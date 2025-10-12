#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkItems() {
  const client = createClient(supabaseUrl, supabaseServiceKey);
  
  console.log('🔍 Checking items in database...\n');
  
  // Execute SQL directly via RPC to bypass RLS
  const { data, error } = await client.rpc('exec_sql', {
    sql: `
      SELECT 
        i.id,
        i.tenant_id,
        i.name,
        i.item_type,
        i.category,
        i.current_quantity,
        i.unit_of_measure,
        i.status
      FROM items i
      WHERE i.tenant_id = '00000000-0000-0000-0000-000000000000'
      ORDER BY i.created_at DESC
      LIMIT 10;
    `
  });
  
  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
  
  console.log('✅ Items found:', data);
  
  // Count total items
  const { data: countData, error: countError } = await client.rpc('exec_sql', {
    sql: `
      SELECT COUNT(*) as total
      FROM items
      WHERE tenant_id = '00000000-0000-0000-0000-000000000000';
    `
  });
  
  if (!countError && countData) {
    console.log('\n📊 Total items for tenant:', countData[0]?.total || 0);
  }
}

checkItems().catch(console.error);