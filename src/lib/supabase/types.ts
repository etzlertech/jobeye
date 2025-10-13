/*
AGENT DIRECTIVE BLOCK
file: /src/lib/supabase/types.ts
phase: 1
domain: core-infrastructure
purpose: Supabase schema typings based on live database analysis (stubs until regeneration)
spec_ref: docs/database-schema-analysis-2025-10-12-2051.md
complexity_budget: 120
offline_capability: N/A
dependencies: []
exports:
  - Database
  - Json helper
  - Table access helpers (Tables/Inserts/Updates/Enums)
  - Lightweight enum aliases used across the app
voice_considerations: N/A
test_requirements: N/A (types only)
tasks:
  - Provide concrete typings for frequently accessed tables (customers, contacts, company_settings)
  - Supply generic fallbacks so other tables remain accessible
  - Clearly mark that real types should be regenerated via `supabase gen types` when CLI access is available
*/

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type GenericTable = {
  Row: Record<string, any>;
  Insert: Record<string, any>;
  Update: Record<string, any>;
  Relationships: never[];
};

type AddressJson = {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  [key: string]: Json | undefined;
};

type CustomersTable = {
  Row: {
    id: string;
    tenant_id: string;
    customer_number: string;
    name: string;
    email: string | null;
    phone: string | null;
    mobile_phone: string | null;
    billing_address: AddressJson | null;
    service_address: AddressJson | null;
    notes: string | null;
    tags: Json | null;
    voice_notes: string | null;
    is_active: boolean | null;
    metadata: Json | null;
    created_at: string;
    updated_at: string;
    created_by: string | null;
    version: number | null;
    intake_session_id: string | null;
  };
  Insert: Partial<CustomersTable['Row']> & { tenant_id: string; name: string };
  Update: Partial<CustomersTable['Row']>;
  Relationships: never[];
};

type ContactsTable = {
  Row: {
    id: string;
    tenant_id: string;
    customer_id: string;
    role: string | null;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    mobile_phone: string | null;
    is_primary: boolean | null;
    can_receive_sms: boolean | null;
    can_receive_email: boolean | null;
    preferred_contact_method: string | null;
    voice_recognition_id: string | null;
    notes: string | null;
    metadata: Json | null;
    created_at: string;
    updated_at: string;
  };
  Insert: Partial<ContactsTable['Row']> & {
    tenant_id: string;
    customer_id: string;
    first_name: string;
    last_name: string;
  };
  Update: Partial<ContactsTable['Row']>;
  Relationships: never[];
};

type CompanySettingsTable = {
  Row: {
    id: string;
    tenant_id: string;
    vision_thresholds: Json | null;
    voice_preferences: Json | null;
    budget_limits: Json | null;
    features: Json | null;
    created_at: string;
    updated_at: string;
  };
  Insert: Partial<CompanySettingsTable['Row']> & { tenant_id: string };
  Update: Partial<CompanySettingsTable['Row']>;
  Relationships: never[];
};

type OtherTables = {
  tenants: GenericTable;
  tenant_members: GenericTable;
  tenant_invitations: GenericTable;
  users_extended: GenericTable;
  user_sessions: GenericTable;
  auth_audit_log: GenericTable;
  admin_audit_log: GenericTable;
  properties: GenericTable;
  jobs: GenericTable;
  items: GenericTable;
  item_transactions: GenericTable;
  voice_profiles: GenericTable;
  container_assignments: GenericTable;
  containers: GenericTable;
  equipment: GenericTable;
  training_data: GenericTable;
  media_assets: GenericTable;
  conversation_sessions: GenericTable;
  intent_logs: GenericTable;
  voice_intent_sessions: GenericTable;
  safety_checklists: GenericTable;
  safety_checklist_completions: GenericTable;
  workflow_tasks: GenericTable;
  workflow_task_events: GenericTable;
  tenant_assignments: GenericTable;
};

type SpecificTables = {
  customers: CustomersTable;
  contacts: ContactsTable;
  company_settings: CompanySettingsTable;
};

type TablesSchema = SpecificTables & OtherTables;

type Views = Record<string, GenericTable>;
type Functions = Record<string, (...args: any[]) => any>;
type Enums = Record<string, string | number>;
type CompositeTypes = Record<string, Record<string, any>>;

export type Database = {
  public: {
    Tables: TablesSchema;
    Views: Views;
    Functions: Functions;
    Enums: Enums;
    CompositeTypes: CompositeTypes;
  };
};

export type TablesType<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type Inserts<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type Updates<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
export type EnumsType<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];

// Backwards compatibility helper
export type TableRow<T extends keyof Database['public']['Tables']> = TablesType<T>;

// Lightweight enum aliases used throughout the app
export type ContactRoleDb = 'primary' | 'billing' | 'service' | 'emergency' | string;
export type ContactPreferredMethod = 'phone' | 'email' | 'sms' | string;
export type MediaType = 'image' | 'video' | 'audio' | 'document' | string;
export type UserRole =
  | 'system_admin'
  | 'tenant_admin'
  | 'admin'
  | 'supervisor'
  | 'crew'
  | string;
export type DeviceType = 'mobile' | 'desktop' | 'tablet' | 'voice_assistant' | string;
export type SessionStatus = 'active' | 'expired' | 'terminated' | 'suspended' | string;
export type AuthEventType = string;

// TODO: Regenerate this file with `supabase gen types typescript` when CLI access is available.
// The stubs above reflect the live schema as of docs/database-schema-analysis-2025-10-12-2051.md.
