#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkTenants() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔍 Checking tenants...\n');

  try {
    // Check if tenants table exists and get data
    const { data: tenants, error } = await client
      .from('tenants')
      .select('*');
    
    if (error) {
      console.error('Error accessing tenants:', error);
      
      // Try to create a demo tenant
      console.log('\n🏢 Creating demo tenant...');
      const { data: newTenant, error: createError } = await client
        .from('tenants')
        .insert({
          id: '00000000-0000-0000-0000-000000000000',
          name: 'Demo Company',
          settings: {},
          is_active: true
        })
        .select()
        .single();
      
      if (createError) {
        console.error('Error creating demo tenant:', createError);
      } else {
        console.log('✅ Created demo tenant');
      }
    } else {
      console.log(`Found ${tenants.length} tenants:`);
      tenants.forEach(t => {
        console.log(`  - ${t.id}: ${t.name || 'Unnamed'}`);
      });
      
      // Check if demo tenant exists
      const demoTenant = tenants.find(t => t.id === '00000000-0000-0000-0000-000000000000');
      if (!demoTenant) {
        console.log('\n⚠️  Demo tenant not found, creating...');
        const { data: newTenant, error: createError } = await client
          .from('tenants')
          .insert({
            id: '00000000-0000-0000-0000-000000000000',
            name: 'Demo Company',
            settings: {},
            is_active: true
          })
          .select()
          .single();
        
        if (createError) {
          console.error('Error creating demo tenant:', createError);
        } else {
          console.log('✅ Created demo tenant');
        }
      } else {
        console.log('\n✅ Demo tenant already exists');
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkTenants().catch(console.error);