/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/domains/inventory/services/inventory-voice-orchestrator.service.ts
 * phase: 3
 * domain: inventory
 * purpose: Orchestrate voice intents to inventory CRUD operations
 * spec_ref: voice-to-crud-plan.md
 * complexity_budget: 500
 * migrations_touched: []
 * state_machine: null
 * estimated_llm_cost: {
 *   "executeIntent": "$0.00 (no LLM calls, just orchestration)"
 * }
 * offline_capability: REQUIRED (delegates to services with offline support)
 * dependencies: {
 *   internal: [
 *     '@/domains/intent/types/voice-intent-types',
 *     './check-in.service',
 *     './check-out.service',
 *     './transfer.service',
 *     '../repositories/inventory-items.repository',
 *     '@/domains/equipment/repositories/equipment-repository',
 *     '@/domains/material/repositories/material-repository',
 *     '@/core/logger/voice-logger',
 *     '@/core/errors/error-types'
 *   ]
 * }
 * exports: ['InventoryVoiceOrchestrator']
 * voice_considerations: |
 *   Maps voice intents to inventory services.
 *   Resolves entity names (e.g., "hammer") to database IDs.
 *   Provides human-readable responses for TTS.
 * test_requirements: {
 *   coverage: 90,
 *   unit_tests: 'tests/domains/inventory/services/inventory-voice-orchestrator.test.ts',
 *   integration_tests: 'tests/integration/voice-to-crud-flow.test.ts'
 * }
 * tasks: [
 *   'Implement intent routing to services',
 *   'Add entity name to ID resolution',
 *   'Handle missing/invalid entities gracefully',
 *   'Generate human-readable response text',
 *   'Add voice logging for all operations'
 * ]
 */

import {
  VoiceIntentResult,
  VoiceIntentEntities,
  VoiceActionResult,
} from '@/domains/intent/types/voice-intent-types';
import { checkIn, CheckInRequest, CheckInResult } from './check-in.service';
import { checkOut, CheckOutRequest, CheckOutResult } from './check-out.service';
import { transfer, TransferRequest, TransferResult } from './transfer.service';
import * as inventoryItemsRepo from '../repositories/inventory-items.repository';
import { EquipmentRepository, EquipmentCreateInput } from '@/domains/equipment/repositories/equipment-repository';
import { MaterialRepository, MaterialCreateInput } from '@/domains/material/repositories/material-repository';
import { VoiceLogger } from '@/core/logger/voice-logger';
import { createAppError, ErrorCategory, ErrorSeverity } from '@/core/errors/error-types';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * Orchestrate voice intents to inventory CRUD operations
 */
export class InventoryVoiceOrchestrator {
  private voiceLogger: VoiceLogger;

  constructor() {
    this.voiceLogger = new VoiceLogger();
  }

