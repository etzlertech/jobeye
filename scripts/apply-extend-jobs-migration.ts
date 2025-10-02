#!/usr/bin/env npx tsx
/**
 * Apply jobs table extension migration for MVP Intent-Driven features
 * This script adds new columns to support voice, photo, and intent features
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

async function applyMigration() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔧 Applying jobs table extension migration...\n');

  try {
    // Read the migration SQL file
    const migrationPath = path.join(
      process.cwd(),
      'supabase',
      'migrations',
      '20250102_1400_extend_jobs_table_mvp.sql'
    );
    
    const migrationSql = await fs.readFile(migrationPath, 'utf-8');

    // Split the migration into individual statements
    const statements = migrationSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      // Log a preview of the statement
      const preview = statement.substring(0, 50).replace(/\n/g, ' ');
      console.log(`  ${preview}...`);

      const { error } = await client.rpc('exec_sql', {
        sql: statement + ';'
      });

      if (error) {
        console.error(`\n❌ Error executing statement ${i + 1}:`, error);
        
        // If it's just a "already exists" error, we can continue
        if (error.message?.includes('already exists')) {
          console.log('  ⚠️  Column/index already exists, continuing...');
        } else {
          throw error;
        }
      } else {
        console.log('  ✅ Success');
      }
    }

    console.log('\n✅ Jobs table extension migration applied successfully!');
    
    // Verify the changes
    console.log('\n🔍 Verifying new columns...');
    
    const { data: columns, error: verifyError } = await client.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = 'jobs'
        AND column_name IN (
          'voice_instructions',
          'voice_instructions_audio_url',
          'load_verified',
          'load_verified_at',
          'load_verification_method',
          'start_photo_url',
          'completion_photo_url',
          'assigned_by_intent',
          'intent_metadata'
        )
        ORDER BY column_name;
      `
    });

    if (verifyError) {
      console.error('❌ Error verifying columns:', verifyError);
    } else if (columns && columns.length > 0) {
      console.log('\n✅ New columns verified:');
      columns.forEach((col: any) => {
        console.log(`  - ${col.column_name} (${col.data_type})`);
      });
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
applyMigration().catch(console.error);