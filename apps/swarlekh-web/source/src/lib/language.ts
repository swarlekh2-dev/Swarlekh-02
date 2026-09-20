// Main-language setting + text-to-speech helpers for the exam screen.
//
// The chosen language is used for BOTH speech recognition (what the student
// speaks) and speech synthesis (what the app reads out). It is remembered in
// localStorage so it survives page reloads. Default is Marathi (mr-IN), same
// as before.
//
// To add another language, just add one line to LANGUAGES below.

export interface AppLanguage {
  code: string   // BCP-47 code used by the browser speech APIs
  label: string  // English name
  native: string // Name written in its own script
}

export const LANGUAGES: AppLanguage[] = [
  { code: 'mr-IN', label: 'Marathi', native: 'मराठी' },
  { code: 'hi-IN', label: 'Hindi', native: 'हिन्दी' },
  { code: 'en-IN', label: 'English (India)', native: 'English' },
  { code: 'gu-IN', label: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'bn-IN', label: 'Bengali', native: 'বাংলা' },
  { code: 'ta-IN', label: 'Tamil', native: 'தமிழ்' },
  { code: 'te-IN', label: 'Telugu', native: 'తెలుగు' },
  { code: 'kn-IN', label: 'Kannada', native: 'ಕನ್ನಡ' },
]

export const DEFAULT_LANGUAGE = 'mr-IN'
const STORAGE_KEY = 'swarlekh_main_language'

let currentLang = DEFAULT_LANGUAGE

export function getSavedLanguage(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && LANGUAGES.some(l => l.code === saved)) {
      currentLang = saved
      return saved
    }
  } catch { /* storage blocked — fall back to default */ }
  currentLang = DEFAULT_LANGUAGE
  return DEFAULT_LANGUAGE
}

export function saveLanguage(code: string) {
  currentLang = code
  try { localStorage.setItem(STORAGE_KEY, code) } catch { /* ignore */ }
}

export function getLanguage(): string {
  return currentLang
}

// Pick the best available voice: exact language match, then same base
// language (e.g. "hi"), then any English voice, then whatever exists.
function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  const base = lang.split('-')[0]
  return (
    voices.find(v => v.lang === lang) ||
    voices.find(v => v.lang.replace('_', '-').startsWith(base)) ||
    voices.find(v => v.lang === 'en-IN') ||
    voices.find(v => v.lang.startsWith('en')) ||
    voices[0]
  )
}

function makeUtterance(text: string, lang: string) {
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang
  u.rate = 0.85
  u.pitch = 1.0
  u.voice = pickVoice(lang)
  return u
}

export const speak = (text: string, lang: string = currentLang) => {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(makeUtterance(text, lang))
}

export const stopSpeaking = () => {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

/**
 * Reads several sentences one after another (sentence-by-sentence).
 * onStart(i) fires as sentence i begins; onDone() fires after the last one
 * finishes or the reading is cancelled.
 */
export const speakSentences = (
  sentences: string[],
  onStart?: (index: number) => void,
  onDone?: () => void,
  lang: string = currentLang
) => {
  if (!('speechSynthesis' in window) || sentences.length === 0) { onDone?.(); return }
  window.speechSynthesis.cancel()
  sentences.forEach((s, i) => {
    const u = makeUtterance(s, lang)
    u.onstart = () => onStart?.(i)
    if (i === sentences.length - 1) {
      u.onend = () => onDone?.()
      u.onerror = () => onDone?.()
    }
    window.speechSynthesis.speak(u)
  })
}

/** Splits an answer into sentences (handles . ! ? and the Devanagari danda). */
export function splitSentences(text: string): string[] {
  if (!text) return []
  const parts = text.match(/[^.!?।\n]+[.!?।]*/g) || []
  return parts.map(p => p.trim()).filter(p => /[^\s.!?।]/.test(p))
}
