/**
 * @file /src/components/admin/AdminNavigation.tsx
 * @phase 3.3
 * @domain admin
 * @purpose Navigation sidebar for System Admin Console
 * @spec_ref admin-ui-wireframes.md
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Building,
  Users,
  Settings,
  Shield,
  LogOut,
  Home,
  Bell
} from 'lucide-react';

const navigation = [
  {
    name: 'Dashboard',
    href: '/admin/dashboard',
    icon: BarChart3,
    description: 'System overview and metrics'
  },
  {
    name: 'Tenants',
    href: '/admin/tenants',
    icon: Building,
    description: 'Manage tenant accounts'
  },
  {
    name: 'Users',
    href: '/admin/users',
    icon: Users,
    description: 'Cross-tenant user management'
  },
  {
    name: 'Configuration',
    href: '/admin/config',
    icon: Settings,
    description: 'System settings and feature flags'
  }
];

export function AdminNavigation() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav">
      <div className="nav-header">
        <Shield className="w-8 h-8 text-golden" />
        <div>
          <h1 className="nav-title">System Admin</h1>
          <p className="nav-subtitle">Console</p>
        </div>
      </div>

      <div className="nav-menu">
        <Link href="/" className="nav-link-home">
          <Home className="w-4 h-4" />
          <span>Back to App</span>
        </Link>

        <div className="nav-section">
          <h3 className="nav-section-title">Administration</h3>
          <ul className="nav-list">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={`nav-link ${isActive ? 'active' : ''}`}
                    title={item.description}
                  >
                    <Icon className="w-5 h-5" />
                    <div className="nav-link-content">
                      <span className="nav-link-name">{item.name}</span>
                      <span className="nav-link-desc">{item.description}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="nav-footer">
        <button className="nav-link logout" onClick={() => {
          // TODO: Implement logout
          window.location.href = '/sign-in';
        }}>
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      <style jsx>{`
        .admin-nav {
          width: 280px;
          background: #000;
          border-right: 1px solid #333;
          display: flex;
          flex-direction: column;
          padding: 1.5rem;
        }

        .nav-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #333;
        }

        .nav-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #FFD700;
          margin: 0;
          line-height: 1.2;
        }

        .nav-subtitle {
          font-size: 0.875rem;
          color: #999;
          margin: 0;
          line-height: 1;
        }

        .nav-menu {
          flex: 1;
        }

        .nav-link-home {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem;
          color: #999;
          text-decoration: none;
          border-radius: 0.5rem;
          transition: all 0.2s;
          margin-bottom: 1.5rem;
          border: 1px solid transparent;
        }

        .nav-link-home:hover {
          background: rgba(255, 255, 255, 0.05);
          color: white;
        }

        .nav-section {
          margin-bottom: 2rem;
        }

        .nav-section-title {
          font-size: 0.75rem;
          font-weight: 600;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 0 0 0.75rem 0;
          padding: 0 0.75rem;
        }

        .nav-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .nav-link {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 0.875rem 0.75rem;
          color: #ccc;
          text-decoration: none;
          border-radius: 0.5rem;
          transition: all 0.2s;
          margin-bottom: 0.25rem;
          border: 1px solid transparent;
        }

        .nav-link:hover {
          background: rgba(255, 255, 255, 0.05);
          color: white;
          border-color: rgba(255, 215, 0, 0.2);
        }

        .nav-link.active {
          background: rgba(255, 215, 0, 0.1);
          color: #FFD700;
          border-color: rgba(255, 215, 0, 0.3);
        }

        .nav-link-content {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          min-width: 0;
        }

        .nav-link-name {
          font-weight: 500;
          font-size: 0.875rem;
        }

        .nav-link-desc {
          font-size: 0.75rem;
          color: #999;
          line-height: 1.2;
        }

        .nav-link.active .nav-link-desc {
          color: #B8860B;
        }

        .nav-footer {
          padding-top: 1rem;
          border-top: 1px solid #333;
        }

        .logout {
          width: 100%;
          background: none;
          border: 1px solid #333;
          cursor: pointer;
        }

        .logout:hover {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.3);
          color: #EF4444;
        }

        .golden {
          color: #FFD700;
        }

        @media (max-width: 768px) {
          .admin-nav {
            width: 100%;
            height: auto;
            border-right: none;
            border-bottom: 1px solid #333;
            padding: 1rem;
          }

          .nav-header {
            margin-bottom: 1rem;
          }

          .nav-menu {
            display: none;
          }

          .nav-footer {
            display: none;
          }
        }
      `}</style>
    </nav>
  );
}