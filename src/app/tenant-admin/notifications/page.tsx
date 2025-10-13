/**
 * @file /src/app/tenant-admin/notifications/page.tsx
 * @phase 3.4.2
 * @domain tenant-admin
 * @purpose Notification system for tenant administrators
 * @spec_ref docs/admin-ui-specs.md#notification-system
 */

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ADMIN_CARD_CLASSES, 
  ADMIN_CARD_ITEM_CLASSES 
} from '@/app/admin/_constants/admin-ui-constants';
import {
  Bell,
  BellRing,
  Megaphone,
  MessageSquare,
  Settings,
  Users,
  Send,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Info,
  Zap,
  UserPlus,
  FileText,
  X
} from 'lucide-react';

type NotificationType = 'system' | 'announcement' | 'message' | 'approval' | 'user_activity';
type NotificationPriority = 'low' | 'medium' | 'high';

interface Notification {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  body: string;
  createdAt: string;
  creator?: {
    id: string;
    name: string | null;
  };
  scope: 'all' | 'role' | 'user';
  scopeTarget?: string;
  read?: boolean;
  actionUrl?: string;
  actionLabel?: string;
}

interface NotificationPreferences {
  approvals: boolean;
  userActivity: boolean;
  systemAlerts: boolean;
  announcements: boolean;
  jobUpdates: boolean;
}

// Mock data
const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'notif_001',
    type: 'approval',
    priority: 'high',
    title: 'New user invitation requires approval',
    body: 'Sarah Johnson has invited Mike Chen as a supervisor.',
    createdAt: '2025-10-13T10:00:00Z',
    scope: 'role',
    scopeTarget: 'admin',
    actionUrl: '/tenant-admin/approvals',
    actionLabel: 'Review Request'
  },
  {
    id: 'notif_002',
    type: 'system',
    priority: 'medium',
    title: 'Voice command integration is now available',
    body: 'Enable voice commands for your field crews to improve efficiency.',
    createdAt: '2025-10-12T15:30:00Z',
    scope: 'all',
    read: true,
    actionUrl: '/tenant-admin/onboarding',
    actionLabel: 'Configure'
  },
  {
    id: 'notif_003',
    type: 'user_activity',
    priority: 'low',
    title: 'New user logged in',
    body: 'Alex Rivera logged in for the first time from a mobile device.',
    createdAt: '2025-10-12T08:15:00Z',
    scope: 'role',
    scopeTarget: 'admin',
    read: true
  },
  {
    id: 'notif_004',
    type: 'announcement',
    priority: 'medium',
    title: 'Scheduled maintenance on October 15th',
    body: 'JobEye will undergo maintenance from 2:00 AM to 4:00 AM PST. Service may be temporarily unavailable.',
    createdAt: '2025-10-11T12:00:00Z',
    creator: {
      id: 'system',
      name: 'System Admin'
    },
    scope: 'all'
  },
  {
    id: 'notif_005',
    type: 'message',
    priority: 'medium',
    title: 'Direct message from Mike Torres',
    body: 'Can we discuss the new crew assignments for next week?',
    createdAt: '2025-10-11T09:30:00Z',
    creator: {
      id: 'usr_mike',
      name: 'Mike Torres'
    },
    scope: 'user',
    scopeTarget: 'sarah@greenworks.land',
    actionUrl: '#',
    actionLabel: 'Reply'
  }
];

const NOTIFICATION_ICONS = {
  system: { icon: Zap, color: 'text-blue-400', bgColor: 'bg-blue-500/10' },
  announcement: { icon: Megaphone, color: 'text-purple-400', bgColor: 'bg-purple-500/10' },
  message: { icon: MessageSquare, color: 'text-green-400', bgColor: 'bg-green-500/10' },
  approval: { icon: CheckCircle, color: 'text-yellow-400', bgColor: 'bg-yellow-500/10' },
  user_activity: { icon: UserPlus, color: 'text-slate-400', bgColor: 'bg-slate-500/10' }
};

const MESSAGE_TEMPLATES = [
  {
    id: 'welcome',
    name: 'Welcome Message',
    template: 'Welcome to GreenWorks Landscaping! We\'re excited to have you join our team.'
  },
  {
    id: 'maintenance',
    name: 'Maintenance Notice',
    template: 'We will be performing scheduled maintenance on [DATE]. The system will be unavailable from [START] to [END].'
  },
  {
    id: 'policy_update',
    name: 'Policy Update',
    template: 'Important: Our [POLICY_NAME] has been updated. Please review the changes at your earliest convenience.'
  },
  {
    id: 'training',
    name: 'Training Reminder',
    template: 'Reminder: [TRAINING_NAME] is scheduled for [DATE]. Please confirm your attendance.'
  }
];

