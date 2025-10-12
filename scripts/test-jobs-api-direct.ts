#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function testJobsAPI() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Testing jobs table access...\n');

  try {
    // Test 1: Check if jobs table exists
    console.log('1. Checking if jobs table exists...');
    const { data: tables, error: tableError } = await client.rpc('exec_sql', {
      sql: `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'jobs'
      `
    });
    
    if (tableError) {
      console.error('❌ Error checking table:', tableError);
      return;
    }
    
    console.log('✅ Jobs table exists:', tables);

    // Test 2: Check table structure
    console.log('\n2. Checking jobs table structure...');
    const { data: columns, error: columnsError } = await client.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'jobs'
        ORDER BY ordinal_position
      `
    });
    
    if (columnsError) {
      console.error('❌ Error checking columns:', columnsError);
      return;
    }
    
    console.log('✅ Jobs table columns:');
    columns.forEach((col: any) => {
      console.log(`   - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });

    // Test 3: Try a simple query
    console.log('\n3. Testing simple jobs query...');
    const { data: jobs, error: queryError } = await client
      .from('jobs')
      .select('*')
      .eq('tenant_id', 'demo-company')
      .limit(5);
    
    if (queryError) {
      console.error('❌ Error querying jobs:', queryError);
      return;
    }
    
    console.log(`✅ Found ${jobs?.length || 0} jobs for demo-company`);

    // Test 4: Try the join query from the API
    console.log('\n4. Testing join query with customers and properties...');
    const { data: jobsWithRelations, error: joinError } = await client
      .from('jobs')
      .select(`
        *,
        customer:customers(
          id,
          name,
          email,
          phone
        ),
        property:properties(
          id,
          name,
          address
        )
      `)
      .eq('tenant_id', 'demo-company')
      .limit(5);
    
    if (joinError) {
      console.error('❌ Error with join query:', joinError);
      console.error('   This might be the cause of the 500 error!');
      return;
    }
    
    console.log(`✅ Join query successful, found ${jobsWithRelations?.length || 0} jobs`);
    
    // Test 5: Test creating a job
    console.log('\n5. Testing job creation...');
    const newJob = {
      tenant_id: 'demo-company',
      job_number: `TEST-${Date.now()}`,
      title: 'Test Job',
      customer_id: null, // We'll need a valid customer_id
      status: 'draft',
      priority: 'medium',
      created_by: 'test-script'
    };
    
    // First, get a customer
    const { data: customers } = await client
      .from('customers')
      .select('id')
      .eq('tenant_id', 'demo-company')
      .limit(1);
    
    if (customers && customers.length > 0) {
      newJob.customer_id = customers[0].id;
      
      const { data: createdJob, error: createError } = await client
        .from('jobs')
        .insert(newJob)
        .select()
        .single();
      
      if (createError) {
        console.error('❌ Error creating job:', createError);
      } else {
        console.log('✅ Job created successfully:', createdJob?.id);
        
        // Clean up
        await client
          .from('jobs')
          .delete()
          .eq('id', createdJob.id);
      }
    } else {
      console.log('⚠️  No customers found for demo-company, skipping creation test');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testJobsAPI().catch(console.error);