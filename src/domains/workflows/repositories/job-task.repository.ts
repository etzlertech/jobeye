/**
 * T060: JobTaskRepository
 * Repository for managing AI-parsed job tasks with status tracking and completion verification
 */
import { SupabaseClient } from '@supabase/supabase-js';

export interface JobTask {
  id: string;
  tenant_id: string;
  job_id: string;
  task_template_id?: string;
  title: string;
  description?: string;
  sequence: number;
  category?: string;
  estimated_duration_mins?: number;
  actual_duration_mins?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'blocked';
  completion_photo_id?: string;
  completion_verified: boolean;
  verification_confidence?: number;
  verification_notes?: string;
  blocked_reason?: string;
  requires_photo: boolean;
  requires_supervisor_approval: boolean;
  supervisor_approved_by?: string;
  supervisor_approved_at?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export class JobTaskRepository {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<JobTask | null> {
    const { data, error } = await this.supabase
      .from('job_tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async findByJobId(jobId: string, options?: {
    status?: JobTask['status'];
    orderBy?: 'sequence' | 'created_at';
  }): Promise<JobTask[]> {
    let query = this.supabase
      .from('job_tasks')
      .select('*')
      .eq('job_id', jobId);

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    const orderBy = options?.orderBy || 'sequence';
    query = query.order(orderBy, { ascending: true });

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async findByTemplateId(templateId: string): Promise<JobTask[]> {
    const { data, error } = await this.supabase
      .from('job_tasks')
      .select('*')
      .eq('task_template_id', templateId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async findByStatus(status: JobTask['status'], limit?: number): Promise<JobTask[]> {
    let query = this.supabase
      .from('job_tasks')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: true });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async findPendingSupervisorApproval(limit?: number): Promise<JobTask[]> {
    let query = this.supabase
      .from('job_tasks')
      .select('*')
      .eq('requires_supervisor_approval', true)
      .eq('status', 'completed')
      .is('supervisor_approved_at', null)
      .order('completed_at', { ascending: true });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async findUnverifiedCompletions(limit?: number): Promise<JobTask[]> {
    let query = this.supabase
      .from('job_tasks')
      .select('*')
      .eq('status', 'completed')
      .eq('completion_verified', false)
      .eq('requires_photo', true)
      .order('completed_at', { ascending: true });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async create(task: Omit<JobTask, 'id' | 'created_at' | 'updated_at'>): Promise<JobTask> {
    const { data, error } = await this.supabase
      .from('job_tasks')
      .insert(task)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createMany(tasks: Omit<JobTask, 'id' | 'created_at' | 'updated_at'>[]): Promise<JobTask[]> {
    const { data, error } = await this.supabase
      .from('job_tasks')
      .insert(tasks)
      .select();

    if (error) throw error;
    return data || [];
  }

  async update(id: string, updates: Partial<JobTask>): Promise<JobTask> {
    const { data, error } = await this.supabase
      .from('job_tasks')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateStatus(
    id: string,
    status: JobTask['status'],
    statusData?: {
      started_at?: string;
      completed_at?: string;
      actual_duration_mins?: number;
      completion_photo_id?: string;
      blocked_reason?: string;
    }
  ): Promise<JobTask> {
    const updates: Partial<JobTask> = { status };

    if (status === 'in_progress' && !statusData?.started_at) {
      updates.started_at = new Date().toISOString();
    } else if (statusData?.started_at) {
      updates.started_at = statusData.started_at;
    }

    if (status === 'completed') {
      updates.completed_at = statusData?.completed_at || new Date().toISOString();
      if (statusData?.actual_duration_mins !== undefined) {
        updates.actual_duration_mins = statusData.actual_duration_mins;
      }
      if (statusData?.completion_photo_id) {
        updates.completion_photo_id = statusData.completion_photo_id;
      }
    }

    if (status === 'blocked' && statusData?.blocked_reason) {
      updates.blocked_reason = statusData.blocked_reason;
    }

    return this.update(id, updates);
  }

  async updateVerification(
    id: string,
    verified: boolean,
    verificationData?: {
      confidence?: number;
      notes?: string;
    }
  ): Promise<JobTask> {
    const updates: Partial<JobTask> = {
      completion_verified: verified,
    };

    if (verificationData?.confidence !== undefined) {
      updates.verification_confidence = verificationData.confidence;
    }

    if (verificationData?.notes) {
      updates.verification_notes = verificationData.notes;
    }

    return this.update(id, updates);
  }

  async approveBySupervisor(id: string, supervisorId: string): Promise<JobTask> {
    return this.update(id, {
      supervisor_approved_by: supervisorId,
      supervisor_approved_at: new Date().toISOString(),
    });
  }

  async reorderTasks(jobId: string, taskIdOrder: string[]): Promise<void> {
    // Update each task with new sequence number
    for (let i = 0; i < taskIdOrder.length; i++) {
      await this.update(taskIdOrder[i], { sequence: i + 1 });
    }
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('job_tasks')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async deleteByJobId(jobId: string): Promise<void> {
    const { error } = await this.supabase
      .from('job_tasks')
      .delete()
      .eq('job_id', jobId);

    if (error) throw error;
  }

  async getCompletionStats(jobId: string): Promise<{
    total: number;
    completed: number;
    in_progress: number;
    pending: number;
    skipped: number;
    blocked: number;
    completion_percentage: number;
    verified_percentage: number;
  }> {
    const tasks = await this.findByJobId(jobId);

    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const in_progress = tasks.filter((t) => t.status === 'in_progress').length;
    const pending = tasks.filter((t) => t.status === 'pending').length;
    const skipped = tasks.filter((t) => t.status === 'skipped').length;
    const blocked = tasks.filter((t) => t.status === 'blocked').length;
    const verified = tasks.filter((t) => t.completion_verified).length;

    return {
      total,
      completed,
      in_progress,
      pending,
      skipped,
      blocked,
      completion_percentage: total > 0 ? (completed / total) * 100 : 0,
      verified_percentage: completed > 0 ? (verified / completed) * 100 : 0,
    };
  }
}