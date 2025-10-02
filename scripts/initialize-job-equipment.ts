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

// Default equipment lists for different job types
const equipmentTemplates = {
  standard: [
    { name: 'Walk-Behind Mower', checked: false, category: 'primary', icon: '🚜' },
    { name: 'String Trimmer', checked: false, category: 'primary', icon: '✂️' },
    { name: 'Leaf Blower', checked: false, category: 'primary', icon: '💨' },
    { name: 'Safety Glasses', checked: false, category: 'safety', icon: '🥽' },
    { name: 'Hearing Protection', checked: false, category: 'safety', icon: '🎧' },
    { name: 'Gas Can (2 gal)', checked: false, category: 'support', icon: '⛽' },
    { name: 'Hand Tools Bag', checked: false, category: 'support', icon: '🧰' },
    { name: 'Trash Bags', checked: false, category: 'materials', quantity: 10, icon: '🗑️' }
  ],
  premium: [
    { name: 'Zero-Turn Mower', checked: false, category: 'primary', icon: '🚜' },
    { name: 'String Trimmer', checked: false, category: 'primary', icon: '✂️' },
    { name: 'Edger', checked: false, category: 'primary', icon: '🔪' },
    { name: 'Backpack Blower', checked: false, category: 'primary', icon: '🎒' },
    { name: 'Safety Kit', checked: false, category: 'safety', icon: '🦺' },
    { name: 'Gas Can (5 gal)', checked: false, category: 'support', icon: '⛽' },
    { name: '2-Cycle Oil', checked: false, category: 'support', quantity: 2, icon: '🛢️' },
    { name: 'Trimmer Line', checked: false, category: 'materials', icon: '🧵' },
    { name: 'First Aid Kit', checked: false, category: 'safety', icon: '🏥' },
    { name: 'Water Cooler', checked: false, category: 'support', icon: '💧' }
  ],
  commercial: [
    { name: 'Commercial Mower (60")', checked: false, category: 'primary', icon: '🚜' },
    { name: 'Zero-Turn Mower', checked: false, category: 'primary', icon: '🚜' },
    { name: 'String Trimmer', checked: false, category: 'primary', quantity: 2, icon: '✂️' },
    { name: 'Edger', checked: false, category: 'primary', quantity: 2, icon: '🔪' },
    { name: 'Backpack Blower', checked: false, category: 'primary', quantity: 2, icon: '🎒' },
    { name: 'Safety Cones', checked: false, category: 'safety', quantity: 6, icon: '🚧' },
    { name: 'Team Safety Gear', checked: false, category: 'safety', quantity: 2, icon: '🦺' },
    { name: 'Gas Can (5 gal)', checked: false, category: 'support', quantity: 2, icon: '⛽' },
    { name: '2-Cycle Mix', checked: false, category: 'support', quantity: 4, icon: '🛢️' },
    { name: 'Trailer', checked: false, category: 'support', icon: '🚛' },
    { name: 'Hedge Trimmer', checked: false, category: 'primary', icon: '✂️' },
    { name: 'Mulch (bags)', checked: false, category: 'materials', quantity: 20, icon: '🌿' }
  ]
};

async function initializeJobEquipment() {
  const client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  console.log('🔧 Initializing job equipment lists...\n');

  try {
    // Get jobs without equipment
    const { data: jobs, error: jobsError } = await client
      .from('jobs')
      .select('id, job_number, title, checklist_items')
      .or('checklist_items.is.null,checklist_items.eq.[]')
      .limit(20);
    
    if (jobsError) throw jobsError;

    if (!jobs || jobs.length === 0) {
      console.log('✅ All jobs already have equipment lists or no jobs found');
      return;
    }

    console.log(`Found ${jobs.length} jobs without equipment lists\n`);

    // Update each job with appropriate equipment
    let successCount = 0;
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      
      // Determine which template to use based on job title or number
      let template = 'standard';
      const titleLower = (job.title || '').toLowerCase();
      
      if (titleLower.includes('commercial') || titleLower.includes('hoa')) {
        template = 'commercial';
      } else if (titleLower.includes('full') || titleLower.includes('premium')) {
        template = 'premium';
      }
      
      const equipment = equipmentTemplates[template as keyof typeof equipmentTemplates];
      
      console.log(`[${i + 1}/${jobs.length}] Job ${job.job_number}: Using ${template} template (${equipment.length} items)`);
      
      const { error } = await client
        .from('jobs')
        .update({ checklist_items: equipment })
        .eq('id', job.id);
      
      if (error) {
        console.error(`❌ Failed to update job ${job.id}:`, error.message);
      } else {
        console.log(`✅ Updated successfully`);
        successCount++;
      }
    }

    console.log(`\n✅ Summary: Updated ${successCount} of ${jobs.length} jobs with equipment lists`);

    // Verify by checking a sample
    console.log('\n🔍 Verifying update...');
    const { data: sample } = await client
      .from('jobs')
      .select('job_number, checklist_items')
      .not('checklist_items', 'eq', '[]')
      .limit(3);
    
    if (sample && sample.length > 0) {
      console.log('\nSample jobs with equipment:');
      sample.forEach(job => {
        console.log(`\n${job.job_number}: ${job.checklist_items.length} items`);
        if (job.checklist_items.length > 0) {
          console.log('First 3 items:', job.checklist_items.slice(0, 3).map((i: any) => i.name).join(', '));
        }
      });
    }

  } catch (error) {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  }
}

// Run the initialization
initializeJobEquipment().catch(console.error);