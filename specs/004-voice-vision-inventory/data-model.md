# Data Model: Voice & Vision Inventory Management

**Feature**: 004-voice-vision-inventory
**Date**: 2025-09-29
**Status**: Phase 1 - Design

## Entity Relationship Diagram

```
┌─────────────────┐
│    companies    │
└────────┬────────┘
         │
         │ (1:N)
         ├───────────────────────────────────────────────────────┐
         │                                                       │
         ▼                                                       ▼
┌────────────────────┐                             ┌────────────────────────┐
│  inventory_items   │◄──────────┐                │      containers        │
│                    │           │                │                        │
│ - id               │           │ (N:1)          │ - id                   │
│ - company_id       │           │                │ - company_id           │
│ - type (enum)      │           │                │ - type (enum)          │
│ - name             │           │                │ - name                 │
│ - category         │           │                │ - identifier           │
│ - status (enum)    │           │                │ - capacity             │
│ - current_location ├───────────┘                │ - parent_container_id  │
│ - specifications   │                            │ - default_location_gps │
│ - attributes       │                            │ - photo_url            │
│ - images           │                            │ - voice_name           │
│ - tracking_mode    │                            │ - is_active            │
│                    │                            │ - is_default           │
└────────┬───────────┘                            └────────┬───────────────┘
         │                                                 │
         │ (N:M via container_assignments)                │
         │                                                 │
         └──────────────┬──────────────────────────────────┘
                        │
                        ▼
                ┌───────────────────────┐
                │ container_assignments │
                │                       │
                │ - id                  │
                │ - container_id        │
                │ - item_id             │
                │ - quantity            │
                │ - checked_in_at       │
                │ - checked_out_at      │
                │ - job_id              │
                │ - status              │
                └───────────────────────┘
                        ▲
                        │
                        │ (N:1)
                        │
        ┌───────────────┴───────────────────┐
        │                                   │
        ▼                                   ▼
┌──────────────────────┐       ┌────────────────────────┐
│ inventory_           │       │   purchase_receipts    │
│   transactions       │       │                        │
│                      │       │ - id                   │
│ - id                 │       │ - company_id           │
│ - company_id         │       │ - vendor_name          │
│ - type (enum)        │       │ - vendor_location      │
│ - item_ids[]         │       │ - purchase_date        │
│ - quantity           │       │ - total_amount         │
│ - source_container   │       │ - line_items (jsonb)   │
│ - dest_container     │       │ - receipt_photo_url    │
│ - job_id             │       │ - ocr_extracted_data   │
│ - performer_id       │       │ - ocr_confidence       │
│ - verification_method│       │ - po_reference         │
│ - photo_evidence_url │       │ - assigned_job_id      │
│ - voice_session_id   │       │                        │
│ - voice_transcript   │       └────────────────────────┘
│ - notes              │
│ - cost_data          │
└──────────────────────┘
        │
        │ (1:N)
        │
        ▼
┌──────────────────────────┐
│   training_data_records  │
│                          │
│ - id                     │
│ - company_id             │
│ - user_id                │
│ - original_photo_url     │
│ - yolo_detections (jsonb)│
│ - vlm_analysis (jsonb)   │
│ - user_selections        │
│ - user_corrections       │
│ - context (jsonb)        │
│ - voice_transcript       │
│ - quality_metrics        │
│ - created_record_ids[]   │
└────────┬─────────────────┘
         │
         │ (1:N)
         │
         ▼
┌─────────────────────────────┐
│ vision_training_annotations │
│                             │
│ - id                        │
│ - training_record_id        │
│ - item_detection_number     │
│ - corrected_label           │
│ - corrected_bbox (jsonb)    │
│ - correction_reason         │
└─────────────────────────────┘

┌──────────────────────────────┐     ┌─────────────────────────────┐
│ detection_confidence_        │     │ background_filter_          │
│   thresholds                 │     │   preferences               │
│                              │     │                             │
│ - id                         │     │ - id                        │
│ - company_id                 │     │ - company_id                │
│ - local_confidence_threshold │     │ - user_id (nullable)        │
│ - max_daily_vlm_requests     │     │ - object_label              │
│ - daily_cost_budget_cap      │     │ - action (enum)             │
│ - is_active                  │     │ - context_filters (jsonb)   │
└──────────────────────────────┘     └─────────────────────────────┘

┌──────────────────────┐
│  item_relationships  │
│                      │
│ - id                 │
│ - parent_item_id     │
│ - related_item_id    │
│ - relationship_type  │
│ - notes              │
└──────────────────────┘
```

