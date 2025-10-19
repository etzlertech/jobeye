#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';

const DATABASE_URL = process.env.SUPABASE_DB_URL || 'postgresql://postgres.rtwigjwqufozqfwozpvo:Duke-neepo-oliver-ttq5@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

async function checkColumnExists(client: any, tableName: string, columnName: string): Promise<boolean> {
  const result = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = $1
      AND column_name = $2
      AND table_schema = 'public'
    );
  `, [tableName, columnName]);

  return result.rows[0].exists;
}

async function applyImagesMigration() {
  console.log('='.repeat(60));
  console.log('Applying Template and Task Images Migration');
  console.log('Migration: 20251019000000_add_images_to_templates_and_tasks.sql');
  console.log('='.repeat(60));

  // Use pg directly for migrations
  const { default: pg } = await import('pg');
  const { Client } = pg;

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✓ Connected to database\n');

    // Check current state
    console.log('Current column status:');
    console.log('\ntask_templates:');
    const ttThumbnail = await checkColumnExists(client, 'task_templates', 'thumbnail_url');
    const ttMedium = await checkColumnExists(client, 'task_templates', 'medium_url');
    const ttPrimary = await checkColumnExists(client, 'task_templates', 'primary_image_url');
    console.log(`  thumbnail_url: ${ttThumbnail ? '✓ exists' : '✗ does not exist'}`);
    console.log(`  medium_url: ${ttMedium ? '✓ exists' : '✗ does not exist'}`);
    console.log(`  primary_image_url: ${ttPrimary ? '✓ exists' : '✗ does not exist'}`);

    console.log('\nworkflow_tasks:');
    const wtThumbnail = await checkColumnExists(client, 'workflow_tasks', 'thumbnail_url');
    const wtMedium = await checkColumnExists(client, 'workflow_tasks', 'medium_url');
    const wtPrimary = await checkColumnExists(client, 'workflow_tasks', 'primary_image_url');
    console.log(`  thumbnail_url: ${wtThumbnail ? '✓ exists' : '✗ does not exist'}`);
    console.log(`  medium_url: ${wtMedium ? '✓ exists' : '✗ does not exist'}`);
    console.log(`  primary_image_url: ${wtPrimary ? '✓ exists' : '✗ does not exist'}`);

    const allColumnsExist = ttThumbnail && ttMedium && ttPrimary &&
                            wtThumbnail && wtMedium && wtPrimary;

    if (allColumnsExist) {
      console.log('\n⚠ All columns already exist. Migration may have been applied already.');
      console.log('Proceeding anyway (migration is idempotent)...\n');
    }

    // Apply migration
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20251019000000_add_images_to_templates_and_tasks.sql');

    if (!fs.existsSync(migrationPath)) {
      console.error(`✗ Migration file not found: ${migrationPath}`);
      process.exit(1);
    }

    console.log('Applying migration...');
    const sql = fs.readFileSync(migrationPath, 'utf-8');

    try {
      await client.query(sql);
      console.log('✓ Migration applied successfully\n');
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log('⚠ Migration applied with warnings (some objects already exist)\n');
      } else {
        console.error('✗ Migration failed:', error.message);
        throw error;
      }
    }

    // Verify final state
    console.log('='.repeat(60));
    console.log('Final column status:');
    console.log('\ntask_templates:');
    const ttThumbnailFinal = await checkColumnExists(client, 'task_templates', 'thumbnail_url');
    const ttMediumFinal = await checkColumnExists(client, 'task_templates', 'medium_url');
    const ttPrimaryFinal = await checkColumnExists(client, 'task_templates', 'primary_image_url');
    console.log(`  thumbnail_url: ${ttThumbnailFinal ? '✓ exists' : '✗ MISSING'}`);
    console.log(`  medium_url: ${ttMediumFinal ? '✓ exists' : '✗ MISSING'}`);
    console.log(`  primary_image_url: ${ttPrimaryFinal ? '✓ exists' : '✗ MISSING'}`);

    console.log('\nworkflow_tasks:');
    const wtThumbnailFinal = await checkColumnExists(client, 'workflow_tasks', 'thumbnail_url');
    const wtMediumFinal = await checkColumnExists(client, 'workflow_tasks', 'medium_url');
    const wtPrimaryFinal = await checkColumnExists(client, 'workflow_tasks', 'primary_image_url');
    console.log(`  thumbnail_url: ${wtThumbnailFinal ? '✓ exists' : '✗ MISSING'}`);
    console.log(`  medium_url: ${wtMediumFinal ? '✓ exists' : '✗ MISSING'}`);
    console.log(`  primary_image_url: ${wtPrimaryFinal ? '✓ exists' : '✗ MISSING'}`);

    const allColumnsExistFinal = ttThumbnailFinal && ttMediumFinal && ttPrimaryFinal &&
                                  wtThumbnailFinal && wtMediumFinal && wtPrimaryFinal;

    console.log('\n' + '='.repeat(60));
    if (allColumnsExistFinal) {
      console.log('✓ Migration completed successfully!');
      console.log('✓ All 6 image columns added (3 per table)');
      console.log('\nNext steps:');
      console.log('  1. Run: npm run generate:types');
      console.log('  2. Proceed with T002 (Create storage buckets)');
    } else {
      console.error('✗ Migration incomplete - some columns missing');
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

// Run the migration
applyImagesMigration();
