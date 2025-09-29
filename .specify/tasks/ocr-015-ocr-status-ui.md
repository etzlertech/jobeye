# Task: OCR Status and Progress UI

**Slug:** `ocr-015-ocr-status-ui`
**Priority:** Medium
**Size:** 1 PR

## Description
Create OCR queue status component integrated with existing sync progress indicator.

## Files to Create
- `src/components/ocr/status/ocr-queue-status.tsx`
- `src/components/ocr/status/ocr-sync-integration.tsx`
- `src/hooks/use-ocr-status.ts`

## Files to Modify
- `src/components/sync/sync-progress-indicator.tsx` - Add OCR section
- `src/components/layout/header.tsx` - Show OCR badge

## Acceptance Criteria
- [ ] Shows pending OCR job count
- [ ] Processing spinner with current doc
- [ ] Failed items with retry option
- [ ] Success toast notifications
- [ ] Integrates with main sync UI
- [ ] Shows daily budget usage
- [ ] Warning at 80% budget
- [ ] Commit and push after implementation

## Test Files
**Create:** `src/__tests__/components/ocr/status/ocr-queue-status.test.tsx`

Test cases:
- `shows queue counts`
  - Mock 5 pending, 2 processing
  - Assert badges show counts
  - Assert correct colors
  
- `allows retry of failed`
  - Show 3 failed jobs
  - Click retry button
  - Assert retry triggered
  
- `shows budget warning`
  - Set budget used to 85%
  - Assert warning visible
  - Assert percentage shown

**Create:** `src/__tests__/hooks/use-ocr-status.test.ts`

Test cases:
- `subscribes to status updates`
- `calculates budget percentage`
- `provides retry function`

## Dependencies
- OCR job service
- Existing sync progress UI
- Cost tracking service

## UI Components
```
Header Badge:
[OCR: 5] <- Click for details

Dropdown Details:
+-------------------------+
| OCR Queue Status       |
+-------------------------+
| ⏳ Processing: 2        |
| 📄 Pending: 5          |
| ❌ Failed: 1 [Retry]   |
|                        |
| Budget: $4.25/$5.00    |
| ███████░░ 85%          |
|                        |
| View Details →         |
+-------------------------+

Sync Integration:
| Syncing...            |
| Jobs: 3/10 ███░░░     |
| Images: 5/5 █████     |
| OCR: 2/7 ██░░░░░      |
```

## Status Hook
```typescript
interface OcrStatus {
  queue: {
    pending: number;
    processing: number;
    failed: number;
    completed24h: number;
  };
  budget: {
    used: number;
    limit: number;
    percentage: number;
  };
  currentJob?: {
    id: string;
    type: string;
    fileName: string;
  };
}
```

## Rollback
- Hide OCR status
- Show in dev tools only