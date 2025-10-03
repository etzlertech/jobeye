# Supabase Analysis Report

Generated: 2025-10-03T13:26:27.567Z
Database: https://rtwigjwqufozqfwozpvo.supabase.co

## Executive Summary

### Database Overview
- **Total Tables**: 17
- **Total Rows**: 243
- **Tables without RLS**: 17
- **Orphaned Tables**: 9
- **Views**: 0
- **Functions**: 0
- **Enums**: 0

### Storage Overview  
- **Total Buckets**: 4
- **Total Files**: 0
- **Total Size**: 0 Bytes
- **Public Buckets**: 2
- **Empty Buckets**: 4

## AI Agent Instructions

This report provides comprehensive analysis of the Supabase database and storage. Use this information to:

1. **Identify Cleanup Opportunities**:
   - Remove orphaned tables listed in section 2.5
   - Delete unused functions with 'test_', 'temp_', or 'backup_' prefixes
   - Clean up empty storage buckets
   - Archive or remove large files that haven't been accessed recently

2. **Security Improvements**:
   - Enable RLS on all tables listed in section 2.4
   - Review public storage buckets for sensitive data
   - Add missing RLS policies to storage buckets

3. **Performance Optimizations**:
   - Add indexes to foreign key columns without indexes
   - Review tables with high row counts for partitioning needs
   - Optimize large files in storage

4. **Schema Mapping**:
   - Use the detailed table schemas in section 2.1 for API development
   - Reference foreign key relationships for join operations
   - Check column constraints when implementing validation



## Database Analysis
### 2.1 Tables (17 total)

| Table Name | Rows | Columns | RLS | Primary Key | Description |
|------------|------|---------|-----|-------------|-------------|
| customers | 84 | 19 | ❌ | id | Customer data |
| jobs | 50 | 51 | ❌ | id | Job tracking |
| properties | 35 | 22 | ❌ | id | Domain data |
| equipment_maintenance | 33 | 13 | ❌ | id | Equipment tracking |
| role_permissions | 25 | 9 | ❌ | id | Domain data |
| audit_logs | 11 | 10 | ❌ | id | System logging |
| companies | 5 | 7 | ❌ | id | Domain data |
| equipment | 0 | 3 | ❌ | id | Equipment tracking |
| materials | 0 | 3 | ❌ | id | Material inventory |
| voice_sessions | 0 | 3 | ❌ | id | Voice interactions |
| voice_transcripts | 0 | 3 | ❌ | id | Voice interactions |
| vision_cost_records | 0 | 3 | ❌ | id | Vision/image processing |
| detection_confidence_thresholds | 0 | 3 | ❌ | id | Domain data |
| job_templates | 0 | 3 | ❌ | id | Job tracking |
| mobile_sessions | 0 | 3 | ❌ | id | Domain data |
| offline_queue | 0 | 3 | ❌ | id | Domain data |
| media_assets | 0 | 3 | ❌ | id | Domain data |

### 2.2 Table Schemas

#### audit_logs

**Row Count**: 11 | **RLS**: Disabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| tenant_id | uuid | No | - | Foreign key reference |
| entity_type | varchar | Yes | - | Data field |
| entity_id | uuid | No | - | Foreign key reference |
| action | varchar | Yes | - | Data field |
| performed_by | varchar | Yes | - | Data field |
| details | varchar | Yes | - | Data field |
| ip_address | varchar | Yes | - | Data field |
| user_agent | varchar | Yes | - | Data field |
| created_at | timestamp | No | now() | Record creation timestamp |

**Foreign Keys**:
- tenant_id → tenants.id (RESTRICT)
- entity_id → entitys.id (RESTRICT)
- tenant_id → companies.id (CASCADE)

#### companies

**Row Count**: 5 | **RLS**: Disabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| tenant_id | uuid | No | - | Foreign key reference |
| name | varchar | Yes | - | Display name |
| created_at | timestamp | No | now() | Record creation timestamp |
| updated_at | timestamp | Yes | - | Last modification timestamp |
| domain | varchar | Yes | - | Data field |
| is_active | boolean | Yes | - | Flag/toggle |

**Foreign Keys**:
- tenant_id → tenants.id (RESTRICT)

#### customers

