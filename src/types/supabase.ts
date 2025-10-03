// Generated types for Supabase database schema
// This is a minimal version needed for 003-scheduling-kits feature

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          domain: string | null
          is_active: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          domain?: string | null
          is_active?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          domain?: string | null
          is_active?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      day_plans: {
        Row: {
          id: string
          tenant_id: string
          user_id: string
          plan_date: string
          status: 'draft' | 'published' | 'in_progress' | 'completed' | 'cancelled'
          route_data: Json | null
          total_distance_miles: number | null
          estimated_duration_minutes: number | null
          actual_start_time: string | null
          actual_end_time: string | null
          voice_session_id: string | null
          auto_schedule_breaks: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          user_id: string
          plan_date: string
          status?: 'draft' | 'published' | 'in_progress' | 'completed' | 'cancelled'
          route_data?: Json | null
          total_distance_miles?: number | null
          estimated_duration_minutes?: number | null
          actual_start_time?: string | null
          actual_end_time?: string | null
          voice_session_id?: string | null
          auto_schedule_breaks?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          user_id?: string
          plan_date?: string
          status?: 'draft' | 'published' | 'in_progress' | 'completed' | 'cancelled'
          route_data?: Json | null
          total_distance_miles?: number | null
          estimated_duration_minutes?: number | null
          actual_start_time?: string | null
          actual_end_time?: string | null
          voice_session_id?: string | null
          auto_schedule_breaks?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      schedule_events: {
        Row: {
          id: string
          tenant_id: string
          day_plan_id: string
          event_type: 'job' | 'break' | 'travel' | 'maintenance' | 'meeting'
          job_id: string | null
          sequence_order: number
          scheduled_start: string | null
          scheduled_duration_minutes: number | null
          actual_start: string | null
          actual_end: string | null
          status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'skipped'
          location_data: unknown | null
          address: Json | null
          notes: string | null
          voice_notes: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          day_plan_id: string
          event_type: 'job' | 'break' | 'travel' | 'maintenance' | 'meeting'
          job_id?: string | null
          sequence_order: number
          scheduled_start?: string | null
          scheduled_duration_minutes?: number | null
          actual_start?: string | null
          actual_end?: string | null
          status?: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'skipped'
          location_data?: unknown | null
          address?: Json | null
          notes?: string | null
          voice_notes?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          day_plan_id?: string
          event_type?: 'job' | 'break' | 'travel' | 'maintenance' | 'meeting'
          job_id?: string | null
          sequence_order?: number
          scheduled_start?: string | null
          scheduled_duration_minutes?: number | null
          actual_start?: string | null
          actual_end?: string | null
          status?: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'skipped'
          location_data?: unknown | null
          address?: Json | null
          notes?: string | null
          voice_notes?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      crew_assignments: {
        Row: {
          id: string
          tenant_id: string
          schedule_event_id: string
          user_id: string
          role: 'lead' | 'helper' | 'trainee'
          assigned_by: string
          assigned_at: string
          confirmed_at: string | null
          voice_confirmed: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          schedule_event_id: string
          user_id: string
          role: 'lead' | 'helper' | 'trainee'
          assigned_by: string
          assigned_at?: string
          confirmed_at?: string | null
          voice_confirmed?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          schedule_event_id?: string
          user_id?: string
          role?: 'lead' | 'helper' | 'trainee'
          assigned_by?: string
          assigned_at?: string
          confirmed_at?: string | null
          voice_confirmed?: boolean
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
      kit_items: {
        Row: {
          id: string
          tenant_id: string
          kit_id: string
          item_type: 'equipment' | 'material' | 'tool'
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
          item_type: 'equipment' | 'material' | 'tool'
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
          item_type?: 'equipment' | 'material' | 'tool'
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
      job_kits: {
        Row: {
          id: string
          tenant_id: string
          job_id: string
          kit_id: string
          variant_id: string | null
          assigned_by: string
          assigned_at: string
          verified_at: string | null
          verified_by: string | null
          verification_status: 'pending' | 'verified' | 'partial' | 'failed' | null
          notes: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          job_id: string
          kit_id: string
          variant_id?: string | null
          assigned_by: string
          assigned_at?: string
          verified_at?: string | null
          verified_by?: string | null
          verification_status?: 'pending' | 'verified' | 'partial' | 'failed' | null
          notes?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          job_id?: string
          kit_id?: string
          variant_id?: string | null
          assigned_by?: string
          assigned_at?: string
          verified_at?: string | null
          verified_by?: string | null
          verification_status?: 'pending' | 'verified' | 'partial' | 'failed' | null
          notes?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      kit_override_logs: {
        Row: {
          id: string
          tenant_id: string
          job_id: string
          kit_id: string | null
          item_id: string | null
          technician_id: string
          override_reason: string
          supervisor_id: string | null
          supervisor_notified_at: string | null
          notification_method: string | null
          notification_status: string | null
          notification_attempts: Json | null
          sla_seconds: number | null
          sla_met: boolean | null
          notification_latency_ms: number | null
          voice_initiated: boolean
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          job_id: string
          kit_id?: string | null
          item_id?: string | null
          technician_id: string
          override_reason: string
          supervisor_id?: string | null
          supervisor_notified_at?: string | null
          notification_method?: string | null
          notification_status?: string | null
          notification_attempts?: Json | null
          sla_seconds?: number | null
          sla_met?: boolean | null
          notification_latency_ms?: number | null
          voice_initiated?: boolean
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          job_id?: string
          kit_id?: string | null
          item_id?: string | null
          technician_id?: string
          override_reason?: string
          supervisor_id?: string | null
          supervisor_notified_at?: string | null
          notification_method?: string | null
          notification_status?: string | null
          notification_attempts?: Json | null
          sla_seconds?: number | null
          sla_met?: boolean | null
          notification_latency_ms?: number | null
          voice_initiated?: boolean
          metadata?: Json
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
          priority: 'low' | 'medium' | 'high' | 'urgent'
          message: string
          data: Json | null
          method: 'sms' | 'push' | 'email' | 'call' | null
          status: 'pending' | 'sent' | 'delivered' | 'failed'
          attempts: number
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
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          message: string
          data?: Json | null
          method?: 'sms' | 'push' | 'email' | 'call' | null
          status?: 'pending' | 'sent' | 'delivered' | 'failed'
          attempts?: number
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
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          message?: string
          data?: Json | null
          method?: 'sms' | 'push' | 'email' | 'call' | null
          status?: 'pending' | 'sent' | 'delivered' | 'failed'
          attempts?: number
          last_attempt_at?: string | null
          delivered_at?: string | null
          error?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_job_limit: {
        Args: {
          p_day_plan_id: string
        }
        Returns: boolean
      }
      get_override_analytics: {
        Args: {
          p_tenant_id: string
          p_start_date: string
          p_end_date: string
        }
        Returns: Json
      }
      check_break_compliance: {
        Args: {
          p_day_plan_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}