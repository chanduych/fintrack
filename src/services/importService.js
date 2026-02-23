import { supabase } from './supabaseClient'

/**
 * Parse CSV file to array of objects
 */
export const parseCSV = (csvText) => {
  const lines = csvText.trim().split('\n')
  if (lines.length < 2) {
    throw new Error('CSV file is empty or has no data rows')
  }

  // Parse header
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))

  // Parse rows
  const data = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Handle quoted values with commas
    const values = []
    let current = ''
    let inQuotes = false

    for (let j = 0; j < line.length; j++) {
      const char = line[j]

      if (char === '"') {
        if (inQuotes && line[j + 1] === '"') {
          // Escaped quote
          current += '"'
          j++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    values.push(current.trim())

    // Create object from headers and values
    const row = {}
    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })
    data.push(row)
  }

  return { headers, data }
}

/**
 * Validate borrower data
 */
export const validateBorrowers = (data) => {
  const errors = []
  const valid = []

  data.forEach((row, index) => {
    const rowNum = index + 2 // +2 because of header and 0-index
    const issues = []

    if (!row.name || row.name.trim() === '') {
      issues.push('Name is required')
    }

    if (row.phone && !/^\d{10}$/.test(row.phone.replace(/\D/g, ''))) {
      issues.push('Phone must be 10 digits')
    }

    if (issues.length > 0) {
      errors.push({ row: rowNum, data: row, issues })
    } else {
      valid.push({
        name: row.name.trim(),
        area: row.area?.trim() || '',
        phone: row.phone?.replace(/\D/g, '').slice(0, 10) || '',
        leader_tag: row.leader_tag?.trim() || '',
        is_active: row.is_active === 'false' ? false : true
      })
    }
  })

  return { valid, errors }
}

/**
 * Check for duplicate borrowers
 */
export const checkDuplicateBorrowers = async (userId, borrowers) => {
  try {
    // Fetch existing borrowers
    const { data: existing, error } = await supabase
      .from('borrowers')
      .select('name, phone')
      .eq('user_id', userId)

    if (error) throw error

    const duplicates = []
    const unique = []

    borrowers.forEach(borrower => {
      const isDuplicate = existing.some(e =>
        (e.name.toLowerCase() === borrower.name.toLowerCase()) ||
        (borrower.phone && e.phone === borrower.phone)
      )

      if (isDuplicate) {
        duplicates.push(borrower)
      } else {
        unique.push(borrower)
      }
    })

    return { unique, duplicates, error: null }
  } catch (error) {
    console.error('Error checking duplicates:', error)
    return { unique: [], duplicates: [], error }
  }
}

/**
 * Import borrowers into database
 */
export const importBorrowers = async (userId, borrowers) => {
  try {
    const borrowersWithUserId = borrowers.map(b => ({
      ...b,
      user_id: userId
    }))

    const { data, error } = await supabase
      .from('borrowers')
      .insert(borrowersWithUserId)
      .select()

    if (error) throw error

    return { data, error: null, count: data.length }
  } catch (error) {
    console.error('Error importing borrowers:', error)
    return { data: null, error, count: 0 }
  }
}

/**
 * Import full backup JSON
 */
export const importBackupJSON = async (userId, backupData) => {
  try {
    // Validate backup structure
    if (!backupData.borrowers || !backupData.loans || !backupData.payments) {
      throw new Error('Invalid backup file format')
    }

    const results = {
      borrowers: 0,
      loans: 0,
      payments: 0,
      errors: []
    }

    // 1. Import borrowers (with ID mapping)
    const borrowerIdMap = {} // old_id -> new_id

    if (backupData.borrowers.length > 0) {
      const borrowersToImport = backupData.borrowers.map(b => ({
        user_id: userId,
        name: b.name,
        area: b.area || '',
        phone: b.phone || '',
        leader_tag: b.leader_tag || '',
        is_active: b.is_active !== false
      }))

      const { data: newBorrowers, error: borrowerError } = await supabase
        .from('borrowers')
        .insert(borrowersToImport)
        .select('id')

      if (borrowerError) throw borrowerError

      backupData.borrowers.forEach((oldBorrower, index) => {
        borrowerIdMap[oldBorrower.id] = newBorrowers[index].id
      })

      results.borrowers = newBorrowers.length
    }

    // 2. Import loans (with ID mapping)
    const loanIdMap = {} // old_id -> new_id

    if (backupData.loans.length > 0) {
      const loansToImport = backupData.loans.map(l => ({
        user_id: userId,
        borrower_id: borrowerIdMap[l.borrower_id],
        loan_number: l.loan_number || 1,
        principal_amount: l.principal_amount,
        weekly_amount: l.weekly_amount,
        number_of_weeks: l.number_of_weeks,
        total_amount: l.total_amount,
        start_date: l.start_date,
        first_payment_date: l.first_payment_date || null,
        collection_day: l.collection_day || 0,
        status: l.status || 'active',
        foreclosure_date: l.foreclosure_date || null,
        foreclosure_settlement_amount: l.foreclosure_settlement_amount || null
      }))

      const { data: newLoans, error: loanError } = await supabase
        .from('loans')
        .insert(loansToImport)
        .select('id')

      if (loanError) throw loanError

      backupData.loans.forEach((oldLoan, index) => {
        loanIdMap[oldLoan.id] = newLoans[index].id
      })

      results.loans = newLoans.length
    }

    // 3. Import payments
    if (backupData.payments.length > 0) {
      const paymentsToImport = backupData.payments.map(p => ({
        loan_id: loanIdMap[p.loan_id],
        week_number: p.week_number,
        due_date: p.due_date,
        amount_due: p.amount_due,
        amount_paid: p.amount_paid || 0,
        paid_date: p.paid_date || null,
        status: p.status || 'pending',
        notes: p.notes || ''
      }))

      const { data: newPayments, error: paymentError } = await supabase
        .from('payments')
        .insert(paymentsToImport)
        .select('id')

      if (paymentError) throw paymentError

      results.payments = newPayments.length
    }

    // 4. Import settings
    if (backupData.settings) {
      const { error: settingsError } = await supabase
        .from('settings')
        .upsert({
          user_id: userId,
          default_weeks: backupData.settings.default_weeks || 24,
          weekly_rate: backupData.settings.weekly_rate || 0.05,
          default_collection_day: backupData.settings.default_collection_day || 0,
          allow_mass_record_past: backupData.settings.allow_mass_record_past || false
        })

      if (settingsError) {
        results.errors.push('Settings import failed: ' + settingsError.message)
      }
    }

    return { success: true, results, error: null }
  } catch (error) {
    console.error('Error importing backup:', error)
    return { success: false, results: null, error }
  }
}
