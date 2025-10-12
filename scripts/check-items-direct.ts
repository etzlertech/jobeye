#!/usr/bin/env npx tsx

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkItems() {
  const client = createClient(supabaseUrl, supabaseServiceKey);
  
  console.log('🔍 Checking items in database...\n');
  
  // Query items directly
  const { data, error, count } = await client
    .from('items')
    .select('*', { count: 'exact' })
    .eq('tenant_id', '00000000-0000-0000-0000-000000000000')
    .limit(10);
  
  if (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
  
  console.log('✅ Items found:', data);
  console.log('📊 Total count:', count);
  
  // If no items, let's check all tenants
  if (!data || data.length === 0) {
    console.log('\n🔍 Checking all tenants...');
    const { data: allData, error: allError } = await client
      .from('items')
      .select('tenant_id')
      .limit(10);
    
    if (allData && allData.length > 0) {
      console.log('Found items for tenants:', [...new Set(allData.map(i => i.tenant_id))]);
    } else {
      console.log('No items found in database at all');
    }
  }
}

checkItems().catch(console.error);