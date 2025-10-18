# Repository Type Safety Patterns - Reference Guide

**Last Updated:** 2025-10-18
**For:** CODEX and agents working on TypeScript repository implementations

---

## 🎯 Three Proven Repository Implementations

These repositories are **production-ready** and serve as reference implementations:

1. **Material Repository** - `src/domains/material/repositories/material-repository.ts:126`
   - Uses shared `items` table with `item_type` filter
   - Complex jsonb attributes (StoredMaterialAttributes)
   - 730 lines - most comprehensive example

2. **Property Repository** - `src/domains/property/repositories/property-repository.ts:123`
   - Jsonb fields: address, metadata, zones
   - Geography field: PostGIS POINT handling
   - Soft delete with `is_active` boolean

3. **Jobs Repository** - `src/domains/jobs/repositories/jobs.repository.ts:37`
   - Enum types: job_status
   - Relations: customers and properties joins
   - Status transitions with auto-timestamps

---

## 📋 Pattern 1: Type Aliases (Universal)

**Used in:** All 3 reference repositories

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// ALWAYS create these type aliases at the top of your repository
type ItemsTable = Database['public']['Tables']['items'];
type ItemRow = ItemsTable['Row'];
type ItemInsert = ItemsTable['Insert'];
type ItemUpdate = ItemsTable['Update'];

// For enums used in this table
import type { transaction_type, item_status } from '@/types/database';
type TransactionTypeEnum = transaction_type;
type ItemStatusEnum = item_status;
```

**Why:**
- Reduces verbosity throughout the file
- Makes refactoring easier
- Catches schema changes at compile time
- Self-documenting code

**Example from material-repository.ts:126-129:**
```typescript
type ItemsTable = Database['public']['Tables']['items'];
type ItemRow = ItemsTable['Row'];
type ItemInsert = ItemsTable['Insert'];
type ItemUpdatePayload = ItemsTable['Update'];
```

---

## 📋 Pattern 2: Jsonb Field Casting (Required for Strict Mode)

**Used in:** Material repository (attributes), Property repository (address, metadata)

```typescript
// Problem: TypeScript's strict mode rejects direct jsonb assignment
const payload: ItemInsert = {
  attributes: myDataObject  // ❌ Type error!
};

// Solution: Double cast through unknown
const payload: ItemInsert = {
  attributes: myDataObject as unknown as ItemInsert['attributes']
};
```

**Real Examples:**

### Material Repository (line 259-261):
```typescript
const insertPayload: ItemInsert = {
  // ... other fields
  attributes: attributes as unknown as ItemInsert['attributes'],
  custom_fields: customFields as unknown as ItemInsert['custom_fields'],
  tags: validated.tags ?? [],
};
```

### Property Repository (line 145, 153):
```typescript
const insertPayload: PropertyInsert = {
  // ... other fields
  address: addressJson as unknown as PropertyInsert['address'],
  metadata: metadata as unknown as PropertyInsert['metadata'],
};
```

**When to use:**
- ANY jsonb column (`attributes`, `metadata`, `custom_fields`, etc.)
- When inserting or updating jsonb data
- NOT needed when reading jsonb (TypeScript infers Json type)

**Pattern Variation - Reading Metadata Back:**
```typescript
// Safe parsing helper (from property-repository.ts:653)
private ensureMetadata(value: unknown): PropertyMetadata {
  if (!isRecord(value)) {
    return {
      state: PropertyState.ACTIVE,
      tags: [],
      customFields: {},
      version: 1,
    };
  }

  return {
    state: coercePropertyState(value.state),
    yearBuilt: typeof value.yearBuilt === 'number' ? value.yearBuilt : undefined,
    tags: Array.isArray(value.tags) ? (value.tags as string[]) : [],
    // ... more safe parsing
  };
}
```

---

## 📋 Pattern 3: Client Flexibility Getter

**Used in:** All 3 reference repositories

```typescript
export class MyRepository {
  constructor(private readonly supabaseClient: SupabaseClient<Database>) {}

