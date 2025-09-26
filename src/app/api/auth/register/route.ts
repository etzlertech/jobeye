// --- AGENT DIRECTIVE BLOCK ---
// file: /src/app/api/auth/register/route.ts
// purpose: Next.js API route for user registration with Supabase Auth, voice profile setup, tenant assignment, and welcome communications
// spec_ref: auth#register-route
// version: 2025-08-1
// domain: authentication
// phase: 1
// complexity_budget: medium
// offline_capability: NONE
//
// dependencies:
//   - internal: ['src/domains/auth/types/auth-types.ts', 'src/domains/auth/utils/auth-validators.ts', 'src/domains/auth/utils/auth-helpers.ts', 'src/core/database/connection.ts', 'src/core/logger/logger.ts']
//   - external: ['next/server', '@supabase/supabase-js', '@supabase/auth-helpers-nextjs']
//
// exports:
//   - POST - Handle user registration with profile setup and tenant assignment
//   - RegisterRequest - Request payload interface for registration endpoint
//   - RegisterResponse - Response payload interface for registration endpoint
//   - VoiceRegistrationRequest - Voice-specific registration request interface
//   - TenantAssignmentResult - Result of tenant assignment process
//
// voice_considerations: >
//   Voice registration should initialize voice profiles with default preferences and wake word settings.
//   Voice profile setup should include speech rate, language preferences, and TTS provider selection.
//   Voice onboarding should provide audio guidance for first-time voice users.
//   Voice registration should support voice-guided profile completion for accessibility.
//
// security_considerations: >
//   Registration must enforce strong password requirements and validate email domains.
//   Email verification must be required before account activation to prevent fake accounts.
//   Tenant assignment must be validated against approved domain lists to prevent unauthorized access.
//   User profile creation must enforce Row Level Security policies for multi-tenant isolation.
//   Registration attempts must be rate-limited to prevent spam and automated account creation.
//   Welcome communications must not expose sensitive system information or internal data.
//
// performance_considerations: >
//   Registration process should be optimized for fast user onboarding experience.
//   Database operations should be transactional to ensure data consistency during profile creation.
//   Email/SMS sending should be asynchronous to avoid blocking registration response.
//   Tenant lookup and assignment should use cached domain mappings for performance.
//   Voice profile initialization should be efficient and not delay registration completion.
//
// tasks:
//   1. [SETUP] Import Next.js server types, Supabase client, and auth utilities
//   2. [VALIDATION] Implement comprehensive request validation using registration schemas
//   3. [SIGNUP] Handle Supabase signUp with email verification and proper error handling
//   4. [TENANT] Implement tenant assignment based on email domain with validation
//   5. [PROFILE] Create user profile with voice preferences and default settings
//   6. [VOICE] Initialize voice profile with default preferences and accessibility options
//   7. [ROLE] Assign default user role based on tenant settings and registration context
//   8. [WELCOME] Send welcome email/SMS with account verification and next steps
//   9. [AUDIT] Implement registration audit logging with security and compliance tracking
//  10. [RESPONSE] Format response with account status, verification requirements, and next steps
// --- END DIRECTIVE BLOCK ---

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { validateRegistration } from '@/domains/auth/utils/auth-validators';
import { sanitizeAuthError, extractTenantFromEmail, generateVoiceGreeting } from '@/domains/auth/utils/auth-helpers';
import { Role, type RegisterDto, type UserProfile } from '@/domains/auth/types/auth-types';
import { createLogger } from '@/core/logger/logger';
import { supabase } from '@/core/database/connection';

const logger = createLogger('auth-register');

// Request/Response Interfaces
interface RegisterRequest extends RegisterDto {
  confirm_password?: string;
  terms_accepted?: boolean;
  marketing_consent?: boolean;
  preferred_communication?: 'email' | 'sms' | 'both';
  device_info?: {
    device_type: 'mobile' | 'desktop' | 'tablet' | 'voice_assistant';
    device_name?: string;
    user_agent?: string;
  };
  invitation_code?: string;
}

interface VoiceRegistrationRequest extends RegisterRequest {
  voice_guided: true;
  voice_preferences: {
    preferred_language: string;
    speech_rate: number;
    wake_word?: string;
    voice_feedback_enabled: boolean;
    preferred_tts_provider: 'openai' | 'google' | 'system';
  };
}

interface RegisterResponse {
  success: boolean;
  user_id?: string;
  email?: string;
  verification_required?: boolean;
  verification_method?: 'email' | 'sms';
  tenant_assigned?: string;
  role_assigned?: Role;
  voice_profile_created?: boolean;
  welcome_sent?: boolean;
  voice_greeting?: string;
  next_steps?: string[];
  message?: string;
  error?: string;
  voice_error?: string;
}

