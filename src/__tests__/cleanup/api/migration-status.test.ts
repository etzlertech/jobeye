/**
 * @file Contract test for /api/cleanup/migration/status endpoint
 */

import { GET } from '@/app/api/cleanup/migration/status/route';
import { NextRequest } from 'next/server';
import { createTestClient, cleanupTestData } from '../test-utils';

describe('GET /api/cleanup/migration/status', () => {
  const client = createTestClient();

  beforeEach(async () => {
    // Seed test data
    await client.from('migration_tracking').insert([
      {
        table_name: 'test_table_1',
        has_company_id: true,
        has_tenant_id: false,
        row_count: 10,
        migration_status: 'pending'
      },
      {
        table_name: 'test_table_2',
        has_company_id: true,
        has_tenant_id: true,
        row_count: 5,
        migration_status: 'completed',
        migrated_at: new Date()
      }
    ]);
  });

  afterEach(async () => {
    await cleanupTestData(client, ['migration_tracking']);
  });

  it('should return all migration statuses', async () => {
    const request = new Request('http://localhost:3000/api/cleanup/migration/status');
    const response = await GET(request as unknown as NextRequest);
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    
    // Validate response structure
    expect(data).toHaveProperty('migrations');
    expect(Array.isArray(data.migrations)).toBe(true);
    expect(data.migrations.length).toBeGreaterThan(0);
    
    // Validate migration item structure
    const migration = data.migrations[0];
    expect(migration).toHaveProperty('id');
    expect(migration).toHaveProperty('tableName');
    expect(migration).toHaveProperty('hasCompanyId');
    expect(migration).toHaveProperty('hasTenantId');
    expect(migration).toHaveProperty('rowCount');
    expect(migration).toHaveProperty('status');
    
    // Validate summary
    expect(data).toHaveProperty('summary');
    expect(data.summary).toHaveProperty('total');
    expect(data.summary).toHaveProperty('pending');
    expect(data.summary).toHaveProperty('completed');
    expect(data.summary).toHaveProperty('failed');
    expect(data.summary).toHaveProperty('skipped');
    expect(data.summary).toHaveProperty('inProgress');
  });

  it('should filter by status when provided', async () => {
    const request = new Request('http://localhost:3000/api/cleanup/migration/status?status=pending');
    const response = await GET(request as unknown as NextRequest);
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    
    // All returned migrations should have pending status
    expect(data.migrations.every((m: any) => m.status === 'pending')).toBe(true);
  });

  it('should handle invalid status parameter', async () => {
    const request = new Request('http://localhost:3000/api/cleanup/migration/status?status=invalid');
    const response = await GET(request as unknown as NextRequest);
    
    // Should either ignore invalid status or return 400
    expect([200, 400]).toContain(response.status);
  });
});