  // Getter for runtime type flexibility
  private get client(): SupabaseClient<any> {
    return this.supabaseClient as unknown as SupabaseClient<any>;
  }

  // Use this.client in all queries
  async findById(id: string, tenantId: string) {
    const { data, error } = await this.client
      .from('items')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) throw error;
    return data;
  }
}
```

**Real Examples:**

### Material Repository (line 135-137):
```typescript
private get client(): SupabaseClient<any> {
  return this.supabaseClient as unknown as SupabaseClient<any>;
}
```

### Property Repository (line 105-107):
```typescript
private get client(): SupabaseClient<any> {
  return this.supabaseClient as unknown as SupabaseClient<any>;
}
```

**Why:**
- Supabase generated types can be overly strict
- Runtime queries need flexibility for complex operations
- Maintains type safety at public API boundaries
- Allows method chaining without type conflicts

---

## 📋 Pattern 4: Tenant Isolation (CRITICAL - Security)

**Used in:** All 3 reference repositories - EVERY query

```typescript
// READING - Always filter by tenant_id
async findById(id: string, tenantId: string) {
  const { data, error } = await this.client
    .from('items')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)  // ⚠️ REQUIRED
    .single();

  return data;
}

// INSERTING - Always set tenant_id
async create(data: ItemCreate, tenantId: string) {
  const payload: ItemInsert = {
    tenant_id: tenantId,  // ⚠️ REQUIRED
    // ... other fields
  };

  const { data: created, error } = await this.client
    .from('items')
    .insert(payload)
    .select()
    .single();

  return created;
}

// UPDATING - Always filter by tenant_id
async update(id: string, updates: ItemUpdate, tenantId: string) {
  const { data, error } = await this.client
    .from('items')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', tenantId)  // ⚠️ REQUIRED
    .select()
    .single();

  return data;
}

// DELETING - Always filter by tenant_id (but prefer soft delete)
async delete(id: string, tenantId: string) {
  const { error } = await this.client
    .from('items')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);  // ⚠️ REQUIRED

  return !error;
}
```

**Real Examples:**

### Material Repository (line 171-174):
```typescript
const { data: existingItem, error: fetchError } = await this.client
  .from('items')
  .select('*')
  .eq('id', materialId)
  .eq('tenant_id', tenantId)  // ✅ Tenant isolation
  .eq('item_type', 'material')
  .maybeSingle();
```

### Jobs Repository (line 79-95):
```typescript
let query = this.client
  .from('jobs')
  .select(`...`)
  .eq('tenant_id', tenantId);  // ✅ Tenant isolation first
```

**Why:**
- **Security:** Prevents cross-tenant data leaks
- **RLS:** Works with Row Level Security policies
- **Required:** Database has RLS policies that expect `app.tenant_id`
- **Convention:** Every method takes `tenantId` as last parameter

---

## 📋 Pattern 5: Soft Delete (Preferred over Hard Delete)

**Used in:** Material repository (status field), Property repository (is_active field)

```typescript
// DON'T use hard DELETE
async delete(id: string, tenantId: string): Promise<boolean> {
  const { error } = await this.client
    .from('items')
    .delete()  // ❌ Permanent data loss
    .eq('id', id)
    .eq('tenant_id', tenantId);

  return !error;
}

// DO use soft delete with status field
async delete(id: string, tenantId: string): Promise<boolean> {
  const { error } = await this.client
    .from('items')
    .update({ status: 'inactive' })  // ✅ Soft delete
    .eq('id', id)
    .eq('tenant_id', tenantId);

  return !error;
}

