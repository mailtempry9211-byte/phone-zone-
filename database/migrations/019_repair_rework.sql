-- Migration 019: Repair Rework, Warranty and Business Module Separation
ALTER TABLE repair_jobs ADD COLUMN is_rework INTEGER NOT NULL DEFAULT 0;
ALTER TABLE repair_jobs ADD COLUMN rework_notes TEXT;
ALTER TABLE repair_jobs ADD COLUMN original_job_id TEXT REFERENCES repair_jobs(id);

CREATE INDEX IF NOT EXISTS idx_repair_jobs_rework ON repair_jobs(is_rework);

ALTER TABLE admin_settings ADD COLUMN business_module TEXT DEFAULT 'both';

