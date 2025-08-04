// --- AGENT DIRECTIVE BLOCK ---
// file: /src/app/api/auth/logout/route.ts
// purpose: Next.js API route for user logout with Supabase Auth signOut, session cleanup, voice session termination, and audit logging
// spec_ref: auth#logout-route
// version: 2025-08-1
// domain: authentication
// phase: 1
// complexity_budget: low
// offline_capability: NONE
//
// dependencies:
//   - internal: ['src/domains/auth/types/auth-types.ts', 'src/domains/auth/utils/auth-helpers.ts', 'src/core/database/connection.ts', 'src/core/logger/logger.ts']
//   - external: ['next/server', '@supabase/supabase-js', '@supabase/auth-helpers-nextjs']
//
// exports:
//   - POST - Handle user logout with session cleanup and audit logging
//   - LogoutRequest - Request payload interface for logout endpoint
//   - LogoutResponse - Response payload interface for logout endpoint
//   - VoiceLogoutRequest - Voice-specific logout request interface
//
// voice_considerations: >
//   Voice logout should provide clear confirmation of successful logout.
//   Voice session termination should handle graceful disconnection from voice services.
//   Voice logout should support natural language commands like "sign out" or "log me out".
//   Voice feedback should confirm all sessions have been terminated safely.
//
// security_considerations: >
//   All logout operations must invalidate sessions across all devices if requested.
//   Session cleanup must be thorough to prevent session hijacking or reuse.
//   Voice session termination must securely disconnect from voice services.
//   Audit logging must track logout events with device and session information.
//   Cookie clearing must be comprehensive and secure to prevent session persistence.
//   Logout must be idempotent and safe to call multiple times without side effects.
//
// performance_considerations: >
//   Logout operations should be fast and responsive for good user experience.
//   Session cleanup should be efficient and avoid unnecessary database operations.
//   Audit logging should be asynchronous to avoid blocking the logout response.
//   Cookie clearing should be optimized and not cause client-side delays.
//   Voice session termination should timeout quickly if voice services are unavailable.
//
// tasks:
//   1. [SETUP] Import Next.js server types, Supabase client, and auth utilities
//   2. [VALIDATION] Implement request validation for logout parameters and options
//   3. [AUTH] Handle Supabase signOut with proper error handling and cleanup
//   4. [VOICE] Add voice logout support with session termination and confirmation
//   5. [SESSION] Clean up session records in database with proper cascade deletion
//   6. [COOKIES] Clear all authentication cookies with secure configuration
//   7. [VOICE_SESSION] Terminate voice sessions and disconnect from voice services
//   8. [AUDIT] Implement logout audit logging with session and device information
//   9. [RESPONSE] Format response with logout confirmation and optional redirect
//  10. [ERROR] Handle all error cases with appropriate HTTP status codes and messages
// --- END DIRECTIVE BLOCK ---

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { sanitizeAuthError, generateSessionId } from '@/domains/auth/utils/auth-helpers';
import { logger } from '@/core/logger/logger';
import { supabase } from '@/core/database/connection';

// Request/Response Interfaces
interface LogoutRequest {
  logout_all_devices?: boolean;
  redirect_url?: string;
  voice_command?: string;
  session_id?: string;
}

interface VoiceLogoutRequest {
  voice_command: string;
  confidence: number;
  device_info: {
    device_type: 'voice_assistant';
    device_name?: string;
  };
  logout_all_devices?: boolean;
}

interface LogoutResponse {
  success: boolean;
  message: string;
  voice_message?: string;
  redirect_url?: string;
  sessions_cleared?: number;
  voice_session_terminated?: boolean;
  error?: string;
}

/**
 * Handle POST requests for user logout
 */
