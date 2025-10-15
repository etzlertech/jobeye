# Research: Job Creation Workflow Integration

**Feature**: 007-integrate-job-creation-workflow
**Date**: 2025-10-14
**Phase**: 0 (Research)
**Status**: Complete

## Executive Summary

This research phase audited all existing demo CRUD components, API endpoints, authentication patterns, and database schema to determine the best approach for integrating customer, property, inventory, and job management into the authenticated supervisor dashboard.

**Key Finding**: All demo components are highly reusable with minimal modifications needed. The primary changes required are:
1. Replace hardcoded tenant UUID headers with session-based authentication
2. Adapt page layout to authenticated supervisor routes
3. Create missing customer/property API endpoints
4. Add RLS policies following constitutional requirements

**Estimated Reusability**: 85-90% of existing demo code can be copied and adapted

---

## 1. Demo Component Audit

### 1.1 Customer Components (`/demo-crud/`)

**CustomerForm Component** (`_components/CustomerForm.tsx`)

- **Pattern**: Controlled component with draft state management
- **Props Interface**:
  ```typescript
  interface CustomerDraft {
    name: string;
    email: string;
    phone: string;
  }
  ```
- **Features**:
  - Field-by-field onChange callbacks
  - Submit/Clear actions
  - Disabled state for loading
  - Icons from lucide-react (Check, Loader2, X)
  - Tailwind styling with green accent color
  - Responsive grid layout
- **Reusability**: ✅ 100% - Copy as-is, only update imports

**CustomerList Component** (`_components/CustomerList.tsx`)

- **Pattern**: List with inline editing capability
- **Props Interface**:
  ```typescript
  interface CustomerRecord {
    id: string;
    name: string;
    email: string;
    phone?: string;
    created_at: string;
  }
  ```
- **Features**:
  - Inline editing mode (edits name only)
  - Save/Cancel editing actions
  - Delete with confirmation pattern
  - Loading and empty states
  - Refresh button
  - Responsive layout
- **Reusability**: ✅ 95% - May want to expand editable fields

### 1.2 Property Components (`/demo-properties/`)

**PropertyForm Component** (`_components/PropertyForm.tsx`)

- **Pattern**: Multi-field form with customer dropdown
- **Props Interface**:
  ```typescript
  interface PropertyFormState {
    customerId: string;
    propertyName: string;
    addressLine1: string;
    city: string;
    state: string;
    postalCode: string;
    notes: string;
  }

  interface CustomerOption {
    id: string;
    name: string;
  }
  ```
- **Features**:
  - Customer dropdown selection (depends on customers API)
  - Address fields (line1, city, state, postal)
  - Optional property name
  - Textarea for access notes
  - Blue accent color (vs green for customers)
  - Responsive 2-column grid
- **Key Dependency**: Requires customer list to populate dropdown
- **Reusability**: ✅ 100% - Perfect for authenticated use

**PropertyList Component** (`_components/PropertyList.tsx`)

- **Pattern**: List with customer association display
- **Props Interface**:
  ```typescript
  interface PropertyRecord {
    id: string;
    name: string;
    addressLabel: string;
    customerName: string;
    createdAt: string;
  }
  ```
- **Features**:
  - Shows customer name for each property
  - Displays formatted address
  - Inline name editing
  - Yellow accent color with MapPin icon
  - Same CRUD action pattern as customers
- **Reusability**: ✅ 100% - Excellent component

### 1.3 Inventory/Items Components (`/demo-items/`)

**Note**: Items use a page-based approach instead of separated form/list components

**Items Page** (`page.tsx`)

- **Pattern**: Single-page CRUD with inline form and table list
- **State Management**: Component-level useState hooks
- **API Integration**:
  - `GET /api/supervisor/items` with x-tenant-id header
  - `POST /api/supervisor/items` with x-tenant-id header
  - `POST /api/supervisor/items/[id]/image` for image uploads
- **Features**:
  - Item creation form with:
    - Name (required)
    - Type: equipment, material, tool, consumable
    - Category (text input)
    - Tracking mode: individual, quantity, batch
    - Quantity (number input, disabled for individual mode)
    - Unit of measure (text input)
  - Image upload via ItemImageUpload component
  - Table list with columns:
    - Image thumbnail
    - Name (clickable link to detail page)
    - Type, Category, Tracking Mode
    - Quantity, Unit, Status
