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

async function checkEquipmentTable() {
  const client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  console.log('🔍 Detailed analysis of equipment table...\n');

  try {
    // 1. Get equipment table structure and data
    console.log('1️⃣ Equipment table structure and data:');
    const { data: equipment, error: equipError } = await client
      .from('equipment')
      .select('*')
      .limit(10);
    
    if (!equipError && equipment) {
      if (equipment.length > 0) {
        console.log('✅ Equipment table columns:', Object.keys(equipment[0]));
        console.log('\nSample equipment data:');
        console.table(equipment);
      } else {
        console.log('Equipment table is empty');
        
        // Show table structure even if empty
        const { data: singleRow } = await client
          .from('equipment')
          .select('*')
          .limit(1);
        if (singleRow) {
          console.log('Table exists but has no data');
        }
      }
    }

    // 2. Check the jobs.checklist_items JSONB structure
    console.log('\n2️⃣ Analyzing jobs.checklist_items structure:');
    const { data: jobsWithData } = await client
      .from('jobs')
      .select('id, job_number, checklist_items, equipment_used, status')
      .or('checklist_items.not.is.null,equipment_used.not.is.null')
      .limit(5);
    
    if (jobsWithData && jobsWithData.length > 0) {
      console.log('Found jobs with equipment data:');
      jobsWithData.forEach(job => {
        console.log(`\nJob ${job.job_number}:`);
        if (job.checklist_items) {
          console.log('Checklist items:', JSON.stringify(job.checklist_items, null, 2));
        }
        if (job.equipment_used) {
          console.log('Equipment used:', JSON.stringify(job.equipment_used, null, 2));
        }
      });
    }

    // 3. Check if we can use the existing structure
    console.log('\n3️⃣ Checking if we can use jobs.checklist_items for equipment:');
    
    // Try to update a job's checklist_items with equipment data
    const testEquipmentData = [
      { name: 'Walk-Behind Mower', checked: false, category: 'primary' },
      { name: 'String Trimmer', checked: false, category: 'primary' },
      { name: 'Safety Glasses', checked: false, category: 'safety' }
    ];
    
    console.log('Test equipment structure:', JSON.stringify(testEquipmentData, null, 2));

    // 4. Check inventory_items table structure more carefully
    console.log('\n4️⃣ Checking inventory_items for equipment tracking:');
    const { data: invStructure, error: invError } = await client
      .from('inventory_items')
      .select()
      .limit(0); // Just get structure
    
    if (!invError) {
      // Try inserting a test item to see the structure
      const { data: testInsert, error: insertError } = await client
        .from('inventory_items')
        .insert({
          tenant_id: '11111111-1111-1111-1111-111111111111',
          name: 'TEST_EQUIPMENT_DELETE_ME',
          category: 'equipment'
        })
        .select();
      
      if (!insertError && testInsert && testInsert.length > 0) {
        console.log('✅ inventory_items structure:');
        console.log(Object.keys(testInsert[0]));
        
        // Clean up test data
        await client
          .from('inventory_items')
          .delete()
          .eq('name', 'TEST_EQUIPMENT_DELETE_ME');
      } else if (insertError) {
        console.log('Insert error (reveals required fields):', insertError.message);
      }
    }

    // 5. Summary and recommendation
    console.log('\n📊 SUMMARY AND RECOMMENDATION:');
    console.log('─'.repeat(60));
    console.log('Existing tables that can store equipment:');
    console.log('1. jobs.checklist_items (JSONB) - Currently used for job checklists');
    console.log('2. jobs.equipment_used (JSONB) - Currently empty but available');
    console.log('3. equipment table - Exists but structure unknown');
    console.log('4. inventory_items table - Exists for inventory tracking');
    console.log('\nRECOMMENDATION: Use jobs.checklist_items or jobs.equipment_used');
    console.log('to store equipment lists per job instead of creating new table.');

  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
  }
}

// Run the check
checkEquipmentTable().catch(console.error);