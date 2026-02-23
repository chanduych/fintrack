import { useState, useEffect, useRef } from 'react'
import { X, IndianRupeeIcon, Calendar, Hash, Loader2, User, ChevronDown, Search } from 'lucide-react'
import { calculateWeeklyAmount, calculateTotalAmount, calculateInterest, formatCurrency } from '../../utils/loanCalculations'
import { formatDateISO, getDayName } from '../../utils/dateUtils'
import { getUserSettings } from '../../services/userService'
import { useAuth } from '../../contexts/AuthContext'

export default function AddLoanModal({ isOpen, onClose, onSave, borrowers = [] }) {
  const { user } = useAuth()
  const [formData, setFormData] = useState({
    borrower_id: '',
    principal_amount: '',
    number_of_weeks: 24,
    start_date: formatDateISO(new Date()),
    first_payment_date: '',
    collection_day: 0
  })
  const [weeklyRate, setWeeklyRate] = useState(0.05)
  const [loading, setLoading] = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [errors, setErrors] = useState({})
  const [borrowerSearch, setBorrowerSearch] = useState('')
  const [borrowerDropdownOpen, setBorrowerDropdownOpen] = useState(false)
  const borrowerDropdownRef = useRef(null)

  // Load user settings
  useEffect(() => {
    if (user && isOpen) {
      loadSettings()
    }
  }, [user, isOpen])

  const loadSettings = async () => {
    setLoadingSettings(true)
    const { data, error } = await getUserSettings(user.id)

    if (!error && data) {
      setWeeklyRate(data.weekly_rate || 0.05)
      setFormData(prev => ({
        ...prev,
        number_of_weeks: data.default_weeks || 24,
        collection_day: data.default_collection_day || 0
      }))
    }
    setLoadingSettings(false)
  }

  // Next Sunday from a date (for first installment default)
  const getNextSunday = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const day = d.getDay()
    const daysToAdd = day === 0 ? 7 : (7 - day)
    d.setDate(d.getDate() + daysToAdd)
    return formatDateISO(d)
  }

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      const today = formatDateISO(new Date())
      const nextSun = getNextSunday(today)
      setFormData({
        borrower_id: '',
        principal_amount: '',
        number_of_weeks: 24,
        start_date: today,
        first_payment_date: nextSun,
        collection_day: 0
      })
      setErrors({})
      setBorrowerSearch('')
      setBorrowerDropdownOpen(false)
    }
  }, [isOpen])

  // Click outside to close borrower dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (borrowerDropdownRef.current && !borrowerDropdownRef.current.contains(e.target)) {
        setBorrowerDropdownOpen(false)
      }
    }
    if (borrowerDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [borrowerDropdownOpen])

  // Calculate derived values
  const weeklyAmount = formData.principal_amount
    ? calculateWeeklyAmount(parseFloat(formData.principal_amount), weeklyRate)
    : 0

  const totalAmount = weeklyAmount && formData.number_of_weeks
    ? calculateTotalAmount(weeklyAmount, parseInt(formData.number_of_weeks))
    : 0

  const interestAmount = totalAmount && formData.principal_amount
    ? calculateInterest(totalAmount, parseFloat(formData.principal_amount))
    : 0

  const firstPaymentDateStr = formData.first_payment_date || getNextSunday(formData.start_date)
  const firstPaymentDate = firstPaymentDateStr ? new Date(firstPaymentDateStr) : null

  const selectedBorrower = borrowers.find(b => b.id === formData.borrower_id)
  const borrowerLabel = selectedBorrower ? `${selectedBorrower.name}${selectedBorrower.area ? ` – ${selectedBorrower.area}` : ''}` : ''
  const borrowerQuery = (borrowerSearch || '').trim().toLowerCase()
  const filteredBorrowers = borrowerQuery
    ? borrowers.filter(b => {
        const name = (b.name || '').toLowerCase()
        const area = (b.area || '').toLowerCase()
        return name.includes(borrowerQuery) || area.includes(borrowerQuery)
      })
    : borrowers
  const maxBorrowerListHeight = 220

  const validate = () => {
    const newErrors = {}

    if (!formData.borrower_id) {
      newErrors.borrower_id = 'Please select a borrower'
    }

    if (!formData.principal_amount || parseFloat(formData.principal_amount) <= 0) {
      newErrors.principal_amount = 'Principal amount must be greater than 0'
    }

    if (!formData.number_of_weeks || parseInt(formData.number_of_weeks) <= 0) {
      newErrors.number_of_weeks = 'Number of weeks must be greater than 0'
    }

    if (!formData.start_date) {
      newErrors.start_date = 'Start date is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validate()) return

    setLoading(true)

    const loanData = {
      borrower_id: formData.borrower_id,
      principal_amount: parseFloat(formData.principal_amount),
      weekly_amount: weeklyAmount,
      number_of_weeks: parseInt(formData.number_of_weeks),
      start_date: formData.start_date,
      first_payment_date: firstPaymentDateStr || null,
      collection_day: parseInt(formData.collection_day),
      status: 'active'
    }

    await onSave(loanData)
    setLoading(false)
  }

  const handleChange = (field, value) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'start_date' && value) {
        next.first_payment_date = getNextSunday(value)
      }
      return next
    })
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-t-3xl md:rounded-2xl shadow-2xl w-full md:max-w-2xl max-h-[92vh] md:max-h-[90vh] overflow-y-auto animate-slide-up md:animate-scale-in">
        {/* Header - larger tap target on mobile */}
        <div className="sticky top-0 bg-gradient-to-r from-primary-600 to-accent-600 px-4 md:px-6 py-4 pt-6 md:py-4 rounded-t-3xl md:rounded-t-2xl z-10">
          <div className="flex items-center justify-between min-h-[44px]">
            <h2 className="text-lg md:text-xl font-semibold text-white">Create New Loan</h2>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="p-2 -m-2 text-white/80 hover:text-white transition-colors touch-manipulation"
              aria-label="Close"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {loadingSettings ? (
          <div className="p-8 flex items-center justify-center min-h-[200px]">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4 md:space-y-5 pb-28 md:pb-6">
            {/* Borrower Selection - searchable */}
            <div ref={borrowerDropdownRef} className="relative">
              <label htmlFor="borrower" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Borrower <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                {borrowerDropdownOpen ? (
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 z-10" />
                ) : (
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 z-10" />
                )}
                <input
                  id="borrower"
                  type="text"
                  value={borrowerDropdownOpen ? borrowerSearch : borrowerLabel}
                  onChange={(e) => {
                    setBorrowerSearch(e.target.value)
                    setBorrowerDropdownOpen(true)
                    if (formData.borrower_id) handleChange('borrower_id', '')
                  }}
                  onFocus={() => setBorrowerDropdownOpen(true)}
                  placeholder="Search by name or area..."
                  autoComplete="off"
                  className={`w-full pl-10 pr-10 py-3 min-h-[44px] border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 text-base ${
                    errors.borrower_id ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  disabled={loading}
                />
                <ChevronDown
                  className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 transition-transform ${borrowerDropdownOpen ? 'rotate-180' : ''}`}
                  aria-hidden
                />
              </div>
              {borrowerDropdownOpen && (
                <ul
                  className="absolute left-0 right-0 mt-1 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg z-20 overflow-y-auto"
                  style={{ maxHeight: maxBorrowerListHeight }}
                  role="listbox"
                >
                  {filteredBorrowers.length === 0 ? (
                    <li className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No borrowers match</li>
                  ) : (
                    filteredBorrowers.map((borrower) => {
                      const label = `${borrower.name}${borrower.area ? ` – ${borrower.area}` : ''}`
                      const selected = borrower.id === formData.borrower_id
                      return (
                        <li
                          key={borrower.id}
                          role="option"
                          aria-selected={selected}
                          onClick={() => {
                            handleChange('borrower_id', borrower.id)
                            setBorrowerSearch('')
                            setBorrowerDropdownOpen(false)
                          }}
                          className={`px-4 py-3 text-sm cursor-pointer transition-colors ${
                            selected
                              ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-200'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white'
                          }`}
                        >
                          {label}
                        </li>
                      )
                    })
                  )}
                </ul>
              )}
              {errors.borrower_id && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.borrower_id}</p>
              )}
            </div>

            {/* Principal Amount */}
            <div>
              <label htmlFor="principal" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Principal Amount <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <IndianRupeeIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  id="principal"
                  type="number"
                  inputMode="decimal"
                  value={formData.principal_amount}
                  onChange={(e) => handleChange('principal_amount', e.target.value)}
                  placeholder="Enter loan amount"
                  className={`w-full pl-10 pr-4 py-3 min-h-[44px] border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 text-base ${
                    errors.principal_amount ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  disabled={loading}
                  step="100"
                  min="0"
                />
              </div>
              {errors.principal_amount && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.principal_amount}</p>
              )}
            </div>

            {/* Number of Weeks */}
            <div>
              <label htmlFor="weeks" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Number of Weeks <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  id="weeks"
                  type="number"
                  inputMode="numeric"
                  value={formData.number_of_weeks}
                  onChange={(e) => handleChange('number_of_weeks', e.target.value)}
                  placeholder="e.g., 24"
                  className={`w-full pl-10 pr-4 py-3 min-h-[44px] border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 text-base ${
                    errors.number_of_weeks ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  disabled={loading}
                  min="1"
                />
              </div>
              {errors.number_of_weeks && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.number_of_weeks}</p>
              )}
            </div>

            {/* Start Date */}
            <div>
              <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Loan Disbursement Date <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                When the loan amount will be given to the borrower
              </p>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => handleChange('start_date', e.target.value)}
                  className={`w-full pl-10 pr-4 py-3 min-h-[44px] border rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base ${
                    errors.start_date ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  disabled={loading}
                />
              </div>
              {errors.start_date && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.start_date}</p>
              )}
            </div>

            {/* First installment date (editable; default = next Sunday) */}
            <div>
              <label htmlFor="first_payment_date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                First installment date
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Default is next Sunday from disbursement. You can change it.
              </p>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
                <input
                  id="first_payment_date"
                  type="date"
                  value={firstPaymentDateStr}
                  onChange={(e) => handleChange('first_payment_date', e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white min-h-[44px]"
                  disabled={loading}
                />
              </div>
              {firstPaymentDate && (
                <p className="mt-1.5 text-xs text-blue-600 dark:text-blue-400">
                  First payment due: {firstPaymentDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
            </div>

            {/* Collection Day */}
            <div>
              <label htmlFor="collection_day" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Collection Day
              </label>
              <select
                id="collection_day"
                value={formData.collection_day}
                onChange={(e) => handleChange('collection_day', e.target.value)}
                className="w-full px-4 py-3 min-h-[44px] border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-base"
                disabled={loading}
              >
                {[0, 1, 2, 3, 4, 5, 6].map(day => (
                  <option key={day} value={day}>{getDayName(day)}</option>
                ))}
              </select>
            </div>

            {/* Calculation Summary */}
            {formData.principal_amount && (
              <div className="bg-gradient-to-br from-primary-50 to-accent-50 dark:from-primary-900/20 dark:to-accent-900/20 rounded-xl p-5 border border-primary-200 dark:border-primary-800">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Loan Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Weekly Payment:</span>
                    <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                      {formatCurrency(weeklyAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Total to Repay:</span>
                    <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                      {formatCurrency(totalAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-primary-200 dark:border-primary-700">
                    <span className="text-gray-600 dark:text-gray-400">Interest Amount:</span>
                    <span className="font-semibold text-green-600 dark:text-green-400 tabular-nums">
                      {formatCurrency(interestAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 pt-1">
                    <span>Weekly Rate: {(weeklyRate * 100).toFixed(1)}%</span>
                    <span>Duration: {formData.number_of_weeks} weeks</span>
                  </div>
                </div>
              </div>
            )}

            {/* Actions - large touch targets on mobile */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 min-h-[48px] px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 min-h-[48px] px-4 py-3 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 rounded-xl font-medium text-white transition-all focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 touch-manipulation"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Loan'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
