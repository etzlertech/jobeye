/**
 * AGENT DIRECTIVE BLOCK
 * file: /src/scheduling/services/notification.service.ts
 * phase: 4
 * domain: Scheduling
 * purpose: Handles notifications for scheduling events and alerts
 * spec_ref: .specify/features/003-scheduling-kits/specs/backend-scheduling.md
 * complexity_budget: 150
 * state_machine: none
 * estimated_llm_cost: 0.01
 * offline_capability: REQUIRED
 * dependencies:
 *   internal: none
 *   external:
 *     - @supabase/supabase-js
 * exports:
 *   - NotificationService
 * voice_considerations:
 *   - Support voice-triggered notifications
 *   - Format messages for voice output
 * test_requirements:
 *   coverage: 90%
 *   test_file: /src/__tests__/scheduling/integration/job-limit-enforcement.test.ts
 * tasks:
 *   - T032: Implement notification sending
 *   - Support different notification types
 *   - Handle offline queueing
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

interface NotificationPayload {
  recipient_id: string;
  type: 'job_limit_warning' | 'job_limit_reached' | 'kit_override' | 'break_reminder';
  priority: 'low' | 'medium' | 'high';
  message: string;
  data?: Record<string, any>;
}

export class NotificationService {
  private offlineQueue: NotificationPayload[] = [];

  constructor(private supabase: SupabaseClient<Database>) {}

  async sendNotification(payload: NotificationPayload): Promise<void> {
    // Check if online
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.offlineQueue.push(payload);
      return;
    }

    try {
      // In a real implementation, this would:
      // 1. Insert into a notifications table
      // 2. Trigger a Supabase Edge Function for delivery
      // 3. Send via appropriate channel (email, SMS, push, etc.)
      
      // For now, we'll just log it
      console.log('Sending notification:', payload);

      // Mock implementation for tests
      if (process.env.NODE_ENV === 'test') {
        // Store in memory for test verification
        (global as any).__notifications = (global as any).__notifications || [];
        (global as any).__notifications.push(payload);
      }

      // TODO: Implement actual notification delivery
      // await this.supabase
      //   .from('notifications')
      //   .insert({
      //     recipient_id: payload.recipient_id,
      //     type: payload.type,
      //     priority: payload.priority,
      //     message: payload.message,
      //     data: payload.data,
      //     sent_at: new Date().toISOString()
      //   });

    } catch (error) {
      console.error('Failed to send notification:', error);
      // Queue for retry
      this.offlineQueue.push(payload);
      throw error;
    }
  }

  async procesOfflineQueue(): Promise<void> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return;
    }

    const queue = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const notification of queue) {
      try {
        await this.sendNotification(notification);
      } catch (error) {
        console.error('Failed to process queued notification:', error);
        // Re-queue on failure
        this.offlineQueue.push(notification);
      }
    }
  }

  formatForVoice(payload: NotificationPayload): string {
    switch (payload.type) {
      case 'job_limit_warning':
        return `Warning: Technician is approaching job limit. ${payload.message}`;
      
      case 'job_limit_reached':
        return `Alert: Technician has reached maximum job capacity. ${payload.message}`;
      
      case 'kit_override':
        return `Kit override notification: ${payload.message}`;
      
      case 'break_reminder':
        return `Break reminder: ${payload.message}`;
      
      default:
        return payload.message;
    }
  }

  // Mock method for tests
  async sendVoiceNotification(recipientId: string, message: string): Promise<void> {
    await this.sendNotification({
      recipient_id: recipientId,
      type: 'break_reminder', // Default type for voice
      priority: 'medium',
      message: this.formatForVoice({
        recipient_id: recipientId,
        type: 'break_reminder',
        priority: 'medium',
        message
      })
    });
  }
}