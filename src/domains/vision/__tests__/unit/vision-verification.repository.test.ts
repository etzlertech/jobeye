/**
 * @file /src/domains/vision/__tests__/unit/vision-verification.repository.test.ts
 * @phase 3.4
 * @domain Vision
 * @purpose Unit tests for vision verification repository
 */

import * as repo from '../../repositories/vision-verification.repository';
import { supabase } from '@/lib/supabase/client';

// Mock Supabase client
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    eq: jest.fn(),
    gte: jest.fn(),
    lte: jest.fn(),
    range: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    single: jest.fn(),
    then: jest.fn()
  }
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('Vision Verification Repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Set up return values to return the mock itself for chaining
    (mockSupabase.from as jest.Mock).mockReturnValue(mockSupabase);
    (mockSupabase.select as jest.Mock).mockReturnValue(mockSupabase);
    (mockSupabase.insert as jest.Mock).mockReturnValue(mockSupabase);
    (mockSupabase.update as jest.Mock).mockReturnValue(mockSupabase);
    (mockSupabase.delete as jest.Mock).mockReturnValue(mockSupabase);
    (mockSupabase.eq as jest.Mock).mockReturnValue(mockSupabase);
    (mockSupabase.gte as jest.Mock).mockReturnValue(mockSupabase);
    (mockSupabase.lte as jest.Mock).mockReturnValue(mockSupabase);
    (mockSupabase.range as jest.Mock).mockReturnValue(mockSupabase);
    (mockSupabase.order as jest.Mock).mockReturnValue(mockSupabase);
    (mockSupabase.limit as jest.Mock).mockReturnValue(mockSupabase);
    (mockSupabase.single as jest.Mock).mockReturnValue(mockSupabase);

    // Make it thenable - by default resolve with empty result
    (mockSupabase.then as jest.Mock).mockImplementation((resolve: any) => {
      return Promise.resolve({ data: null, error: null }).then(resolve);
    });
  });

  describe('findVerificationById', () => {
    it('should find verification by ID', async () => {
      const mockVerification = {
        id: 'test-id',
        tenant_id: 'company-123',
        kit_id: 'kit-456',
        verification_result: 'complete',
        confidence_score: 0.85
      };

      mockSupabase.single.mockResolvedValue({
        data: mockVerification,
        error: null
      });

      const result = await repo.findVerificationById('test-id');

      expect(result.data).toEqual(mockVerification);
      expect(result.error).toBeNull();
      expect(mockSupabase.from).toHaveBeenCalledWith('vision_verifications');
      expect(mockSupabase.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'test-id');
    });

    it('should handle not found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' }
      });

      const result = await repo.findVerificationById('nonexistent');

      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Not found');
    });
  });

  describe('findVerifications', () => {
    it('should find verifications with filters', async () => {
      const mockData = [
        { id: '1', tenant_id: 'company-123', verification_result: 'complete' },
        { id: '2', tenant_id: 'company-123', verification_result: 'incomplete' }
      ];

      mockSupabase.order.mockResolvedValue({
        data: mockData,
        error: null,
        count: 2
      });

      const result = await repo.findVerifications({
        companyId: 'company-123',
        verificationResult: 'complete'
      });

      expect(result.data).toEqual(mockData);
      expect(result.count).toBe(2);
      expect(mockSupabase.eq).toHaveBeenCalledWith('tenant_id', 'company-123');
      expect(mockSupabase.eq).toHaveBeenCalledWith('verification_result', 'complete');
    });

    it('should apply date range filters', async () => {
      mockSupabase.order.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      });

      await repo.findVerifications({
        verifiedAfter: '2024-01-01',
        verifiedBefore: '2024-12-31'
      });

      expect(mockSupabase.gte).toHaveBeenCalledWith('verified_at', '2024-01-01');
      expect(mockSupabase.lte).toHaveBeenCalledWith('verified_at', '2024-12-31');
    });

    it('should apply pagination', async () => {
      mockSupabase.order.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      });

      await repo.findVerifications({
        limit: 25,
        offset: 50
      });

      expect(mockSupabase.range).toHaveBeenCalledWith(50, 74); // offset to offset+limit-1
    });

    it('should use default pagination', async () => {
      mockSupabase.order.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      });

      await repo.findVerifications({});

      expect(mockSupabase.range).toHaveBeenCalledWith(0, 49); // default limit 50
    });
  });

  describe('createVerification', () => {
    it('should create verification record', async () => {
      const newVerification = {
        tenant_id: 'company-123',
        kit_id: 'kit-456',
        verification_result: 'complete' as const,
        confidence_score: 0.85
      };

      const mockCreated = { id: 'new-id', ...newVerification };

      mockSupabase.single.mockResolvedValue({
        data: mockCreated,
        error: null
      });

      const result = await repo.createVerification(newVerification);

      expect(result.data).toEqual(mockCreated);
      expect(result.error).toBeNull();
      expect(mockSupabase.insert).toHaveBeenCalledWith(newVerification);
      expect(mockSupabase.select).toHaveBeenCalled();
    });

    it('should handle creation errors', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Duplicate key' }
      });

      const result = await repo.createVerification({
        tenant_id: 'company-123',
        kit_id: 'kit-456'
      } as any);

      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
    });
  });

  describe('updateVerification', () => {
    it('should update verification record', async () => {
      const updates = {
        verification_result: 'complete' as const,
        confidence_score: 0.90
      };

      const mockUpdated = { id: 'test-id', ...updates };

      mockSupabase.single.mockResolvedValue({
        data: mockUpdated,
        error: null
      });

      const result = await repo.updateVerification('test-id', updates);

      expect(result.data).toEqual(mockUpdated);
      expect(mockSupabase.update).toHaveBeenCalledWith(updates);
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'test-id');
    });
  });

  describe('deleteVerification', () => {
    it('should delete verification record', async () => {
      mockSupabase.then.mockImplementation((resolve: any) => {
        return Promise.resolve({ error: null }).then(resolve);
      });

      const result = await repo.deleteVerification('test-id');

      expect(result.error).toBeNull();
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'test-id');
    });

    it('should handle delete errors', async () => {
      mockSupabase.then.mockImplementation((resolve: any) => {
        return Promise.resolve({ error: { message: 'Not found' } }).then(resolve);
      });

      const result = await repo.deleteVerification('nonexistent');

      expect(result.error).toBeInstanceOf(Error);
    });
  });

  describe('getVerificationStats', () => {
    it('should calculate statistics', async () => {
      const mockData = [
        { verification_result: 'complete', processing_method: 'local_yolo', confidence_score: 0.85 },
        { verification_result: 'complete', processing_method: 'cloud_vlm', confidence_score: 0.92 },
        { verification_result: 'incomplete', processing_method: 'local_yolo', confidence_score: 0.65 },
        { verification_result: 'failed', processing_method: 'cloud_vlm', confidence_score: 0.50 }
      ];

      mockSupabase.then.mockImplementation((resolve: any) => {
        return Promise.resolve({ data: mockData, error: null }).then(resolve);
      });

      const result = await repo.getVerificationStats('company-123');

      expect(result.data).toEqual({
        total: 4,
        complete: 2,
        incomplete: 1,
        failed: 1,
        yoloCount: 2,
        vlmCount: 2,
        avgConfidence: 0.73
      });
    });

    it('should handle empty results', async () => {
      mockSupabase.then.mockImplementation((resolve: any) => {
        return Promise.resolve({ data: [], error: null }).then(resolve);
      });

      const result = await repo.getVerificationStats('company-123');

      expect(result.data).toEqual({
        total: 0,
        complete: 0,
        incomplete: 0,
        failed: 0,
        yoloCount: 0,
        vlmCount: 0,
        avgConfidence: 0
      });
    });

    it('should apply date filters', async () => {
      mockSupabase.then.mockImplementation((resolve: any) => {
        return Promise.resolve({ data: [], error: null }).then(resolve);
      });

      await repo.getVerificationStats(
        'company-123',
        '2024-01-01',
        '2024-12-31'
      );

      expect(mockSupabase.gte).toHaveBeenCalledWith('verified_at', '2024-01-01');
      expect(mockSupabase.lte).toHaveBeenCalledWith('verified_at', '2024-12-31');
    });
  });

  describe('findLatestVerificationForKit', () => {
    it('should find most recent verification', async () => {
      const mockVerification = {
        id: 'latest-id',
        kit_id: 'kit-456',
        verified_at: '2024-12-01T10:00:00Z'
      };

      mockSupabase.single.mockResolvedValue({
        data: mockVerification,
        error: null
      });

      const result = await repo.findLatestVerificationForKit('kit-456');

      expect(result.data).toEqual(mockVerification);
      expect(mockSupabase.eq).toHaveBeenCalledWith('kit_id', 'kit-456');
      expect(mockSupabase.order).toHaveBeenCalledWith('verified_at', { ascending: false });
      expect(mockSupabase.limit).toHaveBeenCalledWith(1);
    });
  });
});