  /**
   * Execute intent and return result with human-readable response
   */
  async executeIntent(
    intent: VoiceIntentResult,
    userId: string,
    tenantId: string,
    voiceSessionId?: string
  ): Promise<VoiceActionResult> {
    const startTime = Date.now();

    try {
      // Route to appropriate handler
      let result: VoiceActionResult;

      switch (intent.intent) {
        case 'check_in':
          result = await this.handleCheckIn(intent.entities, userId, tenantId, voiceSessionId);
          break;

        case 'check_out':
          result = await this.handleCheckOut(intent.entities, userId, tenantId, voiceSessionId);
          break;

        case 'transfer':
          result = await this.handleTransfer(intent.entities, userId, tenantId, voiceSessionId);
          break;

        case 'inventory_add':
          result = await this.handleInventoryAdd(intent.entities, userId, tenantId, voiceSessionId);
          break;

        case 'inventory_check':
          result = await this.handleInventoryCheck(intent.entities, userId, tenantId);
          break;

        default:
          result = {
            success: false,
            intent: intent.intent,
            response_text: `I don't know how to handle the "${intent.intent}" action yet.`,
            error: 'Unsupported intent',
          };
      }

      // Log voice command
      this.voiceLogger.logVoiceCommand(
        intent.intent,
        intent.confidence,
        {
          sessionId: voiceSessionId || 'no-session',
        }
      );

      return result;
    } catch (error) {
      throw createAppError({
        code: 'VOICE_ORCHESTRATION_ERROR',
        message: `Failed to execute intent "${intent.intent}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.VOICE,
        context: { intent: intent.intent, entities: intent.entities },
        originalError: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Handle check-in intent
   */
  private async handleCheckIn(
    entities: VoiceIntentEntities | undefined,
    userId: string,
    tenantId: string,
    voiceSessionId?: string
  ): Promise<VoiceActionResult> {
    // Validate required entities
    if (!entities || !entities.itemNames || entities.itemNames.length === 0) {
      return {
        success: false,
        intent: 'check_in',
        response_text: 'Which items do you want to check in?',
        needs_confirmation: false,
        error: 'Missing item names',
      };
    }

    if (!entities.jobId && !entities.jobNumber) {
      return {
        success: false,
        intent: 'check_in',
        response_text: 'Which job are you checking items in from?',
        needs_confirmation: false,
        error: 'Missing job ID',
      };
    }

    try {
      // Resolve item names to IDs
      const itemIds = await this.resolveItemNames(entities.itemNames, tenantId);

      if (itemIds.length === 0) {
        return {
          success: false,
          intent: 'check_in',
          response_text: `I couldn't find any items matching "${entities.itemNames.join(', ')}". Please check the names.`,
          error: 'Items not found',
        };
      }

      // Build check-in request
      const request: CheckInRequest = {
        tenantId,
        userId,
        itemIds,
        jobId: entities.jobId || entities.jobNumber,
        toLocationId: entities.toLocationId,
        quantities: this.buildQuantitiesMap(itemIds, entities.quantities),
        conditions: this.buildConditionsMap(itemIds, entities.conditions),
        notes: entities.notes,
        voiceSessionId,
      };

      // Execute check-in
      const result: CheckInResult = await checkIn(request);

      if (!result.success) {
        return {
          success: false,
          intent: 'check_in',
          response_text: `Failed to check in items: ${result.error?.message || 'Unknown error'}`,
          error: result.error?.message,
        };
      }

      // Build response
      const itemCount = result.transactions.length;
      const itemNames = entities.itemNames.slice(0, itemCount).join(', ');
      const location = entities.toLocationName || 'the warehouse';

      return {
        success: true,
        intent: 'check_in',
        data: result,
        response_text: `Checked in ${itemCount} item${itemCount !== 1 ? 's' : ''} (${itemNames}) from job ${entities.jobId || entities.jobNumber} to ${location}.`,
      };
    } catch (error) {
      return {
        success: false,
        intent: 'check_in',
        response_text: `Failed to check in items: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle check-out intent
   */
  private async handleCheckOut(
    entities: VoiceIntentEntities | undefined,
    userId: string,
    tenantId: string,
    voiceSessionId?: string
  ): Promise<VoiceActionResult> {
    // Validate required entities
    if (!entities || !entities.itemNames || entities.itemNames.length === 0) {
      return {
        success: false,
        intent: 'check_out',
        response_text: 'Which items do you want to check out?',
        error: 'Missing item names',
      };
    }

    if (!entities.jobId && !entities.jobNumber) {
      return {
        success: false,
        intent: 'check_out',
        response_text: 'Which job should I assign these items to?',
        error: 'Missing job ID',
      };
    }

    try {
      // Resolve item names to IDs
      const itemIds = await this.resolveItemNames(entities.itemNames, tenantId);

      if (itemIds.length === 0) {
        return {
          success: false,
          intent: 'check_out',
          response_text: `I couldn't find any items matching "${entities.itemNames.join(', ')}".`,
          error: 'Items not found',
        };
      }

      // Build check-out request
      const request: CheckOutRequest = {
        tenantId,
        userId,
        itemIds,
        jobId: entities.jobId || entities.jobNumber,
        locationId: entities.toLocationId,
        quantities: this.buildQuantitiesMap(itemIds, entities.quantities),
        notes: entities.notes,
        voiceSessionId,
      };

      // Execute check-out
      const result: CheckOutResult = await checkOut(request);

      if (!result.success) {
        return {
          success: false,
          intent: 'check_out',
          response_text: `Failed to check out items: ${result.error?.message || 'Unknown error'}`,
          error: result.error?.message,
        };
      }

      // Build response
      const itemCount = result.transactions.length;
      const itemNames = entities.itemNames.slice(0, itemCount).join(', ');
      const location = entities.toLocationName || 'the job site';

      return {
        success: true,
        intent: 'check_out',
        data: result,
        response_text: `Checked out ${itemCount} item${itemCount !== 1 ? 's' : ''} (${itemNames}) to job ${entities.jobId || entities.jobNumber} at ${location}.`,
      };
    } catch (error) {
      return {
        success: false,
        intent: 'check_out',
        response_text: `Failed to check out items: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle transfer intent
   */
  private async handleTransfer(
    entities: VoiceIntentEntities | undefined,
    userId: string,
    tenantId: string,
    voiceSessionId?: string
  ): Promise<VoiceActionResult> {
    // Validate required entities
    if (!entities || !entities.itemNames || entities.itemNames.length === 0) {
      return {
        success: false,
        intent: 'transfer',
        response_text: 'Which items do you want to transfer?',
        error: 'Missing item names',
      };
    }

    if (!entities.fromLocationId && !entities.fromLocationName) {
      return {
        success: false,
        intent: 'transfer',
        response_text: 'Where are you transferring the items from?',
        error: 'Missing source location',
      };
    }

    if (!entities.toLocationId && !entities.toLocationName) {
      return {
        success: false,
        intent: 'transfer',
        response_text: 'Where should I transfer the items to?',
        error: 'Missing destination location',
      };
    }

    try {
      // Resolve item names to IDs
      const itemIds = await this.resolveItemNames(entities.itemNames, tenantId);

      if (itemIds.length === 0) {
        return {
          success: false,
          intent: 'transfer',
          response_text: `I couldn't find any items matching "${entities.itemNames.join(', ')}".`,
          error: 'Items not found',
        };
      }

