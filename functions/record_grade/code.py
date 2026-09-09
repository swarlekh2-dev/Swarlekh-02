# input_type_name: RecordGradeInput
# output_type_name: RecordGradeResult
# function_name: record_grade
#
# Deterministic grading write-path (spec sections 36-42, 52).
#
# Why this is a plain function and not something the grading_agent writes
# directly: the agent supplies judgment (score + feedback text), but whether
# that judgment is allowed to become the *visible* grade depends on the
# teacher's grading_configs.mode for the exam. That policy check belongs in
# code that always runs the same way, not in an LLM instruction that could in
# principle be talked out of it. This keeps "AI cannot silently override a
# teacher's manual-grading choice" true regardless of what the agent argues.

from typing import Optional

from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod
from lemma_sdk.errors import LemmaAPIError


class RecordGradeInput(BaseModel):
    session_id: str
    question_id: str
    ai_score: float
    ai_feedback: str = ""


class RecordGradeResult(BaseModel):
    denied: bool = False
    status_code: Optional[int] = None
    error_code: Optional[str] = None
    written: bool = False
    reason: Optional[str] = None
    answer_id: Optional[str] = None


async def record_grade(ctx: FunctionContext, data: RecordGradeInput) -> RecordGradeResult:
    pod = Pod.from_env()

    try:
        session = pod.table("exam_sessions").get(data.session_id)
        question = pod.table("questions").get(data.question_id)

        config_rows = pod.table("grading_configs").list(
            filters={"exam_id": session["exam_id"]}
        )
        mode = config_rows[0]["mode"] if config_rows else "manual"

        if mode == "manual":
            return RecordGradeResult(
                written=False,
                reason="Exam is in manual-grading mode; AI score not recorded as final.",
            )

        answer_rows = pod.table("student_answers").list(
            filters={"session_id": data.session_id, "question_id": data.question_id}
        )
        if not answer_rows:
            return RecordGradeResult(written=False, reason="No student_answers row found.")
        answer = answer_rows[0]

        # Never clobber a teacher's own entry, even in hybrid mode.
        if answer.get("manual_score") is not None:
            return RecordGradeResult(
                written=False,
                reason="Teacher already entered a manual score; AI score kept as suggestion only.",
                answer_id=str(answer["id"]),
            )

        max_marks = float(question.get("marks", 0))
        clamped_score = max(0.0, min(data.ai_score, max_marks))

        update = {
            "ai_score": clamped_score,
            "ai_feedback": data.ai_feedback,
        }
        # AI mode: the AI score is authoritative. Hybrid mode: it's a
        # suggestion the teacher must still accept (final_score stays unset
        # until a human confirms it via the grading UI).
        if mode == "ai":
            update["final_score"] = clamped_score

        pod.table("student_answers").update(answer["id"], update)

        return RecordGradeResult(written=True, answer_id=str(answer["id"]))

    except LemmaAPIError as exc:
        return RecordGradeResult(
            denied=True, status_code=exc.status_code, error_code=exc.code
        )
