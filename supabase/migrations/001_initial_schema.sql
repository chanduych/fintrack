-- FinTrack Database Schema
-- Initial migration for loan management system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USER PROFILES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    full_name TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id)
);

-- =====================================================
-- BORROWERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS borrowers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    area TEXT NOT NULL,
    phone TEXT NOT NULL,
    leader_tag TEXT,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- LOANS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    borrower_id UUID REFERENCES borrowers(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    principal_amount DECIMAL(12, 2) NOT NULL CHECK (principal_amount > 0),
    weekly_amount DECIMAL(12, 2) NOT NULL CHECK (weekly_amount > 0),
    number_of_weeks INTEGER NOT NULL CHECK (number_of_weeks > 0),
    total_amount DECIMAL(12, 2) GENERATED ALWAYS AS (weekly_amount * number_of_weeks) STORED,
    start_date DATE NOT NULL,
    collection_day INTEGER NOT NULL CHECK (collection_day >= 0 AND collection_day <= 6),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'foreclosed')),
    foreclosure_date DATE,
    foreclosure_amount DECIMAL(12, 2),
    foreclosure_settlement_amount DECIMAL(12, 2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- PAYMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID REFERENCES loans(id) ON DELETE CASCADE NOT NULL,
    week_number INTEGER NOT NULL CHECK (week_number > 0),
    due_date DATE NOT NULL,
    amount_due DECIMAL(12, 2) NOT NULL CHECK (amount_due >= 0),
    amount_paid DECIMAL(12, 2) DEFAULT 0 NOT NULL CHECK (amount_paid >= 0),
    balance DECIMAL(12, 2) GENERATED ALWAYS AS (amount_due - amount_paid) STORED,
    paid_date DATE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'partial', 'overdue', 'foreclosed')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(loan_id, week_number)
);

-- =====================================================
-- SETTINGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    default_weeks INTEGER DEFAULT 24 NOT NULL CHECK (default_weeks > 0),
    weekly_rate DECIMAL(5, 4) DEFAULT 0.05 NOT NULL CHECK (weekly_rate > 0),
    default_collection_day INTEGER DEFAULT 0 NOT NULL CHECK (default_collection_day >= 0 AND default_collection_day <= 6),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(user_id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Borrowers indexes
CREATE INDEX idx_borrowers_user_id ON borrowers(user_id);
CREATE INDEX idx_borrowers_area ON borrowers(area);
CREATE INDEX idx_borrowers_leader_tag ON borrowers(leader_tag);
CREATE INDEX idx_borrowers_is_active ON borrowers(is_active);

-- Loans indexes
CREATE INDEX idx_loans_borrower_id ON loans(borrower_id);
CREATE INDEX idx_loans_user_id ON loans(user_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loans_start_date ON loans(start_date);

-- Payments indexes
CREATE INDEX idx_payments_loan_id ON payments(loan_id);
CREATE INDEX idx_payments_due_date ON payments(due_date);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_week_number ON payments(week_number);

-- =====================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_borrowers_updated_at
    BEFORE UPDATE ON borrowers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loans_updated_at
    BEFORE UPDATE ON loans
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================
COMMENT ON TABLE user_profiles IS 'Extended user profile information for lenders/admins';
COMMENT ON TABLE borrowers IS 'Customers who take loans';
COMMENT ON TABLE loans IS 'Loan accounts with repayment schedules';
COMMENT ON TABLE payments IS 'Individual weekly payment entries';
COMMENT ON TABLE settings IS 'User-specific application settings';

COMMENT ON COLUMN loans.weekly_amount IS 'Calculated as principal_amount * weekly_rate from settings';
COMMENT ON COLUMN loans.total_amount IS 'Automatically computed as weekly_amount * number_of_weeks';
COMMENT ON COLUMN loans.collection_day IS '0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday';
COMMENT ON COLUMN payments.balance IS 'Automatically computed as amount_due - amount_paid';
COMMENT ON COLUMN settings.weekly_rate IS 'Default 0.05 = 5% of principal per week';
