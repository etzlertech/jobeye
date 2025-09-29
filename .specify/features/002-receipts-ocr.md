# Feature Specification: 002-receipts-ocr

## Overview
Enable field technicians and office staff to capture and process receipts, invoices, and handwritten notes through the mobile PWA with offline-first OCR capabilities, automatic entity extraction, and structured data routing.

## Current Implementation Status

### ✅ Already Implemented (Dependencies)
- **Media Assets Infrastructure**: `inventory_images` table exists for storing images
- **Offline Queue System**: Base repository pattern with automatic queuing
- **Company Settings**: Budget limits and feature flags infrastructure
- **Cost Tracking**: AI operation cost recording and budget enforcement
- **PWA Foundation**: Camera access, offline page, service worker, background sync
- **Admin Audit System**: RLS bypass logging infrastructure
- **Sync Progress UI**: Components for showing operation progress

### ❌ Not Yet Implemented
- OCR processing pipeline (local and cloud)
- Receipt/invoice/note entity extraction
- Vendor normalization and geofencing
- Structured data confirmation UI
- Domain event routing system

## User Stories & Acceptance Criteria

### Story 1: Receipt Capture and Processing
**As a** field technician purchasing materials  
**I want to** photograph store receipts immediately after purchase  
**So that** inventory consumption is tracked accurately without manual entry

#### Acceptance Criteria
- [ ] Camera captures receipts in PWA (online/offline)
- [ ] Images compressed to <2MB and queued locally
- [ ] OCR extracts: vendor, date, line items (description, qty, price), tax, total
- [ ] Confidence scores shown per field (green >0.8, yellow 0.5-0.8, red <0.5)
- [ ] Edit screen allows corrections before submission
- [ ] Generates inventory consumption event on confirmation
- [ ] Works offline with sync when connected
- [ ] Respects daily OCR budget from company_settings

#### Current Gaps
- OCR service implementation
- Receipt parser and field extractor
- Confirmation UI components
- Event routing system

### Story 2: Invoice/PO Processing
**As an** office administrator  
**I want to** upload supplier invoices and purchase orders  
**So that** payables are tracked and matched to deliveries

#### Acceptance Criteria
- [ ] File upload supports PDF, JPG, PNG (max 10MB)
- [ ] Multi-page PDF support with page preview
- [ ] OCR extracts: vendor, invoice/PO number, date, terms, line items with SKUs
- [ ] Subtotal, tax breakdown, and total amounts captured
- [ ] Currency detection (USD default, others supported)
- [ ] Links to existing POs when numbers match
- [ ] Generates PO receipt event with line-item matching
- [ ] Audit trail of who uploaded and when

#### Current Gaps
- PDF processing pipeline
- Multi-page document handling
- SKU/part number extraction
- PO matching logic

### Story 3: Handwritten Notes Capture
**As a** field technician at a job site  
**I want to** photograph handwritten notes and whiteboards  
**So that** job updates and customer requests are digitized

#### Acceptance Criteria
- [ ] Camera/upload captures handwritten content
- [ ] OCR extracts: customer names, phone numbers, addresses
- [ ] Identifies job IDs and material quantities
- [ ] Preserves unknown text as free-form remarks
- [ ] Suggests linked customer/job based on extracted data
- [ ] Allows review and correction of extracted entities
- [ ] Creates job note event with structured + unstructured data
- [ ] Higher error tolerance than printed text

#### Current Gaps
- Handwriting recognition service
- Entity extraction for unstructured text
- Customer/job matching logic

### Story 4: Geofenced Context Awareness
**As a** field technician at a vendor location  
**I want** the app to recognize where I am  
**So that** receipts are automatically categorized correctly

#### Acceptance Criteria
- [ ] Detects when user is near known vendor locations
- [ ] Auto-suggests vendor name from geofence + OCR
- [ ] Shows "At Home Depot on Main St?" confirmation
- [ ] Links receipts to active jobs when at job sites
- [ ] Maintains vendor location database
- [ ] Works without location (manual vendor selection)
- [ ] Respects location permissions

#### Current Gaps
- Geofencing service
- Vendor location database
- Location-based context UI

## Data Model

### New Tables Required

