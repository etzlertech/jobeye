/**
 * @file /src/domains/vision/__tests__/unit/vision-verification.repository.test.ts
 * @phase 3.4
 * @domain Vision
 * @purpose Unit tests for vision verification repository
 */

import * as repo from '../../repositories/vision-verification.repository';
import { createMockSupabaseClient } from '@/__tests__/mocks/supabase-client.mock';

// Mock Supabase client
jest.mock('@/lib/supabase/client');

const mockSupabase = createMockSupabaseClient();

describe('Vision Verification Repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase._clearMockData();
    
    // Mock the module to return our mock client
    require('@/lib/supabase/client').supabase = mockSupabase;
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

      // Set up mock data
      mockSupabase._setMockData('vision_verifications', [mockVerification]);

      const result = await repo.findVerificationById('test-id');

      expect(result.data).toEqual(mockVerification);
      expect(result.error).toBeNull();
    });

    it('should handle not found', async () => {
      // Don't set any mock data, so it should return null
      const result = await repo.findVerificationById('nonexistent');

      expect(result.data).toBeNull();
    });
  });

  describe('findVerifications', () => {
    it('should find verifications with filters', async () => {
      const mockData = [
        { id: '1', tenant_id: 'company-123', verification_result: 'complete' },
        { id: '2', tenant_id: 'company-123', verification_result: 'incomplete' }
      ];

      // Set up mock data
      mockSupabase._setMockData('vision_verifications', mockData);

      const result = await repo.findVerifications({
        tenantId: 'company-123',
        verificationResult: 'complete'
      });

      // Should filter for complete results only
      expect(result.data.length).toBe(1);
      expect(result.data[0].verification_result).toBe('complete');
      expect(result.count).toBe(1);
    });

    it('should apply date range filters', async () => {
      // Set up empty mock data for filtering test
      mockSupabase._setMockData('vision_verifications', []);

      const result = await repo.findVerifications({
        verifiedAfter: '2024-01-01',
        verifiedBefore: '2024-12-31'
      });

      expect(result.data).toEqual([]);
      expect(result.count).toBe(0);
    });

    it('should apply pagination', async () => {
      // Set up mock data for pagination test
      mockSupabase._setMockData('vision_verifications', []);

      const result = await repo.findVerifications({
        limit: 25,
        offset: 50
      });

      expect(result.data).toEqual([]);
      expect(result.count).toBe(0);
    });

    it('should use default pagination', async () => {
      // Set up mock data for default pagination test
      mockSupabase._setMockData('vision_verifications', []);

      const result = await repo.findVerifications({});

      expect(result.data).toEqual([]);
      expect(result.count).toBe(0);
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

      const result = await repo.createVerification(newVerification);

      expect(result.data).toMatchObject(newVerification);
      expect(result.data.id).toBeDefined();
      expect(result.error).toBeNull();
    });

    it('should handle creation errors', async () => {
      // Mock an error by setting up invalid data scenario
      mockSupabase._setMockError(new Error('Duplicate key'));

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
      const existingRecord = {
        id: 'test-id',
        tenant_id: 'company-123',
        verification_result: 'incomplete' as const,
        confidence_score: 0.70
      };
      
      const updates = {
        verification_result: 'complete' as const,
        confidence_score: 0.90
      };

      // Set up existing record
      mockSupabase._setMockData('vision_verifications', [existingRecord]);

      const result = await repo.updateVerification('test-id', updates);

      expect(result.data).toMatchObject({ ...existingRecord, ...updates });
      expect(result.error).toBeNull();
    });
  });

  describe('deleteVerification', () => {
    it('should delete verification record', async () => {
      const existingRecord = {
        id: 'test-id',
        tenant_id: 'company-123',
        verification_result: 'complete' as const
      };

      // Set up existing record
      mockSupabase._setMockData('vision_verifications', [existingRecord]);

      const result = await repo.deleteVerification('test-id');

      expect(result.error).toBeNull();
    });

    it('should handle delete errors', async () => {
      // Mock an error scenario
      mockSupabase._setMockError(new Error('Not found'));

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

      // Set up mock data for statistics calculation
      mockSupabase._setMockData('vision_verifications', mockData);

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
      // Set up empty mock data
      mockSupabase._setMockData('vision_verifications', []);

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
      // Set up mock data for date filter test
      mockSupabase._setMockData('vision_verifications', []);

      const result = await repo.getVerificationStats(
        'company-123',
        '2024-01-01',
        '2024-12-31'
      );

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
  });

  describe('findLatestVerificationForKit', () => {
    it('should find most recent verification', async () => {
      const mockVerifications = [
        {
          id: 'older-id',
          kit_id: 'kit-456',
          verified_at: '2024-11-01T10:00:00Z'
        },
        {
          id: 'latest-id',
          kit_id: 'kit-456',
          verified_at: '2024-12-01T10:00:00Z'
        }
      ];

      // Set up mock data with multiple verifications
      mockSupabase._setMockData('vision_verifications', mockVerifications);

      const result = await repo.findLatestVerificationForKit('kit-456');

      expect(result.data?.id).toBe('latest-id');
      expect(result.data?.kit_id).toBe('kit-456');
      expect(result.error).toBeNull();
    });
  });
});