## Entities

### 1. inventory_items

**Purpose**: Represents trackable equipment or materials in the company's inventory.

**Fields**:
- `id` (UUID, PK): Unique identifier
- `company_id` (UUID, FK → companies.id, NOT NULL): Tenant isolation
- `type` (ENUM: 'equipment', 'material'): Determines tracking mode
- `name` (TEXT, NOT NULL): Item display name (e.g., "Honda HRX Mower")
- `category` (TEXT): Classification (e.g., "mower", "trimmer", "fertilizer")
- `status` (ENUM: 'active', 'maintenance', 'repair', 'retired', 'lost'): Current state
- `current_location_id` (UUID, FK → containers.id, NULLABLE): Where item currently is
- `specifications` (JSONB): Technical specs (model, serial, dimensions, weight)
- `attributes` (JSONB): Custom fields (brand, color, purchase_date, purchase_price, vendor)
- `images` (JSONB[]): Array of {url, aspect_ratio, crop_box, is_primary}
- `tracking_mode` (ENUM: 'individual', 'quantity'): How to track (equipment=individual, materials=quantity)
- `current_quantity` (INTEGER, NULLABLE): For materials only
- `reorder_level` (INTEGER, NULLABLE): Minimum quantity trigger for materials
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())
- `created_by` (UUID, FK → users.id): User who created record

**Indexes**:
- PRIMARY KEY (id)
- INDEX (company_id, status) - Fast filtering by company and status
- INDEX (company_id, category) - Category-based queries
- INDEX (current_location_id) - Location lookups
- FULL TEXT SEARCH (name, category) - Voice search support

**RLS Policy**:
```sql
CREATE POLICY "tenant_isolation" ON inventory_items
  FOR ALL USING (
    company_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
  );
```

**Validation Rules**:
- `type='equipment'` → `tracking_mode='individual'`, `current_quantity` must be NULL
- `type='material'` → `tracking_mode='quantity'`, `current_quantity` must be NOT NULL
- At least one image required (`images` array length ≥ 1)
- Primary image required (exactly one image with `is_primary=true`)

---

### 2. containers

**Purpose**: Represents physical storage locations where inventory items can be checked in/out.

**Fields**:
- `id` (UUID, PK): Unique identifier
- `company_id` (UUID, FK → companies.id, NOT NULL): Tenant isolation
- `type` (ENUM: 'truck', 'trailer', 'storage_bin', 'warehouse', 'building', 'toolbox'): Container category
- `name` (TEXT, NOT NULL): Display name (e.g., "Truck 214", "Main Warehouse")
- `identifier` (TEXT, NULLABLE): License plate, asset tag, or code
- `capacity` (INTEGER, NULLABLE): Maximum item count (null = unlimited)
- `parent_container_id` (UUID, FK → containers.id, NULLABLE): For hierarchy (toolbox inside truck)
- `default_location_gps` (POINT, NULLABLE): GPS coordinates for context detection
- `photo_url` (TEXT, NULLABLE): Container photo
- `voice_name` (TEXT, NULLABLE): Alternative name for voice commands (e.g., "red trailer")
- `is_active` (BOOLEAN, DEFAULT TRUE): Whether container is in use
- `is_default` (BOOLEAN, DEFAULT FALSE): Default container for user quick actions
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

**Indexes**:
- PRIMARY KEY (id)
- INDEX (company_id, is_active) - Active containers lookup
- INDEX (company_id, type) - Filter by type
- INDEX (parent_container_id) - Hierarchy traversal
- FULL TEXT SEARCH (name, voice_name, identifier) - Voice search

**RLS Policy**:
```sql
CREATE POLICY "tenant_isolation" ON containers
  FOR ALL USING (
    company_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
  );
```

**Validation Rules**:
- Only one `is_default=true` per user per company
- `parent_container_id` cannot create circular references (enforced via trigger)
- GPS coordinates must be valid POINT type if provided

---

### 3. container_assignments

