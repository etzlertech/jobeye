// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/customer/services/customer-service.ts
// phase: 2
// domain: customer-management
// purpose: Orchestrate customer business logic including creation, updates, search, and voice interactions
// spec_ref: phase2/customer-management#service
// version: 2025-08-1
// complexity_budget: 500 LoC
// offline_capability: REQUIRED
//
// state_machine:
//   states: [draft, active, inactive, archived]
//   transitions:
//     - from: draft, to: active, trigger: activate
//     - from: active, to: inactive, trigger: deactivate
//     - from: inactive, to: active, trigger: reactivate
//     - from: [active, inactive], to: archived, trigger: archive
//
// dependencies:
//   internal:
//     - /src/lib/repositories/customer.repository
//     - /src/domains/customer/types/customer-types
//     - /src/domains/customer/validators/customer-validators
//     - /src/domains/customer/services/customer-search-service
//     - /src/core/logger/voice-logger
//     - /src/core/errors/error-handler
//   external:
//     - @supabase/supabase-js: ^2.43.0
//
// exports:
//   - CustomerService: class - Main customer business logic service
//   - createCustomer: function - Create new customer with validation
//   - updateCustomer: function - Update customer with state transitions
//   - findCustomerByVoice: function - Voice-friendly customer lookup
//   - addCustomerNote: function - Add notes with voice support
//   - transitionState: function - Customer state management
//   - deleteCustomer: function - Soft delete customer
//   - bulkImportCustomers: function - Bulk customer import
//
// voice_considerations: |
//   All methods must support voice context for enhanced logging.
//   Customer creation via voice should use fuzzy matching to prevent duplicates.
//   Voice notes should be tagged with session ID for playback.
//
// test_requirements:
//   coverage: 90%
//   test_files:
//     - src/__tests__/domains/customer/services/customer-service.test.ts
//     - src/__tests__/integration-real/customer-service.integration.test.ts
//
// tasks:
//   1. Implement customer creation with duplicate checking
//   2. Add state machine for customer lifecycle
//   3. Integrate voice-friendly search
//   4. Add contact management methods
//   5. Implement offline queue for operations
//   6. Add customer analytics methods
// --- END DIRECTIVE BLOCK ---

import { SupabaseClient } from '@supabase/supabase-js';
import { CustomerRepository } from '@/lib/repositories/customer.repository';
import {
  Customer,
  CustomerStatus,
  Contact,
  Address,
  CustomerNote,
  CustomerWithRelations,
  customerCreateSchema,
  customerUpdateSchema,
  CustomerSearchResult,
  CustomerVoiceCommand,
  AddressType,
} from '../types/customer-types';
import { CustomerSearchService } from './customer-search-service';
import { voiceLogger } from '@/core/logger/voice-logger';
import { handleError, ErrorContext } from '@/core/errors/error-handler';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';
import { EventBus } from '@/core/events/event-bus';

interface CustomerServiceOptions {
  supabaseClient: SupabaseClient;
  tenantId: string;
  userId?: string;
  voiceSessionId?: string;
}

export class CustomerService {
  private repository: CustomerRepository;
  private searchService: CustomerSearchService;
  private eventBus: EventBus;
  private tenantId: string;
  private userId?: string;
  private voiceSessionId?: string;

  constructor(options: CustomerServiceOptions) {
    this.repository = new CustomerRepository();
    this.searchService = new CustomerSearchService(options.supabaseClient);
    this.eventBus = EventBus.getInstance();
    this.tenantId = options.tenantId;
    this.userId = options.userId;
    this.voiceSessionId = options.voiceSessionId;
  }

