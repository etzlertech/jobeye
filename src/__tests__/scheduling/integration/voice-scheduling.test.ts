/**
 * @file /src/__tests__/scheduling/integration/voice-scheduling.test.ts
 * @purpose Integration test: Voice-driven scheduling
 * @coverage_target ≥90%
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

// These will fail with "Cannot find module" - as expected for TDD
import { VoiceCommandService } from '@/scheduling/voice/voice-command.service';
import { SchedulingIntentProcessor } from '@/scheduling/voice/scheduling-intent-processor';
import { DayPlanService } from '@/scheduling/services/day-plan.service';
import { SchedulingService } from '@/scheduling/services/scheduling.service';
import type { Database } from '@/types/database';

describe('Voice-Driven Scheduling Integration', () => {
  let supabase: SupabaseClient<Database>;
  let voiceCommandService: VoiceCommandService;
  let intentProcessor: SchedulingIntentProcessor;
  let dayPlanService: DayPlanService;
  let schedulingService: SchedulingService;
  
  const testCompanyId = '00000000-0000-4000-a000-000000000003';
  const testUserId = '123e4567-e89b-12d3-a456-426614174000';
  const voiceSessionId = 'voice-session-test-123';

  beforeEach(() => {
    supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false },
        global: {
          headers: {
            'x-company-id': testCompanyId,
            'x-voice-session-id': voiceSessionId
          }
        }
      }
    );

    // Initialize services
    dayPlanService = new DayPlanService(/* dependencies */);
    schedulingService = new SchedulingService(/* dependencies */);
    intentProcessor = new SchedulingIntentProcessor(dayPlanService, schedulingService);
    voiceCommandService = new VoiceCommandService(intentProcessor, supabase);
  });

  afterEach(async () => {
    // Cleanup
    await supabase
      .from('voice_sessions')
      .delete()
      .eq('id', voiceSessionId);
  });

  it('should schedule a job via voice command', async () => {
    const voiceCommand = {
      transcript: "Schedule a small yard service for tomorrow at 2PM",
      session_id: voiceSessionId,
      user_id: testUserId,
      confidence: 0.95
    };

    const result = await voiceCommandService.processCommand(voiceCommand);

    expect(result).toMatchObject({
      intent: 'schedule_job',
      entities: {
        job_type: 'small yard service',
        date: expect.stringMatching(/\d{4}-\d{2}-\d{2}/),
        time: '14:00:00'
      },
      action_taken: {
        type: 'job_scheduled',
        job_id: expect.any(String),
        schedule_event_id: expect.any(String),
        day_plan_id: expect.any(String)
      },
      response: expect.stringContaining('scheduled')
    });

    // Verify job was created
    const { data: events } = await supabase
      .from('schedule_events')
      .select('*')
      .eq('id', result.action_taken.schedule_event_id)
      .single();

    expect(events).toMatchObject({
      event_type: 'job',
      scheduled_start: expect.stringContaining('14:00'),
      voice_notes: 'small yard service'
    });
  });

  it('should handle "What\'s next?" voice query', async () => {
    // Setup: Create a day plan with jobs
    const dayPlan = await dayPlanService.createDayPlan({
      user_id: testUserId,
      plan_date: new Date().toISOString().split('T')[0]
    });

    await schedulingService.scheduleEvent({
      day_plan_id: dayPlan.id,
      event_type: 'job',
      job_id: 'job-001',
      sequence_order: 1,
      scheduled_start: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      scheduled_duration_minutes: 60,
      address: { street: '123 Main St' }
    });

    const voiceCommand = {
      transcript: "What's my next job?",
      session_id: voiceSessionId,
      user_id: testUserId,
      confidence: 0.92
    };

    const result = await voiceCommandService.processCommand(voiceCommand);

    expect(result).toMatchObject({
      intent: 'query_schedule',
      query_type: 'next_task',
      response: expect.stringContaining('123 Main St'),
      data: {
        next_event: expect.objectContaining({
          event_type: 'job',
          address: expect.objectContaining({ street: '123 Main St' })
        })
      }
    });
  });

  it('should assign crew via voice command', async () => {
    // Setup: Create a scheduled job
    const dayPlan = await dayPlanService.createDayPlan({
      user_id: testUserId,
      plan_date: '2024-01-15'
    });

    const event = await schedulingService.scheduleEvent({
      day_plan_id: dayPlan.id,
      event_type: 'job',
      job_id: 'job-smith-property',
      scheduled_start: '2024-01-15T10:00:00Z',
      scheduled_duration_minutes: 90
    });

    const voiceCommand = {
      transcript: "Assign John to the Smith property job",
      session_id: voiceSessionId,
      user_id: testUserId,
      confidence: 0.88
    };

    const result = await voiceCommandService.processCommand(voiceCommand);

    expect(result).toMatchObject({
      intent: 'modify_schedule',
      modification_type: 'crew_assignment',
      entities: {
        technician_name: 'John',
        job_reference: 'Smith property'
      },
      action_taken: {
        type: 'crew_assigned',
        assignment_id: expect.any(String),
        technician_id: expect.any(String)
      }
    });

    // Verify assignment was created
    const { data: assignment } = await supabase
      .from('crew_assignments')
      .select('*')
      .eq('schedule_event_id', event.id)
      .single();

    expect(assignment).toMatchObject({
      role: 'lead',
      voice_confirmed: true
    });
  });

  it('should handle kit selection via voice', async () => {
    const voiceCommand = {
      transcript: "Switch to winter kit variant",
      session_id: voiceSessionId,
      user_id: testUserId,
      confidence: 0.91,
      context: {
        current_job_id: 'job-001',
        current_kit_id: 'kit-irrigation-start'
      }
    };

    const result = await voiceCommandService.processCommand(voiceCommand);

    expect(result).toMatchObject({
      intent: 'kit_management',
      action: 'switch_variant',
      entities: {
        variant: 'winter'
      },
      action_taken: {
        type: 'variant_selected',
        kit_id: 'kit-irrigation-start',
        variant_id: expect.any(String)
      },
      response: expect.stringContaining('winter kit variant')
    });
  });

  it('should reschedule job via voice', async () => {
    // Setup: Create a scheduled job
    const event = await schedulingService.scheduleEvent({
      day_plan_id: 'existing-plan-id',
      event_type: 'job',
      job_id: 'job-current',
      scheduled_start: '2024-01-15T10:00:00Z',
      scheduled_duration_minutes: 60
    });

    const voiceCommand = {
      transcript: "Reschedule current job to next Tuesday",
      session_id: voiceSessionId,
      user_id: testUserId,
      confidence: 0.93,
      context: {
        current_event_id: event.id
      }
    };

    const result = await voiceCommandService.processCommand(voiceCommand);

    expect(result).toMatchObject({
      intent: 'modify_schedule',
      modification_type: 'reschedule',
      entities: {
        new_date: expect.stringMatching(/2024-01-\d{2}/), // Next Tuesday
        job_reference: 'current'
      },
      action_taken: {
        type: 'job_rescheduled',
        old_event_id: event.id,
        new_event_id: expect.any(String),
        notification_sent: true
      }
    });
  });

  it('should show today\'s route via voice query', async () => {
    // Setup: Create day plan with multiple jobs
    const dayPlan = await dayPlanService.createDayPlan({
      user_id: testUserId,
      plan_date: new Date().toISOString().split('T')[0],
      route_data: {
        optimized: true,
        stops: [
          { address: '123 Main St', sequence: 1 },
          { address: '456 Oak Ave', sequence: 2 },
          { address: '789 Pine Rd', sequence: 3 }
        ],
        total_distance_miles: 12.5,
        estimated_duration_minutes: 180
      }
    });

    const voiceCommand = {
      transcript: "Show me today's route",
      session_id: voiceSessionId,
      user_id: testUserId,
      confidence: 0.89
    };

    const result = await voiceCommandService.processCommand(voiceCommand);

    expect(result).toMatchObject({
      intent: 'query_schedule',
      query_type: 'day_overview',
      response: expect.stringContaining('3 stops'),
      data: {
        day_plan: expect.objectContaining({
          total_distance_miles: 12.5,
          estimated_duration_minutes: 180,
          stop_count: 3
        }),
        summary: expect.stringContaining('12.5 miles')
      }
    });
  });

  it('should handle ambiguous voice commands with confirmation', async () => {
    const voiceCommand = {
      transcript: "Schedule lawn service tomorrow",
      session_id: voiceSessionId,
      user_id: testUserId,
      confidence: 0.78 // Lower confidence
    };

    const result = await voiceCommandService.processCommand(voiceCommand);

    expect(result).toMatchObject({
      intent: 'schedule_job',
      requires_confirmation: true,
      clarification_needed: 'time',
      options: expect.arrayContaining([
        { time: '09:00', label: 'Morning (9 AM)' },
        { time: '14:00', label: 'Afternoon (2 PM)' }
      ]),
      response: expect.stringContaining('What time'),
      pending_action: {
        type: 'schedule_job',
        job_type: 'lawn service',
        date: expect.any(String)
      }
    });
  });
});