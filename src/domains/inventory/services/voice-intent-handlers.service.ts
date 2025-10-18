/**
 * @file /src/domains/inventory/services/voice-intent-handlers.service.ts
 * @phase 3.7
 * @domain Inventory
 * @purpose Voice intent handlers for inventory operations
 * @complexity_budget 300
 * @feature 004-voice-vision-inventory
 *
 * Voice commands supported:
 * - "Check out hammer and drill for job 123"
 * - "Check in tools from truck A"
 * - "Record 5 bags of cement used"
 * - "Transfer ladder from truck to warehouse"
 * - "Scan items in this photo"
 * - "Start inventory audit at warehouse"
 */

import type { IntentClassification } from '../../voice/services/intent-recognition-service';
import * as checkOutService from './check-out.service';
import * as checkInService from './check-in.service';
import * as materialUsageService from './material-usage.service';
import * as transferService from './transfer.service';
import * as auditService from './audit.service';
import * as detectionOrchestratorService from './detection-orchestrator.service';

export interface VoiceCommandContext {
  tenantId: string;
  userId: string;
  sessionId: string;
  jobId?: string;
  locationId?: string;
}

export interface VoiceCommandResult {
  success: boolean;
  message: string;
  data?: any;
  error?: Error;
}

/**
 * Handle CHECK_OUT_EQUIPMENT intent
 * Example: "Check out hammer and drill for job 123"
 */
export async function handleCheckOutEquipment(
  classification: IntentClassification,
  context: VoiceCommandContext
): Promise<VoiceCommandResult> {
  try {
    // Extract entities
    const itemNames = classification.entities
      .filter((e) => e.type === 'item_name')
      .map((e) => e.value);

    const jobId =
      classification.entities.find((e) => e.type === 'job_id')?.value ||
      context.jobId;

    const locationId =
      classification.entities.find((e) => e.type === 'location_id')?.value ||
      context.locationId;

    if (itemNames.length === 0) {
      return {
        success: false,
        message: 'No items specified for check-out. Please specify item names.',
      };
    }

    // TODO: Resolve item names to IDs
    // For now, assume itemNames are IDs
    const result = await checkOutService.checkOut({
      tenantId: context.tenantId,
      userId: context.userId,
      itemIds: itemNames, // In real implementation, resolve names to IDs
      jobId,
      locationId,
      voiceSessionId: context.sessionId,
    });

    if (!result.success) {
      return {
        success: false,
        message: `Check-out failed: ${result.error?.message}`,
        error: result.error,
      };
    }

    const itemCount = result.transactions.length;
    return {
      success: true,
      message: `Successfully checked out ${itemCount} item${itemCount !== 1 ? 's' : ''}${jobId ? ` for job ${jobId}` : ''}`,
      data: result,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Check-out failed: ${err.message}`,
      error: err,
    };
  }
}

/**
 * Handle CHECK_IN_EQUIPMENT intent
 * Example: "Check in tools from truck A"
 */
export async function handleCheckInEquipment(
  classification: IntentClassification,
  context: VoiceCommandContext
): Promise<VoiceCommandResult> {
  try {
    const itemNames = classification.entities
      .filter((e) => e.type === 'item_name')
      .map((e) => e.value);

    const fromLocation = classification.entities.find(
      (e) => e.type === 'from_location'
    )?.value;

    const toLocation =
      classification.entities.find((e) => e.type === 'to_location')?.value ||
      context.locationId;

    if (itemNames.length === 0) {
      return {
        success: false,
        message: 'No items specified for check-in. Please specify item names.',
      };
    }

    const result = await checkInService.checkIn({
      tenantId: context.tenantId,
      userId: context.userId,
      itemIds: itemNames, // TODO: Resolve names to IDs
      fromLocationId: fromLocation,
      toLocationId: toLocation,
      jobId: context.jobId,
      voiceSessionId: context.sessionId,
    });

    if (!result.success) {
      return {
        success: false,
        message: `Check-in failed: ${result.error?.message}`,
        error: result.error,
      };
    }

    const itemCount = result.transactions.length;
    return {
      success: true,
      message: `Successfully checked in ${itemCount} item${itemCount !== 1 ? 's' : ''}`,
      data: result,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Check-in failed: ${err.message}`,
      error: err,
    };
  }
}

/**
 * Handle RECORD_MATERIAL_USAGE intent
 * Example: "Record 5 bags of cement used"
 */
