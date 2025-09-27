# Voice-First FSM Application Architecture Manifest
Generated: 2025-09-27T14:15:52.721Z
Purpose: Track implementation progress of the Voice-First Field Service Management application architecture

## Project Context
- **Branch**: main
- **Last Commit**: afd0ac1 - feat: implement v4 core infrastructure with comprehensive test suite (12 hours ago)
- **Total Files**: 59
- **Files with Directives**: 29

## Scaffold Status Summary
- **Scaffolded** (Empty): 0 files
- **Partial** (In Progress): 1 files  
- **Complete** (Implemented): 58 files

## Architecture by Phase

### Phase: 1
**Progress**: 25/26 files (96%)

#### Domain: core-infrastructure
**Completion**: 89%

| File | Status | Purpose | Complexity |
|------|--------|---------|------------|
| `src/core/monitoring/health-check.ts` | ✅ | Application health monitoring with voice system status and dependency checks | medium |
| `src/core/logger/voice-logger.ts` | ✅ | Specialized voice interaction logging with audio quality metrics and speech analytics | medium |
| `src/core/logger/logger.ts` | ✅ | Structured logging service with multiple outputs and voice event integration | medium |
| `src/core/events/event-bus.ts` | ✅ | Application-wide event system with voice event routing and pub-sub messaging | high |
| `src/core/errors/error-types.ts` | ✅ | Centralized error type definitions with voice-specific error categories | low |
| `src/core/errors/error-handler.ts` | 🚧 | Global error handling service with voice notifications and recovery strategies | high |
| `src/core/database/transaction-manager.ts` | ✅ | Database transaction management with automatic rollback and nested transaction support | high |
| `src/core/database/connection.ts` | ✅ | Centralized Supabase client management with connection pooling and offline detection | medium |
| `src/core/config/environment.ts` | ✅ | Environment variable validation and configuration management with voice settings | low |

#### Domain: authentication
**Completion**: 100%

| File | Status | Purpose | Complexity |
|------|--------|---------|------------|
| `src/domains/auth/types/auth-types.ts` | ✅ | Defines all TypeScript interfaces and enums for the authentication domain, ensuring type safety across services and components. | low |
| `src/domains/auth/utils/auth-validators.ts` | ✅ | Input validation schemas and helpers using Zod for authentication operations with voice command support and security validation | medium |
| `src/domains/auth/utils/auth-helpers.ts` | ✅ | Authentication utility functions for user display, session management, permissions, and voice interactions | low |
| `src/domains/auth/services/permission-service.ts` | ✅ | Role-Based Access Control (RBAC) with voice command permissions, multi-tenant isolation, and dynamic permission loading | high |
| `src/domains/auth/services/mfa-service.ts` | ✅ | Multi-factor authentication with TOTP, SMS/Email codes, voice biometric support, and backup code management | high |
| `src/domains/auth/services/auth-service.ts` | ✅ | Core authentication service with voice-first login, session management, and multi-tenant user handling | high |
| `src/domains/auth/repositories/user-repository.ts` | ✅ | User CRUD operations with Supabase RLS, voice profile management, and multi-tenant user queries with fuzzy search | medium |
| `src/domains/auth/repositories/session-repository.ts` | ✅ | Session storage and retrieval with active session management, analytics, voice tracking, and automated cleanup | medium |
| `src/domains/auth/guards/auth-guard.tsx` | ✅ | Next.js middleware and HOCs for route protection with RBAC, multi-tenant isolation, and voice session validation | medium |
| `src/app/api/auth/register/route.ts` | ✅ | Next.js API route for user registration with Supabase Auth, voice profile setup, tenant assignment, and welcome communications | medium |
| `src/app/api/auth/refresh/route.ts` | ✅ | Next.js API route for token refresh with Supabase Auth, voice session extension, session updates, and audit logging | low |
| `src/app/api/auth/logout/route.ts` | ✅ | Next.js API route for user logout with Supabase Auth signOut, session cleanup, voice session termination, and audit logging | low |
| `src/app/api/auth/login/route.ts` | ✅ | Next.js API route for user authentication with Supabase Auth, voice login support, MFA handling, and audit logging | medium |

#### Domain: tenant
**Completion**: 100%

| File | Status | Purpose | Complexity |
|------|--------|---------|------------|
| `src/domains/tenant/types/tenant-types.ts` | ✅ | TypeScript interfaces and types for multi-tenant architecture with voice-first configuration and subscription management | low |
| `src/domains/tenant/services/tenant-service.ts` | ✅ | Core tenant management service for multi-tenant architecture with organization setup, user management, and voice-first configuration | high |
| `src/domains/tenant/services/subscription-service.ts` | ✅ | Subscription management service for tenant billing plans, usage tracking, and plan upgrades/downgrades with voice analytics | high |
| `src/domains/tenant/repositories/tenant-repository.ts` | ✅ | Data access layer for tenant operations with Supabase RLS, pagination, and multi-tenant isolation | medium |


---

### Phase: 3
**Progress**: 3/3 files (100%)

#### Domain: voice-pipeline
**Completion**: 100%

| File | Status | Purpose | Complexity |
|------|--------|---------|------------|
| `src/domains/voice/types/voice-types.ts` | ✅ | Type definitions for voice processing pipeline | 100 LoC |
| `src/domains/voice/services/voice-intake-service.ts` | ✅ | Handle voice recording intake and initiate ASR processing | 200 LoC |
| `src/app/api/voice/intake/route.ts` | ✅ | API endpoint for voice recording intake and signed URL generation | 150 LoC |


---

### Phase: UNSPECIFIED
**Progress**: 30/30 files (100%)

#### Domain: general
**Completion**: 100%

| File | Status | Purpose | Complexity |
|------|--------|---------|------------|
| `src/types/supabase.ts` | ✅ | — | — |
| `src/app/page.tsx` | ✅ | — | — |
| `src/app/layout.tsx` | ✅ | — | — |
| `src/__tests__/setup.ts` | ✅ | — | — |
| `src/lib/supabase/types.ts` | ✅ | — | — |
| `src/lib/supabase/client.ts` | ✅ | — | — |
| `src/lib/repositories/customer.repository.ts` | ✅ | — | — |
| `src/lib/repositories/base.repository.ts` | ✅ | — | — |
| `src/components/auth/SignInForm.tsx` | ✅ | — | — |
| `src/__tests__/mocks/supabase.ts` | ✅ | — | — |
| `src/__tests__/mocks/styleMock.js` | ✅ | — | — |
| `src/__tests__/mocks/fileMock.js` | ✅ | — | — |
| `src/__tests__/integration-real/voice.integration.test.ts` | ✅ | — | — |
| `src/__tests__/integration-real/test-setup.ts` | ✅ | — | — |
| `src/__tests__/integration-real/multi-tenant.integration.test.ts` | ✅ | — | — |
| `src/__tests__/integration-real/customer-repository.integration.test.ts` | ✅ | — | — |
| `src/__tests__/integration-real/auth.integration.test.ts` | ✅ | — | — |
| `src/__tests__/integration/real-supabase-connection.test.ts` | ✅ | — | — |
| `src/__tests__/integration/auth-flow.test.ts` | ✅ | — | — |
| `src/__tests__/__mocks__/isows.js` | ✅ | — | — |
| `src/app/api/health/route.ts` | ✅ | — | — |
| `src/app/auth/sign-in/page.tsx` | ✅ | — | — |
| `src/__tests__/lib/supabase/client.test.ts` | ✅ | — | — |
| `src/__tests__/lib/repositories/customer.repository.test.ts` | ✅ | — | — |
| `src/__tests__/lib/repositories/base.repository.test.ts` | ✅ | — | — |
| `src/__tests__/components/auth/SignInForm.test.tsx` | ✅ | — | — |
| `supabase/migrations/004_v4_storage_buckets_and_functions.sql` | ✅ | — | — |
| `supabase/migrations/003_v4_irrigation_and_specialized_tables.sql` | ✅ | — | — |
| `supabase/migrations/002_v4_voice_vision_media_tables.sql` | ✅ | — | — |
| `supabase/migrations/001_v4_core_business_tables.sql` | ✅ | — | — |



## Detailed File Inventory

### Complete File List with Metadata

