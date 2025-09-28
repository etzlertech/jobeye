# Multi-Object MVP Decision Record (2025-09-28)

## Context
- Merged `feat/voice-vision-pipeline` into `main`, adding container management, multi-object vision services, and migration `005_v4_multi_object_vision_extension.sql`.
- TypeScript strict checks currently fail due to legacy modules (auth onboarding, error-handler, Supabase repo layer, voice logging) expecting earlier contracts.
- Goal is to ship a functional mobile capture + load list auto-check workflow quickly to validate the field experience.

## Decision
Proceed with MVP implementation despite existing TypeScript violations. Focus on delivering the mobile photo capture flow (1 FPS stream -> multi-object detection -> load-list auto check) for real-world testing. Defer TypeScript contract alignment until after MVP validation.

## Rationale
- Shipping the workflow enables feedback on usability, detection accuracy, and container UX before investing in deeper refactors.
- Legacy modules still function; issues are limited to typing/contract drift rather than broken runtime behaviour.
- Multi-object vision, container schema, and load verification logic are in place and ready for integration with the mobile app.

## Follow-Up Plan
1. Deliver MVP experience (mobile capture, automatic load checklist updates, manual overrides) and capture usage data.
2. Document testing outcomes and required UX/accuracy adjustments.
3. Schedule a cleanup sprint to:
   - Update auth onboarding + login flows to new Supabase types.
   - Replace `ErrorBus` usage with typed `DomainEvent` interface.
   - Align Supabase repositories with `supabase.ts` schema + regenerate types.
   - Restore strict TypeScript checks and CI enforcement.

## Risks & Mitigations
- **Risk:** Type drift grows while MVP is in flight. **Mitigation:** Track cleanup tasks as backlog issues and time-box the follow-up sprint immediately after MVP sign-off.
- **Risk:** Runtime regressions hide behind skipped types. **Mitigation:** Keep integration tests for multi-object workflows, and manually verify critical auth flows during MVP testing.
- **Risk:** Mobile capture timeline slips without clear owners. **Mitigation:** Assign dedicated engineer(s) for mobile pipeline + load-check integration and review progress in weekly sync.

## Next Steps
- Wire mobile client to capture 1 FPS frames and submit to `multi-object-vision-service`.
- Implement checklist auto-update endpoint/UI to surface detection results.
- Prepare field test plan and logging to measure detection accuracy vs. manual load verification.
