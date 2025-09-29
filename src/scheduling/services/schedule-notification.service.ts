/**
 * AGENT DIRECTIVE BLOCK
 * file: src/scheduling/services/schedule-notification.service.ts
 * phase: 3
 * domain: scheduling
 * purpose: Handle schedule-related notifications
 * spec_ref: 003-scheduling-kits/contracts/scheduling.yaml
 * complexity_budget: 300
 * state_machine: idle -> sending -> sent/failed
 * estimated_llm_cost: 0.001
 * offline_capability: OPTIONAL
 * dependencies:
 *   internal:
 *     - "@/scheduling/repositories/schedule-event.repository"
 *     - "@/scheduling/services/notification.service"
 *     - "@/core/logger/voice-logger"
 *   external:
 *     - date-fns
 *   supabase:
 *     - schedule_events (read)
 *     - notification_logs (write)
 * exports:
 *   - ScheduleNotificationService
 *   - ScheduleNotificationType
 * voice_considerations:
 *   - Support voice-based notification preferences
 *   - Format messages for text-to-speech
 * test_requirements:
 *   coverage: 90%
 *   test_file: src/__tests__/scheduling/unit/schedule-notification.test.ts
 * tasks:
 *   - Implement schedule change notifications
 *   - Support reminder notifications
 *   - Handle notification preferences
 *   - Track notification delivery
 */

import { addMinutes, format, isBefore, isAfter } from 'date-fns';
import { ScheduleEventRepository } from '@/scheduling/repositories/schedule-event.repository';
import { NotificationService, NotificationChannel } from '@/scheduling/services/notification.service';
import { logger } from '@/core/logger/voice-logger';

export enum ScheduleNotificationType {
  SCHEDULE_CREATED = 'schedule_created',
  SCHEDULE_UPDATED = 'schedule_updated',
  SCHEDULE_CANCELLED = 'schedule_cancelled',
  REMINDER_15MIN = 'reminder_15min',
  REMINDER_1HOUR = 'reminder_1hour',
  REMINDER_1DAY = 'reminder_1day',
  CONFLICT_DETECTED = 'conflict_detected',
  BREAK_REMINDER = 'break_reminder',
  JOB_COMPLETED = 'job_completed',
  ROUTE_OPTIMIZED = 'route_optimized'
}

export interface ScheduleNotificationPreferences {
  channels: NotificationChannel[];
  reminderTimes: number[]; // minutes before event
  enableBreakReminders: boolean;
  enableConflictAlerts: boolean;
  voiceEnabled: boolean;
}

export interface ScheduleNotificationContext {
  eventId?: string;
  dayPlanId?: string;
  userId: string;
  eventType?: string;
  scheduledTime?: Date;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
}

export class ScheduleNotificationService {
  private defaultPreferences: ScheduleNotificationPreferences = {
    channels: [NotificationChannel.PUSH, NotificationChannel.SMS],
    reminderTimes: [15, 60], // 15 min and 1 hour
    enableBreakReminders: true,
    enableConflictAlerts: true,
    voiceEnabled: true
  };

  constructor(
    private scheduleEventRepo: ScheduleEventRepository,
    private notificationService: NotificationService
  ) {}

  async sendScheduleNotification(
    type: ScheduleNotificationType,
    context: ScheduleNotificationContext,
    preferences?: ScheduleNotificationPreferences
  ): Promise<boolean> {
    try {
      const prefs = preferences || this.defaultPreferences;
      const message = this.buildMessage(type, context);
      const voiceMessage = prefs.voiceEnabled ? this.buildVoiceMessage(type, context) : undefined;

      logger.info('Sending schedule notification', {
        type,
        userId: context.userId,
        channels: prefs.channels,
        metadata: { voice: { enabled: prefs.voiceEnabled } }
      });

      // Send through all configured channels
      const results = await Promise.allSettled(
        prefs.channels.map(channel =>
          this.notificationService.send({
            channel,
            recipient: context.userId,
            title: this.getNotificationTitle(type),
            body: message,
            data: {
              type,
              ...context,
              voiceMessage
            },
            priority: this.getNotificationPriority(type)
          })
        )
      );

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const success = successCount > 0;

      if (!success) {
        logger.error('All notification channels failed', {
          type,
          userId: context.userId,
          errors: results.filter(r => r.status === 'rejected')
        });
      }

      return success;
    } catch (error) {
      logger.error('Error sending schedule notification', { error, type, context });
      return false;
    }
  }

  async scheduleReminders(
    eventId: string,
    preferences?: ScheduleNotificationPreferences
  ): Promise<void> {
    try {
      const event = await this.scheduleEventRepo.findById(eventId);
      if (!event || !event.scheduled_start) {
        logger.warn('Cannot schedule reminders for event without start time', { eventId });
        return;
      }

      const prefs = preferences || this.defaultPreferences;
      const eventStart = new Date(event.scheduled_start);

      for (const minutesBefore of prefs.reminderTimes) {
        const reminderTime = addMinutes(eventStart, -minutesBefore);
        
        if (isAfter(reminderTime, new Date())) {
          // Schedule the reminder (would integrate with a job queue in production)
          logger.info('Scheduling reminder', {
            eventId,
            reminderTime: reminderTime.toISOString(),
            minutesBefore,
            metadata: { voice: { enabled: prefs.voiceEnabled } }
          });

          // In production, this would use a job scheduler like Bull or Agenda
          setTimeout(() => {
            this.sendScheduleNotification(
              minutesBefore === 15 ? ScheduleNotificationType.REMINDER_15MIN :
              minutesBefore === 60 ? ScheduleNotificationType.REMINDER_1HOUR :
              ScheduleNotificationType.REMINDER_1DAY,
              {
                eventId,
                userId: event.day_plan?.user_id || '',
                eventType: event.event_type,
                scheduledTime: eventStart
              },
              prefs
            );
          }, reminderTime.getTime() - Date.now());
        }
      }
    } catch (error) {
      logger.error('Error scheduling reminders', { error, eventId });
    }
  }

