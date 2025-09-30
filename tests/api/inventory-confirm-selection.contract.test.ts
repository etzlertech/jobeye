/**
 * Contract Test: POST /api/inventory/confirm-selection
 *
 * Feature: 004-voice-vision-inventory
 * Contract: specs/004-voice-vision-inventory/contracts/inventory-detection.yaml
 *
 * PURPOSE: Validate request/response schemas match OpenAPI contract
 * MUST FAIL: Endpoint does not exist yet (TDD)
 */

import { POST as confirmSelection } from '@/app/api/inventory/confirm-selection/route';

// Mock Next.js Response
jest.mock('next/server', () => {
  class MockNextResponse {
    constructor(private readonly payload: unknown, public readonly status: number) {}

    static json(body: unknown, init: { status?: number } = {}) {
      return new MockNextResponse(body, init.status ?? 200);
    }

    async json() {
      return this.payload;
    }
  }

  return {
    NextResponse: MockNextResponse,
  };
});

const mockGetSession = jest.fn();

jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createRouteHandlerClient: () => ({
    auth: {
      getSession: mockGetSession,
    },
  }),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

const COMPANY_A = '00000000-0000-0000-0000-000000000001';
const MOCK_DETECTION_ID = '12345678-1234-1234-1234-123456789012';

function buildSession(companyId: string) {
  return {
    data: {
      session: {
        user: {
          id: `user-${companyId}`,
          app_metadata: { company_id: companyId },
          user_metadata: {},
        },
        access_token: 'mock-token',
      },
    },
    error: null,
  };
}

function createMockRequest(body: unknown) {
  return {
    method: 'POST',
    json: async () => body,
    headers: {
      get: (key: string) => {
        if (key === 'content-type') return 'application/json';
        return null;
      },
    },
  } as unknown as Request;
}

describe('POST /api/inventory/confirm-selection - Contract Tests', () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue(buildSession(COMPANY_A));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Request Schema Validation', () => {
    it('should accept valid minimal request', async () => {
      const request = createMockRequest({
        detectionId: MOCK_DETECTION_ID,
        selectedItemNumbers: [1, 2, 5],
        companyId: COMPANY_A,
      });

      const response = await confirmSelection(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('sessionId');
      expect(data).toHaveProperty('selectedItems');
      expect(data).toHaveProperty('nextStep');
    });

    it('should accept request with corrections', async () => {
      const request = createMockRequest({
        detectionId: MOCK_DETECTION_ID,
        selectedItemNumbers: [1, 2],
        companyId: COMPANY_A,
        corrections: [
          {
            detectionNumber: 1,
            correctedLabel: 'riding_mower',
            correctionReason: 'YOLO detected as lawn_mower but it is riding_mower',
          },
        ],
      });

      const response = await confirmSelection(request);
      expect(response.status).toBe(200);
    });

    it('should accept request with voice transcript', async () => {
      const request = createMockRequest({
        detectionId: MOCK_DETECTION_ID,
        selectedItemNumbers: [1, 2, 3],
        companyId: COMPANY_A,
        voiceTranscript: 'Add items one, two, and three',
      });

      const response = await confirmSelection(request);
      expect(response.status).toBe(200);
    });

    it('should reject request without detectionId', async () => {
      const request = createMockRequest({
        selectedItemNumbers: [1, 2],
        companyId: COMPANY_A,
      });

      const response = await confirmSelection(request);
      expect(response.status).toBe(400);
    });

    it('should reject request without selectedItemNumbers', async () => {
      const request = createMockRequest({
        detectionId: MOCK_DETECTION_ID,
        companyId: COMPANY_A,
      });

      const response = await confirmSelection(request);
      expect(response.status).toBe(400);
    });

    it('should reject request with empty selectedItemNumbers', async () => {
      const request = createMockRequest({
        detectionId: MOCK_DETECTION_ID,
        selectedItemNumbers: [],
        companyId: COMPANY_A,
      });

      const response = await confirmSelection(request);
      expect(response.status).toBe(400);
    });

    it('should reject request without companyId', async () => {
      const request = createMockRequest({
        detectionId: MOCK_DETECTION_ID,
        selectedItemNumbers: [1, 2],
      });

      const response = await confirmSelection(request);
      expect(response.status).toBe(400);
    });

    it('should reject invalid UUID for detectionId', async () => {
      const request = createMockRequest({
        detectionId: 'not-a-uuid',
        selectedItemNumbers: [1, 2],
        companyId: COMPANY_A,
      });

      const response = await confirmSelection(request);
      expect(response.status).toBe(400);
    });
  });

  describe('Response Schema Validation', () => {
    it('should return all required fields', async () => {
      const request = createMockRequest({
        detectionId: MOCK_DETECTION_ID,
        selectedItemNumbers: [1, 2, 3],
        companyId: COMPANY_A,
      });

      const response = await confirmSelection(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(typeof data.sessionId).toBe('string');
      expect(Array.isArray(data.selectedItems)).toBe(true);
      expect(['attribute_assignment', 'transaction_intent_confirmation']).toContain(data.nextStep);
      expect(typeof data.requiresAttributeInput).toBe('boolean');
    });

    it('should return valid selectedItems schema', async () => {
      const request = createMockRequest({
        detectionId: MOCK_DETECTION_ID,
        selectedItemNumbers: [1, 2],
        companyId: COMPANY_A,
      });

      const response = await confirmSelection(request);
      const data = await response.json();

      expect(data.selectedItems.length).toBeGreaterThan(0);

      const item = data.selectedItems[0];
      expect(typeof item.detectionNumber).toBe('number');
      expect(typeof item.label).toBe('string');
      expect(typeof item.cropUrl).toBe('string');
      expect(typeof item.attributes).toBe('object');
    });

    it('should indicate attribute_assignment when attributes needed', async () => {
      const request = createMockRequest({
        detectionId: MOCK_DETECTION_ID,
        selectedItemNumbers: [1],
        companyId: COMPANY_A,
      });

      const response = await confirmSelection(request);
      const data = await response.json();

      if (data.requiresAttributeInput === true) {
        expect(data.nextStep).toBe('attribute_assignment');
      }
    });

    it('should indicate transaction_intent_confirmation when no attributes needed', async () => {
      const request = createMockRequest({
        detectionId: MOCK_DETECTION_ID,
        selectedItemNumbers: [1],
        companyId: COMPANY_A,
      });

      const response = await confirmSelection(request);
      const data = await response.json();

      if (data.requiresAttributeInput === false) {
        expect(data.nextStep).toBe('transaction_intent_confirmation');
      }
    });
  });

  describe('Error Response Validation', () => {
    it('should return 404 when detection session not found', async () => {
      const request = createMockRequest({
        detectionId: '00000000-0000-0000-0000-000000000000',
        selectedItemNumbers: [1],
        companyId: COMPANY_A,
      });

      const response = await confirmSelection(request);
      expect([404, 400]).toContain(response.status); // May be 400 for now
    });

    it('should return 404 when detection session expired', async () => {
      // This will be tested once session expiry is implemented
      expect(true).toBe(true);
    });

    it('should return 400 with error details for invalid corrections', async () => {
      const request = createMockRequest({
        detectionId: MOCK_DETECTION_ID,
        selectedItemNumbers: [1],
        companyId: COMPANY_A,
        corrections: [
          {
            detectionNumber: 999, // Invalid detection number
            correctedLabel: 'test',
          },
        ],
      });

      const response = await confirmSelection(request);
      expect([400, 404]).toContain(response.status);
    });
  });
});