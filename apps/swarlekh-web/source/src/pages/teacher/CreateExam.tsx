import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase, Question, GradingMode } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { PlusCircle, Trash2, Upload, Info } from 'lucide-react'
import Layout from '../../components/layout/Layout'
import toast from 'react-hot-toast'

const generateCode = () => Math.random().toString(36).substring(2,8).toUpperCase()

const EXAM_TYPES = ['College Exam','School Exam','Government Exam','Corporate Exam','Entrance Exam','Certification']
const QUESTION_TYPES = [
  {value:'descriptive', label:'Descriptive (Voice/Text)'},
  {value:'mcq', label:'Multiple Choice (MCQ)'},
  {value:'fill_blank', label:'Fill in the Blanks'},
  {value:'true_false', label:'True or False'},
  {value:'short_answer', label:'Short Answer'},
]
const GRADING_MODES: { value: GradingMode; label: string; hint: string }[] = [
  { value: 'manual', label: 'Manual', hint: 'You grade every answer yourself in Submissions. Works today.' },
  { value: 'ai', label: 'AI', hint: 'AI grades automatically and its score is final. Requires the Lemma grading agent to be running — see LEMMA_INTEGRATION.md.' },
  { value: 'hybrid', label: 'Hybrid', hint: 'AI suggests a score, you accept or override it in Submissions. Requires the Lemma grading agent to be running.' },
]

