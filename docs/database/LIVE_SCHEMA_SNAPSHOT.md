# Live Database Schema Snapshot
**Generated:** 2025-10-19
**Database:** jobeye (rtwigjwqufozqfwozpvo)
**Purpose:** Document actual production schema before refactoring task-item associations

## Executive Summary

### Critical Findings

1. **`job_tasks` table DOES NOT EXIST** - Referenced in specs but not in production
2. **Task-item associations have ZERO production usage:**
   - `task_template_item_associations`: 0 rows
   - `workflow_task_item_associations`: 0 rows
   - `workflow_tasks`: 0 rows
3. **No template-to-job propagation mechanism** - No triggers, functions, or foreign key usage
4. **`job_checklist_items` exists but disconnected** - No link to template system (3 rows total)

### Production Data Overview

| Table | Total Rows | Notes |
|-------|------------|-------|
| jobs | 71 | Active production data |
| items | 43 | Equipment/materials inventory |
| job_assignments | 16 | User-job mappings |
| kits | 6 | Item groupings |
| kit_items | 13 | Kit compositions |
| job_checklist_items | 3 | Minimal usage, no template link |
| task_templates | 1 | Single template exists |
| task_template_items | 1 | Single template item |
| task_template_item_associations | 0 | **UNUSED** |
| workflow_tasks | 0 | **UNUSED** |
| workflow_task_item_associations | 0 | **UNUSED** |

---

## Table Inventory

### 1. task_templates

**Purpose:** Define reusable job templates with associated tasks and items

**Columns:**
```
id                  uuid            NOT NULL  DEFAULT gen_random_uuid()  [PK]
tenant_id           uuid            NOT NULL                             [FK → tenants]
name                varchar         NOT NULL
description         text            NULL
job_type            varchar         NULL
is_active           boolean         NOT NULL  DEFAULT true
created_by          uuid            NULL                                 [FK → auth.users]
created_at          timestamptz     NOT NULL  DEFAULT now()
updated_at          timestamptz     NOT NULL  DEFAULT now()
thumbnail_url       text            NULL
medium_url          text            NULL
primary_image_url   text            NULL
```

**Constraints:**
- PK: `task_templates_pkey` (id)
- FK: `task_templates_tenant_id_fkey` → tenants(id) ON DELETE CASCADE
- FK: `task_templates_created_by_fkey` → auth.users(id)
- UNIQUE: `task_templates_name_tenant_unique` (tenant_id, name)

**RLS Policies:**
- `task_templates_tenant_isolation` (ALL): tenant_id matches JWT app_metadata

**Production Usage:** 1 row

---

### 2. task_template_items

**Purpose:** Individual task steps within a template (e.g., "Inspect fence", "Load tools")

**Columns:**
```
id                              uuid        NOT NULL  DEFAULT gen_random_uuid()  [PK]
template_id                     uuid        NOT NULL                             [FK → task_templates]
task_order                      integer     NOT NULL  DEFAULT 0
task_description                text        NOT NULL
is_required                     boolean     NOT NULL  DEFAULT true
requires_photo_verification     boolean     NOT NULL  DEFAULT false
requires_supervisor_approval    boolean     NOT NULL  DEFAULT false
acceptance_criteria             text        NULL
created_at                      timestamptz NOT NULL  DEFAULT now()
source_definition_id            uuid        NULL                                 [FK → task_definitions]
```

**Constraints:**
- PK: `task_template_items_pkey` (id)
- FK: `task_template_items_template_id_fkey` → task_templates(id) ON DELETE CASCADE
- FK: `task_template_items_source_definition_id_fkey` → task_definitions(id) ON DELETE SET NULL
- UNIQUE: `task_template_items_order_unique` (template_id, task_order)

**RLS Policies:**
- `task_template_items_tenant_isolation` (ALL): Via task_templates.tenant_id

**Production Usage:** 1 row

---

### 3. task_template_item_associations

**Purpose:** Link template tasks to required items/kits (template-level BOM)

