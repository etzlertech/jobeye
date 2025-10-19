// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/task-template/services/TaskTemplateService.ts
// phase: 3.5
// domain: task-template
// purpose: Business logic for task template operations and instantiation
// spec_ref: specs/013-lets-plan-to/spec.md
// version: 2025-10-20
// complexity_budget: 300 LoC
// offline_capability: NOT_REQUIRED
//
// dependencies:
//   internal:
//     - /src/domains/task-template/repositories/TaskTemplateRepository
//     - /src/domains/workflow-task/repositories/WorkflowTaskRepository
//     - /src/domains/task-template/types/task-template-types
//
// exports:
//   - TaskTemplateService: class - Template business logic
//   - instantiateTemplate: function - Create tasks from template
//   - validateTemplateUsage: function - Check if template can be deleted
//
// test_requirements:
//   coverage: 80%
//   test_files:
//     - tests/unit/task-template/TaskTemplateService.test.ts
//
// tasks:
//   1. Implement template instantiation
//   2. Add template usage validation
//   3. Add error handling
// --- END DIRECTIVE BLOCK ---

import type { SupabaseClient } from '@supabase/supabase-js';
import { TaskTemplateRepository } from '../repositories/TaskTemplateRepository';
import { TaskTemplateItemAssociationRepository } from '../repositories/TaskTemplateItemAssociationRepository';
import { WorkflowTaskRepository } from '@/domains/workflow-task/repositories/WorkflowTaskRepository';
import { WorkflowTaskItemAssociationRepository } from '@/domains/workflow-task/repositories/WorkflowTaskItemAssociationRepository';
import {
  TemplateWithItems,
  TaskTemplate,
  ServiceError,
  Result,
  Ok,
  Err,
  TemplateImageUrls,
  isErr,
} from '../types/task-template-types';
import {
  TaskTemplateItemAssociation,
  TaskTemplateItemAssociationWithDetails,
  CreateTaskTemplateItemAssociationInput,
  UpdateTaskTemplateItemAssociationInput,
} from '../types/task-template-association-types';
import { TaskItemStatus } from '@/domains/workflow-task/types/workflow-task-association-types';
import type { WorkflowTask } from '@/domains/workflow-task/types/workflow-task-types';
import type { ProcessedImages } from '@/utils/image-processor';
import {
  uploadImagesToStorage,
  deleteImagesFromStorage,
} from '@/lib/supabase/storage';

const TEMPLATE_IMAGE_BUCKET = 'task-template-images';

