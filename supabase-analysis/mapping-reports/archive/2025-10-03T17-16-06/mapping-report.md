# Database to Codebase Mapping Report

Generated: 2025-10-03T17:03:45.447Z
Codebase Path: /mnt/c/Users/tetzler.KWW/OneDrive - Kaspar Companies/Documents/GitHub/jobeye

## Executive Summary

### Overview
- **Total Database Tables**: 157
- **Tables with Code References**: 49 (31%)
- **Unused Tables**: 108 (69%)
- **Code Quality Issues**: 74

### Key Findings
- ⚠️ **16 high-severity code quality issues** requiring immediate attention
- 📊 **11 tables contain data but have no code references**
- 🔧 **37 tables use direct database access** instead of repository pattern
- ✅ **28 tables follow repository pattern** (good practice)

## Table Usage Analysis

### Most Referenced Tables

| Table | References | Patterns | Operations |
|-------|------------|----------|------------|
| customers | 85 | api, service, repository, direct | select, insert, update... |
| jobs | 83 | api, service, repository, direct | select, update, insert... |
| schedule_events | 78 | repository, direct | select, insert, update... |
| day_plans | 57 | repository, direct | select, insert, update... |
| properties | 28 | api, service, repository, direct | select, update, delete... |
| users_extended | 25 | service, direct | update, select, rpc:exec_sql... |
| tenants | 24 | api, service, direct | select, update, insert... |
| equipment | 23 | api, repository, direct | select, insert, type... |
| kits | 20 | direct, repository | select, insert, delete... |
| kit_items | 18 | direct, repository | insert, select, update... |

### Code Quality Issues

| Severity | Type | Table | Description |
|----------|------|-------|-------------|
| 🔴 High | Direct DB Access | tenants | Table "tenants" has no repository and is accessed directly |
| 🔴 High | Direct DB Access | containers | Table "containers" has no repository and is accessed directly |
| 🔴 High | Direct DB Access | users | Table "users" has no repository and is accessed directly |
| 🔴 High | Direct DB Access | media_assets | Table "media_assets" has no repository and is accessed directly |
| 🔴 High | Direct DB Access | kit_assignments | Table "kit_assignments" has no repository and is accessed directly |
| 🔴 High | Direct DB Access | users_extended | Table "users_extended" has no repository and is accessed directly |
| 🔴 High | Direct DB Access | roles | Table "roles" has no repository and is accessed directly |
| 🔴 High | Direct DB Access | sync_queue | Table "sync_queue" has no repository and is accessed directly |
| 🔴 High | Direct DB Access | companies | Table "companies" has no repository and is accessed directly |
| 🔴 High | Direct DB Access | detected_items | Table "detected_items" has no repository and is accessed directly |
| 🔴 High | Direct DB Access | voice_sessions | Table "voice_sessions" has no repository and is accessed directly |
| 🔴 High | Direct DB Access | offline_queue | Table "offline_queue" has no repository and is accessed directly |
| 🔴 High | Direct DB Access | notes | Table "notes" has no repository and is accessed directly |
| 🔴 High | Direct DB Access | invoices | Table "invoices" has no repository and is accessed directly |
| 🔴 High | Direct DB Access | audit_logs | Table "audit_logs" has no repository and is accessed directly |

## Unused Tables Analysis

### Summary
- **Total Unused**: 108 tables
- **With Data**: 11 tables
- **Empty**: 97 tables

### Unused Tables with Data (Requires Review)

| Table | Row Count | Likely Reason |
|-------|-----------|---------------|
| notification_queue | 209 | No code references found |
| equipment_maintenance | 33 | No code references found |
| role_permissions | 25 | No code references found |
| permissions | 11 | No code references found |
| notifications | 6 | No code references found |
| ocr_documents | 1 | No code references found |
| ocr_jobs | 1 | No code references found |
| ocr_line_items | 1 | No code references found |
| ocr_note_entities | 1 | No code references found |
| vendor_aliases | 1 | No code references found |
| vendor_locations | 1 | No code references found |

## Detailed Table Mappings

Click on a table name to see detailed usage information.


### User Management Tables

<details>
<summary><b>roles</b> (3 references)</summary>

#### Access Patterns
- **Direct**: 3 files

#### File Locations

**Client call:**
- `scripts/analyze-tenancy-model.ts:95` (rpc:exec_sql)
- `scripts/deep-database-analysis.ts:110` (rpc:exec_sql)
- `scripts/query-rls-policies.ts:16` (rpc:exec_sql)

#### Operations Used
`rpc:exec_sql`

#### Table Relationships
*No foreign key relationships*

</details>

<details>
<summary><b>users</b> (15 references)</summary>

#### Access Patterns
- **Direct**: 4 files
- **Service**: 2 files

#### File Locations

**Client call:**
- `src/domains/auth/guards/auth-guard.tsx:136` (select)
- `src/domains/auth/guards/auth-guard.tsx:430` (select)
- `scripts/apply-mvp-tables-migration.ts:22` (rpc:exec_sql)
- *... and 10 more locations*

**Service:**
- `src/domains/job/services/checklist-verification-service.ts:590` (select)
- `src/domains/job/services/job-from-voice-service.ts:135` (select)

#### Operations Used
`select`, `rpc:exec_sql`

#### Table Relationships
- **Referenced by**: day_plans, notifications

</details>

<details>
<summary><b>users_extended</b> (25 references)</summary>

#### Access Patterns
- **Direct**: 5 files
- **Service**: 1 file

