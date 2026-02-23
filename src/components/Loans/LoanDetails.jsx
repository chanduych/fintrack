import { useState, useEffect } from 'react'
import {
  X,
  User,
  MapPin,
  Phone,
  Calendar,
  IndianRupeeIcon,
  TrendingUp,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader2,
  Ban,
  Trash2,
  Pencil,
  HandCoins
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { getLoan, forecloseLoan, settleAndCloseLoan, deleteLoan, updateLoanDetails } from '../../services/loanService'
import { getPaymentsByLoan } from '../../services/paymentService'
import { getSettings } from '../../services/settingsService'
import { formatCurrency } from '../../utils/loanCalculations'
import { formatDate } from '../../utils/dateUtils'
import RecordPaymentModal from '../Collections/RecordPaymentModal'
import MassRecordPastPaymentsModal from './MassRecordPastPaymentsModal'

export default function LoanDetails({ loanId, onClose, onUpdate }) {
  const { user } = useAuth()
  const [loan, setLoan] = useState(null)
  const [allowMassRecordPast, setAllowMassRecordPast] = useState(false)
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showForecloseModal, setShowForecloseModal] = useState(false)
  const [forecloseSettlement, setForecloseSettlement] = useState('')
  const [forecloseDate, setForecloseDate] = useState('')
  const [forecloseLoading, setForecloseLoading] = useState(false)
  const [forecloseError, setForecloseError] = useState('')
  const [showSettleModal, setShowSettleModal] = useState(false)
  const [settleAmount, setSettleAmount] = useState('')
  const [settleDate, setSettleDate] = useState('')
  const [settleLoading, setSettleLoading] = useState(false)
  const [settleError, setSettleError] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [editPrincipal, setEditPrincipal] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editFirstPaymentDate, setEditFirstPaymentDate] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')
  const [showMassRecordModal, setShowMassRecordModal] = useState(false)

  useEffect(() => {
    if (loanId) {
      loadLoanDetails()
    }
  }, [loanId])

  useEffect(() => {
    if (user?.id) {
      getSettings(user.id).then(({ data }) => {
        setAllowMassRecordPast(data?.allow_mass_record_past === true)
      })
    }
  }, [user?.id])

  const loadLoanDetails = async () => {
    setLoading(true)

    const [loanRes, paymentsRes] = await Promise.all([
      getLoan(loanId),
      getPaymentsByLoan(loanId)
    ])

    if (loanRes.data) setLoan(loanRes.data)
    if (paymentsRes.data) setPayments(paymentsRes.data)

    setLoading(false)
  }

  const handleRecordPayment = (payment) => {
    setSelectedPayment({
      ...payment,
      borrower_id: loan.borrower?.id ?? payment.loan?.borrower_id,
      borrower_name: loan.borrower?.name ?? payment.loan?.borrower?.name,
      borrower_phone: loan.borrower?.phone ?? payment.loan?.borrower?.phone,
      borrower_area: loan.borrower?.area ?? payment.loan?.borrower?.area,
      borrower_leader_tag: loan.borrower?.leader_tag ?? payment.loan?.borrower?.leader_tag,
      loan_id: payment.loan_id ?? loan.id,
      loan_number: loan.loan_number ?? payment.loan_number
    })
    setShowPaymentModal(true)
  }

  const handlePaymentRecorded = () => {
    setShowPaymentModal(false)
    setSelectedPayment(null)
    loadLoanDetails()
    if (onUpdate) onUpdate()
  }

  const handleForeclose = async (e) => {
    e.preventDefault()
    setForecloseError('')
    setForecloseLoading(true)
    const amount = forecloseSettlement.trim() ? parseFloat(forecloseSettlement) : null
    const dateToUse = forecloseDate || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
    const { error } = await forecloseLoan(loanId, amount, dateToUse)
    setForecloseLoading(false)
    if (error) {
      setForecloseError(error.message || 'Failed to foreclose loan')
      return
    }
    setShowForecloseModal(false)
    setForecloseSettlement('')
    setForecloseDate('')
    loadLoanDetails()
    if (onUpdate) onUpdate()
  }

  const handleSettleAndClose = async (e) => {
    e.preventDefault()
    setSettleError('')
    const amt = parseFloat(settleAmount)
    if (!settleAmount || isNaN(amt) || amt < 0) {
      setSettleError('Please enter a valid settlement amount')
      return
    }
    const dateToUse = settleDate || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
    setSettleLoading(true)
    const { error } = await settleAndCloseLoan(loanId, amt, dateToUse)
    setSettleLoading(false)
    if (error) {
      setSettleError(error.message || 'Failed to settle and close')
      return
    }
    setShowSettleModal(false)
    setSettleAmount('')
    setSettleDate('')
    loadLoanDetails()
    if (onUpdate) onUpdate()
  }

  const handleDeleteClick = () => setShowDeleteModal(true)

  const openEditModal = () => {
    if (!loan) return
    setEditPrincipal(String(loan.principal_amount ?? ''))
    setEditStartDate(loan.start_date ? (loan.start_date.split('T')[0] || loan.start_date) : '')
    setEditFirstPaymentDate(loan.first_payment_date ? (loan.first_payment_date.split('T')[0] || loan.first_payment_date) : '')
    setEditError('')
    setShowEditModal(true)
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    setEditError('')
    const principal = parseFloat(editPrincipal)
    if (!editPrincipal || isNaN(principal) || principal <= 0) {
      setEditError('Please enter a valid principal amount')
      return
    }
    if (!editStartDate) {
      setEditError('Please enter the loan given date')
      return
    }
    setEditLoading(true)
    const { data, error } = await updateLoanDetails(loanId, loan.user_id, {
      principal_amount: principal,
      start_date: editStartDate,
      first_payment_date: editFirstPaymentDate || null
    })
    setEditLoading(false)
    if (error) {
      setEditError(error.message || 'Failed to update loan')
      return
    }
    setShowEditModal(false)
    loadLoanDetails()
    if (onUpdate) onUpdate()
  }

  const handleDeleteConfirm = async () => {
    setDeleteError('')
    setDeleteLoading(true)
    setShowDeleteModal(false)
    const { error } = await deleteLoan(loanId)
    setDeleteLoading(false)
    if (error) {
      setShowDeleteModal(true)
      setDeleteError(error.message || 'Failed to delete loan')
      return
    }
    onClose()
    if (onUpdate) onUpdate()
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          </div>
        </div>
      </div>
    )
  }

  if (!loan) {
    return null
  }

  // Calculate progress
  const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount_paid || 0), 0)
  const progressPercent = (totalPaid / parseFloat(loan.total_amount || 1)) * 100

  const unpaidPaymentsList = payments.filter(p => p.status !== 'paid')
  const overdueCount = unpaidPaymentsList.filter(p =>
    p.status === 'overdue' || new Date(p.due_date) < new Date()
  ).length
  const futurePendingCount = unpaidPaymentsList.length - overdueCount
  const pendingCount = unpaidPaymentsList.length

  const statusColors = {
    paid: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    partial: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    overdue: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
  }

  const statusIcons = {
    paid: CheckCircle,
    pending: Clock,
    partial: Clock,
    overdue: AlertCircle
  }

  const unpaidPayments = payments.filter(p => p.status !== 'paid')
  // Calculate true pending amount: total loan amount minus total paid
  // This correctly handles extra payments
  const pendingAmount = Math.max(0, parseFloat(loan.total_amount || 0) - totalPaid)
  const pendingWeeksCount = unpaidPayments.length
  const weeklyAmount = parseFloat(loan.weekly_amount || 0)
  const weeksByCost = weeklyAmount > 0 ? Math.ceil(pendingAmount / weeklyAmount) : 0

  const fullPaidPayments = payments.filter(p => p.status === 'paid')
  const fullPaidCount = fullPaidPayments.length
  const fullPaidSum = fullPaidPayments.reduce((s, p) => s + parseFloat(p.amount_paid || 0), 0)

  const partialPayments = payments.filter(p => p.status === 'partial')
  const partialPaidCount = partialPayments.length
  const partialPaidSum = partialPayments.reduce((s, p) => s + parseFloat(p.amount_paid || 0), 0)

  const extraPaidSum = payments.reduce((s, p) => {
    const due = parseFloat(p.amount_due || 0)
    const paid = parseFloat(p.amount_paid || 0)
    return s + (paid > due ? paid - due : 0)
  }, 0)
  const extraPaidCount = payments.filter(p => parseFloat(p.amount_paid || 0) > parseFloat(p.amount_due || 0)).length

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-screen flex items-start md:items-center justify-center p-0 md:p-4">
        <div className="bg-white dark:bg-gray-800 w-full md:rounded-2xl md:shadow-2xl md:max-w-4xl min-h-screen md:min-h-0 md:my-8">
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-6 py-4 pt-6 flex items-center justify-between md:rounded-t-2xl z-10">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
                Loan Details
              </h2>
              <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1">
                {loan.borrower?.name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openEditModal}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors border border-primary-200 dark:border-primary-800"
                title="Edit loan details"
              >
                <Pencil className="w-4 h-4" />
                <span className="hidden sm:inline">Edit</span>
              </button>
              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={deleteLoading}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-red-200 dark:border-red-800 disabled:opacity-50"
                title="Delete Loan"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">{deleteLoading ? 'Deleting...' : 'Delete'}</span>
              </button>
              {loan.status === 'active' && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowSettleModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors border border-amber-200 dark:border-amber-800"
                  >
                    Settle & close
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForecloseModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors border border-orange-200 dark:border-orange-800"
                  >
                    <Ban className="w-4 h-4" />
                    Foreclose
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 md:w-6 md:h-6 text-gray-500" />
              </button>
            </div>
          </div>

        <div className="p-4 md:p-6 space-y-4 md:space-y-6 pb-24 md:pb-6">
          {/* Borrower Info */}
          <div className="bg-gradient-to-br from-primary-50 to-accent-50 dark:from-primary-900/20 dark:to-accent-900/20 rounded-xl p-4 md:p-6 border border-primary-200 dark:border-primary-800">
            <div className="flex items-start gap-3 md:gap-4">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-bold text-lg md:text-2xl flex-shrink-0">
                {loan.borrower?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {loan.borrower?.name}
                </h3>
                <div className="space-y-2 md:space-y-0 md:grid md:grid-cols-3 md:gap-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{loan.borrower?.area}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <Phone className="w-4 h-4 flex-shrink-0" />
                    <span>{loan.borrower?.phone}</span>
                  </div>
                  {loan.borrower?.leader_tag && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <User className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{loan.borrower?.leader_tag}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Loan Summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3 md:p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Principal</p>
              <p className="text-base md:text-xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                {formatCurrency(loan.principal_amount)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3 md:p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Amount</p>
              <p className="text-base md:text-xl font-bold text-gray-900 dark:text-white tabular-nums">
                {formatCurrency(loan.total_amount)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3 md:p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Weekly</p>
              <p className="text-base md:text-xl font-bold text-purple-600 dark:text-purple-400 tabular-nums">
                {formatCurrency(loan.weekly_amount)}
              </p>
            </div>
          </div>

          {/* Dates Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-3 md:p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <p className="text-xs font-medium text-blue-900 dark:text-blue-300">Loan Disbursement Date</p>
              </div>
              <p className="text-sm md:text-base font-bold text-blue-900 dark:text-blue-100">
                {formatDate(loan.start_date)}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                Date loan was given to borrower
              </p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-3 md:p-4 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                <p className="text-xs font-medium text-green-900 dark:text-green-300">First Payment Date</p>
              </div>
              <p className="text-sm md:text-base font-bold text-green-900 dark:text-green-100">
                {payments.length > 0 ? formatDate(payments[0].due_date) : 'N/A'}
              </p>
              <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                Payment collection starts from this date
              </p>
            </div>
          </div>

          {/* Progress */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 md:p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Payment Progress
              </h3>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                By amount collected
              </span>
            </div>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-600 dark:text-gray-400">Collected</span>
                <span className="font-bold text-gray-900 dark:text-white tabular-nums">
                  {formatCurrency(totalPaid)} / {formatCurrency(loan.total_amount)}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-primary-500 to-accent-500 h-3 rounded-full transition-all"
                  style={{ width: `${Math.min(progressPercent, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {progressPercent.toFixed(1)}% complete
              </p>
            </div>

            {/* Paid vs Pending */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Collected</p>
                <p className="text-lg md:text-xl font-bold text-green-600 dark:text-green-400 mt-1 tabular-nums">
                  {formatCurrency(totalPaid)}
                </p>
                <div className="mt-2 space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
                  <p>Full paid: {fullPaidCount} week{fullPaidCount !== 1 ? 's' : ''} · {formatCurrency(fullPaidSum)}</p>
                  {partialPaidCount > 0 && (
                    <p>Partial: {partialPaidCount} week{partialPaidCount !== 1 ? 's' : ''} · {formatCurrency(partialPaidSum)}</p>
                  )}
                  {extraPaidCount > 0 && (
                    <p>Extra paid: {formatCurrency(extraPaidSum)}</p>
                  )}
                </div>
              </div>
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Pending</p>
                <p className="text-lg md:text-xl font-bold text-yellow-600 dark:text-yellow-400 mt-1 tabular-nums">
                  {formatCurrency(pendingAmount)}
                </p>
                <div className="mt-2 space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
                  <p>{pendingCount} week{pendingCount !== 1 ? 's' : ''} · {overdueCount} overdue, {futurePendingCount} future</p>
                  {weeklyAmount > 0 && pendingAmount > 0 && (
                    <p>~{weeksByCost} week{weeksByCost !== 1 ? 's' : ''} by cost ({formatCurrency(pendingAmount)} ÷ {formatCurrency(weeklyAmount)})</p>
                  )}
                </div>
              </div>
            </div>

            {allowMassRecordPast && overdueCount > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setShowMassRecordModal(true)}
                  className="w-full py-2.5 px-4 text-sm font-medium text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 border border-primary-200 dark:border-primary-800"
                >
                  Record all {overdueCount} past week{overdueCount !== 1 ? 's' : ''} as paid (use actual due dates)
                </button>
              </div>
            )}
          </div>

          {/* Payment Schedule */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 md:px-6 py-3 md:py-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white">
                Payment Schedule
              </h3>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
              {payments.map((payment) => {
                const isOverdue = payment.status !== 'paid' && new Date(payment.due_date) < new Date()
                const actualStatus = isOverdue ? 'overdue' : payment.status
                const displayLabel = (actualStatus === 'foreclosed' && loan.status === 'foreclosed') ? 'Settled' : actualStatus
                const StatusIcon = statusIcons[actualStatus] || Clock

                return (
                  <div
                    key={payment.id}
                    className="p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                          Week {payment.week_number}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Due: {formatDate(payment.due_date)}
                        </p>
                        {payment.paid_date && (
                          <p className="text-xs text-green-600 dark:text-green-400">
                            Paid: {formatDate(payment.paid_date)}
                          </p>
                        )}
                      </div>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusColors[actualStatus]}`}>
                        <StatusIcon className="w-3 h-3" />
                        {displayLabel}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                          Due: {formatCurrency(payment.amount_due)}
                        </p>
                        {payment.amount_paid > 0 && (
                          <p className="text-base font-bold text-green-600 dark:text-green-400 mt-0.5 tabular-nums">
                            Paid: {formatCurrency(payment.amount_paid)}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleRecordPayment(payment)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                          payment.status === 'paid'
                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            : 'bg-primary-600 text-white hover:bg-primary-700'
                        }`}
                      >
                        {payment.status === 'paid' ? 'Edit' : 'Pay Now'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Week
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Due Date
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {payments.map((payment) => {
                    const isOverdue = payment.status !== 'paid' && new Date(payment.due_date) < new Date()
                    const actualStatus = isOverdue ? 'overdue' : payment.status
                    const displayLabel = (actualStatus === 'foreclosed' && loan.status === 'foreclosed') ? 'Settled' : actualStatus
                    const StatusIcon = statusIcons[actualStatus] || Clock

                    return (
                      <tr
                        key={payment.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                          Week {payment.week_number}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                          {formatDate(payment.due_date)}
                          {payment.paid_date && (
                            <div className="text-xs text-green-600 dark:text-green-400">
                              Paid: {formatDate(payment.paid_date)}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                            Due: {formatCurrency(payment.amount_due)}
                          </p>
                          {payment.amount_paid > 0 && (
                            <p className="text-sm font-bold text-green-600 dark:text-green-400 mt-0.5 tabular-nums">
                              Paid: {formatCurrency(payment.amount_paid)}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusColors[actualStatus]}`}>
                            <StatusIcon className="w-3 h-3" />
                            {displayLabel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleRecordPayment(payment)}
                            className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                              payment.status === 'paid'
                                ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                : 'bg-primary-600 text-white hover:bg-primary-700'
                            }`}
                          >
                            {payment.status === 'paid' ? 'Edit' : 'Pay'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

          {/* Foreclose Loan Modal */}
          {showForecloseModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                    <Ban className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      Foreclose this loan?
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      This will close all pending weeks and mark the loan as foreclosed. This cannot be undone.
                    </p>
                  </div>
                </div>

                {pendingWeeksCount > 0 && (
                  <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Pending amount (will be closed)</p>
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 tabular-nums mt-1">
                      {formatCurrency(pendingAmount)}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      {pendingWeeksCount} week{pendingWeeksCount !== 1 ? 's' : ''} will be closed
                    </p>
                  </div>
                )}

                <form onSubmit={handleForeclose} className="space-y-4">
                  <div>
                    <label htmlFor="foreclose-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Foreclosure date
                    </label>
                    <input
                      id="foreclose-date"
                      type="date"
                      value={forecloseDate || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`}
                      onChange={(e) => setForecloseDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Closed weeks will appear in Collections for this date
                    </p>
                  </div>
                  <div>
                    <label htmlFor="foreclose-settlement" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Settlement amount (optional)
                    </label>
                    <input
                      id="foreclose-settlement"
                      type="number"
                      step="0.01"
                      min="0"
                      value={forecloseSettlement}
                      onChange={(e) => setForecloseSettlement(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    />
                  </div>
                  {forecloseError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {forecloseError}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => { setShowForecloseModal(false); setForecloseError(''); setForecloseSettlement(''); setForecloseDate('') }}
                      className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={forecloseLoading}
                      className="flex-1 px-4 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {forecloseLoading ? 'Foreclosing...' : 'Close all weeks & foreclose'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Settle and close Modal */}
          {showSettleModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                    <HandCoins className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      Settle & close
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Enter settlement amount (same, lower, or higher than pending). The full amount is recorded on the settlement date so it appears in that week&apos;s collections. All pending and rest weeks will show as settled.
                    </p>
                  </div>
                </div>

                {pendingWeeksCount > 0 && (
                  <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Pending balance</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums mt-1">
                      {formatCurrency(pendingAmount)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {pendingWeeksCount} week{pendingWeeksCount !== 1 ? 's' : ''} will show as settled
                    </p>
                  </div>
                )}

                <form onSubmit={handleSettleAndClose} className="space-y-4">
                  <div>
                    <label htmlFor="settle-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Settlement date
                    </label>
                    <input
                      id="settle-date"
                      type="date"
                      value={settleDate || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`}
                      onChange={(e) => setSettleDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      This amount will appear in Collections for this date
                    </p>
                  </div>
                  <div>
                    <label htmlFor="settle-amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Settlement amount (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="settle-amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={settleAmount}
                      onChange={(e) => setSettleAmount(e.target.value)}
                      placeholder="0"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      required
                    />
                  </div>
                  {settleError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {settleError}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => { setShowSettleModal(false); setSettleError(''); setSettleAmount(''); setSettleDate('') }}
                      className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={settleLoading}
                      className="flex-1 px-4 py-2.5 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {settleLoading ? 'Settling...' : 'Settle & close'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Loan Modal */}
          {showEditModal && loan && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Pencil className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    Edit loan details
                  </h3>
                  <button type="button" onClick={() => { setShowEditModal(false); setEditError('') }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
                <form onSubmit={handleEditSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="edit-principal" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Principal amount (₹)
                    </label>
                    <input
                      id="edit-principal"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={editPrincipal}
                      onChange={(e) => setEditPrincipal(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      required
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Weekly and total will be recalculated from your default rate. Unpaid installments will use the new weekly amount.
                    </p>
                  </div>
                  <div>
                    <label htmlFor="edit-start-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Loan given date
                    </label>
                    <input
                      id="edit-start-date"
                      type="date"
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-first-payment-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      First payment due date
                    </label>
                    <input
                      id="edit-first-payment-date"
                      type="date"
                      value={editFirstPaymentDate}
                      onChange={(e) => setEditFirstPaymentDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Leave empty to use next Sunday after loan given date. Changing this updates all payment due dates.
                    </p>
                  </div>
                  {editError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {editError}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => { setShowEditModal(false); setEditError('') }}
                      className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={editLoading}
                      className="flex-1 px-4 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {editLoading ? 'Saving...' : 'Save changes'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Delete Loan Confirmation Modal */}
          {showDeleteModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                    <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      Delete this loan?
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      This will permanently delete the loan and all associated payment records. This action cannot be undone.
                    </p>
                  </div>
                </div>
                {deleteError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm mb-4">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {deleteError}
                  </div>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowDeleteModal(false); setDeleteError('') }}
                    className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteConfirm}
                    disabled={deleteLoading}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {deleteLoading ? 'Deleting...' : 'Delete loan'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Record Payment Modal */}
          {showPaymentModal && selectedPayment && (
            <RecordPaymentModal
              payment={selectedPayment}
              onClose={() => setShowPaymentModal(false)}
              onSuccess={handlePaymentRecorded}
            />
          )}

          {/* Mass record past weeks (only when setting enabled) */}
          {allowMassRecordPast && showMassRecordModal && loan?.id && (
            <MassRecordPastPaymentsModal
              loanId={loan.id}
              borrowerName={loan.borrower?.name}
              onClose={() => setShowMassRecordModal(false)}
              onDone={() => {
                loadLoanDetails()
                if (onUpdate) onUpdate()
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
