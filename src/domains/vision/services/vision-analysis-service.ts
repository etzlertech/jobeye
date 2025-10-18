// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/vision/services/vision-analysis-service.ts
// phase: 3
// domain: vision-pipeline
// purpose: Visual analysis service for loading operations and inventory management
// spec_ref: phase3/vision-pipeline#analysis-service
// version: 2025-08-1
// complexity_budget: 500 LoC
// offline_capability: OPTIONAL
//
// dependencies:
//   internal:
//     - /src/domains/vision/types/vision-types
//     - /src/domains/vision/types/vision-context-types
//     - /src/domains/equipment/types/equipment-types
//     - /src/domains/material/types/material-types
//     - /src/core/logger/voice-logger
//   external:
//     - openai: ^4.0.0
//
// exports:
//   - VisionAnalysisService: class - Main vision analysis service
//   - analyzeLoadingOperation: function - Analyze loading context
//   - validateJobLoading: function - Validate against job requirements
//   - detectStorageLocations: function - Identify vehicles/storage
//
// voice_considerations: |
//   Voice narration of analysis results.
//   Voice confirmation of item placements.
//   Natural language alerts for issues.
//
// test_requirements:
//   coverage: 85%
//   test_files:
//     - src/__tests__/domains/vision/services/vision-analysis-service.test.ts
//
// tasks:
//   1. Implement vision API integration
//   2. Create scene analysis logic
//   3. Add vehicle/location detection
//   4. Implement item-location matching
//   5. Create job validation logic
//   6. Add alert generation
// --- END DIRECTIVE BLOCK ---

import { VoiceLogger } from '@/core/logger/voice-logger';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';
import {
  VisionResult,
  VisionProvider,
  DetectedObject,
  ObjectClass,
  VisionScanRequest,
  DEFAULT_OBJECT_MAPPINGS,
} from '../types/vision-types';
import {
  VisionContext,
  StorageLocation,
  LocationType,
  LocationColor,
  ItemPlacement,
  LoadingContext,
  LoadRequirement,
  LoadingValidation,
  isItemInLocation,
  analyzePlacementQuality,
} from '../types/vision-context-types';

// Known vehicle/trailer mappings
const KNOWN_VEHICLES: Record<string, { type: LocationType; color: LocationColor; name: string }> = {
  'VH-TKR': { type: LocationType.TRUCK_BED, color: LocationColor.RED, name: 'Red Truck' },
  'VH-VN1': { type: LocationType.VAN_CARGO, color: LocationColor.WHITE, name: 'Van #1' },
  'TR-DU12R': { type: LocationType.TRAILER_DUMP, color: LocationColor.RED, name: 'Red Dump Trailer' },
  'TR-LB16A': { type: LocationType.TRAILER_LOWBOY, color: LocationColor.BLACK, name: 'Black Lowboy Trailer' },
};

export class VisionAnalysisService {
  private logger: VoiceLogger;
  private openaiApiKey?: string;
  private provider: VisionProvider;

  constructor(logger?: VoiceLogger) {
    this.logger = logger || new VoiceLogger();
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.provider = this.openaiApiKey ? VisionProvider.OPENAI_VISION : VisionProvider.OFFLINE_MODEL;
  }