```yaml
files:
  - path: "src/types/supabase.ts"
    status: "complete"
    type: "type"
    lines: 30
    has_directive: false
  - path: "src/app/page.tsx"
    status: "complete"
    type: "other"
    lines: 48
    has_directive: false
  - path: "src/app/layout.tsx"
    status: "complete"
    type: "other"
    lines: 21
    has_directive: false
  - path: "src/__tests__/setup.ts"
    status: "complete"
    type: "other"
    lines: 43
    has_directive: false
  - path: "src/lib/supabase/types.ts"
    status: "complete"
    type: "other"
    lines: 277
    has_directive: false
  - path: "src/lib/supabase/client.ts"
    status: "complete"
    type: "other"
    lines: 117
    has_directive: false
  - path: "src/lib/repositories/customer.repository.ts"
    status: "complete"
    type: "other"
    lines: 233
    has_directive: false
  - path: "src/lib/repositories/base.repository.ts"
    status: "complete"
    type: "other"
    lines: 400
    has_directive: false
  - path: "src/core/monitoring/health-check.ts"
    status: "complete"
    type: "other"
    lines: 161
    has_directive: true
    directive:
      purpose: "Application health monitoring with voice system status and dependency checks"
      domain: "core-infrastructure"
      phase: "1"
      complexity_budget: "medium"
  - path: "src/core/logger/voice-logger.ts"
    status: "complete"
    type: "other"
    lines: 111
    has_directive: true
    directive:
      purpose: "Specialized voice interaction logging with audio quality metrics and speech analytics"
      domain: "core-infrastructure"
      phase: "1"
      complexity_budget: "medium"
  - path: "src/core/logger/logger.ts"
    status: "complete"
    type: "other"
    lines: 218
    has_directive: true
    directive:
      purpose: "Structured logging service with multiple outputs and voice event integration"
      domain: "core-infrastructure"
      phase: "1"
      complexity_budget: "medium"
  - path: "src/core/events/event-bus.ts"
    status: "complete"
    type: "other"
    lines: 141
    has_directive: true
    directive:
      purpose: "Application-wide event system with voice event routing and pub-sub messaging"
      domain: "core-infrastructure"
      phase: "1"
      complexity_budget: "high"
  - path: "src/core/errors/error-types.ts"
    status: "complete"
    type: "other"
    lines: 184
    has_directive: true
    directive:
      purpose: "Centralized error type definitions with voice-specific error categories"
      domain: "core-infrastructure"
      phase: "1"
      complexity_budget: "low"
  - path: "src/core/errors/error-handler.ts"
    status: "partial"
    type: "other"
    lines: 99
    has_directive: true
    directive:
      purpose: "Global error handling service with voice notifications and recovery strategies"
      domain: "core-infrastructure"
      phase: "1"
      complexity_budget: "high"
  - path: "src/core/database/transaction-manager.ts"
    status: "complete"
    type: "other"
    lines: 100
    has_directive: true
    directive:
      purpose: "Database transaction management with automatic rollback and nested transaction support"
      domain: "core-infrastructure"
      phase: "1"
      complexity_budget: "high"
      exports: 29 items
      tasks: 10 items
  - path: "src/core/database/connection.ts"
    status: "complete"
    type: "other"
    lines: 130
    has_directive: true
    directive:
      purpose: "Centralized Supabase client management with connection pooling and offline detection"
      domain: "core-infrastructure"
      phase: "1"
      complexity_budget: "medium"
      exports: 29 items
      tasks: 10 items
  - path: "src/core/config/environment.ts"
    status: "complete"
    type: "other"
    lines: 177
    has_directive: true
    directive:
      purpose: "Environment variable validation and configuration management with voice settings"
      domain: "core-infrastructure"
      phase: "1"
      complexity_budget: "low"
  - path: "src/components/auth/SignInForm.tsx"
    status: "complete"
    type: "component"
    lines: 242
    has_directive: false
  - path: "src/__tests__/mocks/supabase.ts"
    status: "complete"
    type: "other"
    lines: 147
    has_directive: false
  - path: "src/__tests__/mocks/styleMock.js"
    status: "complete"
    type: "other"
    lines: 1
    has_directive: false
  - path: "src/__tests__/mocks/fileMock.js"
    status: "complete"
    type: "other"
    lines: 1
    has_directive: false
  - path: "src/__tests__/integration-real/voice.integration.test.ts"
    status: "complete"
    type: "test"
    lines: 601
    has_directive: false
  - path: "src/__tests__/integration-real/test-setup.ts"
    status: "complete"
    type: "other"
    lines: 260
    has_directive: false
  - path: "src/__tests__/integration-real/multi-tenant.integration.test.ts"
    status: "complete"
    type: "test"
    lines: 517
    has_directive: false
  - path: "src/__tests__/integration-real/customer-repository.integration.test.ts"
    status: "complete"
    type: "test"
    lines: 437
    has_directive: false
  - path: "src/__tests__/integration-real/auth.integration.test.ts"
    status: "complete"
    type: "test"
    lines: 470
    has_directive: false
  - path: "src/__tests__/integration/real-supabase-connection.test.ts"
    status: "complete"
    type: "test"
    lines: 129
    has_directive: false
  - path: "src/__tests__/integration/auth-flow.test.ts"
    status: "complete"
    type: "test"
    lines: 231
    has_directive: false
  - path: "src/__tests__/__mocks__/isows.js"
    status: "complete"
    type: "other"
    lines: 4
    has_directive: false
  - path: "src/app/api/health/route.ts"
    status: "complete"
    type: "api"
    lines: 10
    has_directive: false
  - path: "src/app/auth/sign-in/page.tsx"
    status: "complete"
    type: "other"
    lines: 86
    has_directive: false
  - path: "src/domains/auth/types/auth-types.ts"
    status: "complete"
    type: "type"
    lines: 172
    has_directive: true
    directive:
      purpose: "Defines all TypeScript interfaces and enums for the authentication domain, ensuring type safety across services and components."
      domain: "authentication"
      phase: "1"
      complexity_budget: "low"
      dependencies: ["@supabase/supabase-js"]
      exports: 23 items
      tasks: 10 items
      voice_considerations: "Includes specific types for voice preferences within the UserProfile to allow for personalized voice..."
      security_considerations: "Types must not expose sensitive data like password hashes. All sensitive data is handled by Supabase..."
      performance_considerations: "Types are lightweight and designed for efficient serialization and caching for offline use. tasks: 1..."
  - path: "src/domains/auth/utils/auth-validators.ts"
    status: "complete"
    type: "utility"
    lines: 333
    has_directive: true
    directive:
      purpose: "Input validation schemas and helpers using Zod for authentication operations with voice command support and security validation"
      domain: "authentication"
      phase: "1"
      complexity_budget: "medium"
      dependencies: ["src/domains/auth/types/auth-types.ts", "zod"]
      exports: 36 items
      tasks: 10 items
      voice_considerations: "Voice command validation should handle natural language variations for authentication operations. Va..."
      security_considerations: "Password validation must enforce strong security requirements including length, complexity, and comm..."
      performance_considerations: "Zod schemas should be pre-compiled and cached for repeated validation operations. Complex validation..."
  - path: "src/domains/auth/utils/auth-helpers.ts"
    status: "complete"
    type: "utility"
    lines: 391
    has_directive: true
    directive:
      purpose: "Authentication utility functions for user display, session management, permissions, and voice interactions"
      domain: "authentication"
      phase: "1"
      complexity_budget: "low"
      dependencies: ["src/domains/auth/types/auth-types.ts", "@supabase/supabase-js", "date-fns"]
      exports: 37 items
      tasks: 10 items
      voice_considerations: "Voice greetings should be natural and personalized based on user preferences and time of day. Voice ..."
      security_considerations: "Error sanitization must never leak sensitive system information or user data. Session validation mus..."
      performance_considerations: "Functions should be pure and stateless for better caching and testing. String operations should be o..."
  - path: "src/domains/auth/services/permission-service.ts"
    status: "complete"
    type: "service"
    lines: 69
    has_directive: true
    directive:
      purpose: "Role-Based Access Control (RBAC) with voice command permissions, multi-tenant isolation, and dynamic permission loading"
      domain: "authentication"
      phase: "1"
      complexity_budget: "high"
      exports: 41 items
      tasks: 10 items
  - path: "src/domains/auth/services/mfa-service.ts"
    status: "complete"
    type: "service"
    lines: 70
    has_directive: true
    directive:
      purpose: "Multi-factor authentication with TOTP, SMS/Email codes, voice biometric support, and backup code management"
      domain: "authentication"
      phase: "1"
      complexity_budget: "high"
      exports: 41 items
      tasks: 10 items
  - path: "src/domains/auth/services/auth-service.ts"
    status: "complete"
    type: "service"
    lines: 69
    has_directive: true
    directive:
      purpose: "Core authentication service with voice-first login, session management, and multi-tenant user handling"
      domain: "authentication"
      phase: "1"
      complexity_budget: "high"
      exports: 41 items
      tasks: 10 items
  - path: "src/domains/auth/repositories/user-repository.ts"
    status: "complete"
    type: "other"
    lines: 67
    has_directive: true
    directive:
      purpose: "User CRUD operations with Supabase RLS, voice profile management, and multi-tenant user queries with fuzzy search"
      domain: "authentication"
      phase: "1"
      complexity_budget: "medium"
      exports: 41 items
      tasks: 10 items
  - path: "src/domains/auth/repositories/session-repository.ts"
    status: "complete"
    type: "other"
    lines: 67
    has_directive: true
    directive:
      purpose: "Session storage and retrieval with active session management, analytics, voice tracking, and automated cleanup"
      domain: "authentication"
      phase: "1"
      complexity_budget: "medium"
      exports: 41 items
      tasks: 10 items
  - path: "src/domains/auth/guards/auth-guard.tsx"
    status: "complete"
    type: "other"
    lines: 462
    has_directive: true
    directive:
      purpose: "Next.js middleware and HOCs for route protection with RBAC, multi-tenant isolation, and voice session validation"
      domain: "authentication"
      phase: "1"
      complexity_budget: "medium"
      dependencies: ["src/domains/auth/types/auth-types.ts", "src/domains/auth/utils/auth-helpers.ts", "src/core/database/connection.ts", "next/server", "next", "@supabase/supabase-js"]
      exports: 36 items
      tasks: 10 items
      voice_considerations: "Voice routes should have extended session timeouts and different validation rules. Voice session val..."
      security_considerations: "All route protection must enforce Row Level Security policies for multi-tenant data isolation. Sessi..."
      performance_considerations: "Middleware should cache permission checks to avoid repeated database queries. Route protection shoul..."
  - path: "src/__tests__/lib/supabase/client.test.ts"
    status: "complete"
    type: "test"
    lines: 220
    has_directive: false
  - path: "src/__tests__/lib/repositories/customer.repository.test.ts"
    status: "complete"
    type: "test"
    lines: 320
    has_directive: false
  - path: "src/__tests__/lib/repositories/base.repository.test.ts"
    status: "complete"
    type: "test"
    lines: 470
    has_directive: false
  - path: "src/domains/voice/types/voice-types.ts"
    status: "complete"
    type: "type"
    lines: 112
    has_directive: true
    directive:
      purpose: "Type definitions for voice processing pipeline"
      domain: "voice-pipeline"
      phase: "3"
      complexity_budget: "100 LoC"
      exports: 13 items
      voice_considerations: "Define clear types for voice metadata including confidence scores, language detection, and provider-..."
  - path: "src/domains/voice/services/voice-intake-service.ts"
    status: "complete"
    type: "service"
    lines: 250
    has_directive: true
    directive:
      purpose: "Handle voice recording intake and initiate ASR processing"
      domain: "voice-pipeline"
      phase: "3"
      complexity_budget: "200 LoC"
      exports: 17 items
      tasks: 6 items
      voice_considerations: "Track upload progress for large voice files. Support multiple audio formats (webm, mp3, wav). Genera..."
  - path: "src/domains/tenant/types/tenant-types.ts"
    status: "complete"
    type: "type"
    lines: 550
    has_directive: true
    directive:
      purpose: "TypeScript interfaces and types for multi-tenant architecture with voice-first configuration and subscription management"
      domain: "tenant"
      phase: "1"
      complexity_budget: "low"
      exports: 34 items
      tasks: 10 items
      voice_considerations: "Voice configuration types should support multiple TTS/STT providers and custom voice branding. Voice..."
      security_considerations: "All tenant types must support Row Level Security policies for data isolation. Sensitive subscription..."
      performance_considerations: "Types should be optimized for efficient serialization and caching. Large objects like analytics shou..."
  - path: "src/domains/tenant/services/tenant-service.ts"
    status: "complete"
    type: "service"
    lines: 764
    has_directive: true
    directive:
      purpose: "Core tenant management service for multi-tenant architecture with organization setup, user management, and voice-first configuration"
      domain: "tenant"
      phase: "1"
      complexity_budget: "high"
      dependencies: ["src/core/database/connection.ts", "src/core/logger/logger.ts", "src/core/errors/error-types.ts", "src/domains/tenant/types/tenant-types.ts", "src/domains/tenant/repositories/tenant-repository.ts", "@supabase/supabase-js"]
      exports: 40 items
      tasks: 10 items
      voice_considerations: "Tenant voice configuration should support organization-specific wake words and voice branding. Voice..."
      security_considerations: "All tenant operations must enforce strict data isolation between organizations. Tenant access valida..."
      performance_considerations: "Tenant data should be cached with TTL expiry for frequent access patterns. Tenant user queries shoul..."
  - path: "src/domains/tenant/services/subscription-service.ts"
    status: "complete"
    type: "service"
    lines: 748
    has_directive: true
    directive:
      purpose: "Subscription management service for tenant billing plans, usage tracking, and plan upgrades/downgrades with voice analytics"
      domain: "tenant"
      phase: "1"
      complexity_budget: "high"
      dependencies: ["src/core/database/connection.ts", "src/core/logger/logger.ts", "src/core/errors/error-types.ts", "src/domains/tenant/types/tenant-types.ts", "@supabase/supabase-js"]
      exports: 39 items
      tasks: 10 items
      voice_considerations: "Subscription service should track voice usage minutes and API calls for billing purposes. Voice anal..."
      security_considerations: "All subscription operations must enforce tenant isolation and permission validation. Payment process..."
      performance_considerations: "Usage tracking should use efficient aggregation queries with proper indexing. Subscription checks sh..."
  - path: "src/domains/tenant/repositories/tenant-repository.ts"
    status: "complete"
    type: "other"
    lines: 653
    has_directive: true
    directive:
      purpose: "Data access layer for tenant operations with Supabase RLS, pagination, and multi-tenant isolation"
      domain: "tenant"
      phase: "1"
      complexity_budget: "medium"
      dependencies: ["src/core/database/connection.ts", "src/core/logger/logger.ts", "src/core/errors/error-types.ts", "src/domains/tenant/types/tenant-types.ts", "@supabase/supabase-js"]
      exports: 38 items
      tasks: 10 items
      voice_considerations: "Repository should handle voice configuration data efficiently for real-time voice operations. Voice ..."
      security_considerations: "All operations must enforce Row Level Security policies for multi-tenant data isolation. Tenant data..."
      performance_considerations: "Repository should use efficient queries with proper indexing on slug, domain, and name fields. Pagin..."
  - path: "src/__tests__/components/auth/SignInForm.test.tsx"
    status: "complete"
    type: "component"
    lines: 281
    has_directive: false
  - path: "src/app/api/voice/intake/route.ts"
    status: "complete"
    type: "api"
    lines: 149
    has_directive: true
    directive:
      purpose: "API endpoint for voice recording intake and signed URL generation"
      domain: "voice-pipeline"
      phase: "3"
      complexity_budget: "150 LoC"
      exports: 15 items
      tasks: 6 items
      voice_considerations: "Validate audio file types and sizes before generating upload URLs. Return clear error messages for v..."
  - path: "src/app/api/auth/register/route.ts"
    status: "complete"
    type: "api"
    lines: 649
    has_directive: true
    directive:
      purpose: "Next.js API route for user registration with Supabase Auth, voice profile setup, tenant assignment, and welcome communications"
      domain: "authentication"
      phase: "1"
      complexity_budget: "medium"
      dependencies: ["src/domains/auth/types/auth-types.ts", "src/domains/auth/utils/auth-validators.ts", "src/domains/auth/utils/auth-helpers.ts", "src/core/database/connection.ts", "src/core/logger/logger.ts", "next/server", "@supabase/supabase-js", "@supabase/auth-helpers-nextjs"]
      exports: 34 items
      tasks: 10 items
      voice_considerations: "Voice registration should initialize voice profiles with default preferences and wake word settings...."
      security_considerations: "Registration must enforce strong password requirements and validate email domains. Email verificatio..."
      performance_considerations: "Registration process should be optimized for fast user onboarding experience. Database operations sh..."
  - path: "src/app/api/auth/refresh/route.ts"
    status: "complete"
    type: "api"
    lines: 483
    has_directive: true
    directive:
      purpose: "Next.js API route for token refresh with Supabase Auth, voice session extension, session updates, and audit logging"
      domain: "authentication"
      phase: "1"
      complexity_budget: "low"
      dependencies: ["src/domains/auth/types/auth-types.ts", "src/domains/auth/utils/auth-helpers.ts", "src/core/database/connection.ts", "src/core/logger/logger.ts", "next/server", "@supabase/supabase-js", "@supabase/auth-helpers-nextjs"]
      exports: 33 items
      tasks: 10 items
      voice_considerations: "Voice session refresh should extend voice session timeouts for continuous device use. Voice session ..."
      security_considerations: "Token refresh must validate existing session authenticity before issuing new tokens. Refresh operati..."
      performance_considerations: "Token refresh should be fast and responsive to avoid interrupting user workflows. Session updates sh..."
  - path: "src/app/api/auth/logout/route.ts"
    status: "complete"
    type: "api"
    lines: 507
    has_directive: true
    directive:
      purpose: "Next.js API route for user logout with Supabase Auth signOut, session cleanup, voice session termination, and audit logging"
      domain: "authentication"
      phase: "1"
      complexity_budget: "low"
      dependencies: ["src/domains/auth/types/auth-types.ts", "src/domains/auth/utils/auth-helpers.ts", "src/core/database/connection.ts", "src/core/logger/logger.ts", "next/server", "@supabase/supabase-js", "@supabase/auth-helpers-nextjs"]
      exports: 33 items
      tasks: 10 items
      voice_considerations: "Voice logout should provide clear confirmation of successful logout. Voice session termination shoul..."
      security_considerations: "All logout operations must invalidate sessions across all devices if requested. Session cleanup must..."
      performance_considerations: "Logout operations should be fast and responsive for good user experience. Session cleanup should be ..."
  - path: "src/app/api/auth/login/route.ts"
    status: "complete"
    type: "api"
    lines: 526
    has_directive: true
    directive:
      purpose: "Next.js API route for user authentication with Supabase Auth, voice login support, MFA handling, and audit logging"
      domain: "authentication"
      phase: "1"
      complexity_budget: "medium"
      dependencies: ["src/domains/auth/types/auth-types.ts", "src/domains/auth/utils/auth-validators.ts", "src/domains/auth/utils/auth-helpers.ts", "src/core/database/connection.ts", "src/core/logger/logger.ts", "next/server", "@supabase/supabase-js", "@supabase/auth-helpers-nextjs"]
      exports: 34 items
      tasks: 10 items
      voice_considerations: "Voice login should support natural language patterns like "sign in as john@company.com". Voice authe..."
      security_considerations: "All login attempts must be rate-limited to prevent brute force attacks. Failed login attempts must b..."
      performance_considerations: "Login requests should be processed quickly to provide responsive user experience. Database queries s..."
  - path: "supabase/migrations/004_v4_storage_buckets_and_functions.sql"
    status: "complete"
    type: "migration"
    lines: 417
    has_directive: false
  - path: "supabase/migrations/003_v4_irrigation_and_specialized_tables.sql"
    status: "complete"
    type: "migration"
    lines: 443
    has_directive: false
  - path: "supabase/migrations/002_v4_voice_vision_media_tables.sql"
    status: "complete"
    type: "migration"
    lines: 349
    has_directive: false
  - path: "supabase/migrations/001_v4_core_business_tables.sql"
    status: "complete"
    type: "migration"
    lines: 352
    has_directive: false
```

