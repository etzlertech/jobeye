#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkJobFields() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Checking job table structure and relations...\n');

  try {
    // Get a job with simple query
    console.log('1. Simple job query:');
    const { data: simpleJob, error: simpleError } = await client
      .from('jobs')
      .select('*')
      .eq('tenant_id', '00000000-0000-0000-0000-000000000000')
      .limit(1)
      .single();
    
    if (simpleError) {
      console.error('Simple query error:', simpleError);
    } else if (simpleJob) {
      console.log('✅ Simple query works');
      console.log('Fields:', Object.keys(simpleJob).join(', '));
    }

    // Try with customer relation
    console.log('\n2. Query with customer relation:');
    const { data: jobWithCustomer, error: customerError } = await client
      .from('jobs')
      .select(`
        id,
        title,
        customer_id,
        customer:customers(
          id,
          name
        )
      `)
      .eq('tenant_id', '00000000-0000-0000-0000-000000000000')
      .limit(1)
      .single();
    
    if (customerError) {
      console.error('Customer relation error:', customerError);
    } else {
      console.log('✅ Customer relation works');
      console.log('Result:', jobWithCustomer);
    }

    // Try with left join
    console.log('\n3. Query with left join:');
    const { data: jobWithLeftJoin, error: leftError } = await client
      .from('jobs')
      .select(`
        id,
        title,
        customer_id,
        customer:customers!left(
          id,
          name
        )
      `)
      .eq('tenant_id', '00000000-0000-0000-0000-000000000000')
      .limit(1)
      .single();
    
    if (leftError) {
      console.error('Left join error:', leftError);
    } else {
      console.log('✅ Left join works');
      console.log('Result:', jobWithLeftJoin);
    }

    // Check what's in the query result
    console.log('\n4. Full query with count:');
    const { data: fullData, error: fullError, count } = await client
      .from('jobs')
      .select('*', { count: 'exact' })
      .eq('tenant_id', '00000000-0000-0000-0000-000000000000');
    
    if (fullError) {
      console.error('Full query error:', fullError);
    } else {
      console.log(`✅ Found ${count} jobs`);
      if (fullData && fullData.length > 0) {
        console.log('First job:', fullData[0]);
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkJobFields().catch(console.error);