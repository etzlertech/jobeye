// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/task-template/repositories/TaskTemplateItemAssociationRepository.ts
// phase: 3.3
// domain: task-template
// purpose: Template item association data access with tenant isolation
// spec_ref: specs/015-task-item-association/spec.md
// version: 2025-10-19
// complexity_budget: 300 LoC
// offline_capability: NOT_REQUIRED
//
// dependencies:
//   internal:
//     - /src/domains/task-template/types/task-template-association-types
//   external:
//     - @supabase/supabase-js: ^2.43.0
//
// exports:
//   - TaskTemplateItemAssociationRepository: class - Association data access
//   - findByTemplateItemId: function - Get all associations for a template item
//   - findById: function - Get association by ID
//   - create: function - Create association
//   - update: function - Update association
//   - delete: function - Delete association
//
// test_requirements:
//   coverage: 80%
//   test_files:
//     - tests/unit/task-template/TaskTemplateItemAssociationRepository.test.ts
//
// tasks:
//   1. Implement CRUD with tenant isolation via RLS
//   2. Add findByTemplateItemId for loading associations
//   3. Add XOR validation enforcement
//   4. Add duplicate prevention
//   5. Handle foreign key constraint errors
// --- END DIRECTIVE BLOCK ---

import { SupabaseClient } from '@supabase/supabase-js';
import {
  TaskTemplateItemAssociation,
  TaskTemplateItemAssociationWithDetails,
  CreateTaskTemplateItemAssociationInput,
  UpdateTaskTemplateItemAssociationInput,
  CreateTaskTemplateItemAssociationSchema,
  UpdateTaskTemplateItemAssociationSchema,
  TaskTemplateAssociationRepositoryError,
  Result,
  Ok,
  Err,
} from '../types/task-template-association-types';

export class TaskTemplateItemAssociationRepository {
  constructor(private client: SupabaseClient) {}

