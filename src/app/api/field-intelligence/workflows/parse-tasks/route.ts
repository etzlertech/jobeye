/**
 * @file src/app/api/field-intelligence/workflows/parse-tasks/route.ts
 * @phase 3
 * @domain field-intelligence
 * @purpose API endpoint for voice-to-task parsing with LLM
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 150 LoC
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WorkflowsTaskParsingService } from '@/domains/field-intelligence/services/workflows-task-parsing.service';
import { logger } from '@/core/logger/voice-logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

/**
 * POST /api/field-intelligence/workflows/parse-tasks
 * Parse voice transcript into structured tasks
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = user.user_metadata?.company_id;
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID not found' }, { status: 400 });
    }

    const body = await request.json();
    const { jobId, transcript } = body;

    if (!jobId || !transcript) {
      return NextResponse.json(
        { error: 'jobId and transcript are required' },
        { status: 400 }
      );
    }

    const openaiApiKey = process.env.OPENAI_API_KEY || '';
    const parsingService = new WorkflowsTaskParsingService(
      supabase,
      companyId,
      openaiApiKey
    );

    const result = await parsingService.parseVoiceToTasks(jobId, transcript);

    logger.info('Tasks parsed via API', {
      jobId,
      totalTasks: result.totalTasks,
      averageConfidence: result.averageConfidence,
      costUSD: result.costUSD,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Task parsing API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/field-intelligence/workflows/parse-tasks?jobId=xxx
 * Get parsed tasks for job
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = user.user_metadata?.company_id;
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID not found' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY || '';
    const parsingService = new WorkflowsTaskParsingService(
      supabase,
      companyId,
      openaiApiKey
    );

    const tasks = await parsingService.getParsedTasks(jobId);

    return NextResponse.json({
      success: true,
      data: tasks,
    });
  } catch (error: any) {
    logger.error('Get parsed tasks API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}