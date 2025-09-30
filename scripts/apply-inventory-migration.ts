#!/usr/bin/env npx tsx
/**
 * Apply inventory vision migration via Supabase client RPC
 *
 * CRITICAL: This is the ONLY reliable method to execute SQL migrations
 * on hosted Supabase (per Constitution guidance in CLAUDE.md)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import dotenv from 'dotenv';

// Load .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function applyMigration() {
  console.log('🔧 Applying inventory vision migration...\n');

  const client = createClient(supabaseUrl, supabaseServiceKey);

  // Read migration file
  const migrationPath = resolve(process.cwd(), 'supabase/migrations/050_inventory_vision_extend.sql');
  const migrationSql = readFileSync(migrationPath, 'utf-8');

  console.log(`📄 Loaded migration: ${migrationPath}`);
  console.log(`📊 Migration size: ${Math.round(migrationSql.length / 1024)}KB\n`);

  try {
    console.log('🚀 Executing migration via Supabase RPC...\n');

    // Execute SQL directly via RPC
    const { error } = await client.rpc('exec_sql', {
      sql: migrationSql
    });

    if (error) {
      console.error('❌ Migration error:', error);
      console.error('\nDetails:', JSON.stringify(error, null, 2));
      process.exit(1);
    }

    console.log('✅ Migration applied successfully!\n');
    console.log('📋 Created:');
    console.log('   - 10 tables (inventory_items, containers, container_assignments, etc.)');
    console.log('   - 10 ENUM types');
    console.log('   - 2 triggers (update_item_location, prevent_circular_hierarchy)');
    console.log('   - RLS policies for multi-tenant isolation\n');

  } catch (err: any) {
    console.error('❌ Unexpected error:', err.message);
    if (err.stack) {
      console.error('Stack:', err.stack);
    }
    process.exit(1);
  }
}

applyMigration();