## Voice-First Compliance

### Files with Voice Considerations
- **`src/domains/auth/types/auth-types.ts`**: Includes specific types for voice preferences within the UserProfile to allow for personalized voice interactions. security_considerations: > Types must not expose sensitive data like password hashes. All sensitive data is handled by Supabase directly. performance_considerations: > Types are lightweight and designed for efficient serialization and caching for offline use. tasks: 1. [SETUP] Import the `User` and `Session` types from the `@supabase/supabase-js` library. 2. [ENUM] Define the `Role` enum with values: 'admin', 'manager', 'technician', 'customer'. 3. [USER] Create the `UserProfile` interface, extending the Supabase `User` type with fields for `role: Role`, `active_tenant_id: string`, and `voice_preferences: object`. 4. [SESSION] Define the `Session` interface, extending the Supabase `Session` type with `device_info: object` for tracking. 5. [PERMISSIONS] Create a `Permission` interface with `action: string` (e.g., 'delete_job') and `subject: string` (e.g., 'work_order'). 6. [MFA] Define an `MFAChallenge` interface with `type: 'totp' | 'sms'` and a `challenge_id: string`. 7. [RESULT] Create the `AuthResult` type, which is an object containing `{ user: UserProfile, session: Session }`. 8. [DTOs] Define Data Transfer Object interfaces like `LoginDto` and `RegisterDto` for API validation. 9. [GUARDS] Add type guards (e.g., `isManager(role: Role)`) for easy role checking. 10. [DOCUMENTATION] Add TSDoc comments to all exported types and enums explaining their purpose. --- END DIRECTIVE BLOCK ---
- **`src/domains/auth/utils/auth-validators.ts`**: Voice command validation should handle natural language variations for authentication operations. Validation error messages should be voice-friendly for TTS output to users. Voice input validation should be more lenient with formatting but strict with security. security_considerations: > Password validation must enforce strong security requirements including length, complexity, and common password checking. Email validation must prevent injection attacks and normalize input safely. Phone validation must handle international formats while preventing malformed input. All validation errors must not leak sensitive information about system internals. performance_considerations: > Zod schemas should be pre-compiled and cached for repeated validation operations. Complex validation rules should use efficient regex patterns and avoid expensive operations. Voice command validation should be optimized for real-time processing with minimal latency. tasks: 1. [SETUP] Import Zod library and auth types for schema definition 2. [EMAIL] Create email validation schema with proper format checking and normalization 3. [PASSWORD] Define password schema with strength requirements (min 8 chars, uppercase, lowercase, numbers) 4. [PHONE] Create phone number validation schema supporting international formats 5. [LOGIN] Build login validation schema combining email and password validation 6. [REGISTER] Create registration schema with all required fields and role validation 7. [VOICE] Define voice command validation schema for auth operations 8. [HELPERS] Create helper functions that wrap schema validation with error handling 9. [ERRORS] Implement voice-friendly error message formatting for validation failures 10. [EXPORT] Export all schemas and validation helper functions for use in services --- END DIRECTIVE BLOCK ---
- **`src/domains/auth/utils/auth-helpers.ts`**: Voice greetings should be natural and personalized based on user preferences and time of day. Voice session management should handle device wake/sleep cycles gracefully. User name formatting should consider pronunciation for TTS systems. security_considerations: > Error sanitization must never leak sensitive system information or user data. Session validation must be cryptographically secure and tamper-resistant. Tenant extraction must validate against known patterns to prevent domain spoofing. All helper functions must handle null/undefined inputs safely. performance_considerations: > Functions should be pure and stateless for better caching and testing. String operations should be optimized for frequent calls. Date calculations should use efficient date-fns functions over native Date methods. Permission lookups should use cached data structures where possible. tasks: 1. [SETUP] Import required dependencies and auth types 2. [DISPLAY] Create formatUserDisplayName with fallback logic for missing names 3. [SESSION] Implement isSessionExpired using date-fns for accurate time comparison 4. [PERMISSIONS] Build getPermissionsForRole with role-based permission mapping 5. [ERRORS] Create sanitizeAuthError to convert technical errors to user messages 6. [VOICE] Implement generateVoiceGreeting with personalization and time awareness 7. [TENANT] Add extractTenantFromEmail with domain validation and mapping 8. [VOICE_SESSION] Create isVoiceSessionActive with device state checking 9. [UTILITIES] Add helper functions for role display, session formatting, and security 10. [EXPORT] Export all helper functions with proper TypeScript types --- END DIRECTIVE BLOCK ---
- **`src/domains/auth/guards/auth-guard.tsx`**: Voice routes should have extended session timeouts and different validation rules. Voice session validation should handle device sleep/wake cycles gracefully. Authentication failures should provide voice-friendly error messages and alternatives. security_considerations: > All route protection must enforce Row Level Security policies for multi-tenant data isolation. Session validation must be cryptographically secure and resistant to tampering. Permission checks must use server-side validation and never rely on client-side state alone. Tenant access validation must prevent cross-tenant data access through URL manipulation. Voice session validation must include additional security checks for sensitive operations. performance_considerations: > Middleware should cache permission checks to avoid repeated database queries. Route protection should fail fast for unauthorized access to minimize server load. Session validation should use efficient caching strategies for frequently accessed routes. HOCs should minimize re-renders and only update when auth state actually changes. tasks: 1. [SETUP] Import Next.js middleware types, Supabase client, and auth utilities 2. [MIDDLEWARE] Create Next.js middleware function for server-side route protection 3. [PERMISSION] Implement checkRoutePermission with role and resource validation 4. [REDIRECT] Build redirectToLogin with return URL preservation and voice handling 5. [TENANT] Create validateTenantAccess for multi-tenant route isolation 6. [VOICE] Implement checkVoiceSession for voice-enabled route validation 7. [HOC] Build withAuth HOC for protecting React components and pages 8. [CONTEXT] Create React context provider for auth guard state management 9. [ROLE_HOC] Implement withRoleAccess HOC for role-based component rendering 10. [SERVER] Add getServerAuthState for server-side auth state retrieval --- END DIRECTIVE BLOCK ---
- **`src/domains/voice/types/voice-types.ts`**: Define clear types for voice metadata including confidence scores, language detection, and provider-specific response formats offline_capability: OPTIONAL test_requirements: coverage: 0.0 test_file: n/a - type definitions only --- END DIRECTIVE BLOCK ---
- **`src/domains/voice/services/voice-intake-service.ts`**: Track upload progress for large voice files. Support multiple audio formats (webm, mp3, wav). Generate signed URLs with appropriate expiration. offline_capability: OPTIONAL test_requirements: coverage: 0.9 test_file: /src/domains/voice/services/__tests__/voice-intake-service.test.ts tasks: 1. [SETUP] Initialize Supabase client 2. [SESSION] Create or validate conversation session 3. [MEDIA] Create media_assets record 4. [STORAGE] Generate signed upload URL 5. [QUEUE] Enqueue ASR processing on upload completion 6. [ERROR] Handle upload failures and cleanup --- END DIRECTIVE BLOCK ---
- **`src/domains/tenant/types/tenant-types.ts`**: Voice configuration types should support multiple TTS/STT providers and custom voice branding. Voice analytics should include confidence scores, command success rates, and usage patterns. Voice settings should support tenant-specific wake words and pronunciation customization. security_considerations: > All tenant types must support Row Level Security policies for data isolation. Sensitive subscription data like billing information must be properly typed for encryption. Voice pattern data must be designed for secure storage without exposing biometric details. performance_considerations: > Types should be optimized for efficient serialization and caching. Large objects like analytics should be paginated and lazily loaded. Voice configuration should be cached separately for real-time access. tasks: 1. [ENUMS] Define BillingPlan enum with free, starter, professional, enterprise 2. [CORE] Create core Tenant interface with id, name, slug, domain, settings, is_active 3. [SETTINGS] Define TenantSettings with branding, features, and limits 4. [VOICE] Create TenantVoiceConfig with wake_words, tts_provider, stt_provider, voice_branding 5. [SUBSCRIPTION] Define Subscription interface with plan, status, current_period_end 6. [INVITATION] Create TenantInvitation interface for user invitations 7. [ANALYTICS] Define TenantAnalytics interface for usage metrics 8. [USER] Create TenantUser interface for users with tenant context 9. [CRUD] Create CRUD operation data transfer objects 10. [UTILITIES] Add utility types and type guards for validation --- END DIRECTIVE BLOCK ---
- **`src/domains/tenant/services/tenant-service.ts`**: Tenant voice configuration should support organization-specific wake words and voice branding. Voice analytics should track organization-wide voice usage patterns and performance metrics. Voice setup should include tenant-specific TTS voices and speech recognition settings. Multi-tenant voice isolation should prevent cross-tenant voice data access. security_considerations: > All tenant operations must enforce strict data isolation between organizations. Tenant access validation must prevent unauthorized cross-tenant data access. User invitations must be validated against tenant domain policies and approval workflows. Tenant deletion must securely archive data with proper retention policies. Voice configuration must isolate tenant-specific voice patterns and training data. performance_considerations: > Tenant data should be cached with TTL expiry for frequent access patterns. Tenant user queries should be paginated and indexed for large organizations. Analytics queries should use pre-computed aggregations where possible. Voice configuration should be cached separately for real-time voice operations. Cross-tenant operations should be minimized and optimized for performance. tasks: 1. [SETUP] Create TenantService class with dependency injection and error handling 2. [CREATE] Implement createTenant with organization setup and initial configuration 3. [RETRIEVE] Add getTenant and getTenantByDomain with caching and validation 4. [UPDATE] Create updateTenant with configuration validation and change tracking 5. [DELETE] Implement soft delete with data archival and cleanup workflows 6. [ACCESS] Add validateTenantAccess with role-based permission checking 7. [USERS] Create tenant user management with role filtering and pagination 8. [INVITES] Implement user invitation system with approval workflows 9. [VOICE] Add tenant-specific voice configuration and branding setup 10. [ANALYTICS] Create tenant analytics with usage metrics and performance tracking --- END DIRECTIVE BLOCK ---
- **`src/domains/tenant/services/subscription-service.ts`**: Subscription service should track voice usage minutes and API calls for billing purposes. Voice analytics should be included in usage metrics for plan optimization recommendations. Plan changes should consider voice feature availability and usage patterns. Voice-heavy usage should trigger upgrade recommendations for better limits. security_considerations: > All subscription operations must enforce tenant isolation and permission validation. Payment processing must be secure and PCI compliant with encrypted data handling. Usage metrics must not expose sensitive tenant data across organizational boundaries. Plan changes must validate user permissions and prevent unauthorized upgrades. Billing data must be encrypted at rest and in transit with audit logging. performance_considerations: > Usage tracking should use efficient aggregation queries with proper indexing. Subscription checks should be cached to avoid repeated database queries. Billing calculations should be optimized for real-time plan comparison. Usage metrics should use pre-computed values where possible for performance. Payment processing should be asynchronous to avoid blocking user operations. tasks: 1. [SETUP] Create SubscriptionService class with database connection and error handling 2. [GET] Implement getSubscription with current plan and usage details 3. [CREATE] Add createSubscription with default plan setup and billing integration 4. [UPDATE] Create updateSubscription with plan change validation and proration 5. [CANCEL] Implement cancelSubscription with retention period and data archival 6. [RENEW] Add renewSubscription with payment processing and plan reactivation 7. [USAGE] Create checkUsageLimits with real-time usage validation against plan limits 8. [METRICS] Implement getUsageMetrics with voice analytics and performance data 9. [VALIDATION] Add validatePlanChange with upgrade/downgrade business rules 10. [BILLING] Create payment processing and invoice generation functionality --- END DIRECTIVE BLOCK ---
- **`src/domains/tenant/repositories/tenant-repository.ts`**: Repository should handle voice configuration data efficiently for real-time voice operations. Voice settings should be cached separately for performance during voice interactions. Tenant voice data should be isolated to prevent cross-tenant voice pattern access. security_considerations: > All operations must enforce Row Level Security policies for multi-tenant data isolation. Tenant data must be filtered by user permissions and tenant assignments. Sensitive configuration data must be encrypted at rest using Supabase encryption. Domain validation must prevent tenant impersonation and subdomain hijacking. Soft delete must preserve audit trails while securing deleted tenant data. performance_considerations: > Repository should use efficient queries with proper indexing on slug, domain, and name fields. Pagination should use cursor-based pagination for large tenant datasets. Frequently accessed tenant data should be cached with appropriate TTL. Bulk operations should use batch processing to minimize database round trips. Complex joins should be optimized to avoid N+1 query problems. tasks: 1. [SETUP] Create TenantRepository class with Supabase client and error handling 2. [CREATE] Implement create method with validation and default settings setup 3. [FIND_BY_ID] Add findById method with settings and voice config retrieval 4. [FIND_BY_SLUG] Create findBySlug method with active tenant filtering 5. [FIND_BY_DOMAIN] Implement findByDomain with primary and allowed domain matching 6. [UPDATE] Add update method with configuration merging and validation 7. [DELETE] Create soft delete method with data retention and cleanup 8. [LIST] Implement list method with pagination, filtering, and sorting 9. [UNIQUENESS] Add uniqueness checking methods for name, slug, and domain 10. [HELPERS] Create helper methods for query optimization and data transformation --- END DIRECTIVE BLOCK ---
- **`src/app/api/voice/intake/route.ts`**: Validate audio file types and sizes before generating upload URLs. Return clear error messages for voice UI to display. offline_capability: NONE test_requirements: coverage: 0.9 test_file: /src/app/api/voice/intake/__tests__/route.test.ts tasks: 1. [AUTH] Verify JWT authentication 2. [VALIDATE] Check request body schema 3. [SESSION] Validate session ownership 4. [SERVICE] Call voice intake service 5. [RESPONSE] Return upload URL and metadata 6. [ERROR] Handle and log failures --- END DIRECTIVE BLOCK ---
- **`src/app/api/auth/register/route.ts`**: Voice registration should initialize voice profiles with default preferences and wake word settings. Voice profile setup should include speech rate, language preferences, and TTS provider selection. Voice onboarding should provide audio guidance for first-time voice users. Voice registration should support voice-guided profile completion for accessibility. security_considerations: > Registration must enforce strong password requirements and validate email domains. Email verification must be required before account activation to prevent fake accounts. Tenant assignment must be validated against approved domain lists to prevent unauthorized access. User profile creation must enforce Row Level Security policies for multi-tenant isolation. Registration attempts must be rate-limited to prevent spam and automated account creation. Welcome communications must not expose sensitive system information or internal data. performance_considerations: > Registration process should be optimized for fast user onboarding experience. Database operations should be transactional to ensure data consistency during profile creation. Email/SMS sending should be asynchronous to avoid blocking registration response. Tenant lookup and assignment should use cached domain mappings for performance. Voice profile initialization should be efficient and not delay registration completion. tasks: 1. [SETUP] Import Next.js server types, Supabase client, and auth utilities 2. [VALIDATION] Implement comprehensive request validation using registration schemas 3. [SIGNUP] Handle Supabase signUp with email verification and proper error handling 4. [TENANT] Implement tenant assignment based on email domain with validation 5. [PROFILE] Create user profile with voice preferences and default settings 6. [VOICE] Initialize voice profile with default preferences and accessibility options 7. [ROLE] Assign default user role based on tenant settings and registration context 8. [WELCOME] Send welcome email/SMS with account verification and next steps 9. [AUDIT] Implement registration audit logging with security and compliance tracking 10. [RESPONSE] Format response with account status, verification requirements, and next steps --- END DIRECTIVE BLOCK ---
- **`src/app/api/auth/refresh/route.ts`**: Voice session refresh should extend voice session timeouts for continuous device use. Voice session extension should maintain conversation context and wake word state. Voice refresh should be automatic and not interrupt ongoing voice interactions. Voice session analytics should track refresh frequency for device optimization. security_considerations: > Token refresh must validate existing session authenticity before issuing new tokens. Refresh operations must update session security metadata including device fingerprints. Expired or invalid refresh tokens must be rejected with proper error logging. Session updates must maintain security flags and anomaly detection state. Audit logging must track refresh patterns for security monitoring and fraud detection. New auth cookies must be issued with secure settings and proper expiration times. performance_considerations: > Token refresh should be fast and responsive to avoid interrupting user workflows. Session updates should be efficient and use optimized database queries. Refresh operations should be idempotent and safe for concurrent requests. Voice session extension should minimize latency to maintain real-time interaction. Audit logging should be asynchronous to avoid blocking refresh response. tasks: 1. [SETUP] Import Next.js server types, Supabase client, and auth utilities 2. [VALIDATION] Implement request validation for refresh parameters and session data 3. [REFRESH] Handle Supabase session refresh with proper error handling 4. [VOICE] Add voice session extension with timeout updates and context preservation 5. [SESSION] Update session records in database with new expiration and activity data 6. [COOKIES] Issue new auth cookies with updated tokens and secure configuration 7. [SECURITY] Update session security metadata and validate session integrity 8. [AUDIT] Implement refresh audit logging with session and security information 9. [RESPONSE] Format response with new tokens, session data, and expiration info 10. [ERROR] Handle all error cases with appropriate HTTP status codes and messages --- END DIRECTIVE BLOCK ---
- **`src/app/api/auth/logout/route.ts`**: Voice logout should provide clear confirmation of successful logout. Voice session termination should handle graceful disconnection from voice services. Voice logout should support natural language commands like "sign out" or "log me out". Voice feedback should confirm all sessions have been terminated safely. security_considerations: > All logout operations must invalidate sessions across all devices if requested. Session cleanup must be thorough to prevent session hijacking or reuse. Voice session termination must securely disconnect from voice services. Audit logging must track logout events with device and session information. Cookie clearing must be comprehensive and secure to prevent session persistence. Logout must be idempotent and safe to call multiple times without side effects. performance_considerations: > Logout operations should be fast and responsive for good user experience. Session cleanup should be efficient and avoid unnecessary database operations. Audit logging should be asynchronous to avoid blocking the logout response. Cookie clearing should be optimized and not cause client-side delays. Voice session termination should timeout quickly if voice services are unavailable. tasks: 1. [SETUP] Import Next.js server types, Supabase client, and auth utilities 2. [VALIDATION] Implement request validation for logout parameters and options 3. [AUTH] Handle Supabase signOut with proper error handling and cleanup 4. [VOICE] Add voice logout support with session termination and confirmation 5. [SESSION] Clean up session records in database with proper cascade deletion 6. [COOKIES] Clear all authentication cookies with secure configuration 7. [VOICE_SESSION] Terminate voice sessions and disconnect from voice services 8. [AUDIT] Implement logout audit logging with session and device information 9. [RESPONSE] Format response with logout confirmation and optional redirect 10. [ERROR] Handle all error cases with appropriate HTTP status codes and messages --- END DIRECTIVE BLOCK ---
- **`src/app/api/auth/login/route.ts`**: Voice login should support natural language patterns like "sign in as john@company.com". Voice authentication should have extended session timeouts for continuous device use. Voice login errors should provide clear audio feedback with alternative authentication methods. Voice commands should be logged separately for voice interaction analytics. security_considerations: > All login attempts must be rate-limited to prevent brute force attacks. Failed login attempts must be logged with IP addresses and user agents for security monitoring. MFA challenges must be securely generated and have short expiration times. Session cookies must be httpOnly, secure, and have appropriate SameSite settings. Tenant verification must prevent cross-tenant login attempts and data access. Voice login must include additional validation to prevent unauthorized voice impersonation. performance_considerations: > Login requests should be processed quickly to provide responsive user experience. Database queries should be optimized and use proper indexes for user lookup. Session creation should be efficient and avoid unnecessary data serialization. Audit logging should be asynchronous to avoid blocking the login response. MFA validation should use cached TOTP windows to reduce computation overhead. tasks: 1. [SETUP] Import Next.js server types, Supabase client, and auth utilities 2. [VALIDATION] Implement request validation using Zod schemas for login data 3. [AUTH] Handle Supabase signInWithPassword with proper error handling 4. [VOICE] Add voice login support with natural language command parsing 5. [MFA] Implement MFA challenge generation and validation workflow 6. [SESSION] Create secure session with proper cookie configuration 7. [TENANT] Add tenant verification and multi-tenant login support 8. [AUDIT] Implement login audit logging with security event tracking 9. [RESPONSE] Format response with user data, session info, and next steps 10. [ERROR] Handle all error cases with appropriate HTTP status codes and messages --- END DIRECTIVE BLOCK ---

