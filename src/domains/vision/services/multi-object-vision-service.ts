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
import {
  BoundingBox,
  DetectedContainer,
  DetectedItem,
  JobLoadRequirement,
  LoadVerificationAnalysis,
  LoadVerificationStatus,
  KnownContainer,
  KnownEquipment,
  KnownMaterial,
  SceneAnalysisRequest,
} from '@/domains/vision/types/load-verification-types';

export type LoadVerification = LoadVerificationAnalysis;

export interface YOLODetection {
  class: string;
  confidence: number;
  boundingBox: BoundingBox;
  attributes?: Record<string, any>;
}

export interface HybridVisionConfig {
  useYOLO: boolean;
  yoloEndpoint?: string;
  yoloModel?: 'yolov11' | 'yolov26';
  vlmFallbackThreshold?: number;
  enableOfflineCache?: boolean;
}

export class MultiObjectVisionService {
  private logger: VoiceLogger;
  private openaiApiKey?: string;
  private geminiApiKey?: string;
  private defaultConfidenceThreshold = 0.7;
  private hybridConfig: HybridVisionConfig;
  private offlineCache: Map<string, LoadVerification> = new Map();

  constructor(
    supabase?: any,
    logger?: VoiceLogger, 
    hybridConfig?: HybridVisionConfig
  ) {
    this.logger = logger || new VoiceLogger();
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.geminiApiKey = process.env.GEMINI_API_KEY;
    this.hybridConfig = {
      useYOLO: hybridConfig?.useYOLO ?? true,
      yoloEndpoint: hybridConfig?.yoloEndpoint ?? process.env.YOLO_ENDPOINT,
      yoloModel: hybridConfig?.yoloModel ?? 'yolov11',
      vlmFallbackThreshold: hybridConfig?.vlmFallbackThreshold ?? 0.6,
      enableOfflineCache: hybridConfig?.enableOfflineCache ?? true
    };
    this.loadOfflineCache();
  }

  /**
   * Analyze a loading scene with multiple items and containers
   */
  async analyzeLoadingScene(
    mediaId: string,
    jobId: string,
    options?: { expectedItems?: any[] }
  ): Promise<LoadVerificationAnalysis> {
    // Convert to internal request format
    const request: SceneAnalysisRequest = {
      jobId,
      imageData: mediaId, // Will be fetched later if needed
      knownContainers: [],
      knownEquipment: [],
      knownMaterials: [],
      loadRequirements: options?.expectedItems?.map(item => ({
        checklistItemId: item.id,
        itemId: item.inventoryItemId ?? item.itemId ?? item.id,
        itemName: item.name,
        itemType: item.type,
        quantity: item.quantity || 1,
        containerId: item.expectedContainer,
        containerName: ''
      })) || []
    };

    return this.analyzeLoadingSceneInternal(request);
  }

