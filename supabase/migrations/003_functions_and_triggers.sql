-- FinTrack Database Functions and Triggers
-- Automated business logic

-- =====================================================
-- FUNCTION: Calculate due date for a payment week
-- =====================================================
CREATE OR REPLACE FUNCTION calculate_due_date(
    p_start_date DATE,
    p_week_number INTEGER,
    p_collection_day INTEGER
)
RETURNS DATE AS $$
DECLARE
    v_due_date DATE;
    v_day_of_week INTEGER;
    v_days_to_add INTEGER;
BEGIN
    -- Start from loan start date + (week_number - 1) weeks
    v_due_date := p_start_date + ((p_week_number - 1) * INTERVAL '7 days');

    -- Get day of week (0 = Sunday, 6 = Saturday)
    v_day_of_week := EXTRACT(DOW FROM v_due_date);

    -- Calculate days to add to reach collection day
    v_days_to_add := (p_collection_day - v_day_of_week + 7) % 7;

    -- For first payment, move to next collection day if needed
    IF p_week_number = 1 AND v_days_to_add > 0 THEN
        v_due_date := v_due_date + (v_days_to_add * INTERVAL '1 day');
    END IF;

    RETURN v_due_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- FUNCTION: Generate payment schedule for a loan
-- =====================================================
CREATE OR REPLACE FUNCTION generate_payment_schedule()
RETURNS TRIGGER AS $$
DECLARE
    v_week INTEGER;
    v_due_date DATE;
BEGIN
    -- Only generate schedule for new loans
    IF TG_OP = 'INSERT' THEN
        -- Generate payment entries for each week
        FOR v_week IN 1..NEW.number_of_weeks LOOP
            -- Calculate due date for this week
            v_due_date := calculate_due_date(
                NEW.start_date,
                v_week,
                NEW.collection_day
            );

            -- Insert payment record
            INSERT INTO payments (
                loan_id,
                week_number,
                due_date,
                amount_due,
                status
            ) VALUES (
                NEW.id,
                v_week,
                v_due_date,
                NEW.weekly_amount,
                'pending'
            );
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to loans table
CREATE TRIGGER generate_loan_payments
    AFTER INSERT ON loans
    FOR EACH ROW
    EXECUTE FUNCTION generate_payment_schedule();

-- =====================================================
-- FUNCTION: Update payment status based on conditions
-- =====================================================
CREATE OR REPLACE FUNCTION update_payment_status()
RETURNS TRIGGER AS $$
DECLARE
    v_loan_status TEXT;
BEGIN
    -- Get loan status
    SELECT status INTO v_loan_status
    FROM loans
    WHERE id = NEW.loan_id;

    -- If loan is foreclosed and payment is unpaid, mark as foreclosed
    IF v_loan_status = 'foreclosed' AND NEW.amount_paid = 0 THEN
        NEW.status := 'foreclosed';
    -- If fully paid
    ELSIF NEW.amount_paid >= NEW.amount_due THEN
        NEW.status := 'paid';
        IF NEW.paid_date IS NULL THEN
            NEW.paid_date := CURRENT_DATE;
        END IF;
    -- If partially paid
    ELSIF NEW.amount_paid > 0 THEN
        NEW.status := 'partial';
        IF NEW.paid_date IS NULL THEN
            NEW.paid_date := CURRENT_DATE;
        END IF;
    -- If overdue (due date passed and not paid)
    ELSIF NEW.due_date < CURRENT_DATE AND NEW.amount_paid = 0 THEN
        NEW.status := 'overdue';
    -- Otherwise pending
    ELSE
        NEW.status := 'pending';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to payments table
CREATE TRIGGER auto_update_payment_status
    BEFORE INSERT OR UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_status();

-- =====================================================
-- FUNCTION: Update loan status based on payments
-- =====================================================
CREATE OR REPLACE FUNCTION update_loan_status()
RETURNS TRIGGER AS $$
DECLARE
    v_total_payments INTEGER;
    v_paid_payments INTEGER;
BEGIN
    -- Get payment counts
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'paid')
    INTO v_total_payments, v_paid_payments
    FROM payments
    WHERE loan_id = NEW.loan_id;

    -- If all payments are paid, close the loan
    IF v_paid_payments = v_total_payments AND v_total_payments > 0 THEN
        UPDATE loans
        SET status = 'closed'
        WHERE id = NEW.loan_id
        AND status = 'active';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to payments table
CREATE TRIGGER check_loan_completion
    AFTER INSERT OR UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_loan_status();

-- =====================================================
-- FUNCTION: Initialize user settings on signup
-- =====================================================
CREATE OR REPLACE FUNCTION initialize_user_settings()
RETURNS TRIGGER AS $$
BEGIN
    -- Create default settings for new user
    INSERT INTO settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    -- Create user profile
    INSERT INTO user_profiles (user_id, full_name)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to auth.users table (requires Supabase to enable)
-- Note: This might need to be created via Supabase Dashboard -> Database -> Triggers
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION initialize_user_settings();

-- =====================================================
-- FUNCTION: Mark all unpaid payments as foreclosed
-- =====================================================
CREATE OR REPLACE FUNCTION foreclose_loan_payments()
RETURNS TRIGGER AS $$
BEGIN
    -- When loan status changes to 'foreclosed'
    IF NEW.status = 'foreclosed' AND OLD.status != 'foreclosed' THEN
        UPDATE payments
        SET status = 'foreclosed'
        WHERE loan_id = NEW.id
        AND amount_paid < amount_due;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to loans table
CREATE TRIGGER handle_loan_foreclosure
    AFTER UPDATE ON loans
    FOR EACH ROW
    WHEN (NEW.status = 'foreclosed')
    EXECUTE FUNCTION foreclose_loan_payments();

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================
COMMENT ON FUNCTION calculate_due_date IS 'Calculates the due date for a payment based on start date, week number, and collection day';
COMMENT ON FUNCTION generate_payment_schedule IS 'Automatically generates payment schedule when a loan is created';
COMMENT ON FUNCTION update_payment_status IS 'Automatically updates payment status based on amount paid and due date';
COMMENT ON FUNCTION update_loan_status IS 'Automatically closes loan when all payments are completed';
COMMENT ON FUNCTION initialize_user_settings IS 'Creates default settings and profile for new users';
COMMENT ON FUNCTION foreclose_loan_payments IS 'Marks all unpaid payments as foreclosed when loan is foreclosed';
