/**
 * AGENT DIRECTIVE BLOCK
 * file: src/scheduling/services/kit.service.ts
 * phase: 3
 * domain: scheduling
 * purpose: Manage kits with override handling and seasonal variants
 * spec_ref: 003-scheduling-kits/contracts/kit-management.yaml
 * complexity_budget: 300
 * state_machine: idle -> loading -> loaded/override_required
 * estimated_llm_cost: 0.002
 * offline_capability: REQUIRED
 * dependencies:
 *   internal:
 *     - "@/scheduling/repositories/kit.repository"
 *     - "@/scheduling/repositories/kit-item.repository"
 *     - "@/scheduling/repositories/kit-variant.repository"
 *     - "@/scheduling/repositories/kit-override-log.repository"
 *     - "@/scheduling/repositories/job-kit.repository"
 *     - "@/scheduling/services/notification.service"
 *     - "@/core/logger/voice-logger"
 *   external:
 *     - date-fns
 *   supabase:
 *     - kits (read)
 *     - kit_items (read)
 *     - kit_variants (read)
 *     - kit_override_logs (write)
 *     - job_kits (read/write)
 * exports:
 *   - KitService
 *   - KitLoadResult
 *   - KitOverrideRequest
 * voice_considerations:
 *   - Voice commands for kit overrides
 *   - Simple kit verification prompts
 *   - Voice notifications for missing items
 * test_requirements:
 *   coverage: 90%
 *   test_file: src/__tests__/scheduling/unit/kit.service.test.ts
 * tasks:
 *   - Implement kit loading and verification
 *   - Handle seasonal variant selection
 *   - Process override requests
 *   - Track override patterns
 *   - Send supervisor notifications
 */

import { format, getMonth } from 'date-fns';
import { KitRepository } from '@/scheduling/repositories/kit.repository';
import { KitItemRepository } from '@/scheduling/repositories/kit-item.repository';
import { KitVariantRepository } from '@/scheduling/repositories/kit-variant.repository';
import { KitOverrideLogRepository } from '@/scheduling/repositories/kit-override-log.repository';
import { JobKitRepository } from '@/scheduling/repositories/job-kit.repository';
import { NotificationService, NotificationChannel } from '@/scheduling/services/notification.service';
import { logger } from '@/core/logger/voice-logger';

export interface KitLoadResult {
  kitId: string;
  variantId?: string;
  items: KitItemDetail[];
  missingItems: KitItemDetail[];
  requiresOverride: boolean;
  voiceSummary: string;
}

export interface KitItemDetail {
  id: string;
  itemType: 'equipment' | 'material' | 'tool';
  quantity: number;
  unit?: string;
  isRequired: boolean;
  available: boolean;
  reason?: string;
}

export interface KitOverrideRequest {
  jobId: string;
  kitId: string;
  itemId: string;
  technicianId: string;
  overrideReason: string;
  voiceInitiated?: boolean;
}

export interface SeasonalVariantCriteria {
  date?: Date;
  temperature?: number;
  location?: { lat: number; lng: number };
  explicitVariantCode?: string;
}

export class KitService {
  private kitRepo: KitRepository;
  private kitItemRepo: KitItemRepository;
  private kitVariantRepo: KitVariantRepository;
  private overrideLogRepo: KitOverrideLogRepository;
  private jobKitRepo: JobKitRepository;
  private notificationService: NotificationService;

  constructor(
    kitRepo?: KitRepository,
    kitItemRepo?: KitItemRepository,
    kitVariantRepo?: KitVariantRepository,
    overrideLogRepo?: KitOverrideLogRepository,
    jobKitRepo?: JobKitRepository,
    notificationService?: NotificationService
  ) {
    // Allow construction without args for testing
    this.kitRepo = kitRepo as any;
    this.kitItemRepo = kitItemRepo as any;
    this.kitVariantRepo = kitVariantRepo as any;
    this.overrideLogRepo = overrideLogRepo as any;
    this.jobKitRepo = jobKitRepo as any;
    this.notificationService = notificationService as any;
  }

