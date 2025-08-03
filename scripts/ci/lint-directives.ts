#!/usr/bin/env tsx
/**
 * Directive Block Linter v2025-08-1
 * Validates all TypeScript/JavaScript files have proper directive blocks
 * with enhanced checks for migrations, state machines, and cost tracking
 */

import { readFileSync, existsSync } from 'fs';
import { glob } from 'glob';
import { join, relative } from 'path';
import { load } from 'js-yaml';

interface ValidationError {
  file: string;
  errors: string[];
}

interface Config {
  skeleton_freeze_date?: string;
  max_monthly_llm_cost_usd?: number;
}

// ANSI colors
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m'
};

// Directive block regex patterns
const DIRECTIVE_REGEX = /\/\/ --- AGENT DIRECTIVE BLOCK ---[\s\S]*?\/\/ --- END DIRECTIVE BLOCK ---/;
const SQL_DIRECTIVE_REGEX = /-- --- AGENT DIRECTIVE BLOCK ---[\s\S]*?-- --- END DIRECTIVE BLOCK ---/;

/**
 * Load configuration
 */
function loadConfig(): Config {
  const configPath = join(process.cwd(), '.aac', 'config.yml');
  if (existsSync(configPath)) {
    try {
      const yaml = require('js-yaml');
      return yaml.load(readFileSync(configPath, 'utf-8')) as Config;
    } catch (e) {
      console.warn(`${colors.yellow}Warning: Could not load .aac/config.yml${colors.reset}`);
    }
  }
  return {};
}

/**
 * Extract directive block from file content
 */
function extractDirectiveBlock(content: string, filePath: string): string | null {
  if (filePath.endsWith('.sql')) {
    const match = content.match(SQL_DIRECTIVE_REGEX);
    return match ? match[0] : null;
  } else {
    const match = content.match(DIRECTIVE_REGEX);
    return match ? match[0] : null;
  }
}

/**
 * Validate a single directive block
 */
function validateDirectiveBlock(block: string, filePath: string, config: Config): string[] {
  const errors: string[] = [];
  const isSql = filePath.endsWith('.sql');
  const commentPrefix = isSql ? '--' : '//';
  
  // Mandatory fields for v2025-08-1
  const mandatoryFields = [
    'file:', 'phase:', 'domain:', 'version:', 'purpose:', 
    'spec_ref:', 'complexity_budget:', 'tasks:', 'offline_capability:'
  ];
  
  mandatoryFields.forEach(field => {
    const regex = new RegExp(`${commentPrefix} ${field}`, 'i');
    if (!regex.test(block)) {
      errors.push(`Missing mandatory field: ${field}`);
    }
  });
  
  // Validate file path matches
  const fileMatch = block.match(new RegExp(`${commentPrefix} file: (.+)`));
  if (fileMatch) {
    const declaredPath = fileMatch[1].trim();
    const actualPath = '/' + filePath.replace(/\\/g, '/');
    if (declaredPath !== actualPath) {
      errors.push(`File path mismatch: declared '${declaredPath}', actual '${actualPath}'`);
    }
  }
  
  // Validate phase number (1-5)
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
      errors.push(`Complexity budget exceeds limit: ${complexity} (max 500 LoC)`);
    }
  }
  
  // Validate spec_ref path exists
  const specRefMatch = block.match(new RegExp(`${commentPrefix} spec_ref: (.+)`));
  if (specRefMatch) {
    const specPath = specRefMatch[1].trim().split('#')[0]; // Remove anchor
    const fullSpecPath = join(process.cwd(), '.claude', 'spec', specPath);
    if (!existsSync(fullSpecPath)) {
      errors.push(`Invalid spec_ref: file does not exist at .claude/spec/${specPath}`);
    }
  }
  
  // Validate test coverage
  const coverageMatch = block.match(/coverage: ([\d.]+)/);
  if (coverageMatch) {
    const coverage = parseFloat(coverageMatch[1]);
    if (coverage < 0.85) {
      errors.push(`Test coverage too low: ${coverage} (minimum 0.85)`);
    }
  }
  
  // NEW: Validate migrations_touched
  const migrationsSection = block.match(/migrations_touched:\s*\n((?:\s*-\s*.+\n)*)/);
  if (migrationsSection) {
    const migrations = migrationsSection[1].match(/-\s*(.+)/g) || [];
    migrations.forEach(migration => {
      const migrationFile = migration.replace(/^-\s*/, '').trim();
      const migrationPath = join(process.cwd(), 'supabase', 'migrations', migrationFile);
      if (!existsSync(migrationPath)) {
        errors.push(`Migration file not found: ${migrationFile}`);
      }
    });
  }
  
  // NEW: Validate state_machine
  const stateMachineMatch = block.match(/state_machine:\s*\n\s*id:\s*(.+)\n\s*states:\s*\[([^\]]+)\]/);
  if (stateMachineMatch) {
    const states = stateMachineMatch[2].split(',').map(s => s.trim());
    if (states.length < 2) {
      errors.push(`State machine must have at least 2 states (found ${states.length})`);
    }
  }
  
  // NEW: Validate estimated_llm_cost
  const llmCostMatch = block.match(/estimated_llm_cost:\s*\n(?:\s*.+\n)*?\s*monthly_cost_usd:\s*([\d.]+)/);
  if (llmCostMatch) {
    const monthlyCost = parseFloat(llmCostMatch[1]);
    const maxCost = config.max_monthly_llm_cost_usd || 100;
    if (monthlyCost > maxCost) {
      errors.push(`LLM cost exceeds budget: $${monthlyCost} (max $${maxCost})`);
    }
  }
  
  // NEW: Validate offline_capability
  const offlineMatch = block.match(/offline_capability:\s*(REQUIRED|OPTIONAL|NONE)/);
  if (!offlineMatch) {
    errors.push('offline_capability must be specified as REQUIRED, OPTIONAL, or NONE');
  }
  
  // Check for voice_considerations in user-facing components
  const isUserFacing = filePath.includes('/controllers/') || 
                      filePath.includes('/components/') ||
                      filePath.includes('/pages/');
  
  if (isUserFacing && !block.includes('voice_considerations:')) {
    errors.push('Missing voice_considerations for user-facing component');
  }
  
  // Check if file has LLM operations but missing cost estimate
  const hasLLMOperation = block.includes('openai') || 
                         block.includes('anthropic') || 
                         block.includes('gpt') ||
                         block.includes('llm') ||
                         block.includes('ai_vision');
  
  if (hasLLMOperation && !block.includes('estimated_llm_cost:')) {
    errors.push('LLM operations detected but estimated_llm_cost missing');
  }
  
  return errors;
}

