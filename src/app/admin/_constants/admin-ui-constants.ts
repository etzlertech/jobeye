/**
 * @file /src/app/admin/_constants/admin-ui-constants.ts
 * @purpose Shared constants and types for admin UI components
 */

// Status colors used across admin components
export const ADMIN_STATUS_COLORS = {
  active: 'bg-emerald-500/10 text-emerald-300',
  suspended: 'bg-red-500/10 text-red-300',
  pending: 'bg-yellow-500/10 text-yellow-300',
  expired: 'bg-slate-600/20 text-slate-300',
  cancelled: 'bg-slate-600/20 text-slate-300'
} as const;

// Role colors for user management
export const ADMIN_ROLE_COLORS = {
  system_admin: 'bg-purple-500/10 text-purple-300',
  tenant_admin: 'bg-blue-500/10 text-blue-300',
  supervisor: 'bg-indigo-500/10 text-indigo-300',
  crew: 'bg-green-500/10 text-green-300'
} as const;

// Plan colors for tenant management
export const ADMIN_PLAN_COLORS = {
  trial: 'bg-slate-700/60 text-slate-200',
  free: 'bg-slate-800/60 text-slate-200',
  starter: 'bg-blue-500/10 text-blue-300',
  pro: 'bg-indigo-500/10 text-indigo-300',
  enterprise: 'bg-amber-500/10 text-amber-300'
} as const;

// Security flag colors for user management
export const ADMIN_SECURITY_FLAG_COLORS = {
  system_admin: 'bg-purple-500/10 text-purple-300',
  new_account: 'bg-blue-500/10 text-blue-300',
  multiple_failed_logins: 'bg-red-500/10 text-red-300',
  suspicious_activity: 'bg-orange-500/10 text-orange-300'
} as const;

// Common card styling
export const ADMIN_CARD_CLASSES = 'border border-slate-800 bg-slate-900/60';
export const ADMIN_CARD_ITEM_CLASSES = 'rounded-lg border border-slate-800 bg-slate-900/50 p-4 transition hover:border-slate-700';

// Status badge utility
export const getStatusBadgeClass = (status: keyof typeof ADMIN_STATUS_COLORS) => {
  return ADMIN_STATUS_COLORS[status] || 'bg-slate-600/20 text-slate-300';
};

// Role badge utility
export const getRoleBadgeClass = (role: keyof typeof ADMIN_ROLE_COLORS) => {
  return ADMIN_ROLE_COLORS[role] || 'bg-slate-600/20 text-slate-300';
};

// Plan badge utility  
export const getPlanBadgeClass = (plan: keyof typeof ADMIN_PLAN_COLORS) => {
  return ADMIN_PLAN_COLORS[plan] || 'bg-slate-800/60 text-slate-300';
};

// Security flag badge utility
export const getSecurityFlagBadgeClass = (flag: keyof typeof ADMIN_SECURITY_FLAG_COLORS) => {
  return ADMIN_SECURITY_FLAG_COLORS[flag] || 'bg-gray-500/10 text-gray-300';
};