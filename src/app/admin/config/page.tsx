/**
 * @file /src/app/admin/config/page.tsx
 * @phase 3.3.2
 * @domain admin
 * @purpose System Configuration for feature flags, maintenance, and settings
 * @spec_ref admin-ui-wireframes.md#phase-332--system-configuration
 */

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { ADMIN_CARD_CLASSES } from '../_constants/admin-ui-constants';
import {
  Settings,
  ToggleLeft,
  ToggleRight,
  Calendar,
  Mail,
  Zap,
  AlertTriangle,
  CheckCircle,
  Save,
  RefreshCw,
  Wrench
} from 'lucide-react';

interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  environments: Array<{
    env: 'development' | 'staging' | 'production';
    enabled: boolean;
  }>;
  lastUpdated: string;
  updatedBy: string;
}

interface MaintenanceSchedule {
  enabled: boolean;
  startsAt?: string;
  endsAt?: string;
  message?: string;
}

// Mock data based on contracts
const FEATURE_FLAGS: FeatureFlag[] = [
  {
    key: 'voice_commands_v2',
    name: 'Voice Commands V2',
    description: 'Enable enhanced voice command processing with improved accuracy',
    environments: [
      { env: 'development', enabled: true },
      { env: 'staging', enabled: true },
      { env: 'production', enabled: false }
    ],
    lastUpdated: '2025-10-12T14:30:00Z',
    updatedBy: 'admin@jobeye.com'
  },
  {
    key: 'advanced_vision_analytics',
    name: 'Advanced Vision Analytics',
    description: 'ML-powered object detection and inventory verification',
    environments: [
      { env: 'development', enabled: true },
      { env: 'staging', enabled: false },
      { env: 'production', enabled: false }
    ],
    lastUpdated: '2025-10-11T09:15:00Z',
    updatedBy: 'admin@jobeye.com'
  },
  {
    key: 'real_time_notifications',
    name: 'Real-time Notifications',
    description: 'WebSocket-based real-time updates for job status changes',
    environments: [
      { env: 'development', enabled: true },
      { env: 'staging', enabled: true },
      { env: 'production', enabled: true }
    ],
    lastUpdated: '2025-10-10T16:45:00Z',
    updatedBy: 'admin@jobeye.com'
  },
  {
    key: 'tenant_onboarding_v3',
    name: 'Tenant Onboarding V3',
    description: 'Streamlined tenant setup with automated provisioning',
    environments: [
      { env: 'development', enabled: true },
      { env: 'staging', enabled: false },
      { env: 'production', enabled: false }
    ],
    lastUpdated: '2025-10-09T11:20:00Z',
    updatedBy: 'admin@jobeye.com'
  }
];

const EMAIL_TEMPLATES = [
  { id: 'tenant_welcome', name: 'Tenant Welcome', lastUpdated: '2025-10-05' },
  { id: 'user_invitation', name: 'User Invitation', lastUpdated: '2025-10-03' },
  { id: 'job_completion_alert', name: 'Job Completion Alert', lastUpdated: '2025-10-01' },
  { id: 'maintenance_notification', name: 'Maintenance Notification', lastUpdated: '2025-09-28' }
];

const INTEGRATION_STATUS = [
  { name: 'Supabase', status: 'healthy', lastCheck: '2m ago', responseTime: '45ms' },
  { name: 'Voice Service', status: 'warning', lastCheck: '5m ago', responseTime: '890ms' },
  { name: 'Vision API', status: 'healthy', lastCheck: '3m ago', responseTime: '120ms' },
  { name: 'Email Service', status: 'healthy', lastCheck: '1m ago', responseTime: '67ms' }
];

