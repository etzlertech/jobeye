#!/usr/bin/env npx tsx
/**
 * Simple database schema check using Supabase client
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.local
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function checkDatabase() {
  console.log('🔍 Checking actual database schema...\n');

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get table list from REST API
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    const openapi = await response.json();
    const paths = Object.keys(openapi.paths || {});

    const tables = paths
      .filter(path => path !== '/' && path.startsWith('/'))
      .map(path => path.substring(1))
      .filter(name => !name.includes('/'))
      .sort();

    console.log(`Found ${tables.length} tables:\n`);

    // Check relevant tables for inventory feature
    const relevantTables = [
      'companies',
      'users',
      'equipment',
      'materials',
      'containers',
      'inventory_items',
      'inventory_transactions',
      'container_assignments',
      'purchase_receipts',
      'training_data_records'
    ];

    for (const tableName of relevantTables) {
      const exists = tables.includes(tableName);
      const status = exists ? '✅' : '❌';
      console.log(`${status} ${tableName}`);

      if (exists) {
        try {
          const { count, error } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });

          if (!error) {
            console.log(`   Rows: ${count || 0}`);
          }

          // Get schema definition
          const tableDef = openapi.definitions?.[tableName];
          if (tableDef && tableDef.properties) {
            const columns = Object.keys(tableDef.properties);
            console.log(`   Columns (${columns.length}): ${columns.slice(0, 5).join(', ')}${columns.length > 5 ? '...' : ''}`);
          }
        } catch (err: any) {
          console.log(`   Error: ${err.message}`);
        }
      }
      console.log('');
    }

    console.log('\n📊 All available tables:');
    console.log(tables.join(', '));

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkDatabase();