import { supabase } from './supabaseClient'

/**
 * Export all data as JSON (full backup)
 */
export const exportAllDataJSON = async (userId, userEmail) => {
  try {
    // Fetch all data in parallel
    const [borrowersRes, loansRes, paymentsRes, settingsRes] = await Promise.all([
      supabase.from('borrowers').select('*').eq('user_id', userId),
      supabase.from('loans').select('*').eq('user_id', userId),
      supabase.from('payments').select('payments.*, loan:loans!inner(user_id)').eq('loan.user_id', userId),
      supabase.from('settings').select('*').eq('user_id', userId).single()
    ])

    const exportData = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      user: {
        id: userId,
        email: userEmail
      },
      borrowers: borrowersRes.data || [],
      loans: loansRes.data || [],
      payments: (paymentsRes.data || []).map(p => ({
        ...p,
        loan: undefined // Remove nested loan object
      })),
      settings: settingsRes.data || {
        default_weeks: 24,
        weekly_rate: 0.05,
        default_collection_day: 0,
        allow_mass_record_past: false
      }
    }

    // Create downloadable JSON file
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fintrack-backup-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    return { success: true, error: null }
  } catch (error) {
    console.error('Error exporting data:', error)
    return { success: false, error }
  }
}

/**
 * Export borrowers as CSV
 */
export const exportBorrowersCSV = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('borrowers')
      .select('*')
      .eq('user_id', userId)
      .order('name')

    if (error) throw error

    // Convert to CSV
    const headers = ['id', 'name', 'area', 'phone', 'leader_tag', 'is_active', 'created_at']
    const csvRows = [headers.join(',')]

    for (const row of data || []) {
      const values = headers.map(header => {
        const value = row[header] ?? ''
        // Escape commas and quotes
        return `"${String(value).replace(/"/g, '""')}"`
      })
      csvRows.push(values.join(','))
    }

    const csvContent = csvRows.join('\n')
    downloadCSV(csvContent, `borrowers-${new Date().toISOString().split('T')[0]}.csv`)

    return { success: true, error: null }
  } catch (error) {
    console.error('Error exporting borrowers:', error)
    return { success: false, error }
  }
}

/**
 * Export loans as CSV
 */
export const exportLoansCSV = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('loans')
      .select(`
        *,
        borrower:borrowers(name)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Convert to CSV
    const headers = [
      'id', 'borrower_name', 'loan_number', 'principal_amount', 'weekly_amount',
      'number_of_weeks', 'total_amount', 'start_date', 'first_payment_date',
      'status', 'foreclosure_date', 'foreclosure_settlement_amount', 'created_at'
    ]
    const csvRows = [headers.join(',')]

    for (const row of data || []) {
      const values = [
        row.id,
        row.borrower?.name || '',
        row.loan_number || 1,
        row.principal_amount,
        row.weekly_amount,
        row.number_of_weeks,
        row.total_amount,
        row.start_date,
        row.first_payment_date || '',
        row.status,
        row.foreclosure_date || '',
        row.foreclosure_settlement_amount || '',
        row.created_at
      ].map(v => `"${String(v).replace(/"/g, '""')}"`)

      csvRows.push(values.join(','))
    }

    const csvContent = csvRows.join('\n')
    downloadCSV(csvContent, `loans-${new Date().toISOString().split('T')[0]}.csv`)

    return { success: true, error: null }
  } catch (error) {
    console.error('Error exporting loans:', error)
    return { success: false, error }
  }
}

/**
 * Export payments as CSV
 */
export const exportPaymentsCSV = async (userId) => {
  try {
    // Get user's loan IDs
    const { data: loans, error: loanError } = await supabase
      .from('loans')
      .select('id')
      .eq('user_id', userId)

    if (loanError) throw loanError

    const loanIds = (loans || []).map(l => l.id)
    if (loanIds.length === 0) {
      return { success: false, error: new Error('No loans found') }
    }

    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        loan:loans(
          loan_number,
          borrower:borrowers(name)
        )
      `)
      .in('loan_id', loanIds)
      .order('due_date')

    if (error) throw error

    // Convert to CSV
    const headers = [
      'loan_id', 'borrower_name', 'loan_number', 'week_number', 'due_date',
      'amount_due', 'amount_paid', 'paid_date', 'status', 'notes'
    ]
    const csvRows = [headers.join(',')]

    for (const row of data || []) {
      const values = [
        row.loan_id,
        row.loan?.borrower?.name || '',
        row.loan?.loan_number || 1,
        row.week_number,
        row.due_date,
        row.amount_due,
        row.amount_paid || 0,
        row.paid_date || '',
        row.status,
        row.notes || ''
      ].map(v => `"${String(v).replace(/"/g, '""')}"`)

      csvRows.push(values.join(','))
    }

    const csvContent = csvRows.join('\n')
    downloadCSV(csvContent, `payments-${new Date().toISOString().split('T')[0]}.csv`)

    return { success: true, error: null }
  } catch (error) {
    console.error('Error exporting payments:', error)
    return { success: false, error }
  }
}

/**
 * Helper to download CSV
 */
function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