**Row Count**: 84 | **RLS**: Disabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| tenant_id | uuid | No | - | Foreign key reference |
| customer_number | integer | Yes | - | Numeric value |
| name | varchar | Yes | - | Display name |
| email | varchar | Yes | - | Email address |
| phone | varchar | Yes | - | Phone number |
| mobile_phone | varchar | Yes | - | Data field |
| billing_address | varchar | Yes | - | Data field |
| service_address | varchar | Yes | - | Data field |
| notes | text | Yes | - | Data field |
| tags | varchar | Yes | - | Data field |
| voice_notes | text | Yes | - | Data field |
| is_active | boolean | Yes | - | Flag/toggle |
| metadata | jsonb | Yes | - | Structured data |
| created_at | timestamp | No | now() | Record creation timestamp |
| updated_at | timestamp | Yes | - | Last modification timestamp |
| created_by | varchar | Yes | - | User who created record |
| version | varchar | Yes | - | Data field |
| intake_session_id | uuid | No | - | Foreign key reference |

**Foreign Keys**:
- tenant_id → tenants.id (RESTRICT)
- intake_session_id → intake_sessions.id (RESTRICT)
- tenant_id → companies.id (CASCADE)

#### detection_confidence_thresholds

**Row Count**: 0 | **RLS**: Disabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | gen_random_uuid() | Primary identifier |
| tenant_id | uuid | No | - | Foreign key reference |
| created_at | timestamp | No | now() | Record creation timestamp |

**Foreign Keys**:
- tenant_id → tenants.id (RESTRICT)
- tenant_id → companies.id (CASCADE)

#### equipment

**Row Count**: 0 | **RLS**: Disabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | gen_random_uuid() | Primary identifier |
| tenant_id | uuid | No | - | Foreign key reference |
| created_at | timestamp | No | now() | Record creation timestamp |

**Foreign Keys**:
- tenant_id → tenants.id (RESTRICT)
- tenant_id → companies.id (CASCADE)

#### equipment_maintenance

**Row Count**: 33 | **RLS**: Disabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| company_id | uuid | No | - | Foreign key reference |
| equipment_id | uuid | No | - | Foreign key reference |
| performed_by | varchar | Yes | - | Data field |
| maintenance_type | varchar | Yes | - | Data field |
| maintenance_date | timestamp | Yes | - | Date/time value |
| actions_performed | varchar | Yes | - | Data field |
| pre_maintenance_verification_id | uuid | No | - | Foreign key reference |
| post_maintenance_verification_id | uuid | No | - | Foreign key reference |
| status | varchar | Yes | - | Current status/state |
| completion_date | timestamp | Yes | - | Date/time value |
| notes | text | Yes | - | Data field |
| created_at | timestamp | No | now() | Record creation timestamp |

**Foreign Keys**:
- company_id → companys.id (RESTRICT)
- equipment_id → equipments.id (RESTRICT)
- pre_maintenance_verification_id → pre_maintenance_verifications.id (RESTRICT)
- post_maintenance_verification_id → post_maintenance_verifications.id (RESTRICT)

#### job_templates

**Row Count**: 0 | **RLS**: Disabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | gen_random_uuid() | Primary identifier |
| tenant_id | uuid | No | - | Foreign key reference |
| created_at | timestamp | No | now() | Record creation timestamp |

**Foreign Keys**:
- tenant_id → tenants.id (RESTRICT)
- tenant_id → companies.id (CASCADE)

#### jobs

