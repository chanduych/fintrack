import { useState, useEffect } from 'react'
import {
  TrendingUp,
  IndianRupeeIcon,
  Users,
  CheckCircle,
  AlertCircle,
  Wallet,
  BarChart3,
  Loader2,
  Percent,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { getBorrowers } from '../../services/borrowerService'
import { getLoans } from '../../services/loanService'
import { getOverduePayments } from '../../services/paymentService'
import { getUserSettings } from '../../services/userService'
import { formatCurrency } from '../../utils/loanCalculations'
import { formatDate } from '../../utils/dateUtils'

export default function AnalyticsDashboard() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [borrowers, setBorrowers] = useState([])
  const [loans, setLoans] = useState([])
  const [overduePayments, setOverduePayments] = useState([])
  const [settings, setSettings] = useState(null)
  const [expandedOverdueKeys, setExpandedOverdueKeys] = useState(new Set())

  useEffect(() => {
    if (user) {
      loadAnalyticsData()
    }
  }, [user])

  const loadAnalyticsData = async () => {
    setLoading(true)

    const [borrowersRes, loansRes, overdueRes, settingsRes] = await Promise.all([
      getBorrowers(user.id),
      getLoans(user.id),
      getOverduePayments(user.id),
      getUserSettings(user.id)
    ])

    if (borrowersRes.data) setBorrowers(borrowersRes.data)
    if (loansRes.data) setLoans(loansRes.data)
    if (overdueRes.data) setOverduePayments(overdueRes.data)
    if (settingsRes.data) setSettings(settingsRes.data)

    setLoading(false)
  }

  // Calculate metrics
  const activeLoans = loans.filter(l => l.status === 'active')
  const closedLoans = loans.filter(l => l.status === 'closed')
  const foreclosedLoans = loans.filter(l => l.status === 'foreclosed')
  const settledLoans = [...closedLoans, ...foreclosedLoans].sort((a, b) => {
    const dateA = a.foreclosure_date || a.updated_at || a.created_at
    const dateB = b.foreclosure_date || b.updated_at || b.created_at
    return new Date(dateB) - new Date(dateA)
  })

  // Total principal disbursed (all loans)
  const totalPrincipalDisbursed = loans.reduce((sum, l) =>
    sum + parseFloat(l.principal_amount || 0), 0
  )

  // Active principal (only active loans)
  const activePrincipal = activeLoans.reduce((sum, l) =>
    sum + parseFloat(l.principal_amount || 0), 0
  )

  // Total amount expected = full repayable (active loans)
  const totalAmountExpected = activeLoans.reduce((sum, l) =>
    sum + parseFloat(l.total_amount || 0), 0
  )

  // Calculate total collected from all active loans
  const totalCollected = activeLoans.reduce((sum, loan) => {
    // Sum up all paid amounts from payments
    const loanPayments = loan.payments || []
    const collected = loanPayments.reduce((pSum, p) =>
      pSum + parseFloat(p.amount_paid || 0), 0
    )
    return sum + collected
  }, 0)

  // Outstanding amount (expected - collected)
  const outstandingAmount = totalAmountExpected - totalCollected

  // Overdue: distinct loans and total amount
  const overdueLoanKeys = new Set(overduePayments.map(p => `${p.borrower_id}-${p.loan_id}`))
  const overdueLoanCount = overdueLoanKeys.size
  const overdueTotalAmount = overduePayments.reduce((s, p) => s + parseFloat(p.balance || 0), 0)

  // Interest earned from closed loans = total - principal (full interest on closed loans)
  const interestEarnedClosed = closedLoans.reduce((sum, l) =>
    sum + (parseFloat(l.total_amount || 0) - parseFloat(l.principal_amount || 0)), 0
  )

  // Interest earned from active loans = interest portion of what we've collected so far
  const interestEarnedActive = activeLoans.reduce((sum, loan) => {
    const paidRaw = loan.total_paid ?? (loan.payments || []).reduce((s, p) => s + parseFloat(p.amount_paid || 0), 0)
    const totalPaid = parseFloat(paidRaw || 0)
    const principal = parseFloat(loan.principal_amount || 0)
    const totalAmount = parseFloat(loan.total_amount || 0)
    if (totalAmount <= 0) return sum
    const principalPortionReceived = principal * (totalPaid / totalAmount)
    const interestPortionReceived = totalPaid - principalPortionReceived
    return sum + Math.max(0, interestPortionReceived)
  }, 0)

  // Interest earned from foreclosed loans = interest portion of what was collected before foreclosure
  const interestEarnedForeclosed = foreclosedLoans.reduce((sum, loan) => {
    const paidRaw = loan.total_paid ?? (loan.payments || []).reduce((s, p) => s + parseFloat(p.amount_paid || 0), 0)
    const totalPaid = parseFloat(paidRaw || 0)
    const principal = parseFloat(loan.principal_amount || 0)
    const totalAmount = parseFloat(loan.total_amount || 0)
    if (totalAmount <= 0) return sum
    const principalPortionReceived = principal * (totalPaid / totalAmount)
    const interestPortionReceived = totalPaid - principalPortionReceived
    return sum + Math.max(0, interestPortionReceived)
  }, 0)

  // Total interest earned till date = closed + active + foreclosed
  const totalInterestEarnedTillDate = interestEarnedClosed + interestEarnedActive + interestEarnedForeclosed

  // Potential interest on active loans (if all remaining payments are made)
  const potentialInterest = activeLoans.reduce((sum, l) =>
    sum + (parseFloat(l.total_amount || 0) - parseFloat(l.principal_amount || 0)), 0
  )

  // This week's collections
  const today = new Date()
  const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay())
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)

  // This month's disbursements
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthLoans = loans.filter(l => {
    const loanDate = new Date(l.start_date)
    return loanDate >= monthStart && loanDate <= today
  })
  const monthlyDisbursement = monthLoans.reduce((sum, l) =>
    sum + parseFloat(l.principal_amount || 0), 0
  )

  // Borrowers: active (is_active) vs inactive
  const activeBorrowerCount = borrowers.filter(b => b.is_active !== false).length
  const inactiveBorrowerCount = borrowers.filter(b => b.is_active === false).length

  // Total collected across ALL loans
  const totalCollectedAll = loans.reduce((sum, loan) => {
    const paid = loan.total_paid ?? (loan.payments || []).reduce((s, p) => s + parseFloat(p.amount_paid || 0), 0)
    return sum + parseFloat(paid || 0)
  }, 0)

  // Weekly rate (interest applied per week)
  const weeklyRate = settings?.weekly_rate ?? 0.05
  const weeklyRatePct = (weeklyRate * 100).toFixed(1)

  // Average loan size
  const avgLoanSize = loans.length > 0 ? totalPrincipalDisbursed / loans.length : 0

  // Collection rate (collected / expected for active loans)
  const collectionRate = totalAmountExpected > 0
    ? (totalCollected / totalAmountExpected) * 100
    : 0

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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3 mb-2">
          <BarChart3 className="w-8 h-8 text-primary-600" />
          Analytics Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Overview of your loan management business
        </p>
      </div>

      {/* Key Metrics - Top Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {/* Total Borrowers */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <Users className="w-7 h-7 opacity-80" />
            <p className="text-2xl font-bold">{borrowers.length}</p>
          </div>
          <p className="text-xs opacity-90 uppercase tracking-wide mb-2">Total Borrowers</p>
          <div className="flex items-center gap-3 text-xs opacity-90">
            <span>{activeBorrowerCount} active</span>
            <span>{inactiveBorrowerCount} inactive</span>
          </div>
        </div>

        {/* Active Loans */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <TrendingUp className="w-7 h-7 opacity-80" />
            <p className="text-2xl font-bold">{activeLoans.length}</p>
          </div>
          <p className="text-xs opacity-90 uppercase tracking-wide mb-2">Active Loans</p>
          <div className="text-xs opacity-90">
            {loans.length} total · {closedLoans.length} closed · {foreclosedLoans.length} foreclosed
          </div>
        </div>

        {/* Principal Out */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <IndianRupeeIcon className="w-7 h-7 opacity-80" />
          </div>
          <p className="text-xs opacity-90 uppercase tracking-wide mb-1">Principal Out</p>
          <p className="text-xl font-bold tabular-nums">
            {formatCurrency(activePrincipal)}
          </p>
          <div className="text-xs opacity-90 mt-1">
            Total disbursed: {formatCurrency(totalPrincipalDisbursed)}
          </div>
        </div>

        {/* Interest rate (compound) */}
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <Percent className="w-7 h-7 opacity-80" />
          </div>
          <p className="text-xs opacity-90 uppercase tracking-wide mb-1">Interest (weekly)</p>
          <p className="text-xl font-bold tabular-nums">{weeklyRatePct}%</p>
          <div className="text-xs opacity-90 mt-1">
            Applied on principal per week
          </div>
        </div>

        {/* Outstanding */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <Wallet className="w-7 h-7 opacity-80" />
          </div>
          <p className="text-xs opacity-90 uppercase tracking-wide mb-1">Outstanding</p>
          <p className="text-xl font-bold tabular-nums">
            {formatCurrency(outstandingAmount)}
          </p>
          <div className="text-xs opacity-90 mt-1">
            Collection rate: {collectionRate.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Financial Overview — order: out → with interest → pending → collected → interest */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {/* 1. Total amount out (active loans principal) */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Wallet className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total amount out</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                {formatCurrency(activePrincipal)}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Principal given · {activeLoans.length} active loans
          </p>
        </div>

        {/* 2. Total amount with interest (full repayable on active loans) */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center">
              <IndianRupeeIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total amount with interest</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                {formatCurrency(totalAmountExpected)}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Full repayable (principal + interest) · active loans
          </p>
        </div>

        {/* 3. Total expected (pending) = remaining to collect */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total expected (pending)</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                {formatCurrency(outstandingAmount)}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Pending payments only (principal + interest to come)
          </p>
        </div>

        {/* 4. Total Collected */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Collected</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 tabular-nums">
                {formatCurrency(totalCollected)}
              </p>
            </div>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(collectionRate, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Interest earned — total till date, differentiated by closed / active / foreclosed */}
      <div className="mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 max-w-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <IndianRupeeIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total interest earned (till date)</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 tabular-nums">
                {formatCurrency(totalInterestEarnedTillDate)}
              </p>
            </div>
          </div>
          <div className="space-y-1.5 text-sm">
            <p className="text-gray-600 dark:text-gray-300">
              <span className="text-gray-500 dark:text-gray-400">From closed loans (total − principal):</span>{' '}
              <span className="font-semibold tabular-nums">{formatCurrency(interestEarnedClosed)}</span>
            </p>
            <p className="text-gray-600 dark:text-gray-300">
              <span className="text-gray-500 dark:text-gray-400">From active loans (interest on collected):</span>{' '}
              <span className="font-semibold tabular-nums">{formatCurrency(interestEarnedActive)}</span>
            </p>
            {interestEarnedForeclosed > 0 && (
              <p className="text-gray-600 dark:text-gray-300">
                <span className="text-gray-500 dark:text-gray-400">From foreclosed (interest on collected):</span>{' '}
                <span className="font-semibold tabular-nums">{formatCurrency(interestEarnedForeclosed)}</span>
              </p>
            )}
            <p className="text-gray-600 dark:text-gray-300 pt-1 border-t border-gray-200 dark:border-gray-600 mt-2">
              <span className="text-gray-500 dark:text-gray-400">Potential (active, if all paid):</span>{' '}
              <span className="font-semibold tabular-nums">{formatCurrency(potentialInterest)}</span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Closed = full interest (total − principal). Active / foreclosed = interest portion of amount collected so far.
            </p>
          </div>
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Avg Loan Size</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">
            {formatCurrency(avgLoanSize)}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">This Month</p>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
            {formatCurrency(monthlyDisbursement)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {monthLoans.length} loans
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Overdue</p>
          <p className="text-xl font-bold text-red-600 dark:text-red-400">
            {overdueLoanCount} {overdueLoanCount === 1 ? 'loan' : 'loans'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {formatCurrency(overdueTotalAmount)}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Foreclosed</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">
            {foreclosedLoans.length}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {formatCurrency(foreclosedLoans.reduce((s, l) => s + parseFloat(l.principal_amount || 0), 0))}
          </p>
        </div>
      </div>

      {/* Recent Activity & Overdue Payments */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Loan Status Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary-600" />
            Loan Status
          </h3>

          <div className="space-y-4">
            {/* Active */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Active Loans</span>
                <span className="text-sm font-bold text-green-600 dark:text-green-400">
                  {activeLoans.length} ({((activeLoans.length / loans.length) * 100 || 0).toFixed(0)}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all"
                  style={{ width: `${(activeLoans.length / loans.length) * 100 || 0}%` }}
                />
              </div>
            </div>

            {/* Closed */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Closed Loans</span>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {closedLoans.length} ({((closedLoans.length / loans.length) * 100 || 0).toFixed(0)}%)
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                <div
                  className="bg-blue-500 h-3 rounded-full transition-all"
                  style={{ width: `${(closedLoans.length / loans.length) * 100 || 0}%` }}
                />
              </div>
            </div>

            {/* Foreclosed */}
            {foreclosedLoans.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Foreclosed</span>
                  <span className="text-sm font-bold text-red-600 dark:text-red-400">
                    {foreclosedLoans.length} ({((foreclosedLoans.length / loans.length) * 100 || 0).toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-red-500 h-3 rounded-full transition-all"
                    style={{ width: `${(foreclosedLoans.length / loans.length) * 100 || 0}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Overdue Payments */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            Overdue Payments
          </h3>

          {overduePayments.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                No overdue payments
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[28rem] overflow-y-auto">
              {(() => {
                const grouped = {}
                overduePayments.forEach(payment => {
                  const key = `${payment.borrower_id}-${payment.loan_id}`
                  if (!grouped[key]) {
                    grouped[key] = {
                      key,
                      borrower_id: payment.borrower_id,
                      borrower_name: payment.borrower_name,
                      loan_id: payment.loan_id,
                      loan_number: payment.loan_number,
                      payments: [],
                      total_balance: 0
                    }
                  }
                  grouped[key].payments.push(payment)
                  grouped[key].total_balance += parseFloat(payment.balance || 0)
                })
                const groupedLoans = Object.values(grouped).sort((a, b) => b.total_balance - a.total_balance)

                const toggle = (k) => {
                  setExpandedOverdueKeys(prev => {
                    const next = new Set(prev)
                    if (next.has(k)) next.delete(k)
                    else next.add(k)
                    return next
                  })
                }

                return groupedLoans.map((group) => {
                  const isExpanded = expandedOverdueKeys.has(group.key)
                  return (
                    <div
                      key={group.key}
                      className="rounded-lg border border-red-200 dark:border-red-800 overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => toggle(group.key)}
                        className="w-full flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 text-left hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {group.borrower_name}
                              </p>
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded">
                                Loan {group.loan_number ?? group.loan_id ?? '—'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {group.payments.length} week{group.payments.length !== 1 ? 's' : ''} overdue
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <p className="text-sm font-bold text-red-600 dark:text-red-400 tabular-nums">
                            {formatCurrency(group.total_balance)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">pending</p>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="bg-white dark:bg-gray-800/80 border-t border-red-200 dark:border-red-800">
                          <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            Overdue weeks
                          </div>
                          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                            {group.payments
                              .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''))
                              .map((p, idx) => (
                                <li
                                  key={p.id || `${p.loan_id}-${p.week_number}-${idx}`}
                                  className="flex items-center justify-between px-4 py-2 text-sm"
                                >
                                  <span className="text-gray-600 dark:text-gray-300">
                                    Week {p.week_number ?? '—'} · due {formatDate(p.due_date)}
                                  </span>
                                  <span className="font-medium text-red-600 dark:text-red-400 tabular-nums">
                                    {formatCurrency(parseFloat(p.balance || 0))}
                                  </span>
                                </li>
                              ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )
                })
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Settled loans list */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 md:px-6 py-3 md:py-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Settled loans
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Closed and foreclosed loans · loan amount, needed to pay, actually paid
          </p>
        </div>
        {settledLoans.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No settled loans yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Borrower</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Loan amount</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Needed to pay</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actually paid</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {settledLoans.map((loan) => {
                  const totalPaid = loan.total_paid ?? (loan.payments || []).reduce((s, p) => s + parseFloat(p.amount_paid || 0), 0)
                  return (
                    <tr key={loan.loan_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{loan.borrower_name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{loan.borrower_area} · Loan #{loan.loan_number ?? '-'}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-900 dark:text-white">
                        {formatCurrency(loan.principal_amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-600 dark:text-gray-300">
                        {formatCurrency(loan.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium tabular-nums text-green-600 dark:text-green-400">
                        {formatCurrency(totalPaid)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          loan.status === 'closed'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                        }`}>
                          {loan.status === 'closed' ? 'Closed' : 'Foreclosed'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
