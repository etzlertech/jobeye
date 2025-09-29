# Feature 003: Scheduling, Day Plan & Kit Assignment

## Overview

This feature enables voice-driven job scheduling, technician day plans with route optimization, and reusable kit management for standardized job execution. It provides offline-first operation with conflict resolution and integrates deeply with the voice pipeline for hands-free field operations.

## Core Objectives

1. **Voice-Driven Scheduling**: Create, update, and cancel jobs via natural language commands
2. **Day Plan Management**: Generate route-optimized daily plans with voice navigation
3. **Kit System**: Define reusable kits with equipment/materials for job standardization
4. **Offline-First**: Cache critical data locally with queue-based sync on reconnect
5. **Multi-Tenant Security**: Enforce company-level data isolation via RLS

## Clarifications

### Session 2025-01-29
- Q: When a required kit item (equipment/material) is unavailable at job start, what should happen? → A: Technician override with supervisor notification within 30 seconds
- Q: When two jobs are scheduled for overlapping times for the same technician, how should the system respond? → A: Queue second job after first completes
- Q: What is the maximum number of jobs a single technician should be scheduled for in one day? → A: 6
- Q: Which users can modify schedules while offline (before sync)? → A: Technician, supervisor, and dispatchers
- Q: How often should routes be re-optimized during the workday? → A: After each job completion (completed, cancelled, or skipped)

## Acceptance Criteria

### Database Schema

New tables required (all with company-scoped RLS):

1. **day_plans**
   - `id`: UUID primary key
   - `company_id`: UUID (RLS anchor)
   - `user_id`: UUID (technician)
   - `plan_date`: DATE
   - `status`: ENUM (draft, published, in_progress, completed)
   - `route_data`: JSONB (optimized stop sequence)
   - `total_distance_miles`: DECIMAL
   - `estimated_duration_minutes`: INTEGER
   - `actual_start_time`: TIMESTAMP
   - `actual_end_time`: TIMESTAMP
   - `voice_session_id`: UUID
   - `metadata`: JSONB
   - `created_at`, `updated_at`: TIMESTAMP

2. **schedule_events**
   - `id`: UUID primary key
   - `company_id`: UUID (RLS anchor)
   - `day_plan_id`: UUID
   - `event_type`: ENUM (job, break, travel, maintenance, meeting)
   - `job_id`: UUID (nullable, FK to jobs)
   - `sequence_order`: INTEGER
   - `scheduled_start`: TIMESTAMP
   - `scheduled_duration_minutes`: INTEGER
   - `actual_start`: TIMESTAMP
   - `actual_end`: TIMESTAMP
   - `status`: ENUM (pending, in_progress, completed, cancelled, skipped)
   - `location_data`: GEOGRAPHY(POINT)
   - `address`: JSONB
   - `notes`: TEXT
   - `voice_notes`: TEXT
   - `metadata`: JSONB
   - `created_at`, `updated_at`: TIMESTAMP

3. **crew_assignments**
   - `id`: UUID primary key
   - `company_id`: UUID (RLS anchor)
   - `schedule_event_id`: UUID
   - `user_id`: UUID (technician)
   - `role`: ENUM (lead, helper, trainee)
   - `assigned_by`: UUID
   - `assigned_at`: TIMESTAMP
   - `confirmed_at`: TIMESTAMP
   - `voice_confirmed`: BOOLEAN
   - `metadata`: JSONB

4. **kits**
   - `id`: UUID primary key
   - `company_id`: UUID (RLS anchor)
   - `kit_code`: VARCHAR(50) UNIQUE per company
   - `name`: VARCHAR(255)
   - `description`: TEXT
   - `category`: VARCHAR(100)
   - `is_active`: BOOLEAN
   - `default_container_id`: UUID
   - `voice_identifier`: VARCHAR(100)
   - `typical_job_types`: TEXT[]
   - `metadata`: JSONB
   - `created_at`, `updated_at`: TIMESTAMP

