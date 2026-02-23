-- Verify and re-create payment generation triggers if needed
-- This migration ensures the payment schedule generation works correctly

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS generate_loan_payments ON loans;

-- Drop and recreate the function to ensure it's up to date
DROP FUNCTION IF EXISTS generate_payment_schedule() CASCADE;

-- =====================================================
-- FUNCTION: Generate payment schedule for a loan
-- First payment starts NEXT WEEK from loan start date
-- =====================================================
CREATE OR REPLACE FUNCTION generate_payment_schedule()
RETURNS TRIGGER AS $$
DECLARE
    v_week INTEGER;
    v_due_date DATE;
    v_temp_date DATE;   
    v_day_of_week INTEGER;
    v_days_to_add INTEGER;
BEGIN
    -- Only generate schedule for new loans
    IF TG_OP = 'INSERT' THEN
        -- Log for debugging
        RAISE NOTICE 'Generating payment schedule for loan ID: %', NEW.id;

        -- Generate payment entries for each week
        FOR v_week IN 1..NEW.number_of_weeks LOOP
            -- Calculate due date - first payment is NEXT week (week * 7 days)
            v_temp_date := NEW.start_date + (v_week * INTERVAL '7 days');

            -- Adjust to collection day
            v_day_of_week := EXTRACT(DOW FROM v_temp_date);
            v_days_to_add := (NEW.collection_day - v_day_of_week + 7) % 7;

            IF v_days_to_add > 0 THEN
                v_due_date := v_temp_date + (v_days_to_add * INTERVAL '1 day');
            ELSE
                v_due_date := v_temp_date;
            END IF;

            -- Insert payment record (balance is auto-calculated)
            INSERT INTO payments (
                loan_id,
                week_number,
                due_date,
                amount_due,
                amount_paid,
                status
            ) VALUES (
                NEW.id,
                v_week,
                v_due_date,
                NEW.weekly_amount,
                0,
                'pending'
            );

            RAISE NOTICE 'Created payment for week % with due date %', v_week, v_due_date;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger to ensure it's active
CREATE TRIGGER generate_loan_payments
    AFTER INSERT ON loans
    FOR EACH ROW
    EXECUTE FUNCTION generate_payment_schedule();

-- Add comment
COMMENT ON TRIGGER generate_loan_payments ON loans IS
'Automatically generates payment schedule when a new loan is created';

-- Verify trigger exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'generate_loan_payments'
    ) THEN
        RAISE NOTICE 'Payment generation trigger is active';
    ELSE
        RAISE WARNING 'Payment generation trigger was not created!';
    END IF;
END $$;
