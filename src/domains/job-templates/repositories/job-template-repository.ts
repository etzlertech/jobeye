// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/job-templates/repositories/job-template-repository.ts
// phase: 4
// domain: job-execution
// purpose: Job template data access with versioning and sharing capabilities
// spec_ref: phase4/job-execution#template-repository
// version: 2025-08-1
// complexity_budget: 400 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   internal:
//     - /src/lib/repositories/base.repository
//     - /src/domains/job-templates/types/job-template-types
//   external:
//     - @supabase/supabase-js: ^2.43.0
//
// exports:
//   - JobTemplateRepository: class - Template data access
//   - createTemplate: function - Create new template
//   - updateTemplate: function - Update with versioning
//   - findTemplatesByCategory: function - Category filtering
//   - findPublicTemplates: function - Shared template access
//
// voice_considerations: |
//   Support voice template searches and creation.
//   Store voice instructions with templates.
//   Enable voice-guided template execution.
//
// test_requirements:
//   coverage: 90%
//   test_files:
//     - src/__tests__/domains/job-templates/repositories/job-template-repository.test.ts
//
// tasks:
//   1. Extend BaseRepository for templates
//   2. Implement template CRUD with versioning
//   3. Add category and difficulty filtering
//   4. Create template sharing logic
//   5. Implement template inheritance
//   6. Add usage tracking
// --- END DIRECTIVE BLOCK ---

import { SupabaseClient } from '@supabase/supabase-js';
import { BaseRepository } from '@/lib/repositories/base.repository';
import {
  JobTemplate,
  JobTemplateCreate,
  JobTemplateUpdate,
  TemplateCategory,
  TemplateDifficulty,
  jobTemplateCreateSchema,
  jobTemplateUpdateSchema,
} from '../types/job-template-types';
import { JobType } from '@/domains/job/types/job-types';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';

export class JobTemplateRepository extends BaseRepository<'job_templates'> {
  private supabaseClient: SupabaseClient;

  constructor(supabaseClient: SupabaseClient) {
    super('job_templates', supabaseClient);
    this.supabaseClient = supabaseClient;
  }