5. **kit_items**
   - `id`: UUID primary key
   - `kit_id`: UUID
   - `item_type`: ENUM (equipment, material, tool)
   - `equipment_id`: UUID (nullable)
   - `material_id`: UUID (nullable)
   - `quantity`: DECIMAL
   - `unit`: VARCHAR(50)
   - `is_required`: BOOLEAN
   - `alternate_items`: UUID[]
   - `notes`: TEXT
   - `metadata`: JSONB

6. **kit_variants**
   - `id`: UUID primary key
   - `kit_id`: UUID
   - `variant_code`: VARCHAR(50)
   - `variant_type`: ENUM (seasonal, weather, customer_type)
   - `conditions`: JSONB
   - `item_modifications`: JSONB
   - `is_active`: BOOLEAN
   - `valid_from`: DATE
   - `valid_until`: DATE
   - `metadata`: JSONB

7. **job_kits**
   - `id`: UUID primary key
   - `company_id`: UUID (RLS anchor)
   - `job_id`: UUID
   - `kit_id`: UUID
   - `variant_id`: UUID (nullable)
   - `assigned_at`: TIMESTAMP
   - `assigned_by`: UUID
   - `verified_at`: TIMESTAMP
   - `verified_by`: UUID
   - `verification_method`: ENUM (manual, photo, future_vision) -- placeholder for feature 004
   - `modifications`: JSONB
   - `metadata`: JSONB

8. **kit_override_log**
   - `id`: UUID primary key
   - `company_id`: UUID (RLS anchor)
   - `job_id`: UUID
   - `kit_id`: UUID
   - `item_id`: UUID
   - `technician_id`: UUID
   - `override_reason`: TEXT
   - `supervisor_notified_at`: TIMESTAMP
   - `notification_method`: ENUM (sms, push, call)
   - `notification_status`: VARCHAR(50)
   - `supervisor_response`: TEXT
   - `created_at`: TIMESTAMP

### Service Requirements

**Note on service split:** The Scheduling and DayPlan services are temporarily split to respect the 300-LoC budget and isolate responsibilities uncovered during analysis (conflict detection, notification orchestration, validation). Services will be consolidated when:
1. Combined LoC remains under 300 (or justified exception under 500)
2. Clear abstraction boundaries are established
3. Test coverage exceeds 90% for affected code
If implementation converges below budget, we will consolidate per Constitution §2.

#### SchedulingService
- Create/update/cancel schedule events
- Assign default kits based on job type
- Support bulk operations for crew assignment
- Voice command processing with confirmation flows
- Integration with existing JobService
- Conflict detection and automatic queuing
- Queue overlapping jobs sequentially with updated times
- Notify affected customers of schedule adjustments

#### DayPlanService
- Generate route-optimized daily plans
- Handle dependencies (e.g., equipment pickup before job)
- Support "What's next?" voice queries
- Real-time plan updates with notifications
- Travel time estimation via mapping APIs
- Break scheduling based on labor rules
- Enforce maximum of 6 jobs per technician per day
- Alert supervisors when approaching daily job limit
- Re-optimize routes after each job completion
- Update ETAs for remaining jobs automatically

#### Break Scheduling Rules

Labor law compliance rules:
- **Mandatory Breaks**:
  - 15-minute paid break every 4 hours worked
  - 30-minute unpaid meal break for shifts >6 hours
  - Meal break must start before 5th hour of work
  
- **Auto-Scheduling**:
  - System automatically inserts breaks into day plans
  - Breaks cannot be skipped without supervisor override
  - Warning issued if technician works >4 hours without break
  
- **Configurable per Company**:
  - Companies can set stricter break requirements
  - State-specific rules supported via company_settings
  - Default to federal minimums if not configured

#### KitService
- CRUD operations on kit definitions
- Kit-to-job assignment logic
- Seasonal variant selection
- Container assignment tracking
- Usage analytics and optimization
- Integration with inventory management
- Technician override flow for missing items with reason capture
- Immediate supervisor notification via SMS/push/call (Twilio integration)
- Track missing item incidents with reasons for analytics
- Generate override alerts: "Tech [A] chose to leave without [item B] for job [C]"

### Voice Integration

