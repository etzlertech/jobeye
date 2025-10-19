// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/task-template/repositories/TaskTemplateRepository.ts
// phase: 3.4
// domain: task-template
// purpose: Task template data access with tenant isolation and template management
// spec_ref: specs/013-lets-plan-to/spec.md
// version: 2025-10-20
// complexity_budget: 300 LoC
// offline_capability: NOT_REQUIRED
//
// dependencies:
//   internal:
//     - /src/domains/task-template/types/task-template-types
//   external:
//     - @supabase/supabase-js: ^2.43.0
//
// exports:
//   - TaskTemplateRepository: class - Task template data access
//   - findAll: function - Get all templates
//   - findByIdWithItems: function - Get template with items
//   - create: function - Create template with items
//   - update: function - Update template
//   - delete: function - Delete template
//
// test_requirements:
//   coverage: 80%
//   test_files:
//     - tests/unit/task-template/TaskTemplateRepository.test.ts
//
// tasks:
//   1. Implement CRUD with tenant isolation
//   2. Add findAll with is_active filter
//   3. Add findByIdWithItems for template details
//   4. Add create method for template + items
//   5. Add update and delete methods
// --- END DIRECTIVE BLOCK ---

import { SupabaseClient } from '@supabase/supabase-js';
import {
  TaskTemplate,
  TaskTemplateItem,
  TemplateWithItems,
  CreateTemplateInput,
  CreateTemplateItemInput,
  UpdateTemplateInput,
  CreateTemplateSchema,
  CreateTemplateItemSchema,
  UpdateTemplateSchema,
  TemplateImageUrls,
  RepositoryError,
  Result,
  Ok,
  Err,
} from '../types/task-template-types';

export class TaskTemplateRepository {
  constructor(private client: SupabaseClient) {}