  async loadKitForJob(
    jobId: string,
    criteria?: SeasonalVariantCriteria
  ): Promise<KitLoadResult> {
    try {
      logger.info('Loading kit for job', {
        jobId,
        metadata: { voice: { action: 'Loading equipment kit' } }
      });

      // Get job kit assignment
      const jobKit = await this.jobKitRepo.findByJobId(jobId);
      if (!jobKit) {
        throw new Error(`No kit assigned to job ${jobId}`);
      }

      // Get kit details
      const kit = await this.kitRepo.findById(jobKit.kit_id);
      if (!kit || !kit.is_active) {
        throw new Error(`Kit ${jobKit.kit_id} not found or inactive`);
      }

      // Select appropriate variant
      const variant = await this.selectVariant(kit.id, criteria);
      
      // Get kit items
      const items = await this.kitItemRepo.findByKitId(kit.id);
      
      // Check item availability
      const itemDetails = await this.checkItemAvailability(items);
      const missingItems = itemDetails.filter(item => !item.available && item.isRequired);

      const result: KitLoadResult = {
        kitId: kit.id,
        variantId: variant?.id,
        items: itemDetails,
        missingItems,
        requiresOverride: missingItems.length > 0,
        voiceSummary: this.generateLoadSummary(kit.name, itemDetails, missingItems)
      };

      logger.info('Kit load completed', {
        jobId,
        kitId: kit.id,
        requiresOverride: result.requiresOverride,
        metadata: { voice: { summary: result.voiceSummary } }
      });

      return result;
    } catch (error) {
      logger.error('Error loading kit for job', { error, jobId });
      throw error;
    }
  }

  async processOverride(
    request: KitOverrideRequest
  ): Promise<{ success: boolean; notificationSent: boolean }> {
    try {
      logger.info('Processing kit override', {
        ...request,
        metadata: { voice: { initiated: request.voiceInitiated } }
      });

      // Get supervisor info (mock for now)
      const supervisorId = await this.getSupervisorForTechnician(request.technicianId);

      // Log the override
      const overrideLog = await this.overrideLogRepo.create({
        company_id: '', // Would get from context
        job_id: request.jobId,
        kit_id: request.kitId,
        item_id: request.itemId,
        technician_id: request.technicianId,
        override_reason: request.overrideReason,
        supervisor_id: supervisorId,
        voice_initiated: request.voiceInitiated || false,
        metadata: {
          timestamp: new Date().toISOString(),
          source: request.voiceInitiated ? 'voice' : 'manual'
        }
      });

      // Send supervisor notification
      let notificationSent = false;
      if (supervisorId) {
        notificationSent = await this.notifySupervisor(
          supervisorId,
          request,
          overrideLog.id
        );

        // Update notification status
        await this.overrideLogRepo.update(overrideLog.id, {
          supervisor_notified_at: notificationSent ? new Date().toISOString() : null,
          notification_status: notificationSent ? 'sent' : 'failed'
        });
      }

      logger.info('Override processed', {
        overrideId: overrideLog.id,
        notificationSent,
        metadata: { 
          voice: { 
            response: notificationSent 
              ? 'Override logged and supervisor notified'
              : 'Override logged, notification pending'
          }
        }
      });

      return { success: true, notificationSent };
    } catch (error) {
      logger.error('Error processing override', { error, request });
      return { success: false, notificationSent: false };
    }
  }

  async verifyKitCompletion(
    jobId: string,
    technicianId: string
  ): Promise<{ verified: boolean; issues: string[] }> {
    try {
      const jobKit = await this.jobKitRepo.findByJobId(jobId);
      if (!jobKit) {
        return { verified: false, issues: ['No kit assigned to job'] };
      }

      const overrides = await this.overrideLogRepo.findByJobAndKit(
        jobId,
        jobKit.kit_id
      );

      const issues: string[] = [];

      // Check for unresolved overrides
      const unresolvedOverrides = overrides.filter(
        o => !o.supervisor_id || o.notification_status !== 'acknowledged'
      );

      if (unresolvedOverrides.length > 0) {
        issues.push(`${unresolvedOverrides.length} unresolved override(s)`);
      }

      // Update verification status
      if (issues.length === 0) {
        await this.jobKitRepo.update(jobKit.id, {
          verified_at: new Date().toISOString(),
          verified_by: technicianId,
          verification_status: 'verified'
        });
      }

      return {
        verified: issues.length === 0,
        issues
      };
    } catch (error) {
      logger.error('Error verifying kit completion', { error, jobId });
      return { verified: false, issues: ['Verification error'] };
    }
  }

