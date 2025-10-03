/**
 * @file src/app/api/field-intelligence/workflows/search-instructions/route.ts
 * @phase 3
 * @domain field-intelligence
 * @purpose API endpoint for semantic instruction search
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 150 LoC
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WorkflowsInstructionSearchService } from '@/domains/field-intelligence/services/workflows-instruction-search.service';
import { logger } from '@/core/logger/voice-logger';

export const dynamic = "force-dynamic";

/**
 * GET /api/field-intelligence/workflows/search-instructions?q=xxx&category=xxx
 * Search for job instructions
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = user.user_metadata?.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: 'Company ID not found' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!query) {
      return NextResponse.json({ error: 'q (query) is required' }, { status: 400 });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY || '';
    const searchService = new WorkflowsInstructionSearchService(
      supabase,
      tenantId,
      openaiApiKey
    );

    const results = await searchService.search({
      query,
      category: category || undefined,
      limit,
    });

    logger.info('Instruction search completed via API', {
      query,
      resultsCount: results.length,
    });

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    logger.error('Instruction search API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}