  /**
   * Create new job template
   */
  async createTemplate(
    data: JobTemplateCreate,
    tenantId: string
  ): Promise<JobTemplate> {
    try {
      // Validate input
      const validated = jobTemplateCreateSchema.parse(data);

      // Generate template number
      const templateNumber = await this.generateTemplateNumber(tenantId);

      // Calculate summaries from steps
      const { equipmentSummary, materialsSummary, estimatedTotalDuration } = 
        this.calculateTemplateSummaries(validated.steps);

      const template = {
        template_number: templateNumber,
        tenant_id: tenantId,
        title: validated.title,
        description: validated.description,
        category: validated.category,
        job_type: validated.jobType,
        difficulty: validated.difficulty,
        steps: validated.steps.map((step, index) => ({
          ...step,
          id: `step-${index + 1}`,
          stepNumber: index + 1,
        })),
        estimated_total_duration: estimatedTotalDuration,
        estimated_cost: validated.estimatedCost,
        default_pricing: validated.defaultPricing,
        required_skills: validated.requiredSkills,
        required_certifications: validated.requiredCertifications,
        minimum_team_size: validated.minimumTeamSize,
        maximum_team_size: validated.maximumTeamSize,
        equipment_summary: equipmentSummary,
        materials_summary: materialsSummary,
        safety_requirements: validated.safetyRequirements,
        compliance_notes: validated.complianceNotes,
        insurance_requirements: validated.insuranceRequirements,
        voice_metadata: validated.voiceMetadata,
        parent_template_id: validated.parentTemplateId,
        is_public: validated.isPublic,
        usage_count: 0,
        version: '1.0.0',
        version_history: [{
          version: '1.0.0',
          changelog: 'Initial version',
          createdAt: new Date(),
          createdBy: 'system', // Will be updated with actual user
          isActive: true,
        }],
        tags: validated.tags,
        custom_fields: validated.customFields,
        is_active: true,
      };

      const { data: created, error } = await this.supabaseClient
        .from('job_templates')
        .insert(template)
        .select('*')
        .single();

      if (error) throw error;

      return this.mapToJobTemplate(created);
    } catch (error) {
      throw createAppError({
        code: 'TEMPLATE_CREATE_FAILED',
        message: 'Failed to create job template',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Update job template with versioning
   */
  async updateTemplate(
    templateId: string,
    updates: JobTemplateUpdate,
    tenantId: string,
    createNewVersion: boolean = false
  ): Promise<JobTemplate | null> {
    try {
      const validated = jobTemplateUpdateSchema.parse(updates);

      if (createNewVersion) {
        return this.createNewVersion(templateId, validated, tenantId);
      }

      const updateData: any = {};

      if (validated.title) updateData.title = validated.title;
      if (validated.description) updateData.description = validated.description;
      if (validated.category) updateData.category = validated.category;
      if (validated.jobType) updateData.job_type = validated.jobType;
      if (validated.difficulty) updateData.difficulty = validated.difficulty;
      
      if (validated.steps) {
        updateData.steps = validated.steps.map((step, index) => ({
          ...step,
          id: step.id || `step-${index + 1}`,
          stepNumber: index + 1,
        }));

        // Recalculate summaries
        const { equipmentSummary, materialsSummary, estimatedTotalDuration } = 
          this.calculateTemplateSummaries(validated.steps);
        
        updateData.equipment_summary = equipmentSummary;
        updateData.materials_summary = materialsSummary;
        updateData.estimated_total_duration = estimatedTotalDuration;
      }

      if (validated.estimatedCost !== undefined) updateData.estimated_cost = validated.estimatedCost;
      if (validated.defaultPricing) updateData.default_pricing = validated.defaultPricing;
      if (validated.requiredSkills) updateData.required_skills = validated.requiredSkills;
      if (validated.requiredCertifications) updateData.required_certifications = validated.requiredCertifications;
      if (validated.minimumTeamSize) updateData.minimum_team_size = validated.minimumTeamSize;
      if (validated.maximumTeamSize !== undefined) updateData.maximum_team_size = validated.maximumTeamSize;
      if (validated.safetyRequirements) updateData.safety_requirements = validated.safetyRequirements;
      if (validated.complianceNotes) updateData.compliance_notes = validated.complianceNotes;
      if (validated.insuranceRequirements) updateData.insurance_requirements = validated.insuranceRequirements;
      if (validated.isPublic !== undefined) updateData.is_public = validated.isPublic;
      if (validated.tags) updateData.tags = validated.tags;
      if (validated.customFields) updateData.custom_fields = validated.customFields;
      if (validated.is_active !== undefined) updateData.is_active = validated.is_active;

      const { data: updated, error } = await this.supabaseClient
        .from('job_templates')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', templateId)
        .eq('tenant_id', tenantId)
        .select('*')
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return this.mapToJobTemplate(updated);
    } catch (error) {
      throw createAppError({
        code: 'TEMPLATE_UPDATE_FAILED',
        message: 'Failed to update job template',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find template by ID
   */
  async findById(templateId: string, tenantId: string): Promise<JobTemplate | null> {
    try {
      const { data, error } = await this.supabaseClient
        .from('job_templates')
        .select('*')
        .eq('id', templateId)
        .or(`tenant_id.eq.${tenantId},is_public.eq.true`)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return this.mapToJobTemplate(data);
    } catch (error) {
      throw createAppError({
        code: 'TEMPLATE_FETCH_FAILED',
        message: 'Failed to fetch job template',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find templates by category
   */
  async findTemplatesByCategory(
    category: TemplateCategory,
    tenantId: string,
    includePublic: boolean = true
  ): Promise<JobTemplate[]> {
    try {
      let query = this.supabaseClient
        .from('job_templates')
        .select('*')
        .eq('category', category)
        .eq('is_active', true);

      if (includePublic) {
        query = query.or(`tenant_id.eq.${tenantId},is_public.eq.true`);
      } else {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query.order('title');

      if (error) throw error;

      return (data || []).map(row => this.mapToJobTemplate(row));
    } catch (error) {
      throw createAppError({
        code: 'TEMPLATE_CATEGORY_SEARCH_FAILED',
        message: 'Failed to find templates by category',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find templates by job type
   */
  async findTemplatesByJobType(
    jobType: JobType,
    tenantId: string,
    includePublic: boolean = true
  ): Promise<JobTemplate[]> {
    try {
      let query = this.supabaseClient
        .from('job_templates')
        .select('*')
        .eq('job_type', jobType)
        .eq('is_active', true);

      if (includePublic) {
        query = query.or(`tenant_id.eq.${tenantId},is_public.eq.true`);
      } else {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query.order('title');

      if (error) throw error;

      return (data || []).map(row => this.mapToJobTemplate(row));
    } catch (error) {
      throw createAppError({
        code: 'TEMPLATE_JOBTYPE_SEARCH_FAILED',
        message: 'Failed to find templates by job type',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Find all templates with filters
   */
  async findAll(options: {
    tenantId: string;
    filters?: {
      category?: TemplateCategory;
      jobType?: JobType;
      difficulty?: TemplateDifficulty;
      isPublic?: boolean;
      is_active?: boolean;
    };
    includePublic?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ data: JobTemplate[]; count: number }> {
    try {
      let query = this.supabaseClient
        .from('job_templates')
        .select('*', { count: 'exact' });

      // Tenant filtering
      if (options.includePublic !== false) {
        query = query.or(`tenant_id.eq.${options.tenantId},is_public.eq.true`);
      } else {
        query = query.eq('tenant_id', options.tenantId);
      }

      // Apply filters
      if (options.filters) {
        if (options.filters.category) {
          query = query.eq('category', options.filters.category);
        }
        if (options.filters.jobType) {
          query = query.eq('job_type', options.filters.jobType);
        }
        if (options.filters.difficulty) {
          query = query.eq('difficulty', options.filters.difficulty);
        }
        if (options.filters.isPublic !== undefined) {
          query = query.eq('is_public', options.filters.isPublic);
        }
        if (options.filters.is_active !== undefined) {
          query = query.eq('is_active', options.filters.is_active);
        }
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }
      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      const { data, error, count } = await query.order('title');

      if (error) throw error;

      return {
        data: (data || []).map(row => this.mapToJobTemplate(row)),
        count: count || 0,
      };
    } catch (error) {
      throw createAppError({
        code: 'TEMPLATE_FETCH_FAILED',
        message: 'Failed to fetch templates list',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Search templates by title or description
   */
  async searchTemplates(
    searchTerm: string,
    tenantId: string,
    includePublic: boolean = true,
    limit: number = 20
  ): Promise<JobTemplate[]> {
    try {
      let query = this.supabaseClient
        .from('job_templates')
        .select('*')
        .eq('is_active', true)
        .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);

      if (includePublic) {
        query = query.or(`tenant_id.eq.${tenantId},is_public.eq.true`);
      } else {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query
        .limit(limit)
        .order('usage_count', { ascending: false });

      if (error) throw error;

      return (data || []).map(row => this.mapToJobTemplate(row));
    } catch (error) {
      throw createAppError({
        code: 'TEMPLATE_SEARCH_FAILED',
        message: 'Failed to search templates',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Increment template usage count
   */
  async incrementUsageCount(templateId: string): Promise<void> {
    try {
      const { error } = await this.supabaseClient.rpc('increment_template_usage', {
        template_id: templateId,
      });

      if (error) throw error;
    } catch (error) {
      // Don't throw error for usage tracking failures
      console.warn('Failed to increment template usage count:', error);
    }
  }

  /**
   * Delete template (soft delete)
   */
  async delete(templateId: string, tenantId: string): Promise<boolean> {
    try {
      const { error } = await this.supabaseClient
        .from('job_templates')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', templateId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      return true;
    } catch (error) {
      throw createAppError({
        code: 'TEMPLATE_DELETE_FAILED',
        message: 'Failed to delete job template',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Generate unique template number
   */
  private async generateTemplateNumber(tenantId: string): Promise<string> {
    const prefix = 'TPL';
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Calculate template summaries from steps
   */
  private calculateTemplateSummaries(steps: any[]) {
    const equipmentMap = new Map<string, { quantity: number; isOptional: boolean }>();
    const materialsMap = new Map<string, { quantity: number; unit: string; isOptional: boolean }>();
    let estimatedTotalDuration = 0;

    steps.forEach(step => {
      estimatedTotalDuration += step.estimatedDuration || 0;

      // Aggregate equipment requirements
      (step.requiredEquipment || []).forEach((eq: any) => {
        const existing = equipmentMap.get(eq.equipmentType);
        if (existing) {
          existing.quantity += eq.quantity;
          existing.isOptional = existing.isOptional && eq.isOptional;
        } else {
          equipmentMap.set(eq.equipmentType, {
            quantity: eq.quantity,
            isOptional: eq.isOptional,
          });
        }
      });

      // Aggregate material requirements
      (step.requiredMaterials || []).forEach((mat: any) => {
        const existing = materialsMap.get(mat.materialType);
        if (existing) {
          existing.quantity += mat.quantity;
          existing.isOptional = existing.isOptional && mat.isOptional;
        } else {
          materialsMap.set(mat.materialType, {
            quantity: mat.quantity,
            unit: mat.unit,
            isOptional: mat.isOptional,
          });
        }
      });
    });

    const equipmentSummary = Array.from(equipmentMap.entries()).map(([type, data]) => ({
      equipmentType: type,
      quantity: data.quantity,
      isOptional: data.isOptional,
    }));

    const materialsSummary = Array.from(materialsMap.entries()).map(([type, data]) => ({
      materialType: type,
      estimatedQuantity: data.quantity,
      unit: data.unit,
      isOptional: data.isOptional,
    }));

    return { equipmentSummary, materialsSummary, estimatedTotalDuration };
  }

  /**
   * Create new version of template
   */
  private async createNewVersion(
    templateId: string,
    updates: JobTemplateUpdate,
    tenantId: string
  ): Promise<JobTemplate | null> {
    // Implementation would create a new version of the template
    // This is a placeholder for the versioning logic
    throw new Error('Template versioning not yet implemented');
  }

  /**
   * Map database row to JobTemplate type
   */
  private mapToJobTemplate(row: any): JobTemplate {
    if (!row) throw new Error('Cannot map null row to JobTemplate');

    return {
      id: row.id,
      tenant_id: row.tenant_id,
      template_number: row.template_number,
      title: row.title,
      description: row.description,
      category: row.category as TemplateCategory,
      jobType: row.job_type as JobType,
      difficulty: row.difficulty as TemplateDifficulty,
      steps: row.steps || [],
      estimatedTotalDuration: row.estimated_total_duration || 0,
      estimatedCost: row.estimated_cost || 0,
      defaultPricing: row.default_pricing,
      requiredSkills: row.required_skills || [],
      requiredCertifications: row.required_certifications || [],
      minimumTeamSize: row.minimum_team_size || 1,
      maximumTeamSize: row.maximum_team_size,
      equipmentSummary: row.equipment_summary || [],
      materialsSummary: row.materials_summary || [],
      safetyRequirements: row.safety_requirements || [],
      complianceNotes: row.compliance_notes || [],
      insuranceRequirements: row.insurance_requirements || [],
      voiceMetadata: row.voice_metadata,
      parentTemplateId: row.parent_template_id,
      isPublic: row.is_public || false,
      usageCount: row.usage_count || 0,
      averageRating: row.average_rating,
      version: row.version || '1.0.0',
      versionHistory: (row.version_history || []).map((vh: any) => ({
        ...vh,
        createdAt: new Date(vh.createdAt),
      })),
      tags: row.tags || [],
      customFields: row.custom_fields || {},
      is_active: row.is_active,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdBy: row.created_by,
      updatedBy: row.updated_by,
    };
  }
}

// Convenience export
export const createJobTemplateRepository = (supabase: SupabaseClient): JobTemplateRepository => {
  return new JobTemplateRepository(supabase);
};