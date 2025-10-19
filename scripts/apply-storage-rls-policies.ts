#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

const DATABASE_URL = process.env.SUPABASE_DB_URL || 'postgresql://postgres.rtwigjwqufozqfwozpvo:Duke-neepo-oliver-ttq5@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

async function checkPolicyExists(client: any, policyName: string): Promise<boolean> {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE policyname = $1
      AND schemaname = 'storage'
      AND tablename = 'objects'
    );
  `, [policyName]);

  return result.rows[0].exists;
}

async function applyStorageRLSPolicies() {
  console.log('='.repeat(60));
  console.log('Applying Storage RLS Policies for Image Buckets');
  console.log('Migration: 20251019000001_storage_rls_policies_for_images.sql');
  console.log('='.repeat(60));

  const { default: pg } = await import('pg');
  const { Client } = pg;

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    const policies = [
      'Users can upload template images in their tenant',
      'Public can view template images',
      'Users can update template images in their tenant',
      'Users can delete template images in their tenant',
      'Users can upload task images in their tenant',
      'Public can view task images',
      'Users can update task images in their tenant',
      'Users can delete task images in their tenant'
    ];

    console.log('Current policy status:');
    for (const policy of policies) {
      const exists = await checkPolicyExists(client, policy);
      console.log(`  ${policy}: ${exists ? '✓ exists' : '✗ does not exist'}`);
    }

    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20251019000001_storage_rls_policies_for_images.sql');

    if (!fs.existsSync(migrationPath)) {
      console.error(`✗ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    console.log('\nApplying RLS policies migration...');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    try {
      await client.query(sql);
      console.log('✓ Migration applied successfully\n');
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log('⚠ Migration applied with warnings (some policies already exist)\n');
      } else {
        console.error('✗ Migration failed:', error.message);
        throw error;
      }
    }

    console.log('='.repeat(60));
    console.log('Final policy status:');
    for (const policy of policies) {
      const exists = await checkPolicyExists(client, policy);
      console.log(`  ${policy}: ${exists ? '✓ exists' : '✗ MISSING'}`);
    }

    const allPoliciesExist = await Promise.all(
      policies.map(p => checkPolicyExists(client, p))
    ).then(results => results.every(exists => exists));

    console.log('\n' + '='.repeat(60));
    if (allPoliciesExist) {
      console.log('✓ RLS policies migration completed successfully!');
      console.log('✓ All 8 storage policies applied (4 per bucket)');
      console.log('\nNext steps:');
      console.log('  1. CODEX will handle T004-T006 (Domain Layer)');
      console.log('  2. Then continue with T007-T008 (Service Layer)');
    } else {
      console.error('✗ Migration incomplete - some policies missing');
      process.exit(1);
    }
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n✗ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyStorageRLSPolicies();
