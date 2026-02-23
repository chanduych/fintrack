import { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Plus, Search, Users, Loader2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { getBorrowers, createBorrower, updateBorrower, deleteBorrower } from '../../services/borrowerService'
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
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState('recent') // 'recent', 'name', 'area', 'leader'
  const [areaFilter, setAreaFilter] = useState('all')
  const [leaderFilter, setLeaderFilter] = useState('all')

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingBorrower, setEditingBorrower] = useState(null)
  const [deletingBorrower, setDeletingBorrower] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [selectedBorrower, setSelectedBorrower] = useState(null)

  // Load borrowers
  useEffect(() => {
    if (user) {
      loadBorrowers()
    }
  }, [user])

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
