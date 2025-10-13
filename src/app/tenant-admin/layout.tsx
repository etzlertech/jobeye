/**
 * @file /src/app/tenant-admin/layout.tsx
 * @phase 3.4
 * @domain admin
 * @purpose Shared layout shell for tenant admin routes
 * @spec_ref docs/admin-ui-specs.md#phase-34-tenant-admin-approval-screens
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Building2, 
  Users2, 
  CheckCircle, 
  Bell,
  ClipboardList,
  BarChart3,
  Shield
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/tenant-admin/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/tenant-admin/onboarding', label: 'Onboarding', icon: ClipboardList },
  { href: '/tenant-admin/users', label: 'Users', icon: Users2 },
  { href: '/tenant-admin/approvals', label: 'Approvals', icon: CheckCircle },
  { href: '/tenant-admin/notifications', label: 'Notifications', icon: Bell }
] as const;

function TenantAdminNavigation() {
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
            {item.label === 'Approvals' && (
              <Badge variant="destructive" className="ml-auto h-5 min-w-[20px] px-1.5 text-xs">
                3
              </Badge>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export default function TenantAdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-800">
              <Building2 className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">
                Tenant Administration
              </p>
              <h1 className="text-lg font-semibold text-white">GreenWorks Landscaping</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-blue-500/40 text-blue-300">
              <Shield className="mr-1 h-3 w-3" />
              Tenant Admin
            </Badge>
            <div className="h-8 w-px bg-slate-700" />
            <div className="text-right">
              <p className="text-sm font-medium text-white">Sarah Johnson</p>
              <p className="text-xs text-slate-400">sarah@greenworks.land</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-8 px-6 py-8">
        <aside className="hidden w-60 shrink-0 md:block">
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Navigation</p>
          <TenantAdminNavigation />
        </aside>
        <Separator orientation="vertical" className="hidden h-auto bg-slate-800 md:block" />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}