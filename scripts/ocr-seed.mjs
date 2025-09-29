#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to seed OCR data.');
  process.exit(1);
}

const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  },
});

const companyId = 'test-org-a';
const rows = [
  {
    table: 'vendors',
    payload: {
      id: '11111111-1111-4111-8111-111111111111',
      company_id: companyId,
      name: 'Seed Vendor A',
      is_active: true,
    },
  },
  {
    table: 'vendor_aliases',
    payload: {
      id: '22222222-2222-4222-8222-222222222222',
      company_id: companyId,
      vendor_id: '11111111-1111-4111-8111-111111111111',
      alias: 'Seed Vendor Alias A',
    },
  },
  {
    table: 'vendor_locations',
    payload: {
      id: '33333333-3333-4333-8333-333333333333',
      company_id: companyId,
      vendor_id: '11111111-1111-4111-8111-111111111111',
      address: '123 Seed St',
      city: 'Seedville',
      state: 'TX',
      postal_code: '75001',
      country: 'USA',
    },
  },
  {
    table: 'inventory_images',
    payload: {
      id: '44444444-4444-4444-8444-444444444444',
      company_id: companyId,
      media_id: null,
      file_path: '/ocr/test-org-a/invoices/seed-invoice.pdf',
      mime_type: 'application/pdf',
      size_bytes: 1024,
    },
  },
  {
    table: 'ocr_jobs',
    payload: {
      id: '55555555-5555-4555-8555-555555555555',
      company_id: companyId,
      vendor_id: '11111111-1111-4111-8111-111111111111',
      status: 'done',
      completed_at: new Date().toISOString(),
    },
  },
  {
    table: 'ocr_documents',
    payload: {
      id: '66666666-6666-4666-8666-666666666666',
      company_id: companyId,
      ocr_job_id: '55555555-5555-4555-8555-555555555555',
      file_path: '/ocr/test-org-a/invoices/seed-invoice.pdf',
      page_count: 1,
    },
  },
  {
    table: 'ocr_line_items',
    payload: {
      id: '77777777-7777-4777-8777-777777777777',
      company_id: companyId,
      ocr_document_id: '66666666-6666-4666-8666-666666666666',
      line_index: 1,
      sku: 'SEED-001',
      description: 'Seeded line item',
      qty: 2,
      unit_price: 10,
      total: 20,
    },
  },
  {
    table: 'ocr_note_entities',
    payload: {
      id: '88888888-8888-4888-8888-888888888888',
      company_id: companyId,
      ocr_document_id: '66666666-6666-4666-8666-666666666666',
      label: 'total_due',
      value: '20.00',
    },
  },
];

try {
  for (const row of rows) {
    const { error } = await client.from(row.table).upsert(row.payload, { onConflict: 'id' });
    if (error) {
      console.error(`Failed to upsert ${row.table}:`, error);
      process.exit(1);
    }
  }
  console.log('OCR seed complete.');
} catch (error) {
  console.error('Seed script error:', error);
  process.exit(1);
}
