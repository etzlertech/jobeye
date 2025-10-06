import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { CustomerOfflineSync } from '@/domains/customer/services/customer-offline-sync';
import { OfflineOperation, OfflineOperationType, SyncConflict } from '@/domains/customer/types/customer-types';
import { voiceLogger } from '@/core/logger/voice-logger';
import { EventBus } from '@/core/events/event-bus';

jest.mock('@/core/logger/voice-logger', () => ({
  voiceLogger: {
    speak: jest.fn(),
  },
}));

const emitMock = jest.fn();

jest.mock('@/core/events/event-bus', () => ({
  EventBus: class {
    static getInstance = jest.fn(() => ({ emit: emitMock }));
  },
}));

describe('CustomerOfflineSync', () => {
  const speakMock = voiceLogger.speak as jest.Mock;
  let mockCustomerService: {
    findById: jest.Mock;
    createCustomer: jest.Mock;
    updateCustomer: jest.Mock;
    deleteCustomer: jest.Mock;
  };
  let offlineSync: CustomerOfflineSync;

  beforeEach(() => {
    jest.clearAllMocks();
    speakMock.mockResolvedValue(undefined);

    mockCustomerService = {
      findById: jest.fn(),
      createCustomer: jest.fn(),
      updateCustomer: jest.fn(),
      deleteCustomer: jest.fn(),
    };

    (global as any).navigator = { onLine: true };
    (global as any).localStorage = {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };
    (global as any).window = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };

    offlineSync = new CustomerOfflineSync(mockCustomerService as any);
  });

  afterEach(() => {
    delete (global as any).navigator;
    delete (global as any).localStorage;
    delete (global as any).window;
  });

  const createOperation = (overrides: Partial<OfflineOperation> = {}): OfflineOperation => ({
    id: overrides.id ?? 'op-queued',
    type: overrides.type ?? OfflineOperationType.CREATE,
    entityId: overrides.entityId ?? 'cust-123',
    data: overrides.data ?? { name: 'New Customer' },
    tenantId: overrides.tenantId ?? 'tenant-123',
    timestamp: overrides.timestamp ?? new Date(),
    version: overrides.version,
  });

  it('queues operations and persists to localStorage', async () => {
    const operation = createOperation();

    await offlineSync.queueCustomerOperation(operation, 'voice-session');

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'customer_offline_queue',
      expect.stringContaining(operation.id)
    );
    expect(speakMock).toHaveBeenCalledWith(
      'Operation saved offline. Will sync when connection is restored.',
      { voiceSessionId: 'voice-session' }
    );
    expect(emitMock).toHaveBeenCalledWith('customer:offline:queued', expect.any(Object));
  });

  it('syncs queued create operations', async () => {
    const operation = createOperation({ type: OfflineOperationType.CREATE });
    await offlineSync.queueCustomerOperation(operation);

    mockCustomerService.findById.mockResolvedValue(null);
    mockCustomerService.createCustomer.mockResolvedValue({ id: 'cust-123' });

    const result = await offlineSync.syncPendingOperations();

    expect(result.successful).toBe(1);
    expect(mockCustomerService.createCustomer).toHaveBeenCalledWith(operation.data);
  });

  it('detects version conflicts during update', async () => {
    const operation = createOperation({
      type: OfflineOperationType.UPDATE,
      version: 1,
      data: { phone: '555-000-0000' },
    });
    await offlineSync.queueCustomerOperation(operation);

    mockCustomerService.findById.mockResolvedValue({ id: 'cust-123', version: 2 });

    const result = await offlineSync.syncPendingOperations();

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]?.type).toBe('version_mismatch');
  });

  it('applies resolutions when resolving conflicts', async () => {
    const conflicts: SyncConflict[] = [
      {
        operationId: 'op-1',
        type: 'version_mismatch',
        localData: { phone: '555-111-1111' },
        remoteData: { id: 'cust-123', tenant_id: 'tenant-123' },
        message: 'Conflict',
      },
    ];

    mockCustomerService.updateCustomer.mockResolvedValue({});

    await offlineSync.resolveConflicts(conflicts, ['local']);

    expect(mockCustomerService.updateCustomer).toHaveBeenCalledWith(
      'cust-123',
      expect.objectContaining({ phone: '555-111-1111' })
    );
  });
});
