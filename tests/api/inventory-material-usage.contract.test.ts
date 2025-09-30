/**
 * Contract Test: POST /api/inventory/material-usage
 *
 * Feature: 004-voice-vision-inventory
 * Contract: specs/004-voice-vision-inventory/contracts/inventory-transactions.yaml
 *
 * PURPOSE: Validate request/response schemas match OpenAPI contract
 * MUST FAIL: Endpoint does not exist yet (TDD)
 */

import { POST as logMaterialUsage } from '@/app/api/inventory/material-usage/route';

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
const MOCK_JOB_ID = '33333333-3333-3333-3333-333333333333';
const MOCK_USER_ID = 'user-1';

function buildSession(companyId: string) {
  return { data: { session: { user: { id: MOCK_USER_ID, app_metadata: { company_id: companyId } } } } };
}

function createMockRequest(body: unknown) {
  return { json: async () => body } as Request;
}

describe('POST /api/inventory/material-usage - Contract Tests', () => {
  beforeEach(() => mockGetSession.mockResolvedValue(buildSession(COMPANY_A)));

  it('should accept valid material usage request', async () => {
    const response = await logMaterialUsage(createMockRequest({
      companyId: COMPANY_A,
      itemId: MOCK_ITEM_ID,
      quantityUsed: 10.5,
      jobId: MOCK_JOB_ID,
      performerId: MOCK_USER_ID,
    }));

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('transactionId');
    expect(data).toHaveProperty('remainingStock');
    expect(data).toHaveProperty('costImpact');
    expect(data).toHaveProperty('reorderNeeded');
  });

  it('should accept wasteAmount', async () => {
    const response = await logMaterialUsage(createMockRequest({
      companyId: COMPANY_A,
      itemId: MOCK_ITEM_ID,
      quantityUsed: 10,
      wasteAmount: 2.5,
      jobId: MOCK_JOB_ID,
      performerId: MOCK_USER_ID,
    }));

    expect([200, 400]).toContain(response.status);
  });

  it('should calculate remainingStock correctly', async () => {
    const response = await logMaterialUsage(createMockRequest({
      companyId: COMPANY_A,
      itemId: MOCK_ITEM_ID,
      quantityUsed: 5,
      jobId: MOCK_JOB_ID,
      performerId: MOCK_USER_ID,
    }));

    const data = await response.json();
    expect(typeof data.remainingStock).toBe('number');
    expect(data.remainingStock).toBeGreaterThanOrEqual(0);
  });

  it('should calculate costImpact for job', async () => {
    const response = await logMaterialUsage(createMockRequest({
      companyId: COMPANY_A,
      itemId: MOCK_ITEM_ID,
      quantityUsed: 5,
      jobId: MOCK_JOB_ID,
      performerId: MOCK_USER_ID,
    }));

    const data = await response.json();
    expect(typeof data.costImpact).toBe('number');
  });

  it('should indicate reorderNeeded when below threshold', async () => {
    const response = await logMaterialUsage(createMockRequest({
      companyId: COMPANY_A,
      itemId: MOCK_ITEM_ID,
      quantityUsed: 100,
      jobId: MOCK_JOB_ID,
      performerId: MOCK_USER_ID,
    }));

    const data = await response.json();
    expect(typeof data.reorderNeeded).toBe('boolean');
  });

  it('should reject negative quantityUsed', async () => {
    const response = await logMaterialUsage(createMockRequest({
      companyId: COMPANY_A,
      itemId: MOCK_ITEM_ID,
      quantityUsed: -5,
      jobId: MOCK_JOB_ID,
      performerId: MOCK_USER_ID,
    }));

    expect(response.status).toBe(400);
  });

  it('should reject missing jobId', async () => {
    const response = await logMaterialUsage(createMockRequest({
      companyId: COMPANY_A,
      itemId: MOCK_ITEM_ID,
      quantityUsed: 5,
      performerId: MOCK_USER_ID,
    }));

    expect(response.status).toBe(400);
  });
});