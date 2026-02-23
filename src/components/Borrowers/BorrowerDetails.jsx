import { useState, useEffect } from 'react'
import { X, TrendingUp, CheckCircle, XCircle, Clock, Loader2, ExternalLink } from 'lucide-react'
import { getLoansByBorrower } from '../../services/loanService'
import { formatCurrency } from '../../utils/loanCalculations'
import { formatDate } from '../../utils/dateUtils'
import LoanDetails from '../Loans/LoanDetails'

export default function BorrowerDetails({ borrower, onClose, onLoanUpdated }) {
  const [loans, setLoans] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedLoanId, setSelectedLoanId] = useState(null)

  useEffect(() => {
    if (borrower?.id) {
      setLoading(true)
      getLoansByBorrower(borrower.id).then(({ data, error }) => {
        if (!error) setLoans(data || [])
        setLoading(false)
      })
    }
  }, [borrower?.id])

  const openLoans = loans.filter(l => l.status === 'active')
  const closedLoans = loans.filter(l => l.status === 'closed' || l.status === 'foreclosed')

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
      case 'closed':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
      case 'foreclosed':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'closed':
        return <CheckCircle className="w-4 h-4" />
      case 'foreclosed':
        return <XCircle className="w-4 h-4" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  const handleLoanUpdated = () => {
    onLoanUpdated?.()
    if (borrower?.id) {
      getLoansByBorrower(borrower.id).then(({ data, error }) => {
        if (!error) setLoans(data || [])
      })
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-semibold text-lg">
                {borrower?.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{borrower?.name}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{borrower?.area} {borrower?.phone && ` · ${borrower.phone}`}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Open loans */}
                <section>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                    Open loans ({openLoans.length})
                  </h3>
                  {openLoans.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 py-2">No active loans</p>
                  ) : (
                    <ul className="space-y-2">
                      {openLoans.map(loan => (
                        <li
                          key={loan.loan_id}
                          className="flex items-center justify-between gap-4 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                                {formatCurrency(loan.principal_amount)}
                              </span>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(loan.status)}`}>
                                {getStatusIcon(loan.status)}
                                {loan.status}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              Started {formatDate(loan.start_date)} · {formatCurrency(loan.total_paid || 0)} / {formatCurrency(loan.total_amount)}
                            </p>
                          </div>
                          <button
                            onClick={() => setSelectedLoanId(loan.loan_id)}
                            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                          >
                            View
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Closed loans */}
                <section>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Closed loans ({closedLoans.length})
                  </h3>
                  {closedLoans.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 py-2">No closed or foreclosed loans</p>
                  ) : (
                    <ul className="space-y-2">
                      {closedLoans.map(loan => (
                        <li
                          key={loan.loan_id}
                          className="flex items-center justify-between gap-4 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-gray-900 dark:text-white tabular-nums">
                                {formatCurrency(loan.principal_amount)}
                              </span>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(loan.status)}`}>
                                {getStatusIcon(loan.status)}
                                {loan.status}
                              </span>
                              {loan.status === 'foreclosed' && loan.foreclosure_date && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  · {formatDate(loan.foreclosure_date)}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {formatCurrency(loan.total_paid || 0)} / {formatCurrency(loan.total_amount)} repaid
                            </p>
                          </div>
                          <button
                            onClick={() => setSelectedLoanId(loan.loan_id)}
                            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                          >
                            View
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Loan details modal (stacked on top) */}
      {selectedLoanId && (
        <LoanDetails
          loanId={selectedLoanId}
          onClose={() => setSelectedLoanId(null)}
          onUpdate={handleLoanUpdated}
        />
      )}
    </>
  )
}
