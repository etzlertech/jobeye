#!/usr/bin/env npx tsx
/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /scripts/setup-storage-buckets.ts
 * phase: 1
 * domain: deployment
 * purpose: Set up required Supabase storage buckets in production environment
 * spec_ref: 007-mvp-intent-driven/contracts/storage-setup.md
 * complexity_budget: 150
 * migrations_touched: []
 * state_machine: {
 *   states: ['connecting', 'creating_buckets', 'setting_policies', 'completed'],
 *   transitions: [
 *     'connecting->creating_buckets: connectedToSupabase()',
 *     'creating_buckets->setting_policies: bucketsCreated()',
 *     'setting_policies->completed: policiesSet()',
 *     'any->completed: error()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "storageSetup": "$0.00 (no AI operations)"
 * }
 * offline_capability: NONE
 * dependencies: {
 *   internal: [],
 *   external: ['@supabase/supabase-js', 'dotenv'],
 *   supabase: ['storage', 'auth']
 * }
 * exports: ['setupStorageBuckets']
 * voice_considerations: None - deployment script
 * test_requirements: {
 *   coverage: 80,
 *   unit_tests: 'scripts/__tests__/setup-storage-buckets.test.ts'
 * }
 * tasks: [
 *   'Connect to Supabase with service role',
 *   'Create required storage buckets',
 *   'Set up bucket policies for access control',
 *   'Verify bucket creation success'
 * ]
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

interface StorageBucket {
  id: string;
  name: string;
  public: boolean;
  description: string;
}

interface BucketPolicy {
  bucket: string;
  policy_name: string;
  sql: string;
}

const REQUIRED_BUCKETS: StorageBucket[] = [
  {
    id: 'job-photos',
    name: 'job-photos',
    public: true,
    description: 'Photos taken during job execution and equipment verification'
  },
  {
    id: 'voice-recordings',
    name: 'voice-recordings',
    public: false,
    description: 'Voice instructions and notes recorded by supervisors and crew'
  },
  {
    id: 'equipment-images',
    name: 'equipment-images',
    public: true,
    description: 'Reference images for equipment recognition training'
  }
];

const BUCKET_POLICIES: BucketPolicy[] = [
  {
    bucket: 'job-photos',
    policy_name: 'Users can upload job photos',
    sql: `
      CREATE POLICY "Users can upload job photos" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (
          bucket_id = 'job-photos' AND
          (storage.foldername(name))[1] = (auth.jwt() ->> 'company_id')
        );
    `
  },
  {
    bucket: 'job-photos',
    policy_name: 'Users can view job photos from their company',
    sql: `
      CREATE POLICY "Users can view job photos from their company" ON storage.objects
        FOR SELECT TO authenticated
        USING (
          bucket_id = 'job-photos' AND
          (storage.foldername(name))[1] = (auth.jwt() ->> 'company_id')
        );
    `
  },
  {
    bucket: 'voice-recordings',
    policy_name: 'Users can upload voice recordings',
    sql: `
      CREATE POLICY "Users can upload voice recordings" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (
          bucket_id = 'voice-recordings' AND
          (storage.foldername(name))[1] = (auth.jwt() ->> 'company_id')
        );
    `
  },
  {
    bucket: 'voice-recordings',
    policy_name: 'Users can access voice recordings from their company',
    sql: `
      CREATE POLICY "Users can access voice recordings from their company" ON storage.objects
        FOR SELECT TO authenticated
        USING (
          bucket_id = 'voice-recordings' AND
          (storage.foldername(name))[1] = (auth.jwt() ->> 'company_id')
        );
    `
  },
  {
    bucket: 'equipment-images',
    policy_name: 'Public read access for equipment images',
    sql: `
      CREATE POLICY "Public read access for equipment images" ON storage.objects
        FOR SELECT TO public
        USING (bucket_id = 'equipment-images');
    `
  },
  {
    bucket: 'equipment-images',
    policy_name: 'Admins can upload equipment images',
    sql: `
      CREATE POLICY "Admins can upload equipment images" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (
          bucket_id = 'equipment-images' AND
          (auth.jwt() ->> 'role') = 'super_admin'
        );
    `
  }
];

async function setupStorageBuckets(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  }

  console.log('🔧 Setting up Supabase storage buckets...\n');

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // 1. Check existing buckets
    console.log('📋 Checking existing buckets...');
    const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      throw new Error(`Failed to list existing buckets: ${listError.message}`);
    }

    const existingBucketNames = existingBuckets?.map(bucket => bucket.name) || [];
    console.log(`   Found ${existingBuckets?.length || 0} existing buckets: ${existingBucketNames.join(', ')}\n`);

    // 2. Create missing buckets
    for (const bucket of REQUIRED_BUCKETS) {
      if (existingBucketNames.includes(bucket.name)) {
        console.log(`✅ Bucket '${bucket.name}' already exists`);
        continue;
      }

      console.log(`🆕 Creating bucket '${bucket.name}'...`);
      const { data: bucketData, error: createError } = await supabase.storage.createBucket(
        bucket.id,
        {
          public: bucket.public,
          allowedMimeTypes: bucket.name === 'voice-recordings' 
            ? ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg']
            : ['image/jpeg', 'image/png', 'image/webp'],
          fileSizeLimit: bucket.name === 'voice-recordings' ? 10485760 : 52428800, // 10MB for audio, 50MB for images
        }
      );

      if (createError) {
        console.error(`❌ Failed to create bucket '${bucket.name}': ${createError.message}`);
        throw createError;
      }

      console.log(`✅ Created bucket '${bucket.name}' successfully`);
    }

    console.log('\n🔐 Setting up bucket policies...');

    // 3. Set up bucket policies
    for (const policy of BUCKET_POLICIES) {
      console.log(`   Setting policy '${policy.policy_name}' for bucket '${policy.bucket}'...`);
      
      try {
        const { error: policyError } = await supabase.rpc('exec_sql', {
          sql: policy.sql.trim()
        });

        if (policyError) {
          // Check if policy already exists
          if (policyError.message?.includes('already exists')) {
            console.log(`   ✅ Policy '${policy.policy_name}' already exists`);
          } else {
            console.error(`   ❌ Failed to create policy '${policy.policy_name}': ${policyError.message}`);
            throw policyError;
          }
        } else {
          console.log(`   ✅ Created policy '${policy.policy_name}' successfully`);
        }
      } catch (error) {
        console.error(`   ❌ Error creating policy '${policy.policy_name}':`, error);
        // Continue with other policies instead of failing completely
      }
    }

    // 4. Verify final setup
    console.log('\n🔍 Verifying bucket setup...');
    const { data: finalBuckets, error: finalListError } = await supabase.storage.listBuckets();
    
    if (finalListError) {
      throw new Error(`Failed to verify buckets: ${finalListError.message}`);
    }

    const finalBucketNames = finalBuckets?.map(bucket => bucket.name) || [];
    const missingBuckets = REQUIRED_BUCKETS.filter(bucket => !finalBucketNames.includes(bucket.name));

    if (missingBuckets.length > 0) {
      console.error(`❌ Missing buckets: ${missingBuckets.map(b => b.name).join(', ')}`);
      throw new Error('Some required buckets are missing');
    }

    console.log('✅ All required buckets are present:');
    for (const bucket of REQUIRED_BUCKETS) {
      const bucketInfo = finalBuckets?.find(b => b.name === bucket.name);
      console.log(`   - ${bucket.name} (${bucket.public ? 'public' : 'private'}) - ${bucket.description}`);
    }

    console.log('\n🎉 Storage bucket setup completed successfully!');

  } catch (error) {
    console.error('❌ Storage bucket setup failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  setupStorageBuckets().catch(console.error);
}

export { setupStorageBuckets };