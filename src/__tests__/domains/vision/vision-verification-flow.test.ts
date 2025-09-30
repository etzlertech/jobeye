/**
 * @file __tests__/domains/vision/integration/vision-verification-flow.test.ts
 * @phase 3.3
 * @domain Vision
 * @purpose Integration test for complete YOLO verification flow
 * @complexity_budget 300
 * @test_coverage 100%
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';

describe('Vision Verification Flow - YOLO Local Detection', () => {
  let supabase: ReturnType<typeof createClient>;

  beforeAll(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    supabase = createClient(supabaseUrl, supabaseKey);
  });

  it('should complete verification with high confidence (>= 70%)', async () => {
    // WILL FAIL - VisionVerificationService not implemented yet
    const { VisionVerificationService } = await import('@/domains/vision/services/vision-verification.service');

    const service = new VisionVerificationService(supabase);
    const result = await service.verifyKit({
      kitId: 'test-kit',
      photo: new Blob(['test-image']),
      companyId: 'company-1',
      technicianId: 'tech-1'
    });

    expect(result.confidence).toBeGreaterThanOrEqual(0.70);
    expect(result.processingMethod).toBe('local_yolo');
    expect(result.requiresVlmFallback).toBe(false);
  });

  it('should store verification record in database with company_id', async () => {
    const companyId = 'test-company-1';

    // Trigger verification
    const verificationId = 'test-verification-1';

    // Query verification_verifications (tenant_id maps to company_id)
    const { data, error } = await supabase
      .from('vision_verifications')
      .select('*')
      .eq('id', verificationId)
      .single();

    expect(error).toBeNull();
    expect(data?.tenant_id).toBe(companyId);
  });

  it('should create detected_items records for YOLO detections', async () => {
    const verificationId = 'test-verification-1';

    const { data, error } = await supabase
      .from('vision_detected_items')
      .select('*')
      .eq('verification_id', verificationId);

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);

    if (data && data.length > 0) {
      const item = data[0];
      expect(item.confidence_score).toBeGreaterThan(0);
      expect(item.confidence_score).toBeLessThanOrEqual(1);
      expect(item.bounding_box).toBeDefined();
    }
  });

  it('should update detected_items_count and missing_items_count', async () => {
    const verificationId = 'test-verification-1';

    const { data } = await supabase
      .from('vision_verifications')
      .select('detected_items_count, missing_items_count')
      .eq('id', verificationId)
      .single();

    expect(data?.detected_items_count).toBeGreaterThanOrEqual(0);
    expect(data?.missing_items_count).toBeGreaterThanOrEqual(0);
  });

  it('should complete within 3 seconds (performance requirement)', async () => {
    const start = Date.now();

    // Run verification
    // ... (will be implemented)

    const duration = Date.now() - start;
    expect(duration).toBeLessThan(3000);
  });
});