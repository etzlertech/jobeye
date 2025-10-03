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

  console.log('🔧 Applying cleanup tracking tables migration...\n');

  // Read the migration file
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250203_0900_cleanup_tracking_tables.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

  // Parse SQL more carefully to handle functions and triggers
  const parseStatements = (sql: string): string[] => {
    const statements: string[] = [];
    let currentStatement = '';
    let inFunction = false;
    let dollarQuoteTag = '';
    
    const lines = sql.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip pure comment lines
      if (trimmedLine.startsWith('--') && currentStatement.trim() === '') {
        continue;
      }
      
      // Check for dollar quote start
      const dollarMatch = line.match(/\$(\w*)\$/);
      if (dollarMatch) {
        if (!inFunction) {
          inFunction = true;
          dollarQuoteTag = dollarMatch[0];
        } else if (line.includes(dollarQuoteTag)) {
          inFunction = false;
          dollarQuoteTag = '';
        }
      }
      
      currentStatement += line + '\n';
      
      // If we're not in a function and line ends with semicolon, it's end of statement
      if (!inFunction && trimmedLine.endsWith(';')) {
        const stmt = currentStatement.trim();
        if (stmt && !stmt.startsWith('--')) {
          statements.push(stmt);
        }
        currentStatement = '';
      }
    }
    
    // Handle any remaining statement
    if (currentStatement.trim()) {
      statements.push(currentStatement.trim());
    }
    
    return statements;
  };
  
  const statements = parseStatements(migrationSql);

  console.log(`📋 Found ${statements.length} SQL statements to execute\n`);

  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    const preview = statement.substring(0, 50).replace(/\n/g, ' ') + '...';
    
    console.log(`[${i + 1}/${statements.length}] Executing: ${preview}`);
    
    const { error } = await client.rpc('exec_sql', { sql: statement });
    
    if (error) {
      console.error(`   ❌ Error: ${error.message}`);
      failureCount++;
      // Don't exit on error - some statements might be idempotent retries
    } else {
      console.log(`   ✅ Success`);
      successCount++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${failureCount}`);
  
  if (failureCount === 0) {
    console.log('\n✅ All cleanup tracking tables created successfully!');
  } else {
    console.log('\n⚠️  Some statements failed (may be due to existing objects)');
  }
  
  // Verify tables were created
  console.log('\n🔍 Verifying tables...');
  const tables = ['migration_tracking', 'table_inventory', 'code_pattern_violations', 'repository_inventory'];
  
  for (const table of tables) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .limit(1);
      
    if (error) {
      console.log(`   ❌ ${table}: Not accessible`);
    } else {
      console.log(`   ✅ ${table}: Ready`);
    }
  }
}

applyMigration().catch(console.error);