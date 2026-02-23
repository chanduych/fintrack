-- FinTrack Analytical Views
-- Precomputed views for dashboard analytics

-- =====================================================
-- VIEW: Loan Summary with Borrower Info
-- =====================================================
CREATE OR REPLACE VIEW loan_summary AS
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
    -- Calculate total paid
    COALESCE(SUM(p.amount_paid), 0) AS total_paid,
    -- Calculate balance remaining
    l.total_amount - COALESCE(SUM(p.amount_paid), 0) AS balance_remaining,
    -- Calculate interest earned
    COALESCE(SUM(p.amount_paid), 0) - l.principal_amount AS interest_earned,
    -- Count payments
    COUNT(p.id) AS total_payments,
    COUNT(p.id) FILTER (WHERE p.status = 'paid') AS paid_payments,
    COUNT(p.id) FILTER (WHERE p.status = 'pending') AS pending_payments,
    COUNT(p.id) FILTER (WHERE p.status = 'overdue') AS overdue_payments,
    COUNT(p.id) FILTER (WHERE p.status = 'partial') AS partial_payments,
    -- Calculate weeks remaining
    COUNT(p.id) FILTER (WHERE p.status IN ('pending', 'partial', 'overdue')) AS weeks_remaining,
    -- Calculate progress percentage
    CASE
        WHEN COUNT(p.id) > 0 THEN
            ROUND((COUNT(p.id) FILTER (WHERE p.status = 'paid')::DECIMAL / COUNT(p.id)) * 100, 2)
        ELSE 0
    END AS completion_percentage,
    l.created_at,
    l.updated_at
FROM loans l
LEFT JOIN borrowers b ON l.borrower_id = b.id
LEFT JOIN payments p ON l.id = p.loan_id
GROUP BY
    l.id, l.borrower_id, b.name, b.area, b.leader_tag,
    l.user_id, l.principal_amount, l.weekly_amount,
    l.number_of_weeks, l.total_amount, l.start_date,
    l.collection_day, l.status, l.foreclosure_date,
    l.foreclosure_settlement_amount, l.created_at, l.updated_at;

-- =====================================================
-- VIEW: This Week's Collections
-- =====================================================
CREATE OR REPLACE VIEW this_week_collections AS
SELECT
    p.id AS payment_id,
    p.loan_id,
    l.borrower_id,
    b.name AS borrower_name,
    b.area AS borrower_area,
    b.phone AS borrower_phone,
    b.leader_tag AS borrower_leader_tag,
    l.user_id,
    p.week_number,
    p.due_date,
    p.amount_due,
    p.amount_paid,
    p.balance,
    p.status,
    p.paid_date,
    p.notes,
    -- Days until/past due
    p.due_date - CURRENT_DATE AS days_until_due,
    CASE
        WHEN p.due_date < CURRENT_DATE THEN ABS(p.due_date - CURRENT_DATE)
        ELSE 0
    END AS days_overdue
FROM payments p
JOIN loans l ON p.loan_id = l.id
JOIN borrowers b ON l.borrower_id = b.id
WHERE
    -- This week: from start of week (Sunday) to end of week (Saturday)
    p.due_date >= date_trunc('week', CURRENT_DATE)
    AND p.due_date < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'
    AND l.status = 'active'
ORDER BY p.due_date, b.name;

-- =====================================================
-- VIEW: Overdue Payments
-- =====================================================
CREATE OR REPLACE VIEW overdue_payments AS
SELECT
    p.id AS payment_id,
    p.loan_id,
    l.borrower_id,
    b.name AS borrower_name,
    b.area AS borrower_area,
    b.phone AS borrower_phone,
    b.leader_tag AS borrower_leader_tag,
    l.user_id,
    p.week_number,
    p.due_date,
    p.amount_due,
    p.amount_paid,
    p.balance,
    p.status,
    -- Days overdue
    CURRENT_DATE - p.due_date AS days_overdue,
    p.notes
FROM payments p
JOIN loans l ON p.loan_id = l.id
JOIN borrowers b ON l.borrower_id = b.id
WHERE
    p.status = 'overdue'
    AND l.status = 'active'
ORDER BY p.due_date ASC;

-- =====================================================
-- VIEW: User Analytics Dashboard
-- =====================================================
CREATE OR REPLACE VIEW user_analytics AS
SELECT
    l.user_id,
    -- Active loans count
    COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'active') AS active_loans_count,
    -- Closed loans count
    COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'closed') AS closed_loans_count,
    -- Foreclosed loans count
    COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'foreclosed') AS foreclosed_loans_count,
    -- Total loans
    COUNT(DISTINCT l.id) AS total_loans,
    -- Total principal disbursed (active only)
    COALESCE(SUM(l.principal_amount) FILTER (WHERE l.status = 'active'), 0) AS total_principal_out,
    -- Total amount to be collected (active only)
    COALESCE(SUM(l.total_amount) FILTER (WHERE l.status = 'active'), 0) AS total_amount_out,
    -- Total collected so far (active loans)
    COALESCE(SUM(p.amount_paid) FILTER (WHERE l.status = 'active'), 0) AS total_collected,
    -- Total outstanding (active loans)
    COALESCE(
        SUM(l.total_amount) FILTER (WHERE l.status = 'active')
        - SUM(p.amount_paid) FILTER (WHERE l.status = 'active'),
        0
    ) AS total_outstanding,
    -- Total interest earned (all closed/active loans)
    COALESCE(
        SUM(p.amount_paid) FILTER (WHERE l.status IN ('active', 'closed'))
        - SUM(l.principal_amount) FILTER (WHERE l.status IN ('active', 'closed')),
        0
    ) AS total_interest_earned,
    -- This week due
    COALESCE(
        SUM(p.amount_due) FILTER (
            WHERE l.status = 'active'
            AND p.status IN ('pending', 'partial', 'overdue')
            AND p.due_date >= date_trunc('week', CURRENT_DATE)
            AND p.due_date < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'
        ),
        0
    ) AS this_week_due,
    -- This week collected
    COALESCE(
        SUM(p.amount_paid) FILTER (
            WHERE l.status = 'active'
            AND p.due_date >= date_trunc('week', CURRENT_DATE)
            AND p.due_date < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'
        ),
        0
    ) AS this_week_collected,
    -- This week pending
    COALESCE(
        SUM(p.amount_due - p.amount_paid) FILTER (
            WHERE l.status = 'active'
            AND p.status IN ('pending', 'partial', 'overdue')
            AND p.due_date >= date_trunc('week', CURRENT_DATE)
            AND p.due_date < date_trunc('week', CURRENT_DATE) + INTERVAL '7 days'
        ),
        0
    ) AS this_week_pending,
    -- Overdue count
    COUNT(p.id) FILTER (WHERE p.status = 'overdue' AND l.status = 'active') AS overdue_payments_count,
    -- Overdue amount
    COALESCE(
        SUM(p.amount_due - p.amount_paid) FILTER (WHERE p.status = 'overdue' AND l.status = 'active'),
        0
    ) AS overdue_amount,
    -- Active borrowers
    COUNT(DISTINCT l.borrower_id) FILTER (WHERE l.status = 'active') AS active_borrowers_count
FROM loans l
LEFT JOIN payments p ON l.id = p.loan_id
GROUP BY l.user_id;

-- =====================================================
-- VIEW: Borrower Loan History
-- =====================================================
CREATE OR REPLACE VIEW borrower_loan_history AS
SELECT
    b.id AS borrower_id,
    b.user_id,
    b.name AS borrower_name,
    b.area,
    b.phone,
    b.leader_tag,
    b.is_active,
    -- Loan counts
    COUNT(l.id) AS total_loans,
    COUNT(l.id) FILTER (WHERE l.status = 'active') AS active_loans,
    COUNT(l.id) FILTER (WHERE l.status = 'closed') AS closed_loans,
    COUNT(l.id) FILTER (WHERE l.status = 'foreclosed') AS foreclosed_loans,
    -- Financial summary
    COALESCE(SUM(l.principal_amount) FILTER (WHERE l.status = 'active'), 0) AS current_principal_out,
    COALESCE(SUM(l.total_amount) FILTER (WHERE l.status = 'active'), 0) AS current_total_out,
    COALESCE(SUM(p.amount_paid) FILTER (WHERE l.status = 'active'), 0) AS current_paid,
    COALESCE(
        SUM(l.total_amount) FILTER (WHERE l.status = 'active')
        - SUM(p.amount_paid) FILTER (WHERE l.status = 'active'),
        0
    ) AS current_balance,
    -- Lifetime totals (all loans)
    COALESCE(SUM(l.principal_amount), 0) AS lifetime_principal,
    COALESCE(SUM(p.amount_paid), 0) AS lifetime_paid,
    -- First and last loan dates
    MIN(l.start_date) AS first_loan_date,
    MAX(l.start_date) AS last_loan_date,
    b.created_at,
    b.updated_at
FROM borrowers b
LEFT JOIN loans l ON b.id = l.borrower_id
LEFT JOIN payments p ON l.id = p.loan_id
GROUP BY
    b.id, b.user_id, b.name, b.area, b.phone,
    b.leader_tag, b.is_active, b.created_at, b.updated_at;

-- =====================================================
-- GRANT PERMISSIONS ON VIEWS
-- =====================================================
-- Users can read their own data from views
ALTER VIEW loan_summary SET (security_invoker = true);
ALTER VIEW this_week_collections SET (security_invoker = true);
ALTER VIEW overdue_payments SET (security_invoker = true);
ALTER VIEW user_analytics SET (security_invoker = true);
ALTER VIEW borrower_loan_history SET (security_invoker = true);

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================
COMMENT ON VIEW loan_summary IS 'Comprehensive loan information with payment progress';
COMMENT ON VIEW this_week_collections IS 'Payments due in the current week (Sunday to Saturday)';
COMMENT ON VIEW overdue_payments IS 'All overdue payments with borrower details';
COMMENT ON VIEW user_analytics IS 'Dashboard analytics aggregated per user';
COMMENT ON VIEW borrower_loan_history IS 'Complete loan history for each borrower';