#### File Locations

**Service:**
- `src/domains/tenant/services/tenant-service.ts:568` (update)

**Client call:**
- `scripts/check-rls-status.ts:30` (select)
- `scripts/check-schema.ts:39` (select)
- `scripts/create-missing-tables.ts:52` (rpc:exec_sql)
- *... and 8 more locations*

**Migration:**
- `scripts/create-missing-tables.ts:53` (sql)
- `scripts/create-missing-tables.ts:53` (sql)
- `scripts/create-missing-tables.ts:105` (sql)
- *... and 10 more locations*

#### Operations Used
`update`, `select`, `rpc:exec_sql`, `sql`, `upsert`

#### Table Relationships
- **References**: tenants

</details>


### Customer & Properties Tables

<details>
<summary><b>customers</b> (85 references)</summary>

#### Access Patterns
- **Direct**: 32 files
- **Api**: 3 files
- **Service**: 2 files
- **Repository**: 1 file

#### File Locations

**Api route:**
- `src/app/api/demo-crud/route.ts:19` (select)
- `src/app/api/demo-crud/route.ts:53` (insert)
- `src/app/api/demo-crud/route.ts:68` (update)
- *... and 5 more locations*

**Service:**
- `src/domains/customer/services/customer-search-service.ts:221` (select)
- `src/domains/job/services/job-from-voice-service.ts:390` (select)
- `src/domains/job/services/job-from-voice-service.ts:401` (select)
- *... and 1 more locations*

**Repository:**
- `src/lib/repositories/customer.repository.ts:48` (select)
- `src/lib/repositories/customer.repository.ts:69` (select)
- `src/lib/repositories/customer.repository.ts:93` (select)
- *... and 2 more locations*

**Client call:**
- `scripts/check-customers-schema.ts:15` (select)
- `scripts/check-customers-schema.ts:37` (insert)
- `scripts/check-demo-customers.ts:16` (select)
- *... and 64 more locations*

**Migration:**
- `scripts/migrations/005-all-tables.ts:112` (sql)

#### Operations Used
`select`, `insert`, `update`, `rpc:exec_sql`, `delete`, `upsert`, `sql`

#### Table Relationships
- **References**: tenants, intake_sessions
- **Referenced by**: invoices, jobs, properties

</details>

<details>
<summary><b>tenants</b> (24 references)</summary>

#### Access Patterns
- **Direct**: 8 files
- **Service**: 2 files
- **Api**: 1 file

#### File Locations

**Api route:**
- `src/app/api/auth/register/route.ts:385` (select)
- `src/app/api/auth/register/route.ts:409` (select)
- `src/app/api/auth/register/route.ts:426` (select)

**Service:**
- `src/domains/tenant/services/subscription-service.ts:629` (update)
- `src/domains/tenant/services/tenant-service.ts:109` (insert)
- `src/domains/tenant/services/tenant-service.ts:173` (select)
- *... and 3 more locations*

**Client call:**
- `scripts/apply-mvp-tables-migration.ts:22` (rpc:exec_sql)
- `scripts/apply-mvp-tables-migration.ts:68` (rpc:exec_sql)
- `scripts/apply-mvp-tables-migration.ts:107` (rpc:exec_sql)
- *... and 12 more locations*

#### Operations Used
`select`, `update`, `insert`, `rpc:exec_sql`, `upsert`

#### Table Relationships
- **Referenced by**: audit_logs, companies, customers, equipment_maintenance, invoices, jobs, kit_assignments, kit_items, kit_variants, kits, notifications, ocr_note_entities, properties, role_permissions, users_extended, vendor_aliases, vendor_locations, vendors

</details>


### Jobs & Work Tables

<details>
<summary><b>job_assignments</b> (7 references)</summary>

#### Access Patterns
- **Api**: 2 files
- **Service**: 2 files

#### File Locations

**Api route:**
- `src/app/api/crew/jobs/today/route.ts:94` (select)
- `src/app/api/crew/status/route.ts:65` (select)

**Service:**
- `src/domains/crew/services/crew-workflow.service.ts:110` (select)
- `src/domains/crew/services/crew-workflow.service.ts:187` (select)
- `src/domains/supervisor/services/supervisor-workflow.service.ts:265` (insert)
- *... and 2 more locations*

#### Operations Used
`select`, `insert`

#### Table Relationships
*No foreign key relationships*

</details>

<details>
<summary><b>job_checklist_items</b> (10 references)</summary>

#### Access Patterns
- **Service**: 3 files
- **Repository**: 1 file

#### File Locations

**Repository:**
- `src/domains/job/repositories/job-checklist-repository.ts:61` (select)
- `src/domains/job/repositories/job-checklist-repository.ts:94` (update)
- `src/domains/job/repositories/job-checklist-repository.ts:127` (update)

**Service:**
- `src/domains/job/services/checklist-verification-service.ts:462` (update)
- `src/domains/job/services/checklist-verification-service.ts:479` (update)
- `src/domains/job/services/job-from-voice-service.ts:189` (insert)
- *... and 4 more locations*

#### Operations Used
`select`, `update`, `insert`

#### Table Relationships
*No foreign key relationships*

</details>

<details>
<summary><b>job_equipment</b> (1 references)</summary>

#### Access Patterns
- **Service**: 1 file

#### File Locations

**Service:**
- `src/domains/crew/services/crew-workflow.service.ts:255` (select)

#### Operations Used
`select`