/**
 * Check actual file complexity
 */
function checkFileComplexity(content: string, filePath: string): string[] {
  const errors: string[] = [];
  
  // Count lines of code (excluding comments and blank lines)
  const lines = content.split('\n');
  const codeLines = lines.filter(line => {
    const trimmed = line.trim();
    return trimmed.length > 0 && 
           !trimmed.startsWith('//') && 
           !trimmed.startsWith('/*') &&
           !trimmed.startsWith('*');
  });
  
  if (codeLines.length > 500) {
    errors.push(`File exceeds 500 LoC limit: ${codeLines.length} lines`);
  }
  
  return errors;
}

/**
 * Check skeleton freeze date
 */
function checkSkeletonFreeze(config: Config): boolean {
  if (!config.skeleton_freeze_date) return false;
  
  const freezeDate = new Date(config.skeleton_freeze_date);
  const now = new Date();
  
  return now > freezeDate;
}

/**
 * Main validation function
 */
async function main() {
  const projectRoot = process.cwd();
  const config = loadConfig();
  
  // Check if we're past skeleton freeze date
  if (checkSkeletonFreeze(config)) {
    console.log(`${colors.yellow}⚠️  Warning: Past skeleton freeze date (${config.skeleton_freeze_date})${colors.reset}`);
    console.log(`${colors.yellow}   New skeletons require override-skeleton-freeze label and 2 reviewers${colors.reset}\n`);
  }
  
  // Find all TypeScript/JavaScript/SQL files
  const patterns = [
    'src/**/*.{ts,tsx,js,jsx}',
    'supabase/**/*.sql',
    'supabase/functions/**/*.{ts,js}'
  ];
  
  const ignorePatterns = [
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.spec.ts',
    '**/*.spec.tsx',
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**'
  ];
  
  let allFiles: string[] = [];
  
  for (const pattern of patterns) {
    const files = await glob(pattern, { 
      ignore: ignorePatterns,
      cwd: projectRoot 
    });
    allFiles = allFiles.concat(files);
  }
  
  console.log(`${colors.green}Checking ${allFiles.length} files for v2025-08-1 directive blocks...${colors.reset}\n`);
  
  const validationErrors: ValidationError[] = [];
  let validCount = 0;
  
  // Validate each file
  for (const file of allFiles) {
    const fullPath = join(projectRoot, file);
    const content = readFileSync(fullPath, 'utf-8');
    const errors: string[] = [];
    
    // Extract directive block
    const directiveBlock = extractDirectiveBlock(content, file);
    
    if (!directiveBlock) {
      errors.push('Missing directive block');
    } else {
      // Validate directive block
      const blockErrors = validateDirectiveBlock(directiveBlock, file, config);
      errors.push(...blockErrors);
    }
    
    // Check file complexity
    const complexityErrors = checkFileComplexity(content, file);
    errors.push(...complexityErrors);
    
    if (errors.length > 0) {
      validationErrors.push({ file, errors });
    } else {
      validCount++;
    }
  }
  
  // Report results
  if (validationErrors.length === 0) {
    console.log(`${colors.green}✅ All ${allFiles.length} files have valid v2025-08-1 directive blocks!${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`${colors.red}❌ Validation failed for ${validationErrors.length} files:${colors.reset}\n`);
    
    validationErrors.forEach(({ file, errors }) => {
      console.log(`${colors.yellow}${file}:${colors.reset}`);
      errors.forEach(error => {
        console.log(`  ${colors.red}✗${colors.reset} ${error}`);
      });
      console.log('');
    });
    
    console.log(`${colors.green}Summary: ${validCount} valid, ${validationErrors.length} invalid${colors.reset}`);
    process.exit(1);
  }
}

// Handle missing dependencies gracefully
try {
  main().catch(error => {
    console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
    process.exit(1);
  });
} catch (error) {
  if (error.code === 'MODULE_NOT_FOUND') {
    console.log(`${colors.yellow}Note: Missing dependencies for this script.${colors.reset}`);
    console.log(`Run: ${colors.green}npm install -D glob @types/glob js-yaml @types/js-yaml${colors.reset}`);
  } else {
    throw error;
  }
}
