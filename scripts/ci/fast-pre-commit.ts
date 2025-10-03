#!/usr/bin/env tsx
/**
 * Fast pre-commit checks - essential checks only
 * Full checks can be run with npm run pre-commit:full
 */

import { execSync } from 'child_process';
import chalk from 'chalk';

interface Check {
  name: string;
  command: string;
  essential: boolean;
}

const checks: Check[] = [
  {
    name: 'TypeScript',
    command: 'npx tsc --noEmit --incremental',
    essential: true
  },
  {
    name: 'Cleanup Verification',
    command: 'npm run verify:cleanup',
    essential: true
  },
  {
    name: 'Lint (staged only)',
    command: 'npx eslint --cache --ext .ts,.tsx $(git diff --staged --name-only | grep -E "\\.(ts|tsx)$" | xargs)',
    essential: false
  }
];

async function main() {
  console.log(chalk.bold('🚀 Fast Pre-Commit Checks\n'));
  
  const results: { name: string; passed: boolean; time: number }[] = [];
  let hasErrors = false;
  
  for (const check of checks) {
    const start = Date.now();
    console.log(chalk.blue(`Running ${check.name}...`));
    
    try {
      execSync(check.command, { stdio: 'pipe' });
      const time = Date.now() - start;
      console.log(chalk.green(`✅ ${check.name} (${time}ms)`));
      results.push({ name: check.name, passed: true, time });
    } catch (error: any) {
      const time = Date.now() - start;
      console.log(chalk.red(`❌ ${check.name} (${time}ms)`));
      results.push({ name: check.name, passed: false, time });
      
      if (check.essential) {
        hasErrors = true;
        // Show error output for essential checks
        console.log(chalk.gray(error.stdout?.toString() || error.message));
      }
    }
  }
  
  // Summary
  console.log(chalk.bold('\n📊 Summary:\n'));
  const totalTime = results.reduce((sum, r) => sum + r.time, 0);
  const passed = results.filter(r => r.passed).length;
  
  console.log(`  Total time: ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`  Passed: ${passed}/${results.length}`);
  
  if (hasErrors) {
    console.log(chalk.red('\n❌ Pre-commit checks failed'));
    console.log(chalk.yellow('\nRun "npm run pre-commit:full" for detailed checks'));
    process.exit(1);
  } else {
    console.log(chalk.green('\n✅ All essential checks passed!'));
    process.exit(0);
  }
}

main().catch(console.error);