#### Table Relationships
*No foreign key relationships*

</details>

<details>
<summary><b>job_kits</b> (12 references)</summary>

#### Access Patterns
- **Repository**: 1 file

#### File Locations

**Repository:**
- `src/scheduling/repositories/job-kit.repository.ts:57` (select)
- `src/scheduling/repositories/job-kit.repository.ts:72` (select)
- `src/scheduling/repositories/job-kit.repository.ts:91` (select)
- *... and 9 more locations*

#### Operations Used
`select`, `insert`, `update`, `delete`

#### Table Relationships
*No foreign key relationships*

</details>

<details>
<summary><b>job_templates</b> (13 references)</summary>

#### Access Patterns
- **Direct**: 2 files
- **Service**: 1 file
- **Repository**: 1 file

#### File Locations

**Service:**
- `src/domains/job/services/job-from-voice-service.ts:362` (select)
- `src/domains/job/services/job-from-voice-service.ts:373` (select)
- `src/domains/job/services/job-from-voice-service.ts:473` (select)

**Repository:**
- `src/domains/job-templates/repositories/job-template-repository.ts:126` (insert)
- `src/domains/job-templates/repositories/job-template-repository.ts:200` (update)
- `src/domains/job-templates/repositories/job-template-repository.ts:233` (select)
- *... and 5 more locations*

**Client call:**
- `scripts/check-database-direct.ts:60` (select)
- `scripts/check-existing-equipment-structure.ts:80` (select)

#### Operations Used
`select`, `insert`, `update`

#### Table Relationships
*No foreign key relationships*

</details>

<details>
<summary><b>jobs</b> (83 references)</summary>

#### Access Patterns
- **Direct**: 27 files
- **Api**: 4 files
- **Service**: 4 files
- **Repository**: 1 file

#### File Locations

**Api route:**
- `src/app/api/crew/jobs/[jobId]/equipment/route.ts:107` (select)
- `src/app/api/crew/jobs/[jobId]/equipment/route.ts:158` (update)
- `src/app/api/crew/jobs/[jobId]/verify-load/route.ts:96` (update)
- *... and 2 more locations*

**Service:**
- `src/domains/crew/services/crew-workflow.service.ts:203` (update)
- `src/domains/crew/services/crew-workflow.service.ts:310` (update)
- `src/domains/crew/services/crew-workflow.service.ts:523` (update)
- *... and 6 more locations*

**Repository:**
- `src/domains/job/repositories/job-repository.ts:126` (insert)
- `src/domains/job/repositories/job-repository.ts:216` (update)
- `src/domains/job/repositories/job-repository.ts:254` (select)
- *... and 8 more locations*

**Client call:**
- `src/lib/offline/sync-manager.ts:230` (insert)
- `src/lib/offline/sync-manager.ts:237` (update)
- `src/lib/offline/sync-manager.ts:245` (delete)
- *... and 45 more locations*

**Migration:**
- `scripts/apply-mvp-tables-migration.ts:149` (sql)
- `scripts/apply-mvp-tables-migration.ts:153` (sql)
- `scripts/apply-mvp-tables-migration.ts:157` (sql)
- *... and 7 more locations*

#### Operations Used
`select`, `update`, `insert`, `delete`, `rpc:exec_sql`, `sql`, `upsert`

#### Table Relationships
- **References**: tenants, templates, customers, properties, voice_sessions, arrival_photos
- **Referenced by**: invoices

</details>


### Equipment & Materials Tables

<details>
<summary><b>equipment</b> (23 references)</summary>

#### Access Patterns
- **Direct**: 9 files
- **Api**: 1 file
- **Repository**: 1 file

#### File Locations

**Api route:**
- `src/app/api/vision/load-verifications/route.ts:148` (select)

**Repository:**
- `src/domains/equipment/repositories/equipment-repository.ts:120` (insert)
- `src/domains/equipment/repositories/equipment-repository.ts:175` (update)
- `src/domains/equipment/repositories/equipment-repository.ts:208` (select)
- *... and 7 more locations*

**Type definition:**
- `src/domains/equipment/repositories/equipment-repository.ts:145` (type)
- `src/domains/equipment/services/equipment-service.ts:201` (type)

**Client call:**
- `scripts/analyze-db-structure.ts:81` (select)
- `scripts/apply-mvp-tables-migration.ts:148` (rpc:exec_sql)
- `scripts/check-actual-column-types.ts:17` (rpc:exec_sql)
- *... and 7 more locations*

#### Operations Used
`select`, `insert`, `type`, `update`, `rpc:exec_sql`, `upsert`

#### Table Relationships
- **Referenced by**: equipment_maintenance

</details>

<details>
<summary><b>inventory_images</b> (6 references)</summary>

#### Access Patterns
- **Repository**: 1 file

#### File Locations

**Repository:**
- `src/domains/inventory/repositories/inventory-image-repository.ts:37` (select)
- `src/domains/inventory/repositories/inventory-image-repository.ts:69` (insert)
- `src/domains/inventory/repositories/inventory-image-repository.ts:97` (update)
- *... and 3 more locations*

#### Operations Used
`select`, `insert`, `update`, `delete`

#### Table Relationships
- **References**: companies, medias

</details>

<details>
<summary><b>inventory_items</b> (15 references)</summary>

#### Access Patterns
- **Direct**: 5 files
- **Api**: 1 file
- **Repository**: 1 file

#### File Locations

