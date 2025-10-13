/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/app/admin/layout.tsx
 * phase: 3
 * domain: admin
 * purpose: Shared layout shell for system admin console routes
 * spec_ref: docs/admin-ui-specs.md#phase-33-system-admin-console
 * complexity_budget: 120 LoC
 * migrations_touched: []
 * offline_capability: N/A
 * dependencies: {
 *   internal: ['@/components/ui/badge', '@/components/ui/separator'],
 *   external: ['next/link', 'next/navigation', 'react']
 * }
 * exports: ['default']
 * voice_considerations: Provide clear headings for voice navigation
 * test_requirements: No direct tests (layout wrapper)
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Shield, BarChart3, Users2, Building2, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/admin/tenants', label: 'Tenants', icon: Building2 },
  { href: '/admin/users', label: 'Users', icon: Users2 },
  { href: '/admin/config', label: 'System Config', icon: Settings }
] as const;

function AdminNavigation() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`group flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
              isActive
                ? 'bg-slate-800 text-white'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-800">
              <Shield className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">
                System Administration
              </p>
              <h1 className="text-lg font-semibold text-white">JobEye Control Tower</h1>
            </div>
          </div>
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-300">
            System Admin
          </Badge>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-8 px-6 py-8">
        <aside className="hidden w-60 shrink-0 md:block">
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Navigation</p>
          <AdminNavigation />
        </aside>
        <Separator orientation="vertical" className="hidden h-auto bg-slate-800 md:block" />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
