/**
 * AGENT DIRECTIVE BLOCK
 * file: /src/scheduling/repositories/schedule-event.repository.ts
 * phase: 4
 * domain: Scheduling
 * purpose: Repository for schedule event CRUD operations
 * spec_ref: .specify/features/003-scheduling-kits/data-model.md
 * complexity_budget: 300
 * state_machine: none
 * estimated_llm_cost: 0.02
 * offline_capability: REQUIRED
 * dependencies:
 *   internal:
 *     - /src/types/supabase.ts
 *   external:
 *     - @supabase/supabase-js
 * exports:
 *   - ScheduleEventRepository
 * voice_considerations:
 *   - Support voice notes on events
 *   - Simple status updates via voice
 * test_requirements:
 *   coverage: 90%
 *   test_file: /src/__tests__/scheduling/repositories/schedule-event.repository.test.ts
 * tasks:
 *   - Implement CRUD with day plan association
 *   - Support event sequencing and reordering
 *   - Handle job event counting for limits
 *   - Implement status transitions
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type ScheduleEvent = Database['public']['Tables']['schedule_events']['Row'];
type ScheduleEventInsert = Database['public']['Tables']['schedule_events']['Insert'];
type ScheduleEventUpdate = Database['public']['Tables']['schedule_events']['Update'];

export interface ScheduleEventFilters {
  day_plan_id?: string;
  event_type?: ScheduleEvent['event_type'];
  status?: ScheduleEvent['status'];
  job_id?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export class ScheduleEventRepository {
  constructor(private supabase: SupabaseClient<Database>) {}

  async findById(id: string): Promise<ScheduleEvent | null> {
    const { data, error } = await this.supabase
      .from('schedule_events')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async findAll(filters?: ScheduleEventFilters): Promise<ScheduleEvent[]> {
    let query = this.supabase.from('schedule_events').select('*');

    if (filters?.day_plan_id) {
      query = query.eq('day_plan_id', filters.day_plan_id);
    }

    if (filters?.event_type) {
      query = query.eq('event_type', filters.event_type);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.job_id) {
      query = query.eq('job_id', filters.job_id);
    }

    if (filters?.date_from && filters?.date_to) {
      query = query.gte('scheduled_start', filters.date_from)
                   .lte('scheduled_start', filters.date_to);
    }

    query = query.order('sequence_order', { ascending: true });

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async create(event: ScheduleEventInsert): Promise<ScheduleEvent> {
    const { data, error } = await this.supabase
      .from('schedule_events')
      .insert(event)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createMany(events: ScheduleEventInsert[]): Promise<ScheduleEvent[]> {
    const { data, error } = await this.supabase
      .from('schedule_events')
      .insert(events)
      .select()
      .order('sequence_order', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async update(id: string, updates: ScheduleEventUpdate): Promise<ScheduleEvent> {
    const { data, error } = await this.supabase
      .from('schedule_events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('schedule_events')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }

  async findByDayPlan(dayPlanId: string): Promise<ScheduleEvent[]> {
    const { data, error } = await this.supabase
      .from('schedule_events')
      .select('*')
      .eq('day_plan_id', dayPlanId)
      .order('sequence_order', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async countJobEvents(dayPlanId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('schedule_events')
      .select('id', { count: 'exact', head: true })
      .eq('day_plan_id', dayPlanId)
      .eq('event_type', 'job')
      .neq('status', 'cancelled');

    if (error) throw error;
    return count || 0;
  }

  async countByDayPlanAndType(dayPlanId: string, eventType: ScheduleEvent['event_type']): Promise<number> {
    const { count, error } = await this.supabase
      .from('schedule_events')
      .select('id', { count: 'exact', head: true })
      .eq('day_plan_id', dayPlanId)
      .eq('event_type', eventType)
      .neq('status', 'cancelled');

    if (error) throw error;
    return count || 0;
  }

  async updateStatus(id: string, status: ScheduleEvent['status']): Promise<ScheduleEvent> {
    return this.update(id, { status });
  }

  async startEvent(id: string): Promise<ScheduleEvent> {
    return this.update(id, {
      status: 'in_progress',
      actual_start: new Date().toISOString()
    });
  }

  async completeEvent(id: string): Promise<ScheduleEvent> {
    return this.update(id, {
      status: 'completed',
      actual_end: new Date().toISOString()
    });
  }

  async reorderEvents(dayPlanId: string, eventOrders: { id: string; sequence_order: number }[]): Promise<ScheduleEvent[]> {
    const updates = eventOrders.map(({ id, sequence_order }) =>
      this.update(id, { sequence_order })
    );

    await Promise.all(updates);
    return this.findByDayPlan(dayPlanId);
  }

  async findActiveEvent(dayPlanId: string): Promise<ScheduleEvent | null> {
    const { data, error } = await this.supabase
      .from('schedule_events')
      .select('*')
      .eq('day_plan_id', dayPlanId)
      .eq('status', 'in_progress')
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async findNextEvent(dayPlanId: string, currentSequence: number): Promise<ScheduleEvent | null> {
    const { data, error } = await this.supabase
      .from('schedule_events')
      .select('*')
      .eq('day_plan_id', dayPlanId)
      .eq('status', 'pending')
      .gt('sequence_order', currentSequence)
      .order('sequence_order', { ascending: true })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  }

  async addVoiceNote(id: string, voiceNote: string): Promise<ScheduleEvent> {
    const event = await this.findById(id);
    if (!event) throw new Error('Event not found');

    const existingNotes = event.voice_notes || '';
    const separator = existingNotes ? '\n---\n' : '';
    const timestamp = new Date().toISOString();
    const newNote = `[${timestamp}] ${voiceNote}`;

    return this.update(id, {
      voice_notes: existingNotes + separator + newNote
    });
  }

  async findByJobId(jobId: string): Promise<ScheduleEvent[]> {
    const { data, error } = await this.supabase
      .from('schedule_events')
      .select('*')
      .eq('job_id', jobId)
      .order('scheduled_start', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async deleteByDayPlan(dayPlanId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('schedule_events')
      .delete()
      .eq('day_plan_id', dayPlanId);

    if (error) throw error;
    return true;
  }
}