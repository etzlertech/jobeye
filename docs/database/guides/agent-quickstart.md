# Database Quick Reference for Agents (without MCP access)

**Last Updated:** 2025-10-18 (from database.ts generation)
**Database Types Version:** 2025-10-18T08:06:29

---

## 📊 Quick Stats

- **Total Tables:** 68
- **Active Tables (with data):** 7 (jobs, properties, customers, companies, etc.)
- **Total Enums:** 28
- **Key Business Tables:** jobs, properties, customers, items, item_transactions

---

## 🎯 Core Business Tables (Priority for CODEX)

### **jobs** (55 columns, ~50 rows)

**Purpose:** Job execution tracking with scheduling, assignment, and completion data

**Key Columns:**
- `id` (uuid) - Primary key
- `tenant_id` (uuid) - Multi-tenant isolation
- `job_number` (text) - Human-readable ID
- `status` (job_status) - Current job status (ENUM)
- `title` (text) - Job title
- `scheduled_start` / `scheduled_end` (timestamp) - Scheduling
- `actual_start` / `actual_end` (timestamp) - Actual times
- `customer_id` (uuid) → customers(id)
- `property_id` (uuid) → properties(id)

**Jsonb Fields:**
- `checklist_items` (jsonb) - Flexible checklist data
- `materials_used` (jsonb) - Materials tracking
- `photos_before` / `photos_after` (jsonb) - Image arrays
- `metadata` (jsonb) - Additional data

**Status Enum:** job_status
- Values: `draft`, `scheduled`, `dispatched`, `in_progress`, `paused`, `completed`, `cancelled`, `failed`, `voice_created`

**Repository:** `src/domains/jobs/repositories/jobs.repository.ts:37`
**Type Safety Pattern:**
```typescript
import type { Database, job_status } from '@/types/database';

type JobsTable = Database['public']['Tables']['jobs'];
type Job = JobsTable['Row'];
type JobInsert = JobsTable['Insert'];
type JobUpdate = JobsTable['Update'];
type JobStatusEnum = job_status;

// Usage
async updateStatus(id: string, status: JobStatusEnum) {
  const updateData: JobUpdate = {
    status,
    updated_at: new Date().toISOString()
  };
  // ... Supabase query
}
```

---

### **properties** (25 columns, ~35 rows)

**Purpose:** Property/location management with address and geospatial data

**Key Columns:**
- `id` (uuid) - Primary key
- `tenant_id` (uuid) - Multi-tenant isolation
- `customer_id` (uuid) → customers(id)
- `property_number` (text) - Human-readable ID
- `name` (text) - Property name
- `address` (jsonb) - Structured address object
- `location` (geography POINT) - PostGIS geospatial point
- `property_type` (text) - Type of property
- `size_sqft` (numeric) - Property size
- `is_active` (boolean) - Soft delete flag

**Jsonb Fields:**
- `address` (jsonb) - { street, city, state, zip, country, formatted, landmarks }
- `metadata` (jsonb) - { state, yearBuilt, stories, tags, serviceFrequency, voiceProfile }
- `zones` (jsonb) - Irrigation zones or service areas

**Geography Field:**
- `location` - PostGIS POINT format: `POINT(longitude latitude)`
- Example: `POINT(-122.4194 37.7749)` for San Francisco

**Repository:** `src/domains/property/repositories/property-repository.ts:123`
**Type Safety Pattern:**
```typescript
type PropertiesTable = Database['public']['Tables']['properties'];
type PropertyRow = PropertiesTable['Row'];
type PropertyInsert = PropertiesTable['Insert'];
type PropertyUpdate = PropertiesTable['Update'];

// Jsonb casting pattern
const insertPayload: PropertyInsert = {
  tenant_id: tenantId,
  address: addressObject as unknown as PropertyInsert['address'],
  metadata: metadataObject as unknown as PropertyInsert['metadata'],
  location: `POINT(${lng} ${lat})`, // String format for PostGIS
  // ... other fields
};
```

---

### **items** (40 columns, ready for data)

**Purpose:** Unified inventory/material/equipment tracking table

**Key Columns:**
- `id` (uuid) - Primary key
- `tenant_id` (uuid) - Multi-tenant isolation
- `item_type` (text) - 'material', 'equipment', 'tool', 'consumable'
- `category` (text) - Item category
- `tracking_mode` (text) - 'individual' or 'quantity'
- `name` (text) - Item name
- `description` (text) - Item description
- `current_quantity` (numeric) - Stock level
- `unit_of_measure` (text) - Unit (each, box, gallon, etc.)
- `status` (text) - 'active', 'inactive', 'maintenance', etc.

