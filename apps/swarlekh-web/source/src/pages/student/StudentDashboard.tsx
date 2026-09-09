import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Clock, CheckCircle, Mic, ArrowRight } from 'lucide-react'
import Layout from '../../components/layout/Layout'

export default function StudentDashboard() {
  const { profile } = useAuth()
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { if (profile?.id) fetchSessions() }, [profile])

  const fetchSessions = async () => {
    const { data } = await supabase.from('exam_sessions').select('*, exam:exams(*)').eq('student_id', profile!.id).order('created_at', { ascending: false })
    setSessions(data || [])
    setLoading(false)
  }

  const stats = [
    { label: 'Exams Given', value: sessions.length, icon: BookOpen, color: 'bg-blue-100 text-blue-600' },
    { label: 'Submitted', value: sessions.filter(s => s.status === 'submitted').length, icon: CheckCircle, color: 'bg-green-100 text-green-600' },
    { label: 'In Progress', value: sessions.filter(s => s.status === 'in_progress').length, icon: Clock, color: 'bg-amber-100 text-amber-600' },
  ]

  return (
    <Layout>
      <div className="p-6 lg:p-8">
        {/* Welcome Card */}
        <div className="rounded-2xl p-6 lg:p-8 mb-6 text-white" style={{ background: 'linear-gradient(135deg,#0A1628,#1E3A5F)' }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Mic size={18} />
            </div>
            <span className="text-blue-300 font-medium text-sm">SwarLekh</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold mb-1">Welcome, {profile?.name?.split(' ')[0]}!</h1>
          <p className="text-white/60 mb-6 text-sm lg:text-base">{profile?.institution}</p>
          <button onClick={() => navigate('/student/join')}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl text-base transition-all w-full sm:w-auto justify-center sm:justify-start">
            <BookOpen size={20} />Join Exam with Code<ArrowRight size={18} />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 lg:gap-4 mb-6">
          {stats.map(s => (
            <div key={s.label} className="card-p flex flex-col lg:flex-row items-center lg:items-center gap-2 lg:gap-4 text-center lg:text-left">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.color}`}>
                <s.icon size={20} />
              </div>
              <div>
                <div className="text-2xl lg:text-3xl font-bold text-gray-900">{s.value}</div>
                <div className="text-gray-500 text-xs lg:text-sm">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Recent Exams */}
        <div className="card-p">
          <h2 className="text-lg lg:text-xl font-semibold text-gray-900 mb-5">Recent Exams</h2>
          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">No exams taken yet</p>
              <button onClick={() => navigate('/student/join')} className="btn-primary">Join Your First Exam</button>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.slice(0, 5).map(session => (
                <div key={session.id} className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-blue-200 transition-all">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-gray-900 text-sm lg:text-base truncate">{session.exam?.title}</div>
                    <div className="text-xs lg:text-sm text-gray-500">{session.exam?.subject} • {new Date(session.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    {session.status === 'in_progress' && (
                      <button onClick={() => navigate(`/student/exam/${session.id}`)} className="btn-primary text-xs px-3 py-1.5 min-h-0">Continue</button>
                    )}
                    <span className={session.status === 'submitted' ? 'badge-green' : session.status === 'in_progress' ? 'badge-amber' : 'badge-blue'}>
                      {session.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
