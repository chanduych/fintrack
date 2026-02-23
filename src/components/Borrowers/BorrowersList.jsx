import { useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react'
import { Plus, Search, Users, Loader2, ChevronDown, ChevronRight, Banknote } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { getBorrowers, createBorrower, updateBorrower, deleteBorrower } from '../../services/borrowerService'
import { getActiveLoans } from '../../services/loanService'
import { getPaymentsByWeek, getOverduePayments_all } from '../../services/paymentService'
import { formatCurrency } from '../../utils/loanCalculations'
import { useToast } from '../../hooks/useToast'
import { ToastContainer } from '../Common/Toast'
import BorrowerCard from './BorrowerCard'
import BorrowerDetails from './BorrowerDetails'
import AddBorrowerModal from './AddBorrowerModal'
import ConfirmationModal from '../Common/ConfirmationModal'

const BorrowersList = forwardRef((props, ref) => {
  const { user } = useAuth()

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    openAddModal: handleAddNew
  }))
  const { toasts, success, error, hideToast } = useToast()

  const [borrowers, setBorrowers] = useState([])
  const [filteredBorrowers, setFilteredBorrowers] = useState([])
  const [weekPayments, setWeekPayments] = useState([]) // payments due this week
  const [overduePayments, setOverduePayments] = useState([]) // unpaid payments with due_date in the past
  const [activeLoans, setActiveLoans] = useState([]) // all active (open) loans for drill-down
  const [expandedLeader, setExpandedLeader] = useState(null)
  const [showOverdue, setShowOverdue] = useState(false) // toggle to show overdue at group and per-loan
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('recent') // 'recent', 'name', 'area', 'leader'
  const [areaFilter, setAreaFilter] = useState('all')
  const [leaderFilter, setLeaderFilter] = useState('all')

  // This week range (Sunday–Saturday, same as WeeklyPayments)
  const getWeekRange = () => {
    const today = new Date()
    const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay())
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    return { start: weekStart, end: weekEnd }
  }

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingBorrower, setEditingBorrower] = useState(null)
  const [deletingBorrower, setDeletingBorrower] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [selectedBorrower, setSelectedBorrower] = useState(null)

  // Load borrowers and payments due this week (for leader collection totals)
  useEffect(() => {
    if (user) {
      loadBorrowers()
      loadLeaderWeekData()
    }
  }, [user])

  const loadLeaderWeekData = async () => {
    if (!user) return
    const { start, end } = getWeekRange()
    const [weekRes, overdueRes, loansRes] = await Promise.all([
      getPaymentsByWeek(user.id, start, end),
      getOverduePayments_all(user.id, new Date()),
      getActiveLoans(user.id)
    ])
    setWeekPayments(weekRes.data || [])
    setOverduePayments(overdueRes.data || [])
    setActiveLoans(loansRes.data || [])
  }

  // Filter and sort borrowers
  useEffect(() => {
    let filtered = [...borrowers]

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(b =>
        b.name.toLowerCase().includes(term) ||
        b.area.toLowerCase().includes(term) ||
        b.phone.includes(term) ||
        (b.leader_tag && b.leader_tag.toLowerCase().includes(term))
      )
    }

    // Area filter
    if (areaFilter !== 'all') {
      filtered = filtered.filter(b => b.area === areaFilter)
    }

    // Leader filter
    if (leaderFilter !== 'all') {
      filtered = filtered.filter(b => b.leader_tag === leaderFilter)
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'area':
          return a.area.localeCompare(b.area)
        case 'leader':
          return (a.leader_tag || '').localeCompare(b.leader_tag || '')
        case 'recent':
        default:
          return new Date(b.created_at) - new Date(a.created_at)
      }
    })

    setFilteredBorrowers(filtered)
  }, [borrowers, searchTerm, sortBy, areaFilter, leaderFilter])

  // Get unique areas and leader tags
  const uniqueAreas = [...new Set(borrowers.map(b => b.area))].sort()
  const uniqueLeaders = [...new Set(borrowers.map(b => b.leader_tag).filter(Boolean))].sort()

  // Total at top = sum of what's shown in dropdown per loan: "due this week" OR "EMI" (one per loan).
  const leaderWeekStats = useMemo(() => {
    const dueThisWeekByLoanId = {}
    weekPayments.forEach(p => {
      const key = p.loan_id
      if (!dueThisWeekByLoanId[key]) dueThisWeekByLoanId[key] = 0
      dueThisWeekByLoanId[key] += parseFloat(p.amount_due || 0)
    })
    const overdueWeeksByLeader = {}
    overduePayments.forEach(p => {
      const tag = p.borrower_leader_tag
      if (!tag) return
      if (overdueWeeksByLeader[tag] === undefined) overdueWeeksByLeader[tag] = 0
      overdueWeeksByLeader[tag] += 1
    })
    const totalByLeader = {}
    const dueThisWeekByLeader = {}
    activeLoans.forEach(loan => {
      const tag = loan.borrower_leader_tag
      if (!tag) return
      if (!totalByLeader[tag]) totalByLeader[tag] = 0
      if (!dueThisWeekByLeader[tag]) dueThisWeekByLeader[tag] = 0
      const dueThisWeek = dueThisWeekByLoanId[loan.loan_id] ?? 0
      const emi = parseFloat(loan.weekly_amount || 0)
      const value = dueThisWeek > 0 ? dueThisWeek : emi
      totalByLeader[tag] += value
      dueThisWeekByLeader[tag] += dueThisWeek
    })
    return activeLoans
      .reduce((acc, loan) => {
        const tag = loan.borrower_leader_tag
        if (!tag || acc.some(s => s.leader === tag)) return acc
        acc.push({
          leader: tag,
          totalDueThisWeek: dueThisWeekByLeader[tag] ?? 0,
          overdueWeeks: overdueWeeksByLeader[tag] ?? 0,
          total: totalByLeader[tag] ?? 0
        })
        return acc
      }, [])
      .sort((a, b) => a.leader.localeCompare(b.leader))
  }, [activeLoans, weekPayments, overduePayments])

  // Drill-down: every active loan with week number, this week amount, overdue weeks count, EMI amount (no total overdue sum)
  const leaderDrillDown = useMemo(() => {
    const byLeader = {}
    activeLoans.forEach(loan => {
      const tag = loan.borrower_leader_tag
      if (!tag) return
      if (!byLeader[tag]) byLeader[tag] = {}
      const bid = loan.borrower_id
      const name = loan.borrower_name
      if (!byLeader[tag][bid]) byLeader[tag][bid] = { borrower_name: name, loans: {} }
      byLeader[tag][bid].loans[loan.loan_id] = {
        loan_number: loan.loan_number,
        emiAmount: parseFloat(loan.weekly_amount || 0),
        amountDueThisWeek: 0,
        weekNumber: null,
        overdueWeeks: 0
      }
    })
    weekPayments.forEach(p => {
      const tag = p.borrower_leader_tag
      if (!tag || !byLeader[tag]) return
      const bid = p.borrower_id
      if (!byLeader[tag][bid]?.loans[p.loan_id]) return
      const loanEntry = byLeader[tag][bid].loans[p.loan_id]
      loanEntry.amountDueThisWeek += parseFloat(p.amount_due || 0)
      if (p.week_number != null && loanEntry.weekNumber == null) loanEntry.weekNumber = p.week_number
    })
    overduePayments.forEach(p => {
      const tag = p.borrower_leader_tag
      if (!tag || !byLeader[tag]) return
      const bid = p.borrower_id
      if (!byLeader[tag][bid]?.loans[p.loan_id]) return
      byLeader[tag][bid].loans[p.loan_id].overdueWeeks += 1
    })
    return byLeader
  }, [activeLoans, weekPayments, overduePayments])

  const loadBorrowers = async () => {
    setLoading(true)
    const { data, error: err } = await getBorrowers(user.id)

    if (err) {
      error('Failed to load borrowers')
      console.error(err)
    } else {
      setBorrowers(data || [])
    }

    setLoading(false)
  }

  const handleSaveBorrower = async (formData) => {
    try {
      if (editingBorrower) {
        // Update existing
        const { error: err } = await updateBorrower(editingBorrower.id, formData)
        if (err) throw err
        success('Borrower updated successfully')
      } else {
        // Create new
        const { error: err } = await createBorrower(user.id, formData)
        if (err) throw err
        success('Borrower added successfully')
      }

      await loadBorrowers()
      await loadLeaderWeekData()
      setShowAddModal(false)
      setEditingBorrower(null)
    } catch (err) {
      error(editingBorrower ? 'Failed to update borrower' : 'Failed to add borrower')
      console.error(err)
    }
  }

  const handleEdit = (borrower) => {
    setEditingBorrower(borrower)
    setShowAddModal(true)
  }

  const handleDeleteConfirm = async () => {
    setDeleteLoading(true)
    try {
      const { error: err } = await deleteBorrower(deletingBorrower.id)
      if (err) throw err

      success('Borrower deleted successfully')
      await loadBorrowers()
      setDeletingBorrower(null)
    } catch (err) {
      error('Failed to delete borrower')
      console.error(err)
    }
    setDeleteLoading(false)
  }

  const handleAddNew = () => {
    setEditingBorrower(null)
    setShowAddModal(true)
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
      <ToastContainer toasts={toasts} onClose={hideToast} />

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Users className="w-8 h-8 text-primary-600" />
              Borrowers
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage your customers and their information
            </p>
          </div>
          <button
            onClick={handleAddNew}
            className="hidden md:flex px-4 py-3 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 text-white font-medium rounded-lg transition-all items-center gap-2 shadow-lg shadow-primary-500/30"
          >
            <Plus className="w-5 h-5" />
            Add Borrower
          </button>
        </div>

        {/* Weekly collection total by leader — click to see each user / each loan amount for this week */}
        {leaderWeekStats.length > 0 && (
          <div className="mb-6">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Collection this week (by leader) — tap to see each user and loan amount
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOverdue}
                  onChange={(e) => setShowOverdue(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">Show overdue</span>
              </label>
            </div>
            <div className="space-y-2">
              {leaderWeekStats.map(({ leader, totalDueThisWeek, overdueWeeks, total }) => {
                const isExpanded = expandedLeader === leader
                const drill = leaderDrillDown[leader]
                const borrowersList = drill ? Object.entries(drill) : []
                return (
                  <div
                    key={leader}
                    className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedLeader(isExpanded ? null : leader)}
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400 shrink-0" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-500 dark:text-gray-400 shrink-0" />
                        )}
                        <Banknote className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0" />
                        <span className="font-semibold text-gray-900 dark:text-white">{leader}</span>
                      </div>
                      <span className="font-bold text-primary-600 dark:text-primary-400 tabular-nums">
                        {formatCurrency(total)}
                      </span>
                    </button>
                    {!isExpanded && (totalDueThisWeek > 0 || (showOverdue && overdueWeeks > 0)) && (
                      <div className="px-3 pb-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                        {totalDueThisWeek > 0 && <span>Due this week: {formatCurrency(totalDueThisWeek)}</span>}
                        {showOverdue && overdueWeeks > 0 && <span className="text-amber-600 dark:text-amber-400">{overdueWeeks} week{overdueWeeks !== 1 ? 's' : ''} overdue</span>}
                      </div>
                    )}
                    {isExpanded && borrowersList.length > 0 && (
                      <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 p-3 space-y-3">
                        {borrowersList.map(([borrowerId, { borrower_name, loans }]) => (
                          <div key={borrowerId} className="space-y-1.5">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{borrower_name}</p>
                            <ul className="pl-4 space-y-1">
                              {Object.entries(loans).map(([loanId, { loan_number, amountDueThisWeek, weekNumber, overdueWeeks: loanOverdueWeeks, emiAmount }]) => {
                                const hasThisWeek = amountDueThisWeek > 0
                                const hasOverdue = loanOverdueWeeks > 0
                                const showEmiOnly = !hasThisWeek && (hasOverdue || emiAmount > 0)
                                return (
                                  <li key={loanId} className="text-sm text-gray-600 dark:text-gray-400 flex justify-between items-baseline gap-2 flex-wrap">
                                    <span>Loan #{loan_number ?? loanId?.slice(0, 8) ?? '—'}</span>
                                    <span className="font-semibold tabular-nums text-gray-900 dark:text-white flex flex-col items-end gap-0.5">
                                      {hasThisWeek && (
                                        <span>
                                          {weekNumber != null && <span className="text-gray-500 dark:text-gray-400">Week {weekNumber} — </span>}
                                          {formatCurrency(amountDueThisWeek)} this week
                                        </span>
                                      )}
                                      {showOverdue && hasOverdue && (
                                        <span className="text-amber-600 dark:text-amber-400">
                                          {loanOverdueWeeks} week{loanOverdueWeeks !== 1 ? 's' : ''} overdue · EMI {formatCurrency(emiAmount)}
                                        </span>
                                      )}
                                      {showEmiOnly && !(showOverdue && hasOverdue) && (
                                        <span>EMI {formatCurrency(emiAmount)}</span>
                                      )}
                                      {!hasThisWeek && !hasOverdue && emiAmount <= 0 && <span className="text-gray-400">—</span>}
                                    </span>
                                  </li>
                                )
                              })}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, area, phone, or tag..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400"
              />
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="recent">Recent First</option>
              <option value="name">Name (A-Z)</option>
              <option value="area">Area (A-Z)</option>
              <option value="leader">Leader Tag</option>
            </select>
          </div>

          {/* Filter Chips */}
          {borrowers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {/* Area Filter */}
              {uniqueAreas.length > 1 && (
                <select
                  value={areaFilter}
                  onChange={(e) => setAreaFilter(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="all">All Areas</option>
                  {uniqueAreas.map(area => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
              )}

              {/* Leader Filter */}
              {uniqueLeaders.length > 1 && (
                <select
                  value={leaderFilter}
                  onChange={(e) => setLeaderFilter(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="all">All Leaders</option>
                  {uniqueLeaders.map(leader => (
                    <option key={leader} value={leader}>{leader}</option>
                  ))}
                </select>
              )}

              {/* Clear Filters */}
              {(areaFilter !== 'all' || leaderFilter !== 'all') && (
                <button
                  onClick={() => {
                    setAreaFilter('all')
                    setLeaderFilter('all')
                  }}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Borrowers Grid */}
      {filteredBorrowers.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {searchTerm ? 'No borrowers found' : 'No borrowers yet'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {searchTerm
              ? 'Try adjusting your search term'
              : 'Get started by adding your first borrower'}
          </p>
          {!searchTerm && (
            <button
              onClick={handleAddNew}
              className="px-6 py-3 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 text-white font-medium rounded-lg transition-all inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Your First Borrower
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBorrowers.map(borrower => (
            <BorrowerCard
              key={borrower.id}
              borrower={borrower}
              onEdit={handleEdit}
              onDelete={setDeletingBorrower}
              onSelect={setSelectedBorrower}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <AddBorrowerModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          setEditingBorrower(null)
        }}
        onSave={handleSaveBorrower}
        editBorrower={editingBorrower}
      />

      <ConfirmationModal
        isOpen={!!deletingBorrower}
        onClose={() => setDeletingBorrower(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Borrower"
        message={`Are you sure you want to delete ${deletingBorrower?.name}? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={deleteLoading}
      />

      {selectedBorrower && (
        <BorrowerDetails
          borrower={selectedBorrower}
          onClose={() => setSelectedBorrower(null)}
          onLoanUpdated={loadBorrowers}
        />
      )}

    </div>
  )
})

BorrowersList.displayName = 'BorrowersList'

export default BorrowersList