**Api route:**
- `src/app/api/supervisor/inventory/route.ts:150` (select)
- `src/app/api/supervisor/inventory/route.ts:192` (select)
- `src/app/api/supervisor/inventory/route.ts:291` (insert)

**Repository:**
- `src/domains/inventory/repositories/inventory-items.repository.ts:39` (select)
- `src/domains/inventory/repositories/inventory-items.repository.ts:58` (select)
- `src/domains/inventory/repositories/inventory-items.repository.ts:111` (insert)
- *... and 2 more locations*

**Client call:**
- `scripts/analyze-db-structure.ts:94` (select)
- `scripts/check-database-direct.ts:80` (select)
- `scripts/check-equipment-table-detail.ts:88` (select)
- *... and 4 more locations*

#### Operations Used
`select`, `insert`, `update`, `delete`

#### Table Relationships
*No foreign key relationships*

</details>

<details>
<summary><b>inventory_transactions</b> (2 references)</summary>

#### Access Patterns
- **Repository**: 1 file

#### File Locations

**Repository:**
- `src/domains/inventory/repositories/inventory-transactions.repository.ts:14` (insert)
- `src/domains/inventory/repositories/inventory-transactions.repository.ts:32` (select)

#### Operations Used
`insert`, `select`

#### Table Relationships
*No foreign key relationships*

</details>

<details>
<summary><b>materials</b> (11 references)</summary>

#### Access Patterns
- **Api**: 1 file
- **Repository**: 1 file
- **Direct**: 1 file

#### File Locations

**Api route:**
- `src/app/api/vision/load-verifications/route.ts:172` (select)

**Repository:**
- `src/domains/material/repositories/material-repository.ts:134` (insert)
- `src/domains/material/repositories/material-repository.ts:185` (update)
- `src/domains/material/repositories/material-repository.ts:218` (select)
- *... and 6 more locations*

**Client call:**
- `scripts/check-actual-column-types.ts:17` (rpc:exec_sql)

#### Operations Used
`select`, `insert`, `update`, `rpc:exec_sql`

#### Table Relationships
*No foreign key relationships*

</details>


### Voice & AI Tables

<details>
<summary><b>ai_interaction_logs</b> (11 references)</summary>

#### Access Patterns
- **Direct**: 4 files
- **Repository**: 1 file

#### File Locations

**Repository:**
- `src/domains/intent/repositories/ai-interaction-log.repository.ts:102` (insert)
- `src/domains/intent/repositories/ai-interaction-log.repository.ts:180` (select)
- `src/domains/intent/repositories/ai-interaction-log.repository.ts:289` (select)

**Client call:**
- `src/lib/offline/sync-manager.ts:292` (insert)
- `scripts/apply-mvp-tables-direct.ts:16` (select)
- `scripts/apply-mvp-tables-migration.ts:22` (rpc:exec_sql)
- *... and 5 more locations*

#### Operations Used
`insert`, `select`, `rpc:exec_sql`

#### Table Relationships
*No foreign key relationships*

</details>

<details>
<summary><b>container_assignments</b> (3 references)</summary>

#### Access Patterns
- **Repository**: 1 file

#### File Locations

**Repository:**
- `src/domains/inventory/repositories/container-assignments.repository.ts:14` (insert)
- `src/domains/inventory/repositories/container-assignments.repository.ts:30` (select)
- `src/domains/inventory/repositories/container-assignments.repository.ts:48` (update)

#### Operations Used
`insert`, `select`, `update`

#### Table Relationships
*No foreign key relationships*

</details>

<details>
<summary><b>containers</b> (8 references)</summary>

#### Access Patterns
- **Direct**: 4 files
- **Api**: 1 file
- **Service**: 1 file

#### File Locations

**Api route:**
- `src/app/api/vision/load-verifications/route.ts:124` (select)
- `src/app/api/vision/load-verifications/route.ts:328` (select)

**Service:**
- `src/domains/job/services/job-from-voice-service.ts:329` (select)

**Client call:**
- `scripts/analyze-db-structure.ts:85` (select)
- `scripts/apply-mvp-tables-migration.ts:148` (rpc:exec_sql)
- `scripts/check-mvp-tables.ts:16` (rpc:exec_sql)
- *... and 2 more locations*

#### Operations Used
`select`, `rpc:exec_sql`

#### Table Relationships
*No foreign key relationships*

</details>

<details>
<summary><b>conversation_sessions</b> (2 references)</summary>

#### Access Patterns
- **Api**: 1 file
- **Service**: 1 file

#### File Locations

**Api route:**
- `src/app/api/voice/intake/route.ts:94` (select)

**Service:**
- `src/domains/voice/services/voice-intake-service.ts:93` (select)

#### Operations Used
`select`

#### Table Relationships
*No foreign key relationships*

</details>

<details>
<summary><b>intent_classifications</b> (12 references)</summary>

#### Access Patterns
- **Direct**: 4 files
- **Repository**: 1 file

#### File Locations

**Repository:**
- `src/domains/intent/repositories/intent-classification.repository.ts:116` (insert)
- `src/domains/intent/repositories/intent-classification.repository.ts:189` (update)
- `src/domains/intent/repositories/intent-classification.repository.ts:250` (select)
- *... and 3 more locations*

**Client call:**
- `src/lib/offline/sync-manager.ts:303` (insert)
- `scripts/apply-mvp-tables-direct.ts:21` (select)
- `scripts/apply-mvp-tables-migration.ts:68` (rpc:exec_sql)
- *... and 3 more locations*

