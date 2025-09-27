#!/usr/bin/env tsx
/*
 * Check database status and required tables
 */

import { createClient } from '@supabase/supabase-js';

// Using the provided credentials
const supabaseUrl = 'https://rtwigjwqufozqfwozpvo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0d2lnandxdWZvenFmd296cHZvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDI1MDMwMCwiZXhwIjoyMDY5ODI2MzAwfQ.e4U3aDv5GDIFiPlY_JcveGwbAT9p-ahiW_0hhoOUoY0';

async function checkDatabase() {
  console.log('Connecting to Supabase database...\n');
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Directly check tables since we can't run raw SQL through Supabase client
      // Get list of tables we can access
      console.log('=== CHECKING ACCESSIBLE TABLES ===\n');
      
      const tablesToCheck = [
        'profiles',
        'companies', 
        'users',
        'jobs',
        'job_templates',
        'media_assets',
        'voice_transcripts',
        'intent_recognitions',
        'vision_verifications',
        'conversation_sessions',
        'request_deduplication',
        'company_users',
        'customers',
        'properties',
        'equipment',
        'materials',
        'irrigation_systems'
      ];

      for (const tableName of tablesToCheck) {
        try {
          // Try to query table structure
          const { data, error, count } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });
          
          if (!error) {
            console.log(`✅ Table: ${tableName}`);
            console.log(`   Row count: ${count || 0}`);
            
            // Get column info by querying one row
            const { data: sample } = await supabase
              .from(tableName)
              .select('*')
              .limit(1);
            
            if (sample && sample.length > 0) {
              console.log(`   Columns:`);
              Object.keys(sample[0]).forEach(col => {
                const value = sample[0][col];
                const type = value === null ? 'unknown' : typeof value;
                console.log(`     - ${col}: ${type}`);
              });
            }
          } else {
            console.log(`❌ Table: ${tableName} - ${error.message}`);
          }
        } catch (err: any) {
          console.log(`❌ Table: ${tableName} - Error: ${err.message}`);
        }
        console.log('');
      }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the check
checkDatabase().catch(console.error);