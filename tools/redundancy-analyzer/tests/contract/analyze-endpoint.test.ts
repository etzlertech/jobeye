import type { AnalysisRequest, AnalysisResponse } from '@/types/api';

describe('POST /analyze endpoint contract', () => {
  let analyzeEndpoint: (request: AnalysisRequest) => Promise<AnalysisResponse>;

  beforeEach(() => {
    // This will fail until implementation exists
    analyzeEndpoint = jest.fn();
  });

  describe('request validation', () => {
    it('should accept valid analysis request', async () => {
      const validRequest: AnalysisRequest = {
        projectPath: '/path/to/project',
        options: {
          excludePatterns: ['node_modules', '.git'],
          includeTests: true,
          includeDocs: true,
          similarityThreshold: 70,
          minModuleSize: 10,
        },
      };

      const response = await analyzeEndpoint(validRequest);
      
      expect(response).toBeDefined();
      expect(response.analysisId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(response.status).toBe('initializing');
    });

    it('should require projectPath', async () => {
      const invalidRequest = {
        options: {},
      } as AnalysisRequest;

      await expect(analyzeEndpoint(invalidRequest)).rejects.toThrow(
        'projectPath is required'
      );
    });

    it('should validate similarity threshold range', async () => {
      const invalidRequest: AnalysisRequest = {
        projectPath: '/path',
        options: {
          similarityThreshold: 150, // Invalid: > 100
        },
      };

      await expect(analyzeEndpoint(invalidRequest)).rejects.toThrow(
        'similarityThreshold must be between 0 and 100'
      );
    });
  });

  describe('response format', () => {
    it('should return 202 Accepted with analysis ID', async () => {
      const request: AnalysisRequest = {
        projectPath: '/valid/path',
      };

      const response = await analyzeEndpoint(request);

      expect(response).toMatchObject({
        analysisId: expect.any(String),
        status: expect.stringMatching(
          /^(initializing|scanning|analyzing|generating_report|complete)$/
        ),
      });
    });

    it('should include estimated time when available', async () => {
      const request: AnalysisRequest = {
        projectPath: '/large/project',
      };

      const response = await analyzeEndpoint(request);

      if (response.estimatedTime) {
        expect(response.estimatedTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      }
    });
  });

  describe('error handling', () => {
    it('should return 400 for invalid project path', async () => {
      const request: AnalysisRequest = {
        projectPath: '',
      };

      await expect(analyzeEndpoint(request)).rejects.toMatchObject({
        code: 'INVALID_REQUEST',
        message: expect.stringContaining('projectPath'),
      });
    });

    it('should handle non-existent directory', async () => {
      const request: AnalysisRequest = {
        projectPath: '/definitely/does/not/exist/path',
      };

      await expect(analyzeEndpoint(request)).rejects.toMatchObject({
        code: 'PATH_NOT_FOUND',
        message: expect.stringContaining('does not exist'),
      });
    });
  });
});