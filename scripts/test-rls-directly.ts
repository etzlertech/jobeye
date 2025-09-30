#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import { Database } from '../src/types/supabase';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TEST_COMPANY_B = '00000000-0000-0000-0000-000000000002';

async function testRLS() {
  // Create user with company_id
  const adminClient = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  console.log('🔧 Creating test user with Company B metadata...');

  const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
    email: 'rls-test@test.com',
    password: 'Test123!',
    email_confirm: true,
    app_metadata: {
      company_id: TEST_COMPANY_B,
    },
  });

  if (createError && !createError.message.includes('already been registered')) {
    console.error('❌ Create error:', createError);
    return;
  }

  console.log('✅ User created/exists');

  // Sign in
  const userClient = createClient<Database>(supabaseUrl, supabaseAnonKey);
  const { data: signInData, error: signInError } = await userClient.auth.signInWithPassword({
    email: 'rls-test@test.com',
    password: 'Test123!',
  });

  if (signInError) {
    console.error('❌ Sign in error:', signInError);
    return;
  }

  console.log('✅ Signed in');

  // Decode JWT
  const jwt = signInData.session.access_token;
  const jwtPayload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString());
  console.log('JWT app_metadata:', jwtPayload.app_metadata);

  // Try to insert a day plan
  console.log('\n🔧 Attempting to insert day_plan with company_id:', TEST_COMPANY_B);

  const { data: insertData, error: insertError } = await userClient
    .from('day_plans')
    .insert({
      company_id: TEST_COMPANY_B,
      user_id: signInData.user.id,
      plan_date: '2025-10-01',
      status: 'draft',
    })
    .select();

  if (insertError) {
    console.error('❌ Insert error:', insertError);
    console.error('   Code:', insertError.code);
    console.error('   Details:', insertError.details);
    console.error('   Hint:', insertError.hint);
  } else {
    console.log('✅ Insert succeeded!');
    console.log('   Created plan:', insertData);
  }

  // Try to query
  console.log('\n🔧 Attempting to query day_plans...');
  const { data: queryData, error: queryError } = await userClient
    .from('day_plans')
    .select('*')
    .eq('company_id', TEST_COMPANY_B);

  if (queryError) {
    console.error('❌ Query error:', queryError);
  } else {
    console.log('✅ Query succeeded!');
    console.log('   Found plans:', queryData?.length || 0);
  }

  // Cleanup
  await adminClient.from('day_plans').delete().eq('company_id', TEST_COMPANY_B);
}

testRLS().catch(console.error);