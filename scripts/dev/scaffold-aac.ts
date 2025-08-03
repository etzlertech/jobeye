#!/usr/bin/env tsx
/**
 * Architecture-as-Code Scaffold Injector v2025-08-1
 * Parses directive blocks from Claude's output and creates skeleton files
 * Enhanced with mandatory field validation and RLS template support
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join, basename } from 'path';

interface DirectiveBlock {
  path: string;
  content: string;
}

// ANSI color codes for terminal output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// Mandatory fields for v2025-08-1
const MANDATORY_FIELDS = ['phase', 'domain', 'purpose', 'spec_ref', 'tasks', 'offline_capability'];

/**
 * Parse directive blocks from Claude's output
 * Handles multiple code fence formats
 */
function parseDirectiveBlocks(input: string): DirectiveBlock[] {
  const blocks: DirectiveBlock[] = [];
  
  // Match code blocks with directive blocks inside
  // Supports ```typescript, ```ts, ```javascript, ```js, or just ```
  const regex = /```(?:typescript|ts|javascript|js|sql)?\n((?:\/\/|--) --- AGENT DIRECTIVE BLOCK ---[\s\S]*?(?:\/\/|--) --- END DIRECTIVE BLOCK ---)\n```/g;
  
  let match;
  while ((match = regex.exec(input)) !== null) {
    const block = match[1];
    
    // Extract file path from the block
    const fileMatch = block.match(/(?:\/\/|--) file: (.+)/);
    if (fileMatch) {
      const filePath = fileMatch[1].trim();
      blocks.push({
        path: filePath,
        content: block
      });
    }
  }
  
  return blocks;
}

/**
 * Validate directive block has required fields
 */
function validateDirectiveBlock(block: string, path: string): string[] {
  const errors: string[] = [];
  const isSql = path.endsWith('.sql');
  const commentPrefix = isSql ? '--' : '//';
  
  // Check mandatory fields
  MANDATORY_FIELDS.forEach(field => {
    const regex = new RegExp(`${commentPrefix} ${field}:`, 'i');
    if (!regex.test(block)) {
      errors.push(`Missing mandatory field: ${field}`);
    }
  });
  
  // Validate phase number
  const phaseMatch = block.match(new RegExp(`${commentPrefix} phase: (\\d+)`));
  if (phaseMatch) {
    const phase = parseInt(phaseMatch[1]);
    if (phase < 1 || phase > 5) {
      errors.push(`Invalid phase number: ${phase} (must be 1-5)`);
    }
  }
  
  // Validate complexity budget
  const complexityMatch = block.match(new RegExp(`${commentPrefix} complexity_budget: (\\d+)`));
  if (complexityMatch) {
    const complexity = parseInt(complexityMatch[1]);
    if (complexity > 500) {
      errors.push(`Complexity budget too high: ${complexity} (max 500 LoC)`);
    }
  }
  
  // Validate offline_capability value
  const offlineMatch = block.match(/offline_capability:\s*(REQUIRED|OPTIONAL|NONE)/);
  if (!offlineMatch) {
    errors.push('offline_capability must be REQUIRED, OPTIONAL, or NONE');
  }
  
  return errors;
}

/**
 * Check if RLS template should be generated
 */
function shouldGenerateRLSTemplate(block: string): string | null {
  const tableMatch = block.match(/table:\s*(\w+)\s*\(RLS ON\)/);
  if (tableMatch) {
    return tableMatch[1];
  }
  return null;
}

/**
 * Generate RLS template for a table
 */
function generateRLSTemplate(tableName: string, phaseNum: string): string {
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  
  return `-- --- AGENT DIRECTIVE BLOCK ---
-- file: /supabase/migrations/${timestamp}_${tableName}_rls.sql
-- phase: ${phaseNum}
-- domain: database
-- version: 1.0.0
-- purpose: Row-level security policies for ${tableName} table
-- spec_ref: .claude/spec/v4.0/rls-patterns.md
-- complexity_budget: 100 LoC
--
-- migrations_touched:
--   - ${timestamp}_${tableName}_rls.sql
--
-- tasks:
--   1. [ENABLE] Enable RLS on ${tableName} table
--   2. [ISOLATE] Create company isolation policy
--   3. [USER] Create user-specific read policy
--   4. [ADMIN] Create admin bypass policy
--
-- --- END DIRECTIVE BLOCK ---

-- Enable Row Level Security
ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;

-- Policy: Company isolation (all operations)
CREATE POLICY "${tableName}_company_isolation"
  ON public.${tableName}
  FOR ALL
  USING (company_id = (auth.jwt() ->> 'company_id')::uuid);

-- Policy: Users can read their own records
CREATE POLICY "${tableName}_user_read_own"
  ON public.${tableName}
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy: Admin bypass for support
CREATE POLICY "${tableName}_admin_bypass"
  ON public.${tableName}
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Grant usage permissions
GRANT ALL ON public.${tableName} TO authenticated;
GRANT ALL ON public.${tableName} TO service_role;
`;
}

