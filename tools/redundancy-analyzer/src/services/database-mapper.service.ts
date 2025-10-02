import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { DatabaseTableMapping, CrudOperations } from '../models/database-table-mapping.model';
import { DatabaseTableMappingModel } from '../models/database-table-mapping.model';
import { glob } from 'glob';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface DatabaseMapperOptions {
  supabaseUrl?: string;
  supabaseKey?: string;
  projectRoot: string;
}

interface TableInfo {
  table_name: string;
  column_count: string;
  row_count?: string;
}

export class DatabaseMapperService {
  private supabase: SupabaseClient | null = null;
  private tableCache: Map<string, DatabaseTableMapping>;

  constructor() {
    this.tableCache = new Map();
  }

  async initialize(options: DatabaseMapperOptions): Promise<void> {
    const url = options.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = options.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (url && key) {
      this.supabase = createClient(url, key);
      
      // Test connection
      try {
        const { error } = await this.supabase.from('auth.users').select('id').limit(1);
        if (error && !error.message.includes('permission denied')) {
          throw error;
        }
        console.log('✅ Connected to Supabase database');
      } catch (error) {
        console.warn('⚠️ Supabase connection test failed, proceeding with limited functionality:', error);
      }
    } else {
      console.warn('⚠️ Supabase credentials not provided. Database analysis will be limited.');
    }
  }

  async analyzeTableUsage(projectRoot: string): Promise<DatabaseTableMapping[]> {
    const tables = await this.fetchDatabaseTables();
    const mappings: DatabaseTableMapping[] = [];

    for (const table of tables) {
      const mapping = await this.analyzeTable(table.table_name, projectRoot);
      mappings.push(mapping);
      this.tableCache.set(table.table_name, mapping);
    }

    return mappings;
  }

  private async fetchDatabaseTables(): Promise<TableInfo[]> {
    if (!this.supabase) {
      return [];
    }

    try {
      const { data, error } = await this.supabase.rpc('exec_sql', {
        sql: `
          SELECT 
            t.table_name,
            COUNT(c.column_name) as column_count
          FROM information_schema.tables t
          LEFT JOIN information_schema.columns c 
            ON t.table_name = c.table_name AND t.table_schema = c.table_schema
          WHERE t.table_schema = 'public' 
            AND t.table_type = 'BASE TABLE'
            AND t.table_name NOT IN ('schema_migrations', 'supabase_functions_migrations')
          GROUP BY t.table_name
          ORDER BY t.table_name;
        `,
      });

      if (error) {
        console.error('Error fetching tables:', error);
        return [];
      }

      // Get row counts for each table
      const tablesWithCounts: TableInfo[] = [];
      for (const table of data || []) {
        const rowCount = await this.getTableRowCount(table.table_name);
        tablesWithCounts.push({
          ...table,
          row_count: rowCount,
        });
      }

      return tablesWithCounts;
    } catch (error) {
      console.error('Error in fetchDatabaseTables:', error);
      return [];
    }
  }

  private async getTableRowCount(tableName: string): Promise<string> {
    if (!this.supabase) return '0';

    try {
      const { data, error } = await this.supabase.rpc('exec_sql', {
        sql: `SELECT COUNT(*) as count FROM "${tableName}"`,
      });

      if (error || !data || !data[0]) return '0';
      return data[0].count || '0';
    } catch {
      return '0';
    }
  }

  private async analyzeTable(
    tableName: string,
    projectRoot: string
  ): Promise<DatabaseTableMapping> {
    const mapping = new DatabaseTableMappingModel({
      tableName,
      hasRepository: false,
      repositoryPath: null,
      hasCrudOperations: {
        create: false,
        read: false,
        update: false,
        delete: false,
      },
      usageCount: 0,
      lastModified: null,
      isAbandoned: true,
    });

    // Search for repository files
    const repositoryPath = await this.findRepository(tableName, projectRoot);
    if (repositoryPath) {
      mapping.setRepository(repositoryPath);
    }

    // Search for CRUD operations in code
    const crudOps = await this.findCrudOperations(tableName, projectRoot);
    mapping.hasCrudOperations = crudOps;

    // Count usage references
    const usageCount = await this.countTableReferences(tableName, projectRoot);
    mapping.usageCount = usageCount;

    // Determine if abandoned
    mapping.isAbandoned = this.isTableAbandoned(mapping);

    return mapping;
  }

