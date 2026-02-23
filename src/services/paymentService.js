import { supabase } from './supabaseClient'

const toDateStr = (date) => {
  if (typeof date === 'string') return date
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/**
 * Get all payments for a loan
 */
export const getPaymentsByLoan = async (loanId) => {
  try {
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        loan:loans (
          borrower_id,
          borrower:borrowers (
            name,
            area,
            leader_tag
          )
        )
      `)
      .eq('loan_id', loanId)
      .order('week_number', { ascending: true })

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching payments:', error)
    return { data: null, error }
  }
}

/**
 * Get payments for a specific week range (all statuses - paid, pending, partial)
 * @param {object} options - { includeClosedAndForeclosed: boolean } When true, include closed/foreclosed loans (for current week only). When false, exclude them so they don't appear in other weeks.
 */
export const getPaymentsByWeek = async (userId, weekStart, weekEnd, options = {}) => {
  try {
    const startStr = toDateStr(weekStart)
    const endStr = toDateStr(weekEnd)
    const { includeClosedAndForeclosed = false } = options

    let query = supabase.from('loans').select('id').eq('user_id', userId)
    if (!includeClosedAndForeclosed) {
      query = query.eq('status', 'active')
    }
    const { data: userLoans, error: loanError } = await query

    if (loanError) throw loanError
    if (!userLoans || userLoans.length === 0) return { data: [], error: null }

    const loanIds = userLoans.map(l => l.id)

    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        loan:loans (
          id,
          user_id,
          borrower_id,
          status,
          loan_number,
          borrower:borrowers (
            id,
            name,
            area,
            phone,
            leader_tag
          )
        )
      `)
      .in('loan_id', loanIds)
      .gte('due_date', startStr)
      .lte('due_date', endStr)
      .order('due_date', { ascending: true })

    if (error) throw error

    // Flatten the nested structure
    const flattenedData = data?.map(payment => ({
      ...payment,
      borrower_id: payment.loan?.borrower?.id,
      borrower_name: payment.loan?.borrower?.name,
      borrower_area: payment.loan?.borrower?.area,
      borrower_phone: payment.loan?.borrower?.phone,
      borrower_leader_tag: payment.loan?.borrower?.leader_tag,
      loan_id: payment.loan?.id,
      loan_status: payment.loan?.status,
      loan_number: payment.loan?.loan_number
    })) || []

    return { data: flattenedData, error: null }
  } catch (error) {
    console.error('Error fetching weekly payments:', error)
    return { data: null, error }
  }
}

/**
 * Record payment with FIFO allocation logic
 * Automatically allocates payment amount:
 * 1. Oldest overdue EMIs first (FIFO)
 * 2. Then current due EMIs
 * 3. Extra amount as prepayment (reducing principal)
 *
 * @param {string} borrowerId - Borrower ID to apply payment to
 * @param {number} totalAmount - Total payment amount
 * @param {string} paidDate - Payment date
 * @param {string} notes - Optional notes
 * @returns {object} { success, allocations, error }
 */
