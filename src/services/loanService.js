import { supabase } from './supabaseClient'
import { getUserSettings } from './userService'

/**
 * Get all loans with borrower info
 */
export const getLoans = async (userId) => {
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const { data, error } = await supabase
    .from('loan_summary')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return { data: null, error }

  // Fetch payments for all loans
  const loanIds = data.map(loan => loan.loan_id)
  if (loanIds.length > 0) {
    const { data: paymentsData } = await supabase
      .from('payments')
      .select('*')
      .in('loan_id', loanIds)

    // Attach payments to each loan
    const loansWithPayments = data.map(loan => ({
      ...loan,
      payments: paymentsData?.filter(p => p.loan_id === loan.loan_id) || []
    }))

    return { data: loansWithPayments, error: null }
  }

  return { data, error }
}

/**
 * Get active loans (metadata only, no payments).
 * Lightweight query for leader collection stats, etc.
 */
export const getActiveLoans = async (userId) => {
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const { data, error } = await supabase
    .from('loan_summary')
    .select('loan_id, user_id, borrower_id, borrower_name, borrower_leader_tag, loan_number, weekly_amount, status')
    .eq('user_id', userId)
    .eq('status', 'active')

  return { data, error }
}

/**
 * Get loans for a specific borrower
 */
export const getLoansByBorrower = async (borrowerId) => {
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const { data, error } = await supabase
    .from('loan_summary')
    .select('*')
    .eq('borrower_id', borrowerId)
    .order('created_at', { ascending: false })

  return { data, error }
}

/**
 * Get a single loan by ID
 */
export const getLoan = async (loanId) => {
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const { data, error } = await supabase
    .from('loans')
    .select(`
      *,
      borrower:borrowers(*)
    `)
    .eq('id', loanId)
    .single()

  return { data, error }
}

/**
 * Generate payment schedule for a loan (fallback if trigger fails)
 */
const generatePaymentSchedule = async (loanId, loan) => {
  try {
    const payments = []
    let firstPaymentDate
    if (loan.first_payment_date) {
      firstPaymentDate = new Date(loan.first_payment_date)
    } else {
      const loanStartDate = new Date(loan.start_date)
      firstPaymentDate = new Date(loanStartDate)
      const currentDay = firstPaymentDate.getDay()
      const daysUntilSunday = currentDay === 0 ? 7 : (7 - currentDay)
      firstPaymentDate.setDate(firstPaymentDate.getDate() + daysUntilSunday)
    }

    for (let week = 1; week <= loan.number_of_weeks; week++) {
      // Calculate due date - first payment is next Sunday, subsequent payments are 7 days apart
      const dueDate = new Date(firstPaymentDate)
      dueDate.setDate(dueDate.getDate() + ((week - 1) * 7)) // Week 1 = firstPaymentDate, Week 2 = +7 days, etc.

      payments.push({
        loan_id: loanId,
        week_number: week,
        due_date: dueDate.toISOString().split('T')[0],
        amount_due: loan.weekly_amount,
        amount_paid: 0,
        status: 'pending'
        // balance is auto-calculated as a generated column
      })
    }

    // Insert all payments
    const { error } = await supabase
      .from('payments')
      .insert(payments)

    if (error) throw error

    console.log(`Generated ${payments.length} payments for loan ${loanId}`)
    return { error: null }
  } catch (error) {
    console.error('Error generating payment schedule:', error)
    return { error }
  }
}

/**
 * Create a new loan
 */