export async function handleRecordMaterialUsage(
  classification: IntentClassification,
  context: VoiceCommandContext
): Promise<VoiceCommandResult> {
  try {
    const materialName = classification.entities.find(
      (e) => e.type === 'item_name' || e.type === 'material_name'
    )?.value;

    const quantity =
      parseFloat(
        classification.entities.find((e) => e.type === 'quantity')?.value
      ) || 1;

    const jobId =
      classification.entities.find((e) => e.type === 'job_id')?.value ||
      context.jobId;

    if (!materialName) {
      return {
        success: false,
        message: 'Material name not specified. Please specify what material was used.',
      };
    }

    if (!jobId) {
      return {
        success: false,
        message: 'Job ID not specified. Material usage must be linked to a job.',
      };
    }

    const result = await materialUsageService.recordUsage({
      tenantId: context.tenantId,
      userId: context.userId,
      materialId: materialName, // TODO: Resolve name to ID
      quantity,
      jobId,
      voiceSessionId: context.sessionId,
    });

    if (!result.success) {
      return {
        success: false,
        message: `Failed to record usage: ${result.error?.message}`,
        error: result.error,
      };
    }

    return {
      success: true,
      message: `Recorded ${quantity} ${materialName} used for job ${jobId}`,
      data: result,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Material usage recording failed: ${err.message}`,
      error: err,
    };
  }
}

/**
 * Handle TRANSFER_INVENTORY intent
 * Example: "Transfer ladder from truck to warehouse"
 */
export async function handleTransferInventory(
  classification: IntentClassification,
  context: VoiceCommandContext
): Promise<VoiceCommandResult> {
  try {
    const itemNames = classification.entities
      .filter((e) => e.type === 'item_name')
      .map((e) => e.value);

    const fromLocation = classification.entities.find(
      (e) => e.type === 'from_location'
    )?.value;

    const toLocation = classification.entities.find(
      (e) => e.type === 'to_location'
    )?.value;

    if (itemNames.length === 0) {
      return {
        success: false,
        message: 'No items specified for transfer.',
      };
    }

    if (!fromLocation || !toLocation) {
      return {
        success: false,
        message: 'Source and destination locations must be specified.',
      };
    }

    const result = await transferService.transfer({
      tenantId: context.tenantId,
      userId: context.userId,
      itemIds: itemNames, // TODO: Resolve names to IDs
      fromLocationId: fromLocation,
      toLocationId: toLocation,
      jobId: context.jobId,
      voiceSessionId: context.sessionId,
    });

    if (!result.success) {
      return {
        success: false,
        message: `Transfer failed: ${result.error?.message}`,
        error: result.error,
      };
    }

    const itemCount = result.transactions.length;
    return {
      success: true,
      message: `Successfully transferred ${itemCount} item${itemCount !== 1 ? 's' : ''} from ${fromLocation} to ${toLocation}`,
      data: result,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Transfer failed: ${err.message}`,
      error: err,
    };
  }
}

/**
 * Handle SCAN_INVENTORY intent
 * Example: "Scan items in this photo"
 */
export async function handleScanInventory(
  classification: IntentClassification,
  context: VoiceCommandContext,
  imageSource?: HTMLImageElement | File | Blob | string,
  imageUrl?: string
): Promise<VoiceCommandResult> {
  try {
    if (!imageSource || !imageUrl) {
      return {
        success: false,
        message: 'No image provided for scanning. Please attach an image.',
      };
    }

    const expectedItems = classification.entities
      .filter((e) => e.type === 'item_name')
      .map((e) => e.value);

    const result = await detectionOrchestratorService.detectInventoryItems({
      tenantId: context.tenantId,
      userId: context.userId,
      imageSource,
      imageUrl,
      expectedItems,
      jobId: context.jobId,
      locationId: context.locationId,
    });

    if (result.error || !result.data) {
      return {
        success: false,
        message: `Scan failed: ${result.error?.message}`,
        error: result.error || undefined,
      };
    }

    const detectionCount = result.data.candidates.length;
    return {
      success: true,
      message: `Detected ${detectionCount} item${detectionCount !== 1 ? 's' : ''} using ${result.data.method === 'yolo' ? 'local detection' : 'cloud vision'}`,
      data: result.data,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Scan failed: ${err.message}`,
      error: err,
    };
  }
}

/**
 * Handle START_INVENTORY_AUDIT intent
 * Example: "Start inventory audit at warehouse"
 */
export async function handleStartInventoryAudit(
  classification: IntentClassification,
  context: VoiceCommandContext
): Promise<VoiceCommandResult> {
  try {
    const locationId =
      classification.entities.find((e) => e.type === 'location_id')?.value ||
      context.locationId;

    // Get items at location for audit
    const itemsResult = await auditService.getItemsForAudit(
      context.tenantId,
      locationId
    );

    if (itemsResult.error) {
      return {
        success: false,
        message: `Failed to start audit: ${itemsResult.error.message}`,
        error: itemsResult.error,
      };
    }

    return {
      success: true,
      message: `Started inventory audit${locationId ? ` at ${locationId}` : ''}. Found ${itemsResult.data.length} items to audit.`,
      data: {
        items: itemsResult.data,
        locationId,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Audit start failed: ${err.message}`,
      error: err,
    };
  }
}
