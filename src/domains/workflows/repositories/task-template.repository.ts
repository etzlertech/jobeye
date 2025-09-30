/**
 * T061: TaskTemplateRepository
 * Repository for managing reusable task templates for common job types
 */
import { SupabaseClient } from '@supabase/supabase-js';

export interface TaskTemplate {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  category: string;
  job_types: string[]; // Array of job type IDs this template applies to
  default_sequence: number;
  estimated_duration_mins?: number;
  requires_photo: boolean;
  requires_supervisor_approval: boolean;
  instructions?: string;
  instruction_document_ids?: string[];
  metadata?: Record<string, any>;
  active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export class TaskTemplateRepository {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<TaskTemplate | null> {
    const { data, error } = await this.supabase
      .from('task_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async findAll(options?: {
    active?: boolean;
    category?: string;
    limit?: number;
    orderBy?: 'name' | 'usage_count' | 'created_at';
  }): Promise<TaskTemplate[]> {
    let query = this.supabase.from('task_templates').select('*');

    if (options?.active !== undefined) {
      query = query.eq('active', options.active);
    }

    if (options?.category) {
      query = query.eq('category', options.category);
    }

    const orderBy = options?.orderBy || 'name';
    const ascending = orderBy === 'name';
    query = query.order(orderBy, { ascending });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async findByJobType(jobType: string, options?: {
    active?: boolean;
    category?: string;
  }): Promise<TaskTemplate[]> {
    let query = this.supabase
      .from('task_templates')
      .select('*')
      .contains('job_types', [jobType])
      .order('default_sequence', { ascending: true });

    if (options?.active !== undefined) {
      query = query.eq('active', options.active);
    }

    if (options?.category) {
      query = query.eq('category', options.category);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async findByCategory(category: string, activeOnly: boolean = true): Promise<TaskTemplate[]> {
    let query = this.supabase
      .from('task_templates')
      .select('*')
      .eq('category', category)
      .order('default_sequence', { ascending: true });

    if (activeOnly) {
      query = query.eq('active', true);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async findMostUsed(limit: number = 10): Promise<TaskTemplate[]> {
    const { data, error } = await this.supabase
      .from('task_templates')
      .select('*')
      .eq('active', true)
      .order('usage_count', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  }

  async findByInstructionDocumentId(documentId: string): Promise<TaskTemplate[]> {
    const { data, error } = await this.supabase
      .from('task_templates')
      .select('*')
      .contains('instruction_document_ids', [documentId])
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async create(template: Omit<TaskTemplate, 'id' | 'created_at' | 'updated_at' | 'usage_count'>): Promise<TaskTemplate> {
    const { data, error } = await this.supabase
      .from('task_templates')
      .insert({ ...template, usage_count: 0 })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, updates: Partial<TaskTemplate>): Promise<TaskTemplate> {
    const { data, error } = await this.supabase
      .from('task_templates')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async incrementUsageCount(id: string): Promise<TaskTemplate> {
    const template = await this.findById(id);
    if (!template) throw new Error('Template not found');

    return this.update(id, { usage_count: template.usage_count + 1 });
  }

  async addJobType(id: string, jobType: string): Promise<TaskTemplate> {
    const template = await this.findById(id);
    if (!template) throw new Error('Template not found');

    if (template.job_types.includes(jobType)) {
      return template; // Already exists
    }

    const updatedJobTypes = [...template.job_types, jobType];
    return this.update(id, { job_types: updatedJobTypes });
  }

  async removeJobType(id: string, jobType: string): Promise<TaskTemplate> {
    const template = await this.findById(id);
    if (!template) throw new Error('Template not found');

    const updatedJobTypes = template.job_types.filter((jt) => jt !== jobType);
    return this.update(id, { job_types: updatedJobTypes });
  }

  async addInstructionDocument(id: string, documentId: string): Promise<TaskTemplate> {
    const template = await this.findById(id);
    if (!template) throw new Error('Template not found');

    const currentDocs = template.instruction_document_ids || [];
    if (currentDocs.includes(documentId)) {
      return template; // Already exists
    }

    const updatedDocs = [...currentDocs, documentId];
    return this.update(id, { instruction_document_ids: updatedDocs });
  }

  async removeInstructionDocument(id: string, documentId: string): Promise<TaskTemplate> {
    const template = await this.findById(id);
    if (!template) throw new Error('Template not found');

    const updatedDocs = (template.instruction_document_ids || []).filter((docId) => docId !== documentId);
    return this.update(id, { instruction_document_ids: updatedDocs });
  }

  async setActive(id: string, active: boolean): Promise<TaskTemplate> {
    return this.update(id, { active });
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('task_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getCategories(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('task_templates')
      .select('category')
      .eq('active', true);

    if (error) throw error;

    // Get unique categories
    const categories = new Set<string>();
    (data || []).forEach((template) => {
      if (template.category) categories.add(template.category);
    });

    return Array.from(categories).sort();
  }

  async getStatsByCategory(): Promise<Array<{
    category: string;
    count: number;
    avg_duration: number;
    total_usage: number;
  }>> {
    const { data, error } = await this.supabase
      .from('task_templates')
      .select('category, estimated_duration_mins, usage_count')
      .eq('active', true);

    if (error) throw error;

    // Aggregate by category
    const stats = new Map<string, { count: number; total_duration: number; total_usage: number }>();

    (data || []).forEach((template) => {
      const category = template.category || 'uncategorized';
      const existing = stats.get(category) || { count: 0, total_duration: 0, total_usage: 0 };
      existing.count++;
      existing.total_duration += template.estimated_duration_mins || 0;
      existing.total_usage += template.usage_count || 0;
      stats.set(category, existing);
    });

    return Array.from(stats.entries()).map(([category, agg]) => ({
      category,
      count: agg.count,
      avg_duration: agg.count > 0 ? agg.total_duration / agg.count : 0,
      total_usage: agg.total_usage,
    }));
  }
}