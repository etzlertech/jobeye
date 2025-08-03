# Master Prompt for Architecture-as-Code Skeleton Generation v2025-08-1

Use this template to initiate skeleton generation with Claude for each phase/domain combination.

## Template

```
🤖 Claude,

We are initiating Architecture-as-Code scaffolding for Voice-First FSM v3.2.1.

Role: Lead Architect AI
Objective: Generate file skeletons only with Directive Block Contract v2025-08-1
Workflow: Propose → Approve → Emit blocks, domain by domain

Rules:
1. Acknowledge Directive-Block Contract v2025-08-1
2. Work domain-by-domain as described
3. Never write implementation now – headers only
4. Emit max 5 directive blocks per response
5. Validate each spec_ref path exists
6. Stop when domain skeleton complete; await next domain

**Ruleset Addendum (v2025-08-1)**:
- Use the AAC-Header contract with ALL fields including:
  - migrations_touched (list SQL files for DB operations)
  - state_machine (if stateful workflow with id and states)
  - estimated_llm_cost (for any AI/LLM operations)
  - offline_capability (REQUIRED | OPTIONAL | NONE)
- Do NOT write implementation code
- Max 5 AAC-Headers per response
- Verify spec_ref exists
- Await explicit "Approved" before emitting headers

Current phase: [PHASE_NUMBER]
Current domain: [DOMAIN_NAME]
Tables involved: [LIST_TABLES]
Special requirements: [ANY_PHASE_SPECIFIC_NEEDS]

Available spec documents in .claude/spec/:
- [LIST_AVAILABLE_SPEC_FILES]

Begin by proposing the file list for this domain.
```

## Phase 1 Examples

### Authentication Domain
```
Current phase: 1
Current domain: Authentication
Tables involved: users, auth_tokens, password_reset_requests
Special requirements: 
- Integrate with Supabase Auth
- Support magic link authentication
- Voice biometric as future enhancement
- JWT with refresh token pattern
- Multi-tenant isolation from day one
- RLS policies for all tables
- Estimated 5,000 logins/day

Available spec documents in .claude/spec/:
- v4.0/schema-overview.md
- v4.0/auth-patterns.md
- v4.0/voice-security.md
- v4.0/rls-patterns.md
```

### Core Infrastructure Domain
```
Current phase: 1
Current domain: Core Infrastructure
Tables involved: audit_logs, system_settings
Special requirements:
- Structured logging with correlation IDs
- Environment-based configuration
- Supabase client singleton
- Error handling with proper error codes
- Request/response interceptors
- No offline capability needed
- Cost tracking foundation

Available spec documents in .claude/spec/:
- v4.0/infrastructure-patterns.md
- v4.0/logging-standards.md
- v4.0/error-handling.md
```

### Multi-tenant Domain
```
Current phase: 1
Current domain: Multi-tenant
Tables involved: companies, company_users, tenant_settings
Special requirements:
- Row Level Security (RLS) policies
- Company ID injection in all queries
- Tenant isolation middleware
- Admin bypass for support
- Subscription tier handling
- Company switching for users with multiple companies
- Offline capability: OPTIONAL

Available spec documents in .claude/spec/:
- v4.0/multi-tenant-architecture.md
- v4.0/rls-patterns.md
- v4.0/company-isolation.md
```

## Phase 2 Examples

### Customer Management Domain
```
Current phase: 2
Current domain: Customer Management
Tables involved: customers, contacts, addresses, customer_tags, customer_notes
Special requirements:
- Fuzzy search on customer names
- Address validation/geocoding
- Tag-based segmentation
- Voice-searchable customer lookup ("find customer John Smith")
- Quick-add via voice commands
- Offline capability: REQUIRED for mobile
- Customer state machine: [prospect, active, inactive, archived]

Available spec documents in .claude/spec/:
- v4.0/customer-domain.md
- v4.0/search-patterns.md
- v4.0/voice-shortcuts.md
```

## Phase 3 Examples

### Voice Core Domain
```
Current phase: 3
Current domain: Voice Core
Tables involved: conversation_sessions, messages, transcripts, voice_metadata
Special requirements:
- Real-time transcription
- Session state management
- Cost tracking per message (estimated $0.006/message)
- Voice authentication prep
- Conversation context window
- State machine: [idle, listening, processing, responding, error]
- Offline capability: REQUIRED with queue

Available spec documents in .claude/spec/:
- v4.0/voice-architecture.md
- v4.0/conversation-state.md
- v4.0/llm-cost-tracking.md
```

