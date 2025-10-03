# Container Repository Analysis Report

## Overview

This analysis identifies duplicate container-related repository implementations in the JobEye codebase. There are three different implementations serving similar purposes but with key differences.

## Repository Implementations Found

### 1. Equipment Domain Container Repository
**File**: `/src/domains/equipment/repositories/container-repository.ts`
- **Phase**: 4
- **Complexity**: 377 LoC (within 400 LoC budget)
- **Purpose**: Data access layer for loading containers in equipment tracking

**Key Features**:
- Extends BaseRepository pattern
- Full CRUD operations (create, update, findById, findAll, delete)
- Container-specific methods:
  - `findByIdentifier()` - Find by unique identifier
  - `getDefault()` - Get default container for tenant
  - `getActiveContainers()` - Voice selection support
  - `searchContainers()` - Natural language search
- Automatic default container management
- Comprehensive validation with Zod schemas
- Proper error handling with structured errors
- Offline capability support

**Data Model** (Equipment Domain):
```typescript
interface Container {
  id: string;
  tenantId: string;
  containerType: 'truck' | 'trailer' | 'storage_bin' | 'warehouse' | 'building' | 'toolbox';
  identifier: string;  // e.g., 'VH-TKR', 'TR-DU12R'
  name: string;        // e.g., 'Red Truck', 'Black Lowboy'
  color?: string;
  capacityInfo?: CapacityInfo;  // Complex object with dimensions, weight, volume
  primaryImageUrl?: string;
  additionalImageUrls?: string[];
  isDefault: boolean;
  isActive: boolean;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

### 2. Inventory Domain Container Assignments Repository
**File**: `/src/domains/inventory/repositories/container-assignments.repository.ts`
- **Phase**: 3.4
- **Purpose**: Manage container-item assignments for inventory tracking

**Key Features**:
- Minimal implementation (56 LoC)
- Focused on container assignments only
- Three methods:
  - `create()` - Create new assignment
  - `findActiveByItem()` - Find active assignment for an item
  - `checkOut()` - Mark assignment as checked out
- Direct Supabase client usage (no BaseRepository)
- No validation layer

**Data Model**:
```typescript
interface ContainerAssignment {
  id: string;
  container_id: string;
  item_id: string;
  quantity: number;
  checked_in_at: string;
  checked_out_at?: string;
  job_id?: string;
  status: 'active' | 'completed' | 'cancelled';
}
```

### 3. Inventory Domain Container Repository Adapter
**File**: `/src/domains/inventory/adapters/container-repository-adapter.ts`
- **Purpose**: Adapter to use equipment domain's ContainerRepository in inventory domain
- **Complexity**: 269 LoC

**Key Features**:
- Wraps Equipment ContainerRepository for inventory domain use
- Provides functional interface (no classes)
- Maps between different data formats
- Methods:
  - `findById()`, `findAll()`, `create()`, `update()`, `deleteById()`
  - `findByCompany()` - Compatibility method
- Singleton pattern for repository instance
- Format conversion between domains

**Data Model** (Inventory Domain):
```typescript
interface Container {
  id: string;
  tenant_id: string;  // Note: snake_case vs camelCase
  type: ContainerType;
  name: string;
  identifier: string | null;
  capacity: number | null;  // Simple number vs complex CapacityInfo
  parent_container_id: string | null;
  default_location_gps: string | null;
  photo_url: string | null;  // Single vs multiple URLs
  voice_name: string | null;
  is_active: boolean;
  is_default: boolean;
  status: 'active' | 'inactive';  // Additional field
  current_location_id: string | null;  // Additional field
  attributes: any;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
```

## Database Schema Differences

### Equipment Domain Expected Table: `equipment_containers`
- Referenced in migration: `20250127_1900_mvp_intent_driven_tables.sql`
- Used for job vehicle assignments
- **Note**: Table doesn't exist in actual migrations

### Inventory Domain Table: `containers`
- Created in migration: `050_inventory_vision_extend.sql`
- Uses PostGIS for GPS location tracking
- Has parent-child container relationships
- Company-based multi-tenancy (vs tenant_id)

## Service Layer Usage

### 1. Equipment Container Service
**File**: `/src/domains/equipment/services/container-service.ts`
- Uses Equipment ContainerRepository
- Rich business logic with events
- Voice command processing
- Capacity management
- Default container auto-creation

### 2. Inventory Container Management Service
**File**: `/src/domains/inventory/services/container-management.service.ts`
- Uses the adapter pattern to access containers
- Combines container and item data
- Simpler business logic
- No event publishing

## Identified Issues

### 1. **Duplicate Implementations**
- Two completely different container models (equipment vs inventory)
- Different field naming conventions (camelCase vs snake_case)
- Different capacity representations (complex object vs simple number)

### 2. **Database Schema Mismatch**
- Equipment domain expects `equipment_containers` table (doesn't exist)
- Inventory domain uses `containers` table
- Migration references non-existent table

### 3. **Inconsistent Patterns**
- Equipment uses BaseRepository pattern
- Inventory uses direct Supabase calls and adapters
- Different error handling approaches

### 4. **Feature Duplication**
- Both domains implement container management
- Overlapping functionality with different approaches
- No clear separation of concerns

## Redundancy Impact Score

### Scale: **HIGH** (8/10)
- Two complete implementations
- 700+ LoC of duplicate functionality
- Multiple services affected

### Risk: **HIGH** (9/10)
- Database schema confusion
- Data model incompatibility
- Potential for bugs when domains interact

### Code Quality: **MEDIUM** (6/10)
- Equipment domain follows best practices
- Inventory domain has inconsistent patterns
- Adapter pattern adds complexity

**Overall Impact Score: 7.7/10**

## Recommendations

### Immediate Actions
1. **Resolve Database Schema**
   - Determine if `equipment_containers` should exist
   - Update migrations to match actual needs
   - Fix foreign key references

2. **Consolidate Container Models**
   - Choose one canonical container implementation
   - Migrate inventory to use equipment repository
   - Remove the adapter layer

### Medium-term Actions
1. **Standardize Data Models**
   - Unify field naming conventions
   - Consolidate capacity representations
   - Merge container types

2. **Refactor Service Layer**
   - Use consistent repository patterns
   - Implement shared business logic
   - Add proper event handling

### Long-term Actions
1. **Domain Boundary Review**
   - Clarify equipment vs inventory responsibilities
   - Consider a shared container domain
   - Document domain interactions

## Migration Strategy

1. **Phase 1**: Fix database schema issues
   ```sql
   -- Option 1: Create missing table
   CREATE TABLE equipment_containers AS SELECT * FROM containers;
   
   -- Option 2: Update references to use containers table
   ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_assigned_vehicle_id_fkey;
   ALTER TABLE jobs ADD CONSTRAINT jobs_assigned_vehicle_id_fkey 
     FOREIGN KEY (assigned_vehicle_id) REFERENCES containers(id);
   ```

2. **Phase 2**: Unify repository implementations
   - Update inventory services to use equipment repository directly
   - Remove adapter layer
   - Add missing inventory-specific methods to equipment repository

3. **Phase 3**: Data model consolidation
   - Create migration to standardize field names
   - Merge container type enums
   - Consolidate capacity representations

## Conclusion

The container repository implementations show significant redundancy with high risk impact. The equipment domain has a more mature implementation following established patterns, while the inventory domain uses a mix of approaches. Consolidation is recommended to reduce complexity and potential bugs.