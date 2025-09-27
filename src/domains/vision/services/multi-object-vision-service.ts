// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/vision/services/multi-object-vision-service.ts
// phase: 4
// domain: job-execution
// purpose: Multi-object detection for load verification with container awareness
// spec_ref: phase4/vision#multi-object-detection
// version: 2025-08-1
// complexity_budget: 500 LoC
// offline_capability: OPTIONAL
// 
// dependencies:
//   internal:
//     - /src/domains/vision/types/vision-types
//     - /src/domains/equipment/types/container-types
//     - /src/domains/equipment/types/equipment-types
//     - /src/domains/material/types/material-types
//     - /src/core/logger/voice-logger
//   external:
//     - openai: ^4.0.0
//
// exports:
//   - MultiObjectVisionService: class - Multi-object detection service
//   - analyzeLoadingScene: function - Analyze scene with items and containers
//   - processJobLoadVerification: function - Verify items against job requirements
//   - generateVLMPrompt: function - Create optimized prompts for VLMs
//
// estimated_llm_cost:
//   tokens_per_operation: 3000
//   operations_per_day: 1000
//   monthly_cost_usd: 90.00
//
// voice_considerations: |
//   Voice confirmation of detected items.
//   Natural language feedback for loading status.
//   Voice alerts for misplaced items.
//
// test_requirements:
//   coverage: 85%
//   test_files:
//     - src/__tests__/domains/vision/services/multi-object-vision-service.test.ts
//
// tasks:
//   1. Implement VLM integration for scene analysis
//   2. Create container detection logic
//   3. Build item-to-container matching
//   4. Add job requirement validation
//   5. Implement confidence scoring
//   6. Create result aggregation
// --- END DIRECTIVE BLOCK ---

import { VoiceLogger } from '@/core/logger/voice-logger';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';
import { Container } from '@/domains/equipment/types/container-types';
import { Equipment } from '@/domains/equipment/types/equipment-types';
import { Material } from '@/domains/material/types/material-types';

// Multi-object detection types
export interface DetectedContainer {
  containerId?: string; // Matched to known container
  containerType: string;
  color?: string;
  identifier?: string;
  confidence: number;
  boundingBox?: BoundingBox;
  attributes?: Record<string, any>;
}

export interface DetectedItem {
  itemType: 'equipment' | 'material';
  itemId?: string; // Matched to inventory
  itemName: string;
  confidence: number;
  boundingBox?: BoundingBox;
  containerId?: string; // Which container it's in
  attributes?: Record<string, any>;
}

export interface BoundingBox {
  x: number; // 0-1 normalized
  y: number; // 0-1 normalized
  width: number; // 0-1 normalized  
  height: number; // 0-1 normalized
}

export interface LoadVerification {
  id: string;
  jobId: string;
  timestamp: Date;
  
  // Detected elements
  containers: DetectedContainer[];
  items: DetectedItem[];
  
  // Verification results
  verifiedItems: Array<{
    checklistItemId: string;
    detectedItem: DetectedItem;
    status: 'verified' | 'wrong_container' | 'low_confidence';
    confidence: number;
  }>;
  
  missingItems: Array<{
    checklistItemId: string;
    itemName: string;
    expectedContainer?: string;
  }>;
  
  unexpectedItems: DetectedItem[];
  
  // Analysis metadata
  provider: string;
  modelId: string;
  processingTimeMs: number;
  tokensUsed?: number;
  costUsd?: number;
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
  imageData: string | Buffer; // Base64 or buffer
  jobId: string;
  loadRequirements: JobLoadRequirement[];
  knownContainers: Container[];
  knownEquipment?: Equipment[];
  knownMaterials?: Material[];
  confidenceThreshold?: number; // Default 0.7
}

export class MultiObjectVisionService {
  private logger: VoiceLogger;
  private openaiApiKey?: string;
  private geminiApiKey?: string;
  private defaultConfidenceThreshold = 0.7;

  constructor(logger?: VoiceLogger) {
    this.logger = logger || new VoiceLogger();
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.geminiApiKey = process.env.GEMINI_API_KEY;
  }

