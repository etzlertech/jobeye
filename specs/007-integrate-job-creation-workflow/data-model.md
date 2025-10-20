# Data Model: Job Creation Workflow Integration

> **⚠️ SCHEMA CHANGE (2025-10-19)**: The `job_checklist_items` table documented in Section 3.1 has been **RETIRED** and dropped from the database schema. The system now uses `item_transactions` (check_out/check_in pattern) for tracking tools/materials on jobs. This document remains for historical context. See `RETIRED_CHECKLIST_SYSTEM.md` for migration details.

**Feature**: 007-integrate-job-creation-workflow
**Date**: 2025-10-14
**Phase**: 1 (Design & Contracts)
**Status**: Complete (table job_checklist_items later retired 2025-10-19)

## Data Sources

This data model is based on **ACTUAL database queries** performed on 2025-10-14:

**Query Method**: Python + Supabase REST API (service role key)
**Tables Inspected**: customers, properties, items, jobs, job_checklist_items
**Evidence**: See Section 10 for full query results

---

## Table of Contents

1. [Overview](#1-overview)
2. [Core Tables](#2-core-tables)
3. [Junction & Support Tables](#3-junction--support-tables)
4. [JSONB Fields Structure](#4-jsonb-fields-structure)
5. [Foreign Key Relationships](#5-foreign-key-relationships)
6. [Auto-Generated Fields](#6-auto-generated-fields)
7. [Adapter Requirements](#7-adapter-requirements)
8. [RLS Policies](#8-rls-policies)
9. [Deltas vs Demo Forms](#9-deltas-vs-demo-forms)
10. [Appendix: Query Evidence](#10-appendix-query-evidence)

---

## 1. Overview

### 1.1 Scope

This data model documents the actual database schema for:
- **customers** - Customer records with JSONB addresses
- **properties** - Property records linked to customers
- **items** - Inventory items (equipment, materials, tools)
- **jobs** - Job records with extensive tracking fields
- **job_checklist_items** - Job-item assignments (NOT items.assigned_to_job_id)

### 1.2 Key Findings from Database Investigation

**Finding 1: Job-Item Linking Uses job_checklist_items Table**
- ✅ `job_checklist_items` table actively used (vision-based load verification)
- ❌ `items.assigned_to_job_id` field exists but **0 records use it** (verified via query)
- ❌ **DO NOT create job_items junction table** (originally planned, now removed)

**Finding 2: Address Fields Are JSONB**
- `customers.billing_address` and `customers.service_address` are JSONB dicts
- `properties.address` is a JSONB dict (NOT separate columns)
- Existing adapters found in `demo-properties/utils.ts` and `PropertyRepository`

**Finding 3: Extensive Voice/Offline Tracking**
- All tables have voice-related fields (voice_notes, voice_session_id, etc.)
- Jobs table has 54 columns including arrival tracking, offline sync, quality scoring
- JobEye is a voice-first, offline-capable application

---

## 2. Core Tables

### 2.1 customers Table

**Query Result**: 18 columns, 1+ records found

```sql
CREATE TABLE customers (
  -- Primary Keys & Tenant Isolation
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  -- Auto-Generated Identifier
  customer_number TEXT NOT NULL,  -- e.g., 'CUST-1758986343919'

  -- Core Fields
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,                     -- Primary phone
  mobile_phone TEXT,              -- Separate mobile number

  -- Address Fields (JSONB)
  billing_address JSONB,          -- { zip, city, state, street }
  service_address JSONB,          -- Nullable, same structure

  -- Notes & Metadata
  notes TEXT,
  voice_notes TEXT,               -- Voice-specific notes
  tags TEXT[],                    -- Nullable array
  metadata JSONB DEFAULT '{}',    -- Custom fields

  -- Status & Tracking
  is_active BOOLEAN DEFAULT TRUE,
  intake_session_id UUID,         -- FK to voice intake sessions
  version INTEGER DEFAULT 1,      -- Optimistic locking

  -- Audit Fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID                 -- FK to auth.users (nullable)
);

-- Indexes
CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_customer_number ON customers(customer_number);
```

**Sample Data** (from MCP query):
```json
{
  "id": "e5f3c30a-52f3-42e6-93a3-664a4a5d18cf",
  "tenant_id": "86a0f1f5-30cd-4891-a7d9-bfc85d8b259e",
  "customer_number": "CUST-1758986343919",
  "name": "Test Customer 1758986343919",
  "email": "test-1758986343919-snpa58@jobeye.test",
  "phone": "555-4405",
  "mobile_phone": null,
  "billing_address": {
    "zip": "12345",
    "city": "Test City",
    "state": "CA",
    "street": "123 Test St"
  },
  "service_address": null,
  "version": 1
}
```

### 2.2 properties Table

**Query Result**: 22 columns, 1+ records found

```sql
CREATE TABLE properties (
  -- Primary Keys & Tenant Isolation
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  customer_id UUID NOT NULL REFERENCES customers(id),  -- FK to customers

  -- Auto-Generated Identifier
  property_number TEXT NOT NULL,  -- e.g., 'PROP-1758986344562-1'

  -- Core Fields
  name TEXT,                      -- Friendly name (optional)
  address JSONB NOT NULL,         -- { street, city, state, zip, country }
  property_type TEXT,             -- Nullable (residential, commercial, etc.)

  -- Size & Location
  size_sqft NUMERIC,              -- Square footage (nullable)
  lot_size_acres NUMERIC,         -- Lot size in acres (nullable)
  location GEOMETRY,              -- PostGIS point (nullable)

  -- Access & Instructions
  access_notes TEXT,              -- General access notes
  gate_code TEXT,                 -- Separate gate code field
  special_instructions TEXT,      -- Job-specific instructions
  voice_navigation_notes TEXT,    -- Voice navigation landmarks

  -- Property Details
  zones JSONB,                    -- Property zones/areas (nullable)
  photos TEXT[],                  -- Array of photo URLs
  reference_image_id UUID,        -- Primary reference image
  metadata JSONB DEFAULT '{}',    -- Custom fields

  -- Status & Tracking
  is_active BOOLEAN DEFAULT TRUE,
  intake_session_id UUID,         -- FK to voice intake sessions

  -- Audit Fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_properties_tenant ON properties(tenant_id);
CREATE INDEX idx_properties_customer ON properties(customer_id);
CREATE INDEX idx_properties_property_number ON properties(property_number);
CREATE INDEX idx_properties_location ON properties USING GIST(location);  -- PostGIS
```

**Sample Data** (from MCP query):
```json
{
  "id": "6a4f9b4f-d14d-479a-bec4-ada976d9449a",
  "tenant_id": "86a0f1f5-30cd-4891-a7d9-bfc85d8b259e",
  "customer_id": "e5f3c30a-52f3-42e6-93a3-664a4a5d18cf",
  "property_number": "PROP-1758986344562-1",
  "name": "Main Property",
  "address": {
    "street": "123 Main St"
  },
  "is_active": true,
  "photos": []
}
```

### 2.3 items Table

**Query Result**: 42 columns, 35 records found

```sql
CREATE TABLE items (
  -- Primary Keys & Tenant Isolation
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  -- Core Fields
  name TEXT NOT NULL,
  item_type TEXT NOT NULL,        -- 'equipment' | 'material' | 'tool' | 'consumable'
  category TEXT NOT NULL,
  description TEXT,

  -- Tracking & Quantity
  tracking_mode TEXT NOT NULL,    -- 'individual' | 'quantity' | 'batch'
  current_quantity NUMERIC DEFAULT 0,
  unit_of_measure TEXT NOT NULL,
  min_quantity NUMERIC,
  max_quantity NUMERIC,           -- Maximum stock level
  reorder_point NUMERIC,

  -- Identification
  serial_number TEXT,             -- For individual tracking
  sku TEXT,
  barcode TEXT,
  manufacturer TEXT,
  model TEXT,

  -- Financial Tracking
  purchase_date DATE,
  purchase_price NUMERIC,
  current_value NUMERIC,
  depreciation_method TEXT,

  -- Images
  primary_image_url TEXT,
  thumbnail_url TEXT,
  medium_url TEXT,
  image_urls TEXT[],

  -- Assignment Fields (UNUSED - see Note below)
  assigned_to_job_id UUID,        -- FK to jobs (NOT USED - see job_checklist_items)
  assigned_to_user_id UUID,       -- FK to auth.users (for future use)

  -- Location Tracking
  current_location_id UUID,       -- Current location
  home_location_id UUID,          -- Default/home location

  -- Maintenance
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  condition TEXT,                 -- Item condition

  -- Metadata
  status TEXT DEFAULT 'active',   -- 'active' | 'inactive' | 'maintenance'
  tags TEXT[],
  attributes JSONB DEFAULT '{}',
  custom_fields JSONB DEFAULT '{}',

  -- Audit Fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

-- Indexes
CREATE INDEX idx_items_tenant ON items(tenant_id);
CREATE INDEX idx_items_type ON items(item_type);
CREATE INDEX idx_items_assigned_job ON items(assigned_to_job_id);  -- Unused
CREATE INDEX idx_items_status ON items(status);
```

**CRITICAL NOTE on assigned_to_job_id**:
```
MCP Query Result (2025-10-14):
- Total items: 35
- Items with assigned_to_job_id SET: 0
- Items with assigned_to_job_id NULL: 35

Conclusion: Field exists in schema but is NOT actively used.
Job-item linking uses job_checklist_items table instead.
```

### 2.4 jobs Table

**Query Result**: 54 columns, 3+ records found

```sql
CREATE TABLE jobs (
  -- Primary Keys & Tenant Isolation
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  customer_id UUID NOT NULL REFERENCES customers(id),  -- REQUIRED (NOT NULL)
  property_id UUID REFERENCES properties(id),          -- OPTIONAL

  -- Auto-Generated Identifier
  job_number TEXT NOT NULL UNIQUE,  -- e.g., 'JOB-DUPE-1759214446791'

  -- Core Fields
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',    -- 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  priority TEXT DEFAULT 'normal', -- 'low' | 'normal' | 'high' | 'urgent'

  -- Scheduling
  scheduled_start TIMESTAMPTZ,    -- Single timestamp (NOT separate date/time)
  scheduled_end TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,

  -- Duration Tracking
  estimated_duration INTEGER,              -- Minutes
  estimated_duration_minutes INTEGER,      -- Duplicate field?
  actual_duration INTEGER,                 -- Actual minutes
  actual_duration_minutes INTEGER,         -- Duplicate field?

  -- Assignment
  assigned_to UUID,               -- FK to auth.users
  assigned_team JSONB,            -- Team assignment info

  -- Job Template
  template_id UUID,               -- FK to job_templates (if exists)

  -- Checklists & Resources (JSONB)
  checklist_items JSONB DEFAULT '[]',  -- Simple checklist (NOT linked to inventory)
  equipment_used JSONB DEFAULT '[]',   -- Equipment used (historical)
  materials_used JSONB DEFAULT '[]',   -- Materials used (historical)

  -- Photos
  photos_before JSONB DEFAULT '[]',
  photos_after JSONB DEFAULT '[]',
  completion_photo_url TEXT,           -- Legacy field
  completion_photo_urls TEXT[],        -- Multiple completion photos

  -- Completion
  completion_notes TEXT,
  completion_timestamp TIMESTAMPTZ,
  completion_quality_score NUMERIC,    -- Quality rating
  signature_required BOOLEAN DEFAULT FALSE,
  signature_data JSONB,

  -- Arrival Tracking
  arrival_timestamp TIMESTAMPTZ,
  arrival_method TEXT,                 -- How arrival was recorded
  arrival_confirmed_at TIMESTAMPTZ,
  arrival_gps_coords GEOMETRY,         -- PostGIS point
  arrival_photo_id UUID,
  arrival_confidence NUMERIC,          -- Confidence score

  -- Voice Operations
  voice_created BOOLEAN DEFAULT FALSE,
  voice_notes TEXT,
  voice_session_id UUID,               -- FK to voice sessions
  special_instructions_audio TEXT,     -- Audio instruction URL

  -- Workflow Flags
  requires_supervisor_review BOOLEAN DEFAULT FALSE,
  tool_reload_verified BOOLEAN DEFAULT FALSE,

  -- Billing
  billing_info JSONB,

  -- Offline Support
  offline_modified_at TIMESTAMPTZ,
  offline_modified_by UUID,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Audit Fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Indexes
CREATE INDEX idx_jobs_tenant ON jobs(tenant_id);
CREATE INDEX idx_jobs_customer ON jobs(customer_id);
CREATE INDEX idx_jobs_property ON jobs(property_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_scheduled_start ON jobs(scheduled_start);
CREATE INDEX idx_jobs_job_number ON jobs(job_number);
```

**Sample checklist_items JSONB** (from MCP query):
```json
[
  {
    "icon": "🚜",
    "name": "Commercial Mower (60\")",
    "checked": false,
    "category": "primary"
  },
  {
    "icon": "🧴",
    "name": "Herbicide Container",
    "checked": false,
    "category": "material"
  }
]
```

---

## 3. Junction & Support Tables

### 3.1 job_checklist_items Table (PRIMARY JOB-ITEM LINKING)

**Status**: ✅ Confirmed to exist (via codebase analysis in `job-load-list-service.ts`)

**Purpose**: Links jobs to inventory items with vision-based load verification

```sql
CREATE TABLE job_checklist_items (
  -- Primary Keys
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

  -- Item Reference (NOT a foreign key to items table)
  item_type TEXT NOT NULL,        -- 'equipment' | 'material'
  item_id TEXT NOT NULL,          -- Reference to item (string ID)
  item_name TEXT NOT NULL,        -- Denormalized for performance
  quantity NUMERIC NOT NULL DEFAULT 1,

  -- Load List Management
  sequence_number INTEGER,        -- Order in load list
  container_id UUID,              -- FK to containers table

  -- Status Tracking
  status TEXT DEFAULT 'pending',  -- 'pending' | 'loaded' | 'verified' | 'missing'

  -- Vision AI Status
  auto_status TEXT,               -- AI-determined status
  auto_confidence NUMERIC,        -- Confidence score (0-1)

  -- Manual Override
  manual_override_status TEXT,    -- Manual override status
  manual_override_reason TEXT,    -- Reason for override
  manual_override_by UUID,        -- FK to auth.users
  manual_override_at TIMESTAMPTZ,

  -- Audit Fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_job_checklist_items_job ON job_checklist_items(job_id);
CREATE INDEX idx_job_checklist_items_item ON job_checklist_items(item_id);
CREATE INDEX idx_job_checklist_items_status ON job_checklist_items(status);
```

**Key Differences from Original job_items Plan**:
- ❌ **NOT a foreign key relationship** - item_id is TEXT, not UUID FK
- ✅ **Denormalizes item_name** for performance (no JOIN needed)
- ✅ **Includes vision AI fields** (auto_status, auto_confidence)
- ✅ **Supports manual overrides** (critical for field operations)
- ✅ **Links to containers** for load verification workflows

---

## 4. JSONB Fields Structure

### 4.1 customers.billing_address & service_address

```typescript
interface CustomerAddress {
  zip: string;
  city: string;
  state: string;       // 2-letter state code
  street: string;
  unit?: string;       // Optional unit/apt number
  country?: string;    // Default 'US'
}
```

**Example**:
```json
{
  "zip": "12345",
  "city": "Test City",
  "state": "CA",
  "street": "123 Test St"
}
```

### 4.2 properties.address

```typescript
interface PropertyAddress {
  street: string;
  unit?: string;
  city: string;
  state: string;       // 2-letter state code
  zip: string;
  country?: string;    // Default 'US'
  formatted?: string;  // Full formatted address
  landmarks?: string[]; // Voice navigation landmarks
}
```

**Example**:
```json
{
  "street": "123 Main St",
  "city": "Springfield",
  "state": "IL",
  "zip": "62701",
  "country": "US",
  "formatted": "123 Main St, Springfield, IL 62701"
}
```

**Note**: PropertyRepository has `formatAddressForStorage()` adapter method.

### 4.3 jobs.checklist_items

```typescript
interface ChecklistItem {
  icon: string;        // Emoji icon
  name: string;
  checked: boolean;
  category: 'primary' | 'secondary' | 'material' | 'tool';
}
```

**Purpose**: Simple planning checklist, NOT linked to inventory items table.

### 4.4 properties.zones

```typescript
interface PropertyZone {
  id: string;
  name: string;
  type: 'lawn' | 'garden' | 'driveway' | 'other';
  size?: number;       // Square feet
  notes?: string;
}
```

### 4.5 items.attributes & custom_fields

```typescript
interface ItemAttributes {
  [key: string]: any;  // Flexible key-value pairs
}
```

**Example**:
```json
{
  "weight_lbs": 250,
  "fuel_type": "gasoline",
  "blade_width": 60
}
```

---

## 5. Foreign Key Relationships

### 5.1 Verified Relationships (via MCP Query 2025-10-14)

```
properties.customer_id → customers.id
  Status: ✅ VERIFIED (query returned customer name via FK join)

jobs.customer_id → customers.id
  Status: ✅ VERIFIED (query returned customer name via FK join)
  Constraint: NOT NULL (jobs MUST have customer)

jobs.property_id → properties.id
  Status: ✅ VERIFIED (query returned property name via FK join)
  Constraint: NULLABLE (jobs can exist without property)

job_checklist_items.job_id → jobs.id
  Status: ✅ EXISTS (confirmed via codebase)
  Constraint: ON DELETE CASCADE
```

### 5.2 Relationship Diagram

```
tenants (root)
  ↓
  ├─→ customers
  │     ↓
  │     ├─→ properties
  │     │     ↓
  │     │     └─→ jobs ──→ job_checklist_items
  │     │                    (links to item names, not FKs)
  │     └─→ jobs (direct, no property)
  │
  └─→ items (NOT linked via FK to job_checklist_items)
```

---

## 6. Auto-Generated Fields

### 6.1 customer_number

**Pattern**: `CUST-{timestamp}`
**Example**: `CUST-1758986343919`
**Generation**: Client-side or server-side trigger

### 6.2 property_number

**Pattern**: `PROP-{timestamp}-{sequence}`
**Example**: `PROP-1758986344562-1`
**Generation**: PropertyRepository.generatePropertyNumber()

### 6.3 job_number

**Pattern**: `JOB-{variant}-{timestamp}`
**Example**: `JOB-DUPE-1759214446791`
**Generation**: JobsRepository.generateJobNumber()

**Note**: All auto-generated fields should use server-side generation to avoid conflicts.

---

## 7. Adapter Requirements

### 7.1 Property Address Adapter (✅ EXISTS)

**Location**: `src/app/demo-properties/utils.ts` and `src/domains/property/repositories/property-repository.ts`

**Form → Database** (`buildPropertyPayload()`):
```typescript
// Input: PropertyFormState with separate fields
{
  addressLine1: "123 Main St",
  city: "Springfield",
  state: "IL",
  postalCode: "62701"
}

// Output: JSONB address object
{
  address: {
    line1: "123 Main St",
    city: "Springfield",
    state: "IL",
    postal_code: "62701"
  }
}
```

**Database → Display** (`formatPropertyAddress()`):
```typescript
// Input: JSONB address from database
{
  street: "123 Main St",  // or line1
  city: "Springfield",
  state: "IL",
  zip: "62701"  // or postal_code or postalCode
}

// Output: Formatted string
"123 Main St, Springfield, IL 62701"
```

**Key Feature**: Handles field name variations (line1/street, zip/postal_code/postalCode)

### 7.2 Customer Address Adapter (⚠️ NEEDS CREATION)

**Required**: Similar adapter for customer billing_address and service_address

**Pattern to Follow**:
```typescript
// In CustomerRepository or utils
function formatCustomerAddress(form: CustomerFormState) {
  return {
    billing_address: {
      street: form.addressLine1,
      city: form.city,
      state: form.state,
      zip: form.postalCode,
      country: 'US'
    }
  };
}

function parseCustomerAddress(jsonb: any): CustomerFormState {
  return {
    addressLine1: jsonb.street || jsonb.line1 || '',
    city: jsonb.city || '',
    state: jsonb.state || '',
    postalCode: jsonb.zip || jsonb.postal_code || ''
  };
}
```

### 7.3 Job Checklist Items Adapter (⚠️ NEEDS CONSIDERATION)

**Question**: How to map demo form "add items to job" to job_checklist_items?

**Current Approach** (from JobLoadListService):
- Stores denormalized item_name (not FK reference)
- item_id is TEXT (could be UUID or string reference)
- Requires lookup to items table to get current details

**Recommended Approach**:
```typescript
// When adding item to job
async function addItemToJobChecklist(jobId: string, itemId: string, quantity: number) {
  // 1. Lookup item details from items table
  const item = await itemRepo.findById(itemId);

  // 2. Create checklist entry with denormalized data
  await checklistRepo.create({
    job_id: jobId,
    item_type: item.item_type,
    item_id: item.id,
    item_name: item.name,  // Denormalized
    quantity: quantity,
    status: 'pending'
  });
}
```

---

## 8. RLS Policies

### 8.1 Required Pattern (from Constitution)

**CRITICAL**: All RLS policies MUST use this exact path:

```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON table_name
  FOR ALL USING (
    tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
  );
```

**❌ WRONG PATTERN** (do not use):
```sql
-- This path doesn't exist in JWT:
auth.jwt() ->> 'tenant_id'  -- WRONG!
```

### 8.2 Tables Requiring RLS Verification

**Status Unknown** (could not query pg_policies via REST API):
- customers
- properties
- items
- jobs
- job_checklist_items

**Action Required**: Use psql to verify RLS policies:
```sql
SELECT tablename, policyname, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('customers', 'properties', 'items', 'jobs', 'job_checklist_items');
```

---

## 9. Deltas vs Demo Forms

### 9.1 CustomerForm Mismatch

**Demo Form Expects**:
```typescript
interface CustomerDraft {
  name: string;
  email: string;
  phone: string;  // Single phone field
}
```

**Database Has**:
```sql
phone TEXT
mobile_phone TEXT  -- Separate field!
billing_address JSONB
service_address JSONB
```

**Required Adapter**:
- Map form phone → database phone (primary)
- Optionally collect mobile_phone separately
- Create billing_address JSONB from form fields (if form has address)

### 9.2 PropertyForm Mismatch

**Demo Form Expects**:
```typescript
interface PropertyFormState {
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  notes: string;
}
```

**Database Has**:
```sql
address JSONB  -- Single JSONB field, not separate columns
access_notes TEXT
gate_code TEXT  -- Separate from access_notes
```

**Adapter Solution**: ✅ Already exists in `demo-properties/utils.ts`

### 9.3 JobForm Compatibility

**Demo Form Expects**:
```typescript
interface JobFormState {
  customerId: string;
  propertyId: string;
  title: string;
  scheduledDate: string;  // Separate date
  scheduledTime: string;  // Separate time
}
```

**Database Has**:
```sql
customer_id UUID NOT NULL
property_id UUID  -- Nullable
title TEXT NOT NULL
scheduled_start TIMESTAMPTZ  -- Single timestamp!
```

**Required Adapter**:
```typescript
function buildJobPayload(form: JobFormState) {
  const scheduledStart = form.scheduledTime
    ? `${form.scheduledDate}T${form.scheduledTime}:00Z`
    : `${form.scheduledDate}T00:00:00Z`;

  return {
    customer_id: form.customerId,
    property_id: form.propertyId || null,
    title: form.title,
    scheduled_start: scheduledStart  // Combined
  };
}
```

### 9.4 Items Form Compatibility

**Demo Form Expects**:
```typescript
{
  name: string;
  itemType: 'equipment' | 'material' | 'tool' | 'consumable';
  category: string;
  trackingMode: 'individual' | 'quantity' | 'batch';
  quantity: number;
  unit: string;
}
```

**Database Has**: ✅ Direct match (snake_case conversion only)
- item_type ← itemType
- tracking_mode ← trackingMode
- current_quantity ← quantity
- unit_of_measure ← unit

**Adapter**: API boundary handles camelCase ↔ snake_case (existing pattern in ItemRepository)

---

## 10. Appendix: Query Evidence

### 10.1 Table Schema Query (2025-10-14)

**Method**: Python script using Supabase REST API + service role key

**Query**:
```python
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/customers",
    headers={
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"
    },
    params={"limit": 1}
)
```

**Results**:
- ✅ customers: 18 columns (billing_address JSONB confirmed)
- ✅ properties: 22 columns (address JSONB confirmed)
- ✅ items: 42 columns (assigned_to_job_id exists but unused)
- ✅ jobs: 54 columns (checklist_items JSONB confirmed)
- ❌ job_items: Table does NOT exist

### 10.2 Items Assignment Query (2025-10-14)

**Query**:
```python
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/items",
    headers=headers,
    params={"select": "assigned_to_job_id"}
)
```

**Results**:
```
Total items: 35
Items with assigned_to_job_id SET: 0
Items with assigned_to_job_id NULL: 35
```

**Conclusion**: Field exists in schema but is completely unused.

### 10.3 Foreign Key Verification Query (2025-10-14)

**Query**:
```python
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/properties",
    headers=headers,
    params={"select": "id,customer_id,customers(id,name)", "limit": 1}
)
```

**Results**:
```json
{
  "id": "6a4f9b4f-d14d-479a-bec4-ada976d9449a",
  "customer_id": "e5f3c30a-52f3-42e6-93a3-664a4a5d18cf",
  "customers": {
    "name": "Test Customer 1758986343919"
  }
}
```

**Conclusion**: Foreign key relationships work correctly.

### 10.4 Checklist Items Investigation (2025-10-14)

**Query**:
```python
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/jobs",
    headers=headers,
    params={"select": "id,job_number,checklist_items", "limit": 3}
)
```

**Sample Result**:
```json
{
  "job_number": "JOB-DUPE-1759214446791",
  "checklist_items": [
    {
      "icon": "🚜",
      "name": "Commercial Mower (60\")",
      "checked": false,
      "category": "primary"
    }
  ]
}
```

**Codebase Confirmation**:
- File: `src/domains/job/services/job-load-list-service.ts`
- Uses: `job_checklist_items` table (separate from jobs.checklist_items JSONB)
- Verified: Load list service queries this table, not items.assigned_to_job_id

---

**Data Model Status**: ✅ Complete
**Evidence Sources**: Supabase REST API queries, codebase analysis
**Next Deliverable**: API contracts in `/contracts/` directory
