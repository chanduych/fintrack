-- Add loan_number to loans if missing (app uses it when creating loans)
ALTER TABLE loans ADD COLUMN IF NOT EXISTS loan_number INTEGER;

-- Recreate view with loan_number added at the end (CREATE OR REPLACE cannot reorder columns)
DROP VIEW IF EXISTS loan_summary;

CREATE VIEW loan_summary AS
SELECT
    l.id AS loan_id,
    l.borrower_id,
    b.name AS borrower_name,
    b.area AS borrower_area,
    b.leader_tag AS borrower_leader_tag,
    l.user_id,
    l.principal_amount,
    l.weekly_amount,
    l.number_of_weeks,
    l.total_amount,
    l.start_date,
    l.collection_day,
    l.status,
    l.foreclosure_date,
    l.foreclosure_settlement_amount,
    COALESCE(SUM(p.amount_paid), 0) AS total_paid,
    l.total_amount - COALESCE(SUM(p.amount_paid), 0) AS balance_remaining,
    COALESCE(SUM(p.amount_paid), 0) - l.principal_amount AS interest_earned,
    COUNT(p.id) AS total_payments,
    COUNT(p.id) FILTER (WHERE p.status = 'paid') AS paid_payments,
    COUNT(p.id) FILTER (WHERE p.status = 'pending') AS pending_payments,
    COUNT(p.id) FILTER (WHERE p.status = 'overdue') AS overdue_payments,
    COUNT(p.id) FILTER (WHERE p.status = 'partial') AS partial_payments,
    COUNT(p.id) FILTER (WHERE p.status IN ('pending', 'partial', 'overdue')) AS weeks_remaining,
    CASE
        WHEN COUNT(p.id) > 0 THEN
            ROUND((COUNT(p.id) FILTER (WHERE p.status = 'paid')::DECIMAL / COUNT(p.id)) * 100, 2)
        ELSE 0
    END AS completion_percentage,
    l.created_at,
    l.updated_at,
    l.loan_number
FROM loans l
LEFT JOIN borrowers b ON l.borrower_id = b.id
LEFT JOIN payments p ON l.id = p.loan_id
GROUP BY
    l.id, l.borrower_id, b.name, b.area, b.leader_tag,
    l.user_id, l.principal_amount, l.weekly_amount,
    l.number_of_weeks, l.total_amount, l.start_date,
    l.collection_day, l.status, l.foreclosure_date,
    l.foreclosure_settlement_amount, l.created_at, l.updated_at, l.loan_number;

ALTER VIEW loan_summary SET (security_invoker = true);
