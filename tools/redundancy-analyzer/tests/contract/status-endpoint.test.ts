import type { AnalysisStatus } from '@/types/api';

describe('GET /analyze/{id}/status endpoint contract', () => {
  let getAnalysisStatus: (analysisId: string) => Promise<AnalysisStatus>;

  beforeEach(() => {
    // This will fail until implementation exists
    getAnalysisStatus = jest.fn();
  });

  describe('request validation', () => {
    it('should accept valid UUID analysis ID', async () => {
      const validId = '550e8400-e29b-41d4-a716-446655440000';
      
      const status = await getAnalysisStatus(validId);
      
      expect(status).toBeDefined();
      expect(status.analysisId).toBe(validId);
    });

    it('should reject invalid UUID format', async () => {
      const invalidId = 'not-a-uuid';
      
      await expect(getAnalysisStatus(invalidId)).rejects.toThrow(
        'Invalid analysis ID format'
      );
    });
  });

  describe('response format', () => {
    it('should return complete status object', async () => {
      const analysisId = '550e8400-e29b-41d4-a716-446655440000';
      
      const status = await getAnalysisStatus(analysisId);
      
      expect(status).toMatchObject({
        analysisId: analysisId,
        status: expect.stringMatching(
          /^(initializing|scanning|analyzing|generating_report|complete|failed)$/
        ),
        progress: expect.any(Number),
      });
      
      expect(status.progress).toBeGreaterThanOrEqual(0);
      expect(status.progress).toBeLessThanOrEqual(100);
    });

    it('should include current phase when in progress', async () => {
      const analysisId = '550e8400-e29b-41d4-a716-446655440000';
      
      const status = await getAnalysisStatus(analysisId);
      
      if (status.status !== 'complete' && status.status !== 'failed') {
        expect(status.currentPhase).toBeDefined();
        expect(typeof status.currentPhase).toBe('string');
      }
    });

    it('should include file scan progress', async () => {
      const analysisId = '550e8400-e29b-41d4-a716-446655440000';
      
      const status = await getAnalysisStatus(analysisId);
      
      if (status.filesScanned !== undefined) {
        expect(status.filesScanned).toBeGreaterThanOrEqual(0);
        expect(typeof status.filesScanned).toBe('number');
      }
    });

    it('should include findings count when available', async () => {
      const analysisId = '550e8400-e29b-41d4-a716-446655440000';
      
      const status = await getAnalysisStatus(analysisId);
      
      if (status.findingsCount !== undefined) {
        expect(status.findingsCount).toBeGreaterThanOrEqual(0);
        expect(typeof status.findingsCount).toBe('number');
      }
    });
  });

  describe('error handling', () => {
    it('should return 404 for non-existent analysis', async () => {
      const unknownId = '00000000-0000-0000-0000-000000000000';
      
      await expect(getAnalysisStatus(unknownId)).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: expect.stringContaining('Analysis not found'),
      });
    });

    it('should include error message for failed analysis', async () => {
      const failedId = '550e8400-e29b-41d4-a716-446655440001';
      
      const status = await getAnalysisStatus(failedId);
      
      if (status.status === 'failed') {
        expect(status.error).toBeDefined();
        expect(typeof status.error).toBe('string');
      }
    });
  });

  describe('state transitions', () => {
    it('should show progressive states', async () => {
      const analysisId = '550e8400-e29b-41d4-a716-446655440000';
      const validStates = [
        'initializing',
        'scanning', 
        'analyzing',
        'generating_report',
        'complete',
        'failed'
      ];
      
      const status = await getAnalysisStatus(analysisId);
      
      expect(validStates).toContain(status.status);
    });
  });
});