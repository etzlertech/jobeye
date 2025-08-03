#!/usr/bin/env tsx

import { glob } from 'glob';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

interface DirectiveBlock {
  purpose?: string;
  domain?: string;
  phase?: string;
  complexity_budget?: string;
  voice_considerations?: string;
  security_considerations?: string;
  performance_considerations?: string;
  dependencies?: string[];
  [key: string]: any;
}

interface FileMetadata {
  path: string;
  relativePath: string;
  hasDirective: boolean;
  directive?: DirectiveBlock;
  fileType: string;
  status: 'scaffolded' | 'partial' | 'complete';
  lineCount: number;
  hasImplementation: boolean;
}

interface DomainGroup {
  domain: string;
  files: FileMetadata[];
  completionRate: number;
}

interface PhaseGroup {
  phase: string;
  domains: DomainGroup[];
  totalFiles: number;
  completedFiles: number;
}

async function extractDirectiveBlock(content: string): Promise<DirectiveBlock | null> {
  // Look for AGENT DIRECTIVE BLOCK or similar patterns
  const patterns = [
    /\/\*[\s\S]*?AGENT DIRECTIVE BLOCK[\s\S]*?\*\//,
    /\/\*[\s\S]*?purpose:[\s\S]*?\*\//,
    /\/\/\s*@directive-start[\s\S]*?\/\/\s*@directive-end/
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const block = match[0];
      const directive: DirectiveBlock = {};
      
      // Extract fields from the directive block
      const fields = [
        'purpose', 'domain', 'phase', 'complexity_budget',
        'voice_considerations', 'security_considerations', 
        'performance_considerations'
      ];
      
      for (const field of fields) {
        const fieldPattern = new RegExp(`${field}:\\s*(.+?)(?:\\n|\\*\/)`, 'i');
        const fieldMatch = block.match(fieldPattern);
        if (fieldMatch) {
          directive[field] = fieldMatch[1].trim();
        }
      }
      
      // Extract dependencies if present
      const depsMatch = block.match(/dependencies:\s*\[([^\]]+)\]/i);
      if (depsMatch) {
        directive.dependencies = depsMatch[1].split(',').map(d => d.trim());
      }
      
      return Object.keys(directive).length > 0 ? directive : null;
    }
  }
  
  return null;
}

async function analyzeFile(filePath: string): Promise<FileMetadata> {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  const relativePath = path.relative(process.cwd(), filePath);
  
  // Extract directive block
  const directive = await extractDirectiveBlock(content);
  
  // Determine file status
  let status: 'scaffolded' | 'partial' | 'complete' = 'complete';
  let hasImplementation = true;
  
  // Check for scaffold indicators
  const hasNotImplemented = content.includes('throw new Error("Not implemented")') ||
                           content.includes('// TODO: Implement') ||
                           content.includes('return notImplemented()');
  
  const hasSkeletonMarkers = content.includes('// SKELETON:') ||
                             content.includes('@skeleton') ||
                             content.includes('scaffold:');
  
  if (hasNotImplemented && !content.includes('export')) {
    status = 'scaffolded';
    hasImplementation = false;
  } else if (hasNotImplemented || hasSkeletonMarkers) {
    status = 'partial';
    hasImplementation = lines.length > 50; // Rough heuristic
  }
  
  // Determine file type
  let fileType = 'other';
  if (filePath.includes('/components/')) fileType = 'component';
  else if (filePath.includes('/services/')) fileType = 'service';
  else if (filePath.includes('/api/')) fileType = 'api';
  else if (filePath.includes('/hooks/')) fileType = 'hook';
  else if (filePath.includes('/utils/')) fileType = 'utility';
  else if (filePath.includes('/types/')) fileType = 'type';
  else if (filePath.includes('.test.') || filePath.includes('.spec.')) fileType = 'test';
  else if (filePath.endsWith('.sql')) fileType = 'migration';
  
  return {
    path: filePath,
    relativePath,
    hasDirective: !!directive,
    directive: directive || undefined,
    fileType,
    status,
    lineCount: lines.length,
    hasImplementation
  };
}

