/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/api/crew/jobs/[jobId]/equipment/route.ts
 * phase: 3
 * domain: crew
 * purpose: API endpoint for job equipment management using jobs.checklist_items
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
 *   'Get equipment list from job checklist_items',
 *   'Update equipment checklist items',
 *   'Support demo mode'
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { handleApiError } from '@/core/errors/error-handler';

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
    
    // Check if demo mode
    const isDemo = request.headers.get('x-is-demo') === 'true';

    if (isDemo) {
      // Return varied mock equipment for demo jobs
      const demoEquipment: Record<string, EquipmentItem[]> = {
        '1': [
          { name: 'Walk-Behind Mower', checked: false, category: 'primary', icon: '🚜' },
          { name: 'String Trimmer', checked: false, category: 'primary', icon: '✂️' },
          { name: 'Leaf Blower', checked: false, category: 'primary', icon: '💨' },
          { name: 'Safety Glasses', checked: false, category: 'safety', icon: '🥽' },
          { name: 'Hearing Protection', checked: false, category: 'safety', icon: '🎧' },
          { name: 'Gas Can (2 gal)', checked: false, category: 'support', icon: '⛽' },
          { name: 'Hand Tools Bag', checked: false, category: 'support', icon: '🧰' },
          { name: 'Trash Bags', checked: false, category: 'materials', quantity: 10, icon: '🗑️' }
        ],
        '2': [
          { name: 'Zero-Turn Mower', checked: false, category: 'primary', icon: '🚜' },
          { name: 'String Trimmer', checked: false, category: 'primary', icon: '✂️' },
          { name: 'Edger', checked: false, category: 'primary', icon: '🔪' },
          { name: 'Backpack Blower', checked: false, category: 'primary', icon: '🎒' },
          { name: 'Safety Kit', checked: false, category: 'safety', icon: '🦺' },
          { name: 'Gas Can (5 gal)', checked: false, category: 'support', icon: '⛽' },
          { name: '2-Cycle Oil', checked: false, category: 'support', quantity: 2, icon: '🛢️' },
          { name: 'Trimmer Line', checked: false, category: 'materials', icon: '🧵' },
          { name: 'First Aid Kit', checked: false, category: 'safety', icon: '🏥' },
          { name: 'Water Cooler', checked: false, category: 'support', icon: '💧' }
        ],
        '3': [
          { name: 'Commercial Mower (60")', checked: false, category: 'primary', icon: '🚜' },
          { name: 'Zero-Turn Mower', checked: false, category: 'primary', icon: '🚜' },
          { name: 'String Trimmer', checked: false, category: 'primary', quantity: 2, icon: '✂️' },
          { name: 'Edger', checked: false, category: 'primary', quantity: 2, icon: '🔪' },
          { name: 'Backpack Blower', checked: false, category: 'primary', quantity: 2, icon: '🎒' },
          { name: 'Safety Cones', checked: false, category: 'safety', quantity: 6, icon: '🚧' },
          { name: 'Team Safety Gear', checked: false, category: 'safety', quantity: 2, icon: '🦺' },
          { name: 'Gas Can (5 gal)', checked: false, category: 'support', quantity: 2, icon: '⛽' },
          { name: '2-Cycle Mix', checked: false, category: 'support', quantity: 4, icon: '🛢️' },
          { name: 'Trailer', checked: false, category: 'support', icon: '🚛' },
          { name: 'Hedge Trimmer', checked: false, category: 'primary', icon: '✂️' },
          { name: 'Mulch (bags)', checked: false, category: 'materials', quantity: 20, icon: '🌿' }
        ]
      };

      return NextResponse.json({
        equipment: demoEquipment[jobId] || demoEquipment['1'],
        job_id: jobId
      });
    }

    // Get job with checklist_items
    const { data: job, error } = await supabase
      .from('jobs')
      .select('id, checklist_items')
      .eq('id', jobId)
      .single();

    if (error) throw error;

    // checklist_items is a JSONB array of equipment items
    const equipment = job?.checklist_items || [];

    return NextResponse.json({
      equipment: equipment,
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

    const { equipment } = body;

    if (!Array.isArray(equipment)) {
      return NextResponse.json(
        { error: 'Equipment array is required' },
        { status: 400 }
      );
    }

    // Update the job's checklist_items
    const { data, error } = await supabase
      .from('jobs')
      .update({ checklist_items: equipment })
      .eq('id', jobId)
      .select('checklist_items')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      equipment: data.checklist_items
    });

  } catch (error) {
    return handleApiError(error);
  }
}

// Note: POST and DELETE are not needed since we update the entire checklist array with PUT