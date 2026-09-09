import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, PlusCircle, Eye, FileText, Users, LogOut, Mic, BookOpen, ClipboardList, Menu, X } from 'lucide-react'

export default function Sidebar() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const teacherNav = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/teacher' },
    { icon: PlusCircle, label: 'Create Exam', path: '/teacher/create-exam' },
    { icon: Eye, label: 'Monitor', path: '/teacher/monitor' },
    { icon: FileText, label: 'Submissions', path: '/teacher/submissions' },
  ]
  const studentNav = [
    { icon: LayoutDashboard, label: 'Home', path: '/student' },
    { icon: BookOpen, label: 'Join Exam', path: '/student/join' },
    { icon: ClipboardList, label: 'My Results', path: '/student/results' },
  ]
  const adminNav = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
    { icon: Users, label: 'Users', path: '/admin/users' },
    { icon: FileText, label: 'All Exams', path: '/admin/exams' },
  ]

  const navItems = profile?.role === 'teacher' ? teacherNav : profile?.role === 'student' ? studentNav : adminNav
  const initials = profile?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'U'
  const roleLabel = profile?.role === 'teacher' ? 'Teacher Panel' : profile?.role === 'student' ? 'Student Panel' : 'Admin Panel'

  const handleNav = (path: string) => {
    navigate(path)
    setMobileOpen(false)
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full" style={{ background: '#0A1628' }}>
      {/* Logo */}
      <div className="px-6 py-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Mic size={18} color="white" />
          </div>
          <div>
            <div className="text-white font-semibold text-lg leading-tight">SwarLekh</div>
            <div className="text-xs" style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>Accessible Exams</div>
          </div>
        </div>
        <button onClick={() => setMobileOpen(false)} className="lg:hidden text-white/60 hover:text-white p-1">
          <X size={20} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="text-xs font-semibold uppercase tracking-widest px-3 mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {roleLabel}
        </div>
        {navItems.map(item => {
          const active = location.pathname === item.path
          return (
            <button key={item.path} onClick={() => handleNav(item.path)}
              aria-current={active ? 'page' : undefined}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all"
              style={{ background: active ? 'rgba(37,99,235,0.25)' : 'transparent', color: active ? 'white' : 'rgba(255,255,255,0.55)' }}>
              <item.icon size={18} color={active ? '#60A5FA' : 'rgba(255,255,255,0.45)'} />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* User */}
      <div className="px-4 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">{initials}</div>
          <div className="min-w-0">
            <div className="text-white text-sm font-medium truncate">{profile?.name}</div>
            <div className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{profile?.role} · {profile?.institution}</div>
          </div>
        </div>
        <button onClick={signOut} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all" style={{ color: 'rgba(255,255,255,0.55)' }}>
          <LogOut size={16} />Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col fixed top-0 left-0 h-screen w-64 z-50">
        <SidebarContent />
      </aside>

      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3" style={{ background: '#0A1628', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Mic size={16} color="white" />
          </div>
          <span className="text-white font-semibold">SwarLekh</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="text-white p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.1)' }} aria-label="Open menu">
          <Menu size={22} />
        </button>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-72 flex-shrink-0 flex flex-col shadow-2xl">
            <SidebarContent />
          </div>
          <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  )
}
