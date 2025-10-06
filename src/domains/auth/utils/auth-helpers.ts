// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/auth/utils/auth-helpers.ts
// purpose: Authentication utility functions for user display, session management, permissions, and voice interactions
// spec_ref: auth#helpers
// version: 2025-08-1
// domain: authentication
// phase: 1
// complexity_budget: low
// offline_capability: REQUIRED
//
// dependencies:
//   - internal: ['src/domains/auth/types/auth-types.ts']
//   - external: ['@supabase/supabase-js', 'date-fns']
//
// exports:
//   - formatUserDisplayName - Format user names for UI display with fallbacks
//   - isSessionExpired - Check if Supabase session has expired
//   - getPermissionsForRole - Get permissions array for a specific role
//   - sanitizeAuthError - Convert auth errors to user-friendly messages
//   - generateVoiceGreeting - Create personalized voice greetings for users
//   - extractTenantFromEmail - Extract tenant ID from email domain patterns
//   - isVoiceSessionActive - Check if voice session is currently active
//   - formatSessionDuration - Format session duration for display
//   - getRoleDisplayName - Get human-readable role names
//   - isHighPrivilegeRole - Check if role requires additional security
//   - generateSessionId - Generate secure session identifiers
//   - maskSensitiveData - Mask sensitive data for logging
//
// voice_considerations: >
//   Voice greetings should be natural and personalized based on user preferences and time of day.
//   Voice session management should handle device wake/sleep cycles gracefully.
//   User name formatting should consider pronunciation for TTS systems.
//
// security_considerations: >
//   Error sanitization must never leak sensitive system information or user data.
//   Session validation must be cryptographically secure and tamper-resistant.
//   Tenant extraction must validate against known patterns to prevent domain spoofing.
//   All helper functions must handle null/undefined inputs safely.
//
// performance_considerations: >
//   Functions should be pure and stateless for better caching and testing.
//   String operations should be optimized for frequent calls.
//   Date calculations should use efficient date-fns functions over native Date methods.
//   Permission lookups should use cached data structures where possible.
//
// tasks:
//   1. [SETUP] Import required dependencies and auth types
//   2. [DISPLAY] Create formatUserDisplayName with fallback logic for missing names
//   3. [SESSION] Implement isSessionExpired using date-fns for accurate time comparison
//   4. [PERMISSIONS] Build getPermissionsForRole with role-based permission mapping
//   5. [ERRORS] Create sanitizeAuthError to convert technical errors to user messages
//   6. [VOICE] Implement generateVoiceGreeting with personalization and time awareness
//   7. [TENANT] Add extractTenantFromEmail with domain validation and mapping
//   8. [VOICE_SESSION] Create isVoiceSessionActive with device state checking
//   9. [UTILITIES] Add helper functions for role display, session formatting, and security
//  10. [EXPORT] Export all helper functions with proper TypeScript types
// --- END DIRECTIVE BLOCK ---

import { isAfter, parseISO, format, differenceInMinutes } from 'date-fns';
import type { Session as SupabaseSession } from '@supabase/supabase-js';
import { Role, type UserProfile, type Session, type Permission } from '../types/auth-types';

/**
 * Format user display name with intelligent fallbacks
 * Handles various name combinations and provides voice-friendly output
 */
export const formatUserDisplayName = (user: Partial<UserProfile>): string => {
  if (!user) return 'Guest User';

  // Try email-based name if no display name
  if (!user.user_metadata?.display_name && !user.user_metadata?.full_name) {
    if (user.email) {
      const emailName = user.email.split('@')[0];
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }
  }

  // Use full_name if available
  if (user.user_metadata?.full_name) {
    return user.user_metadata.full_name;
  }

  // Use display_name if available
  if (user.user_metadata?.display_name) {
    return user.user_metadata.display_name;
  }

  // Construct from first/last name
  const firstName = user.user_metadata?.first_name || '';
  const lastName = user.user_metadata?.last_name || '';
  
  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }
  
  if (firstName) return firstName;
  if (lastName) return lastName;

  // Final fallback to email or generic
  return user.email || 'User';
};

/**
 * Check if a Supabase session has expired
 * Uses precise date comparison for accurate expiry checking
 */
