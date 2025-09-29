/**
 * AGENT DIRECTIVE BLOCK
 * file: src/scheduling/voice/day-plan-queries.ts
 * phase: 3
 * domain: scheduling
 * purpose: Handle voice queries about day plans
 * spec_ref: 003-scheduling-kits/contracts/scheduling.yaml
 * complexity_budget: 200
 * state_machine: none
 * estimated_llm_cost: 0.001
 * offline_capability: REQUIRED
 * dependencies:
 *   internal:
 *     - "@/scheduling/repositories/day-plan.repository"
 *     - "@/scheduling/repositories/schedule-event.repository"
 *     - "@/core/logger/voice-logger"
 *   external:
 *     - date-fns
 *   supabase:
 *     - day_plans (read)
 *     - schedule_events (read)
 * exports:
 *   - DayPlanVoiceQuery
 *   - executeDayPlanQuery
 *   - formatVoiceResponse
 * voice_considerations:
 *   - Concise responses for voice playback
 *   - Natural time expressions
 *   - Clear status summaries
 * test_requirements:
 *   coverage: 90%
 *   test_file: src/__tests__/scheduling/unit/day-plan-queries.test.ts
 * tasks:
 *   - Process voice queries
 *   - Generate voice-friendly responses
 *   - Handle context-aware queries
 *   - Support relative time queries
 */

import { format, formatDistanceToNow, addMinutes, isBefore, isAfter } from 'date-fns';
import { DayPlanRepository } from '@/scheduling/repositories/day-plan.repository';
import { ScheduleEventRepository } from '@/scheduling/repositories/schedule-event.repository';
import { logger } from '@/core/logger/voice-logger';

export interface DayPlanVoiceQuery {
  type: 'summary' | 'next_job' | 'time_remaining' | 'job_count' | 'breaks' | 'route_info' | 'status';
  context?: {
    date?: Date;
    userId?: string;
    currentLocation?: { lat: number; lng: number };
  };
}

export interface VoiceQueryResult {
  success: boolean;
  data: any;
  voiceResponse: string;
  visualData?: any;
}

export class DayPlanVoiceQueryService {
  constructor(
    private dayPlanRepo: DayPlanRepository,
    private scheduleEventRepo: ScheduleEventRepository
  ) {}

  async executeDayPlanQuery(
    query: DayPlanVoiceQuery,
    userId: string
  ): Promise<VoiceQueryResult> {
    try {
      logger.info('Executing day plan voice query', {
        type: query.type,
        userId,
        metadata: { voice: { query: query.type } }
      });

      const date = query.context?.date || new Date();
      const dayPlan = await this.dayPlanRepo.findByUserAndDate(userId, date);

      if (!dayPlan) {
        return {
          success: false,
          data: null,
          voiceResponse: 'No schedule found for today'
        };
      }

      const events = await this.scheduleEventRepo.findByDayPlan(dayPlan.id);

      switch (query.type) {
        case 'summary':
          return this.getDaySummary(dayPlan, events);
        case 'next_job':
          return this.getNextJob(events);
        case 'time_remaining':
          return this.getTimeRemaining(dayPlan, events);
        case 'job_count':
          return this.getJobCount(events);
        case 'breaks':
          return this.getBreakInfo(events);
        case 'route_info':
          return this.getRouteInfo(dayPlan);
        case 'status':
          return this.getDayStatus(dayPlan, events);
        default:
          return {
            success: false,
            data: null,
            voiceResponse: 'Query type not recognized'
          };
      }
    } catch (error) {
      logger.error('Error executing day plan query', { error, query });
      return {
        success: false,
        data: null,
        voiceResponse: 'Unable to retrieve schedule information'
      };
    }
  }

  private async getDaySummary(dayPlan: any, events: any[]): Promise<VoiceQueryResult> {
    const jobEvents = events.filter(e => e.event_type === 'job');
    const breakEvents = events.filter(e => e.event_type === 'break');
    const completedJobs = jobEvents.filter(e => e.status === 'completed');
    
    const summary = {
      totalJobs: jobEvents.length,
      completedJobs: completedJobs.length,
      remainingJobs: jobEvents.length - completedJobs.length,
      totalBreaks: breakEvents.length,
      estimatedEndTime: this.calculateEndTime(dayPlan, events)
    };

    const voiceResponse = this.buildSummaryResponse(summary);

    return {
      success: true,
      data: summary,
      voiceResponse,
      visualData: {
        dayPlan,
        events: events.map(e => ({
          id: e.id,
          type: e.event_type,
          status: e.status,
          time: e.scheduled_start,
          duration: e.scheduled_duration_minutes
        }))
      }
    };
  }

