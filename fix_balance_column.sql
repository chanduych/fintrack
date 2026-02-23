-- Quick fix for balance column issue
-- Run this in Supabase SQL Editor

-- Drop the existing trigger
DROP TRIGGER IF EXISTS generate_loan_payments ON loans;

-- Recreate the function without balance column
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

            -- Insert payment record (balance is auto-calculated by database)
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

-- Recreate the trigger
CREATE TRIGGER generate_loan_payments
    AFTER INSERT ON loans
    FOR EACH ROW
    EXECUTE FUNCTION generate_payment_schedule();

-- Verify it was created
SELECT
    trigger_name,
    event_manipulation,
    event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'generate_loan_payments';
