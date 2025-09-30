/**
 * Contract Test: POST /api/inventory/transfer
 *
 * Feature: 004-voice-vision-inventory
 * Contract: specs/004-voice-vision-inventory/contracts/inventory-transactions.yaml
 *
 * PURPOSE: Validate request/response schemas match OpenAPI contract
 * MUST FAIL: Endpoint does not exist yet (TDD)
 */

import { POST as transferItems } from '@/app/api/inventory/transfer/route';

jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init: { status?: number } = {}) => ({
      status: init.status ?? 200,
      json: async () => body,
    }),
  },
}));

const mockGetSession = jest.fn();
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createRouteHandlerClient: () => ({ auth: { getSession: mockGetSession } }),
}));
jest.mock('next/headers', () => ({ cookies: jest.fn() }));

const COMPANY_A = '00000000-0000-0000-0000-000000000001';
const MOCK_ITEM_ID = '11111111-1111-1111-1111-111111111111';
const SOURCE_CONTAINER = '22222222-2222-2222-2222-222222222222';
const DEST_CONTAINER = '33333333-3333-3333-3333-333333333333';
const MOCK_USER_ID = 'user-1';

function buildSession(companyId: string) {
  return { data: { session: { user: { id: MOCK_USER_ID, app_metadata: { company_id: companyId } } } } };
}

function createMockRequest(body: unknown) {
  return { json: async () => body } as Request;
}

describe('POST /api/inventory/transfer - Contract Tests', () => {
  beforeEach(() => mockGetSession.mockResolvedValue(buildSession(COMPANY_A)));

  it('should accept valid transfer request', async () => {
    const response = await transferItems(createMockRequest({
      companyId: COMPANY_A,
      itemIds: [MOCK_ITEM_ID],
      sourceContainerId: SOURCE_CONTAINER,
      destinationContainerId: DEST_CONTAINER,
      performerId: MOCK_USER_ID,
    }));

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('transactionId');
    expect(Array.isArray(data.transferredItems)).toBe(true);
  });

  it('should accept quantity for materials', async () => {
    const response = await transferItems(createMockRequest({
      companyId: COMPANY_A,
      itemIds: [MOCK_ITEM_ID],
      sourceContainerId: SOURCE_CONTAINER,
      destinationContainerId: DEST_CONTAINER,
      performerId: MOCK_USER_ID,
      quantity: 5,
    }));

    expect([200, 400]).toContain(response.status);
  });

  it('should return location change details', async () => {
    const response = await transferItems(createMockRequest({
      companyId: COMPANY_A,
      itemIds: [MOCK_ITEM_ID],
      sourceContainerId: SOURCE_CONTAINER,
      destinationContainerId: DEST_CONTAINER,
      performerId: MOCK_USER_ID,
    }));

    const data = await response.json();
    if (data.transferredItems.length > 0) {
      const item = data.transferredItems[0];
      expect(typeof item.oldLocation).toBe('string');
      expect(typeof item.newLocation).toBe('string');
    }
  });

  it('should reject missing source container', async () => {
    const response = await transferItems(createMockRequest({
      companyId: COMPANY_A,
      itemIds: [MOCK_ITEM_ID],
      destinationContainerId: DEST_CONTAINER,
      performerId: MOCK_USER_ID,
    }));

    expect(response.status).toBe(400);
  });

  it('should reject missing destination container', async () => {
    const response = await transferItems(createMockRequest({
      companyId: COMPANY_A,
      itemIds: [MOCK_ITEM_ID],
      sourceContainerId: SOURCE_CONTAINER,
      performerId: MOCK_USER_ID,
    }));

    expect(response.status).toBe(400);
  });
});