export default function TenantNotificationsPage() {
  const [activeTab, setActiveTab] = useState<'feed' | 'compose' | 'preferences'>('feed');
  const [typeFilter, setTypeFilter] = useState<'all' | NotificationType>('all');
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [announcement, setAnnouncement] = useState({
    title: '',
    body: '',
    scope: 'all' as 'all' | 'role' | 'user',
    scopeTarget: ''
  });
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    approvals: true,
    userActivity: true,
    systemAlerts: true,
    announcements: true,
    jobUpdates: true
  });

  const filteredNotifications = MOCK_NOTIFICATIONS.filter(notification => {
    return typeFilter === 'all' || notification.type === typeFilter;
  });

  const unreadCount = MOCK_NOTIFICATIONS.filter(n => !n.read).length;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleSendAnnouncement = () => {
    // TODO: API call to send announcement
    console.log('Sending announcement:', announcement);
    setShowComposeModal(false);
    setAnnouncement({ title: '', body: '', scope: 'all', scopeTarget: '' });
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = MESSAGE_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setAnnouncement({
        ...announcement,
        title: template.name,
        body: template.template
      });
    }
    setSelectedTemplate(templateId);
  };

  const togglePreference = (key: keyof NotificationPreferences) => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Notifications</h2>
            <p className="text-sm text-slate-400">
              Manage announcements and communication with your team.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <Badge variant="destructive">
                {unreadCount} unread
              </Badge>
            )}
            <Button
              size="sm"
              className="bg-blue-500 text-white hover:bg-blue-400"
              onClick={() => setShowComposeModal(true)}
            >
              <Megaphone className="mr-2 h-3.5 w-3.5" />
              New Announcement
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Card className={ADMIN_CARD_CLASSES}>
          <CardContent className="py-4">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('feed')}
                className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
                  activeTab === 'feed'
                    ? 'bg-slate-200 text-slate-900'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Bell className="w-4 h-4" />
                Notification Feed
              </button>
              <button
                onClick={() => setActiveTab('preferences')}
                className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors ${
                  activeTab === 'preferences'
                    ? 'bg-slate-200 text-slate-900'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Settings className="w-4 h-4" />
                Preferences
              </button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Tab Content */}
      {activeTab === 'feed' && (
        <>
          {/* Filter */}
          <Card className={ADMIN_CARD_CLASSES}>
            <CardContent className="py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-400">Filter by type:</span>
                <div className="flex flex-wrap gap-2">
                  {['all', 'system', 'announcement', 'message', 'approval', 'user_activity'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setTypeFilter(type as any)}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${
                        typeFilter === type
                          ? 'bg-slate-200 text-slate-900'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {type === 'all' ? 'All' : type.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card className={ADMIN_CARD_CLASSES}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <BellRing className="w-5 h-5" />
                Recent Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {filteredNotifications.map((notification) => {
                const config = NOTIFICATION_ICONS[notification.type];
                const Icon = config.icon;
                
                return (
                  <div
                    key={notification.id}
                    className={`${ADMIN_CARD_ITEM_CLASSES} ${
                      !notification.read ? 'border-blue-500/30' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className={`rounded-md p-2 ${config.bgColor}`}>
                        <Icon className={`h-4 w-4 ${config.color}`} />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className={`text-sm font-semibold ${
                                notification.read ? 'text-slate-300' : 'text-white'
                              }`}>
                                {notification.title}
                              </h3>
                              {notification.priority === 'high' && (
                                <Badge className="bg-red-500/10 text-red-300 text-xs">
                                  High Priority
                                </Badge>
                              )}
                              {!notification.read && (
                                <div className="h-2 w-2 rounded-full bg-blue-400" />
                              )}
                            </div>
                            <p className={`text-sm ${
                              notification.read ? 'text-slate-500' : 'text-slate-400'
                            }`}>
                              {notification.body}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span>{formatDate(notification.createdAt)}</span>
                            {notification.creator && (
                              <>
                                <span>•</span>
                                <span>From {notification.creator.name}</span>
                              </>
                            )}
                            {notification.scope !== 'all' && (
                              <>
                                <span>•</span>
                                <Badge className="bg-slate-700 text-slate-300 text-xs">
                                  {notification.scope === 'role' ? notification.scopeTarget : notification.scope}
                                </Badge>
                              </>
                            )}
                          </div>
                          {notification.actionUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 border-slate-700 text-slate-200 text-xs"
                            >
                              {notification.actionLabel}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredNotifications.length === 0 && (
                <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-8 text-center">
                  <Info className="mx-auto mb-3 h-8 w-8 text-slate-500" />
                  <p className="text-sm text-slate-400">
                    No notifications to display.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === 'preferences' && (
        <Card className={ADMIN_CARD_CLASSES}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Settings className="w-5 h-5" />
              Notification Preferences
            </CardTitle>
            <p className="text-sm text-slate-400">
              Control which notifications you receive
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-white">Email Notifications</h4>
              <div className="space-y-3">
                {Object.entries({
                  approvals: 'Approval requests and decisions',
                  userActivity: 'User logins and role changes',
                  systemAlerts: 'System maintenance and issues',
                  announcements: 'Organization announcements',
                  jobUpdates: 'Job status changes and completions'
                }).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between p-3 rounded-lg border border-slate-700 bg-slate-800/30">
                    <span className="text-sm text-slate-300">{label}</span>
                    <button
                      onClick={() => togglePreference(key as keyof NotificationPreferences)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        preferences[key as keyof NotificationPreferences]
                          ? 'bg-blue-500'
                          : 'bg-slate-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          preferences[key as keyof NotificationPreferences]
                            ? 'translate-x-6'
                            : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <Separator className="bg-slate-700" />

            <div className="space-y-4">
              <h4 className="text-sm font-medium text-white">Message Templates</h4>
              <p className="text-xs text-slate-400">
                Pre-built templates for common announcements
              </p>
              <div className="space-y-2">
                {MESSAGE_TEMPLATES.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-slate-700 bg-slate-800/30"
                  >
                    <div>
                      <p className="text-sm font-medium text-white">{template.name}</p>
                      <p className="text-xs text-slate-400 mt-1">{template.template.substring(0, 60)}...</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleTemplateSelect(template.id);
                        setShowComposeModal(true);
                      }}
                      className="border-slate-700 text-slate-200"
                    >
                      Use
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button className="bg-blue-500 text-white hover:bg-blue-400">
                Save Preferences
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compose Modal */}
      {showComposeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto border-slate-800 bg-slate-900">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-white">
                  <Megaphone className="w-5 h-5" />
                  Create Announcement
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowComposeModal(false)}
                  className="text-slate-400"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Title
                </label>
                <Input
                  value={announcement.title}
                  onChange={(e) => setAnnouncement({ ...announcement, title: e.target.value })}
                  className="border-slate-700 bg-slate-800 text-white"
                  placeholder="Announcement title..."
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Message
                </label>
                <textarea
                  value={announcement.body}
                  onChange={(e) => setAnnouncement({ ...announcement, body: e.target.value })}
                  rows={6}
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder:text-slate-500"
                  placeholder="Type your message here..."
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Audience
                </label>
                <div className="space-y-3">
                  <select
                    value={announcement.scope}
                    onChange={(e) => setAnnouncement({ ...announcement, scope: e.target.value as any, scopeTarget: '' })}
                    className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white"
                  >
                    <option value="all">All users</option>
                    <option value="role">Specific role</option>
                    <option value="user">Specific user</option>
                  </select>

                  {announcement.scope === 'role' && (
                    <select
                      value={announcement.scopeTarget}
                      onChange={(e) => setAnnouncement({ ...announcement, scopeTarget: e.target.value })}
                      className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white"
                    >
                      <option value="">Select role...</option>
                      <option value="admin">Admins</option>
                      <option value="supervisor">Supervisors</option>
                      <option value="crew">Crew members</option>
                    </select>
                  )}

                  {announcement.scope === 'user' && (
                    <Input
                      value={announcement.scopeTarget}
                      onChange={(e) => setAnnouncement({ ...announcement, scopeTarget: e.target.value })}
                      className="border-slate-700 bg-slate-800 text-white"
                      placeholder="User email..."
                    />
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowComposeModal(false)}
                  className="flex-1 border-slate-700 text-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSendAnnouncement}
                  disabled={!announcement.title || !announcement.body}
                  className="flex-1 bg-blue-500 text-white hover:bg-blue-400"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Send Announcement
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}