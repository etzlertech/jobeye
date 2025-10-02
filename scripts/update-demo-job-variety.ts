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

async function updateDemoJobVariety() {
  const client = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  
  console.log('🎨 Adding variety to demo job equipment...\n');

  try {
    // Get first 3 jobs to update with different equipment
    const { data: jobs, error } = await client
      .from('jobs')
      .select('id, job_number')
      .limit(3);
    
    if (error) throw error;
    if (!jobs || jobs.length === 0) {
      console.log('No jobs found');
      return;
    }

    // Premium equipment for job 2
    if (jobs[1]) {
      console.log(`Updating ${jobs[1].job_number} with premium equipment...`);
      const { error: updateError } = await client
        .from('jobs')
        .update({
          checklist_items: [
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
          title: 'Full Service Package - Smith Residence'
        })
        .eq('id', jobs[1].id);
      
      if (updateError) {
        console.error('Failed:', updateError);
      } else {
        console.log('✅ Updated with premium equipment');
      }
    }

    // Commercial equipment for job 3
    if (jobs[2]) {
      console.log(`Updating ${jobs[2].job_number} with commercial equipment...`);
      const { error: updateError } = await client
        .from('jobs')
        .update({
          checklist_items: [
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
          ],
          title: 'Commercial Property - Green Acres HOA'
        })
        .eq('id', jobs[2].id);
      
      if (updateError) {
        console.error('Failed:', updateError);
      } else {
        console.log('✅ Updated with commercial equipment');
      }
    }

    // Keep job 1 with standard equipment but update title
    if (jobs[0]) {
      console.log(`Updating ${jobs[0].job_number} title...`);
      const { error: updateError } = await client
        .from('jobs')
        .update({
          title: 'Standard Lawn Service - Johnson Family'
        })
        .eq('id', jobs[0].id);
      
      if (updateError) {
        console.error('Failed:', updateError);
      } else {
        console.log('✅ Updated title');
      }
    }

    console.log('\n✅ Demo job variety complete!');

  } catch (error) {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  }
}

// Run the update
updateDemoJobVariety().catch(console.error);