**Columns:**
```
id               uuid        NOT NULL  DEFAULT uuid_generate_v4()  [PK]
tenant_id        uuid        NOT NULL                              [FK → tenants]
template_item_id uuid        NOT NULL                              [FK → task_template_items]
item_id          uuid        NULL                                  [FK → items]
kit_id           uuid        NULL                                  [FK → kits]
quantity         numeric     NOT NULL  DEFAULT 1
is_required      boolean     NOT NULL  DEFAULT true
notes            text        NULL
created_at       timestamptz NOT NULL  DEFAULT now()
updated_at       timestamptz NOT NULL  DEFAULT now()
```

**Constraints:**
- PK: `task_template_item_associations_pkey` (id)
- FK: `task_template_item_associations_template_item_id_fkey` → task_template_items(id) ON DELETE CASCADE
- FK: `task_template_item_associations_item_id_fkey` → items(id) ON DELETE RESTRICT
- FK: `task_template_item_associations_kit_id_fkey` → kits(id) ON DELETE RESTRICT
- FK: `task_template_item_associations_tenant_id_fkey` → tenants(id)
- CHECK: `task_template_item_associations_item_or_kit_check` - Exactly one of item_id/kit_id must be non-null
- CHECK: `task_template_item_associations_quantity_check` - quantity > 0
- UNIQUE: `task_template_item_associations_item_unique` (template_item_id, item_id)
- UNIQUE: `task_template_item_associations_kit_unique` (template_item_id, kit_id)

**RLS Policies:**
- `tenant_isolation` (ALL): tenant_id matches JWT app_metadata

**Triggers:**
- `set_updated_at`: Updates updated_at on row change

**Production Usage:** **0 rows** ⚠️

---

### 4. workflow_tasks

**Purpose:** Job-level task instances (copied from templates when job created)

**Columns:**
```
id                              uuid            NOT NULL  DEFAULT gen_random_uuid()  [PK]
tenant_id                       uuid            NOT NULL
job_id                          uuid            NOT NULL                             [FK → jobs]
task_description                text            NOT NULL
task_order                      integer         NOT NULL  DEFAULT 0
status                          text            NOT NULL  DEFAULT 'pending'
completed_by                    uuid            NULL                                 [FK → users_extended]
completed_at                    timestamptz     NULL
verification_photo_url          text            NULL
ai_confidence                   float8          NULL
requires_supervisor_review      boolean         NULL      DEFAULT false
supervisor_approved             boolean         NULL
supervisor_notes                text            NULL
created_at                      timestamptz     NULL      DEFAULT now()
updated_at                      timestamptz     NULL      DEFAULT now()
verification_method             text            NULL      DEFAULT 'manual'
verification_data               jsonb           NULL      DEFAULT '{}'
requires_supervisor_approval    boolean         NULL      DEFAULT false
user_id                         uuid            NULL                                 [FK → users_extended]
task_type                       text            NULL      DEFAULT 'verification'
supervisor_id                   uuid            NULL                                 [FK → users_extended]
is_required                     boolean         NOT NULL  DEFAULT true
is_deleted                      boolean         NOT NULL  DEFAULT false
template_id                     uuid            NULL                                 [FK → task_templates]
thumbnail_url                   text            NULL
medium_url                      text            NULL
primary_image_url               text            NULL
```

**Constraints:**
- PK: `workflow_tasks_pkey` (id)
- FK: `workflow_tasks_job_id_fkey` → jobs(id) ON DELETE CASCADE
- FK: `workflow_tasks_completed_by_fkey` → users_extended(id)
- FK: `workflow_tasks_supervisor_id_fkey` → users_extended(id)
- FK: `workflow_tasks_user_id_fkey` → users_extended(id)
- FK: `workflow_tasks_template_id_fkey` → task_templates(id)

**RLS Policies:**
- `workflow_tasks_tenant_isolation` (ALL): tenant_id matches JWT app_metadata

**Production Usage:** **0 rows** ⚠️

---

### 5. workflow_task_item_associations

**Purpose:** Job-level item tracking for workflow tasks (copied from template associations)

