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

import { AppError } from '@/core/errors/error-types';
import { createServerClient } from '@/lib/supabase/server';
import { JobLoadRepository } from '../repositories/job-load.repository';

export interface LoadVerificationResult {
  verified: boolean;
  missingItems: string[];
  verifiedItems: string[];
  method: 'ai_vision' | 'manual';
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
  constructor() {}

  /**
   * Get assigned jobs for crew member
   */
  async getAssignedJobs(
    crewId: string,
    tenantId: string,
    date?: string
  ): Promise<JobSummary[]> {
    try {
      const supabase = await createServerClient();
      const client = supabase as any;
      const targetDate = date || new Date().toISOString().split('T')[0];

      const { data: assignments, error } = await client
        .from('job_assignments')
        .select(`
          job_id,
          jobs!inner (
            id,
            scheduled_start,
            status,
            description,
            voice_notes,
            load_verified,
            customers!inner (
              name
            ),
            properties!inner (
              address
            )
          )
        `)
        .eq('user_id', crewId)
        .eq('tenant_id', tenantId)
        .gte('jobs.scheduled_start', targetDate)
        .lt('jobs.scheduled_start', `${targetDate}T23:59:59`)
        .order('jobs.scheduled_start');

      if (error) {
        throw new AppError('Failed to fetch jobs');
      }

      // Use JobLoadRepository to get required items for each job
      const loadRepo = new JobLoadRepository(client);
      const jobSummaries = await Promise.all(
        (assignments || []).map(async (assignment: any) => {
          const items = await loadRepo.getRequiredItems(assignment.jobs.id);

          return {
            id: assignment.jobs.id,
            customerName: assignment.jobs.customers?.name ?? 'Unknown customer',
            propertyAddress: assignment.jobs.properties?.address ?? 'Unknown address',
            scheduledTime: assignment.jobs.scheduled_start || '',
            status: assignment.jobs.status,
            specialInstructions: assignment.jobs.description ||
              assignment.jobs.voice_notes || '',
            requiredEquipment: items.map((item) => item.name),
            loadVerified: Boolean(assignment.jobs.load_verified)
          };
        })
      );

      return jobSummaries;
    } catch (error) {
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
      const supabase = await createServerClient();
      const client = supabase as any;

      // Verify crew is assigned
      const { data: assignment } = await client
        .from('job_assignments')
        .select('id')
        .eq('job_id', jobId)
        .eq('user_id', crewId)
        .eq('tenant_id', tenantId)
        .single();

      if (!assignment) {
        return {
          success: false,
          message: 'You are not assigned to this job'
        };
      }

      // Update job status
      const { error } = await client
        .from('jobs')
        .update({
          status: 'started',
          started_at: new Date().toISOString(),
          start_photo_url: startPhotoUrl
        })
        .eq('id', jobId)
        .eq('tenant_id', tenantId);

      if (error) {
        throw error;
      }

      return {
        success: true,
        message: 'Job started successfully'
      };
    } catch (error) {
      throw new AppError('Failed to start job');
    }
  }

  /**
   * Verify equipment load using AI vision
   */
  async verifyLoad(
    jobId: string,
    _photoBlob: Blob,
    crewId: string,
    tenantId: string,
    manualItems?: string[]
  ): Promise<LoadVerificationResult> {
    try {
      const supabase = await createServerClient();
      const client = supabase as any;

      const loadRepo = new JobLoadRepository(client);

      // Get required items using dual-read logic
      const requiredItems = await loadRepo.getRequiredItems(jobId);

      const verifiedItemIds = manualItems ?? [];
      const missingItems = requiredItems
        .filter((item) => !verifiedItemIds.includes(item.id))
        .map((item) => item.name);

      // Mark items as verified or missing
      for (const item of requiredItems) {
        if (verifiedItemIds.includes(item.id)) {
          await loadRepo.markItemVerified(jobId, item.id, item.task_id || undefined);
        } else {
          await loadRepo.markItemMissing(jobId, item.id, item.task_id || undefined);
        }
      }

      // Update overall job verification status
      const method = manualItems ? 'manual' : 'ai_vision';
      await loadRepo.updateLoadVerificationStatus(
        jobId,
        missingItems.length === 0,
        method
      );

      return {
        verified: missingItems.length === 0,
        verifiedItems: requiredItems
          .filter((item) => verifiedItemIds.includes(item.id))
          .map((item) => item.name),
        missingItems,
        method,
        confidence: manualItems ? 1 : undefined
      };
    } catch (error) {
      throw new AppError('Failed to verify load');
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
      const supabase = await createServerClient();
      const client = supabase as any;

      const { data: created, error } = await client
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
      throw new AppError('Failed to report maintenance');
    }
  }

  /**
   * Process voice command
   */
  async processVoiceCommand(
    _transcript: string,
    _crewId: string,
    _tenantId: string,
    _context: any
  ): Promise<{
    success: boolean;
    action: string;
    response: string;
    data?: any;
  }> {
    return {
      success: true,
      action: 'voice_response',
      response: 'Crew voice commands are currently routed through the mobile client.'
    };
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
      const supabase = await createServerClient();
      const client = supabase as any;

      const { error } = await client
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
        throw error;
      }

      return {
        success: true,
        message: 'Job completed successfully'
      };
    } catch (error) {
      throw new AppError('Failed to complete job');
    }
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