  private async selectVariant(
    kitId: string,
    criteria?: SeasonalVariantCriteria
  ): Promise<any | null> {
    const variants = await this.kitVariantRepo.findByKit(kitId);
    
    if (variants.length === 0) {
      return null;
    }

    // Explicit variant requested
    if (criteria?.explicitVariantCode) {
      return variants.find(v => v.variant_code === criteria.explicitVariantCode);
    }

    // Select by season (simplified)
    const month = getMonth(criteria?.date || new Date());
    const season = this.getSeasonFromMonth(month);
    
    // Look for seasonal variant
    const seasonalVariant = variants.find(v => 
      v.variant_code.toLowerCase().includes(season)
    );

    if (seasonalVariant) {
      return seasonalVariant;
    }

    // Return default variant
    return variants.find(v => v.is_default) || variants[0];
  }

  private getSeasonFromMonth(month: number): string {
    if (month >= 11 || month <= 1) return 'winter';
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    return 'fall';
  }

  private async checkItemAvailability(
    items: any[]
  ): Promise<KitItemDetail[]> {
    // In a real implementation, this would check inventory
    return items.map(item => ({
      id: item.id,
      itemType: item.item_type,
      quantity: item.quantity,
      unit: item.unit,
      isRequired: item.is_required,
      available: Math.random() > 0.1, // Mock 90% availability
      reason: Math.random() > 0.9 ? 'Out of stock' : undefined
    }));
  }

  private async getSupervisorForTechnician(
    technicianId: string
  ): Promise<string | null> {
    // Mock implementation - would lookup in user hierarchy
    return 'supervisor_123';
  }

  private async notifySupervisor(
    supervisorId: string,
    override: KitOverrideRequest,
    overrideLogId: string
  ): Promise<boolean> {
    const message = `Kit override requested: ${override.overrideReason}`;
    
    return this.notificationService.send({
      channel: NotificationChannel.SMS,
      recipient: supervisorId,
      title: 'Kit Override Request',
      body: message,
      data: {
        type: 'kit_override',
        jobId: override.jobId,
        overrideLogId,
        requiresAcknowledgment: true
      },
      priority: 'high'
    });
  }

  private generateLoadSummary(
    kitName: string,
    items: KitItemDetail[],
    missingItems: KitItemDetail[]
  ): string {
    if (missingItems.length === 0) {
      return `${kitName} kit loaded successfully`;
    }
    
    return `${kitName} kit loaded with ${missingItems.length} missing item${
      missingItems.length > 1 ? 's' : ''
    }`;
  }

