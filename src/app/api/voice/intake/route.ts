// --- AGENT DIRECTIVE BLOCK ---
// file: /src/app/api/voice/intake/route.ts
// phase: 3
// domain: voice-pipeline
// version: 1.0.0
// purpose: API endpoint for voice recording intake and signed URL generation
// spec_ref: v4.0/api-patterns.md#voice-intake
// complexity_budget: 150 LoC
//
// migrations_touched:
//   - 2025-10-voice-vision-p0.sql
//
// dependencies:
//   internal:
//     - /src/domains/voice/services/voice-intake-service.ts
//     - /src/core/logger/logger.ts
//   external:
//     - npm: '@supabase/supabase-js'
//   supabase:
//     - auth: required
//
// exports:
//   - function POST(request: Request): Promise<Response>
//
// voice_considerations: >
//   Validate audio file types and sizes before generating upload URLs.
//   Return clear error messages for voice UI to display.
//
// offline_capability: NONE
//
// test_requirements:
//   coverage: 0.9
//   test_file: /src/app/api/voice/intake/__tests__/route.test.ts
//
// tasks:
//   1. [AUTH] Verify JWT authentication
//   2. [VALIDATE] Check request body schema
//   3. [SESSION] Validate session ownership
//   4. [SERVICE] Call voice intake service
//   5. [RESPONSE] Return upload URL and metadata
//   6. [ERROR] Handle and log failures
// --- END DIRECTIVE BLOCK ---

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { createVoiceIntakeService } from '@/domains/voice/services/voice-intake-service';
import { Logger } from '@/core/logger/logger';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

const logger = new Logger('voice-intake-api');

// Request validation schema
const VoiceIntakeRequestSchema = z.object({
  sessionId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().positive().max(52428800), // 50MB limit
  mimeType: z.enum(['audio/webm', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mpeg'])
});

export async function POST(request: NextRequest) {
  try {
    // Initialize Supabase client with auth
    const supabase = createRouteHandlerClient({ cookies });
    
    // Check authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = VoiceIntakeRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const { sessionId, fileName, fileSize, mimeType } = validationResult.data;

    // Verify session belongs to user's company
    const { data: sessionData, error: sessionError } = await supabase
      .from('conversation_sessions')
      .select('id, user_id')
      .eq('id', sessionId)
      .eq('user_id', session.user.id)
      .single();

    if (sessionError || !sessionData) {
      logger.warn('Invalid session access attempt', { 
        sessionId, 
        userId: session.user.id 
      });
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 403 }
      );
    }

    // Create voice upload session
    const voiceIntakeService = createVoiceIntakeService(supabase);
    const uploadResponse = await voiceIntakeService.createVoiceUpload({
      sessionId,
      fileName,
      fileSize,
      mimeType
    });

    logger.info('Voice upload session created', {
      mediaId: uploadResponse.mediaId,
      userId: session.user.id,
      fileSize
    });

    return NextResponse.json({
      uploadUrl: uploadResponse.uploadUrl,
      mediaId: uploadResponse.mediaId,
      expiresAt: uploadResponse.expiresAt,
      storagePath: uploadResponse.storagePath
    });

  } catch (error) {
    logger.error('Voice intake failed', error as Error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}