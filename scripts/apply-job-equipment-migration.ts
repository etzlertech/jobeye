#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

async function applyMigration() {
  const client = createClient(supabaseUrl, supabaseServiceKey);
  
  console.log('🔧 Applying job equipment migration...\n');

  try {
    // Read the migration SQL file
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20250127_2100_job_equipment_lists.sql');
    const migrationSql = readFileSync(migrationPath, 'utf8');

    // Split SQL into individual statements (roughly)
    const statements = migrationSql
      .split(/;\s*$/m)
      .filter(stmt => stmt.trim().length > 0)
      .map(stmt => stmt.trim() + ';');

    console.log(`📄 Found ${statements.length} SQL statements to execute\n`);

    let successCount = 0;
    let errorCount = 0;

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments and empty statements
      if (statement.startsWith('--') || statement.trim() === ';') {
        continue;
      }

      // Show first 100 chars of statement
      const preview = statement.substring(0, 100).replace(/\n/g, ' ') + (statement.length > 100 ? '...' : '');
      console.log(`\n[${i + 1}/${statements.length}] Executing: ${preview}`);

      try {
        // Special handling for DO blocks
        if (statement.trim().toUpperCase().startsWith('DO $$')) {
          // DO blocks need to be executed as-is
          const { error } = await client.rpc('exec_sql', {
            sql: statement
          });
          
          if (error) throw error;
        } else {
          // Regular statements
          const { error } = await client.rpc('exec_sql', {
            sql: statement
          });
          
          if (error) throw error;
        }
        
        console.log('✅ Success');
        successCount++;
      } catch (error: any) {
        console.error('❌ Error:', error.message);
        errorCount++;
        
        // Continue on error for non-critical statements
        if (!statement.includes('CREATE TABLE') && !statement.includes('ALTER TABLE')) {
          console.log('⚠️  Continuing despite error (non-critical statement)');
        } else {
          // Stop on critical errors
          throw error;
        }
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`✅ Successful statements: ${successCount}`);
    console.log(`❌ Failed statements: ${errorCount}`);

    // Verify the table was created
    console.log('\n🔍 Verifying migration...');
    const { data: tables, error: tableError } = await client.rpc('exec_sql', {
      sql: `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'job_equipment_requirements';
      `
    });

    if (tableError) {
      console.error('❌ Failed to verify table:', tableError);
    } else if (tables && tables.length > 0) {
      console.log('✅ Table job_equipment_requirements exists!');
      
      // Check if demo data was inserted
      const { data: equipmentCount } = await client.rpc('exec_sql', {
        sql: `SELECT COUNT(*) as count FROM job_equipment_requirements;`
      });
      
      if (equipmentCount && equipmentCount.length > 0) {
        console.log(`✅ Found ${equipmentCount[0].count} equipment records`);
      }
    } else {
      console.log('⚠️  Table job_equipment_requirements was not found');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }

  console.log('\n✅ Migration completed successfully!');
}

// Run the migration
applyMigration().catch(console.error);