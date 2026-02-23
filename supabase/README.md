# FinTrack Supabase Database Setup

This directory contains all the SQL migrations needed to set up the FinTrack database schema.

## Prerequisites

1. Create a Supabase project at https://supabase.com
2. Copy your project URL and anon key
3. Update `.env.local` with your credentials

## Quick Setup

### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Execute the migration files in order:
   - `001_initial_schema.sql` - Creates tables and indexes
   - `002_row_level_security.sql` - Sets up RLS policies
   - `003_functions_and_triggers.sql` - Adds automated business logic
   - `004_views_and_analytics.sql` - Creates analytical views

4. **Important**: For the user initialization trigger in `003_functions_and_triggers.sql`, you may need to:
   - Go to **Database** → **Triggers**
   - Create the `on_auth_user_created` trigger manually if it doesn't work via SQL

### Option 2: Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push

# Or run individual migrations
supabase db reset
```

## Schema Overview

### Tables

#### `user_profiles`
Extended profile information for authenticated users (lenders/admins).

#### `borrowers`
Customers who take loans. Contains:
- Basic info (name, area, phone)
- `leader_tag` for grouping/sorting
- `is_active` flag

#### `loans`
Loan accounts with:
- `principal_amount` - Original loan amount
- `weekly_amount` - Auto-calculated based on principal × weekly_rate
- `total_amount` - Auto-computed (weekly_amount × number_of_weeks)
- `status` - 'active', 'closed', or 'foreclosed'
- `collection_day` - Day of week (0=Sunday)

#### `payments`
Individual weekly payment entries with:
- `amount_due` - Expected weekly payment
- `amount_paid` - Actual amount paid
- `balance` - Auto-computed (amount_due - amount_paid)
- `status` - 'pending', 'paid', 'partial', 'overdue', 'foreclosed'
- `due_date` - Calculated based on loan start and collection day

#### `settings`
User-specific configuration:
- `default_weeks` - Default loan duration (24)
- `weekly_rate` - Percentage per week (0.05 = 5%)
- `default_collection_day` - Default collection day (0=Sunday)

### Automated Features

#### 1. Payment Schedule Generation
When a loan is created, the system automatically generates all payment entries:
- Calculates due dates based on start date and collection day
- Creates one payment per week
- Sets initial status as 'pending'

**Trigger**: `generate_loan_payments` (after INSERT on loans)

#### 2. Payment Status Updates
Payment status is automatically updated based on:
- Fully paid → 'paid'
- Partially paid → 'partial'
- Past due date → 'overdue'
- Loan foreclosed → 'foreclosed'

**Trigger**: `auto_update_payment_status` (before INSERT/UPDATE on payments)

#### 3. Loan Completion
When all payments are marked as 'paid', the loan status automatically changes to 'closed'.

**Trigger**: `check_loan_completion` (after INSERT/UPDATE on payments)

#### 4. Foreclosure Handling
When a loan is marked as 'foreclosed', all unpaid payments are automatically marked as 'foreclosed'.

**Trigger**: `handle_loan_foreclosure` (after UPDATE on loans)

#### 5. User Initialization
When a new user signs up:
- Default settings are created
- User profile is initialized

**Trigger**: `on_auth_user_created` (after INSERT on auth.users)

### Analytical Views

#### `loan_summary`
Complete loan information with:
- Borrower details
- Payment progress
- Balance remaining
- Completion percentage

#### `this_week_collections`
All payments due in the current week (Sunday to Saturday).

#### `overdue_payments`
All overdue payments with borrower contact information.

#### `user_analytics`
Dashboard metrics:
- Loan counts by status
- Total amounts outstanding
- This week's collections
- Overdue summary

#### `borrower_loan_history`
Complete history for each borrower:
- Loan counts
- Current balances
- Lifetime totals

### Row Level Security (RLS)

All tables enforce RLS policies to ensure:
- Users can only access their own data
- No cross-user data leakage
- Secure multi-tenant operation

**Key principle**: Every query checks `auth.uid() = user_id`

## Testing the Schema

### Create a Test Borrower

```sql
INSERT INTO borrowers (user_id, name, area, phone, leader_tag)
VALUES (
    auth.uid(),
    'Test Borrower',
    'North Area',
    '9876543210',
    'Leader A'
);
```

### Create a Test Loan

```sql
-- First, get your borrower_id from the previous insert
INSERT INTO loans (
    borrower_id,
    user_id,
    principal_amount,
    weekly_amount,
    number_of_weeks,
    start_date,
    collection_day
)
VALUES (
    'your-borrower-id-here',
    auth.uid(),
    10000,  -- ₹10,000 principal
    500,    -- ₹500/week
    24,     -- 24 weeks
    CURRENT_DATE,
    0       -- Sunday
);
```

This will automatically:
- Generate 24 payment entries
- Calculate due dates for each week
- Set initial status as 'pending'

### Record a Payment

```sql
-- Get payment_id from the loan's payments
UPDATE payments
SET
    amount_paid = 500,
    paid_date = CURRENT_DATE
WHERE id = 'your-payment-id-here';
```

This will automatically update the status to 'paid'.

### Check Analytics

```sql
-- View your dashboard analytics
SELECT * FROM user_analytics
WHERE user_id = auth.uid();

-- View this week's collections
SELECT * FROM this_week_collections
WHERE user_id = auth.uid();

-- View loan summary
SELECT * FROM loan_summary
WHERE user_id = auth.uid();
```

## Indexes

The schema includes indexes on:
- All foreign keys (user_id, borrower_id, loan_id)
- Frequently queried fields (area, leader_tag, status, due_date)

This ensures fast queries even with thousands of records.

## Backup Strategy

### Manual Backup

```sql
-- Export all data as JSON
COPY (
    SELECT json_build_object(
        'borrowers', (SELECT json_agg(b) FROM borrowers b WHERE user_id = auth.uid()),
        'loans', (SELECT json_agg(l) FROM loans l WHERE user_id = auth.uid()),
        'payments', (SELECT json_agg(p) FROM payments p JOIN loans l ON p.loan_id = l.id WHERE l.user_id = auth.uid()),
        'settings', (SELECT row_to_json(s) FROM settings s WHERE user_id = auth.uid())
    )
) TO '/path/to/backup.json';
```

### Automated Backups

See `functions/scheduled-backup/` for Supabase Edge Function that runs on a schedule.

## Troubleshooting

### Trigger Not Working

If the `on_auth_user_created` trigger doesn't work:

1. Go to **Database** → **Triggers** in Supabase Dashboard
2. Click **Create a new trigger**
3. Configure:
   - Name: `on_auth_user_created`
   - Table: `auth.users`
   - Events: `INSERT`
   - Type: `After`
   - Function: `initialize_user_settings`

### RLS Blocking Queries

If queries return no results:

1. Check if RLS is enabled: `SELECT * FROM pg_tables WHERE schemaname = 'public';`
2. Verify you're authenticated: `SELECT auth.uid();` should return your user ID
3. Check policy definitions: `SELECT * FROM pg_policies;`

### Performance Issues

If queries are slow:

1. Check index usage: `EXPLAIN ANALYZE your_query;`
2. Add missing indexes on frequently filtered columns
3. Consider adding composite indexes for multi-column filters

## Next Steps

After setting up the database:

1. Copy your Supabase URL and anon key to `.env.local`
2. Test authentication by signing in
3. Create test data using the examples above
4. Verify all triggers work correctly
5. Start building the frontend components!

## Support

For issues with:
- **Database schema**: Check migration SQL files
- **Supabase setup**: Visit https://supabase.com/docs
- **Application code**: See main project README
