#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

async function checkDatabase() {
  const client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  console.log('🔍 Checking database tables...\n');

  try {
    // First, let's check if we can query anything
    console.log('1️⃣ Testing basic query capability...');
    const { data: testData, error: testError } = await client
      .from('jobs')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.log('❌ Cannot query jobs table:', testError.message);
    } else {
      console.log('✅ Successfully connected to database');
      console.log('Jobs table exists:', testData ? 'Yes' : 'No data');
    }

    // Check for job_equipment_requirements table
    console.log('\n2️⃣ Checking for job_equipment_requirements table...');
    const { data: equipData, error: equipError } = await client
      .from('job_equipment_requirements')
      .select('id')
      .limit(1);
    
    if (equipError) {
      if (equipError.message.includes('relation') && equipError.message.includes('does not exist')) {
        console.log('❌ Table job_equipment_requirements does not exist');
      } else {
        console.log('❌ Error querying job_equipment_requirements:', equipError.message);
      }
    } else {
      console.log('✅ Table job_equipment_requirements exists!');
    }

    // Check for job_templates table
    console.log('\n3️⃣ Checking for job_templates table...');
    const { data: templateData, error: templateError } = await client
      .from('job_templates')
      .select('id, name')
      .limit(5);
    
    if (templateError) {
      if (templateError.message.includes('relation') && templateError.message.includes('does not exist')) {
        console.log('❌ Table job_templates does not exist');
      } else {
        console.log('❌ Error querying job_templates:', templateError.message);
      }
    } else {
      console.log('✅ Table job_templates exists!');
      if (templateData && templateData.length > 0) {
        console.log('Sample templates:', templateData);
      }
    }

    // Check for inventory_items table
    console.log('\n4️⃣ Checking for inventory_items table...');
    const { data: invData, error: invError } = await client
      .from('inventory_items')
      .select('id, name, type')
      .limit(5);
    
    if (invError) {
      if (invError.message.includes('relation') && invError.message.includes('does not exist')) {
        console.log('❌ Table inventory_items does not exist');
      } else {
        console.log('❌ Error querying inventory_items:', invError.message);
      }
    } else {
      console.log('✅ Table inventory_items exists!');
      if (invData && invData.length > 0) {
        console.log('Sample items:', invData);
      }
    }

    // Check for detected_items table (from vision feature)
    console.log('\n5️⃣ Checking for detected_items table...');
    const { data: detData, error: detError } = await client
      .from('detected_items')
      .select('id, item_name')
      .limit(5);
    
    if (detError) {
      if (detError.message.includes('relation') && detError.message.includes('does not exist')) {
        console.log('❌ Table detected_items does not exist');
      } else {
        console.log('❌ Error querying detected_items:', detError.message);
      }
    } else {
      console.log('✅ Table detected_items exists!');
      if (detData && detData.length > 0) {
        console.log('Sample detected items:', detData);
      }
    }

    // Check jobs table structure
    console.log('\n6️⃣ Checking jobs table for equipment-related columns...');
    const { data: jobSample, error: jobError } = await client
      .from('jobs')
      .select('*')
      .limit(1);
    
    if (!jobError && jobSample && jobSample.length > 0) {
      const equipmentColumns = Object.keys(jobSample[0]).filter(col => 
        col.includes('equipment') || 
        col.includes('kit') || 
        col.includes('load') ||
        col.includes('item') ||
        col.includes('tool')
      );
      
      if (equipmentColumns.length > 0) {
        console.log('✅ Found equipment-related columns in jobs table:', equipmentColumns);
      } else {
        console.log('❌ No equipment-related columns found in jobs table');
      }
      
      // Show all columns
      console.log('\nAll jobs table columns:', Object.keys(jobSample[0]));
    }

    // Check for any checklist tables
    console.log('\n7️⃣ Looking for checklist tables...');
    const checklistTables = [
      'checklists',
      'job_checklists', 
      'checklist_items',
      'job_checklist_items',
      'safety_checklists',
      'equipment_checklists'
    ];
    
    for (const table of checklistTables) {
      const { error } = await client.from(table).select('id').limit(1);
      if (!error) {
        console.log(`✅ Found table: ${table}`);
      }
    }

  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
  }
}

// Run the check
checkDatabase().catch(console.error);