async function generateDetailedManifest() {
  console.log('🔍 Analyzing project architecture in detail...');
  
  // Get all source files
  const patterns = [
    'src/**/*.{ts,tsx,js,jsx}',
    'supabase/migrations/*.sql',
    'scripts/**/*.ts'
  ];
  
  const allFiles: string[] = [];
  for (const pattern of patterns) {
    const files = await glob(pattern, { 
      ignore: ['**/node_modules/**', '**/*.d.ts', '**/dist/**', '**/.next/**']
    });
    allFiles.push(...files);
  }
  
  // Analyze each file
  const fileMetadata: FileMetadata[] = [];
  for (const file of allFiles) {
    try {
      const metadata = await analyzeFile(file);
      fileMetadata.push(metadata);
    } catch (error) {
      console.error(`Error analyzing ${file}:`, error);
    }
  }
  
  // Group by phase and domain
  const phaseGroups = new Map<string, PhaseGroup>();
  
  for (const file of fileMetadata) {
    const phase = file.directive?.phase || 'unspecified';
    const domain = file.directive?.domain || 'general';
    
    if (!phaseGroups.has(phase)) {
      phaseGroups.set(phase, {
        phase,
        domains: [],
        totalFiles: 0,
        completedFiles: 0
      });
    }
    
    const phaseGroup = phaseGroups.get(phase)!;
    let domainGroup = phaseGroup.domains.find(d => d.domain === domain);
    
    if (!domainGroup) {
      domainGroup = {
        domain,
        files: [],
        completionRate: 0
      };
      phaseGroup.domains.push(domainGroup);
    }
    
    domainGroup.files.push(file);
    phaseGroup.totalFiles++;
    if (file.status === 'complete') {
      phaseGroup.completedFiles++;
    }
  }
  
  // Calculate completion rates
  phaseGroups.forEach(phase => {
    phase.domains.forEach(domain => {
      const completed = domain.files.filter(f => f.status === 'complete').length;
      domain.completionRate = Math.round((completed / domain.files.length) * 100);
    });
  });
  
  // Get git info
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  let gitInfo = { branch: 'unknown', lastCommit: 'unknown' };
  try {
    const [branchResult, commitResult] = await Promise.all([
      execAsync('git branch --show-current'),
      execAsync('git log -1 --pretty=format:"%h - %s (%cr)"')
    ]);
    gitInfo = {
      branch: branchResult.stdout.trim(),
      lastCommit: commitResult.stdout.trim()
    };
  } catch {}
  
  // Generate the detailed manifest
  const manifest = `# Architecture-as-Code Progress Manifest
Generated: ${new Date().toISOString()}
Purpose: Detailed scaffold tracking for AI-guided development

## Project Context
- **Branch**: ${gitInfo.branch}
- **Last Commit**: ${gitInfo.lastCommit}
- **Total Files**: ${fileMetadata.length}
- **Files with Directives**: ${fileMetadata.filter(f => f.hasDirective).length}

## Scaffold Status Summary
- **Scaffolded** (Empty): ${fileMetadata.filter(f => f.status === 'scaffolded').length} files
- **Partial** (In Progress): ${fileMetadata.filter(f => f.status === 'partial').length} files  
- **Complete** (Implemented): ${fileMetadata.filter(f => f.status === 'complete').length} files

## Architecture by Phase

${Array.from(phaseGroups.values())
  .sort((a, b) => {
    // Sort phases in logical order
    const order = ['foundation', 'core', 'features', 'enhancement', 'unspecified'];
    return order.indexOf(a.phase) - order.indexOf(b.phase);
  })
  .map(phase => `### Phase: ${phase.phase.toUpperCase()}
**Progress**: ${phase.completedFiles}/${phase.totalFiles} files (${Math.round((phase.completedFiles/phase.totalFiles)*100)}%)

${phase.domains.map(domain => `#### Domain: ${domain.domain}
**Completion**: ${domain.completionRate}%

| File | Status | Purpose | Complexity |
|------|--------|---------|------------|
${domain.files.map(f => {
  const status = f.status === 'complete' ? '✅' : 
                 f.status === 'partial' ? '🚧' : '📋';
  const purpose = f.directive?.purpose || '—';
  const complexity = f.directive?.complexity_budget || '—';
  return `| \`${f.relativePath}\` | ${status} | ${purpose} | ${complexity} |`;
}).join('\n')}
`).join('\n')}
`).join('\n---\n\n')}

