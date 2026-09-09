import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Clock, Users, ArrowRight, Volume2 } from 'lucide-react'
import Layout from '../../components/layout/Layout'
import toast from 'react-hot-toast'

const speak = (text: string) => {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'mr-IN'; u.rate = 0.85
  window.speechSynthesis.speak(u)
}

export default function JoinExam() {
  const { profile } = useAuth()
  const [code, setCode] = useState('')
  const [exam, setExam] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [joining, setJoining] = useState(false)
  const navigate = useNavigate()

  const findExam = async () => {
    if (code.length < 4) { toast.error('Enter valid session code'); return }
    setLoading(true)
    const { data, error } = await supabase.from('exams').select('*').eq('session_code', code.toUpperCase()).eq('status', 'active').single()
    if (error || !data) { toast.error('Exam not found or not active'); setLoading(false); return }
    setExam(data)
    speak(`Exam found. ${data.title}. Subject: ${data.subject}. Duration: ${data.duration_minutes} minutes. ${data.questions?.length || 0} questions. Press Start Exam when ready.`)
    setLoading(false)
  }

  const startExam = async () => {
    if (!exam || !profile) return
    setJoining(true)
    const { data: existing } = await supabase.from('exam_sessions').select('id').eq('exam_id', exam.id).eq('student_id', profile.id).single()
    if (existing) { navigate(`/student/exam/${existing.id}`); return }
    const { data, error } = await supabase.from('exam_sessions').insert({
      exam_id: exam.id, student_id: profile.id, answers: {}, status: 'in_progress'
    }).select().single()
    if (error) { toast.error('Failed to join exam'); setJoining(false); return }
    navigate(`/student/exam/${data.id}`)
    setJoining(false)
  }

  return (
    <Layout>
      <div className="p-6 lg:p-8 max-w-lg">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Join Exam</h1>
        <p className="text-gray-500 mb-8">Enter the session code from your teacher</p>

        <div className="card-p mb-6">
          <label htmlFor="code" className="block text-lg font-medium text-gray-700 mb-3">Session Code</label>
          <input id="code" type="text" value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            className="input-field text-center text-2xl lg:text-3xl font-mono tracking-widest mb-4"
            placeholder="ABC123" maxLength={6}
            style={{ letterSpacing: '8px' }}
            onKeyDown={e => e.key === 'Enter' && findExam()}
            aria-label="Enter 6-character session code" />
          <button onClick={findExam} disabled={loading || code.length < 4} className="btn-primary w-full">
            {loading ? 'Searching...' : 'Find Exam →'}
          </button>
        </div>

        {exam && (
          <div className="card-p border-2 border-blue-200 bg-blue-50">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-blue-600 uppercase tracking-wide">✓ Exam Found</div>
              <button onClick={() => speak(`${exam.title}. ${exam.subject}. ${exam.duration_minutes} minutes.`)}
                className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700">
                <Volume2 size={14} />Read aloud
              </button>
            </div>
            <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-2">{exam.title}</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="badge-blue flex items-center gap-1"><BookOpen size={13} />{exam.subject}</span>
              <span className="badge-blue flex items-center gap-1"><Clock size={13} />{exam.duration_minutes} min</span>
              <span className="badge-blue flex items-center gap-1"><Users size={13} />{exam.questions?.length || 0} questions</span>
              <span className="badge-blue">{exam.exam_type}</span>
            </div>
            <div className="bg-white rounded-xl p-4 mb-5 text-sm text-gray-600">
              <strong className="text-gray-800">Instructions:</strong> Listen to each question. Speak your answer or type it. Say "read question" to hear it again. Say "undo" to remove last sentence.
            </div>
            <button onClick={startExam} disabled={joining} className="btn-success w-full flex items-center justify-center gap-2 text-lg py-4">
              {joining ? 'Starting...' : <><ArrowRight size={22} />Start Exam</>}
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}
