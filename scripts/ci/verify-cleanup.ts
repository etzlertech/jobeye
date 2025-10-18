#!/usr/bin/env npx tsx
/**
 * CI/CD script to verify cleanup has been properly applied
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import chalk from 'chalk';

interface VerificationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

async function verifyTenantIdStandardization(): Promise<VerificationResult> {
  console.log(chalk.blue('🔍 Verifying tenant_id standardization...'));
  
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check that no files use company_id in RLS policies
  const migrations = await readdir('supabase/migrations');
  for (const file of migrations) {
    if (file.endsWith('.sql') && !file.includes('archive')) {
      const content = await readFile(join('supabase/migrations', file), 'utf-8');
      
      // Check for old RLS pattern
      if (content.includes("jwt.claims ->> 'company_id'")) {
        errors.push(`Migration ${file} still uses old JWT path`);
      }
      
      // Check for company_id columns (warning only, as some might be legitimate)
      if (content.includes('company_id') && !content.includes('tenant_id')) {
        warnings.push(`Migration ${file} uses company_id without tenant_id`);
      }
    }
  }
  
  return {
    passed: errors.length === 0,
    errors,
    warnings
  };
}

async function verifyRepositoryPatterns(): Promise<VerificationResult> {
  console.log(chalk.blue('🔍 Verifying repository patterns...'));
  
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check that class-based repositories exist
  const classRepos = [
    'src/domains/vision/repositories/vision-verification.repository.class.ts',
    'src/domains/vision/repositories/detected-item.repository.class.ts',
    'src/domains/vision/repositories/cost-record.repository.class.ts'
  ];
  
  for (const repo of classRepos) {
    try {
      await readFile(repo);
    } catch {
      errors.push(`Missing class-based repository: ${repo}`);
    }
  }
  
  // Check that services use class imports
  const serviceFiles = [
    'src/domains/vision/services/vision-verification.service.ts',
    'src/domains/vision/services/cost-tracking.service.ts'
  ];
  
  for (const service of serviceFiles) {
    try {
      const content = await readFile(service, 'utf-8');
      if (content.includes('import *') && content.includes('repository')) {
        warnings.push(`Service ${service} still uses wildcard imports for repositories`);
      }
    } catch {
      warnings.push(`Could not check service: ${service}`);
    }
  }
  
  return {
    passed: errors.length === 0,
    errors,
    warnings
  };
}

async function verifyMigrationSequence(): Promise<VerificationResult> {
  console.log(chalk.blue('🔍 Verifying migration sequence...'));
  
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check for duplicate table creations
  const tableCreations = new Map<string, string[]>();
  const migrations = await readdir('supabase/migrations');
  
  for (const file of migrations) {
    if (file.endsWith('.sql') && !file.includes('archive')) {
      const content = await readFile(join('supabase/migrations', file), 'utf-8');
      const tables = [...content.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?([a-zA-Z_]+)(?:\s|\()/gi)]
        .map(m => m[1])
        .filter(t => !['public', 'for', 'if'].includes(t.toLowerCase()));
        
      for (const table of tables) {
        if (!tableCreations.has(table)) {
          tableCreations.set(table, []);
        }
        tableCreations.get(table)!.push(file);
      }
    }
  }
  
  // Check for duplicates
  for (const [table, files] of tableCreations) {
    if (files.length > 1) {
      errors.push(`Table '${table}' created in multiple migrations: ${files.join(', ')}`);
    }
  }
  
  // Check migration count
  const activeMigrations = migrations.filter(f => f.endsWith('.sql') && !f.includes('archive'));
  if (activeMigrations.length > 60) {
    warnings.push(`Too many active migrations (${activeMigrations.length}). Consider consolidating.`);
  }
  
  return {
    passed: errors.length === 0,
    errors,
    warnings
  };
}

async function verifyUnifiedInventory(): Promise<VerificationResult> {
  console.log(chalk.blue('🔍 Verifying unified inventory...'));
  
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check that unified inventory tables exist in migrations
  const requiredTables = ['items', 'item_transactions'];
  const migrations = (await readdir('supabase/migrations')).filter(f => f.endsWith('.sql'));
  
  for (const table of requiredTables) {
    let found = false;
    for (const file of migrations) {
      if (!file.includes('archive')) {
        const content = await readFile(join('supabase/migrations', file), 'utf-8');
        if (content.includes(`CREATE TABLE ${table}`) || content.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
          found = true;
          break;
        }
      }
    }
    if (!found) {
      errors.push(`Unified inventory table '${table}' not found in migrations`);
    }
  }
  
  // Check that shared repository exists
  try {
    await readFile('src/domains/shared/repositories/item.repository.ts');
  } catch {
    warnings.push('Unified item repository not found in shared domain');
  }
  
  return {
    passed: errors.length === 0,
    errors,
    warnings
  };
}

async function main() {
  console.log(chalk.bold('🧹 JobEye Cleanup Verification\n'));
  
  const results: { [key: string]: VerificationResult } = {
    tenantId: await verifyTenantIdStandardization(),
    repositories: await verifyRepositoryPatterns(),
    migrations: await verifyMigrationSequence(),
    inventory: await verifyUnifiedInventory()
  };
  
  // Summary
  console.log(chalk.bold('\n📊 Summary:\n'));
  
  let totalErrors = 0;
  let totalWarnings = 0;
  
  for (const [check, result] of Object.entries(results)) {
    totalErrors += result.errors.length;
    totalWarnings += result.warnings.length;
    
    if (result.passed) {
      console.log(chalk.green(`  ✅ ${check}: PASSED`));
    } else {
      console.log(chalk.red(`  ❌ ${check}: FAILED (${result.errors.length} errors)`));
    }
    
    if (result.warnings.length > 0) {
      console.log(chalk.yellow(`     ⚠️  ${result.warnings.length} warnings`));
    }
  }
  
  // Details
  if (totalErrors > 0 || totalWarnings > 0) {
    console.log(chalk.bold('\n📝 Details:\n'));
    
    for (const [check, result] of Object.entries(results)) {
      if (result.errors.length > 0) {
        console.log(chalk.red(`\n${check} errors:`));
        result.errors.forEach(e => console.log(`  - ${e}`));
      }
      
      if (result.warnings.length > 0) {
        console.log(chalk.yellow(`\n${check} warnings:`));
        result.warnings.forEach(w => console.log(`  - ${w}`));
      }
    }
  }
  
  // Exit code
  if (totalErrors > 0) {
    console.log(chalk.red(`\n❌ Verification failed with ${totalErrors} errors`));
    process.exit(1);
  } else if (totalWarnings > 0) {
    console.log(chalk.yellow(`\n⚠️  Verification passed with ${totalWarnings} warnings`));
    process.exit(0);
  } else {
    console.log(chalk.green('\n✅ All verifications passed!'));
    process.exit(0);
  }
}

main().catch(console.error);
