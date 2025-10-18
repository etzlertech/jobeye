// Generated TypeScript types from Supabase database
// Generated: 2025-10-18T08:06:29.693017

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type geography = unknown

// Database Enums
export type assignment_status = 'active' | 'completed' | 'cancelled'
export type auth_event_type = 'login_success' | 'login_failed' | 'logout_success' | 'registration_success' | 'registration_failed' | 'refresh_success' | 'refresh_failed' | 'password_reset' | 'mfa_setup' | 'mfa_failed'
export type container_color = 'red' | 'black' | 'white' | 'blue' | 'green' | 'yellow' | 'gray' | 'orange' | 'silver' | 'other'
export type container_type = 'truck' | 'trailer' | 'storage_bin' | 'warehouse' | 'building' | 'toolbox'
export type device_type = 'mobile' | 'desktop' | 'tablet' | 'voice_assistant'
export type equipment_status = 'active' | 'maintenance' | 'broken' | 'retired' | 'reserved'
export type filter_action = 'always_exclude' | 'always_include' | 'ask'
export type intent_type = 'create_job' | 'update_job' | 'job_query' | 'navigation' | 'equipment_check' | 'material_request' | 'time_entry' | 'photo_capture' | 'note_taking' | 'help_request' | 'confirmation' | 'cancellation' | 'unknown'
export type irrigation_controller_type = 'smart' | 'conventional' | 'hybrid'
export type item_status = 'active' | 'maintenance' | 'repair' | 'retired' | 'lost'
export type item_type = 'equipment' | 'material'
export type job_priority = 'low' | 'normal' | 'high' | 'urgent' | 'emergency'
export type job_status = 'draft' | 'scheduled' | 'dispatched' | 'in_progress' | 'paused' | 'completed' | 'cancelled' | 'failed' | 'voice_created'
export type material_unit = 'each' | 'box' | 'case' | 'pound' | 'ounce' | 'gallon' | 'liter' | 'foot' | 'meter' | 'hour' | 'minute'
export type media_type = 'image' | 'video' | 'audio' | 'document' | 'signature'
export type mfa_method = 'totp' | 'sms' | 'email' | 'voice_biometric'
export type ocr_method = 'tesseract' | 'gpt4_vision'
export type relationship_type = 'accessory' | 'part' | 'alternative' | 'replacement' | 'upgrade'
export type schedule_type = 'fixed' | 'smart' | 'weather_based' | 'seasonal' | 'manual'
export type session_status = 'active' | 'expired' | 'terminated' | 'suspended'
export type tracking_mode = 'individual' | 'quantity'
export type transaction_type = 'check_out' | 'check_in' | 'transfer' | 'register' | 'purchase' | 'usage' | 'decommission' | 'audit' | 'maintenance'
export type transcription_status = 'pending' | 'processing' | 'completed' | 'failed' | 'partial'
export type user_role = 'admin' | 'manager' | 'technician' | 'customer'
export type valve_status = 'open' | 'closed' | 'fault' | 'unknown'
export type verification_method = 'manual' | 'qr_scan' | 'photo_vision' | 'voice'
export type vision_verification_type = 'before_photo' | 'after_photo' | 'issue_photo' | 'equipment_scan' | 'material_scan' | 'document_scan'
export type zone_type = 'lawn' | 'shrubs' | 'trees' | 'drip' | 'garden' | 'other'