**Row Count**: 50 | **RLS**: Disabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| tenant_id | uuid | No | - | Foreign key reference |
| job_number | integer | Yes | - | Numeric value |
| template_id | uuid | No | - | Foreign key reference |
| customer_id | uuid | No | - | Foreign key reference |
| property_id | uuid | No | - | Foreign key reference |
| title | varchar | Yes | - | Data field |
| description | text | Yes | - | Detailed description |
| status | varchar | Yes | - | Current status/state |
| priority | varchar | Yes | - | Data field |
| scheduled_start | varchar | Yes | - | Data field |
| scheduled_end | varchar | Yes | - | Data field |
| actual_start | varchar | Yes | - | Data field |
| actual_end | varchar | Yes | - | Data field |
| assigned_to | varchar | Yes | - | Data field |
| assigned_team | varchar | Yes | - | Data field |
| estimated_duration | varchar | Yes | - | Data field |
| actual_duration | varchar | Yes | - | Data field |
| completion_notes | text | Yes | - | Data field |
| voice_notes | text | Yes | - | Data field |
| voice_created | varchar | Yes | - | Data field |
| voice_session_id | uuid | No | - | Foreign key reference |
| checklist_items | varchar | Yes | - | Data field |
| materials_used | varchar | Yes | - | Data field |
| equipment_used | varchar | Yes | - | Data field |
| photos_before | varchar | Yes | - | Data field |
| photos_after | varchar | Yes | - | Data field |
| signature_required | varchar | Yes | - | Data field |
| signature_data | jsonb | Yes | - | Structured data |
| billing_info | varchar | Yes | - | Data field |
| metadata | jsonb | Yes | - | Structured data |
| created_at | timestamp | No | now() | Record creation timestamp |
| updated_at | timestamp | Yes | - | Last modification timestamp |
| created_by | varchar | Yes | - | User who created record |
| arrival_photo_id | uuid | No | - | Foreign key reference |
| arrival_confirmed_at | varchar | Yes | - | Data field |
| completion_quality_score | varchar | Yes | - | Data field |
| requires_supervisor_review | varchar | Yes | - | Data field |
| arrival_timestamp | varchar | Yes | - | Data field |
| arrival_gps_coords | varchar | Yes | - | Data field |
| arrival_method | varchar | Yes | - | Data field |
| arrival_confidence | varchar | No | - | Data field |
| completion_timestamp | varchar | Yes | - | Data field |
| completion_photo_url | varchar | Yes | - | Data field |
| tool_reload_verified | varchar | Yes | - | Data field |
| offline_modified_at | varchar | Yes | - | Data field |
| offline_modified_by | varchar | Yes | - | Data field |
| special_instructions_audio | varchar | Yes | - | Data field |
| estimated_duration_minutes | varchar | Yes | - | Data field |
| actual_duration_minutes | varchar | Yes | - | Data field |
| completion_photo_urls | varchar | Yes | - | Data field |

**Foreign Keys**:
- tenant_id → tenants.id (RESTRICT)
- template_id → templates.id (RESTRICT)
- customer_id → customers.id (RESTRICT)
- property_id → propertys.id (RESTRICT)
- voice_session_id → voice_sessions.id (RESTRICT)
- arrival_photo_id → arrival_photos.id (RESTRICT)
- tenant_id → companies.id (CASCADE)

#### materials

**Row Count**: 0 | **RLS**: Disabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | gen_random_uuid() | Primary identifier |
| tenant_id | uuid | No | - | Foreign key reference |
| created_at | timestamp | No | now() | Record creation timestamp |

**Foreign Keys**:
- tenant_id → tenants.id (RESTRICT)
- tenant_id → companies.id (CASCADE)

#### media_assets

**Row Count**: 0 | **RLS**: Disabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | gen_random_uuid() | Primary identifier |
| tenant_id | uuid | No | - | Foreign key reference |
| created_at | timestamp | No | now() | Record creation timestamp |

**Foreign Keys**:
- tenant_id → tenants.id (RESTRICT)
- tenant_id → companies.id (CASCADE)

#### mobile_sessions

**Row Count**: 0 | **RLS**: Disabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | gen_random_uuid() | Primary identifier |
| tenant_id | uuid | No | - | Foreign key reference |
| created_at | timestamp | No | now() | Record creation timestamp |

**Foreign Keys**:
- tenant_id → tenants.id (RESTRICT)
- tenant_id → companies.id (CASCADE)

#### offline_queue

**Row Count**: 0 | **RLS**: Disabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | gen_random_uuid() | Primary identifier |
| tenant_id | uuid | No | - | Foreign key reference |
| created_at | timestamp | No | now() | Record creation timestamp |

**Foreign Keys**:
- tenant_id → tenants.id (RESTRICT)
- tenant_id → companies.id (CASCADE)

#### properties

**Row Count**: 35 | **RLS**: Disabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| tenant_id | uuid | No | - | Foreign key reference |
| customer_id | uuid | No | - | Foreign key reference |
| property_number | integer | Yes | - | Numeric value |
| name | varchar | Yes | - | Display name |
| address | varchar | Yes | - | Physical address |
| location | varchar | Yes | - | Data field |
| property_type | varchar | Yes | - | Data field |
| size_sqft | varchar | Yes | - | Data field |
| lot_size_acres | varchar | Yes | - | Data field |
| zones | varchar | Yes | - | Data field |
| access_notes | text | Yes | - | Data field |
| gate_code | varchar | Yes | - | Data field |
| special_instructions | varchar | Yes | - | Data field |
| voice_navigation_notes | text | Yes | - | Data field |
| photos | varchar | Yes | - | Data field |
| is_active | boolean | Yes | - | Flag/toggle |
| metadata | jsonb | Yes | - | Structured data |
| created_at | timestamp | No | now() | Record creation timestamp |
| updated_at | timestamp | Yes | - | Last modification timestamp |
| intake_session_id | uuid | No | - | Foreign key reference |
| reference_image_id | uuid | No | - | Foreign key reference |

