#!/usr/bin/env tsx
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { Client as PgClient } from 'pg';

type TableCategory = 'dependency' | 'ocr';

type ColumnExpectation = {
  name: string;
  description: string;
};

type TableExpectation = {
  table: string;
  category: TableCategory;
  description: string;
  requiredColumns: ColumnExpectation[];
};

type ColumnInfo = {
  column_name: string;
  data_type: string;
  is_nullable: 'YES' | 'NO';
  column_default: string | null;
};

type IndexInfo = {
  indexname: string;
  indexdef: string;
};

type TableReport = {
  table: string;
  category: TableCategory;
  exists: boolean;
  rowCount: number | null;
  missingColumns: ColumnExpectation[];
  columns: ColumnInfo[];
  indexes: IndexInfo[];
};

type PreflightIssue = {
  table: string;
  message: string;
};

export type PreflightResult = {
  issues: PreflightIssue[];
  tables: TableReport[];
  reportPath: string;
  reportContent: string;
};

type PreflightOptions = {
  failOnIssues?: boolean;
  reportPath?: string;
  includeConsoleSummary?: boolean;
};

const DEFAULT_SUPABASE_URL = 'https://rtwigjwqufozqfwozpvo.supabase.co';
const DEFAULT_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d2lnandxdWZvenFmd296cHZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDI1MDMwMCwiZXhwIjoyMDY5ODI2MzAwfQ.e4U3aDv5GDIFiPlY_JcveGwbAT9p-ahiW_0hhoOUoY0';
const DEFAULT_DB_URL = 'postgresql://postgres.rtwigjwqufozqfwozpvo:Duke-neepo-oliver-ttq5@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

const REPORT_RELATIVE_PATH = path.join('reports', 'db-precheck-ocr.txt');

const TABLE_EXPECTATIONS: TableExpectation[] = [
  {
    table: 'vendors',
    category: 'dependency',
    description: 'Vendor master data required for OCR associations',
    requiredColumns: [
      { name: 'id', description: 'Primary key for vendor' },
      { name: 'company_id', description: 'Owning company identifier' },
      { name: 'name', description: 'Vendor display name' }
    ]
  },
  {
    table: 'inventory_images',
    category: 'dependency',
    description: 'Source images used for OCR ingestion',
    requiredColumns: [
      { name: 'id', description: 'Primary key for inventory image' },
      { name: 'company_id', description: 'Owning company identifier' },
      { name: 'url', description: 'Image location' }
    ]
  },
  {
    table: 'ocr_jobs',
    category: 'ocr',
    description: 'Inbound OCR job requests',
    requiredColumns: [
      { name: 'id', description: 'Primary key for job' },
      { name: 'company_id', description: 'Tenant scoping for job' },
      { name: 'status', description: 'Processing status for job' }
    ]
  },
  {
    table: 'ocr_documents',
    category: 'ocr',
    description: 'Document metadata extracted from OCR jobs',
    requiredColumns: [
      { name: 'id', description: 'Primary key for document' },
      { name: 'job_id', description: 'Associated OCR job' },
      { name: 'company_id', description: 'Tenant scoping for document' }
    ]
  },
  {
    table: 'ocr_line_items',
    category: 'ocr',
    description: 'Item-level data captured from OCR documents',
    requiredColumns: [
      { name: 'id', description: 'Primary key for line item' },
      { name: 'document_id', description: 'Owning OCR document' },
      { name: 'company_id', description: 'Tenant scoping for line item' }
    ]
  },
  {
    table: 'ocr_note_entities',
    category: 'ocr',
    description: 'Structured note entities extracted from OCR',
    requiredColumns: [
      { name: 'id', description: 'Primary key for note entity' },
      { name: 'document_id', description: 'Associated OCR document' },
      { name: 'company_id', description: 'Tenant scoping for note entity' }
    ]
  },
  {
    table: 'vendor_aliases',
    category: 'ocr',
    description: 'Vendor alias mappings for OCR normalization',
    requiredColumns: [
      { name: 'id', description: 'Primary key for vendor alias' },
      { name: 'vendor_id', description: 'Linked vendor record' },
      { name: 'company_id', description: 'Tenant scoping for alias' }
    ]
  },
  {
    table: 'vendor_locations',
    category: 'ocr',
    description: 'Vendor location mapping for OCR results',
    requiredColumns: [
      { name: 'id', description: 'Primary key for vendor location' },
      { name: 'vendor_id', description: 'Linked vendor record' },
      { name: 'company_id', description: 'Tenant scoping for location' }
    ]
  }
];

function resolveSupabaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    DEFAULT_SUPABASE_URL
  );
}

function resolveServiceRoleKey(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    DEFAULT_SERVICE_ROLE_KEY
  );
}

function resolveDatabaseUrl(): string {
  return process.env.SUPABASE_DB_URL || DEFAULT_DB_URL;
}

async function fetchColumns(client: PgClient, table: string): Promise<ColumnInfo[]> {
  const result = await client.query<ColumnInfo>(
    `SELECT column_name, data_type, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table]
  );
  return result.rows;
}

async function fetchIndexes(client: PgClient, table: string): Promise<IndexInfo[]> {
  const result = await client.query<IndexInfo>(
    `SELECT indexname, indexdef
     FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = $1
     ORDER BY indexname`,
    [table]
  );
  return result.rows;
}

async function tableExists(client: PgClient, table: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [table]
  );
  return result.rows[0]?.exists ?? false;
}

type SupabaseClient = ReturnType<typeof createClient>;

function buildSupabaseClient(): SupabaseClient {
  const url = resolveSupabaseUrl();
  const serviceRoleKey = resolveServiceRoleKey();

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase credentials are required to run the OCR preflight check.');
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

async function fetchRowCount(supabase: SupabaseClient, table: string): Promise<number | null> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });

  if (error) {
    return null;
  }

  return count ?? 0;
}

function formatTableHeader(table: string, category: TableCategory): string {
  const label = category === 'dependency' ? 'Dependency' : 'OCR';
  return `\n=== ${label} table: ${table} ===`;
}

function buildReportContent(tables: TableReport[], issues: PreflightIssue[], startedAt: Date, supabaseUrl: string): string {
  const lines: string[] = [];
  lines.push('# OCR Migration Preflight Report');
  lines.push('');
  lines.push(`Timestamp: ${startedAt.toISOString()}`);
  lines.push(`Supabase URL: ${supabaseUrl}`);
  lines.push('');

  if (issues.length > 0) {
    lines.push('## Issues Detected');
    for (const issue of issues) {
      lines.push(`- **${issue.table}**: ${issue.message}`);
    }
    lines.push('');
  } else {
    lines.push('## Issues Detected');
    lines.push('- None (all clear)');
    lines.push('');
  }

  lines.push('## Table Details');

  for (const table of tables) {
    lines.push(`### ${table.table}`);
    lines.push(`- Category: ${table.category}`);
    lines.push(`- Exists: ${table.exists ? 'Yes' : 'No'}`);
    lines.push(`- Row count: ${table.rowCount ?? 'N/A'}`);
    if (table.missingColumns.length > 0) {
      lines.push('- Missing columns:');
      for (const column of table.missingColumns) {
        lines.push(`  - ${column.name} (${column.description})`);
      }
    } else {
      lines.push('- Missing columns: None');
    }

    if (table.columns.length > 0) {
      lines.push('- Columns:');
      for (const col of table.columns) {
        const defaultValue = col.column_default ? ` (default: ${col.column_default.trim()})` : '';
        lines.push(`  - ${col.column_name}: ${col.data_type}, nullable=${col.is_nullable}${defaultValue}`);
      }
    }

    if (table.indexes.length > 0) {
      lines.push('- Indexes:');
      for (const idx of table.indexes) {
        lines.push(`  - ${idx.indexname}: ${idx.indexdef}`);
      }
    } else {
      lines.push('- Indexes: None');
    }

    lines.push('');
  }

  return lines.join('\n');
}

