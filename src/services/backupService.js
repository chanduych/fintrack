import { supabase } from './supabaseClient'

/**
 * Create a full backup to Supabase Storage (JSON format)
 */
export const createAutoBackup = async (userId, userEmail) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupFolder = `backups/${userId}/${timestamp}`

    // Fetch all data
    const [borrowersRes, loansRes, paymentsRes, settingsRes] = await Promise.all([
      supabase.from('borrowers').select('*').eq('user_id', userId).order('name'),
      supabase.from('loans').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('payments').select('payments.*, loan:loans!inner(user_id)').eq('loan.user_id', userId).order('due_date'),
      supabase.from('settings').select('*').eq('user_id', userId).single()
    ])

    // Create complete backup JSON
    const backupData = {
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

    // Upload single JSON backup file
    const { data: backupUpload, error: backupError } = await supabase.storage
      .from('fintrack-backups')
      .upload(`${backupFolder}/backup.json`, JSON.stringify(backupData, null, 2), {
        contentType: 'application/json',
        upsert: false
      })

    if (backupError) {
      throw backupError
    }

    // Store backup record in database
    const { error: recordError } = await supabase
      .from('backup_history')
      .insert({
        user_id: userId,
        backup_path: backupFolder,
        backup_type: 'manual',
        file_count: 1,
        borrowers_count: backupData.borrowers.length,
        loans_count: backupData.loans.length,
        payments_count: backupData.payments.length,
        status: 'success',
        error_message: null
      })

    if (recordError) {
      console.error('Failed to record backup history:', recordError)
    }

    return {
      success: true,
      backupPath: backupFolder,
      backupFile: backupUpload.path,
      counts: {
        borrowers: backupData.borrowers.length,
        loans: backupData.loans.length,
        payments: backupData.payments.length
      },
      error: null
    }
  } catch (error) {
    console.error('Error creating auto backup:', error)
    return { success: false, error }
  }
}

/**
 * List all backups for user
 */
export const listBackups = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('backup_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error

    return { data, error: null }
  } catch (error) {
    console.error('Error listing backups:', error)
    return { data: null, error }
  }
}

/**
 * Download a specific backup file
 */
export const downloadBackupFile = async (backupPath, filename) => {
  try {
    const { data, error } = await supabase.storage
      .from('fintrack-backups')
      .download(`${backupPath}/${filename}`)

    if (error) throw error

    // Create download link
    const url = URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    return { success: true, error: null }
  } catch (error) {
    console.error('Error downloading backup file:', error)
    return { success: false, error }
  }
}

/**
 * Delete old backups (keep only last N backups)
 */
export const cleanupOldBackups = async (userId, keepCount = 10) => {
  try {
    // Get all backups
    const { data: backups, error: listError } = await supabase
      .from('backup_history')
      .select('id, backup_path')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (listError) throw listError

    // Delete old backups beyond keepCount
    if (backups.length > keepCount) {
      const toDelete = backups.slice(keepCount)

      for (const backup of toDelete) {
        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from('fintrack-backups')
          .remove([`${backup.backup_path}/backup.json`])

        if (storageError) {
          console.error('Error deleting backup files:', storageError)
        }

        // Delete record
        await supabase
          .from('backup_history')
          .delete()
          .eq('id', backup.id)
      }

      return { success: true, deleted: toDelete.length, error: null }
    }

    return { success: true, deleted: 0, error: null }
  } catch (error) {
    console.error('Error cleaning up backups:', error)
    return { success: false, deleted: 0, error }
  }
}

/**
 * Get last backup info
 */
export const getLastBackup = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('backup_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') throw error

    return { data: data || null, error: null }
  } catch (error) {
    console.error('Error getting last backup:', error)
    return { data: null, error }
  }
}