**Columns:**
```
id                              uuid            NOT NULL  DEFAULT uuid_generate_v4()  [PK]
tenant_id                       uuid            NOT NULL                              [FK → tenants]
workflow_task_id                uuid            NOT NULL                              [FK → workflow_tasks]
item_id                         uuid            NULL                                  [FK → items]
kit_id                          uuid            NULL                                  [FK → kits]
quantity                        numeric         NOT NULL  DEFAULT 1
is_required                     boolean         NOT NULL  DEFAULT true
status                          task_item_status NOT NULL DEFAULT 'pending'
loaded_at                       timestamptz     NULL
loaded_by                       uuid            NULL                                  [FK → auth.users]
notes                           text            NULL
source_template_association_id  uuid            NULL                                  [FK → task_template_item_associations]
created_at                      timestamptz     NOT NULL  DEFAULT now()
updated_at                      timestamptz     NOT NULL  DEFAULT now()
```

**Constraints:**
- PK: `workflow_task_item_associations_pkey` (id)
- FK: `workflow_task_item_associations_workflow_task_id_fkey` → workflow_tasks(id) ON DELETE CASCADE
- FK: `workflow_task_item_associations_item_id_fkey` → items(id) ON DELETE RESTRICT
- FK: `workflow_task_item_associations_kit_id_fkey` → kits(id) ON DELETE RESTRICT
- FK: `workflow_task_item_associations_loaded_by_fkey` → auth.users(id)
- FK: `workflow_task_item_associations_tenant_id_fkey` → tenants(id)
- FK: `workflow_task_item_associatio_source_template_association__fkey` → task_template_item_associations(id)
- CHECK: `workflow_task_item_associations_item_or_kit_check` - Exactly one of item_id/kit_id
- CHECK: `workflow_task_item_associations_quantity_check` - quantity > 0
- CHECK: `workflow_task_item_associations_loaded_check` - Both loaded_at and loaded_by must be set together
- UNIQUE: `workflow_task_item_associations_item_unique` (workflow_task_id, item_id)
- UNIQUE: `workflow_task_item_associations_kit_unique` (workflow_task_id, kit_id)

**RLS Policies:**
- `tenant_isolation` (ALL): tenant_id matches JWT app_metadata

**Triggers:**
- `set_updated_at`: Updates updated_at on row change
- `auto_set_loaded_timestamp`: Sets loaded_at/loaded_by when status changes

**Production Usage:** **0 rows** ⚠️

---

### 6. job_checklist_items

**Purpose:** Simple checklist for jobs (appears to be legacy or parallel system)

**Columns:**
```
id                  uuid        NOT NULL  DEFAULT uuid_generate_v4()  [PK]
job_id              uuid        NOT NULL                              [FK → jobs]
sequence_number     integer     NOT NULL
item_type           text        NULL
item_id             uuid        NOT NULL
item_name           text        NOT NULL
quantity            integer     NULL      DEFAULT 1
container_id        uuid        NULL
status              text        NULL      DEFAULT 'pending'
vlm_prompt          text        NULL
acceptance_criteria text        NULL
notes               text        NULL
created_at          timestamptz NULL      DEFAULT now()
updated_at          timestamptz NULL      DEFAULT now()
```

**Constraints:**
- PK: `job_checklist_items_pkey` (id)
- FK: `job_checklist_items_job_id_fkey` → jobs(id) ON DELETE CASCADE
- CHECK: `job_checklist_items_item_type_check` - item_type IN ('equipment', 'material')
- CHECK: `job_checklist_items_status_check` - status IN ('pending', 'loaded', 'verified', 'missing')
- UNIQUE: `job_checklist_sequence_unique` (job_id, sequence_number)

**RLS Policies:**
- `job_checklist_items_tenant_isolation` (ALL): Via jobs.tenant_id

**Triggers:**
- `set_updated_at_job_checklist_items`: Updates updated_at on row change

**Production Usage:** 3 rows (tenant: 550e8400-e29b-41d4-a716-446655440000)

