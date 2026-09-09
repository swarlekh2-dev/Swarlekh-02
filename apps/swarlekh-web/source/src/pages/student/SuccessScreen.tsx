import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'

const speak = (text: string) => {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'mr-IN'; u.rate = 0.85
  window.speechSynthesis.speak(u)
}

export default function SuccessScreen() {
  const navigate = useNavigate()
  useEffect(() => {
    speak('Congratulations! Your exam has been submitted successfully. Your teacher will receive your answers shortly.')
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(135deg,#0A1628,#1E3A5F)' }}>
      <div className="text-center max-w-md">
        <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl">
          <CheckCircle size={48} color="white" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-3">Exam Submitted!</h1>
        <p className="text-white/60 text-xl mb-8 leading-relaxed">Your answers have been recorded and sent to your teacher successfully.</p>
        <div className="bg-white/10 rounded-2xl p-6 mb-8 text-left space-y-3">
          <div className="flex justify-between">
            <span className="text-white/50">Status</span>
            <span className="text-green-400 font-semibold">✓ Submitted</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">Submitted at</span>
            <span className="text-white font-medium">{new Date().toLocaleTimeString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/50">PDF Status</span>
            <span className="text-green-400 font-semibold">✓ Sent to Teacher</span>
          </div>
        </div>
        <button onClick={() => navigate('/student')}
          className="w-full py-4 rounded-2xl font-semibold text-xl transition-all"
          style={{ background: '#2563EB', color: 'white' }}>
          Back to Home
        </button>
      </div>
    </div>
  )
}
