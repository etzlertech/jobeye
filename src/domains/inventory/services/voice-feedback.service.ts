/**
 * @file /src/domains/inventory/services/voice-feedback.service.ts
 * @phase 3.7
 * @domain Inventory
 * @purpose Voice feedback templates for inventory operations
 * @complexity_budget 150
 * @feature 004-voice-vision-inventory
 *
 * Voice feedback for:
 * - Successful operations
 * - Errors and validation failures
 * - Progress updates
 * - Confirmations
 */

export interface VoiceFeedback {
  text: string;
  ssml?: string;
  emotionalTone?: 'neutral' | 'positive' | 'negative' | 'urgent';
}

/**
 * Generate feedback for successful check-out
 */
export function checkOutSuccess(itemCount: number, jobId?: string): VoiceFeedback {
  const items = itemCount === 1 ? 'item' : 'items';
  const baseText = `Successfully checked out ${itemCount} ${items}`;
  const jobText = jobId ? ` for job ${jobId}` : '';

  return {
    text: `${baseText}${jobText}.`,
    ssml: `<speak><prosody rate="medium">${baseText}${jobText}.</prosody></speak>`,
    emotionalTone: 'positive',
  };
}

/**
 * Generate feedback for successful check-in
 */
export function checkInSuccess(itemCount: number): VoiceFeedback {
  const items = itemCount === 1 ? 'item' : 'items';

  return {
    text: `Successfully checked in ${itemCount} ${items}.`,
    ssml: `<speak><prosody rate="medium">Successfully checked in ${itemCount} ${items}.</prosody></speak>`,
    emotionalTone: 'positive',
  };
}

/**
 * Generate feedback for material usage recording
 */
export function materialUsageSuccess(
  quantity: number,
  materialName: string,
  jobId: string
): VoiceFeedback {
  return {
    text: `Recorded ${quantity} ${materialName} used for job ${jobId}.`,
    ssml: `<speak><prosody rate="medium">Recorded ${quantity} ${materialName} used for job ${jobId}.</prosody></speak>`,
    emotionalTone: 'positive',
  };
}

/**
 * Generate feedback for transfer success
 */
export function transferSuccess(
  itemCount: number,
  fromLocation: string,
  toLocation: string
): VoiceFeedback {
  const items = itemCount === 1 ? 'item' : 'items';

  return {
    text: `Successfully transferred ${itemCount} ${items} from ${fromLocation} to ${toLocation}.`,
    ssml: `<speak><prosody rate="medium">Successfully transferred ${itemCount} ${items} from ${fromLocation} to ${toLocation}.</prosody></speak>`,
    emotionalTone: 'positive',
  };
}

/**
 * Generate feedback for detection results
 */
export function detectionResults(
  detectionCount: number,
  method: 'yolo' | 'vlm'
): VoiceFeedback {
  const items = detectionCount === 1 ? 'item' : 'items';
  const methodText = method === 'yolo' ? 'local detection' : 'cloud vision';

  return {
    text: `Detected ${detectionCount} ${items} using ${methodText}.`,
    ssml: `<speak><prosody rate="medium">Detected ${detectionCount} ${items} using ${methodText}.</prosody></speak>`,
    emotionalTone: 'neutral',
  };
}

/**
 * Generate feedback for audit start
 */
export function auditStarted(itemCount: number, location?: string): VoiceFeedback {
  const items = itemCount === 1 ? 'item' : 'items';
  const locationText = location ? ` at ${location}` : '';

  return {
    text: `Started inventory audit${locationText}. Found ${itemCount} ${items} to audit.`,
    ssml: `<speak><prosody rate="medium">Started inventory audit${locationText}. Found ${itemCount} ${items} to audit.</prosody></speak>`,
    emotionalTone: 'neutral',
  };
}

/**
 * Generate feedback for errors
 */
