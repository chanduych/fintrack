import { supabase } from './supabaseClient'

/**
 * Initialize user settings and profile after signup/login
 * This ensures settings exist even if the database trigger fails
 */
export const initializeUserData = async (userId) => {
  if (!supabase) return { error: 'Supabase not configured' }

  try {
    // Check if settings already exist
    const { data: existingSettings } = await supabase
      .from('settings')
      .select('id')
      .eq('user_id', userId)
      .single()

    // Create default settings if they don't exist
    if (!existingSettings) {
      const { error: settingsError } = await supabase
        .from('settings')
        .insert({
          user_id: userId,
          default_weeks: 24,
          weekly_rate: 0.05,
          default_collection_day: 0
        })

      if (settingsError && settingsError.code !== '23505') { // Ignore duplicate key errors
        console.error('Error creating settings:', settingsError)
      }
    }

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', userId)
      .single()

    // Create profile if it doesn't exist
    if (!existingProfile) {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: userId
        })

      if (profileError && profileError.code !== '23505') { // Ignore duplicate key errors
        console.error('Error creating profile:', profileError)
      }
    }

    return { error: null }
  } catch (error) {
    console.error('Error initializing user data:', error)
    return { error }
  }
}

/**
 * Get user settings
 */
export const getUserSettings = async (userId) => {
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', userId)
    .single()

  return { data, error }
}

/**
 * Update user settings
 */
export const updateUserSettings = async (userId, updates) => {
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const { data, error } = await supabase
    .from('settings')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single()

  return { data, error }
}

/**
 * Get user profile
 */
export const getUserProfile = async (userId) => {
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()

  return { data, error }
}

/**
 * Update user profile
 */
export const updateUserProfile = async (userId, updates) => {
  if (!supabase) return { data: null, error: 'Supabase not configured' }

  const { data, error } = await supabase
    .from('user_profiles')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single()

  return { data, error }
}
