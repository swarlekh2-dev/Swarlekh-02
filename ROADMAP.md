# SwarLekh on Lemma — status and roadmap

This pod bundle is a **starting scaffold**, not a finished rebuild. Be clear
with anyone you show this to about what's real vs. planned below — that
matters more than looking finished.

## What's in this bundle and why

- `apps/swarlekh-web/source/` — your existing React/Vite app, copied as-is
  (junk `{...}` artifact folders removed, nothing else changed). It still
  talks to Supabase directly via `src/lib/supabase.ts`. It does **not** yet
  call Lemma tables or functions. Its working voice code (browser
  `SpeechSynthesis` + `SpeechRecognition` in `ExamInterface.tsx`) was left
  untouched because it already works — no reason to rebuild it.
- `tables/` — a Lemma-native schema (`profiles`, `exams`, `questions`,
  `exam_sessions`, `student_answers`, `results`, `grading_configs`,
  `trial_tests`, `trial_attempts`, `audit_logs`) adapted from your current
  3-table Supabase schema (`SUPABASE_SETUP.sql`) plus the data model in spec
  section 53-54. This is real, importable schema — verified against Lemma's
  actual `DatastoreDataType` enum, not guessed.
- `functions/record_grade` — deterministic grade-writing logic that enforces
  manual/AI/hybrid grading mode and never overwrites a teacher's own score
  (spec sections 40-42).
- `functions/extract_pdf_questions` — regex-based question-boundary
  detection for question-paper text, flags low-confidence type guesses,
  never auto-publishes (spec sections 15-16). Written and structurally
  sound; **not yet run against a real exam PDF**.
- `agents/grading_agent` — question-type-aware grading instructions (spec
  section 39), hands writes off to `record_grade` so it can't bypass grading
  policy.

## What is NOT done yet (be upfront about this)

1. **The frontend still isn't wired to any of this.** `swarlekh-web` needs
   its Supabase calls replaced with `lemma_sdk`/`@lemma/sdk` calls (or kept
   alongside Supabase during migration — your call). Nothing above runs
   end-to-end until that happens.
2. **PDF text extraction itself** (PDF → raw text) isn't in this bundle.
   `extract_pdf_questions` expects text as input; something upstream (a
   frontend `pdf.js` step, or a small extraction function) has to produce
   that text first.
3. **No teacher UI for the grading-mode / keyword / model-answer / PDF
   review flow** exists yet in `swarlekh-web` — only the data model and
   backend logic to support it.
4. **Trial test content, question bank UI, results/feedback UI, audit
   logging calls, and hybrid-grading review screen** are schema-only right
   now — no functions or UI behind them yet.
5. **Duplicate "System B" component tree** in `src/pages/*Page.tsx` /
   `*Layout.tsx` is still sitting there unwired, per your instruction. Worth
   resolving before doing UI work so effort isn't spent twice.
6. This bundle has **not been imported or run** against a live Lemma
   instance — I don't have Lemma Desktop / the local runtime in this
   environment. First import will likely surface small format issues
   (`lemma pod import` will tell you exactly what).

## Suggested next phases

1. Import this bundle (`lemma pod import` — see below), fix whatever the
   importer flags.
2. Point `swarlekh-web`'s data layer at Lemma tables instead of Supabase for
   one flow first (e.g. exam creation), verify end-to-end, then migrate the
   rest.
3. Add the PDF-to-text step and wire `extract_pdf_questions` to a real
   "Upload PDF" teacher screen with the review/edit step from spec section
   15.
4. Wire `grading_agent` to run after submission and build the teacher
   review/override screen (spec section 41-45).
5. Build trial test content + question bank UI.
6. Accessibility, security, and error-handling passes (spec sections 46,
   52, 58) — do these against real screens, not preemptively.

## How to use this bundle

On a machine with Lemma Desktop installed and the local runtime running:

```bash
lemma pod import ./swarlekh-pod
```

Then open the resulting pod directory in Claude Code / Codex / your coding
agent of choice to continue implementation against your live local Lemma
instance — that part has to happen on your machine, not here.