## Security Audit

### Files with Security Considerations
- **`src/domains/auth/types/auth-types.ts`**: Types must not expose sensitive data like password hashes. All sensitive data is handled by Supabase directly. performance_considerations: > Types are lightweight and designed for efficient serialization and caching for offline use. tasks: 1. [SETUP] Import the `User` and `Session` types from the `@supabase/supabase-js` library. 2. [ENUM] Define the `Role` enum with values: 'admin', 'manager', 'technician', 'customer'. 3. [USER] Create the `UserProfile` interface, extending the Supabase `User` type with fields for `role: Role`, `active_tenant_id: string`, and `voice_preferences: object`. 4. [SESSION] Define the `Session` interface, extending the Supabase `Session` type with `device_info: object` for tracking. 5. [PERMISSIONS] Create a `Permission` interface with `action: string` (e.g., 'delete_job') and `subject: string` (e.g., 'work_order'). 6. [MFA] Define an `MFAChallenge` interface with `type: 'totp' | 'sms'` and a `challenge_id: string`. 7. [RESULT] Create the `AuthResult` type, which is an object containing `{ user: UserProfile, session: Session }`. 8. [DTOs] Define Data Transfer Object interfaces like `LoginDto` and `RegisterDto` for API validation. 9. [GUARDS] Add type guards (e.g., `isManager(role: Role)`) for easy role checking. 10. [DOCUMENTATION] Add TSDoc comments to all exported types and enums explaining their purpose. --- END DIRECTIVE BLOCK ---
- **`src/domains/auth/utils/auth-validators.ts`**: Password validation must enforce strong security requirements including length, complexity, and common password checking. Email validation must prevent injection attacks and normalize input safely. Phone validation must handle international formats while preventing malformed input. All validation errors must not leak sensitive information about system internals. performance_considerations: > Zod schemas should be pre-compiled and cached for repeated validation operations. Complex validation rules should use efficient regex patterns and avoid expensive operations. Voice command validation should be optimized for real-time processing with minimal latency. tasks: 1. [SETUP] Import Zod library and auth types for schema definition 2. [EMAIL] Create email validation schema with proper format checking and normalization 3. [PASSWORD] Define password schema with strength requirements (min 8 chars, uppercase, lowercase, numbers) 4. [PHONE] Create phone number validation schema supporting international formats 5. [LOGIN] Build login validation schema combining email and password validation 6. [REGISTER] Create registration schema with all required fields and role validation 7. [VOICE] Define voice command validation schema for auth operations 8. [HELPERS] Create helper functions that wrap schema validation with error handling 9. [ERRORS] Implement voice-friendly error message formatting for validation failures 10. [EXPORT] Export all schemas and validation helper functions for use in services --- END DIRECTIVE BLOCK ---
- **`src/domains/auth/utils/auth-helpers.ts`**: Error sanitization must never leak sensitive system information or user data. Session validation must be cryptographically secure and tamper-resistant. Tenant extraction must validate against known patterns to prevent domain spoofing. All helper functions must handle null/undefined inputs safely. performance_considerations: > Functions should be pure and stateless for better caching and testing. String operations should be optimized for frequent calls. Date calculations should use efficient date-fns functions over native Date methods. Permission lookups should use cached data structures where possible. tasks: 1. [SETUP] Import required dependencies and auth types 2. [DISPLAY] Create formatUserDisplayName with fallback logic for missing names 3. [SESSION] Implement isSessionExpired using date-fns for accurate time comparison 4. [PERMISSIONS] Build getPermissionsForRole with role-based permission mapping 5. [ERRORS] Create sanitizeAuthError to convert technical errors to user messages 6. [VOICE] Implement generateVoiceGreeting with personalization and time awareness 7. [TENANT] Add extractTenantFromEmail with domain validation and mapping 8. [VOICE_SESSION] Create isVoiceSessionActive with device state checking 9. [UTILITIES] Add helper functions for role display, session formatting, and security 10. [EXPORT] Export all helper functions with proper TypeScript types --- END DIRECTIVE BLOCK ---
- **`src/domains/auth/guards/auth-guard.tsx`**: All route protection must enforce Row Level Security policies for multi-tenant data isolation. Session validation must be cryptographically secure and resistant to tampering. Permission checks must use server-side validation and never rely on client-side state alone. Tenant access validation must prevent cross-tenant data access through URL manipulation. Voice session validation must include additional security checks for sensitive operations. performance_considerations: > Middleware should cache permission checks to avoid repeated database queries. Route protection should fail fast for unauthorized access to minimize server load. Session validation should use efficient caching strategies for frequently accessed routes. HOCs should minimize re-renders and only update when auth state actually changes. tasks: 1. [SETUP] Import Next.js middleware types, Supabase client, and auth utilities 2. [MIDDLEWARE] Create Next.js middleware function for server-side route protection 3. [PERMISSION] Implement checkRoutePermission with role and resource validation 4. [REDIRECT] Build redirectToLogin with return URL preservation and voice handling 5. [TENANT] Create validateTenantAccess for multi-tenant route isolation 6. [VOICE] Implement checkVoiceSession for voice-enabled route validation 7. [HOC] Build withAuth HOC for protecting React components and pages 8. [CONTEXT] Create React context provider for auth guard state management 9. [ROLE_HOC] Implement withRoleAccess HOC for role-based component rendering 10. [SERVER] Add getServerAuthState for server-side auth state retrieval --- END DIRECTIVE BLOCK ---
- **`src/domains/tenant/types/tenant-types.ts`**: All tenant types must support Row Level Security policies for data isolation. Sensitive subscription data like billing information must be properly typed for encryption. Voice pattern data must be designed for secure storage without exposing biometric details. performance_considerations: > Types should be optimized for efficient serialization and caching. Large objects like analytics should be paginated and lazily loaded. Voice configuration should be cached separately for real-time access. tasks: 1. [ENUMS] Define BillingPlan enum with free, starter, professional, enterprise 2. [CORE] Create core Tenant interface with id, name, slug, domain, settings, is_active 3. [SETTINGS] Define TenantSettings with branding, features, and limits 4. [VOICE] Create TenantVoiceConfig with wake_words, tts_provider, stt_provider, voice_branding 5. [SUBSCRIPTION] Define Subscription interface with plan, status, current_period_end 6. [INVITATION] Create TenantInvitation interface for user invitations 7. [ANALYTICS] Define TenantAnalytics interface for usage metrics 8. [USER] Create TenantUser interface for users with tenant context 9. [CRUD] Create CRUD operation data transfer objects 10. [UTILITIES] Add utility types and type guards for validation --- END DIRECTIVE BLOCK ---
- **`src/domains/tenant/services/tenant-service.ts`**: All tenant operations must enforce strict data isolation between organizations. Tenant access validation must prevent unauthorized cross-tenant data access. User invitations must be validated against tenant domain policies and approval workflows. Tenant deletion must securely archive data with proper retention policies. Voice configuration must isolate tenant-specific voice patterns and training data. performance_considerations: > Tenant data should be cached with TTL expiry for frequent access patterns. Tenant user queries should be paginated and indexed for large organizations. Analytics queries should use pre-computed aggregations where possible. Voice configuration should be cached separately for real-time voice operations. Cross-tenant operations should be minimized and optimized for performance. tasks: 1. [SETUP] Create TenantService class with dependency injection and error handling 2. [CREATE] Implement createTenant with organization setup and initial configuration 3. [RETRIEVE] Add getTenant and getTenantByDomain with caching and validation 4. [UPDATE] Create updateTenant with configuration validation and change tracking 5. [DELETE] Implement soft delete with data archival and cleanup workflows 6. [ACCESS] Add validateTenantAccess with role-based permission checking 7. [USERS] Create tenant user management with role filtering and pagination 8. [INVITES] Implement user invitation system with approval workflows 9. [VOICE] Add tenant-specific voice configuration and branding setup 10. [ANALYTICS] Create tenant analytics with usage metrics and performance tracking --- END DIRECTIVE BLOCK ---
- **`src/domains/tenant/services/subscription-service.ts`**: All subscription operations must enforce tenant isolation and permission validation. Payment processing must be secure and PCI compliant with encrypted data handling. Usage metrics must not expose sensitive tenant data across organizational boundaries. Plan changes must validate user permissions and prevent unauthorized upgrades. Billing data must be encrypted at rest and in transit with audit logging. performance_considerations: > Usage tracking should use efficient aggregation queries with proper indexing. Subscription checks should be cached to avoid repeated database queries. Billing calculations should be optimized for real-time plan comparison. Usage metrics should use pre-computed values where possible for performance. Payment processing should be asynchronous to avoid blocking user operations. tasks: 1. [SETUP] Create SubscriptionService class with database connection and error handling 2. [GET] Implement getSubscription with current plan and usage details 3. [CREATE] Add createSubscription with default plan setup and billing integration 4. [UPDATE] Create updateSubscription with plan change validation and proration 5. [CANCEL] Implement cancelSubscription with retention period and data archival 6. [RENEW] Add renewSubscription with payment processing and plan reactivation 7. [USAGE] Create checkUsageLimits with real-time usage validation against plan limits 8. [METRICS] Implement getUsageMetrics with voice analytics and performance data 9. [VALIDATION] Add validatePlanChange with upgrade/downgrade business rules 10. [BILLING] Create payment processing and invoice generation functionality --- END DIRECTIVE BLOCK ---
- **`src/domains/tenant/repositories/tenant-repository.ts`**: All operations must enforce Row Level Security policies for multi-tenant data isolation. Tenant data must be filtered by user permissions and tenant assignments. Sensitive configuration data must be encrypted at rest using Supabase encryption. Domain validation must prevent tenant impersonation and subdomain hijacking. Soft delete must preserve audit trails while securing deleted tenant data. performance_considerations: > Repository should use efficient queries with proper indexing on slug, domain, and name fields. Pagination should use cursor-based pagination for large tenant datasets. Frequently accessed tenant data should be cached with appropriate TTL. Bulk operations should use batch processing to minimize database round trips. Complex joins should be optimized to avoid N+1 query problems. tasks: 1. [SETUP] Create TenantRepository class with Supabase client and error handling 2. [CREATE] Implement create method with validation and default settings setup 3. [FIND_BY_ID] Add findById method with settings and voice config retrieval 4. [FIND_BY_SLUG] Create findBySlug method with active tenant filtering 5. [FIND_BY_DOMAIN] Implement findByDomain with primary and allowed domain matching 6. [UPDATE] Add update method with configuration merging and validation 7. [DELETE] Create soft delete method with data retention and cleanup 8. [LIST] Implement list method with pagination, filtering, and sorting 9. [UNIQUENESS] Add uniqueness checking methods for name, slug, and domain 10. [HELPERS] Create helper methods for query optimization and data transformation --- END DIRECTIVE BLOCK ---
- **`src/app/api/auth/register/route.ts`**: Registration must enforce strong password requirements and validate email domains. Email verification must be required before account activation to prevent fake accounts. Tenant assignment must be validated against approved domain lists to prevent unauthorized access. User profile creation must enforce Row Level Security policies for multi-tenant isolation. Registration attempts must be rate-limited to prevent spam and automated account creation. Welcome communications must not expose sensitive system information or internal data. performance_considerations: > Registration process should be optimized for fast user onboarding experience. Database operations should be transactional to ensure data consistency during profile creation. Email/SMS sending should be asynchronous to avoid blocking registration response. Tenant lookup and assignment should use cached domain mappings for performance. Voice profile initialization should be efficient and not delay registration completion. tasks: 1. [SETUP] Import Next.js server types, Supabase client, and auth utilities 2. [VALIDATION] Implement comprehensive request validation using registration schemas 3. [SIGNUP] Handle Supabase signUp with email verification and proper error handling 4. [TENANT] Implement tenant assignment based on email domain with validation 5. [PROFILE] Create user profile with voice preferences and default settings 6. [VOICE] Initialize voice profile with default preferences and accessibility options 7. [ROLE] Assign default user role based on tenant settings and registration context 8. [WELCOME] Send welcome email/SMS with account verification and next steps 9. [AUDIT] Implement registration audit logging with security and compliance tracking 10. [RESPONSE] Format response with account status, verification requirements, and next steps --- END DIRECTIVE BLOCK ---
- **`src/app/api/auth/refresh/route.ts`**: Token refresh must validate existing session authenticity before issuing new tokens. Refresh operations must update session security metadata including device fingerprints. Expired or invalid refresh tokens must be rejected with proper error logging. Session updates must maintain security flags and anomaly detection state. Audit logging must track refresh patterns for security monitoring and fraud detection. New auth cookies must be issued with secure settings and proper expiration times. performance_considerations: > Token refresh should be fast and responsive to avoid interrupting user workflows. Session updates should be efficient and use optimized database queries. Refresh operations should be idempotent and safe for concurrent requests. Voice session extension should minimize latency to maintain real-time interaction. Audit logging should be asynchronous to avoid blocking refresh response. tasks: 1. [SETUP] Import Next.js server types, Supabase client, and auth utilities 2. [VALIDATION] Implement request validation for refresh parameters and session data 3. [REFRESH] Handle Supabase session refresh with proper error handling 4. [VOICE] Add voice session extension with timeout updates and context preservation 5. [SESSION] Update session records in database with new expiration and activity data 6. [COOKIES] Issue new auth cookies with updated tokens and secure configuration 7. [SECURITY] Update session security metadata and validate session integrity 8. [AUDIT] Implement refresh audit logging with session and security information 9. [RESPONSE] Format response with new tokens, session data, and expiration info 10. [ERROR] Handle all error cases with appropriate HTTP status codes and messages --- END DIRECTIVE BLOCK ---
- **`src/app/api/auth/logout/route.ts`**: All logout operations must invalidate sessions across all devices if requested. Session cleanup must be thorough to prevent session hijacking or reuse. Voice session termination must securely disconnect from voice services. Audit logging must track logout events with device and session information. Cookie clearing must be comprehensive and secure to prevent session persistence. Logout must be idempotent and safe to call multiple times without side effects. performance_considerations: > Logout operations should be fast and responsive for good user experience. Session cleanup should be efficient and avoid unnecessary database operations. Audit logging should be asynchronous to avoid blocking the logout response. Cookie clearing should be optimized and not cause client-side delays. Voice session termination should timeout quickly if voice services are unavailable. tasks: 1. [SETUP] Import Next.js server types, Supabase client, and auth utilities 2. [VALIDATION] Implement request validation for logout parameters and options 3. [AUTH] Handle Supabase signOut with proper error handling and cleanup 4. [VOICE] Add voice logout support with session termination and confirmation 5. [SESSION] Clean up session records in database with proper cascade deletion 6. [COOKIES] Clear all authentication cookies with secure configuration 7. [VOICE_SESSION] Terminate voice sessions and disconnect from voice services 8. [AUDIT] Implement logout audit logging with session and device information 9. [RESPONSE] Format response with logout confirmation and optional redirect 10. [ERROR] Handle all error cases with appropriate HTTP status codes and messages --- END DIRECTIVE BLOCK ---
- **`src/app/api/auth/login/route.ts`**: All login attempts must be rate-limited to prevent brute force attacks. Failed login attempts must be logged with IP addresses and user agents for security monitoring. MFA challenges must be securely generated and have short expiration times. Session cookies must be httpOnly, secure, and have appropriate SameSite settings. Tenant verification must prevent cross-tenant login attempts and data access. Voice login must include additional validation to prevent unauthorized voice impersonation. performance_considerations: > Login requests should be processed quickly to provide responsive user experience. Database queries should be optimized and use proper indexes for user lookup. Session creation should be efficient and avoid unnecessary data serialization. Audit logging should be asynchronous to avoid blocking the login response. MFA validation should use cached TOTP windows to reduce computation overhead. tasks: 1. [SETUP] Import Next.js server types, Supabase client, and auth utilities 2. [VALIDATION] Implement request validation using Zod schemas for login data 3. [AUTH] Handle Supabase signInWithPassword with proper error handling 4. [VOICE] Add voice login support with natural language command parsing 5. [MFA] Implement MFA challenge generation and validation workflow 6. [SESSION] Create secure session with proper cookie configuration 7. [TENANT] Add tenant verification and multi-tenant login support 8. [AUDIT] Implement login audit logging with security event tracking 9. [RESPONSE] Format response with user data, session info, and next steps 10. [ERROR] Handle all error cases with appropriate HTTP status codes and messages --- END DIRECTIVE BLOCK ---

