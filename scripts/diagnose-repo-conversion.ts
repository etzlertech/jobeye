#!/usr/bin/env npx tsx
/**
 * Diagnose issues with class-based repository conversion
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';
import { VisionVerificationRepository } from '../src/domains/vision/repositories/vision-verification.repository.class';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(chalk.red('❌ Missing environment variables'));
  process.exit(1);
}

async function main() {
  console.log(chalk.bold('🔍 Diagnosing Repository Conversion Issues\n'));

  // Test basic Supabase connection
  console.log('Testing Supabase connection...');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  try {
    const { data, error } = await supabase
      .from('vision_verification_records')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error(chalk.red('❌ Supabase query error:'), error);
    } else {
      console.log(chalk.green('✅ Supabase connection OK'));
    }
  } catch (err: any) {
    console.error(chalk.red('❌ Supabase connection failed:'), err.message);
  }

  // Test repository instantiation
  console.log('\nTesting repository instantiation...');
  try {
    const repo = new VisionVerificationRepository(supabase);
    console.log(chalk.green('✅ Repository instantiated'));
    
    // Test a simple create
    console.log('\nTesting create method...');
    const testData = {
      tenantId: '00000000-0000-0000-0000-000000000000',
      kitId: 'test-kit-' + Date.now(),
      verificationResult: 'complete' as const,
      processingMethod: 'local_yolo' as const,
      confidenceScore: 0.95,
      detectionCount: 3,
      expectedCount: 3,
      processingTimeMs: 100,
      costUsd: 0.0,
      verifiedAt: new Date().toISOString()
    };
    
    console.log('Test data:', testData);
    
    const created = await repo.create(testData);
    console.log(chalk.green('✅ Create successful:'), created.id);
    
    // Clean up
    await repo.delete(created.id);
    console.log(chalk.green('✅ Cleanup successful'));
    
  } catch (err: any) {
    console.error(chalk.red('❌ Repository error:'), err.message);
    console.error('Stack trace:', err.stack);
  }
}

main().catch(console.error);