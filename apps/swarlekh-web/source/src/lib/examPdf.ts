// Builds the neat, printable PDF of one student's submission (used by the
// teacher's "PDF" button in Submissions).
//
// What "neat" means here:
//   * clean header band + a small details table (exam, subject, student ...)
//   * every question in its own block: Q number, marks, question, answer
//   * answers are tidied up first (double spaces, "..", " ." etc. removed)
//   * long answers flow onto the next page without cutting a line in half,
//     and a question heading is never left alone at the bottom of a page
//   * "Page X of Y" + footer on every page
//   * Marathi / Hindi (Devanagari) and other non-Latin text is drawn through
//     the browser's own text engine so it shows correctly. jsPDF's built-in
//     fonts can only draw plain Latin text and would print garbage instead.

import jsPDF from 'jspdf'
import { Exam, ExamSession } from './supabase'

const PAGE_W = 210
const PAGE_H = 297
const MARGIN = 18
const CONTENT_W = PAGE_W - MARGIN * 2
const FOOTER_Y = PAGE_H - 10
const BOTTOM_LIMIT = PAGE_H - 20

const BLUE: [number, number, number] = [30, 58, 138]
const DARK: [number, number, number] = [17, 24, 39]
const GREY: [number, number, number] = [107, 114, 128]
const LIGHT: [number, number, number] = [243, 244, 246]

const NON_LATIN = /[^\u0000-\u024F\u2000-\u206F\u20A0-\u20CF]/

/** Tidies text that came from speech recognition / typing. */
export function cleanAnswerText(raw: unknown): string {
  if (raw === null || raw === undefined) return ''
  let t = String(raw)
  t = t.replace(/\r\n?/g, '\n')
  t = t.replace(/[ \t\u00A0]+/g, ' ')                 // collapse spaces
  t = t.replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n')
  t = t.replace(/\s+([.,;:!?।])/g, '$1')              // no space before punctuation
  t = t.replace(/([.!?।])(\s*[.!?।])+/g, '$1')        // "sentence. . next" / ".." -> "."
  return t.trim()
}

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim() || 'file'

// ---------- text drawing (Latin via jsPDF, other scripts via canvas) ----------

const PX_PER_MM = 12 // canvas resolution for rasterised text (~300 dpi)

function wrapWithCanvas(ctx: CanvasRenderingContext2D, text: string, maxPx: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    if (!para.trim()) { out.push(''); continue }
    let line = ''
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word
      if (ctx.measureText(test).width <= maxPx || !line) {
        line = test
      } else {
        out.push(line)
        line = word
      }
      // a single very long word: break it by characters
      while (ctx.measureText(line).width > maxPx && line.length > 1) {
        let cut = line.length - 1
        while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > maxPx) cut--
        out.push(line.slice(0, cut))
        line = line.slice(cut)
      }
    }
    out.push(line)
  }
  return out
}

interface TextStyle {
  size: number      // pt
  bold?: boolean
  color: [number, number, number]
}

/** Returns wrapped lines + a function that draws one of them at (x, y). */
function prepareText(doc: jsPDF, text: string, width: number, style: TextStyle) {
  if (!NON_LATIN.test(text)) {
    doc.setFont('helvetica', style.bold ? 'bold' : 'normal')
    doc.setFontSize(style.size)
    const lines: string[] = doc.splitTextToSize(text, width)
    return {
      lines,
      draw: (line: string, x: number, y: number) => {
        doc.setFont('helvetica', style.bold ? 'bold' : 'normal')
        doc.setFontSize(style.size)
        doc.setTextColor(...style.color)
        if (line) doc.text(line, x, y)
      },
    }
  }

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const fontPx = (style.size * 0.3528) * PX_PER_MM // pt -> mm -> px
  const fontCss = `${style.bold ? 'bold ' : ''}${fontPx}px "Noto Sans Devanagari","Nirmala UI","Mangal","Lohit Devanagari","Noto Sans",Arial,sans-serif`
  ctx.font = fontCss
  const lines = wrapWithCanvas(ctx, text, width * PX_PER_MM)
  const lineMm = style.size * 0.3528 * 1.6
  return {
    lines,
    draw: (line: string, x: number, y: number) => {
      if (!line) return
      const c = document.createElement('canvas')
      const cx = c.getContext('2d')!
      cx.font = fontCss
      const w = Math.min(Math.ceil(cx.measureText(line).width) + 4, width * PX_PER_MM)
      const h = Math.ceil(lineMm * PX_PER_MM)
      c.width = w
      c.height = h
      cx.font = fontCss // resizing resets the context
      cx.fillStyle = `rgb(${style.color.join(',')})`
      cx.textBaseline = 'middle'
      cx.fillText(line, 0, h / 2)
      // y is the text baseline (mm) used by jsPDF; shift the image so it sits on the same line
      doc.addImage(c.toDataURL('image/png'), 'PNG', x, y - lineMm * 0.72, w / PX_PER_MM, h / PX_PER_MM)
    },
  }
}

const lineHeightFor = (size: number) => size * 0.3528 * 1.6

// ---------- main builder ----------

