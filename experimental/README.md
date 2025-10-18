# Experimental Features

This folder contains incomplete or experimental features that are not yet ready for production.

## Status: Not for Production Use

These features are under development and may have:
- Incomplete implementations
- TypeScript errors
- Missing database tables
- Unfinished tests

## Vision Domain

**Status**: Experimental
**Description**: AI vision detection, cost records, YOLO inference, VLM routing
**Reason**: References non-existent database tables, incomplete implementation
**Test Status**: 150+ type errors in test files

### Vision Tests Moved Here:
- `scenarios/voice-narration.scenario.test.ts` (43 errors)
- `unit/detected-item.repository.test.ts` (41 errors)
- `unit/cost-record.repository.test.ts` (40 errors)
- `unit/batch-verification.service.test.ts` (24 errors)
- `lib/__tests__/vlm-router.test.ts` (18 errors)
- `lib/__tests__/yolo-inference.test.ts` (17 errors)

These will be properly implemented when the vision feature is fully specified and database schema is created.

## Intent Domain

**Status**: To be determined
**Description**: Intent classification, offline sync queue

## Safety Domain

**Status**: To be determined
**Description**: Safety analytics, completion tracking

---

**Note**: This folder is excluded from type-checking and production builds.