export const recordPaymentFIFO = async (borrowerId, totalAmount, paidDate, notes = '') => {
  try {
    const paymentAmount = parseFloat(totalAmount)
    if (paymentAmount <= 0) {
      return { success: false, error: 'Invalid payment amount' }
    }

    // Get all active loans for this borrower
    const { data: loans, error: loanError } = await supabase
      .from('loans')
      .select('id')
      .eq('borrower_id', borrowerId)
      .eq('status', 'active')

    if (loanError) throw loanError
    if (!loans || loans.length === 0) {
      return { success: false, error: 'No active loans found for borrower' }
    }

    const loanIds = loans.map(l => l.id)

    // Get all unpaid payments across all borrower's loans, sorted by due_date (FIFO)
    const { data: unpaidPayments, error: paymentsError } = await supabase
      .from('payments')
      .select('id, loan_id, week_number, due_date, amount_due, amount_paid, status')
      .in('loan_id', loanIds)
      .in('status', ['pending', 'partial', 'overdue'])
      .order('due_date', { ascending: true })
      .order('week_number', { ascending: true })

    if (paymentsError) throw paymentsError

    let remainingAmount = paymentAmount
    const allocations = []

    // Allocate to each payment in FIFO order
    for (const payment of unpaidPayments || []) {
      if (remainingAmount <= 0) break

      const amountOwed = parseFloat(payment.amount_due) - parseFloat(payment.amount_paid || 0)
      const amountToApply = Math.min(remainingAmount, amountOwed)

      const newAmountPaid = parseFloat(payment.amount_paid || 0) + amountToApply
      const newStatus = newAmountPaid >= parseFloat(payment.amount_due) ? 'paid' : 'partial'

      // Update this payment
      const { error: updateError } = await supabase
        .from('payments')
        .update({
          amount_paid: newAmountPaid,
          paid_date: paidDate,
          status: newStatus,
          notes: notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.id)

      if (updateError) throw updateError

      allocations.push({
        payment_id: payment.id,
        week_number: payment.week_number,
        amount_applied: amountToApply,
        status: newStatus
      })

      remainingAmount -= amountToApply
    }

    // Check if all payments are paid for each loan and close if needed
    for (const loanId of loanIds) {
      await checkAndCloseLoan(loanId)
    }

    // If there's remaining amount, it's a prepayment/overpayment
    const result = {
      success: true,
      allocations,
      overpayment: remainingAmount > 0 ? remainingAmount : 0,
      error: null
    }

    if (remainingAmount > 0) {
      console.log(`Overpayment of ${remainingAmount} recorded as prepayment`)
      // TODO: Handle prepayment (reduce principal of oldest active loan)
    }

    return result
  } catch (error) {
    console.error('Error recording payment with FIFO:', error)
    return { success: false, allocations: [], error }
  }
}

/**
 * Record a payment (legacy - single payment)
 * @deprecated Use recordPaymentFIFO instead for proper FIFO allocation
 */
export const recordPayment = async (paymentId, amount, paidDate, notes = '') => {
  try {
    // First, get the current payment details
    const { data: payment, error: fetchError } = await supabase
      .from('payments')
      .select('*, loan:loans(id)')
      .eq('id', paymentId)
      .single()

    if (fetchError) throw fetchError

    const paymentAmount = parseFloat(amount)
    const amountDue = parseFloat(payment.amount_due)

    // Allow any amount to be recorded (partial, full, or overpayment)
    const newAmountPaid = paymentAmount

    // Determine status
    let status = 'pending'
    if (newAmountPaid >= amountDue) {
      status = 'paid'
    } else if (newAmountPaid > 0) {
      status = 'partial'
    }

    // Update the payment - simple direct update
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        amount_paid: newAmountPaid,
        paid_date: paidDate,
        status: status,
        notes: notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId)

    if (updateError) throw updateError

    // Check if all payments are paid and close loan
    await checkAndCloseLoan(payment.loan.id)

    return { data: { success: true }, error: null }
  } catch (error) {
    console.error('Error recording payment:', error)
    return { data: null, error }
  }
}

/**
 * Check if all payments are paid and close the loan
 */
const checkAndCloseLoan = async (loanId) => {
  try {
    const { data: allPayments, error } = await supabase
      .from('payments')
      .select('status')
      .eq('loan_id', loanId)

    if (error) return

    const allPaid = allPayments.every(p => p.status === 'paid')

    if (allPaid) {
      await supabase
        .from('loans')
        .update({
          status: 'closed',
          updated_at: new Date().toISOString()
        })
        .eq('id', loanId)
    }
  } catch (error) {
    console.error('Error checking loan status:', error)
  }
}

/**
 * Record all past-due payments for a loan as paid (mass backfill).
 * Each payment is recorded with amount_paid = amount_due and paid_date = due_date (actual due date).
 * @param {string} loanId
 * @returns {{ data: { recorded: number }, error: any }}
 */
export const recordBulkPastPayments = async (loanId) => {
  try {
    const todayStr = toDateStr(new Date())

    const { data: payments, error: fetchError } = await supabase
      .from('payments')
      .select('id, due_date, amount_due, status')
      .eq('loan_id', loanId)
      .order('week_number', { ascending: true })

    if (fetchError) return { data: null, error: fetchError }
    if (!payments || payments.length === 0) return { data: { recorded: 0 }, error: null }

    const pastUnpaid = payments.filter(p => {
      if (p.status === 'paid') return false
      const dueStr = typeof p.due_date === 'string' ? p.due_date.split('T')[0] : toDateStr(p.due_date)
      return dueStr < todayStr
    })

    let recorded = 0
    for (const p of pastUnpaid) {
      const paidDateStr = typeof p.due_date === 'string' ? p.due_date.split('T')[0] : toDateStr(p.due_date)
      const { error } = await recordPayment(p.id, p.amount_due, paidDateStr, 'Mass backfill - actual due date')
      if (error) return { data: null, error }
      recorded++
    }

    return { data: { recorded }, error: null }
  } catch (error) {
    console.error('Error in recordBulkPastPayments:', error)
    return { data: null, error }
  }
}

