/*
AGENT DIRECTIVE BLOCK
file: /src/lib/supabase/types.ts
phase: 1
domain: core-infrastructure
purpose: TypeScript types for Supabase database schema
spec_ref: v4-blueprint
complexity_budget: 200
offline_capability: N/A
dependencies:
  external: []
  internal: []
exports:
  - Database type
  - Table types
  - Enum types
voice_considerations: N/A - Type definitions
test_requirements:
  coverage: N/A - Type definitions only
tasks:
  - Define database schema types
  - Export enums
  - Create helper types
*/

export type Database = {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          tenant_id: string;
          customer_number: string;
          name: string;
          email: string | null;
          phone: string | null;
          mobile_phone: string | null;
          billing_address: Record<string, any> | null;
          service_address: Record<string, any> | null;
          notes: string | null;
          tags: string[] | null;
          voice_notes: string | null;
          is_active: boolean;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['customers']['Insert']>;
      };
      
      contacts: {
        Row: {
          id: string;
          tenant_id: string;
          customer_id: string;
          role: ContactRoleDb;
          first_name: string;
          last_name: string;
          email: string | null;
          phone: string | null;
          mobile_phone: string | null;
          is_primary: boolean;
          can_receive_sms: boolean;
          can_receive_email: boolean;
          preferred_contact_method: ContactPreferredMethod;
          voice_recognition_id: string | null;
          notes: string | null;
          metadata: Record<string, any> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['contacts']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['contacts']['Insert']>;
      };

      properties: {
        Row: {
          id: string;
          tenant_id: string;
          customer_id: string;
          property_number: string;
          name: string;
          address: Record<string, any>;
          location: unknown | null; // PostGIS geography
          property_type: string | null;
          size_sqft: number | null;
          lot_size_acres: number | null;
          zones: Record<string, any> | null;
          access_notes: string | null;
          gate_code: string | null;
          special_instructions: string | null;
          voice_navigation_notes: string | null;
          photos: Record<string, any>[];
          is_active: boolean;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['properties']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['properties']['Insert']>;
      };
      
      jobs: {
        Row: {
          id: string;
          tenant_id: string;
          job_number: string;
          template_id: string | null;
          customer_id: string;
          property_id: string | null;
          title: string;
          description: string | null;
          status: JobStatus;
          priority: JobPriority;
          scheduled_start: string | null;
          scheduled_end: string | null;
          actual_start: string | null;
          actual_end: string | null;
          assigned_to: string | null;
          assigned_team: string[] | null;
          estimated_duration: number | null;
          actual_duration: number | null;
          completion_notes: string | null;
          voice_notes: string | null;
          voice_created: boolean;
          voice_session_id: string | null;
          checklist_items: Record<string, any>[];
          materials_used: Record<string, any>[];
          equipment_used: string[] | null;
          photos_before: Record<string, any>[];
          photos_after: Record<string, any>[];
          signature_required: boolean;
          signature_data: Record<string, any> | null;
          billing_info: Record<string, any> | null;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: Omit<Database['public']['Tables']['jobs']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['jobs']['Insert']>;
      };
      
      company_settings: {
        Row: {
          id: string;
          tenant_id: string;
          vision_thresholds: Record<string, any>;
          voice_preferences: Record<string, any>;
          budget_limits: Record<string, any>;
          features: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          vision_thresholds?: Record<string, any>;
          voice_preferences?: Record<string, any>;
          budget_limits?: Record<string, any>;
          features?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          vision_thresholds?: Record<string, any>;
          voice_preferences?: Record<string, any>;
          budget_limits?: Record<string, any>;
          features?: Record<string, any>;
          created_at?: string;
          updated_at?: string;
        };
      };

      auth_audit_log: {
        Row: {
          id: string;
          event_type: string;
          tenant_id: string | null;
          user_id: string | null;
          user_email: string | null;
          success: boolean | null;
          reason: string | null;
          details: Record<string, any> | null;
          ip_address: string | null;
          user_agent: string | null;
          device_type: string | null;
          created_at: string;
          metadata: Record<string, any> | null;
        };
        Insert: {
          id?: string;
          event_type: string;
          tenant_id?: string | null;
          user_id?: string | null;
          user_email?: string | null;
          success?: boolean | null;
          reason?: string | null;
          details?: Record<string, any> | null;
          ip_address?: string | null;
          user_agent?: string | null;
          device_type?: string | null;
          created_at?: string;
          metadata?: Record<string, any> | null;
        };
        Update: Partial<Database['public']['Tables']['auth_audit_log']['Insert']>;
      };

      voice_profiles: {
        Row: {
          id: string;
          user_id: string;
          tenant_id: string | null;
          wake_word: string | null;
          speech_rate: number | null;
          voice_pitch: number | null;
          preferred_voice: string | null;
          language_code: string | null;
          voice_feedback_enabled: boolean | null;
          voice_feedback_level: string | null;
          preferred_tts_provider: string | null;
          confidence_threshold: number | null;
          noise_cancellation_enabled: boolean | null;
          voice_commands_enabled: boolean | null;
          accessibility_voice_navigation: boolean | null;
          onboarding_completed: boolean | null;
          voice_samples_collected: number | null;
          last_voice_training_at: string | null;
          created_at: string;
          updated_at: string;
          metadata: Record<string, any> | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          tenant_id?: string | null;
          wake_word?: string | null;
          speech_rate?: number | null;
          voice_pitch?: number | null;
          preferred_voice?: string | null;
          language_code?: string | null;
          voice_feedback_enabled?: boolean | null;
          voice_feedback_level?: string | null;
          preferred_tts_provider?: string | null;
          confidence_threshold?: number | null;
          noise_cancellation_enabled?: boolean | null;
          voice_commands_enabled?: boolean | null;
          accessibility_voice_navigation?: boolean | null;
          onboarding_completed?: boolean | null;
          voice_samples_collected?: number | null;
          last_voice_training_at?: string | null;
          created_at?: string;
          updated_at?: string;
          metadata?: Record<string, any> | null;
        };
        Update: Partial<Database['public']['Tables']['voice_profiles']['Insert']>;
      };

      voice_transcripts: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          session_id: string | null;
          job_id: string | null;
          audio_url: string | null;
          audio_duration: number | null;
          transcript: string | null;
          confidence_score: number | null;
          status: TranscriptionStatus;
          language_code: string;
          provider: string | null;
          provider_transcript_id: string | null;
          cost: number | null;
          metadata: Record<string, any>;
          created_at: string;
          processed_at: string | null;
        };
        Insert: Omit<Database['public']['Tables']['voice_transcripts']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['voice_transcripts']['Insert']>;
      };
      
      intent_recognitions: {
        Row: {
          id: string;
          tenant_id: string;
          transcript_id: string;
          user_id: string;
          intent_type: IntentType | null;
          confidence_score: number | null;
          entities: Record<string, any> | null;
          context: Record<string, any> | null;
          action_taken: Record<string, any> | null;
          success: boolean | null;
          error_message: string | null;
          feedback_given: boolean;
          feedback_score: number | null;
          provider: string | null;
          cost: number | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['intent_recognitions']['Row'], 'id' | 'created_at'> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['intent_recognitions']['Insert']>;
      };
    };
    
    Views: {
      active_jobs_view: {
        Row: Database['public']['Tables']['jobs']['Row'] & {
          customer_name: string | null;
          customer_phone: string | null;
          property_name: string | null;
          property_address: Record<string, any> | null;
          assigned_to_name: string | null;
        };
      };
    };
    
    Functions: {
      get_user_tenant_id: {
        Args: { user_id: string };
        Returns: string | null;
      };
      user_has_permission: {
        Args: { user_id: string; permission_name: string };
        Returns: boolean;
      };
      process_voice_command: {
        Args: {
          p_transcript_id: string;
          p_intent_type: IntentType;
          p_entities: Record<string, any>;
          p_confidence: number;
        };
        Returns: Record<string, any>;
      };
      get_job_voice_summary: {
        Args: { p_job_id: string };
        Returns: string;
      };
    };

    Enums: {
      job_status: JobStatus;
      job_priority: JobPriority;
      equipment_status: EquipmentStatus;
      material_unit: MaterialUnit;
      transcription_status: TranscriptionStatus;
      intent_type: IntentType;
      media_type: MediaType;
      user_role: UserRole;
      contact_role: ContactRoleDb;
      contact_preferred_method: ContactPreferredMethod;
    };
  };
};