  /**
   * Analyze a complete loading operation
   */
  async analyzeLoadingOperation(
    imageData: string | ArrayBuffer | Blob,
    jobId?: string,
    loadRequirements?: LoadRequirement[]
  ): Promise<VisionContext> {
    const startTime = Date.now();

    try {
      // Step 1: Basic object detection
      const detectionResult = await this.detectObjects(imageData);
      
      // Step 2: Detect storage locations (vehicles, trailers, bins)
      const locations = await this.detectStorageLocations(imageData, detectionResult);
      
      // Step 3: Analyze item placements
      const placements = this.analyzeItemPlacements(detectionResult.detectedObjects, locations);
      
      // Step 4: Determine loading context
      const context = this.determineLoadingContext(locations, detectionResult);
      
      // Step 5: Validate against job requirements if provided
      const requirementMatches = loadRequirements ? 
        await this.matchRequirements(placements, loadRequirements) : undefined;
      
      // Step 6: Generate alerts
      const alerts = this.generateAlerts(placements, requirementMatches, loadRequirements);
      
      // Create complete context
      const visionContext: VisionContext = {
        id: this.generateId(),
        tenantId: 'current-tenant', // TODO: Get from context
        jobId,
        imageUrl: typeof imageData === 'string' ? imageData : undefined,
        locations,
        items: detectionResult.detectedObjects,
        placements,
        context,
        loadRequirements,
        requirementMatches,
        alerts,
        analysisTimeMs: Date.now() - startTime,
        modelVersion: '1.0.0',
        confidence: {
          overall: this.calculateOverallConfidence(detectionResult, locations, placements),
          locationDetection: this.averageConfidence(locations),
          itemDetection: this.averageConfidence(detectionResult.detectedObjects),
          placementAnalysis: this.averageConfidence(placements),
        },
      };

      // Log the analysis
      await this.logger.info('Loading operation analyzed', {
        jobId,
        locationCount: locations.length,
        itemCount: detectionResult.detectedObjects.length,
        alertCount: alerts?.length ?? 0,
        analysisTimeMs: visionContext.analysisTimeMs,
      });

      return visionContext;
    } catch (error) {
      throw createAppError({
        code: 'VISION_ANALYSIS_FAILED',
        message: 'Failed to analyze loading operation',
        severity: ErrorSeverity.HIGH,
        category: ErrorCategory.BUSINESS_LOGIC,
        originalError: error as Error,
      });
    }
  }

  /**
   * Validate loading against job requirements
   */
  async validateJobLoading(
    visionContext: VisionContext,
    strictMode: boolean = false
  ): Promise<LoadingValidation> {
    if (!visionContext.jobId || !visionContext.loadRequirements) {
      throw new Error('Job ID and load requirements required for validation');
    }

    const issues: LoadingValidation['issues'] = [];
    let fulfilledCount = 0;
    let totalRequired = 0;

    // Check each requirement
    for (const match of visionContext.requirementMatches || []) {
      if (match.requirement.isRequired) {
        totalRequired++;
        if (match.status === 'fulfilled') {
          fulfilledCount++;
        } else if (match.status === 'missing') {
          issues.push({
            type: 'missing_item',
            description: `Missing required item: ${match.requirement.itemName}`,
            severity: 'high',
            suggestedAction: `Load ${match.requirement.quantity} ${match.requirement.itemName}`,
          });
        } else if (match.status === 'partial') {
          const loadedQty = match.fulfilledBy.length;
          issues.push({
            type: 'incomplete_quantity',
            description: `Only ${loadedQty} of ${match.requirement.quantity} ${match.requirement.itemName} loaded`,
            severity: 'medium',
            suggestedAction: `Load ${match.requirement.quantity - loadedQty} more ${match.requirement.itemName}`,
          });
        }
      }
    }

    // Check for placement issues
    for (const alert of visionContext.alerts || []) {
      if (alert.type === 'unsafe_placement') {
        issues.push({
          type: 'safety_concern',
          description: alert.message,
          severity: 'high',
          suggestedAction: 'Reposition items for safe transport',
        });
      } else if (alert.type === 'wrong_location' && strictMode) {
        issues.push({
          type: 'incorrect_location',
          description: alert.message,
          severity: 'medium',
          suggestedAction: 'Move items to correct vehicle/trailer',
        });
      }
    }

    const completionPercentage = totalRequired > 0 ? 
      (fulfilledCount / totalRequired) * 100 : 100;

    return {
      jobId: visionContext.jobId,
      isComplete: completionPercentage === 100 && issues.filter(i => i.severity === 'high').length === 0,
      isCorrect: issues.length === 0,
      completionPercentage,
      issues,
      recommendations: this.generateRecommendations(visionContext, issues),
    };
  }

