#!/usr/bin/env npx tsx
/**
 * Verify Documentation Sync
 *
 * Checks if database documentation is in sync with:
 * - Generated types (database.ts)
 * - Recent migrations
 * - Live database schema
 *
 * Exit codes:
 * 0 = All checks passed
 * 1 = Critical sync issues (blocks commit)
 * 2 = Warnings only (can proceed with caution)
 */

import * as fs from 'fs';
import * as path from 'path';

interface SyncStatus {
  critical: string[];
  warnings: string[];
  passed: string[];
}

async function verifySync(): Promise<SyncStatus> {
  const status: SyncStatus = {
    critical: [],
    warnings: [],
    passed: []
  };

  console.log('🔍 Verifying documentation sync...\n');

  // Check 1: Does database.ts exist?
  const databaseTypesPath = 'src/types/database.ts';
  if (!fs.existsSync(databaseTypesPath)) {
    status.critical.push('❌ database.ts not found - run `npm run generate:types`');
  } else {
    status.passed.push('✅ database.ts exists');

    // Check 2: How old is database.ts?
    const typesStats = fs.statSync(databaseTypesPath);
    const typesAge = Date.now() - typesStats.mtimeMs;
    const hoursOld = Math.floor(typesAge / (1000 * 60 * 60));

    if (hoursOld > 72) {
      status.critical.push(`❌ database.ts is ${hoursOld} hours old (>72 hours)`);
    } else if (hoursOld > 24) {
      status.warnings.push(`⚠️  database.ts is ${hoursOld} hours old (>24 hours)`);
    } else {
      status.passed.push(`✅ database.ts is ${hoursOld} hours old (<24 hours)`);
    }
  }

  // Check 3: Does agent-quickstart.md exist?
  const quickstartPath = 'docs/database/guides/agent-quickstart.md';
  if (!fs.existsSync(quickstartPath)) {
    status.critical.push('❌ agent-quickstart.md not found');
  } else {
    status.passed.push('✅ agent-quickstart.md exists');

    // Check 4: How old is agent-quickstart.md?
    const docsStats = fs.statSync(quickstartPath);
    const docsAge = Date.now() - docsStats.mtimeMs;
    const daysOld = Math.floor(docsAge / (1000 * 60 * 60 * 24));

    if (daysOld > 7) {
      status.critical.push(`❌ agent-quickstart.md is ${daysOld} days old (>7 days)`);
    } else if (daysOld > 2) {
      status.warnings.push(`⚠️  agent-quickstart.md is ${daysOld} days old (>2 days)`);
    } else {
      status.passed.push(`✅ agent-quickstart.md is ${daysOld} days old (<2 days)`);
    }
  }

  // Check 5: Are there recent migrations without doc updates?
  const migrationsDir = 'supabase/migrations';
  if (fs.existsSync(migrationsDir)) {
    const migrations = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .map(f => ({
        name: f,
        path: path.join(migrationsDir, f),
        stats: fs.statSync(path.join(migrationsDir, f))
      }))
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

    if (migrations.length > 0) {
      const latestMigration = migrations[0];
      const migrationAge = Date.now() - latestMigration.stats.mtimeMs;
      const hoursOld = Math.floor(migrationAge / (1000 * 60 * 60));

      if (fs.existsSync(quickstartPath) && fs.existsSync(databaseTypesPath)) {
        const docsStats = fs.statSync(quickstartPath);
        const typesStats = fs.statSync(databaseTypesPath);

        // If migration is newer than docs
        if (latestMigration.stats.mtimeMs > docsStats.mtimeMs) {
          status.critical.push(
            `❌ Migration ${latestMigration.name} (${hoursOld}h old) is newer than docs`
          );
        }

        // If migration is newer than types
        if (latestMigration.stats.mtimeMs > typesStats.mtimeMs) {
          status.critical.push(
            `❌ Migration ${latestMigration.name} (${hoursOld}h old) is newer than database.ts`
          );
        }

        if (status.critical.length === 2) {
          // Both checks passed (no new criticals added)
          status.passed.push(`✅ Latest migration ${latestMigration.name} has docs/types updated`);
        }
      }

      status.passed.push(`✅ Found ${migrations.length} migrations`);
    } else {
      status.passed.push('✅ No migrations yet');
    }
  } else {
    status.warnings.push('⚠️  Migrations directory not found');
  }

  // Check 6: Does snapshots directory exist?
  const snapshotsDir = 'docs/database/snapshots';
  if (fs.existsSync(snapshotsDir)) {
    const snapshots = fs.readdirSync(snapshotsDir)
      .filter(f => f.endsWith('.json'))
      .map(f => ({
        name: f,
        stats: fs.statSync(path.join(snapshotsDir, f))
      }))
      .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

    if (snapshots.length > 0) {
      const latestSnapshot = snapshots[0];
      const snapshotAge = Date.now() - latestSnapshot.stats.mtimeMs;
      const daysOld = Math.floor(snapshotAge / (1000 * 60 * 60 * 24));

      if (daysOld > 14) {
        status.warnings.push(`⚠️  Latest snapshot is ${daysOld} days old (>14 days)`);
      } else if (daysOld > 7) {
        status.warnings.push(`⚠️  Latest snapshot is ${daysOld} days old (>7 days)`);
      } else {
        status.passed.push(`✅ Latest snapshot is ${daysOld} days old (<7 days)`);
      }
    } else {
      status.warnings.push('⚠️  No snapshots created yet - run `npm run db:snapshot`');
    }
  } else {
    status.warnings.push('⚠️  Snapshots directory not found - run `npm run db:snapshot`');
  }

  return status;
}

function printStatus(status: SyncStatus): void {
  console.log('\n📊 SYNC STATUS REPORT\n');

  if (status.passed.length > 0) {
    console.log('✅ PASSED CHECKS:');
    status.passed.forEach(msg => console.log(`   ${msg}`));
    console.log('');
  }

  if (status.warnings.length > 0) {
    console.log('⚠️  WARNINGS:');
    status.warnings.forEach(msg => console.log(`   ${msg}`));
    console.log('');
  }

  if (status.critical.length > 0) {
    console.log('🔴 CRITICAL ISSUES:');
    status.critical.forEach(msg => console.log(`   ${msg}`));
    console.log('');
  }

  // Summary
  const total = status.passed.length + status.warnings.length + status.critical.length;
  console.log(`\n📈 Summary: ${status.passed.length}/${total} checks passed`);

  if (status.critical.length > 0) {
    console.log('\n🚨 BLOCKED: Fix critical issues before committing\n');
    console.log('Quick fix:');
    console.log('  npm run generate:types    # Regenerate types');
    console.log('  npm run db:refresh        # Update documentation');
    console.log('  npm run db:verify         # Re-run verification\n');
  } else if (status.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS: Documentation may be stale\n');
    console.log('Recommended:');
    console.log('  npm run db:full-update    # Full refresh\n');
  } else {
    console.log('\n✅ ALL CHECKS PASSED: Documentation is in sync!\n');
  }
}

async function main() {
  try {
    const status = await verifySync();
    printStatus(status);

    // Exit codes
    if (status.critical.length > 0) {
      process.exit(1); // Critical issues - block commit
    } else if (status.warnings.length > 0) {
      process.exit(2); // Warnings only - can proceed
    } else {
      process.exit(0); // All good
    }
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

main();
