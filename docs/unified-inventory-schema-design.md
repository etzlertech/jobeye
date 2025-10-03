# Unified Inventory Schema Design

## Overview

This document outlines the design for a unified inventory schema that consolidates the current fragmented approach across equipment, inventory, materials, and tools domains into a single, coherent data model.

## Current State Issues

1. **Domain Fragmentation**: Separate tables and repositories for equipment, inventory_items, tools, and materials
2. **Code Duplication**: Similar CRUD operations repeated across domains
3. **Inconsistent Patterns**: Mix of functional and class-based repositories
4. **Redundant Relationships**: Multiple ways to track items in containers

## Proposed Unified Schema

### Core Tables

#### 1. `items` (Unified Item Table)
```sql
CREATE TABLE items (
  -- Core Identity
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Classification
  item_type TEXT NOT NULL CHECK (item_type IN ('equipment', 'material', 'consumable', 'tool')),
  category TEXT NOT NULL, -- e.g., 'mower', 'trimmer', 'fertilizer', 'safety_gear'
  tracking_mode TEXT NOT NULL CHECK (tracking_mode IN ('individual', 'quantity', 'batch')),
  
  -- Basic Information  
  name TEXT NOT NULL,
  description TEXT,
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT, -- For individually tracked items
  sku TEXT,
  barcode TEXT,
  
  -- Quantity Management (for quantity/batch tracked items)
  current_quantity DECIMAL(10,2) DEFAULT 0,
  unit_of_measure TEXT, -- 'each', 'lbs', 'gallons', etc.
  min_quantity DECIMAL(10,2),
  max_quantity DECIMAL(10,2),
  reorder_point DECIMAL(10,2),
  
  -- Location & Assignment
  current_location_id UUID, -- Can be container, warehouse, job site
  home_location_id UUID, -- Default storage location
  assigned_to_user_id UUID REFERENCES users(id),
  assigned_to_job_id UUID REFERENCES jobs(id),
  
  -- Status & Condition
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'retired', 'lost', 'damaged')),
  condition TEXT CHECK (condition IN ('new', 'excellent', 'good', 'fair', 'poor')),
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  
  -- Financial
  purchase_date DATE,
  purchase_price DECIMAL(10,2),
  current_value DECIMAL(10,2),
  depreciation_method TEXT,
  
  -- Metadata & Extensibility
  attributes JSONB DEFAULT '{}', -- Type-specific data
  tags TEXT[], -- Searchable tags
  custom_fields JSONB DEFAULT '{}', -- Customer-defined fields
  
  -- Media
  primary_image_url TEXT,
  image_urls TEXT[],
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),
  
  -- Indexes
  UNIQUE(tenant_id, serial_number) WHERE serial_number IS NOT NULL,
  UNIQUE(tenant_id, sku) WHERE sku IS NOT NULL,
  UNIQUE(tenant_id, barcode) WHERE barcode IS NOT NULL
);

CREATE INDEX idx_items_tenant_type ON items(tenant_id, item_type);
CREATE INDEX idx_items_tenant_category ON items(tenant_id, category);
CREATE INDEX idx_items_tenant_status ON items(tenant_id, status);
CREATE INDEX idx_items_location ON items(current_location_id);
CREATE INDEX idx_items_search ON items USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));
```

#### 2. `item_transactions` (Unified Transaction Log)
```sql
CREATE TABLE item_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Transaction Details
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'check_in', 'check_out', 'transfer', 'adjustment',
    'purchase', 'sale', 'maintenance', 'disposal'
  )),
  item_id UUID NOT NULL REFERENCES items(id),
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  
  -- Movement Tracking
  from_location_id UUID,
  to_location_id UUID,
  from_user_id UUID REFERENCES users(id),
  to_user_id UUID REFERENCES users(id),
  
  -- Context
  job_id UUID REFERENCES jobs(id),
  purchase_order_id UUID,
  work_order_id UUID,
  
  -- Details
  cost DECIMAL(10,2),
  notes TEXT,
  reason TEXT,
  
  -- Voice/Vision Integration
  voice_session_id UUID,
  detection_session_id UUID,
  confidence_score DECIMAL(3,2),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_transactions_tenant_item ON item_transactions(tenant_id, item_id);
CREATE INDEX idx_transactions_type_date ON item_transactions(transaction_type, created_at DESC);
CREATE INDEX idx_transactions_job ON item_transactions(job_id) WHERE job_id IS NOT NULL;
```