  /**
   * Find all templates with optional is_active filter
   */
  async findAll(includeInactive = false): Promise<Result<TaskTemplate[], RepositoryError>> {
    try {
      let query = this.client
        .from('task_templates')
        .select('*');

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query.order('name', { ascending: true });

      if (error) {
        return Err({
          code: 'QUERY_FAILED',
          message: `Failed to fetch templates: ${error.message}`,
          details: error,
        });
      }

      return Ok(data as TaskTemplate[]);
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Find template by ID with items
   */
  async findByIdWithItems(id: string): Promise<Result<TemplateWithItems | null, RepositoryError>> {
    try {
      // Get template
      const { data: template, error: templateError } = await this.client
        .from('task_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (templateError) {
        if (templateError.code === 'PGRST116') {
          return Ok(null); // Not found
        }
        return Err({
          code: 'QUERY_FAILED',
          message: `Failed to fetch template: ${templateError.message}`,
          details: templateError,
        });
      }

      // Get template items
      const { data: items, error: itemsError } = await this.client
        .from('task_template_items')
        .select('*')
        .eq('template_id', id)
        .order('task_order', { ascending: true });

      if (itemsError) {
        return Err({
          code: 'QUERY_FAILED',
          message: `Failed to fetch template items: ${itemsError.message}`,
          details: itemsError,
        });
      }

      return Ok({
        ...template,
        items: items || [],
      } as TemplateWithItems);
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Create template with items
   */
  async create(
    templateInput: CreateTemplateInput,
    itemsInput: CreateTemplateItemInput[]
  ): Promise<Result<TemplateWithItems, RepositoryError>> {
    try {
      // Validate inputs
      const validatedTemplate = CreateTemplateSchema.parse(templateInput);
      const validatedItems = itemsInput.map(item => CreateTemplateItemSchema.parse(item));

      // Create template
      const { data: newTemplate, error: templateError } = await this.client
        .from('task_templates')
        .insert({
          name: validatedTemplate.name,
          description: validatedTemplate.description || null,
          job_type: validatedTemplate.job_type || null,
          tenant_id: (templateInput as any).tenant_id, // tenant_id passed from API
          is_active: true,
        })
        .select()
        .single();

      if (templateError) {
        // Check for unique constraint violation
        if (templateError.code === '23505') {
          return Err({
            code: 'TEMPLATE_NAME_EXISTS',
            message: 'A template with this name already exists for your tenant',
            details: templateError,
          });
        }
        return Err({
          code: 'INSERT_FAILED',
          message: `Failed to create template: ${templateError.message}`,
          details: templateError,
        });
      }

      // Create template items
      const itemsWithTemplateId = validatedItems.map(item => ({
        ...item,
        template_id: newTemplate.id,
        acceptance_criteria: item.acceptance_criteria || null,
      }));

      const { data: newItems, error: itemsError } = await this.client
        .from('task_template_items')
        .insert(itemsWithTemplateId)
        .select();

      if (itemsError) {
        // Rollback: delete the template we just created
        await this.client
          .from('task_templates')
          .delete()
          .eq('id', newTemplate.id);

        return Err({
          code: 'INSERT_FAILED',
          message: `Failed to create template items: ${itemsError.message}`,
          details: itemsError,
        });
      }

      return Ok({
        ...newTemplate,
        items: newItems || [],
      } as TemplateWithItems);
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return Err({
          code: 'VALIDATION_ERROR',
          message: 'Invalid template data',
          details: err.errors,
        });
      }
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Update image URLs for a template
   */
  async updateImageUrls(
    templateId: string,
    imageUrls: TemplateImageUrls
  ): Promise<Result<TaskTemplate, RepositoryError>> {
    try {
      const { data, error } = await this.client
        .from('task_templates')
        .update({
          thumbnail_url: imageUrls.thumbnail_url,
          medium_url: imageUrls.medium_url,
          primary_image_url: imageUrls.primary_image_url,
        })
        .eq('id', templateId)
        .select('*')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return Err({
            code: 'NOT_FOUND',
            message: 'Template not found',
            details: error,
          });
        }

        return Err({
          code: 'UPDATE_FAILED',
          message: `Failed to update template images: ${error.message}`,
          details: error,
        });
      }

      return Ok(data as TaskTemplate);
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Update template metadata (not items)
   */
  async update(id: string, input: UpdateTemplateInput): Promise<Result<TaskTemplate, RepositoryError>> {
    try {
      // Validate input
      const validated = UpdateTemplateSchema.parse(input);

      const { data, error } = await this.client
        .from('task_templates')
        .update({
          ...validated,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return Err({
            code: 'NOT_FOUND',
            message: 'Template not found',
          });
        }
        if (error.code === '23505') {
          return Err({
            code: 'TEMPLATE_NAME_EXISTS',
            message: 'A template with this name already exists',
            details: error,
          });
        }
        return Err({
          code: 'UPDATE_FAILED',
          message: `Failed to update template: ${error.message}`,
          details: error,
        });
      }

      return Ok(data as TaskTemplate);
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return Err({
          code: 'VALIDATION_ERROR',
          message: 'Invalid template data',
          details: err.errors,
        });
      }
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Delete template (cascade deletes items via FK)
   */
  async delete(id: string): Promise<Result<void, RepositoryError>> {
    try {
      const { error } = await this.client
        .from('task_templates')
        .delete()
        .eq('id', id);

      if (error) {
        return Err({
          code: 'DELETE_FAILED',
          message: `Failed to delete template: ${error.message}`,
          details: error,
        });
      }

      return Ok(undefined);
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Check if template is in use by any jobs
   */
  async isTemplateInUse(id: string): Promise<Result<boolean, RepositoryError>> {
    try {
      const { data, error } = await this.client
        .from('workflow_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('template_id', id)
        .limit(1);

      if (error) {
        return Err({
          code: 'QUERY_FAILED',
          message: `Failed to check template usage: ${error.message}`,
          details: error,
        });
      }

      return Ok((data as any) > 0);
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }
}

// Convenience export
export const createTaskTemplateRepository = (client: SupabaseClient): TaskTemplateRepository => {
  return new TaskTemplateRepository(client);
};
