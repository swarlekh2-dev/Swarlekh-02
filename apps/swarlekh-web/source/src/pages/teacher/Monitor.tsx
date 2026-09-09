import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { Eye, Users, Clock, CheckCircle, RefreshCw } from 'lucide-react'
import Layout from '../../components/layout/Layout'

export default function Monitor() {
  const { profile } = useAuth()
  const [exams, setExams] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [selectedExam, setSelectedExam] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  useEffect(() => { if (profile?.id) fetchActiveExams() }, [profile])
  useEffect(() => { if (selectedExam) fetchLiveSessions(selectedExam) }, [selectedExam])

  // Auto refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedExam) { fetchLiveSessions(selectedExam); setLastRefresh(new Date()) }
    }, 30000)
    return () => clearInterval(interval)
  }, [selectedExam])

  const fetchActiveExams = async () => {
    const { data } = await supabase.from('exams').select('*')
      .eq('teacher_id', profile!.id).eq('status', 'active')
      .order('created_at', { ascending: false })
    setExams(data || [])
    if (data && data.length > 0) setSelectedExam(data[0].id)
    setLoading(false)
  }

  const fetchLiveSessions = async (examId: string) => {
    const { data } = await supabase.from('exam_sessions')
      .select('*, student:profiles(*)')
      .eq('exam_id', examId)
      .order('created_at', { ascending: false })
    setSessions(data || [])
  }

  const statusColor = (status: string) => {
    if (status === 'submitted') return 'badge-green'
    if (status === 'in_progress') return 'badge-blue'
    return 'badge-amber'
  }

  const currentExam = exams.find(e => e.id === selectedExam)
  const submitted = sessions.filter(s => s.status === 'submitted').length
  const inProgress = sessions.filter(s => s.status === 'in_progress').length

  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Live Monitor</h1>
            <p className="text-gray-500 mt-1">Real-time exam progress tracking</p>
          </div>
          <button onClick={() => { if (selectedExam) { fetchLiveSessions(selectedExam); setLastRefresh(new Date()) } }}
            className="btn-secondary flex items-center gap-2">
            <RefreshCw size={16} />Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading...</div>
        ) : exams.length === 0 ? (
          <div className="card-p text-center py-16">
            <Eye size={48} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No active exams right now</p>
            <p className="text-gray-400 text-sm mt-2">Activate an exam to see live student progress</p>
          </div>
        ) : (
          <>
            {/* Exam Selector */}
            <div className="card-p mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Active Exam</label>
              <select className="input-field max-w-md" value={selectedExam} onChange={e => setSelectedExam(e.target.value)}>
                {exams.map(e => <option key={e.id} value={e.id}>{e.title} — {e.subject}</option>)}
              </select>
              {currentExam && (
                <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                  <span className="font-mono font-bold text-blue-600 text-lg">{currentExam.session_code}</span>
                  <span>•</span>
                  <span>{currentExam.duration_minutes} min</span>
                  <span>•</span>
                  <span>{currentExam.questions?.length || 0} questions</span>
                  <span className="text-xs text-gray-400 ml-auto">
                    Last refresh: {lastRefresh.toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total Joined', value: sessions.length, icon: Users, color: 'bg-blue-100 text-blue-600' },
                { label: 'In Progress', value: inProgress, icon: Clock, color: 'bg-amber-100 text-amber-600' },
                { label: 'Submitted', value: submitted, icon: CheckCircle, color: 'bg-green-100 text-green-600' },
                { label: 'Completion', value: `${sessions.length > 0 ? Math.round((submitted / sessions.length) * 100) : 0}%`, icon: Eye, color: 'bg-purple-100 text-purple-600' },
              ].map(s => (
                <div key={s.label} className="card-p flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.color}`}>
                    <s.icon size={20} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{s.value}</div>
                    <div className="text-gray-500 text-sm">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Live Students */}
            <div className="card-p">
              <h2 className="text-lg font-semibold text-gray-900 mb-5">
                Live Students ({sessions.length})
              </h2>
              {sessions.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Users size={40} className="mx-auto mb-3 text-gray-300" />
                  <p>No students have joined yet</p>
                  <p className="text-sm mt-1">Share code: <span className="font-mono font-bold text-blue-600">{currentExam?.session_code}</span></p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map(session => (
                    <div key={session.id}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all ${session.status === 'submitted' ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${session.status === 'submitted' ? 'bg-green-500 text-white' : 'bg-blue-100 text-blue-600'}`}>
                          {(session.student as any)?.name?.charAt(0)?.toUpperCase() || 'S'}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{(session.student as any)?.name || 'Student'}</div>
                          <div className="text-sm text-gray-500">
                            {(session.student as any)?.institution} •
                            Joined: {new Date(session.created_at).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {session.status === 'submitted' && session.submitted_at && (
                          <span className="text-xs text-green-600">
                            Submitted {new Date(session.submitted_at).toLocaleTimeString()}
                          </span>
                        )}
                        <span className={statusColor(session.status)}>{session.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
