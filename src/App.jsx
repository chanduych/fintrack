import { useState, useRef } from 'react'
import { useAuth } from './contexts/AuthContext'
import { useDeepLinking } from './hooks/useDeepLinking'
import AuthPage from './components/Auth/AuthPage'
import Header from './components/Layout/Header'
import MobileBottomNav from './components/Layout/MobileBottomNav'
import QuickActionModal from './components/Layout/QuickActionModal'
import BorrowersList from './components/Borrowers/BorrowersList'
import LoansList from './components/Loans/LoansList'
import WeeklyCollections from './components/Collections/WeeklyCollections'
import WeeklyPayments from './components/Collections/WeeklyPayments'
import AnalyticsDashboard from './components/Analytics/AnalyticsDashboard'
import SettingsPage from './components/Settings/SettingsPage'
import { Loader2 } from 'lucide-react'

function App() {
  const { user, loading } = useAuth()
  const [currentView, setCurrentView] = useState('borrowers')
  const [showQuickAction, setShowQuickAction] = useState(false)

  // Handle deep link OAuth redirects on mobile
  useDeepLinking()

  // Refs to trigger actions in child components
  const borrowersRef = useRef(null)
  const loansRef = useRef(null)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary-600 dark:text-primary-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-300 text-lg">
            Loading FinTrack...
          </p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <AuthPage />
  }

  const handleQuickAction = (actionId) => {
    if (actionId === 'borrower') {
      setCurrentView('borrowers')
      // Trigger add borrower modal in BorrowersList
      setTimeout(() => {
        if (borrowersRef.current?.openAddModal) {
          borrowersRef.current.openAddModal()
        }
      }, 100)
    } else if (actionId === 'loan') {
      setCurrentView('loans')
      // Trigger add loan modal in LoansList
      setTimeout(() => {
        if (loansRef.current?.openAddModal) {
          loansRef.current.openAddModal()
        }
      }, 100)
    }
  }

  const renderView = () => {
    switch (currentView) {
      case 'borrowers':
        return <BorrowersList ref={borrowersRef} />
      case 'loans':
        return <LoansList ref={loansRef} />
      case 'collections':
        return <WeeklyPayments />
      case 'weekly-loans':
        return <WeeklyCollections />
      case 'analytics':
        return <AnalyticsDashboard />
      case 'settings':
        return <SettingsPage />
      default:
        return <BorrowersList />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-20 md:pb-0">
      <Header currentView={currentView} onViewChange={setCurrentView} />
      {renderView()}
      <MobileBottomNav
        currentView={currentView}
        onViewChange={setCurrentView}
        onQuickAction={() => setShowQuickAction(true)}
      />
      <QuickActionModal
        isOpen={showQuickAction}
        onClose={() => setShowQuickAction(false)}
        onAction={handleQuickAction}
      />
    </div>
  )
}

export default App
