import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Users, FileText, GraduationCap, BookOpen, Shield, CheckCircle, XCircle, Clock } from 'lucide-react'
import Layout from '../../components/layout/Layout'
import toast from 'react-hot-toast'

export default function AdminDashboard() {
  const [users, setUsers] = useState<any[]>([])
  const [exams, setExams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'users' | 'exams' | 'approvals'>('overview')
  const [approving, setApproving] = useState<string | null>(null)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const [{ data: u }, { data: e }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('exams').select('*, teacher:profiles(name)').order('created_at', { ascending: false }),
    ])
    setUsers(u || [])
    setExams(e || [])
    setLoading(false)
  }

  const pendingTeachers = users.filter(u => u.role === 'teacher' && u.status === 'pending')
  const approvedTeachers = users.filter(u => u.role === 'teacher' && u.status !== 'pending')

  const approveTeacher = async (userId: string) => {
    setApproving(userId)
    const { error } = await supabase.from('profiles').update({ status: 'approved' }).eq('id', userId)
    if (error) { toast.error('Failed to approve'); setApproving(null); return }
    toast.success('Teacher approved!')
    fetchData()
    setApproving(null)
  }

  const rejectTeacher = async (userId: string) => {
    setApproving(userId)
    const { error } = await supabase.from('profiles').update({ status: 'rejected' }).eq('id', userId)
    if (error) { toast.error('Failed to reject'); setApproving(null); return }
    toast.success('Teacher rejected')
    fetchData()
    setApproving(null)
  }

  const stats = [
    { label: 'Total Users', value: users.length, icon: Users, color: 'bg-blue-100 text-blue-600' },
    { label: 'Teachers', value: users.filter(u => u.role === 'teacher').length, icon: GraduationCap, color: 'bg-purple-100 text-purple-600' },
    { label: 'Students', value: users.filter(u => u.role === 'student').length, icon: BookOpen, color: 'bg-green-100 text-green-600' },
    { label: 'Total Exams', value: exams.length, icon: FileText, color: 'bg-amber-100 text-amber-600' },
    { label: 'Pending Approval', value: pendingTeachers.length, icon: Clock, color: 'bg-red-100 text-red-600' },
  ]

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'approvals', label: `Approvals ${pendingTeachers.length > 0 ? `(${pendingTeachers.length})` : ''}` },
    { id: 'users', label: 'Users' },
    { id: 'exams', label: 'Exams' },
  ] as const

  return (
    <Layout>
      <div className="p-6 lg:p-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Admin Panel</h1>
        <p className="text-gray-500 mb-6">System overview and management</p>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4 mb-6">
          {stats.map(s => (
            <div key={s.label} className="card-p flex flex-col items-center text-center gap-2">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.color}`}><s.icon size={20} /></div>
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
              <div className="text-gray-500 text-xs">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap transition-all ${tab === t.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-200'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? <div className="text-center py-12 text-gray-400">Loading...</div> : (
          <>
            {/* Overview */}
            {tab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card-p">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Users</h2>
                  <div className="space-y-3">
                    {users.slice(0, 6).map(u => (
                      <div key={u.id} className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm flex-shrink-0">
                          {u.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 truncate">{u.name}</div>
                          <div className="text-xs text-gray-500 truncate">{u.institution}</div>
                        </div>
                        <span className={u.role === 'teacher' ? 'badge-blue' : u.role === 'admin' ? 'badge-red' : 'badge-green'}>{u.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="card-p">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Exams</h2>
                  <div className="space-y-3">
                    {exams.slice(0, 6).map(e => (
                      <div key={e.id} className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                          <FileText size={16} className="text-green-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 truncate">{e.title}</div>
                          <div className="text-xs text-gray-500">{e.subject} • {(e.teacher as any)?.name}</div>
                        </div>
                        <span className={e.status === 'active' ? 'badge-green' : 'badge-gray'}>{e.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Approvals */}
            {tab === 'approvals' && (
              <div className="card-p">
                <h2 className="text-lg font-semibold text-gray-900 mb-5">Teacher Approval Requests</h2>
                {pendingTeachers.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle size={40} className="text-green-300 mx-auto mb-3" />
                    <p className="text-gray-500">No pending approvals</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingTeachers.map(teacher => (
                      <div key={teacher.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 font-semibold flex-shrink-0">
                            {teacher.name?.charAt(0)?.toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{teacher.name}</div>
                            <div className="text-sm text-gray-500">{teacher.email}</div>
                            <div className="text-xs text-gray-400">{teacher.institution}</div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => approveTeacher(teacher.id)} disabled={approving === teacher.id}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-all">
                            <CheckCircle size={16} />{approving === teacher.id ? 'Approving...' : 'Approve'}
                          </button>
                          <button onClick={() => rejectTeacher(teacher.id)} disabled={approving === teacher.id}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-red-100 text-red-600 hover:bg-red-200 transition-all">
                            <XCircle size={16} />Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {approvedTeachers.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">Approved Teachers</h3>
                    <div className="space-y-2">
                      {approvedTeachers.map(teacher => (
                        <div key={teacher.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-semibold text-xs flex-shrink-0">
                              {teacher.name?.charAt(0)?.toUpperCase()}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{teacher.name}</div>
                              <div className="text-xs text-gray-500">{teacher.institution}</div>
                            </div>
                          </div>
                          <span className="badge-green text-xs">Approved</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Users */}
            {tab === 'users' && (
              <div className="card-p">
                <h2 className="text-lg font-semibold text-gray-900 mb-5">All Users ({users.length})</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        {['Name', 'Email', 'Role', 'Institution', 'Joined'].map(h => (
                          <th key={h} className="text-left py-3 px-3 text-gray-500 font-medium text-xs uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-3 font-medium text-gray-900">{u.name}</td>
                          <td className="py-3 px-3 text-gray-500 text-xs">{u.email}</td>
                          <td className="py-3 px-3">
                            <span className={u.role === 'teacher' ? 'badge-blue' : u.role === 'admin' ? 'badge-red' : 'badge-green'}>{u.role}</span>
                          </td>
                          <td className="py-3 px-3 text-gray-500 text-xs">{u.institution}</td>
                          <td className="py-3 px-3 text-gray-500 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Exams */}
            {tab === 'exams' && (
              <div className="card-p">
                <h2 className="text-lg font-semibold text-gray-900 mb-5">All Exams ({exams.length})</h2>
                <div className="space-y-3">
                  {exams.map(e => (
                    <div key={e.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-gray-200 gap-2">
                      <div>
                        <div className="font-semibold text-gray-900">{e.title}</div>
                        <div className="text-sm text-gray-500">{e.subject} • {e.exam_type} • {(e.teacher as any)?.name}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-blue-600 font-bold">{e.session_code}</span>
                        <span className={e.status === 'active' ? 'badge-green' : 'badge-gray'}>{e.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