// OR use is_active boolean
async delete(id: string, tenantId: string): Promise<boolean> {
  const { error } = await this.client
    .from('properties')
    .update({ is_active: false })  // ✅ Soft delete
    .eq('id', id)
    .eq('tenant_id', tenantId);

  return !error;
}
```

**Real Examples:**

### Material Repository (line 377-392):
```typescript
async softDeleteMaterial(materialId: string, tenantId: string): Promise<boolean> {
  try {
    const { error } = await this.client
      .from('items')
      .update({
        status: 'inactive',  // ✅ Soft delete
        updated_at: new Date().toISOString(),
      } as ItemUpdatePayload)
      .eq('id', materialId)
      .eq('tenant_id', tenantId)
      .eq('item_type', 'material');

    return !error;
  } catch (error) {
    throw createAppError({
      code: 'MATERIAL_DELETE_FAILED',
      message: 'Failed to soft delete material',
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.DATABASE,
      originalError: error as Error,
    });
  }
}
```

### Property Repository (line 485-532):
```typescript
async delete(propertyId: string, tenantId: string): Promise<boolean> {
  // Fetch current metadata
  const { data: currentRow, error: fetchError } = await this.client
    .from('properties')
    .select('metadata')
    .eq('id', propertyId)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!currentRow) return false;

  const metadata = this.ensureMetadata(currentRow.metadata);

  // Soft delete with is_active + metadata state
  const { error } = await this.client
    .from('properties')
    .update({
      is_active: false,  // ✅ Soft delete
      metadata: {
        ...metadata,
        state: PropertyState.INACTIVE,
        version: (metadata.version ?? 1) + 1,
      } as unknown as PropertyUpdatePayload['metadata'],
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', propertyId)
    .eq('tenant_id', tenantId);

  return !error;
}
```

**Why:**
- **Recovery:** Can undo accidental deletions
- **Audit:** Maintains history
- **Relations:** Doesn't break foreign key references
- **Business Logic:** Some records should never be permanently deleted

**Status Field Options:**
- For `items` table: `status = 'inactive'` (also: 'maintenance', 'repair', 'retired', 'lost')
- For `properties` table: `is_active = false`
- For `jobs` table: `status = 'cancelled'` (enum value)

---

## 📋 Pattern 6: Enum Type Usage

**Used in:** Jobs repository (job_status), Material repository (transaction_type implied)

```typescript
// Import enum from generated types
import type { job_status, transaction_type } from '@/types/database';

// Create type alias
type JobStatusEnum = job_status;
type TransactionTypeEnum = transaction_type;

// Use in method signatures
async updateStatus(
  id: string,
  status: JobStatusEnum,  // ✅ Type-safe enum
  tenantId: string
): Promise<Job | null> {
  const updateData: JobUpdate = {
    status,  // TypeScript validates this is a valid enum value
    updated_at: new Date().toISOString(),
  };

  // Add conditional fields based on status
  if (status === 'in_progress') {
    updateData.actual_start = new Date().toISOString();
  }
  if (status === 'completed') {
    updateData.actual_end = new Date().toISOString();
  }

  return this.update(id, updateData, { tenant_id: tenantId });
}
```

**Real Example from Jobs Repository (line 232-253):**
```typescript
async updateStatus(
  id: string,
  status: JobStatusEnum,
  tenantId: string,
  additionalData: Partial<JobUpdate> = {}
): Promise<Job | null> {
  const updateData: JobUpdate = {
    status,
    updated_at: new Date().toISOString(),
    ...additionalData
  };

  // Add actual start/end times based on status
  if (status === 'in_progress' && !additionalData.actual_start) {
    updateData.actual_start = new Date().toISOString();
  }
  if (status === 'completed' && !additionalData.actual_end) {
    updateData.actual_end = new Date().toISOString();
  }

  return this.update(id, updateData, { tenant_id: tenantId });
}
```

**All Available Enums:**
See `docs/database/guides/agent-quickstart.md` for full enum list (28 total)

**Common Enums:**
- `job_status` - 9 values (draft → completed flow)
- `transaction_type` - 9 values (check_out, check_in, transfer, etc.)
- `item_status` - 5 values (active, maintenance, repair, retired, lost)
- `tracking_mode` - 2 values (individual, quantity)
- `auth_event_type` - 11 values (login_success, login_failed, etc.)

---

## 📋 Pattern 7: Error Handling

**Used in:** All 3 reference repositories

```typescript
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';

async createMaterial(data: MaterialCreate, tenantId: string): Promise<Material> {
  try {
    // Perform database operation
    const { data: created, error } = await this.client
      .from('items')
      .insert(insertPayload)
      .select()
      .single();

    // Check for Supabase errors
    if (error) {
      throw error;
    }

    return this.mapToMaterial(created);

  } catch (error) {
    // Wrap in application error
    throw createAppError({
      code: 'MATERIAL_CREATE_FAILED',
      message: 'Failed to create material',
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.DATABASE,
      originalError: error as Error,
    });
  }
}
```

**Real Example from Material Repository (line 232-281):**
```typescript
async persistMaterial(validated: MaterialCreate, tenantId: string): Promise<Material> {
  try {
    // Build insert payload
    const insertPayload: ItemInsert = {
      tenant_id: tenantId,
      item_type: 'material',
      // ... more fields
    };

    const { data: created, error } = await this.client
      .from('items')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return this.mapToMaterial(created);
  } catch (error) {
    throw createAppError({
      code: 'MATERIAL_CREATE_FAILED',
      message: 'Failed to create material in items table',
      severity: ErrorSeverity.MEDIUM,
      category: ErrorCategory.DATABASE,
      originalError: error as Error,
    });
  }
}
```

**Error Handling Checklist:**
- ✅ Wrap queries in try/catch
- ✅ Check for Supabase `error` object
- ✅ Throw AppError with context
- ✅ Include original error
- ✅ Use appropriate ErrorCategory (DATABASE, VALIDATION, BUSINESS_LOGIC, etc.)
- ✅ Set ErrorSeverity (LOW, MEDIUM, HIGH, CRITICAL)

**Special Case - Not Found (PGRST116):**
```typescript
async findById(id: string, tenantId: string): Promise<Material | null> {
  const { data, error } = await this.client
    .from('items')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  if (error) {
    // PGRST116 = not found (expected, not an error)
    if (error.code === 'PGRST116') {
      return null;
    }
    throw error;
  }

  return data;
}
```

---

## 📋 Pattern 8: Domain Mapping (Row → Domain Model)

**Used in:** Material repository (mapToMaterial), Property repository (mapToProperty)

```typescript
// Private mapping method
private mapToMaterial(row: ItemRow): Material {
  if (!row) {
    throw new Error('Cannot map empty item row to material');
  }

  // Parse jsonb attributes safely
  const attributes = this.ensureAttributes(row.attributes);

  // Map database row to domain model
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    materialNumber: attributes.materialNumber,
    name: row.name,
    category: row.category,
    brand: attributes.brand,
    // ... map all fields from row + attributes
    version: attributes.version ?? 1,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
  };
}

