/**
 * @file /src/__tests__/scheduling/integration/kit-override-flow.test.ts
 * @purpose Integration test: Missing kit item override flow
 * @coverage_target ≥90%
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

// These will fail with "Cannot find module" - as expected for TDD
import { KitService } from '@/scheduling/services/kit.service';
import { KitOverrideService } from '@/scheduling/services/kit-override.service';
import { NotificationService } from '@/scheduling/services/notification.service';
import { AuditService } from '@/core/services/audit.service';
import type { Database } from '@/types/database';

// Mock Twilio for testing
jest.mock('twilio');

describe('Kit Override Flow Integration', () => {
  let supabase: SupabaseClient<Database>;
  let kitService: KitService;
  let overrideService: KitOverrideService;
  let notificationService: NotificationService;
  let auditService: AuditService;
  
  const testCompanyId = '00000000-0000-4000-a000-000000000003';
  const testTechnicianId = '123e4567-e89b-12d3-a456-426614174000';
  const testSupervisorId = '456e4567-e89b-12d3-a456-426614174000';
  const testJobId = 'job-test-001';

  beforeEach(() => {
    supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false },
        global: {
          headers: { 'x-company-id': testCompanyId }
        }
      }
    );

    // Initialize services
    auditService = new AuditService(supabase);
    notificationService = new NotificationService({
      twilioClient: jest.mocked(require('twilio').Twilio)(),
      supabase
    });
    overrideService = new KitOverrideService(supabase, notificationService, auditService);
    kitService = new KitService(supabase, overrideService);

    // Setup supervisor preferences
    jest.spyOn(notificationService, 'getSupervisorPreferences').mockResolvedValue({
      user_id: testSupervisorId,
      notification_methods: ['sms', 'push', 'call'],
      phone_number: '+1234567890',
      push_token: 'push-token-123',
      quiet_hours: { start: '22:00', end: '07:00' }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should handle missing required item with supervisor notification', async () => {
    // Create kit with required items
    const kit = await kitService.createKit({
      kit_code: 'LAWN-PRO',
      name: 'Professional Lawn Kit',
      category: 'lawn_care',
      items: [
        {
          item_type: 'equipment',
          equipment_id: 'mower-pro-001',
          quantity: 1,
          is_required: true
        },
        {
          item_type: 'equipment',
          equipment_id: 'edger-001',
          quantity: 1,
          is_required: true
        }
      ]
    });

    // Assign kit to job
    await kitService.assignKitToJob({
      job_id: testJobId,
      kit_id: kit.id,
      assigned_by: testTechnicianId
    });

    // Mock notification delivery
    const notificationSpy = jest.spyOn(notificationService, 'sendNotification')
      .mockResolvedValue({
        id: 'notif-001',
        method: 'sms',
        status: 'delivered',
        delivered_at: new Date().toISOString()
      });

    // Attempt verification with missing required item
    const verification = await kitService.verifyKit({
      job_id: testJobId,
      kit_id: kit.id,
      verified_by: testTechnicianId,
      verification_method: 'manual',
      checklist: [
        {
          item_id: 'mower-pro-001',
          status: 'present',
          quantity_verified: 1
        },
        {
          item_id: 'edger-001',
          status: 'missing',
          quantity_verified: 0,
          override_reason: 'Equipment broken, proceeding with trimmer instead'
        }
      ],
      override_missing: true,
      supervisor_id: testSupervisorId
    });

    // Should create override
    expect(verification).toMatchObject({
      verification_status: 'partial',
      has_overrides: true,
      missing_items: ['edger-001'],
      override_log_id: expect.any(String)
    });

    // Verify notification was sent
    expect(notificationSpy).toHaveBeenCalledWith({
      recipient_id: testSupervisorId,
      type: 'kit_override',
      priority: 'high',
      message: expect.stringContaining('Tech 123e4567'),
      message: expect.stringContaining('edger-001'),
      message: expect.stringContaining('Equipment broken'),
      data: {
        job_id: testJobId,
        kit_id: kit.id,
        item_id: 'edger-001',
        technician_id: testTechnicianId
      }
    });

    // Verify override record was created
    const { data: override } = await supabase
      .from('kit_override_logs')
      .select('*')
      .eq('id', verification.override_log_id!)
      .single();

    expect(override).toMatchObject({
      job_id: testJobId,
      kit_id: kit.id,
      item_id: 'edger-001',
      technician_id: testTechnicianId,
      override_reason: 'Equipment broken, proceeding with trimmer instead',
      supervisor_notified_at: expect.any(String),
      notification_method: 'sms',
      notification_status: 'delivered'
    });

    // Verify audit trail
    const { data: auditLog } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entity_type', 'kit_override')
      .eq('entity_id', override.id)
      .single();

    expect(auditLog).toMatchObject({
      action: 'kit_override_created',
      actor_id: testTechnicianId,
      metadata: expect.objectContaining({
        job_id: testJobId,
        missing_item: 'edger-001',
        notification_sent: true
      })
    });
  });

  it('should handle notification delivery with fallback chain', async () => {
    const kit = await kitService.createKit({
      kit_code: 'CRITICAL-KIT',
      name: 'Critical Equipment Kit',
      items: [{
        item_type: 'equipment',
        equipment_id: 'critical-001',
        is_required: true
      }]
    });

    await kitService.assignKitToJob({
      job_id: testJobId,
      kit_id: kit.id,
      assigned_by: testTechnicianId
    });

    // Mock notification attempts - SMS fails, Push succeeds
    const notificationSpy = jest.spyOn(notificationService, 'sendNotification')
      .mockImplementation(async (params) => {
        if (params.method === 'sms') {
          throw new Error('SMS delivery failed');
        }
        return {
          id: 'notif-002',
          method: 'push',
          status: 'delivered',
          delivered_at: new Date().toISOString()
        };
      });

    const verification = await kitService.verifyKit({
      job_id: testJobId,
      kit_id: kit.id,
      verified_by: testTechnicianId,
      verification_method: 'manual',
      checklist: [{
        item_id: 'critical-001',
        status: 'missing',
        override_reason: 'Critical equipment failure'
      }],
      override_missing: true,
      supervisor_id: testSupervisorId
    });

    // Should have tried SMS first, then Push
    expect(notificationSpy).toHaveBeenCalledTimes(2);
    
    // Verify override shows successful notification via push
    const { data: override } = await supabase
      .from('kit_override_logs')
      .select('*')
      .eq('id', verification.override_log_id!)
      .single();

    expect(override).toMatchObject({
      notification_method: 'push',
      notification_status: 'delivered',
      notification_attempts: expect.arrayContaining([
        expect.objectContaining({
          method: 'sms',
          status: 'failed',
          error: 'SMS delivery failed'
        }),
        expect.objectContaining({
          method: 'push',
          status: 'delivered'
        })
      ])
    });
  });

  it('should enforce 30-second SLA for notifications', async () => {
    const startTime = Date.now();

    const kit = await kitService.createKit({
      kit_code: 'TIME-CRITICAL',
      name: 'Time Critical Kit',
      items: [{
        item_type: 'equipment',
        equipment_id: 'time-critical-001',
        is_required: true
      }]
    });

    await kitService.assignKitToJob({
      job_id: testJobId,
      kit_id: kit.id,
      assigned_by: testTechnicianId
    });

    // Mock immediate notification delivery
    jest.spyOn(notificationService, 'sendNotification')
      .mockResolvedValue({
        id: 'notif-003',
        method: 'sms',
        status: 'delivered',
        delivered_at: new Date(startTime + 5000).toISOString() // 5 seconds
      });

    const verification = await kitService.verifyKit({
      job_id: testJobId,
      kit_id: kit.id,
      verified_by: testTechnicianId,
      verification_method: 'manual',
      checklist: [{
        item_id: 'time-critical-001',
        status: 'missing',
        override_reason: 'Urgent - equipment unavailable'
      }],
      override_missing: true,
      supervisor_id: testSupervisorId,
      priority: 'urgent'
    });

    const endTime = Date.now();
    const totalTime = (endTime - startTime) / 1000;

    // Entire flow should complete within 30 seconds
    expect(totalTime).toBeLessThan(30);

    // Verify SLA tracking
    const { data: override } = await supabase
      .from('kit_override_logs')
      .select('*')
      .eq('id', verification.override_log_id!)
      .single();

    expect(override).toMatchObject({
      sla_seconds: 30,
      sla_met: true,
      notification_latency_ms: expect.any(Number)
    });

    expect(override.notification_latency_ms).toBeLessThan(30000);
  });

  it('should handle voice-initiated override', async () => {
    const kit = await kitService.createKit({
      kit_code: 'VOICE-KIT',
      name: 'Voice Test Kit',
      items: [{
        item_type: 'equipment',
        equipment_id: 'voice-equip-001',
        is_required: false
      }]
    });

    await kitService.assignKitToJob({
      job_id: testJobId,
      kit_id: kit.id,
      assigned_by: testTechnicianId
    });

    // Create override via voice command
    const voiceOverride = await overrideService.createOverrideFromVoice({
      job_id: testJobId,
      kit_id: kit.id,
      voice_session_id: 'voice-123',
      technician_id: testTechnicianId,
      transcript: "Override missing item trimmer not available",
      intent_data: {
        item_reference: 'trimmer',
        reason: 'not available'
      },
      confidence: 0.92
    });

    expect(voiceOverride).toMatchObject({
      override_reason: expect.stringContaining('not available'),
      voice_initiated: true,
      metadata: expect.objectContaining({
        voice_session_id: 'voice-123',
        confidence: 0.92
      })
    });

    // Verify notification includes voice context
    const notificationSpy = jest.spyOn(notificationService, 'sendNotification');
    expect(notificationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Voice command:')
      })
    );
  });

  it('should track override patterns for analytics', async () => {
    // Create multiple overrides for same item
    const kit = await kitService.createKit({
      kit_code: 'PATTERN-KIT',
      name: 'Pattern Analysis Kit',
      items: [{
        item_type: 'equipment',
        equipment_id: 'problem-equip-001',
        is_required: true
      }]
    });

    // Create 3 overrides for same equipment
    for (let i = 0; i < 3; i++) {
      const jobId = `job-pattern-${i}`;
      
      await kitService.assignKitToJob({
        job_id: jobId,
        kit_id: kit.id,
        assigned_by: testTechnicianId
      });

      await kitService.verifyKit({
        job_id: jobId,
        kit_id: kit.id,
        verified_by: testTechnicianId,
        checklist: [{
          item_id: 'problem-equip-001',
          status: 'missing',
          override_reason: 'Equipment failure'
        }],
        override_missing: true,
        supervisor_id: testSupervisorId
      });
    }

    // Get override analytics
    const analytics = await overrideService.getOverrideAnalytics({
      kit_id: kit.id,
      start_date: new Date(Date.now() - 30 * 86400000).toISOString(),
      end_date: new Date().toISOString()
    });

    expect(analytics).toMatchObject({
      total_overrides: 3,
      by_item: {
        'problem-equip-001': {
          count: 3,
          reasons: expect.arrayContaining(['Equipment failure']),
          trend: 'increasing'
        }
      },
      by_technician: {
        [testTechnicianId]: 3
      },
      frequent_issues: [
        {
          item_id: 'problem-equip-001',
          frequency: 3,
          common_reason: 'Equipment failure',
          recommendation: 'Review equipment maintenance schedule'
        }
      ]
    });
  });
});