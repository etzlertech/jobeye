/**
 * @file Contract test for /api/cleanup/migration/execute endpoint
 */

import { POST } from '@/app/api/cleanup/migration/execute/route';
import { NextRequest } from 'next/server';
import { createTestClient, cleanupTestData } from '../test-utils';

describe('POST /api/cleanup/migration/execute', () => {
  const client = createTestClient();

  beforeEach(async () => {
    // Setup test table
    await client.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS test_migration_table (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          tenant_id UUID,
          data VARCHAR(255)
        );
      `
    });
    
    // Add test data
    await client.rpc('exec_sql', {
      sql: `
        INSERT INTO test_migration_table (tenant_id, data) 
        VALUES 
          ('11111111-1111-1111-1111-111111111111', 'test1'),
          ('22222222-2222-2222-2222-222222222222', 'test2');
      `
    });
    
    // Track in migration_tracking
    await client.from('migration_tracking').insert({
      table_name: 'test_migration_table',
      has_company_id: true,
      has_tenant_id: false,
      row_count: 2,
      migration_status: 'pending'
    });
  });

  afterEach(async () => {
    await cleanupTestData(client, ['migration_tracking']);
    await client.rpc('exec_sql', {
      sql: 'DROP TABLE IF EXISTS test_migration_table;'
    });
  });

  it('should execute migration successfully', async () => {
    const request = new Request('http://localhost:3000/api/cleanup/migration/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableName: 'test_migration_table' })
    });
    
    const response = await POST(request as unknown as NextRequest);
    
    expect(response.status).toBe(202); // Accepted
    
    const data = await response.json();
    
    // Validate response structure
    expect(data).toHaveProperty('migrationId');
    expect(data).toHaveProperty('tableName');
    expect(data.tableName).toBe('test_migration_table');
    expect(data).toHaveProperty('status');
    expect(['started', 'completed']).toContain(data.status);
    expect(data).toHaveProperty('rowsAffected');
    expect(data).toHaveProperty('duration');
  });

  it('should handle dry run mode', async () => {
    const request = new Request('http://localhost:3000/api/cleanup/migration/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        tableName: 'test_migration_table',
        dryRun: true 
      })
    });
    
    const response = await POST(request as unknown as NextRequest);
    
    expect(response.status).toBe(202);
    
    const data = await response.json();
    
    // Dry run should not actually modify data
    const { data: tracking } = await client
      .from('migration_tracking')
      .select('migration_status')
      .eq('table_name', 'test_migration_table')
      .single();

    expect(tracking).toBeTruthy();
    if (!tracking) {
      throw new Error('tracking row missing');
    }

    expect(tracking.migration_status).toBe('pending'); // Should still be pending
  });

  it('should reject invalid table names', async () => {
    const request = new Request('http://localhost:3000/api/cleanup/migration/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableName: 'non_existent_table' })
    });
    
    const response = await POST(request as unknown as NextRequest);
    
    expect(response.status).toBe(400);
    
    const error = await response.json();
    expect(error).toHaveProperty('error');
  });

  it('should prevent duplicate migrations', async () => {
    // Set status to in_progress
    await client
      .from('migration_tracking')
      .update({ migration_status: 'in_progress' })
      .eq('table_name', 'test_migration_table');
    
    const request = new Request('http://localhost:3000/api/cleanup/migration/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableName: 'test_migration_table' })
    });
    
    const response = await POST(request as unknown as NextRequest);
    
    expect(response.status).toBe(409); // Conflict
  });

  it('should handle missing request body', async () => {
    const request = new Request('http://localhost:3000/api/cleanup/migration/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const response = await POST(request as unknown as NextRequest);
    
    expect(response.status).toBe(400);
  });
});