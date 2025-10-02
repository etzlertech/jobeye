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

async function checkExistingStructure() {
  const client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  console.log('🔍 Analyzing existing equipment-related structures...\n');

  try {
    // 1. Check inventory_items structure and sample data
    console.log('1️⃣ Checking inventory_items table...');
    const { data: invItems, error: invError } = await client
      .from('inventory_items')
      .select('*')
      .limit(5);
    
    if (!invError && invItems) {
      console.log('✅ inventory_items structure:');
      if (invItems.length > 0) {
        console.log('Columns:', Object.keys(invItems[0]));
        console.log('\nSample data:');
        console.table(invItems);
      } else {
        console.log('Table is empty');
      }
    }

    // 2. Check a job with checklist_items
    console.log('\n2️⃣ Checking jobs table checklist_items field...');
    const { data: jobsWithChecklist, error: jobError } = await client
      .from('jobs')
      .select('id, job_number, checklist_items, equipment_used, tool_reload_verified')
      .not('checklist_items', 'is', null)
      .limit(3);
    
    if (!jobError && jobsWithChecklist) {
      if (jobsWithChecklist.length > 0) {
        console.log('✅ Found jobs with checklist_items:');
        jobsWithChecklist.forEach((job, i) => {
          console.log(`\nJob ${i + 1} (${job.id}):`);
          console.log('- checklist_items:', JSON.stringify(job.checklist_items, null, 2));
          console.log('- equipment_used:', job.equipment_used);
          console.log('- tool_reload_verified:', job.tool_reload_verified);
        });
      } else {
        console.log('No jobs found with checklist_items');
        
        // Check any job
        const { data: anyJob } = await client
          .from('jobs')
          .select('id, checklist_items, equipment_used')
          .limit(1);
        
        if (anyJob && anyJob.length > 0) {
          console.log('\nSample job data:');
          console.log(anyJob[0]);
        }
      }
    }

    // 3. Check job_templates for equipment fields
    console.log('\n3️⃣ Checking job_templates table...');
    const { data: templates, error: templateError } = await client
      .from('job_templates')
      .select('*')
      .limit(2);
    
    if (!templateError && templates && templates.length > 0) {
      console.log('✅ job_templates columns:', Object.keys(templates[0]));
      console.log('\nSample template:');
      console.log(JSON.stringify(templates[0], null, 2));
    }

    // 4. Check safety_checklists
    console.log('\n4️⃣ Checking safety_checklists table...');
    const { data: safetyData, error: safetyError } = await client
      .from('safety_checklists')
      .select('*')
      .limit(3);
    
    if (!safetyError && safetyData) {
      if (safetyData.length > 0) {
        console.log('✅ safety_checklists structure:');
        console.log('Columns:', Object.keys(safetyData[0]));
        console.log('\nSample data:');
        console.table(safetyData);
      } else {
        console.log('Table is empty');
      }
    }

    // 5. Try to find any equipment-related tables we might have missed
    console.log('\n5️⃣ Checking for other potential equipment tables...');
    const potentialTables = [
      'equipment',
      'tools',
      'job_equipment',
      'template_equipment',
      'equipment_assignments',
      'checklist_templates',
      'checklist_items'
    ];
    
    for (const table of potentialTables) {
      const { error } = await client.from(table).select('id').limit(1);
      if (!error) {
        console.log(`✅ Found table: ${table}`);
        
        // Get sample data
        const { data } = await client.from(table).select('*').limit(2);
        if (data && data.length > 0) {
          console.log(`  Columns: ${Object.keys(data[0]).join(', ')}`);
        }
      }
    }

  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
  }
}

// Run the check
checkExistingStructure().catch(console.error);