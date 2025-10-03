/**
 * @file /src/app/api/inventory/detect/route.ts
 * @phase 3.8
 * @domain Inventory
 * @purpose POST /api/inventory/detect - Vision-based item detection
 * @complexity_budget 200
 * @feature 004-voice-vision-inventory
 *
 * Request:
 * - image: File (multipart/form-data) or base64 string
 * - expectedItems?: string[] (optional)
 * - jobId?: string (optional)
 * - locationId?: string (optional)
 * - context?: string (optional)
 *
 * Response:
 * - sessionId: string
 * - method: 'yolo' | 'vlm'
 * - candidates: DetectionCandidate[]
 * - processingTimeMs: number
 * - estimatedCost: number
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import * as detectionOrchestratorService from '@/domains/inventory/services/detection-orchestrator.service';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get company ID from user metadata
    const tenantId = user.app_metadata?.tenant_id;
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Company ID not found in user metadata' },
        { status: 400 }
      );
    }

    // Parse request body
    const contentType = request.headers.get('content-type') || '';
    let imageData: File | Blob | string;
    let imageUrl: string;
    let expectedItems: string[] | undefined;
    let jobId: string | undefined;
    let locationId: string | undefined;
    let context: string | undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const imageFile = formData.get('image') as File;

      if (!imageFile) {
        return NextResponse.json(
          { error: 'Image file is required' },
          { status: 400 }
        );
      }

      imageData = imageFile;

      // Upload to Supabase Storage
      const fileName = `detections/${tenantId}/${Date.now()}-${imageFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('inventory-images')
        .upload(fileName, imageFile);

      if (uploadError) {
        return NextResponse.json(
          { error: `Image upload failed: ${uploadError.message}` },
          { status: 500 }
        );
      }

      const { data: urlData } = supabase.storage
        .from('inventory-images')
        .getPublicUrl(fileName);

      imageUrl = urlData.publicUrl;

      // Parse other form fields
      expectedItems = formData.get('expectedItems')
        ? JSON.parse(formData.get('expectedItems') as string)
        : undefined;
      jobId = (formData.get('jobId') as string) || undefined;
      locationId = (formData.get('locationId') as string) || undefined;
      context = (formData.get('context') as string) || undefined;
    } else {
      const body = await request.json();

      if (!body.image) {
        return NextResponse.json(
          { error: 'Image is required' },
          { status: 400 }
        );
      }

      imageData = body.image;
      imageUrl = body.imageUrl || body.image;
      expectedItems = body.expectedItems;
      jobId = body.jobId;
      locationId = body.locationId;
      context = body.context;
    }

    // Run detection
    const result = await detectionOrchestratorService.detectInventoryItems({
      tenantId,
      userId: user.id,
      imageSource: imageData,
      imageUrl,
      expectedItems,
      jobId,
      locationId,
      context,
    });

    if (result.error || !result.data) {
      return NextResponse.json(
        { error: result.error?.message || 'Detection failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sessionId: result.data.sessionId,
      method: result.data.method,
      candidates: result.data.candidates,
      processingTimeMs: result.data.processingTimeMs,
      estimatedCost: result.data.estimatedCost,
    });
  } catch (error: any) {
    console.error('Detection endpoint error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}