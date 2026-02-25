-- ============================================================
-- Migration 008: Normalize currency to SLE (new Sierra Leonean Leone)
-- Sierra Leone redenominated in 2022: SLL -> SLE (ISO 4217)
-- ============================================================

-- 1. Update existing SLL values to SLE
UPDATE opportunities SET currency = 'SLE' WHERE currency = 'SLL';
UPDATE transactions  SET currency = 'SLE' WHERE currency = 'SLL';
UPDATE pitches       SET currency = 'SLE' WHERE currency = 'SLL';

-- 2. Change column defaults from USD to SLE
ALTER TABLE opportunities ALTER COLUMN currency SET DEFAULT 'SLE';
ALTER TABLE transactions  ALTER COLUMN currency SET DEFAULT 'SLE';
ALTER TABLE pitches       ALTER COLUMN currency SET DEFAULT 'SLE';
