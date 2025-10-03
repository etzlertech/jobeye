/**
 * @file src/app/api/field-intelligence/intake/ocr/route.ts
 * @phase 3
 * @domain field-intelligence
 * @purpose API endpoint for OCR processing of intake documents
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 150 LoC
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { IntakeOCRService } from '@/domains/field-intelligence/services/intake-ocr.service';
import { logger } from '@/core/logger/voice-logger';

/**
 * POST /api/field-intelligence/intake/ocr
 * Process document with OCR
 */
export async function POST(request: NextRequest) {
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

    // Parse multipart form data
    const formData = await request.formData();
    const documentId = formData.get('documentId') as string;
    const imageFile = formData.get('image') as File;

    if (!documentId || !imageFile) {
      return NextResponse.json(
        { error: 'documentId and image are required' },
        { status: 400 }
      );
    }

    // Convert file to blob
    const imageBlob = new Blob([await imageFile.arrayBuffer()], {
      type: imageFile.type,
    });

    const openaiApiKey = process.env.OPENAI_API_KEY || '';
    const ocrService = new IntakeOCRService(supabase, tenantId, openaiApiKey);

    const result = await ocrService.extractTextWithRetry(documentId, imageBlob);

    logger.info('OCR processing completed via API', {
      documentId,
      confidence: result.confidence,
      costUSD: result.costUSD,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('OCR API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}