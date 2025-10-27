/**
 * @file Voice Tools API
 * @purpose Execute function calls from Gemini Live API
 * @phase 3
 * @domain Voice
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/auth/context';
import { VoiceToolExecutor } from '@/domains/voice/services/voice-tool-executor.service';
import { ToolCall } from '@/domains/voice/services/gemini-live.service';
import { handleApiError } from '@/core/errors/error-handler';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Execute tool calls with database access
 */
export async function POST(req: NextRequest) {
  try {
    // Get auth context
    const context = await getRequestContext(req);
    if (!context.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user, tenantId } = context;

    // Parse tool call
    const toolCall: ToolCall = await req.json();

    console.log('[Voice Tools API] Executing tool call:', toolCall);

    // Execute tools
    const executor = new VoiceToolExecutor({
      userId: user.id,
      tenantId,
    });

    const response = await executor.execute(toolCall);

    console.log('[Voice Tools API] Tool response:', response);

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[Voice Tools API] Error:', error);
    return handleApiError(error);
  }
}