export function error(message: string): VoiceFeedback {
  return {
    text: `Error: ${message}`,
    ssml: `<speak><prosody rate="slow" pitch="-10%">Error: ${message}</prosody></speak>`,
    emotionalTone: 'negative',
  };
}

/**
 * Generate feedback for validation failures
 */
export function validationError(field: string, reason: string): VoiceFeedback {
  return {
    text: `Invalid ${field}: ${reason}`,
    ssml: `<speak><prosody rate="slow">Invalid ${field}: ${reason}</prosody></speak>`,
    emotionalTone: 'negative',
  };
}

/**
 * Generate feedback for insufficient quantity
 */
export function insufficientQuantity(
  itemName: string,
  available: number,
  requested: number
): VoiceFeedback {
  return {
    text: `Insufficient quantity for ${itemName}. Available: ${available}, Requested: ${requested}.`,
    ssml: `<speak><prosody rate="medium">Insufficient quantity for ${itemName}. Available: ${available}, Requested: ${requested}.</prosody></speak>`,
    emotionalTone: 'negative',
  };
}

/**
 * Generate feedback for confirmation requests
 */
export function confirmAction(action: string, details: string): VoiceFeedback {
  return {
    text: `Please confirm: ${action} ${details}. Say yes to confirm or no to cancel.`,
    ssml: `<speak><prosody rate="medium">Please confirm: ${action} ${details}. <break time="500ms"/> Say yes to confirm or no to cancel.</prosody></speak>`,
    emotionalTone: 'neutral',
  };
}

/**
 * Generate feedback for missing required information
 */
export function missingInformation(field: string): VoiceFeedback {
  return {
    text: `Missing required information: ${field}. Please provide ${field}.`,
    ssml: `<speak><prosody rate="medium">Missing required information: ${field}. Please provide ${field}.</prosody></speak>`,
    emotionalTone: 'neutral',
  };
}

/**
 * Generate feedback for offline mode
 */
export function offlineQueued(operation: string): VoiceFeedback {
  return {
    text: `You are offline. ${operation} has been queued and will sync when connection is restored.`,
    ssml: `<speak><prosody rate="medium">You are offline. ${operation} has been queued and will sync when connection is restored.</prosody></speak>`,
    emotionalTone: 'neutral',
  };
}

/**
 * Generate feedback for VLM fallback cost warning
 */
export function vlmCostWarning(estimatedCost: number): VoiceFeedback {
  return {
    text: `Low confidence detection. Using cloud vision will cost approximately $${estimatedCost.toFixed(2)}. Say yes to proceed or no to cancel.`,
    ssml: `<speak><prosody rate="medium">Low confidence detection. Using cloud vision will cost approximately ${estimatedCost.toFixed(2)} dollars. <break time="500ms"/> Say yes to proceed or no to cancel.</prosody></speak>`,
    emotionalTone: 'neutral',
  };
}

/**
 * Generate feedback for help
 */
export function help(domain: 'inventory' | 'general'): VoiceFeedback {
  if (domain === 'inventory') {
    return {
      text: `Inventory commands: Check out items, Check in items, Record material usage, Transfer items, Scan photo, Start audit, or Process receipt.`,
      ssml: `<speak><prosody rate="medium">Inventory commands: <break time="300ms"/> Check out items, <break time="200ms"/> Check in items, <break time="200ms"/> Record material usage, <break time="200ms"/> Transfer items, <break time="200ms"/> Scan photo, <break time="200ms"/> Start audit, <break time="200ms"/> or Process receipt.</prosody></speak>`,
      emotionalTone: 'neutral',
    };
  }

  return {
    text: `I can help with inventory management, job scheduling, customer records, and equipment tracking. What would you like to do?`,
    ssml: `<speak><prosody rate="medium">I can help with inventory management, job scheduling, customer records, and equipment tracking. <break time="500ms"/> What would you like to do?</prosody></speak>`,
    emotionalTone: 'positive',
  };
}