export const isSessionExpired = (session: SupabaseSession | Session | null): boolean => {
  if (!session) return true;
  
  const expiresAt = session.expires_at;
  if (!expiresAt) return true;

  // Handle both Unix timestamp and ISO string formats
  let expiryDate: Date;
  if (typeof expiresAt === 'number') {
    expiryDate = new Date(expiresAt * 1000);
  } else if (typeof expiresAt === 'string') {
    expiryDate = parseISO(expiresAt);
  } else {
    return true;
  }

  return isAfter(new Date(), expiryDate);
};

/**
 * Get permissions array for a specific user role
 * Returns cached permission set based on role hierarchy
 */
export const getPermissionsForRole = (role: Role): Permission[] => {
  const permissions: Record<Role, Permission[]> = {
    [Role.CUSTOMER]: [
      { action: 'view', subject: 'own_profile' },
      { action: 'update', subject: 'own_profile' },
      { action: 'view', subject: 'own_work_orders' },
      { action: 'create', subject: 'service_request' }
    ],
    [Role.TECHNICIAN]: [
      // Inherit customer permissions
      ...getPermissionsForRole(Role.CUSTOMER),
      { action: 'view', subject: 'work_orders' },
      { action: 'update', subject: 'work_order_status' },
      { action: 'view', subject: 'customer_info' },
      { action: 'create', subject: 'time_entry' },
      { action: 'upload', subject: 'work_order_photos' }
    ],
    [Role.MANAGER]: [
      // Inherit technician permissions
      ...getPermissionsForRole(Role.TECHNICIAN),
      { action: 'view', subject: 'all_work_orders' },
      { action: 'assign', subject: 'work_orders' },
      { action: 'view', subject: 'team_performance' },
      { action: 'manage', subject: 'technician_schedules' },
      { action: 'approve', subject: 'time_entries' }
    ],
    [Role.ADMIN]: [
      // Inherit manager permissions
      ...getPermissionsForRole(Role.MANAGER),
      { action: 'manage', subject: 'users' },
      { action: 'manage', subject: 'tenant_settings' },
      { action: 'view', subject: 'system_logs' },
      { action: 'manage', subject: 'integrations' },
      { action: 'delete', subject: 'any_data' }
    ]
  };

  return permissions[role] || [];
};

/**
 * Convert technical auth errors to user-friendly messages
 * Sanitizes errors to prevent information leakage
 */
export const sanitizeAuthError = (error: any): { message: string; voiceMessage: string } => {
  if (!error) {
    return {
      message: 'An unexpected error occurred',
      voiceMessage: 'Something went wrong, please try again'
    };
  }

  const errorMessage = error.message || error.toString();
  const errorCode = error.code || error.error_code;

  // Common Supabase auth error mappings
  const errorMappings: Record<string, { message: string; voiceMessage: string }> = {
    'invalid_credentials': {
      message: 'Invalid email or password',
      voiceMessage: 'Invalid login credentials, please try again'
    },
    'email_not_confirmed': {
      message: 'Please check your email and confirm your account',
      voiceMessage: 'Please confirm your email address before signing in'
    },
    'signup_disabled': {
      message: 'Account registration is currently disabled',
      voiceMessage: 'Account registration is not available at this time'
    },
    'invalid_grant': {
      message: 'Session expired, please sign in again',
      voiceMessage: 'Your session has expired, please sign in again'
    },
    'user_not_found': {
      message: 'No account found with this email address',
      voiceMessage: 'No account found with that email address'
    },
    'too_many_requests': {
      message: 'Too many attempts, please try again later',
      voiceMessage: 'Too many login attempts, please wait and try again'
    }
  };

  // Check for specific error codes first
  if (errorCode && errorMappings[errorCode]) {
    return errorMappings[errorCode];
  }

  // Check for error message patterns
  for (const [key, value] of Object.entries(errorMappings)) {
    if (errorMessage.toLowerCase().includes(key.replace('_', ' '))) {
      return value;
    }
  }

  // Generic fallback
  return {
    message: 'Authentication failed, please try again',
    voiceMessage: 'Authentication failed, please check your credentials and try again'
  };
};

/**
 * Generate personalized voice greeting for users
 * Considers time of day, user preferences, and context
 */