/**
 * Get all pending/partial payments (overdue) - unpaid with due_date on or before cutoff
 * @param {string} userId
 * @param {Date|string} cutoffDate - Include payments with due_date <= this date (typically today)
 */
export const getOverduePayments_all = async (userId, cutoffDate) => {
  try {
    const cutoff = toDateStr(cutoffDate || new Date())

    // Get user's loan IDs (exclude foreclosed)
    const { data: userLoans, error: loanError } = await supabase
      .from('loans')
      .select('id')
      .eq('user_id', userId)
      .neq('status', 'foreclosed')

    if (loanError) throw loanError
    if (!userLoans || userLoans.length === 0) {
      return { data: [], error: null }
    }

    const loanIds = userLoans.map(l => l.id)

    // All pending/partial/overdue payments with due_date on or before the cutoff
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        loan:loans (
          id,
          user_id,
          borrower_id,
          status,
          loan_number,
          borrower:borrowers (
            id,
            name,
            area,
            phone,
            leader_tag
          )
        )
      `)
      .in('loan_id', loanIds)
      .in('status', ['pending', 'partial', 'overdue'])
      .lte('due_date', cutoff)
      .order('due_date', { ascending: true })

    if (error) throw error

    const flattenedData = data?.map(payment => ({
      ...payment,
      borrower_id: payment.loan?.borrower?.id,
      borrower_name: payment.loan?.borrower?.name,
      borrower_area: payment.loan?.borrower?.area,
      borrower_phone: payment.loan?.borrower?.phone,
      borrower_leader_tag: payment.loan?.borrower?.leader_tag,
      loan_id: payment.loan?.id,
      loan_status: payment.loan?.status,
      loan_number: payment.loan?.loan_number
    })) || []

    return { data: flattenedData, error: null }
  } catch (error) {
    console.error('Error fetching overdue payments:', error)
    return { data: null, error }
  }
}

/**
 * Get payments actually collected in a date range (by paid_date, not due_date)
 * This tracks real money collected, including prepayments and extra payments
 */
export const getPaymentsCollectedInRange = async (userId, startDate, endDate) => {
  try {
    const startStr = toDateStr(startDate)
    const endStr = toDateStr(endDate)

    // Get user's loan IDs first
    const { data: userLoans, error: loanError } = await supabase
      .from('loans')
      .select('id')
      .eq('user_id', userId)

    if (loanError) throw loanError
    if (!userLoans || userLoans.length === 0) return { data: [], error: null }

    const loanIds = userLoans.map(l => l.id)

    // Query payments where paid_date falls in the range (includes foreclosed so closure shows in that week's collected)
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        loan:loans (
          id,
          user_id,
          borrower_id,
          status,
          loan_number,
          borrower:borrowers (
            id,
            name,
            area,
            phone,
            leader_tag
          )
        )
      `)
      .in('loan_id', loanIds)
      .not('paid_date', 'is', null)
      .gte('paid_date', startStr)
      .lte('paid_date', endStr)
      .order('paid_date', { ascending: true })

    if (error) throw error

    const flattenedData = data?.map(payment => ({
      ...payment,
      borrower_id: payment.loan?.borrower?.id,
      borrower_name: payment.loan?.borrower?.name,
      borrower_area: payment.loan?.borrower?.area,
      borrower_phone: payment.loan?.borrower?.phone,
      borrower_leader_tag: payment.loan?.borrower?.leader_tag,
      loan_id: payment.loan?.id,
      loan_status: payment.loan?.status,
      loan_number: payment.loan?.loan_number
    })) || []

    return { data: flattenedData, error: null }
  } catch (error) {
    console.error('Error fetching collected payments:', error)
    return { data: null, error }
  }
}

/**
 * Get all unpaid payments for a borrower across ALL their loans
 * Used by RecordPaymentModal to let user choose which week/loan to pay
 * Returns payments grouped by loan with loan numbering
 */