  async createCustomer(data: any): Promise<Customer> {
    try {
      // Validate input
      const validated = customerCreateSchema.parse(data);

      // Check for duplicates using voice-friendly search
      if (this.voiceSessionId) {
        const duplicateCheck = await this.searchService.findByVoice(
          validated.name,
          this.tenantId
        );

        if (duplicateCheck && duplicateCheck.confidence > 0.8) {
          await voiceLogger.warn(
            `Customer ${validated.name} may already exist as ${duplicateCheck.customer.name}`,
            { voiceSessionId: this.voiceSessionId }
          );

          throw createAppError({
            code: 'CUSTOMER_DUPLICATE',
            message: `Customer similar to ${validated.name} already exists`,
            severity: ErrorSeverity.MEDIUM,
            category: ErrorCategory.VALIDATION,
            metadata: {
              existingCustomer: duplicateCheck.customer,
              confidence: duplicateCheck.confidence,
            },
          });
        }
      }

      // Generate customer number
      const customerNumber = await this.repository.generateCustomerNumber();

      // Create customer
      const customer = await this.repository.create({
        ...validated,
        tenant_id: this.tenantId,
        customer_number: customerNumber,
        created_by: this.userId,
        metadata: {
          source: this.voiceSessionId ? 'voice' : 'web',
          voiceSessionId: this.voiceSessionId,
        },
      });

      // Create addresses if provided
      if (validated.billingAddress || validated.serviceAddress) {
        await this.createCustomerAddresses(
          customer.id,
          validated.billingAddress,
          validated.serviceAddress
        );
      }

      // Emit event
      this.eventBus.emit('customer:created', {
        customer,
        userId: this.userId,
        source: this.voiceSessionId ? 'voice' : 'web',
      });

      // Voice confirmation
      if (this.voiceSessionId) {
        await voiceLogger.speak(
          `Customer ${customer.name} created with number ${customerNumber}`,
          { voiceSessionId: this.voiceSessionId }
        );
      }

      return customer;
    } catch (error) {
      const errorContext: ErrorContext = {
        operation: 'createCustomer',
        tenantId: this.tenantId,
        userId: this.userId,
        voiceSessionId: this.voiceSessionId,
        metadata: { data },
      };

      await handleError(error as Error, errorContext);
      throw error;
    }
  }

  async updateCustomer(
    customerId: string,
    updates: any
  ): Promise<Customer | null> {
    try {
      // Validate updates
      const validated = customerUpdateSchema.parse(updates);

      // Get current customer for state validation
      const current = await this.repository.findById(customerId);
      if (!current) {
        throw createAppError({
          code: 'CUSTOMER_NOT_FOUND',
          message: `Customer ${customerId} not found`,
          severity: ErrorSeverity.MEDIUM,
          category: ErrorCategory.BUSINESS_LOGIC,
        });
      }

      // Update customer
      const updated = await this.repository.update(
        customerId,
        validated
      );

      if (!updated) {
        return null;
      }

      // Emit event
      this.eventBus.emit('customer:updated', {
        customerId,
        updates: validated,
        userId: this.userId,
      });

      return updated;
    } catch (error) {
      await handleError(error as Error, {
        operation: 'updateCustomer',
        tenantId: this.tenantId,
        metadata: { customerId, updates },
      });
      throw error;
    }
  }

  async findById(customerId: string): Promise<Customer | null> {
    try {
      return await this.repository.findById(customerId);
    } catch (error) {
      await handleError(error as Error, {
        operation: 'findById',
        tenantId: this.tenantId,
        metadata: { customerId },
      });
      throw error;
    }
  }

  async findCustomerByVoice(query: string): Promise<CustomerSearchResult | null> {
    try {
      const result = await this.searchService.findByVoice(query, this.tenantId);

      if (result && this.voiceSessionId) {
        await voiceLogger.info(
          `Found customer ${result.customer.name} with ${result.confidence * 100}% confidence`,
          { voiceSessionId: this.voiceSessionId }
        );
      }

      return result;
    } catch (error) {
      await handleError(error as Error, {
        operation: 'findCustomerByVoice',
        tenantId: this.tenantId,
        metadata: { query },
      });
      throw error;
    }
  }