## Next Implementation Priorities

### 🔴 Critical (Scaffolded Files)
No scaffolded files requiring implementation

### 🟡 In Progress (Partial Implementation)
1. `src/core/errors/error-handler.ts` - Global error handling service with voice notifications and recovery strategies

## Architecture Details

### Dependencies Analysis
- **`src/domains/auth/types/auth-types.ts`**: 1 dependencies
- **`src/domains/auth/utils/auth-validators.ts`**: 2 dependencies
- **`src/domains/auth/utils/auth-helpers.ts`**: 3 dependencies
- **`src/domains/auth/guards/auth-guard.tsx`**: 6 dependencies
- **`src/domains/tenant/services/tenant-service.ts`**: 6 dependencies
- **`src/domains/tenant/services/subscription-service.ts`**: 5 dependencies
- **`src/domains/tenant/repositories/tenant-repository.ts`**: 5 dependencies
- **`src/app/api/auth/register/route.ts`**: 8 dependencies
- **`src/app/api/auth/refresh/route.ts`**: 7 dependencies
- **`src/app/api/auth/logout/route.ts`**: 7 dependencies
- **`src/app/api/auth/login/route.ts`**: 8 dependencies

### Exports Analysis  
- **`src/core/database/transaction-manager.ts`**: 29 exports
- **`src/core/database/connection.ts`**: 29 exports
- **`src/domains/auth/types/auth-types.ts`**: 23 exports
- **`src/domains/auth/utils/auth-validators.ts`**: 36 exports
- **`src/domains/auth/utils/auth-helpers.ts`**: 37 exports
- **`src/domains/auth/services/permission-service.ts`**: 41 exports
- **`src/domains/auth/services/mfa-service.ts`**: 41 exports
- **`src/domains/auth/services/auth-service.ts`**: 41 exports
- **`src/domains/auth/repositories/user-repository.ts`**: 41 exports
- **`src/domains/auth/repositories/session-repository.ts`**: 41 exports
- **`src/domains/auth/guards/auth-guard.tsx`**: 36 exports
- **`src/domains/voice/types/voice-types.ts`**: 13 exports
- **`src/domains/voice/services/voice-intake-service.ts`**: 17 exports
- **`src/domains/tenant/types/tenant-types.ts`**: 34 exports
- **`src/domains/tenant/services/tenant-service.ts`**: 40 exports
- **`src/domains/tenant/services/subscription-service.ts`**: 39 exports
- **`src/domains/tenant/repositories/tenant-repository.ts`**: 38 exports
- **`src/app/api/voice/intake/route.ts`**: 15 exports
- **`src/app/api/auth/register/route.ts`**: 34 exports
- **`src/app/api/auth/refresh/route.ts`**: 33 exports
- **`src/app/api/auth/logout/route.ts`**: 33 exports
- **`src/app/api/auth/login/route.ts`**: 34 exports

