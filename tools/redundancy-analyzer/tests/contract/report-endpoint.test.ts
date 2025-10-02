describe('GET /analyze/{id}/report endpoint contract', () => {
  let getAnalysisReport: (analysisId: string) => Promise<string>;

  beforeEach(() => {
    // This will fail until implementation exists
    getAnalysisReport = jest.fn();
  });

  describe('request validation', () => {
    it('should accept valid UUID analysis ID', async () => {
      const validId = '550e8400-e29b-41d4-a716-446655440000';
      
      const report = await getAnalysisReport(validId);
      
      expect(report).toBeDefined();
      expect(typeof report).toBe('string');
    });

    it('should reject invalid UUID format', async () => {
      const invalidId = 'not-a-uuid';
      
      await expect(getAnalysisReport(invalidId)).rejects.toThrow(
        'Invalid analysis ID format'
      );
    });
  });

  describe('response format', () => {
    it('should return markdown formatted report', async () => {
      const analysisId = '550e8400-e29b-41d4-a716-446655440000';
      
      const report = await getAnalysisReport(analysisId);
      
      // Check for markdown structure
      expect(report).toContain('# Redundancy Analysis Report');
      expect(report).toContain('## Executive Summary');
      expect(report).toContain('## Findings by Category');
      expect(report).toContain('## Recommendations');
    });

    it('should include analysis metadata', async () => {
      const analysisId = '550e8400-e29b-41d4-a716-446655440000';
      
      const report = await getAnalysisReport(analysisId);
      
      // Check for metadata
      expect(report).toMatch(/Analysis ID: [0-9a-f-]+/i);
      expect(report).toMatch(/Date: \d{4}-\d{2}-\d{2}/);
      expect(report).toMatch(/Total Files Analyzed: \d+/);
    });

    it('should include findings sections', async () => {
      const analysisId = '550e8400-e29b-41d4-a716-446655440000';
      
      const report = await getAnalysisReport(analysisId);
      
      // Check for findings categories
      expect(report).toMatch(/Duplicate Implementations/i);
      expect(report).toMatch(/Overlapping Features/i);
      expect(report).toMatch(/Unused Code/i);
      expect(report).toMatch(/Abandoned Tables/i);
    });

    it('should include impact metrics', async () => {
      const analysisId = '550e8400-e29b-41d4-a716-446655440000';
      
      const report = await getAnalysisReport(analysisId);
      
      // Check for metrics
      expect(report).toMatch(/Total redundant code: \d+,?\d* lines/);
      expect(report).toMatch(/Critical findings: \d+/);
      expect(report).toMatch(/Estimated cleanup effort: \d+ days/);
    });
  });

  describe('error handling', () => {
    it('should return 404 for non-existent analysis', async () => {
      const unknownId = '00000000-0000-0000-0000-000000000000';
      
      await expect(getAnalysisReport(unknownId)).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: expect.stringContaining('Report not found'),
      });
    });

    it('should return 202 if analysis still in progress', async () => {
      const inProgressId = '550e8400-e29b-41d4-a716-446655440002';
      
      await expect(getAnalysisReport(inProgressId)).rejects.toMatchObject({
        code: 'IN_PROGRESS',
        message: expect.stringContaining('Analysis still in progress'),
        status: expect.stringMatching(/scanning|analyzing|generating_report/),
      });
    });

    it('should handle failed analysis', async () => {
      const failedId = '550e8400-e29b-41d4-a716-446655440003';
      
      await expect(getAnalysisReport(failedId)).rejects.toMatchObject({
        code: 'ANALYSIS_FAILED',
        message: expect.stringContaining('Analysis failed'),
      });
    });
  });

  describe('report content validation', () => {
    it('should include valid markdown formatting', async () => {
      const analysisId = '550e8400-e29b-41d4-a716-446655440000';
      
      const report = await getAnalysisReport(analysisId);
      
      // Check for proper markdown elements
      const headingCount = (report.match(/^#{1,3} /gm) || []).length;
      expect(headingCount).toBeGreaterThan(5);
      
      // Check for code blocks
      expect(report).toMatch(/```[\s\S]*?```/);
      
      // Check for lists
      expect(report).toMatch(/^[\s]*[-*] /m);
    });

    it('should include actionable recommendations', async () => {
      const analysisId = '550e8400-e29b-41d4-a716-446655440000';
      
      const report = await getAnalysisReport(analysisId);
      
      // Check for recommendation structure
      expect(report).toMatch(/Priority: (high|medium|low)/i);
      expect(report).toMatch(/Action: /);
      expect(report).toMatch(/Impact: /);
      expect(report).toMatch(/Effort: (small|medium|large)/);
    });
  });
});