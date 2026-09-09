// Wires AI grading to the Lemma pod described in swarlekh-pod/.
//
// WHY THIS FILE EXISTS: exams.grading_mode = 'ai' | 'hybrid' needs a real
// score. That score is produced by swarlekh-pod/agents/grading_agent,
// which reads `questions` and `student_answers` rows from the POD'S OWN
// datastore (not Supabase) and writes results via the record_grade
// function. Supabase and the pod are two separate databases with their
// own auto-generated UUIDs for the same logical exam/question/session/
// answer, so this module's job is: mirror the relevant rows into the pod
// once, trigger grading, then copy the result back into Supabase so the
// rest of the app (which only reads Supabase) can show it.
//
// STATUS: written against the real, published `lemma-sdk` npm package
// (verified types, v0.7.1) and the real table schemas / agent instructions
// in swarlekh-pod/. It has NOT been run against a live pod yet, because
// no pod existed at the time this was written. Once you run
// `lemma pod import ./swarlekh-pod` and get a pod ID, set the three env
// vars below and test end to end — see LEMMA_INTEGRATION.md.
//
// If anything about the pod's actual behavior differs from what's encoded
// here (e.g. record_grade's exact permission errors, or how grading_agent
// expects to be addressed), this is the one file that needs adjusting —
// nothing else in the app depends on Lemma internals.

import { LemmaClient } from 'lemma-sdk'
import { supabase, Exam, ExamSession, Question } from './supabase'

let client: LemmaClient | null = null
let clientInitPromise: Promise<LemmaClient | null> | null = null

/** True once VITE_LEMMA_POD_ID (and the API/auth URLs) are configured. */
export function isLemmaConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_LEMMA_POD_ID &&
    import.meta.env.VITE_LEMMA_API_URL &&
    import.meta.env.VITE_LEMMA_AUTH_URL
  )
}

async function getClient(): Promise<LemmaClient | null> {
  if (!isLemmaConfigured()) return null
  if (client) return client
  if (!clientInitPromise) {
    clientInitPromise = (async () => {
      const c = new LemmaClient({
        apiUrl: import.meta.env.VITE_LEMMA_API_URL,
        authUrl: import.meta.env.VITE_LEMMA_AUTH_URL,
        podId: import.meta.env.VITE_LEMMA_POD_ID,
      })
      await c.initialize()
      client = c
      return c
    })()
  }
  return clientInitPromise
}

// ---------------------------------------------------------------------
// Pod-side profile provisioning
// ---------------------------------------------------------------------
// The pod's exams/questions/exam_sessions rows all have a required foreign
// key to the pod's own `profiles` table. Rather than requiring every
// teacher/student to separately join the Lemma pod (which would add a
// second login step this app was explicitly built to avoid), we upsert a
// lightweight shadow profile in the pod keyed by email the first time we
// need one, and reuse it after that.

const profileIdCache = new Map<string, string>()

async function ensurePodProfileId(
  c: LemmaClient,
  person: { name: string; email: string; role: 'student' | 'teacher' | 'admin'; institution?: string }
): Promise<string> {
  const cached = profileIdCache.get(person.email)
  if (cached) return cached

  const existing = await c.records.query('profiles', {
    filters: [{ field: 'email', op: 'eq', value: person.email }],
    limit: 1,
  })
  const row = existing?.items?.[0] as any
  if (row?.id) {
    profileIdCache.set(person.email, row.id)
    return row.id
  }

  const created = await c.records.create('profiles', {
    name: person.name,
    email: person.email,
    role: person.role,
    institution: person.institution || '',
  })
  profileIdCache.set(person.email, created.id)
  return created.id
}

// ---------------------------------------------------------------------
// Mirror an exam (+ its questions) into the pod, once
// ---------------------------------------------------------------------

