import { CodeScanner, TableReference } from './code-scanner';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface TableMapping {
  tableName: string;
  totalReferences: number;
  locations: LocationDetail[];
  operations: string[];
  accessPatterns: AccessPattern[];
  relationships: {
    references: string[];
    referencedBy: string[];
  };
}

export interface LocationDetail {
  file: string;
  line: number;
  type: TableReference['type'];
  operations: string[];
}

export interface AccessPattern {
  pattern: 'repository' | 'direct' | 'service' | 'api';
  count: number;
  files: string[];
}

export interface MappingAnalysis {
  analyzedAt: string;
  codebasePath: string;
  totalTables: number;
  mappedTables: number;
  unmappedTables: number;
  tableMappings: Record<string, TableMapping>;
  unmappedTableDetails: UnmappedTable[];
  codeQualityIssues: CodeQualityIssue[];
  recommendations: string[];
}

export interface UnmappedTable {
  name: string;
  rowCount: number;
  reason: 'no_references' | 'deprecated' | 'migration_only';
}

export interface CodeQualityIssue {
  type: 'direct_access' | 'missing_repository' | 'inconsistent_pattern' | 'missing_types';
  severity: 'high' | 'medium' | 'low';
  table: string;
  files: string[];
  description: string;
}

export class MappingAnalyzer {
  private codeScanner: CodeScanner;
  private projectRoot: string;

  constructor(knownTables: string[], projectRoot: string) {
    this.codeScanner = new CodeScanner(knownTables);
    this.projectRoot = projectRoot;
  }

  async analyze(databaseAnalysis: any): Promise<MappingAnalysis> {
    console.log('🔍 Starting database-to-codebase mapping analysis...\n');

    const knownTables = databaseAnalysis.tables.map((t: any) => t.name);
    const tableReferences = await this.scanCodebase();
    
    console.log(`\n📊 Found ${tableReferences.length} table references in codebase\n`);

    const tableMappings = this.buildTableMappings(tableReferences, databaseAnalysis);
    const unmappedTables = this.findUnmappedTables(databaseAnalysis, tableMappings);
    const codeQualityIssues = this.analyzeCodeQuality(tableMappings);
    const recommendations = this.generateRecommendations(tableMappings, unmappedTables, codeQualityIssues);

    return {
      analyzedAt: new Date().toISOString(),
      codebasePath: this.projectRoot,
      totalTables: databaseAnalysis.tables.length,
      mappedTables: Object.keys(tableMappings).length,
      unmappedTables: unmappedTables.length,
      tableMappings,
      unmappedTableDetails: unmappedTables,
      codeQualityIssues,
      recommendations
    };
  }

  private async scanCodebase(): Promise<TableReference[]> {
    const srcPath = path.join(this.projectRoot, 'src');
    const excludePaths = [
      'supabase-analysis',
      '__tests__',
      '.test.',
      '.spec.',
      'node_modules'
    ];

    console.log('📂 Scanning directories:');
    console.log('  - src/');
    console.log('  - supabase/migrations/');
    console.log('  - scripts/');

    // Scan src directory
    const srcReferences = await this.codeScanner.scanDirectory(srcPath, excludePaths);
    
    // Scan migrations
    const migrationsPath = path.join(this.projectRoot, 'supabase', 'migrations');
    let migrationReferences: TableReference[] = [];
    try {
      migrationReferences = await this.codeScanner.scanDirectory(migrationsPath, []);
    } catch (e) {
      console.log('  ⚠️  No migrations directory found');
    }

    // Scan scripts
    const scriptsPath = path.join(this.projectRoot, 'scripts');
    let scriptReferences: TableReference[] = [];
    try {
      scriptReferences = await this.codeScanner.scanDirectory(scriptsPath, excludePaths);
    } catch (e) {
      console.log('  ⚠️  No scripts directory found');
    }

    return [...srcReferences, ...migrationReferences, ...scriptReferences];
  }