**⚠️ Gap:** No foreign key or column linking to task_template_item_associations or workflow_task_item_associations

---

### 7. items

**Purpose:** Master inventory of equipment, materials, tools, consumables

**Columns (39 total):**
```
id                      uuid        NOT NULL  DEFAULT gen_random_uuid()  [PK]
tenant_id               uuid        NOT NULL
item_type               text        NOT NULL  CHECK IN ('equipment', 'material', 'consumable', 'tool')
category                text        NOT NULL
tracking_mode           text        NOT NULL  CHECK IN ('individual', 'quantity', 'batch')
name                    text        NOT NULL
description             text        NULL
manufacturer            text        NULL
model                   text        NULL
serial_number           text        NULL      UNIQUE (tenant_id, serial_number)
sku                     text        NULL      UNIQUE (tenant_id, sku)
barcode                 text        NULL      UNIQUE (tenant_id, barcode)
current_quantity        numeric     NULL      DEFAULT 0
unit_of_measure         text        NULL      DEFAULT 'each'
min_quantity            numeric     NULL
max_quantity            numeric     NULL
reorder_point           numeric     NULL
current_location_id     uuid        NULL
home_location_id        uuid        NULL
assigned_to_user_id     uuid        NULL
assigned_to_job_id      uuid        NULL
status                  text        NOT NULL  DEFAULT 'active'  CHECK IN ('active', 'maintenance', 'retired', 'lost', 'damaged')
condition               text        NULL      CHECK IN ('new', 'excellent', 'good', 'fair', 'poor')
last_maintenance_date   date        NULL
next_maintenance_date   date        NULL
purchase_date           date        NULL
purchase_price          numeric     NULL
current_value           numeric     NULL
depreciation_method     text        NULL
attributes              jsonb       NULL      DEFAULT '{}'
tags                    text[]      NULL
custom_fields           jsonb       NULL      DEFAULT '{}'
primary_image_url       text        NULL
image_urls              text[]      NULL
created_at              timestamptz NULL      DEFAULT now()
created_by              uuid        NULL
updated_at              timestamptz NULL      DEFAULT now()
updated_by              uuid        NULL
thumbnail_url           text        NULL
medium_url              text        NULL
```

**Constraints:**
- PK: `items_pkey` (id)
- UNIQUE: `items_tenant_id_barcode_key` (tenant_id, barcode)
- UNIQUE: `items_tenant_id_serial_number_key` (tenant_id, serial_number)
- UNIQUE: `items_tenant_id_sku_key` (tenant_id, sku)

**RLS Policies:**
- `items_tenant_isolation` (ALL, authenticated): tenant_id matches JWT
- `items_service_role` (ALL, public): For service_role access

**Production Usage:** 43 rows

---

### 8. jobs

**Purpose:** Core job/work order management