**Foreign Keys**:
- tenant_id → tenants.id (RESTRICT)
- customer_id → customers.id (RESTRICT)
- intake_session_id → intake_sessions.id (RESTRICT)
- reference_image_id → reference_images.id (RESTRICT)
- tenant_id → companies.id (CASCADE)

#### role_permissions

**Row Count**: 25 | **RLS**: Disabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| role | varchar | Yes | - | Data field |
| permission_id | uuid | No | - | Foreign key reference |
| tenant_id | uuid | No | - | Foreign key reference |
| granted_by | varchar | Yes | - | Data field |
| granted_at | varchar | Yes | - | Data field |
| expires_at | varchar | Yes | - | Data field |
| is_active | boolean | Yes | - | Flag/toggle |
| conditions | varchar | Yes | - | Data field |

**Foreign Keys**:
- permission_id → permissions.id (RESTRICT)
- tenant_id → tenants.id (RESTRICT)
- tenant_id → companies.id (CASCADE)

#### vision_cost_records

**Row Count**: 0 | **RLS**: Disabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | gen_random_uuid() | Primary identifier |
| tenant_id | uuid | No | - | Foreign key reference |
| created_at | timestamp | No | now() | Record creation timestamp |

**Foreign Keys**:
- tenant_id → tenants.id (RESTRICT)
- tenant_id → companies.id (CASCADE)

#### voice_sessions

**Row Count**: 0 | **RLS**: Disabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | gen_random_uuid() | Primary identifier |
| tenant_id | uuid | No | - | Foreign key reference |
| created_at | timestamp | No | now() | Record creation timestamp |

**Foreign Keys**:
- tenant_id → tenants.id (RESTRICT)
- tenant_id → companies.id (CASCADE)

#### voice_transcripts

**Row Count**: 0 | **RLS**: Disabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | gen_random_uuid() | Primary identifier |
| tenant_id | uuid | No | - | Foreign key reference |
| created_at | timestamp | No | now() | Record creation timestamp |

**Foreign Keys**:
- tenant_id → tenants.id (RESTRICT)
- tenant_id → companies.id (CASCADE)

### 2.4 Tables Without RLS (17 total)

⚠️ **Security Risk**: These tables do not have Row Level Security enabled:

- companies
- audit_logs
- role_permissions
- customers
- properties
- equipment
- equipment_maintenance
- materials
- voice_sessions
- voice_transcripts
- vision_cost_records
- detection_confidence_thresholds
- job_templates
- jobs
- mobile_sessions
- offline_queue
- media_assets
### 2.5 Orphaned Tables (9 total)

🧹 **Cleanup Candidates**: These tables have no relationships and no data:

- equipment
- materials
- voice_transcripts
- vision_cost_records
- detection_confidence_thresholds
- job_templates
- mobile_sessions
- offline_queue
- media_assets

## Storage Analysis
### 3.1 Storage Buckets (4 total)

| Bucket | Public | Files | Size | RLS Policies | Status |
|--------|--------|-------|------|--------------|--------|
| verification-photos | 🔒 No | 0 | 0 Bytes | 0 | 📭 Empty |
| job-photos | 🌐 Yes | 0 | 0 Bytes | 0 | 📭 Empty |
| voice-recordings | 🔒 No | 0 | 0 Bytes | 0 | 📭 Empty |
| equipment-images | 🌐 Yes | 0 | 0 Bytes | 0 | 📭 Empty |

### 3.4 Bucket Details

#### verification-photos
- **Public Access**: No
- **Total Files**: 0
- **Total Size**: 0 Bytes
- **Allowed Types**: image/jpeg, image/png, image/webp
- **Size Limit**: 10 MB

#### job-photos
- **Public Access**: Yes
- **Total Files**: 0
- **Total Size**: 0 Bytes
- **Allowed Types**: image/jpeg, image/png, image/webp
- **Size Limit**: 50 MB

#### voice-recordings
- **Public Access**: No
- **Total Files**: 0
- **Total Size**: 0 Bytes
- **Allowed Types**: audio/wav, audio/mp3, audio/mpeg, audio/ogg
- **Size Limit**: 10 MB

#### equipment-images
- **Public Access**: Yes
- **Total Files**: 0
- **Total Size**: 0 Bytes
- **Allowed Types**: image/jpeg, image/png, image/webp
- **Size Limit**: 50 MB