  private buildTableMappings(references: TableReference[], dbAnalysis: any): Record<string, TableMapping> {
    const mappings: Record<string, TableMapping> = {};

    // Group references by table
    for (const ref of references) {
      if (!mappings[ref.tableName]) {
        mappings[ref.tableName] = {
          tableName: ref.tableName,
          totalReferences: 0,
          locations: [],
          operations: [],
          accessPatterns: [],
          relationships: {
            references: [],
            referencedBy: []
          }
        };
      }

      const mapping = mappings[ref.tableName];
      mapping.totalReferences++;

      // Add location
      const existingLocation = mapping.locations.find(
        loc => loc.file === ref.filePath && loc.line === ref.line
      );

      if (existingLocation) {
        if (ref.operation && !existingLocation.operations.includes(ref.operation)) {
          existingLocation.operations.push(ref.operation);
        }
      } else {
        mapping.locations.push({
          file: this.getRelativePath(ref.filePath),
          line: ref.line,
          type: ref.type,
          operations: ref.operation ? [ref.operation] : []
        });
      }

      // Track unique operations
      if (ref.operation && !mapping.operations.includes(ref.operation)) {
        mapping.operations.push(ref.operation);
      }
    }

    // Analyze access patterns and relationships
    for (const [tableName, mapping] of Object.entries(mappings)) {
      mapping.accessPatterns = this.analyzeAccessPatterns(mapping);
      mapping.relationships = this.findTableRelationships(tableName, dbAnalysis);
    }

    return mappings;
  }

  private getRelativePath(filePath: string): string {
    return path.relative(this.projectRoot, filePath).replace(/\\/g, '/');
  }

  private analyzeAccessPatterns(mapping: TableMapping): AccessPattern[] {
    const patterns: Map<string, Set<string>> = new Map();

    for (const location of mapping.locations) {
      let pattern: AccessPattern['pattern'];
      
      if (location.type === 'repository') {
        pattern = 'repository';
      } else if (location.type === 'service') {
        pattern = 'service';
      } else if (location.type === 'api_route') {
        pattern = 'api';
      } else {
        pattern = 'direct';
      }

      if (!patterns.has(pattern)) {
        patterns.set(pattern, new Set());
      }
      patterns.get(pattern)!.add(location.file);
    }

    return Array.from(patterns.entries()).map(([pattern, files]) => ({
      pattern: pattern as AccessPattern['pattern'],
      count: files.size,
      files: Array.from(files).slice(0, 5) // Limit to 5 examples
    }));
  }

  private findTableRelationships(tableName: string, dbAnalysis: any): TableMapping['relationships'] {
    const table = dbAnalysis.tables.find((t: any) => t.name === tableName);
    if (!table) return { references: [], referencedBy: [] };

    // Tables this table references (via foreign keys)
    const references = table.foreign_keys
      ?.map((fk: any) => fk.foreign_table_name)
      .filter((name: string, index: number, self: string[]) => self.indexOf(name) === index) || [];

    // Tables that reference this table
    const referencedBy = dbAnalysis.tables
      .filter((t: any) => 
        t.foreign_keys?.some((fk: any) => fk.foreign_table_name === tableName)
      )
      .map((t: any) => t.name);

    return { references, referencedBy };
  }

  private findUnmappedTables(dbAnalysis: any, mappings: Record<string, TableMapping>): UnmappedTable[] {
    const unmapped: UnmappedTable[] = [];

    for (const table of dbAnalysis.tables) {
      if (!mappings[table.name]) {
        let reason: UnmappedTable['reason'] = 'no_references';
        
        // Try to determine why it's unmapped
        if (table.name.includes('_old') || table.name.includes('_backup')) {
          reason = 'deprecated';
        } else if (table.row_count === 0 && table.foreign_keys.length === 0) {
          reason = 'migration_only';
        }

        unmapped.push({
          name: table.name,
          rowCount: table.row_count,
          reason
        });
      }
    }

    return unmapped;
  }