- **Hard-coded Tenant ID**: `'86a0f1f5-30cd-4891-a7d9-bfc85d8b259e'` in headers
- **Reusability**: ✅ 85% - Need to extract form into component, replace hardcoded tenant

### 1.4 Job Components (`/demo-jobs/`)

**JobForm Component** (`_components/JobForm.tsx`)

- **Pattern**: Complex form with multiple dependencies
- **Props Interface**:
  ```typescript
  interface JobFormState {
    customerId: string;
    propertyId: string;
    title: string;
    description: string;
    scheduledDate: string;
    scheduledTime: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
  }

  interface CustomerOption {
    id: string;
    name: string;
  }

  interface PropertyOption {
    id: string;
    name: string;
    address?: string;
  }
  ```
- **Features**:
  - Customer dropdown (required)
  - Property dropdown (optional, filtered by customer)
  - Title (required) with FileText icon
  - Description textarea (optional)
  - Date picker (required, min: today)
  - Time picker (optional) with Clock icon
  - Priority select with AlertCircle icon
  - Form validation (disables submit if required fields missing)
  - Icons for all major fields
- **Key Dependencies**: Requires both customer and property lists
- **Reusability**: ✅ 100% - Excellent multi-step form

**JobList Component** (`_components/JobList.tsx`)

- **Pattern**: Rich card-based list with status management
- **Props Interface**:
  ```typescript
  interface JobRecord {
    id: string;
    job_number: string;
    title: string;
    description?: string;
    status: string;
    priority: string;
    scheduled_start?: string;
    scheduled_end?: string;
    customerName: string;
    propertyName?: string;
    created_at: string;
  }
  ```