  private async getNextJob(events: any[]): Promise<VoiceQueryResult> {
    const now = new Date();
    const upcomingEvents = events
      .filter(e => 
        e.event_type === 'job' && 
        e.status !== 'completed' &&
        e.scheduled_start &&
        new Date(e.scheduled_start) > now
      )
      .sort((a, b) => 
        new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()
      );

    if (upcomingEvents.length === 0) {
      // Check for current job
      const currentJob = events.find(e => 
        e.event_type === 'job' && 
        e.status === 'in_progress'
      );

      if (currentJob) {
        return {
          success: true,
          data: currentJob,
          voiceResponse: 'Currently at a job'
        };
      }

      return {
        success: true,
        data: null,
        voiceResponse: 'No more jobs scheduled today'
      };
    }

    const nextJob = upcomingEvents[0];
    const timeUntil = formatDistanceToNow(new Date(nextJob.scheduled_start));
    const location = this.getLocationDescription(nextJob);

    return {
      success: true,
      data: nextJob,
      voiceResponse: `Next job in ${timeUntil}${location ? ' at ' + location : ''}`
    };
  }

  private async getTimeRemaining(dayPlan: any, events: any[]): Promise<VoiceQueryResult> {
    const now = new Date();
    const remainingEvents = events.filter(e => 
      e.status !== 'completed' && e.status !== 'cancelled'
    );

    if (remainingEvents.length === 0) {
      return {
        success: true,
        data: { remainingMinutes: 0 },
        voiceResponse: 'All jobs completed for today'
      };
    }

    // Calculate remaining work time
    let remainingMinutes = 0;
    for (const event of remainingEvents) {
      if (event.status === 'in_progress') {
        // Estimate remaining time for current job
        const elapsed = Math.floor(
          (now.getTime() - new Date(event.actual_start || event.scheduled_start).getTime()) / 60000
        );
        const estimated = event.scheduled_duration_minutes || 30;
        remainingMinutes += Math.max(0, estimated - elapsed);
      } else {
        remainingMinutes += event.scheduled_duration_minutes || 30;
      }
    }

    const hours = Math.floor(remainingMinutes / 60);
    const minutes = remainingMinutes % 60;
    
    let voiceResponse = '';
    if (hours > 0) {
      voiceResponse = `About ${hours} hour${hours > 1 ? 's' : ''}`;
      if (minutes > 0) voiceResponse += ` and ${minutes} minutes`;
    } else {
      voiceResponse = `About ${minutes} minutes`;
    }
    voiceResponse += ' of work remaining';

    return {
      success: true,
      data: { remainingMinutes, hours, minutes },
      voiceResponse
    };
  }

  private async getJobCount(events: any[]): Promise<VoiceQueryResult> {
    const jobs = events.filter(e => e.event_type === 'job');
    const completed = jobs.filter(e => e.status === 'completed').length;
    const remaining = jobs.length - completed;

    let voiceResponse = '';
    if (jobs.length === 0) {
      voiceResponse = 'No jobs scheduled today';
    } else if (remaining === 0) {
      voiceResponse = `All ${jobs.length} jobs completed`;
    } else {
      voiceResponse = `${completed} of ${jobs.length} jobs completed, ${remaining} remaining`;
    }

    return {
      success: true,
      data: { total: jobs.length, completed, remaining },
      voiceResponse
    };
  }

  private async getBreakInfo(events: any[]): Promise<VoiceQueryResult> {
    const now = new Date();
    const breaks = events.filter(e => e.event_type === 'break');
    const upcomingBreak = breaks.find(b => 
      b.status !== 'completed' && 
      new Date(b.scheduled_start) > now
    );

    if (!upcomingBreak) {
      const completedBreaks = breaks.filter(b => b.status === 'completed').length;
      return {
        success: true,
        data: { totalBreaks: breaks.length, completedBreaks },
        voiceResponse: completedBreaks > 0 
          ? `Had ${completedBreaks} break${completedBreaks > 1 ? 's' : ''} today`
          : 'No breaks scheduled'
      };
    }

    const timeUntil = formatDistanceToNow(new Date(upcomingBreak.scheduled_start));
    const duration = upcomingBreak.scheduled_duration_minutes || 15;

    return {
      success: true,
      data: { nextBreak: upcomingBreak, timeUntil },
      voiceResponse: `${duration} minute break in ${timeUntil}`
    };
  }