export interface Database {
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          id: string
          tenant_id: string | null
          target_id: string
          target_type: string
          action: string
          actor_id: string | null
          actor_email: string | null
          actor_roles: string[] | null
          reason: string | null
          comment: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          target_id: string
          target_type: string
          action: string
          actor_id?: string | null
          actor_email?: string | null
          actor_roles?: string[] | null
          reason?: string | null
          comment?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string | null
          target_id?: string
          target_type?: string
          action?: string
          actor_id?: string | null
          actor_email?: string | null
          actor_roles?: string[] | null
          reason?: string | null
          comment?: string | null
          metadata?: Json | null
          created_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          tenant_id: string
          entity_type: string
          entity_id: string
          action: string
          performed_by: string
          details: Json | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          entity_type: string
          entity_id: string
          action: string
          performed_by: string
          details?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          entity_type?: string
          entity_id?: string
          action?: string
          performed_by?: string
          details?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
      }
      auth_audit_log: {
        Row: {
          id: string
          event_type: auth_event_type
          user_id: string | null
          user_email: string | null
          tenant_id: string | null
          session_id: string | null
          ip_address: unknown | null
          user_agent: string | null
          device_type: device_type | null
          location: Json | null
          success: boolean | null
          reason: string | null
          error_code: string | null
          risk_score: number | null
          details: Json | null
          voice_command: string | null
          voice_confidence: number | null
          created_at: string
        }
        Insert: {
          id?: string
          event_type: auth_event_type
          user_id?: string | null
          user_email?: string | null
          tenant_id?: string | null
          session_id?: string | null
          ip_address?: unknown | null
          user_agent?: string | null
          device_type?: device_type | null
          location?: Json | null
          success?: boolean | null
          reason?: string | null
          error_code?: string | null
          risk_score?: number | null
          details?: Json | null
          voice_command?: string | null
          voice_confidence?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          event_type?: auth_event_type
          user_id?: string | null
          user_email?: string | null
          tenant_id?: string | null
          session_id?: string | null
          ip_address?: unknown | null
          user_agent?: string | null
          device_type?: device_type | null
          location?: Json | null
          success?: boolean | null
          reason?: string | null
          error_code?: string | null
          risk_score?: number | null
          details?: Json | null
          voice_command?: string | null
          voice_confidence?: number | null
          created_at?: string
        }
      }
      code_pattern_violations: {
        Row: {
          id: string
          file_path: string
          line_number: number
          column_number: number
          pattern_type: string
          violation_text: string
          suggested_fix: string
          is_fixed: boolean
          fixed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          file_path: string
          line_number: number
          column_number: number
          pattern_type: string
          violation_text: string
          suggested_fix: string
          is_fixed?: boolean
          fixed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          file_path?: string
          line_number?: number
          column_number?: number
          pattern_type?: string
          violation_text?: string
          suggested_fix?: string
          is_fixed?: boolean
          fixed_at?: string | null
          created_at?: string
        }
      }
      companies: {
        Row: {
          id: string
          tenant_id: string | null
          name: string | null
          created_at: string
          updated_at: string
          domain: string | null
          is_active: boolean
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          name?: string | null
          created_at?: string
          updated_at?: string
          domain?: string | null
          is_active?: boolean
        }
        Update: {
          id?: string
          tenant_id?: string | null
          name?: string | null
          created_at?: string
          updated_at?: string
          domain?: string | null
          is_active?: boolean
        }
      }
      conflict_logs: {
        Row: {
          id: string
          tenant_id: string
          entity_type: string
          entity_id: string
          job_id: string | null
          conflict_type: string
          field_name: string | null
          user1_id: string
          user1_role: string
          user1_changes: Json
          user1_timestamp: string
          user2_id: string
          user2_role: string
          user2_changes: Json
          user2_timestamp: string
          resolution_strategy: string
          merged_result: Json
          winning_user_id: string | null
          requires_supervisor_review: boolean
          reviewed_by: string | null
          reviewed_at: string | null
          review_notes: string | null
          detected_at: string
          resolved_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          entity_type: string
          entity_id: string
          job_id?: string | null
          conflict_type: string
          field_name?: string | null
          user1_id: string
          user1_role: string
          user1_changes: Json
          user1_timestamp: string
          user2_id: string
          user2_role: string
          user2_changes: Json
          user2_timestamp: string
          resolution_strategy: string
          merged_result: Json
          winning_user_id?: string | null
          requires_supervisor_review?: boolean
          reviewed_by?: string | null
          reviewed_at?: string | null
          review_notes?: string | null
          detected_at?: string
          resolved_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          entity_type?: string
          entity_id?: string
          job_id?: string | null
          conflict_type?: string
          field_name?: string | null
          user1_id?: string
          user1_role?: string
          user1_changes?: Json
          user1_timestamp?: string
          user2_id?: string
          user2_role?: string
          user2_changes?: Json
          user2_timestamp?: string
          resolution_strategy?: string
          merged_result?: Json
          winning_user_id?: string | null
          requires_supervisor_review?: boolean
          reviewed_by?: string | null
          reviewed_at?: string | null
          review_notes?: string | null
          detected_at?: string
          resolved_at?: string
        }
      }
      customer_feedback: {
        Row: {
          id: string
          tenant_id: string
          customer_id: string | null
          job_id: string | null
          feedback_type: string
          severity: string | null
          description: string
          reported_by: string
          status: string
          escalated_to: string | null
          escalation_notes: string | null
          created_at: string
          resolved_at: string | null
          resolution_notes: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          customer_id?: string | null
          job_id?: string | null
          feedback_type: string
          severity?: string | null
          description: string
          reported_by: string
          status?: string
          escalated_to?: string | null
          escalation_notes?: string | null
          created_at?: string
          resolved_at?: string | null
          resolution_notes?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          customer_id?: string | null
          job_id?: string | null
          feedback_type?: string
          severity?: string | null
          description?: string
          reported_by?: string
          status?: string
          escalated_to?: string | null
          escalation_notes?: string | null
          created_at?: string
          resolved_at?: string | null
          resolution_notes?: string | null
        }
      }
      customers: {
        Row: {
          id: string
          tenant_id: string | null
          customer_number: string
          name: string
          email: string | null
          phone: string | null
          mobile_phone: string | null
          billing_address: Json | null
          service_address: Json | null
          notes: string | null
          tags: string[] | null
          voice_notes: string | null
          is_active: boolean | null
          metadata: Json | null
          created_at: string | null
          updated_at: string | null
          created_by: string | null
          version: number | null
          intake_session_id: string | null
          thumbnail_url: string | null
          medium_url: string | null
          primary_image_url: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          customer_number: string
          name: string
          email?: string | null
          phone?: string | null
          mobile_phone?: string | null
          billing_address?: Json | null
          service_address?: Json | null
          notes?: string | null
          tags?: string[] | null
          voice_notes?: string | null
          is_active?: boolean | null
          metadata?: Json | null
          created_at?: string | null
          updated_at?: string | null
          created_by?: string | null
          version?: number | null
          intake_session_id?: string | null
          thumbnail_url?: string | null
          medium_url?: string | null
          primary_image_url?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          customer_number?: string
          name?: string
          email?: string | null
          phone?: string | null
          mobile_phone?: string | null
          billing_address?: Json | null
          service_address?: Json | null
          notes?: string | null
          tags?: string[] | null
          voice_notes?: string | null
          is_active?: boolean | null
          metadata?: Json | null
          created_at?: string | null
          updated_at?: string | null
          created_by?: string | null
          version?: number | null
          intake_session_id?: string | null
          thumbnail_url?: string | null
          medium_url?: string | null
          primary_image_url?: string | null
        }
      }
      daily_reports: {
        Row: {
          id: string
          report_date: string
          created_by: string
          technician_count: number
          jobs_assigned: number
          equipment_audit_id: string | null
          summary_text: string | null
          created_at: string | null
          tenant_id: string | null
        }
        Insert: {
          id?: string
          report_date: string
          created_by: string
          technician_count: number
          jobs_assigned: number
          equipment_audit_id?: string | null
          summary_text?: string | null
          created_at?: string | null
          tenant_id?: string | null
        }
        Update: {
          id?: string
          report_date?: string
          created_by?: string
          technician_count?: number
          jobs_assigned?: number
          equipment_audit_id?: string | null
          summary_text?: string | null
          created_at?: string | null
          tenant_id?: string | null
        }
      }
      day_plans: {
        Row: {
          id: string
          tenant_id: string
          user_id: string
          plan_date: string
          status: string
          route_data: Json | null
          total_distance_miles: number | null
          estimated_duration_minutes: number | null
          actual_start_time: string | null
          actual_end_time: string | null
          voice_session_id: string | null
          auto_schedule_breaks: boolean | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          user_id: string
          plan_date: string
          status?: string
          route_data?: Json | null
          total_distance_miles?: number | null
          estimated_duration_minutes?: number | null
          actual_start_time?: string | null
          actual_end_time?: string | null
          voice_session_id?: string | null
          auto_schedule_breaks?: boolean | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          user_id?: string
          plan_date?: string
          status?: string
          route_data?: Json | null
          total_distance_miles?: number | null
          estimated_duration_minutes?: number | null
          actual_start_time?: string | null
          actual_end_time?: string | null
          voice_session_id?: string | null
          auto_schedule_breaks?: boolean | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      dev_manifest_history: {
        Row: {
          id: string
          created_at: string
          manifest_content: string
          file_count: number
          generated_by: string | null
          branch_name: string | null
          commit_hash: string | null
          completion_percentage: number | null
          voice_coverage_percentage: number | null
        }
        Insert: {
          id?: string
          created_at?: string
          manifest_content: string
          file_count: number
          generated_by?: string | null
          branch_name?: string | null
          commit_hash?: string | null
          completion_percentage?: number | null
          voice_coverage_percentage?: number | null
        }
        Update: {
          id?: string
          created_at?: string
          manifest_content?: string
          file_count?: number
          generated_by?: string | null
          branch_name?: string | null
          commit_hash?: string | null
          completion_percentage?: number | null
          voice_coverage_percentage?: number | null
        }
      }
      dev_project_standards: {
        Row: {
          id: string
          document_title: string
          document_content: string
          version: string
          last_updated_at: string
          updated_by: string | null
          category: string | null
          is_active: boolean | null
          tags: string[] | null
        }
        Insert: {
          id?: string
          document_title: string
          document_content: string
          version: string
          last_updated_at?: string
          updated_by?: string | null
          category?: string | null
          is_active?: boolean | null
          tags?: string[] | null
        }
        Update: {
          id?: string
          document_title?: string
          document_content?: string
          version?: string
          last_updated_at?: string
          updated_by?: string | null
          category?: string | null
          is_active?: boolean | null
          tags?: string[] | null
        }
      }
      equipment_incidents: {
        Row: {
          id: string
          tenant_id: string
          reported_by: string
          incident_type: string
          equipment_item: string
          description: string | null
          verification_id: string | null
          severity: string
          status: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          reported_by: string
          incident_type: string
          equipment_item: string
          description?: string | null
          verification_id?: string | null
          severity: string
          status: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          reported_by?: string
          incident_type?: string
          equipment_item?: string
          description?: string | null
          verification_id?: string | null
          severity?: string
          status?: string
          created_at?: string | null
          updated_at?: string | null
        }
      }
      equipment_maintenance: {
        Row: {
          id: string
          equipment_id: string
          performed_by: string
          maintenance_type: string
          maintenance_date: string
          actions_performed: string[] | null
          pre_maintenance_verification_id: string | null
          post_maintenance_verification_id: string | null
          status: string
          completion_date: string | null
          notes: string | null
          created_at: string | null
          tenant_id: string | null
        }
        Insert: {
          id?: string
          equipment_id: string
          performed_by: string
          maintenance_type: string
          maintenance_date: string
          actions_performed?: string[] | null
          pre_maintenance_verification_id?: string | null
          post_maintenance_verification_id?: string | null
          status: string
          completion_date?: string | null
          notes?: string | null
          created_at?: string | null
          tenant_id?: string | null
        }
        Update: {
          id?: string
          equipment_id?: string
          performed_by?: string
          maintenance_type?: string
          maintenance_date?: string
          actions_performed?: string[] | null
          pre_maintenance_verification_id?: string | null
          post_maintenance_verification_id?: string | null
          status?: string
          completion_date?: string | null
          notes?: string | null
          created_at?: string | null
          tenant_id?: string | null
        }
      }
      geofence_events: {
        Row: {
          id: string
          tenant_id: string
          geofence_id: string
          user_id: string
          event_type: string
          latitude: number
          longitude: number
          timestamp: string
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          geofence_id: string
          user_id: string
          event_type: string
          latitude: number
          longitude: number
          timestamp: string
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          geofence_id?: string
          user_id?: string
          event_type?: string
          latitude?: number
          longitude?: number
          timestamp?: string
          created_at?: string | null
        }
      }
      geofences: {
        Row: {
          id: string
          tenant_id: string
          job_id: string | null
          name: string
          center_latitude: number
          center_longitude: number
          radius_meters: number
          active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          job_id?: string | null
          name: string
          center_latitude: number
          center_longitude: number
          radius_meters: number
          active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          job_id?: string | null
          name?: string
          center_latitude?: number
          center_longitude?: number
          radius_meters?: number
          active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      gps_tracking_records: {
        Row: {
          id: string
          tenant_id: string
          user_id: string
          job_id: string | null
          latitude: number
          longitude: number
          accuracy_meters: number
          altitude_meters: number | null
          speed_mps: number | null
          heading_degrees: number | null
          recorded_at: string
          created_at: string | null
          accuracy: number | null
          altitude: number | null
          speed: number | null
          heading: number | null
          timestamp: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          user_id: string
          job_id?: string | null
          latitude: number
          longitude: number
          accuracy_meters: number
          altitude_meters?: number | null
          speed_mps?: number | null
          heading_degrees?: number | null
          recorded_at?: string
          created_at?: string | null
          accuracy?: number | null
          altitude?: number | null
          speed?: number | null
          heading?: number | null
          timestamp?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          user_id?: string
          job_id?: string | null
          latitude?: number
          longitude?: number
          accuracy_meters?: number
          altitude_meters?: number | null
          speed_mps?: number | null
          heading_degrees?: number | null
          recorded_at?: string
          created_at?: string | null
          accuracy?: number | null
          altitude?: number | null
          speed?: number | null
          heading?: number | null
          timestamp?: string | null
        }
      }
      intake_documents: {
        Row: {
          id: string
          tenant_id: string
          intake_request_id: string
          document_url: string
          document_type: string | null
          ocr_text: string | null
          created_at: string | null
          ocr_confidence: number | null
          ocr_metadata: Json | null
          intake_id: string | null
          storage_path: string | null
          file_size_bytes: number | null
          uploaded_at: string | null
          processed_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          intake_request_id: string
          document_url: string
          document_type?: string | null
          ocr_text?: string | null
          created_at?: string | null
          ocr_confidence?: number | null
          ocr_metadata?: Json | null
          intake_id?: string | null
          storage_path?: string | null
          file_size_bytes?: number | null
          uploaded_at?: string | null
          processed_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          intake_request_id?: string
          document_url?: string
          document_type?: string | null
          ocr_text?: string | null
          created_at?: string | null
          ocr_confidence?: number | null
          ocr_metadata?: Json | null
          intake_id?: string | null
          storage_path?: string | null
          file_size_bytes?: number | null
          uploaded_at?: string | null
          processed_at?: string | null
        }
      }
      intake_requests: {
        Row: {
          id: string
          tenant_id: string
          customer_name: string
          customer_email: string | null
          customer_phone: string | null
          service_type: string | null
          description: string | null
          status: string
          priority: string
          converted_to_job_id: string | null
          created_at: string | null
          updated_at: string | null
          assigned_to: string | null
          lead_score: number | null
          converted_at: string | null
          request_source: string | null
          source: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          customer_name: string
          customer_email?: string | null
          customer_phone?: string | null
          service_type?: string | null
          description?: string | null
          status?: string
          priority?: string
          converted_to_job_id?: string | null
          created_at?: string | null
          updated_at?: string | null
          assigned_to?: string | null
          lead_score?: number | null
          converted_at?: string | null
          request_source?: string | null
          source?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          customer_name?: string
          customer_email?: string | null
          customer_phone?: string | null
          service_type?: string | null
          description?: string | null
          status?: string
          priority?: string
          converted_to_job_id?: string | null
          created_at?: string | null
          updated_at?: string | null
          assigned_to?: string | null
          lead_score?: number | null
          converted_at?: string | null
          request_source?: string | null
          source?: string | null
        }
      }
      inventory_images: {
        Row: {
          id: string
          tenant_id: string
          item_type: string
          item_id: string
          image_url: string
          thumbnail_url: string | null
          is_primary: boolean | null
          angle: string | null
          aspect_ratio: number | null
          original_width: number | null
          original_height: number | null
          crop_box: Json | null
          metadata: Json | null
          captured_by: string | null
          captured_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          item_type: string
          item_id: string
          image_url: string
          thumbnail_url?: string | null
          is_primary?: boolean | null
          angle?: string | null
          aspect_ratio?: number | null
          original_width?: number | null
          original_height?: number | null
          crop_box?: Json | null
          metadata?: Json | null
          captured_by?: string | null
          captured_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          item_type?: string
          item_id?: string
          image_url?: string
          thumbnail_url?: string | null
          is_primary?: boolean | null
          angle?: string | null
          aspect_ratio?: number | null
          original_width?: number | null
          original_height?: number | null
          crop_box?: Json | null
          metadata?: Json | null
          captured_by?: string | null
          captured_at?: string | null
          created_at?: string | null
        }
      }
      invoices: {
        Row: {
          id: string
          tenant_id: string
          invoice_number: string
          customer_id: string | null
          job_id: string | null
          amount: number
          tax_amount: number | null
          total_amount: number | null
          status: string
          created_by: string
          due_date: string
          paid_date: string | null
          payment_method: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          invoice_number: string
          customer_id?: string | null
          job_id?: string | null
          amount: number
          tax_amount?: number | null
          total_amount?: number | null
          status?: string
          created_by: string
          due_date: string
          paid_date?: string | null
          payment_method?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          invoice_number?: string
          customer_id?: string | null
          job_id?: string | null
          amount?: number
          tax_amount?: number | null
          total_amount?: number | null
          status?: string
          created_by?: string
          due_date?: string
          paid_date?: string | null
          payment_method?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      item_transactions: {
        Row: {
          id: string
          tenant_id: string
          transaction_type: string
          item_id: string
          quantity: number
          from_location_id: string | null
          to_location_id: string | null
          from_user_id: string | null
          to_user_id: string | null
          job_id: string | null
          purchase_order_id: string | null
          work_order_id: string | null
          cost: number | null
          notes: string | null
          reason: string | null
          voice_session_id: string | null
          detection_session_id: string | null
          confidence_score: number | null
          metadata: Json | null
          created_at: string | null
          created_by: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          transaction_type: string
          item_id: string
          quantity?: number
          from_location_id?: string | null
          to_location_id?: string | null
          from_user_id?: string | null
          to_user_id?: string | null
          job_id?: string | null
          purchase_order_id?: string | null
          work_order_id?: string | null
          cost?: number | null
          notes?: string | null
          reason?: string | null
          voice_session_id?: string | null
          detection_session_id?: string | null
          confidence_score?: number | null
          metadata?: Json | null
          created_at?: string | null
          created_by?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          transaction_type?: string
          item_id?: string
          quantity?: number
          from_location_id?: string | null
          to_location_id?: string | null
          from_user_id?: string | null
          to_user_id?: string | null
          job_id?: string | null
          purchase_order_id?: string | null
          work_order_id?: string | null
          cost?: number | null
          notes?: string | null
          reason?: string | null
          voice_session_id?: string | null
          detection_session_id?: string | null
          confidence_score?: number | null
          metadata?: Json | null
          created_at?: string | null
          created_by?: string | null
        }
      }
      items: {
        Row: {
          id: string
          tenant_id: string
          item_type: string
          category: string
          tracking_mode: string
          name: string
          description: string | null
          manufacturer: string | null
          model: string | null
          serial_number: string | null
          sku: string | null
          barcode: string | null
          current_quantity: number | null
          unit_of_measure: string | null
          min_quantity: number | null
          max_quantity: number | null
          reorder_point: number | null
          current_location_id: string | null
          home_location_id: string | null
          assigned_to_user_id: string | null
          assigned_to_job_id: string | null
          status: string
          condition: string | null
          last_maintenance_date: string | null
          next_maintenance_date: string | null
          purchase_date: string | null
          purchase_price: number | null
          current_value: number | null
          depreciation_method: string | null
          attributes: Json | null
          tags: string[] | null
          custom_fields: Json | null
          primary_image_url: string | null
          image_urls: string[] | null
          created_at: string | null
          created_by: string | null
          updated_at: string | null
          updated_by: string | null
          thumbnail_url: string | null
          medium_url: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          item_type: string
          category: string
          tracking_mode: string
          name: string
          description?: string | null
          manufacturer?: string | null
          model?: string | null
          serial_number?: string | null
          sku?: string | null
          barcode?: string | null
          current_quantity?: number | null
          unit_of_measure?: string | null
          min_quantity?: number | null
          max_quantity?: number | null
          reorder_point?: number | null
          current_location_id?: string | null
          home_location_id?: string | null
          assigned_to_user_id?: string | null
          assigned_to_job_id?: string | null
          status?: string
          condition?: string | null
          last_maintenance_date?: string | null
          next_maintenance_date?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          current_value?: number | null
          depreciation_method?: string | null
          attributes?: Json | null
          tags?: string[] | null
          custom_fields?: Json | null
          primary_image_url?: string | null
          image_urls?: string[] | null
          created_at?: string | null
          created_by?: string | null
          updated_at?: string | null
          updated_by?: string | null
          thumbnail_url?: string | null
          medium_url?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          item_type?: string
          category?: string
          tracking_mode?: string
          name?: string
          description?: string | null
          manufacturer?: string | null
          model?: string | null
          serial_number?: string | null
          sku?: string | null
          barcode?: string | null
          current_quantity?: number | null
          unit_of_measure?: string | null
          min_quantity?: number | null
          max_quantity?: number | null
          reorder_point?: number | null
          current_location_id?: string | null
          home_location_id?: string | null
          assigned_to_user_id?: string | null
          assigned_to_job_id?: string | null
          status?: string
          condition?: string | null
          last_maintenance_date?: string | null
          next_maintenance_date?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          current_value?: number | null
          depreciation_method?: string | null
          attributes?: Json | null
          tags?: string[] | null
          custom_fields?: Json | null
          primary_image_url?: string | null
          image_urls?: string[] | null
          created_at?: string | null
          created_by?: string | null
          updated_at?: string | null
          updated_by?: string | null
          thumbnail_url?: string | null
          medium_url?: string | null
        }
      }
      job_assignments: {
        Row: {
          id: string
          tenant_id: string
          job_id: string
          user_id: string
          assigned_by: string | null
          assigned_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          job_id: string
          user_id: string
          assigned_by?: string | null
          assigned_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          job_id?: string
          user_id?: string
          assigned_by?: string | null
          assigned_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      job_checklist_items: {
        Row: {
          id: string
          job_id: string
          sequence_number: number
          item_type: string | null
          item_id: string
          item_name: string
          quantity: number | null
          container_id: string | null
          status: string | null
          vlm_prompt: string | null
          acceptance_criteria: string | null
          notes: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          job_id: string
          sequence_number: number
          item_type?: string | null
          item_id: string
          item_name: string
          quantity?: number | null
          container_id?: string | null
          status?: string | null
          vlm_prompt?: string | null
          acceptance_criteria?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          job_id?: string
          sequence_number?: number
          item_type?: string | null
          item_id?: string
          item_name?: string
          quantity?: number | null
          container_id?: string | null
          status?: string | null
          vlm_prompt?: string | null
          acceptance_criteria?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      job_reschedules: {
        Row: {
          id: string
          tenant_id: string
          original_job_id: string | null
          original_date: string
          new_date: string
          reason: string
          rescheduled_by: string
          status: string
          customer_notified: boolean | null
          created_at: string
          confirmed_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          original_job_id?: string | null
          original_date: string
          new_date: string
          reason: string
          rescheduled_by: string
          status?: string
          customer_notified?: boolean | null
          created_at?: string
          confirmed_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          original_job_id?: string | null
          original_date?: string
          new_date?: string
          reason?: string
          rescheduled_by?: string
          status?: string
          customer_notified?: boolean | null
          created_at?: string
          confirmed_at?: string | null
        }
      }
      jobs: {
        Row: {
          id: string
          tenant_id: string
          job_number: string
          template_id: string | null
          customer_id: string
          property_id: string | null
          title: string
          description: string | null
          status: job_status | null
          priority: job_priority | null
          scheduled_start: string | null
          scheduled_end: string | null
          actual_start: string | null
          actual_end: string | null
          assigned_to: string | null
          assigned_team: string[] | null
          estimated_duration: number | null
          actual_duration: number | null
          completion_notes: string | null
          voice_notes: string | null
          voice_created: boolean | null
          voice_session_id: string | null
          checklist_items: Json | null
          materials_used: Json | null
          equipment_used: string[] | null
          photos_before: Json | null
          photos_after: Json | null
          signature_required: boolean | null
          signature_data: Json | null
          billing_info: Json | null
          metadata: Json | null
          created_at: string | null
          updated_at: string | null
          created_by: string | null
          arrival_photo_id: string | null
          arrival_confirmed_at: string | null
          completion_quality_score: number | null
          requires_supervisor_review: boolean | null
          arrival_timestamp: string | null
          arrival_gps_coords: unknown | null
          arrival_method: string | null
          arrival_confidence: string | null
          completion_timestamp: string | null
          completion_photo_url: string | null
          tool_reload_verified: boolean | null
          offline_modified_at: string | null
          offline_modified_by: string | null
          special_instructions_audio: string | null
          estimated_duration_minutes: number | null
          actual_duration_minutes: number | null
          completion_photo_urls: string[] | null
          thumbnail_url: string | null
          medium_url: string | null
          primary_image_url: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          job_number: string
          template_id?: string | null
          customer_id: string
          property_id?: string | null
          title: string
          description?: string | null
          status?: job_status | null
          priority?: job_priority | null
          scheduled_start?: string | null
          scheduled_end?: string | null
          actual_start?: string | null
          actual_end?: string | null
          assigned_to?: string | null
          assigned_team?: string[] | null
          estimated_duration?: number | null
          actual_duration?: number | null
          completion_notes?: string | null
          voice_notes?: string | null
          voice_created?: boolean | null
          voice_session_id?: string | null
          checklist_items?: Json | null
          materials_used?: Json | null
          equipment_used?: string[] | null
          photos_before?: Json | null
          photos_after?: Json | null
          signature_required?: boolean | null
          signature_data?: Json | null
          billing_info?: Json | null
          metadata?: Json | null
          created_at?: string | null
          updated_at?: string | null
          created_by?: string | null
          arrival_photo_id?: string | null
          arrival_confirmed_at?: string | null
          completion_quality_score?: number | null
          requires_supervisor_review?: boolean | null
          arrival_timestamp?: string | null
          arrival_gps_coords?: unknown | null
          arrival_method?: string | null
          arrival_confidence?: string | null
          completion_timestamp?: string | null
          completion_photo_url?: string | null
          tool_reload_verified?: boolean | null
          offline_modified_at?: string | null
          offline_modified_by?: string | null
          special_instructions_audio?: string | null
          estimated_duration_minutes?: number | null
          actual_duration_minutes?: number | null
          completion_photo_urls?: string[] | null
          thumbnail_url?: string | null
          medium_url?: string | null
          primary_image_url?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          job_number?: string
          template_id?: string | null
          customer_id?: string
          property_id?: string | null
          title?: string
          description?: string | null
          status?: job_status | null
          priority?: job_priority | null
          scheduled_start?: string | null
          scheduled_end?: string | null
          actual_start?: string | null
          actual_end?: string | null
          assigned_to?: string | null
          assigned_team?: string[] | null
          estimated_duration?: number | null
          actual_duration?: number | null
          completion_notes?: string | null
          voice_notes?: string | null
          voice_created?: boolean | null
          voice_session_id?: string | null
          checklist_items?: Json | null
          materials_used?: Json | null
          equipment_used?: string[] | null
          photos_before?: Json | null
          photos_after?: Json | null
          signature_required?: boolean | null
          signature_data?: Json | null
          billing_info?: Json | null
          metadata?: Json | null
          created_at?: string | null
          updated_at?: string | null
          created_by?: string | null
          arrival_photo_id?: string | null
          arrival_confirmed_at?: string | null
          completion_quality_score?: number | null
          requires_supervisor_review?: boolean | null
          arrival_timestamp?: string | null
          arrival_gps_coords?: unknown | null
          arrival_method?: string | null
          arrival_confidence?: string | null
          completion_timestamp?: string | null
          completion_photo_url?: string | null
          tool_reload_verified?: boolean | null
          offline_modified_at?: string | null
          offline_modified_by?: string | null
          special_instructions_audio?: string | null
          estimated_duration_minutes?: number | null
          actual_duration_minutes?: number | null
          completion_photo_urls?: string[] | null
          thumbnail_url?: string | null
          medium_url?: string | null
          primary_image_url?: string | null
        }
      }
      kit_assignments: {
        Row: {
          id: string
          kit_id: string
          variant_id: string | null
          external_ref: string
          notes: string | null
          metadata: Json
          created_at: string
          updated_at: string
          tenant_id: string | null
        }
        Insert: {
          id?: string
          kit_id: string
          variant_id?: string | null
          external_ref: string
          notes?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
          tenant_id?: string | null
        }
        Update: {
          id?: string
          kit_id?: string
          variant_id?: string | null
          external_ref?: string
          notes?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
          tenant_id?: string | null
        }
      }
      kit_items: {
        Row: {
          id: string
          tenant_id: string
          kit_id: string
          item_type: string
          quantity: number
          unit: string | null
          is_required: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          kit_id: string
          item_type: string
          quantity?: number
          unit?: string | null
          is_required?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          kit_id?: string
          item_type?: string
          quantity?: number
          unit?: string | null
          is_required?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      kit_variants: {
        Row: {
          id: string
          tenant_id: string
          kit_id: string
          variant_code: string
          name: string
          is_default: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          kit_id: string
          variant_code: string
          name: string
          is_default?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          kit_id?: string
          variant_code?: string
          name?: string
          is_default?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      kits: {
        Row: {
          id: string
          tenant_id: string
          kit_code: string
          name: string
          description: string | null
          category: string | null
          is_active: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          kit_code: string
          name: string
          description?: string | null
          category?: string | null
          is_active?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          kit_code?: string
          name?: string
          description?: string | null
          category?: string | null
          is_active?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      maintenance_schedule: {
        Row: {
          id: string
          tenant_id: string
          equipment_id: string
          scheduled_date: string
          maintenance_type: string
          assigned_to: string | null
          status: string
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          equipment_id: string
          scheduled_date: string
          maintenance_type: string
          assigned_to?: string | null
          status: string
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          equipment_id?: string
          scheduled_date?: string
          maintenance_type?: string
          assigned_to?: string | null
          status?: string
          created_at?: string | null
        }
      }
      maintenance_tickets: {
        Row: {
          id: string
          tenant_id: string
          equipment_id: string | null
          reported_by: string
          issue_type: string
          severity: string
          description: string
          status: string
          assigned_to: string | null
          resolution_notes: string | null
          created_at: string
          resolved_at: string | null
          estimated_cost: number | null
          actual_cost: number | null
        }
        Insert: {
          id?: string
          tenant_id: string
          equipment_id?: string | null
          reported_by: string
          issue_type: string
          severity: string
          description: string
          status?: string
          assigned_to?: string | null
          resolution_notes?: string | null
          created_at?: string
          resolved_at?: string | null
          estimated_cost?: number | null
          actual_cost?: number | null
        }
        Update: {
          id?: string
          tenant_id?: string
          equipment_id?: string | null
          reported_by?: string
          issue_type?: string
          severity?: string
          description?: string
          status?: string
          assigned_to?: string | null
          resolution_notes?: string | null
          created_at?: string
          resolved_at?: string | null
          estimated_cost?: number | null
          actual_cost?: number | null
        }
      }
      material_requests: {
        Row: {
          id: string
          tenant_id: string
          job_id: string | null
          requested_by: string
          status: string
          priority: string
          items_needed: Json
          reason: string | null
          created_at: string
          fulfilled_at: string | null
          fulfilled_by: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          job_id?: string | null
          requested_by: string
          status?: string
          priority?: string
          items_needed: Json
          reason?: string | null
          created_at?: string
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          job_id?: string | null
          requested_by?: string
          status?: string
          priority?: string
          items_needed?: Json
          reason?: string | null
          created_at?: string
          fulfilled_at?: string | null
          fulfilled_by?: string | null
          notes?: string | null
        }
      }
      mfa_challenges: {
        Row: {
          id: string
          challenge_id: string
          user_id: string
          method: mfa_method
          challenge_data: string | null
          expires_at: string
          attempts: number | null
          max_attempts: number | null
          completed_at: string | null
          success: boolean | null
          ip_address: unknown | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          challenge_id: string
          user_id: string
          method: mfa_method
          challenge_data?: string | null
          expires_at?: string
          attempts?: number | null
          max_attempts?: number | null
          completed_at?: string | null
          success?: boolean | null
          ip_address?: unknown | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          challenge_id?: string
          user_id?: string
          method?: mfa_method
          challenge_data?: string | null
          expires_at?: string
          attempts?: number | null
          max_attempts?: number | null
          completed_at?: string | null
          success?: boolean | null
          ip_address?: unknown | null
          user_agent?: string | null
          created_at?: string
        }
      }
      mfa_settings: {
        Row: {
          id: string
          user_id: string
          enabled: boolean
          primary_method: mfa_method | null
          backup_methods: string[] | null
          totp_secret: string | null
          totp_backup_codes: string[] | null
          sms_phone: string | null
          email_verified: boolean | null
          voice_biometric_enabled: boolean | null
          voice_pattern_samples: number | null
          recovery_codes_generated_at: string | null
          last_used_at: string | null
          failed_attempts: number | null
          locked_until: string | null
          settings: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          enabled?: boolean
          primary_method?: mfa_method | null
          backup_methods?: string[] | null
          totp_secret?: string | null
          totp_backup_codes?: string[] | null
          sms_phone?: string | null
          email_verified?: boolean | null
          voice_biometric_enabled?: boolean | null
          voice_pattern_samples?: number | null
          recovery_codes_generated_at?: string | null
          last_used_at?: string | null
          failed_attempts?: number | null
          locked_until?: string | null
          settings?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          enabled?: boolean
          primary_method?: mfa_method | null
          backup_methods?: string[] | null
          totp_secret?: string | null
          totp_backup_codes?: string[] | null
          sms_phone?: string | null
          email_verified?: boolean | null
          voice_biometric_enabled?: boolean | null
          voice_pattern_samples?: number | null
          recovery_codes_generated_at?: string | null
          last_used_at?: string | null
          failed_attempts?: number | null
          locked_until?: string | null
          settings?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      notification_queue: {
        Row: {
          id: string
          tenant_id: string
          recipient_id: string
          type: string
          priority: string
          message: string
          data: Json | null
          method: string | null
          status: string
          attempts: number | null
          last_attempt_at: string | null
          delivered_at: string | null
          error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          recipient_id: string
          type: string
          priority?: string
          message: string
          data?: Json | null
          method?: string | null
          status?: string
          attempts?: number | null
          last_attempt_at?: string | null
          delivered_at?: string | null
          error?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          recipient_id?: string
          type?: string
          priority?: string
          message?: string
          data?: Json | null
          method?: string | null
          status?: string
          attempts?: number | null
          last_attempt_at?: string | null
          delivered_at?: string | null
          error?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          notification_type: string
          title: string
          message: string
          priority: string
          related_entity_type: string | null
          related_entity_id: string | null
          read_at: string | null
          created_at: string | null
          tenant_id: string | null
        }
        Insert: {
          id?: string
          user_id: string
          notification_type: string
          title: string
          message: string
          priority: string
          related_entity_type?: string | null
          related_entity_id?: string | null
          read_at?: string | null
          created_at?: string | null
          tenant_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          notification_type?: string
          title?: string
          message?: string
          priority?: string
          related_entity_type?: string | null
          related_entity_id?: string | null
          read_at?: string | null
          created_at?: string | null
          tenant_id?: string | null
        }
      }
      ocr_documents: {
        Row: {
          id: string
          tenant_id: string
          ocr_job_id: string | null
          file_path: string
          page_count: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          ocr_job_id?: string | null
          file_path: string
          page_count?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          ocr_job_id?: string | null
          file_path?: string
          page_count?: number | null
          created_at?: string | null
        }
      }
      ocr_jobs: {
        Row: {
          id: string
          tenant_id: string
          vendor_id: string | null
          status: string
          created_at: string | null
          completed_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          vendor_id?: string | null
          status: string
          created_at?: string | null
          completed_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          vendor_id?: string | null
          status?: string
          created_at?: string | null
          completed_at?: string | null
        }
      }
      ocr_line_items: {
        Row: {
          id: string
          tenant_id: string
          ocr_document_id: string | null
          line_index: number
          sku: string | null
          description: string | null
          qty: number | null
          unit_price: number | null
          total: number | null
        }
        Insert: {
          id?: string
          tenant_id: string
          ocr_document_id?: string | null
          line_index: number
          sku?: string | null
          description?: string | null
          qty?: number | null
          unit_price?: number | null
          total?: number | null
        }
        Update: {
          id?: string
          tenant_id?: string
          ocr_document_id?: string | null
          line_index?: number
          sku?: string | null
          description?: string | null
          qty?: number | null
          unit_price?: number | null
          total?: number | null
        }
      }
      ocr_note_entities: {
        Row: {
          id: string
          ocr_document_id: string | null
          label: string
          value: string | null
          tenant_id: string | null
        }
        Insert: {
          id?: string
          ocr_document_id?: string | null
          label: string
          value?: string | null
          tenant_id?: string | null
        }
        Update: {
          id?: string
          ocr_document_id?: string | null
          label?: string
          value?: string | null
          tenant_id?: string | null
        }
      }
      permissions: {
        Row: {
          id: string
          name: string
          resource: string
          action: string
          description: string | null
          voice_commands: string[] | null
          requires_confirmation: boolean | null
          risk_level: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          resource: string
          action: string
          description?: string | null
          voice_commands?: string[] | null
          requires_confirmation?: boolean | null
          risk_level?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          resource?: string
          action?: string
          description?: string | null
          voice_commands?: string[] | null
          requires_confirmation?: boolean | null
          risk_level?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      properties: {
        Row: {
          id: string
          tenant_id: string
          customer_id: string
          property_number: string
          name: string
          address: Json
          location: geography | null
          property_type: string | null
          size_sqft: number | null
          lot_size_acres: number | null
          zones: Json | null
          access_notes: string | null
          gate_code: string | null
          special_instructions: string | null
          voice_navigation_notes: string | null
          photos: Json | null
          is_active: boolean | null
          metadata: Json | null
          created_at: string | null
          updated_at: string | null
          intake_session_id: string | null
          reference_image_id: string | null
          thumbnail_url: string | null
          medium_url: string | null
          primary_image_url: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          customer_id: string
          property_number: string
          name: string
          address: Json
          location?: geography | null
          property_type?: string | null
          size_sqft?: number | null
          lot_size_acres?: number | null
          zones?: Json | null
          access_notes?: string | null
          gate_code?: string | null
          special_instructions?: string | null
          voice_navigation_notes?: string | null
          photos?: Json | null
          is_active?: boolean | null
          metadata?: Json | null
          created_at?: string | null
          updated_at?: string | null
          intake_session_id?: string | null
          reference_image_id?: string | null
          thumbnail_url?: string | null
          medium_url?: string | null
          primary_image_url?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          customer_id?: string
          property_number?: string
          name?: string
          address?: Json
          location?: geography | null
          property_type?: string | null
          size_sqft?: number | null
          lot_size_acres?: number | null
          zones?: Json | null
          access_notes?: string | null
          gate_code?: string | null
          special_instructions?: string | null
          voice_navigation_notes?: string | null
          photos?: Json | null
          is_active?: boolean | null
          metadata?: Json | null
          created_at?: string | null
          updated_at?: string | null
          intake_session_id?: string | null
          reference_image_id?: string | null
          thumbnail_url?: string | null
          medium_url?: string | null
          primary_image_url?: string | null
        }
      }
      quality_audits: {
        Row: {
          id: string
          tenant_id: string
          auditor_id: string
          audit_date: string
          jobs_audited: number
          site_inspection_verification_id: string | null
          quality_score: number | null
          issues_found: number | null
          status: string
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          auditor_id: string
          audit_date: string
          jobs_audited: number
          site_inspection_verification_id?: string | null
          quality_score?: number | null
          issues_found?: number | null
          status: string
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          auditor_id?: string
          audit_date?: string
          jobs_audited?: number
          site_inspection_verification_id?: string | null
          quality_score?: number | null
          issues_found?: number | null
          status?: string
          created_at?: string | null
        }
      }
      repository_inventory: {
        Row: {
          id: string
          domain: string
          repository_name: string
          file_path: string
          pattern_type: string
          target_pattern: string
          migration_status: string
          dependencies_count: number
          created_at: string
          migrated_at: string | null
        }
        Insert: {
          id?: string
          domain: string
          repository_name: string
          file_path: string
          pattern_type: string
          target_pattern?: string
          migration_status?: string
          dependencies_count?: number
          created_at?: string
          migrated_at?: string | null
        }
        Update: {
          id?: string
          domain?: string
          repository_name?: string
          file_path?: string
          pattern_type?: string
          target_pattern?: string
          migration_status?: string
          dependencies_count?: number
          created_at?: string
          migrated_at?: string | null
        }
      }
      role_permissions: {
        Row: {
          id: string
          role: user_role
          permission_id: string
          tenant_id: string | null
          granted_by: string | null
          granted_at: string
          expires_at: string | null
          is_active: boolean
          conditions: Json | null
        }
        Insert: {
          id?: string
          role: user_role
          permission_id: string
          tenant_id?: string | null
          granted_by?: string | null
          granted_at?: string
          expires_at?: string | null
          is_active?: boolean
          conditions?: Json | null
        }
        Update: {
          id?: string
          role?: user_role
          permission_id?: string
          tenant_id?: string | null
          granted_by?: string | null
          granted_at?: string
          expires_at?: string | null
          is_active?: boolean
          conditions?: Json | null
        }
      }
      routing_schedules: {
        Row: {
          id: string
          tenant_id: string
          user_id: string
          scheduled_date: string
          job_ids: string[]
          total_distance_meters: number | null
          total_duration_minutes: number | null
          route_geometry: string | null
          optimization_status: string
          mapbox_route_geometry: string | null
          created_at: string | null
          updated_at: string | null
          error_message: string | null
          start_location_lat: number | null
          start_location_lng: number | null
          total_duration_seconds: number | null
          waypoints: Json | null
        }
        Insert: {
          id?: string
          tenant_id: string
          user_id: string
          scheduled_date: string
          job_ids: string[]
          total_distance_meters?: number | null
          total_duration_minutes?: number | null
          route_geometry?: string | null
          optimization_status?: string
          mapbox_route_geometry?: string | null
          created_at?: string | null
          updated_at?: string | null
          error_message?: string | null
          start_location_lat?: number | null
          start_location_lng?: number | null
          total_duration_seconds?: number | null
          waypoints?: Json | null
        }
        Update: {
          id?: string
          tenant_id?: string
          user_id?: string
          scheduled_date?: string
          job_ids?: string[]
          total_distance_meters?: number | null
          total_duration_minutes?: number | null
          route_geometry?: string | null
          optimization_status?: string
          mapbox_route_geometry?: string | null
          created_at?: string | null
          updated_at?: string | null
          error_message?: string | null
          start_location_lat?: number | null
          start_location_lng?: number | null
          total_duration_seconds?: number | null
          waypoints?: Json | null
        }
      }
      safety_checklist_completions: {
        Row: {
          id: string
          checklist_id: string
          job_id: string | null
          user_id: string
          completed_at: string | null
          items_completed: Json | null
          location: Json | null
          signature: string | null
          notes: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          checklist_id: string
          job_id?: string | null
          user_id: string
          completed_at?: string | null
          items_completed?: Json | null
          location?: Json | null
          signature?: string | null
          notes?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          checklist_id?: string
          job_id?: string | null
          user_id?: string
          completed_at?: string | null
          items_completed?: Json | null
          location?: Json | null
          signature?: string | null
          notes?: string | null
          created_at?: string | null
        }
      }
      safety_checklists: {
        Row: {
          id: string
          tenant_id: string
          job_id: string
          user_id: string
          checklist_items: Json
          completion_status: string
          completed_at: string | null
          created_at: string | null
          updated_at: string | null
          supervisor_approved: boolean | null
          supervisor_id: string | null
          supervisor_notes: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          job_id: string
          user_id: string
          checklist_items?: Json
          completion_status?: string
          completed_at?: string | null
          created_at?: string | null
          updated_at?: string | null
          supervisor_approved?: boolean | null
          supervisor_id?: string | null
          supervisor_notes?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          job_id?: string
          user_id?: string
          checklist_items?: Json
          completion_status?: string
          completed_at?: string | null
          created_at?: string | null
          updated_at?: string | null
          supervisor_approved?: boolean | null
          supervisor_id?: string | null
          supervisor_notes?: string | null
        }
      }
      spatial_ref_sys: {
        Row: {
          srid: number
          auth_name: string | null
          auth_srid: number | null
          srtext: string | null
          proj4text: string | null
        }
        Insert: {
          srid: number
          auth_name?: string | null
          auth_srid?: number | null
          srtext?: string | null
          proj4text?: string | null
        }
        Update: {
          srid?: number
          auth_name?: string | null
          auth_srid?: number | null
          srtext?: string | null
          proj4text?: string | null
        }
      }
      tenant_assignments: {
        Row: {
          id: string
          user_id: string
          tenant_id: string
          role: user_role
          is_primary: boolean
          assigned_by: string | null
          assigned_at: string
          expires_at: string | null
          is_active: boolean
          access_level: number | null
          permissions_override: Json | null
          last_accessed_at: string | null
          access_count: number | null
        }
        Insert: {
          id?: string
          user_id: string
          tenant_id: string
          role: user_role
          is_primary?: boolean
          assigned_by?: string | null
          assigned_at?: string
          expires_at?: string | null
          is_active?: boolean
          access_level?: number | null
          permissions_override?: Json | null
          last_accessed_at?: string | null
          access_count?: number | null
        }
        Update: {
          id?: string
          user_id?: string
          tenant_id?: string
          role?: user_role
          is_primary?: boolean
          assigned_by?: string | null
          assigned_at?: string
          expires_at?: string | null
          is_active?: boolean
          access_level?: number | null
          permissions_override?: Json | null
          last_accessed_at?: string | null
          access_count?: number | null
        }
      }
      tenant_invitations: {
        Row: {
          id: string
          tenant_id: string
          email: string
          user_id: string | null
          role: string
          status: string
          token: string
          expires_at: string
          created_at: string | null
          created_by: string
          accepted_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          email: string
          user_id?: string | null
          role?: string
          status?: string
          token?: string
          expires_at?: string
          created_at?: string | null
          created_by: string
          accepted_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          email?: string
          user_id?: string | null
          role?: string
          status?: string
          token?: string
          expires_at?: string
          created_at?: string | null
          created_by?: string
          accepted_at?: string | null
        }
      }
      tenant_members: {
        Row: {
          id: string
          tenant_id: string
          user_id: string
          role: string
          status: string
          joined_at: string | null
          invited_at: string | null
          invited_by: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          user_id: string
          role?: string
          status?: string
          joined_at?: string | null
          invited_at?: string | null
          invited_by?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          user_id?: string
          role?: string
          status?: string
          joined_at?: string | null
          invited_at?: string | null
          invited_by?: string | null
          updated_at?: string | null
        }
      }
      tenants: {
        Row: {
          id: string
          name: string
          slug: string
          status: string
          plan: string
          settings: Json | null
          created_at: string | null
          updated_at: string | null
          created_by: string | null
        }
        Insert: {
          id?: string
          name: string
          slug: string
          status?: string
          plan?: string
          settings?: Json | null
          created_at?: string | null
          updated_at?: string | null
          created_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          status?: string
          plan?: string
          settings?: Json | null
          created_at?: string | null
          updated_at?: string | null
          created_by?: string | null
        }
      }
      training_certificates: {
        Row: {
          id: string
          tenant_id: string
          training_session_id: string
          trainee_id: string
          certificate_type: string
          issued_date: string
          score: number | null
          status: string
          expires_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          training_session_id: string
          trainee_id: string
          certificate_type: string
          issued_date: string
          score?: number | null
          status: string
          expires_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          training_session_id?: string
          trainee_id?: string
          certificate_type?: string
          issued_date?: string
          score?: number | null
          status?: string
          expires_at?: string | null
          created_at?: string | null
        }
      }
      training_sessions: {
        Row: {
          id: string
          tenant_id: string
          trainer_id: string
          training_type: string
          session_date: string
          demo_verification_id: string | null
          equipment_demo_score: number | null
          status: string
          completion_date: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          trainer_id: string
          training_type: string
          session_date: string
          demo_verification_id?: string | null
          equipment_demo_score?: number | null
          status: string
          completion_date?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          trainer_id?: string
          training_type?: string
          session_date?: string
          demo_verification_id?: string | null
          equipment_demo_score?: number | null
          status?: string
          completion_date?: string | null
          created_at?: string | null
        }
      }
      travel_logs: {
        Row: {
          id: string
          tenant_id: string
          user_id: string
          from_property_id: string | null
          to_property_id: string | null
          departure_time: string
          arrival_time: string | null
          distance_km: number | null
          equipment_cleaned: boolean | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          user_id: string
          from_property_id?: string | null
          to_property_id?: string | null
          departure_time: string
          arrival_time?: string | null
          distance_km?: number | null
          equipment_cleaned?: boolean | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          user_id?: string
          from_property_id?: string | null
          to_property_id?: string | null
          departure_time?: string
          arrival_time?: string | null
          distance_km?: number | null
          equipment_cleaned?: boolean | null
          notes?: string | null
          created_at?: string
        }
      }
      user_activity_logs: {
        Row: {
          id: string
          user_id: string
          tenant_id: string
          activity_date: string
          jobs_completed: number | null
          equipment_return_verification_id: string | null
          summary: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          tenant_id: string
          activity_date: string
          jobs_completed?: number | null
          equipment_return_verification_id?: string | null
          summary?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          tenant_id?: string
          activity_date?: string
          jobs_completed?: number | null
          equipment_return_verification_id?: string | null
          summary?: string | null
          created_at?: string | null
        }
      }
      user_assignments: {
        Row: {
          id: string
          user_id: string
          tenant_id: string
          role: string
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          tenant_id: string
          role: string
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          tenant_id?: string
          role?: string
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      user_invitations: {
        Row: {
          id: string
          email: string
          tenant_id: string
          role: user_role
          invitation_code: string
          invited_by: string
          invited_at: string
          expires_at: string
          accepted_at: string | null
          accepted_by: string | null
          is_used: boolean
          welcome_message: string | null
          permissions_preset: Json | null
          voice_onboarding_enabled: boolean | null
          metadata: Json | null
        }
        Insert: {
          id?: string
          email: string
          tenant_id: string
          role?: user_role
          invitation_code: string
          invited_by: string
          invited_at?: string
          expires_at?: string
          accepted_at?: string | null
          accepted_by?: string | null
          is_used?: boolean
          welcome_message?: string | null
          permissions_preset?: Json | null
          voice_onboarding_enabled?: boolean | null
          metadata?: Json | null
        }
        Update: {
          id?: string
          email?: string
          tenant_id?: string
          role?: user_role
          invitation_code?: string
          invited_by?: string
          invited_at?: string
          expires_at?: string
          accepted_at?: string | null
          accepted_by?: string | null
          is_used?: boolean
          welcome_message?: string | null
          permissions_preset?: Json | null
          voice_onboarding_enabled?: boolean | null
          metadata?: Json | null
        }
      }
      user_sessions: {
        Row: {
          id: string
          user_id: string
          tenant_id: string
          session_token: string | null
          refresh_token_hash: string | null
          device_id: string
          device_name: string | null
          device_type: device_type
          device_fingerprint: string | null
          ip_address: unknown
          user_agent: string | null
          location: Json | null
          voice_session_id: string | null
          voice_session_active: boolean | null
          voice_session_expires_at: string | null
          wake_word_active: boolean | null
          conversation_context: Json | null
          status: session_status
          expires_at: string
          last_activity_at: string
          security_flags: Json | null
          refresh_count: number | null
          created_at: string
          ended_at: string | null
          voice_session_terminated: boolean | null
        }
        Insert: {
          id?: string
          user_id: string
          tenant_id: string
          session_token?: string | null
          refresh_token_hash?: string | null
          device_id: string
          device_name?: string | null
          device_type?: device_type
          device_fingerprint?: string | null
          ip_address: unknown
          user_agent?: string | null
          location?: Json | null
          voice_session_id?: string | null
          voice_session_active?: boolean | null
          voice_session_expires_at?: string | null
          wake_word_active?: boolean | null
          conversation_context?: Json | null
          status?: session_status
          expires_at: string
          last_activity_at?: string
          security_flags?: Json | null
          refresh_count?: number | null
          created_at?: string
          ended_at?: string | null
          voice_session_terminated?: boolean | null
        }
        Update: {
          id?: string
          user_id?: string
          tenant_id?: string
          session_token?: string | null
          refresh_token_hash?: string | null
          device_id?: string
          device_name?: string | null
          device_type?: device_type
          device_fingerprint?: string | null
          ip_address?: unknown
          user_agent?: string | null
          location?: Json | null
          voice_session_id?: string | null
          voice_session_active?: boolean | null
          voice_session_expires_at?: string | null
          wake_word_active?: boolean | null
          conversation_context?: Json | null
          status?: session_status
          expires_at?: string
          last_activity_at?: string
          security_flags?: Json | null
          refresh_count?: number | null
          created_at?: string
          ended_at?: string | null
          voice_session_terminated?: boolean | null
        }
      }
      users_extended: {
        Row: {
          id: string
          tenant_id: string
          role: user_role
          display_name: string | null
          first_name: string | null
          last_name: string | null
          phone: string | null
          avatar_url: string | null
          timezone: string | null
          preferred_language: string | null
          is_active: boolean
          email_verified_at: string | null
          phone_verified_at: string | null
          last_login_at: string | null
          password_changed_at: string | null
          terms_accepted_at: string | null
          privacy_policy_accepted_at: string | null
          marketing_consent: boolean | null
          two_factor_enabled: boolean | null
          failed_login_attempts: number | null
          locked_until: string | null
          metadata: Json | null
          created_at: string
          updated_at: string
          primary_image_url: string | null
          thumbnail_url: string | null
          medium_url: string | null
        }
        Insert: {
          id: string
          tenant_id: string
          role?: user_role
          display_name?: string | null
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          timezone?: string | null
          preferred_language?: string | null
          is_active?: boolean
          email_verified_at?: string | null
          phone_verified_at?: string | null
          last_login_at?: string | null
          password_changed_at?: string | null
          terms_accepted_at?: string | null
          privacy_policy_accepted_at?: string | null
          marketing_consent?: boolean | null
          two_factor_enabled?: boolean | null
          failed_login_attempts?: number | null
          locked_until?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
          primary_image_url?: string | null
          thumbnail_url?: string | null
          medium_url?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          role?: user_role
          display_name?: string | null
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          avatar_url?: string | null
          timezone?: string | null
          preferred_language?: string | null
          is_active?: boolean
          email_verified_at?: string | null
          phone_verified_at?: string | null
          last_login_at?: string | null
          password_changed_at?: string | null
          terms_accepted_at?: string | null
          privacy_policy_accepted_at?: string | null
          marketing_consent?: boolean | null
          two_factor_enabled?: boolean | null
          failed_login_attempts?: number | null
          locked_until?: string | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
          primary_image_url?: string | null
          thumbnail_url?: string | null
          medium_url?: string | null
        }
      }
      vendor_aliases: {
        Row: {
          id: string
          vendor_id: string
          alias: string
          tenant_id: string | null
        }
        Insert: {
          id?: string
          vendor_id: string
          alias: string
          tenant_id?: string | null
        }
        Update: {
          id?: string
          vendor_id?: string
          alias?: string
          tenant_id?: string | null
        }
      }
      vendor_locations: {
        Row: {
          id: string
          vendor_id: string
          address: string | null
          city: string | null
          state: string | null
          postal_code: string | null
          country: string | null
          tenant_id: string | null
        }
        Insert: {
          id?: string
          vendor_id: string
          address?: string | null
          city?: string | null
          state?: string | null
          postal_code?: string | null
          country?: string | null
          tenant_id?: string | null
        }
        Update: {
          id?: string
          vendor_id?: string
          address?: string | null
          city?: string | null
          state?: string | null
          postal_code?: string | null
          country?: string | null
          tenant_id?: string | null
        }
      }
      vendors: {
        Row: {
          id: string
          name: string
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
          intake_session_id: string | null
          tenant_id: string | null
        }
        Insert: {
          id?: string
          name: string
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          intake_session_id?: string | null
          tenant_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          intake_session_id?: string | null
          tenant_id?: string | null
        }
      }
      voice_profiles: {
        Row: {
          id: string
          user_id: string
          wake_word: string | null
          speech_rate: number | null
          voice_pitch: number | null
          preferred_voice: string | null
          language_code: string
          voice_feedback_enabled: boolean
          voice_feedback_level: string | null
          preferred_tts_provider: string | null
          voice_pattern_hash: string | null
          confidence_threshold: number | null
          voice_samples_collected: number | null
          last_voice_training_at: string | null
          voice_recognition_provider: string | null
          noise_cancellation_enabled: boolean | null
          voice_commands_enabled: boolean | null
          accessibility_voice_navigation: boolean | null
          onboarding_completed: boolean | null
          voice_analytics: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          wake_word?: string | null
          speech_rate?: number | null
          voice_pitch?: number | null
          preferred_voice?: string | null
          language_code?: string
          voice_feedback_enabled?: boolean
          voice_feedback_level?: string | null
          preferred_tts_provider?: string | null
          voice_pattern_hash?: string | null
          confidence_threshold?: number | null
          voice_samples_collected?: number | null
          last_voice_training_at?: string | null
          voice_recognition_provider?: string | null
          noise_cancellation_enabled?: boolean | null
          voice_commands_enabled?: boolean | null
          accessibility_voice_navigation?: boolean | null
          onboarding_completed?: boolean | null
          voice_analytics?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          wake_word?: string | null
          speech_rate?: number | null
          voice_pitch?: number | null
          preferred_voice?: string | null
          language_code?: string
          voice_feedback_enabled?: boolean
          voice_feedback_level?: string | null
          preferred_tts_provider?: string | null
          voice_pattern_hash?: string | null
          confidence_threshold?: number | null
          voice_samples_collected?: number | null
          last_voice_training_at?: string | null
          voice_recognition_provider?: string | null
          noise_cancellation_enabled?: boolean | null
          voice_commands_enabled?: boolean | null
          accessibility_voice_navigation?: boolean | null
          onboarding_completed?: boolean | null
          voice_analytics?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      workflow_tasks: {
        Row: {
          id: string
          tenant_id: string
          job_id: string
          task_description: string
          task_order: number
          status: string
          completed_by: string | null
          completed_at: string | null
          verification_photo_url: string | null
          ai_confidence: number | null
          requires_supervisor_review: boolean | null
          supervisor_approved: boolean | null
          supervisor_notes: string | null
          created_at: string | null
          updated_at: string | null
          verification_method: string | null
          verification_data: Json | null
          requires_supervisor_approval: boolean | null
          user_id: string | null
          task_type: string | null
          supervisor_id: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          job_id: string
          task_description: string
          task_order?: number
          status?: string
          completed_by?: string | null
          completed_at?: string | null
          verification_photo_url?: string | null
          ai_confidence?: number | null
          requires_supervisor_review?: boolean | null
          supervisor_approved?: boolean | null
          supervisor_notes?: string | null
          created_at?: string | null
          updated_at?: string | null
          verification_method?: string | null
          verification_data?: Json | null
          requires_supervisor_approval?: boolean | null
          user_id?: string | null
          task_type?: string | null
          supervisor_id?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          job_id?: string
          task_description?: string
          task_order?: number
          status?: string
          completed_by?: string | null
          completed_at?: string | null
          verification_photo_url?: string | null
          ai_confidence?: number | null
          requires_supervisor_review?: boolean | null
          supervisor_approved?: boolean | null
          supervisor_notes?: string | null
          created_at?: string | null
          updated_at?: string | null
          verification_method?: string | null
          verification_data?: Json | null
          requires_supervisor_approval?: boolean | null
          user_id?: string | null
          task_type?: string | null
          supervisor_id?: string | null
        }
      }
      vision_verifications: {
        Row: Record<string, any>
        Insert: Record<string, any>
        Update: Record<string, any>
      }
      vision_cost_records: {
        Row: Record<string, any>
        Insert: Record<string, any>
        Update: Record<string, any>
      }
      vision_detected_items: {
        Row: Record<string, any>
        Insert: Record<string, any>
        Update: Record<string, any>
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
  }
}