#### 3. `containers` (Already Unified)
- Keep existing container table structure
- Already supports truck, trailer, toolbox, storage unit types

#### 4. `container_assignments` (Keep Enhanced Version)
- Keep existing assignment tracking
- Links items to containers with check-in/out timestamps

### Migration Strategy

1. **Phase 1: Create New Schema**
   - Create `items` table with all fields
   - Create `item_transactions` table
   - Add necessary indexes and constraints

2. **Phase 2: Data Migration**
   - Migrate `equipment` records → `items` (type='equipment')
   - Migrate `inventory_items` → `items` (preserve tracking_mode)
   - Migrate `tools` → `items` (type='tool')
   - Migrate `materials` → `items` (type='material')
   - Consolidate transaction history

3. **Phase 3: Code Updates**
   - Create unified `ItemRepository` extending BaseRepository
   - Update services to use unified model
   - Update UI components for new schema

4. **Phase 4: Cleanup**
   - Drop old tables after verification
   - Remove old repository files
   - Update documentation

### Benefits

1. **Simplified Architecture**: Single source of truth for all trackable items
2. **Flexible Classification**: item_type and category allow fine-grained organization
3. **Unified Operations**: Single set of CRUD operations for all items
4. **Better Search**: Unified search across all item types
5. **Consistent Patterns**: All items follow same lifecycle and tracking

### Type-Specific Attributes (JSON)

#### Equipment Attributes
```json
{
  "engine_type": "2-stroke",
  "horsepower": 25,
  "fuel_type": "gasoline",
  "maintenance_schedule": "50hr"
}
```

#### Material Attributes  
```json
{
  "chemical_composition": "N-P-K 10-10-10",
  "hazard_class": "3",
  "expiration_date": "2025-12-31",
  "storage_requirements": "cool, dry place"
}
```

#### Tool Attributes
```json
{
  "power_source": "battery",
  "voltage": "20V",
  "compatible_batteries": ["BT-20V-4AH", "BT-20V-6AH"],
  "warranty_expires": "2026-01-01"
}
```

### API Changes

#### Before (Multiple Endpoints)
- `/api/equipment/*`
- `/api/inventory/*`
- `/api/tools/*`
- `/api/materials/*`

#### After (Unified Endpoints)
- `/api/items/*` - All item operations
- `/api/items?type=equipment` - Filter by type
- `/api/items/:id/transactions` - Item history
- `/api/items/:id/assign` - Container assignment

### Repository Pattern

```typescript
// Single repository for all items
export class ItemRepository extends BaseRepository<Item> {
  constructor(supabaseClient: SupabaseClient) {
    super('items', supabaseClient);
  }

  // Type-specific queries
  async findEquipment(tenantId: string, filters?: EquipmentFilters) { }
  async findMaterials(tenantId: string, filters?: MaterialFilters) { }
  async findTools(tenantId: string, filters?: ToolFilters) { }
  
  // Unified operations
  async adjustQuantity(itemId: string, adjustment: number) { }
  async transfer(itemId: string, toLocation: string) { }
  async checkOut(itemIds: string[], jobId: string) { }
}
```

## Implementation Timeline

1. **Week 1**: Create migration scripts and new tables
2. **Week 2**: Build unified repository and services
3. **Week 3**: Update UI components and API routes
4. **Week 4**: Testing and gradual migration
5. **Week 5**: Cleanup and documentation

## Risk Mitigation

1. **Data Integrity**: Run migrations in transaction blocks
2. **Rollback Plan**: Keep old tables until fully verified
3. **Testing**: Comprehensive test suite before migration
4. **Gradual Rollout**: Migrate one item type at a time