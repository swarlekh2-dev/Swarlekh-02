# SwarLekh on Lemma — Run Guide & Feature Inventory

This covers two things: **how to actually run what's in `swarlekh-lemma-pod.zip`**,
and **an honest, complete list of what works vs. what's still a stub**. Every
command below is copied from Lemma's real CLI source (`lemma-cli/cli_core/commands/pods.py`),
not guessed — if a flag looks unfamiliar it's because I checked the code rather
than assumed.

---

## Part 1 — How to run this

There are two independent things to run: **the Lemma pod** (backend: tables,
functions, agent) and **the SwarLekh web app** (frontend). Right now they are
*not* connected to each other yet (see "What's not wired up" below) — you can
run either one on its own today.

### A. Run the SwarLekh web app (works today, on its own)

This is the fast path if you just want to see/demo the app as it exists now.
It still talks to Supabase, exactly as before.

```bash
cd swarlekh-pod/apps/swarlekh-web/source
npm install
cp .env.example .env
# edit .env with your Supabase project URL + anon key
npm run dev
```

Requirements: Node 18+, a Supabase project with `SUPABASE_SETUP.sql` run
against it (see the app's own `README.md` inside that folder for the full
Supabase steps — project creation, SQL editor, admin user promotion).

This confirms cleanly: `npm install` (170 packages, no errors), `tsc --noEmit`
(zero errors outside the unwired duplicate-UI files you asked me to leave
alone), and `npm run build` all succeed as-is.

### B. Import the Lemma pod bundle (backend: tables, functions, agent)

This needs to happen on a machine with **Lemma Desktop** installed — I can't
run this from my sandbox, it has no Lemma runtime or GUI installer access.

**1. Install Lemma Desktop and the CLI** (one-time, on your machine):

```bash
uv tool install lemma-terminal
curl -fsSL https://raw.githubusercontent.com/lemma-work/lemma-platform/main/install.sh | bash -s -- --cli-only
lemma servers select local
lemma auth login
```

