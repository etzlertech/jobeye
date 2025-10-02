/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/domains/crew/services/crew-workflow.service.ts
 * phase: 3
 * domain: crew
 * purpose: Service orchestrating crew member workflows (jobs, equipment, maintenance)
 * spec_ref: 007-mvp-intent-driven/contracts/crew-api.md
 * complexity_budget: 350
 * migrations_touched: ['jobs', 'equipment', 'maintenance_reports']
 * state_machine: {
 *   jobExecution: {
 *     states: ['assigned', 'started', 'equipment_verified', 'in_progress', 'completed'],
 *     transitions: [
 *       'assigned->started: startJob()',
 *       'started->equipment_verified: verifyEquipment()',
 *       'equipment_verified->in_progress: beginWork()',
 *       'in_progress->completed: completeJob()'
 *     ]
 *   }
 * }
 * estimated_llm_cost: {
 *   "processVoiceCommand": "$0.02-0.05 (LLM + STT)",
 *   "verifyLoad": "$0.02-0.05 (VLM)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [
 *     '@/domains/jobs/repositories',
 *     '@/domains/vision/services/vision-verification.service',
 *     '@/domains/intent/services/ai-interaction-logger.service',
 *     '@/core/errors/error-types'
 *   ],
 *   external: [],
 *   supabase: ['jobs', 'job_assignments', 'maintenance_reports']
 * }
 * exports: ['CrewWorkflowService', 'LoadVerificationResult', 'MaintenanceReport']
 * voice_considerations: Voice commands for hands-free operation while working
 * test_requirements: {
 *   coverage: 85,
 *   unit_tests: 'tests/domains/crew/services/crew-workflow.test.ts'
 * }
 * tasks: [
 *   'Implement job workflow state management',
 *   'Create equipment verification flows',
 *   'Add maintenance reporting',
 *   'Implement voice command processing'
 * ]
 */

import { VisionVerificationService } from '@/domains/vision/services/vision-verification.service';
import { AIInteractionLogger } from '@/domains/intent/services/ai-interaction-logger.service';
import { AppError } from '@/core/errors/error-types';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { OfflineDatabase } from '@/lib/offline/offline-db';

export interface LoadVerificationResult {
  verified: boolean;
  missingItems: string[];
  verifiedItems: string[];
  method: 'ai_vision' | 'manual' | 'voice';
  photoUrl?: string;
  confidence?: number;
}

export interface MaintenanceReport {
  id: string;
  equipmentId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  photoUrls: string[];
  reportedAt: Date;
  reportedBy: string;
}

export interface JobSummary {
  id: string;
  customerName: string;
  propertyAddress: string;
  scheduledTime: string;
  status: string;
  specialInstructions?: string;
  requiredEquipment: string[];
  loadVerified: boolean;
}

export class CrewWorkflowService {
  private visionService: VisionVerificationService;
  private aiLogger: AIInteractionLogger;
  private offlineDb: OfflineDatabase;

  constructor() {
    this.visionService = new VisionVerificationService();
    this.aiLogger = new AIInteractionLogger();
    this.offlineDb = new OfflineDatabase();
  }

  /**
   * Get assigned jobs for crew member
   */
  async getAssignedJobs(
    crewId: string,
    tenantId: string,
    date?: string
  ): Promise<JobSummary[]> {
    try {
      const supabase = await createServerSupabaseClient();
      const targetDate = date || new Date().toISOString().split('T')[0];

      const { data: assignments, error } = await supabase
        .from('job_assignments')
        .select(`
          job_id,
          jobs!inner (
            id,
            scheduled_date,
            scheduled_time,
            status,
            special_instructions,
            voice_instructions,
            load_verified,
            customers!inner (
              name
            ),
            properties!inner (
              address
            ),
            job_equipment!inner (
              equipment!inner (
                id,
                name
              )
            )
          )
        `)
        .eq('crew_id', crewId)
        .eq('tenant_id', tenantId)
        .eq('jobs.scheduled_date', targetDate)
        .order('jobs.scheduled_time');

      if (error) {
        throw new AppError('Failed to fetch jobs', {
          code: 'JOBS_FETCH_ERROR',
          details: error
        });
      }

      return assignments?.map(assignment => ({
        id: assignment.jobs.id,
        customerName: assignment.jobs.customers.name,
        propertyAddress: assignment.jobs.properties.address,
        scheduledTime: assignment.jobs.scheduled_time,
        status: assignment.jobs.status,
        specialInstructions: assignment.jobs.special_instructions || 
                           assignment.jobs.voice_instructions,
        requiredEquipment: assignment.jobs.job_equipment.map(
          (je: any) => je.equipment.name
        ),
        loadVerified: assignment.jobs.load_verified
      })) || [];
    } catch (error) {
      // Try offline cache
      if (navigator && !navigator.onLine) {
        const cached = await this.offlineDb.getCachedEntity(
          'crew_jobs',
          `${crewId}_${date}`
        );
        return cached?.data || [];
      }
      throw error;
    }
  }

