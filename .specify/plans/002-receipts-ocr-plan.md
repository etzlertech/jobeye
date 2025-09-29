# Technical Implementation Plan: 002-receipts-ocr

## Overview
This plan details the implementation of receipt, invoice, and handwritten note OCR processing with offline-first architecture, following all constitutional requirements and Non-Negotiables.

## 1. Data & Migrations

### 1.1 Pre-Migration Requirements
**MANDATORY**: Before ANY migration work:
```bash
# Run actual DB check (NON-NEGOTIABLE)
npm run db:check:actual > db-state-ocr-$(date +%Y%m%d).txt

# Verify these tables exist:
- companies (for company_id FK)
- inventory_images (for media_asset_id FK)  
- jobs (for job_id FK)
- auth.users (for user references)

# Check if vendors table exists (create if missing)
# Check if inventory_items exists (for SKU matching)
```

### 1.2 Reconciler Migration Strategy
Create `supabase/migrations/015_ocr_reconciler.sql` using idempotent patterns:

#### Table Creation Pattern
```sql
-- ocr_jobs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'ocr_jobs'
  ) THEN
    CREATE TABLE ocr_jobs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id UUID NOT NULL,
      media_asset_id UUID NOT NULL,
      job_type TEXT NOT NULL,
      status TEXT NOT NULL,
      -- additional columns
    );
  END IF;
END $$;

-- Add columns if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ocr_jobs' AND column_name = 'retry_count'
  ) THEN
    ALTER TABLE ocr_jobs ADD COLUMN retry_count INTEGER DEFAULT 0;
  END IF;
END $$;
```

#### RLS Policy Pattern
```sql
-- Enable RLS
ALTER TABLE ocr_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies idempotently
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ocr_jobs' AND policyname = 'ocr_jobs_tenant_isolation'
  ) THEN
    CREATE POLICY ocr_jobs_tenant_isolation ON ocr_jobs
      FOR ALL USING (company_id = auth.jwt() ->> 'company_id');
  END IF;
END $$;
```

#### Index Creation Pattern
```sql
DO $$
BEGIN
  -- Performance indexes
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_ocr_jobs_status_company'
  ) THEN
    CREATE INDEX idx_ocr_jobs_status_company ON ocr_jobs(company_id, status);
  END IF;
  
  -- FK indexes
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_ocr_jobs_media_asset'
  ) THEN
    CREATE INDEX idx_ocr_jobs_media_asset ON ocr_jobs(media_asset_id);
  END IF;
END $$;
```

### 1.3 Table Dependencies & Foreign Keys

#### Dependency Order
1. Create/verify `vendors` table first (if missing)
2. Create OCR base tables: `ocr_jobs`, `ocr_documents`
3. Create dependent tables: `ocr_line_items`, `ocr_note_entities`
4. Create lookup tables: `vendor_aliases`, `vendor_locations`

#### Foreign Key Constraints (Guarded)
```sql
DO $$
BEGIN
  -- Only add FK if target table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'inventory_images'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'ocr_jobs_media_asset_fk'
    ) THEN
      ALTER TABLE ocr_jobs 
        ADD CONSTRAINT ocr_jobs_media_asset_fk 
        FOREIGN KEY (media_asset_id) 
        REFERENCES inventory_images(id);
    END IF;
  END IF;
END $$;
```

### 1.4 Required Indexes
- `ocr_jobs`: (company_id, status), (media_asset_id), (created_at)
- `ocr_documents`: (company_id, document_type), (vendor_id), (document_date)
- `ocr_line_items`: (document_id), (inventory_item_id)
- `vendor_aliases`: (company_id, alias_name) UNIQUE
- `vendor_locations`: (vendor_id), spatial index on location

### 1.5 Company Settings Extension
```sql
-- Add OCR settings to company_settings
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'company_settings' AND column_name = 'budget_limits'
  ) THEN
    UPDATE company_settings 
    SET budget_limits = budget_limits || '{"ocr_pages_daily": 100, "ocr_cost_daily": 5.00}'::jsonb
    WHERE NOT (budget_limits ? 'ocr_pages_daily');
  END IF;
END $$;
```

## 2. Services

### 2.1 OCR Job Service
**File**: `src/domains/ocr/services/ocr-job-service.ts`

#### Responsibilities
- Queue management with status tracking
- Retry logic with exponential backoff
- Cost estimation before processing
- Progress reporting to sync indicator
- Automatic offline queuing

#### Key Methods
- `createJob(mediaAssetId, jobType)` - Creates and queues
- `processJob(jobId)` - Routes to appropriate OCR engine
- `retryFailed()` - Batch retry with backoff
- `cancelStale()` - Cancel jobs older than 24h
- `getQueueStatus()` - For progress UI

### 2.2 OCR Processing Service
**File**: `src/domains/ocr/services/ocr-processing-service.ts`

