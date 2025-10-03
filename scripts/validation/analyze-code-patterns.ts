#!/usr/bin/env npx tsx
/**
 * @file /scripts/validation/analyze-code-patterns.ts
 * @purpose Analyze codebase for deprecated patterns
 */

import { Project, SourceFile, Node } from 'ts-morph';
import { createClient } from '@supabase/supabase-js';
import { glob } from 'glob';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface PatternViolation {
  file_path: string;
  line_number: number;
  column_number: number;
  pattern_type: string;
  violation_text: string;
  suggested_fix: string;
}

async function analyzeCodePatterns() {
  const client = createClient(supabaseUrl, supabaseServiceKey);
  console.log('🔍 Analyzing code patterns...\n');

  // Initialize TypeScript project
  const project = new Project({
    tsConfigFilePath: path.join(process.cwd(), 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true
  });

  // Find all TypeScript files
  const tsFiles = await glob('src/**/*.{ts,tsx}', { 
    ignore: ['**/*.test.ts', '**/*.test.tsx', '**/node_modules/**'],
    cwd: process.cwd()
  });

  console.log(`Found ${tsFiles.length} TypeScript files to analyze\n`);

  const violations: PatternViolation[] = [];
  let companyIdCount = 0;
  let functionalRepoCount = 0;
  let wrongRlsCount = 0;
  let directDbCount = 0;

  for (const filePath of tsFiles) {
    const fullPath = path.join(process.cwd(), filePath);
    const sourceFile = project.addSourceFileAtPath(fullPath);
    
    // Check for company_id usage
    findCompanyIdUsage(sourceFile, filePath, violations);
    
    // Check for functional repositories
    if (filePath.includes('repository')) {
      findFunctionalRepositories(sourceFile, filePath, violations);
    }
    
    // Check for wrong RLS paths
    findWrongRlsPaths(sourceFile, filePath, violations);
    
    // Check for direct database access
    findDirectDbAccess(sourceFile, filePath, violations);
  }

  // Store violations in database
  console.log('\n💾 Storing violations in database...');
  
  for (const violation of violations) {
    const { error } = await client
      .from('code_pattern_violations')
      .insert(violation);
      
    if (error) {
      console.error(`Failed to store violation: ${error.message}`);
    }
    
    // Count by type
    switch (violation.pattern_type) {
      case 'company_id_usage': companyIdCount++; break;
      case 'functional_repository': functionalRepoCount++; break;
      case 'wrong_rls_path': wrongRlsCount++; break;
      case 'direct_db_access': directDbCount++; break;
    }
  }

  // Update repository inventory
  console.log('\n📦 Analyzing repository patterns...');
  await analyzeRepositoryPatterns(project, client);

  // Summary
  console.log('\n📋 PATTERN ANALYSIS SUMMARY');
  console.log('===========================');
  console.log(`Total violations found: ${violations.length}`);
  console.log(`  - company_id usage: ${companyIdCount}`);
  console.log(`  - functional repositories: ${functionalRepoCount}`);
  console.log(`  - wrong RLS paths: ${wrongRlsCount}`);
  console.log(`  - direct DB access: ${directDbCount}`);
  
  console.log('\n✅ Code pattern analysis complete!');
}

function findCompanyIdUsage(sourceFile: SourceFile, filePath: string, violations: PatternViolation[]) {
  sourceFile.forEachDescendant((node) => {
    const text = node.getText();
    
    // Look for company_id in various contexts
    if (text.includes('company_id') && !text.includes('tenant_id')) {
      const line = sourceFile.getLineAndColumnAtPos(node.getStart());
      
      violations.push({
        file_path: filePath,
        line_number: line.line,
        column_number: line.column,
        pattern_type: 'company_id_usage',
        violation_text: text.substring(0, 100),
        suggested_fix: text.replace(/company_id/g, 'tenant_id').substring(0, 100)
      });
    }
  });
}

function findFunctionalRepositories(sourceFile: SourceFile, filePath: string, violations: PatternViolation[]) {
  const exportedFunctions = sourceFile.getFunctions()
    .filter(fn => fn.isExported());
    
  // If file exports functions directly, it's functional pattern
  if (exportedFunctions.length > 0) {
    const firstFunc = exportedFunctions[0];
    const line = sourceFile.getLineAndColumnAtPos(firstFunc.getStart());
    
    violations.push({
      file_path: filePath,
      line_number: line.line,
      column_number: line.column,
      pattern_type: 'functional_repository',
      violation_text: `export function ${firstFunc.getName()}`,
      suggested_fix: 'Convert to class-based repository extending BaseRepository'
    });
  }
}

function findWrongRlsPaths(sourceFile: SourceFile, filePath: string, violations: PatternViolation[]) {
  sourceFile.forEachDescendant((node) => {
    const text = node.getText();
    
    // Look for wrong JWT path
    if (text.includes('auth.jwt()') && text.includes('tenant_id')) {
      const line = sourceFile.getLineAndColumnAtPos(node.getStart());
      
      violations.push({
        file_path: filePath,
        line_number: line.line,
        column_number: line.column,
        pattern_type: 'wrong_rls_path',
        violation_text: text.substring(0, 100),
        suggested_fix: text.replace('auth.jwt()', 'current_setting(\'request.jwt.claims\', true)::json -> \'app_metadata\'').substring(0, 100)
      });
    }
  });
}

function findDirectDbAccess(sourceFile: SourceFile, filePath: string, violations: PatternViolation[]) {
  // Skip repository files
  if (filePath.includes('repository')) return;
  
  sourceFile.forEachDescendant((node) => {
    const text = node.getText();
    
    // Look for direct Supabase client usage outside repositories
    if ((text.includes('.from(') || text.includes('.rpc(')) && 
        !filePath.includes('repository') &&
        !filePath.includes('migration') &&
        !filePath.includes('scripts/')) {
      
      const line = sourceFile.getLineAndColumnAtPos(node.getStart());
      
      violations.push({
        file_path: filePath,
        line_number: line.line,
        column_number: line.column,
        pattern_type: 'direct_db_access',
        violation_text: text.substring(0, 100),
        suggested_fix: 'Use repository pattern for database access'
      });
    }
  });
}

async function analyzeRepositoryPatterns(project: Project, client: any) {
  const repoFiles = project.getSourceFiles()
    .filter(sf => sf.getFilePath().includes('repository'));
    
  for (const sourceFile of repoFiles) {
    const filePath = path.relative(process.cwd(), sourceFile.getFilePath());
    const classes = sourceFile.getClasses();
    const exportedFunctions = sourceFile.getFunctions().filter(fn => fn.isExported());
    
    let patternType: string;
    if (classes.length > 0 && classes.some(c => c.getExtends()?.getText()?.includes('BaseRepository'))) {
      patternType = 'class_based';
    } else if (exportedFunctions.length > 0) {
      patternType = 'functional';
    } else if (classes.length > 0) {
      patternType = 'singleton';
    } else {
      patternType = 'mixed';
    }
    
    const domain = filePath.split('/')[2] || 'unknown';
    const repoName = path.basename(filePath, '.ts').replace('.repository', '');
    
    await client
      .from('repository_inventory')
      .insert({
        domain,
        repository_name: repoName,
        file_path: filePath,
        pattern_type: patternType,
        target_pattern: 'class_based',
        migration_status: patternType === 'class_based' ? 'completed' : 'pending',
        dependencies_count: 0 // Would need more analysis to get accurate count
      });
  }
}

analyzeCodePatterns().catch(console.error);