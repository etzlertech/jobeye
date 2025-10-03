/**
 * @file Integration test for tenant_id migration process
 */

import { createTestClient, cleanupTestData } from '../test-utils';
import { MigrationTrackingRepository } from '@/domains/cleanup-tracking/repositories/migration-tracking.repository';

describe('Tenant Migration Integration', () => {
  const client = createTestClient();
  let migrationRepo: MigrationTrackingRepository;

  beforeEach(async () => {
    // Create test table with tenant_id
    await client.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS test_tenant_migration (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          tenant_id UUID NOT NULL,
          name VARCHAR(255),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    });

    // Insert test data
    await client.rpc('exec_sql', {
      sql: `
        INSERT INTO test_tenant_migration (tenant_id, name) VALUES
          ('11111111-1111-1111-1111-111111111111', 'Test 1'),
          ('11111111-1111-1111-1111-111111111111', 'Test 2'),
          ('22222222-2222-2222-2222-222222222222', 'Test 3');
      `
    });

    migrationRepo = new MigrationTrackingRepository(client);
  });

  afterEach(async () => {
    await client.rpc('exec_sql', {
      sql: 'DROP TABLE IF EXISTS test_tenant_migration CASCADE;'
    });
    await cleanupTestData(client, ['migration_tracking']);
  });

  it('should successfully migrate tenant_id to tenant_id', async () => {
    // Track the migration
    await migrationRepo.create({
      table_name: 'test_tenant_migration',
      has_tenant_id: true,
      has_tenant_id: false,
      row_count: 3,
      migration_status: 'pending'
    });

    // Execute migration
    await client.rpc('exec_sql', {
      sql: `
        ALTER TABLE test_tenant_migration 
        ADD COLUMN IF NOT EXISTS tenant_id UUID;
        
        UPDATE test_tenant_migration 
        SET tenant_id = tenant_id;
        
        ALTER TABLE test_tenant_migration 
        ALTER COLUMN tenant_id SET NOT NULL;
      `
    });

    // Verify migration
    const { data: columns } = await client.rpc('exec_sql', {
      sql: `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'test_tenant_migration'
        AND column_name IN ('tenant_id', 'tenant_id');
      `
    });

    expect(columns).toContainEqual({ column_name: 'tenant_id' });
    expect(columns).toContainEqual({ column_name: 'tenant_id' });

    // Verify data integrity
    const { data: rows } = await client.rpc('exec_sql', {
      sql: `
        SELECT COUNT(*) as count 
        FROM test_tenant_migration 
        WHERE tenant_id = tenant_id;
      `
    });

    expect(parseInt(rows[0].count)).toBe(3);

    // Update tracking
    const tracking = await migrationRepo.findByTableName('test_tenant_migration');
    await migrationRepo.update(tracking!.id, {
      has_tenant_id: true,
      migration_status: 'completed',
      migrated_at: new Date()
    });
  });

  it('should handle migration rollback', async () => {
    // Add tenant_id column
    await client.rpc('exec_sql', {
      sql: `
        ALTER TABLE test_tenant_migration 
        ADD COLUMN tenant_id UUID;
        
        UPDATE test_tenant_migration 
        SET tenant_id = tenant_id;
      `
    });

    // Simulate rollback need
    await client.rpc('exec_sql', {
      sql: `
        ALTER TABLE test_tenant_migration 
        DROP COLUMN tenant_id;
      `
    });

    // Verify rollback
    const { data: columns } = await client.rpc('exec_sql', {
      sql: `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'test_tenant_migration'
        AND column_name = 'tenant_id';
      `
    });

    expect(columns).toHaveLength(0);

    // Verify original data intact
    const { data: rows } = await client.rpc('exec_sql', {
      sql: 'SELECT COUNT(*) as count FROM test_tenant_migration;'
    });

    expect(parseInt(rows[0].count)).toBe(3);
  });

  it('should update RLS policies after migration', async () => {
    // Add tenant_id
    await client.rpc('exec_sql', {
      sql: `
        ALTER TABLE test_tenant_migration 
        ADD COLUMN tenant_id UUID;
        
        UPDATE test_tenant_migration 
        SET tenant_id = tenant_id;
        
        ALTER TABLE test_tenant_migration 
        ALTER COLUMN tenant_id SET NOT NULL;
      `
    });

    // Enable RLS
    await client.rpc('exec_sql', {
      sql: 'ALTER TABLE test_tenant_migration ENABLE ROW LEVEL SECURITY;'
    });

    // Create RLS policy using tenant_id
    await client.rpc('exec_sql', {
      sql: `
        CREATE POLICY tenant_isolation ON test_tenant_migration
        FOR ALL USING (
          tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
        );
      `
    });

    // Verify policy exists
    const { data: policies } = await client.rpc('exec_sql', {
      sql: `
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'test_tenant_migration';
      `
    });

    expect(policies).toContainEqual({ policyname: 'tenant_isolation' });
  });

  it('should track migration progress accurately', async () => {
    const tracking = await migrationRepo.create({
      table_name: 'test_tenant_migration',
      has_tenant_id: true,
      has_tenant_id: false,
      row_count: 3,
      migration_status: 'pending'
    });

    // Start migration
    await migrationRepo.update(tracking.id, {
      migration_status: 'in_progress'
    });

    // Simulate partial migration
    await client.rpc('exec_sql', {
      sql: `
        ALTER TABLE test_tenant_migration 
        ADD COLUMN tenant_id UUID;
      `
    });

    // Check can track partial state
    const current = await migrationRepo.findById(tracking.id);
    expect(current?.migration_status).toBe('in_progress');

    // Complete migration
    await client.rpc('exec_sql', {
      sql: `
        UPDATE test_tenant_migration 
        SET tenant_id = tenant_id;
      `
    });

    await migrationRepo.update(tracking.id, {
      has_tenant_id: true,
      migration_status: 'completed',
      migrated_at: new Date()
    });

    const final = await migrationRepo.findById(tracking.id);
    expect(final?.migration_status).toBe('completed');
    expect(final?.migrated_at).toBeTruthy();
  });
});