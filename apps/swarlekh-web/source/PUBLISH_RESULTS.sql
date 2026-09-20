-- =====================================================================
-- SwarLekh — Results publishing workflow
-- Run this in the Supabase SQL Editor AFTER SUPABASE_SETUP.sql.
-- Safe to run more than once (all statements are idempotent).
-- =====================================================================

-- 1. Teacher-controlled results release.
--    false = students see "results not published yet" (answers only, no scores)
--    true  = students see scores, remarks and AI feedback
alter table exams add column if not exists results_published boolean default false;

-- 2. When the teacher marked this as published (shown to students).
alter table exams add column if not exists results_published_at timestamp;

-- 3. For AI / hybrid exams only: release each student's AI score the moment
--    they submit, without waiting for the teacher to press Publish.
--    Ignored entirely when grading_mode = 'manual'.
alter table exams add column if not exists auto_publish_ai boolean default false;

-- 4. Existing exams keep the safe default (nothing released until the
--    teacher explicitly publishes).
update exams set results_published = false where results_published is null;
update exams set auto_publish_ai  = false where auto_publish_ai  is null;
