-- Add optional first payment date to loans (first installment = next Sunday by default)
-- When set, the payment schedule uses this as week 1 due date; otherwise next Sunday from start_date.

ALTER TABLE loans ADD COLUMN IF NOT EXISTS first_payment_date DATE;

COMMENT ON COLUMN loans.first_payment_date IS 'Optional: due date for first installment. If null, computed as next Sunday from start_date.';

-- Recreate payment schedule trigger to use first_payment_date
DROP TRIGGER IF EXISTS generate_loan_payments ON loans;
DROP FUNCTION IF EXISTS generate_payment_schedule() CASCADE;

CREATE OR REPLACE FUNCTION generate_payment_schedule()
RETURNS TRIGGER AS $$
DECLARE
    v_week INTEGER;
    v_due_date DATE;
    v_first_due DATE;
    v_dow INTEGER;
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Week 1 due date: use first_payment_date if set, else next Sunday from start_date
        IF NEW.first_payment_date IS NOT NULL THEN
            v_first_due := NEW.first_payment_date;
        ELSE
            -- Next Sunday from start_date (0=Sunday: next Sun = +7; else 7 - DOW days)
            v_dow := EXTRACT(DOW FROM NEW.start_date)::INTEGER;
            IF v_dow = 0 THEN
                v_first_due := NEW.start_date + INTERVAL '7 days';
            ELSE
                v_first_due := NEW.start_date + (7 - v_dow) * INTERVAL '1 day';
            END IF;
        END IF;

        FOR v_week IN 1..NEW.number_of_weeks LOOP
            v_due_date := v_first_due + ((v_week - 1) * INTERVAL '7 days');

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
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_loan_payments
    AFTER INSERT ON loans
    FOR EACH ROW
    EXECUTE FUNCTION generate_payment_schedule();

COMMENT ON TRIGGER generate_loan_payments ON loans IS 'Generates payment schedule; week 1 = first_payment_date or next Sunday from start_date';
