#!/usr/bin/env tsx
/**
 * Skeleton Status Reporter
 * Shows progress of skeleton generation across all phases
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { load } from 'js-yaml';

// ANSI colors
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
  reset: '\x1b[0m'
};

interface FileIndex {
  phases: {
    [key: string]: {
      name: string;
      domains: {
        [key: string]: {
          description: string;
          tables?: string[];
          files: string[];
        };
      };
    };
  };
  total_files: number;
}

function checkFileStatus(filePath: string): 'complete' | 'skeleton' | 'missing' {
  const fullPath = join(process.cwd(), filePath.startsWith('/') ? filePath.slice(1) : filePath);
  
  if (!existsSync(fullPath)) {
    return 'missing';
  }
  
  const content = readFileSync(fullPath, 'utf-8');
  
  // Check if it has directive block
  if (content.includes('AGENT DIRECTIVE BLOCK')) {
    // Check if it has implementation beyond the directive block
    const linesAfterDirective = content.split('END DIRECTIVE BLOCK')[1]?.trim() || '';
    if (linesAfterDirective.length > 100) {
      return 'complete';
    }
    return 'skeleton';
  }
  
  return 'missing';
}

function formatPercentage(value: number): string {
  return `${Math.round(value)}%`;
}

function generateProgressBar(percentage: number, width: number = 20): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${' '.repeat(empty)}]`;
}

async function main() {
  console.log(`${colors.blue}╔═══════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║       JobEye Skeleton Generation Status       ║${colors.reset}`);
  console.log(`${colors.blue}╚═══════════════════════════════════════════════╝${colors.reset}\n`);
  
  // Load file index
  const indexPath = join(process.cwd(), '.aac', 'file-index.yml');
  
  if (!existsSync(indexPath)) {
    console.error(`${colors.red}Error: File index not found at ${indexPath}${colors.reset}`);
    console.log('Run this command from the project root directory.');
    process.exit(1);
  }
  
  let fileIndex: FileIndex;
  try {
    const yaml = await import('js-yaml');
    const content = readFileSync(indexPath, 'utf-8');
    fileIndex = yaml.load(content) as FileIndex;
  } catch (error) {
    // Fallback: parse manually if js-yaml not installed
    console.log(`${colors.yellow}Note: Install js-yaml for better YAML parsing${colors.reset}`);
    console.log(`Run: npm install -D js-yaml @types/js-yaml\n`);
    
    // For now, exit
    process.exit(1);
  }
  
  // Overall statistics
  let totalFiles = 0;
  let totalSkeleton = 0;
  let totalComplete = 0;
  let totalMissing = 0;
  
  // Process each phase
  Object.entries(fileIndex.phases).forEach(([phaseNum, phase]) => {
    console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.blue}Phase ${phaseNum}: ${phase.name}${colors.reset}\n`);
    
    // Process each domain in the phase
    Object.entries(phase.domains).forEach(([domainKey, domain]) => {
      const domainFiles = domain.files.length;
      let domainSkeleton = 0;
      let domainComplete = 0;
      let domainMissing = 0;
      
      // Check each file
      domain.files.forEach(file => {
        const status = checkFileStatus(file);
        switch (status) {
          case 'skeleton':
            domainSkeleton++;
            totalSkeleton++;
            break;
          case 'complete':
            domainComplete++;
            totalComplete++;
            break;
          case 'missing':
            domainMissing++;
            totalMissing++;
            break;
        }
        totalFiles++;
      });
      
      // Calculate domain progress
      const skeletonPercentage = (domainSkeleton / domainFiles) * 100;
      const completePercentage = (domainComplete / domainFiles) * 100;
      const totalProgress = ((domainSkeleton + domainComplete) / domainFiles) * 100;
      
      // Display domain status
      console.log(`${colors.yellow}📁 ${domainKey}${colors.reset} - ${domain.description}`);
      if (domain.tables) {
        console.log(`   ${colors.gray}Tables: ${domain.tables.join(', ')}${colors.reset}`);
      }
      console.log(`   Files: ${domainFiles} total`);
      console.log(`   ${colors.green}✓ Complete: ${domainComplete}${colors.reset} | ${colors.yellow}⚡ Skeleton: ${domainSkeleton}${colors.reset} | ${colors.red}✗ Missing: ${domainMissing}${colors.reset}`);
      console.log(`   Progress: ${generateProgressBar(totalProgress)} ${formatPercentage(totalProgress)}`);
      console.log('');
    });
  });
  
  // Overall summary
  console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}OVERALL SUMMARY${colors.reset}\n`);
  
  const overallSkeletonPercentage = (totalSkeleton / totalFiles) * 100;
  const overallCompletePercentage = (totalComplete / totalFiles) * 100;
  const overallProgress = ((totalSkeleton + totalComplete) / totalFiles) * 100;
  
  console.log(`Total Files: ${totalFiles}`);
  console.log(`${colors.green}✓ Complete:${colors.reset} ${totalComplete} (${formatPercentage(overallCompletePercentage)})`);
  console.log(`${colors.yellow}⚡ Skeleton:${colors.reset} ${totalSkeleton} (${formatPercentage(overallSkeletonPercentage)})`);
  console.log(`${colors.red}✗ Missing:${colors.reset} ${totalMissing} (${formatPercentage((totalMissing / totalFiles) * 100)})`);
  console.log(`\n${colors.blue}Overall Progress:${colors.reset} ${generateProgressBar(overallProgress, 30)} ${formatPercentage(overallProgress)}`);
  
  // Recommendations
  console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.blue}NEXT STEPS${colors.reset}\n`);
  
  if (totalMissing > totalSkeleton + totalComplete) {
    console.log(`1. ${colors.yellow}Start skeleton generation:${colors.reset} Most files are missing`);
    console.log(`   Use the master prompt template to begin with Phase 1`);
  } else if (totalSkeleton > totalComplete) {
    console.log(`1. ${colors.yellow}Continue implementation:${colors.reset} ${totalSkeleton} files have skeletons ready`);
    console.log(`   Focus on completing Phase 1 core infrastructure first`);
  } else {
    console.log(`1. ${colors.green}Great progress!${colors.reset} Most files are implemented`);
    console.log(`   Run tests and validate the implementation`);
  }
  
  // Find the next domain to work on
  let nextDomain = null;
  let nextPhase = null;
  
  phaseLoop: for (const [phaseNum, phase] of Object.entries(fileIndex.phases)) {
    for (const [domainKey, domain] of Object.entries(phase.domains)) {
      const hasAnyFile = domain.files.some(file => {
        const status = checkFileStatus(file);
        return status !== 'missing';
      });
      
      const hasAllFiles = domain.files.every(file => {
        const status = checkFileStatus(file);
        return status !== 'missing';
      });
      
      if (hasAnyFile && !hasAllFiles) {
        nextDomain = domainKey;
        nextPhase = phaseNum;
        break phaseLoop;
      } else if (!hasAnyFile) {
        nextDomain = domainKey;
        nextPhase = phaseNum;
        break phaseLoop;
      }
    }
  }
  
  if (nextDomain && nextPhase) {
    console.log(`\n2. ${colors.yellow}Next domain to scaffold:${colors.reset} Phase ${nextPhase} / ${nextDomain}`);
  }
  
  console.log(`\n${colors.gray}Run 'npm run scaffold:inject < output.txt' after generating skeletons${colors.reset}`);
}

// Run the script
main().catch(error => {
  console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
  process.exit(1);
});