#### Local OCR (Tesseract.js)
- Initialize worker pool (2-4 workers)
- Preprocess images (deskew, enhance)
- Language detection (eng default)
- Confidence threshold: 0.7
- Cache trained data in IndexedDB

#### Cloud Fallback Strategy
```
IF local_confidence < 0.7 OR document_type = 'invoice':
  IF daily_budget_remaining > estimated_cost:
    USE cloud_ocr
  ELSE:
    QUEUE for_later
ELSE:
  USE local_ocr
```

#### Cloud Providers (Priority Order)
1. AWS Textract - Best for invoices/forms
2. Google Vision - Best for general text
3. Azure Form Recognizer - Fallback

### 2.3 Entity Extraction Service
**File**: `src/domains/ocr/services/entity-extraction-service.ts`

#### Receipt/Invoice Extractor
- Vendor name normalization
- Date parsing (multiple formats)
- Currency detection
- Line item parsing with qty/price
- Tax calculation validation
- Total verification

#### Handwritten Note Extractor
- Phone number patterns (regex)
- Customer name detection (NER)
- Job ID patterns
- Material + quantity parsing
- Address extraction
- Confidence scoring per entity

### 2.4 Vendor Normalization Service
**File**: `src/domains/vendor/services/vendor-normalization-service.ts`

#### Responsibilities
- Fuzzy matching vendor names
- Alias management
- Location-based suggestions
- Canonical vendor resolution
- Bulk import aliases

#### Key Methods
- `normalizeVendorName(rawName)` - Returns vendor_id
- `createAlias(vendorId, aliasName)` - Learn new variants
- `suggestByLocation(lat, lng)` - Nearby vendors
- `mergeVendors(id1, id2)` - Handle duplicates

### 2.5 Document Event Router
**File**: `src/domains/ocr/services/document-event-router.ts`

#### Event Types
- `inventory.consumption.recorded` - Receipt processed
- `purchase_order.received` - Invoice/PO processed  
- `job.note.created` - Handwritten note processed

#### Routing Logic
```
SWITCH document_type:
  CASE 'receipt':
    IF has_inventory_matches:
      EMIT inventory.consumption.recorded
  CASE 'invoice':
    IF has_po_number:
      EMIT purchase_order.received
  CASE 'note':
    IF has_job_id:
      EMIT job.note.created
```

### 2.6 Background Sync Integration
**File**: `src/domains/ocr/services/ocr-sync-service.ts`

#### Sync Priorities
1. Failed OCR jobs (retry)
2. Queued cloud OCR jobs
3. Completed results pending upload
4. Large documents (>5MB)

#### Integration with Existing Offline Queue
- Extend `BaseRepository` pattern
- Add to sync progress indicator
- Respect 72h force sync deadline
- Handle expiry for time-sensitive docs

## 3. UI Components

### 3.1 Capture Flow Components
**Files**: `src/components/ocr/capture/`

#### Camera Capture Component
- Capture guide overlay (corners)
- Auto-capture on stability
- Flash toggle
- Multi-capture mode
- Resolution selection (quality vs size)

#### File Upload Component  
- Drag & drop zone
- File type validation
- Multi-file selection
- PDF page preview
- Progress bars

### 3.2 Confirmation/Edit Screen
**File**: `src/components/ocr/confirmation/ocr-confirmation-modal.tsx`

#### Layout Sections
1. **Original Image** - Zoomable preview
2. **Extracted Data** - Editable fields
3. **Confidence Indicators** - Color-coded
4. **Action Buttons** - Confirm, Re-scan, Cancel

#### Field Types
- Text inputs with validation
- Currency inputs with formatting
- Date pickers with format detection
- Autocomplete for vendors
- Line item table editor

### 3.3 Progress & Status Components
**File**: `src/components/ocr/status/`

#### OCR Queue Status
- Pending count badge
- Processing spinner
- Failed items with retry
- Success notifications

#### Sync Integration
- Add OCR to existing sync indicator
- Show pages processed/remaining
- Cost accumulator display
- Budget warning at 80%

### 3.4 Mobile-First Considerations
- Touch-friendly tap targets (48px)
- Swipe gestures for navigation
- Pinch zoom for images
- Offline indicator integration
- Voice feedback for completion

## 4. Integrations

### 4.1 Media Assets Integration
**Enhancement to**: `src/domains/inventory/services/inventory-image-service.ts`

#### Linking Strategy
- Create `inventory_image` first
- Reference in `ocr_jobs.media_asset_id`
- Store original + processed versions
- Apply retention policy (90 days)

#### Storage Optimization
- Compress before upload (80% quality)
- Generate thumbnails (150x150)
- Progressive JPEG for preview
- Delete after successful OCR

