#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkLiveDemoCustomer() {
  const client = createClient(supabaseUrl, supabaseServiceKey);
  
  console.log('🔍 Checking for Live Demo Customer in database...\n');
  
  const { data, error } = await client
    .from('customers')
    .select('*')
    .eq('tenant_id', '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e')
    .ilike('name', '%Live Demo%')
    .order('created_at', { ascending: false })
    .limit(1);
    
  if (error) {
    console.error('❌ Error querying database:', error);
  } else if (data && data.length > 0) {
    console.log('✅ Found Live Demo Customer in database!');
    console.log('Name:', data[0].name);
    console.log('Email:', data[0].email);
    console.log('Phone:', data[0].phone);
    console.log('Address:', data[0].billing_address);
    console.log('Notes:', data[0].notes);
    console.log('Created:', data[0].created_at);
    console.log('Customer Number:', data[0].customer_number);
  } else {
    console.log('❌ Live Demo Customer NOT found in database');
    console.log('This means the save operation from the UI did not complete');
  }
}

checkLiveDemoCustomer().catch(console.error);