**Flexible Data Fields:**
- `attributes` (jsonb) - Type-specific rich data (e.g., StoredMaterialAttributes)
- `tags` (text[]) - Array of tags
- `custom_fields` (jsonb) - Additional custom data

**Location Tracking:**
- `current_location_id` (uuid) - Current location
- `home_location_id` (uuid) - Default/home location

**Assignment:**
- `assigned_to_user_id` (uuid) - Assigned to user
- `assigned_to_job_id` (uuid) - Assigned to job

**Repository:** `src/domains/material/repositories/material-repository.ts:126`
**Type Safety Pattern:**
```typescript
type ItemsTable = Database['public']['Tables']['items'];
type ItemRow = ItemsTable['Row'];
type ItemInsert = ItemsTable['Insert'];
type ItemUpdate = ItemsTable['Update'];

// Material-specific attributes interface
interface StoredMaterialAttributes {
  materialNumber: string;
  materialType: 'chemical' | 'fertilizer' | 'equipment' | 'other';
  brand?: string | null;
  packaging?: string | null;
  pricing: { amount: number; unit: string; date: string }[];
  inventory: { location: string; quantity: number; lastCounted: string }[];
  usage: { averagePerJob?: number; unit?: string };
  safety?: { msdsUrl?: string; warnings?: string[] };
  suppliers: { name: string; partNumber?: string; leadTime?: number }[];
  // ... more fields
}

// Insert pattern
const insertPayload: ItemInsert = {
  tenant_id: tenantId,
  item_type: 'material', // Filter constant
  category: 'chemical',
  tracking_mode: 'quantity',
  name: 'Pool Chlorine',
  attributes: attributes as unknown as ItemInsert['attributes'],
  tags: ['pool', 'chemical'],
  // ... other fields
};
```

---

### **item_transactions** (21 columns, ready for data)

**Purpose:** Track all item movements, check-in/out, transfers, usage, etc.

**Key Columns:**
- `id` (uuid) - Primary key
- `tenant_id` (uuid) - Multi-tenant isolation
- `transaction_type` (text) - Type of transaction (see enum below)
- `item_id` (uuid) → items(id)
- `quantity` (numeric, default 1) - Transaction quantity
- `from_location_id` (uuid) - Source location
- `to_location_id` (uuid) - Destination location
- `from_user_id` (uuid) - Source user
- `to_user_id` (uuid) - Destination user
- `job_id` (uuid) → jobs(id)
- `cost` (numeric) - Transaction cost
- `notes` (text) - Transaction notes
- `metadata` (jsonb) - Additional data

**Transaction Type Enum:** transaction_type
- Values: `check_out`, `check_in`, `transfer`, `register`, `purchase`, `usage`, `decommission`, `audit`, `maintenance`

**Voice Integration:**
- `voice_session_id` (uuid) - Link to voice session
- `detection_session_id` (uuid) - Link to vision detection
- `confidence_score` (numeric) - AI confidence

**Repository:** `src/domains/shared/repositories/item-transaction.repository.ts` (NEEDS FIX - current TypeScript error hotspot)

**Type Safety Pattern (RECOMMENDED):**
```typescript
import type { Database, transaction_type } from '@/types/database';

type ItemTransactionsTable = Database['public']['Tables']['item_transactions'];
type ItemTransaction = ItemTransactionsTable['Row'];
type ItemTransactionInsert = ItemTransactionsTable['Insert'];
type ItemTransactionUpdate = ItemTransactionsTable['Update'];
type TransactionTypeEnum = transaction_type;

// Example usage
async recordCheckOut(
  itemId: string,
  toUserId: string,
  quantity: number,
  tenantId: string
): Promise<ItemTransaction> {
  const insertPayload: ItemTransactionInsert = {
    tenant_id: tenantId,
    transaction_type: 'check_out',
    item_id: itemId,
    quantity,
    to_user_id: toUserId,
    created_at: new Date().toISOString(),
    created_by: toUserId
  };

  const { data, error } = await supabase
    .from('item_transactions')
    .insert(insertPayload)
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

---

### **customers** (23 columns, ~91 rows)

**Purpose:** Customer management

**Key Columns:**
- `id` (uuid) - Primary key
- `tenant_id` (uuid) - Multi-tenant isolation
- `customer_number` (text) - Human-readable ID
- `name` (text) - Customer name
- `email` / `phone` / `mobile_phone` (text) - Contact info
- `billing_address` / `service_address` (jsonb) - Address objects
- `tags` (text[]) - Array of tags
- `notes` (text) - Customer notes
- `status` (text) - Customer status

**Repository:** `src/domains/customer/repositories/customer.repository.ts`

---

## 🔧 Common Type Safety Patterns

### Pattern 1: Type Helper Aliases (ALWAYS USE THIS)
```typescript
// DON'T hardcode types - use generated Database types
type ItemRow = Database['public']['Tables']['items']['Row'];
type ItemInsert = Database['public']['Tables']['items']['Insert'];
type ItemUpdate = Database['public']['Tables']['items']['Update'];
```

### Pattern 2: Jsonb Field Casting (REQUIRED for strict mode)
```typescript
// When inserting jsonb fields, use double cast
const payload: ItemInsert = {
  // ... other fields
  attributes: myObject as unknown as ItemInsert['attributes'],
  metadata: myMetadata as unknown as ItemInsert['metadata']
};

