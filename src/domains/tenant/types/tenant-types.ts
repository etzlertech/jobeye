// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/tenant/types/tenant-types.ts
// purpose: TypeScript interfaces and types for multi-tenant architecture with voice-first configuration and subscription management
// spec_ref: tenant#types
// version: 2025-08-1
// domain: tenant
// phase: 1
// complexity_budget: low
// offline_capability: REQUIRED
//
// dependencies:
//   - internal: []
//   - external: []
//
// exports:
//   - Tenant: interface - Core tenant/organization data with settings and branding
//   - TenantSettings: interface - Branding, features, and limits configuration
//   - TenantVoiceConfig: interface - Voice-specific settings with wake words and providers
//   - Subscription: interface - Subscription plan, status, and billing period
//   - BillingPlan: enum - Available subscription plans (free, starter, professional, enterprise)
//   - TenantInvitation: interface - User invitation data with expiration and role
//   - TenantAnalytics: interface - Usage analytics and metrics for tenant insights
//   - TenantUser: interface - User with tenant context and role information
//   - CreateTenantData: interface - Data required for tenant creation
//   - UpdateTenantData: interface - Data for tenant updates
//   - InviteUserData: interface - Data for inviting users to tenant
//
// voice_considerations: >
//   Voice configuration types should support multiple TTS/STT providers and custom voice branding.
//   Voice analytics should include confidence scores, command success rates, and usage patterns.
//   Voice settings should support tenant-specific wake words and pronunciation customization.
//
// security_considerations: >
//   All tenant types must support Row Level Security policies for data isolation.
//   Sensitive subscription data like billing information must be properly typed for encryption.
//   Voice pattern data must be designed for secure storage without exposing biometric details.
//
// performance_considerations: >
//   Types should be optimized for efficient serialization and caching.
//   Large objects like analytics should be paginated and lazily loaded.
//   Voice configuration should be cached separately for real-time access.
//
// tasks:
//   1. [ENUMS] Define BillingPlan enum with free, starter, professional, enterprise
//   2. [CORE] Create core Tenant interface with id, name, slug, domain, settings, is_active
//   3. [SETTINGS] Define TenantSettings with branding, features, and limits
//   4. [VOICE] Create TenantVoiceConfig with wake_words, tts_provider, stt_provider, voice_branding
//   5. [SUBSCRIPTION] Define Subscription interface with plan, status, current_period_end
//   6. [INVITATION] Create TenantInvitation interface for user invitations
//   7. [ANALYTICS] Define TenantAnalytics interface for usage metrics
//   8. [USER] Create TenantUser interface for users with tenant context
//   9. [CRUD] Create CRUD operation data transfer objects
//  10. [UTILITIES] Add utility types and type guards for validation
// --- END DIRECTIVE BLOCK ---

// =============================================
// ENUMS
// =============================================

/**
 * Available subscription plans with different capabilities
 */
export enum BillingPlan {
  FREE = 'free',
  STARTER = 'starter',
  PROFESSIONAL = 'professional', 
  ENTERPRISE = 'enterprise'
}

/**
 * Tenant lifecycle status
 */
export enum TenantStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  CANCELLED = 'cancelled',
  TRIAL = 'trial'
}

/**
 * Organization size categories
 */
export enum TenantSize {
  SMALL = 'small',        // 1-10 users
  MEDIUM = 'medium',      // 11-50 users
  LARGE = 'large',        // 51-200 users
  ENTERPRISE = 'enterprise' // 200+ users
}

/**
 * Domain verification methods
 */
export enum DomainVerificationMethod {
  DNS = 'dns',
  FILE = 'file',
  EMAIL = 'email'
}

/**
 * Time range options for analytics
 */
export type TimeRange = '24h' | '7d' | '30d' | '90d' | '1y';

// =============================================
// CORE TENANT INTERFACES
// =============================================

/**
 * Core tenant/organization interface
 */
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  display_name?: string;
  description?: string;
  
  // Domain and branding
  domain?: string;
  allowed_domains?: string[];
  
  // Configuration
  settings: TenantSettings;
  
  // Status and lifecycle
  is_active: boolean;
  
  // Audit fields
  created_at: string;
  updated_at: string;
}

/**
 * Tenant branding colors
 */
export interface TenantBrandColors {
  primary?: string;
  secondary?: string;
  accent?: string;
  background?: string;
  text?: string;
  success?: string;
  warning?: string;
  error?: string;
}