export default function CreateExam() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [form, setForm] = useState({ title:'', subject:'', exam_type:'College Exam', duration_minutes:60, grading_mode:'manual' as GradingMode })
  const [questions, setQuestions] = useState<Partial<Question>[]>([
    { type:'descriptive', question:'', marks:10, options:[] }
  ])

  const addQuestion = () => setQuestions(q => [...q, { type:'descriptive', question:'', marks:10, options:[] }])
  const removeQuestion = (i: number) => setQuestions(q => q.filter((_,idx) => idx !== i))
  const updateQuestion = (i: number, field: string, value: any) => {
    setQuestions(q => q.map((item, idx) => idx === i ? {...item, [field]: value} : item))
  }
  const updateOption = (qi: number, oi: number, value: string) => {
    setQuestions(q => q.map((item, idx) => {
      if (idx !== qi) return item
      const opts = [...(item.options || [])]
      opts[oi] = value
      return {...item, options: opts}
    }))
  }
  const addOption = (qi: number) => {
    setQuestions(q => q.map((item, idx) => idx === qi ? {...item, options: [...(item.options||[]), '']} : item))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.subject) { toast.error('Please fill all required fields'); return }
    if (questions.some(q => !q.question)) { toast.error('All questions must have text'); return }
    setLoading(true)

    let pdf_url = null
    if (pdfFile) {
      const filename = `exam-papers/${Date.now()}-${pdfFile.name}`
      const { data: uploadData } = await supabase.storage.from('exam-papers').upload(filename, pdfFile)
      if (uploadData) {
        const { data: urlData } = supabase.storage.from('exam-papers').getPublicUrl(filename)
        pdf_url = urlData.publicUrl
      }
    }

    const examData = {
      teacher_id: profile!.id,
      title: form.title,
      subject: form.subject,
      institution: profile!.institution,
      exam_type: form.exam_type,
      duration_minutes: form.duration_minutes,
      session_code: generateCode(),
      status: 'active',
      questions: questions.map((q, i) => ({...q, id: `q-${i+1}`})),
      pdf_url,
      grading_mode: form.grading_mode,
    }

    const { error } = await supabase.from('exams').insert(examData)
    if (error) { toast.error('Failed to create exam'); setLoading(false); return }
    toast.success('Exam created successfully!')
    navigate('/teacher')
    setLoading(false)
  }

  return (
    <Layout>
      <div className="p-8 max-w-3xl">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Exam</h1>
        <p className="text-gray-500 mb-8">Set up a new examination for your students</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Exam Details */}
          <div className="card-p">
            <h2 className="text-lg font-semibold text-gray-900 mb-5">Exam Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Exam Title *</label>
                <input className="input-field" placeholder="e.g. Science Mid-Term 2026" value={form.title}
                  onChange={e => setForm(f => ({...f, title: e.target.value}))} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject *</label>
                <input className="input-field" placeholder="e.g. Physics" value={form.subject}
                  onChange={e => setForm(f => ({...f, subject: e.target.value}))} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Exam Type</label>
                <select className="input-field" value={form.exam_type} onChange={e => setForm(f => ({...f, exam_type: e.target.value}))}>
                  {EXAM_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Duration (minutes)</label>
                <select className="input-field" value={form.duration_minutes} onChange={e => setForm(f => ({...f, duration_minutes: +e.target.value}))}>
                  {[30,45,60,90,120,180].map(d => <option key={d} value={d}>{d} minutes</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Upload Question Paper (PDF)</label>
                <label className="flex items-center gap-3 p-3 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-blue-400 transition-colors">
                  <Upload size={20} className="text-gray-400" />
                  <span className="text-gray-500 text-sm">{pdfFile ? pdfFile.name : 'Click to upload PDF'}</span>
                  <input type="file" accept=".pdf" className="hidden" onChange={e => setPdfFile(e.target.files?.[0] || null)} />
                </label>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Grading Mode</label>
                <div className="grid grid-cols-3 gap-3">
                  {GRADING_MODES.map(m => (
                    <button type="button" key={m.value}
                      onClick={() => setForm(f => ({...f, grading_mode: m.value}))}
                      className={`text-left p-3 rounded-xl border-2 transition-colors ${form.grading_mode === m.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className="font-semibold text-gray-900 text-sm">{m.label}</div>
                      <div className="text-xs text-gray-500 mt-1">{m.hint}</div>
                    </button>
                  ))}
                </div>
                {form.grading_mode !== 'manual' && (
                  <div className="flex items-start gap-2 mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                    <Info size={14} className="flex-shrink-0 mt-0.5" />
                    <span>AI/Hybrid grading only produces scores once the Lemma grading agent is wired in and running. Until then, answers will show as "not graded yet" — grade manually from Submissions in the meantime.</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Questions */}
          <div className="card-p">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Questions ({questions.length})</h2>
              <button type="button" onClick={addQuestion} className="btn-secondary flex items-center gap-2 text-sm min-h-0 py-2 px-4">
                <PlusCircle size={16} />Add Question
              </button>
            </div>
            <div className="space-y-5">
              {questions.map((q, i) => (
                <div key={i} className="p-5 bg-gray-50 rounded-xl border border-gray-200 relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-blue-600 font-mono">Q{i+1}</span>
                    {questions.length > 1 && (
                      <button type="button" onClick={() => removeQuestion(i)} className="text-red-400 hover:text-red-600 p-1" aria-label="Remove question">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Question Type</label>
                      <select className="input-field text-sm py-2 min-h-0" value={q.type}
                        onChange={e => updateQuestion(i, 'type', e.target.value)}>
                        {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Marks</label>
                      <input type="number" className="input-field text-sm py-2 min-h-0" value={q.marks}
                        onChange={e => updateQuestion(i, 'marks', +e.target.value)} min={1} max={100} />
                    </div>
                  </div>
                  <textarea className="input-field mb-3" rows={2} placeholder="Type your question here..."
                    value={q.question} onChange={e => updateQuestion(i, 'question', e.target.value)} />

                  {q.type === 'mcq' && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-600">Options</label>
                      {(q.options || []).map((opt, oi) => (
                        <input key={oi} className="input-field text-sm py-2 min-h-0" placeholder={`Option ${oi+1}`}
                          value={opt} onChange={e => updateOption(i, oi, e.target.value)} />
                      ))}
                      {(q.options || []).length < 4 && (
                        <button type="button" onClick={() => addOption(i)} className="text-blue-600 text-sm font-medium hover:underline">+ Add Option</button>
                      )}
                      <div>
                        <label className="text-xs font-medium text-gray-600">Correct Answer</label>
                        <input className="input-field text-sm py-2 min-h-0 mt-1" placeholder="Enter correct answer"
                          value={q.correct_answer || ''} onChange={e => updateQuestion(i, 'correct_answer', e.target.value)} />
                      </div>
                    </div>
                  )}

                  {q.type === 'true_false' && (
                    <div>
                      <label className="text-xs font-medium text-gray-600">Correct Answer</label>
                      <select className="input-field text-sm py-2 min-h-0 mt-1" value={q.correct_answer || 'true'}
                        onChange={e => updateQuestion(i, 'correct_answer', e.target.value)}>
                        <option value="true">True</option>
                        <option value="false">False</option>
                      </select>
                    </div>
                  )}

                  {q.type === 'fill_blank' && (
                    <div>
                      <label className="text-xs font-medium text-gray-600">Correct Answer</label>
                      <input className="input-field text-sm py-2 min-h-0 mt-1" placeholder="Expected answer"
                        value={q.correct_answer || ''} onChange={e => updateQuestion(i, 'correct_answer', e.target.value)} />
                    </div>
                  )}

                  {(q.type === 'short_answer' || q.type === 'descriptive') && (
                    <div className="space-y-2 mt-2 pt-3 border-t border-gray-200">
                      <div className="text-xs font-medium text-gray-500">Grading aids (optional — used for manual grading reference, and by AI grading once wired)</div>
                      <div>
                        <label className="text-xs font-medium text-gray-600">Keywords (comma separated)</label>
                        <input className="input-field text-sm py-2 min-h-0 mt-1" placeholder="e.g. photosynthesis, chlorophyll, sunlight"
                          value={(q.keywords || []).join(', ')}
                          onChange={e => updateQuestion(i, 'keywords', e.target.value.split(',').map(k => k.trim()).filter(Boolean))} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600">Model Answer</label>
                        <textarea className="input-field text-sm py-2 min-h-0 mt-1" rows={2} placeholder="Reference answer for scope and depth (not a word-for-word template)"
                          value={q.model_answer || ''} onChange={e => updateQuestion(i, 'model_answer', e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-success w-full text-xl py-4">
            {loading ? 'Creating Exam...' : 'Activate Exam'}
          </button>
        </form>
      </div>
    </Layout>
  )
}