  /**
   * Detect objects in image using vision API
   */
  private async detectObjects(imageData: string | ArrayBuffer | Blob): Promise<VisionResult> {
    if (this.provider === VisionProvider.OPENAI_VISION && this.openaiApiKey) {
      return this.detectWithOpenAI(imageData);
    }
    
    // Fallback to mock detection for development
    return this.mockDetection();
  }

  /**
   * Detect storage locations (vehicles, trailers, storage areas)
   */
  private async detectStorageLocations(
    imageData: string | ArrayBuffer | Blob,
    detectionResult: VisionResult
  ): Promise<StorageLocation[]> {
    // In production, this would use a specialized model or prompt
    // For now, we'll identify locations based on detected objects and context
    
    const locations: StorageLocation[] = [];
    
    // Look for vehicles/trailers in the detected objects
    const vehicleClasses = [ObjectClass.TRUCK, ObjectClass.TRAILER];
    const vehicleObjects = detectionResult.detectedObjects.filter(
      obj => vehicleClasses.includes(obj.class)
    );

    for (const vehicle of vehicleObjects) {
      const location: StorageLocation = {
        id: this.generateId(),
        type: this.mapObjectToLocationType(vehicle.class),
        confidence: vehicle.confidence,
        boundingBox: vehicle.boundingBox,
        attributes: {},
      };

      // Try to identify specific vehicle
      if (vehicle.attributes?.text || vehicle.attributes?.licensePlate) {
        const identifier = this.extractVehicleId(vehicle);
        if (identifier && KNOWN_VEHICLES[identifier]) {
          const known = KNOWN_VEHICLES[identifier];
          location.vehicleId = identifier;
          location.color = known.color;
          location.locationName = known.name;
          location.type = known.type;
        }
      }

      locations.push(location);
    }

    // If no vehicles detected, assume ground/general area
    if (locations.length === 0) {
      locations.push({
        id: this.generateId(),
        type: LocationType.GROUND,
        confidence: 0.5,
        locationName: 'Ground/General Area',
      });
    }

    return locations;
  }

  /**
   * Analyze which items are in which locations
   */
  private analyzeItemPlacements(
    items: DetectedObject[],
    locations: StorageLocation[]
  ): ItemPlacement[] {
    const placements: ItemPlacement[] = [];

    for (const item of items) {
      // Skip non-equipment/material items
      if ([ObjectClass.TRUCK, ObjectClass.TRAILER, ObjectClass.PERSON].includes(item.class)) {
        continue;
      }

      // Find which location contains this item
      let bestLocation: StorageLocation | null = null;
      let bestOverlap = 0;

      for (const location of locations) {
        if (location.boundingBox && isItemInLocation(item, location)) {
          // Calculate overlap percentage to find best match
          const overlap = this.calculateOverlap(item.boundingBox, location.boundingBox);
          if (overlap > bestOverlap) {
            bestOverlap = overlap;
            bestLocation = location;
          }
        }
      }

      // Default to first location if no overlap found
      if (!bestLocation && locations.length > 0) {
        bestLocation = locations[0];
      }

      if (bestLocation) {
        const placement: ItemPlacement = {
          item,
          location: bestLocation,
          position: this.calculateRelativePosition(item, bestLocation),
          placementQuality: analyzePlacementQuality(item, bestLocation, items),
          confidence: Math.min(item.confidence, bestLocation.confidence),
        };
        placements.push(placement);
      }
    }

    return placements;
  }

