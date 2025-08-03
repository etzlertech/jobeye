# Skeleton Generation Guide for Voice-First FSM v3.2.1

## Directive Block Contract v2025-08-1 (AAC-Header)

Every file in this project must begin with a standardized Agent Directive Block:

```typescript
// --- AGENT DIRECTIVE BLOCK ---
// file: /src/[...]/foo-service.ts
// phase: 1                      # 1–5; must match blueprint
// domain: authentication        # high-level bounded-context
// version: 1.0.0
// purpose: Handles login, logout and token refresh via Supabase Auth.
// spec_ref: .claude/spec/v4.0/auth-flow.md#token-lifecycle
// complexity_budget: 300 LoC
//
// migrations_touched:
//   - 006_auth_tables.sql
//   - 007_auth_rls_policies.sql
//
// state_machine:
//   id: auth_session_fsm
//   states: [unauthenticated, pending, authenticated, expired]
//
// estimated_llm_cost:
//   tokens_per_operation: 150
//   operations_per_day: 5_000
//   monthly_cost_usd: 25.00
//
// dependencies:
//   internal:
//     - /src/data/user-repository.ts#getUserByEmail
//     - /src/lib/logger.ts#logError
//   external:
//     - npm: 'jwt-decode'
//   supabase:
//     - table: users              (RLS ON)
//     - function: increment_rate_limit
//
// exports:
//   - function login(email: string, password: string):
//       Promise<{ user: User; accessToken: string }>
//
// voice_considerations: >
//   Intent: "log me in"; require spoken 2FA code if policy enabled.
//
// offline_capability: NONE      # REQUIRED | OPTIONAL | NONE
//
// test_requirements:
//   coverage: 0.9
//   test_file: /src/domains/auth/__tests__/login.test.ts
//
// tasks:
//   1. [SETUP] Import Supabase client & env keys.
//   2. [DATA] Fetch user by email; verify password hash.
//   3. [TOKEN] Create JWT w/ company_id claim; set refresh expiry.
//   4. [VOICE] Emit 'session_started' TTS confirmation.
//   5. [ERROR] Log & propagate auth-error codes.
//
// --- END DIRECTIVE BLOCK ---
```

## New Fields in v2025-08-1

| Field | Purpose | Required |
|-------|---------|----------|
| `migrations_touched` | Track DB dependencies for change-impact analysis | When DB operations exist |
| `state_machine` | Define workflow states for FSM code generation | For stateful workflows |
| `estimated_llm_cost` | Prevent cost overruns with upfront estimates | For LLM-touching code |
| `offline_capability` | Guide PWA/mobile sync requirements | Always |

## Workflow Rules

1. **Maximum 5 files per emission** - Claude must limit responses to 5 directive blocks
2. **No functional code in skeleton phase** - Only directive blocks, no implementation
3. **All paths must be absolute from repo root** - Start with /
4. **Voice considerations mandatory** for all user-facing features
5. **Spec references must be valid** - Point to actual files in .claude/spec/
6. **Phase dependencies enforced** - Can only reference equal or earlier phases
7. **Migration files must exist** when referenced in migrations_touched
8. **Cost estimates required** for any LLM/AI operations

## Phase-Domain Mapping

### Phase 1: Core Infrastructure (15 tables, ~125 files)
- **Authentication**: users, auth_tokens, password_reset_requests
- **Core Infrastructure**: logger, config, database connections
- **Multi-tenant**: companies, company_users, tenant isolation

### Phase 2: Domain Models (25 tables, ~240 files)
- **Customer Management**: customers, contacts, addresses
- **Property Management**: properties, service_locations
- **Equipment Tracking**: equipment_types, equipment_items, maintenance_logs
- **Materials Catalog**: material_catalog, inventory, pricing

### Phase 3: Voice Pipeline (12 tables, ~185 files)
- **Voice Core**: conversation_sessions, messages, transcripts
- **Intent Recognition**: intent_registry, intent_slots, executions
- **STT/TTS Integration**: voice_configs, user_voice_profiles
- **Offline Support**: voice_command_cache, sync_queue

