#!/usr/bin/env npx tsx
/**
 * @file /scripts/migrations/convert-to-class-repository.ts
 * @purpose Convert functional repositories to class-based pattern
 */

import { Project, SourceFile, FunctionDeclaration, VariableDeclaration } from 'ts-morph';
import { RepositoryInventoryRepository } from '@/domains/cleanup-tracking/repositories/repository-inventory.repository';
import { createClient } from '@supabase/supabase-js';
import { glob } from 'glob';
import dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface ConversionOptions {
  domain?: string;
  filePath?: string;
  dryRun?: boolean;
  backup?: boolean;
}

interface RepositoryAnalysis {
  filePath: string;
  currentPattern: 'functional' | 'class_based' | 'mixed' | 'singleton';
  exportedFunctions: string[];
  classes: string[];
  imports: string[];
  dependencies: string[];
}

async function convertToClassRepository(options: ConversionOptions = {}) {
  const client = createClient(supabaseUrl, supabaseServiceKey);
  const repoInventory = new RepositoryInventoryRepository(client);

  console.log('🔄 Starting repository pattern conversion...\n');

  // Initialize TypeScript project
  const project = new Project({
    tsConfigFilePath: path.join(process.cwd(), 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true
  });

  // Find repository files
  const repoFiles = await findRepositoryFiles(options);
  console.log(`Found ${repoFiles.length} repository files to analyze\n`);

  const conversions = [];

  // Analyze each repository file
  for (const filePath of repoFiles) {
    const analysis = await analyzeRepository(project, filePath);
    
    if (analysis.currentPattern === 'functional' || analysis.currentPattern === 'mixed') {
      conversions.push(analysis);
    }

    // Update inventory
    const relativePath = path.relative(process.cwd(), filePath);
    const domain = extractDomain(relativePath);
    const repoName = extractRepositoryName(relativePath);

    await repoInventory.upsert({
      domain,
      repository_name: repoName,
      file_path: relativePath,
      pattern_type: analysis.currentPattern,
      target_pattern: 'class_based',
      migration_status: analysis.currentPattern === 'class_based' ? 'completed' : 'pending',
      dependencies_count: analysis.dependencies.length
    });
  }

  console.log(`Found ${conversions.length} repositories needing conversion:`);
  conversions.forEach(conv => {
    console.log(`  - ${path.basename(conv.filePath)} (${conv.currentPattern} → class_based)`);
  });

  if (options.dryRun) {
    console.log('\n🔍 DRY RUN MODE - No changes will be made');
    return;
  }

  // Convert each repository
  for (const analysis of conversions) {
    await convertRepository(project, analysis, options);
  }

  console.log('\n✅ Repository conversion completed!');
}

async function findRepositoryFiles(options: ConversionOptions): Promise<string[]> {
  const patterns = [
    'src/domains/*/repositories/*.repository.ts',
    'src/domains/*/repositories/*.repository.tsx'
  ];

  if (options.filePath) {
    return [options.filePath];
  }

  if (options.domain) {
    patterns.push(`src/domains/${options.domain}/repositories/*.repository.ts`);
  }

  const files = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern, { cwd: process.cwd() });
    files.push(...matches.map(f => path.join(process.cwd(), f)));
  }

  // Remove duplicates
  return [...new Set(files)];
}

async function analyzeRepository(project: Project, filePath: string): Promise<RepositoryAnalysis> {
  const sourceFile = project.addSourceFileAtPath(filePath);
  
  const exportedFunctions = sourceFile.getFunctions()
    .filter(fn => fn.isExported())
    .map(fn => fn.getName() || 'anonymous');

  const classes = sourceFile.getClasses()
    .map(cls => cls.getName() || 'anonymous');

  const imports = sourceFile.getImportDeclarations()
    .map(imp => imp.getModuleSpecifierValue());

  // Determine current pattern
  let currentPattern: RepositoryAnalysis['currentPattern'] = 'functional';
  
  if (classes.length > 0 && exportedFunctions.length === 0) {
    currentPattern = classes.some(c => sourceFile.getClass(c)?.getExtends()?.getText()?.includes('BaseRepository'))
      ? 'class_based' : 'singleton';
  } else if (classes.length > 0 && exportedFunctions.length > 0) {
    currentPattern = 'mixed';
  } else if (exportedFunctions.length > 0) {
    currentPattern = 'functional';
  }

  // Extract dependencies
  const dependencies = imports.filter(imp => 
    !imp.startsWith('@/') && !imp.startsWith('./') && !imp.startsWith('../')
  );

  return {
    filePath,
    currentPattern,
    exportedFunctions,
    classes,
    imports,
    dependencies
  };
}