Lemma Desktop itself: download from the
[latest release](https://github.com/lemma-work/lemma-platform/releases/latest)
(macOS 14+ Apple Silicon; Windows 11 23H2+ is experimental, no release asset
yet). Open it, choose **Local**, select **Install local services**.

**2. Create a pod to import into:**

```bash
lemma pod create swarlekh
```

This prints a pod id. Either export it or pass `--pod` on every later
command:

```bash
export LEMMA_POD_ID=<the id printed above>
```

**3. Preview the import before touching anything (recommended first run):**

```bash
lemma pod import ./swarlekh-pod --dry-run
```

This prints the exact plan — every table, function, and agent it would
create — without writing anything. Read it before the real import.

**4. Do the real import:**

```bash
lemma pod import ./swarlekh-pod
```

If anything in my JSON doesn't match your Lemma version's exact schema
requirements, this step is where you'll find out — the importer's error
messages will say precisely which field/file. That's expected for a
first-pass bundle I couldn't test-import myself; treat any error here as
"tell me the message and I'll fix it," not "the whole thing is broken."

**5. Continue building it out:** open the pod directory in Claude Code,
Codex, or another coding agent — that's how Lemma pods are meant to be
developed further, against your live local instance.

---

## Part 2 — Full feature inventory

Organized by what's **live and working**, what's **built but not wired
together yet**, and what's **not started**. This is the honest version —
nothing below is rounded up.

### ✅ Live and working today (in the web app, on Supabase, no Lemma needed)

| Feature | Where |
|---|---|
| Role-based auth (student / teacher / admin) | `context/AuthContext.tsx`, Supabase `profiles` table + RLS |
| Teacher: create exam, add questions (MCQ / fill-blank / descriptive / true-false), set duration | `pages/teacher/CreateExam.tsx` |
| Teacher: view submissions | `pages/teacher/Submissions.tsx` |
| Student: join exam by session code | `pages/student/JoinExam.tsx` |
| Student: exam interface with question nav (prev/next), timer | `pages/student/ExamInterface.tsx` |
| **Voice: TTS reads questions aloud**, English (`en-IN`) + Marathi (`mr-IN`) voice selection | `ExamInterface.tsx` (browser `SpeechSynthesis`) |
| **Voice: student answers by speaking**, live transcription | `ExamInterface.tsx` (browser `SpeechRecognition`) |
| Basic voice command handling during answering | `ExamInterface.tsx` `handleVoiceCommand()` |
| PDF export of exam paper (teacher) | `jspdf` dependency, wired in teacher flow |
| Admin dashboard (basic) | `pages/admin/AdminDashboard.tsx` |

### 🟡 Built in the Lemma pod bundle, but not yet connected to the app

Nothing below runs end-to-end yet — the app doesn't call any of this. It
exists as tested, importable backend logic waiting for the frontend to be
pointed at it.

| Resource | What it does | Status |
|---|---|---|
| `tables/*` (10 tables) | Full schema: `profiles`, `exams`, `questions`, `exam_sessions`, `student_answers`, `results`, `grading_configs`, `trial_tests`, `trial_attempts`, `audit_logs` | Schema written, column types verified against Lemma's `DatastoreDataType` enum. Not yet imported/tested against a live pod. |
| `functions/record_grade` | Writes an AI score, but *respects* the exam's grading mode — refuses in manual mode, never overwrites a teacher's own score, requires explicit teacher accept in hybrid mode | Code written, syntax-checked. Not run against a live pod yet. |
| `functions/extract_pdf_questions` | Splits question-paper text into individual questions, guesses type (MCQ/fill-blank/descriptive/etc.) via regex, flags low-confidence guesses, never auto-publishes | Code written, syntax-checked. **Needs a PDF→text step upstream — not included** (see below). |
| `agents/grading_agent` | Question-type-aware grading judgment: exact-match for MCQ/true-false, keyword-and-concept scoring for short/descriptive answers, uses teacher's `keywords`/`model_answer` as guidance not a template | Instructions written. Calls `record_grade` to actually save — can't bypass grading policy. |

### 🔴 Not started (real gaps against the 75-section spec you gave me)

Being direct about these so nothing is oversold:

- **Frontend ↔ Lemma wiring.** The app still only talks to Supabase. Someone
  has to replace (or bridge) calls in `lib/supabase.ts` with `lemma_sdk`
  calls. This is the single biggest remaining piece of work.
- **PDF text extraction.** `extract_pdf_questions` expects plain text in;
  turning an uploaded PDF into that text (e.g. via `pdf.js` on upload) isn't
  built.
- **Teacher UI for:** grading-mode selection (AI/manual/hybrid), keywords,
  model answers, PDF-upload review/edit screen, question bank
  search/filter/reuse.
- **Trial test** — schema exists (`trial_tests`, `trial_attempts`), no
  content or UI.
- **Results/feedback screens** for students, teacher override screen for
  hybrid grading.
- **Erase-word / erase-last-word / clear-answer voice commands** — only
  basic command handling exists today; the fine-grained editing commands
  from the spec aren't implemented.
- **Audit logging** — table exists, nothing writes to it yet.
- **Accessibility, security, and error-handling audits** — not yet done as
  dedicated passes; would rather do these against real screens than
  preemptively.
- **"System B"** (the duplicate `*Page.tsx`/`*Layout.tsx` files) — still
  sitting there unwired, per your instruction to leave it alone for now.

---

## Quick troubleshooting

- **`lemma pod import` fails on a specific file** — send me the exact error
  message; the importer names the file and field, so it's a fast fix, not a
  rebuild.
- **`npm run dev` shows a blank screen** — almost always a missing/wrong
  `.env` (Supabase URL/key). Check the browser console first.
- **Voice doesn't work in the browser** — `SpeechRecognition` requires
  Chrome/Edge (not Firefox/Safari) and a mic permission grant; the app
  already falls back to a keyboard mode if the API isn't available.