export const getUnpaidPaymentsForBorrower = async (borrowerId) => {
  try {
    // Get all active loans for this borrower
    const { data: loans, error: loanError } = await supabase
      .from('loans')
      .select('id, loan_number, principal_amount, weekly_amount, number_of_weeks, start_date, status')
      .eq('borrower_id', borrowerId)
      .eq('status', 'active')
      .order('loan_number', { ascending: true })

    if (loanError) throw loanError
    if (!loans || loans.length === 0) return { data: [], error: null }

    const loanIds = loans.map(l => l.id)

    // Get all unpaid payments across all loans
    const { data: payments, error } = await supabase
      .from('payments')
      .select('id, loan_id, week_number, due_date, amount_due, amount_paid, status')
      .in('loan_id', loanIds)
      .in('status', ['pending', 'partial', 'overdue'])
      .order('due_date', { ascending: true })

    if (error) throw error

    // Build loan info map using database loan_number
    const loanInfoMap = {}
    loans.forEach(loan => {
      loanInfoMap[loan.id] = {
        loanNumber: loan.loan_number || 1,
        principal: loan.principal_amount,
        weeklyAmount: loan.weekly_amount
      }
    })

    const taggedPayments = (payments || []).map(p => ({
      ...p,
      loan_number: loanInfoMap[p.loan_id]?.loanNumber || 1,
      loan_principal: loanInfoMap[p.loan_id]?.principal,
      loan_weekly_amount: loanInfoMap[p.loan_id]?.weeklyAmount
    }))

    return {
      data: taggedPayments,
      totalLoans: loans.length,
      error: null
    }
  } catch (error) {
    console.error('Error fetching unpaid payments for borrower:', error)
    return { data: [], totalLoans: 0, error }
  }
}

/**
 * Get all unpaid payments for a specific loan (not borrower-wide).
 * Used by RecordPaymentModal to keep payments loan-independent.
 * Includes past overdue weeks.
 */
export const getUnpaidPaymentsForLoan = async (loanId) => {
  try {
    const { data: loan, error: loanError } = await supabase
      .from('loans')
      .select('id, loan_number, principal_amount, weekly_amount')
      .eq('id', loanId)
      .single()

    if (loanError) throw loanError

    const { data: payments, error } = await supabase
      .from('payments')
      .select('id, loan_id, week_number, due_date, amount_due, amount_paid, status')
      .eq('loan_id', loanId)
      .in('status', ['pending', 'partial', 'overdue'])
      .order('week_number', { ascending: true })

    if (error) throw error

    const taggedPayments = (payments || []).map(p => ({
      ...p,
      loan_number: loan?.loan_number || 1,
      loan_principal: loan?.principal_amount,
      loan_weekly_amount: loan?.weekly_amount
    }))

    return { data: taggedPayments, error: null }
  } catch (error) {
    console.error('Error fetching unpaid payments for loan:', error)
    return { data: [], error }
  }
}

/**
 * Get overdue payments (legacy alias - used by AnalyticsDashboard)
 * Uses today as cutoff so it includes everything unpaid up to today
 */
export const getOverduePayments = async (userId) => {
  return getOverduePayments_all(userId, new Date())
}

/**
 * Update payment status
 */
export const updatePaymentStatus = async (paymentId, status) => {
  try {
    const { data, error } = await supabase
      .from('payments')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId)
      .select()

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error updating payment status:', error)
    return { data: null, error }
  }
}

/**
 * Reset a payment record (clear payment data but keep schedule)
 */
export const resetPayment = async (paymentId) => {
  try {
    const { data: payment, error: fetchError } = await supabase
      .from('payments')
      .select('*, loan:loans(id)')
      .eq('id', paymentId)
      .single()

    if (fetchError) throw fetchError

    // Reset to pending state
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        amount_paid: 0,
        paid_date: null,
        status: 'pending',
        notes: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId)

    if (updateError) throw updateError

    // Reopen loan if it was closed
    await supabase
      .from('loans')
      .update({
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.loan.id)
      .eq('status', 'closed')

    return { error: null }
  } catch (error) {
    console.error('Error resetting payment:', error)
    return { error }
  }
}

/**
 * Delete a payment (use with caution)
 */
export const deletePayment = async (paymentId) => {
  try {
    const { error } = await supabase
      .from('payments')
      .delete()
      .eq('id', paymentId)

    if (error) throw error
    return { error: null }
  } catch (error) {
    console.error('Error deleting payment:', error)
    return { error }
  }
}