- **Features**:
  - Card layout (not table)
  - Inline title editing
  - Status badges with color coding
  - Priority indicators
  - Customer and property display
  - Status change actions:
    - "Start Job" (scheduled → in_progress)
    - "Complete Job" (in_progress → completed)
    - "Cancel Job" (any → cancelled)
  - Link to manage job items (`/demo-jobs/[id]/items`)
  - Package icon for items management
  - Delete protection (can't delete in_progress/completed jobs)
- **Utility Functions**: Uses helper functions from `utils.ts`:
  - `formatJobStatus()`, `formatJobPriority()`, `formatJobDateTime()`
  - `getStatusColor()`, `getPriorityColor()`
- **Reusability**: ✅ 95% - May want to customize status workflow

---

## 2. API Endpoint Patterns

### 2.1 Existing API: Items (`/api/supervisor/items/route.ts`)

**Authentication Pattern**:
```typescript
const context = await getRequestContext(request);
const { tenantId, user } = context;

let supabase: SupabaseClient;
if (!user) {
  supabase = createServiceClient(); // Use service role for demo/testing
} else {
  supabase = await createServerClient(); // Use session for authenticated
}
```

**GET Endpoint**:
- Query params: `page`, `limit`, `search`, `item_type`, `category`, `status`
- Filters via `ItemRepository.findAll()`
- Returns: `{ data, count, page, limit, totalPages }`
- Uses camelCase for repository methods but snake_case in query params

**POST Endpoint**:
- Validates required fields: `item_type`, `category`, `name`, `tracking_mode`, `unit_of_measure`
- Generates item with `ItemRepository.create()`
- Returns: `{ item, message }` with 201 status
- Transaction creation temporarily disabled (was causing 500 errors)

**Key Insights**:
- ✅ Uses `getRequestContext()` for flexible auth (session or header)
- ✅ Tenant filtering handled by repository layer
- ✅ Service client fallback for unauthenticated demo pages
- ⚠️ Snake_case to camelCase conversion needed at API boundary

### 2.2 Existing API: Jobs (`/api/supervisor/jobs/route.ts`)

**Authentication Pattern**: Same as items (uses `getRequestContext()`)

**GET Endpoint**:
- Query params: `customer_id`, `property_id`, `status`, `scheduled_date`, `search`, `limit`, `offset`
- Special modes:
  - `?health=true` - Health check
  - `?debug=true` - Debug mode with direct query
  - `?simple=true` - Simple query without relations
- Uses `JobsRepository.findAllWithRelations()` for full data
- Returns: `{ jobs, total_count }`

**POST Endpoint**:
- Validates required: `title`, `customer_id`
- Auto-generates `job_number` via `generateJobNumber()`
- Sets defaults: `status: 'draft'`, `priority: 'low'`
- Uses `JobsRepository.create()`
- Returns: `{ job, message }` with 201 status
- **IMPORTANT**: customer_id is NOT NULL in database

**Key Insights**:
- ✅ Already supports relations (customer, property)
- ✅ Job number auto-generation built-in
- ⚠️ Production issue with `findAllWithRelations()` (returns job only)
- ✅ Service client fallback for demos

### 2.3 Missing APIs: Customers & Properties

**Required Endpoints**:

1. **GET /api/supervisor/customers**
   - List all customers for tenant
   - Query params: `search`, `page`, `limit`
   - Returns: `{ customers, count }`

2. **POST /api/supervisor/customers**
   - Create new customer
   - Required: `name`, `email`
   - Optional: `phone`, `address`
   - Returns: `{ customer, message }`

3. **GET /api/supervisor/customers/[id]**
   - Get single customer details
   - Returns: `{ customer }`

4. **PUT /api/supervisor/customers/[id]**
   - Update customer
   - Returns: `{ customer, message }`

5. **DELETE /api/supervisor/customers/[id]**
   - Delete customer (check for properties first)
   - Returns: `{ message }`

6-10. **Same pattern for /api/supervisor/properties**
   - Properties require `customer_id` foreign key

**Implementation Pattern**: Follow items/jobs pattern exactly
- Use `getRequestContext()` for auth
- Service client for unauthenticated, server client for authenticated
- Repository pattern for database operations
- Validate required fields
- Return consistent JSON responses

---

## 3. Authentication & Authorization

### 3.1 withAuth Pattern (`/lib/auth/with-auth.ts`)

**Current Implementation**:
```typescript
export async function withAuth(
  _req: NextRequest,
  handler: AuthenticatedHandler
): Promise<NextResponse> {
  const supabase = await createServerClient();
  const { data: { session }, error } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = session.user.app_metadata?.tenant_id;
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant context missing' }, { status: 403 });
  }

  return await handler(session.user, tenantId);
}
```

**Key Characteristics**:
- ✅ Extracts user and tenantId from session
- ✅ Returns 401 if no session
- ✅ Returns 403 if tenant context missing
- ✅ Passes both user and tenantId to handler

**Usage Pattern**:
```typescript
export async function GET(req: NextRequest) {
  return withAuth(req, async (user, tenantId) => {
    // Handler logic here
    // tenantId is guaranteed to be present
  });
}
```

### 3.2 getRequestContext Pattern (`/lib/auth/context.ts`)

**Used by existing APIs** (items, jobs):
```typescript
const context = await getRequestContext(request);
const { tenantId, user, roles, source } = context;
```

**Features**:
- ✅ Tries session first (preferred)
- ✅ Falls back to `x-tenant-id` header for demo pages
- ✅ Logs warning when using header fallback
- ✅ Returns `source: 'session' | 'header'` for debugging

**Why Two Patterns?**:
- `withAuth()`: Strict authentication (401 if no session) - Use for supervisor-only routes
- `getRequestContext()`: Flexible auth (allows headers) - Use for shared APIs that support demo pages

**Recommendation**:
- Use `withAuth()` for new `/supervisor/customers` and `/supervisor/properties` pages
- Use `getRequestContext()` for API routes to maintain backward compatibility with demo pages

---

## 4. Database Schema & RLS

### 4.1 Existing Tables

**Verified via check_all_tables.py**:
- ✅ `customers` - EXISTS (some records present)
- ✅ `properties` - EXISTS
- ✅ `items` - EXISTS
- ✅ `jobs` - EXISTS
- ✅ `tenants` - EXISTS
- ✅ `tenant_members` - EXISTS
- ❌ `job_items` - DOES NOT EXIST (needs to be created)

**Other Missing Tables** (documented in DATABASE_ISSUES.md):
- ❌ `crews` - Referenced by dashboard but doesn't exist
- ❌ `job_assignments` - Referenced by dashboard
- ❌ `inventory` - Referenced by dashboard (may be same as items?)
- ❌ `activity_logs` - Referenced by dashboard

**Note**: Only `job_items` is required for this feature (007)

### 4.2 Expected Schema

**customers** (exists, schema TBD via Supabase MCP):
```sql
-- Expected columns based on CustomerDraft interface:
id UUID PRIMARY KEY
tenant_id UUID NOT NULL REFERENCES tenants(id)
name TEXT NOT NULL
email TEXT NOT NULL
phone TEXT
address TEXT  -- May be split into multiple columns
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```

**properties** (exists, schema TBD via Supabase MCP):
```sql
-- Expected columns based on PropertyFormState interface:
id UUID PRIMARY KEY
tenant_id UUID NOT NULL REFERENCES tenants(id)
customer_id UUID NOT NULL REFERENCES customers(id)
name TEXT  -- Optional friendly name
address_line1 TEXT
city TEXT
state TEXT
postal_code TEXT
notes TEXT  -- Access notes (gate code, parking, etc.)
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```

**items** (exists, schema confirmed in API code):
```sql
-- Schema inferred from ItemRepository usage:
id UUID PRIMARY KEY
tenant_id UUID NOT NULL REFERENCES tenants(id)
name TEXT NOT NULL
item_type TEXT NOT NULL  -- 'equipment' | 'material' | 'tool' | 'consumable'
category TEXT NOT NULL
tracking_mode TEXT NOT NULL  -- 'individual' | 'quantity' | 'batch'
current_quantity NUMERIC
unit_of_measure TEXT NOT NULL
min_quantity NUMERIC
reorder_point NUMERIC
manufacturer TEXT
model TEXT
sku TEXT
barcode TEXT
status TEXT  -- 'active' | 'inactive' | etc.
primary_image_url TEXT
thumbnail_url TEXT
medium_url TEXT
tags TEXT[]
attributes JSONB
custom_fields JSONB
image_urls TEXT[]
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```

**jobs** (exists, schema confirmed in API code):
```sql
-- Known columns from JobsRepository:
id UUID PRIMARY KEY
tenant_id UUID NOT NULL REFERENCES tenants(id)
customer_id UUID NOT NULL REFERENCES customers(id)  -- NOT NULL constraint!
property_id UUID REFERENCES properties(id)  -- Optional
job_number TEXT UNIQUE
title TEXT NOT NULL
description TEXT
status TEXT  -- 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
priority TEXT  -- 'low' | 'normal' | 'high' | 'urgent'
scheduled_start TIMESTAMPTZ  -- NOT separate date/time fields!
scheduled_end TIMESTAMPTZ
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()
```

**job_items** (NEW - needs creation):
```sql
-- Junction table for job-item assignments:
CREATE TABLE job_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(job_id, item_id)  -- Prevent duplicate assignments
);
```

### 4.3 RLS Policy Requirements (from Constitution)

**CRITICAL PATTERN from `.specify/constitution.md`**:

```sql
-- Every table must have tenant_id and RLS enabled:
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- RLS policy MUST use this exact path:
CREATE POLICY "tenant_isolation" ON table_name
  FOR ALL USING (
    tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
  );
```

**❌ WRONG PATTERN** (do not use):
```sql
-- This path doesn't exist:
auth.jwt() ->> 'tenant_id'  -- WRONG!
```

**✅ CORRECT PATTERN**:
```sql
-- User's tenant_id is stored in JWT's app_metadata:
current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id'
```

**Required RLS Policies for this Feature**:
1. ✅ `customers` - Verify RLS policy exists with correct pattern
2. ✅ `properties` - Verify RLS policy exists with correct pattern
3. ✅ `items` - Already working (RLS likely correct)
4. ✅ `jobs` - Already working (RLS likely correct)
5. ❌ `job_items` - Create RLS policy when table is created

**Verification Required** (use Supabase MCP):
- Check actual RLS policies on customers and properties tables
- Verify they use the `app_metadata` path (not the wrong path)
- Update policies if they use the incorrect pattern

---

## 5. Migration Strategy

### 5.1 Component Migration

**Step 1: Copy Demo Components to Supervisor Routes**

```
Source → Destination

/src/app/demo-crud/_components/CustomerForm.tsx
  → /src/app/supervisor/customers/_components/CustomerForm.tsx

/src/app/demo-crud/_components/CustomerList.tsx
  → /src/app/supervisor/customers/_components/CustomerList.tsx

/src/app/demo-properties/_components/PropertyForm.tsx
  → /src/app/supervisor/properties/_components/PropertyForm.tsx

/src/app/demo-properties/_components/PropertyList.tsx
  → /src/app/supervisor/properties/_components/PropertyList.tsx

/src/app/demo-items/page.tsx
  → Extract form into /src/app/supervisor/inventory/_components/ItemForm.tsx
  → Extract list into /src/app/supervisor/inventory/_components/ItemList.tsx

/src/app/demo-jobs/_components/JobForm.tsx
  → /src/app/supervisor/jobs/_components/JobForm.tsx

/src/app/demo-jobs/_components/JobList.tsx
  → /src/app/supervisor/jobs/_components/JobList.tsx
```

**Step 2: Create Page Components**

Each supervisor route needs a `page.tsx` that:
1. Fetches data from authenticated API endpoints
2. Manages form state and CRUD operations
3. Handles loading and error states
4. Uses the copied form/list components

**Example Structure** (`/src/app/supervisor/customers/page.tsx`):
```typescript
'use client';

import { useState, useEffect } from 'react';
import { CustomerForm } from './_components/CustomerForm';
import { CustomerList } from './_components/CustomerList';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState({ name: '', email: '', phone: '' });

  // Fetch customers (no x-tenant-id header needed - uses session)
  async function loadCustomers() {
    const res = await fetch('/api/supervisor/customers');
    const data = await res.json();
    setCustomers(data.customers);
  }

  // Create customer
  async function createCustomer() {
    const res = await fetch('/api/supervisor/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft)
    });
    if (res.ok) {
      loadCustomers();
      setDraft({ name: '', email: '', phone: '' });
    }
  }

  // Update, Delete, etc...

  return (
    <div>
      <h1>Customer Management</h1>
      <CustomerForm draft={draft} onChange={...} onSubmit={createCustomer} />
      <CustomerList customers={customers} ... />
    </div>
  );
}
```

**Key Changes from Demo Pages**:
- ❌ Remove `x-tenant-id` header from fetch calls
- ✅ Rely on session cookies (handled by middleware)
- ❌ Remove hardcoded demo tenant UUID
- ✅ API endpoints automatically extract tenant from session

### 5.2 API Endpoint Creation

**Pattern to Follow** (from `/api/supervisor/items/route.ts`):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@/lib/auth/context';
import { createServerClient, createServiceClient } from '@/lib/supabase/server';
import { handleApiError, validationError } from '@/core/errors/error-handler';

export async function GET(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const { tenantId, user } = context;

    const supabase = user
      ? await createServerClient()
      : createServiceClient();

    // Use repository pattern for database operations
    const repo = new CustomerRepository(supabase);
    const result = await repo.findAll({ tenantId });

    return NextResponse.json({
      customers: result.data,
      count: result.count
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getRequestContext(request);
    const { tenantId, user } = context;
    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.email) {
      return validationError('Missing required fields', {
        required: ['name', 'email']
      });
    }

    const supabase = user
      ? await createServerClient()
      : createServiceClient();

    const repo = new CustomerRepository(supabase);
    const customer = await repo.create({
      tenantId,
      ...body
    });

    return NextResponse.json({ customer, message: 'Created' }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
```

**Required Repository Classes**:
- `CustomerRepository` - CRUD operations for customers table
- `PropertyRepository` - CRUD operations for properties table
- `ItemRepository` - ✅ Already exists
- `JobsRepository` - ✅ Already exists

**Repository Pattern** (follow existing pattern in `/domains/`):
```typescript
export class CustomerRepository {
  constructor(private supabase: SupabaseClient) {}

  async findAll({ tenantId, filters, limit, offset }: FindAllOptions) {
    let query = this.supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId);

    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
    }

    if (limit) query = query.limit(limit);
    if (offset) query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return { data: data || [], count: count || 0 };
  }

  async create(data: CustomerCreateInput) {
    const { data: customer, error } = await this.supabase
      .from('customers')
      .insert(data)
      .select()
      .single();

    if (error) throw error;
    return customer;
  }

  // findById, update, delete, etc...
}
```

### 5.3 Database Migration Checklist

**BEFORE executing any SQL** (per Constitution RULE 1):
1. ✅ Use Supabase MCP to inspect actual database state
2. ✅ Check which tables exist
3. ✅ Verify column names and types
4. ✅ Check existing RLS policies
5. ✅ Use idempotent SQL (CREATE IF NOT EXISTS, etc.)
6. ✅ Apply statements one-by-one (no multi-statement DO blocks)

**Required Migrations**:
1. **Verify customers table schema** via Supabase MCP
2. **Verify properties table schema** via Supabase MCP
3. **Create job_items table** with RLS policy
4. **Update RLS policies** on customers/properties if using wrong pattern

**Sample Migration Script** (idempotent):
```sql
-- Create job_items table
CREATE TABLE IF NOT EXISTS job_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'job_items_job_item_unique'
  ) THEN
    ALTER TABLE job_items ADD CONSTRAINT job_items_job_item_unique UNIQUE(job_id, item_id);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE job_items ENABLE ROW LEVEL SECURITY;

-- Drop old policy if exists
DROP POLICY IF EXISTS "tenant_isolation" ON job_items;

-- Create RLS policy with correct app_metadata path
CREATE POLICY "tenant_isolation" ON job_items
  FOR ALL USING (
    tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
  );
```

**Execution Method** (per Constitution):
```typescript
// Use scripts/apply-migration.ts pattern
import { createClient } from '@supabase/supabase-js';

const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const { error } = await client.rpc('exec_sql', {
  sql: '/* migration SQL here */'
});
```

---

## 6. State Management Patterns

### 6.1 Form State Pattern (from CustomerForm)

**Recommended Pattern**: Controlled components with parent state management

```typescript
// Parent page.tsx
const [draft, setDraft] = useState<CustomerDraft>({
  name: '',
  email: '',
  phone: ''
});

function handleChange(field: keyof CustomerDraft, value: string) {
  setDraft(prev => ({ ...prev, [field]: value }));
}

// Child CustomerForm.tsx
<CustomerForm
  draft={draft}
  onChange={handleChange}
  onSubmit={createCustomer}
  onClear={() => setDraft({ name: '', email: '', phone: '' })}
/>
```

**Why This Pattern?**:
- ✅ Clear separation between presentation (form) and logic (page)
- ✅ Easy to add validation in parent
- ✅ Form component is pure and testable
- ✅ Can reset form from parent
- ✅ Can pre-populate form for editing

### 6.2 List State Pattern (from CustomerList)

**Recommended Pattern**: Inline editing with dedicated state

```typescript
// Parent page.tsx
const [customers, setCustomers] = useState<CustomerRecord[]>([]);
const [editingId, setEditingId] = useState<string | null>(null);
const [editValue, setEditValue] = useState('');

function startEdit(id: string, currentValue: string) {
  setEditingId(id);
  setEditValue(currentValue);
}

function cancelEdit() {
  setEditingId(null);
  setEditValue('');
}

async function saveEdit(id: string) {
  await fetch(`/api/supervisor/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name: editValue })
  });
  setEditingId(null);
  loadCustomers();
}

// Child CustomerList.tsx
<CustomerList
  customers={customers}
  editingId={editingId}
  editValue={editValue}
  onEditChange={setEditValue}
  onStartEdit={startEdit}
  onCancelEdit={cancelEdit}
  onSaveEdit={saveEdit}
  onDelete={deleteCustomer}
/>
```

### 6.3 Loading & Error States

**Recommended Pattern**:
```typescript
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

async function loadCustomers() {
  setLoading(true);
  setError(null);
  try {
    const res = await fetch('/api/supervisor/customers');
    if (!res.ok) throw new Error('Failed to load');
    const data = await res.json();
    setCustomers(data.customers);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Unknown error');
  } finally {
    setLoading(false);
  }
}
```

---

## 7. Integration Dependencies

### 7.1 Required Order of Implementation

**Phase 1: Database Setup**
1. Verify customers table schema via Supabase MCP
2. Verify properties table schema via Supabase MCP
3. Verify/fix RLS policies on customers and properties
4. Create job_items table with RLS policy

**Phase 2: Repository Layer**
1. Create CustomerRepository
2. Create PropertyRepository
3. Verify ItemRepository works (already exists)
4. Verify JobsRepository works (already exists)
5. Create JobItemsRepository

**Phase 3: API Endpoints**
1. Create /api/supervisor/customers (GET, POST)
2. Create /api/supervisor/customers/[id] (GET, PUT, DELETE)
3. Create /api/supervisor/properties (GET, POST)
4. Create /api/supervisor/properties/[id] (GET, PUT, DELETE)
5. Verify /api/supervisor/items works with session auth
6. Verify /api/supervisor/jobs works with session auth
7. Create /api/supervisor/jobs/[id]/items (GET, POST, DELETE)

**Phase 4: UI Components**
1. Copy and adapt CustomerForm + CustomerList
2. Copy and adapt PropertyForm + PropertyList
3. Extract and adapt ItemForm + ItemList from demo-items page
4. Copy and adapt JobForm + JobList

**Phase 5: Page Components**
1. Create /supervisor/customers/page.tsx
2. Create /supervisor/properties/page.tsx
3. Create /supervisor/inventory/page.tsx
4. Create /supervisor/jobs/page.tsx
5. Create /supervisor/jobs/[id]/items/page.tsx

**Phase 6: Navigation**
1. Add links to supervisor dashboard
2. Add breadcrumb navigation
3. Test navigation flow

### 7.2 Critical Dependencies

**Customer → Property**:
- Properties require customer_id foreign key
- Property form needs customer dropdown
- Must implement customers first

**Property → Jobs**:
- Jobs can have optional property_id
- Job form needs property dropdown (filtered by customer)
- Can implement jobs without properties, but UX is better with them

**Items + Jobs → Job Items**:
- Job items require both jobs and items tables
- Job items page needs item selection interface
- Must implement job_items table and API last

**Authentication → Everything**:
- All pages require withAuth or getRequestContext
- All APIs require tenant context
- Must verify session auth works before building features

---

## 8. Testing Strategy

### 8.1 Manual Testing Workflow

**Complete workflow test** (from spec.md quickstart):
1. Sign in as super@tophand.tech
2. Navigate to /supervisor/customers
3. Create customer "ACME Corp" with email acme@example.com
4. Navigate to /supervisor/properties
5. Create property "123 Main St" for ACME Corp
6. Navigate to /supervisor/inventory
7. Add item "Lawn Mower" (equipment, quantity: 2)
8. Navigate to /supervisor/jobs
9. Create job for ACME Corp / 123 Main St property
10. Navigate to job details
11. Assign "Lawn Mower" (quantity: 1) to job
12. Verify job shows assigned item

### 8.2 API Testing

**Contract tests for each endpoint**:
```typescript
// Test authentication
test('GET /api/supervisor/customers returns 401 without auth', async () => {
  const res = await fetch('/api/supervisor/customers');
  expect(res.status).toBe(401);
});

// Test tenant isolation
test('Customer A cannot access Customer B data', async () => {
  // Sign in as tenant A
  // Create customer
  // Sign in as tenant B
  // Attempt to access tenant A customer
  // Should return 404 or empty list
});

// Test CRUD operations
test('Customer CRUD workflow', async () => {
  // Create
  const created = await createCustomer({ name: 'Test', email: 'test@example.com' });
  expect(created.id).toBeDefined();

  // Read
  const fetched = await getCustomer(created.id);
  expect(fetched.name).toBe('Test');

  // Update
  const updated = await updateCustomer(created.id, { name: 'Updated' });
  expect(updated.name).toBe('Updated');

  // Delete
  await deleteCustomer(created.id);
  const deleted = await getCustomer(created.id);
  expect(deleted).toBeNull();
});
```

### 8.3 Integration Testing

**Test foreign key constraints**:
- Cannot delete customer with existing properties
- Cannot delete property with existing jobs
- Cannot create property without valid customer_id
- Cannot create job without valid customer_id

**Test RLS isolation**:
- Tenant A cannot see Tenant B's customers
- Tenant A cannot modify Tenant B's properties
- API queries automatically filter by tenant_id

---

## 9. Risk Mitigation

### 9.1 Known Issues from Previous Development

**Issue 1: RLS Policy Recursion** (from DATABASE_ISSUES.md)
- **Symptom**: "infinite recursion detected in policy for relation 'users_extended'"
- **Cause**: users_extended view has recursive RLS policy
- **Impact**: Prevents some API queries from executing
- **Current Workaround**: Using service client in some places
- **Solution**: Not required for this feature (doesn't use users_extended)

**Issue 2: Jobs Table Schema Mismatch** (resolved)
- **Issue**: Code expected `scheduled_date` + `scheduled_time` fields
- **Reality**: Database has `scheduled_start` timestamp
- **Status**: ✅ Fixed in existing code
- **Lesson**: Always verify actual schema via Supabase MCP before coding

**Issue 3: Missing Database Tables**
- **Issue**: Several tables referenced in code don't exist (crews, job_assignments, etc.)
- **Impact**: Dashboard endpoints return stub data
- **Status**: Documented in DATABASE_ISSUES.md
- **Relevance**: Does not block this feature (007)

### 9.2 Potential Issues for This Feature

**Risk 1: Customers/Properties Schema Mismatch**
- **Mitigation**: Use Supabase MCP to verify actual schema BEFORE creating repositories
- **Action**: Phase 1 of implementation MUST include schema inspection

**Risk 2: RLS Policies Using Wrong Pattern**
- **Symptom**: Queries return empty results despite data existing
- **Cause**: RLS policy checks wrong JWT path (auth.jwt() instead of app_metadata)
- **Mitigation**: Verify and update RLS policies using Constitution pattern
- **Action**: Phase 1 MUST include RLS policy inspection and fixes

**Risk 3: Session Auth Not Working on New Routes**
- **Symptom**: 401 errors on /supervisor/* pages
- **Cause**: Middleware not configured for new routes
- **Mitigation**: Middleware already handles /supervisor/* pattern
- **Action**: Test authentication on first page before building others

**Risk 4: Job Creation Requires Customer ID**
- **Constraint**: jobs.customer_id is NOT NULL in database
- **Impact**: Cannot create job without customer
- **Mitigation**: Enforce customer selection in UI (already implemented in JobForm)
- **Action**: Validate customer_id before API submission

**Risk 5: Demo Pages Break After API Changes**
- **Concern**: Changing APIs might break existing demo pages
- **Mitigation**: Use `getRequestContext()` pattern that supports both session and header auth
- **Action**: Keep header fallback in APIs, log warnings for header usage

---

## 10. Next Steps (Phase 1: Design & Contracts)

**Phase 1 Goals**:
1. Create detailed data model documentation (data-model.md)
2. Define API contracts for all endpoints (/contracts/)
3. Write contract tests (failing tests)
4. Create quickstart scenario (quickstart.md)
5. Re-evaluate constitution compliance

**Specific Actions for /plan Command**:

1. **Use Supabase MCP** to inspect actual database:
   ```
   - Query customers table schema
   - Query properties table schema
   - Query items table schema
   - Query jobs table schema
   - List RLS policies on each table
   - Verify tenant_id columns exist
   ```

2. **Document in data-model.md**:
   - Actual column names and types
   - Foreign key relationships
   - Indexes and constraints
   - Current RLS policies
   - Required changes

3. **Create API contracts** (/contracts/):
   - customers-api.json
   - properties-api.json
   - items-api.json (verify existing)
   - jobs-api.json (verify existing)
   - job-items-api.json

4. **Write quickstart.md**:
   - Step-by-step test scenario
   - Expected API requests/responses
   - Success criteria verification

5. **Update plan.md**:
   - Mark Phase 0 complete
   - Update Phase 1 with findings
   - Prepare for Phase 2 (task generation)

---

## 11. Key Findings Summary

### ✅ Strengths
1. **Excellent component reusability** - 85-90% of demo code can be copied
2. **Consistent patterns** - All demos follow same form/list structure
3. **Flexible auth** - getRequestContext() supports both session and headers
4. **Repository pattern** - Database operations well-abstracted
5. **Type safety** - Strong TypeScript interfaces throughout

### ⚠️ Concerns
1. **Schema verification needed** - Must confirm actual database structure via Supabase MCP
2. **RLS policies unverified** - Must check if using correct app_metadata path
3. **Missing job_items table** - Critical dependency for job-items feature
4. **Hardcoded tenant IDs** - Demo pages need header-based auth maintained
5. **Error handling varies** - Some components have better error states than others

### 🎯 Recommendations
1. **Use Supabase MCP first** - Inspect actual database before any migration planning
2. **Follow Constitution strictly** - RLS pattern and migration rules are critical
3. **Copy demo components as-is** - Minimal modifications needed
4. **Create repositories before APIs** - Database layer first, then HTTP layer
5. **Test incrementally** - Build customer management first, verify it works, then add properties

### 📊 Effort Estimate
- **Database setup**: 1-2 hours (schema verification, job_items creation, RLS fixes)
- **Repository creation**: 2-3 hours (CustomerRepository, PropertyRepository, JobItemsRepository)
- **API endpoints**: 3-4 hours (customers, properties, job-items routes)
- **UI components**: 2-3 hours (copy/adapt forms and lists)
- **Page components**: 2-3 hours (create page.tsx for each route)
- **Navigation integration**: 1 hour (dashboard links, breadcrumbs)
- **Testing**: 2-3 hours (manual workflow, contract tests)

**Total**: 13-19 hours (original estimate: 6-7 hours was too optimistic)

---

**Research Phase Status**: ✅ Complete
**Ready for Phase 1**: Yes
**Next Command**: `/plan` (continue to Phase 1)