  async getOverrideAnalytics(
    companyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalOverrides: number;
    byItem: Array<{ itemId: string; count: number; reasons: string[] }>;
    byTechnician: Array<{ technicianId: string; count: number }>;
    averageResponseTime: number;
  }> {
    const overrides = await this.overrideLogRepo.findByDateRange(
      companyId,
      startDate,
      endDate
    );

    // Analyze override patterns
    const byItem = new Map<string, { count: number; reasons: Set<string> }>();
    const byTechnician = new Map<string, number>();
    let totalResponseTime = 0;
    let responseCount = 0;

    for (const override of overrides) {
      // By item analysis
      if (override.item_id) {
        const itemStats = byItem.get(override.item_id) || { count: 0, reasons: new Set() };
        itemStats.count++;
        itemStats.reasons.add(override.override_reason);
        byItem.set(override.item_id, itemStats);
      }

      // By technician analysis
      const techCount = byTechnician.get(override.technician_id) || 0;
      byTechnician.set(override.technician_id, techCount + 1);

      // Response time analysis
      if (override.supervisor_notified_at && override.created_at) {
        const responseMs = new Date(override.supervisor_notified_at).getTime() - 
                          new Date(override.created_at).getTime();
        totalResponseTime += responseMs;
        responseCount++;
      }
    }

    return {
      totalOverrides: overrides.length,
      byItem: Array.from(byItem.entries())
        .map(([itemId, stats]) => ({
          itemId,
          count: stats.count,
          reasons: Array.from(stats.reasons)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      byTechnician: Array.from(byTechnician.entries())
        .map(([technicianId, count]) => ({ technicianId, count }))
        .sort((a, b) => b.count - a.count),
      averageResponseTime: responseCount > 0 
        ? Math.round(totalResponseTime / responseCount / 1000 / 60) // minutes
        : 0
    };
  }

  // Test convenience methods
  private kitCache: Map<string, any> = new Map();

  async loadKitWithVariant(kitId: string, variantCode?: string): Promise<{
    kit: any;
    variant: any | null;
    items: any[];
  }> {
    const cacheKey = `${kitId}:${variantCode || 'default'}`;
    if (this.kitCache.has(cacheKey)) {
      return this.kitCache.get(cacheKey);
    }

    const kit = await this.kitRepo.findById(kitId);
    if (!kit) {
      throw new Error('Kit not found');
    }

    let variant = null;
    if (variantCode) {
      const variants = await this.kitVariantRepo.findAll({ kit_id: kitId });
      variant = variants.find(v => v.variant_code === variantCode);
    } else {
      // Auto-select seasonal variant
      const criteria: SeasonalVariantCriteria = { date: new Date() };
      variant = await this.selectVariant(kitId, criteria);
    }

    const items = await this.kitItemRepo.findAll({ kit_id: kitId, variant_id: variant?.id });

    const result = { kit, variant, items };
    this.kitCache.set(cacheKey, result);
    return result;
  }

  applyOverrides(
    items: any[],
    overrides: Record<string, { quantity?: number; skip?: boolean; substitute_with?: string; reason: string }>,
    jobId: string,
    techId: string
  ): { items: any[]; overrideLogs: any[] } {
    const result = [...items];
    const logs: any[] = [];

    for (const [itemId, override] of Object.entries(overrides)) {
      const itemIndex = result.findIndex(item => item.id === itemId || item.material_id === itemId);
      if (itemIndex === -1) continue;

      const logEntry = {
        job_id: jobId,
        kit_item_id: itemId,
        technician_id: techId,
        override_reason: override.reason,
        metadata: {} as any,
        created_at: new Date()
      };

      if (override.skip) {
        const removed = result.splice(itemIndex, 1);
        logEntry.metadata.action = 'skip';
        logEntry.kit_item_id = removed[0]?.id || itemId;
      } else {
        // Handle substitution
        if (override.substitute_with) {
          const originalMaterialId = result[itemIndex].material_id;
          result[itemIndex] = {
            ...result[itemIndex],
            material_id: override.substitute_with,
            is_substituted: true
          };
          logEntry.metadata.action = 'substitute';
          logEntry.metadata.substitute_id = override.substitute_with;
          logEntry.metadata.original_material_id = originalMaterialId;
        }

        // Handle quantity (can be combined with substitution)
        if (override.quantity !== undefined) {
          const originalQty = result[itemIndex].quantity;
          result[itemIndex] = {
            ...result[itemIndex],
            quantity: override.quantity
          };
          if (!override.substitute_with) {
            logEntry.metadata.action = 'quantity';
          }
          logEntry.metadata.original_quantity = originalQty;
          logEntry.metadata.new_quantity = override.quantity;
        }
      }

      logs.push(logEntry);
    }

    return { items: result, overrideLogs: logs };
  }

  clearCache(): void {
    this.kitCache.clear();
  }

  getCacheSize(): number {
    return this.kitCache.size;
  }
}