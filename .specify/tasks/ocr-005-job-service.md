# Task: OCR Job Service Implementation

**Slug:** `ocr-005-job-service`
**Priority:** High
**Size:** 1 PR

## Description
Create OCR job service for queue management, status tracking, and retry logic with offline support.

## Files to Create
- `src/domains/ocr/services/ocr-job-service.ts`
- `src/domains/ocr/repositories/ocr-job.repository.ts`
- `src/domains/ocr/types/job-status.types.ts`

## Files to Modify
- None (new service)

## Acceptance Criteria
- [ ] Creates jobs with queued status
- [ ] Implements status transitions with validation
- [ ] Adds retry with exponential backoff (1s, 5s, 15s)
- [ ] Cancels stale jobs after 24h
- [ ] Integrates with cost tracking service
- [ ] Supports offline queuing via base repository
- [ ] Provides queue status for UI
- [ ] Commit and push after implementation

## Test Files
**Create:** `src/__tests__/domains/ocr/services/ocr-job-service.test.ts`

Test cases:
- `creates job with initial status`
  - Create job
  - Assert status = 'queued'
  - Assert media_asset_id set
  
- `transitions status correctly`
  - Create queued job
  - Start processing
  - Assert status = 'processing'
  - Assert started_at set
  
- `implements retry backoff`
  - Fail job 3 times
  - Assert retry delays: 1s, 5s, 15s
  - Assert gives up after max
  
- `cancels stale jobs`
  - Create job 25h ago
  - Run cleanup
  - Assert status = 'cancelled'

**Create:** `src/__tests__/domains/ocr/repositories/ocr-job.repository.test.ts`

Test cases:
- `enforces company scope`
- `queues operations offline`
- `finds jobs by status`

## Dependencies
- `ocr-002-ocr-tables-migration` - Tables must exist
- Cost tracking service

## Service Interface
```typescript
interface OcrJobService {
  createJob(params: CreateJobParams): Promise<OcrJob>;
  processJob(jobId: string): Promise<void>;
  retryFailed(): Promise<number>;
  cancelStale(): Promise<number>;
  getQueueStatus(): Promise<QueueStatus>;
}

interface CreateJobParams {
  mediaAssetId: string;
  jobType: 'receipt' | 'invoice' | 'handwritten';
  metadata?: Record<string, any>;
}

interface QueueStatus {
  queued: number;
  processing: number;
  failed: number;
  completed24h: number;
}
```

## Rollback
- Jobs can be cancelled via status update
- Feature flag disables processing