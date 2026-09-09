import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { PlusCircle, FileText, Eye, CheckCircle, Clock, Copy } from 'lucide-react'
import Layout from '../../components/layout/Layout'
import toast from 'react-hot-toast'

export default function TeacherDashboard() {
  const { profile } = useAuth()
  const [exams, setExams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { if (profile?.id) fetchExams() }, [profile])

  const fetchExams = async () => {
    const { data } = await supabase.from('exams').select('*').eq('teacher_id', profile!.id).order('created_at', { ascending: false })
    setExams(data || [])
    setLoading(false)
  }

  const copyCode = (code: string) => { navigator.clipboard.writeText(code); toast.success('Code copied!') }

  const stats = [
    { label: 'Total Exams', value: exams.length, icon: FileText, color: 'bg-blue-100 text-blue-600' },
    { label: 'Active', value: exams.filter(e => e.status === 'active').length, icon: Eye, color: 'bg-green-100 text-green-600' },
    { label: 'Closed', value: exams.filter(e => e.status === 'closed').length, icon: CheckCircle, color: 'bg-gray-100 text-gray-600' },
  ]

  return (
    <Layout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 lg:mb-8">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Welcome, {profile?.name?.split(' ')[0]}!</h1>
            <p className="text-gray-500 mt-1 text-sm lg:text-base">{profile?.institution}</p>
          </div>
          <button onClick={() => navigate('/teacher/create-exam')} className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center">
            <PlusCircle size={20} />Create Exam
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 lg:gap-6 mb-6 lg:mb-8">
          {stats.map(s => (
            <div key={s.label} className="card-p flex flex-col lg:flex-row items-center gap-2 lg:gap-4 text-center lg:text-left">
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

        {/* Exams */}
        <div className="card-p">
          <h2 className="text-lg lg:text-xl font-semibold text-gray-900 mb-5">My Exams</h2>
          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : exams.length === 0 ? (
            <div className="text-center py-12">
              <FileText size={40} className="text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">No exams created yet</p>
              <button onClick={() => navigate('/teacher/create-exam')} className="btn-primary">Create First Exam</button>
            </div>
          ) : (
            <div className="space-y-3">
              {exams.map(exam => (
                <div key={exam.id} className="p-4 lg:p-5 rounded-xl border border-gray-200 hover:border-blue-200 transition-all">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900 text-base lg:text-lg">{exam.title}</h3>
                        <span className={exam.status === 'active' ? 'badge-green' : 'badge-gray'}>{exam.status}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs lg:text-sm text-gray-500">
                        <span>{exam.subject}</span>
                        <span>•</span>
                        <span>{exam.exam_type}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1"><Clock size={12} />{exam.duration_minutes} min</span>
                        <span>•</span>
                        <span>{(exam.questions || []).length} questions</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-bold text-blue-600 text-base lg:text-lg tracking-widest">{exam.session_code}</span>
                        <button onClick={() => copyCode(exam.session_code)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400" aria-label="Copy code">
                          <Copy size={14} />
                        </button>
                      </div>
                      <button onClick={() => navigate(`/teacher/submissions/${exam.id}`)} className="btn-secondary text-xs px-3 py-1.5 min-h-0">
                        Submissions
                      </button>
                    </div>
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
