// --- AGENT DIRECTIVE BLOCK ---
// file: /src/types/database.ts
// phase: 1
// domain: core-infrastructure
// purpose: Re-export canonical Supabase database types for application usage
// spec_ref: constitution/types-registry
// version: 2025-08-1
// complexity_budget: 50 LoC
// offline_capability: N/A
//
// dependencies:
//   internal:
//     - /src/lib/supabase/types
//   external:
//     - none
//
// exports:
//   - Database: type alias for global Supabase schema
//
// voice_considerations: N/A - type alias
//
// test_requirements:
//   coverage: N/A - types only
// --- END DIRECTIVE BLOCK ---

import type {
  Database as SupabaseDatabase,
  ContactRoleDb,
  ContactPreferredMethod,
  MediaType,
  UserRole,
  DeviceType,
  SessionStatus,
  AuthEventType,
  TableRow
} from '@/lib/supabase/types';

export type Database = SupabaseDatabase;
export type { ContactRoleDb, ContactPreferredMethod, MediaType, UserRole, DeviceType, SessionStatus, AuthEventType } from '@/lib/supabase/types';

export type Tables<T extends keyof Database['public']['Tables']> = TableRow<T>;

export type Job = Record<string, any>;
export type EquipmentItem = Record<string, any>;