### 4.2 Cost Tracking Integration
**Enhancement to**: `src/domains/telemetry/services/cost-tracking-service.ts`

#### Cost Recording
```typescript
// Record OCR operation
await costTracker.record({
  serviceType: 'ocr',
  operationType: 'extract_receipt',
  estimatedCost: 0.03,
  metadata: {
    provider: 'textract',
    pageCount: 1,
    documentType: 'receipt'
  }
});
```

#### Budget Checks
- Check before cloud OCR call
- Block at 100% daily limit
- Warning at 80%
- Fallback to local only

### 4.3 Audit System Integration
**Enhancement to**: `src/lib/admin/admin-audit-service.ts`

#### Audit Events
- Document data corrections
- Bulk vendor normalizations
- Manual entity linking
- Admin document access

#### Implementation
```typescript
// Log manual correction
await auditService.logChange({
  table: 'ocr_documents',
  operation: 'UPDATE',
  targetId: documentId,
  before: originalData,
  after: correctedData,
  reason: 'Manual vendor correction'
});
```

### 4.4 Domain Event Integration
**New**: `src/lib/events/event-emitter.ts`

#### Event Structure
```typescript
interface OcrDomainEvent {
  id: string;
  type: string;
  documentId: string;
  companyId: string;
  payload: any;
  metadata: {
    userId: string;
    timestamp: Date;
    source: 'ocr';
  };
}
```

#### Event Handlers
- Inventory consumption → Update stock
- PO receipt → Match to orders
- Job note → Append to job log

### 4.5 Notification Integration
**Enhancement to**: `src/domains/notifications/`

#### OCR Notifications
- Processing complete
- Manual review required
- Daily budget warning
- Sync completed

## 5. Testing Strategy

### 5.1 Unit Tests

#### OCR Job Service Tests
**File**: `src/__tests__/domains/ocr/services/ocr-job-service.test.ts`
- Queue creation and status transitions
- Retry logic with backoff
- Cost estimation accuracy
- Stale job cancellation

#### Entity Extraction Tests  
**File**: `src/__tests__/domains/ocr/services/entity-extraction-service.test.ts`
- Receipt parsing accuracy
- Multi-currency support
- Phone number formats
- Confidence scoring

#### Vendor Normalization Tests
**File**: `src/__tests__/domains/vendor/services/vendor-normalization-service.test.ts`
- Fuzzy matching thresholds
- Alias resolution
- Location-based ranking
- Merge operations

### 5.2 Integration Tests

#### OCR Pipeline Tests
**File**: `src/__tests__/integration/ocr-pipeline.test.ts`
- Full flow: capture → OCR → extract → confirm
- Local vs cloud routing
- Cost accumulation
- Event generation

#### Offline Sync Tests
**File**: `src/__tests__/integration/ocr-offline-sync.test.ts`
- Queue while offline
- Sync on reconnect
- Conflict resolution
- Progress reporting

### 5.3 E2E Tests

#### Receipt Capture Flow
**File**: `src/__tests__/e2e/receipt-capture.spec.ts`
```typescript
test('captures receipt and extracts data', async ({ page }) => {
  // Navigate to capture
  // Take photo
  // Verify extraction
  // Edit and confirm
  // Check event generated
});
```

#### Offline OCR Flow
**File**: `src/__tests__/e2e/ocr-offline.spec.ts`
```typescript
test('processes OCR offline and syncs', async ({ page }) => {
  // Go offline
  // Capture multiple docs
  // Verify queued
  // Go online
  // Verify sync
});
```

### 5.4 RLS Tests

#### Table Isolation Tests
**File**: `src/__tests__/rls/ocr-tables.test.ts`
- Test each table for cross-tenant isolation
- Verify company_id enforcement
- Test admin bypass logging
- Check policy completeness

### 5.5 Performance Benchmarks

#### OCR Latency Benchmarks
**File**: `src/__tests__/performance/ocr-benchmarks.test.ts`

**Targets**:
- Local OCR: P50 <1s, P95 <2s, P99 <3s
- Cloud OCR: P50 <3s, P95 <5s, P99 <8s
- Entity extraction: <500ms
- UI confirmation: <100ms render

#### Accuracy Benchmarks
**Test Dataset**: 1000 real receipts/invoices/notes

**Targets**:
- Receipt vendor: >95% accuracy
- Receipt total: >98% accuracy
- Invoice line items: >90% accuracy
- Handwritten names: >80% accuracy
- Phone numbers: >95% accuracy

### 5.6 Mock Infrastructure

#### OCR Provider Mocks
**File**: `src/__tests__/mocks/ocr-mocks.ts`
- Tesseract.js worker mock
- AWS Textract response mock
- Google Vision response mock
- Configurable confidence/accuracy

