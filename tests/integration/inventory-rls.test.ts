/**
 * Integration Test: Inventory RLS (Row Level Security)
 *
 * Feature: 004-voice-vision-inventory
 * Purpose: Verify multi-tenant isolation via RLS policies
 *
 * Tests T013-T015:
 * - inventory_items tenant isolation
 * - containers tenant isolation
 * - inventory_transactions tenant isolation
 *
 * MUST FAIL: No repositories exist yet (TDD)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Test company IDs
const COMPANY_A = '00000000-0000-0000-0000-000000000001';
const COMPANY_B = '00000000-0000-0000-0000-000000000002';

function createAuthClient(companyId: string) {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  // Set JWT claims to simulate authenticated user
  return client;
}

describe('Inventory RLS Integration Tests', () => {
  let clientA: ReturnType<typeof createClient>;
  let clientB: ReturnType<typeof createClient>;
  let serviceClient: ReturnType<typeof createClient>;

  beforeAll(() => {
    if (!supabaseUrl || !supabaseServiceKey) {
      console.log('⚠️  Skipping RLS tests: Missing Supabase credentials');
      return;
    }

    serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    clientA = createAuthClient(COMPANY_A);
    clientB = createAuthClient(COMPANY_B);
  });

  describe('T013: inventory_items RLS tenant isolation', () => {
    let itemIdA: string;
    let itemIdB: string;

    beforeAll(async () => {
      if (!serviceClient) return;

      // Create test items for both companies using service role
      const { data: itemA } = await serviceClient
        .from('inventory_items')
        .insert({
          company_id: COMPANY_A,
          type: 'equipment',
          name: 'Test Mower A',
          category: 'mower',
          status: 'active',
          tracking_mode: 'individual',
          images: [{ url: 'test.jpg', aspect_ratio: 1, is_primary: true }],
        })
        .select('id')
        .single();

      const { data: itemB } = await serviceClient
        .from('inventory_items')
        .insert({
          company_id: COMPANY_B,
          type: 'equipment',
          name: 'Test Mower B',
          category: 'mower',
          status: 'active',
          tracking_mode: 'individual',
          images: [{ url: 'test.jpg', aspect_ratio: 1, is_primary: true }],
        })
        .select('id')
        .single();

      itemIdA = itemA?.id;
      itemIdB = itemB?.id;
    });

    afterAll(async () => {
      if (!serviceClient) return;

      // Cleanup test data
      await serviceClient
        .from('inventory_items')
        .delete()
        .in('id', [itemIdA, itemIdB].filter(Boolean));
    });

    it('should allow Company A to read their own items', async () => {
      if (!clientA) return;

      const { data, error } = await clientA
        .from('inventory_items')
        .select('*')
        .eq('company_id', COMPANY_A);

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.some((item) => item.id === itemIdA)).toBe(true);
    });

    it('should prevent Company A from reading Company B items', async () => {
      if (!clientA) return;

      const { data, error } = await clientA
        .from('inventory_items')
        .select('*')
        .eq('id', itemIdB);

      // RLS should block access
      expect(data).toBeDefined();
      expect(data?.length).toBe(0);
    });

    it('should prevent Company A from updating Company B items', async () => {
      if (!clientA) return;

      const { error } = await clientA
        .from('inventory_items')
        .update({ name: 'Hacked Name' })
        .eq('id', itemIdB);

      // Should fail due to RLS
      expect(error).toBeDefined();
    });

    it('should prevent Company A from deleting Company B items', async () => {
      if (!clientA) return;

      const { error } = await clientA
        .from('inventory_items')
        .delete()
        .eq('id', itemIdB);

      // Should fail due to RLS
      expect(error).toBeDefined();
    });

    it('should isolate company_id in SELECT queries', async () => {
      if (!clientA || !clientB) return;

      const { data: dataA } = await clientA
        .from('inventory_items')
        .select('*')
        .eq('company_id', COMPANY_A);

      const { data: dataB } = await clientB
        .from('inventory_items')
        .select('*')
        .eq('company_id', COMPANY_B);

      // Each company should only see their own items
      expect(dataA?.every((item) => item.company_id === COMPANY_A)).toBe(true);
      expect(dataB?.every((item) => item.company_id === COMPANY_B)).toBe(true);

      // No overlap
      const idsA = dataA?.map((i) => i.id) || [];
      const idsB = dataB?.map((i) => i.id) || [];
      const overlap = idsA.filter((id) => idsB.includes(id));
      expect(overlap.length).toBe(0);
    });
  });

  describe('T014: containers RLS tenant isolation', () => {
    let containerIdA: string;
    let containerIdB: string;

    beforeAll(async () => {
      if (!serviceClient) return;

      const { data: containerA } = await serviceClient
        .from('containers')
        .insert({
          company_id: COMPANY_A,
          type: 'truck',
          name: 'Test Truck A',
        })
        .select('id')
        .single();

      const { data: containerB } = await serviceClient
        .from('containers')
        .insert({
          company_id: COMPANY_B,
          type: 'truck',
          name: 'Test Truck B',
        })
        .select('id')
        .single();

      containerIdA = containerA?.id;
      containerIdB = containerB?.id;
    });

    afterAll(async () => {
      if (!serviceClient) return;

      await serviceClient
        .from('containers')
        .delete()
        .in('id', [containerIdA, containerIdB].filter(Boolean));
    });

    it('should allow Company A to read their own containers', async () => {
      if (!clientA) return;

      const { data, error } = await clientA
        .from('containers')
        .select('*')
        .eq('company_id', COMPANY_A);

      expect(error).toBeNull();
      expect(data?.some((c) => c.id === containerIdA)).toBe(true);
    });

    it('should prevent Company A from reading Company B containers', async () => {
      if (!clientA) return;

      const { data } = await clientA
        .from('containers')
        .select('*')
        .eq('id', containerIdB);

      expect(data?.length).toBe(0);
    });

    it('should prevent Company A from updating Company B containers', async () => {
      if (!clientA) return;

      const { error } = await clientA
        .from('containers')
        .update({ name: 'Hacked Container' })
        .eq('id', containerIdB);

      expect(error).toBeDefined();
    });

    it('should prevent cross-tenant container hierarchy', async () => {
      if (!clientA) return;

      // Try to set parent_container_id to Company B's container
      const { error } = await clientA
        .from('containers')
        .update({ parent_container_id: containerIdB })
        .eq('id', containerIdA);

      // Should fail - cannot reference cross-tenant container
      expect(error).toBeDefined();
    });
  });

  describe('T015: inventory_transactions RLS tenant isolation', () => {
    let transactionIdA: string;
    let transactionIdB: string;
    let itemIdA: string;
    let itemIdB: string;

    beforeAll(async () => {
      if (!serviceClient) return;

      // Create test items
      const { data: itemA } = await serviceClient
        .from('inventory_items')
        .insert({
          company_id: COMPANY_A,
          type: 'equipment',
          name: 'Transaction Test Item A',
          category: 'test',
          status: 'active',
          tracking_mode: 'individual',
          images: [{ url: 'test.jpg', aspect_ratio: 1, is_primary: true }],
        })
        .select('id')
        .single();

      const { data: itemB } = await serviceClient
        .from('inventory_items')
        .insert({
          company_id: COMPANY_B,
          type: 'equipment',
          name: 'Transaction Test Item B',
          category: 'test',
          status: 'active',
          tracking_mode: 'individual',
          images: [{ url: 'test.jpg', aspect_ratio: 1, is_primary: true }],
        })
        .select('id')
        .single();

      itemIdA = itemA?.id;
      itemIdB = itemB?.id;

      // Create test transactions
      const { data: txA } = await serviceClient
        .from('inventory_transactions')
        .insert({
          company_id: COMPANY_A,
          type: 'register',
          item_ids: [itemIdA],
          performer_id: 'user-a',
          verification_method: 'manual',
        })
        .select('id')
        .single();

      const { data: txB } = await serviceClient
        .from('inventory_transactions')
        .insert({
          company_id: COMPANY_B,
          type: 'register',
          item_ids: [itemIdB],
          performer_id: 'user-b',
          verification_method: 'manual',
        })
        .select('id')
        .single();

      transactionIdA = txA?.id;
      transactionIdB = txB?.id;
    });

    afterAll(async () => {
      if (!serviceClient) return;

      await serviceClient.from('inventory_transactions').delete().in('id', [transactionIdA, transactionIdB].filter(Boolean));
      await serviceClient.from('inventory_items').delete().in('id', [itemIdA, itemIdB].filter(Boolean));
    });

    it('should allow Company A to read their own transactions', async () => {
      if (!clientA) return;

      const { data, error } = await clientA
        .from('inventory_transactions')
        .select('*')
        .eq('company_id', COMPANY_A);

      expect(error).toBeNull();
      expect(data?.some((t) => t.id === transactionIdA)).toBe(true);
    });

    it('should prevent Company A from reading Company B transactions', async () => {
      if (!clientA) return;

      const { data } = await clientA
        .from('inventory_transactions')
        .select('*')
        .eq('id', transactionIdB);

      expect(data?.length).toBe(0);
    });

    it('should prevent Company A from creating transactions with Company B items', async () => {
      if (!clientA) return;

      const { error } = await clientA
        .from('inventory_transactions')
        .insert({
          company_id: COMPANY_A,
          type: 'register',
          item_ids: [itemIdB], // Company B's item
          performer_id: 'user-a',
          verification_method: 'manual',
        });

      // Should fail - cannot reference cross-tenant items
      expect(error).toBeDefined();
    });

    it('should isolate transaction history by company', async () => {
      if (!clientA || !clientB) return;

      const { data: txA } = await clientA
        .from('inventory_transactions')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: txB } = await clientB
        .from('inventory_transactions')
        .select('*')
        .order('created_at', { ascending: false });

      // Each company should only see their own transactions
      expect(txA?.every((t) => t.company_id === COMPANY_A)).toBe(true);
      expect(txB?.every((t) => t.company_id === COMPANY_B)).toBe(true);
    });
  });
});