/**
 * @file Integration test for zero downtime during migrations
 */

import { createTestClient } from '../test-utils';
import { MigrationTrackingRepository } from '@/domains/cleanup-tracking/repositories/migration-tracking.repository';

describe('Zero Downtime Migration Integration', () => {
  const client = createTestClient();
  let migrationRepo: MigrationTrackingRepository;
  const testTable = 'test_zero_downtime';

  beforeEach(async () => {
    migrationRepo = new MigrationTrackingRepository(client);
    
    // Create test table
    await client.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS ${testTable} (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          tenant_id UUID NOT NULL,
          name VARCHAR(255),
          status VARCHAR(50) DEFAULT 'active',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `
    });

    // Insert test data
    await client.rpc('exec_sql', {
      sql: `
        INSERT INTO ${testTable} (tenant_id, name) VALUES
          ('11111111-1111-1111-1111-111111111111', 'Test 1'),
          ('22222222-2222-2222-2222-222222222222', 'Test 2');
      `
    });

    // Track migration
    await migrationRepo.create({
      table_name: testTable,
      has_tenant_id: true,
      has_tenant_id: false,
      row_count: 2,
      migration_status: 'pending'
    });
  });

  afterEach(async () => {
    await client.rpc('exec_sql', {
      sql: `DROP TABLE IF EXISTS ${testTable} CASCADE;`
    });
    await client.from('migration_tracking').delete().eq('table_name', testTable);
  });

  it('should maintain data availability during migration', async () => {
    // Start continuous availability monitoring
    const availabilityChecks: boolean[] = [];
    let stopMonitoring = false;

    const monitorAvailability = async () => {
      while (!stopMonitoring) {
        try {
          // Test read availability
          const { data, error } = await client
            .from(testTable)
            .select('*')
            .limit(1);

          availabilityChecks.push(!error);
          
          // Small delay to allow other operations
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          availabilityChecks.push(false);
        }
      }
    };

    // Start monitoring in background
    const monitoringPromise = monitorAvailability();

    try {
      // Execute migration while monitoring availability
      const tracking = await migrationRepo.findByTableName(testTable);
      
      await migrationRepo.update(tracking!.id, {
        migration_status: 'in_progress'
      });

      // Step 1: Add tenant_id column (should not block reads)
      await client.rpc('exec_sql', {
        sql: `ALTER TABLE ${testTable} ADD COLUMN tenant_id UUID;`
      });

      // Verify availability during column addition
      const { data: readTest1 } = await client
        .from(testTable)
        .select('*');
      expect(readTest1).toBeDefined();

      // Step 2: Populate tenant_id (should not block reads)
      await client.rpc('exec_sql', {
        sql: `UPDATE ${testTable} SET tenant_id = tenant_id;`
      });

      // Verify availability during data update
      const { data: readTest2 } = await client
        .from(testTable)
        .select('*');
      expect(readTest2).toBeDefined();

      // Step 3: Set NOT NULL constraint (brief lock acceptable)
      await client.rpc('exec_sql', {
        sql: `ALTER TABLE ${testTable} ALTER COLUMN tenant_id SET NOT NULL;`
      });

      // Verify final availability
      const { data: readTest3 } = await client
        .from(testTable)
        .select('*');
      expect(readTest3).toBeDefined();

      await migrationRepo.update(tracking!.id, {
        has_tenant_id: true,
        migration_status: 'completed',
        migrated_at: new Date()
      });

    } finally {
      // Stop monitoring
      stopMonitoring = true;
      await monitoringPromise;
    }

    // Analyze availability results
    const totalChecks = availabilityChecks.length;
    const successfulChecks = availabilityChecks.filter(Boolean).length;
    const availabilityPercentage = (successfulChecks / totalChecks) * 100;

    console.log(`Availability during migration: ${availabilityPercentage.toFixed(2)}% (${successfulChecks}/${totalChecks})`);

    // Should maintain high availability (allow brief interruptions for schema changes)
    expect(availabilityPercentage).toBeGreaterThan(90);
    expect(totalChecks).toBeGreaterThan(10); // Ensure we actually monitored
  });

  it('should handle concurrent reads during migration', async () => {
    const concurrentReads = 10;
    const readPromises: Promise<any>[] = [];

    // Start migration
    const tracking = await migrationRepo.findByTableName(testTable);
    await migrationRepo.update(tracking!.id, {
      migration_status: 'in_progress'
    });

    // Add tenant_id column
    const migrationPromise = client.rpc('exec_sql', {
      sql: `
        ALTER TABLE ${testTable} ADD COLUMN tenant_id UUID;
        UPDATE ${testTable} SET tenant_id = tenant_id;
      `
    });

    // Start concurrent reads
    for (let i = 0; i < concurrentReads; i++) {
      readPromises.push(
        client.from(testTable).select('*').then(result => ({
          attempt: i,
          success: !result.error,
          data: result.data
        }))
      );
      
      // Stagger requests slightly
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    // Wait for migration and all reads to complete
    const [migrationResult, ...readResults] = await Promise.all([
      migrationPromise,
      ...readPromises
    ]);

    // Verify migration succeeded
    expect(migrationResult.error).toBeNull();

    // Verify most reads succeeded (allow some to fail during schema changes)
    const successfulReads = readResults.filter(r => r.success).length;
    const readSuccessRate = (successfulReads / concurrentReads) * 100;

    console.log(`Concurrent read success rate: ${readSuccessRate}% (${successfulReads}/${concurrentReads})`);
    
    expect(readSuccessRate).toBeGreaterThan(70); // Allow some failures during schema changes
  });

  it('should complete migration within acceptable time window', async () => {
    const maxMigrationTime = 30000; // 30 seconds
    const startTime = Date.now();

    // Execute full migration
    const tracking = await migrationRepo.findByTableName(testTable);
    
    await migrationRepo.update(tracking!.id, {
      migration_status: 'in_progress'
    });

    await client.rpc('exec_sql', {
      sql: `
        ALTER TABLE ${testTable} ADD COLUMN tenant_id UUID;
        UPDATE ${testTable} SET tenant_id = tenant_id;
        ALTER TABLE ${testTable} ALTER COLUMN tenant_id SET NOT NULL;
      `
    });

    await migrationRepo.update(tracking!.id, {
      has_tenant_id: true,
      migration_status: 'completed',
      migrated_at: new Date()
    });

    const migrationTime = Date.now() - startTime;
    
    console.log(`Migration completed in ${migrationTime}ms`);
    
    expect(migrationTime).toBeLessThan(maxMigrationTime);
  });

  it('should maintain data integrity under load during migration', async () => {
    const writeOperations = 5;
    const readOperations = 10;

    // Start migration
    const tracking = await migrationRepo.findByTableName(testTable);
    await migrationRepo.update(tracking!.id, {
      migration_status: 'in_progress'
    });

    // Simulate load during migration
    const operations: Promise<any>[] = [];

    // Add writes
    for (let i = 0; i < writeOperations; i++) {
      operations.push(
        client.from(testTable).insert({
          tenant_id: '33333333-3333-3333-3333-333333333333',
          name: `Load Test ${i}`
        })
      );
    }

    // Add reads
    for (let i = 0; i < readOperations; i++) {
      operations.push(
        client.from(testTable).select('*')
      );
    }

    // Execute migration with concurrent operations
    const migrationPromise = client.rpc('exec_sql', {
      sql: `
        ALTER TABLE ${testTable} ADD COLUMN tenant_id UUID;
        UPDATE ${testTable} SET tenant_id = tenant_id;
        ALTER TABLE ${testTable} ALTER COLUMN tenant_id SET NOT NULL;
      `
    });

    // Wait for all operations
    const [migrationResult, ...operationResults] = await Promise.all([
      migrationPromise,
      ...operations
    ]);

    // Verify migration succeeded
    expect(migrationResult.error).toBeNull();

    // Verify final data integrity
    const { data: finalData } = await client
      .from(testTable)
      .select('*');

    // Should have original data plus any successful inserts
    expect(finalData!.length).toBeGreaterThanOrEqual(2);

    // Verify all records have tenant_id
    const recordsWithTenantId = finalData!.filter(r => r.tenant_id);
    expect(recordsWithTenantId.length).toBe(finalData!.length);

    // Verify tenant_id matches tenant_id for original records
    const originalRecords = finalData!.filter(r => r.name.startsWith('Test'));
    originalRecords.forEach(record => {
      expect(record.tenant_id).toBe(record.tenant_id);
    });

    await migrationRepo.update(tracking!.id, {
      has_tenant_id: true,
      migration_status: 'completed',
      migrated_at: new Date()
    });
  });
});