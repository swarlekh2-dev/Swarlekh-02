import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Mic, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { toast.error('Please fill all fields'); return }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { toast.error(error.message); setLoading(false); return }
    toast.success('Welcome back!')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row" style={{ background: 'linear-gradient(135deg,#0A1628 0%,#1E3A5F 50%,#0A1628 100%)' }}>

      {/* Left — Hero (hidden on mobile) */}
      <div className="hidden lg:flex flex-col justify-center px-16 w-1/2 text-white">
        <div className="flex items-center gap-4 mb-10">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center">
            <Mic size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold">SwarLekh</h1>
            <p className="text-blue-300 text-sm">Accessible Exam Platform</p>
          </div>
        </div>
        <h2 className="text-5xl font-bold leading-tight mb-6">Every student deserves to be heard</h2>
        <p className="text-white/60 text-xl leading-relaxed">AI-powered voice examination for visually impaired students. Speak your answers in Marathi or English.</p>
        <div className="mt-10 grid grid-cols-3 gap-6">
          {[['8.8L+', 'Visually Impaired Students'], ['3,500+', 'Colleges in Maharashtra'], ['0', 'Scribes Needed']].map(([num, label]) => (
            <div key={label} className="bg-white/5 rounded-xl p-4 backdrop-blur">
              <div className="text-2xl font-bold text-blue-300">{num}</div>
              <div className="text-white/50 text-sm mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right — Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="flex items-center justify-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Mic size={20} color="white" />
            </div>
            <span className="text-2xl font-bold text-white">SwarLekh</span>
          </div>

          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h2>
            <p className="text-gray-500 mb-8">Sign in to continue to your dashboard</p>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="input-field" placeholder="you@example.com"
                  autoComplete="email" aria-required="true" />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <input id="password" type={showPass ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)} className="input-field pr-12"
                    placeholder="Enter your password" autoComplete="current-password" aria-required="true" />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showPass ? 'Hide password' : 'Show password'}>
                    {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Signing in...' : 'Sign In →'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-gray-500 text-sm">
                New to SwarLekh?{' '}
                <Link to="/register" className="text-blue-600 font-medium hover:underline">Create account</Link>
              </p>
            </div>

            {/* Role hint */}
            <div className="mt-6 p-4 bg-blue-50 rounded-xl">
              <p className="text-xs text-blue-600 text-center font-medium">
                🎯 Your dashboard opens automatically based on your role
              </p>
              <div className="flex justify-center gap-4 mt-2 text-xs text-blue-500">
                <span>👨‍🏫 Teacher</span>
                <span>👨‍🎓 Student</span>
                <span>🛡️ Admin</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
