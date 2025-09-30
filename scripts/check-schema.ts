#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkSchema() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('📊 Checking actual database schema...\n');

  // Check customers table columns
  console.log('1. CUSTOMERS table columns:');
  const { data: customerCols } = await supabase
    .from('customers')
    .select('*')
    .limit(1);
  
  if (customerCols && customerCols[0]) {
    console.log('   Columns:', Object.keys(customerCols[0]).join(', '));
  }

  // Check properties table columns
  console.log('\n2. PROPERTIES table columns:');
  const { data: propertyCols } = await supabase
    .from('properties')
    .select('*')
    .limit(1);
  
  if (propertyCols && propertyCols[0]) {
    console.log('   Columns:', Object.keys(propertyCols[0]).join(', '));
  }

  // Check users_extended table columns
  console.log('\n3. USERS_EXTENDED table columns:');
  const { data: userCols } = await supabase
    .from('users_extended')
    .select('*')
    .limit(1);
  
  if (userCols && userCols[0]) {
    console.log('   Columns:', Object.keys(userCols[0]).join(', '));
  }

  // Check training_sessions table columns
  console.log('\n4. TRAINING_SESSIONS table columns:');
  const { data: trainingCols } = await supabase
    .from('training_sessions')
    .select('*')
    .limit(1);
  
  if (trainingCols && trainingCols[0]) {
    console.log('   Columns:', Object.keys(trainingCols[0]).join(', '));
  }

  console.log('\n✅ Schema check complete!');
}

checkSchema().catch(console.error);