New voice commands to support:
- "Schedule a small yard service for tomorrow at 2PM"
- "What's my next job?"
- "Assign John to the Smith property job"
- "Switch to winter kit variant"
- "Reschedule current job to next Tuesday"
- "Show me today's route"
- "Mark kit loaded and verified"
- "Override missing item [X]" → "Why can't you load this item?"
- "No [equipment name] available"
- "Item is broken/damaged/missing"

Intent recognition patterns:
- `schedule_job`: Extract date/time, job type, customer
- `query_schedule`: Next task, day overview, specific time
- `modify_schedule`: Reschedule, cancel, reassign
- `kit_management`: Load, verify, switch variants
- `crew_operations`: Assign, remove, query availability
- `kit_override`: Capture missing item, reason, trigger notification

### Offline Capability

#### Offline Sync Scope
MVP uses custom IndexedDB + sync queue. **PowerSync is deferred to Phase 2.**  
**Phase 2 Timeline**: Q2 2025 - after MVP validation and performance benchmarking.
All PowerSync mentions are tagged "Phase 2 Enhancement" and excluded from 003 validation.

Required offline features:
1. **Cached Data**
   - Current and next day's plans
   - Kit definitions and assignments
   - Crew member profiles
   - Customer/property basics

2. **Queued Operations**
   - Schedule modifications
   - Kit assignments
   - Time tracking events
   - Voice notes and commands

3. **Conflict Resolution**
   - Timestamp-based precedence
   - Manual resolution UI for conflicts
   - Audit trail of all changes
   - Supervisor override capability
   - Role-based modification rights (technician, supervisor, dispatcher)
   - Preserve all offline changes for conflict resolution

### Conflict Resolution Strategy

When multiple users modify the same data offline:

1. **Primary Resolution**: Role-based priority hierarchy
   - Dispatcher modifications always win
   - Supervisor modifications override technician changes
   - Technician modifications have lowest priority

2. **Secondary Resolution**: Timestamp-based (within same role)
   - Later timestamp wins when same role level
   - All conflicts logged for review

