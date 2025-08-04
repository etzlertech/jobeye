// --- AGENT DIRECTIVE BLOCK ---
// file: /src/app/api/auth/refresh/route.ts
// purpose: Next.js API route for token refresh with Supabase Auth, voice session extension, session updates, and audit logging
// spec_ref: auth#refresh-route
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
//   - POST - Handle token refresh with session extension and audit logging
//   - RefreshRequest - Request payload interface for refresh endpoint
//   - RefreshResponse - Response payload interface for refresh endpoint
//   - VoiceRefreshRequest - Voice-specific refresh request interface
//
// voice_considerations: >
//   Voice session refresh should extend voice session timeouts for continuous device use.
//   Voice session extension should maintain conversation context and wake word state.
//   Voice refresh should be automatic and not interrupt ongoing voice interactions.
//   Voice session analytics should track refresh frequency for device optimization.
//
// security_considerations: >
//   Token refresh must validate existing session authenticity before issuing new tokens.
//   Refresh operations must update session security metadata including device fingerprints.
//   Expired or invalid refresh tokens must be rejected with proper error logging.
//   Session updates must maintain security flags and anomaly detection state.
//   Audit logging must track refresh patterns for security monitoring and fraud detection.
//   New auth cookies must be issued with secure settings and proper expiration times.
//
// performance_considerations: >
//   Token refresh should be fast and responsive to avoid interrupting user workflows.
//   Session updates should be efficient and use optimized database queries.
//   Refresh operations should be idempotent and safe for concurrent requests.
//   Voice session extension should minimize latency to maintain real-time interaction.
//   Audit logging should be asynchronous to avoid blocking refresh response.
//
// tasks:
//   1. [SETUP] Import Next.js server types, Supabase client, and auth utilities
//   2. [VALIDATION] Implement request validation for refresh parameters and session data
//   3. [REFRESH] Handle Supabase session refresh with proper error handling
//   4. [VOICE] Add voice session extension with timeout updates and context preservation
//   5. [SESSION] Update session records in database with new expiration and activity data
//   6. [COOKIES] Issue new auth cookies with updated tokens and secure configuration
//   7. [SECURITY] Update session security metadata and validate session integrity
//   8. [AUDIT] Implement refresh audit logging with session and security information
//   9. [RESPONSE] Format response with new tokens, session data, and expiration info
//  10. [ERROR] Handle all error cases with appropriate HTTP status codes and messages
// --- END DIRECTIVE BLOCK ---

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { isSessionExpired, sanitizeAuthError, maskSensitiveData } from '@/domains/auth/utils/auth-helpers';
import { logger } from '@/core/logger/logger';
import { supabase } from '@/core/database/connection';

// Request/Response Interfaces
interface RefreshRequest {
  refresh_token?: string;
  session_id?: string;
  extend_voice_session?: boolean;
  device_info?: {
    device_type: 'mobile' | 'desktop' | 'tablet' | 'voice_assistant';
    device_name?: string;
    last_activity?: string;
  };
}

interface VoiceRefreshRequest extends RefreshRequest {
  voice_session_id: string;
  conversation_context?: any;
  wake_word_active?: boolean;
}

interface RefreshResponse {
  success: boolean;
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  session_id?: string;
  voice_session_extended?: boolean;
  voice_session_expires_at?: string;
  user?: {
    id: string;
    email: string;
    role: string;
  };
  message?: string;
  error?: string;
}

/**
 * Handle POST requests for token refresh
 */
