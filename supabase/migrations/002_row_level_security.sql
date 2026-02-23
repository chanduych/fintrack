-- FinTrack Row Level Security Policies
-- Ensures users can only access their own data

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- USER PROFILES POLICIES
-- =====================================================
CREATE POLICY "Users can view own profile"
    ON user_profiles FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own profile"
    ON user_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
    ON user_profiles FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own profile"
    ON user_profiles FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- BORROWERS POLICIES
-- =====================================================
CREATE POLICY "Users can view own borrowers"
    ON borrowers FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create borrowers"
    ON borrowers FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own borrowers"
    ON borrowers FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own borrowers"
    ON borrowers FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- LOANS POLICIES
-- =====================================================
CREATE POLICY "Users can view own loans"
    ON loans FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create loans"
    ON loans FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own loans"
    ON loans FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own loans"
    ON loans FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- PAYMENTS POLICIES
-- =====================================================
-- Payments are linked to loans, so we check loan ownership
CREATE POLICY "Users can view payments for own loans"
    ON payments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM loans
            WHERE loans.id = payments.loan_id
            AND loans.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create payments for own loans"
    ON payments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM loans
            WHERE loans.id = payments.loan_id
            AND loans.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update payments for own loans"
    ON payments FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM loans
            WHERE loans.id = payments.loan_id
            AND loans.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM loans
            WHERE loans.id = payments.loan_id
            AND loans.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete payments for own loans"
    ON payments FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM loans
            WHERE loans.id = payments.loan_id
            AND loans.user_id = auth.uid()
        )
    );

-- =====================================================
-- SETTINGS POLICIES
-- =====================================================
CREATE POLICY "Users can view own settings"
    ON settings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create own settings"
    ON settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
    ON settings FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own settings"
    ON settings FOR DELETE
    USING (auth.uid() = user_id);