      // Resolve location names to IDs (if needed)
      const fromLocationId = entities.fromLocationId || await this.resolveLocationName(entities.fromLocationName!, tenantId);
      const toLocationId = entities.toLocationId || await this.resolveLocationName(entities.toLocationName!, tenantId);

      if (!fromLocationId || !toLocationId) {
        return {
          success: false,
          intent: 'transfer',
          response_text: 'I couldn\'t find one or both of the locations you specified.',
          error: 'Locations not found',
        };
      }

      // Build transfer request
      const request: TransferRequest = {
        tenantId,
        userId,
        itemIds,
        fromLocationId,
        toLocationId,
        quantities: this.buildQuantitiesMap(itemIds, entities.quantities),
        jobId: entities.jobId,
        notes: entities.notes,
        voiceSessionId,
      };

      // Execute transfer
      const result: TransferResult = await transfer(request);

      if (!result.success) {
        return {
          success: false,
          intent: 'transfer',
          response_text: `Failed to transfer items: ${result.error?.message || 'Unknown error'}`,
          error: result.error?.message,
        };
      }

      // Build response
      const itemCount = result.transactions.length;
      const itemNames = entities.itemNames.slice(0, itemCount).join(', ');

      return {
        success: true,
        intent: 'transfer',
        data: result,
        response_text: `Transferred ${itemCount} item${itemCount !== 1 ? 's' : ''} (${itemNames}) from ${entities.fromLocationName} to ${entities.toLocationName}.`,
      };
    } catch (error) {
      return {
        success: false,
        intent: 'transfer',
        response_text: `Failed to transfer items: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle inventory add intent
   */
  private async handleInventoryAdd(
    entities: VoiceIntentEntities | undefined,
    userId: string,
    tenantId: string,
    voiceSessionId?: string
  ): Promise<VoiceActionResult> {
    // Validate required entities
    if (!entities || !entities.itemNames || entities.itemNames.length === 0) {
      return {
        success: false,
        intent: 'inventory_add',
        response_text: 'What item do you want to add to inventory?',
        error: 'Missing item name',
      };
    }

    try {
      const supabase = await createServerSupabaseClient();
      const equipmentRepo = new EquipmentRepository(supabase);

      const createdItems = [];
      const quantities = entities.quantities || Array(entities.itemNames.length).fill(1);

      for (let i = 0; i < entities.itemNames.length; i++) {
        const itemName = entities.itemNames[i];
        const quantity = quantities[i] || 1;

        // Determine if this is equipment or material (default to equipment)
        const isEquipment = !entities.materialType;

        if (isEquipment) {
          // Create equipment
          const equipmentData: EquipmentCreateInput = {
            name: itemName,
            category: 'general',
            notes: entities.notes,
            tags: entities.tags,
            voiceMetadata: {
              createdViaVoice: true,
              voiceSessionId,
              originalTranscript: itemName,
            },
          };

          const created = await equipmentRepo.createEquipment(equipmentData, tenantId);
          createdItems.push(created);
        } else {
          // Create material
          const materialRepo = new MaterialRepository(supabase);
          const materialData: MaterialCreateInput = {
            name: itemName,
            category: entities.materialType || 'general',
            unit_of_measure: entities.unitOfMeasure || 'each',
            quantity_on_hand: quantity,
            notes: entities.notes,
            tags: entities.tags,
          };

          const created = await materialRepo.createMaterial(materialData, tenantId);
          createdItems.push(created);
        }
      }

      const itemCount = createdItems.length;
      const itemNames = entities.itemNames.join(', ');

      return {
        success: true,
        intent: 'inventory_add',
        data: { items: createdItems },
        response_text: `Added ${itemCount} new item${itemCount !== 1 ? 's' : ''} to inventory: ${itemNames}.`,
      };
    } catch (error) {
      return {
        success: false,
        intent: 'inventory_add',
        response_text: `Failed to add items to inventory: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle inventory check intent
   */
  private async handleInventoryCheck(
    entities: VoiceIntentEntities | undefined,
    userId: string,
    tenantId: string
  ): Promise<VoiceActionResult> {
    if (!entities || !entities.itemNames || entities.itemNames.length === 0) {
      return {
        success: false,
        intent: 'inventory_check',
        response_text: 'Which items do you want to check?',
        error: 'Missing item name',
      };
    }

    try {
      const items = await this.searchItems(entities.itemNames[0], tenantId);

      if (items.length === 0) {
        return {
          success: true,
          intent: 'inventory_check',
          data: { items: [] },
          response_text: `I couldn't find any "${entities.itemNames[0]}" in inventory.`,
        };
      }

      const item = items[0];
      const statusText = item.status === 'active' ? 'available' : item.status;
      const locationText = item.current_location_id ? `at location ${item.current_location_id}` : 'no location assigned';

      return {
        success: true,
        intent: 'inventory_check',
        data: { items },
        response_text: `Found ${items.length} ${entities.itemNames[0]}${items.length > 1 ? 's' : ''}. First one is ${statusText}, ${locationText}.`,
      };
    } catch (error) {
      return {
        success: false,
        intent: 'inventory_check',
        response_text: `Failed to check inventory: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Resolve item names to IDs using fuzzy search
   */
  private async resolveItemNames(
    itemNames: string[],
    tenantId: string
  ): Promise<string[]> {
    const itemIds: string[] = [];

    for (const name of itemNames) {
      const items = await this.searchItems(name, tenantId);
      if (items.length > 0) {
        itemIds.push(items[0].id); // Take first match
      }
    }

    return itemIds;
  }

  /**
   * Search items by name
   */
  private async searchItems(name: string, tenantId: string) {
    const result = await inventoryItemsRepo.findAll({
      tenantId,
      search: name,
      limit: 5,
    });

    return result.data || [];
  }

  /**
   * Resolve location name to ID (placeholder - would need location repository)
   */
  private async resolveLocationName(
    locationName: string,
    tenantId: string
  ): Promise<string | null> {
    // TODO: Implement location search
    // For now, return a placeholder
    return `location_${locationName.toLowerCase().replace(/\s+/g, '_')}`;
  }

  /**
   * Build quantities map from arrays
   */
  private buildQuantitiesMap(
    itemIds: string[],
    quantities?: number[]
  ): Record<string, number> {
    if (!quantities || quantities.length === 0) {
      return {};
    }

    const map: Record<string, number> = {};
    itemIds.forEach((id, index) => {
      map[id] = quantities[index] || 1;
    });
    return map;
  }

  /**
   * Build conditions map from arrays
   */
  private buildConditionsMap(
    itemIds: string[],
    conditions?: ('good' | 'damaged' | 'needs_repair')[]
  ): Record<string, any> {
    if (!conditions || conditions.length === 0) {
      return {};
    }

    const map: Record<string, string> = {};
    itemIds.forEach((id, index) => {
      map[id] = conditions[index] || 'good';
    });
    return map;
  }
}