**Columns (54 total):**
```
id                              uuid            NOT NULL  DEFAULT uuid_generate_v4()  [PK]
tenant_id                       uuid            NOT NULL
job_number                      varchar         NOT NULL  UNIQUE (tenant_id, job_number)
template_id                     uuid            NULL                                   [FK → task_templates]
customer_id                     text            NOT NULL                               [FK → customers]
property_id                     uuid            NULL                                   [FK → properties]
title                           varchar         NOT NULL
description                     text            NULL
status                          job_status      NULL      DEFAULT 'draft'
priority                        job_priority    NULL      DEFAULT 'normal'
scheduled_start                 timestamptz     NULL
scheduled_end                   timestamptz     NULL
actual_start                    timestamptz     NULL
actual_end                      timestamptz     NULL
assigned_to                     uuid            NULL                                   [FK → users_extended]
assigned_team                   uuid[]          NULL
estimated_duration              integer         NULL
actual_duration                 integer         NULL
completion_notes                text            NULL
voice_notes                     text            NULL
voice_created                   boolean         NULL      DEFAULT false
voice_session_id                uuid            NULL
checklist_items                 jsonb           NULL      DEFAULT '[]'
materials_used                  jsonb           NULL      DEFAULT '[]'
equipment_used                  uuid[]          NULL
photos_before                   jsonb           NULL      DEFAULT '[]'
photos_after                    jsonb           NULL      DEFAULT '[]'
signature_required              boolean         NULL      DEFAULT false
signature_data                  jsonb           NULL
billing_info                    jsonb           NULL
metadata                        jsonb           NULL      DEFAULT '{}'
created_at                      timestamptz     NULL      DEFAULT now()
updated_at                      timestamptz     NULL      DEFAULT now()
created_by                      uuid            NULL                                   [FK → auth.users]
arrival_photo_id                uuid            NULL
arrival_confirmed_at            timestamptz     NULL
completion_quality_score        integer         NULL
requires_supervisor_review      boolean         NULL      DEFAULT false
arrival_timestamp               timestamptz     NULL
arrival_gps_coords              point           NULL
arrival_method                  varchar         NULL      CHECK IN ('gps_auto', 'gps_manual', 'manual')
arrival_confidence              varchar         NULL      CHECK IN ('high', 'medium', 'low', 'manual')
completion_timestamp            timestamptz     NULL
completion_photo_url            text            NULL
tool_reload_verified            boolean         NULL      DEFAULT false
offline_modified_at             timestamptz     NULL
offline_modified_by             uuid            NULL                                   [FK → auth.users]
special_instructions_audio      text            NULL
estimated_duration_minutes      integer         NULL
actual_duration_minutes         integer         NULL
completion_photo_urls           text[]          NULL
thumbnail_url                   text            NULL
medium_url                      text            NULL
primary_image_url               text            NULL
```

**Constraints:**
- PK: `jobs_pkey` (id)
- FK: `jobs_assigned_to_fkey` → users_extended(id)
- FK: `jobs_created_by_fkey` → auth.users(id)
- FK: `jobs_customer_id_fkey` → customers(id) ON DELETE SET NULL
- FK: `jobs_property_id_fkey` → properties(id)
- FK: `jobs_offline_modified_by_fkey` → auth.users(id)
- UNIQUE: `jobs_tenant_id_job_number_key` (tenant_id, job_number)

**RLS Policies:**
- `jobs_tenant_isolation` (ALL, authenticated): tenant_id matches JWT

**Triggers:**
- `update_jobs_updated_at`: Updates updated_at on row change
- `prevent_double_booking`: Validates job scheduling overlaps

**Production Usage:** 71 rows

**⚠️ Gap:** template_id column exists but **no jobs use it** (all NULL)

---

### 9. kits

**Purpose:** Predefined groupings of items (e.g., "Fence Repair Kit")

**Columns:**
```
id          uuid        NOT NULL  DEFAULT gen_random_uuid()  [PK]
tenant_id   text        NOT NULL
kit_code    varchar     NOT NULL
name        varchar     NOT NULL
description text        NULL
category    varchar     NULL
is_active   boolean     NOT NULL  DEFAULT true
metadata    jsonb       NOT NULL  DEFAULT '{}'
created_at  timestamptz NOT NULL  DEFAULT now()
updated_at  timestamptz NOT NULL  DEFAULT now()
```

**Production Usage:** 6 rows

---

### 10. kit_items

**Purpose:** Items that comprise a kit

**Production Usage:** 13 rows

---

### 11. job_assignments

**Purpose:** Many-to-many relationship between jobs and users

**Columns:**
```
id          uuid        NOT NULL  DEFAULT gen_random_uuid()  [PK]
tenant_id   uuid        NOT NULL                              [FK → tenants]
job_id      uuid        NOT NULL                              [FK → jobs]
user_id     uuid        NOT NULL                              [FK → auth.users]
assigned_by uuid        NULL                                  [FK → auth.users]
assigned_at timestamptz NULL      DEFAULT now()
created_at  timestamptz NULL      DEFAULT now()
updated_at  timestamptz NULL      DEFAULT now()
```

