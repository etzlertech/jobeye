/**
 * AGENT DIRECTIVE BLOCK
 * file: src/domains/job/services/job-from-voice-service.ts
 * phase: 4
 * domain: job
 * purpose: Service for creating jobs from voice commands with natural language processing
 * spec_ref: v4-vision-blueprint-extended.md
 * complexity_budget: 300
 * dependencies:
 *   - internal: JobRepository, JobTemplateRepository, CustomerRepository, PropertyRepository, IntentRecognitionService
 *   - external: uuid, date-fns
 * exports: JobFromVoiceService
 * voice_considerations:
 *   - Voice commands: "create mow job for Smith property", "schedule trimming at 123 Main tomorrow"
 *   - Fuzzy matching for customer/property names
 *   - Confirmation prompts for ambiguous requests
 * offline_capability: REQUIRED
 * test_requirements:
 *   - coverage: 90%
 *   - test_file: src/domains/job/services/__tests__/job-from-voice-service.test.ts
 * tasks:
 *   - [x] Define voice command parsing interface
 *   - [x] Implement entity extraction
 *   - [x] Add fuzzy matching for customers/properties
 *   - [x] Implement job creation with defaults
 *   - [x] Add offline queue support
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { addDays, parseISO, format, startOfDay, addHours } from 'date-fns';
import type { Database } from '@/types/database';
import { VoiceLogger } from '@/core/logger/voice-logger';

export interface VoiceJobCommand {
  raw_transcript: string;
  intent: 'create_job' | 'schedule_job' | 'quick_job';
  entities: {
    job_type?: string;
    customer_name?: string;
    property_address?: string;
    date?: string;
    time?: string;
    duration?: string;
    notes?: string;
    container?: string;
  };
  confidence: number;
  session_id?: string;
}

export interface JobCreationResult {
  success: boolean;
  job_id?: string;
  job_number?: string;
  message: string;
  confirmation_needed?: {
    type: 'customer' | 'property' | 'template' | 'datetime';
    options: Array<{
      id: string;
      name: string;
      confidence: number;
    }>;
    original_value: string;
  };
  voice_response: string;
}

export interface JobTemplate {
  id: string;
  template_code: string;
  name: string;
  category: string;
  estimated_duration: number;
  default_priority: 'low' | 'medium' | 'high' | 'urgent';
  voice_shortcuts: string[];
}

export interface Customer {
  id: string;
  name: string;
  customer_number: string;
  phone?: string;
}

export interface Property {
  id: string;
  customer_id: string;
  name: string;
  address: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
}

interface OfflineJobCreation {
  id: string;
  command: VoiceJobCommand;
  user_id: string;
  timestamp: number;
}

export class JobFromVoiceService {
  private supabase: SupabaseClient;
  private logger: VoiceLogger;
  private offlineQueue: OfflineJobCreation[] = [];

  constructor(
    supabase: SupabaseClient,
    logger?: VoiceLogger
  ) {
    this.supabase = supabase;
    this.logger = logger || new VoiceLogger();
    this.loadOfflineQueue();
  }

  async createJobFromVoice(
    command: VoiceJobCommand,
    userId: string
  ): Promise<JobCreationResult> {
    if (!navigator.onLine) {
      return this.queueOfflineJobCreation(command, userId);
    }

    try {
      // Extract and validate entities
      const validation = await this.validateAndResolveEntities(command, userId);
      if (!validation.isValid) {
        return validation.result!;
      }

      // Get user's tenant
      const { data: user } = await this.supabase
        .from('users')
        .select('tenant_id')
        .eq('id', userId)
        .single();

      if (!user?.tenant_id) {
        return {
          success: false,
          message: 'User company not found',
          voice_response: 'Unable to determine your company. Please try again.'
        };
      }

      // Create job
      const jobData = {
        tenant_id: user.tenant_id,
        template_id: validation.template_id!,
        customer_id: validation.customer_id!,
        property_id: validation.property_id!,
        title: validation.job_title!,
        description: command.entities.notes || `Created by voice: "${command.raw_transcript}"`,
        status: 'scheduled' as const,
        priority: validation.priority || 'medium' as const,
        scheduled_start: validation.scheduled_start!,
        scheduled_end: validation.scheduled_end!,
        estimated_duration: validation.duration!,
        voice_created: true,
        voice_session_id: command.session_id,
        voice_notes: command.raw_transcript,
        created_by: userId
      };

      const { data: job, error } = await this.supabase
        .from('jobs')
        .insert(jobData)
        .select()
        .single();

      if (error) throw error;

      // Note: Template-based task creation would happen via TaskTemplateService.instantiateTemplate
      // if template_id is provided. Voice service creates minimal job only.

      await this.logger.info('Job created from voice', {
        jobId: job.id,
        jobNumber: job.job_number,
        command,
        userId
      });

      return {
        success: true,
        job_id: job.id,
        job_number: job.job_number,
        message: `Job ${job.job_number} created successfully`,
        voice_response: this.generateSuccessVoiceResponse(job, validation)
      };
    } catch (error) {
      await this.logger.error('Failed to create job from voice', {
        error: error instanceof Error ? error : new Error(String(error)),
        command,
        userId,
      });

      return {
        success: false,
        message: 'Failed to create job',
        voice_response: 'Sorry, I was unable to create the job. Please try again.'
      };
    }
  }

  private async validateAndResolveEntities(
    command: VoiceJobCommand,
    userId: string
  ): Promise<{
    isValid: boolean;
    result?: JobCreationResult;
    template_id?: string;
    customer_id?: string;
    property_id?: string;
    job_title?: string;
    priority?: string;
    scheduled_start?: string;
    scheduled_end?: string;
    duration?: number;
  }> {
    // Find matching job template
    const template = await this.findJobTemplate(command.entities.job_type);
    if (!template) {
      return {
        isValid: false,
        result: {
          success: false,
          message: 'Job type not recognized',
          voice_response: `I didn't understand the job type "${command.entities.job_type}". Please try again with a valid job type.`,
          confirmation_needed: {
            type: 'template',
            options: await this.getCommonTemplates(),
            original_value: command.entities.job_type || ''
          }
        }
      };
    }

    // Find matching customer
    const customer = await this.findCustomer(command.entities.customer_name);
    if (!customer) {
      return {
        isValid: false,
        result: {
          success: false,
          message: 'Customer not found',
          voice_response: `I couldn't find a customer named "${command.entities.customer_name}". Please specify a valid customer.`,
          confirmation_needed: {
            type: 'customer',
            options: await this.searchCustomers(command.entities.customer_name || ''),
            original_value: command.entities.customer_name || ''
          }
        }
      };
    }

    // Find matching property
    const property = await this.findProperty(
      customer.id, 
      command.entities.property_address
    );
    if (!property) {
      const properties = await this.getCustomerProperties(customer.id);
      if (properties.length === 1) {
        // Use the only property
        return this.createValidationResult(
          template,
          customer,
          properties[0],
          command
        );
      }

      return {
        isValid: false,
        result: {
          success: false,
          message: 'Property not found or ambiguous',
          voice_response: `Which property for ${customer.name}?`,
          confirmation_needed: {
            type: 'property',
            options: properties.map(p => ({
              id: p.id,
              name: p.name,
              confidence: 0.5
            })),
            original_value: command.entities.property_address || ''
          }
        }
      };
    }

    return this.createValidationResult(template, customer, property, command);
  }

  private async createValidationResult(
    template: JobTemplate,
    customer: Customer,
    property: Property,
    command: VoiceJobCommand
  ) {
    // Parse date and time
    const scheduledDate = this.parseDate(command.entities.date);
    const scheduledTime = this.parseTime(command.entities.time);
    const duration = this.parseDuration(command.entities.duration) || template.estimated_duration;

    const scheduled_start = this.combineDateTime(scheduledDate, scheduledTime);
    const scheduled_end = addHours(parseISO(scheduled_start), duration / 60);

    // Template items and containers would be handled by TaskTemplateService if needed

    return {
      isValid: true,
      template_id: template.id,
      customer_id: customer.id,
      property_id: property.id,
      job_title: `${template.name} - ${property.name}`,
      priority: template.default_priority,
      scheduled_start,
      scheduled_end: scheduled_end.toISOString(),
      duration,
    };
  }

  private async findJobTemplate(jobType?: string): Promise<JobTemplate | null> {
    if (!jobType) return null;

    const normalizedType = jobType.toLowerCase().trim();

    // Try exact match first
    const { data: exactMatch } = await this.supabase
      .from('job_templates')
      .select('*')
      .eq('is_active', true)
      .or(`name.ilike.%${normalizedType}%,voice_shortcuts.cs.{${normalizedType}}`)
      .limit(1)
      .single();

    if (exactMatch) return exactMatch;

    // Try category match
    const { data: categoryMatch } = await this.supabase
      .from('job_templates')
      .select('*')
      .eq('is_active', true)
      .ilike('category', `%${normalizedType}%`)
      .limit(1)
      .single();

    return categoryMatch;
  }

  private async findCustomer(customerName?: string): Promise<Customer | null> {
    if (!customerName) return null;

    const normalizedName = customerName.toLowerCase().trim();

    // Try exact match
    const { data: exactMatch } = await this.supabase
      .from('customers')
      .select('*')
      .eq('is_active', true)
      .ilike('name', normalizedName)
      .limit(1)
      .single();

    if (exactMatch) return exactMatch;

    // Try partial match
    const { data: partialMatches } = await this.supabase
      .from('customers')
      .select('*')
      .eq('is_active', true)
      .ilike('name', `%${normalizedName}%`)
      .limit(5);

    if (partialMatches && partialMatches.length === 1) {
      return partialMatches[0];
    }

    return null;
  }

  private async searchCustomers(query: string): Promise<Array<{ id: string; name: string; confidence: number }>> {
    const { data: customers } = await this.supabase
      .from('customers')
      .select('id, name')
      .eq('is_active', true)
      .ilike('name', `%${query}%`)
      .limit(10);

    return (customers || []).map(c => ({
      id: c.id,
      name: c.name,
      confidence: this.calculateStringMatch(query, c.name)
    })).sort((a, b) => b.confidence - a.confidence);
  }

  private async findProperty(customerId: string, address?: string): Promise<Property | null> {
    if (!address) {
      // Return default or only property
      const { data: properties } = await this.supabase
        .from('properties')
        .select('*')
        .eq('customer_id', customerId)
        .eq('is_active', true);

      if (properties && properties.length === 1) {
        return properties[0];
      }
      return null;
    }

    const normalizedAddress = address.toLowerCase().trim();

    // Try to match by street name or property name
    const { data: matches } = await this.supabase
      .from('properties')
      .select('*')
      .eq('customer_id', customerId)
      .eq('is_active', true)
      .or(`name.ilike.%${normalizedAddress}%,address->street.ilike.%${normalizedAddress}%`);

    if (matches && matches.length === 1) {
      return matches[0];
    }

    return null;
  }

  private async getCustomerProperties(customerId: string): Promise<Property[]> {
    const { data } = await this.supabase
      .from('properties')
      .select('*')
      .eq('customer_id', customerId)
      .eq('is_active', true);

    return data || [];
  }

  private async getCommonTemplates(): Promise<Array<{ id: string; name: string; confidence: number }>> {
    const { data: templates } = await this.supabase
      .from('job_templates')
      .select('id, name, category')
      .eq('is_active', true)
      .limit(10);

    return (templates || []).map(t => ({
      id: t.id,
      name: t.name,
      confidence: 1.0
    }));
  }

  private parseDate(dateStr?: string): Date {
    if (!dateStr) return new Date();

    const normalized = dateStr.toLowerCase();
    const today = startOfDay(new Date());

    if (normalized.includes('today')) return today;
    if (normalized.includes('tomorrow')) return addDays(today, 1);
    if (normalized.includes('monday')) return this.getNextWeekday(1);
    if (normalized.includes('tuesday')) return this.getNextWeekday(2);
    if (normalized.includes('wednesday')) return this.getNextWeekday(3);
    if (normalized.includes('thursday')) return this.getNextWeekday(4);
    if (normalized.includes('friday')) return this.getNextWeekday(5);
    if (normalized.includes('saturday')) return this.getNextWeekday(6);
    if (normalized.includes('sunday')) return this.getNextWeekday(0);

    // Try to parse as date
    try {
      return startOfDay(parseISO(dateStr));
    } catch {
      return today;
    }
  }

  private parseTime(timeStr?: string): string {
    if (!timeStr) return '08:00';

    const normalized = timeStr.toLowerCase();
    
    // Handle common patterns
    if (normalized.includes('morning')) return '08:00';
    if (normalized.includes('noon')) return '12:00';
    if (normalized.includes('afternoon')) return '14:00';
    if (normalized.includes('evening')) return '17:00';

    // Try to extract time
    const timeMatch = normalized.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const ampm = timeMatch[3];

      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;

      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    return '08:00';
  }

  private parseDuration(durationStr?: string): number | null {
    if (!durationStr) return null;

    const normalized = durationStr.toLowerCase();
    
    // Extract number
    const match = normalized.match(/(\d+)\s*(hour|hr|minute|min)?/);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2];
      
      if (unit?.includes('hour')) return value * 60;
      return value;
    }

    return null;
  }

  private combineDateTime(date: Date, time: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    const combined = new Date(date);
    combined.setHours(hours, minutes, 0, 0);
    return combined.toISOString();
  }

  private getNextWeekday(dayOfWeek: number): Date {
    const today = new Date();
    const currentDay = today.getDay();
    const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7 || 7;
    return addDays(startOfDay(today), daysUntilTarget);
  }

  private calculateStringMatch(query: string, target: string): number {
    const q = query.toLowerCase();
    const t = target.toLowerCase();
    
    if (t === q) return 1.0;
    if (t.includes(q)) return 0.8;
    if (q.includes(t)) return 0.7;
    
    // Simple character overlap
    const overlap = q.split('').filter(c => t.includes(c)).length;
    return overlap / Math.max(q.length, t.length) * 0.5;
  }

  private generateSuccessVoiceResponse(job: any, validation: any): string {
    const date = format(parseISO(validation.scheduled_start), 'EEEE, MMMM do');
    const time = format(parseISO(validation.scheduled_start), 'h:mm a');
    
    return `Job ${job.job_number} created. ${validation.job_title} scheduled for ${date} at ${time}.`;
  }

  // Offline support
  private loadOfflineQueue() {
    const stored = localStorage.getItem('job-voice-offline-queue');
    if (stored) {
      this.offlineQueue = JSON.parse(stored);
    }
  }

  private saveOfflineQueue() {
    localStorage.setItem('job-voice-offline-queue', JSON.stringify(this.offlineQueue));
  }

  private queueOfflineJobCreation(
    command: VoiceJobCommand,
    userId: string
  ): JobCreationResult {
    const operation: OfflineJobCreation = {
      id: uuidv4(),
      command,
      user_id: userId,
      timestamp: Date.now()
    };

    this.offlineQueue.push(operation);
    this.saveOfflineQueue();

    return {
      success: true,
      message: 'Job queued for creation when online',
      voice_response: 'Job saved offline. It will be created when you reconnect.'
    };
  }

  async syncOfflineOperations(): Promise<void> {
    if (!navigator.onLine || this.offlineQueue.length === 0) {
      return;
    }

    const operations = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const operation of operations) {
      try {
        await this.createJobFromVoice(operation.command, operation.user_id);
      } catch (error) {
        console.error('Failed to sync offline job creation:', error);
        this.offlineQueue.push(operation);
      }
    }

    this.saveOfflineQueue();
  }
}
