// Test Integrity Rule: Never change a test's business behavior or expected outcomes just to make it pass.

import { KitService, KitSelectionContext } from '../kit-service';

interface MockCallTracker {
  findActiveKitByCode: jest.Mock;
  findActiveVariantsForKit: jest.Mock;
  createAssignment: jest.Mock;
  createOverride: jest.Mock;
  dispatchSupervisorAlert: jest.Mock;
}

describe('KitService', () => {
  let service: KitService;
  let mocks: MockCallTracker;

  const baseKit = {
    id: 'kit-snow-ops',
    companyId: 'company-1',
    kitCode: 'SNOW_OPS',
    name: 'Snow Operations Kit',
    isActive: true,
    items: [
      {
        itemId: 'item-salt-spreader',
        itemType: 'equipment' as const,
        quantity: 1,
        unit: 'unit',
        isRequired: true,
        metadata: { voiceIdentifier: 'salt spreader' },
      },
      {
        itemId: 'item-ice-melt',
        itemType: 'material' as const,
        quantity: 1,
        unit: 'bag',
        isRequired: true,
        metadata: { voiceIdentifier: 'ice melt' },
      },
    ],
    metadata: {},
  };

  const winterVariant = {
    id: 'variant-winter-2025',
    kitId: 'kit-snow-ops',
    variantCode: 'WINTER_EXTREME',
    variantType: 'seasonal' as const,
    isActive: true,
    validFrom: new Date('2024-12-01'),
    validUntil: new Date('2025-03-31'),
    conditions: {
      season: 'winter',
      weather: 'snow',
    },
    itemModifications: [
      {
        type: 'adjust_quantity' as const,
        itemId: 'item-ice-melt',
        quantity: 2,
      },
      {
        type: 'add_item' as const,
        item: {
          itemId: 'item-safety-cones',
          itemType: 'equipment' as const,
          quantity: 4,
          unit: 'unit',
          isRequired: false,
          metadata: { voiceIdentifier: 'safety cones' },
        },
      },
    ],
    metadata: {},
  };

  const summerVariant = {
    id: 'variant-summer',
    kitId: 'kit-snow-ops',
    variantCode: 'SUMMER',
    variantType: 'seasonal' as const,
    isActive: true,
    validFrom: new Date('2025-06-01'),
    validUntil: new Date('2025-08-31'),
    conditions: {
      season: 'summer',
    },
    itemModifications: [],
    metadata: {},
  };

  const context: KitSelectionContext = {
    season: 'winter',
    weather: 'snow',
    jobType: 'deicing',
    eventDate: new Date('2025-01-10T08:00:00Z'),
    companySettings: {
      enforceRequiredItems: true,
      supervisorNotificationMethod: 'sms',
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();

    mocks = {
      findActiveKitByCode: jest.fn(),
      findActiveVariantsForKit: jest.fn(),
      createAssignment: jest.fn(),
      createOverride: jest.fn(),
      dispatchSupervisorAlert: jest.fn(),
    };

    service = new KitService({
      kitRepository: { findActiveKitByCode: mocks.findActiveKitByCode },
      kitVariantRepository: { findActiveVariantsForKit: mocks.findActiveVariantsForKit },
      jobKitRepository: { createAssignment: mocks.createAssignment },
      kitOverrideLogRepository: { createOverride: mocks.createOverride },
      notificationService: { dispatchSupervisorAlert: mocks.dispatchSupervisorAlert },
      clock: { now: () => new Date('2025-01-10T08:05:00Z') },
    });
  });

  describe('assignKitToJob', () => {
    it('selects the best matching variant and persists kit assignment with resolved items', async () => {
      mocks.findActiveKitByCode.mockResolvedValue(baseKit);
      mocks.findActiveVariantsForKit.mockResolvedValue([winterVariant, summerVariant]);
      mocks.createAssignment.mockResolvedValue({
        id: 'job-kit-001',
        companyId: 'company-1',
        jobId: 'job-42',
        kitId: 'kit-snow-ops',
        variantId: 'variant-winter-2025',
      });

      const result = await service.assignKitToJob({
        companyId: 'company-1',
        jobId: 'job-42',
        technicianId: 'tech-9',
        kitCode: 'SNOW_OPS',
        context,
      });

      expect(mocks.findActiveKitByCode).toHaveBeenCalledWith('company-1', 'SNOW_OPS');
      expect(mocks.findActiveVariantsForKit).toHaveBeenCalledWith('kit-snow-ops');
      expect(mocks.createAssignment).toHaveBeenCalledWith({
        companyId: 'company-1',
        jobId: 'job-42',
        kitId: 'kit-snow-ops',
        variantId: 'variant-winter-2025',
        technicianId: 'tech-9',
        assignedAt: expect.any(Date),
        resolvedItems: expect.arrayContaining([
          expect.objectContaining({ itemId: 'item-ice-melt', quantity: 2 }),
          expect.objectContaining({ itemId: 'item-safety-cones', quantity: 4 }),
        ]),
        missingRequiredItems: [],
        metadata: expect.objectContaining({ assignmentContext: expect.any(Object) }),
      });

      expect(result).toEqual(
        expect.objectContaining({
          assignmentId: 'job-kit-001',
          variantId: 'variant-winter-2025',
          resolvedItems: expect.arrayContaining([
            expect.objectContaining({ itemId: 'item-ice-melt', quantity: 2 }),
            expect.objectContaining({ itemId: 'item-safety-cones', quantity: 4 }),
          ]),
        })
      );
    });

    it('tracks missing required items and reflects them in assignment metadata', async () => {
      mocks.findActiveKitByCode.mockResolvedValue(baseKit);
      mocks.findActiveVariantsForKit.mockResolvedValue([winterVariant]);
      const missingContext = {
        ...context,
        unavailableItemIds: ['item-ice-melt'],
      } as KitSelectionContext;

      mocks.createAssignment.mockResolvedValue({
        id: 'job-kit-002',
        companyId: 'company-1',
        jobId: 'job-43',
        kitId: 'kit-snow-ops',
        variantId: 'variant-winter-2025',
      });

      const result = await service.assignKitToJob({
        companyId: 'company-1',
        jobId: 'job-43',
        technicianId: 'tech-9',
        kitCode: 'SNOW_OPS',
        context: missingContext,
      });

      expect(result.missingRequiredItems).toEqual([
        expect.objectContaining({ itemId: 'item-ice-melt' }),
      ]);
      expect(mocks.createAssignment).toHaveBeenCalledWith(
        expect.objectContaining({
          missingRequiredItems: expect.arrayContaining([
            expect.objectContaining({ itemId: 'item-ice-melt' }),
          ]),
          metadata: expect.objectContaining({
            missingRequiredItemCount: 1,
          }),
        })
      );
    });
  });

  describe('recordMissingItemOverride', () => {
    it('logs override and notifies supervisor with escalation metadata', async () => {
      mocks.createOverride.mockResolvedValue({
        id: 'override-100',
        companyId: 'company-1',
        jobId: 'job-43',
        kitId: 'kit-snow-ops',
        itemId: 'item-ice-melt',
        technicianId: 'tech-9',
        overrideReason: 'Damaged bag',
        notificationStatus: 'pending',
        createdAt: new Date('2025-01-10T08:05:00Z'),
      });
      mocks.dispatchSupervisorAlert.mockResolvedValue({
        delivered: true,
        dispatchedAt: new Date('2025-01-10T08:05:15Z'),
        channel: 'sms',
      });

      const result = await service.recordMissingItemOverride({
        companyId: 'company-1',
        jobId: 'job-43',
        kitId: 'kit-snow-ops',
        itemId: 'item-ice-melt',
        technicianId: 'tech-9',
        reason: 'Damaged bag',
        preferredNotificationMethod: 'sms',
      });

      expect(mocks.createOverride).toHaveBeenCalledWith({
        companyId: 'company-1',
        jobId: 'job-43',
        kitId: 'kit-snow-ops',
        itemId: 'item-ice-melt',
        technicianId: 'tech-9',
        overrideReason: 'Damaged bag',
        notificationMethod: 'sms',
        notificationStatus: 'pending',
        supervisorNotifiedAt: null,
        metadata: expect.objectContaining({ requiresSupervisorFollowUp: true }),
      });

      expect(mocks.dispatchSupervisorAlert).toHaveBeenCalledWith({
        companyId: 'company-1',
        jobId: 'job-43',
        kitId: 'kit-snow-ops',
        itemId: 'item-ice-melt',
        technicianId: 'tech-9',
        reason: 'Damaged bag',
        method: 'sms',
        escalationDeadline: expect.any(Date),
      });

      expect(result.notification?.delivered).toBe(true);
      expect(result.override.id).toBe('override-100');
    });
  });
});
