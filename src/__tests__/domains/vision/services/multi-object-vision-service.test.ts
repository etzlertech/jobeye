// Test Integrity Rule: Never change a test's business behavior or expected outcomes just to make it pass.

import {
  MultiObjectVisionService,
  SceneAnalysisRequest,
  LoadVerification,
  JobLoadRequirement,
} from '@/domains/vision/services/multi-object-vision-service';
import { Container, ContainerType, ContainerColor } from '@/domains/equipment/types/container-types';
import { Equipment, EquipmentState } from '@/domains/equipment/types/equipment-types';
import { Material, MaterialUnit } from '@/domains/material/types/material-types';
import { VoiceLogger } from '@/core/logger/voice-logger';

// Mock dependencies
jest.mock('@/core/logger/voice-logger');
jest.mock('openai');

describe('MultiObjectVisionService', () => {
  let service: MultiObjectVisionService;
  let mockLogger: jest.Mocked<VoiceLogger>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock logger
    mockLogger = {
      info: jest.fn().mockResolvedValue(undefined),
      warn: jest.fn().mockResolvedValue(undefined),
      error: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Mock environment
    process.env.OPENAI_API_KEY = 'test-key';
    
    service = new MultiObjectVisionService(mockLogger);
  });

  describe('analyzeLoadingScene', () => {
    const mockContainers: Container[] = [
      {
        id: 'container-1',
        tenantId: 'tenant-1',
        containerType: ContainerType.TRUCK,
        identifier: 'VH-TKR',
        name: 'Red Truck',
        color: ContainerColor.RED,
        isDefault: true,
        isActive: true,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'container-2',
        tenantId: 'tenant-1',
        containerType: ContainerType.TRAILER,
        identifier: 'TR-DU12R',
        name: 'Red Dump Trailer',
        color: ContainerColor.RED,
        isDefault: false,
        isActive: true,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const mockEquipment: Equipment[] = [
      {
        id: 'equip-1',
        tenantId: 'tenant-1',
        name: 'Stihl Chainsaw MS271',
        category: 'power_tool' as any,
        type: 'chainsaw',
        make: 'Stihl',
        model: 'MS271',
        serialNumber: 'SN123',
        state: EquipmentState.ACTIVE,
        currentLocation: { type: 'site', siteId: 'site-1' },
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'equip-2',
        tenantId: 'tenant-1',
        name: 'Push Mower',
        category: 'power_tool' as any,
        type: 'mower',
        make: 'Honda',
        model: 'HRX217',
        state: EquipmentState.ACTIVE,
        currentLocation: { type: 'site', siteId: 'site-1' },
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const mockMaterials: Material[] = [
      {
        id: 'mat-1',
        tenantId: 'tenant-1',
        name: 'Red Gas Can',
        category: 'fuel' as any,
        type: 'gasoline',
        unit: MaterialUnit.GALLON,
        currentStock: 10,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const mockRequirements: JobLoadRequirement[] = [
      {
        checklistItemId: 'checklist-1',
        itemType: 'equipment',
        itemId: 'equip-1',
        itemName: 'Stihl Chainsaw MS271',
        quantity: 2,
        containerId: 'container-1',
        containerName: 'Red Truck',
      },
      {
        checklistItemId: 'checklist-2',
        itemType: 'equipment',
        itemId: 'equip-2',
        itemName: 'Push Mower',
        quantity: 1,
        containerId: 'container-1',
        containerName: 'Red Truck',
      },
      {
        checklistItemId: 'checklist-3',
        itemType: 'material',
        itemId: 'mat-1',
        itemName: 'Gas Can',
        quantity: 3,
        containerId: 'container-1',
        containerName: 'Red Truck',
      },
    ];

    it('should analyze scene and verify all items loaded correctly', async () => {
      const request: SceneAnalysisRequest = {
        imageData: 'base64-image-data',
        jobId: 'job-123',
        loadRequirements: mockRequirements,
        knownContainers: mockContainers,
        knownEquipment: mockEquipment,
        knownMaterials: mockMaterials,
      };

      // Mock the vision API to return perfect matches
      const mockVisionResponse = {
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
          },
        ],
        provider: 'openai',
        modelId: 'gpt-4-vision-preview',
        tokensUsed: 1500,
        costUsd: 0.045,
      };

      // Mock OpenAI
      const mockOpenAI = jest.requireMock('openai');
      mockOpenAI.OpenAI = jest.fn().mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ 
                message: { 
                  content: JSON.stringify(mockVisionResponse) 
                } 
              }],
              usage: { total_tokens: 1500 },
            }),
          },
        },
      }));

      const result = await service.analyzeLoadingScene(request);

      expect(result).toMatchObject({
        jobId: 'job-123',
        containers: expect.arrayContaining([
          expect.objectContaining({
            containerId: 'container-1',
            containerType: 'truck',
            color: 'red',
            identifier: 'VH-TKR',
          }),
        ]),
        verifiedItems: expect.arrayContaining([
          expect.objectContaining({
            checklistItemId: 'checklist-1',
            status: 'verified',
          }),
          expect.objectContaining({
            checklistItemId: 'checklist-2',
            status: 'verified',
          }),
          expect.objectContaining({
            checklistItemId: 'checklist-3',
            status: 'verified',
          }),
        ]),
        missingItems: [],
        unexpectedItems: [],
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Load verification completed',
        expect.objectContaining({
          jobId: 'job-123',
          verifiedCount: 3,
          missingCount: 0,
        })
      );
    });

    it('should detect missing items', async () => {
      const request: SceneAnalysisRequest = {
        imageData: 'base64-image-data',
        jobId: 'job-123',
        loadRequirements: mockRequirements,
        knownContainers: mockContainers,
        knownEquipment: mockEquipment,
        knownMaterials: mockMaterials,
      };

      // Mock vision response missing the mower
      const mockVisionResponse = {
        containers: [
          {
            type: 'truck',
            color: 'red',
            identifier: 'VH-TKR',
            confidence: 0.95,
          },
        ],
        items: [
          {
            name: 'Stihl Chainsaw',
            type: 'equipment',
            containerId: '0',
            confidence: 0.88,
            quantity: 2,
          },
          {
            name: 'Gas Can',
            type: 'material',
            containerId: '0',
            confidence: 0.85,
            quantity: 3,
          },
        ],
        provider: 'openai',
        modelId: 'gpt-4-vision-preview',
        tokensUsed: 1200,
        costUsd: 0.036,
      };

      const mockOpenAI = jest.requireMock('openai');
      mockOpenAI.OpenAI = jest.fn().mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ 
                message: { 
                  content: JSON.stringify(mockVisionResponse) 
                } 
              }],
              usage: { total_tokens: 1200 },
            }),
          },
        },
      }));

      const result = await service.analyzeLoadingScene(request);

      expect(result.missingItems).toHaveLength(1);
      expect(result.missingItems[0]).toMatchObject({
        checklistItemId: 'checklist-2',
        itemName: 'Push Mower',
        expectedContainer: 'Red Truck',
      });
    });

    it('should detect items in wrong containers', async () => {
      const requirementsWithMultipleContainers: JobLoadRequirement[] = [
        ...mockRequirements.slice(0, 2),
        {
          checklistItemId: 'checklist-3',
          itemType: 'material',
          itemId: 'mat-1',
          itemName: 'Gas Can',
          quantity: 3,
          containerId: 'container-2', // Should be in trailer
          containerName: 'Red Dump Trailer',
        },
      ];

      const request: SceneAnalysisRequest = {
        imageData: 'base64-image-data',
        jobId: 'job-123',
        loadRequirements: requirementsWithMultipleContainers,
        knownContainers: mockContainers,
        knownEquipment: mockEquipment,
        knownMaterials: mockMaterials,
      };

      // Mock response with gas cans in truck instead of trailer
      const mockVisionResponse = {
        containers: [
          {
            type: 'truck',
            color: 'red',
            identifier: 'VH-TKR',
            confidence: 0.95,
          },
          {
            type: 'trailer',
            color: 'red',
            identifier: 'TR-DU12R',
            confidence: 0.90,
          },
        ],
        items: [
          {
            name: 'Stihl Chainsaw',
            type: 'equipment',
            containerId: '0', // In truck - correct
            confidence: 0.88,
            quantity: 2,
          },
          {
            name: 'Push Mower',
            type: 'equipment',
            containerId: '0', // In truck - correct
            confidence: 0.92,
            quantity: 1,
          },
          {
            name: 'Gas Can',
            type: 'material',
            containerId: '0', // In truck - WRONG! Should be in trailer
            confidence: 0.85,
            quantity: 3,
          },
        ],
        provider: 'openai',
        modelId: 'gpt-4-vision-preview',
      };

      const mockOpenAI = jest.requireMock('openai');
      mockOpenAI.OpenAI = jest.fn().mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ 
                message: { 
                  content: JSON.stringify(mockVisionResponse) 
                } 
              }],
              usage: { total_tokens: 1500 },
            }),
          },
        },
      }));

      const result = await service.analyzeLoadingScene(request);

      const gasCanVerification = result.verifiedItems.find(
        v => v.checklistItemId === 'checklist-3'
      );
      
      expect(gasCanVerification?.status).toBe('wrong_container');
    });

    it('should handle low confidence detections', async () => {
      const request: SceneAnalysisRequest = {
        imageData: 'base64-image-data',
        jobId: 'job-123',
        loadRequirements: mockRequirements,
        knownContainers: mockContainers,
        knownEquipment: mockEquipment,
        knownMaterials: mockMaterials,
        confidenceThreshold: 0.8,
      };

      // Mock response with low confidence chainsaw
      const mockVisionResponse = {
        containers: [
          {
            type: 'truck',
            color: 'red',
            identifier: 'VH-TKR',
            confidence: 0.95,
          },
        ],
        items: [
          {
            name: 'Stihl Chainsaw',
            type: 'equipment',
            containerId: '0',
            confidence: 0.65, // Below threshold
            quantity: 2,
          },
          {
            name: 'Push Mower',
            type: 'equipment',
            containerId: '0',
            confidence: 0.92,
            quantity: 1,
          },
          {
            name: 'Gas Can',
            type: 'material',
            containerId: '0',
            confidence: 0.85,
            quantity: 3,
          },
        ],
        provider: 'openai',
        modelId: 'gpt-4-vision-preview',
      };

      const mockOpenAI = jest.requireMock('openai');
      mockOpenAI.OpenAI = jest.fn().mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ 
                message: { 
                  content: JSON.stringify(mockVisionResponse) 
                } 
              }],
              usage: { total_tokens: 1500 },
            }),
          },
        },
      }));

      const result = await service.analyzeLoadingScene(request);

      const chainsawVerification = result.verifiedItems.find(
        v => v.checklistItemId === 'checklist-1'
      );
      
      expect(chainsawVerification?.status).toBe('low_confidence');
    });

    it('should detect unexpected items', async () => {
      const request: SceneAnalysisRequest = {
        imageData: 'base64-image-data',
        jobId: 'job-123',
        loadRequirements: mockRequirements,
        knownContainers: mockContainers,
        knownEquipment: mockEquipment,
        knownMaterials: mockMaterials,
      };

      // Mock response with extra trimmer not on checklist
      const mockVisionResponse = {
        containers: [
          {
            type: 'truck',
            color: 'red',
            identifier: 'VH-TKR',
            confidence: 0.95,
          },
        ],
        items: [
          {
            name: 'Stihl Chainsaw',
            type: 'equipment',
            containerId: '0',
            confidence: 0.88,
            quantity: 2,
          },
          {
            name: 'Push Mower',
            type: 'equipment',
            containerId: '0',
            confidence: 0.92,
            quantity: 1,
          },
          {
            name: 'Gas Can',
            type: 'material',
            containerId: '0',
            confidence: 0.85,
            quantity: 3,
          },
          {
            name: 'String Trimmer', // Not on checklist!
            type: 'equipment',
            containerId: '0',
            confidence: 0.87,
            quantity: 1,
          },
        ],
        provider: 'openai',
        modelId: 'gpt-4-vision-preview',
      };

      const mockOpenAI = jest.requireMock('openai');
      mockOpenAI.OpenAI = jest.fn().mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ 
                message: { 
                  content: JSON.stringify(mockVisionResponse) 
                } 
              }],
              usage: { total_tokens: 1600 },
            }),
          },
        },
      }));

      const result = await service.analyzeLoadingScene(request);

      expect(result.unexpectedItems).toHaveLength(1);
      expect(result.unexpectedItems[0]).toMatchObject({
        itemName: 'String Trimmer',
        itemType: 'equipment',
      });
    });

    it('should handle API errors gracefully', async () => {
      const request: SceneAnalysisRequest = {
        imageData: 'base64-image-data',
        jobId: 'job-123',
        loadRequirements: mockRequirements,
        knownContainers: mockContainers,
      };

      const mockOpenAI = jest.requireMock('openai');
      mockOpenAI.OpenAI = jest.fn().mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('API rate limit exceeded')),
          },
        },
      }));

      await expect(service.analyzeLoadingScene(request)).rejects.toThrow(
        'Failed to analyze loading scene'
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to analyze loading scene',
        expect.any(Error)
      );
    });
  });

  describe('VLM prompt generation', () => {
    it('should generate proper prompt with container and item lists', async () => {
      const containers: Container[] = [
        {
          id: 'c1',
          tenantId: 't1',
          containerType: ContainerType.TRUCK,
          identifier: 'VH-TKR',
          name: 'Red Truck',
          color: ContainerColor.RED,
          isDefault: true,
          isActive: true,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const requirements: JobLoadRequirement[] = [
        {
          checklistItemId: 'ch1',
          itemType: 'equipment',
          itemId: 'e1',
          itemName: 'Chainsaw',
          quantity: 1,
          containerId: 'c1',
          containerName: 'Red Truck',
        },
      ];

      const request: SceneAnalysisRequest = {
        imageData: 'test',
        jobId: 'job-1',
        loadRequirements: requirements,
        knownContainers: containers,
      };

      let capturedPrompt = '';
      const mockOpenAI = jest.requireMock('openai');
      mockOpenAI.OpenAI = jest.fn().mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockImplementation((params) => {
              capturedPrompt = params.messages[0].content[0].text;
              return Promise.resolve({
                choices: [{ 
                  message: { 
                    content: JSON.stringify({
                      containers: [],
                      items: [],
                      provider: 'openai',
                      modelId: 'gpt-4-vision-preview',
                    }),
                  },
                }],
                usage: { total_tokens: 100 },
              });
            }),
          },
        },
      }));

      await service.analyzeLoadingScene(request);

      expect(capturedPrompt).toContain('Red Truck (VH-TKR): truck, red');
      expect(capturedPrompt).toContain('1x Chainsaw (should be in Red Truck)');
      expect(capturedPrompt).toContain('KNOWN CONTAINERS/VEHICLES:');
      expect(capturedPrompt).toContain('EXPECTED ITEMS TO BE LOADED:');
    });
  });
});