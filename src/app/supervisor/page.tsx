/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/app/supervisor/page.tsx
 * phase: 3
 * domain: supervisor
 * purpose: Modern supervisor dashboard with job overview and quick actions
 * spec_ref: 007-mvp-intent-driven/contracts/supervisor-ui.md
 * complexity_budget: 400
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Calendar,
  Users,
  Package,
  AlertTriangle,
  Plus,
  RefreshCw,
  Clock,
  CheckCircle,
  WifiOff
} from 'lucide-react';
import { MobileContainer, MobileHeader, MobileCard } from '@/components/mobile';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { TenantBadge } from '@/components/tenant';
import { supabase } from '@/lib/supabase/client';

interface DashboardData {
  todayJobs: {
    total: number;
    assigned: number;
    inProgress: number;
    completed: number;
  };
  crewStatus: Array<{
    id: string;
    name: string;
    currentJob?: string;
    jobsCompleted: number;
    jobsRemaining: number;
  }>;
  inventoryAlerts: Array<{
    itemId: string;
    itemName: string;
    alertType: 'low_stock' | 'missing' | 'maintenance_due';
    severity: 'high' | 'medium' | 'low';
  }>;
}

interface Job {
  id: string;
  customerName: string;
  propertyAddress: string;
  scheduledDate: string;
  scheduledTime: string;
  status: 'assigned' | 'started' | 'in_progress' | 'completed';
  specialInstructions?: string;
  requiredEquipment?: string[];
  loadVerified?: boolean;
  thumbnailUrl?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export default function SupervisorDashboard() {
  const router = useRouter();

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [todayJobs, setTodayJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [currentUser, setCurrentUser] = useState<{ name?: string | null; email?: string | null } | null>(null);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      const [statusResponse, jobsResponse] = await Promise.all([
        fetch('/api/supervisor/dashboard/status'),
        fetch('/api/supervisor/jobs/today')
      ]);

      if (!statusResponse.ok || !jobsResponse.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const [statusData, jobsData] = await Promise.all([
        statusResponse.json(),
        jobsResponse.json()
      ]);

      setDashboardData(statusData);
      setTodayJobs(jobsData.jobs || []);
      setLastRefresh(new Date());
      setIsOffline(false);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setIsOffline(true);

      // Load from cache if available
      const cachedData = localStorage.getItem('supervisor_dashboard_cache');
      if (cachedData) {
        const { statusData, jobsData, timestamp } = JSON.parse(cachedData);
        const cacheAge = Date.now() - timestamp;

        // Use cache if less than 5 minutes old
        if (cacheAge < 5 * 60 * 1000) {
          setDashboardData(statusData);
          setTodayJobs(jobsData);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Resolve authenticated user for header display
  useEffect(() => {
    let isMounted = true;

    supabase.auth.getUser().then(({ data, error }) => {
      if (!isMounted || error || !data.user) {
        return;
      }

      const rawName =
        (data.user.user_metadata as Record<string, unknown> | undefined)?.name;

      setCurrentUser({
        name: typeof rawName === 'string' ? rawName : null,
        email: data.user.email
      });
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const getStatusVariant = (status: Job['status']) => {
    switch (status) {
      case 'in_progress':
      case 'started':
        return 'default';
      case 'completed':
        return 'secondary';
      case 'assigned':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  if (isLoading) {
    return (
      <MobileContainer className="items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <RefreshCw className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground text-lg">Loading dashboard...</p>
        </motion.div>
      </MobileContainer>
    );
  }

  return (
    <MobileContainer>
      {/* Header */}
      <MobileHeader
        title="Supervisor Dashboard"
        subtitle={lastRefresh.toLocaleTimeString()}
        isOffline={isOffline}
        rightContent={
          <>
            <TenantBadge />
            {currentUser?.email && (
              <Badge variant="outline" className="ml-2 mr-2">
                <Users className="w-3 h-3 mr-1" />
                {currentUser.name || currentUser.email.split('@')[0]}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchDashboardData}
            >
              <RefreshCw className="w-5 h-5" />
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 space-y-4">
          {/* Stats Overview */}
          {dashboardData && (
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <Calendar className="w-6 h-6 text-primary mx-auto mb-2" />
                  <p className="text-2xl font-bold">{dashboardData.todayJobs.total}</p>
                  <p className="text-xs text-muted-foreground mt-1">{dashboardData.todayJobs.completed} done</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <Users className="w-6 h-6 text-primary mx-auto mb-2" />
                  <p className="text-2xl font-bold">{dashboardData.crewStatus.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {dashboardData.crewStatus.filter(c => c.currentJob).length} working
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <Package className={`w-6 h-6 mx-auto mb-2 ${dashboardData.inventoryAlerts.length > 0 ? 'text-orange-500' : 'text-primary'}`} />
                  <p className="text-2xl font-bold">{dashboardData.inventoryAlerts.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {dashboardData.inventoryAlerts.filter(a => a.severity === 'high').length} urgent
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              size="lg"
              onClick={() => router.push('/supervisor/jobs')}
              className="h-20 flex-col gap-2"
            >
              <Plus className="w-6 h-6" />
              <span className="text-sm">Create Job</span>
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => router.push('/supervisor/inventory')}
              className="h-20 flex-col gap-2"
            >
              <Package className="w-6 h-6" />
              <span className="text-sm">Inventory</span>
            </Button>
          </div>

          {/* Today's Jobs */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Today's Jobs</h2>
              <Badge variant="secondary">{todayJobs.length}</Badge>
            </div>

            <div className="space-y-3">
              {todayJobs.length > 0 ? (
                todayJobs.map((job) => (
                  <motion.div
                    key={job.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card
                      className="cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => router.push(`/supervisor/jobs/${job.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant={getStatusVariant(job.status)}>
                                {job.status.replace('_', ' ')}
                              </Badge>
                              {job.priority === 'high' && (
                                <span className="text-xs text-orange-500 font-medium">High Priority</span>
                              )}
                            </div>
                            <h3 className="font-semibold truncate">{job.customerName}</h3>
                            <p className="text-sm text-muted-foreground truncate mt-1">
                              {job.propertyAddress}
                            </p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>{job.scheduledTime}</span>
                              </div>
                              {!job.loadVerified && (
                                <div className="flex items-center gap-1 text-orange-500">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Verify load</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No jobs scheduled for today</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Crew Status */}
          {dashboardData?.crewStatus && dashboardData.crewStatus.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Crew Status</h2>
                <Badge variant="secondary">{dashboardData.crewStatus.length}</Badge>
              </div>
              <div className="space-y-2">
                {dashboardData.crewStatus.slice(0, 3).map((crew) => (
                  <Card key={crew.id}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{crew.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {crew.currentJob ? 'Working' : 'Available'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-primary font-semibold">{crew.jobsCompleted} done</p>
                          <p className="text-xs text-muted-foreground">{crew.jobsRemaining} remain</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Inventory Alerts */}
          {dashboardData?.inventoryAlerts && dashboardData.inventoryAlerts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Inventory Alerts</h2>
                <Badge variant="destructive">{dashboardData.inventoryAlerts.length}</Badge>
              </div>
              <div className="space-y-2">
                {dashboardData.inventoryAlerts.slice(0, 3).map((alert) => (
                  <Card key={alert.itemId} className="border-orange-500/20">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className={`w-5 h-5 shrink-0 ${
                          alert.severity === 'high' ? 'text-red-500' :
                          alert.severity === 'medium' ? 'text-orange-500' :
                          'text-yellow-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{alert.itemName}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {alert.alertType.replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Bottom padding */}
          <div className="h-4" />
        </div>
      </div>
    </MobileContainer>
  );
}