// Enum types
export type JobStatus = 
  | 'draft'
  | 'scheduled'
  | 'dispatched'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'voice_created';

export type JobPriority = 'low' | 'normal' | 'high' | 'urgent' | 'emergency';

export type EquipmentStatus = 'active' | 'maintenance' | 'broken' | 'retired' | 'reserved';

export type MaterialUnit = 
  | 'each'
  | 'box'
  | 'case'
  | 'pound'
  | 'ounce'
  | 'gallon'
  | 'liter'
  | 'foot'
  | 'meter'
  | 'hour'
  | 'minute';

export type TranscriptionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'partial';

export type IntentType = 
  | 'create_job'
  | 'update_job'
  | 'job_query'
  | 'navigation'
  | 'equipment_check'
  | 'material_request'
  | 'time_entry'
  | 'photo_capture'
  | 'note_taking'
  | 'help_request'
  | 'confirmation'
  | 'cancellation'
  | 'unknown';

export type MediaType = 'image' | 'video' | 'audio' | 'document' | 'signature';

export type UserRole = 'admin' | 'manager' | 'technician' | 'viewer';

export type ContactRoleDb = 'primary' | 'billing' | 'service' | 'emergency' | 'other';

export type ContactPreferredMethod = 'phone' | 'email' | 'sms';

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