## Recommendations
### 4.1 Database Recommendations

- Enable RLS on the following tables for security: audit_logs, role_permissions, customers, properties, equipment, equipment_maintenance, materials, voice_sessions, voice_transcripts, vision_cost_records, detection_confidence_thresholds, job_templates, jobs, mobile_sessions, offline_queue, media_assets
- 10 tables have no data. Consider removing unused tables: equipment, materials, voice_sessions, voice_transcripts, vision_cost_records, ...
- The following tables may need tenant_id for multi-tenancy: equipment_maintenance
- The following tables are missing created_at timestamp: role_permissions

### 4.2 Storage Recommendations

- Remove 4 unused buckets: verification-photos, job-photos, voice-recordings, equipment-images
- Add RLS policies to 4 buckets without access control

### 4.3 Priority Actions

1. **Enable RLS on 17 tables** - Critical security risk
3. **Clean up 13 unused resources** - Free up space and reduce clutter

## Appendices
### A.1 API Endpoint Mapping Guide

Based on the analysis, here are suggested API endpoints for each major table:

**customers**:
- GET /api/customers - List all customers
- GET /api/customers/:id - Get single customer
- POST /api/customers - Create new customer
- PUT /api/customers/:id - Update customer
- DELETE /api/customers/:id - Delete customer
- Filters: ?tenant_id=value, ?intake_session_id=value, ?tenant_id=value

**jobs**:
- GET /api/jobs - List all jobs
- GET /api/jobs/:id - Get single job
- POST /api/jobs - Create new job
- PUT /api/jobs/:id - Update job
- DELETE /api/jobs/:id - Delete job
- Filters: ?tenant_id=value, ?template_id=value, ?customer_id=value, ?property_id=value, ?voice_session_id=value, ?arrival_photo_id=value, ?tenant_id=value

**properties**:
- GET /api/properties - List all properties
- GET /api/properties/:id - Get single property
- POST /api/properties - Create new property
- PUT /api/properties/:id - Update property
- DELETE /api/properties/:id - Delete property
- Filters: ?tenant_id=value, ?customer_id=value, ?intake_session_id=value, ?reference_image_id=value, ?tenant_id=value

**equipment_maintenance**:
- GET /api/equipment_maintenance - List all equipment_maintenance
- GET /api/equipment_maintenance/:id - Get single equipment_maintenance
- POST /api/equipment_maintenance - Create new equipment_maintenance
- PUT /api/equipment_maintenance/:id - Update equipment_maintenance
- DELETE /api/equipment_maintenance/:id - Delete equipment_maintenance
- Filters: ?company_id=value, ?equipment_id=value, ?pre_maintenance_verification_id=value, ?post_maintenance_verification_id=value

**role_permissions**:
- GET /api/role_permissions - List all role_permissions
- GET /api/role_permissions/:id - Get single role_permission
- POST /api/role_permissions - Create new role_permission
- PUT /api/role_permissions/:id - Update role_permission
- DELETE /api/role_permissions/:id - Delete role_permission
- Filters: ?permission_id=value, ?tenant_id=value, ?tenant_id=value

**audit_logs**:
- GET /api/audit_logs - List all audit_logs
- GET /api/audit_logs/:id - Get single audit_log
- POST /api/audit_logs - Create new audit_log
- PUT /api/audit_logs/:id - Update audit_log
- DELETE /api/audit_logs/:id - Delete audit_log
- Filters: ?tenant_id=value, ?entity_id=value, ?tenant_id=value

**companies**:
- GET /api/companies - List all companies
- GET /api/companies/:id - Get single company
- POST /api/companies - Create new company
- PUT /api/companies/:id - Update company
- DELETE /api/companies/:id - Delete company
- Filters: ?tenant_id=value

### A.2 Cleanup Script Template

```typescript
// Cleanup script for orphaned tables and unused resources
import { createClient } from "@supabase/supabase-js";

const client = createClient(url, serviceKey);

// Remove orphaned tables
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS equipment;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS materials;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS voice_transcripts;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS vision_cost_records;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS detection_confidence_thresholds;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS job_templates;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS mobile_sessions;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS offline_queue;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS media_assets;" });

// Remove empty buckets
// await client.storage.deleteBucket("verification-photos");
// await client.storage.deleteBucket("job-photos");
// await client.storage.deleteBucket("voice-recordings");
// await client.storage.deleteBucket("equipment-images");
```