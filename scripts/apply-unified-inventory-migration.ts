#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

async function applyMigration() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('📝 Applying unified inventory schema migration...\n');

  // Read the migration file
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20251003_create_unified_inventory_schema.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

  // Split the migration into individual statements
  const statements = migrationSql
    .split(/;(?=\s*(?:--|CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|GRANT))/i)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} SQL statements to execute\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';';
    const preview = statement.substring(0, 50).replace(/\n/g, ' ');
    
    console.log(`[${i + 1}/${statements.length}] Executing: ${preview}...`);
    
    try {
      const { error } = await client.rpc('exec_sql', { sql: statement });
      
      if (error) {
        console.log(`   ❌ Error: ${error.message}`);
        errorCount++;
      } else {
        console.log(`   ✅ Success`);
        successCount++;
      }
    } catch (err) {
      console.log(`   ❌ Exception: ${err}`);
      errorCount++;
    }
  }

  console.log(`\n📊 Migration Summary:`);
  console.log(`   ✅ Successful statements: ${successCount}`);
  console.log(`   ❌ Failed statements: ${errorCount}`);
  
  if (errorCount === 0) {
    console.log('\n🎉 Migration applied successfully!');
  } else {
    console.log('\n⚠️  Migration completed with errors. Please review the failed statements.');
  }

  // Verify tables were created
  console.log('\n🔍 Verifying table creation...');
  const { data: tables } = await client.rpc('exec_sql', {
    sql: `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('items', 'item_transactions')
      ORDER BY table_name
    `
  });

  if (tables && tables.length > 0) {
    console.log('✅ Tables created:');
    tables.forEach((t: any) => console.log(`   - ${t.table_name}`));
  } else {
    console.log('❌ No tables found!');
  }
}

applyMigration().catch(console.error);