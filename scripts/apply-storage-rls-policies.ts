#!/usr/bin/env npx tsx
/**
 * @file apply-storage-rls-policies.ts
 * @purpose Apply RLS policies for verification-photos bucket
 * @usage: npx tsx scripts/apply-storage-rls-policies.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function applyRLSPolicies() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔧 Applying RLS policies for verification-photos bucket...\n');

  const policies = [
    {
      name: 'Upload policy',
      sql: `
        CREATE POLICY "Users can upload verification photos to their company folder"
        ON storage.objects
        FOR INSERT
        TO authenticated
        WITH CHECK (
          bucket_id = 'verification-photos'
          AND (storage.foldername(name))[1] IN (
            SELECT tenant_id::text
            FROM tenant_assignments
            WHERE user_id = auth.uid()
              AND is_active = true
          )
        );
      `,
    },
    {
      name: 'Select policy',
      sql: `
        CREATE POLICY "Users can view verification photos from their company"
        ON storage.objects
        FOR SELECT
        TO authenticated
        USING (
          bucket_id = 'verification-photos'
          AND (storage.foldername(name))[1] IN (
            SELECT tenant_id::text
            FROM tenant_assignments
            WHERE user_id = auth.uid()
              AND is_active = true
          )
        );
      `,
    },
    {
      name: 'Delete policy',
      sql: `
        CREATE POLICY "Users can delete their own verification photos within 24h"
        ON storage.objects
        FOR DELETE
        TO authenticated
        USING (
          bucket_id = 'verification-photos'
          AND owner = auth.uid()
          AND created_at > NOW() - INTERVAL '24 hours'
        );
      `,
    },
  ];

  for (const policy of policies) {
    try {
      console.log(`📝 Applying ${policy.name}...`);
      const { error } = await supabase.rpc('exec_sql', { sql: policy.sql });

      if (error) {
        // Policy might already exist
        if (error.message.includes('already exists')) {
          console.log(`   ⚠️  Policy already exists, skipping`);
        } else {
          throw error;
        }
      } else {
        console.log(`   ✅ Applied successfully`);
      }
    } catch (error: any) {
      console.error(`   ❌ Error:`, error.message);
    }
  }

  console.log('\n✅ RLS policies application complete!');
}

applyRLSPolicies().catch(console.error);