#### Test Data Fixtures
**File**: `src/__tests__/fixtures/ocr-samples.ts`
- Sample receipts (various formats)
- Sample invoices (multi-page)
- Handwritten notes (various quality)
- Edge cases (rotated, blurry, torn)

## 6. Risks & Rollbacks

### 6.1 Technical Risks

#### Risk: Poor OCR Accuracy
**Indicators**:
- Confidence scores consistently <0.5
- High manual correction rate (>40%)
- User complaints

**Mitigation**:
- Image preprocessing improvements
- Better capture guides
- Provider switching logic

**Rollback**:
- Disable auto-processing
- Queue for manual review
- Provide manual entry form

#### Risk: Cost Overruns
**Indicators**:
- Daily budget exceeded by noon
- Cost per document >$0.10
- Unexpected cloud OCR usage

**Mitigation**:
- Aggressive local OCR
- Batch processing at night
- Tiered service levels

**Rollback**:
- Disable cloud OCR
- Local-only mode
- Manual queue management

#### Risk: Incorrect Data Routing
**Indicators**:
- Wrong vendor assignments
- Inventory mismatches
- Job notes on wrong records

**Mitigation**:
- Mandatory confirmation
- Confidence thresholds
- Undo functionality

**Rollback**:
- Event reversal system
- Audit trail for corrections
- Bulk fix tools

### 6.2 Business Risks

#### Risk: Privacy Violations
**Indicators**:
- PII in OCR results
- Customer data exposed
- Retention policy violations

**Mitigation**:
- PII detection regex
- Automatic redaction
- Retention enforcement

**Rollback**:
- Purge commands
- Audit access logs
- Legal notification

#### Risk: User Adoption Failure
**Indicators**:
- <30% receipts via OCR
- High abandonment rate
- Feature disabled by users

**Mitigation**:
- Simplify flow
- Better onboarding
- Success rewards

**Rollback**:
- Keep manual option
- Gather feedback
- Iterate on UX

### 6.3 Rollback Procedures

#### Database Rollback
```sql
-- Disable feature flag
UPDATE company_settings 
SET features = features || '{"ocr_enabled": false}'::jsonb;

-- Stop processing new jobs
UPDATE ocr_jobs 
SET status = 'cancelled' 
WHERE status IN ('queued', 'processing');

-- Archive tables (don't delete data)
ALTER TABLE ocr_jobs RENAME TO ocr_jobs_archived;
-- Repeat for other tables
```

#### Code Rollback
- Feature flag in company_settings
- UI conditionally hidden
- Routes return 404
- Background jobs skip

## 7. Success Metrics

### 7.1 Performance Metrics

#### OCR Processing
- **Local OCR Rate**: >80% of documents
- **Cloud OCR Cost**: <$0.05 per document average
- **Processing Time**: P50 <2s, P95 <5s
- **Queue Depth**: <20 documents average

#### Accuracy Metrics  
- **Vendor Recognition**: >95% correct
- **Amount Extraction**: >98% within $0.01
- **Line Item Matching**: >90% correct
- **Entity Detection**: >85% for handwritten

### 7.2 Business Metrics

#### Adoption
- **Feature Usage**: >70% of users within 3 months
- **Documents Processed**: >80% via OCR vs manual
- **Time Savings**: 5 min → 30 sec per receipt
- **Error Reduction**: 50% fewer data entry errors

#### Cost Efficiency
- **ROI**: 10x time savings vs OCR cost
- **Budget Utilization**: 60-80% of daily limit
- **Cost per Document**: <$0.05 blended average

### 7.3 User Experience Metrics

#### Flow Completion
- **Capture Success**: >90% usable on first attempt
- **Abandonment Rate**: <10% mid-flow
- **Correction Rate**: <20% of fields
- **Confirmation Time**: <30s average

#### Satisfaction
- **User Feedback**: >4.0/5.0 rating
- **Support Tickets**: <5% of OCR users
- **Feature Retention**: >80% monthly active

### 7.4 Technical Health

#### System Reliability
- **OCR Availability**: >99.5% uptime
- **Sync Success**: >95% of queued items
- **Data Integrity**: 0 data loss events
- **RLS Violations**: 0 security breaches

#### Performance Trends
- **Latency Trend**: Stable or improving
- **Cost Trend**: Decreasing per document
- **Accuracy Trend**: Improving with data
- **Queue Trend**: Stable or decreasing

## Implementation Timeline

### Week 1-2: Foundation
- Database schema and migrations
- Basic OCR job service
- Local Tesseract.js integration

### Week 3-4: Processing
- Cloud provider integration
- Entity extraction pipeline
- Vendor normalization

### Week 5-6: UI & UX  
- Capture components
- Confirmation screens
- Sync integration

### Week 7-8: Polish
- Event routing
- Testing suite
- Performance optimization

---

Last Updated: 2025-01-20
Plan Version: 1.0.0