**Purpose**: Tracks current and historical item-to-container relationships (check-ins/outs).

**Fields**:
- `id` (UUID, PK): Unique identifier
- `container_id` (UUID, FK → containers.id, NOT NULL): Which container
- `item_id` (UUID, FK → inventory_items.id, NOT NULL): Which item
- `quantity` (INTEGER, DEFAULT 1): For materials, quantity in container
- `checked_in_at` (TIMESTAMPTZ, NOT NULL): When item entered container
- `checked_out_at` (TIMESTAMPTZ, NULLABLE): When item left container (NULL = currently in container)
- `job_id` (UUID, FK → jobs.id, NULLABLE): Associated job context
- `status` (ENUM: 'active', 'completed', 'cancelled'): Assignment state

**Indexes**:
- PRIMARY KEY (id)
- UNIQUE (container_id, item_id, checked_out_at) WHERE checked_out_at IS NULL - Prevent duplicate active assignments
- INDEX (item_id, checked_out_at) - Find current location (WHERE checked_out_at IS NULL)
- INDEX (container_id, status) - Container contents queries
- INDEX (job_id) - Job-based lookups

**RLS Policy**:
```sql
CREATE POLICY "tenant_isolation" ON container_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM containers
      WHERE containers.id = container_assignments.container_id
        AND containers.company_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
    )
  );
```

**Validation Rules**:
- `checked_out_at` must be >= `checked_in_at` (enforced via CHECK constraint)
- Cannot check out item not currently checked in (trigger validation)

---

### 4. inventory_transactions

**Purpose**: Audit log of all inventory operations (check-out, check-in, register, purchase, transfer, usage).

**Fields**:
- `id` (UUID, PK): Unique identifier
- `company_id` (UUID, FK → companies.id, NOT NULL): Tenant isolation
- `type` (ENUM: 'check_out', 'check_in', 'transfer', 'register', 'purchase', 'usage', 'decommission', 'audit', 'maintenance'): Operation type
- `item_ids` (UUID[], NOT NULL): Items involved in transaction
- `quantity` (INTEGER, NULLABLE): For material transactions
- `source_container_id` (UUID, FK → containers.id, NULLABLE): Origin container
- `destination_container_id` (UUID, FK → containers.id, NULLABLE): Destination container
- `job_id` (UUID, FK → jobs.id, NULLABLE): Associated job
- `performer_id` (UUID, FK → users.id, NOT NULL): Who performed the transaction
- `verification_method` (ENUM: 'manual', 'qr_scan', 'photo_vision', 'voice'): How transaction was initiated
- `photo_evidence_url` (TEXT, NULLABLE): Link to Supabase Storage photo
- `voice_session_id` (UUID, NULLABLE): Link to voice session
- `voice_transcript` (TEXT, NULLABLE): Voice command used
- `notes` (TEXT, NULLABLE): Additional context
- `cost_data` (JSONB, NULLABLE): {estimated_vlm_cost, estimated_llm_cost, actual_cost}
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())

**Indexes**:
- PRIMARY KEY (id)
- INDEX (company_id, type, created_at DESC) - Transaction history queries
- INDEX (performer_id, created_at DESC) - User activity log
- INDEX (job_id) - Job cost tracking
- GIN INDEX (item_ids) - Fast array containment queries

**RLS Policy**:
```sql
CREATE POLICY "tenant_isolation" ON inventory_transactions
  FOR ALL USING (
    company_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
  );

-- Technicians can only view their own transactions
CREATE POLICY "user_access" ON inventory_transactions
  FOR SELECT USING (
    performer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('supervisor', 'admin')
    )
  );
```

**Validation Rules**:
- `type='transfer'` → both `source_container_id` and `destination_container_id` required
- `type='check_out'` → `source_container_id` required, `destination_container_id` required
- `type='register'` → `destination_container_id` required (initial location)
- `item_ids` array must not be empty

---

### 5. purchase_receipts

**Purpose**: Stores supplier purchase documentation and OCR-extracted data.

