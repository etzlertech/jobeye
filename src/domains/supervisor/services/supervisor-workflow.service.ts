/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/domains/supervisor/services/supervisor-workflow.service.ts
 * phase: 3
 * domain: supervisor
 * purpose: Service orchestrating supervisor workflows (inventory, jobs, assignments)
 * spec_ref: 007-mvp-intent-driven/contracts/supervisor-api.md
 * complexity_budget: 400
 * migrations_touched: ['inventory', 'jobs', 'crews', 'assignments']
 * state_machine: {
 *   jobCreation: {
 *     states: ['draft', 'scheduled', 'assigned', 'published'],
 *     transitions: [
 *       'draft->scheduled: scheduleJob()',
 *       'scheduled->assigned: assignCrew()', 
 *       'assigned->published: publishJob()'
 *     ]
 *   }
 * }
 * estimated_llm_cost: {
 *   "processVoiceCommand": "$0.02-0.05 (LLM + STT)",
 *   "inventoryAdd": "$0.02 (VLM for image)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [
 *     '@/domains/inventory/repositories',
 *     '@/domains/jobs/repositories',
 *     '@/domains/intent/services/intent-classification.service',
 *     '@/domains/intent/services/ai-interaction-logger.service',
 *     '@/core/errors/error-types'
 *   ],
 *   external: [],
 *   supabase: ['inventory', 'jobs', 'crews', 'assignments']
 * }
 * exports: ['SupervisorWorkflowService', 'WorkflowResult']
 * voice_considerations: Voice commands can trigger any supervisor action
 * test_requirements: {
 *   coverage: 85,
 *   unit_tests: 'tests/domains/supervisor/services/supervisor-workflow.test.ts'
 * }
 * tasks: [
 *   'Implement inventory management workflows',
 *   'Create job creation and assignment flows',
 *   'Add voice command processing',
 *   'Implement dashboard status aggregation'
 * ]
 */

import { IntentClassificationService } from '@/domains/intent/services/intent-classification.service';
import { AIInteractionLogger } from '@/domains/intent/services/ai-interaction-logger.service';
import { AppError } from '@/core/errors/error-types';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface WorkflowResult {
  success: boolean;
  action: string;
  data?: any;
  message: string;
  requiresConfirmation?: boolean;
}

export interface InventoryAddRequest {
  name: string;
  category: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  quantity?: number;
  container?: string;
  metadata?: Record<string, any>;
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

export interface DashboardStatus {
  todayJobs: {
    total: number;
    assigned: number;
    inProgress: number;
    completed: number;
  };
  crewStatus: Array<{
    id: string;
    name: string;
    currentJob?: string;
    jobsCompleted: number;
    jobsRemaining: number;
  }>;
  inventoryAlerts: Array<{
    itemId: string;
    itemName: string;
    alertType: 'low_stock' | 'missing' | 'maintenance_due';
    severity: 'high' | 'medium' | 'low';
  }>;
  recentActivity: Array<{
    timestamp: Date;
    type: string;
    description: string;
    userId: string;
  }>;
}

export class SupervisorWorkflowService {
  private intentService: IntentClassificationService;
  private aiLogger: AIInteractionLogger;
  private readonly JOB_LIMIT_PER_CREW = 6;

  constructor() {
    this.intentService = new IntentClassificationService();
    this.aiLogger = new AIInteractionLogger();
  }

  /**
   * Add inventory item with image recognition
   */
  async addInventoryItem(
    request: InventoryAddRequest,
    tenantId: string,
    userId: string
  ): Promise<WorkflowResult> {
    try {
      const supabase = await createServerSupabaseClient();

      // Check for duplicates
      const { data: existing } = await supabase
        .from('inventory')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .ilike('name', `%${request.name}%`)
        .limit(5);

      if (existing && existing.length > 0) {
        return {
          success: true,
          action: 'duplicate_check',
          data: { 
            possibleDuplicates: existing,
            originalRequest: request 
          },
          message: `Found ${existing.length} similar items. Add anyway?`,
          requiresConfirmation: true
        };
      }

      // Add to inventory
      const { data: item, error } = await supabase
        .from('inventory')
        .insert({
          tenant_id: tenantId,
          name: request.name,
          category: request.category,
          image_url: request.imageUrl,
          thumbnail_url: request.thumbnailUrl,
          quantity: request.quantity || 1,
          container_id: request.container,
          metadata: request.metadata,
          created_by: userId
        })
        .select()
        .single();

      if (error) {
        throw new AppError('Failed to add inventory item', {
          code: 'INVENTORY_ADD_ERROR',
          details: error
        });
      }

      return {
        success: true,
        action: 'inventory_added',
        data: item,
        message: `${request.name} added to inventory`
      };
    } catch (error) {
      return {
        success: false,
        action: 'inventory_add_failed',
        message: error instanceof Error ? error.message : 'Failed to add item'
      };
    }
  }

