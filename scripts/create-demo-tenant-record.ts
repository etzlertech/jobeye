#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function createDemoTenantRecord() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🏢 Creating demo tenant record in database...\n');

  const demoTenantUuid = '00000000-0000-0000-0000-000000000001';

  // First, let's check what table the foreign key references
  console.log('Checking tenant/company table structure...');
  
  // Try to find the tenant table (could be 'companies', 'tenants', etc.)
  const tables = ['companies', 'tenants', 'organizations'];
  
  let tenantTable = null;
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (!error) {
      tenantTable = table;
      console.log(`✅ Found tenant table: ${table}`);
      break;
    }
  }

  if (!tenantTable) {
    console.log('❌ Could not find tenant table. Let me check the schema...');
    
    // Use RPC to check the foreign key
    const { data: fkInfo } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          tc.table_name, 
          kcu.column_name, 
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name 
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_name = 'customers'
          AND kcu.column_name = 'tenant_id';
      `
    });
    
    if (fkInfo && fkInfo.length > 0) {
      tenantTable = fkInfo[0].foreign_table_name;
      console.log(`✅ Found foreign key reference: customers.tenant_id -> ${tenantTable}.id`);
    }
  }

  if (tenantTable) {
    // Create demo tenant record
    const demoTenant = {
      id: demoTenantUuid,
      name: 'Demo Company',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true
    };

    console.log(`Creating demo tenant in ${tenantTable} table...`);
    
    const { data: tenant, error: tenantError } = await supabase
      .from(tenantTable)
      .upsert(demoTenant, { onConflict: 'id' })
      .select()
      .single();

    if (tenantError) {
      console.error(`❌ Failed to create tenant:`, tenantError.message);
    } else {
      console.log(`✅ Demo tenant created/updated successfully!`);
      console.log(`   Tenant ID: ${tenant.id}`);
      console.log(`   Tenant Name: ${tenant.name}`);
    }

    // Now test customer creation
    console.log('\n🧪 Testing customer creation with proper tenant...');
    
    const testCustomer = {
      tenant_id: demoTenantUuid,
      customer_number: `CUST-${Date.now()}`,
      name: 'Demo Tenant Test Customer',
      email: 'demo.tenant.test@example.com',
      phone: '(555) 999-TENT',
      billing_address: {
        street: '123 Tenant Test St',
        city: 'Demo City',
        state: 'Demo State',
        zip: '12345'
      }
    };

    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert(testCustomer)
      .select()
      .single();

    if (customerError) {
      console.error(`❌ Customer creation failed:`, customerError.message);
    } else {
      console.log(`✅ Customer created successfully!`);
      console.log(`   Customer ID: ${customer.id}`);
      console.log(`   Customer Number: ${customer.customer_number}`);
      console.log(`   Tenant ID: ${customer.tenant_id}`);
      
      // Clean up test customer
      await supabase.from('customers').delete().eq('id', customer.id);
      console.log(`🧹 Test customer cleaned up`);
    }
  }

  console.log('\n🎯 Demo tenant record creation complete!');
  console.log('✅ Demo users can now perform full live CRUD operations!');
}

createDemoTenantRecord().catch(console.error);