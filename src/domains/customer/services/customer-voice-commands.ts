// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/customer/services/customer-voice-commands.ts
// phase: 2
// domain: customer-management
// purpose: Parse and execute voice commands for customer operations
// spec_ref: phase2/customer-management#voice-commands
// version: 2025-08-1
// complexity_budget: 300 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   internal:
//     - /src/domains/customer/types/customer-types
//     - /src/domains/customer/services/customer-service
//     - /src/domains/voice/types/voice-types
//     - /src/core/logger/voice-logger
//   external:
//     - @supabase/supabase-js: ^2.43.0
//
// exports:
//   - CustomerVoiceCommandHandler: class - Voice command processor
//   - parseCustomerCommand: function - Parse voice input to command
//   - executeVoiceCommand: function - Execute parsed command
//   - getCommandSuggestions: function - Provide command hints
//
// voice_considerations: |
//   Support natural language variations for common commands.
//   Handle partial matches and ask for clarification when needed.
//   Provide voice feedback for all operations.
//   Support command chaining for complex operations.
//
// test_requirements:
//   coverage: 90%
//   test_files:
//     - src/__tests__/domains/customer/services/customer-voice-commands.test.ts
//
// tasks:
//   1. Implement command parsing with NLU patterns
//   2. Create command execution pipeline
//   3. Add confirmation dialogs for destructive operations
//   4. Implement command history tracking
//   5. Add voice feedback system
//   6. Create offline command queue
// --- END DIRECTIVE BLOCK ---

import { CustomerService } from './customer-service';
import {
  CustomerVoiceCommand,
  Customer,
  CustomerSearchResult,
} from '../types/customer-types';
import { voiceLogger } from '@/core/logger/voice-logger';
import { EventBus } from '@/core/events/event-bus';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';

interface VoiceContext {
  sessionId: string;
  userId: string;
  tenantId: string;
  lastCustomerId?: string;
  conversationState?: 'idle' | 'collecting_info' | 'confirming';
}

interface CommandPattern {
  pattern: RegExp;
  type: CustomerVoiceCommand['type'];
  extractor: (matches: RegExpMatchArray, context: VoiceContext) => Partial<CustomerVoiceCommand>;
}

export class CustomerVoiceCommandHandler {
  private customerService: CustomerService;
  private eventBus: EventBus;
  private commandHistory: Map<string, CustomerVoiceCommand[]> = new Map();
  
  // Command patterns for natural language processing
  private commandPatterns: CommandPattern[] = [
    // Find customer patterns
    {
      pattern: /^(find|get|show|pull up|look up|search for)(?: a| the)? customer (.+)$/i,
      type: 'find_customer',
      extractor: (matches) => ({ query: matches[2].trim() }),
    },
    {
      pattern: /^(who is|tell me about|customer info for) (.+)$/i,
      type: 'find_customer',
      extractor: (matches) => ({ query: matches[2].trim() }),
    },
    
    // Create customer patterns
    {
      pattern: /^(create|add|new) customer(?: named| called)? (.+?)(?: with phone(?: number)? (.+))?$/i,
      type: 'create_customer',
      extractor: (matches) => ({
        name: matches[2].trim(),
        phone: matches[3]?.trim(),
      }),
    },
    
    // Update customer patterns
    {
      pattern: /^(update|change|set)(?: the)? (.+?)(?: to| as) (.+)$/i,
      type: 'update_customer',
      extractor: (matches, context) => ({
        customerId: context.lastCustomerId,
        field: this.normalizeFieldName(matches[2]),
        value: matches[3].trim(),
      }),
    },
    
    // Add note patterns
    {
      pattern: /^(add note|note|add a note|make a note)(?: that)? (.+)$/i,
      type: 'add_note',
      extractor: (matches, context) => ({
        customerId: context.lastCustomerId,
        content: matches[2].trim(),
      }),
    },
    
    // List properties pattern
    {
      pattern: /^(list|show|what are)(?: the)? properties$/i,
      type: 'list_properties',
      extractor: (_, context) => ({
        customerId: context.lastCustomerId,
      }),
    },
    
    // Customer history pattern
    {
      pattern: /^(show|what is|tell me)(?: the)? (history|recent activity|jobs)(?: for)?(?: the)?(?: last)? (\w+)?$/i,
      type: 'customer_history',
      extractor: (matches, context) => ({
        customerId: context.lastCustomerId,
        timeframe: matches[3] || 'recent',
      }),
    },
  ];