#### Operations Used
`insert`, `update`, `select`, `rpc:exec_sql`

#### Table Relationships
*No foreign key relationships*

</details>

<details>
<summary><b>invoices</b> (4 references)</summary>

#### Access Patterns
- **Direct**: 1 file

#### File Locations

**Client call:**
- `scripts/create-missing-tables.ts:215` (rpc:exec_sql)

**Migration:**
- `scripts/create-missing-tables.ts:216` (sql)
- `scripts/create-missing-tables.ts:216` (sql)
- `scripts/create-missing-tables.ts:216` (sql)

#### Operations Used
`rpc:exec_sql`, `sql`

#### Table Relationships
- **References**: tenants, customers, jobs

</details>

<details>
<summary><b>training_data_records</b> (3 references)</summary>

#### Access Patterns
- **Repository**: 1 file

#### File Locations

**Repository:**
- `src/domains/inventory/repositories/training-data.repository.ts:14` (insert)
- `src/domains/inventory/repositories/training-data.repository.ts:30` (select)
- `src/domains/inventory/repositories/training-data.repository.ts:47` (select)

#### Operations Used
`insert`, `select`

#### Table Relationships
*No foreign key relationships*

</details>

<details>
<summary><b>voice_sessions</b> (2 references)</summary>

#### Access Patterns
- **Direct**: 1 file

#### File Locations

**Client call:**
- `scripts/ci/rls-test-harness.ts:179` (select)
- `scripts/ci/rls-test-harness.ts:188` (select)

#### Operations Used
`select`

#### Table Relationships
- **Referenced by**: day_plans, jobs

</details>


### Vision & Media Tables

<details>
<summary><b>media_assets</b> (12 references)</summary>

#### Access Patterns
- **Service**: 3 files
- **Direct**: 1 file

#### File Locations

**Service:**
- `src/domains/job/services/checklist-verification-service.ts:217` (insert)
- `src/domains/vision/services/media-asset.service.ts:113` (insert)
- `src/domains/vision/services/media-asset.service.ts:173` (select)
- *... and 6 more locations*

**Client call:**
- `scripts/ci/rls-test-harness.ts:197` (select)
- `scripts/ci/rls-test-harness.ts:206` (select)
- `scripts/ci/rls-test-harness.ts:252` (delete)

#### Operations Used
`insert`, `select`, `delete`, `update`

#### Table Relationships
*No foreign key relationships*

</details>

<details>
<summary><b>vision_cost_records</b> (17 references)</summary>

#### Access Patterns
- **Direct**: 7 files
- **Repository**: 1 file

#### File Locations

**Repository:**
- `src/domains/vision/repositories/cost-record.repository.ts:40` (select)
- `src/domains/vision/repositories/cost-record.repository.ts:59` (select)
- `src/domains/vision/repositories/cost-record.repository.ts:104` (insert)
- *... and 4 more locations*

**Migration:**
- `scripts/apply-vision-cost-records-fixed.ts:20` (sql)

**Client call:**
- `scripts/apply-vision-cost-records-fixed.ts:78` (select)
- `scripts/apply-vision-migrations.ts:48` (select)
- `scripts/apply-vision-migrations.ts:127` (select)
- *... and 6 more locations*

#### Operations Used
`select`, `insert`, `sql`, `rpc:exec_sql`

#### Table Relationships
*No foreign key relationships*

</details>

<details>
<summary><b>vision_detected_items</b> (16 references)</summary>

#### Access Patterns
- **Direct**: 6 files
- **Repository**: 1 file

#### File Locations

**Repository:**
- `src/domains/vision/repositories/detected-item.repository.ts:33` (select)
- `src/domains/vision/repositories/detected-item.repository.ts:52` (select)
- `src/domains/vision/repositories/detected-item.repository.ts:97` (select)
- *... and 5 more locations*

**Client call:**
- `scripts/apply-vision-migrations.ts:43` (select)
- `scripts/apply-vision-migrations.ts:122` (select)
- `scripts/check-missing-tables.ts:16` (select)
- *... and 5 more locations*

#### Operations Used
`select`, `insert`, `update`, `delete`, `rpc:exec_sql`

#### Table Relationships
*No foreign key relationships*

</details>

<details>
<summary><b>vision_verifications</b> (17 references)</summary>

#### Access Patterns
- **Direct**: 4 files
- **Repository**: 1 file

#### File Locations

**Repository:**
- `src/domains/vision/repositories/vision-verification.repository.ts:37` (select)
- `src/domains/vision/repositories/vision-verification.repository.ts:89` (select)
- `src/domains/vision/repositories/vision-verification.repository.ts:146` (insert)
- *... and 4 more locations*

**Client call:**
- `scripts/check-vision-verifications-schema.ts:16` (insert)
- `scripts/check-vision-verifications-schema.ts:25` (insert)
- `scripts/test-vision-tables-integration.ts:18` (insert)
- *... and 5 more locations*

**Migration:**
- `scripts/verify-vision-retention.ts:45` (sql)
- `scripts/verify-vision-retention.ts:45` (sql)

#### Operations Used
`select`, `insert`, `update`, `delete`, `rpc:exec_sql`, `sql`

#### Table Relationships
*No foreign key relationships*

</details>


### Notifications Tables

<details>
<summary><b>offline_queue</b> (2 references)</summary>

#### Access Patterns
- **Direct**: 1 file

#### File Locations

**Client call:**
- `scripts/create-missing-tables.ts:17` (rpc:exec_sql)

