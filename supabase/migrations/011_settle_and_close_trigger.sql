-- When loan is foreclosed, only mark as foreclosed the payments that were NOT part of a
-- settlement (i.e. have no paid_date). Payments with paid_date set are from "settle and close"
-- and should keep their paid/partial status so they appear in that week's collections.

CREATE OR REPLACE FUNCTION foreclose_loan_payments()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'foreclosed' AND OLD.status != 'foreclosed' THEN
        UPDATE payments
        SET status = 'foreclosed'
        WHERE loan_id = NEW.id
          AND amount_paid < amount_due
          AND paid_date IS NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION foreclose_loan_payments IS 'Marks unpaid payments (no paid_date) as foreclosed when loan is foreclosed; leaves settled payments (with paid_date) unchanged.';
