/**
 * @file /src/app/tenant-admin/dashboard/page.tsx
 * @phase 3.4
 * @domain tenant-admin
 * @purpose Tenant admin dashboard with key metrics and quick actions
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ADMIN_CARD_CLASSES } from '@/app/admin/_constants/admin-ui-constants';
import {
  Users,
  UserPlus,
  CheckCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  FileCheck,
  Bell
} from 'lucide-react';
import Link from 'next/link';

const metricCards = [
  {
    title: 'Active Users',
    icon: Users,
    value: '24',
    sublabel: '5 supervisors · 19 crew',
    trend: '+2 this week'
  },
  {
    title: 'Pending Approvals',
    icon: Clock,
    value: '3',
    sublabel: '2 users · 1 role change',
    trend: 'Requires action',
    urgency: 'warning'
  },
  {
    title: 'Completion Rate',
    icon: CheckCircle,
    value: '94%',
    sublabel: 'Jobs this month',
    trend: '+3% vs last month'
  },
  {
    title: 'Active Jobs',
    icon: FileCheck,
    value: '12',
    sublabel: 'Across 8 properties',
    trend: 'On schedule'
  }
] as const;

const recentActivity = [
  {
    id: '1',
    type: 'user_invite',
    title: 'New user invitation sent',
    description: 'Invitation sent to mike.chen@greenworks.land',
    timestamp: '2 hours ago',
    icon: UserPlus
  },
  {
    id: '2',
    type: 'approval',
    title: 'Role change approved',
    description: 'Alex Rivera promoted to supervisor',
    timestamp: '5 hours ago',
    icon: CheckCircle
  },
  {
    id: '3',
    type: 'system',
    title: 'Onboarding 95% complete',
    description: 'Complete final integration step to finish',
    timestamp: '1 day ago',
    icon: AlertTriangle
  }
];

export default function TenantDashboardPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">Tenant Dashboard</h2>
          <p className="text-sm text-slate-400">
            Manage your organization, users, and monitor activity.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-3">
          <Button asChild size="sm" className="bg-blue-500 text-white hover:bg-blue-400">
            <Link href="/tenant-admin/users">
              <UserPlus className="mr-2 h-3.5 w-3.5" />
              Invite User
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="border-slate-700 text-slate-200">
            <Link href="/tenant-admin/approvals">
              <Clock className="mr-2 h-3.5 w-3.5" />
              View Approvals (3)
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="border-slate-700 text-slate-200">
            <Link href="/tenant-admin/onboarding">
              <FileCheck className="mr-2 h-3.5 w-3.5" />
              Complete Setup
            </Link>
          </Button>
        </div>
      </section>

      {/* Metrics */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => (
          <Card key={card.title} className={ADMIN_CARD_CLASSES}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">
                {card.title}
              </CardTitle>
              <card.icon className={`h-4 w-4 ${
                card.urgency === 'warning' ? 'text-yellow-400' : 'text-slate-500'
              }`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-white">{card.value}</div>
              <p className="mt-1 text-xs text-slate-400">{card.sublabel}</p>
              <p className={`mt-2 text-xs ${
                card.urgency === 'warning' ? 'text-yellow-400' : 'text-blue-400'
              }`}>
                {card.trend}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Activity and Status */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card className={ADMIN_CARD_CLASSES}>
          <CardHeader>
            <CardTitle className="text-white">Recent Activity</CardTitle>
            <p className="text-sm text-slate-400">
              Latest actions and events in your organization
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentActivity.map((activity) => {
              const Icon = activity.icon;
              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 rounded-md border border-slate-800/50 bg-slate-900/40 p-3"
                >
                  <div className={`rounded-md p-2 ${
                    activity.type === 'user_invite' ? 'bg-blue-500/10' :
                    activity.type === 'approval' ? 'bg-green-500/10' :
                    'bg-yellow-500/10'
                  }`}>
                    <Icon className={`h-4 w-4 ${
                      activity.type === 'user_invite' ? 'text-blue-400' :
                      activity.type === 'approval' ? 'text-green-400' :
                      'text-yellow-400'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{activity.title}</p>
                    <p className="text-xs text-slate-400">{activity.description}</p>
                    <p className="mt-1 text-xs text-slate-500">{activity.timestamp}</p>
                  </div>
                </div>
              );
            })}
            <Button variant="ghost" size="sm" className="w-full text-slate-400 hover:text-white">
              View all activity
            </Button>
          </CardContent>
        </Card>

        {/* Onboarding Status */}
        <Card className={ADMIN_CARD_CLASSES}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <FileCheck className="h-5 w-5" />
              Onboarding Progress
            </CardTitle>
            <p className="text-sm text-slate-400">
              Complete setup to unlock all features
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Company Details</span>
                <Badge className="bg-green-500/10 text-green-300">Complete</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Initial Users</span>
                <Badge className="bg-green-500/10 text-green-300">Complete</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Integrations</span>
                <Badge className="bg-yellow-500/10 text-yellow-300">In Progress</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Approval Submission</span>
                <Badge className="bg-slate-500/10 text-slate-300">Pending</Badge>
              </div>
            </div>
            
            <div className="pt-4">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="text-slate-400">Overall Progress</span>
                <span className="text-slate-300 font-medium">95%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div className="h-full w-[95%] bg-blue-500 transition-all" />
              </div>
            </div>

            <Button asChild className="w-full" variant="outline" size="sm">
              <Link href="/tenant-admin/onboarding">
                Continue Setup
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}