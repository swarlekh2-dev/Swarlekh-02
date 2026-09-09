import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import TeacherDashboard from './pages/teacher/TeacherDashboard'
import CreateExam from './pages/teacher/CreateExam'
import Submissions from './pages/teacher/Submissions'
import Monitor from './pages/teacher/Monitor'
import StudentDashboard from './pages/student/StudentDashboard'
import JoinExam from './pages/student/JoinExam'
import ExamInterface from './pages/student/ExamInterface'
import SuccessScreen from './pages/student/SuccessScreen'
import Results from './pages/student/Results'
import AdminDashboard from './pages/admin/AdminDashboard'

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: string }) {
  const { user, profile, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A1628' }}>
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <div className="text-white text-lg">Loading SwarLekh...</div>
      </div>
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (role && profile?.role !== role) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { user, profile, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A1628' }}>
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <div className="text-white text-lg">Loading...</div>
      </div>
    </div>
  )

  return (
    <Routes>
      {/* Auth */}
      <Route path="/login" element={!user ? <Login /> : <Navigate to={`/${profile?.role || 'student'}`} replace />} />
      <Route path="/register" element={!user ? <Register /> : <Navigate to={`/${profile?.role || 'student'}`} replace />} />

      {/* Teacher */}
      <Route path="/teacher" element={<ProtectedRoute role="teacher"><TeacherDashboard /></ProtectedRoute>} />
      <Route path="/teacher/create-exam" element={<ProtectedRoute role="teacher"><CreateExam /></ProtectedRoute>} />
      <Route path="/teacher/monitor" element={<ProtectedRoute role="teacher"><Monitor /></ProtectedRoute>} />
      <Route path="/teacher/submissions" element={<ProtectedRoute role="teacher"><Submissions /></ProtectedRoute>} />
      <Route path="/teacher/submissions/:examId" element={<ProtectedRoute role="teacher"><Submissions /></ProtectedRoute>} />

      {/* Student */}
      <Route path="/student" element={<ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>} />
      <Route path="/student/join" element={<ProtectedRoute role="student"><JoinExam /></ProtectedRoute>} />
      <Route path="/student/results" element={<ProtectedRoute role="student"><Results /></ProtectedRoute>} />
      <Route path="/student/exam/:sessionId" element={<ProtectedRoute role="student"><ExamInterface /></ProtectedRoute>} />
      <Route path="/student/success" element={<ProtectedRoute role="student"><SuccessScreen /></ProtectedRoute>} />

      {/* Admin */}
      <Route path="/admin" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/exams" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />

      {/* Default */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-right" toastOptions={{
          duration: 3000,
          style: { fontSize: '15px', borderRadius: '12px', padding: '14px 18px' }
        }} />
      </AuthProvider>
    </BrowserRouter>
  )
}
