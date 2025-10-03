/**
 * @file Integration test for migration rollback within deployment window
 */

import { createTestClient, cleanupTestData } from '../test-utils';

describe('Migration Rollback Integration', () => {
  const client = createTestClient();
  const testTable = 'test_rollback_migration';

  beforeEach(async () => {
    // Create test table with original tenant_id structure
    await client.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS ${testTable} (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          tenant_id UUID NOT NULL,
          name VARCHAR(255),
          email VARCHAR(255),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    });

    // Insert test data to preserve
    await client.rpc('exec_sql', {
      sql: `
        INSERT INTO ${testTable} (tenant_id, name, email) VALUES
          ('11111111-1111-1111-1111-111111111111', 'User 1', 'user1@test.com'),
          ('11111111-1111-1111-1111-111111111111', 'User 2', 'user2@test.com'),
          ('22222222-2222-2222-2222-222222222222', 'User 3', 'user3@test.com');
      `
    });
  });

  afterEach(async () => {
    await client.rpc('exec_sql', {
      sql: `DROP TABLE IF EXISTS ${testTable} CASCADE;`
    });
    await cleanupTestData(client, ['migration_tracking']);
  });

  it('should rollback migration immediately preserving all data', async () => {
    // Capture original data
    const { data: originalData } = await client.rpc('exec_sql', {
      sql: `SELECT id, tenant_id, name, email FROM ${testTable} ORDER BY name;`
    });

    expect(originalData).toHaveLength(3);

    // Apply migration (add tenant_id, copy data)
    await client.rpc('exec_sql', {
      sql: `
        ALTER TABLE ${testTable} ADD COLUMN tenant_id UUID;
        UPDATE ${testTable} SET tenant_id = tenant_id;
        ALTER TABLE ${testTable} ALTER COLUMN tenant_id SET NOT NULL;
      `
    });

    // Verify migration applied
    const { data: migratedColumns } = await client.rpc('exec_sql', {
      sql: `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = '${testTable}' 
        AND column_name IN ('tenant_id', 'tenant_id');
      `
    });

    expect(migratedColumns).toHaveLength(2);

    // Immediate rollback (within deployment window)
    await client.rpc('exec_sql', {
      sql: `ALTER TABLE ${testTable} DROP COLUMN tenant_id;`
    });

    // Verify rollback completed
    const { data: rolledBackColumns } = await client.rpc('exec_sql', {
      sql: `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = '${testTable}' 
        AND column_name = 'tenant_id';
      `
    });

    expect(rolledBackColumns).toHaveLength(0);

    // Verify all data preserved
    const { data: finalData } = await client.rpc('exec_sql', {
      sql: `SELECT id, tenant_id, name, email FROM ${testTable} ORDER BY name;`
    });

    expect(finalData).toHaveLength(3);
    expect(finalData).toEqual(originalData);
  });

  it('should rollback complex migration with RLS policies', async () => {
    const originalRowCount = await getRowCount();
    
    // Apply full migration with RLS
    await client.rpc('exec_sql', {
      sql: `
        -- Add tenant_id
        ALTER TABLE ${testTable} ADD COLUMN tenant_id UUID;
        UPDATE ${testTable} SET tenant_id = tenant_id;
        ALTER TABLE ${testTable} ALTER COLUMN tenant_id SET NOT NULL;
        
        -- Enable RLS
        ALTER TABLE ${testTable} ENABLE ROW LEVEL SECURITY;
        
        -- Create RLS policy
        CREATE POLICY tenant_isolation ON ${testTable}
        FOR ALL USING (
          tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
        );
      `
    });

    // Rollback everything
    await client.rpc('exec_sql', {
      sql: `
        -- Drop policy first
        DROP POLICY IF EXISTS tenant_isolation ON ${testTable};
        
        -- Disable RLS
        ALTER TABLE ${testTable} DISABLE ROW LEVEL SECURITY;
        
        -- Remove tenant_id column
        ALTER TABLE ${testTable} DROP COLUMN tenant_id;
      `
    });

    // Verify complete rollback
    const { data: columns } = await client.rpc('exec_sql', {
      sql: `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = '${testTable}';
      `
    });

    const columnNames = columns.map(c => c.column_name);
    expect(columnNames).not.toContain('tenant_id');
    expect(columnNames).toContain('tenant_id');

    // Verify RLS disabled
    const { data: rlsStatus } = await client.rpc('exec_sql', {
      sql: `
        SELECT relrowsecurity 
        FROM pg_class 
        WHERE relname = '${testTable}';
      `
    });

    expect(rlsStatus[0].relrowsecurity).toBe(false);

    // Verify no policies exist
    const { data: policies } = await client.rpc('exec_sql', {
      sql: `
        SELECT COUNT(*) as count 
        FROM pg_policy 
        JOIN pg_class ON pg_policy.polrelid = pg_class.oid 
        WHERE pg_class.relname = '${testTable}';
      `
    });

    expect(parseInt(policies[0].count)).toBe(0);

    // Verify data integrity
    expect(await getRowCount()).toBe(originalRowCount);
  });

  it('should handle partial migration rollback', async () => {
    // Start migration
    await client.rpc('exec_sql', {
      sql: `ALTER TABLE ${testTable} ADD COLUMN tenant_id UUID;`
    });

    // Simulate failure during data copy
    try {
      await client.rpc('exec_sql', {
        sql: `UPDATE ${testTable} SET tenant_id = 'invalid-uuid';` // This should fail
      });
    } catch (error) {
      // Expected to fail
    }

    // Rollback partial migration
    await client.rpc('exec_sql', {
      sql: `ALTER TABLE ${testTable} DROP COLUMN tenant_id;`
    });

    // Verify clean rollback
    const { data: columns } = await client.rpc('exec_sql', {
      sql: `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = '${testTable}';
      `
    });

    const columnNames = columns.map(c => c.column_name);
    expect(columnNames).not.toContain('tenant_id');
    
    // All original data should be intact
    const originalRowCount = 3;
    expect(await getRowCount()).toBe(originalRowCount);
  });

  it('should validate deployment window constraints', async () => {
    const deploymentStart = new Date();
    
    // Apply migration
    await client.rpc('exec_sql', {
      sql: `
        ALTER TABLE ${testTable} ADD COLUMN tenant_id UUID;
        UPDATE ${testTable} SET tenant_id = tenant_id;
      `
    });

    // Simulate time passing (in test, we just check the concept)
    const migrationTime = new Date();
    const deploymentDuration = migrationTime.getTime() - deploymentStart.getTime();
    
    // In real scenario, rollback should only be allowed within deployment window
    // For test purposes, we verify that immediate rollback works
    const canRollback = deploymentDuration < (10 * 60 * 1000); // 10 minutes
    
    if (canRollback) {
      await client.rpc('exec_sql', {
        sql: `ALTER TABLE ${testTable} DROP COLUMN tenant_id;`
      });
      
      // Verify successful rollback
      const { data: columns } = await client.rpc('exec_sql', {
        sql: `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = '${testTable}' 
          AND column_name = 'tenant_id';
        `
      });
      
      expect(columns).toHaveLength(0);
    }
    
    // This test documents the constraint that rollback should only
    // be allowed within the same deployment window
    expect(canRollback).toBe(true);
  });

  async function getRowCount(): Promise<number> {
    const { data } = await client.rpc('exec_sql', {
      sql: `SELECT COUNT(*) as count FROM ${testTable};`
    });
    return parseInt(data[0].count);
  }
});