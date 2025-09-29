export type LoadVerificationStatus = 'verified' | 'wrong_container' | 'low_confidence';

export interface KnownContainer {
  id: string;
  name: string;
  containerType: string;
  identifier?: string;
  color?: string | null;
  metadata?: Record<string, any> | null;
}

export interface KnownEquipment {
  id: string;
  name: string;
  model?: string | null;
  voiceIdentifier?: string | null;
  metadata?: Record<string, any> | null;
}

export interface KnownMaterial {
  id: string;
  name: string;
  sku?: string | null;
  category?: string | null;
  metadata?: Record<string, any> | null;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedContainer {
  containerId?: string;
  containerType: string;
  color?: string;
  identifier?: string;
  confidence: number;
  boundingBox?: BoundingBox;
  attributes?: Record<string, any>;
}

export interface DetectedItem {
  itemType: 'equipment' | 'material';
  itemId?: string;
  itemName: string;
  confidence: number;
  boundingBox?: BoundingBox;
  containerId?: string;
  attributes?: Record<string, any>;
}

export interface JobLoadRequirement {
  checklistItemId: string;
  itemType: 'equipment' | 'material';
  itemId: string;
  itemName: string;
  quantity: number;
  containerId?: string;
  containerName?: string;
}

export interface SceneAnalysisRequest {
  imageData: string | Buffer;
  jobId: string;
  loadRequirements: JobLoadRequirement[];
  knownContainers: KnownContainer[];
  knownEquipment?: KnownEquipment[];
  knownMaterials?: KnownMaterial[];
  confidenceThreshold?: number;
}

export interface LoadVerificationAnalysis {
  id: string;
  jobId: string;
  timestamp: Date;
  containers: DetectedContainer[];
  items: DetectedItem[];
  verifiedItems: Array<{
    checklistItemId: string;
    detectedItem: DetectedItem;
    status: LoadVerificationStatus;
    confidence: number;
  }>;
  missingItems: Array<{
    checklistItemId: string;
    itemName: string;
    expectedContainer?: string;
  }>;
  unexpectedItems: DetectedItem[];
  provider: string;
  modelId: string;
  processingTimeMs: number;
  tokensUsed?: number;
  costUsd?: number;
}

export interface LoadVerificationRecord {
  id: string;
  jobId: string;
  mediaId: string | null;
  provider: string;
  modelId: string;
  detectedContainers: DetectedContainer[];
  detectedItems: DetectedItem[];
  verifiedChecklistItemIds: string[];
  missingChecklistItemIds: string[];
  unexpectedItems: DetectedItem[];
  tokensUsed?: number | null;
  costUsd?: number | null;
  processingTimeMs?: number | null;
  createdAt: string;
}

export interface LoadVerificationPersistencePayload {
  jobId: string;
  mediaId: string | null;
  provider: string;
  modelId: string;
  detectedContainers: DetectedContainer[];
  detectedItems: DetectedItem[];
  verifiedChecklistItemIds: string[];
  missingChecklistItemIds: string[];
  unexpectedItems: DetectedItem[];
  tokensUsed?: number;
  costUsd?: number;
  processingTimeMs?: number;
}
