/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/app/api/crew/jobs/[jobId]/equipment/route.ts
 * phase: 3
 * domain: crew
 * purpose: API endpoint for managing required tools/materials (stored in jobs.checklist_items for compatibility)
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

    const loadRepo = new JobLoadRepository(supabase);

    // Use dual-read logic to get required items
    const items = await loadRepo.getRequiredItems(jobId);

    // Transform to legacy equipment format for backward compatibility
    const equipment = items.map((item) => ({
      id: item.id,
      name: item.name,
      checked: item.status === 'loaded' || item.status === 'verified',
      category: item.item_type === 'equipment' ? 'primary' : 'materials',
      quantity: item.quantity,
      verified_at: item.status === 'verified' ? new Date().toISOString() : undefined,
      icon: undefined
    }));

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

    const loadRepo = new JobLoadRepository(supabase);

    // Dual-write: Update both JSONB and workflow_task_item_associations
    // 1. Update JSONB for backward compatibility
    const { error: jsonbError } = await supabase
      .from('jobs')
      .update({ checklist_items: equipment })
      .eq('id', jobId);

    if (jsonbError) throw jsonbError;

    // 2. Update workflow_task_item_associations status based on checked field
    for (const item of equipment) {
      if (item.checked) {
        await loadRepo.markItemLoaded(jobId, item.id);
      }
    }

    return NextResponse.json({
      success: true,
      equipment,
      _meta: {
        dual_write: true,
        updated_count: equipment.length
      }
    });

  } catch (error) {
    return handleApiError(error);
  }
}

// Note: POST and DELETE are not needed since we update the entire required items array with PUT