  private analyzeCodeQuality(mappings: Record<string, TableMapping>): CodeQualityIssue[] {
    const issues: CodeQualityIssue[] = [];

    for (const [tableName, mapping] of Object.entries(mappings)) {
      // Check for direct access outside of repositories
      const directAccessFiles = mapping.locations
        .filter(loc => loc.type === 'client_call' || loc.type === 'component')
        .map(loc => loc.file);

      if (directAccessFiles.length > 0) {
        const hasRepository = mapping.locations.some(loc => loc.type === 'repository');
        
        issues.push({
          type: 'direct_access',
          severity: hasRepository ? 'medium' : 'high',
          table: tableName,
          files: [...new Set(directAccessFiles)],
          description: hasRepository 
            ? `Table "${tableName}" is accessed directly outside its repository`
            : `Table "${tableName}" has no repository and is accessed directly`
        });
      }

      // Check for inconsistent access patterns
      if (mapping.accessPatterns.length > 2) {
        issues.push({
          type: 'inconsistent_pattern',
          severity: 'low',
          table: tableName,
          files: mapping.locations.slice(0, 5).map(l => l.file),
          description: `Table "${tableName}" is accessed through ${mapping.accessPatterns.length} different patterns`
        });
      }

      // Check for missing type definitions
      const hasTypes = mapping.locations.some(loc => loc.type === 'type_definition');
      if (!hasTypes && mapping.totalReferences > 5) {
        issues.push({
          type: 'missing_types',
          severity: 'medium',
          table: tableName,
          files: [],
          description: `Table "${tableName}" has ${mapping.totalReferences} references but no TypeScript type definitions`
        });
      }
    }

    return issues.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  private generateRecommendations(
    mappings: Record<string, TableMapping>,
    unmappedTables: UnmappedTable[],
    issues: CodeQualityIssue[]
  ): string[] {
    const recommendations: string[] = [];

    // Unused tables
    const unusedWithData = unmappedTables.filter(t => t.rowCount > 0);
    if (unusedWithData.length > 0) {
      recommendations.push(
        `Review ${unusedWithData.length} tables with data but no code references: ${
          unusedWithData.slice(0, 5).map(t => t.name).join(', ')
        }${unusedWithData.length > 5 ? '...' : ''}`
      );
    }

    const emptyUnused = unmappedTables.filter(t => t.rowCount === 0);
    if (emptyUnused.length > 10) {
      recommendations.push(
        `Remove ${emptyUnused.length} empty tables with no code references`
      );
    }

    // Direct access issues
    const directAccessIssues = issues.filter(i => i.type === 'direct_access' && i.severity === 'high');
    if (directAccessIssues.length > 0) {
      recommendations.push(
        `Create repositories for ${directAccessIssues.length} tables with direct database access`
      );
    }

    // Missing types
    const missingTypeIssues = issues.filter(i => i.type === 'missing_types');
    if (missingTypeIssues.length > 0) {
      recommendations.push(
        `Generate TypeScript types for ${missingTypeIssues.length} frequently used tables`
      );
    }

    // Hot tables
    const hotTables = Object.entries(mappings)
      .filter(([_, m]) => m.totalReferences > 20)
      .sort((a, b) => b[1].totalReferences - a[1].totalReferences)
      .slice(0, 5);
    
    if (hotTables.length > 0) {
      recommendations.push(
        `Optimize access patterns for high-traffic tables: ${
          hotTables.map(([name, m]) => `${name} (${m.totalReferences} refs)`).join(', ')
        }`
      );
    }

    // Repository pattern adoption
    const tablesWithoutRepos = Object.entries(mappings)
      .filter(([_, m]) => !m.accessPatterns.some(p => p.pattern === 'repository'))
      .length;
    
    if (tablesWithoutRepos > 5) {
      recommendations.push(
        `Implement repository pattern for ${tablesWithoutRepos} tables currently using direct access`
      );
    }

    return recommendations;
  }
}