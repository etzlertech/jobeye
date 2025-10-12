/*
AGENT DIRECTIVE BLOCK
file: /src/components/demo/DevLayout.tsx
phase: dev-crud
domain: supervisor
purpose: Shared layout shell for demo CRUD tooling with navigation
spec_ref: DEV_CRUD_PORT_PLAN.md
complexity_budget: 180
dependencies:
  internal:
    - none
  external:
    - 'next/link'
    - 'next/navigation'
    - 'react'
voice_considerations:
  - Provide clear headings so screen readers can guide voice navigation
*/

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const NAV_ITEMS = [
  { href: '/demo-crud', label: 'Customers' },
  { href: '/demo-properties', label: 'Properties' },
  { href: '/demo-jobs', label: 'Jobs (coming soon)' },
  { href: '/demo-inventory', label: 'Inventory (coming soon)' }
];

interface DevLayoutProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export default function DevLayout({ title, description, actions, children }: DevLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-yellow-400">{title}</h1>
            {description ? (
              <p className="mt-1 text-sm text-gray-400">{description}</p>
            ) : (
              <p className="mt-1 text-sm text-gray-500">
                Sign in via <span className="font-mono text-gray-300">/simple-signin</span> to use the dev tools below.
              </p>
            )}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
        <nav aria-label="Demo navigation" className="border-t border-gray-900/60 bg-gray-950">
          <div className="mx-auto flex max-w-5xl flex-wrap gap-2 px-4 py-2">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-yellow-400 text-black'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-xl border border-gray-800 bg-gray-950 p-6 shadow-lg shadow-black/40">
          {children}
        </div>
      </main>
    </div>
  );
}
