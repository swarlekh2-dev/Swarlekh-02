# AI Grading via Lemma — how it's wired, and what's left for you to do

Update: the previous version of this doc said the Lemma calling convention
was undocumented. That was true at the time — it's since been found and
verified against the real, published `lemma-sdk` npm package (v0.7.1) and
the actual table schemas / agent instructions in `swarlekh-pod/`. The
integration code is written and type-checks and builds cleanly. It has
**not** been run against a live pod yet, because no pod existed when this
was written. That's the one thing left for you to do.

## What's implemented (`src/lib/lemma.ts`)

1. **`isLemmaConfigured()`** — checks for `VITE_LEMMA_API_URL`,
   `VITE_LEMMA_AUTH_URL`, `VITE_LEMMA_POD_ID`. If any are missing, AI
   grading quietly doesn't appear — the app works exactly as before with
   manual grading only. Nothing breaks if you never set these up.

2. **`mirrorExamForGrading(exam, teacher)`** — the first time an
   `ai`/`hybrid` exam is graded, this creates matching rows in the pod's
   own `exams`, `grading_configs`, and `questions` tables (the pod has a
   separate datastore from Supabase, so this mirror step is required —
   see the architecture note below). The pod-side IDs are saved back onto
   the Supabase `exams` row (`lemma_exam_id`, `lemma_question_ids`) so this
   only happens once per exam, not once per grading run.

3. **`runAiGrading(exam, session, teacher, student)`** — mirrors the
   student's session/answers into the pod, then for each answered question
   calls `client.agents.run('grading_agent', ...)`, which internally reads
   the question + answer and calls `record_grade` (the safety-checked
   write path — it will never overwrite a score you already entered
   manually). Returns the scores; **Submissions.tsx** merges them into
   `exam_sessions.grading`, the same field your manual grading already
   writes to.

4. **Shadow profiles** — the pod's tables require a `teacher_id`/
   `student_id` foreign key into the pod's own `profiles` table. Rather
   than asking every teacher and student to separately join the Lemma pod
   (which would undercut the whole "no extra login" design of this app),
   `ensurePodProfileId()` upserts a lightweight profile in the pod keyed by
   email, the first time it's needed.

5. **UI** — in Submissions.tsx, expand any submission on an `ai`/`hybrid`
   exam and you'll see a **"Run AI Grading"** button (only when Lemma is
   configured). It shows the AI's score and feedback per question; you can
   still override with your own manual score exactly as before.

## Architecture note: why mirroring, not a direct call

`record_grade` (the function the grading agent calls to actually write a
score) reads and writes the pod's own `questions` / `student_answers` /
`exam_sessions` / `grading_configs` tables — not Supabase. So there's no
way to point the agent at your Supabase data directly; the relevant rows
have to exist in the pod first. That's what the mirror step does. It's
idempotent (checked via the `lemma_*_id` columns from `ADD_FEATURES.sql`),
so a given exam/session only gets mirrored once.

## To actually turn this on

1. Create a Lemma account and pod — **no desktop install required**, this
   can all be done from the browser + a lightweight CLI:
   ```
   # sign up at https://lemma.work first, then:
   uv tool install lemma-terminal
   lemma servers cloud --use
   lemma auth login

   cd swarlekh-pod
   lemma pod create swarlekh
   lemma pod import . --dry-run   # preview first
   lemma pod import .             # actual import — pod now runs on lemma.work
   ```
   (Lemma Desktop is an alternative for running the stack fully on your own
   machine, but isn't needed for this — cloud is simpler for a deployed app
   like this one, since your Netlify site can reach it from anywhere.)
2. Find your pod's API URL, auth URL, and pod ID (Lemma Desktop's pod
   settings screen, or `lemma pod list` / `lemma pod info` from the CLI).
3. Add three env vars — locally in `.env`, and in Netlify under Site
   settings → Environment variables:
   ```
   VITE_LEMMA_API_URL=<from step 2>
   VITE_LEMMA_AUTH_URL=<from step 2>
   VITE_LEMMA_POD_ID=<from step 2>
   ```
4. Netlify's `NODE_VERSION` has been bumped to `24` in `netlify.toml`
   because `lemma-sdk` declares that requirement — redeploy after pulling
   this change.
5. Create an exam with Grading Mode = AI or Hybrid, have a student submit
   an answer, then in Submissions click **Run AI Grading**. Watch the
   browser console / Netlify function logs if it errors — the two most
   likely first-run issues are a pod permission scope that needs widening
   for the app's API credentials, or the `grading_agent`'s default agent
   runtime needing a model key configured in Lemma Desktop's Pod Settings.

## If something about the pod's real behavior differs from this code

Only `src/lib/lemma.ts` encodes assumptions about the pod's shape — every
other file just reads `exam_sessions.grading`, which is plain Supabase
data. If the agent's actual input contract or `record_grade`'s error
shape turns out to differ once you're running against a live pod, that
one file is where to fix it.
