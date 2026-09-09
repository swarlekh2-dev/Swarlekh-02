import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, ExamSession, Exam, Question } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Mic, MicOff, Volume2, ChevronLeft, ChevronRight, Trash2, RotateCcw, Send, AlertTriangle, Keyboard } from 'lucide-react'
import toast from 'react-hot-toast'

// TTS Helper
const speak = (text: string, lang = 'mr-IN') => {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang
  u.rate = 0.85
  u.pitch = 1.0
  const voices = window.speechSynthesis.getVoices()
  const marathi = voices.find(v => v.lang === 'mr-IN')
  const english = voices.find(v => v.lang === 'en-IN' || v.lang.startsWith('en'))
  u.voice = marathi || english || voices[0] || null
  window.speechSynthesis.speak(u)
}

export default function ExamInterface() {
  const { sessionId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [session, setSession] = useState<ExamSession | null>(null)
  const [exam, setExam] = useState<Exam | null>(null)
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [sentenceBuffers, setSentenceBuffers] = useState<Record<string, string[]>>({})
  const [isRecording, setIsRecording] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [inputMode, setInputMode] = useState<'voice' | 'keyboard'>('voice')
  const [timeLeft, setTimeLeft] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [tabWarnings, setTabWarnings] = useState(0)
  const recognitionRef = useRef<any>(null)
  const timerRef = useRef<any>(null)
  const autoSaveRef = useRef<any>(null)

  useEffect(() => { fetchSession() }, [sessionId])

  useEffect(() => {
    if (exam) {
      setTimeLeft(exam.duration_minutes * 60)
      startTimer()
    }
    return () => { clearInterval(timerRef.current); clearInterval(autoSaveRef.current) }
  }, [exam])

  // Auto save every 30 seconds
  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      if (session) saveAnswers(false)
    }, 30000)
    return () => clearInterval(autoSaveRef.current)
  }, [session, answers])

  // Tab visibility detection
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        setTabWarnings(w => {
          const newW = w + 1
          speak(`Warning. You left the exam. This is warning number ${newW}. Please return immediately.`)
          toast.error(`⚠️ Tab switch detected! Warning ${newW}/3`)
          if (newW >= 3) { speak('Three warnings reached. Exam will be submitted automatically.'); handleSubmit() }
          return newW
        })
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); handleSubmit(); return 0 }
        if (t === 600) speak('10 minutes remaining.')
        if (t === 300) speak('5 minutes remaining. Please complete your answers.')
        if (t === 60) speak('One minute remaining.')
        return t - 1
      })
    }, 1000)
  }

  const fetchSession = async () => {
    const { data: s } = await supabase.from('exam_sessions').select('*, exam:exams(*)').eq('id', sessionId).single()
    if (!s) { toast.error('Session not found'); navigate('/student'); return }
    setSession(s)
    setExam(s.exam as Exam)
    setAnswers(s.answers || {})
    // Restore sentence buffers from answers
    const buffers: Record<string, string[]> = {}
    Object.entries(s.answers || {}).forEach(([k, v]) => {
      if (v) buffers[k] = (v as string).split('. ').filter(Boolean)
    })
    setSentenceBuffers(buffers)
    setLoading(false)
    setTimeout(() => {
      const q = (s.exam as Exam)?.questions?.[0]
      if (q) speak(`Exam started. Question 1. ${q.question}`)
    }, 1000)
  }

  const saveAnswers = async (showToast = true) => {
    if (!session) return
    await supabase.from('exam_sessions').update({ answers, status: 'in_progress' }).eq('id', session.id)
    if (showToast) toast.success('Answers saved')
  }

  const getCurrentQuestion = (): Question | null => exam?.questions?.[currentQ] || null

  const getCurrentBuffer = () => sentenceBuffers[getCurrentQuestion()?.id || ''] || []

  const updateAnswer = (qId: string, text: string, buffer: string[]) => {
    setAnswers(a => ({ ...a, [qId]: text }))
    setSentenceBuffers(b => ({ ...b, [qId]: buffer }))
  }

  // Voice Commands
  const handleVoiceCommand = (transcript: string, qId: string): boolean => {
    const t = transcript.toLowerCase().trim()

    // ERASE WORD - remove only the last word of the last spoken sentence
    if (t.includes('erase word') || t.includes('शब्द काढ') || t.includes('delete word')) {
      const buf = [...getCurrentBuffer()]
      if (buf.length > 0) {
        const words = buf[buf.length - 1].trim().split(/\s+/)
        const removedWord = words.pop()
        if (words.length > 0) {
          buf[buf.length - 1] = words.join(' ')
        } else {
          buf.pop()
        }
        updateAnswer(qId, buf.join('. '), buf)
        speak(removedWord ? `Removed word: ${removedWord}` : 'Nothing to remove')
        toast.success('Last word removed')
      } else {
        speak('Nothing to remove')
      }
      return true
    }

    // ERASE LINE - remove the entire last spoken sentence (distinct alias from "undo")
    if (t.includes('erase line') || t.includes('ओळ काढ') || t.includes('delete line')) {
      const buf = [...getCurrentBuffer()]
      if (buf.length > 0) {
        const removed = buf.pop()!
        updateAnswer(qId, buf.join('. '), buf)
        speak(`Removed line: ${removed}`)
        toast.success('Last line removed')
      } else {
        speak('Nothing to remove')
      }
      return true
    }

    // UNDO last sentence
    if (t.includes('undo') || t.includes('रद्द कर') || t.includes('delete last') || t.includes('मागे')) {
      const buf = [...getCurrentBuffer()]
      if (buf.length > 0) {
        const removed = buf.pop()!
        updateAnswer(qId, buf.join('. '), buf)
        speak(`Removed: ${removed}`)
        toast.success('Last sentence removed')
      } else speak('Nothing to remove')
      return true
    }

    // CLEAR all
    if (t.includes('clear') || t.includes('सगळं काढ') || t.includes('reset') || t.includes('clear all')) {
      updateAnswer(qId, '', [])
      speak('Answer cleared. You can start again.')
      toast.success('Answer cleared')
      return true
    }

    // READ BACK last 2
    if (t.includes('read back') || t.includes('पुन्हा वाच') || t.includes('repeat')) {
      const buf = getCurrentBuffer()
      const last2 = buf.slice(-2).join('. ')
      speak(last2 || 'No answer yet')
      return true
    }

    // READ ALL
    if (t.includes('read all') || t.includes('सगळं वाच') || t.includes('full answer')) {
      const ans = answers[qId]
      speak(ans || 'No answer yet')
      return true
    }

    // READ QUESTION
    if (t.includes('read question') || t.includes('प्रश्न वाच') || t.includes('question again')) {
      const q = getCurrentQuestion()
      if (q) speak(q.question)
      return true
    }

    // NEXT
    if (t.includes('next question') || t.includes('पुढचा') || t.includes('next')) {
      if (currentQ < (exam?.questions?.length || 0) - 1) {
        goToQuestion(currentQ + 1)
        speak(`Moving to question ${currentQ + 2}`)
      } else speak('This is the last question')
      return true
    }

    // PREVIOUS
    if (t.includes('previous') || t.includes('मागचा') || t.includes('go back')) {
      if (currentQ > 0) {
        goToQuestion(currentQ - 1)
        speak(`Going back to question ${currentQ}`)
      } else speak('This is the first question')
      return true
    }

    // SUBMIT
    if (t.includes('submit') || t.includes('जमा कर') || t.includes('finish exam')) {
      speak('Are you sure you want to submit? Say yes to confirm or no to continue.')
      return true
    }
    if (t === 'yes' || t === 'हो') { handleSubmit(); return true }

    return false
  }

  const startRecording = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { toast.error('Voice not supported. Please use keyboard mode.'); setInputMode('keyboard'); return }
    const recognition = new SR()
    recognition.lang = 'mr-IN'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => { setIsRecording(true); setInterimText('') }
    recognition.onend = () => { if (isRecording) recognition.start() }
    recognition.onerror = (e: any) => {
      if (e.error !== 'aborted') { setIsRecording(false); toast.error('Recording stopped. Tap mic to restart.') }
    }
    recognition.onresult = (event: any) => {
      let interim = '', final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript + ' '
        else interim += event.results[i][0].transcript
      }
      setInterimText(interim)
      if (final.trim()) {
        const qId = getCurrentQuestion()?.id
        if (!qId) return
        const isCmd = handleVoiceCommand(final.trim(), qId)
        if (!isCmd) {
          const buf = [...getCurrentBuffer(), final.trim()]
          const text = buf.join('. ')
          updateAnswer(qId, text, buf)
          setInterimText('')
          speak(final.trim())
        }
      }
    }
    recognitionRef.current = recognition
    recognition.start()
  }

  const stopRecording = () => {
    setIsRecording(false)
    setInterimText('')
    if (recognitionRef.current) { recognitionRef.current.onend = null; recognitionRef.current.stop() }
  }

  const toggleRecording = () => { isRecording ? stopRecording() : startRecording() }

  const goToQuestion = (idx: number) => {
    stopRecording()
    setCurrentQ(idx)
    setInterimText('')
    setTimeout(() => {
      const q = exam?.questions?.[idx]
      if (q) speak(`Question ${idx + 1}. ${q.question}`)
    }, 300)
  }

  const handleSubmit = async () => {
    if (submitting) return
    setSubmitting(true)
    stopRecording()
    clearInterval(timerRef.current)
    await supabase.from('exam_sessions').update({
      answers, status: 'submitted', submitted_at: new Date().toISOString()
    }).eq('id', session!.id)
    speak('Exam submitted successfully. Your answers have been sent to your teacher.')
    toast.success('Exam submitted!')
    navigate('/student/success')
    setSubmitting(false)
  }

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-white text-2xl">Loading exam...</div>
    </div>
  )

  const q = getCurrentQuestion()
  const totalQ = exam?.questions?.length || 0
  const answeredCount = Object.values(answers).filter(a => a && a.trim()).length
  const progress = totalQ > 0 ? ((currentQ + 1) / totalQ) * 100 : 0
  const isLast = currentQ === totalQ - 1
  const timerColor = timeLeft < 300 ? '#EF4444' : timeLeft < 600 ? '#F59E0B' : '#60A5FA'

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0A1628' }}>

      {/* Lock Banner */}
      <div className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium" style={{ background: '#D97706', color: 'white' }}>
        <AlertTriangle size={16} />
        Exam in progress — Tab switching is monitored ({tabWarnings}/3 warnings)
      </div>

      {/* Top Bar */}
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div>
          <div className="text-white font-semibold text-lg">{exam?.title}</div>
          <div className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{exam?.subject} • {profile?.name}</div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {answeredCount}/{totalQ} answered
          </div>
          <div className="font-mono text-xl font-bold px-4 py-1.5 rounded-xl" style={{ color: timerColor, background: 'rgba(255,255,255,0.08)', fontFamily: 'monospace' }}>
            {formatTime(timeLeft)}
          </div>
          <button onClick={() => saveAnswers()} className="px-4 py-2 rounded-lg text-sm font-medium transition-all" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}>
            Save
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1.5" style={{ background: 'rgba(255,255,255,0.1)' }}>
        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      {/* Question Dots */}
      <div className="flex gap-2 px-6 py-3 overflow-x-auto" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        {exam?.questions?.map((question, i) => (
          <button key={i} onClick={() => goToQuestion(i)}
            aria-label={`Question ${i + 1}${answers[question.id] ? ' answered' : ''}`}
            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all"
            style={{
              background: i === currentQ ? '#2563EB' : answers[question.id] ? '#16A34A' : 'rgba(255,255,255,0.15)',
              color: 'white',
              transform: i === currentQ ? 'scale(1.15)' : 'scale(1)',
            }}>
            {i + 1}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 p-6 max-w-6xl mx-auto w-full">

        {/* Question Panel */}
        <div className="lg:w-2/5 flex flex-col gap-4">
          <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold font-mono" style={{ color: '#60A5FA' }}>Q{currentQ + 1} of {totalQ}</span>
              <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
                {q?.marks} marks • {q?.type?.replace('_',' ')}
              </span>
            </div>
            <p className="text-white font-medium leading-relaxed" style={{ fontSize: '20px' }}>{q?.question}</p>

            {/* MCQ Options */}
            {q?.type === 'mcq' && q.options && (
              <div className="mt-4 space-y-2">
                {q.options.map((opt, i) => (
                  <button key={i} onClick={() => { updateAnswer(q.id, opt, [opt]); speak(`Selected: ${opt}`) }}
                    className="w-full text-left px-4 py-3 rounded-xl text-sm transition-all"
                    style={{
                      background: answers[q.id] === opt ? '#2563EB' : 'rgba(255,255,255,0.08)',
                      color: 'white', border: answers[q.id] === opt ? '2px solid #60A5FA' : '2px solid transparent'
                    }}>
                    {String.fromCharCode(65 + i)}. {opt}
                  </button>
                ))}
              </div>
            )}

            {/* True/False */}
            {q?.type === 'true_false' && (
              <div className="mt-4 flex gap-3">
                {['True', 'False'].map(opt => (
                  <button key={opt} onClick={() => { updateAnswer(q.id, opt, [opt]); speak(`Selected: ${opt}`) }}
                    className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all"
                    style={{
                      background: answers[q.id] === opt ? (opt === 'True' ? '#16A34A' : '#DC2626') : 'rgba(255,255,255,0.08)',
                      color: 'white', border: `2px solid ${answers[q.id] === opt ? 'transparent' : 'rgba(255,255,255,0.2)'}`
                    }}>
                    {opt}
                  </button>
                ))}
              </div>
            )}

            <button onClick={() => q && speak(q.question)}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all w-full justify-center"
              style={{ background: 'rgba(37,99,235,0.25)', color: '#93C5FD' }}
              aria-label="Read question aloud">
              <Volume2 size={16} />Read Question Aloud
            </button>
          </div>

          {/* Voice Commands Reference */}
          <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="text-xs font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>🗣️ VOICE COMMANDS</div>
            {[
              ['"erase word" / "शब्द काढ"', 'Remove last word only'],
              ['"erase line" / "ओळ काढ"', 'Remove last full line'],
              ['"undo" / "रद्द कर"', 'Remove last sentence'],
              ['"clear" / "सगळं काढ"', 'Clear all answer'],
              ['"read back" / "पुन्हा वाच"', 'Hear last 2 lines'],
              ['"read question"', 'Hear question again'],
              ['"next" / "पुढचा"', 'Next question'],
              ['"previous" / "मागचा"', 'Previous question'],
            ].map(([cmd, desc]) => (
              <div key={cmd} className="flex items-start gap-2 py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(37,99,235,0.3)', color: '#93C5FD', flexShrink: 0 }}>{cmd}</span>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Answer Panel */}
        <div className="lg:flex-1 flex flex-col gap-4">
          {/* Mode Toggle */}
          <div className="flex items-center gap-2 p-1 rounded-xl self-start" style={{ background: 'rgba(255,255,255,0.08)' }}>
            {(['voice', 'keyboard'] as const).map(mode => (
              <button key={mode} onClick={() => { setInputMode(mode); if (mode === 'keyboard') stopRecording() }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all"
                style={{ background: inputMode === mode ? '#2563EB' : 'transparent', color: inputMode === mode ? 'white' : 'rgba(255,255,255,0.5)' }}>
                {mode === 'voice' ? <Mic size={14} /> : <Keyboard size={14} />}{mode}
              </button>
            ))}
          </div>

          {/* Voice Mode */}
          {inputMode === 'voice' && (q?.type === 'descriptive' || q?.type === 'short_answer' || q?.type === 'fill_blank') && (
            <>
              <div className="flex flex-col items-center py-6">
                <button onClick={toggleRecording} aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                  className="w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-2xl focus:outline-none focus:ring-4 focus:ring-blue-400"
                  style={{
                    background: isRecording ? '#DC2626' : '#2563EB',
                    animation: isRecording ? 'pulse 1.5s infinite' : 'none',
                  }}>
                  {isRecording ? <MicOff size={36} color="white" /> : <Mic size={36} color="white" />}
                </button>
                <div className="mt-3 text-sm" style={{ color: isRecording ? '#FCA5A5' : 'rgba(255,255,255,0.5)' }}>
                  {isRecording ? '🔴 Recording... speak your answer' : 'Tap to start recording'}
                </div>
                {interimText && (
                  <div className="mt-2 text-sm italic px-4 text-center" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {interimText}...
                  </div>
                )}
              </div>

              {/* Transcript */}
              <div className="rounded-2xl p-5 flex-1 min-h-40" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="text-xs font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>YOUR ANSWER</div>
                {answers[q?.id || ''] ? (
                  <p className="text-white leading-relaxed" style={{ fontSize: '18px' }}>{answers[q?.id || '']}</p>
                ) : (
                  <p className="italic" style={{ color: 'rgba(255,255,255,0.25)', fontSize: '16px' }}>Your spoken answer will appear here...</p>
                )}
              </div>
            </>
          )}

          {/* Keyboard Mode */}
          {(inputMode === 'keyboard' || q?.type === 'fill_blank') && (q?.type === 'descriptive' || q?.type === 'short_answer' || q?.type === 'fill_blank') && (
            <textarea
              className="flex-1 rounded-2xl p-5 text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', fontSize: '18px', minHeight: '200px' }}
              placeholder="Type your answer here..."
              value={answers[q?.id || ''] || ''}
              onChange={e => {
                const val = e.target.value
                const lines = val.split('\n').filter(Boolean)
                updateAnswer(q?.id || '', val, lines)
              }}
              aria-label="Type your answer"
            />
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => { updateAnswer(q?.id || '', '', []); speak('Answer cleared') }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all"
              style={{ background: 'rgba(220,38,38,0.2)', color: '#FCA5A5' }}
              aria-label="Clear answer">
              <Trash2 size={16} />Clear
            </button>
            <button onClick={() => {
              const buf = [...(sentenceBuffers[q?.id || ''] || [])]
              if (buf.length > 0) { buf.pop(); updateAnswer(q?.id || '', buf.join('. '), buf); speak('Last sentence removed') }
            }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all"
              style={{ background: 'rgba(245,158,11,0.2)', color: '#FDE68A' }}
              aria-label="Undo last sentence">
              <RotateCcw size={16} />Undo Last
            </button>
            <button onClick={() => speak(answers[q?.id || ''] || 'No answer yet')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-all"
              style={{ background: 'rgba(37,99,235,0.2)', color: '#93C5FD' }}
              aria-label="Read answer aloud">
              <Volume2 size={16} />Read Answer
            </button>
          </div>

          {/* Navigation */}
          <div className="flex gap-3 mt-2">
            <button onClick={() => goToQuestion(currentQ - 1)} disabled={currentQ === 0}
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm transition-all disabled:opacity-30"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}
              aria-label="Previous question">
              <ChevronLeft size={20} />Previous
            </button>
            {!isLast ? (
              <button onClick={() => goToQuestion(currentQ + 1)} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all"
                style={{ background: '#2563EB', color: 'white' }}
                aria-label="Next question">
                Next Question<ChevronRight size={20} />
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all"
                style={{ background: '#16A34A', color: 'white' }}
                aria-label="Submit exam">
                <Send size={20} />{submitting ? 'Submitting...' : 'Submit Exam'}
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.4); }
          50% { box-shadow: 0 0 0 20px rgba(220,38,38,0); }
        }
      `}</style>
    </div>
  )
}
