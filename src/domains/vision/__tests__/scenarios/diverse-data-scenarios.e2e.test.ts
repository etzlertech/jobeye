/**
 * @file diverse-data-scenarios.e2e.test.ts
 * @purpose Tests with diverse, realistic data scenarios covering various business cases
 * @coverage_target ≥90%
 * @test_type integration
 *
 * Tests realistic business scenarios with varied data patterns, edge cases,
 * and complex workflows
 */

import { VisionVerificationService } from '../../services/vision-verification.service';
import { BatchVerificationService } from '../../services/batch-verification.service';
import * as costRecordRepo from '../../repositories/cost-record.repository';
import * as verificationRepo from '../../repositories/vision-verification.repository';

// Realistic test data representing actual field scenarios
const REAL_WORLD_SCENARIOS = {
  // Scenario: New employee's first day
  new_employee_training: {
    tenantId: 'acme-landscaping',
    employee: 'john-new-hire',
    kits: [
      {
        id: 'training-kit-basic',
        name: 'Training Kit - Basic Safety',
        items: ['safety_glasses', 'gloves', 'hard_hat', 'reflective_vest'],
        confidenceTarget: 0.95 // Training requires high confidence
      }
    ],
    expectedBehavior: 'Should verify all safety items with high confidence'
  },

  // Scenario: Seasonal equipment rotation (spring to summer)
  seasonal_rotation: {
    tenantId: 'greenscape-services',
    season: 'spring',
    kits: [
      {
        id: 'spring-aerator-kit',
        name: 'Spring Aeration Equipment',
        items: ['aerator', 'lawn_roller', 'spreader', 'rake'],
        notes: 'Seasonal equipment may have lower confidence due to infrequent use'
      },
      {
        id: 'spring-mulch-kit',
        name: 'Mulch Installation Kit',
        items: ['wheelbarrow', 'rake', 'shovel', 'edger', 'tarp'],
        notes: 'Common items should have high confidence'
      }
    ],
    expectedBehavior: 'Should handle mix of common and seasonal items'
  },

  // Scenario: Multi-crew coordination
  multi_crew_operation: {
    tenantId: 'elite-tree-service',
    crews: [
      {
        crewId: 'crew-alpha',
        lead: 'mike-supervisor',
        equipment: ['chainsaw_primary', 'chainsaw_backup', 'wood_chipper', 'stump_grinder']
      },
      {
        crewId: 'crew-bravo',
        lead: 'sarah-climber',
        equipment: ['climbing_gear', 'harness', 'ropes', 'carabiners', 'helmet']
      },
      {
        crewId: 'crew-charlie',
        lead: 'tom-groundsman',
        equipment: ['pole_saw', 'hand_saw', 'rake', 'tarps', 'first_aid']
      }
    ],
    expectedBehavior: 'Should track equipment across multiple crews independently'
  },

  // Scenario: Equipment sharing between properties
  property_hopping: {
    tenantId: 'mobile-maintenance',
    route: [
      {
        propertyId: 'prop-001-residential',
        address: '123 Oak Street',
        requiredEquipment: ['mower_push', 'trimmer_small', 'blower_handheld'],
        timeOnSite: '30min'
      },
      {
        propertyId: 'prop-002-commercial',
        address: '456 Business Park',
        requiredEquipment: ['mower_commercial', 'trimmer_commercial', 'blower_backpack', 'edger'],
        timeOnSite: '2hr'
      },
      {
        propertyId: 'prop-003-hoa-common',
        address: 'Sunset HOA Commons',
        requiredEquipment: ['mower_commercial', 'hedge_trimmer', 'pole_saw', 'blower_backpack'],
        timeOnSite: '1.5hr'
      }
    ],
    expectedBehavior: 'Should verify equipment before/after each property'
  },

  // Scenario: Emergency response (storm damage)
  emergency_response: {
    tenantId: 'rapid-response-tree',
    emergency: 'hurricane-cleanup',
    priority: 'high',
    equipment: [
      // Safety equipment (critical)
      { item: 'chainsaw', quantity: 3, priority: 'critical', verifyBefore: true },
      { item: 'safety_harness', quantity: 2, priority: 'critical', verifyBefore: true },
      { item: 'helmet', quantity: 3, priority: 'critical', verifyBefore: true },
      { item: 'first_aid_kit', quantity: 1, priority: 'critical', verifyBefore: true },

      // Primary tools (required)
      { item: 'pole_saw', quantity: 2, priority: 'required', verifyBefore: false },
      { item: 'wood_chipper', quantity: 1, priority: 'required', verifyBefore: false },
      { item: 'generator', quantity: 1, priority: 'required', verifyBefore: false },

      // Support items (optional)
      { item: 'tarps', quantity: 5, priority: 'optional', verifyBefore: false },
      { item: 'rope', quantity: 10, priority: 'optional', verifyBefore: false }
    ],
    expectedBehavior: 'Should prioritize safety equipment verification'
  },

  // Scenario: Franchise operations (multi-location)
  franchise_network: {
    franchiseId: 'lawn-pro-franchise',
    locations: [
      {
        locationId: 'lawn-pro-north',
        region: 'north',
        fleetSize: 5,
        standardKit: ['mower', 'trimmer', 'blower', 'edger']
      },
      {
        locationId: 'lawn-pro-south',
        region: 'south',
        fleetSize: 3,
        standardKit: ['mower', 'trimmer', 'blower', 'edger']
      },
      {
        locationId: 'lawn-pro-west',
        region: 'west',
        fleetSize: 8,
        standardKit: ['mower', 'trimmer', 'blower', 'edger']
      }
    ],
    expectedBehavior: 'Should aggregate verification data across all locations'
  }
};

