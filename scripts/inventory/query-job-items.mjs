#!/usr/bin/env node
/*
AGENT DIRECTIVE BLOCK
file: /scripts/inventory/query-job-items.mjs
phase: 0
domain: inventory
purpose: Inspect current item assignments for a given job using item_transactions
spec_ref: docs/cleanup/inventory-refactor-future-plan.md
complexity_budget: 40
dependencies:
  internal:
    - /docs/cleanup/inventory-refactor-future-plan.md
voice_considerations:
  - Script can complement VLM debugging by confirming database state
*/

/**
 * Usage:
 *   node scripts/inventory/query-job-items.mjs <job-id>
 *
 * Example:
 *   node scripts/inventory/query-job-items.mjs 2fd5412e-3efd-4239-99bf-2304e82b03dd
 *
 * The script prints a breakdown of equipment, tools, and materials that are currently
 * assigned (latest transaction = check_out) for the specified job.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const jobId = process.argv[2];

if (!jobId) {
  console.error('❌ Job ID argument missing.\n');
  console.log('Usage: node scripts/inventory/query-job-items.mjs <job-id>');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

function printSection(title, items) {
  if (items.length === 0) {
    return;
  }

  console.log(`${title} (${items.length}):`);
  items.forEach((item, idx) => {
    console.log(`  ${idx + 1}. ${item.name} (qty: ${item.quantity})`);
  });
  console.log('');
}

async function main() {
  console.log(`🔍 Querying assigned items for job ${jobId}...\n`);

  // Fetch job context
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, job_number, customers(name), properties(name)')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    console.error('❌ Job not found or Supabase error:', jobError?.message);
    process.exit(1);
  }

  console.log(`📋 Job: ${job.job_number ?? 'N/A'}`);
  console.log(`👤 Customer: ${job.customers?.name ?? 'N/A'}`);
  console.log(`🏠 Property: ${job.properties?.name ?? 'N/A'}\n`);

  // Fetch transactional history
  const { data: transactions, error: txError } = await supabase
    .from('item_transactions')
    .select(`
      id,
      item_id,
      transaction_type,
      quantity,
      created_at,
      items!inner(
        id,
        name,
        item_type,
        category
      )
    `)
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });

  if (txError) {
    console.error('❌ Failed to fetch transactions:', txError.message);
    process.exit(1);
  }

  if (!transactions || transactions.length === 0) {
    console.log('ℹ️ No item transactions recorded for this job.');
    return;
  }

  // Reduce to latest transaction per item
  const itemsMap = new Map();
  transactions.forEach((tx) => {
    if (!itemsMap.has(tx.item_id)) {
      itemsMap.set(tx.item_id, {
        name: tx.items.name,
        item_type: tx.items.item_type,
        category: tx.items.category,
        transaction_type: tx.transaction_type,
        quantity: tx.quantity
      });
    }
  });

  const currentAssignments = Array.from(itemsMap.values())
    .filter((item) => item.transaction_type === 'check_out');

  const equipment = currentAssignments.filter((item) => item.item_type === 'equipment');
  const materials = currentAssignments.filter((item) => item.item_type === 'material');
  const tools = currentAssignments.filter((item) => item.item_type === 'tool');

  console.log('📦 CURRENTLY ASSIGNED ITEMS\n');
  printSection('🔧 Equipment', equipment);
  printSection('🧰 Tools', tools);
  printSection('📋 Materials', materials);

  console.log('📊 SUMMARY');
  console.log(`  Total assigned: ${currentAssignments.length}`);
  console.log(`  Equipment: ${equipment.length}`);
  console.log(`  Tools: ${tools.length}`);
  console.log(`  Materials: ${materials.length}`);
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