export async function POST(request: NextRequest): Promise<NextResponse<RefreshResponse>> {
  const startTime = Date.now();
  const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  try {
    // Parse request body (optional parameters)
    let body: RefreshRequest = {};
    try {
      const requestBody = await request.text();
      if (requestBody.trim()) {
        body = JSON.parse(requestBody) as RefreshRequest;
      }
    } catch {
      // Empty body is acceptable for refresh - will use cookies
      body = {};
    }

    // Create Supabase client
    const cookieStore = cookies();
    const supabaseClient = createRouteHandlerClient({ cookies: () => cookieStore });

    // Get current session
    const { data: { session: currentSession }, error: sessionError } = await supabaseClient.auth.getSession();

    if (sessionError || !currentSession) {
      logger.warn('Refresh failed - no valid session', {
        error: sessionError?.message,
        clientIP,
        userAgent
      });

      return NextResponse.json({
        success: false,
        error: 'No valid session found',
        message: 'Please log in again'
      }, { status: 401 });
    }

    // Check if session is already expired
    if (isSessionExpired(currentSession)) {
      logger.warn('Refresh failed - session expired', {
        userId: currentSession.user.id,
        expiresAt: currentSession.expires_at,
        clientIP
      });

      return NextResponse.json({
        success: false,
        error: 'Session expired',
        message: 'Please log in again'
      }, { status: 401 });
    }

    // Log refresh attempt
    logger.info('Token refresh attempt', {
      userId: currentSession.user.id,
      email: currentSession.user.email,
      clientIP,
      userAgent,
      sessionId: body.session_id,
      extendVoiceSession: body.extend_voice_session,
      deviceType: body.device_info?.device_type
    });

    // Perform token refresh
    const { data: refreshData, error: refreshError } = await supabaseClient.auth.refreshSession({
      refresh_token: body.refresh_token || currentSession.refresh_token
    });

    if (refreshError || !refreshData.session) {
      const sanitizedError = sanitizeAuthError(refreshError);
      
      await logRefreshFailure(currentSession.user.id, currentSession.user.email || null, clientIP, {
        error: refreshError?.message,
        code: refreshError?.code,
        userAgent
      });

      return NextResponse.json({
        success: false,
        error: sanitizedError.message,
        message: 'Failed to refresh session'
      }, { status: 401 });
    }

    const newSession = refreshData.session;

    // Update session record in database
    const sessionUpdateResult = await updateSessionRecord(
      currentSession.user.id,
      body.session_id,
      newSession,
      body.device_info,
      clientIP,
      userAgent
    );

    // Handle voice session extension if requested
    let voiceSessionExtended = false;
    let voiceSessionExpiresAt: string | undefined;

    if (body.extend_voice_session || body.device_info?.device_type === 'voice_assistant') {
      const voiceExtensionResult = await extendVoiceSession(
        currentSession.user.id,
        body as VoiceRefreshRequest,
        newSession
      );
      voiceSessionExtended = voiceExtensionResult.extended;
      voiceSessionExpiresAt = voiceExtensionResult.expiresAt;
    }

    // Log successful refresh
    await logSuccessfulRefresh(currentSession.user.id, currentSession.user.email || null, clientIP, {
      sessionId: sessionUpdateResult?.sessionId,
      voiceSessionExtended,
      deviceType: body.device_info?.device_type,
      userAgent,
      newExpiresAt: newSession.expires_at
    });

    const responseTime = Date.now() - startTime;
    logger.info('Token refresh completed successfully', {
      userId: currentSession.user.id,
      email: currentSession.user.email,
      responseTime,
      sessionId: sessionUpdateResult?.sessionId,
      voiceSessionExtended
    });

    // Prepare response
    const response: RefreshResponse = {
      success: true,
      access_token: newSession.access_token,
      refresh_token: newSession.refresh_token,
      expires_at: newSession.expires_at,
      expires_in: newSession.expires_in,
      session_id: sessionUpdateResult?.sessionId,
      voice_session_extended: voiceSessionExtended,
      voice_session_expires_at: voiceSessionExpiresAt,
      user: {
        id: newSession.user.id,
        email: newSession.user.email || '',
        role: newSession.user.user_metadata?.role || 'customer'
      },
      message: 'Session refreshed successfully'
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error('Token refresh error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      clientIP,
      userAgent,
      responseTime
    });

    const sanitizedError = sanitizeAuthError(error);
    return NextResponse.json({
      success: false,
      error: sanitizedError.message,
      message: 'Refresh operation failed'
    }, { status: 500 });
  }
}

/**
 * Update session record in database with new token data
 */
