<!--
AGENT DIRECTIVE BLOCK
file: /TODO.md
purpose: Auto-generated checklist for Scheduling Kits feature tasks.
origin: .specify/features/003-scheduling-kits/tasks.md
update_policy: Regenerate via TodoWrite utility before planning work.
-->

# Scheduling Kits Task Checklist

Total: 84
Completed: 0
Pending: 84

- [ ] T001 Create scheduling module directory structure at src/scheduling/
- [ ] T002 Install dependencies: npm install @supabase/supabase-js @tanstack/react-query twilio mapbox-sdk dexie workbox-core
- [ ] T003 [P] Configure PostGIS extension in Supabase dashboard
- [ ] T004 [P] Set up environment variables for Mapbox and Twilio in .env.local (PowerSync deferred to Phase 2)
- [ ] T005 Create database migration at supabase/migrations/035_scheduling_kits_schema.sql with all 8 tables
- [ ] T006 Add RLS policies for all scheduling tables in supabase/migrations/036_scheduling_rls_policies.sql
- [ ] T007 Create notification trigger for kit_override_log in supabase/migrations/037_kit_override_trigger.sql
- [ ] T008 Generate TypeScript types from new schema: npm run generate:types
- [ ] T008a Create Directive Blocks for all new TypeScript/JavaScript files per Constitution §1
- [ ] T008b Validate all Directive Blocks pass Constitution requirements: npm run lint:directives
- [ ] T009 [P] Contract test POST /api/scheduling/day-plans in src/__tests__/scheduling/contract/day-plans-post.test.ts
- [ ] T010 [P] Contract test GET /api/scheduling/day-plans in src/__tests__/scheduling/contract/day-plans-get.test.ts
- [ ] T011 [P] Contract test POST /api/scheduling/schedule-events in src/__tests__/scheduling/contract/schedule-events-post.test.ts
- [ ] T012 [P] Contract test PATCH /api/scheduling/day-plans/{id}/optimize in src/__tests__/scheduling/contract/optimize-route.test.ts
- [ ] T013 [P] Contract test POST /api/kits in src/__tests__/scheduling/contract/kits-post.test.ts
- [ ] T014 [P] Contract test POST /api/jobs/{jobId}/kits/{kitId}/verify in src/__tests__/scheduling/contract/kit-verify.test.ts
- [ ] T015 [P] Contract test POST /api/kit-overrides in src/__tests__/scheduling/contract/kit-override.test.ts
- [ ] T016 [P] Integration test: Create and optimize day plan in src/__tests__/scheduling/integration/day-plan-flow.test.ts
- [ ] T017 [P] Integration test: Voice-driven scheduling in src/__tests__/scheduling/integration/voice-scheduling.test.ts
- [ ] T018 [P] Integration test: Kit loading and verification in src/__tests__/scheduling/integration/kit-loading.test.ts
- [ ] T019 [P] Integration test: Missing kit item override flow in src/__tests__/scheduling/integration/kit-override-flow.test.ts
- [ ] T020 [P] Integration test: Offline sync with conflicts in src/__tests__/scheduling/integration/offline-sync.test.ts
- [ ] T021 [P] RLS test: Multi-tenant data isolation in src/__tests__/scheduling/rls/tenant-isolation.test.ts
- [ ] T022a Integration test: Enforce 6-job maximum per technician in src/__tests__/scheduling/integration/job-limit-enforcement.test.ts
- [ ] T022b Integration test: Break warning after 4 hours in src/__tests__/scheduling/integration/break-warning.test.ts
- [ ] T022 [P] DayPlan repository with CRUD operations in src/scheduling/repositories/day-plan.repository.ts
- [ ] T023 [P] ScheduleEvent repository in src/scheduling/repositories/schedule-event.repository.ts
- [ ] T024 [P] CrewAssignment repository in src/scheduling/repositories/crew-assignment.repository.ts
- [ ] T025 [P] Kit repository in src/scheduling/repositories/kit.repository.ts
- [ ] T026 [P] KitItem repository in src/scheduling/repositories/kit-item.repository.ts
- [ ] T027 [P] KitVariant repository in src/scheduling/repositories/kit-variant.repository.ts
- [ ] T028 [P] JobKit repository in src/scheduling/repositories/job-kit.repository.ts
- [ ] T029 [P] KitOverrideLog repository in src/scheduling/repositories/kit-override-log.repository.ts
- [ ] T030 SchedulingService with event management in src/scheduling/services/scheduling.service.ts
- [ ] T030a ScheduleConflictService for conflict detection in src/scheduling/services/schedule-conflict.service.ts
- [ ] T030b ScheduleNotificationService for notifications in src/scheduling/services/schedule-notification.service.ts
- [ ] T031 DayPlanService with route optimization in src/scheduling/services/day-plan.service.ts
- [ ] T031c DayPlanValidationService for business rules in src/scheduling/services/day-plan-validation.service.ts
- [ ] T031a Break scheduling logic with labor rules in src/scheduling/services/break-scheduler.service.ts
- [ ] T031b Labor rule configuration in src/scheduling/config/labor-rules.ts
- [ ] T032 KitService with override handling and seasonal variant selection in src/scheduling/services/kit.service.ts
- [ ] T032a Container tracking integration in src/scheduling/services/container-integration.service.ts
- [ ] T033 RouteOptimizationService with Mapbox integration in src/scheduling/services/route-optimization.service.ts
- [ ] T033h NotificationService with Twilio SMS/push/voice in src/scheduling/services/notification.service.ts
- [ ] T033e TravelTimeService with mapping API integration in src/scheduling/services/travel-time.service.ts
- [ ] T033f Distance matrix caching in src/scheduling/cache/distance-matrix.cache.ts
- [ ] T033g Travel time estimation for offline mode in src/scheduling/services/offline-travel.service.ts
- [ ] T034 [P] Scheduling intent patterns in src/scheduling/voice/scheduling-intents.ts
- [ ] T035 [P] Kit management voice commands in src/scheduling/voice/kit-management-intents.ts
- [ ] T036 [P] Day plan voice queries in src/scheduling/voice/day-plan-queries.ts
- [ ] T037 [P] IndexedDB schema for offline caching in src/scheduling/offline/scheduling-cache.ts
- [ ] T037a Offline data encryption service in src/scheduling/offline/encryption.service.ts
- [ ] T037b Encryption key management in src/scheduling/offline/key-manager.ts
- [ ] T038 [P] Conflict resolver with role-based priorities in src/scheduling/offline/conflict-resolver.ts
- [ ] T039 [P] Sync queue implementation in src/scheduling/offline/sync-queue.ts
- [ ] T040 [P] Service worker registration in public/sw-scheduling.js
- [ ] T041 Kit override notification function in supabase/functions/notify-kit-override/index.ts
- [ ] T042 Twilio webhook handler in supabase/functions/twilio-webhook/index.ts
- [ ] T042a Configure Twilio webhooks for delivery receipts in supabase/functions/configure-webhooks/index.ts
- [ ] T043 [P] Scheduling wizard component in src/components/scheduling/SchedulingWizard.tsx
- [ ] T044 [P] Day plan view with map in src/components/scheduling/DayPlanView.tsx
- [ ] T045 [P] Kit management interface in src/components/scheduling/KitManagement.tsx
- [ ] T046 [P] Voice scheduling UI in src/components/voice/VoiceSchedulingUI.tsx
- [ ] T046a Labor rules configuration UI in src/components/scheduling/LaborRulesConfig.tsx
- [ ] T078 Conflict resolution UI component in src/components/scheduling/ConflictResolver.tsx
- [ ] T047 [P] Unit tests for all repositories (90% coverage) in src/__tests__/scheduling/unit/
- [ ] T048 Performance optimization: Day plan load <500ms
- [ ] T049 E2E test: Complete scheduling workflow in src/__tests__/e2e/scheduling-flows.test.ts
- [ ] T050 Performance benchmark: Day plan load <500ms in src/__tests__/scheduling/performance/day-plan-load.bench.ts
- [ ] T051 Performance benchmark: Voice-to-schedule <2s in src/__tests__/scheduling/performance/voice-schedule.bench.ts
- [ ] T052 Performance benchmark: Route optimization <3s for 50 stops in src/__tests__/scheduling/performance/route-optimize.bench.ts
- [ ] T065 [P] Storage monitor for offline cache (size/percent) in src/scheduling/offline/storage-monitor.ts
- [ ] T066 [P] Tiered eviction worker (7d completed jobs → 3d routes → inactive kits → stale customer data) in src/scheduling/offline/eviction-worker.ts
- [ ] T067 [P] Cache monitoring & eviction tests in src/scheduling/offline/__tests__/eviction-worker.test.ts
- [ ] T068 Twilio delivery receipt correlator (updates message status → audit) in supabase/functions/twilio-webhook/delivery-receipts.ts
- [ ] T069 Notification delivery repository + audit logging in src/scheduling/repositories/notification-delivery.repository.ts
- [ ] T070 Per-user/per-tenant rate limiter (10/min) + daily cost cap $50 in src/scheduling/services/notification-rate-limiter.service.ts
- [ ] T071 Rate limiter & receipt E2E test (simulate push→sms fallback) in src/__tests__/e2e/notifications/notification-fallback.e2e.ts
- [ ] T072 [P] Cost monitoring service for $50/day cap in src/scheduling/services/cost-monitor.service.ts
- [ ] T073 [P] Cost monitoring tests in src/__tests__/scheduling/unit/cost-monitor.test.ts
- [ ] T074 Data retention service for 2-year/90-day/7-year policies in src/scheduling/services/data-retention.service.ts
- [ ] T075 Scheduled cleanup job in supabase/functions/data-cleanup/index.ts
- [ ] T076 Data retention tests in src/__tests__/scheduling/integration/data-retention.test.ts
- [ ] T077 GDPR compliance validation checklist in src/scheduling/compliance/gdpr-checklist.ts

## Next Up
- T001 Create scheduling module directory structure at src/scheduling/
- T002 Install dependencies: npm install @supabase/supabase-js @tanstack/react-query twilio mapbox-sdk dexie workbox-core
- T003 [P] Configure PostGIS extension in Supabase dashboard
- T004 [P] Set up environment variables for Mapbox and Twilio in .env.local (PowerSync deferred to Phase 2)
- T005 Create database migration at supabase/migrations/035_scheduling_kits_schema.sql with all 8 tables