// This bypasses TypeScript's strict jsonb checking while maintaining type safety at boundaries
```

### Pattern 3: Enum Types (USE GENERATED ENUMS)
```typescript
// Import enum from generated types
import { job_status, transaction_type, device_type } from '@/types/database';

type JobStatusEnum = job_status;
type TransactionTypeEnum = transaction_type;

// Use in function signatures
async updateStatus(status: JobStatusEnum) { /* ... */ }
```

### Pattern 4: Client Flexibility Pattern
```typescript
export class MyRepository {
  constructor(private readonly supabaseClient: SupabaseClient<Database>) {}

  // Getter for runtime flexibility
  private get client(): SupabaseClient<any> {
    return this.supabaseClient as unknown as SupabaseClient<any>;
  }

  // Use this.client for queries
  async findById(id: string) {
    return await this.client.from('items').select('*').eq('id', id);
  }
}
```

### Pattern 5: Tenant Isolation (ALWAYS REQUIRED)
```typescript
// EVERY query must filter by tenant_id
const { data, error } = await supabase
  .from('items')
  .select('*')
  .eq('tenant_id', tenantId)  // ⚠️ CRITICAL - always include this
  .eq('id', itemId);

// For inserts
const payload: ItemInsert = {
  tenant_id: tenantId,  // ⚠️ CRITICAL - always set this
  // ... other fields
};
```

### Pattern 6: Soft Deletes (PREFERRED OVER HARD DELETE)
```typescript
// DON'T use DELETE queries
// DO use status updates or is_active flags

// For items table
await supabase
  .from('items')
  .update({ status: 'inactive' })
  .eq('id', itemId)
  .eq('tenant_id', tenantId);

// For properties table
await supabase
  .from('properties')
  .update({ is_active: false })
  .eq('id', propertyId)
  .eq('tenant_id', tenantId);
```

---

## 📚 All Database Enums (28 total)

```typescript
// Core enums most frequently used:
export type job_status = 'draft' | 'scheduled' | 'dispatched' | 'in_progress' | 'paused' | 'completed' | 'cancelled' | 'failed' | 'voice_created'

export type transaction_type = 'check_out' | 'check_in' | 'transfer' | 'register' | 'purchase' | 'usage' | 'decommission' | 'audit' | 'maintenance'

export type tracking_mode = 'individual' | 'quantity'

export type item_status = 'active' | 'maintenance' | 'repair' | 'retired' | 'lost'

export type job_priority = 'low' | 'normal' | 'high' | 'urgent' | 'emergency'

export type auth_event_type = 'login_success' | 'login_failed' | 'logout_success' | 'registration_success' | 'registration_failed' | 'refresh_success' | 'refresh_failed' | 'password_reset' | 'mfa_setup' | 'mfa_failed'

export type device_type = 'mobile' | 'desktop' | 'tablet' | 'voice_assistant'

export type user_role = 'admin' | 'manager' | 'technician' | 'customer'

export type verification_method = 'manual' | 'qr_scan' | 'photo_vision' | 'voice'

export type vision_verification_type = 'before_photo' | 'after_photo' | 'issue_photo' | 'equipment_scan' | 'material_scan' | 'document_scan'

