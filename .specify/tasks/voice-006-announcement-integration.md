# Task: Voice Announcement Integration

**Slug:** `voice-006-announcement-integration`
**Priority:** High
**Size:** 1 PR

## Description
Wire up voice announcements for verification results and sync summaries as required by acceptance criteria.

## Files to Create
- `src/domains/voice/services/announcement-service.ts`
- `src/domains/voice/templates/announcement-templates.ts`

## Files to Modify
- `src/domains/vision/services/checklist-verification-service.ts` - Add result announcements
- `src/domains/sync/services/offline-sync-service.ts` - Add sync summaries
- `src/components/sync/sync-progress-indicator.tsx` - Trigger announcements

## Acceptance Criteria
- [ ] Announces verification results after vision processing
- [ ] Announces sync completion with operation counts
- [ ] Respects user voice preferences
- [ ] Queues announcements to avoid overlap
- [ ] Works with screen readers (ARIA)
- [ ] Can be muted/configured

## Test Files
**Create:** `src/__tests__/domains/voice/services/announcement-service.test.ts`

Test cases:
- `announces verification success`
- `announces missing items`
- `summarizes sync results`
- `respects mute settings`

## Dependencies
- `voice-002-tts-service` - For speech synthesis