**Migration:**
- `scripts/create-missing-tables.ts:18` (sql)

#### Operations Used
`rpc:exec_sql`, `sql`

#### Table Relationships
*No foreign key relationships*

</details>

<details>
<summary><b>offline_sync_queue</b> (17 references)</summary>

#### Access Patterns
- **Direct**: 3 files
- **Repository**: 1 file

#### File Locations

**Repository:**
- `src/domains/intent/repositories/offline-sync-queue.repository.ts:109` (insert)
- `src/domains/intent/repositories/offline-sync-queue.repository.ts:154` (select)
- `src/domains/intent/repositories/offline-sync-queue.repository.ts:190` (update)
- *... and 9 more locations*

**Client call:**
- `scripts/apply-mvp-tables-direct.ts:26` (select)
- `scripts/apply-mvp-tables-migration.ts:107` (rpc:exec_sql)
- `scripts/apply-mvp-tables-migration.ts:133` (rpc:exec_sql)
- *... and 2 more locations*

#### Operations Used
`insert`, `select`, `update`, `delete`, `rpc:exec_sql`

#### Table Relationships
*No foreign key relationships*

</details>

<details>
<summary><b>sync_queue</b> (4 references)</summary>

#### Access Patterns
- **Direct**: 2 files

#### File Locations

**Client call:**
- `scripts/apply-mvp-tables-migration.ts:107` (rpc:exec_sql)
- `scripts/apply-mvp-tables-migration.ts:133` (rpc:exec_sql)
- `scripts/apply-mvp-tables-migration.ts:137` (rpc:exec_sql)
- *... and 1 more locations*

#### Operations Used
`rpc:exec_sql`

#### Table Relationships
*No foreign key relationships*

</details>


### System & Audit Tables

<details>
<summary><b>audit_logs</b> (2 references)</summary>

#### Access Patterns
- **Direct**: 1 file

#### File Locations

**Client call:**
- `scripts/create-missing-tables.ts:327` (rpc:exec_sql)

**Migration:**
- `scripts/create-missing-tables.ts:328` (sql)

#### Operations Used
`rpc:exec_sql`, `sql`

#### Table Relationships
- **References**: tenants, entitys

</details>

<details>
<summary><b>kit_override_logs</b> (9 references)</summary>

#### Access Patterns
- **Direct**: 1 file
- **Repository**: 1 file

#### File Locations

**Client call:**
- `src/domains/repos/scheduling-kits/kit-override-log-repository.ts:21` (insert)

**Repository:**
- `src/scheduling/repositories/kit-override-log.repository.ts:67` (select)
- `src/scheduling/repositories/kit-override-log.repository.ts:82` (select)
- `src/scheduling/repositories/kit-override-log.repository.ts:130` (insert)
- *... and 5 more locations*

#### Operations Used
`insert`, `select`, `update`, `delete`

#### Table Relationships
*No foreign key relationships*

</details>


### Other Tables

<details>
<summary><b>companies</b> (13 references)</summary>

#### Access Patterns
- **Direct**: 9 files

#### File Locations

**Client call:**
- `scripts/check-actual-column-types.ts:17` (rpc:exec_sql)
- `scripts/check-companies-schema.ts:16` (select)
- `scripts/ci/rls-test-harness.ts:142` (select)
- *... and 8 more locations*

**Migration:**
- `scripts/create-uuid-tenant.ts:50` (sql)
- `scripts/create-uuid-tenant.ts:50` (sql)

#### Operations Used
`rpc:exec_sql`, `select`, `sql`, `upsert`

#### Table Relationships
- **References**: tenants
- **Referenced by**: day_plans, inventory_images, notification_queue, ocr_documents, ocr_jobs, ocr_line_items

</details>

<details>
<summary><b>crew_assignments</b> (11 references)</summary>

#### Access Patterns
- **Repository**: 1 file

#### File Locations

**Repository:**
- `src/scheduling/repositories/crew-assignment.repository.ts:53` (select)
- `src/scheduling/repositories/crew-assignment.repository.ts:68` (select)
- `src/scheduling/repositories/crew-assignment.repository.ts:110` (insert)
- *... and 8 more locations*

#### Operations Used
`select`, `insert`, `update`, `delete`

#### Table Relationships
*No foreign key relationships*

</details>

<details>
<summary><b>day_plans</b> (57 references)</summary>

#### Access Patterns
- **Direct**: 8 files
- **Repository**: 1 file

#### File Locations

**Repository:**
- `src/scheduling/repositories/day-plan.repository.ts:57` (select)
- `src/scheduling/repositories/day-plan.repository.ts:72` (select)
- `src/scheduling/repositories/day-plan.repository.ts:90` (select)
- *... and 8 more locations*

**Client call:**
- `scripts/test-rls-directly.ts:60` (insert)
- `scripts/test-rls-directly.ts:82` (select)
- `scripts/test-rls-directly.ts:95` (delete)
- *... and 43 more locations*

#### Operations Used
`select`, `insert`, `update`, `delete`

#### Table Relationships
- **References**: companies, users, voice_sessions

</details>

<details>
<summary><b>detected_items</b> (2 references)</summary>

#### Access Patterns
- **Direct**: 2 files

#### File Locations

**Client call:**
- `scripts/check-database-direct.ts:100` (select)
- `scripts/verify-feature-001-007-schema.ts:63` (rpc:exec_sql)

#### Operations Used
`select`, `rpc:exec_sql`

