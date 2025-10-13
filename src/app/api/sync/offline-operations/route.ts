/**
 * AGENT DIRECTIVE BLOCK
 * file: src/app/api/sync/offline-operations/route.ts
 * phase: 4
 * domain: core
 * purpose: API endpoint for syncing offline operations
 * spec_ref: v4-vision-blueprint-extended.md
 * complexity_budget: 100
 * dependencies:
 *   - internal: All services with offline support, createServerClient
 *   - external: next
 * exports: POST
 * voice_considerations:
 *   - Provide voice feedback on sync status
 * offline_capability: REQUIRED
 * test_requirements:
 *   - coverage: 90%
 *   - test_file: src/app/api/sync/offline-operations/__tests__/route.test.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { ContainerService } from '@/domains/equipment/services/container-service';
import { JobLoadListService } from '@/domains/job/services/job-load-list-service';
import { JobFromVoiceService } from '@/domains/job/services/job-from-voice-service';
import { ChecklistVerificationService } from '@/domains/job/services/checklist-verification-service';
import { VoiceLogger } from '@/core/logger/voice-logger';

export async function POST(request: NextRequest) {
  const logger = new VoiceLogger();

  try {
    // Get authenticated user
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { services = ['all'] } = body;

    const results = {
      containers: { synced: 0, failed: 0 },
      loadLists: { synced: 0, failed: 0 },
      voiceJobs: { synced: 0, failed: 0 },
      verifications: { synced: 0, failed: 0 },
      total: { synced: 0, failed: 0 }
    };

    // Sync container operations
    if (services.includes('all') || services.includes('containers')) {
      try {
        const containerService = new ContainerService(supabase, logger);
        await containerService.syncOfflineOperations();
        results.containers.synced = 1; // Would need to track actual count
      } catch (error) {
        results.containers.failed = 1;
        await logger.error('Failed to sync container operations', error as Error);
      }
    }

    // Sync load list operations
    if (services.includes('all') || services.includes('loadLists')) {
      try {
        const loadListService = new JobLoadListService(supabase, undefined, undefined, logger);
        await loadListService.syncOfflineOperations();
        results.loadLists.synced = 1;
      } catch (error) {
        results.loadLists.failed = 1;
        await logger.error('Failed to sync load list operations', error as Error);
      }
    }

    // Sync voice job operations
    if (services.includes('all') || services.includes('voiceJobs')) {
      try {
        const voiceJobService = new JobFromVoiceService(supabase, logger);
        await voiceJobService.syncOfflineOperations();
        results.voiceJobs.synced = 1;
      } catch (error) {
        results.voiceJobs.failed = 1;
        await logger.error('Failed to sync voice job operations', error as Error);
      }
    }

    // Sync verification operations
    if (services.includes('all') || services.includes('verifications')) {
      try {
        const verificationService = new ChecklistVerificationService(
          supabase,
          undefined,
          undefined,
          undefined,
          logger
        );
        await verificationService.syncOfflineOperations();
        results.verifications.synced = 1;
      } catch (error) {
        results.verifications.failed = 1;
        await logger.error('Failed to sync verification operations', error as Error);
      }
    }

    // Calculate totals
    results.total.synced = 
      results.containers.synced + 
      results.loadLists.synced + 
      results.voiceJobs.synced + 
      results.verifications.synced;
      
    results.total.failed = 
      results.containers.failed + 
      results.loadLists.failed + 
      results.voiceJobs.failed + 
      results.verifications.failed;

    const voiceSummary = results.total.failed === 0
      ? `All ${results.total.synced} operations synced successfully`
      : `Synced ${results.total.synced} operations, ${results.total.failed} failed`;

    await logger.info('Offline sync completed', {
      userId: user.id,
      results
    });

    return NextResponse.json({
      success: results.total.failed === 0,
      results,
      voice_summary: voiceSummary
    });

  } catch (error) {
    await logger.error('Failed to sync offline operations', error as Error);
    
    return NextResponse.json(
      { 
        error: 'Sync failed',
        message: 'Failed to sync offline operations',
        voice_response: 'Unable to sync offline data. Please try again.'
      },
      { status: 500 }
    );
  }
}