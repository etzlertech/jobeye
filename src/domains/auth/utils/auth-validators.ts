// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/auth/utils/auth-validators.ts
// purpose: Input validation schemas and helpers using Zod for authentication operations with voice command support and security validation
// spec_ref: auth#validators
// version: 2025-08-1
// domain: authentication
// phase: 1
// complexity_budget: medium
// offline_capability: REQUIRED
//
// dependencies:
//   - internal: ['src/domains/auth/types/auth-types.ts']
//   - external: ['zod']
//
// exports:
//   - loginSchema - Zod schema for login credential validation
//   - registerSchema - Zod schema for user registration with password strength
//   - emailSchema - Standalone email format validation schema
//   - phoneSchema - Phone number validation with international format support
//   - passwordSchema - Password strength validation with security requirements
//   - voiceCommandSchema - Voice authentication command validation
//   - validateLogin - Helper function to validate login credentials
//   - validateRegistration - Helper function to validate registration data
//   - validateEmail - Helper function for email format checking
//   - validatePhone - Helper function for phone number validation
//   - validatePassword - Helper function for password strength checking
//   - validateVoiceCommand - Helper function for voice auth command validation
//
// voice_considerations: >
//   Voice command validation should handle natural language variations for authentication operations.
//   Validation error messages should be voice-friendly for TTS output to users.
//   Voice input validation should be more lenient with formatting but strict with security.
//
// security_considerations: >
//   Password validation must enforce strong security requirements including length, complexity, and common password checking.
//   Email validation must prevent injection attacks and normalize input safely.
//   Phone validation must handle international formats while preventing malformed input.
//   All validation errors must not leak sensitive information about system internals.
//
// performance_considerations: >
//   Zod schemas should be pre-compiled and cached for repeated validation operations.
//   Complex validation rules should use efficient regex patterns and avoid expensive operations.
//   Voice command validation should be optimized for real-time processing with minimal latency.
//
// tasks:
//   1. [SETUP] Import Zod library and auth types for schema definition
//   2. [EMAIL] Create email validation schema with proper format checking and normalization
//   3. [PASSWORD] Define password schema with strength requirements (min 8 chars, uppercase, lowercase, numbers)
//   4. [PHONE] Create phone number validation schema supporting international formats
//   5. [LOGIN] Build login validation schema combining email and password validation
//   6. [REGISTER] Create registration schema with all required fields and role validation
//   7. [VOICE] Define voice command validation schema for auth operations
//   8. [HELPERS] Create helper functions that wrap schema validation with error handling
//   9. [ERRORS] Implement voice-friendly error message formatting for validation failures
//  10. [EXPORT] Export all schemas and validation helper functions for use in services
// --- END DIRECTIVE BLOCK ---

import { z } from 'zod';
import { Role, type LoginDto, type RegisterDto, type UserProfile } from '../types/auth-types';

/**
 * Email validation schema with normalization
 * Ensures proper email format and prevents common attacks
 */
export const emailSchema = z
  .string()
  .email('Please enter a valid email address')
  .min(5, 'Email must be at least 5 characters')
  .max(254, 'Email must not exceed 254 characters')
  .toLowerCase()
  .trim();

/**
 * Password strength validation schema
 * Enforces security requirements for user passwords
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password must not exceed 128 characters')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^a-zA-Z0-9]/, 'Password must contain at least one special character')
  .refine(
    (password) => !isCommonPassword(password),
    'Please choose a more secure password'
  );

/**
 * Phone number validation schema
 * Supports international formats and normalizes input
 */
export const phoneSchema = z
  .string()
  .regex(
    /^\+?[1-9]\d{1,14}$/,
    'Please enter a valid phone number (including country code if international)'
  )
  .transform((phone) => {
    // Normalize phone number format
    const cleaned = phone.replace(/\D/g, '');
    return phone.startsWith('+') ? phone : `+${cleaned}`;
  });

/**
 * Tenant ID validation schema
 */
export const tenantIdSchema = z
  .string()
  .uuid('Tenant ID must be a valid UUID')
  .min(1, 'Tenant ID is required');

/**
 * User role validation schema
 */
export const roleSchema = z.nativeEnum(Role, {
  errorMap: () => ({ message: 'Please select a valid user role' })
});

/**
 * Voice preferences validation schema
 */
export const voicePreferencesSchema: z.ZodType<UserProfile['voice_preferences']> = z.object({
  wake_word: z.string().min(2).max(20).optional(),
  speech_rate: z.number().min(0.5).max(2.0),
  preferred_language: z.string().min(2).max(10),
  voice_feedback_enabled: z.boolean(),
  preferred_tts_provider: z.enum(['google', 'openai', 'system'])
});

/**
 * Login validation schema
 * Validates user login credentials
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
  tenant_id: tenantIdSchema.optional(),
  mfa_code: z.string().length(6, 'MFA code must be 6 digits').optional()
}) satisfies z.ZodType<LoginDto>;

/**
 * Registration validation schema
 * Validates new user registration data
 */
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  tenant_id: tenantIdSchema,
  role: roleSchema,
  voice_preferences: voicePreferencesSchema.optional()
}) satisfies z.ZodType<RegisterDto>;

