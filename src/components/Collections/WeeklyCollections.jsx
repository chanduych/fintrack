import { useState, useEffect } from 'react'
import { Calendar, Users, Wallet, Loader2, ChevronLeft, ChevronRight, Banknote } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { getLoans } from '../../services/loanService'
import { getPaymentsCollectedInRange } from '../../services/paymentService'
import { formatCurrency } from '../../utils/loanCalculations'
import { formatDate } from '../../utils/dateUtils'

export default function WeeklyCollections() {
  const { user } = useAuth()
  const [loans, setLoans] = useState([])
  const [collectedPayments, setCollectedPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [showCalendar, setShowCalendar] = useState(false)

  // Get week date range
  const getWeekRange = (offset = 0) => {
    const today = new Date()
    const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() + (offset * 7))
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    return { start: weekStart, end: weekEnd }
  }

  const weekRange = getWeekRange(weekOffset)

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user, weekOffset])

  const loadData = async () => {
    setLoading(true)
    const { start: weekStart, end: weekEnd } = getWeekRange(weekOffset)

    // Fetch loans and actual collections in parallel
    const [loansRes, collectedRes] = await Promise.all([
      getLoans(user.id),
      getPaymentsCollectedInRange(user.id, weekStart, weekEnd)
    ])

    if (!loansRes.error && loansRes.data) setLoans(loansRes.data)
    if (!collectedRes.error && collectedRes.data) setCollectedPayments(collectedRes.data)

    setLoading(false)
  }

  // Handle calendar date selection
  const handleDateSelect = (date) => {
    const selectedDate = new Date(date)
    const today = new Date()
    const todayWeekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay())
    const selectedWeekStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - selectedDate.getDay())
    const diffWeeks = Math.round((selectedWeekStart - todayWeekStart) / (7 * 24 * 60 * 60 * 1000))
    setWeekOffset(diffWeeks)
    setShowCalendar(false)
  }

  // Navigate weeks
  const goToPreviousWeek = () => setWeekOffset(weekOffset - 1)
  const goToNextWeek = () => setWeekOffset(weekOffset + 1)
  const goToCurrentWeek = () => setWeekOffset(0)

  // Filter loans for selected week (by disbursement date)
  const weekLoans = loans.filter(loan => {
    if (!loan.start_date) return false
    const loanDate = new Date(loan.start_date)
    loanDate.setHours(0, 0, 0, 0)
    const weekStartNormalized = new Date(weekRange.start)
    weekStartNormalized.setHours(0, 0, 0, 0)
    const weekEndNormalized = new Date(weekRange.end)
    weekEndNormalized.setHours(23, 59, 59, 999)
    return loanDate >= weekStartNormalized && loanDate <= weekEndNormalized
  })

  // Amount gave this week (loans disbursed)
  const totalLoans = weekLoans.length
  const amountGaveThisWeek = weekLoans.reduce((sum, l) => sum + parseFloat(l.principal_amount || 0), 0)

  // Amount got this week (collections)
  const actualCollectedTotal = collectedPayments.reduce((sum, p) => sum + parseFloat(p.amount_paid || 0), 0)
  const collectedCount = collectedPayments.length

  // Group collected by borrower
  const collectedByBorrower = {}
  for (const p of collectedPayments) {
    const name = p.borrower_name || 'Unknown'
    if (!collectedByBorrower[name]) {
      collectedByBorrower[name] = { total: 0, count: 0, area: p.borrower_area }
    }
    collectedByBorrower[name].total += parseFloat(p.amount_paid || 0)
    collectedByBorrower[name].count++
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Calendar className="w-8 h-8 text-primary-600" />
              Weekly Loans
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Amount got, amount gave & loans gave this week
            </p>
          </div>
        </div>

        {/* Week Selector with Navigation */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={goToPreviousWeek}
            className="p-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Previous Week"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 flex items-center gap-2">
            <button
              onClick={goToCurrentWeek}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                weekOffset === 0
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              This Week
            </button>

            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className="px-4 py-2 rounded-lg font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Select Date</span>
            </button>
          </div>

          <button
            onClick={goToNextWeek}
            className="p-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Next Week"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Calendar Picker */}
        {showCalendar && (
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-600 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                Select a date to view its week
              </h3>
              <button
                onClick={() => setShowCalendar(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>
            <input
              type="date"
              onChange={(e) => handleDateSelect(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        )}

        {/* Week Date Range */}
        <div className="bg-gradient-to-r from-primary-50 to-accent-50 dark:from-primary-900/20 dark:to-accent-900/20 rounded-xl p-4 mb-6 border border-primary-200 dark:border-primary-800">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {formatDate(weekRange.start, 'MMMM dd')} - {formatDate(weekRange.end, 'MMMM dd, yyyy')}
            </p>
            {weekOffset !== 0 && (
              <span className="text-xs px-2 py-1 bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 rounded-full">
                {weekOffset > 0 ? `+${weekOffset} week${weekOffset > 1 ? 's' : ''}` : `${weekOffset} week${weekOffset < -1 ? 's' : ''}`}
              </span>
            )}
          </div>
        </div>

        {/* Summary: amount got, amount gave, loans gave */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-1">
              <Banknote className="w-4 h-4 text-green-600 dark:text-green-400" />
              <p className="text-xs font-medium text-green-700 dark:text-green-400 uppercase">Amount got this week</p>
            </div>
            <p className="text-xl font-bold text-green-600 dark:text-green-400 tabular-nums">
              {formatCurrency(actualCollectedTotal)}
            </p>
            <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">{collectedCount} payments</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <p className="text-xs font-medium text-blue-700 dark:text-blue-400 uppercase">Amount gave this week</p>
            </div>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
              {formatCurrency(amountGaveThisWeek)}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-500 mt-0.5">disbursed</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase">Loans gave</p>
            </div>
            <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{totalLoans}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">this week</p>
          </div>
        </div>

        {/* Collected breakdown (who paid) */}
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 mb-6 border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-green-700 dark:text-green-400">Collected this week</p>
            <p className="text-sm font-bold text-green-600 dark:text-green-400 tabular-nums">
              {formatCurrency(actualCollectedTotal)}
            </p>
          </div>
          {Object.keys(collectedByBorrower).length > 0 && (
            <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800 space-y-1.5">
              {Object.entries(collectedByBorrower)
                .sort(([,a], [,b]) => b.total - a.total)
                .map(([name, info]) => (
                  <div key={name} className="flex items-center justify-between text-sm">
                    <span className="text-green-800 dark:text-green-300">
                      {name}
                      {info.area && <span className="text-xs text-green-600 dark:text-green-500 ml-1">({info.area})</span>}
                    </span>
                    <span className="font-semibold text-green-700 dark:text-green-400 tabular-nums">
                      {formatCurrency(info.total)}
                      {info.count > 1 && <span className="text-xs font-normal ml-1">({info.count}x)</span>}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Loans List */}
      {weekLoans.length === 0 ? (
        <div className="text-center py-16">
          <Calendar className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No loans this week
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            No loans were disbursed during this period
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">List of loans gave this week</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Borrower
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Area
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {weekLoans.map((loan) => (
                  <tr key={loan.loan_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                          {loan.borrower_name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {loan.borrower_name}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                      {loan.borrower_area}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                      {formatDate(loan.start_date)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white text-right tabular-nums">
                      {formatCurrency(loan.principal_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
