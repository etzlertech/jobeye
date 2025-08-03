#!/usr/bin/env tsx

import { glob } from 'glob';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

interface FileStats {
  totalFiles: number;
  scaffoldedFiles: number;
  implementedFiles: number;
  componentFiles: number;
  apiRoutes: number;
  utilityFiles: number;
  testFiles: number;
}

interface DirectiveStats {
  totalDirectives: number;
  voiceConsiderations: number;
  securityConsiderations: number;
  performanceConsiderations: number;
}

async function countFiles(): Promise<FileStats> {
  const srcFiles = await glob('src/**/*.{ts,tsx,js,jsx}', { ignore: ['**/node_modules/**'] });
  const testFiles = await glob('**/*.{test,spec}.{ts,tsx,js,jsx}', { ignore: ['**/node_modules/**'] });
  const componentFiles = srcFiles.filter(f => f.includes('/components/') || f.endsWith('.tsx'));
  const apiFiles = srcFiles.filter(f => f.includes('/api/'));
  const utilFiles = srcFiles.filter(f => f.includes('/utils/') || f.includes('/lib/'));
  
  const scaffoldedFiles: string[] = [];
  const implementedFiles: string[] = [];
  
  for (const file of srcFiles) {
    try {
      const content = await readFile(file, 'utf-8');
      if (content.includes('// TODO:') || content.includes('throw new Error("Not implemented")')) {
        scaffoldedFiles.push(file);
      } else if (content.length > 100) {
        implementedFiles.push(file);
      }
    } catch (error) {
      console.error(`Error reading ${file}:`, error);
    }
  }
  
  return {
    totalFiles: srcFiles.length,
    scaffoldedFiles: scaffoldedFiles.length,
    implementedFiles: implementedFiles.length,
    componentFiles: componentFiles.length,
    apiRoutes: apiFiles.length,
    utilityFiles: utilFiles.length,
    testFiles: testFiles.length,
  };
}

async function countDirectives(): Promise<DirectiveStats> {
  const srcFiles = await glob('src/**/*.{ts,tsx}', { ignore: ['**/node_modules/**'] });
  
  let totalDirectives = 0;
  let voiceConsiderations = 0;
  let securityConsiderations = 0;
  let performanceConsiderations = 0;
  
  for (const file of srcFiles) {
    try {
      const content = await readFile(file, 'utf-8');
      
      const directiveMatches = content.match(/^\/\*\s*\n[\s\S]*?\*\//gm) || [];
      totalDirectives += directiveMatches.length;
      
      if (content.includes('voice_considerations:')) {
        voiceConsiderations++;
      }
      if (content.includes('security_considerations:')) {
        securityConsiderations++;
      }
      if (content.includes('performance_considerations:')) {
        performanceConsiderations++;
      }
    } catch (error) {
      console.error(`Error reading ${file}:`, error);
    }
  }
  
  return {
    totalDirectives,
    voiceConsiderations,
    securityConsiderations,
    performanceConsiderations,
  };
}

async function getGitInfo(): Promise<{ branch: string; lastCommit: string }> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  
  try {
    const [branchResult, commitResult] = await Promise.all([
      execAsync('git branch --show-current').catch(() => ({ stdout: 'unknown' })),
      execAsync('git log -1 --pretty=format:"%h - %s (%cr)"').catch(() => ({ stdout: 'No commits yet' })),
    ]);
    
    return {
      branch: branchResult.stdout.trim(),
      lastCommit: commitResult.stdout.trim(),
    };
  } catch {
    return {
      branch: 'unknown',
      lastCommit: 'No git information available',
    };
  }
}

async function generateManifest() {
  console.log('🔍 Analyzing project structure...');
  
  const [fileStats, directiveStats, gitInfo] = await Promise.all([
    countFiles(),
    countDirectives(),
    getGitInfo(),
  ]);
  
  const completionPercentage = fileStats.implementedFiles > 0 
    ? Math.round((fileStats.implementedFiles / fileStats.totalFiles) * 100)
    : 0;
  
  const voiceCoverage = fileStats.totalFiles > 0
    ? Math.round((directiveStats.voiceConsiderations / fileStats.totalFiles) * 100)
    : 0;
  
  const manifest = `# Project Progress Manifest
Generated: ${new Date().toISOString()}

## Project Overview
- **Project**: Voice-First FSM Application
- **Branch**: ${gitInfo.branch}
- **Last Commit**: ${gitInfo.lastCommit}

## Architecture-as-Code Progress

### File Statistics
- **Total Files**: ${fileStats.totalFiles}
- **Scaffolded Files**: ${fileStats.scaffoldedFiles}
- **Implemented Files**: ${fileStats.implementedFiles}
- **Completion**: ${completionPercentage}%

### Component Breakdown
- **Components**: ${fileStats.componentFiles}
- **API Routes**: ${fileStats.apiRoutes}
- **Utilities**: ${fileStats.utilityFiles}
- **Tests**: ${fileStats.testFiles}

### Directive Block Coverage
- **Total Directives**: ${directiveStats.totalDirectives}
- **Voice Considerations**: ${directiveStats.voiceConsiderations} (${voiceCoverage}% coverage)
- **Security Considerations**: ${directiveStats.securityConsiderations}
- **Performance Considerations**: ${directiveStats.performanceConsiderations}

## Architecture Health

### Voice-First Compliance
${voiceCoverage >= 80 ? '✅' : voiceCoverage >= 50 ? '⚠️' : '❌'} Voice Coverage: ${voiceCoverage}%
${directiveStats.securityConsiderations >= 5 ? '✅' : '⚠️'} Security Directives: ${directiveStats.securityConsiderations}
${fileStats.testFiles >= 10 ? '✅' : '⚠️'} Test Coverage: ${fileStats.testFiles} test files

### Implementation Status
\`\`\`
[${Array(Math.floor(completionPercentage / 5)).fill('█').join('')}${Array(20 - Math.floor(completionPercentage / 5)).fill('░').join('')}] ${completionPercentage}%
\`\`\`

## Recent Activity
- Files analyzed: ${fileStats.totalFiles}
- Scaffolded components pending implementation: ${fileStats.scaffoldedFiles}
- Active development files: ${fileStats.implementedFiles}

## Next Steps
${fileStats.scaffoldedFiles > 0 ? `- Complete implementation of ${fileStats.scaffoldedFiles} scaffolded files` : '- All scaffolded files have been implemented'}
${voiceCoverage < 80 ? `- Add voice considerations to ${fileStats.totalFiles - directiveStats.voiceConsiderations} files` : '- Voice coverage is satisfactory'}
${fileStats.testFiles < fileStats.componentFiles ? '- Increase test coverage for components' : '- Test coverage is adequate'}

---
*This manifest was automatically generated by the Construction Control Tower*
`;
  
  const outputPath = path.join(process.cwd(), 'PROGRESS_MANIFEST.md');
  await writeFile(outputPath, manifest);
  
  console.log('✅ Progress manifest generated successfully!');
  console.log(`📄 Output: ${outputPath}`);
  console.log(`📊 Completion: ${completionPercentage}% | Voice Coverage: ${voiceCoverage}%`);
  
  return manifest;
}

if (require.main === module) {
  generateManifest().catch(console.error);
}

export { generateManifest };