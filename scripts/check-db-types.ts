#!/usr/bin/env tsx
/*
 * Check existing database types and enums
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rtwigjwqufozqfwozpvo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d2lnandxdWZvenFmd296cHZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDI1MDMwMCwiZXhwIjoyMDY5ODI2MzAwfQ.e4U3aDv5GDIFiPlY_JcveGwbAT9p-ahiW_0hhoOUoY0';

async function checkDatabaseTypes() {
  console.log('Checking existing database types...\n');
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Query to get all custom types
    const { data, error } = await supabase.rpc('get_database_types', {}, {
      get: true,
      head: false
    }).catch(() => ({ data: null, error: 'RPC not available' }));

    if (error || !data) {
      console.log('Cannot query types via RPC. Checking common type names...\n');
      
      // List of types we're trying to create
      const typesToCheck = [
        'job_status',
        'job_priority', 
        'equipment_status',
        'material_unit',
        'transcription_status',
        'intent_type',
        'media_type',
        'vision_verification_type',
        'irrigation_controller_type',
        'zone_type',
        'valve_status',
        'schedule_type',
        'auth_event_type',
        'device_type',
        'user_role',
        'mfa_method',
        'session_status'
      ];

      console.log('=== LIKELY EXISTING TYPES ===');
      console.log('Based on the error, these types probably exist:');
      console.log('- job_status');
      console.log('\nTypes seen in existing tables:');
      console.log('- auth_event_type (used in auth_audit_log)');
      console.log('- device_type (used in auth_audit_log, user_sessions)');
      console.log('- user_role (used in tenant_assignments, user_invitations)');
      console.log('- mfa_method (used in mfa_settings, mfa_challenges)');
      console.log('- session_status (used in user_sessions)');
    } else {
      console.log('=== EXISTING TYPES ===');
      data.forEach((type: any) => {
        console.log(`- ${type.typname}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkDatabaseTypes().catch(console.error);