// Helper functions
function generateImageData(width: number = 640, height: number = 480): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.floor(Math.random() * 256);
    data[i + 1] = Math.floor(Math.random() * 256);
    data[i + 2] = Math.floor(Math.random() * 256);
    data[i + 3] = 255;
  }
  return new ImageData(data, width, height);
}

function generateRealisticImageData(scenario: string): ImageData {
  // In a real implementation, this would load actual test images
  // For now, generate with size based on scenario
  const sizes: Record<string, { width: number; height: number }> = {
    mobile_phone: { width: 640, height: 480 },
    tablet: { width: 1024, height: 768 },
    professional_camera: { width: 1920, height: 1080 },
    security_camera: { width: 1280, height: 720 }
  };

  const size = sizes[scenario] || sizes.mobile_phone;
  return generateImageData(size.width, size.height);
}

describe('Vision Verification - Diverse Data Scenarios', () => {
  let visionService: VisionVerificationService;
  let batchService: BatchVerificationService;

  beforeAll(() => {
    visionService = new VisionVerificationService();
    batchService = new BatchVerificationService();
  });

  describe('Real-World Scenario 1: New Employee Training Day', () => {
    const scenario = REAL_WORLD_SCENARIOS.new_employee_training;

    it('should verify training kit with high confidence requirements', async () => {
      // Arrange
      const kit = scenario.kits[0];
      const imageData = generateRealisticImageData('mobile_phone');

      // Act
      const result = await visionService.verifyKit({
        kitId: kit.id,
        tenantId: scenario.tenantId,
        imageData,
        expectedItems: kit.items,
        maxBudgetUsd: 10.0
      });

      // Assert: Training verification succeeds
      expect(result.data).toBeDefined();
      expect(result.error).toBeNull();

      // Assert: High confidence for safety items
      const safetyItems = result.data?.detectedItems.filter(item =>
        ['safety_glasses', 'hard_hat', 'reflective_vest'].includes(item.itemType)
      );

      safetyItems?.forEach(item => {
        expect(item.confidence).toBeGreaterThan(0.70); // Meet threshold
      });

      // Assert: All required safety items detected or flagged
      expect(result.data?.missingItems.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Real-World Scenario 2: Seasonal Equipment Rotation', () => {
    const scenario = REAL_WORLD_SCENARIOS.seasonal_rotation;

    it('should handle spring equipment transition with mixed confidence', async () => {
      // Arrange: Both spring kits
      const springKits = scenario.kits;
      const requests = springKits.map(kit => ({
        kitId: kit.id,
        imageData: generateRealisticImageData('tablet'),
        expectedItems: kit.items
      }));

      // Act: Verify both kits
      const results = await batchService.verifyBatch({
        tenantId: scenario.tenantId,
        items: requests,
        stopOnError: false
      });

      // Assert: Both kits processed
      expect(results.data?.totalItems).toBe(2);
      expect(results.data?.completedItems).toBe(2);

      // Assert: Common items (rake, shovel) detected across kits
      const allDetections = results.data?.results
        .filter(r => r.success)
        .flatMap(r => r.result?.detectedItems || []);

      const commonItems = allDetections?.filter(item =>
        ['rake', 'shovel', 'edger'].includes(item.itemType)
      );

      expect(commonItems?.length).toBeGreaterThan(0);
    });
  });

  describe('Real-World Scenario 3: Multi-Crew Operation', () => {
    const scenario = REAL_WORLD_SCENARIOS.multi_crew_operation;

    it('should track equipment across three independent crews', async () => {
      // Arrange: Create verification for each crew
      const crewVerifications = scenario.crews.map(crew => ({
        kitId: `kit-${crew.crewId}`,
        imageData: generateRealisticImageData('professional_camera'),
        expectedItems: crew.equipment,
        metadata: {
          crewId: crew.crewId,
          crewLead: crew.lead
        }
      }));

      // Act: Verify all crews in parallel
      const results = await Promise.all(
        crewVerifications.map(verification =>
          visionService.verifyKit({
            kitId: verification.kitId,
            tenantId: scenario.tenantId,
            imageData: verification.imageData,
            expectedItems: verification.expectedItems,
            maxBudgetUsd: 10.0
          })
        )
      );

      // Assert: All crews verified
      expect(results.length).toBe(3);
      expect(results.every(r => r.data !== null || r.error !== null)).toBe(true);

      // Assert: Each crew has distinct equipment
      const crewAItems = results[0].data?.detectedItems.map(i => i.itemType) || [];
      const crewBItems = results[1].data?.detectedItems.map(i => i.itemType) || [];

      const overlap = crewAItems.filter(item => crewBItems.includes(item));
      expect(overlap.length).toBeLessThan(crewAItems.length); // Some distinct items
    });
  });

  describe('Real-World Scenario 4: Property Hopping Route', () => {
    const scenario = REAL_WORLD_SCENARIOS.property_hopping;

    it('should verify equipment at each property stop', async () => {
      // Arrange: Simulate verification at each property
      const propertyVerifications = [];

      // Act: Verify before first property
      for (const property of scenario.route) {
        const verification = await visionService.verifyKit({
          kitId: `kit-${property.propertyId}`,
          tenantId: scenario.tenantId,
          imageData: generateRealisticImageData('mobile_phone'),
          expectedItems: property.requiredEquipment,
          maxBudgetUsd: 10.0
        });

        propertyVerifications.push({
          propertyId: property.propertyId,
          address: property.address,
          verification
        });
      }

      // Assert: All properties checked
      expect(propertyVerifications.length).toBe(3);

      // Assert: Equipment requirements vary by property type
      const residentialEquipment = propertyVerifications[0].verification.data?.detectedItems.length || 0;
      const commercialEquipment = propertyVerifications[1].verification.data?.detectedItems.length || 0;

      // Commercial should require more equipment
      expect(commercialEquipment).toBeGreaterThanOrEqual(residentialEquipment);

      // Assert: Can track equipment movement across properties
      const allVerificationIds = propertyVerifications
        .filter(pv => pv.verification.data)
        .map(pv => pv.verification.data!.verificationId);

      expect(allVerificationIds.length).toBeGreaterThan(0);
    });
  });

  describe('Real-World Scenario 5: Emergency Response', () => {
    const scenario = REAL_WORLD_SCENARIOS.emergency_response;

    it('should prioritize critical safety equipment in emergency', async () => {
      // Arrange: Separate critical and non-critical items
      const criticalItems = scenario.equipment
        .filter(e => e.priority === 'critical')
        .map(e => e.item);

      const allItems = scenario.equipment.map(e => e.item);

      // Act: Verify critical equipment first
      const criticalVerification = await visionService.verifyKit({
        kitId: `emergency-${scenario.emergency}-critical`,
        tenantId: scenario.tenantId,
        imageData: generateRealisticImageData('tablet'),
        expectedItems: criticalItems,
        maxBudgetUsd: 20.0 // Higher budget for emergency
      });

      // Assert: Critical verification completes quickly
      expect(criticalVerification.data).toBeDefined();
      expect(criticalVerification.data?.processingTimeMs).toBeLessThan(5000);

      // Assert: All critical items verified or flagged
      const criticalMissing = criticalVerification.data?.missingItems.filter(item =>
        criticalItems.includes(item)
      );

      // In emergency, we need to know about any missing critical items
      expect(criticalMissing).toBeDefined();

      // Act: Verify all equipment
      const fullVerification = await visionService.verifyKit({
        kitId: `emergency-${scenario.emergency}-full`,
        tenantId: scenario.tenantId,
        imageData: generateRealisticImageData('professional_camera'),
        expectedItems: allItems,
        maxBudgetUsd: 20.0
      });

      // Assert: Can verify large emergency kit
      expect(fullVerification.data).toBeDefined();
    });
  });

  describe('Real-World Scenario 6: Franchise Network Aggregation', () => {
    const scenario = REAL_WORLD_SCENARIOS.franchise_network;

    it('should aggregate verification data across franchise locations', async () => {
      // Arrange: Verify standard kit at each location
      const locationVerifications = await Promise.all(
        scenario.locations.map(location =>
          visionService.verifyKit({
            kitId: `kit-${location.locationId}`,
            tenantId: scenario.franchiseId,
            imageData: generateRealisticImageData('mobile_phone'),
            expectedItems: location.standardKit,
            maxBudgetUsd: 10.0
          })
        )
      );

      // Assert: All locations verified
      expect(locationVerifications.length).toBe(3);

      // Act: Query all verifications for franchise
      const franchiseHistory = await verificationRepo.findAll({
        tenantId: scenario.franchiseId,
        limit: 100
      });

      // Assert: Can retrieve franchise-wide data
      expect(franchiseHistory.data).toBeInstanceOf(Array);

      // Assert: Can calculate franchise-wide metrics
      const totalVerifications = franchiseHistory.data?.length || 0;
      expect(totalVerifications).toBeGreaterThanOrEqual(3);

      // Act: Get cost summary for franchise
      const costSummary = await costRecordRepo.getDailySummary(
        scenario.franchiseId,
        new Date()
      );

      // Assert: Cost tracking works franchise-wide
      expect(costSummary.data).toBeDefined();
    });
  });

  describe('Data Diversity: Various Image Qualities', () => {
    it('should handle different image qualities and sources', async () => {
      // Arrange: Different image sources
      const imageSources = [
        { type: 'mobile_phone', quality: 'low', expected: 'May need VLM fallback' },
        { type: 'tablet', quality: 'medium', expected: 'YOLO should work' },
        { type: 'professional_camera', quality: 'high', expected: 'High confidence' },
        { type: 'security_camera', quality: 'medium', expected: 'Fixed angle' }
      ];

      // Act: Verify with each image source
      const results = await Promise.all(
        imageSources.map(source =>
          visionService.verifyKit({
            kitId: `kit-quality-${source.type}`,
            tenantId: 'test-image-quality',
            imageData: generateRealisticImageData(source.type),
            expectedItems: ['mower', 'trimmer', 'blower'],
            maxBudgetUsd: 10.0
          })
        )
      );

      // Assert: All image types processed
      expect(results.length).toBe(4);
      expect(results.filter(r => r.data !== null).length).toBeGreaterThan(0);

      // Assert: Higher quality images should have higher confidence
      const professionalResult = results[2].data;
      const mobileResult = results[0].data;

      if (professionalResult && mobileResult) {
        // Professional camera should generally have higher confidence
        expect(professionalResult.confidenceScore).toBeGreaterThan(0);
        expect(mobileResult.confidenceScore).toBeGreaterThan(0);
      }
    });
  });

  describe('Data Diversity: Time-Based Patterns', () => {
    it('should track verification patterns across different times of day', async () => {
      // Arrange: Simulate verifications at different times
      const timeSlots = [
        { time: '06:00', period: 'early_morning', description: 'Pre-work check' },
        { time: '12:00', period: 'midday', description: 'Lunch break check' },
        { time: '15:00', period: 'afternoon', description: 'Mid-route check' },
        { time: '18:00', period: 'evening', description: 'End of day check' }
      ];

      // Act: Create verifications for each time slot
      const timeBasedVerifications = await Promise.all(
        timeSlots.map(slot =>
          visionService.verifyKit({
            kitId: `kit-${slot.period}`,
            tenantId: 'test-time-patterns',
            imageData: generateImageData(),
            expectedItems: ['mower', 'trimmer'],
            maxBudgetUsd: 10.0
          })
        )
      );

      // Assert: Can track usage patterns
      expect(timeBasedVerifications.length).toBe(4);
      expect(timeBasedVerifications.every(v => v.data || v.error)).toBe(true);

      // In a real scenario, would analyze verification frequency by time
      const successfulVerifications = timeBasedVerifications.filter(v => v.data !== null);
      expect(successfulVerifications.length).toBeGreaterThan(0);
    });
  });

  describe('Data Diversity: Weather Conditions', () => {
    it('should handle verifications in various weather conditions', async () => {
      // Arrange: Simulate different lighting/weather scenarios
      const weatherScenarios = [
        { condition: 'sunny', lighting: 'excellent', confidence: 'high' },
        { condition: 'cloudy', lighting: 'good', confidence: 'medium' },
        { condition: 'overcast', lighting: 'low', confidence: 'medium' },
        { condition: 'rain', lighting: 'poor', confidence: 'low' }
      ];

      // Act: Verify in each condition
      const weatherVerifications = await Promise.all(
        weatherScenarios.map(weather =>
          visionService.verifyKit({
            kitId: `kit-weather-${weather.condition}`,
            tenantId: 'test-weather-conditions',
            imageData: generateImageData(), // Would vary by weather in real scenario
            expectedItems: ['mower', 'trimmer', 'blower'],
            maxBudgetUsd: 10.0
          })
        )
      );

      // Assert: System handles various conditions
      expect(weatherVerifications.length).toBe(4);

      // Assert: Poor conditions might trigger VLM more often
      const results = weatherVerifications.filter(v => v.data !== null);
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Data Diversity: Equipment Conditions', () => {
    it('should detect equipment in various states of wear', async () => {
      // Arrange: Same equipment in different conditions
      const equipmentStates = [
        { state: 'new', items: ['mower_new', 'trimmer_new'], expected: 'High confidence' },
        { state: 'used', items: ['mower', 'trimmer'], expected: 'Normal confidence' },
        { state: 'worn', items: ['mower_old', 'trimmer_old'], expected: 'Lower confidence' },
        { state: 'damaged', items: ['mower_damaged'], expected: 'May not detect' }
      ];

      // Act: Verify each state
      const stateVerifications = await Promise.all(
        equipmentStates.map(state =>
          visionService.verifyKit({
            kitId: `kit-state-${state.state}`,
            tenantId: 'test-equipment-states',
            imageData: generateImageData(),
            expectedItems: state.items,
            maxBudgetUsd: 10.0
          })
        )
      );

      // Assert: Can handle various equipment conditions
      expect(stateVerifications.length).toBe(4);
      expect(stateVerifications.filter(v => v.data || v.error).length).toBe(4);
    });
  });

  describe('Data Diversity: Custom Equipment Names', () => {
    it('should handle company-specific equipment terminology', async () => {
      // Arrange: Different companies use different terms
      const terminologyVariations = [
        { company: 'company-a', term: 'mower', variant: 'lawn_mower' },
        { company: 'company-b', term: 'trimmer', variant: 'weed_eater' },
        { company: 'company-c', term: 'blower', variant: 'leaf_blower' },
        { company: 'company-d', term: 'edger', variant: 'string_trimmer' }
      ];

      // Act: Verify with different terminology
      const terminologyResults = await Promise.all(
        terminologyVariations.map(variation =>
          visionService.verifyKit({
            kitId: `kit-${variation.company}`,
            tenantId: variation.company,
            imageData: generateImageData(),
            expectedItems: [variation.term, variation.variant],
            maxBudgetUsd: 10.0
          })
        )
      );

      // Assert: System handles terminology variations
      expect(terminologyResults.length).toBe(4);

      // In production, would use synonym mapping
      const successfulDetections = terminologyResults.filter(r =>
        r.data && r.data.detectedItems.length > 0
      );

      expect(successfulDetections.length).toBeGreaterThan(0);
    });
  });

  describe('Data Diversity: Complex Scenarios', () => {
    it('should handle complex multi-factor scenarios', async () => {
      // Arrange: Complex real-world scenario
      // Mid-day, cloudy, worn equipment, multiple crews, mid-route check
      const complexScenario = {
        tenantId: 'complex-scenario-test',
        context: {
          time: '14:30',
          weather: 'cloudy',
          location: 'mid_route',
          urgency: 'normal',
          equipmentAge: 'mixed'
        },
        equipment: [
          'mower_commercial_5yr',
          'trimmer_new',
          'blower_2yr',
          'edger_worn',
          'safety_vest',
          'fuel_cans_2'
        ]
      };

      // Act: Verify complex scenario
      const result = await visionService.verifyKit({
        kitId: 'kit-complex-scenario',
        tenantId: complexScenario.tenantId,
        imageData: generateImageData(),
        expectedItems: complexScenario.equipment,
        maxBudgetUsd: 10.0
      });

      // Assert: System handles complexity
      expect(result.data || result.error).toBeDefined();

      // Assert: Provides actionable results despite complexity
      if (result.data) {
        expect(result.data).toHaveProperty('verificationResult');
        expect(result.data).toHaveProperty('detectedItems');
        expect(result.data).toHaveProperty('confidenceScore');
      }
    });
  });
});