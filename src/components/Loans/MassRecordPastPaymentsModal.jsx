import { useState, useEffect } from 'react'
import { X, Calendar, Loader2, CheckCircle } from 'lucide-react'
import { getPaymentsByLoan } from '../../services/paymentService'
import { recordBulkPastPayments } from '../../services/paymentService'
import { formatCurrency } from '../../utils/loanCalculations'
import { formatDate } from '../../utils/dateUtils'

const toDateStr = (d) => {
  if (typeof d === 'string') return d.split('T')[0]
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function MassRecordPastPaymentsModal({ loanId, borrowerName: borrowerNameProp, onClose, onDone }) {
  const [pastUnpaid, setPastUnpaid] = useState([])
  const [borrowerName, setBorrowerName] = useState(borrowerNameProp || '')
  const [loading, setLoading] = useState(true)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (loanId) loadPayments()
  }, [loanId])

  const loadPayments = async () => {
    setLoading(true)
    setError('')
    const { data, error: err } = await getPaymentsByLoan(loanId)
    setLoading(false)
    if (err) {
      setError('Failed to load payments')
      return
    }
    const list = data || []
    if (list.length > 0 && list[0].loan?.borrower?.name) {
      setBorrowerName(list[0].loan.borrower.name)
    }
    const todayStr = toDateStr(new Date())
    const past = list.filter(p => {
      if (p.status === 'paid') return false
      const dueStr = typeof p.due_date === 'string' ? p.due_date.split('T')[0] : toDateStr(p.due_date)
      return dueStr < todayStr
    })
    setPastUnpaid(past)
  }

  const handleRecordAll = async () => {
    if (pastUnpaid.length === 0) return
    setRecording(true)
    setError('')
    const { data, error: err } = await recordBulkPastPayments(loanId)
    setRecording(false)
    if (err) {
      setError(err.message || 'Failed to record payments')
      return
    }
    onDone?.()
    onClose()
  }

  const totalAmount = pastUnpaid.reduce((s, p) => s + parseFloat(p.amount_due || 0), 0)

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-t-3xl md:rounded-2xl shadow-2xl w-full md:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Record past weeks
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={recording}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {borrowerName && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Loan for <span className="font-medium text-gray-900 dark:text-white">{borrowerName}</span>
            </p>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
            </div>
          ) : pastUnpaid.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-700 dark:text-gray-300 font-medium">No past weeks to record</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                All due dates are in the future or already paid.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                This loan has <strong>{pastUnpaid.length}</strong> week{pastUnpaid.length !== 1 ? 's' : ''} with due dates in the past.
                Record all as paid using their <strong>actual due dates</strong>.
              </p>

              <div className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700 max-h-48 overflow-y-auto mb-4">
                {pastUnpaid.map((p, i) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-3 py-2 text-sm"
                  >
                    <span className="text-gray-600 dark:text-gray-400">
                      <Calendar className="w-4 h-4 inline mr-2 text-gray-400" />
                      Week {p.week_number} · {formatDate(p.due_date)}
                    </span>
                    <span className="font-medium tabular-nums text-gray-900 dark:text-white">
                      {formatCurrency(p.amount_due)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between py-2 border-t border-gray-200 dark:border-gray-700">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total</span>
                <span className="font-bold tabular-nums text-gray-900 dark:text-white">
                  {formatCurrency(totalAmount)}
                </span>
              </div>

              {error && (
                <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={recording}
                  className="flex-1 py-3 px-4 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRecordAll}
                  disabled={recording}
                  className="flex-1 py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {recording ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Recording…
                    </>
                  ) : (
                    <>Record all {pastUnpaid.length} week{pastUnpaid.length !== 1 ? 's' : ''}</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
