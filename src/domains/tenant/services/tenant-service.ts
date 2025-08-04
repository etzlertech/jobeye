// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/tenant/services/tenant-service.ts
// purpose: Core tenant management service for multi-tenant architecture with organization setup, user management, and voice-first configuration
// spec_ref: tenant#service
// version: 2025-08-1
// domain: tenant
// phase: 1
// complexity_budget: high
// offline_capability: OPTIONAL
//
// dependencies:
//   - internal: ['src/core/database/connection.ts', 'src/core/logger/logger.ts', 'src/core/errors/error-types.ts', 'src/domains/tenant/types/tenant-types.ts', 'src/domains/tenant/repositories/tenant-repository.ts']
//   - external: ['@supabase/supabase-js']
//
// exports:
//   - TenantService: class - Main tenant management service with organization lifecycle
//   - createTenant(tenantData: CreateTenantData): Promise<Tenant> - Create new organization with setup
//   - getTenant(tenantId: string): Promise<Tenant | null> - Get tenant by ID with caching
//   - updateTenant(tenantId: string, updates: UpdateTenantData): Promise<Tenant> - Update tenant configuration
//   - deleteTenant(tenantId: string): Promise<void> - Soft delete tenant with data retention
//   - getTenantByDomain(domain: string): Promise<Tenant | null> - Domain-based tenant lookup
//   - validateTenantAccess(userId: string, tenantId: string): Promise<boolean> - Access validation
//   - getTenantUsers(tenantId: string, role?: UserRole): Promise<User[]> - List tenant users
//   - inviteUser(tenantId: string, inviteData: InviteUserData): Promise<Invitation> - User invitation
//   - setupTenantVoiceConfig(tenantId: string, config: VoiceConfig): Promise<void> - Voice setup
//   - getTenantAnalytics(tenantId: string, timeRange: TimeRange): Promise<TenantAnalytics> - Usage analytics
//   - switchUserTenant(userId: string, tenantId: string): Promise<void> - Tenant switching for users
//
// voice_considerations: >
//   Tenant voice configuration should support organization-specific wake words and voice branding.
//   Voice analytics should track organization-wide voice usage patterns and performance metrics.
//   Voice setup should include tenant-specific TTS voices and speech recognition settings.
//   Multi-tenant voice isolation should prevent cross-tenant voice data access.
//
// security_considerations: >
//   All tenant operations must enforce strict data isolation between organizations.
//   Tenant access validation must prevent unauthorized cross-tenant data access.
//   User invitations must be validated against tenant domain policies and approval workflows.
//   Tenant deletion must securely archive data with proper retention policies.
//   Voice configuration must isolate tenant-specific voice patterns and training data.
//
// performance_considerations: >
//   Tenant data should be cached with TTL expiry for frequent access patterns.
//   Tenant user queries should be paginated and indexed for large organizations.
//   Analytics queries should use pre-computed aggregations where possible.
//   Voice configuration should be cached separately for real-time voice operations.
//   Cross-tenant operations should be minimized and optimized for performance.
//
// tasks:
//   1. [SETUP] Create TenantService class with dependency injection and error handling
//   2. [CREATE] Implement createTenant with organization setup and initial configuration
//   3. [RETRIEVE] Add getTenant and getTenantByDomain with caching and validation
//   4. [UPDATE] Create updateTenant with configuration validation and change tracking
//   5. [DELETE] Implement soft delete with data archival and cleanup workflows
//   6. [ACCESS] Add validateTenantAccess with role-based permission checking
//   7. [USERS] Create tenant user management with role filtering and pagination
//   8. [INVITES] Implement user invitation system with approval workflows
//   9. [VOICE] Add tenant-specific voice configuration and branding setup
//  10. [ANALYTICS] Create tenant analytics with usage metrics and performance tracking
// --- END DIRECTIVE BLOCK ---

import { supabase } from '@/core/database/connection';
import { logger } from '@/core/logger/logger';
import { TenantError, ValidationError, NotFoundError, UnauthorizedError } from '@/core/errors/error-types';
import type { 
  Tenant, 
  CreateTenantData, 
  UpdateTenantData, 
  TenantUser,
  InviteUserData,
  Invitation,
  VoiceConfig,
  TenantAnalytics,
  TimeRange,
  TenantSettings,
  TenantSubscription
} from '@/domains/tenant/types/tenant-types';
import { Role } from '@/domains/auth/types/auth-types';

