-- ============================================================
-- V3__student_profile_enrichment.sql — Enriched student fields (DOB, Photo, Gender, Blood Group, etc.)
-- ============================================================

ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS dob VARCHAR(30);
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS profile_photo_url VARCHAR(500);
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10);
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS mentor_email VARCHAR(255);