export class PreflightCheckError extends Error {
  result: PreflightResult;

  constructor(message: string, result: PreflightResult) {
    super(message);
    this.name = 'PreflightCheckError';
    this.result = result;
  }
}

export async function runOcrPreflightCheck(options: PreflightOptions = {}): Promise<PreflightResult> {
  const failOnIssues = options.failOnIssues ?? true;
  const includeConsoleSummary = options.includeConsoleSummary ?? true;
  const supabaseUrl = resolveSupabaseUrl();
  const dbUrl = resolveDatabaseUrl();

  const startedAt = new Date();

  const supabase = buildSupabaseClient();
  const client = new PgClient({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  const tables: TableReport[] = [];
  const issues: PreflightIssue[] = [];

  try {
    for (const expectation of TABLE_EXPECTATIONS) {
      if (includeConsoleSummary) {
        console.log(formatTableHeader(expectation.table, expectation.category));
      }

      const exists = await tableExists(client, expectation.table);
      const report: TableReport = {
        table: expectation.table,
        category: expectation.category,
        exists,
        rowCount: null,
        missingColumns: [],
        columns: [],
        indexes: []
      };

      if (!exists) {
        const message = 'Table is missing';
        issues.push({ table: expectation.table, message });
        if (includeConsoleSummary) {
          console.log('[WARN]  Missing table');
        }
        tables.push(report);
        continue;
      }

      const [columns, indexes, rowCount] = await Promise.all([
        fetchColumns(client, expectation.table),
        fetchIndexes(client, expectation.table),
        fetchRowCount(supabase, expectation.table)
      ]);

      report.columns = columns;
      report.indexes = indexes;
      report.rowCount = rowCount;

      const columnSet = new Set(columns.map((col) => col.column_name));
      const missingColumns = expectation.requiredColumns.filter((col) => !columnSet.has(col.name));

      report.missingColumns = missingColumns;

      if (missingColumns.length > 0) {
        issues.push({
          table: expectation.table,
          message: `Missing required columns: ${missingColumns.map((c) => c.name).join(', ')}`
        });
      }

      if (includeConsoleSummary) {
        console.log(`Row count: ${rowCount ?? 'N/A'}`);
        if (missingColumns.length > 0) {
          console.log(`Missing columns: ${missingColumns.map((c) => c.name).join(', ')}`);
        } else {
          console.log('All required columns present.');
        }
        if (indexes.length > 0) {
          console.log(`Indexes: ${indexes.map((idx) => idx.indexname).join(', ')}`);
        } else {
          console.log('No indexes found.');
        }
      }

      tables.push(report);
    }
  } finally {
    await client.end();
  }

  const reportPath = options.reportPath
    ? path.resolve(options.reportPath)
    : path.resolve(process.cwd(), REPORT_RELATIVE_PATH);

  const reportDir = path.dirname(reportPath);
  await fs.mkdir(reportDir, { recursive: true });

  const reportContent = buildReportContent(tables, issues, startedAt, supabaseUrl);
  await fs.writeFile(reportPath, reportContent, 'utf8');

  const result: PreflightResult = {
    issues,
    tables,
    reportPath,
    reportContent
  };

  if (failOnIssues && issues.length > 0) {
    throw new PreflightCheckError('OCR preflight check detected issues.', result);
  }

  if (includeConsoleSummary) {
    console.log('\nOCR preflight complete. Report written to:', reportPath);
  }

  return result;
}

async function main() {
  try {
    await runOcrPreflightCheck();
  } catch (error) {
    if (error instanceof PreflightCheckError) {
      console.error(error.message);
      console.error('See report for details:', error.result.reportPath);
      process.exit(1);
    }

    console.error(error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${__filename}`) {
  main();
}