export class TenantService {
  private cache = new Map<string, { data: Tenant; expires: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Create a new tenant organization with initial setup
   */
  async createTenant(tenantData: CreateTenantData, createdBy: string): Promise<Tenant> {
    try {
      logger.info('Creating new tenant', { 
        name: tenantData.name, 
        domain: tenantData.primary_domain,
        createdBy 
      });

      // Validate tenant data
      await this.validateTenantData(tenantData);

      // Check if domain is already in use
      if (tenantData.primary_domain) {
        const existingTenant = await this.getTenantByDomain(tenantData.primary_domain);
        if (existingTenant) {
          throw new ValidationError(`Domain ${tenantData.primary_domain} is already in use`);
        }
      }

      // Create tenant with default settings
      const { data: tenant, error } = await supabase()
        .from('tenants')
        .insert({
          name: tenantData.name,
          display_name: tenantData.display_name || tenantData.name,
          primary_domain: tenantData.primary_domain,
          allowed_domains: tenantData.allowed_domains || [],
          description: tenantData.description,
          industry: tenantData.industry,
          size: tenantData.size,
          timezone: tenantData.timezone || 'UTC',
          settings: this.getDefaultTenantSettings(tenantData),
          subscription_plan: tenantData.subscription_plan || 'starter',
          is_active: true,
          created_by: createdBy,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('*')
        .single();

      if (error) {
        throw new TenantError(`Failed to create tenant: ${error.message}`);
      }

      // Set up initial tenant configuration
      await this.setupInitialTenantConfig(tenant.id, createdBy);

      // Setup default voice configuration
      if (tenantData.voice_config) {
        await this.setupTenantVoiceConfig(tenant.id, tenantData.voice_config);
      }

      // Create tenant admin assignment for creator
      await this.assignUserToTenant(createdBy, tenant.id, Role.ADMIN, true);

      // Clear cache to ensure fresh data
      this.clearCache();

      logger.info('Tenant created successfully', { 
        tenantId: tenant.id, 
        name: tenant.name,
        createdBy 
      });

      return tenant as Tenant;

    } catch (error) {
      logger.error('Error creating tenant', { error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  /**
   * Get tenant by ID with caching
   */
  async getTenant(tenantId: string): Promise<Tenant | null> {
    try {
      // Check cache first
      const cached = this.cache.get(tenantId);
      if (cached && cached.expires > Date.now()) {
        return cached.data;
      }

      const { data: tenant, error } = await supabase()
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw new TenantError(`Failed to get tenant: ${error.message}`);
      }

      // Cache the result
      this.cache.set(tenantId, {
        data: tenant as Tenant,
        expires: Date.now() + this.CACHE_TTL
      });

      return tenant as Tenant;

    } catch (error) {
      logger.error('Error getting tenant', { tenantId, error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  /**
   * Get tenant by domain
   */
  async getTenantByDomain(domain: string): Promise<Tenant | null> {
    try {
      const { data: tenant, error } = await supabase()
        .from('tenants')
        .select('*')
        .or(`primary_domain.eq.${domain},allowed_domains.cs.["${domain}"]`)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw new TenantError(`Failed to get tenant by domain: ${error.message}`);
      }

      // Cache the result
      this.cache.set(tenant.id, {
        data: tenant as Tenant,
        expires: Date.now() + this.CACHE_TTL
      });

      return tenant as Tenant;

    } catch (error) {
      logger.error('Error getting tenant by domain', { domain, error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  /**
   * Update tenant configuration
   */
  async updateTenant(tenantId: string, updates: UpdateTenantData, updatedBy: string): Promise<Tenant> {
    try {
      logger.info('Updating tenant', { tenantId, updatedBy });

      // Get existing tenant
      const existingTenant = await this.getTenant(tenantId);
      if (!existingTenant) {
        throw new NotFoundError(`Tenant ${tenantId} not found`);
      }

      // Validate updates
      if (updates.primary_domain && updates.primary_domain !== existingTenant.primary_domain) {
        const domainTenant = await this.getTenantByDomain(updates.primary_domain);
        if (domainTenant && domainTenant.id !== tenantId) {
          throw new ValidationError(`Domain ${updates.primary_domain} is already in use`);
        }
      }

      // Merge settings
      const mergedSettings = {
        ...existingTenant.settings,
        ...updates.settings
      };

      const { data: tenant, error } = await supabase()
        .from('tenants')
        .update({
          ...updates,
          settings: mergedSettings,
          updated_by: updatedBy,
          updated_at: new Date().toISOString()
        })
        .eq('id', tenantId)
        .select('*')
        .single();

      if (error) {
        throw new TenantError(`Failed to update tenant: ${error.message}`);
      }

      // Clear cache
      this.cache.delete(tenantId);

      logger.info('Tenant updated successfully', { tenantId, updatedBy });

      return tenant as Tenant;

    } catch (error) {
      logger.error('Error updating tenant', { tenantId, error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  /**
   * Soft delete tenant with data archival
   */
  async deleteTenant(tenantId: string, deletedBy: string, reason?: string): Promise<void> {
    try {
      logger.info('Deleting tenant', { tenantId, deletedBy, reason });

      const { error } = await supabase()
        .from('tenants')
        .update({
          is_active: false,
          deleted_at: new Date().toISOString(),
          deleted_by: deletedBy,
          deletion_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', tenantId);

      if (error) {
        throw new TenantError(`Failed to delete tenant: ${error.message}`);
      }

      // Deactivate all user assignments
      await supabase()
        .from('tenant_assignments')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('tenant_id', tenantId);

      // Clear cache
      this.cache.delete(tenantId);

      logger.info('Tenant deleted successfully', { tenantId, deletedBy });

    } catch (error) {
      logger.error('Error deleting tenant', { tenantId, error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  /**
   * Validate user access to tenant
   */
  async validateTenantAccess(userId: string, tenantId: string, requiredRole?: Role): Promise<boolean> {
    try {
      const { data: assignment, error } = await supabase()
        .from('tenant_assignments')
        .select('role, is_active, expires_at')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .single();

      if (error || !assignment) {
        return false;
      }

      // Check expiration
      if (assignment.expires_at && new Date(assignment.expires_at) < new Date()) {
        return false;
      }

      // Check role requirement
      if (requiredRole) {
        const roleHierarchy = { customer: 1, technician: 2, manager: 3, admin: 4 };
        return roleHierarchy[assignment.role] >= roleHierarchy[requiredRole];
      }

      return true;

    } catch (error) {
      logger.error('Error validating tenant access', { userId, tenantId, error: error instanceof Error ? error.message : 'Unknown' });
      return false;
    }
  }

  /**
   * Get tenant users with optional role filtering
   */
  async getTenantUsers(tenantId: string, role?: Role, limit: number = 50, offset: number = 0): Promise<TenantUser[]> {
    try {
      let query = supabase()
        .from('tenant_assignments')
        .select(`
          user_id,
          role,
          is_primary,
          assigned_at,
          last_accessed_at,
          users_extended:user_id (
            display_name,
            first_name,
            last_name,
            email,
            avatar_url,
            last_login_at,
            is_active
          )
        `)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('assigned_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (role) {
        query = query.eq('role', role);
      }

      const { data: assignments, error } = await query;

      if (error) {
        throw new TenantError(`Failed to get tenant users: ${error.message}`);
      }

      return assignments?.map(assignment => ({
        user_id: assignment.user_id,
        role: assignment.role,
        is_primary: assignment.is_primary,
        assigned_at: assignment.assigned_at,
        last_accessed_at: assignment.last_accessed_at,
        user: assignment.users_extended
      })) || [];

    } catch (error) {
      logger.error('Error getting tenant users', { tenantId, error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  /**
   * Invite user to tenant
   */
  async inviteUser(tenantId: string, inviteData: InviteUserData, invitedBy: string): Promise<Invitation> {
    try {
      logger.info('Creating user invitation', { tenantId, email: inviteData.email, invitedBy });

      // Check if user is already in tenant
      const { data: existingAssignment } = await supabase()
        .from('tenant_assignments')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('user_id', inviteData.user_id || 'none')
        .eq('is_active', true)
        .single();

      if (existingAssignment) {
        throw new ValidationError('User is already a member of this tenant');
      }

      // Generate invitation code
      const invitationCode = this.generateInvitationCode();

      const { data: invitation, error } = await supabase()
        .from('user_invitations')
        .insert({
          email: inviteData.email,
          tenant_id: tenantId,
          role: inviteData.role,
          invitation_code: invitationCode,
          invited_by: invitedBy,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
          welcome_message: inviteData.welcome_message,
          voice_onboarding_enabled: inviteData.voice_onboarding_enabled || false,
          metadata: inviteData.metadata || {}
        })
        .select('*')
        .single();

      if (error) {
        throw new TenantError(`Failed to create invitation: ${error.message}`);
      }

      logger.info('User invitation created', { invitationId: invitation.id, tenantId });

      return invitation as Invitation;

    } catch (error) {
      logger.error('Error creating user invitation', { tenantId, error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  /**
   * Setup tenant-specific voice configuration
   */
  async setupTenantVoiceConfig(tenantId: string, config: VoiceConfig): Promise<void> {
    try {
      logger.info('Setting up tenant voice configuration', { tenantId });

      const { error } = await supabase()
        .from('tenant_voice_configs')
        .upsert({
          tenant_id: tenantId,
          wake_words: config.wake_words || ['hey assistant'],
          default_voice: config.default_voice || 'system',
          language_codes: config.language_codes || ['en-US'],
          speech_rate: config.speech_rate || 1.0,
          voice_branding: config.voice_branding || {},
          recognition_providers: config.recognition_providers || ['system'],
          tts_providers: config.tts_providers || ['system'],
          voice_commands: config.voice_commands || {},
          accessibility_features: config.accessibility_features || {},
          updated_at: new Date().toISOString()
        });

      if (error) {
        throw new TenantError(`Failed to setup voice config: ${error.message}`);
      }

      logger.info('Tenant voice configuration updated', { tenantId });

    } catch (error) {
      logger.error('Error setting up voice config', { tenantId, error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  /**
   * Get tenant analytics and usage metrics
   */
  async getTenantAnalytics(tenantId: string, timeRange: TimeRange): Promise<TenantAnalytics> {
    try {
      const { startDate, endDate } = this.parseTimeRange(timeRange);

      // Get user activity analytics
      const { data: userActivity } = await supabase()
        .from('auth_audit_log')
        .select('event_type, created_at, user_id')
        .eq('tenant_id', tenantId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      // Get voice usage analytics
      const { data: voiceUsage } = await supabase()
        .from('auth_audit_log')
        .select('voice_command, voice_confidence, created_at')
        .eq('tenant_id', tenantId)
        .not('voice_command', 'is', null)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      // Calculate metrics
      const analytics: TenantAnalytics = {
        tenant_id: tenantId,
        time_range: timeRange,
        total_users: await this.getTotalUsers(tenantId),
        active_users: this.calculateActiveUsers(userActivity || []),
        total_sessions: this.calculateTotalSessions(userActivity || []),
        voice_interactions: voiceUsage?.length || 0,
        voice_success_rate: this.calculateVoiceSuccessRate(voiceUsage || []),
        top_voice_commands: this.getTopVoiceCommands(voiceUsage || []),
        user_growth: await this.getUserGrowth(tenantId, timeRange),
        feature_usage: await this.getFeatureUsage(tenantId, timeRange),
        generated_at: new Date().toISOString()
      };

      return analytics;

    } catch (error) {
      logger.error('Error getting tenant analytics', { tenantId, error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  /**
   * Switch user's active tenant
   */
  async switchUserTenant(userId: string, tenantId: string): Promise<void> {
    try {
      // Validate access
      const hasAccess = await this.validateTenantAccess(userId, tenantId);
      if (!hasAccess) {
        throw new UnauthorizedError('User does not have access to this tenant');
      }

      // Update user's active tenant
      const { error } = await supabase()
        .from('users_extended')
        .update({
          tenant_id: tenantId,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        throw new TenantError(`Failed to switch tenant: ${error.message}`);
      }

      // Update last accessed timestamp
      await supabase()
        .from('tenant_assignments')
        .update({
          last_accessed_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('tenant_id', tenantId);

      logger.info('User switched tenant', { userId, tenantId });

    } catch (error) {
      logger.error('Error switching user tenant', { userId, tenantId, error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  // Private helper methods

  private async validateTenantData(data: CreateTenantData): Promise<void> {
    if (!data.name || data.name.trim().length < 2) {
      throw new ValidationError('Tenant name must be at least 2 characters');
    }

    if (data.primary_domain && !/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}$/.test(data.primary_domain)) {
      throw new ValidationError('Invalid primary domain format');
    }
  }

  private getDefaultTenantSettings(data: CreateTenantData): TenantSettings {
    return {
      features: {
        voice_enabled: true,
        mobile_app: true,
        api_access: false,
        custom_branding: false,
        advanced_analytics: false
      },
      security: {
        mfa_required: false,
        session_timeout: 24,
        password_policy: 'standard',
        ip_restrictions: []
      },
      voice: {
        default_language: 'en-US',
        voice_timeout: 30,
        confidence_threshold: 0.7,
        noise_cancellation: true
      },
      notifications: {
        email_notifications: true,
        sms_notifications: false,
        voice_notifications: true
      },
      integrations: {
        allowed_integrations: [],
        webhook_endpoints: []
      }
    };
  }

  private async setupInitialTenantConfig(tenantId: string, createdBy: string): Promise<void> {
    // Create default workspace/project structure
    // This would be implemented based on your specific needs
    logger.info('Setting up initial tenant configuration', { tenantId, createdBy });
  }

  private async assignUserToTenant(userId: string, tenantId: string, role: Role, isPrimary: boolean = false): Promise<void> {
    const { error } = await supabase()
      .from('tenant_assignments')
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        role,
        is_primary: isPrimary,
        is_active: true,
        assigned_at: new Date().toISOString()
      });

    if (error) {
      throw new TenantError(`Failed to assign user to tenant: ${error.message}`);
    }
  }

  private generateInvitationCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private parseTimeRange(timeRange: TimeRange): { startDate: string; endDate: string } {
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return {
      startDate: startDate.toISOString(),
      endDate: now.toISOString()
    };
  }

  private async getTotalUsers(tenantId: string): Promise<number> {
    const { count } = await supabase()
      .from('tenant_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    return count || 0;
  }

  private calculateActiveUsers(activity: any[]): number {
    const uniqueUsers = new Set(activity.map(a => a.user_id).filter(Boolean));
    return uniqueUsers.size;
  }

  private calculateTotalSessions(activity: any[]): number {
    return activity.filter(a => a.event_type === 'login_success').length;
  }

  private calculateVoiceSuccessRate(voiceUsage: any[]): number {
    if (voiceUsage.length === 0) return 0;
    const successfulCommands = voiceUsage.filter(v => v.voice_confidence > 0.7).length;
    return (successfulCommands / voiceUsage.length) * 100;
  }

  private getTopVoiceCommands(voiceUsage: any[]): Array<{ command: string; count: number }> {
    const commandCounts: Record<string, number> = {};
    voiceUsage.forEach(v => {
      if (v.voice_command) {
        commandCounts[v.voice_command] = (commandCounts[v.voice_command] || 0) + 1;
      }
    });

    return Object.entries(commandCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([command, count]) => ({ command, count }));
  }

  private async getUserGrowth(tenantId: string, timeRange: TimeRange): Promise<number> {
    const { startDate } = this.parseTimeRange(timeRange);
    
    const { count } = await supabase()
      .from('tenant_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gte('assigned_at', startDate);

    return count || 0;
  }

  private async getFeatureUsage(tenantId: string, timeRange: TimeRange): Promise<Record<string, number>> {
    // This would be implemented based on your feature tracking
    return {
      voice_commands: 0,
      mobile_access: 0,
      api_calls: 0
    };
  }

  private clearCache(): void {
    this.cache.clear();
  }
}