export default function SystemConfigurationPage() {
  const [activeTab, setActiveTab] = useState<'features' | 'maintenance' | 'email' | 'integrations' | 'alerts'>('features');
  const [featureFlags, setFeatureFlags] = useState(FEATURE_FLAGS);
  const [maintenanceSchedule, setMaintenanceSchedule] = useState<MaintenanceSchedule>({
    enabled: false,
    startsAt: '',
    endsAt: '',
    message: ''
  });

  const tabs = [
    { id: 'features', label: 'Feature Flags', icon: ToggleLeft },
    { id: 'maintenance', label: 'Maintenance', icon: Wrench },
    { id: 'email', label: 'Email Templates', icon: Mail },
    { id: 'integrations', label: 'Integrations', icon: Zap },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle }
  ] as const;

  const toggleFeatureFlag = (flagKey: string, env: 'development' | 'staging' | 'production') => {
    setFeatureFlags(flags => 
      flags.map(flag => 
        flag.key === flagKey 
          ? {
              ...flag,
              environments: flag.environments.map(e => 
                e.env === env ? { ...e, enabled: !e.enabled } : e
              ),
              lastUpdated: new Date().toISOString(),
              updatedBy: 'admin@jobeye.com'
            }
          : flag
      )
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-emerald-400';
      case 'warning':
        return 'text-yellow-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">System Configuration</h2>
            <p className="text-sm text-slate-400">
              Manage feature flags, maintenance windows, and system-wide settings.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="border-slate-700 text-slate-200">
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Reload Config
            </Button>
            <Button size="sm" className="bg-emerald-500 text-black hover:bg-emerald-400">
              <Save className="mr-2 h-3.5 w-3.5" />
              Save Changes
            </Button>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <Card className={ADMIN_CARD_CLASSES}>
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
                    activeTab === tab.id
                      ? 'bg-slate-200 text-slate-900'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tab Content */}
      {activeTab === 'features' && (
        <Card className={ADMIN_CARD_CLASSES}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <ToggleLeft className="w-5 h-5" />
              Feature Flags
            </CardTitle>
            <p className="text-sm text-slate-400">
              Control feature rollouts across different environments.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {featureFlags.map((flag) => (
              <div key={flag.key} className="border border-slate-800 rounded-lg p-4 bg-slate-900/50">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold text-white">{flag.name}</h3>
                    <p className="text-sm text-slate-400">{flag.description}</p>
                    <div className="text-xs text-slate-500">
                      Last updated {new Date(flag.lastUpdated).toLocaleDateString()} by {flag.updatedBy}
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    {flag.environments.map((env) => (
                      <div key={env.env} className="flex flex-col items-center gap-2">
                        <div className="text-xs text-slate-400 capitalize">{env.env}</div>
                        <button
                          onClick={() => toggleFeatureFlag(flag.key, env.env)}
                          className="flex items-center"
                        >
                          {env.enabled ? (
                            <ToggleRight className="w-8 h-8 text-emerald-400" />
                          ) : (
                            <ToggleLeft className="w-8 h-8 text-slate-600" />
                          )}
                        </button>
                        <div className={`text-xs ${env.enabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {env.enabled ? 'ON' : 'OFF'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {activeTab === 'maintenance' && (
        <Card className={ADMIN_CARD_CLASSES}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Wrench className="w-5 h-5" />
              Maintenance Mode
            </CardTitle>
            <p className="text-sm text-slate-400">
              Schedule system maintenance windows with user notifications.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMaintenanceSchedule(prev => ({ ...prev, enabled: !prev.enabled }))}
                className="flex items-center"
              >
                {maintenanceSchedule.enabled ? (
                  <ToggleRight className="w-8 h-8 text-emerald-400" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-slate-600" />
                )}
              </button>
              <div>
                <h3 className="text-sm font-medium text-white">Maintenance Mode</h3>
                <p className="text-xs text-slate-400">
                  {maintenanceSchedule.enabled ? 'Scheduled' : 'Disabled'}
                </p>
              </div>
            </div>
            
            {maintenanceSchedule.enabled && (
              <div className="space-y-4 p-4 bg-slate-800/50 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Start Time
                    </label>
                    <Input
                      type="datetime-local"
                      value={maintenanceSchedule.startsAt}
                      onChange={(e) => setMaintenanceSchedule(prev => ({ ...prev, startsAt: e.target.value }))}
                      className="border-slate-700 bg-slate-900 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      End Time
                    </label>
                    <Input
                      type="datetime-local"
                      value={maintenanceSchedule.endsAt}
                      onChange={(e) => setMaintenanceSchedule(prev => ({ ...prev, endsAt: e.target.value }))}
                      className="border-slate-700 bg-slate-900 text-slate-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Maintenance Message
                  </label>
                  <Input
                    placeholder="System will be unavailable for scheduled maintenance..."
                    value={maintenanceSchedule.message}
                    onChange={(e) => setMaintenanceSchedule(prev => ({ ...prev, message: e.target.value }))}
                    className="border-slate-700 bg-slate-900 text-slate-100"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'email' && (
        <Card className={ADMIN_CARD_CLASSES}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Mail className="w-5 h-5" />
              Email Templates
            </CardTitle>
            <p className="text-sm text-slate-400">
              Manage system email templates and notifications.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {EMAIL_TEMPLATES.map((template) => (
              <div key={template.id} className="flex items-center justify-between p-3 border border-slate-800 rounded-lg bg-slate-900/50">
                <div>
                  <h3 className="text-sm font-medium text-white">{template.name}</h3>
                  <p className="text-xs text-slate-400">Last updated {template.lastUpdated}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="border-slate-700 text-slate-200">
                    Preview
                  </Button>
                  <Button variant="outline" size="sm" className="border-slate-700 text-slate-200">
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {activeTab === 'integrations' && (
        <Card className={ADMIN_CARD_CLASSES}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Zap className="w-5 h-5" />
              Integration Health
            </CardTitle>
            <p className="text-sm text-slate-400">
              Monitor external service connections and API health.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {INTEGRATION_STATUS.map((integration) => (
              <div key={integration.name} className="flex items-center justify-between p-3 border border-slate-800 rounded-lg bg-slate-900/50">
                <div className="flex items-center gap-3">
                  {getStatusIcon(integration.status)}
                  <div>
                    <h3 className="text-sm font-medium text-white">{integration.name}</h3>
                    <p className="text-xs text-slate-400">
                      {integration.responseTime} response • Checked {integration.lastCheck}
                    </p>
                  </div>
                </div>
                <Badge className={`${getStatusColor(integration.status).replace('text-', 'text-')} bg-transparent border-current`}>
                  {integration.status.toUpperCase()}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {activeTab === 'alerts' && (
        <Card className={ADMIN_CARD_CLASSES}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <AlertTriangle className="w-5 h-5" />
              Alert Configuration
            </CardTitle>
            <p className="text-sm text-slate-400">
              Configure system monitoring and alert thresholds.
            </p>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-slate-400">
              Alert configuration interface will be implemented in a future update.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}