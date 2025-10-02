import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    // Use environment variables from Railway
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    // Create admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Test 1: List customers
    const { data: customers, error: listError } = await supabase
      .from('customers')
      .select('*')
      .limit(5);

    if (listError) {
      return NextResponse.json({ 
        error: 'List failed', 
        details: listError,
        config: {
          url: supabaseUrl,
          keyLength: supabaseServiceKey?.length || 0
        }
      }, { status: 500 });
    }

    // Test 2: Create a test customer
    const timestamp = Date.now();
    const { data: newCustomer, error: createError } = await supabase
      .from('customers')
      .insert({
        tenant_id: '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e',
        customer_name: `Test Customer ${timestamp}`,
        customer_number: `TEST-${timestamp}`,
        billing_address: {
          street: '123 Test St',
          city: 'Test City',
          state: 'TS',
          zip: '12345'
        },
        created_by: 'api-test'
      })
      .select()
      .single();

    if (createError) {
      return NextResponse.json({ 
        error: 'Create failed', 
        details: createError,
        existingCount: customers?.length || 0
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      existingCustomers: customers?.length || 0,
      createdCustomer: newCustomer,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({ 
      error: 'Exception', 
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}