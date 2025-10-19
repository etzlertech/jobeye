import type {
  Database as GeneratedDatabase,
  Json as GeneratedJson,
} from '@/types/database';

export type Database = GeneratedDatabase;
export type Json = GeneratedJson;

export type TablesType<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type Inserts<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type Updates<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
export type EnumsType<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T];

export type TableRow<T extends keyof Database['public']['Tables']> = TablesType<T>;

// Lightweight enum aliases retained for backwards compatibility. When the generated schema lacks
// a given enum, fall back to string so downstream code stays permissive.
type StringEnumOrFallback<K extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][K] extends string ? Database['public']['Enums'][K] : string;

export type ContactRoleDb = StringEnumOrFallback<'contact_role'>;
export type ContactPreferredMethod = StringEnumOrFallback<'contact_preferred_method'>;
export type MediaType = StringEnumOrFallback<'media_type'>;
export type UserRole = StringEnumOrFallback<'user_role'>;
export type DeviceType = StringEnumOrFallback<'device_type'>;
export type SessionStatus = StringEnumOrFallback<'session_status'>;
export type AuthEventType = string;
