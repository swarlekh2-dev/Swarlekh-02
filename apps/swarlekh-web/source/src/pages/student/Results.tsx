import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Clock, CheckCircle, BookOpen, ChevronDown, ChevronUp } from 'lucide-react'
import Layout from '../../components/layout/Layout'

export default function Results() {
  const { profile } = useAuth()
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => { if (profile?.id) fetchResults() }, [profile])

  const fetchResults = async () => {
    const { data } = await supabase
      .from('exam_sessions')
      .select('*, exam:exams(*)')
      .eq('student_id', profile!.id)
      .order('created_at', { ascending: false })
    setSessions(data || [])
    setLoading(false)
  }

  const statusColor = (status: string) => {
    if (status === 'submitted') return 'badge-green'
    if (status === 'in_progress') return 'badge-amber'
    return 'badge-blue'
  }

  return (
    <Layout>
      <div className="p-8 max-w-3xl">
        <div className="flex items-center gap-3 mb-2">
          <ClipboardList size={28} className="text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">My Results</h1>
        </div>
        <p className="text-gray-500 mb-8">All your exam history and submissions</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Exams', value: sessions.length, icon: BookOpen, color: 'bg-blue-100 text-blue-600' },
            { label: 'Submitted', value: sessions.filter(s => s.status === 'submitted').length, icon: CheckCircle, color: 'bg-green-100 text-green-600' },
            { label: 'In Progress', value: sessions.filter(s => s.status === 'in_progress').length, icon: Clock, color: 'bg-amber-100 text-amber-600' },
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

        {/* Results List */}
        <div className="card-p">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">Exam History</h2>
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-16">
              <ClipboardList size={48} className="text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg mb-4">No exams taken yet</p>
              <button onClick={() => navigate('/student/join')} className="btn-primary">Join Your First Exam</button>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map(session => (
                <div key={session.id} className="p-5 rounded-xl border border-gray-200 hover:border-blue-200 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 text-lg">{session.exam?.title || 'Exam'}</h3>
                        <span className={statusColor(session.status)}>{session.status}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-500">
                        <span>{session.exam?.subject}</span>
                        <span>•</span>
                        <span>{session.exam?.exam_type}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock size={13} />
                          {new Date(session.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {session.submitted_at && (
                        <div className="text-xs text-green-600 mt-1">
                          ✓ Submitted: {new Date(session.submitted_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {session.status === 'in_progress' && (
                        <button
                          onClick={() => navigate(`/student/exam/${session.id}`)}
                          className="btn-primary text-sm px-4 py-2 min-h-0">
                          Continue
                        </button>
                      )}
                      {session.status === 'submitted' && (
                        <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                          <CheckCircle size={16} />PDF Sent
                        </span>
                      )}
                      {session.status === 'submitted' && (
                        <button onClick={() => setExpandedId(id => id === session.id ? null : session.id)}
                          className="btn-secondary text-sm px-3 py-2 min-h-0 flex items-center gap-1">
                          {expandedId === session.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          Details
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Answer preview */}
                  {session.status === 'submitted' && session.answers && Object.keys(session.answers).length > 0 && expandedId !== session.id && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="text-xs text-gray-400 mb-2">
                        {Object.values(session.answers).filter(Boolean).length} of {session.exam?.questions?.length || 0} questions answered
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className="bg-green-500 h-1.5 rounded-full" style={{
                          width: `${Math.round((Object.values(session.answers).filter(Boolean).length / (session.exam?.questions?.length || 1)) * 100)}%`
                        }} />
                      </div>
                    </div>
                  )}

                  {/* Per-question grading detail */}
                  {expandedId === session.id && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                      {(session.exam?.questions || []).map((q: any, i: number) => {
                        const g = session.grading?.[q.id] || {}
                        const hasScore = g.final_score !== undefined && g.final_score !== null
                        return (
                          <div key={i} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <div className="text-sm font-medium text-gray-700">Q{i+1}: {q.question}</div>
                              <span className="text-xs font-semibold text-gray-600 flex-shrink-0 ml-2">
                                {hasScore ? `${g.final_score}/${q.marks}` : 'Not graded yet'}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 mb-1">{session.answers?.[q.id] || 'No answer'}</div>
                            {g.teacher_remarks && (
                              <div className="text-xs text-blue-700 bg-blue-50 rounded p-2 mt-1">
                                <span className="font-medium">Teacher: </span>{g.teacher_remarks}
                              </div>
                            )}
                            {g.ai_feedback && (
                              <div className="text-xs text-purple-700 bg-purple-50 rounded p-2 mt-1">
                                <span className="font-medium">AI feedback: </span>{g.ai_feedback}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
