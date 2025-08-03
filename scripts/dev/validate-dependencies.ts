#!/usr/bin/env tsx
/**
 * Dependency Graph Validator
 * Ensures internal dependencies only reference files from same or earlier phases
 * Generates visual dependency graph
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { glob } from 'glob';
import { join, dirname } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ANSI colors
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

interface FileInfo {
  path: string;
  phase: number;
  domain: string;
  dependencies: string[];
}

interface DependencyError {
  file: string;
  dependency: string;
  error: string;
}

/**
 * Extract file info from directive block
 */
function extractFileInfo(filePath: string, content: string): FileInfo | null {
  const directiveMatch = content.match(/(?:\/\/|--) --- AGENT DIRECTIVE BLOCK ---[\s\S]*?(?:\/\/|--) --- END DIRECTIVE BLOCK ---/);
  if (!directiveMatch) return null;
  
  const directive = directiveMatch[0];
  
  // Extract phase
  const phaseMatch = directive.match(/(?:\/\/|--) phase: (\d+)/);
  const phase = phaseMatch ? parseInt(phaseMatch[1]) : 0;
  
  // Extract domain
  const domainMatch = directive.match(/(?:\/\/|--) domain: (.+)/);
  const domain = domainMatch ? domainMatch[1].trim() : 'unknown';
  
  // Extract internal dependencies
  const dependencies: string[] = [];
  const depsSection = directive.match(/dependencies:\s*\n\s*internal:((?:\s*-\s*.+\n)*)/);
  
  if (depsSection) {
    const depMatches = depsSection[1].match(/-\s*([^\s#]+)/g) || [];
    depMatches.forEach(dep => {
      const cleanDep = dep.replace(/^-\s*/, '').trim();
      if (cleanDep.startsWith('/')) {
        dependencies.push(cleanDep);
      }
    });
  }
  
  return {
    path: filePath,
    phase,
    domain,
    dependencies
  };
}

/**
 * Build dependency graph from all files
 */
async function buildDependencyGraph(): Promise<Map<string, FileInfo>> {
  const fileMap = new Map<string, FileInfo>();
  
  // Find all source files
  const patterns = [
    'src/**/*.{ts,tsx,js,jsx}',
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
  
  for (const pattern of patterns) {
    const files = await glob(pattern, { 
      ignore: ignorePatterns,
      cwd: process.cwd() 
    });
    
    for (const file of files) {
      const fullPath = join(process.cwd(), file);
      const content = readFileSync(fullPath, 'utf-8');
      const normalizedPath = '/' + file.replace(/\\/g, '/');
      
      const fileInfo = extractFileInfo(normalizedPath, content);
      if (fileInfo) {
        fileMap.set(normalizedPath, fileInfo);
      }
    }
  }
  
  return fileMap;
}

/**
 * Validate dependencies
 */
function validateDependencies(fileMap: Map<string, FileInfo>): DependencyError[] {
  const errors: DependencyError[] = [];
  
  fileMap.forEach((fileInfo, filePath) => {
    fileInfo.dependencies.forEach(dep => {
      const depPath = dep.split('#')[0]; // Remove function reference
      const depInfo = fileMap.get(depPath);
      
      if (!depInfo) {
        // Check if file exists at all
        const fullPath = join(process.cwd(), depPath.slice(1));
        if (!existsSync(fullPath)) {
          errors.push({
            file: filePath,
            dependency: dep,
            error: 'Dependency file does not exist'
          });
        } else {
          errors.push({
            file: filePath,
            dependency: dep,
            error: 'Dependency file missing directive block'
          });
        }
      } else if (depInfo.phase > fileInfo.phase) {
        errors.push({
          file: filePath,
          dependency: dep,
          error: `Depends on later phase (${depInfo.phase} > ${fileInfo.phase})`
        });
      }
    });
  });
  
  return errors;
}

/**
 * Generate DOT graph
 */
function generateDotGraph(fileMap: Map<string, FileInfo>): string {
  const lines: string[] = ['digraph Dependencies {'];
  lines.push('  rankdir=LR;');
  lines.push('  node [shape=box, style=rounded];');
  lines.push('');
  
  // Group by phase
  const phaseGroups = new Map<number, FileInfo[]>();
  fileMap.forEach(info => {
    if (!phaseGroups.has(info.phase)) {
      phaseGroups.set(info.phase, []);
    }
    phaseGroups.get(info.phase)!.push(info);
  });
  
  // Create subgraphs for each phase
  Array.from(phaseGroups.keys()).sort().forEach(phase => {
    lines.push(`  subgraph cluster_phase${phase} {`);
    lines.push(`    label="Phase ${phase}";`);
    lines.push(`    style=filled;`);
    lines.push(`    color=lightgrey;`);
    
    const files = phaseGroups.get(phase)!;
    files.forEach(info => {
      const shortPath = info.path.split('/').slice(-2).join('/');
      const nodeId = info.path.replace(/[\/\-\.]/g, '_');
      lines.push(`    ${nodeId} [label="${shortPath}\\n${info.domain}"];`);
    });
    
    lines.push('  }');
    lines.push('');
  });
  
  // Add edges
  fileMap.forEach(info => {
    const fromId = info.path.replace(/[\/\-\.]/g, '_');
    info.dependencies.forEach(dep => {
      const depPath = dep.split('#')[0];
      if (fileMap.has(depPath)) {
        const toId = depPath.replace(/[\/\-\.]/g, '_');
        lines.push(`  ${fromId} -> ${toId};`);
      }
    });
  });
  
  lines.push('}');
  return lines.join('\n');
}

/**
 * Generate circular dependency report
 */
function findCircularDependencies(fileMap: Map<string, FileInfo>): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  function dfs(path: string, currentPath: string[]): void {
    visited.add(path);
    recursionStack.add(path);
    currentPath.push(path);
    
    const fileInfo = fileMap.get(path);
    if (fileInfo) {
      for (const dep of fileInfo.dependencies) {
        const depPath = dep.split('#')[0];
        
        if (!visited.has(depPath)) {
          dfs(depPath, [...currentPath]);
        } else if (recursionStack.has(depPath)) {
          // Found a cycle
          const cycleStart = currentPath.indexOf(depPath);
          const cycle = currentPath.slice(cycleStart);
          cycle.push(depPath); // Complete the cycle
          cycles.push(cycle);
        }
      }
    }
    
    recursionStack.delete(path);
  }
  
  // Check all files
  fileMap.forEach((_, path) => {
    if (!visited.has(path)) {
      dfs(path, []);
    }
  });
  
  return cycles;
}

/**
 * Main execution
 */
async function main() {
  console.log(`${colors.blue}Building dependency graph...${colors.reset}\n`);
  
  // Build dependency graph
  const fileMap = await buildDependencyGraph();
  console.log(`Found ${fileMap.size} files with directive blocks\n`);
  
  // Validate dependencies
  const errors = validateDependencies(fileMap);
  
  if (errors.length > 0) {
    console.log(`${colors.red}❌ Found ${errors.length} dependency violations:${colors.reset}\n`);
    
    errors.forEach(({ file, dependency, error }) => {
      console.log(`${colors.yellow}${file}${colors.reset}`);
      console.log(`  → ${dependency}`);
      console.log(`  ${colors.red}✗ ${error}${colors.reset}\n`);
    });
  } else {
    console.log(`${colors.green}✅ All dependencies valid!${colors.reset}\n`);
  }
  
  // Check for circular dependencies
  const cycles = findCircularDependencies(fileMap);
  if (cycles.length > 0) {
    console.log(`${colors.red}❌ Found ${cycles.length} circular dependencies:${colors.reset}\n`);
    
    cycles.forEach((cycle, index) => {
      console.log(`${colors.red}Cycle ${index + 1}:${colors.reset}`);
      cycle.forEach((file, i) => {
        if (i < cycle.length - 1) {
          console.log(`  ${file} →`);
        } else {
          console.log(`  ${file}`);
        }
      });
      console.log('');
    });
  }
  
  // Generate DOT graph
  const dotContent = generateDotGraph(fileMap);
  const dotPath = join(process.cwd(), '.aac', 'dependency-graph.dot');
  
  if (!existsSync(dirname(dotPath))) {
    mkdirSync(dirname(dotPath), { recursive: true });
  }
  
  writeFileSync(dotPath, dotContent);
  console.log(`${colors.green}Generated dependency graph: ${dotPath}${colors.reset}`);
  
  // Try to generate SVG if graphviz is installed
  try {
    await execAsync(`dot -Tsvg ${dotPath} -o ${dotPath.replace('.dot', '.svg')}`);
    console.log(`${colors.green}Generated SVG: ${dotPath.replace('.dot', '.svg')}${colors.reset}`);
  } catch (e) {
    console.log(`${colors.yellow}Note: Install graphviz to generate visual graph (dot command)${colors.reset}`);
  }
  
  // Exit with error if violations found
  if (errors.length > 0 || cycles.length > 0) {
    process.exit(1);
  }
}

// Run the script
main().catch(error => {
  console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
  process.exit(1);
});