## Detailed File Inventory

### Complete File List with Metadata

\`\`\`yaml
files:
${fileMetadata.map(f => `  - path: "${f.relativePath}"
    status: "${f.status}"
    type: "${f.fileType}"
    lines: ${f.lineCount}
    has_directive: ${f.hasDirective}${f.directive ? `
    directive:
      purpose: "${f.directive.purpose || '—'}"
      domain: "${f.directive.domain || '—'}"
      phase: "${f.directive.phase || '—'}"
      complexity_budget: "${f.directive.complexity_budget || '—'}"` : ''}`).join('\n')}
\`\`\`

## Voice-First Compliance

### Files with Voice Considerations
${fileMetadata
  .filter(f => f.directive?.voice_considerations)
  .map(f => `- \`${f.relativePath}\`: ${f.directive!.voice_considerations}`)
  .join('\n') || '- None found'}

## Security Audit

### Files with Security Considerations
${fileMetadata
  .filter(f => f.directive?.security_considerations)
  .map(f => `- \`${f.relativePath}\`: ${f.directive!.security_considerations}`)
  .join('\n') || '- None found'}

## Next Implementation Priorities

### 🔴 Critical (Scaffolded Files)
${fileMetadata
  .filter(f => f.status === 'scaffolded')
  .slice(0, 5)
  .map(f => `1. \`${f.relativePath}\` - ${f.directive?.purpose || 'No purpose defined'}`)
  .join('\n') || 'No scaffolded files requiring implementation'}

### 🟡 In Progress (Partial Implementation)
${fileMetadata
  .filter(f => f.status === 'partial')
  .slice(0, 5)
  .map(f => `1. \`${f.relativePath}\` - ${f.directive?.purpose || 'No purpose defined'}`)
  .join('\n') || 'No partially implemented files'}

## Directive Block Coverage Analysis

| Metric | Count | Percentage |
|--------|-------|------------|
| Files with Directives | ${fileMetadata.filter(f => f.hasDirective).length} | ${Math.round((fileMetadata.filter(f => f.hasDirective).length / fileMetadata.length) * 100)}% |
| Files with Purpose | ${fileMetadata.filter(f => f.directive?.purpose).length} | ${Math.round((fileMetadata.filter(f => f.directive?.purpose).length / fileMetadata.length) * 100)}% |
| Files with Domain | ${fileMetadata.filter(f => f.directive?.domain).length} | ${Math.round((fileMetadata.filter(f => f.directive?.domain).length / fileMetadata.length) * 100)}% |
| Files with Phase | ${fileMetadata.filter(f => f.directive?.phase).length} | ${Math.round((fileMetadata.filter(f => f.directive?.phase).length / fileMetadata.length) * 100)}% |
| Voice Considerations | ${fileMetadata.filter(f => f.directive?.voice_considerations).length} | ${Math.round((fileMetadata.filter(f => f.directive?.voice_considerations).length / fileMetadata.length) * 100)}% |

---
*This detailed manifest is designed for AI-guided Architecture-as-Code workflows*
*Use this to track skeleton scaffolding progress and guide implementation priorities*
`;
  
  // Write the manifest
  const outputPath = path.join(process.cwd(), 'DETAILED_PROGRESS_MANIFEST.md');
  await writeFile(outputPath, manifest);
  
  console.log('✅ Detailed progress manifest generated successfully!');
  console.log(`📄 Output: ${outputPath}`);
  console.log(`📊 Files analyzed: ${fileMetadata.length}`);
  console.log(`🏗️ Scaffolded: ${fileMetadata.filter(f => f.status === 'scaffolded').length}`);
  console.log(`🚧 Partial: ${fileMetadata.filter(f => f.status === 'partial').length}`);
  console.log(`✅ Complete: ${fileMetadata.filter(f => f.status === 'complete').length}`);
  
  return manifest;
}

if (require.main === module) {
  generateDetailedManifest().catch(console.error);
}

export { generateDetailedManifest };