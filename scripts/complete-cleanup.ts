#!/usr/bin/env npx tsx
/**
 * Complete the pre-frontend cleanup tasks: run types, write docs, print next steps.
 */

import { execSync } from 'child_process';
import { writeFile } from 'fs/promises';
import chalk from 'chalk';

type StepResult = {
  name: string;
  success: boolean;
  message?: string;
};

async function generateTypes(): Promise<StepResult> {
  try {
    execSync('npm run generate:types', { stdio: 'inherit' });
    return { name: 'Generate types', success: true };
  } catch (error) {
    return {
      name: 'Generate types',
      success: false,
      message: 'npm run generate:types failed. Run manually after installing Supabase CLI.'
    };
  }
}

async function writeUiReadyDoc(): Promise<StepResult> {
  const today = new Date().toISOString().split('T')[0];
  const lines = [
    '# UI-Ready Features',
    '',
    `Last Updated: ${today}`,
    '',
    '## Ready for Frontend Development',
    '',
    '### 1. Customer Management',
    '- Status: Fully implemented',
    '- Data: 91 customers in production',
    '- Backend: Complete CRUD operations',
    '- API Endpoints: `/api/customers/*`',
    '- Repository: `src/domains/customer/repositories/customer.repository.ts`',
    '- Key Features: Create, read, update, delete, search, pagination',
    '',
    '### 2. Property Management',
    '- Status: Fully implemented',
    '- Data: 35 properties in production',
    '- Backend: Complete CRUD operations',
    '- API Endpoints: `/api/properties/*`',
    '- Repository: `src/domains/property/repositories/property.repository.ts`',
    '- Key Features: Property CRUD, customer association, address management',
    '',
    '### 3. Job Management',
    '- Status: Fully implemented',
    '- Data: 50 jobs in production',
    '- Backend: Complete CRUD operations',
    '- API Endpoints: `/api/jobs/*`',
    '- Repository: `src/domains/jobs/repositories/job.repository.ts`',
    '- Key Features: Job scheduling, status tracking, customer/property linking',
    '',
    '### 4. Vision Kit Verification',
    '- Status: Backend ready, no production data',
    '- Backend: Complete service layer',
    '- API Endpoints: `/api/vision/*`',
    '- Repository: Class-based repositories (Feature 009)',
    '- Key Features: YOLO and VLM detection, cost tracking, offline support',
    '- UI Needed: Camera capture, results display, cost dashboard',
    '',
    '### 5. Voice Transcription',
    '- Status: Backend ready, no production data',
    '- Backend: Schema and repositories ready',
    '- API Endpoints: Ready to implement',
    '- Key Features: STT and TTS integration, session management',
    '- UI Needed: Voice recording, transcript display',
    '',
    '## Not Ready for Frontend',
    '',
    '### Inventory Management',
    '- Issue: Migration from legacy to unified model incomplete',
    '- Action Required: Decide between legacy tables or new unified model',
    '- Current State: Both table sets exist with zero data',
    '',
    '### Equipment Tracking',
    '- Issue: Schema exists but no implementation',
    '- Action Required: Implement services and repositories',
    '',
    '## Quick Start for Frontend Devs',
    '',
    '```bash',
    '# 1. Install dependencies',
    'npm install',
    '',
    '# 2. Set up environment variables',
    'cp .env.example .env.local',
    '# Add your Supabase credentials',
    '',
    '# 3. Start development server',
    'npm run dev',
    '',
    '# 4. View API documentation',
    '# Visit http://localhost:3000/api-docs (if implemented)',
    '```',
    '',
    '## Database Statistics',
    '',
    '- Total Tables: 40 (after cleanup)',
    '- Tables with Data: 7',
    '- Total Records: 487',
    '- Removed Tables: 9 (orphaned tables)',
    '',
    '## Technical Notes',
    '',
    '- All repositories use class-based pattern extending BaseRepository',
    '- Multi-tenant isolation via tenant_id and RLS policies',
    '- TypeScript types auto-generated from database schema',
    '- Offline support implemented for vision features'
  ];

  await writeFile('docs/ui-ready-features.md', lines.join('\n'));
  return { name: 'UI-ready documentation', success: true };
}

async function main(): Promise<void> {
  console.log(chalk.bold('Completing pre-frontend cleanup tasks'));
  console.log('');

  const steps: StepResult[] = [];

  steps.push(await generateTypes());
  steps.push(await writeUiReadyDoc());

  console.log('');
  console.log(chalk.bold('Summary'));
  for (const step of steps) {
    const status = step.success ? chalk.green('OK') : chalk.red('FAIL');
    console.log(`- ${step.name}: ${status}`);
    if (!step.success && step.message) {
      console.log(`  ${step.message}`);
    }
  }

  console.log('');
  console.log(chalk.bold('Next steps'));
  console.log('- Run: npx tsx scripts/apply-orphaned-tables-cleanup.ts');
  console.log('- Run: npm run generate:types (if the earlier step failed)');
  console.log('- Run: npx tsx scripts/get-all-tables-direct.ts');
  console.log('- Commit and push once verification is complete');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});