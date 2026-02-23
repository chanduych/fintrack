import { supabase } from './supabaseClient'

/**
 * Get user settings
 */
export const getSettings = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code === 'PGRST116') {
      // No settings found, return defaults
      return {
        data: {
          default_weeks: 24,
          weekly_rate: 0.05,
          default_collection_day: 0,
          allow_mass_record_past: false
        },
        error: null
      }
    }

    if (error) throw error
    return { data, error: null }
  } catch (error) {
    console.error('Error fetching settings:', error)
    return { data: null, error }
  }
}

/**
 * Update or create user settings
 */
export const updateSettings = async (userId, settings) => {
  try {
    // First check if settings exist
    const { data: existing } = await supabase
      .from('settings')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (existing) {
      // Update existing settings
      const { data, error } = await supabase
        .from('settings')
        .update({
          ...settings,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } else {
      // Create new settings
      const { data, error } = await supabase
        .from('settings')
        .insert({
          user_id: userId,
          ...settings
        })
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    }
  } catch (error) {
    console.error('Error updating settings:', error)
    return { data: null, error }
  }
}

/**
 * Reset settings to defaults
 */
export const resetSettings = async (userId) => {
  const defaults = {
    default_weeks: 24,
    weekly_rate: 0.05,
    default_collection_day: 0,
    allow_mass_record_past: false
  }

  return updateSettings(userId, defaults)
}