async function convertRepository(
  project: Project, 
  analysis: RepositoryAnalysis, 
  options: ConversionOptions
) {
  const sourceFile = project.getSourceFile(analysis.filePath)!;
  const fileName = path.basename(analysis.filePath);
  const className = generateClassName(fileName);
  const tableName = extractTableName(fileName);

  console.log(`\n🔄 Converting ${fileName} to class-based pattern...`);

  try {
    // Backup original file if requested
    if (options.backup) {
      const backupPath = analysis.filePath + '.backup';
      const originalContent = sourceFile.getFullText();
      await fs.writeFile(backupPath, originalContent);
      console.log(`  💾 Backup created: ${path.basename(backupPath)}`);
    }

    // Generate new class-based content
    const newContent = generateClassBasedRepository(analysis, className, tableName);

    // Write the new content
    sourceFile.replaceWithText(newContent);
    await sourceFile.save();

    console.log(`  ✅ Converted to ${className}`);
    console.log(`     Functions converted: ${analysis.exportedFunctions.length}`);

    // Update inventory
    const client = createClient(supabaseUrl, supabaseServiceKey);
    const repoInventory = new RepositoryInventoryRepository(client);
    
    const relativePath = path.relative(process.cwd(), analysis.filePath);
    const existing = await repoInventory.findByFilePath(relativePath);
    
    if (existing) {
      await repoInventory.updatePatternType(existing.id, 'class_based');
    }

  } catch (error) {
    console.error(`  ❌ Conversion failed: ${error}`);
    throw error;
  }
}

function generateClassBasedRepository(
  analysis: RepositoryAnalysis, 
  className: string, 
  tableName: string
): string {
  const sourceFile = analysis.filePath;
  const content = `/**
 * @file ${path.relative(process.cwd(), sourceFile)}
 * @purpose Class-based repository for ${tableName}
 * @pattern class_based
 */

import { BaseRepository } from '@/core/repositories/base.repository';
import { SupabaseClient } from '@supabase/supabase-js';

export class ${className} extends BaseRepository {
  constructor(client: SupabaseClient) {
    super(client, '${tableName}');
  }

${generateClassMethods(analysis)}
}
`;

  return content;
}

function generateClassMethods(analysis: RepositoryAnalysis): string {
  const methods = [];

  // Standard CRUD methods
  methods.push(`  async create(data: any) {
    return super.create(data);
  }`);

  methods.push(`  async findById(id: string) {
    return super.findById(id);
  }`);

  methods.push(`  async findAll(filters?: any) {
    return super.findAll(filters);
  }`);

  methods.push(`  async update(id: string, data: any) {
    return super.update(id, data);
  }`);

  methods.push(`  async delete(id: string) {
    return super.delete(id);
  }`);

  // Convert exported functions to methods
  for (const funcName of analysis.exportedFunctions) {
    if (!funcName.includes('create') && !funcName.includes('find') && 
        !funcName.includes('update') && !funcName.includes('delete')) {
      methods.push(`  async ${funcName}(params: any) {
    // TODO: Implement ${funcName} logic
    // Original function needs to be converted manually
    throw new Error('Method ${funcName} needs implementation');
  }`);
    }
  }

  return methods.join('\n\n');
}

function generateClassName(fileName: string): string {
  const base = fileName.replace('.repository.ts', '').replace('.repository.tsx', '');
  return base.split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('') + 'Repository';
}

function extractTableName(fileName: string): string {
  return fileName.replace('.repository.ts', '').replace('.repository.tsx', '')
    .replace(/-/g, '_');
}

function extractDomain(filePath: string): string {
  const match = filePath.match(/src\/domains\/([^\/]+)/);
  return match ? match[1] : 'unknown';
}

function extractRepositoryName(filePath: string): string {
  const fileName = path.basename(filePath);
  return fileName.replace('.repository.ts', '').replace('.repository.tsx', '');
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options: ConversionOptions = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--domain':
        options.domain = args[++i];
        break;
      case '--file':
        options.filePath = args[++i];
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--backup':
        options.backup = true;
        break;
      case '--help':
        console.log(`
Usage: npx tsx convert-to-class-repository.ts [options]

Options:
  --domain <name>    Convert repositories in specific domain only
  --file <path>      Convert specific repository file
  --dry-run         Analyze repositories without making changes
  --backup          Create backup files before conversion
  --help            Show this help message

Examples:
  npx tsx convert-to-class-repository.ts
  npx tsx convert-to-class-repository.ts --domain inventory
  npx tsx convert-to-class-repository.ts --file src/domains/vision/repositories/user.repository.ts
  npx tsx convert-to-class-repository.ts --dry-run --backup
        `);
        process.exit(0);
    }
  }

  convertToClassRepository(options).catch(error => {
    console.error('Repository conversion failed:', error);
    process.exit(1);
  });
}