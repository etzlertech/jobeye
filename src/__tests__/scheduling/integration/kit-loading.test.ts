/**
 * @file /src/__tests__/scheduling/integration/kit-loading.test.ts
 * @purpose Integration test: Kit loading and verification
 * @coverage_target ≥90%
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

// These will fail with "Cannot find module" - as expected for TDD
import { KitRepository } from '@/scheduling/repositories/kit.repository';
import { JobKitRepository } from '@/scheduling/repositories/job-kit.repository';
import { KitService } from '@/scheduling/services/kit.service';
import { JobService } from '@/domains/job/services/job.service';
import type { Database } from '@/types/database';

// TODO: Container domain not implemented. Provide stub so test compiles for TDD.
class ContainerService {
  constructor(_supabase: SupabaseClient) {}
  async createContainer(_input: any) {
    throw new Error('ContainerService not implemented');
  }
}

describe('Kit Loading and Verification Integration', () => {
  let supabase: SupabaseClient;
  let kitRepo: KitRepository;
  let jobKitRepo: JobKitRepository;
  let kitService: KitService;
  let jobService: JobService;
  let containerService: ContainerService;
  
  const testCompanyId = '00000000-0000-4000-a000-000000000003';
  const testTechnicianId = '123e4567-e89b-12d3-a456-426614174000';
  const testJobId = 'job-test-001';
  const testContainerId = 'container-001';

  beforeEach(async () => {
    supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false },
        global: {
          headers: {
            'x-company-id': testCompanyId
          }
        }
      }
    );

    // Initialize services
    kitRepo = new KitRepository(supabase);
    jobKitRepo = new JobKitRepository(supabase);
    kitService = new KitService(kitRepo, jobKitRepo, supabase);
    jobService = new JobService(supabase);
    containerService = new ContainerService(supabase);

    // Create test job
    await jobService.createJob({
      id: testJobId,
      tenant_id: testCompanyId,
      customer_id: 'customer-001',
      property_id: 'property-001',
      job_type: 'lawn_maintenance',
      status: 'scheduled',
      scheduled_start: '2024-01-15T10:00:00Z'
    });
  });

  afterEach(async () => {
    // Cleanup
    await supabase
      .from('jobs')
      .delete()
      .eq('id', testJobId);
  });

  it('should load kit and verify all items are present', async () => {
    // Step 1: Create a kit with items
    const kit = await kitService.createKit({
      kit_code: 'LAWN-BASIC',
      name: 'Basic Lawn Care Kit',
      category: 'lawn_care',
      items: [
        {
          item_type: 'equipment',
          equipment_id: 'mower-001',
          quantity: 1,
          is_required: true
        },
        {
          item_type: 'equipment', 
          equipment_id: 'trimmer-001',
          quantity: 1,
          is_required: true
        },
        {
          item_type: 'material',
          material_id: 'gas-001',
          quantity: 5,
          unit: 'gallons',
          is_required: false
        }
      ]
    });

    // Step 2: Assign kit to job
    const assignment = await kitService.assignKitToJob({
      job_id: testJobId,
      kit_id: kit.id,
      assigned_by: testTechnicianId,
      container_id: testContainerId
    });

    expect(assignment).toMatchObject({
      job_id: testJobId,
      kit_id: kit.id,
      assigned_at: expect.any(String),
      assigned_by: testTechnicianId
    });

    // Step 3: Load kit checklist
    const checklist = await kitService.getKitChecklist(testJobId, kit.id);
    
    expect(checklist).toMatchObject({
      kit_id: kit.id,
      kit_name: 'Basic Lawn Care Kit',
      items: expect.arrayContaining([
        expect.objectContaining({
          item_id: 'mower-001',
          item_type: 'equipment',
          description: expect.any(String),
          quantity_required: 1,
          is_required: true,
          check_status: 'pending'
        })
      ]),
      container_location: expect.objectContaining({
        container_id: testContainerId,
        location: expect.any(String)
      })
    });

    // Step 4: Verify kit with all items present
    const verification = await kitService.verifyKit({
      job_id: testJobId,
      kit_id: kit.id,
      verified_by: testTechnicianId,
      verification_method: 'manual',
      checklist: [
        {
          item_id: 'mower-001',
          status: 'present',
          quantity_verified: 1
        },
        {
          item_id: 'trimmer-001',
          status: 'present',
          quantity_verified: 1
        },
        {
          item_id: 'gas-001',
          status: 'present',
          quantity_verified: 5
        }
      ],
      photo_ids: ['photo-001', 'photo-002'],
      notes: 'All equipment checked and functional'
    });

    expect(verification).toMatchObject({
      job_kit_id: assignment.id,
      verified_at: expect.any(String),
      verified_by: testTechnicianId,
      verification_status: 'complete',
      all_required_present: true,
      has_overrides: false
    });
  });

  it('should handle seasonal kit variant selection', async () => {
    // Create kit with seasonal variants
    const kit = await kitService.createKit({
      kit_code: 'IRRIGATION-START',
      name: 'Irrigation Startup Kit',
      category: 'irrigation',
      items: [
        {
          item_type: 'equipment',
          equipment_id: 'pressure-gauge-001',
          quantity: 1,
          is_required: true
        }
      ],
      variants: [
        {
          variant_code: 'WINTER',
          variant_type: 'seasonal',
          conditions: {
            season: 'winter',
            temperature_below: 40
          },
          item_modifications: {
            additions: [
              {
                item_type: 'material',
                material_id: 'antifreeze-001',
                quantity: 2,
                unit: 'bottles'
              }
            ]
          },
          valid_from: '2024-12-01',
          valid_until: '2025-02-28'
        },
        {
          variant_code: 'SUMMER',
          variant_type: 'seasonal',
          conditions: {
            season: 'summer',
            temperature_above: 80
          },
          item_modifications: {
            additions: [
              {
                item_type: 'material',
                material_id: 'coolant-001',
                quantity: 1,
                unit: 'bottle'
              }
            ]
          },
          valid_from: '2024-06-01',
          valid_until: '2024-08-31'
        }
      ]
    });

    // Assign kit with automatic variant selection based on current date/conditions
    const assignment = await kitService.assignKitToJob({
      job_id: testJobId,
      kit_id: kit.id,
      assigned_by: testTechnicianId,
      environmental_conditions: {
        date: '2024-01-15',
        temperature: 30,
        weather: 'cold'
      }
    });

    // Should select winter variant
    expect(assignment.variant_id).toBeDefined();
    
    const checklist = await kitService.getKitChecklist(testJobId, kit.id);
    
    // Should include base items plus winter additions
    expect(checklist.items).toHaveLength(2);
    expect(checklist.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          item_id: 'pressure-gauge-001'
        }),
        expect.objectContaining({
          item_id: 'antifreeze-001',
          quantity_required: 2
        })
      ])
    );
    expect(checklist.variant_applied).toBe('WINTER');
  });

  it('should integrate with container tracking', async () => {
    // Create containers in truck
    const truck = await containerService.createContainer({
      tenant_id: testCompanyId,
      container_type: 'truck',
      identifier: 'TRUCK-001',
      location: 'Field',
      status: 'active'
    });

    const toolbox = await containerService.createContainer({
      tenant_id: testCompanyId,
      container_type: 'toolbox',
      identifier: 'TOOLBOX-A',
      parent_container_id: truck.id,
      location: 'TRUCK-001',
      status: 'active'
    });

    // Create kit and assign to container
    const kit = await kitService.createKit({
      kit_code: 'ELECTRIC-BASIC',
      name: 'Basic Electrical Kit',
      category: 'electrical',
      default_container_id: toolbox.id,
      items: [
        {
          item_type: 'tool',
          tool_id: 'multimeter-001',
          quantity: 1,
          is_required: true
        }
      ]
    });

    // Assign kit to job
    const assignment = await kitService.assignKitToJob({
      job_id: testJobId,
      kit_id: kit.id,
      assigned_by: testTechnicianId
      // Should use default container
    });

    expect(assignment.container_id).toBe(toolbox.id);

    // Get kit location through container hierarchy
    const kitLocation = await kitService.getKitLocation(kit.id);
    
    expect(kitLocation).toMatchObject({
      kit_id: kit.id,
      container: {
        id: toolbox.id,
        identifier: 'TOOLBOX-A',
        type: 'toolbox'
      },
      parent_containers: [
        {
          id: truck.id,
          identifier: 'TRUCK-001',
          type: 'truck'
        }
      ],
      location_path: 'TRUCK-001 > TOOLBOX-A'
    });
  });

  it('should track kit usage analytics', async () => {
    const kit = await kitService.createKit({
      kit_code: 'PLUMBING-BASIC',
      name: 'Basic Plumbing Kit',
      category: 'plumbing',
      typical_job_types: ['plumbing_repair', 'fixture_install']
    });

    // Assign and verify kit multiple times
    for (let i = 0; i < 3; i++) {
      const jobId = `job-plumb-${i}`;
      await jobService.createJob({
        id: jobId,
        tenant_id: testCompanyId,
        job_type: 'plumbing_repair',
        scheduled_start: new Date(Date.now() + i * 86400000).toISOString()
      });

      const assignment = await kitService.assignKitToJob({
        job_id: jobId,
        kit_id: kit.id,
        assigned_by: testTechnicianId
      });

      await kitService.verifyKit({
        job_id: jobId,
        kit_id: kit.id,
        verified_by: testTechnicianId,
        verification_method: 'manual',
        checklist: []
      });
    }

    // Get kit usage analytics
    const analytics = await kitService.getKitAnalytics(kit.id, {
      start_date: new Date(Date.now() - 30 * 86400000).toISOString(),
      end_date: new Date().toISOString()
    });

    expect(analytics).toMatchObject({
      kit_id: kit.id,
      usage_count: 3,
      verification_rate: 1.0, // 100%
      typical_jobs: expect.arrayContaining(['plumbing_repair']),
      average_verification_time_minutes: expect.any(Number),
      missing_item_frequency: {}
    });
  });
});
