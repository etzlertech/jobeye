/**
 * @file src/app/api/field-intelligence/workflows/verify-completion/route.ts
 * @phase 3
 * @domain field-intelligence
 * @purpose API endpoint for job completion verification with AI
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 200 LoC
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WorkflowsCompletionVerificationService } from '@/domains/field-intelligence/services/workflows-completion-verification.service';
import { logger } from '@/core/logger/voice-logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

/**
 * POST /api/field-intelligence/workflows/verify-completion
 * Verify job completion with photo proofs
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

    // Parse multipart form data
    const formData = await request.formData();
    const jobId = formData.get('jobId') as string;
    const userId = formData.get('userId') as string;

    if (!jobId || !userId) {
      return NextResponse.json(
        { error: 'jobId and userId are required' },
        { status: 400 }
      );
    }

    // Parse photo proofs
    const photoProofs: Array<{ taskId: string; photoUrl: string; photoBlob: Blob }> = [];
    let index = 0;
    while (formData.has(`photo_${index}`)) {
      const taskId = formData.get(`taskId_${index}`) as string;
      const photoUrl = formData.get(`photoUrl_${index}`) as string;
      const photoFile = formData.get(`photo_${index}`) as File;

      if (taskId && photoUrl && photoFile) {
        const photoBlob = new Blob([await photoFile.arrayBuffer()], {
          type: photoFile.type,
        });
        photoProofs.push({ taskId, photoUrl, photoBlob });
      }
      index++;
    }

    const verificationService = new WorkflowsCompletionVerificationService(
      supabase,
      companyId
    );

    const result = await verificationService.verifyCompletion({
      jobId,
      userId,
      photoProofs,
    });

    logger.info('Completion verified via API', {
      verificationId: result.verificationId,
      jobId,
      aiQualityScore: result.aiQualityScore,
      requiresSupervisorApproval: result.requiresSupervisorApproval,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('Completion verification API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/field-intelligence/workflows/verify-completion?jobId=xxx
 * Get completion verification for job
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

    const verificationService = new WorkflowsCompletionVerificationService(
      supabase,
      companyId
    );

    const verification = await verificationService.getCompletionVerification(jobId);

    return NextResponse.json({
      success: true,
      data: verification,
    });
  } catch (error: any) {
    logger.error('Get completion verification API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/field-intelligence/workflows/verify-completion/approve
 * Approve completion (supervisor action)
 */
export async function PUT(request: NextRequest) {
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
    const { verificationId, action, reason } = body;

    if (!verificationId || !action) {
      return NextResponse.json(
        { error: 'verificationId and action are required' },
        { status: 400 }
      );
    }

    const verificationService = new WorkflowsCompletionVerificationService(
      supabase,
      companyId
    );

    if (action === 'APPROVE') {
      await verificationService.approveCompletion(verificationId, user.id);
    } else if (action === 'REJECT') {
      if (!reason) {
        return NextResponse.json(
          { error: 'reason is required for rejection' },
          { status: 400 }
        );
      }
      await verificationService.rejectCompletion(verificationId, user.id, reason);
    } else {
      return NextResponse.json(
        { error: 'action must be APPROVE or REJECT' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Completion ${action.toLowerCase()}d`,
    });
  } catch (error: any) {
    logger.error('Completion approval API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}