export const createLoan = async (userId, loanData) => {
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  try {
    // Get the next loan number for this borrower
    const { data: existingLoans, error: countError } = await supabase
      .from('loans')
      .select('id')
      .eq('borrower_id', loanData.borrower_id)
      .order('created_at', { ascending: true })

    if (countError) throw countError

    const loanNumber = (existingLoans?.length || 0) + 1

    // Create the loan with loan_number
    const { data: loan, error: loanError } = await supabase
      .from('loans')
      .insert({
        user_id: userId,
        loan_number: loanNumber,
        ...loanData
      })
      .select()
      .single()

    if (loanError) throw loanError

    // Wait a moment for the trigger to run
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Check if payments were created by trigger
    const { data: existingPayments } = await supabase
      .from('payments')
      .select('id')
      .eq('loan_id', loan.id)

    // If no payments exist, generate them manually (fallback)
    if (!existingPayments || existingPayments.length === 0) {
      console.log('Trigger did not create payments, generating manually...')
      const { error: paymentError } = await generatePaymentSchedule(loan.id, loan)
      if (paymentError) {
        console.error('Failed to generate payment schedule:', paymentError)
        // Don't fail the loan creation, just log the error
      }
    } else {
      console.log(`${existingPayments.length} payments created by trigger`)
    }

    return { data: loan, error: null }
  } catch (error) {
    console.error('Error creating loan:', error)
    return { data: null, error }
  }
}

/**
 * Update a loan
 */
export const updateLoan = async (loanId, updates) => {
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const { data, error } = await supabase
    .from('loans')
    .update(updates)
    .eq('id', loanId)
    .select()
    .single()

  return { data, error }
}

/**
 * Update loan details (principal, start_date, first_payment_date). Recomputes weekly_amount from user settings when principal changes.
 * When first_payment_date changes, updates all payments' due_date for this loan.
 */
export const updateLoanDetails = async (loanId, userId, { principal_amount, start_date, first_payment_date }) => {
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  try {
    const updates = {}
    if (start_date != null) updates.start_date = start_date
    if (first_payment_date != null) updates.first_payment_date = first_payment_date === '' ? null : first_payment_date
    if (principal_amount != null && principal_amount > 0) {
      updates.principal_amount = parseFloat(principal_amount)
      const { data: settings } = await getUserSettings(userId)
      const rate = settings?.weekly_rate ?? 0.05
      updates.weekly_amount = Math.round(updates.principal_amount * rate * 100) / 100
    }

    if (Object.keys(updates).length === 0) return { data: null, error: null }

    const { data: loan, error: loanError } = await supabase
      .from('loans')
      .update(updates)
      .eq('id', loanId)
      .select()
      .single()

    if (loanError) throw loanError

    if (updates.weekly_amount != null) {
      const { error: payError } = await supabase
        .from('payments')
        .update({ amount_due: updates.weekly_amount })
        .eq('loan_id', loanId)
        .in('status', ['pending', 'partial', 'overdue'])
      if (payError) throw payError
    }

    if (updates.first_payment_date !== undefined) {
      const { data: payments, error: listErr } = await supabase
        .from('payments')
        .select('id, week_number')
        .eq('loan_id', loanId)
        .order('week_number', { ascending: true })
      if (!listErr && payments?.length) {
        let firstDue
        if (loan.first_payment_date) {
          firstDue = new Date(loan.first_payment_date)
        } else if (loan.start_date) {
          const start = new Date(loan.start_date)
          const day = start.getDay()
          const daysUntilSunday = day === 0 ? 7 : (7 - day)
          firstDue = new Date(start)
          firstDue.setDate(firstDue.getDate() + daysUntilSunday)
        }
        if (firstDue) {
          for (const p of payments) {
            const dueDate = new Date(firstDue)
            dueDate.setDate(dueDate.getDate() + (p.week_number - 1) * 7)
            const dueStr = dueDate.toISOString().split('T')[0]
            await supabase.from('payments').update({ due_date: dueStr }).eq('id', p.id)
          }
        }
      }
    }

    return { data: loan, error: null }
  } catch (error) {
    console.error('Error updating loan details:', error)
    return { data: null, error }
  }
}

/**
 * Delete a loan (cascades to payments)
 */
export const deleteLoan = async (loanId) => {
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const { error } = await supabase
    .from('loans')
    .delete()
    .eq('id', loanId)

  return { error }
}

/**
 * Foreclose a loan
 * Marks loan as foreclosed and closes all pending EMIs
 */