  private async getRouteInfo(dayPlan: any): Promise<VoiceQueryResult> {
    const routeData = dayPlan.route_data || {};
    
    if (!routeData.distance_miles && !dayPlan.total_distance_miles) {
      return {
        success: true,
        data: null,
        voiceResponse: 'No route information available'
      };
    }

    const distance = routeData.distance_miles || dayPlan.total_distance_miles;
    const optimized = routeData.optimized || false;

    let voiceResponse = `Today's route is ${Math.round(distance)} miles`;
    if (optimized) {
      voiceResponse += ', optimized for efficiency';
    }

    return {
      success: true,
      data: { distance, optimized, routeData },
      voiceResponse
    };
  }

  private async getDayStatus(dayPlan: any, events: any[]): Promise<VoiceQueryResult> {
    const status = dayPlan.status;
    const jobEvents = events.filter(e => e.event_type === 'job');
    const inProgress = jobEvents.find(e => e.status === 'in_progress');
    const completed = jobEvents.filter(e => e.status === 'completed').length;
    const progress = jobEvents.length > 0 
      ? Math.round((completed / jobEvents.length) * 100) 
      : 0;

    let voiceResponse = '';
    switch (status) {
      case 'draft':
        voiceResponse = 'Schedule is in draft';
        break;
      case 'published':
        voiceResponse = 'Schedule ready to start';
        break;
      case 'in_progress':
        voiceResponse = inProgress 
          ? `Working on job ${completed + 1} of ${jobEvents.length}`
          : `Day in progress, ${progress}% complete`;
        break;
      case 'completed':
        voiceResponse = 'All jobs completed for today';
        break;
      case 'cancelled':
        voiceResponse = 'Schedule was cancelled';
        break;
      default:
        voiceResponse = 'Schedule status unknown';
    }

    return {
      success: true,
      data: { status, progress, currentJob: inProgress },
      voiceResponse
    };
  }

  private buildSummaryResponse(summary: any): string {
    const parts = [];

    if (summary.totalJobs === 0) {
      return 'No jobs scheduled today';
    }

    // Job count
    parts.push(`${summary.totalJobs} job${summary.totalJobs > 1 ? 's' : ''} today`);

    // Progress
    if (summary.completedJobs > 0) {
      parts.push(`${summary.completedJobs} completed`);
    }

    // Remaining
    if (summary.remainingJobs > 0) {
      parts.push(`${summary.remainingJobs} to go`);
    }

    // End time
    if (summary.estimatedEndTime) {
      parts.push(`finishing around ${format(summary.estimatedEndTime, 'h:mm a')}`);
    }

    return parts.join(', ');
  }

  private calculateEndTime(dayPlan: any, events: any[]): Date | null {
    if (dayPlan.actual_end_time) {
      return new Date(dayPlan.actual_end_time);
    }

    const remainingEvents = events
      .filter(e => e.status !== 'completed' && e.status !== 'cancelled')
      .sort((a, b) => 
        new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()
      );

    if (remainingEvents.length === 0) {
      return new Date(); // Already done
    }

    const lastEvent = remainingEvents[remainingEvents.length - 1];
    return addMinutes(
      new Date(lastEvent.scheduled_start),
      lastEvent.scheduled_duration_minutes || 30
    );
  }

  private getLocationDescription(event: any): string | null {
    if (event.address?.street) {
      // Simplify address for voice
      const parts = [];
      if (event.address.street_number) parts.push(event.address.street_number);
      if (event.address.street_name) parts.push(event.address.street_name);
      return parts.join(' ');
    }
    return null;
  }
}

// Standalone helper functions for voice formatting
export function formatTimeForVoice(date: Date): string {
  const time = format(date, 'h:mm a');
  // Make it more natural for voice
  return time.replace(':00', '');
}

export function formatDurationForVoice(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  
  if (mins === 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  
  return `${hours} hour${hours !== 1 ? 's' : ''} and ${mins} minute${mins !== 1 ? 's' : ''}`;
}

export function formatRelativeTimeForVoice(date: Date): string {
  const now = new Date();
  const diffMinutes = Math.floor((date.getTime() - now.getTime()) / 60000);
  
  if (diffMinutes < 0) {
    return `${Math.abs(diffMinutes)} minutes ago`;
  } else if (diffMinutes === 0) {
    return 'now';
  } else if (diffMinutes === 1) {
    return 'in 1 minute';
  } else if (diffMinutes < 60) {
    return `in ${diffMinutes} minutes`;
  } else {
    const hours = Math.floor(diffMinutes / 60);
    return `in ${hours} hour${hours !== 1 ? 's' : ''}`;
  }
}