3. **Field-Level Resolution**: 
   - Assignment changes: Dispatcher > Supervisor > Technician
   - Status updates: Technician > Others (they're in the field)
   - Notes/observations: Merge all (append with attribution)

Example:
- Technician marks job complete at 2:00 PM
- Supervisor reschedules same job at 2:15 PM (offline)
- Resolution: Supervisor wins (role priority), job remains scheduled
- Audit log: "Conflict resolved: Supervisor override of technician completion"

### Offline Data Security

1. **Encryption Requirements**:
   - All offline data encrypted using AES-256-GCM
   - Encryption key derived from user credentials + device ID
   - Key rotation every 30 days or on security events
   
2. **Sensitive Data Classification**:
   - HIGH: Customer PII (names, SSN), addresses (street/unit), phone numbers, payment info
   - MEDIUM: Job details (service type, pricing), schedules (arrival times), notes (access codes)
   - LOW: Kit definitions (tool lists), public configuration (labor rules), company settings
   
3. **Implementation**:
   ```typescript
   // Encrypt before storing in IndexedDB
   const encrypted = await crypto.subtle.encrypt(
     { name: 'AES-GCM', iv },
     key,
     encoder.encode(JSON.stringify(data))
   );
   ```
   
4. **Compliance**:
   - GDPR-compliant data handling
   - Right to deletion includes offline caches
   - Audit log of offline data access

### Cache Management Strategy (100MB Limit)

1. **Storage Monitoring**:
   ```typescript
   interface StorageStatus {
     used: number;      // Current usage in bytes
     limit: 104857600; // 100MB in bytes
     percentage: number;
   }
   ```

2. **Tiered Eviction Policy** (when >90% full):
   - Tier 1 (Delete first): Completed jobs >7 days old
   - Tier 2: Historical route data >3 days old
   - Tier 3: Non-active kit definitions
   - Tier 4: Customer data not accessed in 14 days
   - Protected: Today's schedule, active jobs, user profile

3. **User Warnings**:
   - 80% full: "Storage getting full" warning
   - 90% full: "Some data will be removed" + list
   - 95% full: "Critical - sync now or lose data"
   
4. **Graceful Degradation**:
   - Disable photo caching at 85%
   - Disable predictive caching at 90%
   - Essential operations only at 95%

### UI/UX Requirements

1. **Scheduling Wizard**
   - Voice-first with typing fallback
   - Smart defaults from templates
   - Kit auto-suggestion
   - Crew availability display

2. **Day Plan View**
   - Map with route visualization
   - Timeline with drag-and-drop
   - Quick camera for checklist photos
   - Voice navigation controls

3. **Kit Management**
   - Visual kit builder
   - Seasonal variant editor
   - Usage analytics dashboard
   - Container assignment UI

### Integration Points

1. **JobService**
   - Create jobs from schedule events
   - Update job status from day plan
   - Sync completion data

2. **ContainerService**
   - Track kit container locations
   - Manual photo verification (vision AI deferred to feature 004)
   - Update inventory levels

3. **MultiObjectVisionService**
   - **Note:** Vision-based verification is **out of scope for 003-scheduling-kits** and will be implemented under feature **004-vision-verification**. Current implementation uses manual photo capture only.

4. **CompanySettingsService**
   - Budget thresholds for scheduling
   - Labor rule configurations
   - Default kit assignments

5. **AuditService**
   - Log all schedule changes
   - Track kit usage patterns
   - Voice command history
   - Record kit override incidents

6. **NotificationService (Twilio)**
   - SMS alerts for kit overrides
   - Push notifications to supervisor apps
   - Voice calls for critical overrides
   - Delivery confirmation tracking

#### Notification Delivery Requirements

1. **Notification SLA**:
   - "Immediate" delivery target: **<30 seconds** from event to provider acceptance
   - Retries: exponential backoff 1s/2s/4s (max 3)
   - Fallback chain: Push → SMS (30s) → Voice (urgent & SMS fails by +2m) → Email
   - Delivery tracked via webhook receipts

2. **Retry Policy**:
   - Maximum 3 retry attempts
   - Exponential backoff: 1s, 2s, 4s
   - Dead letter queue after final failure
   
3. **Delivery Confirmation**:
   - SMS: Await Twilio delivery webhook
   - Push: Check delivery receipt
   - Voice: Confirm call answered
   
4. **Rate Limiting**:
   - Max 10 notifications per minute per user
   - Batch similar notifications within 1-minute window
   - Cost cap: $50/day automatic cutoff

### Testing Requirements

1. **Unit Tests** (90% coverage)
   - Service method validation
   - Voice command parsing
   - Offline queue operations
   - Conflict resolution logic

2. **Integration Tests**
   - RLS policy enforcement
   - Cross-service workflows
   - Sync/conflict scenarios
   - Kit assignment chains

3. **E2E Tests**
   - Complete scheduling flow
   - Day plan navigation
   - Offline-to-online sync
   - Voice command sequences

4. **Performance Targets**
   - Day plan load: <500ms
   - Voice-to-schedule: <2s
   - Route optimization: <3s for 50 stops
   - Offline cache: <100MB per technician user

### Security & Compliance

1. **RLS Policies**
   - Company-level isolation on all tables
   - User-specific access for day_plans
   - Read-only access for crew members
   - Admin bypass for support

2. **Audit Requirements**
   - All schedule modifications logged
   - Voice command transcripts stored
   - Kit assignment history tracked
   - Conflict resolution decisions recorded

3. **Data Retention**
   - Active schedules: Indefinite
   - Completed plans: 2 years
   - Voice transcripts: 90 days
   - Audit logs: 7 years

### Migration Strategy

1. **Reconciler Pattern**
   - Check actual DB state before migrations
   - Idempotent table/index creation
   - Preserve existing data relationships
   - Rollback procedures for each step

2. **Data Seeding**
   - Default kit templates
   - Common job-to-kit mappings
   - Sample seasonal variants
   - Test data for development

### Success Metrics

1. **Adoption**
   - Baseline: Measure current % of jobs scheduled via voice in first week
   - Target: 80% of jobs scheduled via voice within 3 months (from baseline)
   - 90% kit attachment rate for applicable jobs (jobs with kit_required=true)
   - <5% manual schedule overrides after initial scheduling

2. **Efficiency**
   - 20% reduction in scheduling time (measure: avg time from request to confirmed schedule)
   - 15% improvement in route efficiency (measure: total miles driven / jobs completed)
   - 30% decrease in missing equipment issues (measure: kit override incidents / total jobs)

3. **Quality**
   - <1% scheduling conflicts
   - 95% kit verification accuracy
   - 99.9% offline sync reliability

### Non-Negotiables

1. **ALWAYS** run `npm run check:db-actual` before any migration work
2. **NEVER** assume database state from migration files
3. **PUSH** immediately after every commit
4. **TEST** RLS policies with multi-tenant scenarios
5. **VALIDATE** voice commands with real field data
6. **MAINTAIN** offline-first architecture principles
7. **ENFORCE** complexity budgets (300 LoC default, 500 max)

### Implementation Timeline

- Week 1-2: Database schema and migrations
- Week 3-4: Core services (Scheduling, DayPlan, Kit)
- Week 5-6: Voice integration and commands
- Week 7-8: Offline capability and sync
- Week 9-10: UI components and testing

### Dependencies

- Phase 1: Core infrastructure (complete)
- Phase 2: Customer/Property models (complete)
- Phase 3: Voice pipeline (required for voice commands)
- Existing: JobService, ContainerService, AuditService

### Risk Mitigation

1. **Route Optimization Complexity**
   - Start with simple distance-based routing
   - Add traffic/time considerations later
   - Partner with mapping API provider

### Route Optimization Algorithms

1. **Online Optimization** (via Mapbox):
   - Uses Optimization API v2.0.0 for <30 stops
   - Considers real-time traffic and road conditions
   - Optimizes for balanced time/distance

2. **Offline Fallback Algorithm**:
   - **Nearest Neighbor Heuristic**:
     ```
     1. Start at depot/first job
     2. Find nearest unvisited job
     3. Add to route
     4. Repeat until all jobs visited
     ```
   - **2-opt Local Improvement**:
     ```
     1. Take initial route from Nearest Neighbor
     2. Try swapping pairs of edges
     3. Keep swaps that reduce total distance
     4. Stop when no improvements found
     ```
   - Expected performance: O(n²) time, <2s for 50 stops

3. **Constraints Respected**:
   - Time windows (hard constraint)
   - Maximum 6 jobs per technician
   - Mandatory breaks inserted after routing

#### Re-optimization Triggers
Re-compute route when:
1. Technician sets status to **completed** or **cancelled**
2. **Hard ETA breach** detected (current time > scheduled_start + 10 minutes AND status still 'pending')
3. **Supervisor override** changes ordering or assignments

Ignored events: note edits, photo uploads, non-status comments

2. **Offline Conflict Resolution**
   - Clear precedence rules
   - Supervisor override capability
   - Comprehensive audit trail

3. **Voice Command Ambiguity**
   - Confirmation flows for critical actions
   - Context-aware command interpretation
   - Fallback to manual entry

### Future Enhancements

1. AI-powered schedule optimization
2. Predictive kit recommendations
3. Real-time traffic integration
4. Multi-day job scheduling
5. Resource capacity planning
6. Customer preference learning

### Task Mapping (Additions)
- Cache Management Strategy → T065, T066, T067
- Notification Delivery Confirmation → T068, T069
- Rate Limiting & Cost Cap → T070, T071
- "Immediate" Notification SLA & Triggers → T070, T071 (tests)
- Cost Monitoring → T072, T073
- Data Retention & Cleanup → T074, T075, T076
- Performance Benchmarks → T050, T051, T052
- Container Integration → T032a
- Notification Service → T033h
- Directive Blocks → T008a
- Directive Block Validation → T008b
- Labor Rules UI → T046a
- GDPR Compliance → T077
- Conflict Resolution UI → T078
- Webhook Configuration → T042a
- 6-Job Limit Enforcement → T022a
- Break Warning Test → T022b
- PowerSync Phase 2 Deferral → (no current tasks; tracked in Phase 2)
- Vision Verification → (deferred to feature 004-vision-verification)