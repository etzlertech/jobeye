/**
 * Voice functionality integration tests with real Supabase database
 * Tests voice sessions, transcripts, and voice intake features
 */

import { 
  serviceClient,
  createTestTenant,
  createTestUserWithTenant,
  cleanupAllTestData,
  testData,
  expectNoError,
  delay
} from './test-setup';
import { randomUUID } from 'crypto';

describe('Voice Features Integration Tests (Real Database)', () => {
  let testTenant: any;
  let testUser: any;

  beforeAll(async () => {
    testTenant = await createTestTenant('Voice Test Company');
    testUser = await createTestUserWithTenant(testTenant.id);
  });

  afterAll(async () => {
    await cleanupAllTestData();
  });

  describe('Voice Profile Management', () => {
    it('should create voice profile for user', async () => {
      const { data: profile, error } = await serviceClient
        .from('voice_profiles')
        .insert({
          user_id: testUser.auth.id,
          wake_word: 'hey jobeye',
          speech_rate: 1.0,
          voice_pitch: 1.0,
          preferred_voice: 'en-US-Standard-A',
          language_code: 'en-US',
          voice_feedback_enabled: true,
          voice_feedback_level: 'verbose',
          preferred_tts_provider: 'google',
          confidence_threshold: 0.8,
          noise_cancellation_enabled: true,
          voice_commands_enabled: true,
          accessibility_voice_navigation: false,
          onboarding_completed: false,
        })
        .select()
        .single();

      expectNoError(error, 'voice profile creation');
      expect(profile).toBeDefined();
      expect(profile?.wake_word).toBe('hey jobeye');
      expect(profile?.language_code).toBe('en-US');
    });

    it('should update voice profile settings', async () => {
      const user = await createTestUserWithTenant(testTenant.id);
      
      // Create initial profile
      await serviceClient
        .from('voice_profiles')
        .insert({
          user_id: user.auth.id,
          wake_word: 'ok jobeye',
          language_code: 'en-US',
        });

      // Update profile
      const updates = {
        speech_rate: 1.2,
        voice_pitch: 0.9,
        preferred_voice: 'en-US-Wavenet-D',
        voice_feedback_enabled: false,
        onboarding_completed: true,
        voice_samples_collected: 5,
        last_voice_training_at: new Date().toISOString(),
      };

      const { data: updated, error } = await serviceClient
        .from('voice_profiles')
        .update(updates)
        .eq('user_id', user.auth.id)
        .select()
        .single();

      expectNoError(error, 'voice profile update');
      expect(updated?.speech_rate).toBe(1.2);
      expect(updated?.onboarding_completed).toBe(true);
      expect(updated?.voice_samples_collected).toBe(5);
    });
  });

  describe('Conversation Sessions', () => {
    it('should create voice conversation session', async () => {
      const sessionToken = `voice-session-${randomUUID()}`;
      
      const { data: session, error } = await serviceClient
        .from('conversation_sessions')
        .insert({
          tenant_id: testTenant.id,
          user_id: testUser.auth.id,
          session_token: sessionToken,
          started_at: new Date().toISOString(),
          is_active: true,
          wake_word_count: 0,
          turn_count: 0,
          current_context: {
            mode: 'idle',
            last_intent: null,
          },
          conversation_history: [],
        })
        .select()
        .single();

      expectNoError(error, 'conversation session creation');
      expect(session).toBeDefined();
      expect(session?.session_token).toBe(sessionToken);
      expect(session?.is_active).toBe(true);
    });

    it('should track conversation context and history', async () => {
      const { data: session } = await serviceClient
        .from('conversation_sessions')
        .insert({
          tenant_id: testTenant.id,
          user_id: testUser.auth.id,
          session_token: `context-test-${Date.now()}`,
          started_at: new Date().toISOString(),
          is_active: true,
        })
        .select()
        .single();

      // Update with conversation progress
      const { error } = await serviceClient
        .from('conversation_sessions')
        .update({
          wake_word_count: 3,
          turn_count: 5,
          current_context: {
            mode: 'job_creation',
            customer_id: 'cust-123',
            property_id: 'prop-456',
            partial_data: {
              title: 'Lawn maintenance',
              priority: 'normal',
            },
          },
          conversation_history: [
            {
              timestamp: new Date().toISOString(),
              type: 'user',
              text: 'Create a new job for John Smith',
            },
            {
              timestamp: new Date().toISOString(),
              type: 'assistant',
              text: 'Creating a job for John Smith. What service will you be providing?',
            },
            {
              timestamp: new Date().toISOString(),
              type: 'user',
              text: 'Lawn maintenance',
            },
          ],
          pending_confirmations: {
            type: 'customer_selection',
            options: ['John Smith', 'Jon Smith'],
            confidence_scores: [0.95, 0.75],
          },
        })
        .eq('id', session!.id);

      expectNoError(error, 'session context update');
    });

    it('should end conversation session properly', async () => {
      const startTime = new Date();
      const { data: session } = await serviceClient
        .from('conversation_sessions')
        .insert({
          tenant_id: testTenant.id,
          user_id: testUser.auth.id,
          session_token: `end-test-${Date.now()}`,
          started_at: startTime.toISOString(),
          is_active: true,
        })
        .select()
        .single();

      // Simulate conversation activity
      await delay(1000);

      // End session
      const endTime = new Date();
      const { error } = await serviceClient
        .from('conversation_sessions')
        .update({
          ended_at: endTime.toISOString(),
          is_active: false,
          total_duration: Math.floor((endTime.getTime() - startTime.getTime()) / 1000),
          active_duration: 45, // Simulated active talking time
          intent_success_rate: 0.85,
          user_satisfaction_score: 4,
          total_stt_cost: 0.05,
          total_llm_cost: 0.10,
          total_tts_cost: 0.03,
        })
        .eq('id', session!.id);

      expectNoError(error, 'session end');
    });

    it('should link conversation session to job', async () => {
      const { data: session } = await serviceClient
        .from('conversation_sessions')
        .insert({
          tenant_id: testTenant.id,
          user_id: testUser.auth.id,
          session_token: `job-linked-${Date.now()}`,
          started_at: new Date().toISOString(),
          is_active: true,
        })
        .select()
        .single();

      // Create a test job
      const { data: job } = await serviceClient
        .from('jobs')
        .insert({
          tenant_id: testTenant.id,
          job_number: `VOICE-JOB-${Date.now()}`,
          title: 'Voice Created Job',
          status: 'scheduled',
          priority: 'normal',
          voice_created: true,
          voice_session_id: session!.id,
          created_by: testUser.auth.id,
        })
        .select()
        .single();

      // Link session to job
      const { error } = await serviceClient
        .from('conversation_sessions')
        .update({ job_id: job!.id })
        .eq('id', session!.id);

      expectNoError(error, 'session-job linking');
    });
  });

  describe('Voice Transcripts', () => {
    it('should store voice transcript', async () => {
      const { data: transcript, error } = await serviceClient
        .from('voice_transcripts')
        .insert({
          tenant_id: testTenant.id,
          user_id: testUser.auth.id,
          audio_url: 'https://storage.example.com/audio/test.webm',
          audio_duration: 5.5,
          transcript: 'Create a new job for customer John Smith at 123 Main Street',
          confidence_score: 0.92,
          status: 'completed',
          language_code: 'en-US',
          provider: 'google',
          provider_transcript_id: 'google-123456',
          cost: 0.05,
          created_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
        })
        .select()
        .single();

      expectNoError(error, 'transcript creation');
      expect(transcript).toBeDefined();
      expect(transcript?.confidence_score).toBe(0.92);
      expect(transcript?.status).toBe('completed');
    });

    it('should handle transcript processing states', async () => {
      // Create pending transcript
      const { data: pending } = await serviceClient
        .from('voice_transcripts')
        .insert({
          tenant_id: testTenant.id,
          user_id: testUser.auth.id,
          audio_url: 'https://storage.example.com/audio/pending.webm',
          audio_duration: 3.2,
          status: 'pending',
          language_code: 'en-US',
          provider: 'openai',
        })
        .select()
        .single();

      // Simulate processing
      await delay(500);

      // Update to processing
      await serviceClient
        .from('voice_transcripts')
        .update({ status: 'processing' })
        .eq('id', pending!.id);

      // Complete processing
      const { error } = await serviceClient
        .from('voice_transcripts')
        .update({
          status: 'completed',
          transcript: 'Schedule maintenance for tomorrow morning',
          confidence_score: 0.88,
          provider_transcript_id: 'openai-789',
          cost: 0.03,
          processed_at: new Date().toISOString(),
        })
        .eq('id', pending!.id);

      expectNoError(error, 'transcript processing update');
    });

    it('should link transcript to conversation session', async () => {
      const { data: session } = await serviceClient
        .from('conversation_sessions')
        .insert({
          tenant_id: testTenant.id,
          user_id: testUser.auth.id,
          session_token: `transcript-session-${Date.now()}`,
          started_at: new Date().toISOString(),
          is_active: true,
        })
        .select()
        .single();

      const { data: transcript, error } = await serviceClient
        .from('voice_transcripts')
        .insert({
          tenant_id: testTenant.id,
          user_id: testUser.auth.id,
          session_id: session!.id,
          audio_url: 'https://storage.example.com/audio/session.webm',
          audio_duration: 2.8,
          transcript: 'Add notes to the previous job',
          confidence_score: 0.95,
          status: 'completed',
          language_code: 'en-US',
          provider: 'google',
          cost: 0.02,
        })
        .select()
        .single();

      expectNoError(error, 'session-linked transcript');
      expect(transcript?.session_id).toBe(session!.id);
    });
  });

  describe('Intent Recognition', () => {
    it('should recognize and store intent', async () => {
      const { data: transcript } = await serviceClient
        .from('voice_transcripts')
        .insert({
          tenant_id: testTenant.id,
          user_id: testUser.auth.id,
          transcript: 'Show me all jobs for tomorrow',
          confidence_score: 0.94,
          status: 'completed',
          language_code: 'en-US',
          provider: 'google',
        })
        .select()
        .single();

      const { data: intent, error } = await serviceClient
        .from('intent_recognitions')
        .insert({
          tenant_id: testTenant.id,
          transcript_id: transcript!.id,
          user_id: testUser.auth.id,
          intent_type: 'list_jobs',
          confidence_score: 0.89,
          entities: {
            time_filter: 'tomorrow',
            date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          },
          context: {
            previous_intent: null,
            session_active: true,
          },
          action_taken: {
            type: 'query_jobs',
            filters: {
              scheduled_date: 'tomorrow',
            },
            result_count: 5,
          },
          success: true,
          provider: 'openai',
          cost: 0.02,
        })
        .select()
        .single();

      expectNoError(error, 'intent recognition');
      expect(intent).toBeDefined();
      expect(intent?.intent_type).toBe('list_jobs');
      expect(intent?.entities.time_filter).toBe('tomorrow');
    });

    it('should handle failed intent recognition', async () => {
      const { data: transcript } = await serviceClient
        .from('voice_transcripts')
        .insert({
          tenant_id: testTenant.id,
          user_id: testUser.auth.id,
          transcript: 'Mmm hmm yeah okay',
          confidence_score: 0.65,
          status: 'completed',
          language_code: 'en-US',
          provider: 'google',
        })
        .select()
        .single();

      const { data: intent, error } = await serviceClient
        .from('intent_recognitions')
        .insert({
          tenant_id: testTenant.id,
          transcript_id: transcript!.id,
          user_id: testUser.auth.id,
          intent_type: 'unknown',
          confidence_score: 0.12,
          entities: {},
          context: {},
          success: false,
          error_message: 'Could not determine user intent from transcript',
          provider: 'openai',
          cost: 0.01,
        })
        .select()
        .single();

      expectNoError(error, 'failed intent creation');
      expect(intent?.success).toBe(false);
      expect(intent?.error_message).toBeDefined();
    });
  });

  describe('Media Assets', () => {
    it('should create media asset for voice recording', async () => {
      const { data: asset, error } = await serviceClient
        .from('media_assets')
        .insert({
          tenant_id: testTenant.id,
          uploaded_by: testUser.auth.id,
          media_type: 'audio',
          file_name: 'voice_command_123456.webm',
          file_size: 125000, // 125KB
          mime_type: 'audio/webm',
          storage_path: `${testTenant.id}/voice/${testUser.auth.id}/2024-01/voice_command_123456.webm`,
          public_url: null, // Private by default
          voice_description: 'Voice command recording',
          tags: ['voice', 'command'],
          is_public: false,
          metadata: {
            duration_seconds: 3.5,
            sample_rate: 48000,
            channels: 1,
            codec: 'opus',
          },
        })
        .select()
        .single();

      expectNoError(error, 'media asset creation');
      expect(asset).toBeDefined();
      expect(asset?.media_type).toBe('audio');
      expect(asset?.metadata.duration_seconds).toBe(3.5);
    });

    it('should link media asset to voice transcript', async () => {
      const { data: asset } = await serviceClient
        .from('media_assets')
        .insert({
          tenant_id: testTenant.id,
          uploaded_by: testUser.auth.id,
          media_type: 'audio',
          file_name: 'linked_voice.webm',
          file_size: 98000,
          mime_type: 'audio/webm',
          storage_path: `${testTenant.id}/voice/linked_voice.webm`,
        })
        .select()
        .single();

      const { data: transcript } = await serviceClient
        .from('voice_transcripts')
        .insert({
          tenant_id: testTenant.id,
          user_id: testUser.auth.id,
          audio_url: asset!.storage_path,
          transcript: 'Test linked audio',
          status: 'completed',
          language_code: 'en-US',
          provider: 'google',
        })
        .select()
        .single();

      // Update asset with transcript link
      const { error } = await serviceClient
        .from('media_assets')
        .update({ voice_transcript_id: transcript!.id })
        .eq('id', asset!.id);

      expectNoError(error, 'asset-transcript linking');
    });
  });

  describe('AI Cost Tracking', () => {
    it('should track voice processing costs', async () => {
      const { data: transcript } = await serviceClient
        .from('voice_transcripts')
        .insert({
          tenant_id: testTenant.id,
          user_id: testUser.auth.id,
          transcript: 'Cost tracking test',
          status: 'completed',
          language_code: 'en-US',
          provider: 'google',
          cost: 0.03,
        })
        .select()
        .single();

      const { data: costEntry, error } = await serviceClient
        .from('ai_cost_tracking')
        .insert({
          tenant_id: testTenant.id,
          user_id: testUser.auth.id,
          service_type: 'speech-to-text',
          provider: 'google',
          model: 'speech-to-text-v2',
          audio_seconds: 3.5,
          unit_cost: 0.006, // per 15 seconds
          total_cost: 0.03,
          voice_transcript_id: transcript!.id,
        })
        .select()
        .single();

      expectNoError(error, 'cost tracking entry');
      expect(costEntry).toBeDefined();
      expect(costEntry?.total_cost).toBe(0.03);
    });

    it('should aggregate costs by service type', async () => {
      // Create multiple cost entries
      const services = [
        { type: 'speech-to-text', cost: 0.05 },
        { type: 'text-to-speech', cost: 0.08 },
        { type: 'intent-recognition', cost: 0.12 },
        { type: 'speech-to-text', cost: 0.03 },
      ];

      for (const service of services) {
        await serviceClient
          .from('ai_cost_tracking')
          .insert({
            tenant_id: testTenant.id,
            user_id: testUser.auth.id,
            service_type: service.type,
            provider: 'various',
            model: 'test-model',
            total_cost: service.cost,
          });
      }

      // Query aggregated costs
      const { data: costs } = await serviceClient
        .from('ai_cost_tracking')
        .select('service_type, total_cost')
        .eq('tenant_id', testTenant.id)
        .eq('user_id', testUser.auth.id);

      expect(costs).toBeDefined();
      expect(costs!.length).toBeGreaterThan(0);

      // Calculate total STT cost
      const sttTotal = costs!
        .filter(c => c.service_type === 'speech-to-text')
        .reduce((sum, c) => sum + Number(c.total_cost), 0);
      
      expect(sttTotal).toBeGreaterThan(0);
    });
  });
});