// Additional enums (see src/types/database.ts lines 13-40 for full list):
// - assignment_status, container_color, container_type, equipment_status
// - filter_action, intent_type, irrigation_controller_type, item_type
// - material_unit, media_type, mfa_method, ocr_method, relationship_type
// - schedule_type, session_status, transcription_status, valve_status, zone_type
```

---

## 🗄️ Storage Buckets

### **job-photos** (public, 500MB limit per file)
- **Purpose:** Job before/after photos
- **Path Pattern:** `{tenant_id}/{job_id}/{timestamp}-{filename}`
- **RLS:** Authenticated users can upload, public can read
- **Tables using:** jobs (photos_before, photos_after, completion_photo_urls)

### **profile-images** (public, 100MB limit per file)
- **Purpose:** User profile photos
- **Path Pattern:** `{user_id}/{timestamp}-{filename}`
- **RLS:** Users can upload own photo, all authenticated can read
- **Tables using:** users_extended (thumbnail_url, medium_url, primary_image_url)

### **property-images** (public, 100MB limit per file)
- **Purpose:** Property photos
- **Path Pattern:** `{tenant_id}/{property_id}/{timestamp}-{filename}`
- **Tables using:** properties (thumbnail_url, medium_url, primary_image_url)

### **item-images** (public, 100MB limit per file)
- **Purpose:** Item/material/equipment photos
- **Path Pattern:** `{tenant_id}/{item_id}/{timestamp}-{filename}`
- **Tables using:** items (thumbnail_url, medium_url, primary_image_url)

**Image URL Pattern (consistent across tables):**
- `thumbnail_url` (text) - Small thumbnail (150x150)
- `medium_url` (text) - Medium size (600x600)
- `primary_image_url` (text) - Full size image

---

## 🚨 Common Mistakes to Avoid

### ❌ Don't: Hardcode table types
```typescript
// BAD
interface Job {
  id: string;
  title: string;
  // ... manually typed
}
```

### ✅ Do: Use generated types
```typescript
// GOOD
type Job = Database['public']['Tables']['jobs']['Row'];
```

---

### ❌ Don't: Skip tenant_id filtering
```typescript
// BAD - bypasses RLS
await supabase.from('items').select('*').eq('id', itemId);
```

### ✅ Do: Always include tenant_id
```typescript
// GOOD
await supabase.from('items').select('*').eq('id', itemId).eq('tenant_id', tenantId);
```

---

### ❌ Don't: Use hard DELETE
```typescript
// BAD - permanent data loss
await supabase.from('items').delete().eq('id', itemId);
```

### ✅ Do: Use soft delete
```typescript
// GOOD
await supabase.from('items').update({ status: 'inactive' }).eq('id', itemId);
```

---

### ❌ Don't: Forget jsonb casting
```typescript
// BAD - TypeScript error in strict mode
const payload: ItemInsert = {
  attributes: myObject  // Type error!
};
```

### ✅ Do: Cast jsonb fields
```typescript
// GOOD
const payload: ItemInsert = {
  attributes: myObject as unknown as ItemInsert['attributes']
};
```

---

## 🔍 When In Doubt

1. **Check if table exists:** Look in `src/types/database.ts` (68 tables defined)
2. **Verify column names:** Search in database.ts for the table definition
3. **Check enum values:** Search for `export type {enum_name}` in database.ts
4. **Reference existing repositories:**
   - Material repository: `src/domains/material/repositories/material-repository.ts:126`
   - Property repository: `src/domains/property/repositories/property-repository.ts:123`
   - Jobs repository: `src/domains/jobs/repositories/jobs.repository.ts:37`
5. **Ask user:** If schema details are unclear or you need row count data

---

## 📅 Snapshot Information

- **Database Types Generated:** 2025-10-18T08:06:29
- **Total Tables:** 68
- **Total Enums:** 28
- **Total Columns:** ~1500+ across all tables
- **Data Last Analyzed:** 2025-10-18 (see docs/live-database-analysis.md)

**Full type definitions:** `src/types/database.ts` (complete generated schema)

---

## 🎯 Quick Reference for CODEX: item_transactions Fix

Since you're fixing `src/domains/shared/repositories/item-transaction.repository.ts`, here's everything you need:

**Table:** `item_transactions`
**Columns:** 21 total (id, tenant_id, transaction_type, item_id, quantity, from/to locations, from/to users, job_id, cost, notes, metadata, timestamps)

**Type Setup:**
```typescript
import type { Database, transaction_type } from '@/types/database';

type ItemTransactionsTable = Database['public']['Tables']['item_transactions'];
type ItemTransactionRow = ItemTransactionsTable['Row'];
type ItemTransactionInsert = ItemTransactionsTable['Insert'];
type ItemTransactionUpdate = ItemTransactionsTable['Update'];
type TransactionTypeEnum = transaction_type;
```

**Key Patterns:**
- Use type aliases (above)
- Cast `metadata` jsonb: `metadata: data as unknown as ItemTransactionInsert['metadata']`
- Always filter `.eq('tenant_id', tenantId)`
- Use enum for transaction_type: `transaction_type: 'check_out' as TransactionTypeEnum`

**Reference Implementation:** Material repository at `src/domains/material/repositories/material-repository.ts:126` uses identical patterns for the items table.

---

**End of Agent Quickstart Guide**
