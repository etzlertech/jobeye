/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /scripts/create-admin-audit-log-table.ts
 * purpose: Idempotent script to create admin_audit_log table via exec_sql RPC
 * spec_ref: admin-ui-specs.md#tenant-management
 * warnings: Run `npm run check:db-actual` before executing (Constitution Rule 1)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

type ExecSqlResponse = {
  error: { message: string } | null;
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase credentials. Ensure .env.local contains NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  const client = createClient(url, serviceKey);

  const sql = `
    create table if not exists admin_audit_log (
      id uuid primary key default gen_random_uuid(),
      tenant_id uuid,
      target_id uuid not null,
      target_type text not null,
      action text not null,
      actor_id uuid,
      actor_email text,
      actor_roles text[] default '{}'::text[],
      reason text,
      comment text,
      metadata jsonb,
      created_at timestamptz not null default timezone('utc', now())
    );

    create index if not exists admin_audit_log_tenant_idx
      on admin_audit_log (tenant_id);

    create index if not exists admin_audit_log_target_idx
      on admin_audit_log (target_id, target_type);
  `;

  const { error } = (await client.rpc('exec_sql', { sql })) as ExecSqlResponse;

  if (error) {
    console.error('Failed to apply admin_audit_log schema:', error.message);
    process.exit(1);
  }

  console.log('admin_audit_log table ensured successfully.');
}

main().catch((error) => {
  console.error('create-admin-audit-log-table.ts failed:', error);
  process.exit(1);
});
