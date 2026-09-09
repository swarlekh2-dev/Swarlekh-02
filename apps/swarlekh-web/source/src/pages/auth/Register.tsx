import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Mic, Eye, EyeOff, GraduationCap, BookOpen } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', institution: '', role: 'student' as 'teacher' | 'student' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.password || !form.institution) { toast.error('Please fill all fields'); return }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    if (form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return }
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email: form.email, password: form.password,
      options: { data: { name: form.name, role: form.role, institution: form.institution } }
    })
    if (error) { toast.error(error.message); setLoading(false); return }
    toast.success(form.role === 'teacher' ? 'Account created! Waiting for admin approval.' : 'Account created! Welcome to SwarLekh.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12" style={{ background: 'linear-gradient(135deg,#0A1628,#1E3A5F,#0A1628)' }}>
      <div className="w-full max-w-lg">
        {/* Mobile Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <Mic size={20} color="white" />
          </div>
          <span className="text-2xl font-bold text-white">SwarLekh</span>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Create Account</h2>
          <p className="text-gray-500 mb-6">Join the accessible exam platform</p>

          {/* Role Selector */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {([
              { role: 'student', icon: BookOpen, label: 'Student', desc: 'Give voice exams' },
              { role: 'teacher', icon: GraduationCap, label: 'Teacher', desc: 'Create & monitor exams' },
            ] as const).map(({ role, icon: Icon, label, desc }) => (
              <button key={role} type="button" onClick={() => setForm(f => ({ ...f, role }))}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${form.role === role ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <Icon size={24} className={form.role === role ? 'text-blue-600' : 'text-gray-400'} />
                <div>
                  <div className={`font-semibold text-sm ${form.role === role ? 'text-blue-600' : 'text-gray-600'}`}>{label}</div>
                  <div className="text-xs text-gray-400">{desc}</div>
                </div>
              </button>
            ))}
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            {[
              { id: 'name', label: 'Full Name', type: 'text', placeholder: 'Enter your full name' },
              { id: 'email', label: 'Email Address', type: 'email', placeholder: 'you@example.com' },
              { id: 'institution', label: 'School / College / Institution', type: 'text', placeholder: 'e.g. Ferguson College, Pune' },
            ].map(field => (
              <div key={field.id}>
                <label htmlFor={field.id} className="block text-sm font-medium text-gray-700 mb-1.5">{field.label}</label>
                <input id={field.id} type={field.type} placeholder={field.placeholder}
                  value={(form as any)[field.id]} onChange={e => setForm(f => ({ ...f, [field.id]: e.target.value }))}
                  className="input-field" aria-required="true" />
              </div>
            ))}

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input id="password" type={showPass ? 'text' : 'password'} placeholder="Min 6 characters"
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="input-field pr-12" aria-required="true" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
              <input id="confirmPassword" type="password" placeholder="Re-enter password"
                value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                className="input-field" aria-required="true" />
            </div>

            {form.role === 'teacher' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                ⚠️ Teacher accounts require admin approval before you can create exams.
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Creating account...' : `Create ${form.role === 'teacher' ? 'Teacher' : 'Student'} Account`}
            </button>
          </form>

          <p className="text-center text-gray-500 mt-4 text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
