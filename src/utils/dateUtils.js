import { format, addDays, addWeeks, isAfter, isBefore, startOfWeek, endOfWeek } from 'date-fns'

/**
 * Format date for display
 * @param {Date|string} date
 * @param {string} formatStr - Format string (default: 'dd MMM yyyy')
 * @returns {string} Formatted date
 */
export const formatDate = (date, formatStr = 'dd MMM yyyy') => {
  if (!date) return ''
  return format(new Date(date), formatStr)
}

/**
 * Format date for ISO (YYYY-MM-DD)
 * @param {Date|string} date
 * @returns {string} ISO formatted date
 */
export const formatDateISO = (date) => {
  if (!date) return ''
  return format(new Date(date), 'yyyy-MM-dd')
}

/**
 * Check if date is overdue
 * @param {Date|string} dueDate
 * @returns {boolean}
 */
export const isOverdue = (dueDate) => {
  if (!dueDate) return false
  return isBefore(new Date(dueDate), new Date())
}

/**
 * Get days until/past due
 * @param {Date|string} dueDate
 * @returns {number} Positive for future, negative for past
 */
export const getDaysUntilDue = (dueDate) => {
  if (!dueDate) return 0
  const now = new Date()
  const due = new Date(dueDate)
  const diffTime = due.getTime() - now.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Check if date is in current week
 * @param {Date|string} date
 * @returns {boolean}
 */
export const isThisWeek = (date) => {
  if (!date) return false
  const targetDate = new Date(date)
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 }) // Sunday
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 0 })
  return !isBefore(targetDate, weekStart) && !isAfter(targetDate, weekEnd)
}

/**
 * Get relative time string (e.g., "2 days ago", "in 3 days")
 * @param {Date|string} date
 * @returns {string}
 */
export const getRelativeTime = (date) => {
  if (!date) return ''
  const days = getDaysUntilDue(date)

  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  if (days > 0) return `In ${days} days`
  return `${Math.abs(days)} days ago`
}

/**
 * Calculate due date for a payment week
 * @param {Date|string} startDate - Loan start date
 * @param {number} weekNumber - Week number (1, 2, 3...)
 * @param {number} collectionDay - Day of week (0=Sunday, 6=Saturday)
 * @returns {string} ISO formatted due date
 */
export const calculateDueDate = (startDate, weekNumber, collectionDay = 0) => {
  const start = new Date(startDate)

  // Add weeks
  let dueDate = addWeeks(start, weekNumber - 1)

  // Adjust to collection day
  const currentDay = dueDate.getDay()
  const daysToAdd = (collectionDay - currentDay + 7) % 7

  if (weekNumber === 1 && daysToAdd > 0) {
    // First payment, move to next collection day
    dueDate = addDays(dueDate, daysToAdd)
  }

  return formatDateISO(dueDate)
}

/**
 * Get day name from day number
 * @param {number} day - Day number (0=Sunday, 6=Saturday)
 * @returns {string} Day name
 */
export const getDayName = (day) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[day] || 'Unknown'
}

/**
 * Get week number of year
 * @param {Date|string} date
 * @returns {number}
 */
export const getWeekNumber = (date) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

/**
 * Get week date range based on collection day (0=Sun, 1=Mon, ... 6=Sat).
 * Week runs from collectionDay to collectionDay+6 (e.g. Monday to Sunday if collectionDay=1).
 * @param {number} collectionDay - First day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
 * @param {number} offset - Week offset (0=current week, -1=previous, 1=next)
 * @returns {{ start: Date, end: Date }}
 */
export const getWeekRangeForCollectionDay = (collectionDay = 0, offset = 0) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = today.getDay()
  const daysBack = (d - collectionDay + 7) % 7
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - daysBack + (offset * 7))
  const weekEnd = addDays(weekStart, 6)
  return { start: weekStart, end: weekEnd }
}
