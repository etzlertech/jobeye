#!/usr/bin/env npx tsx

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const dynamicExports = `
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;`;

const apiRoutes = [
  'src/app/api/auth/login/route.ts',
  'src/app/api/auth/logout/route.ts',
  'src/app/api/auth/refresh/route.ts',
  'src/app/api/auth/register/route.ts',
  'src/app/api/containers/route.ts',
  'src/app/api/control-tower/generate-manifest/route.ts',
  'src/app/api/field-intelligence/routing/geofence/route.ts',
  'src/app/api/field-intelligence/routing/gps/route.ts',
  'src/app/api/field-intelligence/workflows/analytics/route.ts',
  'src/app/api/field-intelligence/workflows/arrivals/route.ts',
  'src/app/api/field-intelligence/workflows/parse-tasks/route.ts',
  'src/app/api/field-intelligence/workflows/verify-completion/route.ts',
  'src/app/api/inventory/detect/route.ts',
  'src/app/api/jobs/[jobId]/kits/[kitId]/verify/route.ts',
  'src/app/api/jobs/[jobId]/load-list/route.ts',
  'src/app/api/kit-overrides/route.ts',
  'src/app/api/kits/route.ts',
  'src/app/api/scheduling/day-plans/[id]/optimize/route.ts',
  'src/app/api/scheduling/day-plans/route.ts',
  'src/app/api/scheduling/schedule-events/route.ts',
  'src/app/api/vision/batch-verify/route.ts',
  'src/app/api/vision/verifications/[id]/route.ts',
  'src/app/api/vision/verify/route.ts',
  'src/app/api/voice/intake/route.ts'
];

function addDynamicExports(filePath: string) {
  try {
    const fullPath = join(process.cwd(), filePath);
    const content = readFileSync(fullPath, 'utf-8');
    
    // Check if already has dynamic export
    if (content.includes('export const dynamic')) {
      console.log(`✓ ${filePath} - already has dynamic export`);
      return;
    }
    
    // Find the last import statement
    const lines = content.split('\n');
    let lastImportIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('import ')) {
        lastImportIndex = i;
      }
    }
    
    if (lastImportIndex === -1) {
      console.error(`✗ ${filePath} - no imports found`);
      return;
    }
    
    // Insert the exports after the last import
    lines.splice(lastImportIndex + 1, 0, dynamicExports);
    
    const newContent = lines.join('\n');
    writeFileSync(fullPath, newContent);
    
    console.log(`✓ ${filePath} - added dynamic exports`);
  } catch (error) {
    console.error(`✗ ${filePath} - error: ${error}`);
  }
}

console.log('Adding dynamic exports to API routes...\n');

apiRoutes.forEach(route => {
  addDynamicExports(route);
});

console.log('\nDone!');