  async addCustomerNote(
    customerId: string,
    content: string,
    noteType: 'general' | 'service' | 'billing' | 'voice_transcript' = 'general'
  ): Promise<CustomerNote> {
    try {
      // Verify customer exists
      const customer = await this.repository.findById(customerId);
      if (!customer) {
        throw createAppError({
          code: 'CUSTOMER_NOT_FOUND',
          message: `Customer ${customerId} not found`,
          severity: ErrorSeverity.MEDIUM,
          category: ErrorCategory.BUSINESS_LOGIC,
        });
      }

      // Create note
      const note: CustomerNote = {
        id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        customerId,
        userId: this.userId || 'system',
        noteType,
        content,
        voiceSessionId: this.voiceSessionId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // In a real implementation, save to database
      // await this.noteRepository.create(note);

      // Emit event
      this.eventBus.emit('customer:note:added', {
        customerId,
        note,
        userId: this.userId,
      });

      if (this.voiceSessionId && noteType === 'voice_transcript') {
        await voiceLogger.info(
          `Voice note added to customer ${customer.name}`,
          { voiceSessionId: this.voiceSessionId }
        );
      }

      return note;
    } catch (error) {
      await handleError(error as Error, {
        operation: 'addCustomerNote',
        tenantId: this.tenantId,
        metadata: { customerId, noteType },
      });
      throw error;
    }
  }

  async processVoiceCommand(command: CustomerVoiceCommand): Promise<any> {
    try {
      switch (command.type) {
        case 'find_customer':
          return await this.findCustomerByVoice(command.query);

        case 'create_customer':
          return await this.createCustomer({
            name: command.name,
            phone: command.phone,
          });

        case 'update_customer':
          return await this.updateCustomer(command.customerId, {
            [command.field]: command.value,
          });

        case 'add_note':
          return await this.addCustomerNote(
            command.customerId,
            command.content,
            'voice_transcript'
          );

        case 'list_properties':
          // TODO: Implement getCustomerProperties
          return [];

        case 'customer_history':
          // TODO: Implement getCustomerHistory
          return [];

        default:
          throw createAppError({
            code: 'UNKNOWN_VOICE_COMMAND',
            message: 'Unknown voice command type',
            severity: ErrorSeverity.LOW,
            category: ErrorCategory.VALIDATION,
          });
      }
    } catch (error) {
      await handleError(error as Error, {
        operation: 'processVoiceCommand',
        tenantId: this.tenantId,
        voiceSessionId: this.voiceSessionId,
        metadata: { command },
      });
      throw error;
    }
  }

  async getCustomerWithRelations(customerId: string): Promise<CustomerWithRelations | null> {
    try {
      const customer = await this.repository.findById(customerId);
      if (!customer) {
        return null;
      }

      // In a real implementation, fetch related data
      const customerWithRelations: CustomerWithRelations = {
        ...customer,
        contacts: [],
        addresses: [],
        tags: [],
        recentNotes: [],
      };

      return customerWithRelations;
    } catch (error) {
      await handleError(error as Error, {
        operation: 'getCustomerWithRelations',
        tenantId: this.tenantId,
        metadata: { customerId },
      });
      throw error;
    }
  }

  async changeCustomerStatus(
    customerId: string,
    newStatus: CustomerStatus
  ): Promise<Customer | null> {
    try {
      const customer = await this.repository.findById(customerId);
      if (!customer) {
        throw createAppError({
          code: 'CUSTOMER_NOT_FOUND',
          message: `Customer ${customerId} not found`,
          severity: ErrorSeverity.MEDIUM,
          category: ErrorCategory.BUSINESS_LOGIC,
        });
      }

      // Validate state transition
      const validTransitions: Record<string, CustomerStatus[]> = {
        [CustomerStatus.PROSPECT]: [CustomerStatus.ACTIVE],
        [CustomerStatus.ACTIVE]: [CustomerStatus.INACTIVE, CustomerStatus.ARCHIVED],
        [CustomerStatus.INACTIVE]: [CustomerStatus.ACTIVE, CustomerStatus.ARCHIVED],
        [CustomerStatus.ARCHIVED]: [], // No transitions from archived
      };

      const currentStatus = customer.metadata?.status || CustomerStatus.ACTIVE;
      const allowedTransitions = validTransitions[currentStatus] || [];

      if (!allowedTransitions.includes(newStatus)) {
        throw createAppError({
          code: 'INVALID_STATUS_TRANSITION',
          message: `Cannot transition from ${currentStatus} to ${newStatus}`,
          severity: ErrorSeverity.MEDIUM,
          category: ErrorCategory.BUSINESS_LOGIC,
        });
      }

      // Update status
      const updated = await this.repository.update(
        customerId,
        {
          metadata: {
            ...customer.metadata,
            status: newStatus,
            statusChangedAt: new Date().toISOString(),
            statusChangedBy: this.userId,
          },
        }
      );

      // Emit event
      this.eventBus.emit('customer:status:changed', {
        customerId,
        oldStatus: currentStatus,
        newStatus,
        userId: this.userId,
      });

      return updated;
    } catch (error) {
      await handleError(error as Error, {
        operation: 'changeCustomerStatus',
        tenantId: this.tenantId,
        metadata: { customerId, newStatus },
      });
      throw error;
    }
  }

  /**
   * Transition customer state (alias for changeCustomerStatus)
   */
  async transitionState(
    customerId: string,
    newState: CustomerStatus,
    reason: string
  ): Promise<Customer | null> {
    try {
      const result = await this.changeCustomerStatus(customerId, newState);
      
      // Log the reason for state transition
      if (result && this.voiceSessionId) {
        await voiceLogger.info(
          `Customer ${result.name} transitioned to ${newState}: ${reason}`,
          { voiceSessionId: this.voiceSessionId }
        );
      }

      return result;
    } catch (error) {
      await handleError(error as Error, {
        operation: 'transitionState',
        tenantId: this.tenantId,
        metadata: { customerId, newState, reason },
      });
      throw error;
    }
  }

  /**
   * Delete customer (soft delete by setting archived status)
   */
  async deleteCustomer(
    customerId: string,
    reason?: string
  ): Promise<void> {
    try {
      const customer = await this.repository.findById(customerId);
      if (!customer) {
        throw createAppError({
          code: 'CUSTOMER_NOT_FOUND',
          message: `Customer ${customerId} not found`,
          severity: ErrorSeverity.MEDIUM,
          category: ErrorCategory.BUSINESS_LOGIC,
        });
      }

      // Soft delete by transitioning to archived status
      await this.transitionState(
        customerId,
        CustomerStatus.ARCHIVED,
        reason || 'Customer deleted'
      );

      // Emit deletion event
      this.eventBus.emit('customer:deleted', {
        customerId,
        customerName: customer.name,
        reason,
        userId: this.userId,
        deletedAt: new Date().toISOString(),
      });

      if (this.voiceSessionId) {
        await voiceLogger.info(
          `Customer ${customer.name} has been deleted (archived)`,
          { voiceSessionId: this.voiceSessionId }
        );
      }
    } catch (error) {
      await handleError(error as Error, {
        operation: 'deleteCustomer',
        tenantId: this.tenantId,
        metadata: { customerId, reason },
      });
      throw error;
    }
  }

  /**
   * Bulk import customers
   */
  async bulkImportCustomers(
    customerData: any[],
    skipDuplicates: boolean = true
  ): Promise<{
    success: Customer[];
    failed: Array<{ data: any; error: string }>;
    duplicates: Array<{ data: any; existingCustomer: Customer }>;
  }> {
    const success: Customer[] = [];
    const failed: Array<{ data: any; error: string }> = [];
    const duplicates: Array<{ data: any; existingCustomer: Customer }> = [];

    for (const data of customerData) {
      try {
        // Validate data
        const validated = customerCreateSchema.parse(data);

        // Check for duplicates if enabled
        if (skipDuplicates) {
          const duplicateCheck = await this.searchService.findByVoice(
            validated.name,
            this.tenantId
          );

          if (duplicateCheck && duplicateCheck.confidence > 0.8) {
            duplicates.push({
              data: validated,
              existingCustomer: duplicateCheck.customer,
            });
            continue;
          }
        }

        // Create customer
        const customer = await this.createCustomer(validated);
        success.push(customer);
      } catch (error) {
        failed.push({
          data,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Emit bulk import event
    this.eventBus.emit('customer:bulk:imported', {
      totalProcessed: customerData.length,
      successCount: success.length,
      failedCount: failed.length,
      duplicateCount: duplicates.length,
      userId: this.userId,
      importedAt: new Date().toISOString(),
    });

    if (this.voiceSessionId) {
      await voiceLogger.info(
        `Bulk import completed: ${success.length} created, ${failed.length} failed, ${duplicates.length} duplicates`,
        { voiceSessionId: this.voiceSessionId }
      );
    }

    return { success, failed, duplicates };
  }

  // Helper methods
  private async createCustomerAddresses(
    customerId: string,
    billingAddress?: any,
    serviceAddress?: any
  ): Promise<void> {
    // In a real implementation, save addresses to database
    if (billingAddress) {
      // await this.addressRepository.create({
      //   ...billingAddress,
      //   customerId,
      //   type: AddressType.BILLING,
      // });
    }

    if (serviceAddress) {
      // await this.addressRepository.create({
      //   ...serviceAddress,
      //   customerId,
      //   type: AddressType.SERVICE,
      // });
    }
  }

  private async getCustomerProperties(customerId: string): Promise<any[]> {
    // In a real implementation, fetch from property repository
    return [];
  }

  private async getCustomerHistory(
    customerId: string,
    timeframe?: string
  ): Promise<any> {
    // In a real implementation, fetch customer history
    return {
      jobs: [],
      notes: [],
      invoices: [],
    };
  }
}

// Convenience function exports
export const createCustomerService = (
  supabaseClient: SupabaseClient,
  tenantId: string,
  userId?: string,
  voiceSessionId?: string
): CustomerService => {
  return new CustomerService({
    supabaseClient,
    tenantId,
    userId,
    voiceSessionId,
  });
};