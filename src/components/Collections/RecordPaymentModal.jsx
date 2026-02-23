import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, IndianRupeeIcon, Calendar, CheckCircle, AlertTriangle, Trash2, ChevronDown, Loader2 } from 'lucide-react'
import { recordPayment, resetPayment, getUnpaidPaymentsForLoan } from '../../services/paymentService'
import { formatCurrency } from '../../utils/loanCalculations'
import { formatDate } from '../../utils/dateUtils'

export default function RecordPaymentModal({ payment, onClose, onSuccess }) {
  const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
  const [amount, setAmount] = useState(
    payment.amount_paid > 0
      ? payment.amount_paid.toString()
      : (payment.amount_due != null ? parseFloat(payment.amount_due).toFixed(2) : '')
  )
  const [paidDate, setPaidDate] = useState(payment.paid_date || todayStr)
  const [notes, setNotes] = useState(payment.notes || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Week/loan selector state
  const [unpaidWeeks, setUnpaidWeeks] = useState([])
  const [selectedPaymentId, setSelectedPaymentId] = useState(payment.id)
  const [selectedPaymentData, setSelectedPaymentData] = useState(payment)
  const [loadingWeeks, setLoadingWeeks] = useState(false)
  const [showWeekSelector, setShowWeekSelector] = useState(false)

  const isEditing = selectedPaymentData.amount_paid > 0
  const remainingAmount = selectedPaymentData.amount_due - (selectedPaymentData.amount_paid || 0)

  // Load unpaid weeks for this specific loan on mount
  useEffect(() => {
    if (payment.loan_id) {
      loadUnpaidWeeks()
    }
  }, [payment.loan_id])

  const loadUnpaidWeeks = async () => {
    setLoadingWeeks(true)
    const result = await getUnpaidPaymentsForLoan(payment.loan_id)
    if (!result.error && result.data) {
      setUnpaidWeeks(result.data)
    }
    setLoadingWeeks(false)
  }

  const handleWeekSelect = (week) => {
    setSelectedPaymentId(week.id)
    setSelectedPaymentData({
      ...payment,
      id: week.id,
      loan_id: week.loan_id,
      week_number: week.week_number,
      due_date: week.due_date,
      amount_due: week.amount_due,
      amount_paid: week.amount_paid,
      status: week.status,
      loan_number: week.loan_number
    })
    // Pre-fill amount with the weekly due
    if (!amount || parseFloat(amount) === parseFloat(payment.amount_due)) {
      setAmount(week.amount_due.toFixed(2))
    }
    setShowWeekSelector(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const paymentAmount = parseFloat(amount)
    if (!amount || paymentAmount <= 0) {
      setError('Please enter a valid amount')
      return
    }

    if (!paidDate) {
      setError('Please select a payment date')
      return
    }

    setLoading(true)

    const { error: paymentError } = await recordPayment(
      selectedPaymentId,
      paymentAmount,
      paidDate,
      notes
    )

    if (paymentError) {
      setError(paymentError.message || 'Failed to record payment')
      setLoading(false)
    } else {
      onSuccess()
    }
  }

  const handleDelete = async () => {
    setLoading(true)
    setError('')

    const { error: resetError } = await resetPayment(selectedPaymentId)

    if (resetError) {
      setError(resetError.message || 'Failed to delete payment')
      setLoading(false)
      setShowDeleteConfirm(false)
    } else {
      onSuccess()
    }
  }

  const handleQuickAmount = (type) => {
    switch(type) {
      case 'due':
        setAmount(selectedPaymentData.amount_due.toFixed(2))
        break
      case 'half':
        setAmount((selectedPaymentData.amount_due * 0.5).toFixed(2))
        break
      default:
        break
    }
  }

  const currentLabel = `Loan ${selectedPaymentData.loan_number || 1} - Week ${selectedPaymentData.week_number}`

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 w-full md:w-auto md:max-w-md rounded-t-3xl md:rounded-2xl shadow-2xl max-h-[92vh] md:max-h-[90vh] overflow-y-auto animate-slide-up md:animate-scale-in flex flex-col md:block"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 py-4 flex items-center justify-between md:rounded-t-2xl z-10">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {isEditing ? 'Edit Payment' : 'Record Payment'}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {payment.borrower_name}
              </p>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded">
                Loan {payment.loan_number || 1}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditing && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                title="Delete Payment"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Form - extra bottom padding on mobile so Cancel/Update sit above bottom nav */}
        <form onSubmit={handleSubmit} className="p-4 md:p-6 pb-28 md:pb-6 space-y-4">
          {/* Week/Loan Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Apply Payment To
            </label>
            <button
              type="button"
              onClick={() => setShowWeekSelector(!showWeekSelector)}
              className="w-full flex items-center justify-between px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold">{currentLabel}</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  - Due {formatDate(selectedPaymentData.due_date)}
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showWeekSelector ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown list of unpaid weeks */}
            {showWeekSelector && (
              <div className="mt-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 max-h-60 overflow-y-auto shadow-lg">
                {loadingWeeks ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />
                  </div>
                ) : unpaidWeeks.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">No unpaid weeks found</p>
                ) : (
                  unpaidWeeks.map(week => {
                    const isSelected = week.id === selectedPaymentId
                    const isOverdue = new Date(week.due_date) < new Date()
                    return (
                      <button
                        key={week.id}
                        type="button"
                        onClick={() => handleWeekSelect(week)}
                        className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                          isSelected
                            ? 'bg-primary-50 dark:bg-primary-900/30 border-l-3 border-primary-600'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${isSelected ? 'text-primary-700 dark:text-primary-400' : 'text-gray-900 dark:text-white'}`}>
                            Week {week.week_number}
                          </span>
                          {isOverdue && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
                              overdue
                            </span>
                          )}
                          {week.status === 'partial' && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                              partial
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                            {formatCurrency(week.amount_due)}
                          </span>
                          <span className="text-xs text-gray-400 ml-2">
                            {formatDate(week.due_date)}
                          </span>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>

          {/* Payment Info */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">{currentLabel} Due</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                {formatCurrency(selectedPaymentData.amount_due)}
              </span>
            </div>
            {selectedPaymentData.amount_paid > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Already Paid</span>
                <span className="text-sm font-semibold text-green-600 dark:text-green-400 tabular-nums">
                  {formatCurrency(selectedPaymentData.amount_paid)}
                </span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
              <span className="text-sm font-medium text-gray-900 dark:text-white">Remaining Balance</span>
              <span className="text-lg font-bold text-yellow-600 dark:text-yellow-400 tabular-nums">
                {formatCurrency(remainingAmount)}
              </span>
            </div>
          </div>

          {/* Quick Amount Buttons */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Quick Select
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickAmount('half')}
                className="px-3 py-2 text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Half ({formatCurrency(selectedPaymentData.amount_due * 0.5)})
              </button>
              <button
                type="button"
                onClick={() => handleQuickAmount('due')}
                className="px-3 py-2 text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
              >
                Full ({formatCurrency(selectedPaymentData.amount_due)})
              </button>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Payment Amount
            </label>
            <div className="relative">
              <IndianRupeeIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.01"
                min="0"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-lg font-semibold"
                placeholder="0.00"
                required
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              You can enter any amount - partial, full, or more than due
            </p>
          </div>

          {/* Payment Date */}
          <div>
            <label htmlFor="paidDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Payment Date
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="paidDate"
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes (Optional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              placeholder="Add any notes..."
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Delete Confirmation */}
          {showDeleteConfirm && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-900 dark:text-red-100">Delete Payment Record?</h3>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    This will reset the payment of {formatCurrency(selectedPaymentData.amount_paid)} recorded on {formatDate(selectedPaymentData.paid_date)}. The week will return to pending status.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-primary-500 to-accent-500 text-white font-medium rounded-lg hover:from-primary-600 hover:to-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (isEditing ? 'Updating...' : 'Recording...') : (isEditing ? 'Update Payment' : 'Record Payment')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