### Phase 4: Job Execution & Verification (18 tables, ~280 files)
- **Job Templates**: job_templates, template_tasks, template_materials
- **Job Execution**: jobs, job_tasks, job_materials, job_photos
- **AI Verification**: verification_checklists, verification_items, ai_vision_logs
- **Irrigation**: irrigation_systems, zones, valves, controllers

### Phase 5: UI Integration (15 tables, ~180 files)
- **Shared Components**: design system, voice button, chat interface
- **Web App**: Next.js pages, admin portal
- **Mobile App**: React Native screens, offline sync
- **Customer Portal**: self-service views, payment integration

## Master Prompt Template with v2025-08-1 Addendum

When initiating skeleton generation with Claude, use this exact prompt:

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
- Use the AAC-Header contract with ALL fields
- Include migrations_touched, state_machine (if stateful), estimated_llm_cost (if AI/LLM)
- Mark offline_capability as REQUIRED, OPTIONAL, or NONE
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

## Token Budget Guidelines

| Chunk Type | Max Items | Typical Token Cost |
|------------|-----------|-------------------|
| File-list proposal | 20 paths | < 300 tokens |
| Directive block emission | 5 files/message | 2k-3k tokens |
| Domain completion | 50-80 files | 15k-20k tokens |

## Quality Checklist

Before accepting any skeleton emission, verify:

- [ ] All paths start with / (absolute from repo root)
- [ ] Phase number is correct (1-5)
- [ ] Domain matches current focus area
- [ ] spec_ref points to valid file
- [ ] complexity_budget ≤ 300 LoC
- [ ] voice_considerations present for user-facing features
- [ ] offline_capability specified (REQUIRED/OPTIONAL/NONE)
- [ ] migrations_touched files exist in /supabase/migrations/
- [ ] state_machine has valid states if present
- [ ] estimated_llm_cost included for AI operations
- [ ] test_file path follows naming convention
- [ ] Supabase dependencies explicitly listed with RLS notation
- [ ] Tasks are specific and actionable
- [ ] No circular dependencies in internal refs
- [ ] Internal dependencies only reference same or earlier phases

## Common Patterns by Phase

### Phase 1 Patterns
- Every service needs error handling exports
- All database operations must use transactions
- Multi-tenant isolation via RLS policies
- Audit logging for all mutations
- Migration files numbered sequentially

### Phase 2 Patterns
- Repository pattern for all entities
- Soft deletes (is_active flag)
- UUID primary keys
- Company-scoped queries
- Voice metadata companion tables

### Phase 3 Patterns
- Cost tracking on every LLM call (estimated_llm_cost mandatory)
- Offline queue for voice commands (offline_capability: REQUIRED)
- User consent before voice recording
- Fallback chains (Google → Web → Push-to-talk)
- State machines for conversation flow

### Phase 4 Patterns
- Complex state machines for workflows
- Photo compression before storage
- GPS validation for job sites
- Time tracking with clock in/out
- AI vision cost estimates

### Phase 5 Patterns
- Progressive web app structure
- Service worker for offline (offline_capability: REQUIRED)
- Responsive voice UI
- Platform-specific adaptations
- Component state machines for complex interactions

## RLS Policy Templates

For any table marked with (RLS ON), expect corresponding migration:

```sql
-- Template pattern for RLS policies
alter table public.[table_name] enable row level security;

create policy "company_isolation_[table_name]"
  on public.[table_name]
  for all
  using (company_id = auth.jwt() ->> 'company_id');

create policy "user_read_own_[table_name]"
  on public.[table_name]
  for select
  using (user_id = auth.uid());
```

## Validation Commands

After each domain skeleton generation:

```bash
npm run scaffold:inject < domain-output.txt
npm run lint:directives
npm run validate:deps
npm run report:skeleton-status
```
