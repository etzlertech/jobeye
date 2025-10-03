#!/usr/bin/env npx tsx
/**
 * Clean up duplicate migrations by moving them to archive
 */

import { rename, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

const duplicateMigrations = [
  // Duplicate containers table - keep the first one (005)
  '050_inventory_vision_extend.sql', // This creates containers again
  
  // The "public" and "for" issues seem to be parsing errors from CREATE POLICY statements
  // We should keep all these migrations but fix the parsing
];

async function main() {
  console.log(chalk.bold('🧹 Cleaning Up Duplicate Migrations\n'));

  const migrationsDir = 'supabase/migrations';
  const archiveDir = join(migrationsDir, 'archive');

  // Ensure archive directory exists
  if (!existsSync(archiveDir)) {
    await mkdir(archiveDir, { recursive: true });
  }

  // Check the actual duplicate - containers table
  console.log(chalk.yellow('⚠️  Checking containers table duplication...\n'));
  
  console.log('Examining 005_v4_multi_object_vision_extension.sql for containers table...');
  const migration005 = join(migrationsDir, '005_v4_multi_object_vision_extension.sql');
  const content005 = await Bun.file(migration005).text();
  
  if (content005.includes('CREATE TABLE containers')) {
    console.log(chalk.green('  ✅ Found containers table creation'));
  }

  console.log('\nExamining 050_inventory_vision_extend.sql for containers table...');
  const migration050 = join(migrationsDir, '050_inventory_vision_extend.sql');
  
  if (existsSync(migration050)) {
    const content050 = await Bun.file(migration050).text();
    
    if (content050.includes('CREATE TABLE') && content050.includes('containers')) {
      console.log(chalk.red('  ❌ Found duplicate containers table creation'));
      console.log(chalk.yellow('  🔄 Moving to archive...'));
      
      const archivePath = join(archiveDir, '050_inventory_vision_extend.sql');
      await rename(migration050, archivePath);
      console.log(chalk.green('  ✅ Moved to archive'));
    } else {
      console.log(chalk.green('  ✅ No duplicate containers table found'));
    }
  }

  // Let's also check for actual issues with migrations
  console.log(chalk.bold('\n📝 Recommendations:\n'));
  console.log('1. The "public" and "for" duplicate detections are false positives');
  console.log('   - They come from CREATE POLICY statements like "CREATE POLICY ... FOR ALL"');
  console.log('   - The regex pattern needs to be more specific\n');
  console.log('2. Review these migrations that modify multiple schemas:');
  console.log('   - 040_ocr_domain.sql (creates 8 policies)');
  console.log('   - 035_003_scheduling_kits.sql (creates 5 policies)');
  console.log('   - 037_scheduling_core_tables.sql (creates 4 policies)\n');
  console.log('3. Consider splitting large migrations into smaller, focused files');
}

main().catch(console.error);