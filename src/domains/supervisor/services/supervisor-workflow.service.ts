/**
 * SupervisorWorkflowService
 * Modern orchestration layer wired to the consolidated inventory + job schemas.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { JobsRepository } from '@/domains/jobs/repositories/jobs.repository';
import {
  createAppError,
  ErrorSeverity,
  ErrorCategory,
} from '@/core/errors/error-types';
import { AIInteractionLogger } from '@/domains/intent/services/ai-interaction-logger.service';

export interface WorkflowResult<T = any> {
  success: boolean;
  action: string;
  message: string;
  data?: T;
  requiresConfirmation?: boolean;
}

export interface InventoryAddRequest {
  name: string;
  category: 'equipment' | 'materials' | 'tools' | 'safety' | 'other';
  quantity?: number;
  container?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface JobCreateRequest {
  customerId: string;
  propertyId: string;
  scheduledDate: string;
  scheduledTime: string;
  templateId?: string;
  specialInstructions?: string;
  voiceInstructions?: string;
  assignedCrewIds?: string[];
  requiredEquipment?: string[];
}

type ItemRow = Database['public']['Tables']['items']['Row'];
type SimplifiedItem = Pick<
  ItemRow,
  | 'id'
  | 'name'
  | 'category'
  | 'current_quantity'
  | 'current_location_id'
  | 'primary_image_url'
  | 'thumbnail_url'
  | 'created_at'
>;

export class SupervisorWorkflowService {
  private readonly supabase: SupabaseClient<any>;
  private readonly jobsRepository: JobsRepository;
  private readonly aiLogger: AIInteractionLogger;
  private readonly JOB_LIMIT_PER_CREW = 6;

  constructor(
    supabase: SupabaseClient<Database>,
    dependencies: {
      aiLogger?: AIInteractionLogger;
    } = {}
  ) {
    this.supabase = supabase as unknown as SupabaseClient<any>;
    this.jobsRepository = new JobsRepository(supabase);
    this.aiLogger = dependencies.aiLogger ?? new AIInteractionLogger();
  }

  /**
   * Add an inventory item (items table)
   */
  async addInventoryItem(
    request: InventoryAddRequest,
    tenantId: string,
    userId: string
  ): Promise<WorkflowResult> {
    try {
      const itemType = this.resolveItemType(request.category);
      const trackingMode = 'quantity';

      const { data: existing } = await this.supabase
        .from('items')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .ilike('name', `%${request.name}%`)
        .limit(5);

      if (existing && existing.length > 0) {
        return {
          success: true,
          action: 'duplicate_check',
          message: `Found ${existing.length} similar items. Add anyway?`,
          data: {
            possibleDuplicates: existing,
            originalRequest: request,
          },
          requiresConfirmation: true,
        };
      }

      const insertPayload: Database['public']['Tables']['items']['Insert'] = {
        tenant_id: tenantId,
        item_type: itemType,
        category: request.category,
        tracking_mode: trackingMode,
        name: request.name,
        description:
          typeof request.metadata?.description === 'string'
            ? (request.metadata.description as string)
            : null,
        current_quantity: request.quantity ?? 1,
        current_location_id: request.container ?? null,
        primary_image_url: request.imageUrl ?? null,
        thumbnail_url: request.thumbnailUrl ?? null,
        tags: Array.isArray(request.metadata?.tags)
          ? (request.metadata?.tags as string[])
          : null,
        custom_fields:
          (request.metadata ?? null) as Database['public']['Tables']['items']['Insert']['custom_fields'],
        created_by: userId,
      };

      const { data: insertedItem, error } = await this.supabase
        .from('items')
        .insert(insertPayload)
        .select(
          'id, name, category, current_quantity, current_location_id, primary_image_url, thumbnail_url, created_at'
        )
        .single();

      if (error) {
        throw createAppError({
          code: 'INVENTORY_ADD_ERROR',
          message: 'Failed to add inventory item',
          severity: ErrorSeverity.MEDIUM,
          category: ErrorCategory.DATABASE,
          originalError: error,
        });
      }

      const item = insertedItem as SimplifiedItem;

      return {
        success: true,
        action: 'inventory_added',
        message: `${request.name} added to inventory`,
        data: {
          id: item.id,
          name: item.name,
          category: item.category,
          quantity: item.current_quantity ?? 0,
          container_id: item.current_location_id,
          image_url: item.primary_image_url,
          thumbnail_url: item.thumbnail_url,
          created_at: item.created_at,
        },
      };
    } catch (error) {
      return {
        success: false,
        action: 'inventory_add_failed',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to add inventory item',
      };
    }
  }

  /**
   * Create a job within the consolidated jobs table and optionally assign crew
   */
  async createJob(
    request: JobCreateRequest,
    tenantId: string,
    userId: string
  ): Promise<WorkflowResult> {
    try {
      const jobNumber = await this.jobsRepository.generateJobNumber(tenantId);
      const scheduledStart = this.combineDateAndTime(
        request.scheduledDate,
        request.scheduledTime
      );
      const scheduledEnd = new Date(scheduledStart.getTime() + 60 * 60 * 1000);

      const jobMetadata =
        request.requiredEquipment?.length || request.voiceInstructions
          ? {
              requiredEquipment: request.requiredEquipment ?? [],
              voiceInstructions: request.voiceInstructions ?? null,
            }
          : null;

      const insertPayload: Database['public']['Tables']['jobs']['Insert'] = {
        tenant_id: tenantId,
        job_number: jobNumber,
        customer_id: request.customerId,
        property_id: request.propertyId,
        title: request.templateId
          ? `Template Job ${request.templateId}`
          : 'Scheduled Job',
        description: request.specialInstructions ?? null,
        status: 'scheduled',
        priority: 'normal',
        scheduled_start: scheduledStart.toISOString(),
        scheduled_end: scheduledEnd.toISOString(),
        metadata: jobMetadata as Database['public']['Tables']['jobs']['Insert']['metadata'],
        created_by: userId,
      };

      const { data: insertedJob, error } = await this.supabase
        .from('jobs')
        .insert(insertPayload)
        .select('*')
        .single();

      if (error) {
        throw createAppError({
          code: 'JOB_CREATE_ERROR',
          message: 'Failed to create job',
          severity: ErrorSeverity.MEDIUM,
          category: ErrorCategory.DATABASE,
          originalError: error,
        });
      }

      const job = insertedJob as Database['public']['Tables']['jobs']['Row'];

      if (request.assignedCrewIds?.length) {
        const validation = await this.validateCrewAssignments(
          request.assignedCrewIds,
          scheduledStart,
          tenantId
        );

        if (!validation.valid) {
          return {
            success: false,
            action: 'crew_limit_exceeded',
            message: validation.message,
            data: validation.violations,
            requiresConfirmation: true,
          };
        }

        await this.assignCrew(job.id, request.assignedCrewIds, tenantId, userId);
      }

      return {
        success: true,
        action: 'job_created',
        message: 'Job scheduled successfully',
        data: job,
      };
    } catch (error) {
      return {
        success: false,
        action: 'job_create_failed',
        message: error instanceof Error ? error.message : 'Failed to create job',
      };
    }
  }

  /**
   * Assign crew members (user ids) to a job.
   */
  async assignCrewToJob(
    jobId: string,
    crewIds: string[],
    tenantId: string,
    userId: string
  ): Promise<WorkflowResult> {
    try {
      const { data: jobRow, error: jobError } = await this.supabase
        .from('jobs')
        .select('id, scheduled_start, status')
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .single();

      if (jobError || !jobRow) {
        return {
          success: false,
          action: 'job_not_found',
          message: 'Job not found',
        };
      }

      const job = jobRow as {
        id: string;
        scheduled_start: string | null;
        status: string | null;
      };

      const scheduledStart = job.scheduled_start
        ? new Date(job.scheduled_start)
        : new Date();

      const validation = await this.validateCrewAssignments(
        crewIds,
        scheduledStart,
        tenantId
      );

      if (!validation.valid) {
        return {
          success: false,
          action: 'crew_limit_exceeded',
          message: validation.message,
          data: validation.violations,
        };
      }

      await this.assignCrew(jobId, crewIds, tenantId, userId);

      // Update job status to assigned if applicable
      if (job.status === 'scheduled') {
        await this.supabase
          .from('jobs')
          .update({ status: 'assigned' })
          .eq('id', jobId)
          .eq('tenant_id', tenantId);
      }

      return {
        success: true,
        action: 'crew_assigned',
        message: 'Crew assigned successfully',
        data: { jobId, crewIds },
      };
    } catch (error) {
      return {
        success: false,
        action: 'crew_assign_failed',
        message:
          error instanceof Error ? error.message : 'Failed to assign crew',
      };
    }
  }

  /**
   * Process supervisor voice command by delegating to intent-based actions.
   */
  async processVoiceCommand(
    transcript: string,
    tenantId: string,
    userId: string,
    context?: Record<string, unknown>
  ): Promise<WorkflowResult> {
    const startTime = Date.now();

    try {
      await this.aiLogger.logInteraction({
        userId,
        tenantId,
        interactionType: 'llm',
        modelUsed: 'gpt-3.5-turbo',
        prompt: transcript,
        response: { transcript, context },
        responseTimeMs: Date.now() - startTime,
        costUsd: 0.04,
        metadata: { context },
      });

      return {
        success: true,
        action: 'voice_processed',
        message: 'Command logged for follow-up',
        data: { transcript, context },
      };
    } catch (error) {
      return {
        success: false,
        action: 'voice_command_failed',
        message:
          error instanceof Error ? error.message : 'Unable to process command',
      };
    }
  }

  /**
   * Resolve category to item_type
   */
  private resolveItemType(
    category: InventoryAddRequest['category']
  ): Database['public']['Tables']['items']['Insert']['item_type'] {
    switch (category) {
      case 'equipment':
        return 'equipment';
      case 'materials':
        return 'material';
      case 'tools':
        return 'tool';
      default:
        return 'consumable';
    }
  }

  private combineDateAndTime(date: string, time: string): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const scheduledDate = new Date(date);
    scheduledDate.setHours(hours, minutes, 0, 0);
    return scheduledDate;
  }

  private async assignCrew(
    jobId: string,
    crewIds: string[],
    tenantId: string,
    userId: string
  ): Promise<void> {
    if (crewIds.length === 0) return;

    const assignments = crewIds.map(
      (crewId): Database['public']['Tables']['job_assignments']['Insert'] => ({
        tenant_id: tenantId,
        job_id: jobId,
        user_id: crewId,
        assigned_by: userId,
      })
    );

    const { error } = await this.supabase
      .from('job_assignments')
      .insert(assignments);

    if (error) {
      throw createAppError({
        code: 'CREW_ASSIGN_ERROR',
        message: 'Failed to assign crew',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error,
      });
    }
  }

  private async validateCrewAssignments(
    crewIds: string[],
    scheduledDate: Date,
    tenantId: string
  ): Promise<{
    valid: boolean;
    message: string;
    violations?: Array<{ crewId: string; currentJobs: number; limit: number }>;
  }> {
    if (crewIds.length === 0) {
      return { valid: true, message: 'No crew to validate' };
    }

    const { data: assignmentRows, error } = await this.supabase
      .from('job_assignments')
      .select('user_id, jobs:jobs!inner(scheduled_start)')
      .eq('tenant_id', tenantId)
      .in('user_id', crewIds);

    if (error) {
      throw createAppError({
        code: 'CREW_VALIDATION_ERROR',
        message: 'Failed to validate crew assignments',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.DATABASE,
        originalError: error,
      });
    }

    const startOfDay = new Date(scheduledDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const assignments = ((assignmentRows ?? []) as unknown) as Array<{
      user_id: string;
      jobs: { scheduled_start: string | null } | null;
    }>;

    const counts: Record<string, number> = {};
    for (const assignment of assignments) {
      const userId = assignment.user_id;
      const scheduledStart = assignment.jobs?.scheduled_start
        ? new Date(assignment.jobs.scheduled_start)
        : null;

      if (
        scheduledStart &&
        scheduledStart >= startOfDay &&
        scheduledStart < endOfDay
      ) {
        counts[userId] = (counts[userId] ?? 0) + 1;
      }
    }

    const violations = crewIds
      .filter((id) => (counts[id] ?? 0) >= this.JOB_LIMIT_PER_CREW)
      .map((id) => ({
        crewId: id,
        currentJobs: counts[id],
        limit: this.JOB_LIMIT_PER_CREW,
      }));

    if (violations.length > 0) {
      return {
        valid: false,
        message: 'One or more crew members have reached their daily limit',
        violations,
      };
    }

    return {
      valid: true,
      message: 'Crew assignments within daily limits',
    };
  }
}
