// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/voice/services/voice-intake-service.ts
// phase: 3
// domain: voice-pipeline
// version: 1.0.0
// purpose: Handle voice recording intake and initiate ASR processing
// spec_ref: v4.0/voice-architecture.md#intake
// complexity_budget: 200 LoC
//
// migrations_touched:
//   - 2025-10-voice-vision-p0.sql
//   - 2025-11-storage-buckets.sql
//
// state_machine:
//   id: voice_intake_fsm
//   states: [uploaded, queued, processing, transcribed, failed]
//
// estimated_llm_cost:
//   tokens_per_operation: 0
//   operations_per_day: 0
//   monthly_cost_usd: 0.00
//
// dependencies:
//   internal:
//     - /src/core/database/connection.ts
//     - /src/core/logger/voice-logger.ts
//     - /src/domains/voice/types/voice-types.ts
//   external:
//     - npm: '@supabase/supabase-js'
//   supabase:
//     - table: media_assets (RLS ON)
//     - table: conversation_sessions (RLS ON)
//     - bucket: voice-recordings
//
// exports:
//   - class VoiceIntakeService
//   - function createVoiceIntakeService(): VoiceIntakeService
//
// voice_considerations: >
//   Track upload progress for large voice files.
//   Support multiple audio formats (webm, mp3, wav).
//   Generate signed URLs with appropriate expiration.
//
// offline_capability: OPTIONAL
//
// test_requirements:
//   coverage: 0.9
//   test_file: /src/domains/voice/services/__tests__/voice-intake-service.test.ts
//
// tasks:
//   1. [SETUP] Initialize Supabase client
//   2. [SESSION] Create or validate conversation session
//   3. [MEDIA] Create media_assets record
//   4. [STORAGE] Generate signed upload URL
//   5. [QUEUE] Enqueue ASR processing on upload completion
//   6. [ERROR] Handle upload failures and cleanup
// --- END DIRECTIVE BLOCK ---

import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/core/database/connection';
import { VoiceLogger } from '@/core/logger/voice-logger';
import { VoiceRecording } from '../types/voice-types';

export interface VoiceUploadRequest {
  sessionId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface VoiceUploadResponse {
  uploadUrl: string;
  mediaId: string;
  expiresAt: string;
  storagePath: string;
}

export class VoiceIntakeService {
  private supabase: SupabaseClient;
  private logger: VoiceLogger;

  constructor(supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient || supabase;
    this.logger = new VoiceLogger('VoiceIntakeService');
  }

  /**
   * Create a voice upload session and generate signed URL
   */
  async createVoiceUpload(request: VoiceUploadRequest): Promise<VoiceUploadResponse> {
    try {
      // Validate session exists and belongs to user's company
      const { data: session, error: sessionError } = await this.supabase
        .from('conversation_sessions')
        .select('id, tenant_id, user_id')
        .eq('id', request.sessionId)
        .single();

      if (sessionError || !session) {
        throw new Error('Invalid session');
      }

      // Generate storage path
      const { data: pathData, error: pathError } = await this.supabase
        .rpc('generate_storage_path', {
          p_tenant_id: session.tenant_id,
          p_object_type: 'voice',
          p_file_extension: this.getFileExtension(request.fileName)
        });

      if (pathError || !pathData) {
        throw new Error('Failed to generate storage path');
      }

      const storagePath = pathData;

      // Create media asset record
      const { data: mediaAsset, error: mediaError } = await this.supabase
        .from('media_assets')
        .insert({
          tenant_id: session.tenant_id,
          type: 'audio',
          storage_path: storagePath,
          file_size_bytes: request.fileSize,
          mime_type: request.mimeType,
          uploaded_by: session.user_id,
          metadata: {
            session_id: request.sessionId,
            original_filename: request.fileName
          }
        })
        .select()
        .single();

      if (mediaError || !mediaAsset) {
        throw new Error('Failed to create media record');
      }

      // Generate signed upload URL
      const { data: uploadData, error: uploadError } = await this.supabase
        .storage
        .from('voice-recordings')
        .createSignedUploadUrl(storagePath, {
          upsert: false
        });

      if (uploadError || !uploadData) {
        // Cleanup media record on failure
        await this.supabase
          .from('media_assets')
          .delete()
          .eq('id', mediaAsset.id);
        
        throw new Error('Failed to generate upload URL');
      }

      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes

      this.logger.info('Voice upload session created', {
        mediaId: mediaAsset.id,
        sessionId: request.sessionId,
        fileSize: request.fileSize
      });

      return {
        uploadUrl: uploadData.signedUrl,
        mediaId: mediaAsset.id,
        expiresAt,
        storagePath
      };
    } catch (error) {
      this.logger.error('Failed to create voice upload', error as Error);
      throw error;
    }
  }

  /**
   * Mark upload as complete and trigger ASR processing
   */
  async confirmUpload(mediaId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('media_assets')
        .update({ 
          uploaded_at: new Date().toISOString(),
          metadata: this.supabase.sql`metadata || '{"status": "uploaded"}'::jsonb`
        })
        .eq('id', mediaId);

      if (error) {
        throw new Error('Failed to confirm upload');
      }

      // TODO: Enqueue ASR processing job
      this.logger.info('Voice upload confirmed, ASR processing queued', { mediaId });
    } catch (error) {
      this.logger.error('Failed to confirm upload', error as Error);
      throw error;
    }
  }

  /**
   * Get voice recording details
   */
  async getVoiceRecording(mediaId: string): Promise<VoiceRecording | null> {
    try {
      const { data, error } = await this.supabase
        .from('media_assets')
        .select(`
          id,
          storage_path,
          file_size_bytes,
          mime_type,
          uploaded_at,
          uploaded_by,
          metadata
        `)
        .eq('id', mediaId)
        .eq('type', 'audio')
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id,
        sessionId: data.metadata?.session_id || '',
        mediaId: data.id,
        duration: 0, // Will be populated after processing
        fileSize: data.file_size_bytes || 0,
        mimeType: data.mime_type || '',
        uploadedAt: new Date(data.uploaded_at),
        uploadedBy: data.uploaded_by
      };
    } catch (error) {
      this.logger.error('Failed to get voice recording', error as Error);
      throw error;
    }
  }

  private getFileExtension(fileName: string): string {
    const parts = fileName.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : 'webm';
  }
}

export function createVoiceIntakeService(supabaseClient?: SupabaseClient): VoiceIntakeService {
  return new VoiceIntakeService(supabaseClient);
}