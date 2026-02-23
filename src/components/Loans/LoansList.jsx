import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Plus, TrendingUp, Loader2, Users } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { getLoans, createLoan } from '../../services/loanService'
import { getBorrowers } from '../../services/borrowerService'
import { getSettings } from '../../services/settingsService'
import { useToast } from '../../hooks/useToast'
import { ToastContainer } from '../Common/Toast'
import LoanCard from './LoanCard'
import AddLoanModal from './AddLoanModal'
import LoanDetails from './LoanDetails'
import MassRecordPastPaymentsModal from './MassRecordPastPaymentsModal'

const LoansList = forwardRef((props, ref) => {
  const { user } = useAuth()

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    openAddModal: () => setShowAddModal(true)
  }))
  const { toasts, success, error, hideToast } = useToast()

  const [loans, setLoans] = useState([])
  const [borrowers, setBorrowers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedLoanId, setSelectedLoanId] = useState(null)
  const [massRecordLoanId, setMassRecordLoanId] = useState(null)
  const [allowMassRecordPast, setAllowMassRecordPast] = useState(false)
  const [statusFilter, setStatusFilter] = useState('active') // 'all', 'active', 'closed', 'foreclosed' - default to active
  const [areaFilter, setAreaFilter] = useState('all')
  const [leaderFilter, setLeaderFilter] = useState('all')

  useEffect(() => {
    if (user) {
      loadData()
      getSettings(user.id).then(({ data }) => {
        setAllowMassRecordPast(data?.allow_mass_record_past === true)
      })
    }
  }, [user])

  const loadData = async () => {
    setLoading(true)

    // Load loans and borrowers in parallel
    const [loansResult, borrowersResult] = await Promise.all([
      getLoans(user.id),
      getBorrowers(user.id)
    ])

    if (loansResult.error) {
      error('Failed to load loans')
      console.error(loansResult.error)
    } else {
      setLoans(loansResult.data || [])
    }

    if (borrowersResult.error) {
      error('Failed to load borrowers')
      console.error(borrowersResult.error)
    } else {
      setBorrowers(borrowersResult.data || [])
    }

    setLoading(false)
  }

  const handleSaveLoan = async (loanData) => {
    try {
      const { data: newLoan, error: err } = await createLoan(user.id, loanData)
      if (err) throw err

      success('Loan created successfully! Payment schedule generated.')
      await loadData()
      setShowAddModal(false)

      // If setting enabled and loan started in the past, offer to mass-record past weeks
      if (allowMassRecordPast && newLoan?.id) {
        const firstDue = newLoan.first_payment_date || newLoan.start_date
        if (firstDue && new Date(firstDue) < new Date()) {
          setMassRecordLoanId(newLoan.id)
        }
      }
    } catch (err) {
      error('Failed to create loan')
      console.error(err)
    }
  }

  const handleViewDetails = (loan) => {
    setSelectedLoanId(loan.loan_id)
  }

  const handleCloseLoanDetails = () => {
    setSelectedLoanId(null)
  }

  const handleLoanUpdated = () => {
    loadData()
  }

  // Get unique areas and leader tags
  const uniqueAreas = [...new Set(borrowers.map(b => b.area))].sort()
  const uniqueLeaders = [...new Set(borrowers.map(b => b.leader_tag).filter(Boolean))].sort()

  // Filter loans
  const filteredLoans = loans.filter(loan => {
    if (statusFilter !== 'all' && loan.status !== statusFilter) return false
    if (areaFilter !== 'all' && loan.borrower_area !== areaFilter) return false
    if (leaderFilter !== 'all' && loan.borrower_leader_tag !== leaderFilter) return false
    return true
  })

  // Stats
  const activeLoans = loans.filter(l => l.status === 'active').length

  // This week's loans (based on start_date)
  const today = new Date()
  const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay()) // Sunday
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const thisWeekLoans = loans.filter(l => {
    const loanDate = new Date(l.start_date)
    return loanDate >= weekStart && loanDate < weekEnd
  })

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
              <TrendingUp className="w-8 h-8 text-primary-600" />
              Loans
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage loans and track repayments
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            disabled={borrowers.length === 0}
            className="hidden md:flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 text-white font-medium rounded-lg transition-all shadow-lg shadow-primary-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            title={borrowers.length === 0 ? 'Add borrowers first' : 'Create new loan'}
          >
            <Plus className="w-5 h-5" />
            Create Loan
          </button>
        </div>

        {/* Stats Cards */}
        {loans.length > 0 && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Active Loans</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{activeLoans}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">This Week</p>
              <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{thisWeekLoans.length}</p>
            </div>
          </div>
        )}

        {/* This Week's Loans Highlight */}
        {thisWeekLoans.length > 0 && statusFilter === 'all' && (
          <div className="bg-gradient-to-r from-primary-50 to-accent-50 dark:from-primary-900/20 dark:to-accent-900/20 rounded-xl p-4 mb-6 border border-primary-200 dark:border-primary-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                  📅 This Week's New Loans
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {thisWeekLoans.length} loan{thisWeekLoans.length !== 1 ? 's' : ''} disbursed this week
                </p>
              </div>
              <button
                onClick={() => setStatusFilter('active')}
                className="px-3 py-1.5 text-xs font-medium text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
              >
                View All
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        {loans.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
              <option value="foreclosed">Foreclosed</option>
            </select>

            {/* Area Filter */}
            {uniqueAreas.length > 0 && (
              <select
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              >
                <option value="all">All Areas</option>
                {uniqueAreas.map(area => (
                  <option key={area} value={area}>{area}</option>
                ))}
              </select>
            )}

            {/* Leader Filter */}
            {uniqueLeaders.length > 0 && (
              <select
                value={leaderFilter}
                onChange={(e) => setLeaderFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              >
                <option value="all">All Leaders</option>
                {uniqueLeaders.map(leader => (
                  <option key={leader} value={leader}>{leader}</option>
                ))}
              </select>
            )}

            {/* Clear Filters */}
            {(statusFilter !== 'all' || areaFilter !== 'all' || leaderFilter !== 'all') && (
              <button
                onClick={() => {
                  setStatusFilter('all')
                  setAreaFilter('all')
                  setLeaderFilter('all')
                }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Loans Grid */}
      {filteredLoans.length === 0 && loans.length > 0 ? (
        <div className="text-center py-16">
          <TrendingUp className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No loans match your filters
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Try adjusting your filter criteria
          </p>
        </div>
      ) : loans.length === 0 ? (
        <div className="text-center py-16">
          {borrowers.length === 0 ? (
            <>
              <Users className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No borrowers yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Add borrowers first before creating loans
              </p>
            </>
          ) : (
            <>
              <TrendingUp className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No loans yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Create your first loan to start tracking repayments
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700 text-white font-medium rounded-lg transition-all inline-flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Create Your First Loan
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLoans.map(loan => (
            <LoanCard
              key={loan.loan_id}
              loan={loan}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      )}

      {/* Add Loan Modal */}
      <AddLoanModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleSaveLoan}
        borrowers={borrowers}
      />

      {/* Mass record past payments (after creating a backdated loan) */}
      {massRecordLoanId && (
        <MassRecordPastPaymentsModal
          loanId={massRecordLoanId}
          onClose={() => setMassRecordLoanId(null)}
          onDone={() => {
            loadData()
            setSelectedLoanId(massRecordLoanId)
          }}
        />
      )}

      {/* Loan Details Modal */}
      {selectedLoanId && (
        <LoanDetails
          loanId={selectedLoanId}
          onClose={handleCloseLoanDetails}
          onUpdate={handleLoanUpdated}
        />
      )}

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onHide={hideToast} />
    </div>
  )
})

LoansList.displayName = 'LoansList'

export default LoansList