## Expected Response Format

Claude should respond with:

1. First, a proposed file list (just paths, no code)
2. After approval, emit directive blocks in code fences

Example:
```
I'll create the following files for the Authentication domain:

1. `/src/domains/auth/services/auth-service.ts` - Main authentication service
2. `/src/domains/auth/services/token-service.ts` - JWT token management
3. `/src/domains/auth/repositories/user-repository.ts` - User data access
4. `/src/domains/auth/controllers/auth-controller.ts` - HTTP endpoints
5. `/src/domains/auth/types/auth.types.ts` - TypeScript interfaces
6. `/src/domains/auth/services/__tests__/auth-service.test.ts` - Auth service tests
7. `/src/domains/auth/middleware/auth-middleware.ts` - Request authentication
8. `/supabase/migrations/006_create_auth_tables.sql` - Database tables
9. `/supabase/migrations/007_auth_rls_policies.sql` - Row-level security
10. `/supabase/functions/verify-magic-link/index.ts` - Magic link verification

Would you like me to proceed with generating the directive blocks for these files?
```

## Workflow Steps

1. **Send Initial Prompt**: Use the template above with specific phase/domain details
2. **Review File List**: Ensure it covers all needed functionality
3. **Approve**: "Yes, please generate the directive blocks for the first 5 files"
4. **Save Output**: Copy the response and use `npm run scaffold:inject` to create files
5. **Continue**: "Please continue with the next 5 files"
6. **Complete Domain**: Repeat until all files for the domain are created
7. **Validate**: Run `npm run lint:directives` and `npm run validate:deps`
8. **Next Domain**: Start with a new prompt for the next domain

## Enhanced Fields in v2025-08-1

When reviewing Claude's output, ensure these fields are properly used:

### migrations_touched
- Lists all SQL migration files affected
- Helps track database change impacts
- Example:
  ```
  migrations_touched:
    - 006_auth_tables.sql
    - 007_auth_rls_policies.sql
  ```

### state_machine
- Defines workflow states for complex processes
- Enables FSM code generation
- Example:
  ```
  state_machine:
    id: job_workflow_fsm
    states: [draft, scheduled, in_progress, completed, cancelled]
  ```

### estimated_llm_cost
- Tracks AI/LLM operation costs
- Prevents budget overruns
- Example:
  ```
  estimated_llm_cost:
    tokens_per_operation: 500
    operations_per_day: 1000
    monthly_cost_usd: 45.00
  ```

### offline_capability
- Guides PWA/mobile development
- Values: REQUIRED | OPTIONAL | NONE
- Example:
  ```
  offline_capability: REQUIRED
  ```

## Tips for Best Results

- Be specific about Supabase integration points
- Mention voice considerations explicitly
- Reference the correct tables from the schema
- Include test file requirements
- Specify any Edge Functions needed
- Call out RLS policy requirements
- Mention offline/sync needs for mobile
- Provide estimated usage for cost calculations
- Define state machines for complex workflows

## Validation After Each Domain

After completing a domain, run:
```bash
# Check that all files were created
npm run report:skeleton-status

# Validate directive blocks
npm run lint:directives

# Check dependency graph
npm run validate:deps

# Review API surface
npm run report:api-surface

# Check voice coverage
npm run report:voice-coverage
```

## Common Issues and Solutions

### "Missing mandatory field"
Ensure all v2025-08-1 fields are included:
- phase, domain, purpose, spec_ref, tasks
- offline_capability (always required)
- migrations_touched (if DB operations)
- state_machine (if stateful)
- estimated_llm_cost (if AI/LLM)

### "Dependency on later phase"
Check that internal dependencies only reference:
- Files in the same phase
- Files in earlier phases
- Never files in later phases

### "Migration file not found"
Ensure migration files listed in migrations_touched:
- Actually exist in /supabase/migrations/
- Follow naming convention: YYYYMMDD_HHMM_description.sql

### "RLS policy missing"
For any table marked (RLS ON):
- A corresponding RLS migration should exist
- The scaffolder will auto-generate a template
