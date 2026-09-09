# SwarLekh — Accessible Exam Platform

AI-powered exam platform for visually impaired students. Built with React, Supabase, and Lemma SDK.

## Features

- Role-based login (Teacher / Student / Admin) — auto-redirect by role
- Teacher: Create exams (MCQ, Fill blanks, Descriptive, True/False, Short answer)
- Teacher: Upload question paper PDF
- Teacher: Live monitor student progress
- Teacher: Download student answer PDF
- Teacher: AI grading via Lemma SDK
- Student: Join exam with session code
- Student: Voice recording (Marathi + English)
- Student: TTS reads questions aloud
- Student: Undo last sentence / erase word / erase line
- Student: Keyboard typing mode
- Exam lock mode (tab switch detection)
- Auto-save every 30 seconds
- Admin: Approve/reject teacher registrations
- Admin: View all users and exams
- Mobile responsive UI

## Deploy to Netlify

### Step 1 — Supabase Setup
1. Go to supabase.com → Create new project
2. Region: South Asia (Mumbai)
3. Go to SQL Editor → New Query → Paste SUPABASE_SETUP.sql → Run
4. Go to Settings → API → Copy URL and anon key

### Step 2 — GitHub
1. Create new GitHub repository
2. Upload all files from this folder
3. Commit changes

### Step 3 — Netlify
1. Go to netlify.com → Add new site → Import from GitHub
2. Select your repository
3. Build command: npm run build
4. Publish directory: dist
5. Add environment variables:
   - VITE_SUPABASE_URL = your supabase url
   - VITE_SUPABASE_ANON_KEY = your anon key
6. Deploy

### Step 4 — Create Admin User
1. Register normally on the live site
2. Go to Supabase → Table Editor → profiles
3. Find your row → change role to 'admin' → Save
4. Login again → Admin dashboard opens

### Step 5 — Lemma SDK (Optional — for AI grading)
1. Install Lemma Desktop from lemma.work
2. Run: lemma pod create swarlekh
3. Run: lemma pod import ./swarlekh-pod
4. Add to Netlify environment variables:
   - VITE_LEMMA_API_URL = your pod api url
   - VITE_LEMMA_AUTH_URL = your pod auth url
   - VITE_LEMMA_POD_ID = your pod id

## Test Flow

Teacher:
1. Register as teacher → wait for admin approval
2. Login → Create exam → Note session code

Student:
1. Register as student (auto-approved)
2. Login → Join exam with code → Give voice answer → Submit

Admin:
1. Login → Approvals tab → Approve teacher

## Voice Commands (During Exam)

| Say | Action |
|---|---|
| "undo" / "रद्द कर" | Remove last sentence |
| "erase word" | Remove last word |
| "erase line" | Remove last line |
| "clear" / "सगळं काढ" | Clear all answer |
| "read back" / "पुन्हा वाच" | Hear last 2 lines |
| "read question" | Hear question again |
| "next" / "पुढचा" | Next question |
| "previous" / "मागचा" | Previous question |
| "submit" / "जमा कर" | Submit exam |