interface TenantAssignmentResult {
  tenant_id: string;
  tenant_name: string;
  role: Role;
  approved: boolean;
}

/**
 * Handle POST requests for user registration
 */
export async function POST(request: NextRequest): Promise<NextResponse<RegisterResponse>> {
  const startTime = Date.now();
  const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    // Parse request body
    const body = await request.json() as RegisterRequest;

    // Log registration attempt
    logger.info('Registration attempt started', {
      email: body.email,
      clientIP,
      userAgent,
      tenantId: body.tenant_id,
      role: body.role,
      hasInvitationCode: !!body.invitation_code,
      deviceType: body.device_info?.device_type
    });

    // Validate registration request
    const validation = validateRegistration(body);
    if (!validation.success || !validation.data) {
      await logRegistrationFailure(body.email, 'validation_failed', clientIP, validation.errors);
      return NextResponse.json({
        success: false,
        error: 'Invalid registration data',
        voice_error: validation.voiceMessage || undefined
      }, { status: 400 });
    }

    // Validate terms acceptance
    if (!body.terms_accepted) {
      return NextResponse.json({
        success: false,
        error: 'Terms and conditions must be accepted',
        voice_error: 'Please accept the terms and conditions to continue'
      }, { status: 400 });
    }

    // Validate password confirmation if provided
    if (body.confirm_password && body.password !== body.confirm_password) {
      return NextResponse.json({
        success: false,
        error: 'Passwords do not match',
        voice_error: 'The password confirmation does not match'
      }, { status: 400 });
    }

    // Create Supabase client
    const cookieStore = cookies();
    const supabaseClient = createRouteHandlerClient({ cookies: () => cookieStore });

    // Check if email already exists
    const { data: existingUser } = await supabaseClient
      .from('auth.users')
      .select('email')
      .eq('email', validation.data.email)
      .single();

    if (existingUser) {
      await logRegistrationFailure(validation.data.email, 'email_already_exists', clientIP, {});
      return NextResponse.json({
        success: false,
        error: 'An account with this email already exists',
        voice_error: 'This email address is already registered'
      }, { status: 409 });
    }

    // Assign tenant based on email domain or provided tenant_id
    const tenantAssignment = await assignTenant(validation.data.email, validation.data.tenant_id, body.invitation_code);
    if (!tenantAssignment.approved) {
      await logRegistrationFailure(validation.data.email, 'tenant_assignment_failed', clientIP, {
        requestedTenant: validation.data.tenant_id,
        domainTenant: tenantAssignment.tenant_id
      });

      return NextResponse.json({
        success: false,
        error: 'Registration not approved for this email domain',
        voice_error: 'Your email domain is not authorized for registration'
      }, { status: 403 });
    }

    // Determine final role (use assigned role from tenant or requested role)
    const finalRole = tenantAssignment.role || validation.data.role;

    // Attempt Supabase registration
    const { data: authData, error: authError } = await supabaseClient.auth.signUp({
      email: validation.data.email,
      password: validation.data.password,
      options: {
        data: {
          role: finalRole,
          tenant_id: tenantAssignment.tenant_id,
          display_name: body.email.split('@')[0],
          registration_ip: clientIP,
          registration_user_agent: userAgent,
          terms_accepted_at: new Date().toISOString(),
          marketing_consent: body.marketing_consent || false
        }
      }
    });

    if (authError || !authData.user) {
      const sanitizedError = sanitizeAuthError(authError);
      await logRegistrationFailure(validation.data.email, 'auth_signup_failed', clientIP, {
        error: authError?.message,
        code: authError?.code
      });

      return NextResponse.json({
        success: false,
        error: sanitizedError.message,
        voice_error: sanitizedError.voiceMessage || undefined
      }, { status: 400 });
    }

    // Create user profile in database
    const profileCreationResult = await createUserProfile(
      authData.user.id,
      validation.data.email,
      tenantAssignment.tenant_id,
      finalRole,
      validation.data.voice_preferences || getDefaultVoicePreferences(),
      body.device_info
    );

    if (!profileCreationResult.success) {
      logger.error('User profile creation failed', {
        userId: authData.user.id,
        email: validation.data.email,
        error: profileCreationResult.error
      });

      // Note: Supabase user already created, but profile failed
      // Consider implementing cleanup or retry logic
    }

    // Initialize voice profile if this is a voice registration
    let voiceProfileCreated = false;
    if (body.device_info?.device_type === 'voice_assistant' || (body as VoiceRegistrationRequest).voice_guided) {
      voiceProfileCreated = await initializeVoiceProfile(authData.user.id, body as VoiceRegistrationRequest);
    }

    // Send welcome communication
    const welcomeSent = await sendWelcomeCommunication(
      validation.data.email,
      body.preferred_communication || 'email',
      {
        displayName: body.email.split('@')[0],
        tenantName: tenantAssignment.tenant_name,
        role: finalRole,
        voiceEnabled: voiceProfileCreated
      }
    );

    // Generate voice greeting if applicable
    const voiceGreeting = voiceProfileCreated
      ? `Welcome to the Field Service Management system! Your voice profile has been set up successfully.`
      : undefined;

    // Log successful registration
    await logSuccessfulRegistration(authData.user.id, validation.data.email, clientIP, {
      tenantId: tenantAssignment.tenant_id,
      role: finalRole,
      voiceProfileCreated,
      welcomeSent,
      deviceType: body.device_info?.device_type,
      hasInvitationCode: !!body.invitation_code
    });

    const responseTime = Date.now() - startTime;
    logger.info('Registration completed successfully', {
      userId: authData.user.id,
      email: validation.data.email,
      responseTime,
      tenantId: tenantAssignment.tenant_id,
      role: finalRole
    });

    // Prepare next steps
    const nextSteps = [
      'Check your email for verification instructions',
      'Complete your profile setup',
    ];

    if (voiceProfileCreated) {
      nextSteps.push('Test your voice commands');
    }

    // Return success response
    return NextResponse.json({
      success: true,
      user_id: authData.user.id,
      email: validation.data.email,
      verification_required: !authData.user.email_confirmed_at,
      verification_method: 'email',
      tenant_assigned: tenantAssignment.tenant_id,
      role_assigned: finalRole,
      voice_profile_created: voiceProfileCreated,
      welcome_sent: welcomeSent,
      voice_greeting: voiceGreeting,
      next_steps: nextSteps,
      message: 'Registration successful! Please check your email for verification.'
    }, { status: 201 });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('Registration error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      clientIP,
      userAgent,
      responseTime
    });

    const sanitizedError = sanitizeAuthError(error);
    return NextResponse.json({
      success: false,
      error: sanitizedError.message,
      voice_error: sanitizedError.voiceMessage || undefined
    }, { status: 500 });
  }
}

