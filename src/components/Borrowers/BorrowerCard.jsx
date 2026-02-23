import { MapPin, Phone, Tag, Edit, Trash2, User, TrendingUp, CheckCircle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { getLoansByBorrower } from '../../services/loanService'

export default function BorrowerCard({ borrower, onEdit, onDelete, onSelect }) {
  const [loanStats, setLoanStats] = useState({ active: 0, closed: 0 })

  useEffect(() => {
    loadLoanStats()
  }, [borrower.id])

  const loadLoanStats = async () => {
    const { data } = await getLoansByBorrower(borrower.id)
    if (data) {
      const active = data.filter(l => l.status === 'active').length
      const closed = data.filter(l => l.status === 'closed' || l.status === 'foreclosed').length
      setLoanStats({ active, closed })
    }
  }
  return (
    <div
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect ? () => onSelect(borrower) : undefined}
      onKeyDown={onSelect ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(borrower) } } : undefined}
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-200 dark:border-gray-700 p-5 group ${onSelect ? 'cursor-pointer' : ''}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-semibold text-lg">
            {borrower.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {borrower.name}
            </h3>
            {borrower.leader_tag && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                <Tag className="w-3 h-3" />
                {borrower.leader_tag}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onEdit(borrower)}
            className="p-2 text-gray-600 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
            title="Edit borrower"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(borrower)}
            className="p-2 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Delete borrower"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <MapPin className="w-4 h-4 text-gray-400" />
          <span>{borrower.area}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <Phone className="w-4 h-4 text-gray-400" />
          <span>{borrower.phone}</span>
        </div>
      </div>

      {/* Loan Stats */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <span className="text-gray-600 dark:text-gray-400">
                <span className="font-semibold text-blue-600 dark:text-blue-400">{loanStats.active}</span> active
              </span>
            </div>
            {loanStats.closed > 0 && (
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-gray-600 dark:text-gray-400">
                  <span className="font-semibold text-green-600 dark:text-green-400">{loanStats.closed}</span> closed
                </span>
              </div>
            )}
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            borrower.is_active
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}>
            {borrower.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>
    </div>
  )
}