**Fields**:
- `id` (UUID, PK): Unique identifier
- `company_id` (UUID, FK → companies.id, NOT NULL): Tenant isolation
- `vendor_name` (TEXT, NOT NULL): Supplier name
- `vendor_location` (TEXT, NULLABLE): Store address or location
- `purchase_date` (DATE, NOT NULL): Date of purchase
- `total_amount` (DECIMAL(10,2), NOT NULL): Receipt total
- `line_items` (JSONB[], NOT NULL): Array of {description, quantity, unit_price, total}
- `receipt_photo_url` (TEXT, NOT NULL): Original receipt photo
- `ocr_extracted_data` (JSONB, NOT NULL): Raw OCR output for debugging
- `ocr_confidence_scores` (JSONB): Per-field confidence {vendor: 0.95, date: 0.88, ...}
- `ocr_method` (ENUM: 'tesseract', 'gpt4_vision'): Which OCR was used
- `po_reference` (TEXT, NULLABLE): Matched purchase order number
- `assigned_job_id` (UUID, FK → jobs.id, NULLABLE): Job assignment
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `created_by` (UUID, FK → users.id, NOT NULL): User who processed receipt

**Indexes**:
- PRIMARY KEY (id)
- INDEX (company_id, purchase_date DESC) - Date-based queries
- INDEX (vendor_name) - Vendor history
- INDEX (assigned_job_id) - Job cost tracking

**RLS Policy**:
```sql
CREATE POLICY "tenant_isolation" ON purchase_receipts
  FOR ALL USING (
    company_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
  );
```

**Validation Rules**:
- `line_items` array must not be empty
- Sum of line_items totals should approximately equal `total_amount` (within 5% tolerance)

---

### 6. training_data_records

**Purpose**: Collects all photos, detections, and user corrections for model fine-tuning.

**Fields**:
- `id` (UUID, PK): Unique identifier
- `company_id` (UUID, FK → companies.id, NOT NULL): Tenant isolation
- `user_id` (UUID, FK → users.id, NOT NULL): Who provided the data
- `original_photo_url` (TEXT, NOT NULL): Full-resolution photo
- `yolo_detections` (JSONB, NOT NULL): {detections: [{bbox, label, confidence}, ...], inference_time_ms}
- `vlm_analysis` (JSONB, NULLABLE): {provider, model, detections, cost, tokens} (if VLM was used)
- `user_selections` (INTEGER[], NOT NULL): Detection numbers user selected (e.g., [1, 2, 5])
- `user_corrections` (JSONB[], NOT NULL): [{detection_num, original_label, corrected_label, bbox_adjustment}, ...]
- `user_exclusions` (JSONB[], NOT NULL): [{detection_num, label, reason}, ...] (filtered background objects)
- `context` (JSONB, NOT NULL): {gps_lat, gps_lng, location_type, transaction_intent, timestamp}
- `voice_transcript` (TEXT, NULLABLE): Associated voice command
- `quality_metrics` (JSONB): {retake_count, correction_count, user_satisfaction_rating}
- `created_record_ids` (UUID[], NOT NULL): inventory_items or transactions created from this data
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())

**Indexes**:
- PRIMARY KEY (id)
- INDEX (company_id, created_at DESC) - Chronological access
- GIN INDEX (context) - Filter by location_type, transaction_intent
- INDEX (created_at) WHERE vlm_analysis IS NOT NULL - Track VLM usage rate

**RLS Policy**:
```sql
CREATE POLICY "tenant_isolation" ON training_data_records
  FOR ALL USING (
    company_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
  );

-- Only admins can access training data for model retraining
CREATE POLICY "admin_only" ON training_data_records
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );
```

**Validation Rules**:
- `user_selections` must be subset of detection numbers in `yolo_detections`
- `created_record_ids` must not be empty (data must have resulted in records)

---

### 7. vision_training_annotations

**Purpose**: Stores corrected ground truth labels for YOLO fine-tuning export.

**Fields**:
- `id` (UUID, PK): Unique identifier
- `training_record_id` (UUID, FK → training_data_records.id, NOT NULL): Parent record
- `item_detection_number` (INTEGER, NOT NULL): Which detection (1-N) from photo
- `corrected_label` (TEXT, NOT NULL): Final ground truth label
- `corrected_bbox` (JSONB, NOT NULL): {x, y, width, height} in normalized coordinates (0-1)
- `correction_reason` (TEXT, NULLABLE): Why user corrected (e.g., "YOLO said 'backpack' but it's a sprayer")
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())

