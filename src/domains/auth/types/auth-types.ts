// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/auth/types/auth.types.ts
// purpose: Defines all TypeScript interfaces and enums for the authentication domain, ensuring type safety across services and components.
// spec_ref: auth#types
// version: 2025-08-1
// domain: authentication
// phase: 1
// complexity_budget: low
// offline_capability: REQUIRED
//
// dependencies:
//   - internal: []
//   - external: ['@supabase/supabase-js']
//
// exports:
//   - interface UserProfile - Extends Supabase user with app-specific data.
//   - interface Session - Represents an active user session with device info.
//   - interface Permission - Defines a specific action a role can perform.
//   - interface MFAChallenge - Represents a multi-factor authentication challenge.
//   - enum Role - Defines the user roles within a tenant.
//   - type AuthResult - The combined result of a successful authentication operation.
//
// voice_considerations: >
//   Includes specific types for voice preferences within the UserProfile to allow for personalized voice interactions.
//
// security_considerations: >
//   Types must not expose sensitive data like password hashes. All sensitive data is handled by Supabase directly.
//
// performance_considerations: >
//   Types are lightweight and designed for efficient serialization and caching for offline use.
//
// tasks:
//   1. [SETUP] Import the `User` and `Session` types from the `@supabase/supabase-js` library.
//   2. [ENUM] Define the `Role` enum with values: 'admin', 'manager', 'technician', 'customer'.
//   3. [USER] Create the `UserProfile` interface, extending the Supabase `User` type with fields for `role: Role`, `active_tenant_id: string`, and `voice_preferences: object`.
//   4. [SESSION] Define the `Session` interface, extending the Supabase `Session` type with `device_info: object` for tracking.
//   5. [PERMISSIONS] Create a `Permission` interface with `action: string` (e.g., 'delete_job') and `subject: string` (e.g., 'work_order').
//   6. [MFA] Define an `MFAChallenge` interface with `type: 'totp' | 'sms'` and a `challenge_id: string`.
//   7. [RESULT] Create the `AuthResult` type, which is an object containing `{ user: UserProfile, session: Session }`.
//   8. [DTOs] Define Data Transfer Object interfaces like `LoginDto` and `RegisterDto` for API validation.
//   9. [GUARDS] Add type guards (e.g., `isManager(role: Role)`) for easy role checking.
//  10. [DOCUMENTATION] Add TSDoc comments to all exported types and enums explaining their purpose.
// --- END DIRECTIVE BLOCK ---

import type { User as SupabaseUser, Session as SupabaseSession } from '@supabase/supabase-js';

/**
 * User roles within a tenant with hierarchical permissions
 */
export enum Role {
  ADMIN = 'admin',
  MANAGER = 'manager',
  TECHNICIAN = 'technician',
  CUSTOMER = 'customer'
}

/**
 * Extended user profile that includes app-specific data
 * Extends Supabase User with tenant and voice preferences
 */
export interface UserProfile extends SupabaseUser {
  role: Role;
  active_tenant_id: string;
  voice_preferences: {
    wake_word?: string;
    speech_rate: number;
    preferred_language: string;
    voice_feedback_enabled: boolean;
    preferred_tts_provider: 'google' | 'openai' | 'system';
  };
}

/**
 * Active user session with device tracking information
 * Extends Supabase Session with device and security data
 */
export interface Session extends SupabaseSession {
  device_info: {
    device_id: string;
    device_name?: string;
    device_type: 'mobile' | 'desktop' | 'tablet' | 'voice_assistant';
    ip_address: string;
    user_agent?: string;
    last_activity_at: string;
  };
}

/**
 * RBAC permission definition for resource-action authorization
 */
export interface Permission {
  action: string; // e.g., 'delete_job', 'view_customer'
  subject: string; // e.g., 'work_order', 'customer_data'
  conditions?: Record<string, any>; // Optional context-based conditions
}

/**
 * Multi-factor authentication challenge data
 */
export interface MFAChallenge {
  type: 'totp' | 'sms';
  challenge_id: string;
  expires_at: string;
  remaining_attempts: number;
}

/**
 * Combined authentication result with user and session data
 */
export type AuthResult = {
  user: UserProfile;
  session: Session;
};

/**
 * Login request payload for authentication
 */
export interface LoginDto {
  email: string;
  password: string;
  tenant_id?: string;
  mfa_code?: string;
}

/**
 * User registration request payload
 */
export interface RegisterDto {
  email: string;
  password: string;
  tenant_id: string;
  role: Role;
  voice_preferences?: UserProfile['voice_preferences'];
}

/**
 * Type guard to check if a role is manager or higher
 */
export const isManager = (role: Role): boolean => {
  return role === Role.MANAGER || role === Role.ADMIN;
};

/**
 * Type guard to check if a role is admin
 */
export const isAdmin = (role: Role): boolean => {
  return role === Role.ADMIN;
};

/**
 * Type guard to check if a role has technician privileges
 */
export const isTechnician = (role: Role): boolean => {
  return role === Role.TECHNICIAN || isManager(role);
};

/**
 * Role hierarchy for permission checking
 */
export const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.CUSTOMER]: 1,
  [Role.TECHNICIAN]: 2,
  [Role.MANAGER]: 3,
  [Role.ADMIN]: 4,
};

/**
 * Check if one role has equal or higher privileges than another
 */
export const hasRoleOrHigher = (userRole: Role, requiredRole: Role): boolean => {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
};