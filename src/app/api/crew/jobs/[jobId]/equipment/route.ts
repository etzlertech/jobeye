/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/api/crew/jobs/[jobId]/equipment/route.ts
 * phase: 3
 * domain: crew
 * purpose: API endpoint for job equipment management
 * spec_ref: 007-mvp-intent-driven/contracts/crew-api.md
 * complexity_budget: 200
 * migrations_touched: ['job_equipment_requirements']
 * state_machine: null
 * estimated_llm_cost: {
 *   "GET": "$0.00",
 *   "PUT": "$0.00"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: ['@/lib/supabase/server', '@/core/errors/error-handler'],
 *   external: ['next/server'],
 *   supabase: ['job_equipment_requirements', 'jobs']
 * }
 * exports: ['GET', 'PUT', 'POST', 'DELETE']
 * voice_considerations: None - API endpoint
 * test_requirements: {
 *   coverage: 85,
 *   unit_tests: 'tests/api/crew/job-equipment.test.ts'
 * }
 * tasks: [
 *   'Get equipment list for job',
 *   'Update equipment verification status',
 *   'Add/remove equipment items',
 *   'Support demo mode'
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { handleApiError } from '@/core/errors/error-handler';

interface EquipmentItem {
  id?: string;
  equipment_name: string;
  quantity: number;
  category: 'primary' | 'safety' | 'support' | 'materials';
  is_required: boolean;
  is_verified: boolean;
  verified_at?: string;
  notes?: string;
  display_order: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const supabase = await createServerClient();
    const { jobId } = params;
    
    // Check if demo mode
    const isDemo = request.headers.get('x-is-demo') === 'true';

    if (isDemo) {
      // Return varied mock equipment for demo jobs
      const demoEquipment: Record<string, EquipmentItem[]> = {
        '1': [
          { equipment_name: 'Walk-Behind Mower', quantity: 1, category: 'primary', is_required: true, is_verified: false, display_order: 1 },
          { equipment_name: 'String Trimmer', quantity: 1, category: 'primary', is_required: true, is_verified: false, display_order: 2 },
          { equipment_name: 'Leaf Blower', quantity: 1, category: 'primary', is_required: true, is_verified: false, display_order: 3 },
          { equipment_name: 'Safety Glasses', quantity: 1, category: 'safety', is_required: true, is_verified: false, display_order: 4 },
          { equipment_name: 'Hearing Protection', quantity: 1, category: 'safety', is_required: true, is_verified: false, display_order: 5 },
          { equipment_name: 'Gas Can (2 gal)', quantity: 1, category: 'support', is_required: true, is_verified: false, display_order: 6 },
          { equipment_name: 'Hand Tools Bag', quantity: 1, category: 'support', is_required: false, is_verified: false, display_order: 7 },
          { equipment_name: 'Trash Bags', quantity: 10, category: 'materials', is_required: false, is_verified: false, display_order: 8 }
        ],
        '2': [
          { equipment_name: 'Zero-Turn Mower', quantity: 1, category: 'primary', is_required: true, is_verified: false, display_order: 1 },
          { equipment_name: 'String Trimmer', quantity: 1, category: 'primary', is_required: true, is_verified: false, display_order: 2 },
          { equipment_name: 'Edger', quantity: 1, category: 'primary', is_required: true, is_verified: false, display_order: 3 },
          { equipment_name: 'Backpack Blower', quantity: 1, category: 'primary', is_required: true, is_verified: false, display_order: 4 },
          { equipment_name: 'Safety Kit', quantity: 1, category: 'safety', is_required: true, is_verified: false, display_order: 5 },
          { equipment_name: 'Gas Can (5 gal)', quantity: 1, category: 'support', is_required: true, is_verified: false, display_order: 6 },
          { equipment_name: '2-Cycle Oil', quantity: 2, category: 'support', is_required: true, is_verified: false, display_order: 7 },
          { equipment_name: 'Trimmer Line', quantity: 1, category: 'materials', is_required: false, is_verified: false, display_order: 8 },
          { equipment_name: 'First Aid Kit', quantity: 1, category: 'safety', is_required: false, is_verified: false, display_order: 9 },
          { equipment_name: 'Water Cooler', quantity: 1, category: 'support', is_required: false, is_verified: false, display_order: 10 }
        ],
        '3': [
          { equipment_name: 'Commercial Mower (60")', quantity: 1, category: 'primary', is_required: true, is_verified: false, display_order: 1 },
          { equipment_name: 'Zero-Turn Mower', quantity: 1, category: 'primary', is_required: true, is_verified: false, display_order: 2 },
          { equipment_name: 'String Trimmer', quantity: 2, category: 'primary', is_required: true, is_verified: false, display_order: 3 },
          { equipment_name: 'Edger', quantity: 2, category: 'primary', is_required: true, is_verified: false, display_order: 4 },
          { equipment_name: 'Backpack Blower', quantity: 2, category: 'primary', is_required: true, is_verified: false, display_order: 5 },
          { equipment_name: 'Safety Cones', quantity: 6, category: 'safety', is_required: true, is_verified: false, display_order: 6 },
          { equipment_name: 'Team Safety Gear', quantity: 2, category: 'safety', is_required: true, is_verified: false, display_order: 7 },
          { equipment_name: 'Gas Can (5 gal)', quantity: 2, category: 'support', is_required: true, is_verified: false, display_order: 8 },
          { equipment_name: '2-Cycle Mix', quantity: 4, category: 'support', is_required: true, is_verified: false, display_order: 9 },
          { equipment_name: 'Trailer', quantity: 1, category: 'support', is_required: true, is_verified: false, display_order: 10 },
          { equipment_name: 'Hedge Trimmer', quantity: 1, category: 'primary', is_required: false, is_verified: false, display_order: 11 },
          { equipment_name: 'Mulch (bags)', quantity: 20, category: 'materials', is_required: false, is_verified: false, display_order: 12 }
        ]
      };

      return NextResponse.json({
        equipment: demoEquipment[jobId] || demoEquipment['1'],
        job_id: jobId
      });
    }

    // Get equipment list from database
    const { data: equipment, error } = await supabase
      .from('job_equipment_requirements')
      .select('*')
      .eq('job_id', jobId)
      .order('display_order', { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      equipment: equipment || [],
      job_id: jobId
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
    
    // Check if demo mode
    const isDemo = request.headers.get('x-is-demo') === 'true';
    
    if (isDemo) {
      // In demo mode, just return success
      return NextResponse.json({
        success: true,
        message: 'Equipment updated (demo mode)'
      });
    }

    const { equipment_name, updates } = body;

    if (!equipment_name) {
      return NextResponse.json(
        { error: 'Equipment name is required' },
        { status: 400 }
      );
    }

    // Update equipment item
    const { data, error } = await supabase
      .from('job_equipment_requirements')
      .update(updates)
      .eq('job_id', jobId)
      .eq('equipment_name', equipment_name)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      equipment: data
    });

  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const supabase = await createServerClient();
    const { jobId } = params;
    const body = await request.json();
    
    // Check if demo mode
    const isDemo = request.headers.get('x-is-demo') === 'true';
    const tenantId = request.headers.get('x-tenant-id') || '11111111-1111-1111-1111-111111111111';
    
    if (isDemo) {
      return NextResponse.json({
        success: true,
        message: 'Equipment added (demo mode)'
      });
    }

    const { equipment_name, quantity, category, is_required, display_order } = body;

    if (!equipment_name) {
      return NextResponse.json(
        { error: 'Equipment name is required' },
        { status: 400 }
      );
    }

    // Add new equipment item
    const { data, error } = await supabase
      .from('job_equipment_requirements')
      .insert({
        tenant_id: tenantId,
        job_id: jobId,
        equipment_name,
        quantity: quantity || 1,
        category: category || 'support',
        is_required: is_required ?? false,
        display_order: display_order || 999
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      equipment: data
    });

  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const supabase = await createServerClient();
    const { jobId } = params;
    const { searchParams } = new URL(request.url);
    const equipmentName = searchParams.get('equipment_name');
    
    // Check if demo mode
    const isDemo = request.headers.get('x-is-demo') === 'true';
    
    if (isDemo) {
      return NextResponse.json({
        success: true,
        message: 'Equipment removed (demo mode)'
      });
    }

    if (!equipmentName) {
      return NextResponse.json(
        { error: 'Equipment name is required' },
        { status: 400 }
      );
    }

    // Delete equipment item
    const { error } = await supabase
      .from('job_equipment_requirements')
      .delete()
      .eq('job_id', jobId)
      .eq('equipment_name', equipmentName);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Equipment item removed'
    });

  } catch (error) {
    return handleApiError(error);
  }
}