import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Logger } from '@/core/logger/logger';
import { createServiceSupabaseClient } from '@/lib/supabase/service-client';
import { MultiObjectVisionService } from '@/domains/vision/services/multi-object-vision-service';
import { createLoadVerificationRepository } from '@/domains/vision/repositories/load-verification-repository';
import {
  KnownContainer,
  KnownEquipment,
  KnownMaterial,
} from '@/domains/vision/types/load-verification-types';
import { createJobChecklistRepository } from '@/domains/job/repositories/job-checklist-repository';
import { LoadVerificationReconciler } from '@/domains/vision/services/load-verification-reconciler';
import { createLoadVerificationTelemetry } from '@/domains/vision/services/load-verification-telemetry';

const logger = new Logger('vision-load-verification-api');
const visionService = new MultiObjectVisionService();

const FrameUploadSchema = z.object({
  jobId: z.string().uuid(),
  mediaId: z.string().uuid().optional().nullable(),
  imageBase64: z.string().min(1),
  mimeType: z.string().optional(),
  frameIndex: z.number().int().min(0).optional(),
  frameTimestamp: z.string().datetime({ offset: true }).optional(),
  userId: z.string().uuid().optional(),
  confidenceThreshold: z.number().min(0).max(1).optional(),
});

const ManualOverrideSchema = z.object({
  checklistItemId: z.string().uuid(),
  manualOverrideStatus: z.enum(['pending', 'loaded', 'verified', 'missing', 'clear']).optional(),
  manualOverrideReason: z.string().max(500).optional(),
  userId: z.string().uuid().optional(),
});

