# JobEye v4 Extension - Multi-Object Vision with Container Awareness

## Overview
This extension builds upon the v4-voice-vision-checklists.md blueprint to support multi-object detection and container-based loading verification.

## 1. Schema Extensions

### 1.1 Container Management
```sql
-- Containers (vehicles, trailers, storage locations)
CREATE TABLE containers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  container_type text NOT NULL CHECK (container_type IN ('truck', 'van', 'trailer', 'storage_bin', 'ground')),
  identifier text NOT NULL, -- e.g., 'VH-TKR', 'TR-DU12R'
  name text NOT NULL, -- e.g., 'Red Truck', 'Black Lowboy'
  color text,
  capacity_info jsonb, -- dimensions, weight limits, etc.
  primary_image_url text,
  additional_image_urls text[],
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, identifier)
);

-- Reference images for inventory items
CREATE TABLE inventory_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('equipment', 'material')),
  item_id uuid NOT NULL, -- references equipment.id or materials.id
  image_url text NOT NULL,
  is_primary boolean DEFAULT false,
  angle text, -- 'front', 'side', 'top', etc.
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Job load list with container assignments
ALTER TABLE jobs ADD COLUMN default_container_id uuid REFERENCES containers(id);

-- Extend checklist items to include container assignment
CREATE TABLE job_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  sequence_number int NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('equipment', 'material')),
  item_id uuid NOT NULL,
  item_name text NOT NULL,
  quantity int DEFAULT 1,
  container_id uuid REFERENCES containers(id),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'loaded', 'verified', 'missing')),
  vlm_prompt text,
  acceptance_criteria text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(job_id, sequence_number)
);

-- Multi-object vision verifications
CREATE TABLE load_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  media_id uuid NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
  provider text NOT NULL,
  model_id text NOT NULL,
  
  -- Detected containers
  detected_containers jsonb DEFAULT '[]'::jsonb,
  /* Structure:
  [{
    container_id: string,
    confidence: number,
    bounding_box: {x, y, width, height}
  }]
  */
  
  -- Detected items with container associations
  detected_items jsonb DEFAULT '[]'::jsonb,
  /* Structure:
  [{
    item_type: 'equipment' | 'material',
    item_id: string,
    item_name: string,
    container_id: string,
    confidence: number,
    bounding_box: {x, y, width, height}
  }]
  */
  
  -- Verification results
  verified_checklist_items uuid[], -- job_checklist_items.id that were verified
  missing_items uuid[], -- job_checklist_items.id that were expected but not found
  unexpected_items jsonb, -- items found but not on checklist
  
  tokens_used int,
  cost_usd numeric(18,6),
  processing_time_ms int,
  created_at timestamptz DEFAULT now()
);
```

### 1.2 Indexes for Performance
```sql
CREATE INDEX idx_containers_company_active ON containers(company_id, is_active);
CREATE INDEX idx_inventory_images_item ON inventory_images(item_type, item_id);
CREATE INDEX idx_job_checklist_items_job ON job_checklist_items(job_id);
CREATE INDEX idx_load_verifications_job ON load_verifications(job_id);
```

### 1.3 RLS Policies
```sql
-- Containers: company isolation
CREATE POLICY containers_company_isolation ON containers
FOR ALL TO authenticated
USING (company_id = (SELECT company_id FROM users WHERE id = auth.uid()))
WITH CHECK (company_id = (SELECT company_id FROM users WHERE id = auth.uid()));

-- Similar policies for other new tables...
```

## 2. Extended Domain Services

### 2.1 Container Management Service
```typescript
// src/domains/equipment/services/container-service.ts
// --- AGENT DIRECTIVE BLOCK ---
// phase: 4
// domain: equipment-tracking
// purpose: Manage loading containers (vehicles, trailers, storage)
// --- END DIRECTIVE BLOCK ---

interface ContainerService {
  createContainer(data: ContainerCreate): Promise<Container>;
  updateContainer(id: string, data: ContainerUpdate): Promise<Container>;
  getDefaultContainer(companyId: string): Promise<Container | null>;
  getContainerByIdentifier(companyId: string, identifier: string): Promise<Container | null>;
  listActiveContainers(companyId: string): Promise<Container[]>;
}
```

### 2.2 Multi-Object Vision Analysis Service
```typescript
// src/domains/vision/services/multi-object-vision-service.ts
// --- AGENT DIRECTIVE BLOCK ---
// phase: 4
// domain: job-execution
// purpose: Analyze scenes for multiple items and containers
// estimated_llm_cost:
//   tokens_per_operation: 3000
//   operations_per_day: 1000
//   monthly_cost_usd: 90.00
// --- END DIRECTIVE BLOCK ---

interface MultiObjectVisionService {
  analyzeLoadingScene(
    imageData: string | Buffer,
    jobId: string,
    expectedItems: JobChecklistItem[]
  ): Promise<LoadVerification>;
  
  matchItemsToContainers(
    detectedObjects: DetectedObject[],
    knownContainers: Container[],
    knownItems: InventoryItem[]
  ): Promise<ItemContainerMatch[]>;
}
```