#### Table Relationships
*No foreign key relationships*

</details>

<details>
<summary><b>kit_assignments</b> (2 references)</summary>

#### Access Patterns
- **Direct**: 1 file

#### File Locations

**Client call:**
- `src/domains/repos/scheduling-kits/kit-assignment-repository.ts:32` (insert)
- `src/domains/repos/scheduling-kits/kit-assignment-repository.ts:46` (select)

#### Operations Used
`insert`, `select`

#### Table Relationships
- **References**: kits, variants, tenants

</details>

<details>
<summary><b>kit_items</b> (18 references)</summary>

#### Access Patterns
- **Direct**: 4 files
- **Repository**: 1 file

#### File Locations

**Client call:**
- `src/domains/repos/scheduling-kits/kit-repository.ts:113` (insert)
- `scripts/comprehensive-test-suite.ts:41` (select)
- `scripts/comprehensive-test-suite.ts:57` (select)
- *... and 5 more locations*

**Repository:**
- `src/scheduling/repositories/kit-item.repository.ts:50` (select)
- `src/scheduling/repositories/kit-item.repository.ts:65` (select)
- `src/scheduling/repositories/kit-item.repository.ts:97` (insert)
- *... and 7 more locations*

#### Operations Used
`insert`, `select`, `update`, `delete`, `rpc:exec_sql`, `upsert`

#### Table Relationships
- **References**: tenants, kits

</details>

<details>
<summary><b>kit_variants</b> (15 references)</summary>

#### Access Patterns
- **Direct**: 1 file
- **Repository**: 1 file

#### File Locations

**Client call:**
- `src/domains/repos/scheduling-kits/kit-variant-repository.ts:18` (select)
- `src/domains/repos/scheduling-kits/kit-variant-repository.ts:43` (insert)

**Repository:**
- `src/scheduling/repositories/kit-variant.repository.ts:50` (select)
- `src/scheduling/repositories/kit-variant.repository.ts:65` (select)
- `src/scheduling/repositories/kit-variant.repository.ts:104` (insert)
- *... and 10 more locations*

#### Operations Used
`select`, `insert`, `update`, `delete`

#### Table Relationships
- **References**: tenants, kits

</details>

<details>
<summary><b>kits</b> (20 references)</summary>

#### Access Patterns
- **Direct**: 3 files
- **Repository**: 1 file

#### File Locations

**Client call:**
- `src/domains/repos/scheduling-kits/kit-repository.ts:38` (select)
- `src/domains/repos/scheduling-kits/kit-repository.ts:52` (select)
- `src/domains/repos/scheduling-kits/kit-repository.ts:71` (select)
- *... and 4 more locations*

**Repository:**
- `src/scheduling/repositories/kit.repository.ts:55` (select)
- `src/scheduling/repositories/kit.repository.ts:70` (select)
- `src/scheduling/repositories/kit.repository.ts:88` (select)
- *... and 10 more locations*

#### Operations Used
`select`, `insert`, `delete`, `update`, `upsert`

#### Table Relationships
- **References**: tenants
- **Referenced by**: kit_assignments, kit_items, kit_variants

</details>

<details>
<summary><b>notes</b> (5 references)</summary>

#### Access Patterns
- **Direct**: 1 file

#### File Locations

**Client call:**
- `scripts/create-missing-tables.ts:52` (rpc:exec_sql)
- `scripts/create-missing-tables.ts:104` (rpc:exec_sql)
- `scripts/create-missing-tables.ts:160` (rpc:exec_sql)
- *... and 2 more locations*

#### Operations Used
`rpc:exec_sql`

#### Table Relationships
*No foreign key relationships*

</details>

<details>
<summary><b>properties</b> (28 references)</summary>

#### Access Patterns
- **Direct**: 6 files
- **Api**: 2 files
- **Service**: 1 file
- **Repository**: 1 file

#### File Locations

**Api route:**
- `src/app/api/supervisor/properties/[id]/route.ts:68` (select)
- `src/app/api/supervisor/properties/[id]/route.ts:135` (update)
- `src/app/api/supervisor/properties/[id]/route.ts:190` (delete)
- *... and 2 more locations*

**Service:**
- `src/domains/job/services/job-from-voice-service.ts:433` (select)
- `src/domains/job/services/job-from-voice-service.ts:448` (select)
- `src/domains/job/services/job-from-voice-service.ts:463` (select)

**Repository:**
- `src/domains/property/repositories/property-repository.ts:113` (insert)
- `src/domains/property/repositories/property-repository.ts:169` (select)
- `src/domains/property/repositories/property-repository.ts:190` (update)
- *... and 10 more locations*

**Client call:**
- `scripts/check-schema.ts:28` (select)
- `scripts/create-missing-tables.ts:281` (rpc:exec_sql)
- `scripts/create-test-fixtures.ts:55` (upsert)
- *... and 2 more locations*

**Migration:**
- `scripts/migrations/005-all-tables.ts:108` (sql)
- `scripts/migrations/005-all-tables.ts:109` (sql)

#### Operations Used
`select`, `update`, `delete`, `insert`, `rpc:find_properties_nearby`, `rpc:exec_sql`, `upsert`, `sql`

#### Table Relationships
- **References**: tenants, customers, intake_sessions, reference_images
- **Referenced by**: jobs

</details>

<details>
<summary><b>purchase_receipts</b> (3 references)</summary>

#### Access Patterns
- **Repository**: 1 file

#### File Locations

