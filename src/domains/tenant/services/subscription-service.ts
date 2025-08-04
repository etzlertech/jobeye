// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/tenant/services/subscription-service.ts
// purpose: Subscription management service for tenant billing plans, usage tracking, and plan upgrades/downgrades with voice analytics
// spec_ref: tenant#subscription-service
// version: 2025-08-1
// domain: tenant
// phase: 1
// complexity_budget: high
// offline_capability: NONE
//
// dependencies:
//   - internal: ['src/core/database/connection.ts', 'src/core/logger/logger.ts', 'src/core/errors/error-types.ts', 'src/domains/tenant/types/tenant-types.ts']
//   - external: ['@supabase/supabase-js']
//
// exports:
//   - SubscriptionService: class - Main subscription management service with billing integration
//   - getSubscription(tenantId: string): Promise<Subscription | null> - Get current subscription details
//   - createSubscription(tenantId: string, plan: BillingPlan): Promise<Subscription> - Create new subscription
//   - updateSubscription(tenantId: string, plan: BillingPlan): Promise<Subscription> - Change subscription plan
//   - cancelSubscription(tenantId: string, reason?: string): Promise<void> - Cancel subscription with retention
//   - renewSubscription(tenantId: string): Promise<Subscription> - Renew expired subscription
//   - checkUsageLimits(tenantId: string): Promise<UsageStatus> - Check current usage against limits
//   - getUsageMetrics(tenantId: string, period?: string): Promise<UsageMetrics> - Get detailed usage statistics
//   - validatePlanChange(tenantId: string, newPlan: BillingPlan): Promise<PlanChangeValidation> - Validate plan upgrade/downgrade
//   - processPayment(tenantId: string, amount: number): Promise<PaymentResult> - Process subscription payment
//   - getUpcomingInvoice(tenantId: string): Promise<Invoice | null> - Preview next billing cycle
//
// voice_considerations: >
//   Subscription service should track voice usage minutes and API calls for billing purposes.
//   Voice analytics should be included in usage metrics for plan optimization recommendations.
//   Plan changes should consider voice feature availability and usage patterns.
//   Voice-heavy usage should trigger upgrade recommendations for better limits.
//
// security_considerations: >
//   All subscription operations must enforce tenant isolation and permission validation.
//   Payment processing must be secure and PCI compliant with encrypted data handling.
//   Usage metrics must not expose sensitive tenant data across organizational boundaries.
//   Plan changes must validate user permissions and prevent unauthorized upgrades.
//   Billing data must be encrypted at rest and in transit with audit logging.
//
// performance_considerations: >
//   Usage tracking should use efficient aggregation queries with proper indexing.
//   Subscription checks should be cached to avoid repeated database queries.
//   Billing calculations should be optimized for real-time plan comparison.
//   Usage metrics should use pre-computed values where possible for performance.
//   Payment processing should be asynchronous to avoid blocking user operations.
//
// tasks:
//   1. [SETUP] Create SubscriptionService class with database connection and error handling
//   2. [GET] Implement getSubscription with current plan and usage details
//   3. [CREATE] Add createSubscription with default plan setup and billing integration
//   4. [UPDATE] Create updateSubscription with plan change validation and proration
//   5. [CANCEL] Implement cancelSubscription with retention period and data archival
//   6. [RENEW] Add renewSubscription with payment processing and plan reactivation
//   7. [USAGE] Create checkUsageLimits with real-time usage validation against plan limits
//   8. [METRICS] Implement getUsageMetrics with voice analytics and performance data
//   9. [VALIDATION] Add validatePlanChange with upgrade/downgrade business rules
//  10. [BILLING] Create payment processing and invoice generation functionality
// --- END DIRECTIVE BLOCK ---

import { supabase } from '@/core/database/connection';
import { logger } from '@/core/logger/logger';
import { DatabaseError, ValidationError, NotFoundError } from '@/core/errors/error-types';
import type {
  Subscription,
  BillingPlan,
  TenantSettings,
  PLAN_CAPABILITIES
} from '@/domains/tenant/types/tenant-types';

