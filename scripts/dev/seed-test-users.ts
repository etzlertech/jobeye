#!/usr/bin/env npx tsx
/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /scripts/dev/seed-test-users.ts
 * phase: 3
 * domain: auth
 * purpose: Seed Supabase with deterministic test users for auth QA
 * spec_ref: docs/auth-routing.md
 * complexity_budget: 150
 * migrations_touched: []
 * state_machine: {
 *   states: ['initial', 'checking', 'creating', 'updating', 'completed'],
 *   transitions: [
 *     'initial->checking: loadUsers()',
 *     'checking->creating: createMissing() | updateExisting()',
 *     'creating->completed: summarize()',
 *     'updating->completed: summarize()'
 *   ]
 * }
 * estimated_llm_cost: { "script": "$0.00" }
 * offline_capability: NONE
 * dependencies: {
 *   internal: [],
 *   external: ['@supabase/supabase-js', 'dotenv', 'chalk'],
 *   supabase: ['auth']
 * }
 * exports: []
 * voice_considerations: NONE
 * test_requirements: {
 *   coverage: 0,
 *   unit_tests: 'Manual script'
 * }
 * tasks: [
 *   'Fetch existing users',
 *   'Create or update role metadata',
 *   'Emit human-readable summary'
 * ]
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(chalk.red('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')); 
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const TENANT_ID = 'demo-company';

interface SeedUser {
  email: string;
  password: string;
  role: 'admin' | 'supervisor' | 'crew';
  displayName: string;
}

const USERS: SeedUser[] = [
  { email: 'admin.qa@jobeye.test', password: 'AdminQA!1', role: 'admin', displayName: 'QA Admin' },
  { email: 'supervisor.qa@jobeye.test', password: 'SupQA!1', role: 'supervisor', displayName: 'QA Supervisor' },
  { email: 'crew.qa@jobeye.test', password: 'CrewQA!1', role: 'crew', displayName: 'QA Crew' }
];

async function listAllUsers() {
  const collected: any[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    if (!data || data.users.length === 0) {
      break;
    }

    collected.push(...data.users);

    if (data.users.length < perPage) {
      break;
    }

    page += 1;
  }

  return collected;
}

async function upsertUser(seed: SeedUser, existing?: any) {
  if (existing) {
    await supabase.auth.admin.updateUserById(existing.id, {
      app_metadata: {
        ...(existing.app_metadata || {}),
        role: seed.role,
        tenant_id: TENANT_ID
      },
      user_metadata: {
        ...(existing.user_metadata || {}),
        demo: true,
        display_name: seed.displayName
      }
    });
    return 'updated';
  }

  await supabase.auth.admin.createUser({
    email: seed.email,
    password: seed.password,
    email_confirm: true,
    user_metadata: {
      demo: true,
      display_name: seed.displayName
    },
    app_metadata: {
      role: seed.role,
      tenant_id: TENANT_ID
    }
  });
  return 'created';
}

async function main() {
  console.log(chalk.bold('Seeding QA auth users...'));
  const existingUsers = await listAllUsers();
  const results: { email: string; status: string }[] = [];

  for (const user of USERS) {
    const existing = existingUsers.find(u => u.email?.toLowerCase() === user.email.toLowerCase());
    const status = await upsertUser(user, existing);
    results.push({ email: user.email, status });
  }

  console.log('\nSummary');
  for (const result of results) {
    const indicator = result.status === 'created' ? chalk.green('CREATED') : chalk.yellow('UPDATED');
    console.log(` - ${indicator} ${result.email}`);
  }

  console.log('\nNext steps:');
  console.log(' - Share credentials securely with QA team');
  console.log(' - Run `npm run test:integration` for auth flows');
  console.log(' - Clear cookies before testing different roles');
}

main().catch(error => {
  console.error(chalk.red('Failed to seed users:'), error);
  process.exit(1);
});