  /**
   * Find all associations for a template item
   */
  async findByTemplateItemId(
    templateItemId: string
  ): Promise<Result<TaskTemplateItemAssociation[], TaskTemplateAssociationRepositoryError>> {
    try {
      const { data, error } = await this.client
        .from('task_template_item_associations')
        .select('*')
        .eq('template_item_id', templateItemId)
        .order('created_at', { ascending: true });

      if (error) {
        return Err({
          code: 'QUERY_FAILED',
          message: `Failed to fetch template item associations: ${error.message}`,
          details: error,
        });
      }

      return Ok((data || []) as TaskTemplateItemAssociation[]);
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Find all associations for a template item with joined item/kit details
   */
  async findByTemplateItemIdWithDetails(
    templateItemId: string
  ): Promise<Result<TaskTemplateItemAssociationWithDetails[], TaskTemplateAssociationRepositoryError>> {
    try {
      const { data, error } = await this.client
        .from('task_template_item_associations')
        .select(`
          *,
          items:item_id (
            name,
            description
          ),
          kits:kit_id (
            name,
            description
          )
        `)
        .eq('template_item_id', templateItemId)
        .order('created_at', { ascending: true });

      if (error) {
        return Err({
          code: 'QUERY_FAILED',
          message: `Failed to fetch template item associations with details: ${error.message}`,
          details: error,
        });
      }

      // Transform the joined data structure
      const transformed = (data || []).map((row: any) => ({
        ...row,
        item_name: row.items?.name || null,
        item_description: row.items?.description || null,
        kit_name: row.kits?.name || null,
        kit_description: row.kits?.description || null,
        items: undefined,
        kits: undefined,
      }));

      return Ok(transformed as TaskTemplateItemAssociationWithDetails[]);
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Find association by ID
   */
  async findById(
    id: string
  ): Promise<Result<TaskTemplateItemAssociation | null, TaskTemplateAssociationRepositoryError>> {
    try {
      const { data, error } = await this.client
        .from('task_template_item_associations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return Ok(null); // Not found
        }
        return Err({
          code: 'QUERY_FAILED',
          message: `Failed to fetch association: ${error.message}`,
          details: error,
        });
      }

      return Ok(data as TaskTemplateItemAssociation);
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Create template item association
   */
  async create(
    templateItemId: string,
    tenantId: string,
    input: CreateTaskTemplateItemAssociationInput
  ): Promise<Result<TaskTemplateItemAssociation, TaskTemplateAssociationRepositoryError>> {
    try {
      // Validate input
      const validated = CreateTaskTemplateItemAssociationSchema.parse(input);

      const { data, error } = await this.client
        .from('task_template_item_associations')
        .insert({
          tenant_id: tenantId,
          template_item_id: templateItemId,
          item_id: validated.item_id || null,
          kit_id: validated.kit_id || null,
          quantity: validated.quantity,
          is_required: validated.is_required,
          notes: validated.notes || null,
        })
        .select()
        .single();

      if (error) {
        // Handle unique constraint violation (duplicate item/kit for same template item)
        if (error.code === '23505') {
          const isItem = validated.item_id;
          return Err({
            code: 'DUPLICATE_ASSOCIATION',
            message: `This ${isItem ? 'item' : 'kit'} is already associated with this template item`,
            details: error,
          });
        }

        // Handle foreign key constraint violation
        if (error.code === '23503') {
          return Err({
            code: 'INVALID_REFERENCE',
            message: 'Invalid template item, item, or kit reference',
            details: error,
          });
        }

        // Handle check constraint violation (XOR)
        if (error.code === '23514') {
          return Err({
            code: 'VALIDATION_ERROR',
            message: 'Must specify exactly one of item_id or kit_id',
            details: error,
          });
        }

        return Err({
          code: 'INSERT_FAILED',
          message: `Failed to create association: ${error.message}`,
          details: error,
        });
      }

      return Ok(data as TaskTemplateItemAssociation);
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return Err({
          code: 'VALIDATION_ERROR',
          message: 'Invalid association data',
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
   * Update template item association
   */
  async update(
    id: string,
    input: UpdateTaskTemplateItemAssociationInput
  ): Promise<Result<TaskTemplateItemAssociation, TaskTemplateAssociationRepositoryError>> {
    try {
      // Validate input
      const validated = UpdateTaskTemplateItemAssociationSchema.parse(input);

      const { data, error } = await this.client
        .from('task_template_item_associations')
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
            message: 'Association not found',
            details: error,
          });
        }

        return Err({
          code: 'UPDATE_FAILED',
          message: `Failed to update association: ${error.message}`,
          details: error,
        });
      }

      return Ok(data as TaskTemplateItemAssociation);
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return Err({
          code: 'VALIDATION_ERROR',
          message: 'Invalid association data',
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
   * Delete template item association
   */
  async delete(id: string): Promise<Result<void, TaskTemplateAssociationRepositoryError>> {
    try {
      const { error } = await this.client
        .from('task_template_item_associations')
        .delete()
        .eq('id', id);

      if (error) {
        return Err({
          code: 'DELETE_FAILED',
          message: `Failed to delete association: ${error.message}`,
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
   * Delete all associations for a template item (used when template item is deleted)
   */
  async deleteByTemplateItemId(
    templateItemId: string
  ): Promise<Result<void, TaskTemplateAssociationRepositoryError>> {
    try {
      const { error } = await this.client
        .from('task_template_item_associations')
        .delete()
        .eq('template_item_id', templateItemId);

      if (error) {
        return Err({
          code: 'DELETE_FAILED',
          message: `Failed to delete associations for template item: ${error.message}`,
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
}

// Convenience export
export const createTaskTemplateItemAssociationRepository = (
  client: SupabaseClient
): TaskTemplateItemAssociationRepository => {
  return new TaskTemplateItemAssociationRepository(client);
};
