# input_type_name: ExtractPdfQuestionsInput
# output_type_name: ExtractPdfQuestionsResult
# function_name: extract_pdf_questions
#
# Heuristic splitter for question-paper text (spec sections 15-16). Stdlib
# regex only, deliberately — no OCR/layout model here. Input is plain text
# already extracted from the PDF (e.g. by pdf.js or a text-layer extraction
# step on upload); this function's job is purely: find question boundaries,
# guess a type, and flag anything it isn't confident about so the teacher
# reviews before anything is saved. It never writes to the database.

import re
from typing import List, Optional

from pydantic import BaseModel
from lemma_sdk import FunctionContext

# Matches a new question start: "1.", "Q1.", "Q1)", "1)" at line start.
_QUESTION_START = re.compile(r"^\s*(?:Q\.?\s*)?(\d{1,3})[\.\)]\s+", re.MULTILINE)
# MCQ option lines: "(a)", "a)", "A.", "(A)" at line start.
_OPTION_LINE = re.compile(r"^\s*[\(\[]?([a-dA-D])[\)\.\]]\s+(.*)$", re.MULTILINE)
# Marks annotations: "[5 marks]", "(5 Marks)", "[5M]".
_MARKS = re.compile(r"[\[\(]\s*(\d+(?:\.\d+)?)\s*(?:marks?|m)\s*[\]\)]", re.IGNORECASE)
_TRUE_FALSE_HINT = re.compile(r"\btrue\s*/\s*false\b", re.IGNORECASE)
_FILL_BLANK_HINT = re.compile(r"_{3,}|\bfill in the blank")
_ODD_ONE_OUT_HINT = re.compile(r"\bodd one out\b", re.IGNORECASE)


class ExtractPdfQuestionsInput(BaseModel):
    text: str


class ExtractedQuestion(BaseModel):
    order_index: int
    raw_number: Optional[str] = None
    text: str
    guessed_type: str
    options: List[str] = []
    marks: Optional[float] = None
    confidence: str  # "high" | "low"
    notes: Optional[str] = None


class ExtractPdfQuestionsResult(BaseModel):
    questions: List[ExtractedQuestion]
    warning: Optional[str] = None


def _guess_type(body: str, options: List[str]) -> tuple[str, str]:
    if options:
        return "mcq", "high"
    if _TRUE_FALSE_HINT.search(body):
        return "true_false", "high"
    if _FILL_BLANK_HINT.search(body):
        return "fill_blank", "high"
    if _ODD_ONE_OUT_HINT.search(body):
        return "odd_one_out", "high"
    word_count = len(body.split())
    if word_count <= 6:
        return "one_word", "low"
    if word_count <= 25:
        return "short_answer", "low"
    return "descriptive", "low"


async def extract_pdf_questions(
    ctx: FunctionContext, data: ExtractPdfQuestionsInput
) -> ExtractPdfQuestionsResult:
    text = data.text.strip()
    if not text:
        return ExtractPdfQuestionsResult(
            questions=[], warning="Empty input text; nothing to extract."
        )

    starts = list(_QUESTION_START.finditer(text))
    if not starts:
        # Couldn't find numbered questions at all: return the whole thing as
        # one low-confidence block rather than silently dropping the upload
        # (spec section 16: never lose the uploaded content).
        return ExtractPdfQuestionsResult(
            questions=[
                ExtractedQuestion(
                    order_index=1,
                    text=text,
                    guessed_type="custom",
                    confidence="low",
                    notes="Could not detect numbered questions. Teacher must split manually.",
                )
            ],
            warning="No question numbering pattern detected.",
        )

    results: List[ExtractedQuestion] = []
    for i, match in enumerate(starts):
        block_start = match.end()
        block_end = starts[i + 1].start() if i + 1 < len(starts) else len(text)
        block = text[block_start:block_end].strip()

        marks_match = _MARKS.search(block)
        marks = float(marks_match.group(1)) if marks_match else None

        option_matches = _OPTION_LINE.findall(block)
        options = [opt_text.strip() for _, opt_text in option_matches]

        # Question body is everything before the first option line / marks tag.
        body = block
        if option_matches:
            first_option_pos = _OPTION_LINE.search(block).start()
            body = block[:first_option_pos].strip()
        if marks_match:
            body = body[: marks_match.start()].strip() if marks_match.start() < len(body) else body

        guessed_type, confidence = _guess_type(body, options)
        notes = None
        if confidence == "low":
            notes = "Question type could not be confidently detected."

        results.append(
            ExtractedQuestion(
                order_index=i + 1,
                raw_number=match.group(1),
                text=body or block,
                guessed_type=guessed_type,
                options=options,
                marks=marks,
                confidence=confidence,
                notes=notes,
            )
        )

    return ExtractPdfQuestionsResult(questions=results)