  private async analyzeLoadingSceneInternal(request: SceneAnalysisRequest): Promise<LoadVerification> {
    const startTime = Date.now();
    
    try {
      // Check offline cache first
      if (this.hybridConfig.enableOfflineCache && !navigator.onLine) {
        const cached = this.getCachedResult(request.jobId);
        if (cached) return cached;
      }

      let containers: DetectedContainer[] = [];
      let items: DetectedItem[] = [];
      let provider = 'hybrid';
      let modelId = '';
      let tokensUsed = 0;
      let costUsd = 0;

      if (this.hybridConfig.useYOLO && this.hybridConfig.yoloEndpoint) {
        // Try YOLO first for fast local detection
        try {
          const yoloResult = await this.runYOLODetection(request.imageData);
          const parsed = this.parseYOLOResults(yoloResult);
          containers = parsed.containers;
          items = parsed.items;
          provider = 'yolo';
          modelId = this.hybridConfig.yoloModel || 'yolov11';

          // If confidence is low, enhance with VLM
          const avgConfidence = this.calculateAverageConfidence(items);
          if (avgConfidence < this.hybridConfig.vlmFallbackThreshold!) {
            const vlmResult = await this.enhanceWithVLM(request, yoloResult);
            containers = vlmResult.containers;
            items = vlmResult.items;
            provider = 'hybrid-yolo-vlm';
            modelId = `${this.hybridConfig.yoloModel}-${vlmResult.modelId}`;
            tokensUsed = vlmResult.tokensUsed || 0;
            costUsd = vlmResult.costUsd || 0;
          }
        } catch (yoloError) {
          await this.logger.warn('YOLO detection failed, falling back to VLM', {
            error: (yoloError as Error).message
          });
        }
      }

      // If YOLO not used or failed, use VLM
      if (containers.length === 0 && items.length === 0) {
        // Generate optimized prompt
        const prompt = this.generateVLMPrompt(request);
        
        // Call VLM (prefer Gemini for multi-object)
        const visionResult = await this.callVisionModel(
          request.imageData,
          prompt,
          this.geminiApiKey ? 'gemini' : 'openai'
        );
        
        // Parse VLM response
        const parsed = this.parseVisionResponse(visionResult);
        containers = parsed.containers;
        items = parsed.items;
        provider = visionResult.provider;
        modelId = visionResult.modelId;
        tokensUsed = visionResult.tokensUsed || 0;
        costUsd = visionResult.costUsd || 0;
      }
      
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
        provider,
        modelId: modelId,
        processingTimeMs: Date.now() - startTime,
        costUsd,
        tokensUsed
      };
      
      // Cache result for offline use
      if (this.hybridConfig.enableOfflineCache) {
        this.cacheResult(request.jobId, result);
      }
      
      // Log analysis
      await this.logger.info('Load verification completed', {
        jobId: request.jobId,
        containersDetected: matchedContainers.length,
        itemsDetected: itemsWithContainers.length,
        verifiedCount: verification.verifiedItems.length,
        missingCount: verification.missingItems.length,
        processingTimeMs: result.processingTimeMs,
        provider,
        modelId
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
    known: KnownContainer[]
  ): DetectedContainer[] {
    return detected.map(det => {
      // Try to match by identifier
      if (det.identifier) {
        const match = known.find(k => 
          k.identifier?.toLowerCase() === det.identifier?.toLowerCase()
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
    equipment: KnownEquipment[],
    materials: KnownMaterial[]
  ): DetectedItem[] {
    return detected.map(det => {
      const nameLower = det.itemName.toLowerCase();
      
      // Try equipment match
      if (det.itemType === 'equipment' || nameLower.includes('mower') || 
          nameLower.includes('chainsaw') || nameLower.includes('trimmer')) {
        const match = equipment.find(e => {
          const equipNameLower = e.name.toLowerCase();
          const modelLower = e.model?.toLowerCase();
          return equipNameLower.includes(nameLower) || 
                 nameLower.includes(equipNameLower) ||
                 (modelLower && nameLower.includes(modelLower));
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
        
        let status: LoadVerificationStatus = 'verified';
        
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

  /**
   * Run YOLO detection locally
   */
  private async runYOLODetection(imageData: string | Buffer): Promise<YOLODetection[]> {
    if (!this.hybridConfig.yoloEndpoint) {
      throw new Error('YOLO endpoint not configured');
    }

    const base64Image = Buffer.isBuffer(imageData) 
      ? imageData.toString('base64')
      : imageData;

    try {
      const response = await fetch(this.hybridConfig.yoloEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Image,
          model: this.hybridConfig.yoloModel,
          conf_threshold: 0.5,
          iou_threshold: 0.45,
          max_detections: 100
        })
      });

      if (!response.ok) {
        throw new Error(`YOLO detection failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      await this.logger.error('YOLO detection error', error as Error);
      throw error;
    }
  }

  /**
   * Parse YOLO detection results
   */
  private parseYOLOResults(yoloDetections: YOLODetection[]): {
    containers: DetectedContainer[];
    items: DetectedItem[];
  } {
    const containers: DetectedContainer[] = [];
    const items: DetectedItem[] = [];

    for (const detection of yoloDetections) {
      // Map YOLO classes to our domain
      if (this.isContainerClass(detection.class)) {
        containers.push({
          containerType: this.mapToContainerType(detection.class),
          confidence: detection.confidence,
          boundingBox: detection.boundingBox,
          attributes: detection.attributes
        });
      } else if (this.isEquipmentClass(detection.class)) {
        items.push({
          itemType: 'equipment',
          itemName: this.mapToItemName(detection.class),
          confidence: detection.confidence,
          boundingBox: detection.boundingBox,
          attributes: detection.attributes
        });
      } else if (this.isMaterialClass(detection.class)) {
        items.push({
          itemType: 'material',
          itemName: this.mapToItemName(detection.class),
          confidence: detection.confidence,
          boundingBox: detection.boundingBox,
          attributes: detection.attributes
        });
      }
    }

    return { containers, items };
  }

  /**
   * Enhance YOLO results with VLM for better understanding
   */
  private async enhanceWithVLM(
    request: SceneAnalysisRequest,
    yoloResults: YOLODetection[]
  ): Promise<any> {
    const enhancedPrompt = this.generateEnhancedVLMPrompt(request, yoloResults);
    
    const visionResult = await this.callVisionModel(
      request.imageData,
      enhancedPrompt,
      this.geminiApiKey ? 'gemini' : 'openai'
    );

    return this.parseVisionResponse(visionResult);
  }

  /**
   * Generate enhanced prompt using YOLO detections
   */
  private generateEnhancedVLMPrompt(
    request: SceneAnalysisRequest,
    yoloResults: YOLODetection[]
  ): string {
    const detectedObjects = yoloResults
      .map(d => `- ${d.class} (confidence: ${d.confidence.toFixed(2)})`)
      .join('\n');

    return `I have already detected these objects using YOLO:
${detectedObjects}

Please enhance this analysis by:
1. Identifying which specific equipment/material each detection represents (e.g., "lawn_mower" -> "Honda HRX217 Push Mower")
2. Determining which container each item is in or near
3. Identifying any items that YOLO might have missed
4. Providing color and identifier information for containers

${this.generateVLMPrompt(request)}`;
  }

  /**
   * Calculate average confidence of detections
   */
  private calculateAverageConfidence(items: DetectedItem[]): number {
    if (items.length === 0) return 0;
    const sum = items.reduce((acc, item) => acc + item.confidence, 0);
    return sum / items.length;
  }

  /**
   * YOLO class mapping helpers
   */
  private isContainerClass(className: string): boolean {
    const containerClasses = ['truck', 'van', 'trailer', 'pickup', 'vehicle', 'bin', 'container'];
    return containerClasses.some(c => className.toLowerCase().includes(c));
  }

  private isEquipmentClass(className: string): boolean {
    const equipmentClasses = ['mower', 'chainsaw', 'trimmer', 'blower', 'edger', 'spreader', 'sprayer'];
    return equipmentClasses.some(c => className.toLowerCase().includes(c));
  }

  private isMaterialClass(className: string): boolean {
    const materialClasses = ['can', 'bottle', 'pipe', 'fitting', 'bag', 'box', 'bucket'];
    return materialClasses.some(c => className.toLowerCase().includes(c));
  }

  private mapToContainerType(className: string): DetectedContainer['containerType'] {
    const lower = className.toLowerCase();
    if (lower.includes('truck') || lower.includes('pickup')) return 'truck';
    if (lower.includes('van')) return 'van';
    if (lower.includes('trailer')) return 'trailer';
    if (lower.includes('bin') || lower.includes('container')) return 'storage_bin';
    return 'ground';
  }

  private mapToItemName(className: string): string {
    // Map YOLO class names to user-friendly names
    const mappings: Record<string, string> = {
      'lawn_mower': 'Push Mower',
      'riding_mower': 'Riding Mower',
      'chainsaw': 'Chainsaw',
      'string_trimmer': 'String Trimmer',
      'leaf_blower': 'Leaf Blower',
      'gas_can': 'Gas Can',
      'herbicide_bottle': 'Herbicide',
      'pvc_pipe': 'PVC Pipe',
      'tool_box': 'Tool Box'
    };

    return mappings[className.toLowerCase()] || className;
  }

  /**
   * Offline cache management
   */
  private loadOfflineCache() {
    if (typeof localStorage === 'undefined') return;

    try {
      const cached = localStorage.getItem('vision-offline-cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        Object.entries(parsed).forEach(([key, value]) => {
          this.offlineCache.set(key, value as LoadVerification);
        });
      }
    } catch (error) {
      console.error('Failed to load offline cache:', error);
    }
  }

  private saveOfflineCache() {
    if (typeof localStorage === 'undefined') return;

    try {
      const cacheObj: Record<string, LoadVerification> = {};
      this.offlineCache.forEach((value, key) => {
        cacheObj[key] = value;
      });
      localStorage.setItem('vision-offline-cache', JSON.stringify(cacheObj));
    } catch (error) {
      console.error('Failed to save offline cache:', error);
    }
  }

  private getCachedResult(jobId: string): LoadVerification | null {
    return this.offlineCache.get(jobId) || null;
  }

  private cacheResult(jobId: string, result: LoadVerification) {
    // Keep cache size limited
    if (this.offlineCache.size > 50) {
      const firstKey = this.offlineCache.keys().next().value;
      if (typeof firstKey === 'string') {
        this.offlineCache.delete(firstKey);
      }
    }

    this.offlineCache.set(jobId, result);
    this.saveOfflineCache();
  }
}