  /**
   * Analyze a loading scene with multiple items and containers
   */
  async analyzeLoadingScene(request: SceneAnalysisRequest): Promise<LoadVerification> {
    const startTime = Date.now();
    
    try {
      // Generate optimized prompt
      const prompt = this.generateVLMPrompt(request);
      
      // Call VLM (prefer Gemini for multi-object)
      const visionResult = await this.callVisionModel(
        request.imageData,
        prompt,
        this.geminiApiKey ? 'gemini' : 'openai'
      );
      
      // Parse VLM response
      const { containers, items } = this.parseVisionResponse(visionResult);
      
      // Match detected containers to known containers
      const matchedContainers = this.matchContainers(containers, request.knownContainers);
      
      // Match detected items to inventory
      const matchedItems = this.matchItems(
        items,
        request.knownEquipment || [],
        request.knownMaterials || []
      );
      
      // Associate items with containers
      const itemsWithContainers = this.associateItemsToContainers(
        matchedItems,
        matchedContainers
      );
      
      // Verify against job requirements
      const verification = this.verifyAgainstRequirements(
        itemsWithContainers,
        request.loadRequirements,
        request.confidenceThreshold || this.defaultConfidenceThreshold
      );
      
      const result: LoadVerification = {
        id: this.generateId(),
        jobId: request.jobId,
        timestamp: new Date(),
        containers: matchedContainers,
        items: itemsWithContainers,
        ...verification,
        provider: visionResult.provider,
        modelId: visionResult.modelId,
        processingTimeMs: Date.now() - startTime,
        tokensUsed: visionResult.tokensUsed,
        costUsd: visionResult.costUsd,
      };
      
      // Log analysis
      await this.logger.info('Load verification completed', {
        jobId: request.jobId,
        containersDetected: matchedContainers.length,
        itemsDetected: itemsWithContainers.length,
        verifiedCount: verification.verifiedItems.length,
        missingCount: verification.missingItems.length,
        processingTimeMs: result.processingTimeMs,
      });
      
      return result;
    } catch (error) {
      await this.logger.error('Failed to analyze loading scene', error as Error);
      throw createAppError({
        code: 'VISION_ANALYSIS_FAILED',
        message: 'Failed to analyze loading scene',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.EXTERNAL_SERVICE,
        originalError: error as Error,
      });
    }
  }

  /**
   * Generate optimized VLM prompt
   */
  private generateVLMPrompt(request: SceneAnalysisRequest): string {
    const containerList = request.knownContainers
      .map(c => `- ${c.name} (${c.identifier}): ${c.containerType}, ${c.color || 'unknown color'}`)
      .join('\n');
      
    const itemList = request.loadRequirements
      .map(r => `- ${r.quantity}x ${r.itemName}${r.containerName ? ` (should be in ${r.containerName})` : ''}`)
      .join('\n');

    return `Analyze this image of equipment/materials being loaded.

KNOWN CONTAINERS/VEHICLES:
${containerList}

EXPECTED ITEMS TO BE LOADED:
${itemList}

For this scene, identify:

1. ALL CONTAINERS/VEHICLES visible (match to known containers above if possible):
   - Type (truck, trailer, van, storage bin)
   - Color
   - Any visible identifiers/numbers
   - Position in image

2. ALL EQUIPMENT/MATERIALS visible:
   - What each item is (be specific: chainsaw, mower, PVC pipe, etc.)
   - Which container/vehicle it's in or near
   - Quantity if multiple similar items
   - Any visible labels or model numbers

3. SPATIAL RELATIONSHIPS:
   - Which items are INSIDE or ON each container
   - Which items are on the ground or elsewhere
   - Items that appear to be in the wrong container

Return a structured JSON response with this exact format:
{
  "containers": [
    {
      "type": "truck" | "trailer" | "van" | "storage_bin" | "ground",
      "color": "color name",
      "identifier": "visible text/number if any",
      "confidence": 0.0-1.0,
      "boundingBox": { "x": 0.0-1.0, "y": 0.0-1.0, "width": 0.0-1.0, "height": 0.0-1.0 }
    }
  ],
  "items": [
    {
      "name": "item description",
      "type": "equipment" | "material",
      "containerId": "index of container it's in (0-based) or null if on ground",
      "confidence": 0.0-1.0,
      "quantity": 1,
      "boundingBox": { "x": 0.0-1.0, "y": 0.0-1.0, "width": 0.0-1.0, "height": 0.0-1.0 },
      "attributes": { "color": "if visible", "brand": "if visible", "model": "if visible" }
    }
  ],
  "summary": "Brief description of the loading operation"
}`;
  }

  /**
   * Call vision model (Gemini or OpenAI)
   */
  private async callVisionModel(
    imageData: string | Buffer,
    prompt: string,
    provider: 'gemini' | 'openai'
  ): Promise<any> {
    // Convert Buffer to base64 if needed
    const base64Image = Buffer.isBuffer(imageData) 
      ? imageData.toString('base64')
      : imageData;

    if (provider === 'gemini' && this.geminiApiKey) {
      // Gemini Vision API call would go here
      throw new Error('Gemini Vision integration not yet implemented');
    }
    
    if (provider === 'openai' && this.openaiApiKey) {
      const { OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: this.openaiApiKey });
      
      const response = await openai.chat.completions.create({
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { 
                type: 'image_url', 
                image_url: { 
                  url: `data:image/jpeg;base64,${base64Image}` 
                } 
              },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0.1,
      });
      
      const content = response.choices[0].message.content;
      const parsed = JSON.parse(content || '{}');
      
      return {
        ...parsed,
        provider: 'openai',
        modelId: 'gpt-4-vision-preview',
        tokensUsed: response.usage?.total_tokens,
        costUsd: (response.usage?.total_tokens || 0) * 0.00003, // Rough estimate
      };
    }
    