```sql
-- OCR job tracking
CREATE TABLE ocr_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  media_asset_id UUID NOT NULL REFERENCES inventory_images(id),
  job_type TEXT NOT NULL CHECK (job_type IN ('receipt', 'invoice', 'handwritten')),
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  
  -- Processing metadata
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  
  -- Cost tracking
  estimated_cost DECIMAL(10,4),
  actual_cost DECIMAL(10,4),
  processing_time_ms INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extracted receipt/invoice data
CREATE TABLE ocr_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  ocr_job_id UUID NOT NULL REFERENCES ocr_jobs(id),
  document_type TEXT NOT NULL CHECK (document_type IN ('receipt', 'invoice', 'po', 'note')),
  
  -- Common fields
  vendor_name TEXT,
  vendor_id UUID REFERENCES vendors(id),
  document_date DATE,
  document_number TEXT, -- invoice/PO number
  currency_code TEXT DEFAULT 'USD',
  
  -- Amounts
  subtotal DECIMAL(10,2),
  tax_amount DECIMAL(10,2),
  total_amount DECIMAL(10,2),
  
  -- Extracted data
  raw_ocr_response JSONB, -- Full OCR response
  extracted_data JSONB,    -- Structured extraction
  confidence_scores JSONB, -- Per-field confidences
  
  -- Metadata
  location GEOGRAPHY(POINT),
  job_id UUID REFERENCES jobs(id),
  processed_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Line items from receipts/invoices
CREATE TABLE ocr_line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES ocr_documents(id) ON DELETE CASCADE,
  
  line_number INTEGER,
  description TEXT,
  sku TEXT,
  quantity DECIMAL(10,3),
  unit_of_measure TEXT,
  unit_price DECIMAL(10,2),
  extended_price DECIMAL(10,2),
  tax_amount DECIMAL(10,2),
  
  -- Matching
  inventory_item_id UUID REFERENCES inventory_items(id),
  confidence DECIMAL(3,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Handwritten note extractions
CREATE TABLE ocr_note_entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES ocr_documents(id) ON DELETE CASCADE,
  
  entity_type TEXT NOT NULL CHECK (entity_type IN ('customer_name', 'phone', 'email', 'address', 'job_id', 'material', 'quantity', 'remark')),
  extracted_text TEXT NOT NULL,
  normalized_value TEXT,
  confidence DECIMAL(3,2),
  
  -- Optional links
  customer_id UUID REFERENCES customers(id),
  job_id UUID REFERENCES jobs(id),
  
  position_data JSONB, -- Bounding box in image
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendor normalization
CREATE TABLE vendor_aliases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  alias_name TEXT NOT NULL,
  alias_type TEXT CHECK (alias_type IN ('ocr_variant', 'abbreviation', 'location_specific')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, alias_name)
);

-- Vendor locations for geofencing
CREATE TABLE vendor_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES vendors(id),
  location_name TEXT NOT NULL,
  address TEXT,
  location GEOGRAPHY(POINT) NOT NULL,
  radius_meters INTEGER DEFAULT 100,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- All tables need RLS
ALTER TABLE ocr_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_note_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_locations ENABLE ROW LEVEL SECURITY;
```

### Reconciler Migration Considerations
- Check if `vendors` table exists (may need to create)
- Check if `inventory_items` table exists for SKU matching
- Ensure `inventory_images` has required columns
- Add OCR budget limits to `company_settings` if missing

## Integration Points

### Existing Services to Integrate

1. **Media Assets (inventory_images)**
   - Store captured images/PDFs
   - Link to OCR jobs
   - Manage retention policy

2. **Offline Queue (base.repository.ts)**
   - Queue OCR jobs when offline
   - Handle sync with retry logic
   - Progress reporting

3. **Company Settings**
   - Add OCR budget limits:
   ```json
   {
     "budget_limits": {
       "ocr_pages_daily": 100,
       "ocr_cost_daily": 5.00
     },
     "ocr_preferences": {
       "default_vendor_radius_meters": 100,
       "auto_suggest_vendor": true,
       "require_confirmation": true
     }
   }
   ```

4. **Cost Tracking Service**
   - Record OCR operation costs
   - Check budget before processing
   - Alert on threshold approach

5. **Admin Audit System**
   - Log manual data corrections
   - Track who processed documents
   - Audit bulk operations

6. **Voice Announcement Service**
   - Announce extraction complete
   - Read total amounts
   - Confirm before submission

### New Services Required