// Safe attributes parser
private ensureAttributes(value: unknown): StoredMaterialAttributes {
  if (!isRecord(value)) {
    // Return sensible defaults
    return {
      materialNumber: '',
      materialType: 'other',
      pricing: [],
      inventory: [],
      usage: {},
      suppliers: [],
      version: 1,
    };
  }

  // Parse and validate each field
  return {
    materialNumber: String(value.materialNumber ?? ''),
    materialType: coerceMaterialType(value.materialType),
    brand: typeof value.brand === 'string' ? value.brand : null,
    // ... more safe parsing
  };
}
```

**Real Example from Material Repository (line 589-652):**
```typescript
private mapToMaterial(row: ItemRow): Material {
  if (!row) {
    throw new Error('Cannot map empty item row to material');
  }

  const attributes = this.ensureAttributes(row.attributes);

  return {
    id: row.id,
    tenant_id: row.tenant_id,
    materialNumber: attributes.materialNumber,
    name: row.name,
    description: row.description ?? undefined,
    category: row.category,
    materialType: attributes.materialType,
    brand: attributes.brand ?? undefined,
    // ... 40+ more mapped fields
    version: attributes.version ?? 1,
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    createdBy: attributes.createdBy ?? undefined,
    updatedBy: attributes.updatedBy ?? undefined,
  };
}
```

**Why:**
- **Separation:** Database schema ≠ Domain model
- **Type Safety:** Explicit mapping catches schema changes
- **Defaults:** Handle missing/null fields safely
- **Transformation:** Convert database types (string dates → Date objects)

**Helper Functions:**
```typescript
// Type guard
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Enum coercion
const coerceMaterialType = (value: unknown): MaterialType =>
  Object.values(MaterialType).includes(value as MaterialType)
    ? (value as MaterialType)
    : MaterialType.OTHER;
