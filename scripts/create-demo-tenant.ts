#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function createDemoTenant() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🏢 Creating demo tenant...\n');

  try {
    // First, get a sample tenant to see structure
    const { data: sampleTenant, error: sampleError } = await client
      .from('tenants')
      .select('*')
      .limit(1)
      .single();
    
    if (sampleTenant) {
      console.log('Sample tenant structure:', Object.keys(sampleTenant));
    }

    // Create demo tenant with minimal fields
    const { data: newTenant, error: createError } = await client
      .from('tenants')
      .insert({
        id: '00000000-0000-0000-0000-000000000000',
        name: 'Demo Company',
        slug: 'demo-company'
      })
      .select()
      .single();
    
    if (createError) {
      if (createError.code === '23505') {
        console.log('✅ Demo tenant already exists');
      } else {
        console.error('❌ Error creating demo tenant:', createError);
      }
    } else {
      console.log('✅ Created demo tenant:', newTenant.id);
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

createDemoTenant().catch(console.error);