1. **OCR Processing Service**
   - Local OCR with Tesseract.js
   - Cloud fallback (AWS Textract, Google Vision)
   - Confidence scoring
   - Format detection

2. **Entity Extraction Service**
   - Receipt/invoice parser
   - Handwriting entity detector
   - Phone/email normalization
   - Material quantity parser

3. **Document Event Router**
   - Generate domain events
   - Route to appropriate handlers
   - Maintain event history

4. **Geofencing Service**
   - Monitor vendor locations
   - Suggest context
   - Cache nearby vendors

## Technical Architecture

### OCR Pipeline Flow
```
1. Capture/Upload → 2. Queue → 3. Preprocess → 4. OCR → 5. Extract → 6. Confirm → 7. Route
                                    ↓                ↓
                              Local OCR ←→ Cloud OCR
                              (Tesseract)   (Textract)
```

### Processing Strategy
- **Receipts**: Local OCR first (90% accuracy target)
- **Invoices**: Cloud OCR for complex layouts
- **Handwritten**: Cloud OCR with handwriting model
- **Fallback**: If confidence <0.7, try alternate OCR

### Offline Behavior
- Queue captures up to 500MB (LRU eviction)
- Process with local OCR if available
- Sync cloud OCR jobs when connected
- Show processing status in sync indicator

## Risks & Mitigation

### Technical Risks

1. **OCR Accuracy**
   - Risk: Poor image quality, skewed captures
   - Mitigation: Image preprocessing, capture guides
   - Rollback: Manual entry fallback

2. **Cost Overruns**
   - Risk: Expensive cloud OCR calls
   - Mitigation: Local OCR first, daily budgets
   - Rollback: Queue for batch processing

3. **Data Quality**
   - Risk: Incorrect extractions, wrong vendors
   - Mitigation: Confidence thresholds, confirmation UI
   - Rollback: Edit history, audit trail

4. **Privacy Concerns**
   - Risk: PII in documents
   - Mitigation: Redaction, retention limits
   - Rollback: Purge commands

### Business Risks

1. **User Adoption**
   - Risk: Complex UI, too many confirmations
   - Mitigation: Progressive disclosure, smart defaults
   - Measure: Usage analytics, completion rates

2. **Currency/Tax Complexity**
   - Risk: Multi-currency, tax variations
   - Mitigation: Locale detection, tax tables
   - Rollback: Manual override

## Success Metrics

### Performance Metrics
- **OCR Latency**: P50 <2s, P95 <5s, P99 <10s
- **Local OCR Rate**: >80% processed locally
- **Extraction Accuracy**: >90% for receipts, >85% for invoices, >70% for handwritten
- **Offline Success**: >95% captures sync successfully

### Business Metrics
- **Time Savings**: 80% reduction in manual entry time
- **Error Rate**: <5% incorrect vendor/amount after confirmation
- **Adoption Rate**: >70% of receipts captured via OCR within 3 months
- **Cost per Document**: <$0.05 average (local + cloud mix)

### User Experience Metrics
- **Capture Success**: >95% first-attempt captures usable
- **Confirmation Time**: <30s average review time
- **Correction Rate**: <20% of fields need manual correction
- **Queue Depth**: <10 documents average backlog

## Implementation Priorities

### Phase 1: Receipt OCR (Week 1-2)
- Basic capture and queue
- Local OCR with Tesseract.js
- Simple receipt parser
- Confirmation UI

### Phase 2: Cloud Fallback (Week 3)
- AWS Textract integration
- Confidence routing
- Cost tracking
- Budget enforcement

### Phase 3: Invoice/PO Support (Week 4)
- Multi-page PDF handling
- Complex layout parsing
- Line item extraction
- SKU matching

### Phase 4: Handwritten Notes (Week 5)
- Handwriting recognition
- Entity extraction
- Free-text preservation
- Job linking

### Phase 5: Context & Intelligence (Week 6)
- Geofencing setup
- Vendor normalization
- Auto-suggestions
- Analytics dashboard

## Compliance & Security

- **Data Retention**: Raw images deleted after 90 days
- **PII Handling**: Redact SSN, credit cards, personal info
- **Access Control**: RLS on all tables, audit all access
- **Encryption**: Images encrypted at rest and in transit
- **GDPR/CCPA**: Support data export and deletion requests

---

Last Updated: 2025-01-20
Feature Version: 1.0.0