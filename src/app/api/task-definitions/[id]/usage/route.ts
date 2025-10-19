/**
 * @fileoverview Task Definitions API Routes - Usage Check
 * @module api/task-definitions/[id]/usage
 *
 * @ai-context
 * Purpose: HTTP endpoint for checking task definition usage in templates
 * Pattern: Next.js App Router dynamic route API
 * Dependencies: TaskDefinitionService, TaskDefinitionRepository
 * Usage: Frontend components check usage before deletion
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/auth/context';
import { createClient } from '@/lib/supabase/server';
import { TaskDefinitionRepository } from '@/domains/task-definition/repositories/TaskDefinitionRepository';
import { TaskDefinitionService } from '@/domains/task-definition/services/TaskDefinitionService';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/task-definitions/:id/usage - Check task definition usage in templates
 * @param id - Task definition UUID
 * @returns Usage statistics (templateCount, templateIds, templateNames)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get and validate context
    const context = await getRequestContext(request);

    if (!context.tenantId) {
      return NextResponse.json(
        { error: 'No tenant context' },
        { status: 401 }
      );
    }

    // Initialize service
    const supabase = await createClient();
    const repository = new TaskDefinitionRepository(supabase);
    const service = new TaskDefinitionService(repository);

    // Check usage
    const result = await service.getTaskDefinitionUsage(params.id);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { data: result.value },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error checking task definition usage:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