### Implementation Tasks
- **`src/core/database/transaction-manager.ts`**: 10 tasks defined
- **`src/core/database/connection.ts`**: 10 tasks defined
- **`src/domains/auth/types/auth-types.ts`**: 10 tasks defined
- **`src/domains/auth/utils/auth-validators.ts`**: 10 tasks defined
- **`src/domains/auth/utils/auth-helpers.ts`**: 10 tasks defined
- **`src/domains/auth/services/permission-service.ts`**: 10 tasks defined
- **`src/domains/auth/services/mfa-service.ts`**: 10 tasks defined
- **`src/domains/auth/services/auth-service.ts`**: 10 tasks defined
- **`src/domains/auth/repositories/user-repository.ts`**: 10 tasks defined
- **`src/domains/auth/repositories/session-repository.ts`**: 10 tasks defined
- **`src/domains/auth/guards/auth-guard.tsx`**: 10 tasks defined
- **`src/domains/voice/services/voice-intake-service.ts`**: 6 tasks defined
- **`src/domains/tenant/types/tenant-types.ts`**: 10 tasks defined
- **`src/domains/tenant/services/tenant-service.ts`**: 10 tasks defined
- **`src/domains/tenant/services/subscription-service.ts`**: 10 tasks defined
- **`src/domains/tenant/repositories/tenant-repository.ts`**: 10 tasks defined
- **`src/app/api/voice/intake/route.ts`**: 6 tasks defined
- **`src/app/api/auth/register/route.ts`**: 10 tasks defined
- **`src/app/api/auth/refresh/route.ts`**: 10 tasks defined
- **`src/app/api/auth/logout/route.ts`**: 10 tasks defined
- **`src/app/api/auth/login/route.ts`**: 10 tasks defined

## Directive Block Coverage Analysis

| Metric | Count | Percentage |
|--------|-------|------------|
| Files with Directives | 29 | 49% |
| Files with Purpose | 29 | 49% |
| Files with Domain | 29 | 49% |
| Files with Phase | 29 | 49% |
| Voice Considerations | 15 | 25% |
| Security Considerations | 12 | 20% |
| Performance Considerations | 12 | 20% |
| Dependencies Documented | 11 | 19% |
| Exports Documented | 22 | 37% |
| Tasks Defined | 21 | 36% |

---
*This architecture manifest focuses solely on the Voice-First FSM application*
*Control Tower tooling and development scripts are excluded to provide clear visibility into product architecture*
