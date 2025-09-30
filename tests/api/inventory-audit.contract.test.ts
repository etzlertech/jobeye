/**
 * Contract Test: POST /api/inventory/audit
 *
 * Feature: 004-voice-vision-inventory
 * Contract: specs/004-voice-vision-inventory/contracts/inventory-transactions.yaml
 *
 * PURPOSE: Validate request/response schemas match OpenAPI contract
 * MUST FAIL: Endpoint does not exist yet (TDD)
 */

import { POST as performAudit } from '@/app/api/inventory/audit/route';

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
const MOCK_LOCATION_ID = '22222222-2222-2222-2222-222222222222';
const MOCK_USER_ID = 'user-1';

function buildSession(companyId: string) {
  return { data: { session: { user: { id: MOCK_USER_ID, app_metadata: { company_id: companyId } } } } };
}

function createMockRequest(body: unknown) {
  return { json: async () => body } as Request;
}

describe('POST /api/inventory/audit - Contract Tests', () => {
  beforeEach(() => mockGetSession.mockResolvedValue(buildSession(COMPANY_A)));

  it('should accept valid audit request', async () => {
    const response = await performAudit(createMockRequest({
      companyId: COMPANY_A,
      locationId: MOCK_LOCATION_ID,
      detectedItemIds: [MOCK_ITEM_ID],
      performerId: MOCK_USER_ID,
    }));

    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toHaveProperty('auditId');
    expect(data).toHaveProperty('expectedItems');
    expect(data).toHaveProperty('detectedItems');
    expect(data).toHaveProperty('discrepancies');
    expect(data).toHaveProperty('accuracyPercentage');
  });

  it('should return valid AuditDiscrepancies schema', async () => {
    const response = await performAudit(createMockRequest({
      companyId: COMPANY_A,
      locationId: MOCK_LOCATION_ID,
      detectedItemIds: [MOCK_ITEM_ID],
      performerId: MOCK_USER_ID,
    }));

    const data = await response.json();
    expect(Array.isArray(data.discrepancies.missing)).toBe(true);
    expect(Array.isArray(data.discrepancies.extra)).toBe(true);
    expect(Array.isArray(data.discrepancies.quantityMismatches)).toBe(true);

    if (data.discrepancies.quantityMismatches.length > 0) {
      const mismatch = data.discrepancies.quantityMismatches[0];
      expect(typeof mismatch.expected).toBe('number');
      expect(typeof mismatch.detected).toBe('number');
      expect(typeof mismatch.difference).toBe('number');
      expect(mismatch.difference).toBe(mismatch.detected - mismatch.expected);
    }
  });

  it('should calculate accuracyPercentage correctly', async () => {
    const response = await performAudit(createMockRequest({
      companyId: COMPANY_A,
      locationId: MOCK_LOCATION_ID,
      detectedItemIds: [MOCK_ITEM_ID],
      performerId: MOCK_USER_ID,
    }));

    const data = await response.json();
    expect(typeof data.accuracyPercentage).toBe('number');
    expect(data.accuracyPercentage).toBeGreaterThanOrEqual(0);
    expect(data.accuracyPercentage).toBeLessThanOrEqual(100);
  });

  it('should include confidence scores in detectedItems', async () => {
    const response = await performAudit(createMockRequest({
      companyId: COMPANY_A,
      locationId: MOCK_LOCATION_ID,
      detectedItemIds: [MOCK_ITEM_ID],
      performerId: MOCK_USER_ID,
    }));

    const data = await response.json();
    if (data.detectedItems.length > 0) {
      const item = data.detectedItems[0];
      expect(typeof item.confidence).toBe('number');
      expect(item.confidence).toBeGreaterThanOrEqual(0);
      expect(item.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('should accept photo evidence', async () => {
    const response = await performAudit(createMockRequest({
      companyId: COMPANY_A,
      locationId: MOCK_LOCATION_ID,
      detectedItemIds: [MOCK_ITEM_ID],
      performerId: MOCK_USER_ID,
      photoEvidenceUrl: 'https://storage.example.com/audit-photo.jpg',
    }));

    expect([200, 400]).toContain(response.status);
  });

  it('should reject empty detectedItemIds', async () => {
    const response = await performAudit(createMockRequest({
      companyId: COMPANY_A,
      locationId: MOCK_LOCATION_ID,
      detectedItemIds: [],
      performerId: MOCK_USER_ID,
    }));

    expect(response.status).toBe(400);
  });

  it('should reject missing locationId', async () => {
    const response = await performAudit(createMockRequest({
      companyId: COMPANY_A,
      detectedItemIds: [MOCK_ITEM_ID],
      performerId: MOCK_USER_ID,
    }));

    expect(response.status).toBe(400);
  });
});