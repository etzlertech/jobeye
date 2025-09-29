/*
 * Query ACTUAL database tables - no assumptions
 */

import { createClient } from '@supabase/supabase-js';
import { runOcrPreflightCheck, PreflightCheckError } from './ocr-preflight-check';
import { Client } from 'pg';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://rtwigjwqufozqfwozpvo.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d2lnandxdWZvenFmd296cHZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDI1MDMwMCwiZXhwIjoyMDY5ODI2MzAwfQ.e4U3aDv5GDIFiPlY_JcveGwbAT9p-ahiW_0hhoOUoY0';

async function checkActualDatabase() {

  console.log('Connecting to check ACTUAL database content...\n');
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  const pgConnectionString = process.env.SUPABASE_DB_URL;

  if (!pgConnectionString) {
    console.error('SUPABASE_DB_URL is required to run the actual DB check. Set the pooled connection string and retry.');
    process.exit(1);
  }

  // Try to connect with pg client for raw SQL
  const pgConfig = {
    connectionString: pgConnectionString,
    ssl: { rejectUnauthorized: false }
  };
  
  // First, let's try a different approach - use Supabase's table editor API
  try {
    console.log('Attempting to fetch actual table list...\n');
    
    // Get auth tables which should always exist
    const authTables = ['users'];
    for (const table of authTables) {
      try {
        const { error, count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (!error) {
          console.log(`Found auth.${table} - Row count: ${count}`);
        }
      } catch (e) {
        // Silent fail
      }
    }
    
    // Try using fetch to get table list from Supabase API
    console.log('\n=== EXTRACTING ACTUAL TABLES FROM API ===');
    
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    
    if (response.ok) {
      const openapi = await response.json();
      const paths = Object.keys(openapi.paths || {});
      
      const tables = paths
        .filter(path => path !== '/' && path.startsWith('/'))
        .map(path => path.substring(1))
        .filter(name => !name.includes('/'));
      
      console.log('Found tables from API:');
      for (const table of tables) {
        console.log(`  - ${table}`);
      }
      
      console.log('\n=== CHECKING EACH TABLE ===');
      
      for (const tableName of tables) {
        try {
          const { error, count } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });
          
          if (!error) {
            console.log(`\nâœ… Table: ${tableName}`);
            console.log(`   Row count: ${count || 0}`);
            
            // Get sample data to see columns
            const { data: sample } = await supabase
              .from(tableName)
              .select('*')
              .limit(1);
            
            if (sample && sample.length > 0) {
              console.log(`   Columns:`);
              Object.entries(sample[0]).forEach(([col, value]) => {
                const type = value === null ? 'null' : typeof value === 'object' ? 'jsonb' : typeof value;
                console.log(`     - ${col}: ${type}`);
              });
            } else {
              // Get schema from OpenAPI definition
              const tableDef = openapi.definitions?.[tableName];
              if (tableDef && tableDef.properties) {
                console.log(`   Columns (from schema):`);
                Object.entries(tableDef.properties).forEach(([col, def]: [string, any]) => {
                  console.log(`     - ${col}: ${def.type || 'unknown'}${def.format ? ` (${def.format})` : ''}`);
                });
              }
            }
          }
        } catch (err: any) {
          console.log(`âŒ Table: ${tableName} - Error: ${err.message}`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  console.log('\n=== ATTEMPTING RAW POSTGRES CONNECTION ===');
  
  // Now let's try with raw postgres to get ALL tables
  const client = new Client(pgConfig);
  
  try {
    await client.connect();
    console.log('Connected via postgres client\n');
    
    // Get ALL tables from ALL schemas
    const result = await client.query(`
      SELECT 
        schemaname,
        tablename,
        tableowner
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schemaname, tablename;
    `);
    
    console.log('=== ALL TABLES IN DATABASE ===');
    let currentSchema = '';
    
    for (const row of result.rows) {
      if (row.schemaname !== currentSchema) {
        currentSchema = row.schemaname;
        console.log(`\n[${currentSchema}]`);
      }
      console.log(`  - ${row.tablename}`);
      
      // Get row count
      try {
        const countResult = await client.query(
          `SELECT COUNT(*) as cnt FROM ${row.schemaname}.${row.tablename}`
        );
        console.log(`    Rows: ${countResult.rows[0].cnt}`);
      } catch (e) {
        console.log(`    Rows: Unable to count`);
      }
    }
    
  } catch (error: any) {
    console.error('Postgres connection error:', error.message);
  } finally {
    await client.end();
  }
}


async function main() {
  try {
    await checkActualDatabase();
    await runOcrPreflightCheck({ includeConsoleSummary: true });
  } catch (error) {
    if (error instanceof PreflightCheckError) {
      console.error(error.message);
      console.error('See report for details:', error.result.reportPath);
      process.exit(1);
      return;
    }

    console.error(error);
    process.exit(1);
  }
}

main();