### 2.3 Job Load List Service
```typescript
// src/domains/jobs/services/job-load-list-service.ts
// --- AGENT DIRECTIVE BLOCK ---
// phase: 4
// domain: job-execution
// purpose: Manage job load lists with container assignments
// --- END DIRECTIVE BLOCK ---

interface JobLoadListService {
  createLoadList(
    jobId: string,
    items: LoadListItem[],
    defaultContainerId?: string
  ): Promise<JobChecklistItem[]>;
  
  updateItemContainer(
    jobId: string,
    itemId: string,
    containerId: string
  ): Promise<void>;
  
  processLoadVerification(
    jobId: string,
    verification: LoadVerification
  ): Promise<LoadListStatus>;
}
```

## 3. VLM Prompts for Multi-Object Detection

### 3.1 Scene Analysis Prompt
```typescript
const MULTI_OBJECT_PROMPT = `
Analyze this image of a loading operation. Identify:

1. CONTAINERS/VEHICLES:
   - Trucks (note color and any visible identifiers)
   - Trailers (type, color, identifiers)
   - Storage bins or areas
   - Ground/general area

2. EQUIPMENT/MATERIALS being loaded:
   - Power tools (chainsaws, mowers, trimmers, etc.)
   - Hand tools
   - Materials (pipes, fittings, chemicals)
   - Safety equipment

3. For each item, specify:
   - What it is
   - Which container it's in/on
   - Confidence level (0-1)
   - Any visible labels or identifiers

Known containers for reference:
${containers.map(c => `- ${c.name} (${c.identifier}): ${c.container_type}, ${c.color}`).join('\n')}

Expected items:
${expectedItems.map(i => `- ${i.quantity}x ${i.item_name}`).join('\n')}

Return a structured JSON response.
`;
```

### 3.2 Reference Image Comparison
```typescript
const REFERENCE_COMPARISON_PROMPT = `
Compare the items in this scene to these reference images:

Reference Containers:
${containers.map(c => `- ${c.name}: [image ${c.primary_image_url}]`).join('\n')}

Reference Items:
${items.map(i => `- ${i.name}: [image ${i.primary_image_url}]`).join('\n')}

Identify which reference items appear in which reference containers.
Note any items that don't match references.
`;
```

## 4. Client UI Updates

### 4.1 Job Load List Creation
```typescript
// src/app/(app)/jobs/create/load-list.tsx
interface LoadListCreationUI {
  // Voice or manual item selection
  // Container assignment per item
  // Default container selection
  // Visual preview of containers
}
```

### 4.2 Field Verification UI
```typescript
// src/app/(app)/jobs/[id]/verify-loading.tsx
interface LoadingVerificationUI {
  // Camera preview at top
  // Real-time detection overlay
  // Checklist below with container assignments
  // Auto-check as items detected
  // Manual override options
  // Container mismatch warnings
}
```

## 5. API Endpoints

### 5.1 Multi-Object Verification
```typescript
POST /api/jobs/{jobId}/verify-loading
Body: {
  media_id: string;
  manual_overrides?: {
    item_id: string;
    container_id: string;
    present: boolean;
  }[];
}
Response: {
  verified_items: string[];
  missing_items: string[];
  misplaced_items: Array<{
    item_id: string;
    expected_container: string;
    actual_container: string;
  }>;
  unknown_items: Array<{
    description: string;
    container: string;
  }>;
}
```

## 6. Testing Strategy

### 6.1 Multi-Object Detection Tests
```typescript
// Test scenarios:
// 1. Multiple items in single container
// 2. Items spread across multiple containers
// 3. Wrong container assignments
// 4. Missing required items
// 5. Extra unexpected items
// 6. Partial view/occlusion handling
```

## 7. Migration Path

1. **Phase 1**: Add container management
   - Create containers table and UI
   - Allow container assignment during job creation
   - Default container logic

2. **Phase 2**: Enhance inventory with images
   - Add reference images to equipment/materials
   - Create image management UI

3. **Phase 3**: Implement multi-object vision
   - Build multi-object vision service
   - Create VLM prompt templates
   - Test with real images

4. **Phase 4**: Update client experience
   - New loading verification UI
   - Real-time detection overlay
   - Auto-completion logic

5. **Phase 5**: Production rollout
   - Feature flag: ENABLE_MULTI_OBJECT_VISION
   - Gradual rollout by company
   - Monitor accuracy metrics