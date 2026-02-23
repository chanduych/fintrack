/**
 * Calculate weekly payment amount based on principal and weekly rate
 * @param {number} principal - Loan principal amount
 * @param {number} weeklyRate - Weekly rate (e.g., 0.05 for 5%)
 * @returns {number} Weekly payment amount
 */
export const calculateWeeklyAmount = (principal, weeklyRate = 0.05) => {
  return principal * weeklyRate
}

/**
 * Calculate total amount to be repaid
 * @param {number} weeklyAmount - Weekly payment amount
 * @param {number} numberOfWeeks - Total number of weeks
 * @returns {number} Total amount
 */
export const calculateTotalAmount = (weeklyAmount, numberOfWeeks) => {
  return weeklyAmount * numberOfWeeks
}

/**
 * Calculate interest amount
 * @param {number} totalAmount - Total amount to be repaid
 * @param {number} principal - Original loan amount
 * @returns {number} Interest amount
 */
export const calculateInterest = (totalAmount, principal) => {
  return totalAmount - principal
}

/**
 * Calculate loan progress percentage
 * @param {number} paidAmount - Total amount paid so far
 * @param {number} totalAmount - Total amount to be repaid
 * @returns {number} Progress percentage (0-100)
 */
export const calculateProgress = (paidAmount, totalAmount) => {
  if (totalAmount === 0) return 0
  return Math.min((paidAmount / totalAmount) * 100, 100)
}

/**
 * Calculate remaining balance
 * @param {number} totalAmount - Total amount to be repaid
 * @param {number} paidAmount - Total amount paid so far
 * @returns {number} Remaining balance
 */
export const calculateBalance = (totalAmount, paidAmount) => {
  return Math.max(totalAmount - paidAmount, 0)
}

/**
 * Get loan summary calculations
 * @param {Object} loan - Loan object
 * @param {number} totalPaid - Total amount paid
 * @returns {Object} Loan summary with calculations
 */
export const getLoanSummary = (loan, totalPaid = 0) => {
  const balance = calculateBalance(loan.total_amount, totalPaid)
  const progress = calculateProgress(totalPaid, loan.total_amount)
  const interestAmount = calculateInterest(loan.total_amount, loan.principal_amount)

  return {
    principal: loan.principal_amount,
    totalAmount: loan.total_amount,
    weeklyAmount: loan.weekly_amount,
    numberOfWeeks: loan.number_of_weeks,
    totalPaid,
    balance,
    progress,
    interestAmount,
    status: loan.status
  }
}

/**
 * Format currency for display (Indian Rupee)
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount)
}

/**
 * Format currency with decimals
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
export const formatCurrencyWithDecimals = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}
