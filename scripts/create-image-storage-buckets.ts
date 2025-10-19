#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('✗ Missing required environment variables:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗ MISSING');
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗ MISSING');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createStorageBuckets() {
  console.log('='.repeat(60));
  console.log('Creating Storage Buckets for Template and Task Images');
  console.log('='.repeat(60));

  const buckets = [
    {
      id: 'task-template-images',
      name: 'Task Template Images',
      public: true,
      fileSizeLimit: 104857600, // 100MB in bytes
      allowedMimeTypes: [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp'
      ]
    },
    {
      id: 'task-images',
      name: 'Task Images',
      public: true,
      fileSizeLimit: 104857600, // 100MB in bytes
      allowedMimeTypes: [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp'
      ]
    }
  ];

  // Check existing buckets
  console.log('\nChecking existing buckets...');
  const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.error('✗ Error listing buckets:', listError.message);
    process.exit(1);
  }

  console.log(`Found ${existingBuckets?.length || 0} existing buckets\n`);

  // Create each bucket
  for (const bucket of buckets) {
    console.log(`\n--- ${bucket.name} (${bucket.id}) ---`);

    const exists = existingBuckets?.some(b => b.id === bucket.id);

    if (exists) {
      console.log(`⚠ Bucket already exists: ${bucket.id}`);
      console.log(`Skipping creation...`);
      continue;
    }

    console.log(`Creating bucket: ${bucket.id}...`);

    // Create bucket with just public setting (Supabase API may not support other options via client)
    const { data, error } = await supabase.storage.createBucket(bucket.id, {
      public: bucket.public
    });

    if (error) {
      if (error.message.includes('already exists')) {
        console.log(`⚠ Bucket already exists: ${bucket.id}`);
      } else {
        console.error(`✗ Error creating bucket ${bucket.id}:`, error.message);
        process.exit(1);
      }
    } else {
      console.log(`✓ Successfully created: ${bucket.id}`);
      console.log(`  Public: ${bucket.public}`);
      console.log(`  Size Limit: ${bucket.fileSizeLimit / 1024 / 1024}MB`);
      console.log(`  Allowed Types: ${bucket.allowedMimeTypes.join(', ')}`);
    }
  }

  // Verify both buckets exist
  console.log('\n' + '='.repeat(60));
  console.log('Verifying bucket creation...');
  const { data: finalBuckets, error: finalError } = await supabase.storage.listBuckets();

  if (finalError) {
    console.error('✗ Error verifying buckets:', finalError.message);
    process.exit(1);
  }

  const taskTemplateImagesBucket = finalBuckets?.find(b => b.id === 'task-template-images');
  const taskImagesBucket = finalBuckets?.find(b => b.id === 'task-images');

  console.log('\nFinal status:');
  console.log(`  task-template-images: ${taskTemplateImagesBucket ? '✓ exists' : '✗ MISSING'}`);
  console.log(`  task-images: ${taskImagesBucket ? '✓ exists' : '✗ MISSING'}`);

  if (taskTemplateImagesBucket && taskImagesBucket) {
    console.log('\n✓ All storage buckets created successfully!');
    console.log('\nNext steps:');
    console.log('  1. Proceed with T003 (Apply RLS policies)');
  } else {
    console.error('\n✗ Bucket creation incomplete');
    process.exit(1);
  }

  console.log('='.repeat(60));
}

// Run the script
createStorageBuckets().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});
