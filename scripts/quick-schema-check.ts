#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const client = createClient(supabaseUrl, supabaseServiceKey);

async function quickCheck() {
  // Try to select from the new tables
  console.log('Testing items table...');
  const { count: itemsCount, error: itemsError } = await client
    .from('items')
    .select('*', { count: 'exact', head: true });
    
  if (itemsError) {
    console.log('❌ Items table error:', itemsError.message);
  } else {
    console.log('✅ Items table exists, count:', itemsCount);
  }

  console.log('\nTesting item_transactions table...');
  const { count: transCount, error: transError } = await client
    .from('item_transactions')
    .select('*', { count: 'exact', head: true });
    
  if (transError) {
    console.log('❌ Item_transactions table error:', transError.message);
  } else {
    console.log('✅ Item_transactions table exists, count:', transCount);
  }

  console.log('\nTesting container_assignments table...');
  const { count: assignCount, error: assignError } = await client
    .from('container_assignments')
    .select('*', { count: 'exact', head: true });
    
  if (assignError) {
    console.log('❌ Container_assignments table error:', assignError.message);
  } else {
    console.log('✅ Container_assignments table exists, count:', assignCount);
  }
}

quickCheck().catch(console.error);