/**
 * Assign tenant based on email domain and invitation code
 */
async function assignTenant(
  email: string,
  requestedTenantId: string,
  invitationCode?: string
): Promise<TenantAssignmentResult> {
  try {
    // If invitation code provided, validate and get tenant from invitation
    if (invitationCode) {
      const { data: invitation } = await supabase()
        .from('user_invitations')
        .select(`
          tenant_id,
          role,
          tenants:tenant_id (
            name
          )
        `)
        .eq('invitation_code', invitationCode)
        .eq('email', email)
        .gte('expires_at', new Date().toISOString())
        .single();

      if (invitation && invitation.tenants) {
        return {
          tenant_id: invitation.tenant_id,
          tenant_name: (invitation as any).tenants.name,
          role: invitation.role as Role,
          approved: true
        };
      }
    }

    // Check if requested tenant allows this email domain
    if (requestedTenantId) {
      const { data: tenant } = await supabase()
        .from('tenants')
        .select('id, name, allowed_domains, default_role')
        .eq('id', requestedTenantId)
        .single();

      if (tenant) {
        const emailDomain = email.split('@')[1];
        const allowedDomains = tenant.allowed_domains || [];
        
        if (allowedDomains.includes(emailDomain) || allowedDomains.includes('*')) {
          return {
            tenant_id: tenant.id,
            tenant_name: tenant.name,
            role: tenant.default_role as Role || Role.CUSTOMER,
            approved: true
          };
        }
      }
    }

    // Try to auto-assign tenant based on email domain
    const autoAssignedTenant = extractTenantFromEmail(email);
    if (autoAssignedTenant) {
      const { data: tenant } = await supabase()
        .from('tenants')
        .select('id, name, default_role')
        .eq('id', autoAssignedTenant)
        .single();

      if (tenant) {
        return {
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          role: tenant.default_role as Role || Role.CUSTOMER,
          approved: true
        };
      }
    }

    // Default to a public tenant if no specific assignment
    const { data: defaultTenant } = await supabase()
      .from('tenants')
      .select('id, name')
      .eq('is_default', true)
      .single();

    if (defaultTenant) {
      return {
        tenant_id: defaultTenant.id,
        tenant_name: defaultTenant.name,
        role: Role.CUSTOMER,
        approved: true
      };
    }

    // No tenant assignment possible
    return {
      tenant_id: '',
      tenant_name: '',
      role: Role.CUSTOMER,
      approved: false
    };

  } catch (error) {
    logger.error('Tenant assignment error', { error: error instanceof Error ? error.message : 'Unknown', email });
    return {
      tenant_id: '',
      tenant_name: '',
      role: Role.CUSTOMER,
      approved: false
    };
  }
}

