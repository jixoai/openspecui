import { Activity, useState, type ReactNode } from 'react'

export interface Tab {
  id: string
  label: ReactNode
  icon?: ReactNode
  content: ReactNode
}

interface TabsProps {
  tabs: Tab[]
  defaultTab?: string
  className?: string
}

/**
 * Tabs component with React 19 Activity for state preservation.
 * Hidden tabs are pre-rendered at lower priority and preserve their state.
 */
export function Tabs({ tabs, defaultTab, className = '' }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id)

  if (tabs.length === 0) return null

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className}`}>
      {/* Tab buttons */}
      <div className="z-2 flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground border-transparent'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content with Activity for state preservation */}
      <div className="min-h-0 flex-1">
        {tabs.map((tab) => (
          <Activity key={tab.id} mode={activeTab === tab.id ? 'visible' : 'hidden'}>
            <>{tab.content}</>
          </Activity>
        ))}
      </div>
    </div>
  )
}