/**
 * Voice command validation schema for authentication operations
 */
export const voiceCommandSchema = z.object({
  command: z.string().min(3, 'Voice command too short').max(200, 'Voice command too long'),
  operation: z.enum(['login', 'logout', 'register', 'reset_password', 'enable_mfa', 'disable_mfa']),
  confidence: z.number().min(0).max(1),
  context: z.record(z.any()).optional()
});

/**
 * MFA code validation schema
 */
export const mfaCodeSchema = z
  .string()
  .regex(/^[0-9]{6}$/, 'MFA code must be 6 digits')
  .length(6, 'MFA code must be exactly 6 digits');

/**
 * Password reset validation schema
 */
export const passwordResetSchema = z.object({
  email: emailSchema,
  new_password: passwordSchema,
  reset_token: z.string().min(10, 'Invalid reset token')
});

/**
 * Helper function to validate login credentials
 */
export const validateLogin = (data: unknown) => {
  const result = loginSchema.safeParse(data);
  return {
    success: result.success,
    data: result.success ? result.data : null,
    errors: result.success ? null : formatValidationErrors(result.error),
    voiceMessage: result.success ? null : getVoiceFriendlyError(result.error)
  };
};

/**
 * Helper function to validate registration data
 */
export const validateRegistration = (data: unknown) => {
  const result = registerSchema.safeParse(data);
  return {
    success: result.success,
    data: result.success ? result.data : null,
    errors: result.success ? null : formatValidationErrors(result.error),
    voiceMessage: result.success ? null : getVoiceFriendlyError(result.error)
  };
};

/**
 * Helper function to validate email format
 */
export const validateEmail = (email: string) => {
  const result = emailSchema.safeParse(email);
  return {
    isValid: result.success,
    normalizedEmail: result.success ? result.data : null,
    error: result.success ? null : result.error.errors[0]?.message
  };
};

/**
 * Helper function to validate phone number
 */
export const validatePhone = (phone: string) => {
  const result = phoneSchema.safeParse(phone);
  return {
    isValid: result.success,
    normalizedPhone: result.success ? result.data : null,
    error: result.success ? null : result.error.errors[0]?.message
  };
};

/**
 * Helper function to validate password strength
 */
export const validatePassword = (password: string) => {
  const result = passwordSchema.safeParse(password);
  return {
    isValid: result.success,
    strength: getPasswordStrength(password),
    errors: result.success ? [] : result.error.errors.map(e => e.message),
    voiceMessage: result.success ? 'Password meets security requirements' : 'Password does not meet security requirements'
  };
};

/**
 * Helper function to validate voice commands for auth operations
 */
export const validateVoiceCommand = (data: unknown) => {
  const result = voiceCommandSchema.safeParse(data);
  return {
    success: result.success,
    data: result.success ? result.data : null,
    errors: result.success ? null : formatValidationErrors(result.error),
    voiceMessage: result.success ? 'Voice command recognized' : 'Voice command not understood'
  };
};

/**
 * Helper function to validate MFA codes
 */
export const validateMFACode = (code: string) => {
  const result = mfaCodeSchema.safeParse(code);
  return {
    isValid: result.success,
    error: result.success ? null : result.error.errors[0]?.message
  };
};

/**
 * Format Zod validation errors into a more usable structure
 */
const formatValidationErrors = (error: z.ZodError) => {
  return error.errors.reduce((acc, err) => {
    const field = err.path.join('.');
    if (!acc[field]) acc[field] = [];
    acc[field].push(err.message);
    return acc;
  }, {} as Record<string, string[]>);
};

/**
 * Generate voice-friendly error messages for TTS output
 */
const getVoiceFriendlyError = (error: z.ZodError): string => {
  const firstError = error.errors[0];
  if (!firstError) return 'Please check your input and try again';

  const field = firstError.path[0];
  const message = firstError.message;

  // Convert technical error messages to voice-friendly ones
  const voiceFriendlyMessages: Record<string, string> = {
    email: 'Please provide a valid email address',
    password: 'Your password does not meet the security requirements',
    phone: 'Please provide a valid phone number',
    tenant_id: 'Please select a valid organization',
    role: 'Please select a valid user role',
    mfa_code: 'Please enter a six digit verification code'
  };

  return voiceFriendlyMessages[field as string] || message;
};

/**
 * Check if password is in common password list
 */
const isCommonPassword = (password: string): boolean => {
  const commonPasswords = [
    'password', '123456', '123456789', 'qwerty', 'abc123',
    'password123', 'admin', 'letmein', 'welcome', 'monkey'
  ];
  return commonPasswords.includes(password.toLowerCase());
};

/**
 * Calculate password strength score
 */
const getPasswordStrength = (password: string): 'weak' | 'fair' | 'good' | 'strong' => {
  let score = 0;
  
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  if (!isCommonPassword(password)) score++;

  if (score < 3) return 'weak';
  if (score < 5) return 'fair';
  if (score < 6) return 'good';
  return 'strong';
};
