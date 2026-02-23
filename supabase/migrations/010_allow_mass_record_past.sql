-- Add setting to enable/disable "mass record past payments" feature.
-- When enabled, user can record all past-due weeks as paid in one click (loan details + after creating backdated loan).

ALTER TABLE settings ADD COLUMN IF NOT EXISTS allow_mass_record_past BOOLEAN DEFAULT false NOT NULL;

COMMENT ON COLUMN settings.allow_mass_record_past IS 'When true, show option to record all past-due weeks as paid in one click (mass backfill).';