export async function POST(request: NextRequest): Promise<NextResponse<LogoutResponse>> {
  const startTime = Date.now();
  const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    // Parse request body (optional parameters)
    let body: LogoutRequest = {};
    try {
      const requestBody = await request.text();
      if (requestBody.trim()) {
        body = JSON.parse(requestBody) as LogoutRequest;
      }
    } catch {
      // Empty body is acceptable for logout
      body = {};
    }

    // Create Supabase client
    const cookieStore = cookies();
    const supabaseClient = createRouteHandlerClient({ cookies: () => cookieStore });

    // Get current session for logging purposes
    const { data: { session: currentSession }, error: sessionError } = await supabaseClient.auth.getSession();
    
    let userId: string | null = null;
    let userEmail: string | null = null;
    let sessionId: string | null = body.session_id || null;

    if (currentSession && !sessionError) {
      userId = currentSession.user.id;
      userEmail = currentSession.user.email || null;
    }

    // Log logout attempt
    logger.info('Logout attempt started', {
      userId,
      userEmail,
      clientIP,
      userAgent,
      logoutAllDevices: body.logout_all_devices,
      hasVoiceCommand: !!body.voice_command,
      sessionId
    });

    // Handle voice logout if voice command provided
    if (body.voice_command) {
      return await handleVoiceLogout(
        body as VoiceLogoutRequest,
        userId,
        userEmail,
        clientIP,
        userAgent,
        supabaseClient
      );
    }

    // Perform Supabase logout
    const { error: signOutError } = await supabaseClient.auth.signOut();
    
    if (signOutError) {
      logger.warn('Supabase signOut error', {
        error: signOutError.message,
        userId,
        userEmail
      });
      // Continue with cleanup even if Supabase signOut fails
    }

    // Clean up session records in database
    let sessionsCleared = 0;
    if (userId) {
      sessionsCleared = await cleanupSessionRecords(userId, body.logout_all_devices, sessionId);
    }

    // Terminate voice sessions if applicable
    const voiceSessionTerminated = await terminateVoiceSessions(userId, sessionId);

    // Clear authentication cookies
    await clearAuthCookies();

    // Log successful logout
    await logSuccessfulLogout(userId, userEmail, clientIP, {
      sessionsCleared,
      voiceSessionTerminated,
      logoutAllDevices: body.logout_all_devices,
      userAgent,
      sessionId
    });

    const responseTime = Date.now() - startTime;
    logger.info('Logout completed successfully', {
      userId,
      userEmail,
      responseTime,
      sessionsCleared,
      voiceSessionTerminated
    });

    // Prepare response
    const response: LogoutResponse = {
      success: true,
      message: 'Successfully logged out',
      voice_message: 'You have been successfully signed out',
      sessions_cleared: sessionsCleared,
      voice_session_terminated: voiceSessionTerminated
    };

    // Add redirect URL if provided and valid
    if (body.redirect_url && isValidRedirectUrl(body.redirect_url)) {
      response.redirect_url = body.redirect_url;
    }

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('Logout error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      clientIP,
      userAgent,
      responseTime
    });

    const sanitizedError = sanitizeAuthError(error);
    return NextResponse.json({
      success: false,
      message: sanitizedError.message,
      voice_message: sanitizedError.voiceMessage,
      error: sanitizedError.message
    }, { status: 500 });
  }
}

/**
 * Handle voice-based logout requests
 */
async function handleVoiceLogout(
  request: VoiceLogoutRequest,
  userId: string | null,
  userEmail: string | null,
  clientIP: string,
  userAgent: string,
  supabaseClient: any
): Promise<NextResponse<LogoutResponse>> {
  try {
    // Validate voice command for logout operations
    const validLogoutCommands = [
      'sign out',
      'log out',
      'log me out',
      'sign me out',
      'logout',
      'signout',
      'end session',
      'goodbye'
    ];

    const commandMatches = validLogoutCommands.some(cmd => 
      request.voice_command.toLowerCase().includes(cmd)
    );

    if (!commandMatches || request.confidence < 0.6) {
      return NextResponse.json({
        success: false,
        message: 'Voice command not understood',
        voice_message: 'I didn\'t understand that logout command. Please try saying "sign out" or "log me out".',
        error: 'Voice command not recognized'
      }, { status: 400 });
    }

    // Perform standard logout process
    const { error: signOutError } = await supabaseClient.auth.signOut();
    
    if (signOutError) {
      logger.warn('Voice logout - Supabase signOut error', {
        error: signOutError.message,
        userId,
        userEmail,
        voiceCommand: request.voice_command
      });
    }

    // Clean up sessions
    const sessionsCleared = userId ? await cleanupSessionRecords(
      userId, 
      request.logout_all_devices, 
      null
    ) : 0;

    // Terminate voice sessions with priority
    const voiceSessionTerminated = await terminateVoiceSessions(userId, null, true);

    // Clear cookies
    await clearAuthCookies();

    // Log voice logout
    await logSuccessfulLogout(userId, userEmail, clientIP, {
      sessionsCleared,
      voiceSessionTerminated,
      voiceCommand: request.voice_command,
      confidence: request.confidence,
      deviceType: request.device_info.device_type,
      userAgent
    });

    return NextResponse.json({
      success: true,
      message: 'Voice logout successful',
      voice_message: 'You have been successfully signed out. Goodbye!',
      sessions_cleared: sessionsCleared,
      voice_session_terminated: voiceSessionTerminated
    }, { status: 200 });

  } catch (error) {
    logger.error('Voice logout error', {
      error: error instanceof Error ? error.message : 'Unknown',
      userId,
      voiceCommand: request.voice_command
    });

    return NextResponse.json({
      success: false,
      message: 'Voice logout failed',
      voice_message: 'Sorry, I encountered an error during logout. Please try again.',
      error: 'Voice logout processing failed'
    }, { status: 500 });
  }
}

