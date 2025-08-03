// --- AGENT DIRECTIVE BLOCK ---
// file: /src/domains/auth/repositories/user-repository.ts
// purpose: User CRUD operations with Supabase RLS, voice profile management, and multi-tenant user queries with fuzzy search
// spec_ref: auth#user-repository
// version: 2025-08-1
// domain: authentication
// phase: 1
// complexity_budget: medium
// offline_capability: OPTIONAL
//
// dependencies:
//   - @supabase/supabase-js: ^2.43.0
//   - src/core/database/connection.ts
//   - src/core/logger/logger.ts
//   - src/core/errors/error-types.ts
//   - src/domains/auth/types/auth-types.ts
//
// exports:
//   - UserRepository: class - User data access layer with RLS enforcement and caching
//   - create(userData: CreateUserData): Promise<User> - Create new user with profile setup
//   - findById(userId: string): Promise<User | null> - Get user by ID with tenant isolation
//   - findByEmail(email: string, tenantId: string): Promise<User | null> - Get user by email in tenant
//   - update(userId: string, updates: UpdateUserData): Promise<User> - Update user with validation
//   - delete(userId: string): Promise<void> - Soft delete user with data retention
//   - findByVoicePattern(pattern: VoicePattern, tenantId: string): Promise<User[]> - Voice-based user search
//   - searchUsers(query: string, tenantId: string): Promise<User[]> - Fuzzy search for voice queries
//   - batchFindByIds(userIds: string[]): Promise<User[]> - Efficient batch user retrieval
//   - updateVoiceProfile(userId: string, profile: VoiceProfile): Promise<void> - Voice preferences update
//   - getUsersByRole(role: UserRole, tenantId: string): Promise<User[]> - Role-based user listing
//
// voice_considerations: |
//   Voice user search should support phonetic matching for names and nicknames.
//   Voice profiles should store preferred wake words and speech recognition settings.
//   User lookup should work with partial voice commands like "find John from maintenance".
//   Voice confirmation should be required before deleting or deactivating user accounts.
//   Voice-friendly user names should be stored for clear TTS pronunciation.
//
// security_considerations: |
//   All user operations must enforce Row Level Security policies for multi-tenant isolation.
//   User passwords and sensitive data must never be returned in query results.
//   Voice patterns and biometric data must be hashed and never stored in plaintext.
//   User search results must be filtered by caller's tenant and permission level.
//   Audit logging must track all user data modifications for compliance and security.
//   Soft delete must be used to maintain referential integrity and audit trails.
//
// performance_considerations: |
//   Implement user data caching with TTL expiry for frequently accessed profiles.
//   Use database indexes on email, tenant_id, and role fields for fast queries.
//   Batch user operations to reduce database round trips for bulk operations.
//   Implement pagination for user listing queries to handle large tenant user bases.
//   Cache voice profile data separately from user data for voice operation performance.
//
// tasks:
//   1. Create UserRepository class with Supabase client integration and RLS policy enforcement
//   2. Implement create user with profile initialization and tenant assignment validation
//   3. Add findById and findByEmail with proper tenant isolation and caching layer
//   4. Create update user functionality with field validation and change tracking
//   5. Implement soft delete with referential integrity preservation and audit logging
//   6. Add voice-based user search with phonetic matching and pattern recognition
//   7. Create fuzzy search functionality for voice queries with relevance scoring
//   8. Implement batch user operations for efficient bulk data retrieval and updates
//   9. Add voice profile management with preferences and wake word configuration
//   10. Create user analytics and reporting for tenant administration and compliance
// --- END DIRECTIVE BLOCK ---

// Implementation will be injected here by Architecture-as-Code system
throw new Error("Implementation required - this is a scaffolded file");