/**
 * Tenant settings with branding, features, and limits
 */
export interface TenantSettings {
  // Branding
  branding: {
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    company_name?: string;
  };
  
  // Feature toggles
  features: {
    voice_enabled: boolean;
    mobile_app: boolean;
    api_access: boolean;
    custom_branding: boolean;
    advanced_analytics: boolean;
  };
  
  // Usage limits
  limits: {
    max_users: number;
    max_storage_gb: number;
    max_api_calls_per_month: number;
    max_voice_minutes_per_month: number;
  };
}

/**
 * Webhook endpoint configuration
 */
export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  is_active: boolean;
  created_at: string;
}

/**
 * API rate limiting configuration
 */
export interface ApiRateLimits {
  requests_per_minute: number;
  requests_per_hour: number;
  requests_per_day: number;
  burst_limit: number;
}

// =============================================
// VOICE CONFIGURATION
// =============================================

/**
 * Tenant-specific voice configuration and branding
 */
export interface TenantVoiceConfig {
  id: string;
  tenant_id: string;
  
  // Voice identity and branding
  wake_words: string[];
  tts_provider: 'google' | 'openai' | 'system';
  stt_provider: 'google' | 'openai' | 'system';
  voice_branding: {
    voice_name?: string;
    greeting_message?: string;
    personality?: 'professional' | 'friendly' | 'casual';
  };
  
  // Language and speech settings
  language_code: string;
  speech_rate: number; // 0.5 - 2.0
  
  // Session settings
  session_timeout_minutes: number;
  confidence_threshold: number; // 0.1 - 1.0
  
  // Audit fields
  created_at: string;
  updated_at: string;
}

/**
 * Voice branding and identity settings
 */
export interface VoiceBranding {
  voice_name?: string;
  voice_personality?: 'professional' | 'friendly' | 'casual' | 'formal';
  greeting_messages: string[];
  error_messages: string[];
  confirmation_phrases: string[];
  voice_signature?: string; // Custom audio signature
}

/**
 * Voice command configuration
 */
export interface VoiceCommandConfig {
  command: string;
  aliases: string[];
  requires_confirmation: boolean;
  confidence_threshold?: number;
  context_required?: string[];
  response_template?: string;
}

/**
 * Voice accessibility features
 */
export interface VoiceAccessibilityFeatures {
  high_contrast_voice: boolean;
  slow_speech_mode: boolean;
  voice_descriptions: boolean;
  hearing_impaired_support: boolean;
  visual_voice_feedback: boolean;
  voice_to_text_display: boolean;
}

// =============================================
// SUBSCRIPTION AND BILLING
// =============================================

/**
 * Tenant subscription information
 */
export interface Subscription {
  id: string;
  tenant_id: string;
  
  // Subscription details
  plan: BillingPlan;
  status: 'active' | 'cancelled' | 'past_due' | 'unpaid' | 'trialing';
  
  // Billing period
  current_period_start: string;
  current_period_end: string;
  
  // Audit fields
  created_at: string;
  updated_at: string;
}

/**
 * Current subscription usage metrics
 */
export interface SubscriptionUsage {
  users_count: number;
  storage_used_gb: number;
  api_calls_this_month: number;
  voice_minutes_this_month: number;
  last_calculated_at: string;
}

// =============================================
// FEATURES AND CAPABILITIES
// =============================================

/**
 * Tenant feature flags and capabilities
 */
export interface TenantFeatures {
  id: string;
  tenant_id: string;
  
  // Core features
  voice_enabled: boolean;
  mobile_app: boolean;
  api_access: boolean;
  custom_branding: boolean;
  advanced_analytics: boolean;
  
  // Voice-specific features
  voice_biometrics: boolean;
  custom_wake_words: boolean;
  voice_analytics: boolean;
  multi_language_voice: boolean;
  
  // Integration features
  webhook_integrations: boolean;
  sso_enabled: boolean;
  ldap_sync: boolean;
  audit_logs: boolean;
  
  // Limits and quotas
  max_voice_minutes_per_month: number;
  max_api_calls_per_month: number;
  max_webhook_endpoints: number;
  
  // Feature flags
  beta_features: Record<string, boolean>;
  experimental_features: Record<string, boolean>;
  
  // Audit fields
  created_at: string;
  updated_at: string;
}

// =============================================
// DOMAIN MANAGEMENT
// =============================================

