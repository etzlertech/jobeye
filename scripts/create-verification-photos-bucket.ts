#!/usr/bin/env npx tsx
/**
 * @file create-verification-photos-bucket.ts
 * @purpose Create verification-photos storage bucket in Supabase
 * @usage: npx tsx scripts/create-verification-photos-bucket.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

async function createBucket() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('🔧 Creating verification-photos storage bucket...\n');

  try {
    // Check if bucket already exists
    const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      throw new Error(`Failed to list buckets: ${listError.message}`);
    }

    const bucketExists = existingBuckets?.some((bucket) => bucket.id === 'verification-photos');

    if (bucketExists) {
      console.log('✅ Bucket "verification-photos" already exists!');
      console.log('\nℹ️  Bucket configuration:');
      const bucket = existingBuckets?.find((b) => b.id === 'verification-photos');
      console.log(`   - ID: ${bucket?.id}`);
      console.log(`   - Name: ${bucket?.name}`);
      console.log(`   - Public: ${bucket?.public}`);
      console.log(`   - File size limit: ${bucket?.file_size_limit ? `${(bucket.file_size_limit / 1024 / 1024).toFixed(2)} MB` : 'Not set'}`);
      return;
    }

    // Create bucket
    const { data: createData, error: createError } = await supabase.storage.createBucket(
      'verification-photos',
      {
        public: false, // Private bucket
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      }
    );

    if (createError) {
      throw new Error(`Failed to create bucket: ${createError.message}`);
    }

    console.log('✅ Bucket "verification-photos" created successfully!');
    console.log('\nℹ️  Bucket configuration:');
    console.log('   - ID: verification-photos');
    console.log('   - Name: verification-photos');
    console.log('   - Public: false (private, authenticated users only)');
    console.log('   - File size limit: 10 MB');
    console.log('   - Allowed MIME types: image/jpeg, image/png, image/webp');
    console.log('\n📝 Next steps:');
    console.log('   1. Run migration 045 to apply RLS policies');
    console.log('   2. Test photo upload from mobile PWA');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createBucket();
