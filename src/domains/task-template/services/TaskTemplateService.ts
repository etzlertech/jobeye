// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/task-template/services/TaskTemplateService.ts
// phase: 3.4
// domain: task-template
// purpose: Business logic for task template operations and instantiation
// spec_ref: specs/011-making-task-lists/spec.md
// version: 2025-10-18
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

import { TaskTemplateRepository } from '../repositories/TaskTemplateRepository';
import { WorkflowTaskRepository } from '@/domains/workflow-task/repositories/WorkflowTaskRepository';
import {
  TemplateWithItems,
  ServiceError,
  Result,
  Ok,
  Err,
} from '../types/task-template-types';
import type { WorkflowTask } from '@/domains/workflow-task/types/workflow-task-types';

export class TaskTemplateService {
  constructor(
    private templateRepo: TaskTemplateRepository,
    private taskRepo: WorkflowTaskRepository
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

      if (!templateResult.ok) {
        return Err({
          code: 'TEMPLATE_FETCH_FAILED',
          message: 'Failed to fetch template',
          details: templateResult.error,
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
      if (existingTasksResult.ok && existingTasksResult.value.length > 0) {
        // This is just a warning - we'll still proceed
        console.warn(`Job ${jobId} already has ${existingTasksResult.value.length} tasks. Adding template tasks.`);
      }

      // Create tasks from template
      const createResult = await this.taskRepo.createFromTemplate(jobId, template.items);

      if (!createResult.ok) {
        return Err({
          code: 'TASK_CREATION_FAILED',
          message: 'Failed to create tasks from template',
          details: createResult.error,
        });
      }

      return Ok(createResult.value);
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

      if (!usageResult.ok) {
        return Err({
          code: 'VALIDATION_FAILED',
          message: 'Failed to check template usage',
          details: usageResult.error,
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

      if (!result.ok) {
        return Err({
          code: 'TEMPLATE_FETCH_FAILED',
          message: 'Failed to fetch templates',
          details: result.error,
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

      if (!result.ok) {
        return Err({
          code: 'TEMPLATE_FETCH_FAILED',
          message: 'Failed to fetch template',
          details: result.error,
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
  taskRepo: WorkflowTaskRepository
): TaskTemplateService => {
  return new TaskTemplateService(templateRepo, taskRepo);
};
