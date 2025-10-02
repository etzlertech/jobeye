import type { RedundancyAnalyzer } from '@/services/redundancy-analyzer';
import type { DatabaseTableMapping } from '@/models/database-table-mapping.model';
import { createClient } from '@supabase/supabase-js';

describe('Abandoned Database Tables Scenario', () => {
  let analyzer: RedundancyAnalyzer;
  let mockSupabase: ReturnType<typeof createClient>;

  beforeEach(() => {
    // This will fail until implementation exists
    analyzer = {} as RedundancyAnalyzer;
    mockSupabase = {} as ReturnType<typeof createClient>;
  });

  describe('when analyzing database tables without CRUD operations', () => {
    it('should identify tables with no repository implementations', async () => {
      // Mock database schema
      const mockTables = [
        { table_name: 'irrigation_systems', column_count: 8 },
        { table_name: 'irrigation_zones', column_count: 6 },
        { table_name: 'irrigation_schedules', column_count: 5 },
        { table_name: 'vendor_management', column_count: 10 },
        { table_name: 'vendor_locations', column_count: 4 },
        { table_name: 'training_records', column_count: 7 },
      ];

      // Mock file system - no repositories for these tables
      const mockFiles = {
        '/lib/repositories/customer.repository.ts': 'CustomerRepository',
        '/domains/job/repositories/job-repository.ts': 'JobRepository',
        // No irrigation or vendor repositories
      };

      const tableMappings = await analyzer.analyzeTableUsage(
        mockSupabase,
        '/test/project'
      );

      // Verify abandoned tables detection
      const abandonedTables = tableMappings.filter((t) => t.isAbandoned);

      expect(abandonedTables).toHaveLength(6);
      expect(abandonedTables.map((t) => t.tableName)).toEqual(
        expect.arrayContaining([
          'irrigation_systems',
          'irrigation_zones',
          'irrigation_schedules',
          'vendor_management',
          'vendor_locations',
          'training_records',
        ])
      );
    });

    it('should check for CRUD operations in existing code', async () => {
      const mockTables = [
        { table_name: 'companies', column_count: 5 },
        { table_name: 'jobs', column_count: 15 },
      ];

      const tableMappings = await analyzer.analyzeTableUsage(
        mockSupabase,
        '/test/project'
      );

      // Companies table has no repository but might have direct queries
      const companiesMapping = tableMappings.find(
        (t) => t.tableName === 'companies'
      );

      expect(companiesMapping).toMatchObject({
        tableName: 'companies',
        hasRepository: false,
        hasCrudOperations: {
          create: false,
          read: true, // Found in direct queries
          update: false,
          delete: false,
        },
        usageCount: 3, // Found 3 references in code
      });
    });

    it('should categorize tables by abandonment risk', async () => {
      const tableMappings = await analyzer.analyzeTableUsage(
        mockSupabase,
        '/test/project'
      );

      const findings = await analyzer.categorizeAbandonedTables(tableMappings);

      expect(findings).toMatchObject({
        completelyAbandoned: expect.arrayContaining([
          'vendor_management',
          'training_records',
        ]),
        partiallyUsed: expect.arrayContaining(['companies']),
        activelyUsed: expect.arrayContaining(['jobs', 'customers']),
      });
    });
  });

  describe('when analyzing table relationships', () => {
    it('should identify orphaned child tables', async () => {
      // Mock foreign key relationships
      const mockForeignKeys = [
        {
          from_table: 'irrigation_zones',
          from_column: 'system_id',
          to_table: 'irrigation_systems',
          to_column: 'id',
        },
      ];

      const findings = await analyzer.analyzeTableRelationships(
        mockSupabase,
        '/test/project'
      );

      // If parent table (irrigation_systems) is abandoned,
      // child tables (irrigation_zones) are also at risk
      const orphanedTables = findings.filter(
        (f) => f.type === 'ABANDONED_TABLE' && f.recommendation.includes('orphaned')
      );

      expect(orphanedTables.length).toBeGreaterThan(0);
    });

    it('should calculate row counts for usage assessment', async () => {
      const tableMappings = await analyzer.analyzeTableUsage(
        mockSupabase,
        '/test/project'
      );

      // Tables with data but no code usage are higher priority
      const vendorTable = tableMappings.find(
        (t) => t.tableName === 'vendor_management'
      );

      expect(vendorTable?.usageCount).toBe(0);
      // Mock row count query would return actual data
      expect(vendorTable?.lastModified).toBeDefined();
    });
  });

  describe('report generation', () => {
    it('should include abandoned tables section', async () => {
      const markdownReport = await analyzer.generateReport('/test/project', {
        focus: 'database',
      });

      // Check report structure from quickstart.md
      expect(markdownReport).toContain('## Abandoned Tables (No CRUD Operations)');
      expect(markdownReport).toContain('- irrigation_systems (5 tables, 0 repositories)');
      expect(markdownReport).toContain('- vendor_management (3 tables, 0 repositories)');
      expect(markdownReport).toContain('- training_records (3 tables, 0 repositories)');
      expect(markdownReport).toMatch(/Total: \d+ tables without application code/);
    });

    it('should prioritize tables by data volume and relationships', async () => {
      const report = await analyzer.generateReport('/test/project', {
        focus: 'database',
      });

      const prioritySection = report.match(
        /### Priority Order[\s\S]*?##/
      )?.[0];

      expect(prioritySection).toBeDefined();
      expect(prioritySection).toContain('1. Tables with data but no code');
      expect(prioritySection).toContain('2. Parent tables with orphaned children');
      expect(prioritySection).toContain('3. Empty tables with no relationships');
    });

    it('should provide migration recommendations', async () => {
      const findings = await analyzer.analyzeProject('/test/project', {
        focus: 'database',
      });

      const abandonedTableFindings = findings.filter(
        (f) => f.type === 'ABANDONED_TABLE'
      );

      expect(abandonedTableFindings[0].recommendation).toMatch(
        /Either implement CRUD operations or remove from schema/
      );

      // High severity for tables with data
      const tablesWithData = abandonedTableFindings.filter(
        (f) => f.severity === 'high'
      );
      expect(tablesWithData.length).toBeGreaterThan(0);
    });
  });

  describe('integration with code analysis', () => {
    it('should cross-reference table names in code comments and strings', async () => {
      const findings = await analyzer.analyzeProject('/test/project');

      // Check if analyzer found references to tables in:
      // - SQL query strings
      // - Migration files
      // - Comments mentioning table names
      const tableReferences = findings.filter(
        (f) => f.type === 'ABANDONED_TABLE' && f.impactScore.risk > 0
      );

      expect(tableReferences.length).toBeGreaterThan(0);
    });
  });
});