    // Fallback mock for development
    return this.mockVisionResponse();
  }

  /**
   * Parse vision model response
   */
  private parseVisionResponse(response: any): {
    containers: DetectedContainer[];
    items: DetectedItem[];
  } {
    const containers: DetectedContainer[] = (response.containers || []).map((c: any) => ({
      containerType: c.type,
      color: c.color,
      identifier: c.identifier,
      confidence: c.confidence || 0.8,
      boundingBox: c.boundingBox,
      attributes: c.attributes || {},
    }));
    
    const items: DetectedItem[] = (response.items || []).map((item: any) => ({
      itemType: item.type as 'equipment' | 'material',
      itemName: item.name,
      confidence: item.confidence || 0.8,
      boundingBox: item.boundingBox,
      containerId: item.containerId?.toString(),
      attributes: item.attributes || {},
    }));
    
    return { containers, items };
  }

  /**
   * Match detected containers to known containers
   */
  private matchContainers(
    detected: DetectedContainer[],
    known: Container[]
  ): DetectedContainer[] {
    return detected.map(det => {
      // Try to match by identifier
      if (det.identifier) {
        const match = known.find(k => 
          k.identifier.toLowerCase() === det.identifier?.toLowerCase()
        );
        if (match) {
          return { ...det, containerId: match.id };
        }
      }
      
      // Try to match by color and type
      if (det.color && det.containerType) {
        const match = known.find(k =>
          k.color?.toLowerCase() === det.color?.toLowerCase() &&
          k.containerType === det.containerType
        );
        if (match) {
          return { ...det, containerId: match.id };
        }
      }
      
      return det;
    });
  }

  /**
   * Match detected items to inventory
   */
  private matchItems(
    detected: DetectedItem[],
    equipment: Equipment[],
    materials: Material[]
  ): DetectedItem[] {
    return detected.map(det => {
      const nameLower = det.itemName.toLowerCase();
      
      // Try equipment match
      if (det.itemType === 'equipment' || nameLower.includes('mower') || 
          nameLower.includes('chainsaw') || nameLower.includes('trimmer')) {
        const match = equipment.find(e => {
          const equipNameLower = e.name.toLowerCase();
          return equipNameLower.includes(nameLower) || 
                 nameLower.includes(equipNameLower) ||
                 (e.model && nameLower.includes(e.model.toLowerCase()));
        });
        
        if (match) {
          return {
            ...det,
            itemType: 'equipment',
            itemId: match.id,
          };
        }
      }
      
      // Try material match
      if (det.itemType === 'material' || nameLower.includes('pipe') || 
          nameLower.includes('fitting') || nameLower.includes('can')) {
        const match = materials.find(m => {
          const matNameLower = m.name.toLowerCase();
          return matNameLower.includes(nameLower) || 
                 nameLower.includes(matNameLower);
        });
        
        if (match) {
          return {
            ...det,
            itemType: 'material',
            itemId: match.id,
          };
        }
      }
      
      return det;
    });
  }

  /**
   * Associate items to their containers based on spatial relationships
   */
  private associateItemsToContainers(
    items: DetectedItem[],
    containers: DetectedContainer[]
  ): DetectedItem[] {
    return items.map(item => {
      // If already has container ID from vision model, map it
      if (item.containerId !== undefined && item.containerId !== null) {
        const containerIndex = parseInt(item.containerId);
        if (containerIndex >= 0 && containerIndex < containers.length) {
          const container = containers[containerIndex];
          return {
            ...item,
            containerId: container.containerId || `detected-${containerIndex}`,
          };
        }
      }
      
      // If no bounding box, can't determine spatially
      if (!item.boundingBox || containers.length === 0) {
        return { ...item, containerId: undefined };
      }
      
      // Find container with best overlap
      let bestContainer: DetectedContainer | null = null;
      let bestOverlap = 0;
      
      for (const container of containers) {
        if (!container.boundingBox) continue;
        
        const overlap = this.calculateOverlap(item.boundingBox, container.boundingBox);
        if (overlap > bestOverlap && overlap > 0.3) { // 30% minimum overlap
          bestOverlap = overlap;
          bestContainer = container;
        }
      }
      
      if (bestContainer) {
        return {
          ...item,
          containerId: bestContainer.containerId || `detected-${containers.indexOf(bestContainer)}`,
        };
      }
      
      return { ...item, containerId: undefined };
    });
  }

  /**
   * Verify detected items against job requirements
   */
  private verifyAgainstRequirements(
    detectedItems: DetectedItem[],
    requirements: JobLoadRequirement[],
    confidenceThreshold: number
  ): {
    verifiedItems: LoadVerification['verifiedItems'];
    missingItems: LoadVerification['missingItems'];
    unexpectedItems: LoadVerification['unexpectedItems'];
  } {
    const verifiedItems: LoadVerification['verifiedItems'] = [];
    const missingItems: LoadVerification['missingItems'] = [];
    const matchedItemIds = new Set<string>();
    
    // Check each requirement
    for (const req of requirements) {
      const matches = detectedItems.filter(item => {
        // Match by ID if available
        if (req.itemId && item.itemId) {
          return item.itemId === req.itemId;
        }
        
        // Match by name similarity
        const nameSimilarity = this.calculateNameSimilarity(
          item.itemName.toLowerCase(),
          req.itemName.toLowerCase()
        );
        return nameSimilarity > 0.7;
      });
      
      if (matches.length === 0) {
        // Item not found
        missingItems.push({
          checklistItemId: req.checklistItemId,
          itemName: req.itemName,
          expectedContainer: req.containerName,
        });
      } else {
        // Check best match
        const bestMatch = matches.reduce((best, current) => 
          current.confidence > best.confidence ? current : best
        );
        
        let status: 'verified' | 'wrong_container' | 'low_confidence' = 'verified';
        
        // Check confidence
        if (bestMatch.confidence < confidenceThreshold) {
          status = 'low_confidence';
        }
        
        // Check container if specified
        if (req.containerId && bestMatch.containerId !== req.containerId) {
          status = 'wrong_container';
        }
        
        verifiedItems.push({
          checklistItemId: req.checklistItemId,
          detectedItem: bestMatch,
          status,
          confidence: bestMatch.confidence,
        });
        
        matchedItemIds.add(bestMatch.itemName);
      }
    }
    
    // Find unexpected items
    const unexpectedItems = detectedItems.filter(item => 
      !matchedItemIds.has(item.itemName)
    );
    
    return { verifiedItems, missingItems, unexpectedItems };
  }

  /**
   * Calculate overlap between two bounding boxes
   */
  private calculateOverlap(box1: BoundingBox, box2: BoundingBox): number {
    const x1 = Math.max(box1.x, box2.x);
    const y1 = Math.max(box1.y, box2.y);
    const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
    const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);
    
    if (x2 < x1 || y2 < y1) return 0;
    
    const intersection = (x2 - x1) * (y2 - y1);
    const box1Area = box1.width * box1.height;
    
    return intersection / box1Area;
  }

  /**
   * Calculate name similarity
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    // Simple word overlap for now
    const words1 = name1.split(/\s+/);
    const words2 = name2.split(/\s+/);
    
    let matches = 0;
    for (const word1 of words1) {
      if (words2.some(word2 => 
        word2.includes(word1) || word1.includes(word2)
      )) {
        matches++;
      }
    }
    
    return matches / Math.max(words1.length, words2.length);
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `load_verification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Mock vision response for testing
   */
  private mockVisionResponse(): any {
    return {
      containers: [
        {
          type: 'truck',
          color: 'red',
          identifier: 'VH-TKR',
          confidence: 0.95,
          boundingBox: { x: 0.1, y: 0.2, width: 0.6, height: 0.5 },
        },
      ],
      items: [
        {
          name: 'Stihl Chainsaw',
          type: 'equipment',
          containerId: '0',
          confidence: 0.88,
          quantity: 2,
          boundingBox: { x: 0.3, y: 0.4, width: 0.1, height: 0.05 },
          attributes: { brand: 'Stihl', color: 'orange' },
        },
        {
          name: 'Push Mower',
          type: 'equipment',
          containerId: '0',
          confidence: 0.92,
          quantity: 1,
          boundingBox: { x: 0.5, y: 0.45, width: 0.15, height: 0.1 },
        },
        {
          name: 'Gas Can',
          type: 'material',
          containerId: '0',
          confidence: 0.85,
          quantity: 3,
          boundingBox: { x: 0.2, y: 0.35, width: 0.08, height: 0.08 },
          attributes: { color: 'red' },
        },
      ],
      summary: 'Equipment loaded in red truck for lawn care job',
      provider: 'mock',
      modelId: 'mock-vision-v1',
      tokensUsed: 0,
      costUsd: 0,
    };
  }
}