**Constraints:**
- PK: `job_assignments_pkey` (id)
- FK: `job_assignments_job_id_fkey` → jobs(id) ON DELETE CASCADE
- FK: `job_assignments_user_id_fkey` → auth.users(id) ON DELETE CASCADE
- FK: `job_assignments_assigned_by_fkey` → auth.users(id)
- FK: `job_assignments_tenant_id_fkey` → tenants(id)
- UNIQUE: `job_assignments_tenant_id_job_id_user_id_key` (tenant_id, job_id, user_id)

**RLS Policies:**
- `tenant_isolation` (ALL): tenant_id matches JWT
- `crew_view_own_assignments` (SELECT): User can see own + supervisor/admin/manager can see all
- `supervisor_insert_assignments` (INSERT): Only supervisor/admin/manager roles
- `supervisor_delete_assignments` (DELETE): Only supervisor/admin/manager roles

**Production Usage:** 16 rows

---

## Missing Tables

### job_tasks

**Status:** Referenced in specs/diagrams but **DOES NOT EXIST** in production database

**Expected Purpose:** Alternative or legacy name for workflow_tasks

---

## Template-to-Job Propagation Analysis

### No Automated Propagation Found

**Checked:**
1. ✅ Database triggers - None found for template propagation
2. ✅ Database functions - No `create_job_from_template` or similar
3. ✅ Foreign key usage - jobs.template_id exists but all NULL
4. ✅ Application logic - Not visible in database (would be in API/service layer)

### Current State

- Template system exists (task_templates, task_template_items, task_template_item_associations)
- Job execution tables exist (workflow_tasks, workflow_task_item_associations)
- **Zero production data flows through this system**
- Job checklist system (job_checklist_items) is separate and minimal

### Implications for Refactor

1. **Clean slate:** No production data to migrate from task/workflow association tables
2. **Template system unused:** Can redesign without breaking changes
3. **Job checklist orphaned:** Need to decide if this merges with new system or remains separate
4. **Application layer handles templating:** Likely creates jobs.checklist_items JSONB directly, bypassing relational model

---

## Enum Types

```sql
-- task_item_status (used by workflow_task_item_associations)
CREATE TYPE task_item_status AS ENUM ('pending', 'loaded', 'verified', 'missing');

-- job_status (used by jobs)
CREATE TYPE job_status AS ENUM ('draft', 'scheduled', 'in_progress', 'completed', 'cancelled');

-- job_priority (used by jobs)
CREATE TYPE job_priority AS ENUM ('low', 'normal', 'high', 'urgent');
```

---

## Views

### active_jobs_view

Joins jobs with customers, properties, and assigned users to show non-completed jobs.

---

## Summary of Schema Gaps

| Issue | Impact | Recommendation |
|-------|--------|----------------|
| `job_tasks` table missing | Specs reference non-existent table | Remove from specs or create |
| Task-item associations unused | 0 production rows | Safe to refactor/redesign |
| `workflow_tasks` unused | 0 production rows | Safe to refactor/redesign |
| No template propagation | jobs.template_id all NULL | Need to implement propagation logic |
| `job_checklist_items` orphaned | No FK to templates | Decide: merge with new system or keep separate |
| JSONB checklist used instead | jobs.checklist_items bypasses relational model | Migrate to relational if needed |

---

## Next Steps for Refactoring

1. **Confirm application layer logic** - How are jobs.checklist_items currently populated?
2. **Decide on job_tasks vs workflow_tasks** - Consolidate naming
3. **Design template propagation** - Trigger vs application layer vs stored procedure
4. **Plan job_checklist_items migration** - Merge into new system or deprecate
5. **Test with production-like data** - Current system is essentially untested

---

## Query Execution Log

All queries executed via Supabase MCP on 2025-10-19:

1. Schema introspection for 11 tables (columns, constraints, RLS)
2. Table discovery queries (task/item/job pattern matching)
3. Row count queries (total and by tenant)
4. Template propagation checks (template_id usage)
5. Trigger and view enumeration

**Database Connection:** jobeye project (rtwigjwqufozqfwozpvo)
**Timestamp:** 2025-10-19
**Tool:** Supabase MCP via Claude Code
