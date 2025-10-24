/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/app/api/crew/jobs/[jobId]/equipment/route.ts
 * phase: 3
 * domain: crew
 * purpose: Hybrid API endpoint - reads item list from item_transactions, verification status from jobs.checklist_items
 * spec_ref: 007-mvp-intent-driven/contracts/crew-api.md
 * complexity_budget: 200
 * migrations_touched: []
 * state_machine: null
 * estimated_llm_cost: {
 *   "GET": "$0.00",
 *   "PUT": "$0.00"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: ['@/lib/supabase/server', '@/core/errors/error-handler'],
 *   external: ['next/server'],
 *   supabase: ['jobs']
 * }
 * exports: ['GET', 'PUT']
 * voice_considerations: None - API endpoint
 * test_requirements: {
 *   coverage: 85,
 *   unit_tests: 'tests/api/crew/job-equipment.test.ts'
 * }
 * tasks: [
 *   'Get required tools/materials from job (stored in checklist_items field)',
 *   'Update required tools/materials for job',
 * ]
 * note: API field name "checklist_items" preserved for backward compatibility
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { handleApiError } from '@/core/errors/error-handler';
import { JobLoadRepository } from '@/domains/crew/repositories/job-load.repository';
import { getRequestContext } from '@/lib/auth/context';
import { isJobLoadV2Enabled } from '@/lib/features/flags';

/**
 * HYBRID MODEL ARCHITECTURE
 *
 * This endpoint uses a hybrid approach for job load verification:
 *
 * 1. Item Assignment (Source of Truth): item_transactions table
 *    - What items are assigned to the job
 *    - Managed via supervisor item assignment API
 *    - Provides audit trail of check_out/check_in
 *
 * 2. Verification Status: jobs.checklist_items JSONB field
 *    - Which items have been verified/checked by crew
 *    - Tracks checked/unchecked state
 *    - Updated by crew during load verification
 *
 * GET: Merges item_transactions (item list) + checklist_items (checked status)
 * PUT: Updates only checklist_items (verification status)
 */

interface EquipmentItem {
  name: string;
  checked: boolean;
  category?: 'primary' | 'safety' | 'support' | 'materials';
  quantity?: number;
  verified_at?: string;
  icon?: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const supabase = await createServerClient();
    const { jobId } = params;

    // Get request context for feature flag check
    const context = await getRequestContext(request);
    const useV2 = await isJobLoadV2Enabled(context);

    if (!useV2) {
      // LEGACY PATH: Read only from jobs.checklist_items JSONB
      const { data: job, error } = await supabase
        .from('jobs')
        .select('checklist_items')
        .eq('id', jobId)
        .single();

      if (error) throw error;

      const checklistItems = (job?.checklist_items as any[]) || [];
      const equipment = checklistItems.map((item: any) => ({
        id: item.id,
        name: item.name,
        checked: item.checked || item.loaded || false,
        category: item.category || 'primary',
        quantity: item.quantity || 1,
        verified_at: item.verified_at,
        icon: item.icon
      }));

      return NextResponse.json({
        equipment,
        job_id: jobId
        // No _meta in legacy mode
      });
    }

    // NEW PATH: Hybrid model
    // 1. Get assigned items from item_transactions (what's assigned to job)
    const loadRepo = new JobLoadRepository(supabase);
    const assignedItems = await loadRepo.getRequiredItems(jobId);

    // 2. Get verification status from JSONB (what's been verified/checked)
    const { data: job } = await supabase
      .from('jobs')
      .select('checklist_items')
      .eq('id', jobId)
      .single();

    const checklistItems = (job?.checklist_items as any[]) || [];

    // 3. Merge: use item_transactions for item list, JSONB for checked status
    const equipment = assignedItems.map((item) => {
      // Find matching checklist item by name (fallback to ID if names don't match)
      const checklistItem = checklistItems.find(
        (ci: any) => ci.name === item.name || ci.id === item.id
      );

      return {
        id: item.id,
        name: item.name,
        checked: checklistItem?.checked || checklistItem?.loaded || false, // Get from JSONB, not item_transactions status
        category: item.item_type === 'equipment' ? 'primary' :
                  item.item_type === 'material' ? 'materials' : 'support',
        quantity: item.quantity,
        verified_at: checklistItem?.verified_at,
        icon: checklistItem?.icon
      };
    });

    return NextResponse.json({
      equipment,
      job_id: jobId,
      _meta: {
        total: items.length,
        sources: {
          table: items.filter((i) => i.source === 'table').length,
          jsonb: items.filter((i) => i.source === 'jsonb').length
        }
      }
    });

  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const supabase = await createServerClient();
    const { jobId } = params;
    const body = await request.json();

    const { equipment } = body;

    if (!Array.isArray(equipment)) {
      return NextResponse.json(
        { error: 'Equipment array is required' },
        { status: 400 }
      );
    }

    // Get request context for feature flag check
    const context = await getRequestContext(request);
    const useV2 = await isJobLoadV2Enabled(context);

    if (!useV2) {
      // LEGACY PATH: Update only jobs.checklist_items JSONB
      const { error } = await supabase
        .from('jobs')
        .update({ checklist_items: equipment })
        .eq('id', jobId);

      if (error) throw error;

      return NextResponse.json({
        success: true,
        equipment
        // No _meta in legacy mode
      });
    }

    // NEW PATH: Hybrid model - update only JSONB verification status
    // Item assignments are managed via supervisor API, not here
    const { error: jsonbError } = await supabase
      .from('jobs')
      .update({ checklist_items: equipment })
      .eq('id', jobId);

    if (jsonbError) throw jsonbError;

    console.log(`[Equipment PUT] Updated verification status for ${equipment.length} items`);

    return NextResponse.json({
      success: true,
      equipment,
      _meta: {
        total_items: equipment.length,
        checked_count: equipment.filter(item => item.checked).length,
        unchecked_count: equipment.filter(item => !item.checked).length
      }
    });

  } catch (error) {
    return handleApiError(error);
  }
}

// Note: POST and DELETE are not needed since we update the entire required items array with PUT
