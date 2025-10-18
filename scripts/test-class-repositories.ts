#!/usr/bin/env npx tsx
/**
 * Test script to verify all converted class-based repositories work correctly
 * Tests CRUD operations and special methods
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';

// Repository classes
import { VisionVerificationRepository } from '../src/domains/vision/repositories/vision-verification.repository.class';
import { DetectedItemRepository } from '../src/domains/vision/repositories/detected-item.repository.class';
import { CostRecordRepository } from '../src/domains/vision/repositories/cost-record.repository.class';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(chalk.red('❌ Missing environment variables'));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testRepository<T>(
  name: string,
  repo: any,
  testData: any,
  updateData: any
): Promise<boolean> {
  console.log(chalk.blue(`\n🧪 Testing ${name}...`));
  
  try {
    // Test create
    console.log('  Testing create...');
    const created = await repo.create(testData);
    console.log(chalk.green(`  ✅ Created: ${created.id}`));

    // Test findById
    console.log('  Testing findById...');
    const found = await repo.findById(created.id);
    if (!found || found.id !== created.id) {
      throw new Error('findById failed');
    }
    console.log(chalk.green('  ✅ Found by ID'));

    // Test update
    console.log('  Testing update...');
    const updated = await repo.update(created.id, updateData);
    console.log(chalk.green('  ✅ Updated'));

    // Test findAll
    console.log('  Testing findAll...');
    const all = await repo.findAll({ tenantId: testData.tenantId }, 10);
    if (!Array.isArray(all)) {
      throw new Error('findAll did not return array');
    }
    console.log(chalk.green(`  ✅ Found ${all.length} items`));

    // Test delete
    console.log('  Testing delete...');
    await repo.delete(created.id);
    console.log(chalk.green('  ✅ Deleted'));

    // Verify deletion
    const deletedItem = await repo.findById(created.id);
    if (deletedItem) {
      throw new Error('Item still exists after deletion');
    }
    console.log(chalk.green('  ✅ Verified deletion'));

    return true;
  } catch (error: any) {
    console.error(chalk.red(`  ❌ Error: ${error.message}`));
    return false;
  }
}

async function testSpecialMethods() {
  console.log(chalk.blue('\n🧪 Testing special repository methods...'));
  
  const testTenantId = '00000000-0000-0000-0000-000000000000';
  
  try {
    // Test CostRecordRepository special methods
    console.log('\n  Testing CostRecordRepository.canMakeVlmRequest...');
    const costRepo = new CostRecordRepository(supabase);
    const budgetCheck = await costRepo.canMakeVlmRequest(testTenantId, 10.0, 100);
    console.log(chalk.green(`  ✅ Budget check: ${budgetCheck.allowed}`));

    console.log('  Testing CostRecordRepository.getTodaysCost...');
    const todayCost = await costRepo.getTodaysCost(testTenantId);
    console.log(chalk.green(`  ✅ Today's cost: $${todayCost.totalCost}`));

    // Test VisionVerificationRepository special methods
    console.log('\n  Testing VisionVerificationRepository.getVerificationStats...');
    const visionRepo = new VisionVerificationRepository(supabase);
    const stats = await visionRepo.getVerificationStats(testTenantId);
    console.log(chalk.green(`  ✅ Stats: ${stats.totalVerifications} verifications`));

    // Test DetectedItemRepository special methods
    console.log('\n  Testing DetectedItemRepository.getVerificationStats...');
    const detectedRepo = new DetectedItemRepository(supabase);
    const itemStats = await detectedRepo.getVerificationStats('test-verification-id');
    console.log(chalk.green(`  ✅ Item stats retrieved`));

    return true;
  } catch (error: any) {
    console.error(chalk.red(`  ❌ Error in special methods: ${error.message}`));
    return false;
  }
}

async function main() {
  console.log(chalk.bold('\n🔧 Testing Class-Based Repositories\n'));

  const testTenantId = '00000000-0000-0000-0000-000000000000';
  const testUserId = '00000000-0000-0000-0000-000000000001';
  const results: { [key: string]: boolean } = {};

  // Test Vision repositories
  results['VisionVerificationRepository'] = await testRepository(
    'VisionVerificationRepository',
    new VisionVerificationRepository(supabase),
    {
      tenantId: testTenantId,
      kitId: 'test-kit',
      verificationResult: 'complete',
      processingMethod: 'local_yolo',
      confidenceScore: 0.95,
      detectionCount: 3,
      expectedCount: 3,
      processingTimeMs: 100,
      costUsd: 0.0,
      verifiedAt: new Date().toISOString()
    },
    { confidenceScore: 0.98 }
  );

  results['DetectedItemRepository'] = await testRepository(
    'DetectedItemRepository',
    new DetectedItemRepository(supabase),
    {
      verificationId: 'test-verification',
      itemType: 'mower',
      itemName: 'Test Mower',
      confidenceScore: 0.9,
      matchStatus: 'matched',
      boundingBox: { x: 0, y: 0, width: 100, height: 100 }
    },
    { confidenceScore: 0.95 }
  );

  results['CostRecordRepository'] = await testRepository(
    'CostRecordRepository',
    new CostRecordRepository(supabase),
    {
      tenantId: testTenantId,
      provider: 'openai-gpt4-vision',
      model: 'gpt-4-vision-preview',
      operation: 'vision_verification',
      tokenCount: 100,
      costUsd: 0.05
    },
    { tokenCount: 120 }
  );

  // Test special methods
  results['SpecialMethods'] = await testSpecialMethods();

  // Summary
  console.log(chalk.bold('\n📊 Test Summary:\n'));
  let allPassed = true;
  
  for (const [name, passed] of Object.entries(results)) {
    if (passed) {
      console.log(chalk.green(`  ✅ ${name}`));
    } else {
      console.log(chalk.red(`  ❌ ${name}`));
      allPassed = false;
    }
  }

  if (allPassed) {
    console.log(chalk.green.bold('\n🎉 All tests passed!'));
    process.exit(0);
  } else {
    console.log(chalk.red.bold('\n❌ Some tests failed'));
    process.exit(1);
  }
}

main().catch(console.error);
