/**
 * T064: SafetyChecklistService
 * Service for managing safety checklists with photo verification integration
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { SafetyChecklistRepository, SafetyChecklist } from '../repositories/safety-checklist.repository';

export interface ChecklistItem {
  id: string;
  task: string;
  type: 'visual_inspection' | 'measurement' | 'photo_required' | 'signature';
  photo_required: boolean;
  critical: boolean;
  sequence: number;
  instructions?: string;
}

export class SafetyChecklistService {
  private checklistRepo: SafetyChecklistRepository;

  constructor(private supabase: SupabaseClient) {
    this.checklistRepo = new SafetyChecklistRepository(supabase);
  }

  /**
   * Get all active checklists
   */
  async getActiveChecklists(): Promise<SafetyChecklist[]> {
    return this.checklistRepo.findAll({ active: true });
  }

  /**
   * Get checklist by ID
   */
  async getChecklistById(id: string): Promise<SafetyChecklist | null> {
    return this.checklistRepo.findById(id);
  }

  /**
   * Get checklists required for a specific job type
   */
  async getChecklistsForJobType(jobType: string): Promise<SafetyChecklist[]> {
    return this.checklistRepo.findByJobType(jobType);
  }

  /**
   * Get daily checklists
   */
  async getDailyChecklists(): Promise<SafetyChecklist[]> {
    return this.checklistRepo.findByFrequency('daily');
  }

  /**
   * Create a new safety checklist
   */
  async createChecklist(data: {
    tenant_id: string;
    name: string;
    description?: string;
    required_for: Array<{ type: string; value: string }>;
    items: ChecklistItem[];
    frequency: 'per-job' | 'daily' | 'weekly' | 'monthly';
  }): Promise<SafetyChecklist> {
    // Validate items
    this.validateChecklistItems(data.items);

    return this.checklistRepo.create({
      tenant_id: data.tenant_id,
      name: data.name,
      description: data.description,
      required_for: data.required_for,
      items: data.items,
      frequency: data.frequency,
      active: true,
    });
  }

  /**
   * Update an existing checklist
   */
  async updateChecklist(
    id: string,
    updates: {
      name?: string;
      description?: string;
      required_for?: Array<{ type: string; value: string }>;
      items?: ChecklistItem[];
      frequency?: SafetyChecklist['frequency'];
    }
  ): Promise<SafetyChecklist> {
    // Validate items if provided
    if (updates.items) {
      this.validateChecklistItems(updates.items);
    }

    return this.checklistRepo.update(id, updates);
  }

  /**
   * Add an item to a checklist
   */
  async addChecklistItem(checklistId: string, item: ChecklistItem): Promise<SafetyChecklist> {
    const checklist = await this.checklistRepo.findById(checklistId);
    if (!checklist) {
      throw new Error('Checklist not found');
    }

    const updatedItems = [...checklist.items, item];
    return this.checklistRepo.update(checklistId, { items: updatedItems });
  }

  /**
   * Remove an item from a checklist
   */
  async removeChecklistItem(checklistId: string, itemId: string): Promise<SafetyChecklist> {
    const checklist = await this.checklistRepo.findById(checklistId);
    if (!checklist) {
      throw new Error('Checklist not found');
    }

    const updatedItems = checklist.items.filter((item) => item.id !== itemId);
    return this.checklistRepo.update(checklistId, { items: updatedItems });
  }

  /**
   * Reorder checklist items
   */
  async reorderItems(checklistId: string, itemIdsInOrder: string[]): Promise<SafetyChecklist> {
    const checklist = await this.checklistRepo.findById(checklistId);
    if (!checklist) {
      throw new Error('Checklist not found');
    }

    // Create a map of existing items
    const itemMap = new Map(checklist.items.map((item) => [item.id, item]));

    // Reorder based on provided order
    const reorderedItems = itemIdsInOrder
      .map((id, index) => {
        const item = itemMap.get(id);
        if (!item) return null;
        return { ...item, sequence: index + 1 };
      })
      .filter((item): item is ChecklistItem => item !== null);

    return this.checklistRepo.update(checklistId, { items: reorderedItems });
  }

  /**
   * Activate or deactivate a checklist
   */
  async setChecklistActive(id: string, active: boolean): Promise<SafetyChecklist> {
    return this.checklistRepo.update(id, { active });
  }

  /**
   * Delete a checklist
   */
  async deleteChecklist(id: string): Promise<void> {
    return this.checklistRepo.delete(id);
  }

  /**
   * Get checklist statistics
   */
  async getChecklistStats(): Promise<{
    total_checklists: number;
    active_checklists: number;
    by_frequency: Record<string, number>;
    avg_items_per_checklist: number;
    photo_required_percentage: number;
  }> {
    const allChecklists = await this.checklistRepo.findAll();
    const activeChecklists = allChecklists.filter((c) => c.active);

    const by_frequency: Record<string, number> = {};
    activeChecklists.forEach((checklist) => {
      by_frequency[checklist.frequency] = (by_frequency[checklist.frequency] || 0) + 1;
    });

    const totalItems = allChecklists.reduce((sum, c) => sum + c.items.length, 0);
    const photoRequiredItems = allChecklists.reduce(
      (sum, c) => sum + c.items.filter((item) => item.photo_required).length,
      0
    );

    return {
      total_checklists: allChecklists.length,
      active_checklists: activeChecklists.length,
      by_frequency,
      avg_items_per_checklist: allChecklists.length > 0 ? totalItems / allChecklists.length : 0,
      photo_required_percentage: totalItems > 0 ? (photoRequiredItems / totalItems) * 100 : 0,
    };
  }

  /**
   * Validate checklist items
   */
  private validateChecklistItems(items: ChecklistItem[]): void {
    if (items.length === 0) {
      throw new Error('Checklist must have at least one item');
    }

    // Check for duplicate item IDs
    const ids = items.map((item) => item.id);
    const uniqueIds = new Set(ids);
    if (ids.length !== uniqueIds.size) {
      throw new Error('Duplicate item IDs detected');
    }

    // Check for duplicate sequences
    const sequences = items.map((item) => item.sequence);
    const uniqueSequences = new Set(sequences);
    if (sequences.length !== uniqueSequences.size) {
      throw new Error('Duplicate item sequences detected');
    }

    // Validate each item
    items.forEach((item, index) => {
      if (!item.task || item.task.trim().length === 0) {
        throw new Error(`Item at index ${index} must have a task description`);
      }

      if (!['visual_inspection', 'measurement', 'photo_required', 'signature'].includes(item.type)) {
        throw new Error(`Item at index ${index} has invalid type: ${item.type}`);
      }

      if (item.sequence < 1) {
        throw new Error(`Item at index ${index} has invalid sequence: ${item.sequence}`);
      }
    });
  }

  /**
   * Clone a checklist for a different tenant or purpose
   */
  async cloneChecklist(
    sourceId: string,
    targetTenantId: string,
    newName?: string
  ): Promise<SafetyChecklist> {
    const source = await this.checklistRepo.findById(sourceId);
    if (!source) {
      throw new Error('Source checklist not found');
    }

    return this.checklistRepo.create({
      tenant_id: targetTenantId,
      name: newName || `${source.name} (Copy)`,
      description: source.description,
      required_for: source.required_for,
      items: source.items,
      frequency: source.frequency,
      active: true,
    });
  }
}