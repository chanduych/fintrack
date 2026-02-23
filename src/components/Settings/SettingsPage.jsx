import { useState, useEffect } from 'react'
import {
  Settings as SettingsIcon, Save, RotateCcw, Download, Upload,
  Moon, Sun, User, Calendar, IndianRupeeIcon, AlertCircle, CheckCircle, Loader2, FileText,
  Database, Clock, Trash2
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { getSettings, updateSettings, resetSettings } from '../../services/settingsService'
import {
  exportAllDataJSON,
  exportBorrowersCSV,
  exportLoansCSV,
  exportPaymentsCSV
} from '../../services/exportService'
import {
  parseCSV,
  validateBorrowers,
  checkDuplicateBorrowers,
  importBorrowers,
  importBackupJSON
} from '../../services/importService'
import {
  createAutoBackup,
  listBackups,
  downloadBackupFile,
  cleanupOldBackups,
  getLastBackup
} from '../../services/backupService'

export default function SettingsPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('general')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  // Settings state
  const [defaultWeeks, setDefaultWeeks] = useState(24)
  const [weeklyRate, setWeeklyRate] = useState(0.05)
  const [collectionDay, setCollectionDay] = useState(0)
  const [allowMassRecordPast, setAllowMassRecordPast] = useState(false)

  // Dark mode
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('darkMode') === 'true'
  })

  // Import state
  const [importType, setImportType] = useState(null) // 'borrowers' | 'backup'
  const [importFile, setImportFile] = useState(null)
  const [importPreview, setImportPreview] = useState(null)
  const [importing, setImporting] = useState(false)

  // Backup state
  const [backups, setBackups] = useState([])
  const [lastBackup, setLastBackup] = useState(null)
  const [creatingBackup, setCreatingBackup] = useState(false)
  const [loadingBackups, setLoadingBackups] = useState(false)

  useEffect(() => {
    if (user) {
      loadSettings()
      if (activeTab === 'export') {
        loadBackupHistory()
      }
    }
  }, [user, activeTab])

  useEffect(() => {
    // Apply dark mode
    if (darkMode) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('darkMode', 'true')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('darkMode', 'false')
    }
  }, [darkMode])

  const loadSettings = async () => {
    setLoading(true)
    const { data, error } = await getSettings(user.id)

    if (!error && data) {
      setDefaultWeeks(data.default_weeks || 24)
      setWeeklyRate(data.weekly_rate || 0.05)
      setCollectionDay(data.default_collection_day || 0)
      setAllowMassRecordPast(data.allow_mass_record_past === true)
    }

    setLoading(false)
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    setMessage(null)

    const { error } = await updateSettings(user.id, {
      default_weeks: parseInt(defaultWeeks),
      weekly_rate: parseFloat(weeklyRate),
      default_collection_day: parseInt(collectionDay),
      allow_mass_record_past: allowMassRecordPast
    })

    setSaving(false)

    if (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' })
    } else {
      setMessage({ type: 'success', text: 'Settings saved successfully!' })
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleResetSettings = async () => {
    if (!confirm('Reset all settings to defaults?')) return

    setSaving(true)
    const { error } = await resetSettings(user.id)

    if (!error) {
      await loadSettings()
      setMessage({ type: 'success', text: 'Settings reset to defaults' })
      setTimeout(() => setMessage(null), 3000)
    } else {
      setMessage({ type: 'error', text: 'Failed to reset settings' })
    }

    setSaving(false)
  }

  const handleExport = async (type) => {
    setMessage(null)
    let result

    switch (type) {
      case 'json':
        result = await exportAllDataJSON(user.id, user.email)
        break
      case 'borrowers':
        result = await exportBorrowersCSV(user.id)
        break
      case 'loans':
        result = await exportLoansCSV(user.id)
        break
      case 'payments':
        result = await exportPaymentsCSV(user.id)
        break
    }

    if (result?.success) {
      setMessage({ type: 'success', text: 'Export completed successfully!' })
      setTimeout(() => setMessage(null), 3000)
    } else {
      setMessage({ type: 'error', text: 'Export failed: ' + result?.error?.message })
    }
  }

  const handleFileSelect = async (e, type) => {
    const file = e.target.files[0]
    if (!file) return

    setImportType(type)
    setImportFile(file)
    setMessage(null)

    try {
      const text = await file.text()

      if (type === 'borrowers') {
        // Parse and validate CSV
        const { data } = parseCSV(text)
        const { valid, errors } = validateBorrowers(data)

        // Check for duplicates
        const { unique, duplicates } = await checkDuplicateBorrowers(user.id, valid)

        setImportPreview({
          type: 'borrowers',
          total: data.length,
          valid: valid.length,
          errors: errors.length,
          unique: unique.length,
          duplicates: duplicates.length,
          errorDetails: errors,
          uniqueData: unique,
          duplicateData: duplicates
        })
      } else if (type === 'backup') {
        // Parse JSON
        const backupData = JSON.parse(text)
        setImportPreview({
          type: 'backup',
          borrowers: backupData.borrowers?.length || 0,
          loans: backupData.loans?.length || 0,
          payments: backupData.payments?.length || 0,
          data: backupData
        })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to read file: ' + error.message })
      setImportFile(null)
      setImportPreview(null)
    }
  }

  const handleConfirmImport = async () => {
    if (!importPreview) return

    setImporting(true)
    setMessage(null)

    try {
      let result

      if (importPreview.type === 'borrowers') {
        result = await importBorrowers(user.id, importPreview.uniqueData)
        if (result.error) throw result.error

        setMessage({
          type: 'success',
          text: `Successfully imported ${result.count} borrowers! ${importPreview.duplicates > 0 ? `(${importPreview.duplicates} duplicates skipped)` : ''}`
        })
      } else if (importPreview.type === 'backup') {
        result = await importBackupJSON(user.id, importPreview.data)
        if (result.error) throw result.error

        setMessage({
          type: 'success',
          text: `Successfully imported: ${result.results.borrowers} borrowers, ${result.results.loans} loans, ${result.results.payments} payments`
        })
      }

      // Reset import state
      setTimeout(() => {
        setImportFile(null)
        setImportPreview(null)
        setImportType(null)
        setMessage(null)
      }, 5000)
    } catch (error) {
      setMessage({ type: 'error', text: 'Import failed: ' + error.message })
    } finally {
      setImporting(false)
    }
  }

  const handleCancelImport = () => {
    setImportFile(null)
    setImportPreview(null)
    setImportType(null)
    setMessage(null)
  }

  const loadBackupHistory = async () => {
    setLoadingBackups(true)
    const [backupsRes, lastBackupRes] = await Promise.all([
      listBackups(user.id),
      getLastBackup(user.id)
    ])

    if (backupsRes.data) setBackups(backupsRes.data)
    if (lastBackupRes.data) setLastBackup(lastBackupRes.data)
    setLoadingBackups(false)
  }

  const handleCreateBackup = async () => {
    setCreatingBackup(true)
    setMessage(null)

    const result = await createAutoBackup(user.id, user.email)

    if (result.success) {
      setMessage({ type: 'success', text: 'Backup created successfully!' })
      await loadBackupHistory()
      // Auto cleanup old backups
      await cleanupOldBackups(user.id, 10)
    } else {
      setMessage({ type: 'error', text: 'Backup failed: ' + result.error })
    }

    setCreatingBackup(false)
    setTimeout(() => setMessage(null), 5000)
  }

  const handleDownloadBackup = async (backup, filename) => {
    setMessage({ type: 'success', text: `Downloading ${filename}...` })
    const result = await downloadBackupFile(backup.backup_path, filename)

    if (!result.success) {
      setMessage({ type: 'error', text: 'Download failed: ' + result.error.message })
    }

    setTimeout(() => setMessage(null), 3000)
  }

  const formatBackupDate = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const daysOfWeek = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <SettingsIcon className="w-7 h-7 text-primary-600" />
          Settings
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Configure your FinTrack preferences and manage data
        </p>
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-4 p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === 'general'
              ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          General
        </button>
        <button
          onClick={() => setActiveTab('export')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === 'export'
              ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Export/Import
        </button>
        <button
          onClick={() => setActiveTab('backups')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === 'backups'
              ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Backups
        </button>
        <button
          onClick={() => setActiveTab('account')}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeTab === 'account'
              ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Account
        </button>
      </div>

      {/* General Settings Tab */}
      {activeTab === 'general' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Loan Defaults
            </h2>

            {/* Default Weeks */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Default Number of Weeks
                </div>
              </label>
              <input
                type="number"
                value={defaultWeeks}
                onChange={(e) => setDefaultWeeks(e.target.value)}
                min="1"
                max="104"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Default loan duration for new loans (typically 24 weeks)
              </p>
            </div>

            {/* Weekly Rate */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <div className="flex items-center gap-2">
                  <IndianRupeeIcon className="w-4 h-4" />
                  Weekly Rate (Interest)
                </div>
              </label>
              <input
                type="number"
                value={weeklyRate}
                onChange={(e) => setWeeklyRate(e.target.value)}
                step="0.001"
                min="0"
                max="1"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Weekly payment as percentage of principal (0.05 = 5% per week)
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-2 font-medium">
                Example: ₹10,000 × {weeklyRate} = ₹{(10000 * weeklyRate).toFixed(0)}/week
              </p>
            </div>

            {/* Collection Day */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default Collection Day
              </label>
              <select
                value={collectionDay}
                onChange={(e) => setCollectionDay(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              >
                {daysOfWeek.map(day => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Default day of the week for payment collections
              </p>
            </div>
          </div>

          {/* Mass record past payments */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Loan data
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Record past weeks in one click</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  When enabled, you can mass-record all past-due weeks as paid (e.g. for backdated loans). Shown in loan details and after creating a loan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAllowMassRecordPast(!allowMassRecordPast)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                  allowMassRecordPast ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    allowMassRecordPast ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Dark Mode Toggle */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Appearance
            </h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {darkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Dark Mode</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {darkMode ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  darkMode ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    darkMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleResetSettings}
              disabled={saving}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset to Defaults
            </button>
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-primary-500 to-accent-500 text-white rounded-lg hover:from-primary-600 hover:to-accent-600 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Export/Import Tab */}
      {activeTab === 'export' && (
        <div className="space-y-4">
          {/* Export Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Download className="w-5 h-5" />
              Export Data
            </h2>
            <div className="space-y-3">
              <button
                onClick={() => handleExport('json')}
                className="w-full px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-left"
              >
                <div className="font-medium">Export All Data (JSON)</div>
                <div className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                  Complete backup including borrowers, loans, payments, and settings
                </div>
              </button>

              <button
                onClick={() => handleExport('borrowers')}
                className="w-full px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors text-left"
              >
                <div className="font-medium">Export Borrowers (CSV)</div>
                <div className="text-sm text-green-600 dark:text-green-400 mt-1">
                  Borrower list with contact information
                </div>
              </button>

              <button
                onClick={() => handleExport('loans')}
                className="w-full px-4 py-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors text-left"
              >
                <div className="font-medium">Export Loans (CSV)</div>
                <div className="text-sm text-purple-600 dark:text-purple-400 mt-1">
                  Loan details with principal, weekly amounts, and status
                </div>
              </button>

              <button
                onClick={() => handleExport('payments')}
                className="w-full px-4 py-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors text-left"
              >
                <div className="font-medium">Export Payments (CSV)</div>
                <div className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                  Complete payment history with due dates and amounts
                </div>
              </button>
            </div>
          </div>

          {/* Import Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Import Data
            </h2>

            {!importPreview ? (
              <div className="space-y-3">
                <div>
                  <label className="block w-full">
                    <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors cursor-pointer">
                      <div className="font-medium">Import Full Backup (JSON)</div>
                      <div className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                        Restore complete backup with all data
                      </div>
                    </div>
                    <input
                      type="file"
                      accept=".json"
                      onChange={(e) => handleFileSelect(e, 'backup')}
                      className="hidden"
                    />
                  </label>
                </div>

                <div>
                  <label className="block w-full">
                    <div className="px-4 py-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors cursor-pointer">
                      <div className="font-medium">Import Borrowers (CSV)</div>
                      <div className="text-sm text-green-600 dark:text-green-400 mt-1">
                        Bulk import borrowers from CSV file
                      </div>
                    </div>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => handleFileSelect(e, 'borrowers')}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <strong>CSV Format for Borrowers:</strong>
                    <br />
                    Headers: name, area, phone, leader_tag, is_active
                    <br />
                    <span className="text-xs">Example: "John Doe","Area 1","9876543210","Leader A","true"</span>
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Preview Section */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      Import Preview
                    </h3>
                  </div>

                  {importPreview.type === 'borrowers' && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Total rows:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{importPreview.total}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-green-600 dark:text-green-400">Will import:</span>
                        <span className="font-semibold text-green-600 dark:text-green-400">{importPreview.unique}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-orange-600 dark:text-orange-400">Duplicates (skip):</span>
                        <span className="font-semibold text-orange-600 dark:text-orange-400">{importPreview.duplicates}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-red-600 dark:text-red-400">Errors:</span>
                        <span className="font-semibold text-red-600 dark:text-red-400">{importPreview.errors}</span>
                      </div>

                      {importPreview.errors > 0 && (
                        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded text-xs">
                          <p className="font-semibold text-red-800 dark:text-red-200 mb-1">Validation Errors:</p>
                          {importPreview.errorDetails.slice(0, 3).map((err, i) => (
                            <div key={i} className="text-red-700 dark:text-red-300">
                              Row {err.row}: {err.issues.join(', ')}
                            </div>
                          ))}
                          {importPreview.errorDetails.length > 3 && (
                            <p className="text-red-600 dark:text-red-400 mt-1">
                              +{importPreview.errorDetails.length - 3} more errors
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {importPreview.type === 'backup' && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Borrowers:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{importPreview.borrowers}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Loans:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{importPreview.loans}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Payments:</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{importPreview.payments}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleCancelImport}
                    disabled={importing}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmImport}
                    disabled={importing || (importPreview.type === 'borrowers' && importPreview.unique === 0)}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-primary-600 to-accent-600 text-white rounded-lg hover:from-primary-700 hover:to-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      'Confirm Import'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Backups Tab */}
      {activeTab === 'backups' && (
        <div className="space-y-4">
          {/* Auto Backup Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  Automatic Backups
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Create and manage backups stored in Supabase Storage
                </p>
              </div>
              <button
                onClick={handleCreateBackup}
                disabled={creatingBackup}
                className="px-4 py-2 bg-gradient-to-r from-primary-600 to-accent-600 text-white rounded-lg hover:from-primary-700 hover:to-accent-700 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {creatingBackup ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Database className="w-4 h-4" />
                    Create Backup Now
                  </>
                )}
              </button>
            </div>

            {lastBackup && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <p className="font-medium text-green-800 dark:text-green-200">Last Backup</p>
                </div>
                <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
                  <p><Clock className="w-4 h-4 inline mr-1" />{formatBackupDate(lastBackup.created_at)}</p>
                  <p className="flex gap-4">
                    <span>{lastBackup.borrowers_count} borrowers</span>
                    <span>{lastBackup.loans_count} loans</span>
                    <span>{lastBackup.payments_count} payments</span>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Backup History */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              Backup History
            </h3>

            {loadingBackups ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
              </div>
            ) : backups.length === 0 ? (
              <div className="text-center py-8">
                <Database className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-600 dark:text-gray-400">No backups yet</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  Create your first backup to get started
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {backups.map((backup) => (
                  <div
                    key={backup.id}
                    className={`p-4 rounded-lg border ${
                      backup.status === 'success'
                        ? 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700'
                        : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Database className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          <p className="font-medium text-gray-900 dark:text-white">
                            {formatBackupDate(backup.created_at)}
                          </p>
                          {backup.status === 'partial' && (
                            <span className="px-2 py-0.5 text-xs bg-yellow-200 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded">
                              Partial
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          <p className="flex gap-4">
                            <span>{backup.borrowers_count} borrowers</span>
                            <span>{backup.loans_count} loans</span>
                            <span>{backup.payments_count} payments</span>
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            {backup.file_count} files
                          </p>
                        </div>
                        {backup.error_message && (
                          <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-2">
                            {backup.error_message}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDownloadBackup(backup, 'backup.json')}
                        className="ml-4 px-4 py-2 bg-gradient-to-r from-primary-600 to-accent-600 text-white text-sm font-medium rounded-lg hover:from-primary-700 hover:to-accent-700 transition-all flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>📦 Backup Format:</strong> JSON (Full restore capability)
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                • Backups are stored securely in Supabase Storage<br />
                • Each backup contains all data in a single JSON file<br />
                • Can be restored using Import → Import Full Backup<br />
                • System keeps last 10 backups automatically
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Account Tab */}
      {activeTab === 'account' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            Account Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <p className="text-gray-900 dark:text-white">{user?.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                User ID
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{user?.id}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
