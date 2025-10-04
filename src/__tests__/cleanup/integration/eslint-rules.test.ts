/**
 * @file Integration test for ESLint cleanup rules
 */

import { ESLint } from 'eslint';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('ESLint Cleanup Rules Integration', () => {
  let eslint: ESLint;
  let testDir: string;

  beforeEach(async () => {
    // Create test directory
    testDir = path.join(process.cwd(), '.test-eslint');
    await fs.mkdir(testDir, { recursive: true });

    // Initialize ESLint with cleanup plugin
    eslint = new ESLint({
      baseConfig: {
        plugins: ['cleanup'],
        rules: {
          'cleanup/no-company-id': 'error',
          'cleanup/repository-class-pattern': 'error'
        }
      },
      useEslintrc: false,
      cwd: testDir
    });
  });

  afterEach(async () => {
    // Clean up test files
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should detect tenant_id usage violations', async () => {
    const testFile = path.join(testDir, 'test-company-id.ts');
    await fs.writeFile(testFile, `
interface User {
  id: string;
  tenant_id: string; // Violation: should be tenant_id
  name: string;
}

export async function getUsers(tenant_id: string) { // Violation: parameter name
  const query = {
    where: { tenant_id } // Violation: object property
  };
  
  return database.users.filter(u => u.tenant_id === tenant_id); // Violation: property access
}

// This should be fine - it's tenant_id
export async function getUsersByTenant(tenant_id: string) {
  return database.users.filter(u => u.tenant_id === tenant_id);
}
    `);

    const results: ESLint.LintResult[] = await eslint.lintFiles([testFile]);
    const messages: ESLint.LintMessage[] = results[0].messages;

    // Should have multiple tenant_id violations
    const tenantIdErrors = messages.filter((m: ESLint.LintMessage) => m.ruleId === 'cleanup/no-company-id');
    expect(tenantIdErrors.length).toBeGreaterThan(0);
    
    // Each violation should suggest tenant_id
    tenantIdErrors.forEach((error: ESLint.LintMessage) => {
      expect(error.message).toContain('tenant_id');
    });
  });

  it('should detect functional repository pattern violations', async () => {
    const testFile = path.join(testDir, 'test-repository.ts');
    await fs.writeFile(testFile, `
import { createClient } from '@supabase/supabase-js';

// Violation: functional pattern
export function createUser(data: any) {
  const client = createClient(url, key);
  return client.from('users').insert(data);
}

export function findUserById(id: string) {
  const client = createClient(url, key);
  return client.from('users').select('*').eq('id', id).single();
}

// This should be fine - class-based pattern
export class UserRepository extends BaseRepository {
  constructor(client: any) {
    super(client, 'users');
  }
  
  async create(data: any) {
    return super.create(data);
  }
}
    `);

    const results: ESLint.LintResult[] = await eslint.lintFiles([testFile]);
    const messages: ESLint.LintMessage[] = results[0].messages;

    // Should detect functional repository pattern
    const repoErrors = messages.filter((m: ESLint.LintMessage) => m.ruleId === 'cleanup/repository-class-pattern');
    expect(repoErrors.length).toBeGreaterThan(0);
    
    // Should suggest class-based pattern
    repoErrors.forEach((error: ESLint.LintMessage) => {
      expect(error.message).toContain('class');
      expect(error.message).toContain('BaseRepository');
    });
  });

  it('should allow valid patterns without errors', async () => {
    const testFile = path.join(testDir, 'test-valid.ts');
    await fs.writeFile(testFile, `
import { BaseRepository } from '@/core/repositories/base.repository';

interface User {
  id: string;
  tenant_id: string; // Correct field name
  name: string;
}

// Correct: class-based repository
export class UserRepository extends BaseRepository {
  constructor(client: any) {
    super(client, 'users');
  }
  
  async findByTenantId(tenant_id: string) {
    return this.client
      .from(this.tableName)
      .select('*')
      .eq('tenant_id', tenant_id);
  }
}

// Correct: using tenant_id
export async function validateTenant(tenant_id: string): Promise<boolean> {
  const repo = new UserRepository(getClient());
  const users = await repo.findByTenantId(tenant_id);
  return users.length > 0;
}
    `);

    const results: ESLint.LintResult[] = await eslint.lintFiles([testFile]);
    
    // Should have no violations
    expect(results[0].errorCount).toBe(0);
    expect(results[0].warningCount).toBe(0);
  });

  it('should integrate with pre-commit hooks', async () => {
    // Test that ESLint can be run programmatically for pre-commit
    const files = [
      {
        name: 'valid-file.ts',
        content: `
export class ValidRepository extends BaseRepository {
  constructor(client: any) {
    super(client, 'table');
  }
}
        `
      },
      {
        name: 'invalid-file.ts',
        content: `
export function invalidRepo(tenant_id: string) {
  return db.from('table').select('*').eq('tenant_id', tenant_id);
}
        `
      }
    ];

    // Write test files
    for (const file of files) {
      await fs.writeFile(path.join(testDir, file.name), file.content);
    }

    // Lint all files
    const globPattern = testDir + '/*.ts';
    const results: ESLint.LintResult[] = await eslint.lintFiles([globPattern]);
    
    // Should pass for valid file
    const validResult = results.find((r: ESLint.LintResult) => r.filePath.includes('valid-file'));
    expect(validResult?.errorCount).toBe(0);
    
    // Should fail for invalid file
    const invalidResult = results.find((r: ESLint.LintResult) => r.filePath.includes('invalid-file'));
    expect(invalidResult?.errorCount).toBeGreaterThan(0);
    
    // Can determine if pre-commit should block
    const hasErrors = results.some((r: ESLint.LintResult) => r.errorCount > 0);
    expect(hasErrors).toBe(true); // Should block commit
  });

  it('should provide auto-fixable suggestions where possible', async () => {
    const testFile = path.join(testDir, 'test-fixable.ts');
    await fs.writeFile(testFile, `
interface Config {
  tenant_id: string;
  database_url: string;
}

const config: Config = {
  tenant_id: '123',
  database_url: 'postgres://...'
};
    `);

    // Lint with fix option
    const results: ESLint.LintResult[] = await eslint.lintFiles([testFile]);
    
    // Check if fixes are available
    const messages: ESLint.LintMessage[] = results[0].messages;
    const fixableMessages = messages.filter((m: ESLint.LintMessage) => m.fix);
    
    // Some violations should be auto-fixable (simple replacements)
    expect(fixableMessages.length).toBeGreaterThan(0);
    
    // Apply fixes
    if (results[0].output) {
      expect(results[0].output).toContain('tenant_id');
      expect(results[0].output).not.toContain('tenant_id');
    }
  });
});