export function buildSubmissionPdf(exam: Exam, session: ExamSession): { doc: jsPDF; fileName: string } {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const student: any = session.student
  const studentName = student?.name || 'Student'
  const questions = exam.questions || []
  const answerOf = (id: string) => cleanAnswerText(session.answers?.[id])
  const answeredCount = questions.filter(q => answerOf(q.id)).length

  let y = 0

  const newPage = () => {
    doc.addPage()
    y = MARGIN
  }
  const ensureSpace = (needed: number) => {
    if (y + needed > BOTTOM_LIMIT) newPage()
  }

  // Header band
  doc.setFillColor(...BLUE)
  doc.rect(0, 0, PAGE_W, 32, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('SwarLekh', MARGIN, 15)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text('Exam Submission', MARGIN, 23)
  y = 42

  // Details table (two columns of label / value)
  const details: [string, string][] = [
    ['Exam', exam.title || '—'],
    ['Subject', exam.subject || '—'],
    ['Student', studentName],
    ['Submitted', session.submitted_at ? new Date(session.submitted_at).toLocaleString() : 'N/A'],
    ['Exam type', exam.exam_type || '—'],
    ['Answered', `${answeredCount} of ${questions.length} questions`],
  ]
  const colW = CONTENT_W / 2
  const rowH = 11
  const rows = Math.ceil(details.length / 2)
  doc.setFillColor(...LIGHT)
  doc.roundedRect(MARGIN, y - 5, CONTENT_W, rows * rowH + 4, 2, 2, 'F')
  details.forEach(([label, value], i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = MARGIN + 4 + col * colW
    const ty = y + row * rowH + 2
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...GREY)
    doc.text(label.toUpperCase(), x, ty - 1.5)
    const t = prepareText(doc, value, colW - 8, { size: 10.5, color: DARK })
    const first = t.lines.length > 1 ? `${t.lines[0].replace(/\s+\S*$/, '')}...` : (t.lines[0] || '')
    t.draw(first, x, ty + 3.2)
  })
  y += rows * rowH + 10

  // Questions
  questions.forEach((q, i) => {
    const qText = cleanAnswerText(q.question) || '(no question text)'
    const answer = answerOf(q.id)
    const qPrep = prepareText(doc, qText, CONTENT_W - 6, { size: 11.5, bold: true, color: DARK })
    const aPrep = prepareText(doc, answer || 'No answer provided', CONTENT_W - 6, {
      size: 11, color: answer ? DARK : GREY,
    })
    const qLh = lineHeightFor(11.5)
    const aLh = lineHeightFor(11)

    // Keep the heading + question + first two answer lines together on one page.
    const minBlock = 8 + qPrep.lines.length * qLh + 6 + Math.min(aPrep.lines.length, 2) * aLh
    ensureSpace(minBlock)

    // Q label + marks
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...BLUE)
    doc.text(`QUESTION ${i + 1}`, MARGIN, y)
    const marksLabel = `${q.marks} mark${q.marks === 1 ? '' : 's'}`
    doc.setTextColor(...GREY)
    doc.text(marksLabel, PAGE_W - MARGIN, y, { align: 'right' })
    y += 5

    // Question text
    qPrep.lines.forEach(line => {
      ensureSpace(qLh)
      qPrep.draw(line, MARGIN, y + qLh * 0.6)
      y += qLh
    })
    y += 3

    // Answer label
    ensureSpace(aLh + 6)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...GREY)
    doc.text('ANSWER', MARGIN + 5, y)
    y += 4

    // Answer text with a blue accent bar down the left side (per page slice)
    let barTop = y - 1
    aPrep.lines.forEach(line => {
      if (y + aLh > BOTTOM_LIMIT) {
        doc.setFillColor(...BLUE)
        doc.rect(MARGIN, barTop, 0.9, y - barTop, 'F')
        newPage()
        barTop = y - 1
      }
      aPrep.draw(line, MARGIN + 5, y + aLh * 0.6)
      y += aLh
    })
    doc.setFillColor(...(answer ? BLUE : ([209, 213, 219] as [number, number, number])))
    doc.rect(MARGIN, barTop, 0.9, Math.max(y - barTop, 2), 'F')

    y += 5
    // thin divider between questions
    if (i < questions.length - 1) {
      ensureSpace(6)
      doc.setDrawColor(229, 231, 235)
      doc.setLineWidth(0.2)
      doc.line(MARGIN, y, PAGE_W - MARGIN, y)
      y += 7
    }
  })

  // Footer on every page
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setDrawColor(229, 231, 235)
    doc.setLineWidth(0.2)
    doc.line(MARGIN, FOOTER_Y - 4, PAGE_W - MARGIN, FOOTER_Y - 4)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...GREY)
    doc.text('Generated by SwarLekh — Accessible Exam Platform', MARGIN, FOOTER_Y)
    doc.text(`Page ${p} of ${total}`, PAGE_W - MARGIN, FOOTER_Y, { align: 'right' })
  }

  return { doc, fileName: `SwarLekh-${safeName(studentName)}-${safeName(exam.title || 'exam')}.pdf` }
}
