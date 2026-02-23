import { Users, TrendingUp, Plus, BarChart3, Settings, Wallet, Calendar } from 'lucide-react'

export default function MobileBottomNav({ currentView, onViewChange, onQuickAction }) {
  const navItems = [
    { id: 'borrowers', label: 'Borrowers', icon: Users },
    { id: 'loans', label: 'Loans', icon: TrendingUp },
    { id: 'add', label: 'Add', icon: Plus, isAction: true },
    { id: 'collections', label: 'Collect', icon: Wallet },
    { id: 'weekly-loans', label: 'Weekly', icon: Calendar }
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50 mobile-safe-bottom">
      <div className="grid grid-cols-5 h-16">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = currentView === item.id

          if (item.isAction) {
            return (
              <button
                key={item.id}
                onClick={onQuickAction}
                className="flex flex-col items-center justify-center relative"
              >
                <div className="absolute -top-6 w-14 h-14 bg-gradient-to-br from-primary-500 to-accent-500 rounded-full flex items-center justify-center shadow-lg">
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </button>
            )
          }

          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                isActive
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
