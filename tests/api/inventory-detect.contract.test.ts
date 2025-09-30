/**
 * Contract Test: POST /api/inventory/detect
 *
 * Feature: 004-voice-vision-inventory
 * Contract: specs/004-voice-vision-inventory/contracts/inventory-detection.yaml
 *
 * PURPOSE: Validate request/response schemas match OpenAPI contract
 * MUST FAIL: Endpoint does not exist yet (TDD)
 */

import { POST as detectItems } from '@/app/api/inventory/detect/route';

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

function createMockRequest(body: unknown, companyId: string = COMPANY_A) {
  const formData = new FormData();
  if (typeof body === 'object' && body !== null) {
    Object.entries(body).forEach(([key, value]) => {
      if (value instanceof File) {
        formData.append(key, value);
      } else {
        formData.append(key, JSON.stringify(value));
      }
    });
  }

  return {
    method: 'POST',
    formData: async () => formData,
    headers: {
      get: (key: string) => {
        if (key === 'content-type') return 'multipart/form-data';
        return null;
      },
    },
  } as unknown as Request;
}

describe('POST /api/inventory/detect - Contract Tests', () => {
  beforeEach(() => {
    mockGetSession.mockResolvedValue(buildSession(COMPANY_A));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Request Schema Validation', () => {
    it('should accept valid minimal request', async () => {
      const photo = new File(['fake-image-data'], 'test.jpg', { type: 'image/jpeg' });

      const request = createMockRequest({
        photo,
        companyId: COMPANY_A,
      });

      const response = await detectItems(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('detectionId');
      expect(data).toHaveProperty('detections');
      expect(data).toHaveProperty('method');
      expect(data).toHaveProperty('processingTimeMs');
      expect(data).toHaveProperty('costUsd');
    });

    it('should accept request with full context', async () => {
      const photo = new File(['fake-image-data'], 'test.jpg', { type: 'image/jpeg' });

      const request = createMockRequest({
        photo,
        companyId: COMPANY_A,
        context: {
          gpsLat: 37.7749,
          gpsLng: -122.4194,
          locationType: 'customer_site',
          transactionIntent: 'check_out',
          expectedItems: ['mower', 'trimmer'],
        },
      });

      const response = await detectItems(request);
      expect(response.status).toBe(200);
    });

    it('should reject request without photo', async () => {
      const request = createMockRequest({
        companyId: COMPANY_A,
      });

      const response = await detectItems(request);
      expect(response.status).toBe(400);
    });

    it('should reject request without companyId', async () => {
      const photo = new File(['fake-image-data'], 'test.jpg', { type: 'image/jpeg' });

      const request = createMockRequest({
        photo,
      });

      const response = await detectItems(request);
      expect(response.status).toBe(400);
    });

    it('should reject photo over 10MB', async () => {
      // Create 11MB file
      const largeData = new Uint8Array(11 * 1024 * 1024);
      const photo = new File([largeData], 'large.jpg', { type: 'image/jpeg' });

      const request = createMockRequest({
        photo,
        companyId: COMPANY_A,
      });

      const response = await detectItems(request);
      expect(response.status).toBe(413);
    });

    it('should validate locationType enum', async () => {
      const photo = new File(['fake-image-data'], 'test.jpg', { type: 'image/jpeg' });

      const request = createMockRequest({
        photo,
        companyId: COMPANY_A,
        context: {
          locationType: 'invalid_location',
        },
      });

      const response = await detectItems(request);
      expect(response.status).toBe(400);
    });

    it('should validate transactionIntent enum', async () => {
      const photo = new File(['fake-image-data'], 'test.jpg', { type: 'image/jpeg' });

      const request = createMockRequest({
        photo,
        companyId: COMPANY_A,
        context: {
          transactionIntent: 'invalid_intent',
        },
      });

      const response = await detectItems(request);
      expect(response.status).toBe(400);
    });
  });

  describe('Response Schema Validation', () => {
    it('should return all required fields', async () => {
      const photo = new File(['fake-image-data'], 'test.jpg', { type: 'image/jpeg' });

      const request = createMockRequest({
        photo,
        companyId: COMPANY_A,
      });

      const response = await detectItems(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(typeof data.detectionId).toBe('string');
      expect(Array.isArray(data.detections)).toBe(true);
      expect(['local_yolo', 'cloud_vlm']).toContain(data.method);
      expect(typeof data.processingTimeMs).toBe('number');
      expect(typeof data.costUsd).toBe('number');
    });

    it('should return valid DetectedItem schema', async () => {
      const photo = new File(['fake-image-data'], 'test.jpg', { type: 'image/jpeg' });

      const request = createMockRequest({
        photo,
        companyId: COMPANY_A,
      });

      const response = await detectItems(request);
      const data = await response.json();

      if (data.detections.length > 0) {
        const detection = data.detections[0];
        expect(typeof detection.detectionNumber).toBe('number');
        expect(detection.detectionNumber).toBeGreaterThan(0);
        expect(typeof detection.label).toBe('string');
        expect(typeof detection.confidence).toBe('number');
        expect(detection.confidence).toBeGreaterThanOrEqual(0);
        expect(detection.confidence).toBeLessThanOrEqual(1);
        expect(typeof detection.cropUrl).toBe('string');
        expect(detection.boundingBox).toHaveProperty('x');
        expect(detection.boundingBox).toHaveProperty('y');
        expect(detection.boundingBox).toHaveProperty('width');
        expect(detection.boundingBox).toHaveProperty('height');
      }
    });

    it('should include budgetStatus when present', async () => {
      const photo = new File(['fake-image-data'], 'test.jpg', { type: 'image/jpeg' });

      const request = createMockRequest({
        photo,
        companyId: COMPANY_A,
      });

      const response = await detectItems(request);
      const data = await response.json();

      if (data.budgetStatus) {
        expect(typeof data.budgetStatus.dailyBudgetCap).toBe('number');
        expect(typeof data.budgetStatus.todaySpent).toBe('number');
        expect(typeof data.budgetStatus.remainingBudget).toBe('number');
        expect(typeof data.budgetStatus.requestsRemaining).toBe('number');
      }
    });

    it('should include groupedDetections when similarity >90%', async () => {
      const photo = new File(['fake-image-data'], 'test.jpg', { type: 'image/jpeg' });

      const request = createMockRequest({
        photo,
        companyId: COMPANY_A,
      });

      const response = await detectItems(request);
      const data = await response.json();

      if (data.groupedDetections && data.groupedDetections.length > 0) {
        const group = data.groupedDetections[0];
        expect(typeof group.groupId).toBe('number');
        expect(typeof group.label).toBe('string');
        expect(typeof group.quantity).toBe('number');
        expect(typeof group.confidence).toBe('number');
        expect(Array.isArray(group.detectionNumbers)).toBe(true);
        expect(typeof group.representativeCropUrl).toBe('string');
      }
    });

    it('should include filteredObjects for background items', async () => {
      const photo = new File(['fake-image-data'], 'test.jpg', { type: 'image/jpeg' });

      const request = createMockRequest({
        photo,
        companyId: COMPANY_A,
      });

      const response = await detectItems(request);
      const data = await response.json();

      if (data.filteredObjects && data.filteredObjects.length > 0) {
        const filtered = data.filteredObjects[0];
        expect(typeof filtered.label).toBe('string');
        expect(typeof filtered.confidence).toBe('number');
        expect(['high_confidence_background', 'user_preference', 'low_value_item']).toContain(filtered.reason);
        expect(typeof filtered.showInReview).toBe('boolean');
      }
    });
  });

  describe('Error Response Validation', () => {
    it('should return 429 when daily VLM budget exceeded', async () => {
      // This will be implemented when budget tracking is in place
      expect(true).toBe(true);
    });

    it('should return 500 with errorId for internal errors', async () => {
      // This will be tested once error handling is implemented
      expect(true).toBe(true);
    });
  });
});