async function updateSessionRecord(
  userId: string,
  sessionId: string | undefined,
  newSession: any,
  deviceInfo: RefreshRequest['device_info'],
  clientIP: string,
  userAgent: string
): Promise<{ sessionId: string } | null> {
  try {
    const now = new Date().toISOString();
    const expiresAt = new Date(newSession.expires_at * 1000).toISOString();

    // If no session ID provided, try to find current session
    if (!sessionId) {
      const { data: sessions } = await supabase()
        .from('user_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .eq('ip_address', clientIP)
        .order('created_at', { ascending: false })
        .limit(1);

      sessionId = sessions?.[0]?.id;
    }

    // Update existing session or create new one if not found
    if (sessionId) {
      const { error } = await supabase()
        .from('user_sessions')
        .update({
          expires_at: expiresAt,
          last_activity_at: now,
          updated_at: now,
          refresh_count: supabase().rpc('increment_refresh_count', { session_id: sessionId })
        })
        .eq('id', sessionId)
        .eq('user_id', userId);

      if (error) {
        logger.error('Session update error', { error: error.message, sessionId, userId });
        return null;
      }

      logger.debug('Session updated successfully', { sessionId, userId, expiresAt });
      return { sessionId };
    } else {
      // Create new session record if none found
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      
      const { error } = await supabase()
        .from('user_sessions')
        .insert({
          id: newSessionId,
          user_id: userId,
          device_type: deviceInfo?.device_type || 'unknown',
          device_name: deviceInfo?.device_name,
          ip_address: clientIP,
          user_agent: userAgent,
          expires_at: expiresAt,
          last_activity_at: now,
          created_at: now,
          is_active: true,
          refresh_count: 1
        });

      if (error) {
        logger.error('New session creation error', { error: error.message, userId });
        return null;
      }

      logger.info('New session created during refresh', { sessionId: newSessionId, userId });
      return { sessionId: newSessionId };
    }
  } catch (error) {
    logger.error('Session record update exception', {
      error: error instanceof Error ? error.message : 'Unknown',
      userId,
      sessionId
    });
    return null;
  }
}

/**
 * Extend voice session timeout for continuous voice interaction
 */
async function extendVoiceSession(
  userId: string,
  voiceRequest: VoiceRefreshRequest,
  newSession: any
): Promise<{ extended: boolean; expiresAt?: string }> {
  try {
    // Voice sessions get extended timeout (8 hours instead of standard 24)
    const voiceSessionDuration = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
    const voiceExpiresAt = new Date(Date.now() + voiceSessionDuration).toISOString();

    // Update voice-specific session data
    const { error } = await supabase()
      .from('user_sessions')
      .update({
        expires_at: voiceExpiresAt,
        voice_session_active: true,
        voice_session_expires_at: voiceExpiresAt,
        wake_word_active: voiceRequest.wake_word_active || false,
        conversation_context: voiceRequest.conversation_context,
        last_activity_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('device_type', 'voice_assistant')
      .eq('is_active', true);

    if (error) {
      logger.error('Voice session extension error', { 
        error: error.message, 
        userId,
        voiceSessionId: voiceRequest.voice_session_id 
      });
      return { extended: false };
    }

    logger.info('Voice session extended', {
      userId,
      voiceSessionId: voiceRequest.voice_session_id,
      expiresAt: voiceExpiresAt,
      wakeWordActive: voiceRequest.wake_word_active
    });

    return { extended: true, expiresAt: voiceExpiresAt };

  } catch (error) {
    logger.error('Voice session extension exception', {
      error: error instanceof Error ? error.message : 'Unknown',
      userId,
      voiceSessionId: voiceRequest.voice_session_id
    });
    return { extended: false };
  }
}

/**
 * Log failed refresh attempt
 */
async function logRefreshFailure(
  userId: string,
  userEmail: string | null,
  clientIP: string,
  details: any
): Promise<void> {
  try {
    await supabase()
      .from('auth_audit_log')
      .insert({
        event_type: 'refresh_failed',
        user_id: userId,
        user_email: userEmail,
        ip_address: clientIP,
        details: {
          ...details,
          // Mask sensitive data in logs
          refresh_token: details.refresh_token ? maskSensitiveData(details.refresh_token) : undefined
        },
        created_at: new Date().toISOString()
      });

    logger.warn('Token refresh failed', {
      userId,
      email: userEmail,
      clientIP,
      error: details.error,
      code: details.code
    });
  } catch (error) {
    logger.error('Failed to log refresh failure', { error });
  }
}

/**
 * Log successful refresh event
 */
async function logSuccessfulRefresh(
  userId: string,
  userEmail: string | null,
  clientIP: string,
  details: any
): Promise<void> {
  try {
    await supabase()
      .from('auth_audit_log')
      .insert({
        event_type: 'refresh_success',
        user_id: userId,
        user_email: userEmail,
        ip_address: clientIP,
        details,
        created_at: new Date().toISOString()
      });

    logger.info('Token refresh successful', {
      userId,
      email: userEmail,
      clientIP,
      sessionId: details.sessionId,
      voiceSessionExtended: details.voiceSessionExtended
    });
  } catch (error) {
    logger.error('Failed to log successful refresh', { error });
  }
}