/**
 * Create skeleton file with directive block
 */
function createSkeletonFile(block: DirectiveBlock, projectRoot: string): { success: boolean; rlsTable?: string; phase?: string } {
  const fullPath = join(projectRoot, block.path.startsWith('/') ? block.path.slice(1) : block.path);
  const dir = dirname(fullPath);
  
  // Create directory if it doesn't exist
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  // Check if file already exists
  if (existsSync(fullPath)) {
    const existingContent = readFileSync(fullPath, 'utf-8');
    if (existingContent.includes('AGENT DIRECTIVE BLOCK')) {
      console.log(`${colors.yellow}⚠️  Skipping ${block.path} - directive block already exists${colors.reset}`);
      return { success: false };
    }
  }
  
  // Validate the directive block
  const errors = validateDirectiveBlock(block.content, block.path);
  if (errors.length > 0) {
    console.log(`${colors.red}❌ Validation failed for ${block.path}:${colors.reset}`);
    errors.forEach(error => console.log(`   - ${error}`));
    return { success: false };
  }
  
  // Check for RLS table reference
  const rlsTableResult = shouldGenerateRLSTemplate(block.content);
  const rlsTable = rlsTableResult ?? undefined;
  const phaseMatch = block.content.match(/(?:\/\/|--) phase: (\d+)/);
  const phase = phaseMatch ? phaseMatch[1] : '1';
  
  // Add appropriate file extension handling
  let fileContent = block.content;
  
  if (block.path.endsWith('.ts') || block.path.endsWith('.tsx')) {
    // TypeScript files - add minimal skeleton
    fileContent += '\n\n// Implementation will go here\n';
    fileContent += 'export {}; // Ensure module scope\n';
  } else if (block.path.endsWith('.sql')) {
    // SQL files - add minimal structure
    fileContent += '\n\n-- Implementation will go here\n';
  } else if (block.path.endsWith('.json')) {
    // JSON files - add empty object
    fileContent = `${block.content}\n\n{}`;
  }
  
  // Write the file
  writeFileSync(fullPath, fileContent);
  console.log(`${colors.green}✅ Created ${block.path}${colors.reset}`);
  
  return { success: true, rlsTable, phase };
}

/**
 * Main execution
 */
function main() {
  // Determine project root (current directory)
  const projectRoot = process.cwd();
  
  // Read input from stdin or from a file if provided as argument
  let input: string;
  
  if (process.argv[2]) {
    // Read from file
    input = readFileSync(process.argv[2], 'utf-8');
  } else {
    // Read from stdin
    input = readFileSync(0, 'utf-8');
  }
  
  // Parse directive blocks
  const blocks = parseDirectiveBlocks(input);
  
  if (blocks.length === 0) {
    console.log(`${colors.red}❌ No directive blocks found in input${colors.reset}`);
    console.log('Make sure the input contains properly formatted directive blocks within code fences.');
    console.log('\nExpected format:');
    console.log('```typescript');
    console.log('// --- AGENT DIRECTIVE BLOCK ---');
    console.log('// ... directive content ...');
    console.log('// --- END DIRECTIVE BLOCK ---');
    console.log('```');
    process.exit(1);
  }
  
  console.log(`${colors.green}Found ${blocks.length} directive blocks to process${colors.reset}\n`);
  
  // Track RLS templates to generate
  const rlsTemplates: Array<{ table: string; phase: string }> = [];
  
  // Create skeleton files
  let successCount = 0;
  blocks.forEach(block => {
    try {
      const result = createSkeletonFile(block, projectRoot);
      if (result.success) {
        successCount++;
        if (result.rlsTable && result.phase) {
          rlsTemplates.push({ table: result.rlsTable, phase: result.phase });
        }
      }
    } catch (error) {
      console.log(`${colors.red}❌ Error creating ${block.path}: ${error}${colors.reset}`);
    }
  });
  
  // Generate RLS templates if needed
  if (rlsTemplates.length > 0) {
    console.log(`\n${colors.blue}Generating RLS templates...${colors.reset}`);
    
    rlsTemplates.forEach(({ table, phase }) => {
      const rlsContent = generateRLSTemplate(table, phase);
      const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
      const rlsPath = join(projectRoot, 'supabase', 'migrations', `${timestamp}_${table}_rls.sql`);
      
      if (!existsSync(dirname(rlsPath))) {
        mkdirSync(dirname(rlsPath), { recursive: true });
      }
      
      if (!existsSync(rlsPath)) {
        writeFileSync(rlsPath, rlsContent);
        console.log(`${colors.green}✅ Generated RLS template for ${table}${colors.reset}`);
      } else {
        console.log(`${colors.yellow}⚠️  RLS template for ${table} already exists${colors.reset}`);
      }
    });
  }
  
  console.log(`\n${colors.green}Summary: ${successCount}/${blocks.length} files created successfully${colors.reset}`);
  
  if (successCount < blocks.length) {
    console.log(`${colors.yellow}Run with validation errors fixed to create remaining files${colors.reset}`);
  }
}

// Run the script
main();