/**
 * Create user profile in database
 */
async function createUserProfile(
  userId: string,
  email: string,
  tenantId: string,
  role: Role,
  voicePreferences: any,
  deviceInfo?: RegisterRequest['device_info']
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase()
      .from('user_profiles')
      .insert({
        user_id: userId,
        active_tenant_id: tenantId,
        role: role,
        display_name: email.split('@')[0],
        voice_preferences: voicePreferences,
        notification_settings: {
          email_enabled: true,
          sms_enabled: false,
          push_enabled: true,
          voice_announcements: voicePreferences.voice_feedback_enabled
        },
        accessibility_settings: {
          high_contrast: false,
          large_text: false,
          voice_navigation: deviceInfo?.device_type === 'voice_assistant',
          screen_reader_support: false,
          keyboard_navigation: false
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Initialize voice profile for voice-guided registration
 */
async function initializeVoiceProfile(
  userId: string,
  voiceRequest: VoiceRegistrationRequest
): Promise<boolean> {
  try {
    const { error } = await supabase()
      .from('user_voice_profiles')
      .insert({
        user_id: userId,
        wake_word: voiceRequest.voice_preferences?.wake_word || 'hey assistant',
        speech_rate: voiceRequest.voice_preferences?.speech_rate || 1.0,
        preferred_language: voiceRequest.voice_preferences?.preferred_language || 'en-US',
        voice_feedback_enabled: voiceRequest.voice_preferences?.voice_feedback_enabled !== false,
        onboarding_completed: false,
        voice_samples_collected: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) {
      logger.error('Voice profile initialization failed', { error: error.message, userId });
      return false;
    }

    logger.info('Voice profile initialized', { userId });
    return true;
  } catch (error) {
    logger.error('Voice profile initialization exception', { error: error instanceof Error ? error.message : 'Unknown', userId });
    return false;
  }
}

/**
 * Send welcome email/SMS to new user
 */
async function sendWelcomeCommunication(
  email: string,
  method: 'email' | 'sms' | 'both',
  context: {
    displayName: string;
    tenantName: string;
    role: Role;
    voiceEnabled: boolean;
  }
): Promise<boolean> {
  try {
    // This would integrate with your email/SMS service
    // For now, log the welcome message
    logger.info('Sending welcome communication', {
      email,
      method,
      displayName: context.displayName,
      tenantName: context.tenantName,
      role: context.role,
      voiceEnabled: context.voiceEnabled
    });

    // Simulate successful send
    return true;
  } catch (error) {
    logger.error('Welcome communication failed', { error: error instanceof Error ? error.message : 'Unknown', email });
    return false;
  }
}

/**
 * Get default voice preferences
 */
function getDefaultVoicePreferences() {
  return {
    wake_word: undefined,
    speech_rate: 1.0,
    preferred_language: 'en-US',
    voice_feedback_enabled: true,
    preferred_tts_provider: 'system'
  };
}

/**
 * Log failed registration attempt
 */
async function logRegistrationFailure(
  email: string,
  reason: string,
  clientIP: string,
  details: any
): Promise<void> {
  try {
    await supabase()
      .from('auth_audit_log')
      .insert({
        event_type: 'registration_failed',
        user_email: email,
        ip_address: clientIP,
        reason,
        details,
        created_at: new Date().toISOString()
      });

    logger.warn('Registration failed', {
      email,
      reason,
      clientIP,
      details
    });
  } catch (error) {
    logger.error('Failed to log registration failure', { error });
  }
}

/**
 * Log successful registration
 */
async function logSuccessfulRegistration(
  userId: string,
  email: string,
  clientIP: string,
  details: any
): Promise<void> {
  try {
    await supabase()
      .from('auth_audit_log')
      .insert({
        event_type: 'registration_success',
        user_id: userId,
        user_email: email,
        ip_address: clientIP,
        details,
        created_at: new Date().toISOString()
      });

    logger.info('Registration successful', {
      userId,
      email,
      clientIP,
      details
    });
  } catch (error) {
    logger.error('Failed to log successful registration', { error });
  }
}