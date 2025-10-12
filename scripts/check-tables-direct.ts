#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkTables() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Checking tables directly...\n');

  try {
    // Check customers table columns
    console.log('📊 Checking customers table...');
    const { data: customerSample, error: custError } = await client
      .from('customers')
      .select('*')
      .limit(1);
    
    if (custError) {
      console.error('Error accessing customers:', custError);
    } else if (customerSample && customerSample.length > 0) {
      console.log('Customer columns:', Object.keys(customerSample[0]));
    } else {
      console.log('Customers table is empty');
      // Try to describe the table structure via a simple insert test
      console.log('Trying to understand table structure...');
    }

    // Check properties table
    console.log('\n📊 Checking properties table...');
    const { data: propSample, error: propError } = await client
      .from('properties')
      .select('*')
      .limit(1);
    
    if (propError) {
      console.error('Error accessing properties:', propError);
    } else if (propSample && propSample.length > 0) {
      console.log('Property columns:', Object.keys(propSample[0]));
    } else {
      console.log('Properties table is empty');
    }

    // Check jobs table
    console.log('\n📊 Checking jobs table...');
    const { data: jobSample, error: jobError } = await client
      .from('jobs')
      .select('*')
      .limit(1);
    
    if (jobError) {
      console.error('Error accessing jobs:', jobError);
    } else if (jobSample && jobSample.length > 0) {
      console.log('Job columns:', Object.keys(jobSample[0]));
    } else {
      console.log('Jobs table is empty');
    }

    // Count existing demo data
    const demoTenantId = '00000000-0000-0000-0000-000000000000';
    
    const { count: custCount } = await client
      .from('customers')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', demoTenantId);
    
    const { count: propCount } = await client
      .from('properties')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', demoTenantId);
    
    const { count: jobCount } = await client
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', demoTenantId);

    console.log('\n📊 Demo data counts:');
    console.log(`  - Customers: ${custCount || 0}`);
    console.log(`  - Properties: ${propCount || 0}`);
    console.log(`  - Jobs: ${jobCount || 0}`);

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkTables().catch(console.error);