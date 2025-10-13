/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/app/admin/dashboard/page.tsx
 * phase: 3
 * domain: admin
 * purpose: System admin overview dashboard (Phase 3.3.1)
 * spec_ref: docs/admin-ui-specs.md#system-admin-dashboard
 * complexity_budget: 200
 * dependencies: {
 *   internal: ['@/components/ui/card', '@/components/ui/separator'],
 *   external: ['react']
 * }
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ADMIN_CARD_CLASSES } from '../_constants/admin-ui-constants';
import {
  Building2,
  Users2,
  Zap,
  Activity,
  AlertTriangle,
  CheckCircle2,
  TrendingUp
} from 'lucide-react';

const metricCards = [
  {
    title: 'Tenants',
    icon: Building2,
    value: '48',
    sublabel: '36 active · 8 pending · 4 suspended',
    trend: '+4% vs last 30d'
  },
  {
    title: 'Users',
    icon: Users2,
    value: '1,245',
    sublabel: 'DAU 312 · WAU 684',
    trend: '+7% vs last week'
  },
  {
    title: 'Active Jobs',
    icon: Activity,
    value: '92',
    sublabel: 'Across 18 tenants',
    trend: '-2% vs yesterday'
  },
  {
    title: 'Monthly Revenue',
    icon: TrendingUp,
    value: '$36.2k',
    sublabel: 'ARR $428k',
    trend: '+11% vs last month'
  }
] as const;

const healthStatuses = [
  { service: 'Database Cluster', status: 'healthy', responseTime: '38 ms', checkedAt: '2m ago' },
  { service: 'Storage', status: 'healthy', responseTime: '45 ms', checkedAt: '2m ago' },
  { service: 'Voice Services', status: 'warning', responseTime: '132 ms', checkedAt: '5m ago' },
  { service: 'Vision Pipeline', status: 'healthy', responseTime: '87 ms', checkedAt: '5m ago' },
  { service: 'Webhooks', status: 'healthy', responseTime: '61 ms', checkedAt: '1m ago' }
] as const;

const recentEvents = [
  {
    id: 'evt_01',
    type: 'tenant',
    severity: 'info',
    title: 'New tenant onboarding request',
    body: '“Lawn Care Pros” submitted onboarding details',
    timestamp: '12 minutes ago'
  },
  {
    id: 'evt_02',
    type: 'system',
    severity: 'warning',
    title: 'Voice service latency',
    body: 'Latency above threshold in us-central (peak 1.8s)',
    timestamp: '27 minutes ago'
  },
  {
    id: 'evt_03',
    type: 'security',
    severity: 'error',
    title: 'Suspicious login attempts',
    body: 'User jamie.b@acme.com failed MFA 5 times',
    timestamp: '1 hour ago'
  },
  {
    id: 'evt_04',
    type: 'tenant',
    severity: 'info',
    title: 'Tenant suspended',
    body: 'Auto-suspension for “Property Test LLC” (billing delinquent)',
    timestamp: '3 hours ago'
  }
] as const;

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8 pb-16">
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">System Overview</h2>
          <p className="text-sm text-slate-400">
            High-level metrics across the JobEye platform
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((card) => (
            <Card key={card.title} className={ADMIN_CARD_CLASSES}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-300">
                  {card.title}
                </CardTitle>
                <card.icon className="h-4 w-4 text-slate-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold text-white">{card.value}</div>
                <p className="mt-1 text-xs text-slate-400">{card.sublabel}</p>
                <p className="mt-2 text-xs text-emerald-400">{card.trend}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className={ADMIN_CARD_CLASSES}>
          <CardHeader>
            <CardTitle className="text-white">System Health</CardTitle>
            <p className="text-sm text-slate-400">
              Status of core infrastructure components
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {healthStatuses.map((entry) => {
              const Icon =
                entry.status === 'healthy'
                  ? CheckCircle2
                  : entry.status === 'warning'
                  ? AlertTriangle
                  : Zap;

              const colorClasses =
                entry.status === 'healthy'
                  ? 'text-emerald-400'
                  : entry.status === 'warning'
                  ? 'text-yellow-400'
                  : 'text-rose-400';

              return (
                <div
                  key={entry.service}
                  className="flex items-center justify-between rounded-md border border-slate-800/80 bg-slate-900/40 px-3 py-2"
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-white">
                      {entry.service}
                    </span>
                    <span className="text-xs text-slate-400">
                      Response {entry.responseTime} · Checked {entry.checkedAt}
                    </span>
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-medium ${colorClasses}`}>
                    <Icon className="h-4 w-4" />
                    <span className="capitalize">{entry.status}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className={ADMIN_CARD_CLASSES}>
          <CardHeader>
            <CardTitle className="text-white">Recent Events</CardTitle>
            <p className="text-sm text-slate-400">
              Key activities and alerts in the last 24 hours
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentEvents.map((event) => (
                <div key={event.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">{event.title}</p>
                      <p className="text-xs text-slate-400">{event.body}</p>
                    </div>
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs capitalize ${
                        event.severity === 'error'
                          ? 'bg-rose-500/10 text-rose-300'
                          : event.severity === 'warning'
                          ? 'bg-yellow-500/10 text-yellow-300'
                          : 'bg-slate-700/60 text-slate-300'
                      }`}
                    >
                      {event.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{event.timestamp}</p>
                  <Separator className="mt-4 bg-slate-800" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className={ADMIN_CARD_CLASSES}>
          <CardHeader>
            <CardTitle className="text-white">Platform Highlights</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-md border border-slate-800/70 bg-slate-900/40 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Adoption
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                12 tenants onboarded in the last 30 days
              </p>
              <p className="mt-1 text-xs text-slate-400">Up 20% compared to previous month.</p>
            </div>
            <div className="rounded-md border border-slate-800/70 bg-slate-900/40 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Voice Usage
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                6,432 commands processed this week
              </p>
              <p className="mt-1 text-xs text-slate-400">Avg latency 820ms.</p>
            </div>
            <div className="rounded-md border border-slate-800/70 bg-slate-900/40 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Support Load
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                9 open support tickets
              </p>
              <p className="mt-1 text-xs text-slate-400">Median response time 41 minutes.</p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