**Indexes**:
- PRIMARY KEY (id)
- INDEX (training_record_id) - Fast lookups per training record
- INDEX (corrected_label) - Export by class for YOLO training

**RLS Policy**:
```sql
-- Inherits from parent training_data_records via FK
CREATE POLICY "admin_only" ON vision_training_annotations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );
```

---

### 8. detection_confidence_thresholds

**Purpose**: Company-specific configuration for YOLO→VLM fallback behavior.

**Fields**:
- `id` (UUID, PK): Unique identifier
- `company_id` (UUID, FK → companies.id, NOT NULL, UNIQUE): One config per company
- `local_confidence_threshold` (DECIMAL(3,2), DEFAULT 0.70): Trigger VLM when below this
- `max_daily_vlm_requests` (INTEGER, DEFAULT 100): Hard cap on VLM calls per day
- `daily_cost_budget_cap` (DECIMAL(6,2), DEFAULT 10.00): Budget limit in USD
- `is_active` (BOOLEAN, DEFAULT TRUE): Whether enforcement is enabled
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

**Indexes**:
- PRIMARY KEY (id)
- UNIQUE (company_id)

**RLS Policy**:
```sql
CREATE POLICY "tenant_isolation" ON detection_confidence_thresholds
  FOR ALL USING (
    company_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
  );
```

**Validation Rules**:
- `local_confidence_threshold` must be between 0.0 and 1.0
- `daily_cost_budget_cap` must be > 0

---

### 9. background_filter_preferences

**Purpose**: Stores learned user/company preferences for auto-filtering background objects.

**Fields**:
- `id` (UUID, PK): Unique identifier
- `company_id` (UUID, FK → companies.id, NOT NULL): Tenant isolation
- `user_id` (UUID, FK → users.id, NULLABLE): User-specific preference (NULL = company-wide)
- `object_label` (TEXT, NOT NULL): What to filter (e.g., "cooler", "person", "wall")
- `action` (ENUM: 'always_exclude', 'always_include', 'ask'): Filter behavior
- `context_filters` (JSONB, NULLABLE): {location_type: 'field', transaction_intent: 'check_out'} (when to apply)
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, DEFAULT NOW())

**Indexes**:
- PRIMARY KEY (id)
- UNIQUE (company_id, user_id, object_label, context_filters) - Prevent duplicates
- INDEX (company_id, action) - Fast filtering lookup

**RLS Policy**:
```sql
CREATE POLICY "tenant_isolation" ON background_filter_preferences
  FOR ALL USING (
    company_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
  );

CREATE POLICY "user_access" ON background_filter_preferences
  FOR ALL USING (
    user_id IS NULL OR user_id = auth.uid()
  );
```

---

### 10. item_relationships

**Purpose**: Tracks connections between inventory items (accessories, parts, replacements).

**Fields**:
- `id` (UUID, PK): Unique identifier
- `parent_item_id` (UUID, FK → inventory_items.id, NOT NULL): Primary item
- `related_item_id` (UUID, FK → inventory_items.id, NOT NULL): Related item
- `relationship_type` (ENUM: 'accessory', 'part', 'alternative', 'replacement', 'upgrade'): Connection type
- `notes` (TEXT, NULLABLE): Additional context
- `created_at` (TIMESTAMPTZ, DEFAULT NOW())

**Indexes**:
- PRIMARY KEY (id)
- INDEX (parent_item_id) - Find accessories for item
- INDEX (related_item_id) - Reverse lookup

**RLS Policy**:
```sql
-- Inherits from parent inventory_items via FK
CREATE POLICY "tenant_isolation" ON item_relationships
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM inventory_items
      WHERE inventory_items.id = item_relationships.parent_item_id
        AND inventory_items.company_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'company_id')
    )
  );
```

**Validation Rules**:
- `parent_item_id` ≠ `related_item_id` (no self-references)
- Both items must belong to same company (enforced via trigger)

---

## Database Triggers

### 1. update_item_location_on_assignment

**Purpose**: Automatically update `inventory_items.current_location_id` when container assignments change.

