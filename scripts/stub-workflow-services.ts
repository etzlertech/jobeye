#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';

const servicesToStub = [
  {
    path: 'src/domains/field-intelligence/services/workflows-completion-verification.service.ts',
    className: 'WorkflowsCompletionVerificationService',
    repositories: ['WorkflowsCompletionRecordsRepository']
  },
  {
    path: 'src/domains/field-intelligence/services/workflows-instruction-search.service.ts',
    className: 'WorkflowsInstructionSearchService',
    repositories: ['WorkflowsStandardInstructionsRepository']
  },
  {
    path: 'src/domains/field-intelligence/services/workflows-job-arrival.service.ts',
    className: 'WorkflowsJobArrivalService',
    repositories: ['WorkflowsJobArrivalsRepository']
  },
  {
    path: 'src/domains/field-intelligence/services/workflows-task-parsing.service.ts',
    className: 'WorkflowsTaskParsingService',
    repositories: ['WorkflowsParsedTasksRepository']
  }
];

servicesToStub.forEach(service => {
  const fullPath = path.join(process.cwd(), service.path);
  
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf-8');
    
    // Comment out repository imports
    service.repositories.forEach(repo => {
      const importRegex = new RegExp(`import\\s+{\\s*${repo}\\s*}\\s+from\\s+['"][^'"]+['"];?`, 'g');
      content = content.replace(importRegex, `// TODO: import { ${repo} } from '../repositories/${repo.replace(/Repository$/, '').replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '')}.repository';`);
    });
    
    // Comment out repository properties and instantiations
    content = content.replace(
      /(private\s+\w+Repository:\s+\w+Repository);/g,
      '// TODO: $1;'
    );
    
    content = content.replace(
      /(this\.\w+Repository\s*=\s*new\s+\w+Repository\([^)]+\));/g,
      '// TODO: $1'
    );
    
    // Replace repository method calls with empty arrays or mock data
    content = content.replace(
      /await\s+this\.\w+Repository\.findAll\([^)]*\)/g,
      '[]'
    );
    
    content = content.replace(
      /await\s+this\.\w+Repository\.findById\([^)]*\)/g,
      'null'
    );
    
    content = content.replace(
      /await\s+this\.\w+Repository\.create\([^)]*\)/g,
      '{ id: "mock-id" }'
    );
    
    content = content.replace(
      /await\s+this\.\w+Repository\.update\([^)]*\)/g,
      '{ id: "mock-id" }'
    );
    
    fs.writeFileSync(fullPath, content);
    console.log(`✓ Stubbed ${service.path}`);
  } else {
    console.log(`✗ File not found: ${service.path}`);
  }
});

console.log('\n✅ Workflow services have been stubbed');