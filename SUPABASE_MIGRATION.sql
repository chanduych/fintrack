-- =====================================================
-- SUPABASE DATABASE MIGRATION
-- Add loan_number column to loans table
-- =====================================================

-- 1. Add loan_number column to loans table
ALTER TABLE loans
ADD COLUMN IF NOT EXISTS loan_number INTEGER;

-- 2. Backfill loan_number for existing loans
-- This assigns loan numbers based on creation order per borrower
WITH numbered_loans AS (
  SELECT
    id,
    borrower_id,
    ROW_NUMBER() OVER (PARTITION BY borrower_id ORDER BY created_at ASC) as loan_num
  FROM loans
)
UPDATE loans
SET loan_number = numbered_loans.loan_num
FROM numbered_loans
WHERE loans.id = numbered_loans.id;

-- 3. Make loan_number NOT NULL now that it's populated
ALTER TABLE loans
ALTER COLUMN loan_number SET NOT NULL;

-- 4. Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_loans_borrower_loan_number
ON loans(borrower_id, loan_number);

-- 5. Verify the migration
-- Run this to check loan numbers are assigned correctly:
SELECT
  l.id,
  b.name as borrower_name,
  l.loan_number,
  l.principal_amount,
  l.created_at
FROM loans l
JOIN borrowers b ON l.borrower_id = b.id
ORDER BY b.name, l.loan_number;
