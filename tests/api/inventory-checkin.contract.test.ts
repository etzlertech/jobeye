/**
 * Contract Test: POST /api/inventory/check-in
 *
 * Feature: 004-voice-vision-inventory
 * Contract: specs/004-voice-vision-inventory/contracts/inventory-transactions.yaml
 *
 * PURPOSE: Validate request/response schemas match OpenAPI contract
 * MUST FAIL: Endpoint does not exist yet (TDD)
 */

import { POST as checkInItems } from '@/app/api/inventory/check-in/route';

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
const MOCK_CONTAINER_ID = '22222222-2222-2222-2222-222222222222';
const MOCK_USER_ID = 'user-1';

function buildSession(companyId: string) {
  return { data: { session: { user: { id: MOCK_USER_ID, app_metadata: { company_id: companyId } } } } };
}

function createMockRequest(body: unknown) {
  return { json: async () => body } as Request;
}

describe('POST /api/inventory/check-in - Contract Tests', () => {
  beforeEach(() => mockGetSession.mockResolvedValue(buildSession(COMPANY_A)));

  it('should accept valid minimal request', async () => {
    const response = await checkInItems(createMockRequest({
      companyId: COMPANY_A,
      itemIds: [MOCK_ITEM_ID],
      sourceContainerId: MOCK_CONTAINER_ID,
      performerId: MOCK_USER_ID,
    }));

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('transactionId');
    expect(data).toHaveProperty('checkedInItems');
    expect(data).toHaveProperty('discrepancies');
  });

  it('should return CheckInDiscrepancies schema', async () => {
    const response = await checkInItems(createMockRequest({
      companyId: COMPANY_A,
      itemIds: [MOCK_ITEM_ID],
      sourceContainerId: MOCK_CONTAINER_ID,
      performerId: MOCK_USER_ID,
    }));

    const data = await response.json();
    expect(Array.isArray(data.discrepancies.missingItems)).toBe(true);
    expect(Array.isArray(data.discrepancies.unexpectedItems)).toBe(true);

    if (data.discrepancies.unexpectedItems.length > 0) {
      const item = data.discrepancies.unexpectedItems[0];
      expect(['purchased', 'borrowed', 'found', 'other']).toContain(item.reason);
    }
  });

  it('should calculate durationHours for checked-in items', async () => {
    const response = await checkInItems(createMockRequest({
      companyId: COMPANY_A,
      itemIds: [MOCK_ITEM_ID],
      sourceContainerId: MOCK_CONTAINER_ID,
      performerId: MOCK_USER_ID,
    }));

    const data = await response.json();
    if (data.checkedInItems.length > 0 && data.checkedInItems[0].wasCheckedOut) {
      expect(typeof data.checkedInItems[0].durationHours).toBe('number');
    }
  });
});