// Subscription service interfaces
interface UsageStatus {
  tenant_id: string;
  current_usage: {
    users: number;
    storage_gb: number;
    api_calls: number;
    voice_minutes: number;
  };
  limits: {
    users: number;
    storage_gb: number;
    api_calls: number;
    voice_minutes: number;
  };
  usage_percentage: {
    users: number;
    storage: number;
    api_calls: number;
    voice_minutes: number;
  };
  warnings: string[];
  blocked_features: string[];
}

interface UsageMetrics {
  tenant_id: string;
  period: string;
  usage_summary: {
    total_users: number;
    active_users: number;
    storage_used_gb: number;
    api_calls_count: number;
    voice_minutes_used: number;
    voice_interactions: number;
  };
  daily_breakdown: Array<{
    date: string;
    api_calls: number;
    voice_minutes: number;
    active_users: number;
  }>;
  top_features: Array<{
    feature: string;
    usage_count: number;
    percentage: number;
  }>;
  recommendations: string[];
}

interface PlanChangeValidation {
  valid: boolean;
  current_plan: BillingPlan;
  new_plan: BillingPlan;
  changes: {
    features_added: string[];
    features_removed: string[];
    limits_increased: Record<string, number>;
    limits_decreased: Record<string, number>;
  };
  warnings: string[];
  requires_confirmation: boolean;
  estimated_cost_change: number;
}

interface PaymentResult {
  success: boolean;
  transaction_id?: string;
  amount: number;
  currency: string;
  payment_method?: string;
  error?: string;
}

interface Invoice {
  id: string;
  tenant_id: string;
  amount: number;
  currency: string;
  due_date: string;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
}

