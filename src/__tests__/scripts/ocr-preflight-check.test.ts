import type { PreflightResult } from '../../../scripts/ocr-preflight-check';
import { PreflightCheckError, runOcrPreflightCheck } from '../../../scripts/ocr-preflight-check';

jest.mock('node:fs', () => {
  const mkdir = jest.fn(() => Promise.resolve());
  const writeFile = jest.fn(() => Promise.resolve());
  return {
    promises: { mkdir, writeFile },
    __mock: { mkdir, writeFile },
  };
});

const fsMock = jest.requireMock('node:fs') as {
  promises: { mkdir: jest.Mock; writeFile: jest.Mock };
  __mock: { mkdir: jest.Mock; writeFile: jest.Mock };
};
const mkdirMock = fsMock.__mock.mkdir;
const writeFileMock = fsMock.__mock.writeFile;

const queryMock = jest.fn();
const connectMock = jest.fn(() => Promise.resolve());
const endMock = jest.fn(() => Promise.resolve());

jest.mock('pg', () => ({
  Client: jest.fn(() => ({
    connect: connectMock,
    query: queryMock,
    end: endMock,
  })),
}));

const fromMock = jest.fn();
const createClientMock = jest.fn(() => ({
  from: fromMock,
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

type TableState = {
  exists: boolean;
  columns: Array<{ column_name: string; data_type: string; is_nullable: 'YES' | 'NO'; column_default: string | null }>;
  indexes: Array<{ indexname: string; indexdef: string }>;
  rows: number | null;
};

describe('ocr-preflight-check', () => {
  const tableState: Record<string, TableState> = {};

  beforeEach(() => {
    jest.clearAllMocks();

    mkdirMock.mockClear();
    writeFileMock.mockClear();
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue(undefined);

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.SUPABASE_DB_URL = 'postgresql://user:pass@example.com:5432/postgres';

    Object.keys(tableState).forEach((key) => delete tableState[key]);

    queryMock.mockImplementation(async (sql: string, params: [string]) => {
      const table = params?.[0];
      const state = table ? tableState[table] : undefined;

      if (sql.includes('SELECT EXISTS')) {
        return { rows: [{ exists: Boolean(state?.exists) }] };
      }

      if (sql.includes('FROM information_schema.columns')) {
        return { rows: state?.columns ?? [] };
      }

      if (sql.includes('FROM pg_indexes')) {
        return { rows: state?.indexes ?? [] };
      }

      return { rows: [] };
    });

    fromMock.mockImplementation((table: string) => ({
      select: () => Promise.resolve({ count: tableState[table]?.rows ?? 0, error: null }),
    }));
  });

  function seedTable(
    table: string,
    overrides: Partial<TableState> = {},
  ) {
    tableState[table] = {
      exists: true,
      columns: [],
      indexes: [],
      rows: 0,
      ...overrides,
    };
  }

  function column(name: string, data_type = 'text'): TableState['columns'][number] {
    return { column_name: name, data_type, is_nullable: 'NO', column_default: null };
  }

  it('detects missing tables', async () => {
    seedTable('inventory_images');
    seedTable('ocr_jobs');
    seedTable('ocr_documents');
    seedTable('ocr_line_items');
    seedTable('ocr_note_entities');
    seedTable('vendor_aliases');
    seedTable('vendor_locations');

    const run = runOcrPreflightCheck({ includeConsoleSummary: false });

    await expect(run).rejects.toBeInstanceOf(PreflightCheckError);

    try {
      await run;
    } catch (error) {
      expect(error).toBeInstanceOf(PreflightCheckError);
      const result = (error as PreflightCheckError).result as PreflightResult;
      expect(result.issues.some((issue) => issue.table === 'vendors')).toBe(true);
      expect(writeFileMock).toHaveBeenCalledTimes(1);
      const report = writeFileMock.mock.calls[0][1] as string;
      expect(report).toContain('vendors');
    }
  });

  it('passes with all tables present', async () => {
    const requiredTables = [
      'vendors',
      'inventory_images',
      'ocr_jobs',
      'ocr_documents',
      'ocr_line_items',
      'ocr_note_entities',
      'vendor_aliases',
      'vendor_locations',
    ];

    for (const table of requiredTables) {
      seedTable(table, {
        columns: [
          column('id', 'uuid'),
          column('company_id', 'uuid'),
        ],
        rows: 3,
      });
    }

    tableState.vendors.columns.push(column('name', 'text'));
    tableState.inventory_images.columns.push(column('url', 'text'));
    tableState.ocr_jobs.columns.push(column('status', 'text'));
    tableState.ocr_documents.columns.push(column('job_id', 'uuid'));
    tableState.ocr_line_items.columns.push(column('document_id', 'uuid'));
    tableState.ocr_note_entities.columns.push(column('document_id', 'uuid'));
    tableState.vendor_aliases.columns.push(column('vendor_id', 'uuid'));
    tableState.vendor_locations.columns.push(column('vendor_id', 'uuid'));

    const result = await runOcrPreflightCheck({ failOnIssues: true, includeConsoleSummary: false });

    expect(result.issues).toHaveLength(0);
    expect(writeFileMock).toHaveBeenCalledTimes(1);
  });

  it('identifies schema drift when required columns are missing', async () => {
    const requiredTables = [
      'vendors',
      'inventory_images',
      'ocr_jobs',
      'ocr_documents',
      'ocr_line_items',
      'ocr_note_entities',
      'vendor_aliases',
      'vendor_locations',
    ];

    for (const table of requiredTables) {
      seedTable(table, {
        columns: [
          column('id', 'uuid'),
          column('company_id', 'uuid'),
        ],
        rows: 1,
      });
    }

    tableState.vendors.columns.push(column('name', 'text'));
    tableState.inventory_images.columns.push(column('url', 'text'));
    tableState.ocr_documents.columns.push(column('job_id', 'uuid'));
    tableState.ocr_line_items.columns.push(column('document_id', 'uuid'));
    tableState.ocr_note_entities.columns.push(column('document_id', 'uuid'));
    tableState.vendor_aliases.columns.push(column('vendor_id', 'uuid'));
    tableState.vendor_locations.columns.push(column('vendor_id', 'uuid'));

    await expect(runOcrPreflightCheck({ includeConsoleSummary: false })).rejects.toBeInstanceOf(PreflightCheckError);
  });
});