  constructor(customerService: CustomerService) {
    this.customerService = customerService;
    this.eventBus = EventBus.getInstance();
  }

  /**
   * Parse voice input into a structured command
   */
  async parseCustomerCommand(
    voiceInput: string,
    context: VoiceContext
  ): Promise<CustomerVoiceCommand | null> {
    const normalizedInput = voiceInput.trim();
    
    // Try each pattern
    for (const pattern of this.commandPatterns) {
      const matches = normalizedInput.match(pattern.pattern);
      if (matches) {
        const extractedData = pattern.extractor(matches, context);
        const command = {
          type: pattern.type,
          ...extractedData,
        } as CustomerVoiceCommand;
        
        await voiceLogger.info(
          `Parsed command: ${pattern.type}`,
          { 
            voiceSessionId: context.sessionId,
            metadata: { command, input: voiceInput }
          }
        );
        
        return command;
      }
    }
    
    // No pattern matched
    await voiceLogger.warn(
      'Could not parse customer command',
      { 
        voiceSessionId: context.sessionId,
        metadata: { input: voiceInput }
      }
    );
    
    return null;
  }

  /**
   * Execute a parsed voice command
   */
  async executeVoiceCommand(
    command: CustomerVoiceCommand,
    context: VoiceContext
  ): Promise<any> {
    try {
      // Track command in history
      this.addToHistory(context.sessionId, command);
      
      // Execute based on command type
      switch (command.type) {
        case 'find_customer':
          return await this.handleFindCustomer(command, context);
          
        case 'create_customer':
          return await this.handleCreateCustomer(command, context);
          
        case 'update_customer':
          return await this.handleUpdateCustomer(command, context);
          
        case 'add_note':
          return await this.handleAddNote(command, context);
          
        case 'list_properties':
          return await this.handleListProperties(command, context);
          
        case 'customer_history':
          return await this.handleCustomerHistory(command, context);
          
        default:
          throw createAppError({
            code: 'UNKNOWN_COMMAND',
            message: 'Unknown voice command',
            severity: ErrorSeverity.LOW,
            category: ErrorCategory.BUSINESS_LOGIC,
          });
      }
    } catch (error) {
      await voiceLogger.error(
        'Sorry, I couldn\'t complete that command',
        { 
          voiceSessionId: context.sessionId,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      throw error;
    }
  }

  /**
   * Get command suggestions based on context
   */
  getCommandSuggestions(context: VoiceContext): string[] {
    const suggestions: string[] = [];
    
    if (!context.lastCustomerId) {
      suggestions.push(
        'Say "find customer" followed by a name or phone number',
        'Say "create new customer" to add someone',
      );
    } else {
      suggestions.push(
        'Say "add note" to add a comment',
        'Say "show properties" to see their locations',
        'Say "update phone number" to change contact info',
        'Say "show history" to see recent activity',
      );
    }
    
    return suggestions;
  }

  /**
   * Handle find customer command
   */
  private async handleFindCustomer(
    command: CustomerVoiceCommand & { type: 'find_customer' },
    context: VoiceContext
  ): Promise<CustomerSearchResult | null> {
    const result = await this.customerService.findCustomerByVoice(command.query);
    
    if (result) {
      // Update context with found customer
      context.lastCustomerId = result.customer.id;
      
      await voiceLogger.speak(
        `Found ${result.customer.name}. ${this.getCustomerSummary(result.customer)}`,
        { voiceSessionId: context.sessionId }
      );
      
      this.eventBus.emit('voice:customer:found', {
        sessionId: context.sessionId,
        customer: result.customer,
        confidence: result.confidence,
      });
    } else {
      await voiceLogger.speak(
        `I couldn't find a customer matching "${command.query}". Would you like to create a new customer?`,
        { voiceSessionId: context.sessionId }
      );
    }
    
    return result;
  }

  /**
   * Handle create customer command
   */
  private async handleCreateCustomer(
    command: CustomerVoiceCommand & { type: 'create_customer' },
    context: VoiceContext
  ): Promise<Customer> {
    // Check if we need more information
    if (!command.phone) {
      await voiceLogger.speak(
        `I need a phone number for ${command.name}. Please say the phone number.`,
        { voiceSessionId: context.sessionId }
      );
      
      throw createAppError({
        code: 'INCOMPLETE_COMMAND',
        message: 'Phone number required',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.VALIDATION,
        metadata: { missingField: 'phone' },
      });
    }
    
    const customer = await this.customerService.createCustomer({
      name: command.name,
      phone: command.phone,
    });
    
    context.lastCustomerId = customer.id;
    
    await voiceLogger.speak(
      `Created customer ${customer.name} with number ${customer.customer_number}`,
      { voiceSessionId: context.sessionId }
    );
    
    return customer;
  }

  /**
   * Handle update customer command
   */
  private async handleUpdateCustomer(
    command: CustomerVoiceCommand & { type: 'update_customer' },
    context: VoiceContext
  ): Promise<Customer | null> {
    if (!command.customerId) {
      throw createAppError({
        code: 'NO_CUSTOMER_CONTEXT',
        message: 'Please find a customer first',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.VALIDATION,
      });
    }
    
    const updated = await this.customerService.updateCustomer(
      command.customerId,
      { [command.field]: command.value }
    );
    
    if (updated) {
      await voiceLogger.speak(
        `Updated ${command.field} to ${command.value}`,
        { voiceSessionId: context.sessionId }
      );
    }
    
    return updated;
  }

  /**
   * Handle add note command
   */
  private async handleAddNote(
    command: CustomerVoiceCommand & { type: 'add_note' },
    context: VoiceContext
  ): Promise<void> {
    if (!command.customerId) {
      throw createAppError({
        code: 'NO_CUSTOMER_CONTEXT',
        message: 'Please find a customer first',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.VALIDATION,
      });
    }
    
    await this.customerService.addCustomerNote(
      command.customerId,
      command.content,
      'voice_transcript'
    );
    
    await voiceLogger.speak(
      'Note added successfully',
      { voiceSessionId: context.sessionId }
    );
  }

  /**
   * Handle list properties command
   */
  private async handleListProperties(
    command: CustomerVoiceCommand & { type: 'list_properties' },
    context: VoiceContext
  ): Promise<void> {
    if (!command.customerId) {
      throw createAppError({
        code: 'NO_CUSTOMER_CONTEXT',
        message: 'Please find a customer first',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.VALIDATION,
      });
    }
    
    // This would fetch from property service
    await voiceLogger.speak(
      'Property listing is not yet implemented',
      { voiceSessionId: context.sessionId }
    );
  }

  /**
   * Handle customer history command
   */
  private async handleCustomerHistory(
    command: CustomerVoiceCommand & { type: 'customer_history' },
    context: VoiceContext
  ): Promise<void> {
    if (!command.customerId) {
      throw createAppError({
        code: 'NO_CUSTOMER_CONTEXT',
        message: 'Please find a customer first',
        severity: ErrorSeverity.LOW,
        category: ErrorCategory.VALIDATION,
      });
    }
    
    // This would fetch history
    await voiceLogger.speak(
      'Customer history is not yet implemented',
      { voiceSessionId: context.sessionId }
    );
  }

  /**
   * Helper methods
   */
  private normalizeFieldName(input: string): string {
    const fieldMap: Record<string, string> = {
      'phone number': 'phone',
      'phone': 'phone',
      'mobile': 'mobilePhone',
      'cell': 'mobilePhone',
      'email': 'email',
      'email address': 'email',
      'name': 'name',
      'address': 'address',
    };
    
    return fieldMap[input.toLowerCase()] || input;
  }

  private getCustomerSummary(customer: Customer): string {
    const parts = [];
    
    if (customer.phone) {
      parts.push(`Phone: ${customer.phone}`);
    }
    
    if (customer.propertyCount) {
      parts.push(`${customer.propertyCount} properties`);
    }
    
    if (customer.activeJobCount) {
      parts.push(`${customer.activeJobCount} active jobs`);
    }
    
    return parts.join('. ') || 'No additional information.';
  }

  private addToHistory(sessionId: string, command: CustomerVoiceCommand): void {
    const history = this.commandHistory.get(sessionId) || [];
    history.push(command);
    
    // Keep last 20 commands
    if (history.length > 20) {
      history.shift();
    }
    
    this.commandHistory.set(sessionId, history);
  }
}

// Convenience export
export const createCustomerVoiceHandler = (
  customerService: CustomerService
): CustomerVoiceCommandHandler => {
  return new CustomerVoiceCommandHandler(customerService);
};