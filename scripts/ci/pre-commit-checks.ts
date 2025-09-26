#!/usr/bin/env tsx
/*
 * Pre-commit validation script
 * Runs all necessary checks before allowing commits
 * This prevents build failures in CI/CD
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

interface CheckResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

class PreCommitChecker {
  private checks: CheckResult[] = [];
  private startTime: number = Date.now();

  async runAllChecks(): Promise<boolean> {
    console.log('🔍 Running pre-commit checks...\n');

    // Run checks in order of speed (fast checks first)
    await this.runCheck('TypeScript Compilation', this.checkTypeScript);
    await this.runCheck('TypeScript Strict Mode', this.checkTypeScriptStrict);
    await this.runCheck('ESLint', this.checkESLint);
    await this.runCheck('Import Validation', this.checkImports);
    await this.runCheck('Directive Validation', this.checkDirectives);
    await this.runCheck('Dependency Validation', this.checkDependencies);
    await this.runCheck('Build Test', this.checkBuild);

    // Print results
    this.printResults();

    // Return true if all checks passed
    return this.checks.every(check => check.passed);
  }

  private async runCheck(name: string, checkFn: () => Promise<void> | void): Promise<void> {
    const startTime = Date.now();
    try {
      await checkFn.call(this);
      this.checks.push({
        name,
        passed: true,
        duration: Date.now() - startTime
      });
    } catch (error) {
      this.checks.push({
        name,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
    }
  }

  private checkTypeScript(): void {
    console.log('Checking TypeScript compilation...');
    try {
      execSync('npx tsc --noEmit', { stdio: 'pipe' });
    } catch (error: any) {
      const output = error.stdout?.toString() || error.stderr?.toString() || '';
      throw new Error(`TypeScript errors found:\n${output}`);
    }
  }

  private checkTypeScriptStrict(): void {
    console.log('Checking TypeScript strict mode...');
    try {
      execSync('npx tsc --noEmit --strict', { stdio: 'pipe' });
    } catch (error: any) {
      const output = error.stdout?.toString() || error.stderr?.toString() || '';
      // Just warn for strict mode failures
      console.warn('⚠️  Strict mode warnings (non-blocking):\n', output.slice(0, 500));
    }
  }

  private checkESLint(): void {
    console.log('Checking ESLint...');
    try {
      execSync('npx eslint src --ext .ts,.tsx --max-warnings 0', { stdio: 'pipe' });
    } catch (error: any) {
      const output = error.stdout?.toString() || error.stderr?.toString() || '';
      throw new Error(`ESLint errors found:\n${output.slice(0, 1000)}`);
    }
  }

  private checkImports(): void {
    console.log('Checking imports...');
    // Check for common import issues
    const problematicImports = [
      { pattern: /from ['"]@supabase\/auth-helpers['"]/, correct: '@supabase/auth-helpers-nextjs' },
      { pattern: /import.*logger.*from.*['"].*logger['"]/, correct: 'import { createLogger } from' },
      { pattern: /import {[^}]*Logger[^}]*} from/, correct: 'import { createLogger } from' }
    ];

    try {
      const output = execSync('grep -r "import" src --include="*.ts" --include="*.tsx" || true', { encoding: 'utf8' });
      const lines = output.split('\n');
      
      const issues: string[] = [];
      lines.forEach(line => {
        problematicImports.forEach(({ pattern, correct }) => {
          if (pattern.test(line)) {
            issues.push(`Found problematic import: ${line.trim()}\n  Correct usage: ${correct}`);
          }
        });
      });

      if (issues.length > 0) {
        throw new Error(`Import issues found:\n${issues.join('\n')}`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Import issues found')) {
        throw error;
      }
      // Ignore grep errors
    }
  }

  private checkDirectives(): void {
    console.log('Checking AGENT DIRECTIVE blocks...');
    if (existsSync('scripts/ci/lint-directives.ts')) {
      try {
        execSync('npm run lint:directives', { stdio: 'pipe' });
      } catch (error: any) {
        const output = error.stdout?.toString() || error.stderr?.toString() || '';
        throw new Error(`Directive validation failed:\n${output.slice(0, 500)}`);
      }
    }
  }

  private checkDependencies(): void {
    console.log('Checking dependencies...');
    if (existsSync('scripts/dev/validate-dependencies.ts')) {
      try {
        execSync('npm run validate:deps', { stdio: 'pipe' });
      } catch (error: any) {
        const output = error.stdout?.toString() || error.stderr?.toString() || '';
        throw new Error(`Dependency validation failed:\n${output.slice(0, 500)}`);
      }
    }
  }

  private checkBuild(): void {
    console.log('Running build test (this may take a minute)...');
    try {
      execSync('npm run build', { stdio: 'pipe' });
    } catch (error: any) {
      const output = error.stdout?.toString() || error.stderr?.toString() || '';
      throw new Error(`Build failed:\n${output}`);
    }
  }

  private printResults(): void {
    console.log('\n' + '='.repeat(80));
    console.log('PRE-COMMIT CHECK RESULTS');
    console.log('='.repeat(80) + '\n');

    const maxNameLength = Math.max(...this.checks.map(c => c.name.length));
    
    this.checks.forEach(check => {
      const status = check.passed ? '✅ PASS' : '❌ FAIL';
      const statusColor = check.passed ? '\x1b[32m' : '\x1b[31m';
      const reset = '\x1b[0m';
      const duration = `(${check.duration}ms)`;
      
      console.log(
        `${statusColor}${status}${reset} ${check.name.padEnd(maxNameLength)} ${duration}`
      );
      
      if (!check.passed && check.error) {
        console.log(`${statusColor}  └─ ${check.error}${reset}\n`);
      }
    });

    const totalDuration = Date.now() - this.startTime;
    const passedCount = this.checks.filter(c => c.passed).length;
    const failedCount = this.checks.filter(c => !c.passed).length;

    console.log('\n' + '-'.repeat(80));
    console.log(`Total: ${this.checks.length} checks, ${passedCount} passed, ${failedCount} failed`);
    console.log(`Duration: ${totalDuration}ms`);
    console.log('-'.repeat(80) + '\n');
  }
}

// Main execution
async function main() {
  const checker = new PreCommitChecker();
  const allPassed = await checker.runAllChecks();

  if (!allPassed) {
    console.error('\n❌ Pre-commit checks failed! Please fix the errors above before committing.');
    process.exit(1);
  } else {
    console.log('\n✅ All pre-commit checks passed! Safe to commit.');
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Pre-commit check failed with error:', error);
    process.exit(1);
  });
}