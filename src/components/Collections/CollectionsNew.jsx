import { useState, useEffect } from 'react'
import { Wallet, TrendingUp, AlertCircle, Loader2, Phone, ChevronLeft, ChevronRight, Calendar, IndianRupeeIcon } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { getPaymentsByWeek, getOverduePayments_all, getPaymentsCollectedInRange, recordPaymentFIFO } from '../../services/paymentService'
import { getUserSettings } from '../../services/userService'
import { formatCurrency } from '../../utils/loanCalculations'
import { formatDate, getWeekRangeForCollectionDay } from '../../utils/dateUtils'

export default function CollectionsNew() {
  const { user } = useAuth()
  const [weekPayments, setWeekPayments] = useState([])
  const [overduePayments, setOverduePayments] = useState([])
  const [collectedPayments, setCollectedPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedBorrower, setSelectedBorrower] = useState(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [collectionDay, setCollectionDay] = useState(0)

  const getWeekRange = (offset = 0) => getWeekRangeForCollectionDay(collectionDay, offset)
  const weekRange = getWeekRange(weekOffset)

  useEffect(() => {
    if (user) {
      getUserSettings(user.id).then(({ data }) => {
        if (data?.default_collection_day != null) setCollectionDay(data.default_collection_day)
      })
    }
  }, [user])

  useEffect(() => {
    if (user) loadData()
  }, [user, weekOffset, collectionDay])

  const loadData = async () => {
    setLoading(true)
    const { start: weekStart, end: weekEnd } = getWeekRange(weekOffset)

    const [weekRes, overdueRes, collectedRes] = await Promise.all([
      getPaymentsByWeek(user.id, weekStart, weekEnd),
      getOverduePayments_all(user.id, weekStart),
      getPaymentsCollectedInRange(user.id, weekStart, weekEnd)
    ])

    if (!weekRes.error && weekRes.data) setWeekPayments(weekRes.data)
    if (!overdueRes.error && overdueRes.data) setOverduePayments(overdueRes.data)
    if (!collectedRes.error && collectedRes.data) setCollectedPayments(collectedRes.data)

    setLoading(false)
  }

  // Group payments by borrower
  const groupByBorrower = (payments) => {
    const grouped = {}
    for (const p of payments) {
      const id = p.borrower_id
      if (!grouped[id]) {
        grouped[id] = {
          borrower_id: id,
          borrower_name: p.borrower_name,
          borrower_area: p.borrower_area,
          borrower_phone: p.borrower_phone,
          borrower_leader_tag: p.borrower_leader_tag,
          payments: []
        }
      }
      grouped[id].payments.push(p)
    }
    return Object.values(grouped).sort((a, b) => a.borrower_name?.localeCompare(b.borrower_name))
  }

  const weekBorrowers = groupByBorrower(weekPayments)
  const overdueBorrowers = groupByBorrower(overduePayments)

  // Calculate totals
  const weekExpected = weekPayments.reduce((s, p) => s + parseFloat(p.amount_due || 0), 0)
  const weekActualCollected = collectedPayments.reduce((s, p) => s + parseFloat(p.amount_paid || 0), 0)
  const overdueTotalDue = overduePayments.reduce((s, p) => s + parseFloat(p.amount_due || 0), 0)
  const overdueTotalPaid = overduePayments.reduce((s, p) => s + parseFloat(p.amount_paid || 0), 0)
  const overdueRemaining = overdueTotalDue - overdueTotalPaid

  // Week navigation
  const goToPreviousWeek = () => setWeekOffset(weekOffset - 1)
  const goToNextWeek = () => setWeekOffset(weekOffset + 1)
  const goToCurrentWeek = () => setWeekOffset(0)

  const handlePayment = (borrower) => {
    setSelectedBorrower(borrower)
    setShowPaymentModal(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Wallet className="w-7 h-7 text-primary-600" />
          Collections
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Weekly collections & overdue tracking
        </p>
      </div>

      {/* Week Selector */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={goToPreviousWeek} className="p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button onClick={goToCurrentWeek} className={`px-3 py-2 rounded-lg text-sm font-medium ${weekOffset === 0 ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600'}`}>
          This Week
        </button>
        <button onClick={goToNextWeek} className="p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="flex-1" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {formatDate(weekRange.start, 'MMM dd')} - {formatDate(weekRange.end, 'MMM dd, yyyy')}
        </span>
      </div>

      {/* Weekly Collections Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <p className="text-xs text-gray-500 dark:text-gray-400">Expected This Week</p>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{formatCurrency(weekExpected)}</p>
          <p className="text-xs text-gray-400 mt-1">{weekPayments.length} payments due</p>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
            <p className="text-xs text-green-700 dark:text-green-400">Actually Collected</p>
          </div>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400 tabular-nums">{formatCurrency(weekActualCollected)}</p>
          <p className="text-xs text-green-500 mt-1">{collectedPayments.length} payments received</p>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <p className="text-xs text-red-700 dark:text-red-400">Total Overdue</p>
          </div>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">{formatCurrency(overdueRemaining)}</p>
          <p className="text-xs text-red-500 mt-1">{overduePayments.length} past due payments</p>
        </div>
      </div>

      {/* This Week Collections */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary-600" />
          This Week's Collections
        </h2>
        {weekBorrowers.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center border border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400">No payments due this week</p>
          </div>
        ) : (
          <div className="space-y-2">
            {weekBorrowers.map(borrower => {
              const totalDue = borrower.payments.reduce((s, p) => s + parseFloat(p.amount_due || 0), 0)
              const totalPaid = borrower.payments.reduce((s, p) => s + parseFloat(p.amount_paid || 0), 0)
              const pending = totalDue - totalPaid

              return (
                <div key={borrower.borrower_id} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-semibold">
                        {borrower.borrower_name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{borrower.borrower_name}</h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          {borrower.borrower_phone && (
                            <a href={`tel:${borrower.borrower_phone}`} className="flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline">
                              <Phone className="w-3 h-3" />
                              {borrower.borrower_phone}
                            </a>
                          )}
                          {borrower.borrower_area && <span>{borrower.borrower_area}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">{formatCurrency(totalDue)}</p>
                      <p className="text-xs text-gray-500">{borrower.payments.length} payment{borrower.payments.length > 1 ? 's' : ''}</p>
                    </div>
                    <button
                      onClick={() => handlePayment(borrower)}
                      className="ml-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      Collect
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Overdue Collections */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          Overdue Collections
        </h2>
        {overdueBorrowers.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center border border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400">No overdue payments</p>
          </div>
        ) : (
          <div className="space-y-2">
            {overdueBorrowers.map(borrower => {
              const totalDue = borrower.payments.reduce((s, p) => s + parseFloat(p.amount_due || 0), 0)
              const totalPaid = borrower.payments.reduce((s, p) => s + parseFloat(p.amount_paid || 0), 0)
              const pending = totalDue - totalPaid

              return (
                <div key={borrower.borrower_id} className="bg-red-50 dark:bg-red-900/10 rounded-lg p-4 border border-red-200 dark:border-red-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white font-semibold">
                        {borrower.borrower_name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white">{borrower.borrower_name}</h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          {borrower.borrower_phone && (
                            <a href={`tel:${borrower.borrower_phone}`} className="flex items-center gap-1 text-red-600 dark:text-red-400 hover:underline">
                              <Phone className="w-3 h-3" />
                              {borrower.borrower_phone}
                            </a>
                          )}
                          {borrower.borrower_area && <span>{borrower.borrower_area}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-red-600 dark:text-red-400 tabular-nums">{formatCurrency(pending)}</p>
                      <p className="text-xs text-red-500">{borrower.payments.length} overdue EMI{borrower.payments.length > 1 ? 's' : ''}</p>
                    </div>
                    <button
                      onClick={() => handlePayment(borrower)}
                      className="ml-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Collect
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Payment Modal - TODO: Implement FIFO payment modal */}
      {showPaymentModal && selectedBorrower && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Collect Payment</h2>
            <p>From: {selectedBorrower.borrower_name}</p>
            <p className="text-sm text-gray-500">FIFO payment allocation coming soon...</p>
            <button onClick={() => setShowPaymentModal(false)} className="mt-4 px-4 py-2 bg-gray-200 rounded-lg">
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