export const forecloseLoan = async (loanId, settlementAmount, foreclosureDate = null) => {
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  try {
    const toDateStr = (d) => {
      if (typeof d === 'string') return d
      const x = d || new Date()
      return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
    }
    const dateStr = toDateStr(foreclosureDate || new Date())

    // 1. Fetch unpaid payments first (before loan update; trigger would set status to foreclosed)
    const { data: unpaidPayments, error: fetchError } = await supabase
      .from('payments')
      .select('id, amount_due')
      .eq('loan_id', loanId)
      .in('status', ['pending', 'partial', 'overdue'])

    if (fetchError) throw fetchError

    // 2. Update loan status to foreclosed
    const { data: loan, error: loanError } = await supabase
      .from('loans')
      .update({
        status: 'foreclosed',
        foreclosure_date: dateStr,
        foreclosure_settlement_amount: settlementAmount
      })
      .eq('id', loanId)
      .select()
      .single()

    if (loanError) throw loanError

    // 3. Mark each pending week as paid (amount_paid = amount_due, paid_date = foreclosure date) so it shows in Collected
    if (unpaidPayments?.length) {
      for (const p of unpaidPayments) {
        const { error: upErr } = await supabase
          .from('payments')
          .update({
            amount_paid: parseFloat(p.amount_due),
            paid_date: dateStr,
            status: 'paid',
            notes: 'Loan foreclosed - closed as paid'
          })
          .eq('id', p.id)
        if (upErr) throw upErr
      }
    }

    // Settlement amount is stored in loan.foreclosure_settlement_amount (no payment row; payments require week_number > 0)
    return { data: loan, error: null }
  } catch (error) {
    console.error('Error foreclosing loan:', error)
    return { data: null, error }
  }
}

/**
 * Settle and close a loan: record one settlement amount on the settlement date (so it shows in that week's collections).
 * All pending/rest weeks are marked settled (foreclosed). No per-week allocation – amount can be equal, lower, or higher than pending.
 */
export const settleAndCloseLoan = async (loanId, settlementAmount, settlementDate = null) => {
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  try {
    const toDateStr = (d) => {
      if (typeof d === 'string') return d.split('T')[0]
      const x = d || new Date()
      return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
    }
    const dateStr = toDateStr(settlementDate || new Date())
    const amount = parseFloat(settlementAmount) || 0

    const { data: unpaidPayments, error: fetchError } = await supabase
      .from('payments')
      .select('id, week_number')
      .eq('loan_id', loanId)
      .in('status', ['pending', 'partial', 'overdue'])
      .order('week_number', { ascending: true })

    if (fetchError) return { data: null, error: fetchError }

    const list = unpaidPayments || []

    if (list.length > 0) {
      const firstId = list[0].id
      await supabase
        .from('payments')
        .update({
          amount_paid: amount,
          paid_date: dateStr,
          status: 'paid',
          notes: 'Settle & close - settlement amount'
        })
        .eq('id', firstId)

      for (let i = 1; i < list.length; i++) {
        await supabase.from('payments').update({ status: 'foreclosed' }).eq('id', list[i].id)
      }
    }

    const { data: loan, error: loanError } = await supabase
      .from('loans')
      .update({
        status: 'foreclosed',
        foreclosure_date: dateStr,
        foreclosure_settlement_amount: amount
      })
      .eq('id', loanId)
      .select()
      .single()

    if (loanError) throw loanError
    return { data: loan, error: null }
  } catch (error) {
    console.error('Error in settleAndCloseLoan:', error)
    return { data: null, error }
  }
}

/**
 * Get active loans count
 */
export const getActiveLoansCount = async (userId) => {
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const { count, error } = await supabase
    .from('loans')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'active')

  return { count, error }
}

/**
 * Get loan with payment schedule
 */
export const getLoanWithPayments = async (loanId) => {
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const { data: loan, error: loanError } = await supabase
    .from('loans')
    .select(`
      *,
      borrower:borrowers(*),
      payments(*)
    `)
    .eq('id', loanId)
    .single()

  if (loanError) return { data: null, error: loanError }

  // Sort payments by week number
  if (loan.payments) {
    loan.payments.sort((a, b) => a.week_number - b.week_number)
  }

  return { data: loan, error: null }
}
