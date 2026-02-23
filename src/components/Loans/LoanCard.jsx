import { Calendar, TrendingUp, IndianRupeeIcon, Clock, CheckCircle, XCircle } from 'lucide-react'
import { formatCurrency } from '../../utils/loanCalculations'
import { formatDate } from '../../utils/dateUtils'

export default function LoanCard({ loan, onViewDetails }) {
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

  // Calculate progress based on money collected, not weeks paid
  const totalAmountPaid = loan.payments?.reduce((sum, p) => sum + parseFloat(p.amount_paid || 0), 0) || loan.total_paid || 0
  const progress = loan.total_amount > 0 ? (totalAmountPaid / loan.total_amount) * 100 : 0

  return (
    <div
      onClick={() => onViewDetails(loan)}
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-all border border-gray-200 dark:border-gray-700 p-5 cursor-pointer group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {loan.borrower_name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {loan.borrower_area}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(loan.status)}`}>
          {getStatusIcon(loan.status)}
          {loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}
          {loan.status === 'foreclosed' && loan.foreclosure_date && (
            <span className="opacity-90"> · {formatDate(loan.foreclosure_date)}</span>
          )}
        </span>
      </div>

      {/* Amount Info */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Principal</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white tabular-nums">
            {formatCurrency(loan.principal_amount)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Amount</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white tabular-nums">
            {formatCurrency(loan.total_amount)}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-2">
          <span>Progress</span>
          <span className="font-medium">{progress.toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-accent-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Collected</p>
          <p className="text-sm font-semibold text-green-600 dark:text-green-400 tabular-nums">
            {formatCurrency(totalAmountPaid)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Remaining</p>
          <p className="text-sm font-semibold text-orange-600 dark:text-orange-400 tabular-nums">
            {formatCurrency(loan.total_amount - totalAmountPaid)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Weekly</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
            {formatCurrency(loan.weekly_amount)}
          </p>
        </div>
      </div>

      {/* Hover hint */}
      <div className="mt-3 text-xs text-center text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
        Click to view details
      </div>
    </div>
  )
}
