#!/usr/bin/env npx tsx
/**
 * Apply unified inventory schema migration
 * Creates unified items and item_transactions tables
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const client = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('🚀 Applying unified inventory schema migration...\n');

  // Read the migration file
  const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20251003_create_unified_inventory_schema.sql');
  const migrationSql = readFileSync(migrationPath, 'utf-8');

  // Split into individual statements more carefully
  const statements: string[] = [];
  let currentStatement = '';
  let inFunction = false;
  
  const lines = migrationSql.split('\n');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip comment-only lines
    if (trimmedLine.startsWith('--') && currentStatement.trim() === '') {
      continue;
    }
    
    // Track if we're inside a function definition
    if (trimmedLine.includes('CREATE OR REPLACE FUNCTION') || trimmedLine.includes('CREATE FUNCTION')) {
      inFunction = true;
    }
    if (trimmedLine === '$$ LANGUAGE plpgsql;') {
      inFunction = false;
    }
    
    currentStatement += line + '\n';
    
    // Check if statement is complete
    if (trimmedLine.endsWith(';') && !inFunction) {
      const statement = currentStatement.trim();
      if (statement && !statement.startsWith('--')) {
        statements.push(statement.replace(/;$/, '')); // Remove trailing semicolon
      }
      currentStatement = '';
    }
  }
  
  // Don't forget the last statement if it doesn't end with semicolon
  if (currentStatement.trim() && !currentStatement.trim().startsWith('--')) {
    statements.push(currentStatement.trim());
  }

  console.log(`📋 Found ${statements.length} SQL statements to execute\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    
    // Skip empty statements
    if (!statement.trim()) continue;

    // Extract first line for logging
    const firstLine = statement.split('\n')[0].substring(0, 80);
    console.log(`${i + 1}. Executing: ${firstLine}...`);

    try {
      const { error } = await client.rpc('exec_sql', { sql: statement + ';' });
      
      if (error) {
        console.error(`   ❌ Error: ${error.message || error}`);
        errorCount++;
      } else {
        console.log(`   ✅ Success`);
        successCount++;
      }
    } catch (err: any) {
      console.error(`   ❌ Error: ${err.message}`);
      errorCount++;
    }
  }

  console.log(`\n📊 Migration Summary:`);
  console.log(`   ✅ Successful statements: ${successCount}`);
  console.log(`   ❌ Failed statements: ${errorCount}`);

  if (errorCount === 0) {
    console.log('\n🎉 Migration completed successfully!');
    
    // Verify the tables were created
    console.log('\n🔍 Verifying new tables...');
    
    const { data: tables } = await client.rpc('exec_sql', {
      sql: `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('items', 'item_transactions')
        ORDER BY table_name;
      `
    });

    if (tables && tables.length === 2) {
      console.log('✅ Both tables created successfully:');
      tables.forEach((t: any) => console.log(`   - ${t.table_name}`));
    } else {
      console.log('⚠️  Warning: Expected tables not found');
    }

    // Check RLS policies
    const { data: policies } = await client.rpc('exec_sql', {
      sql: `
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE tablename IN ('items', 'item_transactions')
        ORDER BY tablename, policyname;
      `
    });

    if (policies && policies.length > 0) {
      console.log('\n✅ RLS policies created:');
      policies.forEach((p: any) => console.log(`   - ${p.tablename}.${p.policyname}`));
    }
  } else {
    console.log('\n⚠️  Migration completed with errors. Please review and fix.');
    process.exit(1);
  }
}

applyMigration().catch(console.error);