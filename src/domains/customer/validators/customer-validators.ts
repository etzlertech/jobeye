// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/customer/validators/customer-validators.ts
// phase: 2
// domain: customer-management
// purpose: Validate customer input data with voice-aware error messages
// spec_ref: phase2/customer-management#validators
// version: 2025-08-1
// complexity_budget: 200 LoC
// offline_capability: REQUIRED
//
// dependencies:
//   internal:
//     - /src/domains/customer/types/customer-types
//     - /src/core/errors/error-types
//   external:
//     - zod: ^3.23.8
//
// exports:
//   - validateCustomerCreate: function - Validate new customer data
//   - validateCustomerUpdate: function - Validate customer updates
//   - validateContact: function - Validate contact information
//   - validateAddress: function - Validate address data
//   - validatePhoneNumber: function - Phone number validation
//   - getVoiceFriendlyError: function - Convert errors to voice format
//
// voice_considerations: |
//   Error messages must be voice-friendly and avoid technical jargon.
//   Phone number validation should accept voice-dictated formats.
//   Provide clear guidance for correcting validation errors via voice.
//
// test_requirements:
//   coverage: 95%
//   test_files:
//     - src/__tests__/domains/customer/validators/customer-validators.test.ts
//
// tasks:
//   1. Implement comprehensive validation schemas
//   2. Add voice-friendly error formatting
//   3. Create phone number format flexibility
//   4. Add address validation with fuzzy matching
//   5. Implement business rule validations
//   6. Add contextual validation hints
// --- END DIRECTIVE BLOCK ---

import { z } from 'zod';
import {
  customerCreateSchema,
  customerUpdateSchema,
  contactSchema,
  addressSchema,
  ContactRole,
  AddressType,
} from '../types/customer-types';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';

/**
 * Phone number validation with multiple format support
 */
const phoneRegex = /^(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/;
const phoneSchema = z.string().regex(phoneRegex, {
  message: 'Phone number should be 10 digits. You can say it as "555-123-4567"',
});

/**
 * Email validation with voice-friendly error
 */
const emailSchema = z.string().email({
  message: 'Please provide a valid email address, like "john at example dot com"',
});

/**
 * Enhanced customer creation schema with voice considerations
 */
export const enhancedCustomerCreateSchema = customerCreateSchema.extend({
  phone: phoneSchema,
  mobilePhone: phoneSchema.optional(),
  email: emailSchema.optional(),
  voiceMetadata: z.object({
    spokenName: z.string().optional(),
    phoneticName: z.string().optional(),
    preferredGreeting: z.string().optional(),
  }).optional(),
});

/**
 * Validate customer creation data
 */
export function validateCustomerCreate(data: unknown): {
  success: boolean;
  data?: any;
  errors?: ValidationError[];
} {
  try {
    const result = enhancedCustomerCreateSchema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: formatZodErrors(error),
      };
    }
    throw error;
  }
}

/**
 * Validate customer update data
 */
export function validateCustomerUpdate(data: unknown): {
  success: boolean;
  data?: any;
  errors?: ValidationError[];
} {
  try {
    const result = customerUpdateSchema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: formatZodErrors(error),
      };
    }
    throw error;
  }
}

/**
 * Validate contact information
 */
export function validateContact(data: unknown): {
  success: boolean;
  data?: any;
  errors?: ValidationError[];
} {
  try {
    const enhanced = contactSchema.extend({
      phone: phoneSchema.optional(),
      mobilePhone: phoneSchema.optional(),
      email: emailSchema.optional(),
    });
    
    const result = enhanced.parse(data);
    
    // Business rule: At least one contact method required
    if (!result.phone && !result.mobilePhone && !result.email) {
      return {
        success: false,
        errors: [{
          field: 'contact',
          message: 'Please provide at least one contact method: phone, mobile, or email',
          voiceHint: 'You need to give me a phone number or email address',
        }],
      };
    }
    
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: formatZodErrors(error),
      };
    }
    throw error;
  }
}