/**
 * Tenant domain configuration and verification
 */
export interface TenantDomain {
  id: string;
  tenant_id: string;
  
  // Domain details
  domain: string;
  is_primary: boolean;
  is_verified: boolean;
  
  // Verification
  verification_token?: string;
  verification_method: DomainVerificationMethod;
  verified_at?: string;
  
  // SSL and security
  ssl_enabled: boolean;
  ssl_cert_expires_at?: string;
  
  // Audit fields
  created_at: string;
  updated_at: string;
}

// =============================================
// USER MANAGEMENT
// =============================================

/**
 * User within tenant context
 */
export interface TenantUser {
  user_id: string;
  tenant_id: string;
  role: string;
  is_active: boolean;
  joined_at: string;
  last_accessed_at?: string;
  user: {
    display_name?: string;
    first_name?: string;
    last_name?: string;
    email: string;
    avatar_url?: string;
  };
}

/**
 * User invitation data
 */
export interface TenantInvitation {
  id: string;
  tenant_id: string;
  email: string;
  role: string;
  invitation_code: string;
  invited_by: string;
  invited_at: string;
  expires_at: string;
  accepted_at?: string;
  is_used: boolean;
  welcome_message?: string;
}

// =============================================
// CRUD DATA TRANSFER OBJECTS
// =============================================

/**
 * Data required for creating a new tenant
 */
export interface CreateTenantData {
  name: string;
  display_name?: string;
  description?: string;
  domain?: string;
  allowed_domains?: string[];
  settings?: Partial<TenantSettings>;
}

/**
 * Data for updating tenant information
 */
export interface UpdateTenantData {
  name?: string;
  display_name?: string;
  description?: string;
  domain?: string;
  allowed_domains?: string[];
  settings?: Partial<TenantSettings>;
  is_active?: boolean;
}

/**
 * Data for inviting a user to a tenant
 */
export interface InviteUserData {
  email: string;
  role: string;
  welcome_message?: string;
}

// =============================================
// ANALYTICS AND METRICS
// =============================================

/**
 * Tenant usage analytics and metrics
 */
export interface TenantAnalytics {
  tenant_id: string;
  period_start: string;
  period_end: string;
  
  // User metrics
  total_users: number;
  active_users: number;
  new_users: number;
  
  // Usage metrics
  total_sessions: number;
  voice_interactions: number;
  voice_success_rate: number;
  api_calls: number;
  storage_used_gb: number;
  
  // Top usage data
  top_voice_commands: Array<{ command: string; count: number }>;
  
  generated_at: string;
}

// =============================================
// UTILITY TYPES AND TYPE GUARDS
// =============================================

/**
 * Type guard to check if a billing plan is valid
 */
export const isValidBillingPlan = (plan: string): plan is BillingPlan => {
  return Object.values(BillingPlan).includes(plan as BillingPlan);
};

/**
 * Default tenant settings factory
 */
export const createDefaultTenantSettings = (): TenantSettings => ({
  branding: {
    company_name: undefined,
    logo_url: undefined,
    primary_color: '#007bff',
    secondary_color: '#6c757d'
  },
  features: {
    voice_enabled: true,
    mobile_app: true,
    api_access: false,
    custom_branding: false,
    advanced_analytics: false
  },
  limits: {
    max_users: 10,
    max_storage_gb: 5,
    max_api_calls_per_month: 1000,
    max_voice_minutes_per_month: 500
  }
});

/**
 * Plan capabilities mapping
 */
export const PLAN_CAPABILITIES: Record<BillingPlan, Partial<TenantSettings['limits']>> = {
  [BillingPlan.FREE]: {
    max_users: 3,
    max_storage_gb: 1,
    max_api_calls_per_month: 100,
    max_voice_minutes_per_month: 100
  },
  [BillingPlan.STARTER]: {
    max_users: 10,
    max_storage_gb: 5,
    max_api_calls_per_month: 1000,
    max_voice_minutes_per_month: 500
  },
  [BillingPlan.PROFESSIONAL]: {
    max_users: 50,
    max_storage_gb: 25,
    max_api_calls_per_month: 10000,
    max_voice_minutes_per_month: 2000
  },
  [BillingPlan.ENTERPRISE]: {
    max_users: 500,
    max_storage_gb: 100,
    max_api_calls_per_month: 100000,
    max_voice_minutes_per_month: 10000
  }
};