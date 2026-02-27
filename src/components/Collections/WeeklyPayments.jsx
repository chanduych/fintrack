import { useState, useEffect, useMemo } from 'react'
import {
  Calendar, AlertCircle, Phone, Users, Wallet, TrendingUp,
  Loader2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  Filter, CheckCircle, Clock, Search, IndianRupeeIcon, Banknote, XCircle, Ban
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { getPaymentsByWeek, getOverduePayments_all, getPaymentsCollectedInRange } from '../../services/paymentService'
import { forecloseLoan } from '../../services/loanService'
import { getUserSettings } from '../../services/userService'
import { formatCurrency } from '../../utils/loanCalculations'
import { formatDate, getWeekRangeForCollectionDay } from '../../utils/dateUtils'
import RecordPaymentModal from './RecordPaymentModal'

export default function WeeklyPayments() {
  const { user } = useAuth()
  const [weekPayments, setWeekPayments] = useState([])
  const [overduePayments, setOverduePayments] = useState([])
  const [collectedPayments, setCollectedPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)
  const [showCalendar, setShowCalendar] = useState(false)
  const [activeTab, setActiveTab] = useState('week') // 'week', 'pending', 'collected'
  const [filterArea, setFilterArea] = useState('')
  const [filterLeader, setFilterLeader] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showForeclosureModal, setShowForeclosureModal] = useState(false)
  const [selectedLoan, setSelectedLoan] = useState(null)
  const [foreclosureAmount, setForeclosureAmount] = useState('')
  const [expandedPendingLoanKeys, setExpandedPendingLoanKeys] = useState(new Set()) // keys: `${borrower_id}-${loan_id}` for per-loan dropdown
  const [foreclosureDate, setForeclosureDate] = useState('')
  const [foreclosureLoading, setForeclosureLoading] = useState(false)
  const [foreclosureError, setForeclosureError] = useState('')
  const [showOtherWeeksCollected, setShowOtherWeeksCollected] = useState(false)
  const [showStatsBreakdown, setShowStatsBreakdown] = useState(false)
  const [collectionDay, setCollectionDay] = useState(0) // 0=Sun, 1=Mon, ... from Settings

  // Week range from Settings default collection day (e.g. Monday–Sunday if Monday selected)
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

    // Fetch all three data sets in parallel:
    // 1. Payments DUE in the selected week (by due_date)
    // 2. ALL pending/partial payments with due_date <= today (overdue till date)
    // 3. Payments actually COLLECTED in the selected week (by paid_date)
    const [weekRes, overdueRes, collectedRes] = await Promise.all([
      getPaymentsByWeek(user.id, weekStart, weekEnd, { includeClosedAndForeclosed: weekOffset === 0 }),
      getOverduePayments_all(user.id, new Date()),
      getPaymentsCollectedInRange(user.id, weekStart, weekEnd)
    ])

    if (!weekRes.error && weekRes.data) setWeekPayments(weekRes.data)
    if (!overdueRes.error && overdueRes.data) setOverduePayments(overdueRes.data)
    if (!collectedRes.error && collectedRes.data) setCollectedPayments(collectedRes.data)

    setLoading(false)
  }

  // Extract unique areas and leaders for filters
  const allPayments = [...weekPayments, ...overduePayments, ...collectedPayments]
  const areas = useMemo(() => {
    const set = new Set(allPayments.map(p => p.borrower_area).filter(Boolean))
    return [...set].sort()
  }, [weekPayments, overduePayments, collectedPayments])

  const leaders = useMemo(() => {
    const set = new Set(allPayments.map(p => p.borrower_leader_tag).filter(Boolean))
    return [...set].sort()
  }, [weekPayments, overduePayments, collectedPayments])

  // Apply filters
  const applyFilters = (payments) => {
    return payments.filter(p => {
      if (filterArea && p.borrower_area !== filterArea) return false
      if (filterLeader && p.borrower_leader_tag !== filterLeader) return false
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        if (!p.borrower_name?.toLowerCase().includes(term) &&
            !p.borrower_phone?.includes(term)) return false
      }
      return true
    })
  }

  const filteredWeekPayments = applyFilters(weekPayments)
  const filteredOverduePayments = applyFilters(overduePayments)
  const filteredCollectedPayments = applyFilters(collectedPayments)

  // Separate this week's into paid and pending (by due_date this week)
  const thisWeekPaid = filteredWeekPayments.filter(p => p.status === 'paid')
  const thisWeekPending = filteredWeekPayments.filter(p => p.status !== 'paid')

  // Paid this week = due-this-week paid + collected this week (e.g. foreclosed overdue closed this week)
  const paidIdsFromWeek = new Set(thisWeekPaid.map(p => p.id))
  const paidThisWeekOnlyCollected = filteredCollectedPayments.filter(p => !paidIdsFromWeek.has(p.id))
  const thisWeekPaidCombined = [...thisWeekPaid, ...paidThisWeekOnlyCollected]

  // NEW: Separate "this week paid" into: due this week vs other weeks
  // Payments due this week and paid
  const thisWeekDueAndPaid = thisWeekPaid
  // Payments from other weeks collected this week
  const otherWeeksCollectedThisWeek = paidThisWeekOnlyCollected

  // Stats - This Week (due this week)
  const weekDue = filteredWeekPayments.reduce((s, p) => s + parseFloat(p.amount_due || 0), 0)
  const weekCollectedFromDue = filteredWeekPayments.reduce((s, p) => s + parseFloat(p.amount_paid || 0), 0)
  const weekPendingAmount = weekDue - weekCollectedFromDue

  // Stats - Overdue (all pending till date)
  const overdueTotalDue = filteredOverduePayments.reduce((s, p) => s + parseFloat(p.amount_due || 0), 0)
  const overdueTotalPaid = filteredOverduePayments.reduce((s, p) => s + parseFloat(p.amount_paid || 0), 0)
  const overdueRemaining = overdueTotalDue - overdueTotalPaid

  // Stats - Actual Collected (by paid_date this week)
  const actualCollectedTotal = filteredCollectedPayments.reduce((s, p) => s + parseFloat(p.amount_paid || 0), 0)

  // Breakdown: due (this week), pending (overdue), foreclosure (upcoming weeks closed on foreclose)
  const toWeekDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const weekStartStr = toWeekDateStr(weekRange.start)
  const weekEndStr = toWeekDateStr(weekRange.end)
  const collectedFromDue = filteredCollectedPayments
    .filter(p => p.due_date >= weekStartStr && p.due_date <= weekEndStr)
    .reduce((s, p) => s + parseFloat(p.amount_paid || 0), 0)
  // Pending = collected from overdue (due_date before this week)
  const collectedFromPending = filteredCollectedPayments
    .filter(p => p.due_date < weekStartStr)
    .reduce((s, p) => s + parseFloat(p.amount_paid || 0), 0)
  // Foreclosed = sum of money recorded as paid this week that was due on future weeks (closed on foreclose)
  const collectedFromForeclosed = filteredCollectedPayments
    .filter(p => p.due_date > weekEndStr)
    .reduce((s, p) => s + parseFloat(p.amount_paid || 0), 0)

  // Collected breakdown: EMI (full), extra paid, partial paid
  const collectedAsEmi = filteredCollectedPayments.reduce(
    (s, p) => s + Math.min(parseFloat(p.amount_paid || 0), parseFloat(p.amount_due || 0)),
    0
  )
  const collectedAsExtra = filteredCollectedPayments.reduce(
    (s, p) => s + Math.max(0, parseFloat(p.amount_paid || 0) - parseFloat(p.amount_due || 0)),
    0
  )
  const collectedAsPartial = filteredCollectedPayments
    .filter(p => parseFloat(p.amount_paid || 0) > 0 && parseFloat(p.amount_paid || 0) < parseFloat(p.amount_due || 0))
    .reduce((s, p) => s + parseFloat(p.amount_paid || 0), 0)

  // Group by borrower + loan so each loan is a separate card
  const groupByBorrowerAndLoan = (payments) => {
    const grouped = {}
    for (const p of payments) {
      const key = `${p.borrower_id}-${p.loan_id}`
      if (!grouped[key]) {
        grouped[key] = {
          borrower_id: p.borrower_id,
          borrower_name: p.borrower_name,
          borrower_area: p.borrower_area,
          borrower_phone: p.borrower_phone,
          borrower_leader_tag: p.borrower_leader_tag,
          loan_id: p.loan_id,
          loan_number: p.loan_number,
          loan_status: p.loan_status,
          payments: []
        }
      }
      grouped[key].payments.push({
        ...p,
        display_loan_number: p.loan_number
      })
    }
    return Object.values(grouped).sort((a, b) => {
      const nameCmp = (a.borrower_name || '').localeCompare(b.borrower_name || '')
      if (nameCmp !== 0) return nameCmp
      return (a.loan_number || 0) - (b.loan_number || 0)
    })
  }

  const weekPendingBorrowers = groupByBorrowerAndLoan(thisWeekPending)
  const weekPaidBorrowers = groupByBorrowerAndLoan(thisWeekPaidCombined)
  const overdueBorrowers = groupByBorrowerAndLoan(filteredOverduePayments)
  const collectedBorrowers = groupByBorrowerAndLoan(filteredCollectedPayments)

  // NEW: Separate groups for this week tab
  const weekDueAndPaidBorrowers = groupByBorrowerAndLoan(thisWeekDueAndPaid)
  const otherWeeksCollectedBorrowers = groupByBorrowerAndLoan(otherWeeksCollectedThisWeek)

  // Navigation
  const goToPreviousWeek = () => setWeekOffset(weekOffset - 1)
  const goToNextWeek = () => setWeekOffset(weekOffset + 1)
  const goToCurrentWeek = () => setWeekOffset(0)

  const handleDateSelect = (date) => {
    const selected = new Date(date)
    selected.setHours(0, 0, 0, 0)
    const daysBack = (selected.getDay() - collectionDay + 7) % 7
    const selectedWeekStart = new Date(selected)
    selectedWeekStart.setDate(selected.getDate() - daysBack)
    const { start: currentStart } = getWeekRangeForCollectionDay(collectionDay, 0)
    const diffWeeks = Math.round((selectedWeekStart - currentStart) / (7 * 24 * 60 * 60 * 1000))
    setWeekOffset(diffWeeks)
    setShowCalendar(false)
  }

  const handleRecordPayment = (payment) => {
    setSelectedPayment(payment)
    setShowPaymentModal(true)
  }

  const handlePaymentRecorded = () => {
    setShowPaymentModal(false)
    setSelectedPayment(null)
    loadData()
  }

  const handleForecloseLoan = (group) => {
    setSelectedLoan(group)
    setForeclosureAmount('')
    setForeclosureError('')
    const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
    setForeclosureDate(todayStr)
    setShowForeclosureModal(true)
  }

  const handleConfirmForeclosure = async (e) => {
    e?.preventDefault?.()
    if (!selectedLoan) return

    setForeclosureError('')
    const amount = foreclosureAmount.trim() ? parseFloat(foreclosureAmount) : null
    const dateToUse = foreclosureDate || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`

    setForeclosureLoading(true)
    const { error } = await forecloseLoan(selectedLoan.loan_id, amount, dateToUse)
    setForeclosureLoading(false)

    if (error) {
      setForeclosureError(error.message || 'Failed to foreclose loan')
      return
    }
    setShowForeclosureModal(false)
    setSelectedLoan(null)
    setForeclosureAmount('')
    setForeclosureDate('')
    loadData()
  }

  const statusColors = {
    paid: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    partial: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    overdue: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    foreclosed: 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    )
  }

  const togglePendingLoanExpanded = (key) => {
    setExpandedPendingLoanKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Render a card per borrower+loan (one loan per card)
  const renderBorrowerCard = (group, sectionType = 'week') => {
    const isPendingSection = sectionType === 'pending'
    const isCollectedSection = sectionType === 'collected'
    const pendingKey = `${group.borrower_id}-${group.loan_id}`
    const isPendingExpanded = isPendingSection && expandedPendingLoanKeys.has(pendingKey)
    const loanOverallPending = group.payments
      .filter(p => p.status !== 'paid')
      .reduce((s, p) => s + (parseFloat(p.amount_due || 0) - parseFloat(p.amount_paid || 0)), 0)

    return (
      <div
        key={`${group.borrower_id}-${group.loan_id}-${sectionType}`}
        className={`bg-white dark:bg-gray-800 rounded-xl border transition-all ${
          isPendingSection ? 'border-red-200 dark:border-red-800'
          : isCollectedSection ? 'border-green-200 dark:border-green-800'
          : 'border-gray-200 dark:border-gray-700'
        }`}
      >
        {/* Borrower + Loan Header - clickable for pending to expand/collapse */}
        <div
          className={`p-4 ${isPendingSection ? 'cursor-pointer' : ''}`}
          onClick={isPendingSection ? () => togglePendingLoanExpanded(pendingKey) : undefined}
          role={isPendingSection ? 'button' : undefined}
          aria-expanded={isPendingSection ? isPendingExpanded : undefined}
        >
          <div className="flex flex-col sm:flex-row sm:items-start gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                {group.borrower_name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    {group.borrower_name}
                  </h3>
                  <span className="px-2 py-0.5 text-xs font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded flex-shrink-0">
                    Loan {group.loan_number ?? 1}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {group.borrower_phone && (
                    <a
                      href={`tel:${group.borrower_phone}`}
                      className="flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Phone className="w-3 h-3" />
                      {group.borrower_phone}
                    </a>
                  )}
                  {group.borrower_area && <span>{group.borrower_area}</span>}
                  {group.borrower_leader_tag && <span>{group.borrower_leader_tag}</span>}
                </div>
              </div>
            </div>
            {/* Loan total for this section */}
            <div className="flex items-center justify-between sm:justify-end gap-2 mt-2 sm:mt-0">
              <div className="text-left sm:text-right whitespace-nowrap">
                <p className={`text-sm font-bold tabular-nums ${
                  isCollectedSection ? 'text-green-600 dark:text-green-400'
                  : isPendingSection ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-900 dark:text-white'
                }`}>
                  {isCollectedSection
                    ? formatCurrency(group.payments.reduce((s, p) => s + parseFloat(p.amount_paid || 0), 0))
                    : formatCurrency(group.payments.reduce((s, p) => s + parseFloat(p.amount_due || 0), 0))
                  }
                </p>
                {loanOverallPending > 0 && !isCollectedSection && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold tabular-nums">
                    Overall pending: {formatCurrency(loanOverallPending)}
                  </p>
                )}
                <p className="text-[10px] text-gray-400 whitespace-nowrap">
                  {isPendingSection
                    ? `${group.payments.length} week${group.payments.length !== 1 ? 's' : ''}`
                    : `${group.payments.length} pmt${group.payments.length !== 1 ? 's' : ''}`}
                </p>
              </div>
              {isPendingSection && (
                <span className="text-red-600 dark:text-red-400">
                  {isPendingExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Payment rows (this loan only) - for pending section only show when expanded */}
        {(!isPendingSection || isPendingExpanded) && (
        <div className="border-t border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          {group.payments.map((payment) => {
            const today = new Date()
            const dueDate = new Date(payment.due_date)
            const isOverdue = isPendingSection || (dueDate < today && payment.status !== 'paid')
            const daysOverdue = isOverdue
              ? Math.floor((today - dueDate) / (1000 * 60 * 60 * 24))
              : 0
            const displayStatus = isOverdue && payment.status !== 'paid' ? 'overdue' : payment.status

            return (
              <div key={payment.id} className={`px-4 py-3 flex flex-wrap sm:flex-nowrap items-start sm:items-center justify-between gap-2 sm:gap-3 ${isOverdue && payment.status !== 'paid' ? 'bg-red-50/50 dark:bg-red-900/5' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {payment.display_loan_number && (
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded">
                        L{payment.display_loan_number}
                      </span>
                    )}
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      Wk {payment.week_number}
                    </span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${statusColors[displayStatus]}`}>
                      {displayStatus}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Due: {formatDate(payment.due_date)}
                    </span>
                    {daysOverdue > 0 && payment.status !== 'paid' && (
                      <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                        ({daysOverdue}d late)
                      </span>
                    )}
                    {payment.paid_date && (
                      <span className="text-xs text-green-600 dark:text-green-400">
                        Paid {formatDate(payment.paid_date)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <div className="text-right flex-shrink-0">
                    {isCollectedSection ? (
                      <div className="text-sm flex sm:block items-center gap-2 sm:space-y-0.5">
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">Total: <span className="text-sm font-bold text-green-600 dark:text-green-400 tabular-nums">{formatCurrency(payment.amount_paid)}</span></p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 hidden sm:block">EMI: <span className="font-semibold text-gray-700 dark:text-gray-300 tabular-nums">{formatCurrency(payment.amount_due)}</span></p>
                        {parseFloat(payment.amount_paid || 0) > parseFloat(payment.amount_due || 0) && (
                          <p className="text-[10px] text-green-600 dark:text-green-400">Extra: <span className="font-semibold tabular-nums">+{formatCurrency(parseFloat(payment.amount_paid) - parseFloat(payment.amount_due))}</span></p>
                        )}
                        {parseFloat(payment.amount_paid || 0) > 0 && parseFloat(payment.amount_paid || 0) < parseFloat(payment.amount_due || 0) && (
                          <p className="text-[10px] text-blue-600 dark:text-blue-400">Partial: <span className="font-semibold tabular-nums">{formatCurrency(payment.amount_paid)}</span></p>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm flex sm:block items-center gap-2 sm:space-y-0.5">
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">Total: <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{formatCurrency(payment.amount_paid || 0)}</span></p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 hidden sm:block">EMI: <span className="font-semibold text-gray-700 dark:text-gray-300 tabular-nums">{formatCurrency(payment.amount_due)}</span></p>
                        {payment.status !== 'paid' && parseFloat(payment.amount_due || 0) - parseFloat(payment.amount_paid || 0) > 0 && (
                          <p className="text-[10px] text-yellow-600 dark:text-yellow-400">Pending: <span className="font-semibold tabular-nums">{formatCurrency(parseFloat(payment.amount_due || 0) - parseFloat(payment.amount_paid || 0))}</span></p>
                        )}
                        {parseFloat(payment.amount_paid || 0) > 0 && parseFloat(payment.amount_paid || 0) < parseFloat(payment.amount_due || 0) && (
                          <p className="text-[10px] text-blue-600 dark:text-blue-400">Partial: <span className="font-semibold tabular-nums">{formatCurrency(payment.amount_paid)}</span></p>
                        )}
                        {payment.status === 'paid' && parseFloat(payment.amount_paid || 0) > parseFloat(payment.amount_due || 0) && (
                          <p className="text-[10px] text-green-600 dark:text-green-400">Extra: <span className="font-semibold tabular-nums">+{formatCurrency(parseFloat(payment.amount_paid) - parseFloat(payment.amount_due))}</span></p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0 ml-auto sm:ml-0">
                    {isCollectedSection ? (
                      <button
                        onClick={() => handleRecordPayment(payment)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        Edit
                      </button>
                    ) : payment.status === 'paid' ? (
                      <button
                        onClick={() => handleRecordPayment(payment)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        Edit
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRecordPayment(payment)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg text-white transition-colors ${
                          isOverdue
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-primary-600 hover:bg-primary-700'
                        }`}
                      >
                        Pay
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        )}
        {/* Foreclose - at bottom of card, subtle, so it's not tempting */}
        {!isCollectedSection && group.loan_status === 'active' && (
          <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 flex justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleForecloseLoan(group)
              }}
              className="text-[10px] font-medium text-rose-400 dark:text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
              title="Foreclose loan (close all pending weeks)"
            >
              Foreclose loan
            </button>
          </div>
        )}
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
          Weekly payments, overdue tracking & actual collections
        </p>
      </div>

      {/* Week Selector */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto">
        <button onClick={goToPreviousWeek} className="flex-shrink-0 p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        </button>
        <button
          onClick={goToCurrentWeek}
          className={`flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            weekOffset === 0 ? 'bg-primary-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          This Week
        </button>
        <button
          onClick={() => setShowCalendar(!showCalendar)}
          className="flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
        >
          <Calendar className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Pick Date</span>
        </button>
        <button onClick={goToNextWeek} className="flex-shrink-0 p-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        </button>
      </div>

      {/* Calendar Picker */}
      {showCalendar && (
        <div className="mb-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-600 p-4">
          <input
            type="date"
            onChange={(e) => handleDateSelect(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
          />
        </div>
      )}

      {/* Week Date Range */}
      <div className="bg-gradient-to-r from-primary-50 to-accent-50 dark:from-primary-900/20 dark:to-accent-900/20 rounded-xl p-3 mb-4 border border-primary-200 dark:border-primary-800">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {formatDate(weekRange.start, 'MMMM dd')} - {formatDate(weekRange.end, 'MMMM dd, yyyy')}
          {weekOffset !== 0 && (
            <span className="ml-2 text-xs px-2 py-0.5 bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 rounded-full">
              {weekOffset > 0 ? `+${weekOffset}` : weekOffset} week{Math.abs(weekOffset) > 1 ? 's' : ''}
            </span>
          )}
        </p>
      </div>

      {/* Filters */}
      {(areas.length > 0 || leaders.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-gray-400 flex-shrink-0 hidden sm:block" />
          <div className="relative w-full sm:w-auto sm:flex-1 sm:min-w-[150px] sm:max-w-[250px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search name or phone..."
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {areas.length > 0 && (
            <select
              value={filterArea}
              onChange={(e) => setFilterArea(e.target.value)}
              className="flex-1 sm:flex-none px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Areas</option>
              {areas.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
          {leaders.length > 0 && (
            <select
              value={filterLeader}
              onChange={(e) => setFilterLeader(e.target.value)}
              className="flex-1 sm:flex-none px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Leaders</option>
              {leaders.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          )}
          {(filterArea || filterLeader || searchTerm) && (
            <button
              onClick={() => { setFilterArea(''); setFilterLeader(''); setSearchTerm('') }}
              className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* This Week's Overview */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          This Week&apos;s Overview
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between sm:block">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 uppercase">Due</p>
                </div>
                <p className="text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400 tabular-nums">{formatCurrency(weekDue)}</p>
              </div>
              <div className="text-right sm:text-left sm:mt-1.5 space-y-0.5 text-[10px] text-blue-600 dark:text-blue-400">
                <p><span className="sm:hidden">Got: </span><span className="hidden sm:inline">Got from due: </span><span className="font-semibold tabular-nums">{formatCurrency(collectedFromDue)}</span></p>
                <p><span className="sm:hidden">Left: </span><span className="hidden sm:inline">Still there: </span><span className="font-semibold tabular-nums">{formatCurrency(weekPendingAmount)}</span></p>
                <p className="text-blue-500">{filteredWeekPayments.length} EMIs · {weekPendingBorrowers.length + weekPaidBorrowers.length} loans</p>
              </div>
            </div>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 border border-red-200 dark:border-red-800">
            <div className="flex items-center justify-between sm:block">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                  <p className="text-[10px] font-semibold text-red-700 dark:text-red-400 uppercase">Pending</p>
                </div>
                <p className="text-base sm:text-lg font-bold text-red-600 dark:text-red-400 tabular-nums">{formatCurrency(overdueRemaining)}</p>
              </div>
              <div className="text-right sm:text-left sm:mt-1.5 space-y-0.5 text-[10px] text-red-600 dark:text-red-400">
                <p><span className="sm:hidden">Got: </span><span className="hidden sm:inline">Got from pending: </span><span className="font-semibold tabular-nums">{formatCurrency(collectedFromPending)}</span></p>
                <p><span className="sm:hidden">Left: </span><span className="hidden sm:inline">Still there: </span><span className="font-semibold tabular-nums">{formatCurrency(overdueRemaining)}</span></p>
                <p className="text-red-500">{filteredOverduePayments.length} week{filteredOverduePayments.length !== 1 ? 's' : ''} unpaid</p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between sm:block">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Banknote className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                  <p className="text-[10px] font-semibold text-green-700 dark:text-green-400 uppercase">Collected</p>
                </div>
                <p className="text-base sm:text-lg font-bold text-green-600 dark:text-green-400 tabular-nums">{formatCurrency(actualCollectedTotal)}</p>
              </div>
              <div className="text-right sm:text-left">
                <p className="text-[10px] text-green-500">{filteredCollectedPayments.length} payments received</p>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile toggle for breakdown details */}
        {(collectedFromDue > 0 || collectedFromPending > 0 || collectedFromForeclosed > 0 || actualCollectedTotal > 0) && (
          <button
            onClick={() => setShowStatsBreakdown(!showStatsBreakdown)}
            className="sm:hidden mt-2 w-full py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors flex items-center justify-center gap-1"
          >
            {showStatsBreakdown ? 'Hide details' : 'Show details'}
            {showStatsBreakdown ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        )}

        {/* Collected breakdown: from due, from pending, from foreclosure */}
        {(collectedFromDue > 0 || collectedFromPending > 0 || collectedFromForeclosed > 0) && (
          <div className={`mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 ${showStatsBreakdown ? '' : 'hidden sm:block'}`}>
            <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Collected from</p>
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-blue-600 dark:text-blue-400">Due (this week):</span>
                <span className="text-sm font-bold text-blue-600 dark:text-blue-400 tabular-nums">{formatCurrency(collectedFromDue)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 dark:text-red-400">Pending (overdue):</span>
                <span className="text-sm font-bold text-red-600 dark:text-red-400 tabular-nums">{formatCurrency(collectedFromPending)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-600 dark:text-amber-400">Foreclosed (future weeks):</span>
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums">{formatCurrency(collectedFromForeclosed)}</span>
              </div>
            </div>
          </div>
        )}
        {/* Collected breakdown: Total paid first, then EMI, then extra or partial */}
        {actualCollectedTotal > 0 && (
          <div className={`mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 ${showStatsBreakdown ? '' : 'hidden sm:block'}`}>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total paid this week</span>
              <span className="text-lg font-bold text-green-600 dark:text-green-400 tabular-nums">{formatCurrency(actualCollectedTotal)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm pt-1 border-t border-gray-200 dark:border-gray-600">
              <span className="text-gray-600 dark:text-gray-400">EMI:</span>
              <span className="font-semibold text-gray-900 dark:text-white tabular-nums">{formatCurrency(collectedAsEmi)}</span>
              {(collectedAsExtra > 0 || collectedAsPartial > 0) && (
                <>
                  <span className="text-gray-400 dark:text-gray-500">·</span>
                  {collectedAsExtra > 0 && (
                    <>
                      <span className="text-green-600 dark:text-green-400">Extra:</span>
                      <span className="font-semibold text-green-600 dark:text-green-400 tabular-nums">+{formatCurrency(collectedAsExtra)}</span>
                    </>
                  )}
                  {collectedAsPartial > 0 && (
                    <>
                      <span className="text-blue-600 dark:text-blue-400">Partial:</span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400 tabular-nums">{formatCurrency(collectedAsPartial)}</span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab('week')}
          className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'week'
              ? 'border-primary-600 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Calendar className="w-4 h-4" />
          This Week
          <span className="ml-0.5 px-1.5 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
            {filteredWeekPayments.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'pending'
              ? 'border-red-600 text-red-600 dark:text-red-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <AlertCircle className="w-4 h-4" />
          Pending
          {overdueBorrowers.length > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 text-xs rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-semibold">
              {overdueBorrowers.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('collected')}
          className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'collected'
              ? 'border-green-600 text-green-600 dark:text-green-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Banknote className="w-4 h-4" />
          Collected
          {filteredCollectedPayments.length > 0 && (
            <span className="ml-0.5 px-1.5 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-semibold">
              <span className="sm:hidden">{filteredCollectedPayments.length}</span>
              <span className="hidden sm:inline">{formatCurrency(actualCollectedTotal)}</span>
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'week' && (
        <div>
          {/* This Week: due this week (unpaid/paid) + paid this week (e.g. foreclosed) */}
          {filteredWeekPayments.length === 0 && thisWeekPaidCombined.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">No payments this week</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">No payments are due and none collected for this period</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Unpaid section */}
              {weekPendingBorrowers.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-yellow-700 dark:text-yellow-400 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Unpaid ({weekPendingBorrowers.length})
                  </h3>
                  <div className="space-y-3">
                    {weekPendingBorrowers.map(b => renderBorrowerCard(b, 'week'))}
                  </div>
                </div>
              )}

              {/* Paid section - Due this week */}
              {weekDueAndPaidBorrowers.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Paid - This Week ({weekDueAndPaidBorrowers.length})
                  </h3>
                  <div className="space-y-3 opacity-75">
                    {weekDueAndPaidBorrowers.map(b => renderBorrowerCard(b, 'week'))}
                  </div>
                </div>
              )}

              {/* Collapsible section - Other weeks collected this week */}
              {otherWeeksCollectedBorrowers.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowOtherWeeksCollected(!showOtherWeeksCollected)}
                    className="w-full flex items-center justify-between text-sm font-semibold text-blue-700 dark:text-blue-400 mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Banknote className="w-4 h-4" />
                      <span>Other Weeks Collected This Week ({otherWeeksCollectedBorrowers.length})</span>
                    </div>
                    {showOtherWeeksCollected ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </button>
                  {showOtherWeeksCollected && (
                    <div className="space-y-3 opacity-75">
                      {otherWeeksCollectedBorrowers.map(b => renderBorrowerCard(b, 'week'))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'pending' && (
        <div>
          {/* Pending (unpaid past weeks) - tap each loan to expand week list */}
          {overdueBorrowers.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-12 h-12 text-green-300 dark:text-green-600 mx-auto mb-3" />
              <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">No pending payments</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">All past payments are up to date</p>
            </div>
          ) : (
            <div className="space-y-3">
              {overdueBorrowers.map(b => renderBorrowerCard(b, 'pending'))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'collected' && (
        <div>
          {/* Collected note */}
          <div className="bg-green-50 dark:bg-green-900/10 rounded-lg p-3 mb-4 border border-green-200 dark:border-green-800">
            <p className="text-xs text-green-700 dark:text-green-400">
              Actual money received this week (by payment date). Includes prepayments, current payments, and overdue collections.
            </p>
          </div>

          {/* Collected Borrower List */}
          {collectedBorrowers.length === 0 ? (
            <div className="text-center py-12">
              <Banknote className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <h3 className="text-base font-medium text-gray-900 dark:text-white mb-1">No collections this week</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">No payments were recorded during this period</p>
            </div>
          ) : (
            <div className="space-y-3">
              {collectedBorrowers.map(b => renderBorrowerCard(b, 'collected'))}
            </div>
          )}
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

      {/* Foreclosure Modal - same as Loan Details */}
      {showForeclosureModal && selectedLoan && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={() => { setShowForeclosureModal(false); setForeclosureError('') }}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <Ban className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Foreclose this loan?
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {selectedLoan.borrower_name} · Loan {selectedLoan.loan_number ?? 1}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  This will close all pending weeks and mark the loan as foreclosed. This cannot be undone.
                </p>
              </div>
            </div>

            {(() => {
              const unpaidPayments = selectedLoan.payments.filter(p => p.status !== 'paid')
              const pendingAmount = unpaidPayments.reduce((sum, p) => sum + (parseFloat(p.amount_due || 0) - parseFloat(p.amount_paid || 0)), 0)
              const pendingWeeksCount = unpaidPayments.length
              return pendingWeeksCount > 0 ? (
                <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Pending amount (will be closed)</p>
                  <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 tabular-nums mt-1">
                    {formatCurrency(pendingAmount)}
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    {pendingWeeksCount} week{pendingWeeksCount !== 1 ? 's' : ''} will be closed
                  </p>
                </div>
              ) : null
            })()}

            <form onSubmit={handleConfirmForeclosure} className="space-y-4">
              <div>
                <label htmlFor="foreclosure-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Foreclosure date
                </label>
                <input
                  id="foreclosure-date"
                  type="date"
                  value={foreclosureDate || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`}
                  onChange={(e) => setForeclosureDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Closed weeks will appear in Collections for this date
                </p>
              </div>
              <div>
                <label htmlFor="foreclosure-amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Settlement amount (optional)
                </label>
                <input
                  id="foreclosure-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={foreclosureAmount}
                  onChange={(e) => setForeclosureAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              {foreclosureError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {foreclosureError}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowForeclosureModal(false); setForeclosureError(''); setSelectedLoan(null) }}
                  className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={foreclosureLoading}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {foreclosureLoading ? 'Foreclosing...' : 'Close all weeks & foreclose'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