  /**
   * Create and schedule a job
   */
  async createJob(
    request: JobCreateRequest,
    tenantId: string,
    userId: string
  ): Promise<WorkflowResult> {
    try {
      const supabase = await createServerSupabaseClient();

      // Validate crew assignments don't exceed limits
      if (request.assignedCrewIds && request.assignedCrewIds.length > 0) {
        const validation = await this.validateCrewAssignments(
          request.assignedCrewIds,
          request.scheduledDate,
          tenantId
        );

        if (!validation.valid) {
          return {
            success: false,
            action: 'crew_limit_exceeded',
            data: validation.violations,
            message: validation.message,
            requiresConfirmation: true
          };
        }
      }

      // Create job
      const { data: job, error } = await supabase
        .from('jobs')
        .insert({
          tenant_id: tenantId,
          customer_id: request.customerId,
          property_id: request.propertyId,
          scheduled_date: request.scheduledDate,
          scheduled_time: request.scheduledTime,
          template_id: request.templateId,
          special_instructions: request.specialInstructions,
          voice_instructions: request.voiceInstructions,
          status: 'scheduled',
          created_by: userId,
          assigned_by_intent: true,
          intent_metadata: {
            createdViaVoice: !!request.voiceInstructions,
            requiredEquipment: request.requiredEquipment
          }
        })
        .select()
        .single();

      if (error) {
        throw new AppError('Failed to create job', {
          code: 'JOB_CREATE_ERROR',
          details: error
        });
      }

      // Create assignments if crew specified
      if (request.assignedCrewIds && request.assignedCrewIds.length > 0) {
        const assignments = request.assignedCrewIds.map(crewId => ({
          tenant_id: tenantId,
          job_id: job.id,
          crew_id: crewId,
          assigned_by: userId,
          assigned_at: new Date().toISOString()
        }));

        await supabase.from('job_assignments').insert(assignments);
      }

      return {
        success: true,
        action: 'job_created',
        data: job,
        message: `Job scheduled for ${new Date(request.scheduledDate).toLocaleDateString()}`
      };
    } catch (error) {
      return {
        success: false,
        action: 'job_create_failed',
        message: error instanceof Error ? error.message : 'Failed to create job'
      };
    }
  }