const getStoragePath = (url: string | null | undefined, bucket: string): string | null => {
  if (!url) return null;
  const marker = `${bucket}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return url.substring(index + marker.length);
};

export class TaskTemplateService {
  constructor(
    private templateRepo: TaskTemplateRepository,
    private taskRepo: WorkflowTaskRepository,
    private associationRepo: TaskTemplateItemAssociationRepository,
    private workflowAssocRepo: WorkflowTaskItemAssociationRepository
  ) {}

  /**
   * Instantiate template into a job (create workflow_tasks from template items)
   */
  async instantiateTemplate(
    templateId: string,
    jobId: string
  ): Promise<Result<WorkflowTask[], ServiceError>> {
    try {
      // Load template with items
      const templateResult = await this.templateRepo.findByIdWithItems(templateId);

      if (isErr(templateResult)) {
        const { error: repositoryError } = templateResult;
        return Err({
          code: 'TEMPLATE_FETCH_FAILED',
          message: 'Failed to fetch template',
          details: repositoryError,
        });
      }

      const template = templateResult.value;

      if (!template) {
        return Err({
          code: 'TEMPLATE_NOT_FOUND',
          message: 'Template not found',
        });
      }

      if (!template.is_active) {
        return Err({
          code: 'TEMPLATE_INACTIVE',
          message: 'Cannot instantiate inactive template',
        });
      }

      if (template.items.length === 0) {
        return Err({
          code: 'TEMPLATE_EMPTY',
          message: 'Template has no items to instantiate',
        });
      }

      // Check if job already has tasks (optional warning)
      const existingTasksResult = await this.taskRepo.findByJobId(jobId);
      if (!isErr(existingTasksResult) && existingTasksResult.value.length > 0) {
        // This is just a warning - we'll still proceed
        console.warn(`Job ${jobId} already has ${existingTasksResult.value.length} tasks. Adding template tasks.`);
      }

      // Create tasks from template (with image inheritance)
      const templateImageUrls = {
        thumbnail_url: template.thumbnail_url,
        medium_url: template.medium_url,
        primary_image_url: template.primary_image_url,
      };

      const createResult = await this.taskRepo.createFromTemplate(
        jobId,
        template.items,
        templateImageUrls
      );

      if (isErr(createResult)) {
        const { error: repositoryError } = createResult;
        return Err({
          code: 'TASK_CREATION_FAILED',
          message: 'Failed to create tasks from template',
          details: repositoryError,
        });
      }

      const createdTasks = createResult.value;

      // T018: Copy item associations from template items to workflow tasks
      // Map template items to created workflow tasks by task_order
      const templateItemToTaskMap = new Map<string, string>();
      for (let i = 0; i < template.items.length; i++) {
        const templateItem = template.items[i];
        const workflowTask = createdTasks[i];
        if (workflowTask) {
          templateItemToTaskMap.set(templateItem.id, workflowTask.id);
        }
      }

      // For each template item, copy its associations to the corresponding workflow task
      for (const [templateItemId, workflowTaskId] of templateItemToTaskMap.entries()) {
        const associationsResult = await this.associationRepo.findByTemplateItemId(templateItemId);

        if (!isErr(associationsResult) && associationsResult.value.length > 0) {
          // Copy each association to the workflow task
          for (const assoc of associationsResult.value) {
            await this.workflowAssocRepo.create(workflowTaskId, template.tenant_id, {
              item_id: assoc.item_id || undefined,
              kit_id: assoc.kit_id || undefined,
              quantity: assoc.quantity,
              is_required: assoc.is_required,
              status: TaskItemStatus.PENDING,
              notes: assoc.notes || undefined,
              source_template_association_id: assoc.id,
            });
            // Note: Errors in association copying are logged but don't fail the whole operation
          }
        }
      }

      return Ok(createdTasks);
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Validate if template can be deleted (not in use)
   */
  async validateTemplateUsage(templateId: string): Promise<Result<{canDelete: boolean, usageCount?: number}, ServiceError>> {
    try {
      const usageResult = await this.templateRepo.isTemplateInUse(templateId);

      if (isErr(usageResult)) {
        const { error: repositoryError } = usageResult;
        return Err({
          code: 'VALIDATION_FAILED',
          message: 'Failed to check template usage',
          details: repositoryError,
        });
      }

      const inUse = usageResult.value;

      return Ok({
        canDelete: !inUse,
        usageCount: inUse ? undefined : 0, // Could enhance to count actual usage
      });
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Get all templates
   */
  async getAllTemplates(includeInactive = false): Promise<Result<TemplateWithItems[], ServiceError>> {
    try {
      const result = await this.templateRepo.findAll(includeInactive);

      if (isErr(result)) {
        const { error: repositoryError } = result;
        return Err({
          code: 'TEMPLATE_FETCH_FAILED',
          message: 'Failed to fetch templates',
          details: repositoryError,
        });
      }

      // For each template, we could fetch items, but for list view we might not need them
      // Return as TemplateWithItems with empty items array
      const templatesWithItems = result.value.map(template => ({
        ...template,
        items: [] as any[], // Empty for list view
      }));

      return Ok(templatesWithItems);
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Get template details with items
   */
  async getTemplateDetails(templateId: string): Promise<Result<TemplateWithItems | null, ServiceError>> {
    try {
      const result = await this.templateRepo.findByIdWithItems(templateId);

      if (isErr(result)) {
        const { error: repositoryError } = result;
        return Err({
          code: 'TEMPLATE_FETCH_FAILED',
          message: 'Failed to fetch template',
          details: repositoryError,
        });
      }

      return Ok(result.value);
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Upload and persist template images
   */
  async uploadTemplateImage(
    supabaseClient: SupabaseClient,
    templateId: string,
    tenantId: string,
    processedImages: ProcessedImages,
    bucketName = TEMPLATE_IMAGE_BUCKET
  ): Promise<Result<TaskTemplate, ServiceError>> {
    try {
      const templateResult = await this.templateRepo.findByIdWithItems(templateId);

      if (isErr(templateResult)) {
        const { error: repositoryError } = templateResult;
        return Err({
          code: 'TEMPLATE_FETCH_FAILED',
          message: 'Failed to fetch template',
          details: repositoryError,
        });
      }

      const template = templateResult.value;

      if (!template) {
        return Err({
          code: 'TEMPLATE_NOT_FOUND',
          message: 'Template not found',
        });
      }

      if (template.tenant_id !== tenantId) {
        return Err({
          code: 'FORBIDDEN',
          message: 'Template does not belong to the current tenant',
        });
      }

      let uploadResult: { urls: TemplateImageUrls; paths: { thumbnail: string; medium: string; full: string } };

      try {
        uploadResult = await uploadImagesToStorage(
          supabaseClient,
          bucketName,
          templateId,
          tenantId,
          processedImages
        );
      } catch (uploadError: any) {
        return Err({
          code: 'IMAGE_UPLOAD_FAILED',
          message: uploadError.message || 'Failed to upload template images',
          details: uploadError,
        });
      }

      const updateResult = await this.templateRepo.updateImageUrls(templateId, uploadResult.urls);

      if (isErr(updateResult)) {
        const { error: repositoryError } = updateResult;
        try {
          await deleteImagesFromStorage(
            supabaseClient,
            bucketName,
            Object.values(uploadResult.paths)
          );
        } catch (cleanupError) {
          console.error('Failed to cleanup uploaded template images', cleanupError);
        }

        return Err({
          code: 'IMAGE_UPDATE_FAILED',
          message: 'Failed to persist template image URLs',
          details: repositoryError,
        });
      }

      return Ok(updateResult.value);
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Remove template images (set URLs to null and delete stored files when possible)
   */
  async removeTemplateImage(
    supabaseClient: SupabaseClient,
    templateId: string,
    tenantId: string,
    bucketName = TEMPLATE_IMAGE_BUCKET
  ): Promise<Result<TaskTemplate, ServiceError>> {
    try {
      const templateResult = await this.templateRepo.findByIdWithItems(templateId);

      if (isErr(templateResult)) {
        const { error: repositoryError } = templateResult;
        return Err({
          code: 'TEMPLATE_FETCH_FAILED',
          message: 'Failed to fetch template',
          details: repositoryError,
        });
      }

      const template = templateResult.value;

      if (!template) {
        return Err({
          code: 'TEMPLATE_NOT_FOUND',
          message: 'Template not found',
        });
      }

      if (template.tenant_id !== tenantId) {
        return Err({
          code: 'FORBIDDEN',
          message: 'Template does not belong to the current tenant',
        });
      }

      const storagePaths = [
        getStoragePath(template.thumbnail_url, bucketName),
        getStoragePath(template.medium_url, bucketName),
        getStoragePath(template.primary_image_url, bucketName),
      ].filter((path): path is string => Boolean(path));

      if (storagePaths.length > 0) {
        try {
          await deleteImagesFromStorage(supabaseClient, bucketName, storagePaths);
        } catch (cleanupError) {
          console.error('Failed to delete template images from storage', cleanupError);
        }
      }

      const updateResult = await this.templateRepo.updateImageUrls(templateId, {
        thumbnail_url: null,
        medium_url: null,
        primary_image_url: null,
      });

      if (isErr(updateResult)) {
        const { error: repositoryError } = updateResult;
        return Err({
          code: 'IMAGE_UPDATE_FAILED',
          message: 'Failed to clear template image URLs',
          details: repositoryError,
        });
      }

      return Ok(updateResult.value);
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Create template item from task definition (library support)
   * Converts a task definition into a template item format with source reference
   */
  createItemFromDefinition(
    definitionId: string,
    definitionName: string,
    definitionDescription: string,
    definitionCriteria: string | null,
    requiresPhoto: boolean,
    requiresApproval: boolean,
    isRequired: boolean,
    taskOrder: number
  ): {
    task_order: number;
    task_description: string;
    is_required: boolean;
    requires_photo_verification: boolean;
    requires_supervisor_approval: boolean;
    acceptance_criteria: string | null;
    source_definition_id: string;
  } {
    return {
      task_order: taskOrder,
      task_description: `${definitionName}: ${definitionDescription}`,
      is_required: isRequired,
      requires_photo_verification: requiresPhoto,
      requires_supervisor_approval: requiresApproval,
      acceptance_criteria: definitionCriteria,
      source_definition_id: definitionId,
    };
  }

  // ============================================================================
  // Template Item Association Methods (T016)
  // ============================================================================

  /**
   * Add item or kit association to a template item
   */
  async addItemAssociation(
    templateItemId: string,
    tenantId: string,
    input: CreateTaskTemplateItemAssociationInput
  ): Promise<Result<TaskTemplateItemAssociation, ServiceError>> {
    try {
      const result = await this.associationRepo.create(templateItemId, tenantId, input);

      if (isErr(result)) {
        const { error: repositoryError } = result;
        return Err({
          code: repositoryError.code,
          message: `Failed to add item association: ${repositoryError.message}`,
          details: repositoryError,
        });
      }

      return Ok(result.value);
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Remove item association from a template item
   */
  async removeItemAssociation(
    associationId: string
  ): Promise<Result<void, ServiceError>> {
    try {
      const result = await this.associationRepo.delete(associationId);

      if (isErr(result)) {
        const { error: repositoryError } = result;
        return Err({
          code: repositoryError.code,
          message: `Failed to remove item association: ${repositoryError.message}`,
          details: repositoryError,
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
   * Get all item associations for a template item
   */
  async getItemAssociations(
    templateItemId: string
  ): Promise<Result<TaskTemplateItemAssociationWithDetails[], ServiceError>> {
    try {
      const result = await this.associationRepo.findByTemplateItemIdWithDetails(templateItemId);

      if (isErr(result)) {
        const { error: repositoryError } = result;
        return Err({
          code: repositoryError.code,
          message: `Failed to fetch item associations: ${repositoryError.message}`,
          details: repositoryError,
        });
      }

      return Ok(result.value);
    } catch (err: any) {
      return Err({
        code: 'UNEXPECTED_ERROR',
        message: err.message,
        details: err,
      });
    }
  }

  /**
   * Update an existing item association
   */
  async updateItemAssociation(
    associationId: string,
    input: UpdateTaskTemplateItemAssociationInput
  ): Promise<Result<TaskTemplateItemAssociation, ServiceError>> {
    try {
      const result = await this.associationRepo.update(associationId, input);

      if (isErr(result)) {
        const { error: repositoryError } = result;
        return Err({
          code: repositoryError.code,
          message: `Failed to update item association: ${repositoryError.message}`,
          details: repositoryError,
        });
      }

      return Ok(result.value);
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
export const createTaskTemplateService = (
  templateRepo: TaskTemplateRepository,
  taskRepo: WorkflowTaskRepository,
  associationRepo: TaskTemplateItemAssociationRepository,
  workflowAssocRepo: WorkflowTaskItemAssociationRepository
): TaskTemplateService => {
  return new TaskTemplateService(templateRepo, taskRepo, associationRepo, workflowAssocRepo);
};
