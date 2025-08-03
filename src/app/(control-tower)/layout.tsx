'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navigation = [
  { 
    name: 'Dashboard', 
    href: '/(control-tower)', 
    icon: '📊',
    description: 'Project overview and stats'
  },
  { 
    name: 'Manifest Generator', 
    href: '/(control-tower)/manifest-generator', 
    icon: '📋',
    description: 'Generate progress reports'
  },
  { 
    name: 'Architecture Viewer', 
    href: '/(control-tower)/architecture-viewer', 
    icon: '🏗️',
    description: 'View dependency graphs'
  },
  { 
    name: 'Standards Library', 
    href: '/(control-tower)/standards-library', 
    icon: '📚',
    description: 'Project standards and docs'
  },
]

export default function ControlTowerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-tower-dark control-tower">
      {/* Header */}
      <header className="bg-tower-gray border-b border-tower-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-white hover:text-tower-accent lg:hidden"
            >
              <span className="sr-only">Open sidebar</span>
              ☰
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">🏗️ Construction Control Tower</h1>
              <p className="text-sm text-gray-400">
                Architecture-as-Code Dashboard
                {process.env.NODE_ENV === 'development' && (
                  <span className="ml-2 px-2 py-1 bg-green-900 text-green-200 text-xs rounded">
                    LOCAL DEV
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-400">
              JobEye v3.2.1
            </div>
            <div className="h-8 w-8 rounded-full bg-tower-accent flex items-center justify-center text-white text-sm">
              👤
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed inset-y-0 left-0 z-50 w-64 bg-tower-gray transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0`}>
          <div className="flex flex-col h-full pt-20 lg:pt-4">
            <nav className="flex-1 px-4 py-6 space-y-2">
              {navigation.map((item) => {
                const isActive = pathname === item.href || 
                  (item.href !== '/(control-tower)' && pathname?.startsWith(item.href))
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`${
                      isActive
                        ? 'bg-tower-accent text-white'
                        : 'text-gray-300 hover:bg-tower-border hover:text-white'
                    } group flex items-center px-3 py-3 rounded-md text-sm font-medium transition-colors`}
                  >
                    <span className="mr-3 text-lg">{item.icon}</span>
                    <div className="flex-1">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs opacity-75">{item.description}</div>
                    </div>
                  </Link>
                )
              })}
            </nav>
            
            {/* Footer */}
            <div className="px-4 py-4 border-t border-tower-border">
              <div className="text-xs text-gray-500">
                <div>🚧 Development Tool</div>
                <div className="mt-1">Isolated from production</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 lg:pl-0">
          <div className="h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}