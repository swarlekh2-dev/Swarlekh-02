import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

export type UserRole = 'teacher' | 'student' | 'admin'

export interface Profile {
  id: string
  name: string
  email: string
  role: UserRole
  institution: string
  created_at: string
  // Teachers require admin approval before they can create/run exams.
  // Students and admins are approved automatically (see ADD_FEATURES.sql).
  approved?: boolean
}

export type GradingMode = 'manual' | 'ai' | 'hybrid'

export interface Exam {
  id: string
  teacher_id: string
  title: string
  subject: string
  institution: string
  exam_type: string
  duration_minutes: number
  session_code: string
  status: 'draft' | 'active' | 'closed'
  questions: Question[]
  created_at: string
  teacher?: Profile
  // Grading mode for this exam. 'manual' = teacher grades by hand (default,
  // works today with no extra setup). 'ai' / 'hybrid' are recognized by the
  // Supabase schema and this UI, but actually producing ai_score/ai_feedback
  // requires the Lemma grading_agent pod to be running and wired in — see
  // LEMMA_INTEGRATION.md. Until then, ai/hybrid exams simply show
  // "not graded yet" for every answer.
  grading_mode?: GradingMode
  // Set once this exam has been mirrored into the Lemma pod for AI grading.
  // lemma_question_ids maps a local question id (e.g. "q-1") to the pod's
  // own questions.id (UUID). See src/lib/lemma.ts.
  lemma_exam_id?: string | null
  lemma_question_ids?: Record<string, string>
}

export interface Question {
  id: string
  type: 'mcq' | 'fill_blank' | 'descriptive' | 'true_false' | 'short_answer'
  question: string
  options?: string[]
  correct_answer?: string
  marks: number
  // Optional grading aids, used by manual grading and (once wired) by the
  // Lemma grading_agent's short_answer/descriptive rubric.
  keywords?: string[]
  model_answer?: string
}

// Per-question grading record, keyed by question id, stored in
// exam_sessions.grading (jsonb). ai_score/ai_feedback are populated by the
// Lemma grading_agent once wired; manual_score/teacher_remarks are entered
// by the teacher in the Submissions UI; final_score is what's shown to the
// student (manual_score wins if present, else ai_score in 'ai' mode).
export interface QuestionGrade {
  ai_score?: number
  ai_feedback?: string
  manual_score?: number
  teacher_remarks?: string
  final_score?: number
}

export interface ExamSession {
  id: string
  exam_id: string
  student_id: string
  answers: Record<string, string>
  grading?: Record<string, QuestionGrade>
  status: 'joined' | 'in_progress' | 'submitted'
  submitted_at?: string
  created_at: string
  exam?: Exam
  student?: Profile
  // Mirror refs into the Lemma pod, set once AI grading has been run for
  // this session. lemma_answer_ids maps a local question id to the pod's
  // student_answers.id (UUID). See src/lib/lemma.ts.
  lemma_session_id?: string | null
  lemma_answer_ids?: Record<string, string>
}