```sql
CREATE OR REPLACE FUNCTION update_item_location()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status = 'active') THEN
    -- Update item location to new container
    UPDATE inventory_items
    SET current_location_id = NEW.container_id,
        updated_at = NOW()
    WHERE id = NEW.item_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.checked_out_at IS NOT NULL THEN
    -- Item was checked out, clear location
    UPDATE inventory_items
    SET current_location_id = NULL,
        updated_at = NOW()
    WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_item_location_trigger
AFTER INSERT OR UPDATE ON container_assignments
FOR EACH ROW EXECUTE FUNCTION update_item_location();
```

### 2. prevent_circular_container_hierarchy

**Purpose**: Prevent circular references in `containers.parent_container_id`.

```sql
CREATE OR REPLACE FUNCTION check_container_hierarchy()
RETURNS TRIGGER AS $$
DECLARE
  current_id UUID;
  depth INTEGER := 0;
  max_depth INTEGER := 10;
BEGIN
  IF NEW.parent_container_id IS NULL THEN
    RETURN NEW;
  END IF;

  current_id := NEW.parent_container_id;
  WHILE current_id IS NOT NULL AND depth < max_depth LOOP
    IF current_id = NEW.id THEN
      RAISE EXCEPTION 'Circular container hierarchy detected';
    END IF;

    SELECT parent_container_id INTO current_id
    FROM containers
    WHERE id = current_id;

    depth := depth + 1;
  END LOOP;

  IF depth >= max_depth THEN
    RAISE EXCEPTION 'Container hierarchy too deep (max 10 levels)';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_circular_hierarchy_trigger
BEFORE INSERT OR UPDATE ON containers
FOR EACH ROW EXECUTE FUNCTION check_container_hierarchy();
```

---

## JSONB Schemas

### inventory_items.images[]

```typescript
interface InventoryImage {
  url: string;              // Supabase Storage path
  aspect_ratio: number;     // Always 1.0 for 1:1 square crops
  crop_box?: {              // Original bounding box if cropped
    x: number;
    y: number;
    width: number;
    height: number;
  };
  is_primary: boolean;      // Exactly one must be true
  captured_at: string;      // ISO timestamp
  captured_by: string;      // User UUID
}
```

### inventory_items.specifications

```typescript
interface ItemSpecifications {
  model?: string;           // Manufacturer model number
  serial?: string;          // Serial number
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: 'in' | 'cm';
  };
  weight?: {
    value: number;
    unit: 'lb' | 'kg';
  };
  capacity?: {
    value: number;
    unit: string;           // 'gal', 'oz', 'lb', etc.
  };
}
```

### inventory_items.attributes

```typescript
interface ItemAttributes {
  brand?: string;
  color?: string;
  purchase_date?: string;   // ISO date
  purchase_price?: number;
  purchase_vendor?: string;
  warranty_expiry?: string; // ISO date
  condition?: 'new' | 'used' | 'refurbished';
  custom_fields?: Record<string, any>;
}
```

### purchase_receipts.line_items[]

```typescript
interface ReceiptLineItem {
  line_number: number;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
  matched_item_id?: string; // UUID if matched to existing inventory
}
```

### training_data_records.yolo_detections

```typescript
interface YoloDetections {
  detections: Array<{
    bbox: [number, number, number, number]; // [x, y, width, height]
    label: string;
    confidence: number;
    detection_number: number; // 1-indexed for user reference
  }>;
  inference_time_ms: number;
  model_version: string;
}
```

### training_data_records.vlm_analysis

```typescript
interface VlmAnalysis {
  provider: 'openai' | 'anthropic';
  model: string;
  detections: Array<{
    label: string;
    confidence: number;
    reasoning: string;
  }>;
  estimated_cost: number;
  tokens_used?: number;
  processing_time_ms: number;
}
```

---

## Migration Dependencies

This data model **extends** existing schema. Required existing tables:
- `companies` (from Phase 1: Core Infrastructure)
- `users` (from Phase 1: Core Infrastructure)
- `jobs` (from Phase 4: Job Execution)

New migration file: `supabase/migrations/050_inventory_vision_extend.sql`

Migration sequence:
1. Create ENUM types
2. Create tables in dependency order
3. Create indexes
4. Create RLS policies
5. Create triggers
6. Insert default data (detection_confidence_thresholds for existing companies)

---

**Data Model Complete**: 2025-09-29
**Next Step**: Generate API contracts in `/contracts/`