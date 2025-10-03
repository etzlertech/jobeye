# Live Database Analysis

## Overview
Based on direct queries to the live Supabase database, here's the current state and usage analysis.

## Database Statistics

### Total Tables: 49

### Tables with Data (7 tables, 487 total rows):
1. **companies** - 5 rows
2. **customers** - 91 rows 
3. **properties** - 35 rows
4. **jobs** - 50 rows
5. **inventory_images** - 1 row
6. **repository_inventory** - 28 rows
7. **code_pattern_violations** - 277 rows

### Empty Tables: 42

## Table Usage Analysis by Domain

### Core Domain (Actively Used)
- **companies** (5 rows) - Multi-tenant foundation
  - Used in: RLS policies, tenant isolation
  - Repository: No dedicated repository (uses direct queries)
  - Status: ✅ Core infrastructure

- **customers** (91 rows) - Customer management
  - Repository: `src/domains/customer/repositories/customer.repository.ts`
  - Service: `src/domains/customer/services/customer.service.ts`
  - API: `/api/customers/*`
  - Status: ✅ Fully implemented

- **properties** (35 rows) - Property management
  - Repository: `src/domains/property/repositories/property.repository.ts`  
  - Service: `src/domains/property/services/property.service.ts`
  - API: `/api/properties/*`
  - Status: ✅ Fully implemented

- **jobs** (50 rows) - Job execution
  - Repository: `src/domains/jobs/repositories/job.repository.ts`
  - Service: `src/domains/jobs/services/job.service.ts`
  - API: `/api/jobs/*`
  - Status: ✅ Fully implemented

### Vision Domain (Schema Ready, No Data)
- **vision_verifications** (0 rows)
- **vision_detected_items** (0 rows)
- **vision_cost_records** (0 rows)
- **vision_confidence_config** (0 rows)
- **vision_training_annotations** (0 rows)

All have:
- ✅ Class-based repositories (converted in Feature 009)
- ✅ Services implemented
- ✅ API routes defined
- ❌ No production data yet

### Inventory Domain (Mixed State)
- **items** (0 rows) - New unified inventory table
- **item_transactions** (0 rows) - New unified transactions
- **inventory_items** (0 rows) - Legacy inventory
- **inventory_transactions** (0 rows) - Legacy transactions
- **inventory_images** (1 row) - Has test data
- **purchase_receipts** (0 rows) - Ready for OCR feature
- **training_data_records** (0 rows) - ML training data

Status: Migrating from legacy to unified model

### Equipment Domain (Schema Ready, No Data)
- **equipment** (0 rows)
- **containers** (0 rows)
- **container_assignments** (0 rows)
- **materials** (0 rows)

Status: Schema exists, implementation pending

### Voice/Intent Domain (Schema Ready, No Data)
- **voice_transcripts** (0 rows)
- **voice_sessions** (0 rows)
- **conversation_sessions** (0 rows)
- **intent_recognitions** (0 rows)
- **intent_classifications** (0 rows)

Status: Waiting for voice feature implementation

### Analysis/Monitoring Tables
- **code_pattern_violations** (277 rows) - Cleanup tracking
- **repository_inventory** (28 rows) - Code analysis
- **ai_cost_tracking** (0 rows) - Cost monitoring
- **ai_interaction_logs** (0 rows) - AI usage logs

### Unused/Orphaned Tables (Cleanup Candidates)
These tables have no data and minimal/no code references:
- **table_inventory** - Duplicate of repository_inventory
- **migration_tracking** - Not used by Supabase
- **background_filter_preferences** - Feature not implemented
- **offline_sync_queue** - PWA feature pending
- **service_history** - Not implemented
- **time_entries** - Not implemented
- **load_verifications** - Scheduling not implemented
- **route_stops** - Routing not implemented
- **routes** - Routing not implemented

## Key Findings

### 1. Production Usage
- Only 7 of 49 tables contain data
- Core business tables (companies, customers, properties, jobs) are actively used
- Most feature-specific tables are ready but unused

### 2. Architecture Patterns
- ✅ Multi-tenant architecture working (companies table)
- ✅ Core CRUD operations implemented for main entities
- ✅ Repository pattern established (especially after Feature 009)
- ⚠️ Many advanced features have schema but no implementation

### 3. Technical Debt
- 9 tables identified as cleanup candidates
- Legacy inventory tables exist alongside new unified model
- Some tables created for features that were never built

### 4. Data Distribution
- Customer data is the largest (91 rows)
- Code analysis data is significant (277 + 28 rows)
- Test data minimal (1 inventory image)
- No production vision/voice data yet

## Recommendations

### Immediate Actions
1. **Remove orphaned tables** - The 9 unused tables identified above
2. **Complete inventory migration** - Move from legacy to unified model
3. **Archive unused features** - Tables for unimplemented features

### Future Considerations
1. **Vision domain** - Ready for production use, needs data
2. **Voice domain** - Schema ready, awaiting implementation
3. **Equipment tracking** - Consider if needed or remove
4. **Irrigation system** - Large schema with no usage

## Connection Method

The analysis uses Supabase JavaScript client with service role key:
```typescript
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Direct table queries
const { count, error } = await supabase
  .from(tableName)
  .select('*', { count: 'exact', head: true });
```

This bypasses RLS and provides full table access for analysis.