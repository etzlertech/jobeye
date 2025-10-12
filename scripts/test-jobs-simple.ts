import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL\!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY\!;

async function testJobsAPI() {
  console.log('Testing with URL:', supabaseUrl.substring(0, 30) + '...');
  console.log('Service key starts with:', supabaseServiceKey.substring(0, 20) + '...');
  
  const client = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Simple direct query
    console.log('\nTesting direct jobs query...');
    const { data: jobs, error } = await client
      .from('jobs')
      .select('id, title, status')
      .eq('tenant_id', 'demo-company')
      .limit(5);
    
    if (error) {
      console.error('❌ Error:', error);
      return;
    }
    
    console.log(`✅ Query successful, found ${jobs?.length || 0} jobs`);
    
    // Test with joins
    console.log('\nTesting with joins...');
    const { data: jobsWithJoins, error: joinError } = await client
      .from('jobs')
      .select('*, customer:customers(id, name)')
      .eq('tenant_id', 'demo-company')
      .limit(1);
    
    if (joinError) {
      console.error('❌ Join error:', joinError);
    } else {
      console.log('✅ Join successful');
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testJobsAPI();