**Repository:**
- `src/domains/inventory/repositories/purchase-receipts.repository.ts:14` (insert)
- `src/domains/inventory/repositories/purchase-receipts.repository.ts:30` (select)
- `src/domains/inventory/repositories/purchase-receipts.repository.ts:47` (select)

#### Operations Used
`insert`, `select`

#### Table Relationships
*No foreign key relationships*

</details>

<details>
<summary><b>schedule_events</b> (78 references)</summary>

#### Access Patterns
- **Direct**: 7 files
- **Repository**: 1 file

#### File Locations

**Repository:**
- `src/scheduling/repositories/schedule-event.repository.ts:54` (select)
- `src/scheduling/repositories/schedule-event.repository.ts:69` (select)
- `src/scheduling/repositories/schedule-event.repository.ts:109` (insert)
- *... and 10 more locations*

**Client call:**
- `scripts/test-scheduling-comprehensive.ts:137` (insert)
- `scripts/test-scheduling-comprehensive.ts:159` (delete)
- `scripts/test-scheduling-comprehensive.ts:237` (select)
- *... and 62 more locations*

#### Operations Used
`select`, `insert`, `update`, `delete`

#### Table Relationships
*No foreign key relationships*

</details>

<details>
<summary><b>schedules</b> (1 references)</summary>

#### Access Patterns
- **Direct**: 1 file

#### File Locations

**Client call:**
- `scripts/create-missing-tables.ts:372` (rpc:exec_sql)

#### Operations Used
`rpc:exec_sql`

#### Table Relationships
*No foreign key relationships*

</details>

<details>
<summary><b>settings</b> (2 references)</summary>

#### Access Patterns
- **Service**: 1 file

#### File Locations

**Service:**
- `src/domains/tenant/services/subscription-service.ts:632` (rpc:jsonb_merge)
- `src/domains/tenant/services/subscription-service.ts:633` (rpc:get_tenant_settings)

#### Operations Used
`rpc:jsonb_merge`, `rpc:get_tenant_settings`

#### Table Relationships
*No foreign key relationships*

</details>

<details>
<summary><b>time_entries</b> (16 references)</summary>

#### Access Patterns
- **Repository**: 1 file
- **Direct**: 1 file

#### File Locations

**Repository:**
- `src/domains/time-tracking/repositories/time-entry.repository.ts:37` (select)
- `src/domains/time-tracking/repositories/time-entry.repository.ts:57` (select)
- `src/domains/time-tracking/repositories/time-entry.repository.ts:90` (select)
- *... and 8 more locations*

**Migration:**
- `scripts/migrations/005-all-tables.ts:101` (sql)
- `scripts/migrations/005-all-tables.ts:102` (sql)
- `scripts/migrations/005-all-tables.ts:103` (sql)
- *... and 2 more locations*

#### Operations Used
`select`, `insert`, `update`, `delete`, `sql`

#### Table Relationships
*No foreign key relationships*

</details>

<details>
<summary><b>vendors</b> (1 references)</summary>

#### Access Patterns
- **Direct**: 1 file

#### File Locations

**Migration:**
- `scripts/migrations/005-all-tables.ts:113` (sql)

#### Operations Used
`sql`

#### Table Relationships
- **References**: intake_sessions, tenants
- **Referenced by**: ocr_jobs, vendor_aliases, vendor_locations

</details>


## Recommendations

### Priority Actions

1. Review 11 tables with data but no code references: equipment_maintenance, notification_queue, notifications, ocr_documents, ocr_jobs...
2. Remove 97 empty tables with no code references
3. Create repositories for 16 tables with direct database access
4. Generate TypeScript types for 30 frequently used tables
5. Optimize access patterns for high-traffic tables: customers (85 refs), jobs (83 refs), schedule_events (78 refs), day_plans (57 refs), properties (28 refs)
6. Implement repository pattern for 21 tables currently using direct access

### Cleanup Script

```sql
-- Empty tables with no code references (97 tables)
DROP TABLE IF EXISTS public.ai_cost_tracking;
DROP TABLE IF EXISTS public.ai_models;
DROP TABLE IF EXISTS public.ai_prompts;
DROP TABLE IF EXISTS public.attachments;
DROP TABLE IF EXISTS public.audit_log_entries;
DROP TABLE IF EXISTS public.background_filter_preferences;
DROP TABLE IF EXISTS public.batch_operations;
DROP TABLE IF EXISTS public.billing_accounts;
DROP TABLE IF EXISTS public.break_logs;
DROP TABLE IF EXISTS public.calendar_events;
-- ... and 87 more tables
```


### Access Pattern Improvements

Based on the analysis, consider these architectural improvements:


#### Create Repositories For:
- `customers` (85 direct references)
- `jobs` (83 direct references)
- `schedule_events` (78 direct references)
- `day_plans` (57 direct references)
- `properties` (28 direct references)

---

## Appendix

### Understanding Access Patterns

- **Repository**: Table is accessed through a dedicated repository class (best practice)
- **Service**: Table is accessed through service layer (good for business logic)
- **API**: Table is accessed directly in API routes (consider moving to service/repository)
- **Direct**: Table is accessed directly using Supabase client (should be refactored)

### Understanding Code Quality Issues

- **Direct Access**: Database queries outside of repository pattern
- **Missing Repository**: No dedicated repository for frequently used table
- **Inconsistent Pattern**: Table accessed through multiple different patterns
- **Missing Types**: No TypeScript types defined for table structure