export class SubscriptionService {
  private cache = new Map<string, { data: Subscription; expires: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get current subscription for tenant
   */
  async getSubscription(tenantId: string): Promise<Subscription | null> {
    try {
      // Check cache first
      const cached = this.cache.get(tenantId);
      if (cached && cached.expires > Date.now()) {
        return cached.data;
      }

      const { data, error } = await supabase()
        .from('tenant_subscriptions')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw new DatabaseError(`Failed to get subscription: ${error.message}`);
      }

      const subscription = data as Subscription;

      // Cache the result
      this.cache.set(tenantId, {
        data: subscription,
        expires: Date.now() + this.CACHE_TTL
      });

      return subscription;

    } catch (error) {
      logger.error('Error getting subscription', { tenantId, error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  /**
   * Create new subscription for tenant
   */
  async createSubscription(tenantId: string, plan: BillingPlan = BillingPlan.FREE): Promise<Subscription> {
    try {
      logger.info('Creating subscription', { tenantId, plan });

      // Check if subscription already exists
      const existing = await this.getSubscription(tenantId);
      if (existing) {
        throw new ValidationError('Subscription already exists for this tenant');
      }

      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const { data, error } = await supabase()
        .from('tenant_subscriptions')
        .insert({
          tenant_id: tenantId,
          plan,
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          created_at: now.toISOString(),
          updated_at: now.toISOString()
        })
        .select('*')
        .single();

      if (error) {
        throw new DatabaseError(`Failed to create subscription: ${error.message}`);
      }

      // Update tenant limits based on plan
      await this.updateTenantLimits(tenantId, plan);

      // Clear cache
      this.cache.delete(tenantId);

      logger.info('Subscription created successfully', { tenantId, plan, subscriptionId: data.id });
      return data as Subscription;

    } catch (error) {
      logger.error('Error creating subscription', { tenantId, error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  /**
   * Update subscription plan
   */
  async updateSubscription(tenantId: string, newPlan: BillingPlan): Promise<Subscription> {
    try {
      logger.info('Updating subscription', { tenantId, newPlan });

      const current = await this.getSubscription(tenantId);
      if (!current) {
        throw new NotFoundError('No subscription found for tenant');
      }

      // Validate plan change
      const validation = await this.validatePlanChange(tenantId, newPlan);
      if (!validation.valid) {
        throw new ValidationError(`Plan change not allowed: ${validation.warnings.join(', ')}`);
      }

      const { data, error } = await supabase()
        .from('tenant_subscriptions')
        .update({
          plan: newPlan,
          updated_at: new Date().toISOString()
        })
        .eq('tenant_id', tenantId)
        .select('*')
        .single();

      if (error) {
        throw new DatabaseError(`Failed to update subscription: ${error.message}`);
      }

      // Update tenant limits
      await this.updateTenantLimits(tenantId, newPlan);

      // Clear cache
      this.cache.delete(tenantId);

      logger.info('Subscription updated successfully', { tenantId, newPlan, subscriptionId: data.id });
      return data as Subscription;

    } catch (error) {
      logger.error('Error updating subscription', { tenantId, error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  /**
   * Cancel subscription with retention period
   */
  async cancelSubscription(tenantId: string, reason?: string): Promise<void> {
    try {
      logger.info('Cancelling subscription', { tenantId, reason });

      const { error } = await supabase()
        .from('tenant_subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('tenant_id', tenantId);

      if (error) {
        throw new DatabaseError(`Failed to cancel subscription: ${error.message}`);
      }

      // Downgrade to free plan limits
      await this.updateTenantLimits(tenantId, BillingPlan.FREE);

      // Clear cache
      this.cache.delete(tenantId);

      logger.info('Subscription cancelled successfully', { tenantId });

    } catch (error) {
      logger.error('Error cancelling subscription', { tenantId, error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  /**
   * Renew expired subscription
   */
  async renewSubscription(tenantId: string): Promise<Subscription> {
    try {
      logger.info('Renewing subscription', { tenantId });

      const current = await this.getSubscription(tenantId);
      if (!current) {
        throw new NotFoundError('No subscription found for tenant');
      }

      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const { data, error } = await supabase()
        .from('tenant_subscriptions')
        .update({
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('tenant_id', tenantId)
        .select('*')
        .single();

      if (error) {
        throw new DatabaseError(`Failed to renew subscription: ${error.message}`);
      }

      // Clear cache
      this.cache.delete(tenantId);

      logger.info('Subscription renewed successfully', { tenantId, subscriptionId: data.id });
      return data as Subscription;

    } catch (error) {
      logger.error('Error renewing subscription', { tenantId, error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  /**
   * Check current usage against plan limits
   */
  async checkUsageLimits(tenantId: string): Promise<UsageStatus> {
    try {
      const subscription = await this.getSubscription(tenantId);
      if (!subscription) {
        throw new NotFoundError('No subscription found for tenant');
      }

      // Get current usage
      const currentUsage = await this.getCurrentUsage(tenantId);
      const limits = PLAN_CAPABILITIES[subscription.plan];

      // Calculate usage percentages
      const usagePercentage = {
        users: limits.max_users ? (currentUsage.users / limits.max_users) * 100 : 0,
        storage: limits.max_storage_gb ? (currentUsage.storage_gb / limits.max_storage_gb) * 100 : 0,
        api_calls: limits.max_api_calls_per_month ? (currentUsage.api_calls / limits.max_api_calls_per_month) * 100 : 0,
        voice_minutes: limits.max_voice_minutes_per_month ? (currentUsage.voice_minutes / limits.max_voice_minutes_per_month) * 100 : 0
      };

      // Generate warnings and blocked features
      const warnings: string[] = [];
      const blockedFeatures: string[] = [];

      if (usagePercentage.users > 90) {
        warnings.push('User limit almost reached');
        if (usagePercentage.users >= 100) {
          blockedFeatures.push('User creation disabled');
        }
      }

      if (usagePercentage.storage > 90) {
        warnings.push('Storage limit almost reached');
        if (usagePercentage.storage >= 100) {
          blockedFeatures.push('File uploads disabled');
        }
      }

      if (usagePercentage.api_calls > 90) {
        warnings.push('API call limit almost reached');
        if (usagePercentage.api_calls >= 100) {
          blockedFeatures.push('API access throttled');
        }
      }

      if (usagePercentage.voice_minutes > 90) {
        warnings.push('Voice minutes limit almost reached');
        if (usagePercentage.voice_minutes >= 100) {
          blockedFeatures.push('Voice features disabled');
        }
      }

      return {
        tenant_id: tenantId,
        current_usage: currentUsage,
        limits: limits as any,
        usage_percentage: usagePercentage,
        warnings,
        blocked_features: blockedFeatures
      };

    } catch (error) {
      logger.error('Error checking usage limits', { tenantId, error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  /**
   * Get detailed usage metrics
   */
  async getUsageMetrics(tenantId: string, period: string = '30d'): Promise<UsageMetrics> {
    try {
      const usageSummary = await this.getCurrentUsage(tenantId);
      const dailyBreakdown = await this.getDailyUsageBreakdown(tenantId, period);
      const topFeatures = await this.getTopFeatureUsage(tenantId, period);
      const recommendations = await this.generateRecommendations(tenantId, usageSummary);

      return {
        tenant_id: tenantId,
        period,
        usage_summary: {
          total_users: usageSummary.users,
          active_users: usageSummary.active_users || 0,
          storage_used_gb: usageSummary.storage_gb,
          api_calls_count: usageSummary.api_calls,
          voice_minutes_used: usageSummary.voice_minutes,
          voice_interactions: usageSummary.voice_interactions || 0
        },
        daily_breakdown: dailyBreakdown,
        top_features: topFeatures,
        recommendations
      };

    } catch (error) {
      logger.error('Error getting usage metrics', { tenantId, error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  /**
   * Validate plan change
   */
  async validatePlanChange(tenantId: string, newPlan: BillingPlan): Promise<PlanChangeValidation> {
    try {
      const current = await this.getSubscription(tenantId);
      if (!current) {
        throw new NotFoundError('No subscription found for tenant');
      }

      const currentLimits = PLAN_CAPABILITIES[current.plan];
      const newLimits = PLAN_CAPABILITIES[newPlan];
      const currentUsage = await this.getCurrentUsage(tenantId);

      const warnings: string[] = [];
      let requiresConfirmation = false;

      // Check if downgrading would exceed new limits
      if (newLimits.max_users && currentUsage.users > newLimits.max_users) {
        warnings.push(`Current users (${currentUsage.users}) exceeds new plan limit (${newLimits.max_users})`);
        requiresConfirmation = true;
      }

      if (newLimits.max_storage_gb && currentUsage.storage_gb > newLimits.max_storage_gb) {
        warnings.push(`Current storage (${currentUsage.storage_gb}GB) exceeds new plan limit (${newLimits.max_storage_gb}GB)`);
        requiresConfirmation = true;
      }

      // Calculate plan differences
      const changes = {
        features_added: this.getFeatureDifferences(currentLimits, newLimits, 'added'),
        features_removed: this.getFeatureDifferences(currentLimits, newLimits, 'removed'),
        limits_increased: this.getLimitDifferences(currentLimits, newLimits, 'increased'),
        limits_decreased: this.getLimitDifferences(currentLimits, newLimits, 'decreased')
      };

      return {
        valid: warnings.length === 0 || !requiresConfirmation,
        current_plan: current.plan,
        new_plan: newPlan,
        changes,
        warnings,
        requires_confirmation: requiresConfirmation,
        estimated_cost_change: this.calculateCostChange(current.plan, newPlan)
      };

    } catch (error) {
      logger.error('Error validating plan change', { tenantId, error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  /**
   * Process subscription payment
   */
  async processPayment(tenantId: string, amount: number): Promise<PaymentResult> {
    try {
      logger.info('Processing payment', { tenantId, amount });

      // This would integrate with Stripe or other payment processor
      // For now, simulate payment processing
      
      const success = Math.random() > 0.1; // 90% success rate for demo

      if (success) {
        const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        
        logger.info('Payment processed successfully', { tenantId, amount, transactionId });
        
        return {
          success: true,
          transaction_id: transactionId,
          amount,
          currency: 'USD',
          payment_method: 'card'
        };
      } else {
        return {
          success: false,
          amount,
          currency: 'USD',
          error: 'Payment failed - insufficient funds'
        };
      }

    } catch (error) {
      logger.error('Error processing payment', { tenantId, error: error instanceof Error ? error.message : 'Unknown' });
      return {
        success: false,
        amount,
        currency: 'USD',
        error: 'Payment processing failed'
      };
    }
  }

  /**
   * Get upcoming invoice preview
   */
  async getUpcomingInvoice(tenantId: string): Promise<Invoice | null> {
    try {
      const subscription = await this.getSubscription(tenantId);
      if (!subscription) {
        return null;
      }

      const planPricing = this.getPlanPricing(subscription.plan);
      const usage = await this.getCurrentUsage(tenantId);

      const items = [
        {
          description: `${subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)} Plan`,
          quantity: 1,
          unit_price: planPricing.base,
          total: planPricing.base
        }
      ];

      // Add overage charges if applicable
      const overages = this.calculateOverages(subscription.plan, usage);
      items.push(...overages);

      const subtotal = items.reduce((sum, item) => sum + item.total, 0);
      const tax = subtotal * 0.1; // 10% tax for demo
      const total = subtotal + tax;

      return {
        id: `inv_preview_${Date.now()}`,
        tenant_id: tenantId,
        amount: total,
        currency: 'USD',
        due_date: subscription.current_period_end,
        items,
        subtotal,
        tax,
        total
      };

    } catch (error) {
      logger.error('Error getting upcoming invoice', { tenantId, error: error instanceof Error ? error.message : 'Unknown' });
      throw error;
    }
  }

  // Private helper methods

  private async updateTenantLimits(tenantId: string, plan: BillingPlan): Promise<void> {
    const limits = PLAN_CAPABILITIES[plan];
    
    await supabase()
      .from('tenants')
      .update({
        settings: supabase().rpc('jsonb_merge', {
          target: supabase().rpc('get_tenant_settings', { tenant_id: tenantId }),
          source: { limits }
        }),
        updated_at: new Date().toISOString()
      })
      .eq('id', tenantId);
  }

  private async getCurrentUsage(tenantId: string): Promise<any> {
    // This would query actual usage from various tables
    // For demo, return sample data
    return {
      users: 5,
      active_users: 3,
      storage_gb: 2.5,
      api_calls: 150,
      voice_minutes: 25,
      voice_interactions: 45
    };
  }

  private async getDailyUsageBreakdown(tenantId: string, period: string): Promise<any[]> {
    // Generate sample daily breakdown
    const days = period === '30d' ? 30 : 7;
    const breakdown = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      breakdown.push({
        date: date.toISOString().split('T')[0],
        api_calls: Math.floor(Math.random() * 20),
        voice_minutes: Math.floor(Math.random() * 5),
        active_users: Math.floor(Math.random() * 3) + 1
      });
    }
    
    return breakdown;
  }

  private async getTopFeatureUsage(tenantId: string, period: string): Promise<any[]> {
    return [
      { feature: 'Voice Commands', usage_count: 120, percentage: 45 },
      { feature: 'API Calls', usage_count: 80, percentage: 30 },
      { feature: 'File Uploads', usage_count: 40, percentage: 15 },
      { feature: 'User Management', usage_count: 25, percentage: 10 }
    ];
  }

  private async generateRecommendations(tenantId: string, usage: any): Promise<string[]> {
    const recommendations = [];
    
    if (usage.voice_minutes > 20) {
      recommendations.push('Consider upgrading to Professional plan for more voice minutes');
    }
    
    if (usage.api_calls > 100) {
      recommendations.push('Your API usage is high - upgrade for higher limits');
    }
    
    if (usage.users >= 8) {
      recommendations.push('You\'re approaching user limits - consider upgrading');
    }
    
    return recommendations;
  }

  private getFeatureDifferences(current: any, target: any, type: 'added' | 'removed'): string[] {
    // This would compare feature sets between plans
    return [];
  }

  private getLimitDifferences(current: any, target: any, type: 'increased' | 'decreased'): Record<string, number> {
    const differences: Record<string, number> = {};
    
    if (type === 'increased') {
      if (target.max_users > current.max_users) {
        differences.users = target.max_users - current.max_users;
      }
    } else {
      if (target.max_users < current.max_users) {
        differences.users = current.max_users - target.max_users;
      }
    }
    
    return differences;
  }

  private calculateCostChange(currentPlan: BillingPlan, newPlan: BillingPlan): number {
    const pricing = {
      [BillingPlan.FREE]: 0,
      [BillingPlan.STARTER]: 29,
      [BillingPlan.PROFESSIONAL]: 99,
      [BillingPlan.ENTERPRISE]: 299
    };
    
    return pricing[newPlan] - pricing[currentPlan];
  }

  private getPlanPricing(plan: BillingPlan): { base: number } {
    const pricing = {
      [BillingPlan.FREE]: { base: 0 },
      [BillingPlan.STARTER]: { base: 29 },
      [BillingPlan.PROFESSIONAL]: { base: 99 },
      [BillingPlan.ENTERPRISE]: { base: 299 }
    };
    
    return pricing[plan];
  }

  private calculateOverages(plan: BillingPlan, usage: any): any[] {
    // Calculate overage charges for usage beyond plan limits
    return [];
  }
}