  private async findRepository(tableName: string, projectRoot: string): Promise<string | null> {
    // Common repository patterns
    const patterns = [
      `**/*${tableName}*.repository.ts`,
      `**/*${tableName.replace(/_/g, '-')}*.repository.ts`,
      `**/repositories/*${tableName}*.ts`,
      `**/repos/*${tableName}*.ts`,
    ];

    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: projectRoot,
        ignore: ['node_modules/**', 'dist/**', 'build/**'],
      });

      if (files.length > 0) {
        // Check if the file actually references the table
        for (const file of files) {
          const content = await fs.readFile(path.join(projectRoot, file), 'utf-8');
          if (content.includes(`'${tableName}'`) || content.includes(`"${tableName}"`)) {
            return file;
          }
        }
      }
    }

    return null;
  }

  private async findCrudOperations(
    tableName: string,
    projectRoot: string
  ): Promise<CrudOperations> {
    const operations: CrudOperations = {
      create: false,
      read: false,
      update: false,
      delete: false,
    };

    // Search for files that might contain database operations
    const files = await glob('**/*.{ts,tsx,js,jsx}', {
      cwd: projectRoot,
      ignore: ['node_modules/**', 'dist/**', 'build/**', 'tests/**'],
    });

    // Patterns to search for
    const patterns = {
      create: [
        `.insert(`,
        `.create(`,
        `INSERT INTO ${tableName}`,
        `INSERT INTO "${tableName}"`,
        `.from('${tableName}').insert`,
        `.from("${tableName}").insert`,
      ],
      read: [
        `.select(`,
        `.query(`,
        `SELECT .* FROM ${tableName}`,
        `SELECT .* FROM "${tableName}"`,
        `.from('${tableName}').select`,
        `.from("${tableName}").select`,
      ],
      update: [
        `.update(`,
        `.patch(`,
        `UPDATE ${tableName}`,
        `UPDATE "${tableName}"`,
        `.from('${tableName}').update`,
        `.from("${tableName}").update`,
      ],
      delete: [
        `.delete(`,
        `.remove(`,
        `DELETE FROM ${tableName}`,
        `DELETE FROM "${tableName}"`,
        `.from('${tableName}').delete`,
        `.from("${tableName}").delete`,
      ],
    };

    // Sample files to avoid processing entire codebase
    const samplesToCheck = Math.min(files.length, 100);
    const filesToCheck = files.sort(() => Math.random() - 0.5).slice(0, samplesToCheck);

    for (const file of filesToCheck) {
      try {
        const content = await fs.readFile(path.join(projectRoot, file), 'utf-8');
        
        // Check if file references the table
        if (!content.includes(tableName)) continue;

        // Check for each operation type
        for (const [operation, searchPatterns] of Object.entries(patterns)) {
          if (!operations[operation as keyof CrudOperations]) {
            for (const pattern of searchPatterns) {
              if (content.includes(pattern)) {
                operations[operation as keyof CrudOperations] = true;
                break;
              }
            }
          }
        }

        // If all operations found, stop searching
        if (Object.values(operations).every((v) => v)) break;
      } catch (error) {
        // Skip files that can't be read
      }
    }

    return operations;
  }

  private async countTableReferences(tableName: string, projectRoot: string): Promise<number> {
    let count = 0;

    const files = await glob('**/*.{ts,tsx,js,jsx,sql}', {
      cwd: projectRoot,
      ignore: ['node_modules/**', 'dist/**', 'build/**'],
    });

    // Sample files for performance
    const samplesToCheck = Math.min(files.length, 200);
    const filesToCheck = files.sort(() => Math.random() - 0.5).slice(0, samplesToCheck);

    for (const file of filesToCheck) {
      try {
        const content = await fs.readFile(path.join(projectRoot, file), 'utf-8');
        
        // Count occurrences of table name
        const regex = new RegExp(`\\b${tableName}\\b`, 'g');
        const matches = content.match(regex);
        if (matches) {
          count += matches.length;
        }
      } catch {
        // Skip unreadable files
      }
    }

    return count;
  }

  private isTableAbandoned(mapping: DatabaseTableMapping): boolean {
    // A table is abandoned if:
    // - It has no repository
    // - It has no CRUD operations
    // - It has very low usage count
    return (
      !mapping.hasRepository &&
      !mapping.hasCrudOperations.create &&
      !mapping.hasCrudOperations.read &&
      !mapping.hasCrudOperations.update &&
      !mapping.hasCrudOperations.delete &&
      mapping.usageCount < 3
    );
  }

  async getTableRelationships(): Promise<Map<string, string[]>> {
    if (!this.supabase) {
      return new Map();
    }

    const relationships = new Map<string, string[]>();

    try {
      const { data, error } = await this.supabase.rpc('exec_sql', {
        sql: `
          SELECT
            tc.table_name AS from_table,
            ccu.table_name AS to_table
          FROM information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY' 
            AND tc.table_schema = 'public'
          ORDER BY tc.table_name;
        `,
      });

      if (!error && data) {
        data.forEach((rel: any) => {
          const related = relationships.get(rel.from_table) || [];
          related.push(rel.to_table);
          relationships.set(rel.from_table, related);
        });
      }
    } catch (error) {
      console.error('Error fetching relationships:', error);
    }

    return relationships;
  }

  getCachedMapping(tableName: string): DatabaseTableMapping | undefined {
    return this.tableCache.get(tableName);
  }

  clearCache(): void {
    this.tableCache.clear();
  }
}