/**
 * Validate address with enhanced rules
 */
export function validateAddress(data: unknown): {
  success: boolean;
  data?: any;
  errors?: ValidationError[];
} {
  try {
    const enhanced = addressSchema.extend({
      street: z.string().min(5, {
        message: 'Street address is too short. Please include the house number and street name',
      }),
      city: z.string().min(2, {
        message: 'City name is required',
      }),
      state: z.string().length(2, {
        message: 'State should be a 2-letter code like "CA" or "NY"',
      }).toUpperCase(),
      zip: z.string().regex(/^\d{5}(-\d{4})?$/, {
        message: 'ZIP code should be 5 digits, or 9 digits with a dash',
      }),
    });
    
    const result = enhanced.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: formatZodErrors(error),
      };
    }
    throw error;
  }
}

/**
 * Validate and normalize phone number
 */
export function validatePhoneNumber(phone: string): {
  valid: boolean;
  normalized?: string;
  error?: string;
} {
  // Remove all non-numeric characters for validation
  const digits = phone.replace(/\D/g, '');
  
  // Check for valid lengths
  if (digits.length === 10) {
    // Format as XXX-XXX-XXXX
    const normalized = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    return { valid: true, normalized };
  }
  
  if (digits.length === 11 && digits[0] === '1') {
    // Remove country code and format
    const normalized = `${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
    return { valid: true, normalized };
  }
  
  return {
    valid: false,
    error: 'Phone number should have 10 digits. For example: 555-123-4567',
  };
}

/**
 * Business rule validations
 */
export function validateBusinessRules(data: any): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Rule: Billing address required if no service address
  if (!data.billingAddress && !data.serviceAddress) {
    errors.push({
      field: 'address',
      message: 'At least one address is required',
      voiceHint: 'Please provide either a billing address or service address',
    });
  }
  
  // Rule: Primary contact must have name
  if (data.contacts) {
    const primaryContact = data.contacts.find((c: any) => c.isPrimary);
    if (primaryContact && (!primaryContact.firstName || !primaryContact.lastName)) {
      errors.push({
        field: 'primaryContact',
        message: 'Primary contact must have first and last name',
        voiceHint: 'Please provide the full name of the primary contact',
      });
    }
  }
  
  return errors;
}

/**
 * Convert validation errors to voice-friendly format
 */
export function getVoiceFriendlyError(errors: ValidationError[]): string {
  if (errors.length === 0) return '';
  
  if (errors.length === 1) {
    return errors[0].voiceHint || errors[0].message;
  }
  
  const errorList = errors
    .map(e => e.voiceHint || e.message)
    .join('. Also, ');
    
  return `I found a few issues: ${errorList}`;
}

/**
 * Format Zod errors into our error structure
 */
function formatZodErrors(error: z.ZodError): ValidationError[] {
  return error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    voiceHint: getVoiceHint(err.path.join('.'), err.message),
  }));
}

/**
 * Get voice-friendly hints for common fields
 */
function getVoiceHint(field: string, message: string): string {
  const hints: Record<string, string> = {
    'name': 'Please tell me the customer\'s full name',
    'phone': 'Say the phone number with area code, like "555-123-4567"',
    'email': 'Spell out the email address, like "J-O-H-N at example dot com"',
    'street': 'Please include the house number and street name',
    'city': 'What city is this address in?',
    'state': 'What state? Use the 2-letter code like "C-A" for California',
    'zip': 'What\'s the 5-digit ZIP code?',
  };
  
  return hints[field] || message;
}

/**
 * Validation error structure
 */
export interface ValidationError {
  field: string;
  message: string;
  voiceHint?: string;
}

/**
 * Create validation error response
 */
export function createValidationError(errors: ValidationError[]): never {
  throw createAppError({
    code: 'VALIDATION_ERROR',
    message: 'Validation failed',
    severity: ErrorSeverity.MEDIUM,
    category: ErrorCategory.VALIDATION,
    userMessage: getVoiceFriendlyError(errors),
    metadata: { errors },
  });
}