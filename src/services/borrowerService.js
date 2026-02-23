import { supabase } from './supabaseClient'

/**
 * Get all borrowers for the authenticated user
 */
export const getBorrowers = async (userId) => {
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const { data, error } = await supabase
    .from('borrowers')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return { data, error }
}

/**
 * Get a single borrower by ID
 */
export const getBorrower = async (borrowerId) => {
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const { data, error } = await supabase
    .from('borrowers')
    .select('*')
    .eq('id', borrowerId)
    .single()

  return { data, error }
}

/**
 * Create a new borrower
 */
export const createBorrower = async (userId, borrowerData) => {
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const { data, error } = await supabase
    .from('borrowers')
    .insert({
      user_id: userId,
      ...borrowerData
    })
    .select()
    .single()

  return { data, error }
}

/**
 * Update a borrower
 */
export const updateBorrower = async (borrowerId, updates) => {
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const { data, error } = await supabase
    .from('borrowers')
    .update(updates)
    .eq('id', borrowerId)
    .select()
    .single()

  return { data, error }
}

/**
 * Delete a borrower
 */
export const deleteBorrower = async (borrowerId) => {
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const { error } = await supabase
    .from('borrowers')
    .delete()
    .eq('id', borrowerId)

  return { error }
}

/**
 * Search borrowers by name, area, or phone
 */
export const searchBorrowers = async (userId, searchTerm) => {
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const { data, error } = await supabase
    .from('borrowers')
    .select('*')
    .eq('user_id', userId)
    .or(`name.ilike.%${searchTerm}%,area.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
    .order('created_at', { ascending: false })

  return { data, error }
}

/**
 * Get borrowers filtered by area
 */
export const getBorrowersByArea = async (userId, area) => {
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const { data, error } = await supabase
    .from('borrowers')
    .select('*')
    .eq('user_id', userId)
    .eq('area', area)
    .order('name')

  return { data, error }
}

/**
 * Get borrowers filtered by leader tag
 */
export const getBorrowersByLeaderTag = async (userId, leaderTag) => {
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const { data, error } = await supabase
    .from('borrowers')
    .select('*')
    .eq('user_id', userId)
    .eq('leader_tag', leaderTag)
    .order('name')

  return { data, error }
}

/**
 * Get borrower with loan history
 */
export const getBorrowerWithLoans = async (borrowerId) => {
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const { data, error } = await supabase
    .from('borrower_loan_history')
    .select('*')
    .eq('borrower_id', borrowerId)
    .single()

  return { data, error }
}
