#!/usr/bin/env npx tsx
/**
 * Refresh Database Documentation
 *
 * Updates agent-quickstart.md and other docs with latest schema info
 * Run after: migrations, schema changes, type regeneration
 *
 * What it does:
 * 1. Updates timestamps in documentation files
 * 2. Verifies database.ts exists and is recent
 * 3. Checks for schema drift indicators
 * 4. Logs warnings if manual review needed
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface RefreshStats {
  filesUpdated: string[];
  warnings: string[];
  recommendations: string[];
}

async function refreshDocs(): Promise<RefreshStats> {
  console.log('📚 Refreshing database documentation...\n');

  const stats: RefreshStats = {
    filesUpdated: [],
    warnings: [],
    recommendations: []
  };

  const timestamp = new Date().toISOString().split('T')[0];

  // Step 1: Verify database.ts exists
  const databaseTypesPath = 'src/types/database.ts';
  if (!fs.existsSync(databaseTypesPath)) {
    stats.warnings.push('⚠️  database.ts not found - run `npm run generate:types` first');
  } else {
    const typesStats = fs.statSync(databaseTypesPath);
    const hoursOld = Math.floor((Date.now() - typesStats.mtimeMs) / (1000 * 60 * 60));

    if (hoursOld > 24) {
      stats.warnings.push(`⚠️  database.ts is ${hoursOld} hours old - consider regenerating`);
      stats.recommendations.push('Run: npm run generate:types');
    }
  }

  // Step 2: Check for recent migrations
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
      const hoursOld = Math.floor((Date.now() - latestMigration.stats.mtimeMs) / (1000 * 60 * 60));

      if (hoursOld < 24) {
        stats.warnings.push(`⚠️  Recent migration detected: ${latestMigration.name} (${hoursOld}h old)`);
        stats.recommendations.push('Manual review: Update agent-quickstart.md with schema changes');
        stats.recommendations.push('Manual review: Update CHANGELOG.md with migration details');
      }
    }
  }

  // Step 3: Update documentation timestamps
  const docsToUpdate = [
    'docs/database/guides/agent-quickstart.md',
    'docs/database/guides/repository-patterns.md',
    'docs/database/README.md',
    'docs/database/MAINTENANCE.md',
    'docs/database/UPDATE-STRATEGY.md'
  ];

  for (const docPath of docsToUpdate) {
    if (fs.existsSync(docPath)) {
      const content = fs.readFileSync(docPath, 'utf-8');

      // Update "Last Updated" timestamp
      let updatedContent = content.replace(
        /\*\*Last Updated:\*\* \d{4}-\d{2}-\d{2}/,
        `**Last Updated:** ${timestamp}`
      );

      // Also update any "Last Refreshed" timestamps
      updatedContent = updatedContent.replace(
        /Last Refreshed: \d{4}-\d{2}-\d{2}/,
        `Last Refreshed: ${timestamp}`
      );

      // Write updated content
      fs.writeFileSync(docPath, updatedContent);
      stats.filesUpdated.push(docPath);
      console.log(`✅ Updated: ${docPath}`);
    } else {
      console.log(`⚠️  Skipped: ${docPath} (not found)`);
    }
  }

  // Step 4: Check if we can access live database for deeper analysis
  if (supabaseUrl && supabaseServiceKey) {
    console.log('\n🔍 Checking live database schema...');

    try {
      const client = createClient(supabaseUrl, supabaseServiceKey);

      // Quick check: count tables
      const { data: tables, error } = await client
        .from('information_schema.tables')
        .select('table_name', { count: 'exact', head: true })
        .eq('table_schema', 'public')
        .eq('table_type', 'BASE TABLE')
        .not('table_name', 'like', 'pg_%');

      if (!error) {
        console.log('✅ Live database accessible');
        stats.recommendations.push('Consider running: npm run db:analyze (for deep analysis)');
      }
    } catch (err) {
      stats.warnings.push('⚠️  Could not access live database - schema validation skipped');
    }
  } else {
    stats.warnings.push('⚠️  Supabase credentials not found - live schema check skipped');
  }

  return stats;
}

function printStats(stats: RefreshStats) {
  console.log('\n📊 REFRESH SUMMARY\n');

  if (stats.filesUpdated.length > 0) {
    console.log(`✅ Updated ${stats.filesUpdated.length} documentation files`);
  }

  if (stats.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    stats.warnings.forEach(w => console.log(`   ${w}`));
  }

  if (stats.recommendations.length > 0) {
    console.log('\n💡 RECOMMENDATIONS:');
    stats.recommendations.forEach(r => console.log(`   ${r}`));
  }

  console.log('\n✅ Documentation refresh complete!');
  console.log('📝 Review changes and commit if needed.\n');
}

async function main() {
  try {
    const stats = await refreshDocs();
    printStats(stats);
  } catch (error) {
    console.error('❌ Documentation refresh failed:', error);
    process.exit(1);
  }
}

main();
