export type UserRole = 'teacher' | 'student' | 'admin'

export interface Profile {
  id: string
  name: string
  email: string
  role: UserRole
  college: string
  created_at: string
}

export interface Exam {
  id: string
  teacher_id: string
  title: string
  subject: string
  duration_minutes: number
  instructions: string
  questions: Question[]
  session_code: string
  status: 'draft' | 'active' | 'closed'
  paper_url?: string
  created_at: string
  teacher?: Profile
}

export interface Question {
  id: string
  type: 'mcq' | 'fill_blank' | 'descriptive' | 'true_false' | 'short'
  text: string
  marks: number
  options?: string[]
  correct_answer?: string
}

export interface ExamSession {
  id: string
  exam_id: string
  student_id: string
  answers: Record<string, any>
  status: 'joined' | 'in_progress' | 'submitted'
  submitted_at?: string
  created_at: string
  exam?: Exam
  student?: Profile
}
