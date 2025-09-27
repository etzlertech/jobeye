#!/usr/bin/env tsx
/*
 * Detailed database schema inspection using direct PostgreSQL connection
 */

import { Client } from 'pg';

// Direct connection using transaction pooler for better compatibility
const CONNECTION_STRING = 'postgresql://postgres.rtwigjwqufozqfwozpvo:Duke-neepo-oliver-ttq5@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

async function getDetailedSchema() {
  console.log('Connecting to Supabase database (via transaction pooler)...\n');
  
  const client = new Client({
    connectionString: CONNECTION_STRING,
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected successfully!\n');
    
    // Get all schemas
    console.log('=== DATABASE SCHEMAS ===');
    const schemasResult = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN (
        'information_schema', 'pg_catalog', 'pg_toast', 
        'graphql', 'graphql_public', 'pgsodium', 'pgsodium_masks', 
        'realtime', 'supabase_functions', 'storage', 'vault',
        'extensions', 'net', 'pgbouncer'
      )
      ORDER BY 
        CASE 
          WHEN schema_name = 'public' THEN 1
          WHEN schema_name = 'auth' THEN 2
          ELSE 3
        END, 
        schema_name;
    `);
    
    const schemas = schemasResult.rows;
    console.log('Found schemas:', schemas.map(s => s.schema_name).join(', '));
    console.log('\n' + '='.repeat(70) + '\n');
    
    // For each schema, get detailed information
    for (const schema of schemas) {
      console.log(`📁 SCHEMA: ${schema.schema_name}`);
      console.log('─'.repeat(50));
      
      // Get all tables with row counts
      const tablesResult = await client.query(`
        SELECT 
          t.table_name,
          obj_description(c.oid) as table_comment
        FROM information_schema.tables t
        JOIN pg_class c ON c.relname = t.table_name 
          AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = $1)
        WHERE t.table_schema = $1
          AND t.table_type = 'BASE TABLE'
        ORDER BY t.table_name;
      `, [schema.schema_name]);
      
      const tables = tablesResult.rows;
      
      if (tables.length === 0) {
        console.log('  No tables found in this schema\n');
        continue;
      }
      
      console.log(`  Found ${tables.length} tables:\n`);
      
      // For each table, get detailed info
      for (const table of tables) {
        console.log(`  📋 TABLE: ${table.table_name}`);
        if (table.table_comment) {
          console.log(`     Description: ${table.table_comment}`);
        }
        
        // Get row count
        try {
          const countResult = await client.query(
            `SELECT COUNT(*) as row_count FROM "${schema.schema_name}"."${table.table_name}"`
          );
          console.log(`     Rows: ${countResult.rows[0].row_count}`);
        } catch (err: any) {
          console.log(`     Rows: Unable to count (${err.message})`);
        }
        
        // Get columns with details
        const columnsResult = await client.query(`
          SELECT 
            c.column_name,
            c.data_type,
            c.character_maximum_length,
            c.numeric_precision,
            c.is_nullable,
            c.column_default,
            pgd.description as column_comment
          FROM information_schema.columns c
          LEFT JOIN pg_catalog.pg_description pgd 
            ON pgd.objsubid = c.ordinal_position 
            AND pgd.objoid = (
              SELECT oid FROM pg_class 
              WHERE relname = c.table_name 
              AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = c.table_schema)
            )
          WHERE c.table_schema = $1 AND c.table_name = $2
          ORDER BY c.ordinal_position;
        `, [schema.schema_name, table.table_name]);
        
        console.log(`     Columns:`);
        for (const col of columnsResult.rows) {
          let type = col.data_type;
          if (col.character_maximum_length) {
            type += `(${col.character_maximum_length})`;
          } else if (col.numeric_precision) {
            type += `(${col.numeric_precision})`;
          }
          
          const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
          const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
          const comment = col.column_comment ? ` -- ${col.column_comment}` : '';
          
          console.log(`       - ${col.column_name}: ${type} ${nullable}${defaultVal}${comment}`);
        }
        
        // Get indexes
        const indexesResult = await client.query(`
          SELECT 
            i.relname as index_name,
            ix.indisunique as is_unique,
            ix.indisprimary as is_primary
          FROM pg_index ix
          JOIN pg_class i ON i.oid = ix.indexrelid
          JOIN pg_class t ON t.oid = ix.indrelid
          JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE t.relname = $2 AND n.nspname = $1
          ORDER BY i.relname;
        `, [schema.schema_name, table.table_name]);
        
        if (indexesResult.rows.length > 0) {
          console.log(`     Indexes:`);
          for (const idx of indexesResult.rows) {
            const type = idx.is_primary ? 'PRIMARY KEY' : idx.is_unique ? 'UNIQUE' : 'INDEX';
            console.log(`       - ${idx.index_name} (${type})`);
          }
        }
        
        // Get foreign keys
        const fkeysResult = await client.query(`
          SELECT 
            tc.constraint_name,
            ccu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM information_schema.table_constraints AS tc 
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY' 
            AND tc.table_schema = $1
            AND tc.table_name = $2;
        `, [schema.schema_name, table.table_name]);
        
        if (fkeysResult.rows.length > 0) {
          console.log(`     Foreign Keys:`);
          for (const fk of fkeysResult.rows) {
            console.log(`       - ${fk.constraint_name}: ${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
          }
        }
        
        console.log('');
      }
      
      console.log('='.repeat(70) + '\n');
    }
    
    // Summary statistics
    const statsResult = await client.query(`
      SELECT 
        COUNT(DISTINCT table_schema) as schema_count,
        COUNT(*) as table_count,
        SUM(n_live_tup) as total_rows
      FROM information_schema.tables t
      LEFT JOIN pg_stat_user_tables s 
        ON s.schemaname = t.table_schema AND s.relname = t.table_name
      WHERE table_type = 'BASE TABLE'
        AND table_schema NOT IN (
          'information_schema', 'pg_catalog', 'pg_toast',
          'graphql', 'graphql_public', 'pgsodium', 'pgsodium_masks',
          'realtime', 'supabase_functions', 'storage', 'vault',
          'extensions', 'net', 'pgbouncer'
        );
    `);
    
    const stats = statsResult.rows[0];
    console.log('=== DATABASE SUMMARY ===');
    console.log(`Total Schemas: ${stats.schema_count}`);
    console.log(`Total Tables: ${stats.table_count}`);
    console.log(`Estimated Total Rows: ${stats.total_rows || 'Unable to determine'}`);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.code === '28P01') {
      console.error('\nAuthentication failed. Please check your connection credentials.');
    } else if (error.code === 'ENOTFOUND') {
      console.error('\nCould not resolve hostname. Please check your connection string.');
    }
  } finally {
    await client.end();
  }
}

// Run the detailed check
getDetailedSchema().catch(console.error);