  async notifyScheduleChanges(
    eventId: string,
    changes: Record<string, any>,
    userId: string
  ): Promise<boolean> {
    return this.sendScheduleNotification(
      ScheduleNotificationType.SCHEDULE_UPDATED,
      { eventId, userId, changes }
    );
  }

  async notifyConflict(
    dayPlanId: string,
    conflictDetails: any,
    userId: string
  ): Promise<boolean> {
    return this.sendScheduleNotification(
      ScheduleNotificationType.CONFLICT_DETECTED,
      { 
        dayPlanId, 
        userId, 
        metadata: { conflict: conflictDetails }
      }
    );
  }

  private buildMessage(type: ScheduleNotificationType, context: ScheduleNotificationContext): string {
    switch (type) {
      case ScheduleNotificationType.SCHEDULE_CREATED:
        return 'Your schedule has been created for today';
      
      case ScheduleNotificationType.SCHEDULE_UPDATED:
        return `Your schedule has been updated${context.changes ? ': ' + this.summarizeChanges(context.changes) : ''}`;
      
      case ScheduleNotificationType.SCHEDULE_CANCELLED:
        return 'A scheduled event has been cancelled';
      
      case ScheduleNotificationType.REMINDER_15MIN:
        return `Reminder: Your next ${context.eventType || 'event'} starts in 15 minutes`;
      
      case ScheduleNotificationType.REMINDER_1HOUR:
        return `Reminder: Your next ${context.eventType || 'event'} starts in 1 hour`;
      
      case ScheduleNotificationType.REMINDER_1DAY:
        return `Tomorrow's schedule: You have ${context.eventType || 'events'} scheduled`;
      
      case ScheduleNotificationType.CONFLICT_DETECTED:
        return 'Schedule conflict detected. Please review your day plan';
      
      case ScheduleNotificationType.BREAK_REMINDER:
        return 'Time for a break! You\'ve been working for 4 hours';
      
      case ScheduleNotificationType.JOB_COMPLETED:
        return 'Job marked as completed';
      
      case ScheduleNotificationType.ROUTE_OPTIMIZED:
        return 'Your route has been optimized to save time';
      
      default:
        return 'Schedule notification';
    }
  }

  private buildVoiceMessage(type: ScheduleNotificationType, context: ScheduleNotificationContext): string {
    // Simplified messages for voice playback
    switch (type) {
      case ScheduleNotificationType.REMINDER_15MIN:
        return 'Next job in 15 minutes';
      case ScheduleNotificationType.REMINDER_1HOUR:
        return 'Next job in one hour';
      case ScheduleNotificationType.BREAK_REMINDER:
        return 'Time for a break';
      case ScheduleNotificationType.CONFLICT_DETECTED:
        return 'Schedule conflict detected';
      default:
        return this.buildMessage(type, context);
    }
  }

  private getNotificationTitle(type: ScheduleNotificationType): string {
    const titles: Record<ScheduleNotificationType, string> = {
      [ScheduleNotificationType.SCHEDULE_CREATED]: 'Schedule Created',
      [ScheduleNotificationType.SCHEDULE_UPDATED]: 'Schedule Updated',
      [ScheduleNotificationType.SCHEDULE_CANCELLED]: 'Event Cancelled',
      [ScheduleNotificationType.REMINDER_15MIN]: '15 Minute Reminder',
      [ScheduleNotificationType.REMINDER_1HOUR]: '1 Hour Reminder',
      [ScheduleNotificationType.REMINDER_1DAY]: 'Tomorrow\'s Schedule',
      [ScheduleNotificationType.CONFLICT_DETECTED]: 'Conflict Alert',
      [ScheduleNotificationType.BREAK_REMINDER]: 'Break Time',
      [ScheduleNotificationType.JOB_COMPLETED]: 'Job Complete',
      [ScheduleNotificationType.ROUTE_OPTIMIZED]: 'Route Optimized'
    };

    return titles[type] || 'Schedule Notification';
  }

  private getNotificationPriority(type: ScheduleNotificationType): 'high' | 'normal' | 'low' {
    switch (type) {
      case ScheduleNotificationType.CONFLICT_DETECTED:
      case ScheduleNotificationType.SCHEDULE_CANCELLED:
      case ScheduleNotificationType.REMINDER_15MIN:
        return 'high';
      case ScheduleNotificationType.REMINDER_1HOUR:
      case ScheduleNotificationType.BREAK_REMINDER:
        return 'normal';
      default:
        return 'low';
    }
  }

  private summarizeChanges(changes: Record<string, any>): string {
    const summaries: string[] = [];
    
    if (changes.scheduled_start) {
      summaries.push(`time changed to ${format(new Date(changes.scheduled_start), 'h:mm a')}`);
    }
    if (changes.location_data) {
      summaries.push('location updated');
    }
    if (changes.status) {
      summaries.push(`status: ${changes.status}`);
    }
    
    return summaries.join(', ');
  }
}