  /**
   * Assign crew to existing job
   */
  async assignCrewToJob(
    jobId: string,
    crewIds: string[],
    tenantId: string,
    userId: string
  ): Promise<WorkflowResult> {
    try {
      const supabase = await createServerSupabaseClient();

      // Get job details
      const { data: job } = await supabase
        .from('jobs')
        .select('scheduled_date, status')
        .eq('id', jobId)
        .eq('tenant_id', tenantId)
        .single();

      if (!job) {
        return {
          success: false,
          action: 'job_not_found',
          message: 'Job not found'
        };
      }

      // Validate crew assignments
      const validation = await this.validateCrewAssignments(
        crewIds,
        job.scheduled_date,
        tenantId
      );

      if (!validation.valid) {
        return {
          success: false,
          action: 'crew_limit_exceeded',
          data: validation.violations,
          message: validation.message
        };
      }

      // Create assignments
      const assignments = crewIds.map(crewId => ({
        tenant_id: tenantId,
        job_id: jobId,
        crew_id: crewId,
        assigned_by: userId,
        assigned_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('job_assignments')
        .insert(assignments);

      if (error) {
        throw new AppError('Failed to assign crew', {
          code: 'CREW_ASSIGN_ERROR',
          details: error
        });
      }

      // Update job status
      await supabase
        .from('jobs')
        .update({ status: 'assigned' })
        .eq('id', jobId)
        .eq('tenant_id', tenantId);

      return {
        success: true,
        action: 'crew_assigned',
        data: { jobId, crewIds },
        message: `Assigned ${crewIds.length} crew members to job`
      };
    } catch (error) {
      return {
        success: false,
        action: 'crew_assign_failed',
        message: error instanceof Error ? error.message : 'Failed to assign crew'
      };
    }
  }

  /**
   * Get dashboard status
   */
  async getDashboardStatus(tenantId: string): Promise<DashboardStatus> {
    const supabase = await createServerSupabaseClient();
    const today = new Date().toISOString().split('T')[0];

    // Get today's jobs
    const { data: todayJobs } = await supabase
      .from('jobs')
      .select('id, status')
      .eq('tenant_id', tenantId)
      .eq('scheduled_date', today);

    const jobStats = {
      total: todayJobs?.length || 0,
      assigned: 0,
      inProgress: 0,
      completed: 0
    };

    todayJobs?.forEach(job => {
      switch (job.status) {
        case 'assigned':
          jobStats.assigned++;
          break;
        case 'in_progress':
          jobStats.inProgress++;
          break;
        case 'completed':
          jobStats.completed++;
          break;
      }
    });

    // Get crew status
    const { data: crews } = await supabase
      .from('crews')
      .select(`
        id,
        name,
        job_assignments!inner (
          job_id,
          jobs!inner (
            id,
            status,
            scheduled_date
          )
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('job_assignments.jobs.scheduled_date', today);

    const crewStatus = crews?.map(crew => {
      const assignments = crew.job_assignments || [];
      const completed = assignments.filter(
        (a: any) => a.jobs?.status === 'completed'
      ).length;
      const inProgress = assignments.find(
        (a: any) => a.jobs?.status === 'in_progress'
      );

      return {
        id: crew.id,
        name: crew.name,
        currentJob: inProgress?.job_id,
        jobsCompleted: completed,
        jobsRemaining: assignments.length - completed
      };
    }) || [];

    // Get inventory alerts (simplified)
    const { data: lowStock } = await supabase
      .from('inventory')
      .select('id, name, quantity, min_quantity')
      .eq('tenant_id', tenantId)
      .lt('quantity', supabase.sql`min_quantity`);

    const inventoryAlerts = lowStock?.map(item => ({
      itemId: item.id,
      itemName: item.name,
      alertType: 'low_stock' as const,
      severity: item.quantity === 0 ? 'high' as const : 'medium' as const
    })) || [];

    // Get recent activity
    const { data: recentLogs } = await supabase
      .from('activity_logs')
      .select('created_at, event_type, description, user_id')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(10);

    const recentActivity = recentLogs?.map(log => ({
      timestamp: new Date(log.created_at),
      type: log.event_type,
      description: log.description,
      userId: log.user_id
    })) || [];

    return {
      todayJobs: jobStats,
      crewStatus,
      inventoryAlerts,
      recentActivity
    };
  }

  /**
   * Process voice command
   */
  async processVoiceCommand(
    transcript: string,
    tenantId: string,
    userId: string,
    context: any
  ): Promise<WorkflowResult> {
    const startTime = Date.now();

    try {
      // Use LLM to understand intent
      const response = await fetch('/api/ai/process-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          context,
          role: 'supervisor'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to process command');
      }

      const result = await response.json();

      // Log AI interaction
      await this.aiLogger.logInteraction({
        userId,
        tenantId,
        interactionType: 'llm',
        modelUsed: 'gpt-4',
        prompt: transcript,
        response: result,
        responseTimeMs: Date.now() - startTime,
        costUsd: 0.03 // Estimate
      });

      // Execute action based on intent
      switch (result.intent) {
        case 'create_job':
          return this.createJob(result.parameters, tenantId, userId);
        
        case 'assign_crew':
          return this.assignCrewToJob(
            result.parameters.jobId,
            result.parameters.crewIds,
            tenantId,
            userId
          );
        
        case 'check_inventory':
          return {
            success: true,
            action: 'show_inventory',
            data: result.parameters,
            message: result.response
          };
        
        default:
          return {
            success: true,
            action: 'voice_response',
            message: result.response
          };
      }
    } catch (error) {
      return {
        success: false,
        action: 'voice_command_failed',
        message: 'Sorry, I couldn\'t process that command'
      };
    }
  }

  /**
   * Validate crew assignments against daily limits
   */
  private async validateCrewAssignments(
    crewIds: string[],
    scheduledDate: string,
    tenantId: string
  ): Promise<{
    valid: boolean;
    message: string;
    violations?: any[];
  }> {
    const supabase = await createServerSupabaseClient();

    // Get existing assignments for the date
    const { data: existingAssignments } = await supabase
      .from('job_assignments')
      .select(`
        crew_id,
        jobs!inner (
          scheduled_date,
          status
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('jobs.scheduled_date', scheduledDate)
      .in('crew_id', crewIds);

    // Count assignments per crew
    const assignmentCounts: Record<string, number> = {};
    existingAssignments?.forEach(assignment => {
      const crewId = assignment.crew_id;
      assignmentCounts[crewId] = (assignmentCounts[crewId] || 0) + 1;
    });

    // Check for violations
    const violations = crewIds
      .filter(crewId => (assignmentCounts[crewId] || 0) >= this.JOB_LIMIT_PER_CREW)
      .map(crewId => ({
        crewId,
        currentJobs: assignmentCounts[crewId],
        limit: this.JOB_LIMIT_PER_CREW
      }));

    if (violations.length > 0) {
      return {
        valid: false,
        message: `Some crew members have reached their daily job limit`,
        violations
      };
    }

    return {
      valid: true,
      message: 'All assignments valid'
    };
  }
}