```

---

## 🎯 Complete Repository Template

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, my_enum_type } from '@/types/database';
import { createAppError, ErrorSeverity, ErrorCategory } from '@/core/errors/error-types';

// 1. Type Aliases
type MyTable = Database['public']['Tables']['my_table'];
type MyRow = MyTable['Row'];
type MyInsert = MyTable['Insert'];
type MyUpdate = MyTable['Update'];
type MyEnumType = my_enum_type;

// 2. Domain Interfaces (if needed)
interface MyDomainModel {
  id: string;
  tenantId: string;
  // ... domain-specific fields
}

export class MyRepository {
  // 3. Constructor with typed client
  constructor(private readonly supabaseClient: SupabaseClient<Database>) {}

  // 4. Client flexibility getter
  private get client(): SupabaseClient<any> {
    return this.supabaseClient as unknown as SupabaseClient<any>;
  }

  // 5. CREATE
  async create(data: MyCreate, tenantId: string): Promise<MyDomainModel> {
    try {
      const insertPayload: MyInsert = {
        tenant_id: tenantId,  // Tenant isolation
        // ... map data to payload
        metadata: data.metadata as unknown as MyInsert['metadata'],  // Jsonb cast
      };

      const { data: created, error } = await this.client
        .from('my_table')
        .insert(insertPayload)
        .select()
        .single();

      if (error) throw error;

      return this.mapToDomain(created);
    } catch (error) {
      throw createAppError({
        code: 'MY_CREATE_FAILED',
        message: 'Failed to create record',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  // 6. READ
  async findById(id: string, tenantId: string): Promise<MyDomainModel | null> {
    try {
      const { data, error } = await this.client
        .from('my_table')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', tenantId)  // Tenant isolation
        .maybeSingle();

      if (error) throw error;

      return data ? this.mapToDomain(data) : null;
    } catch (error) {
      throw createAppError({
        code: 'MY_FETCH_FAILED',
        message: 'Failed to fetch record',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  // 7. UPDATE
  async update(id: string, updates: MyUpdate, tenantId: string): Promise<MyDomainModel | null> {
    try {
      const updatePayload: MyUpdate = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await this.client
        .from('my_table')
        .update(updatePayload)
        .eq('id', id)
        .eq('tenant_id', tenantId)  // Tenant isolation
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return this.mapToDomain(data);
    } catch (error) {
      throw createAppError({
        code: 'MY_UPDATE_FAILED',
        message: 'Failed to update record',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  // 8. SOFT DELETE
  async delete(id: string, tenantId: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('my_table')
        .update({ status: 'inactive' })  // Soft delete
        .eq('id', id)
        .eq('tenant_id', tenantId);  // Tenant isolation

      return !error;
    } catch (error) {
      throw createAppError({
        code: 'MY_DELETE_FAILED',
        message: 'Failed to delete record',
        severity: ErrorSeverity.MEDIUM,
        category: ErrorCategory.DATABASE,
        originalError: error as Error,
      });
    }
  }

  // 9. Private mapper
  private mapToDomain(row: MyRow): MyDomainModel {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      // ... map all fields
    };
  }
}

// 10. Factory function
export const createMyRepository = (supabase: SupabaseClient): MyRepository => {
  return new MyRepository(supabase as SupabaseClient<Database>);
};
```

---

## 🚀 Quick Start for New Repository

1. **Copy template above** → rename to your table name
2. **Update type aliases** → use your table from Database type
3. **Update all `my_table` references** → use your actual table name
4. **Add tenant isolation** → `.eq('tenant_id', tenantId)` to ALL queries
5. **Cast jsonb fields** → `as unknown as MyInsert['field']`
6. **Add domain mapper** → `mapToDomain()` method
7. **Reference existing repos** for complex patterns (joins, geography, enums)

---

**End of Repository Patterns Reference**
