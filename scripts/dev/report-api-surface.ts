#!/usr/bin/env tsx
/**
 * API Surface Report
 * Extracts and reports all exported functions from directive blocks
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { glob } from 'glob';
import { join } from 'path';

// ANSI colors
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  reset: '\x1b[0m'
};

interface ExportInfo {
  file: string;
  phase: number;
  domain: string;
  exports: string[];
}

/**
 * Extract export information from directive block
 */
function extractExports(filePath: string, content: string): ExportInfo | null {
  const directiveMatch = content.match(/(?:\/\/|--) --- AGENT DIRECTIVE BLOCK ---[\s\S]*?(?:\/\/|--) --- END DIRECTIVE BLOCK ---/);
  if (!directiveMatch) return null;
  
  const directive = directiveMatch[0];
  
  // Extract phase
  const phaseMatch = directive.match(/(?:\/\/|--) phase: (\d+)/);
  const phase = phaseMatch ? parseInt(phaseMatch[1]) : 0;
  
  // Extract domain
  const domainMatch = directive.match(/(?:\/\/|--) domain: (.+)/);
  const domain = domainMatch ? domainMatch[1].trim() : 'unknown';
  
  // Extract exports
  const exports: string[] = [];
  const exportsSection = directive.match(/exports:\s*\n((?:\s*-\s*.+\n)*)/);
  
  if (exportsSection) {
    const exportMatches = exportsSection[1].match(/-\s*(.+)/g) || [];
    exportMatches.forEach(exp => {
      const cleanExport = exp.replace(/^-\s*/, '').trim();
      exports.push(cleanExport);
    });
  }
  
  return {
    file: filePath,
    phase,
    domain,
    exports
  };
}

/**
 * Group exports by category
 */
function categorizeExports(exports: string[]): Map<string, string[]> {
  const categories = new Map<string, string[]>();
  
  exports.forEach(exp => {
    let category = 'other';
    
    if (exp.includes('function')) {
      category = 'functions';
    } else if (exp.includes('class')) {
      category = 'classes';
    } else if (exp.includes('interface') || exp.includes('type')) {
      category = 'types';
    } else if (exp.includes('const') || exp.includes('enum')) {
      category = 'constants';
    } else if (exp.includes('component') || /^[A-Z]/.test(exp.trim())) {
      category = 'components';
    }
    
    if (!categories.has(category)) {
      categories.set(category, []);
    }
    categories.get(category)!.push(exp);
  });
  
  return categories;
}

/**
 * Main execution
 */
async function main() {
  console.log(`${colors.blue}╔═══════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║           API Surface Report                  ║${colors.reset}`);
  console.log(`${colors.blue}╚═══════════════════════════════════════════════╝${colors.reset}\n`);
  
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
  
  const exportInfos: ExportInfo[] = [];
  
  for (const pattern of patterns) {
    const files = await glob(pattern, { 
      ignore: ignorePatterns,
      cwd: process.cwd() 
    });
    
    for (const file of files) {
      const fullPath = join(process.cwd(), file);
      const content = readFileSync(fullPath, 'utf-8');
      const normalizedPath = '/' + file.replace(/\\/g, '/');
      
      const exportInfo = extractExports(normalizedPath, content);
      if (exportInfo && exportInfo.exports.length > 0) {
        exportInfos.push(exportInfo);
      }
    }
  }
  
  // Group by phase and domain
  const phaseMap = new Map<number, Map<string, ExportInfo[]>>();
  
  exportInfos.forEach(info => {
    if (!phaseMap.has(info.phase)) {
      phaseMap.set(info.phase, new Map());
    }
    
    const domainMap = phaseMap.get(info.phase)!;
    if (!domainMap.has(info.domain)) {
      domainMap.set(info.domain, []);
    }
    
    domainMap.get(info.domain)!.push(info);
  });
  
  // Generate report
  let totalExports = 0;
  const categoryTotals = new Map<string, number>();
  
  Array.from(phaseMap.keys()).sort().forEach(phase => {
    console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.blue}Phase ${phase}${colors.reset}\n`);
    
    const domainMap = phaseMap.get(phase)!;
    
    Array.from(domainMap.keys()).sort().forEach(domain => {
      const files = domainMap.get(domain)!;
      const domainExports: string[] = [];
      
      files.forEach(file => {
        domainExports.push(...file.exports);
      });
      
      console.log(`${colors.yellow}📁 ${domain}${colors.reset} (${files.length} files, ${domainExports.length} exports)`);
      
      // Categorize exports
      const categories = categorizeExports(domainExports);
      
      categories.forEach((exports, category) => {
        console.log(`   ${colors.cyan}${category}:${colors.reset} ${exports.length}`);
        
        // Update totals
        totalExports += exports.length;
        categoryTotals.set(category, (categoryTotals.get(category) || 0) + exports.length);
        
        // Show first few examples
        const examples = exports.slice(0, 3);
        examples.forEach(exp => {
          const truncated = exp.length > 60 ? exp.substring(0, 57) + '...' : exp;
          console.log(`     • ${truncated}`);
        });
        
        if (exports.length > 3) {
          console.log(`     ${colors.cyan}... and ${exports.length - 3} more${colors.reset}`);
        }
      });
      
      console.log('');
    });
  });
  
  // Summary
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}SUMMARY${colors.reset}\n`);
  
  console.log(`Total Files with Exports: ${exportInfos.length}`);
  console.log(`Total Exports: ${totalExports}\n`);
  
  console.log('By Category:');
  Array.from(categoryTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      const percentage = Math.round((count / totalExports) * 100);
      console.log(`  ${colors.cyan}${category}:${colors.reset} ${count} (${percentage}%)`);
    });
  
  // Generate markdown report
  const reportPath = join(process.cwd(), '.aac', 'api-surface-report.md');
  let markdown = '# API Surface Report\n\n';
  markdown += `Generated: ${new Date().toISOString()}\n\n`;
  markdown += `## Summary\n\n`;
  markdown += `- Total Files: ${exportInfos.length}\n`;
  markdown += `- Total Exports: ${totalExports}\n\n`;
  
  markdown += '## Exports by Phase\n\n';
  
  phaseMap.forEach((domainMap, phase) => {
    markdown += `### Phase ${phase}\n\n`;
    
    domainMap.forEach((files, domain) => {
      markdown += `#### ${domain}\n\n`;
      
      files.forEach(file => {
        markdown += `**${file.file}**\n\n`;
        file.exports.forEach(exp => {
          markdown += `- ${exp}\n`;
        });
        markdown += '\n';
      });
    });
  });
  
  writeFileSync(reportPath, markdown);
  console.log(`\n${colors.green}Full report saved to: ${reportPath}${colors.reset}`);
}

// Run the script
main().catch(error => {
  console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
  process.exit(1);
});