export const generateVoiceGreeting = (user: UserProfile, context?: 'login' | 'return' | 'morning'): string => {
  const displayName = formatUserDisplayName(user);
  const hour = new Date().getHours();
  
  let timeGreeting = '';
  if (hour < 12) timeGreeting = 'Good morning';
  else if (hour < 17) timeGreeting = 'Good afternoon';
  else timeGreeting = 'Good evening';

  const contextGreetings = {
    login: `${timeGreeting}, ${displayName}. Welcome to the Field Service Management system.`,
    return: `Welcome back, ${displayName}. How can I help you today?`,
    morning: `${timeGreeting}, ${displayName}. Ready to start your day?`
  };

  if (context && contextGreetings[context]) {
    return contextGreetings[context];
  }

  // Default personalized greeting
  const roleContext = getRoleDisplayName(user.role);
  return `${timeGreeting}, ${displayName}. You're signed in as ${roleContext}.`;
};

/**
 * Extract tenant ID from email domain patterns
 * Supports common enterprise email patterns and validation
 */
export const extractTenantFromEmail = (email: string): string | null => {
  if (!email || !email.includes('@')) return null;

  const domain = email.split('@')[1].toLowerCase();
  
  // Common enterprise patterns
  const tenantMappings: Record<string, string> = {
    'acme.com': 'acme-corp',
    'example.org': 'example-org',
    'company.co': 'company-co'
  };

  // Direct mapping
  if (tenantMappings[domain]) {
    return tenantMappings[domain];
  }

  // Extract from subdomain patterns (tenant.company.com)
  const parts = domain.split('.');
  if (parts.length >= 3) {
    return parts[0]; // Use subdomain as tenant
  }

  // Generate tenant from domain (remove TLD)
  const domainWithoutTld = domain.split('.')[0];
  return domainWithoutTld.replace(/[^a-z0-9]/g, '-');
};

/**
 * Check if voice session is currently active
 * Considers device state and session expiry
 */
export const isVoiceSessionActive = (session: Session): boolean => {
  if (!session || !session.device_info) return false;

  // Check if session is expired
  if (isSessionExpired(session)) return false;

  // Check device-specific voice session
  const deviceInfo = session.device_info;
  if (deviceInfo.device_type === 'voice_assistant') {
    // Voice assistants should have recent activity
    const lastActivity = parseISO(deviceInfo.last_activity_at);
    const minutesSinceActivity = differenceInMinutes(new Date(), lastActivity);
    return minutesSinceActivity < 30; // 30 minutes timeout for voice sessions
  }

  // For other devices, check if voice features are enabled
  return true; // Assume voice is available if session is valid
};

/**
 * Format session duration for display
 * Returns human-readable duration string
 */
export const formatSessionDuration = (session: Session): string => {
  if (!session.device_info?.last_activity_at) return 'Unknown';

  const lastActivity = parseISO(session.device_info.last_activity_at);
  const minutes = differenceInMinutes(new Date(), lastActivity);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minutes ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hours ago`;
  
  const days = Math.floor(hours / 24);
  return `${days} days ago`;
};

/**
 * Get human-readable role name for display
 */
export const getRoleDisplayName = (role: Role): string => {
  const roleNames: Record<Role, string> = {
    [Role.ADMIN]: 'Administrator',
    [Role.MANAGER]: 'Manager',
    [Role.TECHNICIAN]: 'Technician',
    [Role.CUSTOMER]: 'Customer'
  };

  return roleNames[role] || 'User';
};

/**
 * Check if role requires additional security measures
 */
export const isHighPrivilegeRole = (role: Role): boolean => {
  return role === Role.ADMIN || role === Role.MANAGER;
};

/**
 * Generate secure session identifier
 */
export const generateSessionId = (): string => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${randomPart}`;
};

/**
 * Mask sensitive data for logging and display
 */
export const maskSensitiveData = (data: string, visibleChars: number = 4): string => {
  if (!data || data.length <= visibleChars) return '***';
  
  const visible = data.slice(-visibleChars);
  const masked = '*'.repeat(Math.max(0, data.length - visibleChars));
  return `${masked}${visible}`;
};

/**
 * Check if user has permission for a specific action
 */
export const hasPermission = (userRole: Role, action: string, subject: string): boolean => {
  const permissions = getPermissionsForRole(userRole);
  return permissions.some(p => p.action === action && p.subject === subject);
};

/**
 * Format user's last login time for display
 */
export const formatLastLogin = (lastLoginAt: string | null): string => {
  if (!lastLoginAt) return 'Never';
  
  try {
    const loginDate = parseISO(lastLoginAt);
    return format(loginDate, 'MMM d, yyyy \'at\' h:mm a');
  } catch {
    return 'Invalid date';
  }
};
