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

    // List existing customers
    const { data: customers, error: listError } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (listError) {
      return NextResponse.json({ 
        error: 'List failed', 
        details: listError
      }, { status: 500 });
    }

    // Create a new customer
    const timestamp = Date.now();
    const newCustomerData = {
      tenant_id: '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e',
      name: `Demo Customer ${timestamp}`,
      customer_number: `DEMO-${timestamp}`,
      email: `demo${timestamp}@example.com`,
      phone: '555-0123',
      billing_address: {
        street: '123 Demo Street',
        city: 'Demo City',
        state: 'DC',
        zip: '12345'
      },
      is_active: true,
      metadata: {
        source: 'Railway CRUD Demo',
        timestamp: new Date().toISOString()
      }
    };

    const { data: created, error: createError } = await supabase
      .from('customers')
      .insert(newCustomerData)
      .select()
      .single();

    if (createError) {
      return NextResponse.json({ 
        error: 'Create failed', 
        details: createError,
        existingCount: customers?.length || 0
      }, { status: 500 });
    }

    // Update the created customer
    const { data: updated, error: updateError } = await supabase
      .from('customers')
      .update({ 
        notes: 'Updated via CRUD demo at ' + new Date().toISOString() 
      })
      .eq('id', created.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ 
        error: 'Update failed', 
        details: updateError
      }, { status: 500 });
    }

    // Verify by reading back
    const { data: verified, error: verifyError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', created.id)
      .single();

    if (verifyError) {
      return NextResponse.json({ 
        error: 'Verify failed', 
        details: verifyError
      }, { status: 500 });
    }

    // Create a job for this customer
    const jobData = {
      tenant_id: '86a0f1f5-30cd-4891-a7d9-bfc85d8b259e',
      job_number: `JOB-${timestamp}`,
      customer_id: created.id,
      property_id: null, // No property for demo
      scheduled_start: new Date().toISOString(),
      scheduled_end: new Date(Date.now() + 3600000).toISOString(), // 1 hour later
      status: 'scheduled',
      priority: 'medium',
      job_type: 'maintenance',
      description: 'Demo job created via CRUD test'
    };

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert(jobData)
      .select()
      .single();

    if (jobError) {
      // Jobs table might not exist or have different schema
      console.log('Job creation failed:', jobError);
    }

    // Return comprehensive CRUD results
    return NextResponse.json({
      success: true,
      operations: {
        create: {
          success: true,
          customer: created
        },
        read: {
          success: true,
          totalCustomers: customers?.length || 0,
          existingCustomers: customers?.map(c => ({
            id: c.id,
            name: c.name,
            email: c.email,
            created_at: c.created_at
          }))
        },
        update: {
          success: true,
          updated: updated
        },
        verify: {
          success: true,
          verified: verified
        },
        jobCreation: job ? {
          success: true,
          job: job
        } : {
          success: false,
          error: 'Job creation skipped or failed'
        }
      },
      databaseInfo: {
        url: supabaseUrl,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
      }
    });

  } catch (error) {
    return NextResponse.json({ 
      error: 'Exception', 
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}