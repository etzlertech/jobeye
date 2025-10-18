/**
 * T065: SafetyCompletionService
 * Service for managing safety checklist completions with vision AI photo verification
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { SafetyCompletionRepository, SafetyChecklistCompletion } from '../repositories/safety-completion.repository';
import { SafetyChecklistRepository } from '../repositories/safety-checklist.repository';

export interface ItemCompletion {
  item_id: string;
  completed: boolean;
  photo_id?: string;
  vision_verified?: boolean;
  vision_confidence?: number;
  notes?: string;
  completed_at?: string;
}

export class SafetyCompletionService {
  private completionRepo: SafetyCompletionRepository;
  private checklistRepo: SafetyChecklistRepository;

  constructor(private supabase: SupabaseClient) {
    this.completionRepo = new SafetyCompletionRepository(supabase);
    this.checklistRepo = new SafetyChecklistRepository(supabase);
  }

  /**
   * Start a new checklist completion
   */
  async startCompletion(data: {
    tenant_id: string;
    checklist_id: string;
    user_id: string;
    job_id?: string;
  }): Promise<SafetyChecklistCompletion> {
    // Verify checklist exists
    const checklist = await this.checklistRepo.findById(data.checklist_id);
    if (!checklist) {
      throw new Error('Checklist not found');
    }

    if (!checklist.active) {
      throw new Error('Cannot complete an inactive checklist');
    }

    // Initialize item completions
    const itemCompletions: ItemCompletion[] = checklist.items.map((item) => ({
      item_id: item.id,
      completed: false,
    }));

    return this.completionRepo.create({
      tenant_id: data.tenant_id,
      checklist_id: data.checklist_id,
      user_id: data.user_id,
      job_id: data.job_id,
      status: 'in_progress',
      item_completions: itemCompletions,
      total_items: checklist.items.length,
      completed_items: 0,
    });
  }

  /**
   * Get completion by ID
   */
  async getCompletionById(id: string): Promise<SafetyChecklistCompletion | null> {
    return this.completionRepo.findById(id);
  }

  /**
   * Get completions for a user
   */
  async getCompletionsByUser(
    userId: string,
    options?: {
      status?: SafetyChecklistCompletion['status'];
      startDate?: string;
      endDate?: string;
    }
  ): Promise<SafetyChecklistCompletion[]> {
    return this.completionRepo.findByUserId(userId, options);
  }

  /**
   * Get completions for a job
   */
  async getCompletionsByJob(jobId: string): Promise<SafetyChecklistCompletion[]> {
    return this.completionRepo.findByJobId(jobId);
  }

  /**
   * Mark an item as completed
   */
  async completeItem(
    completionId: string,
    itemId: string,
    data: {
      photo_id?: string;
      vision_verified?: boolean;
      vision_confidence?: number;
      notes?: string;
    }
  ): Promise<SafetyChecklistCompletion> {
    const completion = await this.completionRepo.findById(completionId);
    if (!completion) {
      throw new Error('Completion not found');
    }

    if (completion.status !== 'in_progress') {
      throw new Error('Cannot modify a completed or failed checklist');
    }

    // Find the item in the completion
    const itemIndex = completion.item_completions.findIndex((ic) => ic.item_id === itemId);
    if (itemIndex === -1) {
      throw new Error('Item not found in checklist');
    }

    // Update the item completion
    const updatedItemCompletions = [...completion.item_completions];
    updatedItemCompletions[itemIndex] = {
      ...updatedItemCompletions[itemIndex],
      completed: true,
      photo_id: data.photo_id,
      vision_verified: data.vision_verified,
      vision_confidence: data.vision_confidence,
      notes: data.notes,
      completed_at: new Date().toISOString(),
    };

    // Calculate new completed count
    const completed_items = updatedItemCompletions.filter((ic) => ic.completed).length;

    return this.completionRepo.update(completionId, {
      item_completions: updatedItemCompletions,
      completed_items,
    });
  }

  /**
   * Mark an item as incomplete
   */
  async uncompleteItem(completionId: string, itemId: string): Promise<SafetyChecklistCompletion> {
    const completion = await this.completionRepo.findById(completionId);
    if (!completion) {
      throw new Error('Completion not found');
    }

    if (completion.status !== 'in_progress') {
      throw new Error('Cannot modify a completed or failed checklist');
    }

    const itemIndex = completion.item_completions.findIndex((ic) => ic.item_id === itemId);
    if (itemIndex === -1) {
      throw new Error('Item not found in checklist');
    }

    const updatedItemCompletions = [...completion.item_completions];
    updatedItemCompletions[itemIndex] = {
      item_id: itemId,
      completed: false,
    };

    const completed_items = updatedItemCompletions.filter((ic) => ic.completed).length;

    return this.completionRepo.update(completionId, {
      item_completions: updatedItemCompletions,
      completed_items,
    });
  }

  /**
   * Submit checklist completion
   */
  async submitCompletion(completionId: string): Promise<SafetyChecklistCompletion> {
    const completion = await this.completionRepo.findById(completionId);
    if (!completion) {
      throw new Error('Completion not found');
    }

    if (completion.status !== 'in_progress') {
      throw new Error('Checklist is not in progress');
    }

    // Verify all critical items are completed
    const checklist = await this.checklistRepo.findById(completion.checklist_id);
    if (!checklist) {
      throw new Error('Associated checklist not found');
    }

    const criticalItems = checklist.items.filter((item) => item.critical);
    const completedItemIds = completion.item_completions
      .filter((ic) => ic.completed)
      .map((ic) => ic.item_id);

    const missingCritical = criticalItems.filter((item) => !completedItemIds.includes(item.id));

    if (missingCritical.length > 0) {
      throw new Error(
        `Cannot submit: ${missingCritical.length} critical item(s) not completed: ${missingCritical
          .map((item) => item.task)
          .join(', ')}`
      );
    }

    // Calculate pass/fail status
    const allItemsCompleted = completion.completed_items === completion.total_items;
    const status = allItemsCompleted ? 'completed' : 'completed_with_issues';

    return this.completionRepo.update(completionId, {
      status,
      completed_at: new Date().toISOString(),
    });
  }

  /**
   * Fail a checklist completion
   */
  async failCompletion(completionId: string, reason: string): Promise<SafetyChecklistCompletion> {
    const completion = await this.completionRepo.findById(completionId);
    if (!completion) {
      throw new Error('Completion not found');
    }

    return this.completionRepo.update(completionId, {
      status: 'failed',
      completed_at: new Date().toISOString(),
      item_completions: completion.item_completions.map((ic) => ({
        ...ic,
        notes: ic.notes ? `${ic.notes}\n\nFailed: ${reason}` : `Failed: ${reason}`,
      })),
    });
  }

  /**
   * Get completion progress
   */
  async getCompletionProgress(completionId: string): Promise<{
    total_items: number;
    completed_items: number;
    percentage: number;
    critical_completed: number;
    critical_total: number;
    photo_verified_items: number;
    remaining_items: string[];
  }> {
    const completion = await this.completionRepo.findById(completionId);
    if (!completion) {
      throw new Error('Completion not found');
    }

    const checklist = await this.checklistRepo.findById(completion.checklist_id);
    if (!checklist) {
      throw new Error('Associated checklist not found');
    }

    const criticalItemIds = checklist.items.filter((item) => item.critical).map((item) => item.id);
    const completedItemIds = completion.item_completions
      .filter((ic) => ic.completed)
      .map((ic) => ic.item_id);

    const critical_completed = completedItemIds.filter((id) => criticalItemIds.includes(id)).length;
    const photo_verified_items = completion.item_completions.filter((ic) => ic.vision_verified).length;

    const remaining_items = checklist.items
      .filter((item) => !completedItemIds.includes(item.id))
      .map((item) => item.task);

    return {
      total_items: completion.total_items,
      completed_items: completion.completed_items,
      percentage: (completion.completed_items / completion.total_items) * 100,
      critical_completed,
      critical_total: criticalItemIds.length,
      photo_verified_items,
      remaining_items,
    };
  }

  /**
   * Delete a completion
   */
  async deleteCompletion(id: string): Promise<void> {
    return this.completionRepo.delete(id);
  }

  /**
   * Get completion statistics for a user
   */
  async getUserCompletionStats(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    total_completions: number;
    completed: number;
    completed_with_issues: number;
    failed: number;
    in_progress: number;
    avg_completion_percentage: number;
    vision_verification_rate: number;
  }> {
    const completions = await this.completionRepo.findByUserId(userId, { startDate, endDate });

    const total_completions = completions.length;
    const completed = completions.filter((c) => c.status === 'completed').length;
    const completed_with_issues = completions.filter((c) => c.status === 'completed_with_issues').length;
    const failed = completions.filter((c) => c.status === 'failed').length;
    const in_progress = completions.filter((c) => c.status === 'in_progress').length;

    const total_percentage = completions.reduce((sum, c) => {
      return sum + (c.total_items > 0 ? (c.completed_items / c.total_items) * 100 : 0);
    }, 0);

    const vision_verified = completions.reduce((sum, c) => {
      return sum + c.item_completions.filter((ic) => ic.vision_verified).length;
    }, 0);

    const total_items = completions.reduce((sum, c) => sum + c.total_items, 0);

    return {
      total_completions,
      completed,
      completed_with_issues,
      failed,
      in_progress,
      avg_completion_percentage: total_completions > 0 ? total_percentage / total_completions : 0,
      vision_verification_rate: total_items > 0 ? (vision_verified / total_items) * 100 : 0,
    };
  }
}