  /**
   * Start a job
   */
  async startJob(
    jobId: string,
    crewId: string,
    tenantId: string,
    startPhotoUrl?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const supabase = await createServerSupabaseClient();

      // Verify crew is assigned
      const { data: assignment } = await supabase
        .from('job_assignments')
        .select('id')
        .eq('job_id', jobId)
        .eq('crew_id', crewId)
        .eq('tenant_id', tenantId)
        .single();

      if (!assignment) {
        return {
          success: false,
          message: 'You are not assigned to this job'
        };
      }

      // Update job status
      const { error } = await supabase
        .from('jobs')
        .update({
          status: 'started',
          started_at: new Date().toISOString(),
          start_photo_url: startPhotoUrl
        })
        .eq('id', jobId)
        .eq('tenant_id', tenantId);

      if (error) {
        if (navigator && !navigator.onLine) {
          await this.queueOfflineUpdate('jobs', jobId, {
            status: 'started',
            started_at: new Date().toISOString()
          });
          return {
            success: true,
            message: 'Job start queued for sync'
          };
        }
        throw error;
      }

      return {
        success: true,
        message: 'Job started successfully'
      };
    } catch (error) {
      throw new AppError('Failed to start job', {
        code: 'JOB_START_ERROR',
        details: error
      });
    }
  }

  /**
   * Verify equipment load using AI vision
   */
  async verifyLoad(
    jobId: string,
    photoBlob: Blob,
    crewId: string,
    tenantId: string,
    manualItems?: string[]
  ): Promise<LoadVerificationResult> {
    const startTime = Date.now();

    try {
      const supabase = await createServerSupabaseClient();

      // Get required equipment for job
      const { data: jobEquipment } = await supabase
        .from('job_equipment')
        .select('equipment!inner(id, name)')
        .eq('job_id', jobId)
        .eq('tenant_id', tenantId);

      const requiredItems = jobEquipment?.map(je => ({
        id: je.equipment.id,
        name: je.equipment.name
      })) || [];

      let result: LoadVerificationResult;

      if (manualItems) {
        // Manual verification
        result = {
          verified: manualItems.length === requiredItems.length,
          verifiedItems: manualItems,
          missingItems: requiredItems
            .filter(item => !manualItems.includes(item.id))
            .map(item => item.name),
          method: 'manual'
        };
      } else {
        // AI vision verification
        const visionResult = await this.visionService.verifyKit({
          photo: photoBlob,
          kitId: jobId,
          jobId
        });

        result = {
          verified: visionResult.verified,
          verifiedItems: visionResult.detectedItems,
          missingItems: visionResult.missingItems,
          method: 'ai_vision',
          photoUrl: visionResult.photoUrl,
          confidence: visionResult.confidence
        };

        // Log AI usage
        await this.aiLogger.logInteraction({
          userId: crewId,
          tenantId,
          interactionType: 'vlm',
          modelUsed: visionResult.modelUsed || 'yolo-local',
          prompt: 'Equipment verification',
          imageUrl: visionResult.photoUrl,
          response: visionResult,
          responseTimeMs: Date.now() - startTime,
          costUsd: visionResult.cost || 0
        });
      }

      // Update job with verification status
      await supabase
        .from('jobs')
        .update({
          load_verified: result.verified,
          load_verified_at: new Date().toISOString(),
          load_verification_method: result.method
        })
        .eq('id', jobId)
        .eq('tenant_id', tenantId);

      return result;
    } catch (error) {
      if (navigator && !navigator.onLine) {
        // Queue for offline
        await this.queueOfflineUpdate('load_verifications', jobId, {
          verified: false,
          method: 'manual',
          items: manualItems || []
        });

        return {
          verified: false,
          verifiedItems: [],
          missingItems: [],
          method: 'manual'
        };
      }

      throw new AppError('Failed to verify load', {
        code: 'LOAD_VERIFY_ERROR',
        details: error
      });
    }
  }

  /**
   * Report maintenance issue
   */
  async reportMaintenance(
    report: {
      equipmentId: string;
      severity: 'critical' | 'high' | 'medium' | 'low';
      description: string;
      photoUrls?: string[];
    },
    crewId: string,
    tenantId: string
  ): Promise<MaintenanceReport> {
    try {
      const supabase = await createServerSupabaseClient();

      const { data: created, error } = await supabase
        .from('maintenance_reports')
        .insert({
          tenant_id: tenantId,
          equipment_id: report.equipmentId,
          severity: report.severity,
          description: report.description,
          photo_urls: report.photoUrls || [],
          reported_by: crewId,
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        if (navigator && !navigator.onLine) {
          const tempId = `offline-${Date.now()}`;
          await this.offlineDb.queueOperation({
            operation: 'create',
            entity: 'maintenance_reports',
            data: {
              ...report,
              reported_by: crewId,
              tenant_id: tenantId
            },
            priority: report.severity === 'critical' ? 'critical' : 'medium'
          });

          return {
            id: tempId,
            ...report,
            reportedAt: new Date(),
            reportedBy: crewId,
            photoUrls: report.photoUrls || []
          };
        }
        throw error;
      }

      // Notify supervisor if critical
      if (report.severity === 'critical') {
        await this.notifySupervisor(created.id, tenantId);
      }

      return {
        id: created.id,
        equipmentId: created.equipment_id,
        severity: created.severity,
        description: created.description,
        photoUrls: created.photo_urls,
        reportedAt: new Date(created.created_at),
        reportedBy: created.reported_by
      };
    } catch (error) {
      throw new AppError('Failed to report maintenance', {
        code: 'MAINTENANCE_REPORT_ERROR',
        details: error
      });
    }
  }

  /**
   * Process voice command
   */
  async processVoiceCommand(
    transcript: string,
    crewId: string,
    tenantId: string,
    context: any
  ): Promise<{
    success: boolean;
    action: string;
    response: string;
    data?: any;
  }> {
    const startTime = Date.now();

    try {
      // Process with LLM
      const response = await fetch('/api/ai/process-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          context: {
            ...context,
            role: 'crew',
            crewId
          }
        })
      });

      const result = await response.json();

      // Log interaction
      await this.aiLogger.logInteraction({
        userId: crewId,
        tenantId,
        interactionType: 'llm',
        modelUsed: 'gpt-3.5-turbo',
        prompt: transcript,
        response: result,
        responseTimeMs: Date.now() - startTime,
        costUsd: 0.002
      });

      // Handle specific intents
      switch (result.intent) {
        case 'check_job_status':
          const jobs = await this.getAssignedJobs(crewId, tenantId);
          return {
            success: true,
            action: 'show_jobs',
            response: `You have ${jobs.length} jobs today`,
            data: jobs
          };

        case 'report_issue':
          return {
            success: true,
            action: 'open_maintenance_form',
            response: 'What equipment has an issue?',
            data: result.parameters
          };

        case 'verify_equipment':
          return {
            success: true,
            action: 'open_camera',
            response: 'Take a photo of your equipment',
            data: { jobId: result.parameters.jobId }
          };

        default:
          return {
            success: true,
            action: 'voice_response',
            response: result.response
          };
      }
    } catch (error) {
      return {
        success: false,
        action: 'error',
        response: 'Sorry, I couldn\'t understand that'
      };
    }
  }

  /**
   * Complete a job
   */
  async completeJob(
    jobId: string,
    crewId: string,
    tenantId: string,
    completionPhotoUrl?: string,
    notes?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const supabase = await createServerSupabaseClient();

      const { error } = await supabase
        .from('jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completion_photo_url: completionPhotoUrl,
          completion_notes: notes
        })
        .eq('id', jobId)
        .eq('tenant_id', tenantId);

      if (error) {
        if (navigator && !navigator.onLine) {
          await this.queueOfflineUpdate('jobs', jobId, {
            status: 'completed',
            completed_at: new Date().toISOString()
          });
          return {
            success: true,
            message: 'Job completion queued for sync'
          };
        }
        throw error;
      }

      return {
        success: true,
        message: 'Job completed successfully'
      };
    } catch (error) {
      throw new AppError('Failed to complete job', {
        code: 'JOB_COMPLETE_ERROR',
        details: error
      });
    }
  }

  /**
   * Queue offline update
   */
  private async queueOfflineUpdate(
    entity: string,
    entityId: string,
    data: any
  ): Promise<void> {
    await this.offlineDb.queueOperation({
      operation: 'update',
      entity,
      entityId,
      data,
      priority: 'medium'
    });
  }

  /**
   * Notify supervisor of critical issue
   */
  private async notifySupervisor(
    reportId: string,
    tenantId: string
  ): Promise<void> {
    // In a real app, this would send push notification or SMS
    console.log(`Critical maintenance report ${reportId} for tenant ${tenantId}`);
  }
}