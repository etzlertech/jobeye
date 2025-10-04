#!/usr/bin/env tsx
/**
 * Fast pre-commit checks - essential checks only
 * Full checks can be run with npm run pre-commit:full
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import chalk from 'chalk';

interface CheckExecutionResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  stdout?: string;
  stderr?: string;
}

interface Check {
  name: string;
  essential: boolean;
  run: () => CheckExecutionResult;
}

interface RecordedResult {
  name: string;
  passed: boolean;
  skipped?: boolean;
  reason?: string;
  time: number;
}

const projectRoot = process.cwd();
const nodeBinary = process.execPath;

const tscCli = ensureCli(
  'TypeScript',
  path.join(projectRoot, 'node_modules', 'typescript', 'bin', 'tsc')
);
const eslintCli = ensureCli(
  'ESLint',
  path.join(projectRoot, 'node_modules', 'eslint', 'bin', 'eslint.js')
);
const tsxCli = ensureCli(
  'tsx',
  path.join(projectRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs')
);

const checks: Check[] = [
  {
    name: 'TypeScript',
    essential: false,
    run: () => runNodeScript(tscCli, ['--project', 'tsconfig.build.json', '--noEmit']),
  },
  {
    name: 'Cleanup Verification',
    essential: true,
    run: () => runNodeScript(tsxCli, ['scripts/ci/verify-cleanup.ts']),
  },
  {
    name: 'Lint (staged only)',
    essential: false,
    run: () => {
      const stagedFiles = getStagedTypeScriptFiles();
      if (stagedFiles.length === 0) {
        return {
          success: true,
          skipped: true,
          reason: 'No staged TS/TSX files',
        };
      }

      return runNodeScript(eslintCli, ['--cache', '--ext', '.ts,.tsx', ...stagedFiles]);
    },
  },
];

function ensureCli(label: string, filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required CLI for ${label}: ${filePath}`);
  }

  return filePath;
}

function runNodeScript(scriptPath: string, args: string[] = []): CheckExecutionResult {
  const result = spawnSync(nodeBinary, [scriptPath, ...args], {
    cwd: projectRoot,
    env: process.env,
    encoding: 'utf-8',
  });

  if (result.error) {
    return { success: false, stderr: result.error.message };
  }

  return {
    success: result.status === 0,
    stdout: result.stdout ?? undefined,
    stderr: result.stderr ?? undefined,
  };
}

function getStagedTypeScriptFiles(): string[] {
  const result = spawnSync('git', ['diff', '--staged', '--name-only'], {
    cwd: projectRoot,
    env: process.env,
    encoding: 'utf-8',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(result.stderr || 'Failed to list staged files');
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'));
}

function printOutput(value?: string) {
  if (!value) {
    return;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return;
  }

  console.log(chalk.gray(trimmed));
}

async function main() {
  console.log(chalk.bold('🚀 Fast Pre-Commit Checks\n'));

  const summary: RecordedResult[] = [];
  let hasErrors = false;

  for (const check of checks) {
    const start = Date.now();
    console.log(chalk.blue(`Running ${check.name}...`));

    let result: CheckExecutionResult;
    try {
      result = check.run();
    } catch (error: any) {
      const time = Date.now() - start;
      const message = error?.message ?? String(error);
      console.log(chalk.red(`❌ ${check.name} (${time}ms)`));
      console.log(chalk.gray(message));
      summary.push({ name: check.name, passed: false, time });
      if (check.essential) {
        hasErrors = true;
      }
      continue;
    }

    const time = Date.now() - start;

    if (result.skipped) {
      console.log(
        chalk.yellow(
          `⚠️  ${check.name} skipped (${result.reason ?? 'No reason provided'})`
        )
      );
      summary.push({
        name: check.name,
        passed: true,
        skipped: true,
        reason: result.reason,
        time,
      });
      continue;
    }

    if (result.success) {
      console.log(chalk.green(`✅ ${check.name} (${time}ms)`));
      summary.push({ name: check.name, passed: true, time });
    } else {
      console.log(chalk.red(`❌ ${check.name} (${time}ms)`));
      printOutput(result.stdout);
      printOutput(result.stderr);
      summary.push({ name: check.name, passed: false, time });
      if (check.essential) {
        hasErrors = true;
      }
    }
  }

  console.log(chalk.bold('\n📊 Summary:\n'));
  const totalTime = summary.reduce((sum, item) => sum + item.time, 0);
  const passedCount = summary.filter((item) => item.passed).length;
  const skippedCount = summary.filter((item) => item.skipped).length;

  console.log(`  Total time: ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`  Passed: ${passedCount}/${summary.length}`);
  if (skippedCount > 0) {
    console.log(`  Skipped: ${skippedCount}`);
  }

  if (hasErrors) {
    console.log(chalk.red('\n❌ Pre-commit checks failed'));
    console.log(chalk.yellow('\nRun "npm run pre-commit:full" for detailed checks'));
    process.exit(1);
  }

  console.log(chalk.green('\n✅ All essential checks passed!'));
  process.exit(0);
}

main().catch((error) => {
  console.error(chalk.red('Unexpected error during pre-commit checks'));
  console.error(error);
  process.exit(1);
});
