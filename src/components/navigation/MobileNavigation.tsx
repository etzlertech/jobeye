/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/components/navigation/MobileNavigation.tsx
 * phase: 3
 * domain: shared
 * purpose: Mobile-first navigation component for role-based screen access
 * spec_ref: 007-mvp-intent-driven/contracts/navigation.md
 * complexity_budget: 200
 * migrations_touched: []
 * state_machine: {
 *   states: ['closed', 'open'],
 *   transitions: [
 *     'closed->open: toggleNavigation()',
 *     'open->closed: selectScreen() | clickOutside()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "ui": "$0.00"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [],
 *   external: ['react', 'next/navigation', 'lucide-react'],
 *   supabase: []
 * }
 * exports: ['MobileNavigation']
 * voice_considerations: Voice commands for navigation
 * test_requirements: {
 *   coverage: 85,
 *   unit_tests: 'tests/components/navigation/mobile-navigation.test.tsx'
 * }
 * tasks: [
 *   'Create sliding navigation drawer',
 *   'Implement role-based menu items',
 *   'Add current page highlighting',
 *   'Support voice navigation commands'
 * ]
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { canAccessRoute } from '@/lib/auth/route-access';
import {
  Menu,
  X,
  Home,
  Users,
  Building,
  Package,
  Calendar,
  Camera,
  Settings,
  LogOut,
  Shield,
  Briefcase,
  Wrench,
  ArrowLeft,
  CheckSquare,
  Repeat,
  Truck,
  Mic
} from 'lucide-react';

interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<any>;
  roles: string[];
  badge?: string;
}

interface MobileNavigationProps {
  currentRole: 'admin' | 'supervisor' | 'crew';
  onLogout?: () => void;
  showBackButton?: boolean;
  backTo?: string;
}

const navigationItems: NavigationItem[] = [
  // Admin screens
  { id: 'admin-dashboard', label: 'Admin Dashboard', path: '/admin', icon: Shield, roles: ['admin'] },

  // Supervisor screens
  { id: 'supervisor-dashboard', label: 'Home', path: '/supervisor', icon: Home, roles: ['supervisor', 'admin'] },
  { id: 'voice-assistant', label: 'Voice Assistant', path: '/voice', icon: Mic, roles: ['supervisor', 'admin', 'crew'] },
  { id: 'team', label: 'Team', path: '/supervisor/users', icon: Users, roles: ['supervisor', 'admin'] },
  { id: 'customers', label: 'Customers', path: '/supervisor/customers', icon: Briefcase, roles: ['supervisor', 'admin'] },
  { id: 'properties', label: 'Properties', path: '/supervisor/properties', icon: Building, roles: ['supervisor', 'admin'] },
  { id: 'jobs', label: 'Jobs', path: '/supervisor/jobs', icon: Calendar, roles: ['supervisor', 'admin'] },
  { id: 'tasks', label: 'Tasks', path: '/supervisor/task-definitions', icon: CheckSquare, roles: ['supervisor', 'admin'] },
  { id: 'process', label: 'Process', path: '/supervisor/templates', icon: Repeat, roles: ['supervisor', 'admin'] },
  { id: 'tools', label: 'Tools', path: '/supervisor/tools', icon: Wrench, roles: ['supervisor', 'admin'] },
  { id: 'materials', label: 'Materials', path: '/supervisor/materials', icon: Package, roles: ['supervisor', 'admin'] },
  { id: 'vehicles', label: 'Vehicles', path: '/supervisor/vehicles', icon: Truck, roles: ['supervisor', 'admin'] },

  // Crew screens
  { id: 'crew-dashboard', label: 'Crew Hub', path: '/crew', icon: Wrench, roles: ['crew', 'supervisor', 'admin'] },
  { id: 'job-status', label: 'Job Status', path: '/supervisor/job-status', icon: Calendar, roles: ['crew', 'supervisor', 'admin'] },
  { id: 'load-verify', label: 'Load Verification', path: '/crew/load-verify', icon: Settings, roles: ['crew', 'supervisor', 'admin'] },

  // Vision admin
  { id: 'vision-admin', label: 'Vision Admin', path: '/vision/admin', icon: Settings, roles: ['admin'] },
];

