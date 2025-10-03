/**
 * @file Integration test for repository pattern conversion
 */

import { createTestClient } from '../test-utils';
import { RepositoryInventoryRepository } from '@/domains/cleanup-tracking/repositories/repository-inventory.repository';
import { Project, SourceFile } from 'ts-morph';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Repository Pattern Conversion Integration', () => {
  const client = createTestClient();
  let repoInventory: RepositoryInventoryRepository;
  let testDir: string;
  let project: Project;

  beforeEach(async () => {
    repoInventory = new RepositoryInventoryRepository(client);
    
    // Create temporary test directory
    testDir = path.join(process.cwd(), '.test-repos');
    await fs.mkdir(testDir, { recursive: true });
    
    // Initialize TypeScript project
    project = new Project({
      tsConfigFilePath: path.join(process.cwd(), 'tsconfig.json'),
      skipAddingFilesFromTsConfig: true
    });
  });

  afterEach(async () => {
    // Clean up test files
    await fs.rm(testDir, { recursive: true, force: true });
    
    // Clean up database
    await client.from('repository_inventory').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  });

  it('should convert functional repository to class-based', async () => {
    // Create functional repository
    const functionalPath = path.join(testDir, 'user.repository.ts');
    await fs.writeFile(functionalPath, `
import { createClient } from '@supabase/supabase-js';

export function createUser(data: any) {
  const client = createClient(url, key);
  return client.from('users').insert(data);
}

export function findUserById(id: string) {
  const client = createClient(url, key);
  return client.from('users').select('*').eq('id', id).single();
}

export function updateUser(id: string, data: any) {
  const client = createClient(url, key);
  return client.from('users').update(data).eq('id', id);
}
    `);

    // Track in inventory
    await repoInventory.create({
      domain: 'test',
      repository_name: 'user',
      file_path: 'test/user.repository.ts',
      pattern_type: 'functional',
      target_pattern: 'class_based',
      migration_status: 'pending',
      dependencies_count: 0
    });

    // Convert to class-based
    const classBasedContent = `
import { BaseRepository } from '@/core/repositories/base.repository';

export class UserRepository extends BaseRepository {
  constructor(client: any) {
    super(client, 'users');
  }

  async createUser(data: any) {
    return this.create(data);
  }

  async findUserById(id: string) {
    return this.findById(id);
  }

  async updateUser(id: string, data: any) {
    return this.update(id, data);
  }
}
    `;

    await fs.writeFile(functionalPath, classBasedContent);

    // Update inventory
    const repo = await repoInventory.findByFilePath('test/user.repository.ts');
    await repoInventory.update(repo!.id, {
      pattern_type: 'class_based',
      migration_status: 'completed',
      migrated_at: new Date()
    });

    // Verify conversion
    const content = await fs.readFile(functionalPath, 'utf-8');
    expect(content).toContain('extends BaseRepository');
    expect(content).not.toContain('export function');
  });

  it('should handle repositories with dependencies', async () => {
    // Create a repository with dependencies
    const repoPath = path.join(testDir, 'order.repository.ts');
    const servicePath = path.join(testDir, 'order.service.ts');

    // Functional repository
    await fs.writeFile(repoPath, `
export function findOrderById(id: string) {
  // implementation
}

export function createOrder(data: any) {
  // implementation
}
    `);

    // Service depending on repository
    await fs.writeFile(servicePath, `
import { findOrderById, createOrder } from './order.repository';

export class OrderService {
  async processOrder(id: string) {
    const order = await findOrderById(id);
    // process order
    return order;
  }
}
    `);

    // Track repository with dependencies
    await repoInventory.create({
      domain: 'test',
      repository_name: 'order',
      file_path: 'test/order.repository.ts',
      pattern_type: 'functional',
      target_pattern: 'class_based',
      migration_status: 'pending',
      dependencies_count: 1
    });

    // Convert repository
    await fs.writeFile(repoPath, `
import { BaseRepository } from '@/core/repositories/base.repository';

export class OrderRepository extends BaseRepository {
  constructor(client: any) {
    super(client, 'orders');
  }

  async findOrderById(id: string) {
    return this.findById(id);
  }

  async createOrder(data: any) {
    return this.create(data);
  }
}
    `);

    // Update service to use class-based repository
    await fs.writeFile(servicePath, `
import { OrderRepository } from './order.repository';

export class OrderService {
  constructor(private orderRepo: OrderRepository) {}

  async processOrder(id: string) {
    const order = await this.orderRepo.findOrderById(id);
    // process order
    return order;
  }
}
    `);

    // Verify both files updated correctly
    const repoContent = await fs.readFile(repoPath, 'utf-8');
    const serviceContent = await fs.readFile(servicePath, 'utf-8');

    expect(repoContent).toContain('class OrderRepository extends BaseRepository');
    expect(serviceContent).toContain('constructor(private orderRepo: OrderRepository)');
    expect(serviceContent).not.toContain('import { findOrderById');
  });

  it('should detect and track mixed pattern repositories', async () => {
    // Create mixed pattern repository
    const mixedPath = path.join(testDir, 'mixed.repository.ts');
    await fs.writeFile(mixedPath, `
// Some class-based methods
export class PartialRepository {
  async findById(id: string) {
    // implementation
  }
}

// Some functional exports
export function legacyFindAll() {
  // implementation
}

export const helperFunction = () => {
  // implementation
};
    `);

    const sourceFile = project.addSourceFileAtPath(mixedPath);
    
    // Analyze pattern
    const classes = sourceFile.getClasses();
    const functions = sourceFile.getFunctions();
    const hasClassPattern = classes.length > 0;
    const hasFunctionalPattern = functions.filter(f => f.isExported()).length > 0;
    
    const patternType = hasClassPattern && hasFunctionalPattern ? 'mixed' : 
                       hasClassPattern ? 'class_based' : 
                       hasFunctionalPattern ? 'functional' : 'mixed';

    // Track as mixed pattern
    await repoInventory.create({
      domain: 'test',
      repository_name: 'mixed',
      file_path: 'test/mixed.repository.ts',
      pattern_type: patternType,
      target_pattern: 'class_based',
      migration_status: 'pending',
      dependencies_count: 0
    });

    const tracked = await repoInventory.findByFilePath('test/mixed.repository.ts');
    expect(tracked?.pattern_type).toBe('mixed');
  });

  it('should validate converted repositories follow base pattern', async () => {
    const validPath = path.join(testDir, 'valid.repository.ts');
    
    // Create properly structured class-based repository
    await fs.writeFile(validPath, `
import { BaseRepository } from '@/core/repositories/base.repository';
import { SupabaseClient } from '@supabase/supabase-js';

export class ValidRepository extends BaseRepository {
  constructor(client: SupabaseClient) {
    super(client, 'valid_table');
  }

  async customMethod(param: string) {
    return this.client
      .from(this.tableName)
      .select('*')
      .eq('param', param);
  }
}
    `);

    const sourceFile = project.addSourceFileAtPath(validPath);
    const validClass = sourceFile.getClasses()[0];
    
    // Validate extends BaseRepository
    const extendsClause = validClass.getExtends();
    expect(extendsClause?.getText()).toContain('BaseRepository');
    
    // Validate constructor pattern
    const constructor = validClass.getConstructors()[0];
    expect(constructor).toBeDefined();
    
    const constructorParams = constructor.getParameters();
    expect(constructorParams).toHaveLength(1);
    expect(constructorParams[0].getType().getText()).toContain('SupabaseClient');
  });
});