  /**
   * Match detected items to job requirements
   */
  private async matchRequirements(
    placements: ItemPlacement[],
    requirements: LoadRequirement[]
  ): Promise<VisionContext['requirementMatches']> {
    const matches: NonNullable<VisionContext['requirementMatches']> = [];

    for (const requirement of requirements) {
      const fulfilledBy: Array<{
        item: DetectedObject;
        placement: ItemPlacement;
        matchConfidence: number;
      }> = [];

      // Find items that match this requirement
      for (const placement of placements) {
        const matchConfidence = this.calculateItemMatch(
          placement.item,
          requirement
        );

        if (matchConfidence > 0.7) {
          fulfilledBy.push({
            item: placement.item,
            placement,
            matchConfidence,
          });
        }
      }

      // Determine fulfillment status
      let status: 'fulfilled' | 'partial' | 'missing';
      if (fulfilledBy.length >= requirement.quantity) {
        status = 'fulfilled';
      } else if (fulfilledBy.length > 0) {
        status = 'partial';
      } else {
        status = 'missing';
      }

      matches.push({
        requirement,
        fulfilledBy,
        status,
      });
    }

    return matches;
  }

  // Helper methods

  private generateId(): string {
    return `vision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private mapObjectToLocationType(objectClass: ObjectClass): LocationType {
    switch (objectClass) {
      case ObjectClass.TRUCK:
        return LocationType.TRUCK_BED;
      case ObjectClass.TRAILER:
        return LocationType.TRAILER_DUMP; // Default trailer type
      default:
        return LocationType.UNKNOWN;
    }
  }

  private extractVehicleId(vehicle: DetectedObject): string | null {
    // Look for vehicle ID in attributes
    if (vehicle.attributes?.vehicleId) {
      return vehicle.attributes.vehicleId;
    }
    
    // Try to extract from detected text
    if (vehicle.attributes?.text) {
      const match = vehicle.attributes.text.match(/(?:VH|TR)-[A-Z0-9]+/);
      return match ? match[0] : null;
    }

    return null;
  }

  private calculateOverlap(box1: any, box2: any): number {
    const x1 = Math.max(box1.x, box2.x);
    const y1 = Math.max(box1.y, box2.y);
    const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
    const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);

    if (x2 < x1 || y2 < y1) return 0;

    const intersection = (x2 - x1) * (y2 - y1);
    const box1Area = box1.width * box1.height;
    
    return intersection / box1Area;
  }

  private calculateRelativePosition(item: DetectedObject, location: StorageLocation) {
    if (!location.boundingBox) {
      return { relativeX: 0.5, relativeY: 0.5 };
    }

    const relativeX = (item.boundingBox.x + item.boundingBox.width / 2 - location.boundingBox.x) / 
                     location.boundingBox.width;
    const relativeY = (item.boundingBox.y + item.boundingBox.height / 2 - location.boundingBox.y) / 
                     location.boundingBox.height;

    return {
      relativeX: Math.max(0, Math.min(1, relativeX)),
      relativeY: Math.max(0, Math.min(1, relativeY)),
    };
  }

  private determineLoadingContext(
    locations: StorageLocation[],
    detectionResult: VisionResult
  ): LoadingContext {
    return {
      operationType: 'loading', // Would be determined by temporal analysis in production
      primaryLocation: locations[0],
      secondaryLocations: locations.slice(1),
      environmentalFactors: {
        lighting: 'good', // Would be analyzed from image
      },
    };
  }

  private calculateItemMatch(
    item: DetectedObject,
    requirement: LoadRequirement
  ): number {
    // Find mapping for this object class
    const mapping = DEFAULT_OBJECT_MAPPINGS.find(m => m.objectClass === item.class);
    if (!mapping) return 0;

    // Check if types match
    if (requirement.itemType === 'equipment' && !mapping.equipmentType) return 0;
    if (requirement.itemType === 'material' && !mapping.materialType) return 0;

    // Check name similarity
    const nameSimilarity = this.calculateStringSimilarity(
      requirement.itemName.toLowerCase(),
      item.label?.toLowerCase() || mapping.defaultName.toLowerCase()
    );

    // Check specific unit if provided
    if (requirement.specificUnit && item.attributes?.text) {
      const unitMatch = item.attributes.text.includes(requirement.specificUnit);
      return unitMatch ? 0.95 : nameSimilarity * 0.7;
    }

    return nameSimilarity;
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    // Simple similarity check - in production use better algorithm
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);
    
    let matches = 0;
    for (const word1 of words1) {
      if (words2.some(word2 => word2.includes(word1) || word1.includes(word2))) {
        matches++;
      }
    }

    return matches / Math.max(words1.length, words2.length);
  }

  private generateAlerts(
    placements: ItemPlacement[],
    requirementMatches?: VisionContext['requirementMatches'],
    requirements?: LoadRequirement[]
  ): VisionContext['alerts'] {
    const alerts: NonNullable<VisionContext['alerts']> = [];

    // Check for unsafe placements
    for (const placement of placements) {
      if (!placement.placementQuality.isSecure) {
        alerts.push({
          type: 'unsafe_placement',
          severity: 'error',
          message: `${placement.item.label || placement.item.class} is not securely placed`,
          affectedItems: [placement.item.id],
        });
      }
    }

    // Check for missing required items
    if (requirementMatches) {
      for (const match of requirementMatches) {
        if (match.status === 'missing' && match.requirement.isRequired) {
          alerts.push({
            type: 'missing_item',
            severity: 'error',
            message: `Missing required item: ${match.requirement.itemName}`,
          });
        }
      }
    }

    return alerts;
  }

  private averageConfidence(items: Array<{ confidence: number }>): number {
    if (items.length === 0) return 0;
    const sum = items.reduce((acc, item) => acc + item.confidence, 0);
    return sum / items.length;
  }

  private calculateOverallConfidence(
    detectionResult: VisionResult,
    locations: StorageLocation[],
    placements: ItemPlacement[]
  ): number {
    const weights = {
      detection: 0.4,
      location: 0.3,
      placement: 0.3,
    };

    return (
      this.averageConfidence(detectionResult.detectedObjects) * weights.detection +
      this.averageConfidence(locations) * weights.location +
      this.averageConfidence(placements) * weights.placement
    );
  }

  private generateRecommendations(
    context: VisionContext,
    issues: LoadingValidation['issues']
  ): string[] {
    const recommendations: string[] = [];

    // Safety recommendations
    const safetyIssues = issues.filter(i => i.type === 'safety_concern');
    if (safetyIssues.length > 0) {
      recommendations.push('Prioritize resolving safety concerns before departure');
    }

    // Loading efficiency
    const hasAccessibilityIssues = context.placements.some(
      p => !p.placementQuality.isAccessible
    );
    if (hasAccessibilityIssues) {
      recommendations.push('Reorganize items for better accessibility during job');
    }

    return recommendations;
  }

  // Mock detection for development
  private mockDetection(): VisionResult {
    return {
      id: this.generateId(),
      tenantId: 'mock-tenant',
      provider: VisionProvider.OFFLINE_MODEL,
      detectedObjects: [
        {
          id: '1',
          class: ObjectClass.TRUCK,
          confidence: 0.95,
          boundingBox: { x: 0.1, y: 0.2, width: 0.6, height: 0.5 },
          label: 'Red Truck VH-TKR',
          attributes: { vehicleId: 'VH-TKR', color: 'red' },
        },
        {
          id: '2',
          class: ObjectClass.CHAINSAW,
          confidence: 0.88,
          boundingBox: { x: 0.3, y: 0.4, width: 0.1, height: 0.05 },
          label: 'Stihl Chainsaw',
        },
        {
          id: '3',
          class: ObjectClass.MOWER,
          confidence: 0.92,
          boundingBox: { x: 0.5, y: 0.45, width: 0.15, height: 0.1 },
          label: 'Push Mower',
        },
      ],
      processingTimeMs: 250,
    };
  }

  private async detectWithOpenAI(imageData: string | ArrayBuffer | Blob): Promise<VisionResult> {
    // OpenAI Vision API implementation would go here
    throw new Error('OpenAI Vision integration not yet implemented');
  }
}