/**
 * Clean up session records in database
 */
async function cleanupSessionRecords(
  userId: string,
  logoutAllDevices: boolean = false,
  currentSessionId: string | null = null
): Promise<number> {
  try {
    let query = supabase()
      .from('user_sessions')
      .update({
        is_active: false,
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('is_active', true);

    // If not logging out all devices, only target current session
    if (!logoutAllDevices && currentSessionId) {
      query = query.eq('id', currentSessionId);
    }

    const { data, error } = await query.select('id');

    if (error) {
      logger.error('Session cleanup error', { error: error.message, userId });
      return 0;
    }

    const clearedCount = data?.length || 0;
    logger.info('Sessions cleaned up', { userId, sessionsCleared: clearedCount, logoutAllDevices });

    return clearedCount;
  } catch (error) {
    logger.error('Session cleanup exception', { error: error instanceof Error ? error.message : 'Unknown', userId });
    return 0;
  }
}

/**
 * Terminate voice sessions
 */
async function terminateVoiceSessions(
  userId: string | null,
  sessionId: string | null = null,
  isVoiceLogout: boolean = false
): Promise<boolean> {
  if (!userId) return false;

  try {
    // Update voice sessions to terminated state
    let query = supabase()
      .from('user_sessions')
      .update({
        is_active: false,
        ended_at: new Date().toISOString(),
        voice_session_terminated: true,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('device_type', 'voice_assistant')
      .eq('is_active', true);

    if (sessionId) {
      query = query.eq('id', sessionId);
    }

    const { error } = await query;

    if (error) {
      logger.error('Voice session termination error', { error: error.message, userId });
      return false;
    }

    // Additional cleanup for voice-specific data could be added here
    // e.g., clearing voice conversation history, resetting wake word listeners, etc.

    logger.info('Voice sessions terminated', { userId, isVoiceLogout, sessionId });
    return true;

  } catch (error) {
    logger.error('Voice session termination exception', { 
      error: error instanceof Error ? error.message : 'Unknown', 
      userId 
    });
    return false;
  }
}

/**
 * Clear authentication cookies
 */
async function clearAuthCookies(): Promise<void> {
  try {
    const cookieStore = cookies();
    
    // List of auth-related cookies to clear
    const authCookies = [
      'supabase-auth-token',
      'supabase.auth.token',
      'sb-auth-token',
      'session-token',
      'auth-session',
      'voice-session'
    ];

    // Clear each cookie with secure settings
    authCookies.forEach(cookieName => {
      try {
        cookieStore.delete({
          name: cookieName,
          path: '/',
          domain: undefined,
          secure: true,
          httpOnly: true,
          sameSite: 'lax'
        });
      } catch {
        // Individual cookie deletion errors are not critical
      }
    });

    logger.debug('Authentication cookies cleared');
  } catch (error) {
    logger.warn('Cookie clearing error', { 
      error: error instanceof Error ? error.message : 'Unknown' 
    });
  }
}

/**
 * Validate redirect URL for security
 */
function isValidRedirectUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    
    // Only allow same-origin redirects for security
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_APP_URL,
      'http://localhost:3000',
      'https://localhost:3000'
    ].filter(Boolean);

    return allowedOrigins.some(origin => parsedUrl.origin === origin);
  } catch {
    return false;
  }
}

/**
 * Log successful logout event
 */
async function logSuccessfulLogout(
  userId: string | null,
  userEmail: string | null,
  clientIP: string,
  details: any
): Promise<void> {
  try {
    await supabase()
      .from('auth_audit_log')
      .insert({
        event_type: 'logout_success',
        user_id: userId,
        user_email: userEmail,
        ip_address: clientIP,
        details,
        created_at: new Date().toISOString()
      });

    logger.info('Logout successful', {
      userId,
      email: userEmail,
      clientIP,
      details
    });
  } catch (error) {
    logger.error('Failed to log successful logout', { error });
  }
}