export function MobileNavigation({ 
  currentRole, 
  onLogout, 
  showBackButton = false, 
  backTo 
}: MobileNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close navigation when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Get navigation items for current role
  const visibleItems = navigationItems.filter(item =>
    canAccessRoute(item.path, currentRole)
  );

  const handleNavigate = (path: string) => {
    router.push(path);
    setIsOpen(false);
  };

  const handleBack = () => {
    if (backTo) {
      router.push(backTo);
    } else {
      router.back();
    }
  };

  const getRoleIcon = () => {
    switch (currentRole) {
      case 'admin': return Shield;
      case 'supervisor': return Briefcase;
      case 'crew': return Wrench;
      default: return Home;
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <>
      {/* Navigation Trigger */}
      <div className="nav-trigger">
        {showBackButton ? (
          <button onClick={handleBack} className="nav-button">
            <ArrowLeft className="w-6 h-6" />
          </button>
        ) : (
          <button onClick={() => setIsOpen(true)} className="nav-button">
            <Menu className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Overlay */}
      {isOpen && (
        <div 
          className="nav-overlay"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Navigation Drawer */}
      <div className={`nav-drawer ${isOpen ? 'open' : ''}`}>
        {/* Header */}
        <div className="nav-header">
          <div className="flex items-center gap-3">
            {React.createElement(getRoleIcon(), { className: "w-6 h-6 text-golden" })}
            <div>
              <h2 className="text-lg font-semibold text-white">{currentRole.charAt(0).toUpperCase() + currentRole.slice(1)}</h2>
              <p className="text-xs text-gray-400">JobEye Field Service</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="nav-close">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="nav-items">
          {visibleItems.map(item => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            
            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.path)}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="nav-badge">{item.badge}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        {onLogout && (
          <div className="nav-footer">
            <button onClick={onLogout} className="nav-logout">
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>

      {/* Styles */}
      <style jsx>{`
        .nav-trigger {
          position: fixed;
          top: 1rem;
          left: 50%;
          transform: translateX(calc(-187.5px + 1rem));
          z-index: 1000;
        }

        .nav-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: rgba(255, 215, 0, 0.2);
          border: 1px solid rgba(255, 215, 0, 0.3);
          border-radius: 0.5rem;
          color: #FFD700;
          cursor: pointer;
          transition: all 0.2s;
        }

        .nav-button:hover {
          background: rgba(255, 215, 0, 0.3);
          border-color: #FFD700;
        }

        .nav-overlay {
          position: fixed;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 100%;
          max-width: 375px;
          height: 100vh;
          background: rgba(0, 0, 0, 0.5);
          z-index: 1001;
        }

        .nav-drawer {
          position: absolute;
          top: 0;
          left: 0;
          height: 100vh;
          width: 280px;
          background: #000;
          border-right: 1px solid #333;
          transform: translateX(-100%);
          transition: transform 0.3s ease;
          z-index: 1002;
          display: flex;
          flex-direction: column;
        }

        .nav-drawer.open {
          transform: translateX(0);
        }

        .nav-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.5rem 1rem;
          border-bottom: 1px solid #333;
        }

        .nav-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: transparent;
          border: none;
          color: #FFD700;
          cursor: pointer;
          border-radius: 0.375rem;
          transition: all 0.2s;
        }

        .nav-close:hover {
          background: rgba(255, 215, 0, 0.1);
        }

        .nav-items {
          flex: 1;
          padding: 1rem 0;
          overflow-y: auto;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          width: 100%;
          padding: 0.75rem 1rem;
          background: transparent;
          border: none;
          color: #999;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.875rem;
        }

        .nav-item:hover {
          background: rgba(255, 255, 255, 0.05);
          color: white;
        }

        .nav-item.active {
          background: rgba(255, 215, 0, 0.1);
          color: #FFD700;
          border-right: 3px solid #FFD700;
        }

        .nav-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-left: auto;
          min-width: 1.25rem;
          height: 1.25rem;
          padding: 0 0.375rem;
          background: #FFD700;
          color: #000;
          font-size: 0.7rem;
          font-weight: 600;
          border-radius: 9999px;
        }

        .nav-footer {
          padding: 1rem;
          border-top: 1px solid #333;
        }

        .nav-logout {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          width: 100%;
          padding: 0.75rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 0.5rem;
          color: #ef4444;
          text-align: left;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 0.875rem;
        }

        .nav-logout:hover {
          background: rgba(239, 68, 68, 0.2);
          border-color: #ef4444;
        }
      `}</style>
    </>
  );
}