function normalizeBase64(input: string): string {
  const dataUrlMatch = input.match(/^data:(.*?);base64,(.*)$/);
  if (dataUrlMatch) {
    return dataUrlMatch[2];
  }
  return input;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = FrameUploadSchema.safeParse(body);

    if (!parsed.success) {
      logger.warn('Invalid frame upload payload', { issues: parsed.error.issues });
      return NextResponse.json(
        { error: 'Invalid payload', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const {
      jobId,
      mediaId = null,
      imageBase64,
      mimeType,
      frameIndex,
      frameTimestamp,
      confidenceThreshold,
    } = parsed.data;

    const supabase = createServiceSupabaseClient();

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, tenant_id, title')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      logger.warn('Job not found for vision verification', { jobId, jobError });
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    const checklistRepository = createJobChecklistRepository(supabase);
    const checklistItems = await checklistRepository.listByJob(jobId);

    if (!checklistItems.length) {
      logger.warn('No checklist items found for job vision verification', { jobId });
      return NextResponse.json(
        { error: 'No checklist items configured for this job' },
        { status: 400 }
      );
    }

    const containerIds = Array.from(
      new Set(
        checklistItems
          .map(item => item.containerId)
          .filter((value): value is string => Boolean(value))
      )
    );

    const equipmentIds = Array.from(
      new Set(
        checklistItems
          .filter(item => item.itemType === 'equipment')
          .map(item => item.itemId)
      )
    );

    const materialIds = Array.from(
      new Set(
        checklistItems
          .filter(item => item.itemType === 'material')
          .map(item => item.itemId)
      )
    );

    let knownContainers: KnownContainer[] = [];
    let knownEquipment: KnownEquipment[] = [];
    let knownMaterials: KnownMaterial[] = [];

    if (containerIds.length > 0) {
      const { data: containerRows, error: containerError } = await supabase
        .from('containers')
        .select('id, name, identifier, container_type, color, metadata')
        .in('id', containerIds);

      if (containerError) {
        logger.error('Failed to load containers for vision verification', { containerError, jobId });
        return NextResponse.json(
          { error: 'Failed to load container data' },
          { status: 500 }
        );
      }

      knownContainers = (containerRows || []).map(row => ({
        id: row.id,
        name: row.name,
        containerType: row.container_type,
        identifier: row.identifier,
        color: row.color,
        metadata: row.metadata,
      }));
    }

    if (equipmentIds.length > 0) {
      const { data: equipmentRows, error: equipmentError } = await supabase
        .from('equipment')
        .select('id, name, model, voice_identifier, metadata, tenant_id')
        .in('id', equipmentIds)
        .eq('tenant_id', job.tenant_id);

      if (equipmentError) {
        logger.error('Failed to load equipment for vision verification', { equipmentError, jobId });
        return NextResponse.json(
          { error: 'Failed to load equipment data' },
          { status: 500 }
        );
      }

      knownEquipment = (equipmentRows || []).map(row => ({
        id: row.id,
        name: row.name,
        model: row.model,
        voiceIdentifier: row.voice_identifier,
        metadata: row.metadata,
      }));
    }

    if (materialIds.length > 0) {
      const { data: materialRows, error: materialError } = await supabase
        .from('materials')
        .select('id, name, sku, category, metadata, tenant_id')
        .in('id', materialIds)
        .eq('tenant_id', job.tenant_id);

      if (materialError) {
        logger.error('Failed to load materials for vision verification', { materialError, jobId });
        return NextResponse.json(
          { error: 'Failed to load material data' },
          { status: 500 }
        );
      }

      knownMaterials = (materialRows || []).map(row => ({
        id: row.id,
        name: row.name,
        sku: row.sku,
        category: row.category,
        metadata: row.metadata,
      }));
    }

    const loadRequirements = checklistItems.map(item => ({
      checklistItemId: item.id,
      itemType: item.itemType,
      itemId: item.itemId,
      itemName: item.itemName,
      quantity: item.quantity ?? 1,
      containerId: item.containerId ?? undefined,
      containerName: item.containerId
        ? knownContainers.find(container => container.id === item.containerId)?.name
        : undefined,
    }));

    const analysis = await visionService.analyzeLoadingScene({
      imageData: normalizeBase64(imageBase64),
      jobId,
      loadRequirements,
      knownContainers,
      knownEquipment,
      knownMaterials,
      confidenceThreshold: confidenceThreshold,
    });

    const loadVerificationRepository = createLoadVerificationRepository(supabase);

    const verifiedChecklistItemIds = analysis.verifiedItems
      .filter(item => item.status === 'verified')
      .map(item => item.checklistItemId);

    const record = await loadVerificationRepository.create({
      jobId,
      mediaId,
      provider: analysis.provider,
      modelId: analysis.modelId,
      detectedContainers: analysis.containers,
      detectedItems: analysis.items,
      verifiedChecklistItemIds,
      missingChecklistItemIds: analysis.missingItems.map(item => item.checklistItemId),
      unexpectedItems: analysis.unexpectedItems,
      tokensUsed: analysis.tokensUsed,
      costUsd: analysis.costUsd,
      processingTimeMs: analysis.processingTimeMs,
    });

    const reconciler = new LoadVerificationReconciler(checklistRepository, logger);
    const reconciliation = await reconciler.reconcile({
      jobId,
      verificationId: record.id,
      analysis,
      checklistItems,
    });

    const telemetry = createLoadVerificationTelemetry(logger);
    telemetry.capture({
      jobId,
      verificationId: record.id,
      analysis,
      reconciliation,
      frameIndex,
      frameTimestamp,
    });

    logger.info('Load verification captured', {
      jobId,
      frameIndex,
      frameTimestamp,
      verifiedCount: verifiedChecklistItemIds.length,
      missingCount: analysis.missingItems.length,
      unexpectedCount: analysis.unexpectedItems.length,
      mismatchedCount: reconciliation.mismatchedItems.length,
      overridesRespected: reconciliation.overridesRespected.length,
    });

    return NextResponse.json({
      jobId,
      mediaId,
      frameIndex,
      frameTimestamp,
      analysis,
      record,
      reconciliation,
    });
  } catch (error) {
    logger.error('Vision load verification failed', { error: (error as Error).message });
    return NextResponse.json(
      { error: 'Failed to process load verification frame' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}

export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get('jobId');
    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId query parameter is required' },
        { status: 400 }
      );
    }

    const supabase = createServiceSupabaseClient();
    const checklistRepository = createJobChecklistRepository(supabase);
    const loadVerificationRepository = createLoadVerificationRepository(supabase);

    const [checklistItems, latestVerification] = await Promise.all([
      checklistRepository.listByJob(jobId),
      loadVerificationRepository.findLatestByJob(jobId),
    ]);

    const containerIds = Array.from(
      new Set(
        checklistItems
          .map(item => item.containerId)
          .filter((value): value is string => Boolean(value))
      )
    );

    let containersById: Record<string, { name: string }> = {};

    if (containerIds.length > 0) {
      const { data: containerRows } = await supabase
        .from('containers')
        .select('id, name')
        .in('id', containerIds);

      containersById = (containerRows || []).reduce((acc, row) => {
        acc[row.id] = { name: row.name };
        return acc;
      }, {} as Record<string, { name: string }>);
    }

    const decoratedChecklist = checklistItems.map(item => ({
      ...item,
      containerName: item.containerId ? containersById[item.containerId]?.name ?? null : null,
    }));

    return NextResponse.json({
      jobId,
      checklistItems: decoratedChecklist,
      latestVerification,
    });
  } catch (error) {
    logger.error('Failed to fetch load verification status', { error: (error as Error).message });
    return NextResponse.json(
      { error: 'Failed to fetch load verification status' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ManualOverrideSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { checklistItemId, manualOverrideStatus, manualOverrideReason, userId } = parsed.data;
    const supabase = createServiceSupabaseClient();
    const checklistRepository = createJobChecklistRepository(supabase);

    const resolvedStatus = manualOverrideStatus === 'clear' ? null : manualOverrideStatus ?? null;

    const updatedItem = await checklistRepository.applyManualOverride(checklistItemId, {
      manualOverrideStatus: resolvedStatus,
      manualOverrideReason: manualOverrideReason ?? null,
      manualOverrideBy: userId ?? null,
      manualOverrideAt: new Date().toISOString(),
    });

    return NextResponse.json({
      checklistItem: updatedItem,
    });
  } catch (error) {
    logger.error('Failed to apply manual override', { error: (error as Error).message });
    return NextResponse.json(
      { error: 'Failed to apply manual override' },
      { status: 500 }
    );
  }
}
