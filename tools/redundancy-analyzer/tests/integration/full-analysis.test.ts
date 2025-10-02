import type { RedundancyAnalyzer } from '@/services/redundancy-analyzer';
import type { AnalysisReport } from '@/models/analysis-report.model';
import { promises as fs } from 'fs';
import path from 'path';

describe('End-to-End Analysis Workflow', () => {
  let analyzer: RedundancyAnalyzer;
  const testProjectPath = '/test/jobeye-project';
  const reportPath = path.join(__dirname, '../../reports');

  beforeEach(() => {
    // This will fail until implementation exists
    analyzer = {} as RedundancyAnalyzer;
  });

  describe('complete analysis workflow', () => {
    it('should execute all analysis phases in correct order', async () => {
      const analysisId = await analyzer.startAnalysis({
        projectPath: testProjectPath,
        options: {
          excludePatterns: ['node_modules', '.git', 'build'],
          includeTests: true,
          includeDocs: true,
          similarityThreshold: 70,
          minModuleSize: 10,
        },
      });

      expect(analysisId).toMatch(/^[0-9a-f-]{36}$/);

      // Check status progression
      let status = await analyzer.getStatus(analysisId);
      expect(status.status).toBe('initializing');

      // Wait for scanning phase
      await analyzer.waitForPhase(analysisId, 'scanning');
      status = await analyzer.getStatus(analysisId);
      expect(status.status).toBe('scanning');
      expect(status.filesScanned).toBeGreaterThan(0);

      // Wait for analysis phase
      await analyzer.waitForPhase(analysisId, 'analyzing');
      status = await analyzer.getStatus(analysisId);
      expect(status.status).toBe('analyzing');
      expect(status.findingsCount).toBeGreaterThanOrEqual(0);

      // Wait for completion
      await analyzer.waitForCompletion(analysisId);
      status = await analyzer.getStatus(analysisId);
      expect(status.status).toBe('complete');
      expect(status.progress).toBe(100);
    });

    it('should analyze all code types and database schemas', async () => {
      const report = await analyzer.analyzeProject(testProjectPath);

      // Verify comprehensive coverage
      expect(report.totalFiles).toBeGreaterThan(500);
      expect(report.totalTables).toBeGreaterThan(100);

      // Check finding categories
      const findingTypes = [...new Set(report.findings.map((f) => f.type))];
      expect(findingTypes).toContain('EXACT_DUPLICATE');
      expect(findingTypes).toContain('SIMILAR_LOGIC');
      expect(findingTypes).toContain('OVERLAPPING_FEATURE');
      expect(findingTypes).toContain('UNUSED_CODE');
      expect(findingTypes).toContain('ABANDONED_TABLE');
      expect(findingTypes).toContain('DUPLICATE_API');
    });

    it('should generate comprehensive markdown report', async () => {
      const analysisId = await analyzer.startAnalysis({
        projectPath: testProjectPath,
      });

      await analyzer.waitForCompletion(analysisId);

      const reportContent = await analyzer.getReport(analysisId);

      // Verify report structure
      expect(reportContent).toContain('# Redundancy Analysis Report');
      expect(reportContent).toContain('## Executive Summary');
      expect(reportContent).toMatch(/Total redundant code: \d+,?\d* lines/);
      expect(reportContent).toMatch(/Critical findings: \d+/);

      // Check all required sections
      const requiredSections = [
        '## Findings by Category',
        '### 1. Duplicate Implementations',
        '### 2. Overlapping Features',
        '### 3. Unused Code',
        '### 4. Abandoned Tables',
        '## Recommendations',
        '## Detailed Findings',
      ];

      requiredSections.forEach((section) => {
        expect(reportContent).toContain(section);
      });
    });

    it('should save report to file system with timestamp', async () => {
      const analysisId = await analyzer.startAnalysis({
        projectPath: testProjectPath,
      });

      await analyzer.waitForCompletion(analysisId);

      const reportFiles = await fs.readdir(reportPath);
      const latestReport = reportFiles
        .filter((f) => f.startsWith('redundancy-analysis-'))
        .sort()
        .pop();

      expect(latestReport).toMatch(/redundancy-analysis-\d{8}-\d{6}\.md/);

      const reportContent = await fs.readFile(
        path.join(reportPath, latestReport!),
        'utf-8'
      );

      expect(reportContent).toContain('Redundancy Analysis Report');
      expect(reportContent.length).toBeGreaterThan(1000);
    });
  });

  describe('performance and scalability', () => {
    it('should handle large codebases efficiently', async () => {
      const startTime = Date.now();

      const report = await analyzer.analyzeProject(testProjectPath, {
        options: {
          excludePatterns: ['node_modules', '.git'],
        },
      });

      const duration = Date.now() - startTime;

      // Should complete in reasonable time (no strict limit per spec)
      expect(duration).toBeLessThan(600000); // 10 minutes max

      // Should use memory efficiently
      const memoryUsage = process.memoryUsage();
      expect(memoryUsage.heapUsed).toBeLessThan(2 * 1024 * 1024 * 1024); // 2GB
    });

    it('should support incremental progress updates', async () => {
      const progressUpdates: number[] = [];

      const analysisId = await analyzer.startAnalysis({
        projectPath: testProjectPath,
        onProgress: (progress) => {
          progressUpdates.push(progress);
        },
      });

      await analyzer.waitForCompletion(analysisId);

      // Verify smooth progress updates
      expect(progressUpdates.length).toBeGreaterThan(10);
      expect(progressUpdates[0]).toBe(0);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);

      // Progress should increase monotonically
      for (let i = 1; i < progressUpdates.length; i++) {
        expect(progressUpdates[i]).toBeGreaterThanOrEqual(progressUpdates[i - 1]);
      }
    });
  });

  describe('error handling and recovery', () => {
    it('should handle invalid project paths gracefully', async () => {
      await expect(
        analyzer.analyzeProject('/definitely/does/not/exist')
      ).rejects.toThrow('Project path does not exist');
    });

    it('should handle database connection failures', async () => {
      // Simulate database connection failure
      process.env.SUPABASE_URL = 'https://invalid.supabase.co';

      const report = await analyzer.analyzeProject(testProjectPath);

      // Should continue with code analysis even if DB fails
      expect(report.findings.length).toBeGreaterThan(0);
      expect(report.summary.tablesWithoutCrud).toBe(-1); // Indicates DB failure
    });

    it('should support resumable analysis', async () => {
      const analysisId = await analyzer.startAnalysis({
        projectPath: testProjectPath,
      });

      // Simulate interruption
      await analyzer.pause(analysisId);
      let status = await analyzer.getStatus(analysisId);
      expect(status.status).toMatch(/paused|scanning/);

      // Resume analysis
      await analyzer.resume(analysisId);
      await analyzer.waitForCompletion(analysisId);

      status = await analyzer.getStatus(analysisId);
      expect(status.status).toBe('complete');
    });
  });

  describe('integration scenarios from quickstart', () => {
    it('should identify duplicate repository implementations as documented', async () => {
      const report = await analyzer.analyzeProject(testProjectPath, {
        focus: 'repositories',
      });

      // Find the specific example from quickstart
      const kitRepoSection = report.findings.find(
        (f) =>
          f.primaryLocation.filePath.includes('kit-repository') &&
          f.duplicateLocations.some((d) => d.filePath.includes('kit.repository'))
      );

      expect(kitRepoSection).toBeDefined();
      expect(kitRepoSection?.estimatedSavings).toBeCloseTo(150, -2);
    });

    it('should find abandoned database tables as documented', async () => {
      const report = await analyzer.analyzeProject(testProjectPath, {
        focus: 'database',
      });

      // Check for specific abandoned table groups from quickstart
      const abandonedGroups = {
        irrigation_systems: 5,
        vendor_management: 3,
        training_records: 3,
      };

      Object.entries(abandonedGroups).forEach(([prefix, expectedCount]) => {
        const tables = report.findings.filter(
          (f) =>
            f.type === 'ABANDONED_TABLE' &&
            f.primaryLocation.filePath.startsWith(prefix)
        );
        expect(tables.length).toBe(expectedCount);
      });

      expect(report.summary.tablesWithoutCrud).toBe(75);
    });
  });
});