export async function mirrorExamForGrading(exam: Exam, teacher: { name: string; email: string; institution?: string }) {
  const c = await getClient()
  if (!c) return null
  if (exam.lemma_exam_id && exam.lemma_question_ids && Object.keys(exam.lemma_question_ids).length === exam.questions.length) {
    // Already mirrored.
    return { examId: exam.lemma_exam_id, questionIds: exam.lemma_question_ids }
  }

  const teacherId = await ensurePodProfileId(c, { ...teacher, role: 'teacher' })

  const podExam = await c.records.create('exams', {
    teacher_id: teacherId,
    title: exam.title,
    subject: exam.subject,
    institution: exam.institution,
    duration_minutes: exam.duration_minutes,
    session_code: exam.session_code,
    status: 'active',
  })

  await c.records.create('grading_configs', {
    exam_id: podExam.id,
    mode: exam.grading_mode || 'manual',
    ai_feedback_enabled: true,
  })

  const questionIds: Record<string, string> = {}
  for (const q of exam.questions) {
    const podQ = await c.records.create('questions', {
      exam_id: podExam.id,
      teacher_id: teacherId,
      type: q.type,
      text: q.question,
      marks: q.marks,
      options: q.options ?? null,
      correct_answer: q.correct_answer ? [q.correct_answer] : null,
      model_answer: q.model_answer || null,
      keywords: q.keywords ?? null,
    })
    questionIds[q.id] = podQ.id
  }

  // Persist the mapping so we never re-create these rows.
  await supabase.from('exams').update({
    lemma_exam_id: podExam.id,
    lemma_question_ids: questionIds,
  }).eq('id', exam.id)

  return { examId: podExam.id, questionIds }
}

// ---------------------------------------------------------------------
// Mirror one student's submitted session + answers, then grade it
// ---------------------------------------------------------------------

export interface GradingRunResult {
  // Keyed by local question id.
  results: Record<string, { ai_score: number; ai_feedback: string }>
  skipped: Record<string, string> // question id -> reason (e.g. manual mode, already graded)
}

/**
 * Mirrors the session/answers if needed, runs the grading agent once per
 * question, and returns the scores it produced. Does NOT write to
 * Supabase itself — call site (Submissions.tsx) merges these into
 * exam_sessions.grading so the existing manual-override UI keeps working.
 */
export async function runAiGrading(
  exam: Exam,
  session: ExamSession,
  teacher: { name: string; email: string; institution?: string },
  student: { name: string; email: string; institution?: string }
): Promise<GradingRunResult> {
  const c = await getClient()
  if (!c) throw new Error('Lemma is not configured (missing VITE_LEMMA_* env vars).')

  const mirrored = await mirrorExamForGrading(exam, teacher)
  if (!mirrored) throw new Error('Could not mirror exam into the Lemma pod.')

  const studentId = await ensurePodProfileId(c, { ...student, role: 'student' })

  let podSessionId = session.lemma_session_id
  let answerIds: Record<string, string> = { ...(session.lemma_answer_ids || {}) }

  if (!podSessionId) {
    const podSession = await c.records.create('exam_sessions', {
      exam_id: mirrored.examId,
      student_id: studentId,
      status: 'submitted',
      submitted_at: session.submitted_at || new Date().toISOString(),
    })
    podSessionId = podSession.id
  }

  const results: GradingRunResult['results'] = {}
  const skipped: GradingRunResult['skipped'] = {}

  for (const q of exam.questions) {
    const answerText = session.answers?.[q.id]
    const podQuestionId = mirrored.questionIds[q.id]
    if (!answerText || !podQuestionId) {
      skipped[q.id] = !answerText ? 'No answer submitted' : 'Question not mirrored'
      continue
    }

    let podAnswerId = answerIds[q.id]
    if (!podAnswerId) {
      const podAnswer = await c.records.create('student_answers', {
        session_id: podSessionId,
        question_id: podQuestionId,
        answer_text: answerText,
        answer_state: 'answered',
      })
      podAnswerId = podAnswer.id
      answerIds[q.id] = podAnswerId
    }

    // Ask the grading agent to grade this specific answer. It reads the
    // question + student_answers rows itself (it has read access to both,
    // per grading_agent.json) and calls record_grade internally.
    await c.agents.run(
      'grading_agent',
      JSON.stringify({ question_id: podQuestionId, session_id: podSessionId, answer_id: podAnswerId })
    )

    // record_grade runs synchronously as a tool call inside the agent's
    // turn, so by the time .run() resolves the pod's student_answers row
    // should already carry ai_score/ai_feedback. Re-fetch to confirm.
    const graded = await c.records.get('student_answers', podAnswerId)
    if (graded?.ai_score !== undefined && graded?.ai_score !== null) {
      results[q.id] = { ai_score: graded.ai_score, ai_feedback: graded.ai_feedback || '' }
    } else {
      skipped[q.id] = 'Agent did not return a score (exam may be in manual mode, or the agent run failed).'
    }
  }

  // Persist mirror refs for next time (avoid re-creating session/answers).
  await supabase.from('exam_sessions').update({
    lemma_session_id: podSessionId,
    lemma_answer_ids: answerIds,
  }).eq('id', session.id)

  return { results, skipped }
}
