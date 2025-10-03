# COMPREHENSIVE Database Analysis Report

Generated: 2025-10-03T22:34:58.505Z
Database: https://rtwigjwqufozqfwozpvo.supabase.co

## Executive Summary

- **Total Tables**: 65
- **Total Rows**: 10,458
- **Total Columns**: 851
- **Total Indexes**: 240
- **Total Foreign Keys**: 62
- **Total RLS Policies**: 93
- **Tables with Data**: 19
- **Tables with RLS**: 49
- **Tables with Policies**: 51

## Key Insights

### Largest Tables by Row Count
- **spatial_ref_sys**: 8,500 rows (7144 kB)
- **gps_tracking_records**: 1,046 rows (488 kB)
- **code_pattern_violations**: 277 rows (168 kB)
- **notification_queue**: 175 rows (264 kB)
- **auth_audit_log**: 138 rows (176 kB)
- **customers**: 83 rows (128 kB)
- **tenants**: 71 rows (88 kB)
- **invoices**: 57 rows (168 kB)
- **jobs**: 47 rows (200 kB)
- **equipment_maintenance**: 26 rows (80 kB)

### Tables Without Primary Keys
None - all tables have primary keys ✅

### Tables Without Indexes
None - all tables have indexes ✅

### Tables with RLS but No Policies
- tenants
- safety_checklist_completions

## Detailed Table Information


### 📊 spatial_ref_sys

- **Row Count**: 8,500
- **Table Size**: 6896 kB
- **Index Size**: 208 kB
- **Total Size**: 7144 kB
- **RLS Enabled**: ❌
- **Primary Keys**: srid

#### Columns (5)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| srid | integer | NO | - | - | PK |
| auth_name | character varying | YES | - | - | - |
| auth_srid | integer | YES | - | - | - |
| srtext | character varying | YES | - | - | - |
| proj4text | character varying | YES | - | - | - |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| spatial_ref_sys_pkey | btree | ✅ | ✅ | srid | 208 kB |

---


### 📊 gps_tracking_records

- **Row Count**: 1,046
- **Table Size**: 264 kB
- **Index Size**: 192 kB
- **Total Size**: 488 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (17)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| tenant_id | uuid | NO | - | - | FK |
| user_id | uuid | NO | - | - | FK |
| job_id | uuid | YES | - | - | FK |
| latitude | double precision | NO | - | - | - |
| longitude | double precision | NO | - | - | - |
| accuracy_meters | double precision | NO | - | - | - |
| altitude_meters | double precision | YES | - | - | - |
| speed_mps | double precision | YES | - | - | - |
| heading_degrees | double precision | YES | - | - | - |
| recorded_at | timestamp with time zone | NO | now() | - | - |
| created_at | timestamp with time zone | YES | now() | - | - |
| accuracy | double precision | YES | - | - | - |
| altitude | double precision | YES | - | - | - |
| speed | double precision | YES | - | - | - |
| heading | double precision | YES | - | - | - |
| timestamp | timestamp with time zone | YES | - | - | - |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| gps_tracking_records_job_id_fkey | job_id | jobs.id | NO ACTION | NO ACTION |
| gps_tracking_records_tenant_id_fkey | tenant_id | tenants.id | NO ACTION | CASCADE |
| gps_tracking_records_user_id_fkey | user_id | users_extended.id | NO ACTION | NO ACTION |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| gps_tracking_records_pkey | btree | ✅ | ✅ | id | 80 kB |
| idx_gps_tracking_job | btree | - | - | job_id | 16 kB |
| idx_gps_tracking_recorded | btree | - | - | recorded_at | 48 kB |
| idx_gps_tracking_tenant | btree | - | - | tenant_id | 32 kB |
| idx_gps_tracking_user | btree | - | - | user_id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| gps_tracking_tenant_isolation | ALL | PERMISSIVE |  | `(tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)` |

---


### 📊 code_pattern_violations

- **Row Count**: 277
- **Table Size**: 72 kB
- **Index Size**: 64 kB
- **Total Size**: 168 kB
- **RLS Enabled**: ❌
- **Primary Keys**: id

#### Columns (10)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | uuid_generate_v4() | - | PK |
| file_path | character varying | NO | - | - | - |
| line_number | integer | NO | - | - | - |
| column_number | integer | NO | - | - | - |
| pattern_type | character varying | NO | - | - | - |
| violation_text | text | NO | - | - | - |
| suggested_fix | text | NO | - | - | - |
| is_fixed | boolean | NO | false | - | - |
| fixed_at | timestamp with time zone | YES | - | - | - |
| created_at | timestamp with time zone | NO | now() | - | - |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| code_pattern_violations_pkey | btree | ✅ | ✅ | id | 16 kB |
| idx_violation_file | btree | - | - | file_path | 16 kB |
| idx_violation_fixed | btree | - | - | is_fixed | 16 kB |
| idx_violation_type | btree | - | - | pattern_type | 16 kB |

---


### 📊 notification_queue

- **Row Count**: 175
- **Table Size**: 184 kB
- **Index Size**: 48 kB
- **Total Size**: 264 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (15)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| company_id | text | NO | - | - | FK |
| recipient_id | uuid | NO | - | - | FK |
| type | text | NO | - | - | - |
| priority | text | NO | 'medium'::text | - | - |
| message | text | NO | - | - | - |
| data | jsonb | YES | - | - | - |
| method | text | YES | - | - | - |
| status | text | NO | 'pending'::text | - | - |
| attempts | integer | YES | 0 | - | - |
| last_attempt_at | timestamp with time zone | YES | - | - | - |
| delivered_at | timestamp with time zone | YES | - | - | - |
| error | text | YES | - | - | - |
| created_at | timestamp with time zone | NO | now() | - | - |
| updated_at | timestamp with time zone | NO | now() | - | - |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| notification_queue_company_id_fkey | company_id | companies.id | NO ACTION | CASCADE |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_notification_queue_pending | btree | - | - | status, created_at | 16 kB |
| idx_notification_queue_recipient | btree | - | - | recipient_id, created_at | 16 kB |
| notification_queue_pkey | btree | ✅ | ✅ | id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| notification_queue_service_role | ALL | PERMISSIVE |  | `(auth.role() = 'service_role'::text)` |
| notification_queue_tenant_access | ALL | PERMISSIVE |  | `(company_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'company_id'::text))` |

---


### 📊 auth_audit_log

- **Row Count**: 138
- **Table Size**: 40 kB
- **Index Size**: 96 kB
- **Total Size**: 176 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (18)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | uuid_generate_v4() | - | PK |
| event_type | USER-DEFINED | NO | - | - | - |
| user_id | uuid | YES | - | - | FK |
| user_email | text | YES | - | - | - |
| tenant_id | uuid | YES | - | - | FK |
| session_id | uuid | YES | - | - | FK |
| ip_address | inet | YES | - | - | - |
| user_agent | text | YES | - | - | - |
| device_type | USER-DEFINED | YES | - | - | - |
| location | jsonb | YES | - | - | - |
| success | boolean | YES | - | - | - |
| reason | text | YES | - | - | - |
| error_code | text | YES | - | - | - |
| risk_score | integer | YES | - | - | - |
| details | jsonb | YES | '{}'::jsonb | - | - |
| voice_command | text | YES | - | - | - |
| voice_confidence | numeric | YES | - | - | - |
| created_at | timestamp with time zone | NO | now() | - | - |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| auth_audit_log_session_id_fkey | session_id | user_sessions.id | NO ACTION | SET NULL |
| auth_audit_log_tenant_id_fkey | tenant_id | tenants.id | NO ACTION | SET NULL |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| auth_audit_log_pkey | btree | ✅ | ✅ | id | 16 kB |
| idx_auth_audit_log_created_at | btree | - | - | created_at | 16 kB |
| idx_auth_audit_log_event_type | btree | - | - | event_type | 16 kB |
| idx_auth_audit_log_ip_address | btree | - | - | ip_address | 8192 bytes |
| idx_auth_audit_log_risk_score | btree | - | - | risk_score | 8192 bytes |
| idx_auth_audit_log_success | btree | - | - | success | 16 kB |
| idx_auth_audit_log_user_id | btree | - | - | user_id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| Admins can view tenant audit logs | SELECT | PERMISSIVE |  | `(EXISTS ( SELECT 1
   FROM users_extended ue
  WHERE ((ue.id = auth.uid()) AND (ue.role = 'admin'::user_role) AND ((ue.tenant_id = auth_audit_log.tenant_id) OR (auth_audit_log.tenant_id IS NULL)))))` |

---


### 📊 customers

- **Row Count**: 83
- **Table Size**: 24 kB
- **Index Size**: 64 kB
- **Total Size**: 128 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (19)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | text | NO | (gen_random_uuid())::text | - | PK |
| tenant_id | uuid | YES | - | - | FK |
| customer_number | character varying | NO | - | - | - |
| name | character varying | NO | - | - | - |
| email | character varying | YES | - | - | - |
| phone | character varying | YES | - | - | - |
| mobile_phone | character varying | YES | - | - | - |
| billing_address | jsonb | YES | - | - | - |
| service_address | jsonb | YES | - | - | - |
| notes | text | YES | - | - | - |
| tags | ARRAY | YES | - | - | - |
| voice_notes | text | YES | - | - | - |
| is_active | boolean | YES | true | - | - |
| metadata | jsonb | YES | '{}'::jsonb | - | - |
| created_at | timestamp with time zone | YES | now() | - | - |
| updated_at | timestamp with time zone | YES | now() | - | - |
| created_by | uuid | YES | - | - | - |
| version | integer | YES | 1 | - | - |
| intake_session_id | uuid | YES | - | - | FK |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| customers_tenant_id_fkey | tenant_id | tenants.id | NO ACTION | CASCADE |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| customers_pkey | btree | ✅ | ✅ | id | 16 kB |
| customers_tenant_id_customer_number_key | btree | ✅ | - | tenant_id, customer_number | 16 kB |
| idx_customers_name | btree | - | - | name | 16 kB |
| idx_customers_tenant_id | btree | - | - | tenant_id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| customers_service_role | ALL | PERMISSIVE | service_role | `true` |

---


### 📊 tenants

- **Row Count**: 71
- **Table Size**: 16 kB
- **Index Size**: 32 kB
- **Total Size**: 88 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (5)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| name | character varying | NO | - | - | - |
| slug | character varying | NO | - | - | - |
| created_at | timestamp with time zone | YES | CURRENT_TIMESTAMP | - | - |
| updated_at | timestamp with time zone | YES | CURRENT_TIMESTAMP | - | - |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| tenants_pkey | btree | ✅ | ✅ | id | 16 kB |
| tenants_slug_key | btree | ✅ | - | slug | 16 kB |

---


### 📊 invoices

- **Row Count**: 57
- **Table Size**: 24 kB
- **Index Size**: 112 kB
- **Total Size**: 168 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (16)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| tenant_id | uuid | NO | - | - | FK |
| invoice_number | text | NO | - | - | - |
| customer_id | uuid | YES | - | - | FK |
| job_id | uuid | YES | - | - | FK |
| amount | numeric | NO | - | - | - |
| tax_amount | numeric | YES | 0 | - | - |
| total_amount | numeric | YES | - | - | - |
| status | text | NO | 'draft'::text | - | - |
| created_by | uuid | NO | - | - | - |
| due_date | date | NO | - | - | - |
| paid_date | date | YES | - | - | - |
| payment_method | text | YES | - | - | - |
| notes | text | YES | - | - | - |
| created_at | timestamp with time zone | NO | now() | - | - |
| updated_at | timestamp with time zone | NO | now() | - | - |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| invoices_job_id_fkey | job_id | jobs.id | NO ACTION | SET NULL |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_invoices_customer | btree | - | - | customer_id | 16 kB |
| idx_invoices_due_date | btree | - | - | due_date | 16 kB |
| idx_invoices_job | btree | - | - | job_id | 16 kB |
| idx_invoices_status | btree | - | - | status | 16 kB |
| idx_invoices_tenant | btree | - | - | tenant_id | 16 kB |
| invoices_pkey | btree | ✅ | ✅ | id | 16 kB |
| invoices_unique_number | btree | ✅ | - | tenant_id, invoice_number | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| Managers can create invoices | INSERT | PERMISSIVE |  | `` |
| Managers can update invoices | UPDATE | PERMISSIVE |  | `(tenant_id IN ( SELECT users_extended.tenant_id
   FROM users_extended
  WHERE (users_extended.id = auth.uid())))` |
| Users can view their tenant's invoices | SELECT | PERMISSIVE |  | `(tenant_id IN ( SELECT users_extended.tenant_id
   FROM users_extended
  WHERE (users_extended.id = auth.uid())))` |

---


### 📊 jobs

- **Row Count**: 47
- **Table Size**: 40 kB
- **Index Size**: 120 kB
- **Total Size**: 200 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (51)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | uuid_generate_v4() | - | PK |
| tenant_id | uuid | NO | - | - | FK |
| job_number | character varying | NO | - | - | - |
| template_id | uuid | YES | - | - | FK |
| customer_id | text | NO | - | - | FK |
| property_id | uuid | YES | - | - | FK |
| title | character varying | NO | - | - | - |
| description | text | YES | - | - | - |
| status | USER-DEFINED | YES | 'draft'::job_status | - | - |
| priority | USER-DEFINED | YES | 'normal'::job_priority | - | - |
| scheduled_start | timestamp with time zone | YES | - | - | - |
| scheduled_end | timestamp with time zone | YES | - | - | - |
| actual_start | timestamp with time zone | YES | - | - | - |
| actual_end | timestamp with time zone | YES | - | - | - |
| assigned_to | uuid | YES | - | - | - |
| assigned_team | ARRAY | YES | - | - | - |
| estimated_duration | integer | YES | - | - | - |
| actual_duration | integer | YES | - | - | - |
| completion_notes | text | YES | - | - | - |
| voice_notes | text | YES | - | - | - |
| voice_created | boolean | YES | false | - | - |
| voice_session_id | uuid | YES | - | - | FK |
| checklist_items | jsonb | YES | '[]'::jsonb | - | - |
| materials_used | jsonb | YES | '[]'::jsonb | - | - |
| equipment_used | ARRAY | YES | - | - | - |
| photos_before | jsonb | YES | '[]'::jsonb | - | - |
| photos_after | jsonb | YES | '[]'::jsonb | - | - |
| signature_required | boolean | YES | false | - | - |
| signature_data | jsonb | YES | - | - | - |
| billing_info | jsonb | YES | - | - | - |
| metadata | jsonb | YES | '{}'::jsonb | - | - |
| created_at | timestamp with time zone | YES | now() | - | - |
| updated_at | timestamp with time zone | YES | now() | - | - |
| created_by | uuid | YES | - | - | - |
| arrival_photo_id | uuid | YES | - | - | FK |
| arrival_confirmed_at | timestamp with time zone | YES | - | - | - |
| completion_quality_score | integer | YES | - | - | - |
| requires_supervisor_review | boolean | YES | false | - | - |
| arrival_timestamp | timestamp with time zone | YES | - | - | - |
| arrival_gps_coords | point | YES | - | - | - |
| arrival_method | character varying | YES | - | - | - |
| arrival_confidence | character varying | YES | - | - | - |
| completion_timestamp | timestamp with time zone | YES | - | - | - |
| completion_photo_url | text | YES | - | - | - |
| tool_reload_verified | boolean | YES | false | - | - |
| offline_modified_at | timestamp with time zone | YES | - | - | - |
| offline_modified_by | uuid | YES | - | - | - |
| special_instructions_audio | text | YES | - | - | - |
| estimated_duration_minutes | integer | YES | - | - | - |
| actual_duration_minutes | integer | YES | - | - | - |
| completion_photo_urls | ARRAY | YES | - | - | - |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| jobs_assigned_to_fkey | assigned_to | users_extended.id | NO ACTION | NO ACTION |
| jobs_customer_id_fkey | customer_id | customers.id | NO ACTION | SET NULL |
| jobs_property_id_fkey | property_id | properties.id | NO ACTION | NO ACTION |
| jobs_tenant_id_fkey | tenant_id | tenants.id | NO ACTION | CASCADE |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_jobs_arrival | btree | - | - | arrival_timestamp | 8192 bytes |
| idx_jobs_assigned_to | btree | - | - | assigned_to | 16 kB |
| idx_jobs_completion | btree | - | - | completion_timestamp | 8192 bytes |
| idx_jobs_customer_property | btree | - | - | customer_id, property_id | 16 kB |
| idx_jobs_offline_modified | btree | - | - | offline_modified_at | 8192 bytes |
| idx_jobs_scheduled_start | btree | - | - | scheduled_start | 16 kB |
| idx_jobs_tenant_status | btree | - | - | tenant_id, status | 16 kB |
| jobs_pkey | btree | ✅ | ✅ | id | 16 kB |
| jobs_tenant_id_job_number_key | btree | ✅ | - | tenant_id, job_number | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| Users can manage their tenant's jobs | ALL | PERMISSIVE |  | `(tenant_id IN ( SELECT tenant_assignments.tenant_id
   FROM tenant_assignments
  WHERE ((tenant_assignments.user_id = auth.uid()) AND (tenant_assignments.is_active = true))))` |
| Users can view their tenant's jobs | SELECT | PERMISSIVE |  | `(tenant_id IN ( SELECT tenant_assignments.tenant_id
   FROM tenant_assignments
  WHERE ((tenant_assignments.user_id = auth.uid()) AND (tenant_assignments.is_active = true))))` |

---


### 📊 equipment_maintenance

- **Row Count**: 26
- **Table Size**: 16 kB
- **Index Size**: 32 kB
- **Total Size**: 80 kB
- **RLS Enabled**: ❌
- **Primary Keys**: id

#### Columns (13)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | uuid_generate_v4() | - | PK |
| equipment_id | text | NO | - | - | FK |
| performed_by | uuid | NO | - | - | - |
| maintenance_type | text | NO | - | - | - |
| maintenance_date | timestamp with time zone | NO | - | - | - |
| actions_performed | ARRAY | YES | - | - | - |
| pre_maintenance_verification_id | uuid | YES | - | - | FK |
| post_maintenance_verification_id | uuid | YES | - | - | FK |
| status | text | NO | - | - | - |
| completion_date | timestamp with time zone | YES | - | - | - |
| notes | text | YES | - | - | - |
| created_at | timestamp with time zone | YES | now() | - | - |
| tenant_id | uuid | YES | - | - | FK |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| equipment_maintenance_pkey | btree | ✅ | ✅ | id | 16 kB |
| idx_equipment_maintenance_equipment | btree | - | - | equipment_id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| tenant_isolation | ALL | PERMISSIVE |  | `((tenant_id)::text = (((current_setting('request.jwt.claims'::text, true))::json -> 'app_metadata'::text) ->> 'tenant_id'::text))` |

---


### 📊 users_extended

- **Row Count**: 21
- **Table Size**: 8192 bytes
- **Index Size**: 96 kB
- **Total Size**: 112 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (24)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | - | - | PK |
| tenant_id | uuid | NO | - | - | FK |
| role | USER-DEFINED | NO | 'customer'::user_role | - | - |
| display_name | text | YES | - | - | - |
| first_name | text | YES | - | - | - |
| last_name | text | YES | - | - | - |
| phone | text | YES | - | - | - |
| avatar_url | text | YES | - | - | - |
| timezone | text | YES | 'UTC'::text | - | - |
| preferred_language | text | YES | 'en-US'::text | - | - |
| is_active | boolean | NO | true | - | - |
| email_verified_at | timestamp with time zone | YES | - | - | - |
| phone_verified_at | timestamp with time zone | YES | - | - | - |
| last_login_at | timestamp with time zone | YES | - | - | - |
| password_changed_at | timestamp with time zone | YES | now() | - | - |
| terms_accepted_at | timestamp with time zone | YES | - | - | - |
| privacy_policy_accepted_at | timestamp with time zone | YES | - | - | - |
| marketing_consent | boolean | YES | false | - | - |
| two_factor_enabled | boolean | YES | false | - | - |
| failed_login_attempts | integer | YES | 0 | - | - |
| locked_until | timestamp with time zone | YES | - | - | - |
| metadata | jsonb | YES | '{}'::jsonb | - | - |
| created_at | timestamp with time zone | NO | now() | - | - |
| updated_at | timestamp with time zone | NO | now() | - | - |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| users_extended_tenant_id_fkey | tenant_id | tenants.id | NO ACTION | RESTRICT |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_users_extended_active | btree | - | - | is_active | 16 kB |
| idx_users_extended_email_verified | btree | - | - | email_verified_at | 8192 bytes |
| idx_users_extended_last_login | btree | - | - | last_login_at | 16 kB |
| idx_users_extended_phone | btree | - | - | phone | 8192 bytes |
| idx_users_extended_role | btree | - | - | role | 16 kB |
| idx_users_extended_tenant_id | btree | - | - | tenant_id | 16 kB |
| users_extended_pkey | btree | ✅ | ✅ | id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| Admins can view all users in tenant | SELECT | PERMISSIVE |  | `(EXISTS ( SELECT 1
   FROM users_extended ue
  WHERE ((ue.id = auth.uid()) AND (ue.role = 'admin'::user_role) AND (ue.tenant_id = users_extended.tenant_id))))` |
| Users can update own profile | UPDATE | PERMISSIVE |  | `(auth.uid() = id)` |
| Users can view own profile | SELECT | PERMISSIVE |  | `(auth.uid() = id)` |

---


### 📊 training_sessions

- **Row Count**: 20
- **Table Size**: 8192 bytes
- **Index Size**: 32 kB
- **Total Size**: 48 kB
- **RLS Enabled**: ❌
- **Primary Keys**: id

#### Columns (10)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | uuid_generate_v4() | - | PK |
| company_id | text | NO | - | - | FK |
| trainer_id | uuid | NO | - | - | FK |
| training_type | text | NO | - | - | - |
| session_date | timestamp with time zone | NO | - | - | - |
| demo_verification_id | uuid | YES | - | - | FK |
| equipment_demo_score | numeric | YES | - | - | - |
| status | text | NO | - | - | - |
| completion_date | timestamp with time zone | YES | - | - | - |
| created_at | timestamp with time zone | YES | now() | - | - |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_training_sessions_company | btree | - | - | company_id | 16 kB |
| training_sessions_pkey | btree | ✅ | ✅ | id | 16 kB |

---


### 📊 kit_items

- **Row Count**: 13
- **Table Size**: 8192 bytes
- **Index Size**: 32 kB
- **Total Size**: 80 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (10)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| tenant_id | text | NO | - | - | FK |
| kit_id | uuid | NO | - | - | FK |
| item_type | text | NO | - | - | - |
| quantity | numeric | NO | 1 | - | - |
| unit | character varying | YES | - | - | - |
| is_required | boolean | NO | true | - | - |
| metadata | jsonb | NO | '{}'::jsonb | - | - |
| created_at | timestamp with time zone | NO | now() | - | - |
| updated_at | timestamp with time zone | NO | now() | - | - |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| kit_items_company_id_fkey | tenant_id | companies.id | NO ACTION | CASCADE |
| kit_items_kit_id_fkey | kit_id | kits.id | NO ACTION | CASCADE |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| kit_items_kit_idx | btree | - | - | kit_id | 16 kB |
| kit_items_pkey | btree | ✅ | ✅ | id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| kit_items_service_role | ALL | PERMISSIVE |  | `(auth.role() = 'service_role'::text)` |
| kit_items_tenant_access | ALL | PERMISSIVE |  | `(tenant_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'company_id'::text))` |

---


### 📊 properties

- **Row Count**: 11
- **Table Size**: 16 kB
- **Index Size**: 56 kB
- **Total Size**: 104 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (22)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | uuid_generate_v4() | - | PK |
| tenant_id | uuid | NO | - | - | FK |
| customer_id | text | NO | - | - | FK |
| property_number | character varying | NO | - | - | - |
| name | character varying | NO | - | - | - |
| address | jsonb | NO | - | - | - |
| location | USER-DEFINED | YES | - | - | - |
| property_type | character varying | YES | - | - | - |
| size_sqft | integer | YES | - | - | - |
| lot_size_acres | numeric | YES | - | - | - |
| zones | jsonb | YES | - | - | - |
| access_notes | text | YES | - | - | - |
| gate_code | character varying | YES | - | - | - |
| special_instructions | text | YES | - | - | - |
| voice_navigation_notes | text | YES | - | - | - |
| photos | jsonb | YES | '[]'::jsonb | - | - |
| is_active | boolean | YES | true | - | - |
| metadata | jsonb | YES | '{}'::jsonb | - | - |
| created_at | timestamp with time zone | YES | now() | - | - |
| updated_at | timestamp with time zone | YES | now() | - | - |
| intake_session_id | uuid | YES | - | - | FK |
| reference_image_id | uuid | YES | - | - | FK |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| properties_customer_id_fkey | customer_id | customers.id | NO ACTION | SET NULL |
| properties_tenant_id_fkey | tenant_id | tenants.id | NO ACTION | CASCADE |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_properties_location | gist | - | - | location | 8192 bytes |
| idx_properties_tenant_customer | btree | - | - | tenant_id, customer_id | 16 kB |
| properties_pkey | btree | ✅ | ✅ | id | 16 kB |
| properties_tenant_id_property_number_key | btree | ✅ | - | tenant_id, property_number | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| Users can manage their tenant's properties | ALL | PERMISSIVE |  | `(tenant_id IN ( SELECT tenant_assignments.tenant_id
   FROM tenant_assignments
  WHERE ((tenant_assignments.user_id = auth.uid()) AND (tenant_assignments.is_active = true))))` |
| Users can view their tenant's properties | SELECT | PERMISSIVE |  | `(tenant_id IN ( SELECT tenant_assignments.tenant_id
   FROM tenant_assignments
  WHERE ((tenant_assignments.user_id = auth.uid()) AND (tenant_assignments.is_active = true))))` |

---


### 📊 kits

- **Row Count**: 6
- **Table Size**: 8192 bytes
- **Index Size**: 64 kB
- **Total Size**: 112 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (10)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| tenant_id | text | NO | - | - | FK |
| kit_code | character varying | NO | - | - | - |
| name | character varying | NO | - | - | - |
| description | text | YES | - | - | - |
| category | character varying | YES | - | - | - |
| is_active | boolean | NO | true | - | - |
| metadata | jsonb | NO | '{}'::jsonb | - | - |
| created_at | timestamp with time zone | NO | now() | - | - |
| updated_at | timestamp with time zone | NO | now() | - | - |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| kits_company_id_fkey | tenant_id | companies.id | NO ACTION | CASCADE |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| kits_company_id_kit_code_key | btree | ✅ | - | tenant_id, kit_code | 16 kB |
| kits_company_name_idx | btree | - | - | tenant_id, name | 16 kB |
| kits_pkey | btree | ✅ | ✅ | id | 16 kB |
| uniq_kits_company_code | btree | ✅ | - | tenant_id, kit_code | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| kits_service_role | ALL | PERMISSIVE |  | `(auth.role() = 'service_role'::text)` |
| kits_tenant_access | ALL | PERMISSIVE |  | `(tenant_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'company_id'::text))` |

---


### 📊 companies

- **Row Count**: 5
- **Table Size**: 8192 bytes
- **Index Size**: 16 kB
- **Total Size**: 64 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (7)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | text | NO | (gen_random_uuid())::text | - | PK |
| tenant_id | uuid | YES | - | - | FK |
| name | text | YES | - | - | - |
| created_at | timestamp with time zone | NO | now() | - | - |
| updated_at | timestamp with time zone | NO | now() | - | - |
| domain | text | YES | - | - | - |
| is_active | boolean | NO | true | - | - |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| companies_pkey | btree | ✅ | ✅ | id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| companies_service_role | ALL | PERMISSIVE | service_role | `true` |
| companies_tenant_isolation | ALL | PERMISSIVE | authenticated | `(id = COALESCE(((current_setting('request.jwt.claims'::text, true))::json ->> 'company_id'::text), (((current_setting('request.jwt.claims'::text, true))::json -> 'user_metadata'::text) ->> 'company_id'::text), (((current_setting('request.jwt.claims'::text, true))::json -> 'app_metadata'::text) ->> 'company_id'::text)))` |

---


### 📊 kit_variants

- **Row Count**: 2
- **Table Size**: 8192 bytes
- **Index Size**: 48 kB
- **Total Size**: 64 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (9)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| tenant_id | text | NO | - | - | FK |
| kit_id | uuid | NO | - | - | FK |
| variant_code | character varying | NO | - | - | - |
| name | character varying | NO | - | - | - |
| is_default | boolean | NO | false | - | - |
| metadata | jsonb | NO | '{}'::jsonb | - | - |
| created_at | timestamp with time zone | NO | now() | - | - |
| updated_at | timestamp with time zone | NO | now() | - | - |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| kit_variants_company_id_fkey | tenant_id | companies.id | NO ACTION | CASCADE |
| kit_variants_kit_id_fkey | kit_id | kits.id | NO ACTION | CASCADE |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| kit_variants_kit_id_variant_code_key | btree | ✅ | - | kit_id, variant_code | 16 kB |
| kit_variants_kit_idx | btree | - | - | kit_id | 16 kB |
| kit_variants_pkey | btree | ✅ | ✅ | id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| kit_variants_service_role | ALL | PERMISSIVE |  | `(auth.role() = 'service_role'::text)` |
| kit_variants_tenant_access | ALL | PERMISSIVE |  | `(tenant_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'company_id'::text))` |

---


### 📊 day_plans

- **Row Count**: 2
- **Table Size**: 8192 bytes
- **Index Size**: 32 kB
- **Total Size**: 64 kB
- **RLS Enabled**: ❌
- **Primary Keys**: id

#### Columns (15)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| company_id | text | NO | - | - | FK |
| user_id | uuid | NO | - | - | FK |
| plan_date | date | NO | - | - | - |
| status | text | NO | 'draft'::text | - | - |
| route_data | jsonb | YES | - | - | - |
| total_distance_miles | numeric | YES | - | - | - |
| estimated_duration_minutes | integer | YES | - | - | - |
| actual_start_time | timestamp with time zone | YES | - | - | - |
| actual_end_time | timestamp with time zone | YES | - | - | - |
| voice_session_id | uuid | YES | - | - | FK |
| auto_schedule_breaks | boolean | YES | false | - | - |
| metadata | jsonb | NO | '{}'::jsonb | - | - |
| created_at | timestamp with time zone | NO | now() | - | - |
| updated_at | timestamp with time zone | NO | now() | - | - |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| day_plans_company_id_fkey | company_id | companies.id | NO ACTION | CASCADE |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| day_plans_company_id_user_id_plan_date_key | btree | ✅ | - | company_id, user_id, plan_date | 16 kB |
| day_plans_pkey | btree | ✅ | ✅ | id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| day_plans_tenant_access | ALL | PERMISSIVE |  | `(company_id = (((current_setting('request.jwt.claims'::text, true))::json -> 'app_metadata'::text) ->> 'company_id'::text))` |

---


### 📊 kit_assignments

- **Row Count**: 1
- **Table Size**: 8192 bytes
- **Index Size**: 16 kB
- **Total Size**: 32 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (9)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| kit_id | uuid | NO | - | - | FK |
| variant_id | uuid | YES | - | - | FK |
| external_ref | text | NO | - | - | - |
| notes | text | YES | - | - | - |
| metadata | jsonb | NO | '{}'::jsonb | - | - |
| created_at | timestamp with time zone | NO | now() | - | - |
| updated_at | timestamp with time zone | NO | now() | - | - |
| tenant_id | uuid | YES | - | - | FK |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| kit_assignments_kit_id_fkey | kit_id | kits.id | NO ACTION | CASCADE |
| kit_assignments_variant_id_fkey | variant_id | kit_variants.id | NO ACTION | SET NULL |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| kit_assignments_pkey | btree | ✅ | ✅ | id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| kit_assignments_service_role | ALL | PERMISSIVE |  | `(auth.role() = 'service_role'::text)` |
| tenant_isolation | ALL | PERMISSIVE |  | `((tenant_id)::text = (((current_setting('request.jwt.claims'::text, true))::json -> 'app_metadata'::text) ->> 'tenant_id'::text))` |

---


### 📊 workflow_tasks

- **Row Count**: 0
- **Table Size**: 0 bytes
- **Index Size**: 64 kB
- **Total Size**: 88 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (21)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| tenant_id | uuid | NO | - | - | FK |
| job_id | uuid | NO | - | - | FK |
| task_description | text | NO | - | - | - |
| task_order | integer | NO | 0 | - | - |
| status | text | NO | 'pending'::text | - | - |
| completed_by | uuid | YES | - | - | - |
| completed_at | timestamp with time zone | YES | - | - | - |
| verification_photo_url | text | YES | - | - | - |
| ai_confidence | double precision | YES | - | - | - |
| requires_supervisor_review | boolean | YES | false | - | - |
| supervisor_approved | boolean | YES | - | - | - |
| supervisor_notes | text | YES | - | - | - |
| created_at | timestamp with time zone | YES | now() | - | - |
| updated_at | timestamp with time zone | YES | now() | - | - |
| verification_method | text | YES | 'manual'::text | - | - |
| verification_data | jsonb | YES | '{}'::jsonb | - | - |
| requires_supervisor_approval | boolean | YES | false | - | - |
| user_id | uuid | YES | - | - | FK |
| task_type | text | YES | 'verification'::text | - | - |
| supervisor_id | uuid | YES | - | - | FK |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| workflow_tasks_completed_by_fkey | completed_by | users_extended.id | NO ACTION | NO ACTION |
| workflow_tasks_job_id_fkey | job_id | jobs.id | NO ACTION | CASCADE |
| workflow_tasks_supervisor_id_fkey | supervisor_id | users_extended.id | NO ACTION | NO ACTION |
| workflow_tasks_tenant_id_fkey | tenant_id | tenants.id | NO ACTION | CASCADE |
| workflow_tasks_user_id_fkey | user_id | users_extended.id | NO ACTION | NO ACTION |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_workflow_tasks_job | btree | - | - | job_id | 16 kB |
| idx_workflow_tasks_status | btree | - | - | status | 16 kB |
| idx_workflow_tasks_tenant | btree | - | - | tenant_id | 16 kB |
| workflow_tasks_pkey | btree | ✅ | ✅ | id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| workflow_tasks_tenant_isolation | ALL | PERMISSIVE |  | `(tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)` |

---


### 📊 geofences

- **Row Count**: 0
- **Table Size**: 8192 bytes
- **Index Size**: 48 kB
- **Total Size**: 64 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (10)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| tenant_id | uuid | NO | - | - | FK |
| job_id | uuid | YES | - | - | FK |
| name | text | NO | - | - | - |
| center_latitude | double precision | NO | - | - | - |
| center_longitude | double precision | NO | - | - | - |
| radius_meters | double precision | NO | - | - | - |
| active | boolean | YES | true | - | - |
| created_at | timestamp with time zone | YES | now() | - | - |
| updated_at | timestamp with time zone | YES | now() | - | - |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| geofences_job_id_fkey | job_id | jobs.id | NO ACTION | NO ACTION |
| geofences_tenant_id_fkey | tenant_id | tenants.id | NO ACTION | CASCADE |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| geofences_pkey | btree | ✅ | ✅ | id | 16 kB |
| idx_geofences_job | btree | - | - | job_id | 16 kB |
| idx_geofences_tenant | btree | - | - | tenant_id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| geofences_tenant_isolation | ALL | PERMISSIVE |  | `(tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)` |

---


### 📊 geofence_events

- **Row Count**: 0
- **Table Size**: 8192 bytes
- **Index Size**: 48 kB
- **Total Size**: 64 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (9)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| tenant_id | uuid | NO | - | - | FK |
| geofence_id | uuid | NO | - | - | FK |
| user_id | uuid | NO | - | - | FK |
| event_type | text | NO | - | - | - |
| latitude | double precision | NO | - | - | - |
| longitude | double precision | NO | - | - | - |
| timestamp | timestamp with time zone | NO | - | - | - |
| created_at | timestamp with time zone | YES | now() | - | - |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| geofence_events_geofence_id_fkey | geofence_id | geofences.id | NO ACTION | CASCADE |
| geofence_events_tenant_id_fkey | tenant_id | tenants.id | NO ACTION | CASCADE |
| geofence_events_user_id_fkey | user_id | users_extended.id | NO ACTION | NO ACTION |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| geofence_events_pkey | btree | ✅ | ✅ | id | 16 kB |
| idx_geofence_events_geofence | btree | - | - | geofence_id | 16 kB |
| idx_geofence_events_tenant | btree | - | - | tenant_id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| geofence_events_tenant_isolation | ALL | PERMISSIVE |  | `(tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)` |

---


### 📊 inventory_images

- **Row Count**: -1
- **Table Size**: 8192 bytes
- **Index Size**: 16 kB
- **Total Size**: 32 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (7)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| company_id | text | NO | - | - | FK |
| media_id | uuid | YES | - | - | FK |
| file_path | text | NO | - | - | - |
| mime_type | text | YES | - | - | - |
| size_bytes | integer | YES | - | - | - |
| created_at | timestamp with time zone | YES | now() | - | - |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| inventory_images_pkey | btree | ✅ | ✅ | id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| inventory_images_service_role | ALL | PERMISSIVE | service_role | `true` |
| inventory_images_tenant_isolation | ALL | PERMISSIVE | authenticated | `(company_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'company_id'::text))` |

---


### 📊 ocr_jobs

- **Row Count**: -1
- **Table Size**: 8192 bytes
- **Index Size**: 16 kB
- **Total Size**: 32 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (6)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| company_id | text | NO | - | - | FK |
| vendor_id | uuid | YES | - | - | FK |
| status | text | NO | - | - | - |
| created_at | timestamp with time zone | YES | now() | - | - |
| completed_at | timestamp with time zone | YES | - | - | - |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| ocr_jobs_vendor_id_fkey | vendor_id | vendors.id | NO ACTION | NO ACTION |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| ocr_jobs_pkey | btree | ✅ | ✅ | id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| ocr_jobs_service_role | ALL | PERMISSIVE | service_role | `true` |
| ocr_jobs_tenant_isolation | ALL | PERMISSIVE | authenticated | `(company_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'company_id'::text))` |

---


### 📊 ocr_documents

- **Row Count**: -1
- **Table Size**: 8192 bytes
- **Index Size**: 16 kB
- **Total Size**: 32 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (6)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| company_id | text | NO | - | - | FK |
| ocr_job_id | uuid | YES | - | - | FK |
| file_path | text | NO | - | - | - |
| page_count | integer | YES | - | - | - |
| created_at | timestamp with time zone | YES | now() | - | - |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| ocr_documents_ocr_job_id_fkey | ocr_job_id | ocr_jobs.id | NO ACTION | CASCADE |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| ocr_documents_pkey | btree | ✅ | ✅ | id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| ocr_documents_service_role | ALL | PERMISSIVE | service_role | `true` |
| ocr_documents_tenant_isolation | ALL | PERMISSIVE | authenticated | `(company_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'company_id'::text))` |

---


### 📊 ocr_line_items

- **Row Count**: -1
- **Table Size**: 8192 bytes
- **Index Size**: 16 kB
- **Total Size**: 32 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (9)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| company_id | text | NO | - | - | FK |
| ocr_document_id | uuid | YES | - | - | FK |
| line_index | integer | NO | - | - | - |
| sku | text | YES | - | - | - |
| description | text | YES | - | - | - |
| qty | numeric | YES | - | - | - |
| unit_price | numeric | YES | - | - | - |
| total | numeric | YES | - | - | - |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| ocr_line_items_ocr_document_id_fkey | ocr_document_id | ocr_documents.id | NO ACTION | CASCADE |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| ocr_line_items_pkey | btree | ✅ | ✅ | id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| ocr_line_items_service_role | ALL | PERMISSIVE | service_role | `true` |
| ocr_line_items_tenant_isolation | ALL | PERMISSIVE | authenticated | `(company_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'company_id'::text))` |

---


### 📊 ocr_note_entities

- **Row Count**: -1
- **Table Size**: 8192 bytes
- **Index Size**: 16 kB
- **Total Size**: 32 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (5)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| ocr_document_id | uuid | YES | - | - | FK |
| label | text | NO | - | - | - |
| value | text | YES | - | - | - |
| tenant_id | uuid | YES | - | - | FK |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| ocr_note_entities_ocr_document_id_fkey | ocr_document_id | ocr_documents.id | NO ACTION | CASCADE |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| ocr_note_entities_pkey | btree | ✅ | ✅ | id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| ocr_note_entities_service_role | ALL | PERMISSIVE | service_role | `true` |
| tenant_isolation | ALL | PERMISSIVE |  | `((tenant_id)::text = (((current_setting('request.jwt.claims'::text, true))::json -> 'app_metadata'::text) ->> 'tenant_id'::text))` |

---


### 📊 vendor_locations

- **Row Count**: -1
- **Table Size**: 8192 bytes
- **Index Size**: 16 kB
- **Total Size**: 32 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (8)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| vendor_id | uuid | NO | - | - | FK |
| address | text | YES | - | - | - |
| city | text | YES | - | - | - |
| state | text | YES | - | - | - |
| postal_code | text | YES | - | - | - |
| country | text | YES | - | - | - |
| tenant_id | uuid | YES | - | - | FK |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| vendor_locations_vendor_id_fkey | vendor_id | vendors.id | NO ACTION | CASCADE |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| vendor_locations_pkey | btree | ✅ | ✅ | id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| tenant_isolation | ALL | PERMISSIVE |  | `((tenant_id)::text = (((current_setting('request.jwt.claims'::text, true))::json -> 'app_metadata'::text) ->> 'tenant_id'::text))` |
| vendor_locations_service_role | ALL | PERMISSIVE | service_role | `true` |

---


### 📊 item_transactions

- **Row Count**: -1
- **Table Size**: 0 bytes
- **Index Size**: 40 kB
- **Total Size**: 48 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (21)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| tenant_id | uuid | NO | - | - | FK |
| transaction_type | text | NO | - | - | - |
| item_id | uuid | NO | - | - | FK |
| quantity | numeric | NO | 1 | - | - |
| from_location_id | uuid | YES | - | - | FK |
| to_location_id | uuid | YES | - | - | FK |
| from_user_id | uuid | YES | - | - | FK |
| to_user_id | uuid | YES | - | - | FK |
| job_id | uuid | YES | - | - | FK |
| purchase_order_id | uuid | YES | - | - | FK |
| work_order_id | uuid | YES | - | - | FK |
| cost | numeric | YES | - | - | - |
| notes | text | YES | - | - | - |
| reason | text | YES | - | - | - |
| voice_session_id | uuid | YES | - | - | FK |
| detection_session_id | uuid | YES | - | - | FK |
| confidence_score | numeric | YES | - | - | - |
| metadata | jsonb | YES | '{}'::jsonb | - | - |
| created_at | timestamp with time zone | YES | now() | - | - |
| created_by | uuid | YES | - | - | - |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| item_transactions_item_id_fkey | item_id | items.id | NO ACTION | CASCADE |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_transactions_job | btree | - | - | job_id | 8192 bytes |
| idx_transactions_tenant_item | btree | - | - | tenant_id, item_id | 8192 bytes |
| idx_transactions_type_date | btree | - | - | transaction_type, created_at | 8192 bytes |
| idx_transactions_voice | btree | - | - | voice_session_id | 8192 bytes |
| item_transactions_pkey | btree | ✅ | ✅ | id | 8192 bytes |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| transactions_service_role | ALL | PERMISSIVE |  | `((auth.jwt() ->> 'role'::text) = 'service_role'::text)` |
| transactions_tenant_isolation | ALL | PERMISSIVE |  | `(tenant_id = ((((current_setting('request.jwt.claims'::text, true))::json -> 'app_metadata'::text) ->> 'tenant_id'::text))::uuid)` |

---


### 📊 mfa_challenges

- **Row Count**: -1
- **Table Size**: 0 bytes
- **Index Size**: 40 kB
- **Total Size**: 48 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (13)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | uuid_generate_v4() | - | PK |
| challenge_id | text | NO | - | - | FK |
| user_id | uuid | NO | - | - | FK |
| method | USER-DEFINED | NO | - | - | - |
| challenge_data | text | YES | - | - | - |
| expires_at | timestamp with time zone | NO | (now() + '00:05:00'::interval) | - | - |
| attempts | integer | YES | 0 | - | - |
| max_attempts | integer | YES | 3 | - | - |
| completed_at | timestamp with time zone | YES | - | - | - |
| success | boolean | YES | false | - | - |
| ip_address | inet | YES | - | - | - |
| user_agent | text | YES | - | - | - |
| created_at | timestamp with time zone | NO | now() | - | - |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_mfa_challenges_challenge_id | btree | - | - | challenge_id | 8192 bytes |
| idx_mfa_challenges_expires_at | btree | - | - | expires_at | 8192 bytes |
| idx_mfa_challenges_user_id | btree | - | - | user_id | 8192 bytes |
| mfa_challenges_challenge_id_key | btree | ✅ | - | challenge_id | 8192 bytes |
| mfa_challenges_pkey | btree | ✅ | ✅ | id | 8192 bytes |
| mfa_challenges_pkey | btree | ✅ | ✅ | id | 8192 bytes |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| Users can manage own MFA challenges | ALL | PERMISSIVE |  | `(auth.uid() = user_id)` |

---


### 📊 mfa_settings

- **Row Count**: -1
- **Table Size**: 0 bytes
- **Index Size**: 32 kB
- **Total Size**: 40 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (18)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | uuid_generate_v4() | - | PK |
| user_id | uuid | NO | - | - | FK |
| enabled | boolean | NO | false | - | - |
| primary_method | USER-DEFINED | YES | - | - | - |
| backup_methods | ARRAY | YES | '{}'::mfa_method[] | - | - |
| totp_secret | text | YES | - | - | - |
| totp_backup_codes | ARRAY | YES | - | - | - |
| sms_phone | text | YES | - | - | - |
| email_verified | boolean | YES | false | - | - |
| voice_biometric_enabled | boolean | YES | false | - | - |
| voice_pattern_samples | integer | YES | 0 | - | - |
| recovery_codes_generated_at | timestamp with time zone | YES | - | - | - |
| last_used_at | timestamp with time zone | YES | - | - | - |
| failed_attempts | integer | YES | 0 | - | - |
| locked_until | timestamp with time zone | YES | - | - | - |
| settings | jsonb | YES | '{}'::jsonb | - | - |
| created_at | timestamp with time zone | NO | now() | - | - |
| updated_at | timestamp with time zone | NO | now() | - | - |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_mfa_settings_enabled | btree | - | - | enabled | 8192 bytes |
| idx_mfa_settings_user_id | btree | - | - | user_id | 8192 bytes |
| mfa_settings_pkey | btree | ✅ | ✅ | id | 8192 bytes |
| mfa_settings_user_id_key | btree | ✅ | - | user_id | 8192 bytes |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| Users can manage own MFA settings | ALL | PERMISSIVE |  | `(auth.uid() = user_id)` |

---


### 📊 migration_tracking

- **Row Count**: -1
- **Table Size**: 0 bytes
- **Index Size**: 32 kB
- **Total Size**: 40 kB
- **RLS Enabled**: ❌
- **Primary Keys**: id

#### Columns (10)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | uuid_generate_v4() | - | PK |
| table_name | character varying | NO | - | - | - |
| has_company_id | boolean | NO | false | - | FK |
| has_tenant_id | boolean | NO | false | - | FK |
| row_count | integer | NO | 0 | - | - |
| migration_status | character varying | NO | 'pending'::character varying | - | - |
| migrated_at | timestamp with time zone | YES | - | - | - |
| error_message | text | YES | - | - | - |
| created_at | timestamp with time zone | NO | now() | - | - |
| updated_at | timestamp with time zone | NO | now() | - | - |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_migration_status | btree | - | - | migration_status | 8192 bytes |
| idx_migration_table | btree | - | - | table_name | 8192 bytes |
| migration_tracking_pkey | btree | ✅ | ✅ | id | 8192 bytes |
| migration_tracking_table_name_key | btree | ✅ | - | table_name | 8192 bytes |

---


### 📊 user_invitations

- **Row Count**: -1
- **Table Size**: 0 bytes
- **Index Size**: 56 kB
- **Total Size**: 64 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (15)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | uuid_generate_v4() | - | PK |
| email | text | NO | - | - | - |
| tenant_id | uuid | NO | - | - | FK |
| role | USER-DEFINED | NO | 'customer'::user_role | - | - |
| invitation_code | text | NO | - | - | - |
| invited_by | uuid | NO | - | - | - |
| invited_at | timestamp with time zone | NO | now() | - | - |
| expires_at | timestamp with time zone | NO | (now() + '7 days'::interval) | - | - |
| accepted_at | timestamp with time zone | YES | - | - | - |
| accepted_by | uuid | YES | - | - | - |
| is_used | boolean | NO | false | - | - |
| welcome_message | text | YES | - | - | - |
| permissions_preset | jsonb | YES | '{}'::jsonb | - | - |
| voice_onboarding_enabled | boolean | YES | false | - | - |
| metadata | jsonb | YES | '{}'::jsonb | - | - |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| user_invitations_tenant_id_fkey | tenant_id | tenants.id | NO ACTION | CASCADE |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_user_invitations_code | btree | - | - | invitation_code | 8192 bytes |
| idx_user_invitations_email | btree | - | - | email | 8192 bytes |
| idx_user_invitations_expires_at | btree | - | - | expires_at | 8192 bytes |
| idx_user_invitations_tenant_id | btree | - | - | tenant_id | 8192 bytes |
| idx_user_invitations_used | btree | - | - | is_used | 8192 bytes |
| user_invitations_invitation_code_key | btree | ✅ | - | invitation_code | 8192 bytes |
| user_invitations_pkey | btree | ✅ | ✅ | id | 8192 bytes |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| Admins can manage invitations | ALL | PERMISSIVE |  | `(EXISTS ( SELECT 1
   FROM users_extended ue
  WHERE ((ue.id = auth.uid()) AND (ue.role = ANY (ARRAY['admin'::user_role, 'manager'::user_role])))))` |

---


### 📊 table_inventory

- **Row Count**: -1
- **Table Size**: 0 bytes
- **Index Size**: 32 kB
- **Total Size**: 40 kB
- **RLS Enabled**: ❌
- **Primary Keys**: id

#### Columns (11)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | uuid_generate_v4() | - | PK |
| schema_name | character varying | NO | 'public'::character varying | - | - |
| table_name | character varying | NO | - | - | - |
| category | character varying | NO | - | - | - |
| row_count | integer | NO | 0 | - | - |
| has_code_references | boolean | NO | false | - | - |
| has_relationships | boolean | NO | false | - | - |
| last_modified | timestamp with time zone | YES | - | - | - |
| decision | character varying | NO | 'keep'::character varying | - | - |
| decision_reason | text | YES | - | - | - |
| created_at | timestamp with time zone | NO | now() | - | - |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_table_category | btree | - | - | category | 8192 bytes |
| idx_table_decision | btree | - | - | decision | 8192 bytes |
| table_inventory_pkey | btree | ✅ | ✅ | id | 8192 bytes |
| table_inventory_schema_name_table_name_key | btree | ✅ | - | schema_name, table_name | 8192 bytes |

---


### 📊 tenant_assignments

- **Row Count**: -1
- **Table Size**: 0 bytes
- **Index Size**: 56 kB
- **Total Size**: 64 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (13)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | uuid_generate_v4() | - | PK |
| user_id | uuid | NO | - | - | FK |
| tenant_id | uuid | NO | - | - | FK |
| role | USER-DEFINED | NO | - | - | - |
| is_primary | boolean | NO | false | - | - |
| assigned_by | uuid | YES | - | - | - |
| assigned_at | timestamp with time zone | NO | now() | - | - |
| expires_at | timestamp with time zone | YES | - | - | - |
| is_active | boolean | NO | true | - | - |
| access_level | integer | YES | 1 | - | - |
| permissions_override | jsonb | YES | '{}'::jsonb | - | - |
| last_accessed_at | timestamp with time zone | YES | - | - | - |
| access_count | integer | YES | 0 | - | - |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| tenant_assignments_tenant_id_fkey | tenant_id | tenants.id | NO ACTION | CASCADE |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_tenant_assignments_active | btree | - | - | is_active | 8192 bytes |
| idx_tenant_assignments_primary | btree | - | - | is_primary | 8192 bytes |
| idx_tenant_assignments_role | btree | - | - | role | 8192 bytes |
| idx_tenant_assignments_tenant_id | btree | - | - | tenant_id | 8192 bytes |
| idx_tenant_assignments_user_id | btree | - | - | user_id | 8192 bytes |
| tenant_assignments_pkey | btree | ✅ | ✅ | id | 8192 bytes |
| tenant_assignments_user_id_tenant_id_key | btree | ✅ | - | user_id, tenant_id | 8192 bytes |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| Admins can manage tenant assignments | ALL | PERMISSIVE |  | `(EXISTS ( SELECT 1
   FROM users_extended ue
  WHERE ((ue.id = auth.uid()) AND (ue.role = 'admin'::user_role))))` |
| Users can view own tenant assignments | SELECT | PERMISSIVE |  | `(auth.uid() = user_id)` |

---


### 📊 repository_inventory

- **Row Count**: -1
- **Table Size**: 8192 bytes
- **Index Size**: 64 kB
- **Total Size**: 80 kB
- **RLS Enabled**: ❌
- **Primary Keys**: id

#### Columns (10)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | uuid_generate_v4() | - | PK |
| domain | character varying | NO | - | - | - |
| repository_name | character varying | NO | - | - | - |
| file_path | character varying | NO | - | - | - |
| pattern_type | character varying | NO | - | - | - |
| target_pattern | character varying | NO | 'class_based'::character varying | - | - |
| migration_status | character varying | NO | 'pending'::character varying | - | - |
| dependencies_count | integer | NO | 0 | - | - |
| created_at | timestamp with time zone | NO | now() | - | - |
| migrated_at | timestamp with time zone | YES | - | - | - |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_repo_pattern | btree | - | - | pattern_type | 16 kB |
| idx_repo_status | btree | - | - | migration_status | 16 kB |
| repository_inventory_pkey | btree | ✅ | ✅ | id | 16 kB |
| unique_file_path | btree | ✅ | - | file_path | 16 kB |

---


### 📊 equipment_incidents

- **Row Count**: -1
- **Table Size**: 8192 bytes
- **Index Size**: 48 kB
- **Total Size**: 64 kB
- **RLS Enabled**: ❌
- **Primary Keys**: id

#### Columns (11)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | uuid_generate_v4() | - | PK |
| company_id | text | NO | - | - | FK |
| reported_by | uuid | NO | - | - | - |
| incident_type | text | NO | - | - | - |
| equipment_item | text | NO | - | - | - |
| description | text | YES | - | - | - |
| verification_id | uuid | YES | - | - | FK |
| severity | text | NO | - | - | - |
| status | text | NO | - | - | - |
| created_at | timestamp with time zone | YES | now() | - | - |
| updated_at | timestamp with time zone | YES | now() | - | - |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| equipment_incidents_pkey | btree | ✅ | ✅ | id | 16 kB |
| idx_equipment_incidents_company | btree | - | - | company_id | 16 kB |
| idx_equipment_incidents_reported_by | btree | - | - | reported_by | 16 kB |

---


### 📊 voice_profiles

- **Row Count**: -1
- **Table Size**: 0 bytes
- **Index Size**: 56 kB
- **Total Size**: 64 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (22)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | uuid_generate_v4() | - | PK |
| user_id | uuid | NO | - | - | FK |
| wake_word | text | YES | 'hey assistant'::text | - | - |
| speech_rate | numeric | YES | 1.0 | - | - |
| voice_pitch | numeric | YES | 1.0 | - | - |
| preferred_voice | text | YES | - | - | - |
| language_code | text | NO | 'en-US'::text | - | - |
| voice_feedback_enabled | boolean | NO | true | - | - |
| voice_feedback_level | text | YES | 'standard'::text | - | - |
| preferred_tts_provider | text | YES | 'system'::text | - | - |
| voice_pattern_hash | text | YES | - | - | - |
| confidence_threshold | numeric | YES | 0.80 | - | - |
| voice_samples_collected | integer | YES | 0 | - | - |
| last_voice_training_at | timestamp with time zone | YES | - | - | - |
| voice_recognition_provider | text | YES | 'system'::text | - | - |
| noise_cancellation_enabled | boolean | YES | true | - | - |
| voice_commands_enabled | boolean | YES | true | - | - |
| accessibility_voice_navigation | boolean | YES | false | - | - |
| onboarding_completed | boolean | YES | false | - | - |
| voice_analytics | jsonb | YES | '{}'::jsonb | - | - |
| created_at | timestamp with time zone | NO | now() | - | - |
| updated_at | timestamp with time zone | NO | now() | - | - |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_voice_profiles_language | btree | - | - | language_code | 8192 bytes |
| idx_voice_profiles_onboarding | btree | - | - | onboarding_completed | 8192 bytes |
| idx_voice_profiles_pattern_hash | btree | - | - | voice_pattern_hash | 8192 bytes |
| idx_voice_profiles_provider | btree | - | - | preferred_tts_provider | 8192 bytes |
| idx_voice_profiles_user_id | btree | - | - | user_id | 8192 bytes |
| voice_profiles_pkey | btree | ✅ | ✅ | id | 8192 bytes |
| voice_profiles_user_id_key | btree | ✅ | - | user_id | 8192 bytes |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| Users can manage own voice profile | ALL | PERMISSIVE |  | `(auth.uid() = user_id)` |

---


### 📊 notifications

- **Row Count**: -1
- **Table Size**: 8192 bytes
- **Index Size**: 32 kB
- **Total Size**: 48 kB
- **RLS Enabled**: ❌
- **Primary Keys**: id

#### Columns (11)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | uuid_generate_v4() | - | PK |
| user_id | uuid | NO | - | - | FK |
| notification_type | text | NO | - | - | - |
| title | text | NO | - | - | - |
| message | text | NO | - | - | - |
| priority | text | NO | - | - | - |
| related_entity_type | text | YES | - | - | - |
| related_entity_id | uuid | YES | - | - | FK |
| read_at | timestamp with time zone | YES | - | - | - |
| created_at | timestamp with time zone | YES | now() | - | - |
| tenant_id | uuid | YES | - | - | FK |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_notifications_user | btree | - | - | user_id, read_at | 16 kB |
| notifications_pkey | btree | ✅ | ✅ | id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| tenant_isolation | ALL | PERMISSIVE |  | `((tenant_id)::text = (((current_setting('request.jwt.claims'::text, true))::json -> 'app_metadata'::text) ->> 'tenant_id'::text))` |

---


### 📊 quality_audits

- **Row Count**: -1
- **Table Size**: 8192 bytes
- **Index Size**: 32 kB
- **Total Size**: 48 kB
- **RLS Enabled**: ❌
- **Primary Keys**: id

#### Columns (10)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | uuid_generate_v4() | - | PK |
| company_id | text | NO | - | - | FK |
| auditor_id | uuid | NO | - | - | FK |
| audit_date | date | NO | - | - | - |
| jobs_audited | integer | NO | - | - | - |
| site_inspection_verification_id | uuid | YES | - | - | FK |
| quality_score | numeric | YES | - | - | - |
| issues_found | integer | YES | - | - | - |
| status | text | NO | - | - | - |
| created_at | timestamp with time zone | YES | now() | - | - |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_quality_audits_company_date | btree | - | - | company_id, audit_date | 16 kB |
| quality_audits_pkey | btree | ✅ | ✅ | id | 16 kB |

---


### 📊 role_permissions

- **Row Count**: -1
- **Table Size**: 8192 bytes
- **Index Size**: 72 kB
- **Total Size**: 88 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (9)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | uuid_generate_v4() | - | PK |
| role | USER-DEFINED | NO | - | - | - |
| permission_id | uuid | NO | - | - | FK |
| tenant_id | uuid | YES | - | - | FK |
| granted_by | uuid | YES | - | - | - |
| granted_at | timestamp with time zone | NO | now() | - | - |
| expires_at | timestamp with time zone | YES | - | - | - |
| is_active | boolean | NO | true | - | - |
| conditions | jsonb | YES | '{}'::jsonb | - | - |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| role_permissions_permission_id_fkey | permission_id | permissions.id | NO ACTION | CASCADE |
| role_permissions_tenant_id_fkey | tenant_id | tenants.id | NO ACTION | CASCADE |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_role_permissions_active | btree | - | - | is_active | 16 kB |
| idx_role_permissions_role | btree | - | - | role | 16 kB |
| idx_role_permissions_tenant | btree | - | - | tenant_id | 8192 bytes |
| role_permissions_pkey | btree | ✅ | ✅ | id | 16 kB |
| role_permissions_role_permission_id_tenant_id_key | btree | ✅ | - | role, permission_id, tenant_id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| Admins can manage role permissions | ALL | PERMISSIVE |  | `(EXISTS ( SELECT 1
   FROM users_extended ue
  WHERE ((ue.id = auth.uid()) AND (ue.role = 'admin'::user_role))))` |
| Users can view role permissions | SELECT | PERMISSIVE |  | `true` |

---


### 📊 training_certificates

- **Row Count**: -1
- **Table Size**: 8192 bytes
- **Index Size**: 32 kB
- **Total Size**: 48 kB
- **RLS Enabled**: ❌
- **Primary Keys**: id

#### Columns (10)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | uuid_generate_v4() | - | PK |
| company_id | text | NO | - | - | FK |
| training_session_id | uuid | NO | - | - | FK |
| trainee_id | uuid | NO | - | - | FK |
| certificate_type | text | NO | - | - | - |
| issued_date | timestamp with time zone | NO | - | - | - |
| score | numeric | YES | - | - | - |
| status | text | NO | - | - | - |
| expires_at | timestamp with time zone | YES | - | - | - |
| created_at | timestamp with time zone | YES | now() | - | - |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_training_certificates_trainee | btree | - | - | trainee_id | 16 kB |
| training_certificates_pkey | btree | ✅ | ✅ | id | 16 kB |

---


### 📊 maintenance_schedule

- **Row Count**: -1
- **Table Size**: 8192 bytes
- **Index Size**: 48 kB
- **Total Size**: 64 kB
- **RLS Enabled**: ❌
- **Primary Keys**: id

#### Columns (8)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | uuid_generate_v4() | - | PK |
| company_id | text | NO | - | - | FK |
| equipment_id | text | NO | - | - | FK |
| scheduled_date | timestamp with time zone | NO | - | - | - |
| maintenance_type | text | NO | - | - | - |
| assigned_to | uuid | YES | - | - | - |
| status | text | NO | - | - | - |
| created_at | timestamp with time zone | YES | now() | - | - |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_maintenance_schedule_company | btree | - | - | company_id | 16 kB |
| idx_maintenance_schedule_date | btree | - | - | scheduled_date | 16 kB |
| maintenance_schedule_pkey | btree | ✅ | ✅ | id | 16 kB |

---


### 📊 user_activity_logs

- **Row Count**: -1
- **Table Size**: 8192 bytes
- **Index Size**: 48 kB
- **Total Size**: 64 kB
- **RLS Enabled**: ❌
- **Primary Keys**: id

#### Columns (8)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | uuid_generate_v4() | - | PK |
| user_id | uuid | NO | - | - | FK |
| company_id | text | NO | - | - | FK |
| activity_date | date | NO | - | - | - |
| jobs_completed | integer | YES | - | - | - |
| equipment_return_verification_id | uuid | YES | - | - | FK |
| summary | text | YES | - | - | - |
| created_at | timestamp with time zone | YES | now() | - | - |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_user_activity_logs_company | btree | - | - | company_id | 16 kB |
| idx_user_activity_logs_user_date | btree | - | - | user_id, activity_date | 16 kB |
| user_activity_logs_pkey | btree | ✅ | ✅ | id | 16 kB |

---


### 📊 permissions

- **Row Count**: -1
- **Table Size**: 8192 bytes
- **Index Size**: 64 kB
- **Total Size**: 80 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (10)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | uuid_generate_v4() | - | PK |
| name | text | NO | - | - | - |
| resource | text | NO | - | - | - |
| action | text | NO | - | - | - |
| description | text | YES | - | - | - |
| voice_commands | ARRAY | YES | - | - | - |
| requires_confirmation | boolean | YES | false | - | - |
| risk_level | integer | YES | 1 | - | - |
| created_at | timestamp with time zone | NO | now() | - | - |
| updated_at | timestamp with time zone | NO | now() | - | - |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_permissions_resource_action | btree | - | - | resource, action | 16 kB |
| idx_permissions_risk_level | btree | - | - | risk_level | 16 kB |
| permissions_name_key | btree | ✅ | - | name | 16 kB |
| permissions_pkey | btree | ✅ | ✅ | id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| Admins can manage permissions | ALL | PERMISSIVE |  | `(EXISTS ( SELECT 1
   FROM users_extended ue
  WHERE ((ue.id = auth.uid()) AND (ue.role = 'admin'::user_role))))` |
| Users can view permissions | SELECT | PERMISSIVE |  | `true` |

---


### 📊 user_assignments

- **Row Count**: -1
- **Table Size**: 0 bytes
- **Index Size**: 32 kB
- **Total Size**: 40 kB
- **RLS Enabled**: ❌
- **Primary Keys**: id

#### Columns (7)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | uuid_generate_v4() | - | PK |
| user_id | uuid | NO | - | - | FK |
| tenant_id | text | NO | - | - | FK |
| role | text | NO | - | - | - |
| is_active | boolean | YES | true | - | - |
| created_at | timestamp with time zone | YES | now() | - | - |
| updated_at | timestamp with time zone | YES | now() | - | - |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_user_assignments_tenant | btree | - | - | tenant_id | 8192 bytes |
| idx_user_assignments_user | btree | - | - | user_id | 8192 bytes |
| user_assignments_pkey | btree | ✅ | ✅ | id | 8192 bytes |
| user_assignments_user_id_tenant_id_key | btree | ✅ | - | user_id, tenant_id | 8192 bytes |

---


### 📊 daily_reports

- **Row Count**: -1
- **Table Size**: 8192 bytes
- **Index Size**: 16 kB
- **Total Size**: 32 kB
- **RLS Enabled**: ❌
- **Primary Keys**: id

#### Columns (9)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | uuid_generate_v4() | - | PK |
| report_date | date | NO | - | - | - |
| created_by | uuid | NO | - | - | - |
| technician_count | integer | NO | - | - | - |
| jobs_assigned | integer | NO | - | - | - |
| equipment_audit_id | uuid | YES | - | - | FK |
| summary_text | text | YES | - | - | - |
| created_at | timestamp with time zone | YES | now() | - | - |
| tenant_id | uuid | YES | - | - | FK |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| daily_reports_pkey | btree | ✅ | ✅ | id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| tenant_isolation | ALL | PERMISSIVE |  | `((tenant_id)::text = (((current_setting('request.jwt.claims'::text, true))::json -> 'app_metadata'::text) ->> 'tenant_id'::text))` |

---


### 📊 material_requests

- **Row Count**: -1
- **Table Size**: 8192 bytes
- **Index Size**: 64 kB
- **Total Size**: 80 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (12)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| tenant_id | uuid | NO | - | - | FK |
| job_id | uuid | YES | - | - | FK |
| requested_by | uuid | NO | - | - | - |
| status | text | NO | 'pending'::text | - | - |
| priority | text | NO | 'normal'::text | - | - |
| items_needed | jsonb | NO | - | - | - |
| reason | text | YES | - | - | - |
| created_at | timestamp with time zone | NO | now() | - | - |
| fulfilled_at | timestamp with time zone | YES | - | - | - |
| fulfilled_by | uuid | YES | - | - | - |
| notes | text | YES | - | - | - |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| material_requests_job_id_fkey | job_id | jobs.id | NO ACTION | CASCADE |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_material_requests_job | btree | - | - | job_id | 16 kB |
| idx_material_requests_status | btree | - | - | status | 16 kB |
| idx_material_requests_tenant | btree | - | - | tenant_id | 16 kB |
| material_requests_pkey | btree | ✅ | ✅ | id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| Users can create material requests | INSERT | PERMISSIVE |  | `` |
| Users can view their tenant's material requests | SELECT | PERMISSIVE |  | `(tenant_id IN ( SELECT users_extended.tenant_id
   FROM users_extended
  WHERE (users_extended.id = auth.uid())))` |

---


### 📊 customer_feedback

- **Row Count**: -1
- **Table Size**: 8192 bytes
- **Index Size**: 80 kB
- **Total Size**: 96 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (14)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| tenant_id | uuid | NO | - | - | FK |
| customer_id | uuid | YES | - | - | FK |
| job_id | uuid | YES | - | - | FK |
| feedback_type | text | NO | - | - | - |
| severity | text | YES | - | - | - |
| description | text | NO | - | - | - |
| reported_by | uuid | NO | - | - | - |
| status | text | NO | 'open'::text | - | - |
| escalated_to | uuid | YES | - | - | - |
| escalation_notes | text | YES | - | - | - |
| created_at | timestamp with time zone | NO | now() | - | - |
| resolved_at | timestamp with time zone | YES | - | - | - |
| resolution_notes | text | YES | - | - | - |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| customer_feedback_job_id_fkey | job_id | jobs.id | NO ACTION | SET NULL |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| customer_feedback_pkey | btree | ✅ | ✅ | id | 16 kB |
| idx_customer_feedback_customer | btree | - | - | customer_id | 16 kB |
| idx_customer_feedback_job | btree | - | - | job_id | 16 kB |
| idx_customer_feedback_status | btree | - | - | status | 16 kB |
| idx_customer_feedback_tenant | btree | - | - | tenant_id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| Managers can create feedback | INSERT | PERMISSIVE |  | `` |
| Users can view their tenant's feedback | SELECT | PERMISSIVE |  | `(tenant_id IN ( SELECT users_extended.tenant_id
   FROM users_extended
  WHERE (users_extended.id = auth.uid())))` |

---


### 📊 maintenance_tickets

- **Row Count**: -1
- **Table Size**: 0 bytes
- **Index Size**: 32 kB
- **Total Size**: 40 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (14)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| tenant_id | uuid | NO | - | - | FK |
| equipment_id | uuid | YES | - | - | FK |
| reported_by | uuid | NO | - | - | - |
| issue_type | text | NO | - | - | - |
| severity | text | NO | - | - | - |
| description | text | NO | - | - | - |
| status | text | NO | 'open'::text | - | - |
| assigned_to | uuid | YES | - | - | - |
| resolution_notes | text | YES | - | - | - |
| created_at | timestamp with time zone | NO | now() | - | - |
| resolved_at | timestamp with time zone | YES | - | - | - |
| estimated_cost | numeric | YES | - | - | - |
| actual_cost | numeric | YES | - | - | - |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_maintenance_tickets_equipment | btree | - | - | equipment_id | 8192 bytes |
| idx_maintenance_tickets_status | btree | - | - | status | 8192 bytes |
| idx_maintenance_tickets_tenant | btree | - | - | tenant_id | 8192 bytes |
| maintenance_tickets_pkey | btree | ✅ | ✅ | id | 8192 bytes |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| Users can create tickets | INSERT | PERMISSIVE |  | `` |
| Users can view their tenant's tickets | SELECT | PERMISSIVE |  | `(tenant_id IN ( SELECT users_extended.tenant_id
   FROM users_extended
  WHERE (users_extended.id = auth.uid())))` |

---


### 📊 user_sessions

- **Row Count**: -1
- **Table Size**: 0 bytes
- **Index Size**: 80 kB
- **Total Size**: 88 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (25)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | uuid_generate_v4() | - | PK |
| user_id | uuid | NO | - | - | FK |
| tenant_id | uuid | NO | - | - | FK |
| session_token | text | YES | - | - | - |
| refresh_token_hash | text | YES | - | - | - |
| device_id | text | NO | - | - | FK |
| device_name | text | YES | - | - | - |
| device_type | USER-DEFINED | NO | 'desktop'::device_type | - | - |
| device_fingerprint | text | YES | - | - | - |
| ip_address | inet | NO | - | - | - |
| user_agent | text | YES | - | - | - |
| location | jsonb | YES | - | - | - |
| voice_session_id | text | YES | - | - | FK |
| voice_session_active | boolean | YES | false | - | - |
| voice_session_expires_at | timestamp with time zone | YES | - | - | - |
| wake_word_active | boolean | YES | false | - | - |
| conversation_context | jsonb | YES | '{}'::jsonb | - | - |
| status | USER-DEFINED | NO | 'active'::session_status | - | - |
| expires_at | timestamp with time zone | NO | - | - | - |
| last_activity_at | timestamp with time zone | NO | now() | - | - |
| security_flags | jsonb | YES | '{}'::jsonb | - | - |
| refresh_count | integer | YES | 0 | - | - |
| created_at | timestamp with time zone | NO | now() | - | - |
| ended_at | timestamp with time zone | YES | - | - | - |
| voice_session_terminated | boolean | YES | false | - | - |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| user_sessions_tenant_id_fkey | tenant_id | tenants.id | NO ACTION | CASCADE |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_user_sessions_device_type | btree | - | - | device_type | 8192 bytes |
| idx_user_sessions_expires_at | btree | - | - | expires_at | 8192 bytes |
| idx_user_sessions_last_activity | btree | - | - | last_activity_at | 8192 bytes |
| idx_user_sessions_status | btree | - | - | status | 8192 bytes |
| idx_user_sessions_tenant_id | btree | - | - | tenant_id | 8192 bytes |
| idx_user_sessions_token | btree | - | - | session_token | 8192 bytes |
| idx_user_sessions_user_id | btree | - | - | user_id | 8192 bytes |
| idx_user_sessions_voice_active | btree | - | - | voice_session_active | 8192 bytes |
| user_sessions_pkey | btree | ✅ | ✅ | id | 8192 bytes |
| user_sessions_session_token_key | btree | ✅ | - | session_token | 8192 bytes |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| Admins can view tenant sessions | SELECT | PERMISSIVE |  | `(EXISTS ( SELECT 1
   FROM users_extended ue
  WHERE ((ue.id = auth.uid()) AND (ue.role = 'admin'::user_role) AND (ue.tenant_id = user_sessions.tenant_id))))` |
| System can insert sessions | INSERT | PERMISSIVE |  | `` |
| Users can update own sessions | UPDATE | PERMISSIVE |  | `(auth.uid() = user_id)` |
| Users can view own sessions | SELECT | PERMISSIVE |  | `(auth.uid() = user_id)` |

---


### 📊 travel_logs

- **Row Count**: -1
- **Table Size**: 8192 bytes
- **Index Size**: 64 kB
- **Total Size**: 80 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (11)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| tenant_id | uuid | NO | - | - | FK |
| user_id | uuid | NO | - | - | FK |
| from_property_id | uuid | YES | - | - | FK |
| to_property_id | uuid | YES | - | - | FK |
| departure_time | timestamp with time zone | NO | - | - | - |
| arrival_time | timestamp with time zone | YES | - | - | - |
| distance_km | numeric | YES | - | - | - |
| equipment_cleaned | boolean | YES | false | - | - |
| notes | text | YES | - | - | - |
| created_at | timestamp with time zone | NO | now() | - | - |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| travel_logs_from_property_id_fkey | from_property_id | properties.id | NO ACTION | SET NULL |
| travel_logs_to_property_id_fkey | to_property_id | properties.id | NO ACTION | SET NULL |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_travel_logs_departure | btree | - | - | departure_time | 16 kB |
| idx_travel_logs_tenant | btree | - | - | tenant_id | 16 kB |
| idx_travel_logs_user | btree | - | - | user_id | 16 kB |
| travel_logs_pkey | btree | ✅ | ✅ | id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| Users can create their own travel logs | INSERT | PERMISSIVE |  | `` |
| Users can view their own travel logs | SELECT | PERMISSIVE |  | `((user_id = auth.uid()) OR (tenant_id IN ( SELECT users_extended.tenant_id
   FROM users_extended
  WHERE (users_extended.id = auth.uid()))))` |

---


### 📊 audit_logs

- **Row Count**: -1
- **Table Size**: 8192 bytes
- **Index Size**: 80 kB
- **Total Size**: 96 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (10)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| tenant_id | uuid | NO | - | - | FK |
| entity_type | text | NO | - | - | - |
| entity_id | uuid | NO | - | - | FK |
| action | text | NO | - | - | - |
| performed_by | uuid | NO | - | - | - |
| details | jsonb | YES | - | - | - |
| ip_address | text | YES | - | - | - |
| user_agent | text | YES | - | - | - |
| created_at | timestamp with time zone | NO | now() | - | - |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| audit_logs_pkey | btree | ✅ | ✅ | id | 16 kB |
| idx_audit_logs_created_at | btree | - | - | created_at | 16 kB |
| idx_audit_logs_entity | btree | - | - | entity_type, entity_id | 16 kB |
| idx_audit_logs_performed_by | btree | - | - | performed_by | 16 kB |
| idx_audit_logs_tenant | btree | - | - | tenant_id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| Admins and managers can view audit logs | SELECT | PERMISSIVE |  | `(tenant_id IN ( SELECT users_extended.tenant_id
   FROM users_extended
  WHERE (users_extended.id = auth.uid())))` |
| System can insert audit logs | INSERT | PERMISSIVE |  | `` |

---


### 📊 job_reschedules

- **Row Count**: -1
- **Table Size**: 8192 bytes
- **Index Size**: 64 kB
- **Total Size**: 80 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (11)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| tenant_id | uuid | NO | - | - | FK |
| original_job_id | uuid | YES | - | - | FK |
| original_date | timestamp with time zone | NO | - | - | - |
| new_date | timestamp with time zone | NO | - | - | - |
| reason | text | NO | - | - | - |
| rescheduled_by | uuid | NO | - | - | - |
| status | text | NO | 'pending_confirmation'::text | - | - |
| customer_notified | boolean | YES | false | - | - |
| created_at | timestamp with time zone | NO | now() | - | - |
| confirmed_at | timestamp with time zone | YES | - | - | - |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| job_reschedules_original_job_id_fkey | original_job_id | jobs.id | NO ACTION | CASCADE |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_job_reschedules_job | btree | - | - | original_job_id | 16 kB |
| idx_job_reschedules_status | btree | - | - | status | 16 kB |
| idx_job_reschedules_tenant | btree | - | - | tenant_id | 16 kB |
| job_reschedules_pkey | btree | ✅ | ✅ | id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| Users can create reschedules | INSERT | PERMISSIVE |  | `` |
| Users can view their tenant's reschedules | SELECT | PERMISSIVE |  | `(tenant_id IN ( SELECT users_extended.tenant_id
   FROM users_extended
  WHERE (users_extended.id = auth.uid())))` |

---


### 📊 safety_checklist_completions

- **Row Count**: -1
- **Table Size**: 0 bytes
- **Index Size**: 32 kB
- **Total Size**: 40 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (10)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| checklist_id | uuid | NO | - | - | FK |
| job_id | uuid | YES | - | - | FK |
| user_id | uuid | NO | - | - | FK |
| completed_at | timestamp with time zone | YES | now() | - | - |
| items_completed | jsonb | YES | '[]'::jsonb | - | - |
| location | jsonb | YES | - | - | - |
| signature | text | YES | - | - | - |
| notes | text | YES | - | - | - |
| created_at | timestamp with time zone | YES | now() | - | - |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_safety_completions_checklist | btree | - | - | checklist_id | 8192 bytes |
| idx_safety_completions_job | btree | - | - | job_id | 8192 bytes |
| idx_safety_completions_user | btree | - | - | user_id | 8192 bytes |
| safety_checklist_completions_pkey | btree | ✅ | ✅ | id | 8192 bytes |

---


### 📊 conflict_logs

- **Row Count**: -1
- **Table Size**: 0 bytes
- **Index Size**: 40 kB
- **Total Size**: 48 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (24)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| company_id | uuid | NO | - | - | FK |
| entity_type | character varying | NO | - | - | - |
| entity_id | uuid | NO | - | - | FK |
| job_id | uuid | YES | - | - | FK |
| conflict_type | character varying | NO | - | - | - |
| field_name | character varying | YES | - | - | - |
| user1_id | uuid | NO | - | - | FK |
| user1_role | character varying | NO | - | - | - |
| user1_changes | jsonb | NO | - | - | - |
| user1_timestamp | timestamp with time zone | NO | - | - | - |
| user2_id | uuid | NO | - | - | FK |
| user2_role | character varying | NO | - | - | - |
| user2_changes | jsonb | NO | - | - | - |
| user2_timestamp | timestamp with time zone | NO | - | - | - |
| resolution_strategy | character varying | NO | - | - | - |
| merged_result | jsonb | NO | - | - | - |
| winning_user_id | uuid | YES | - | - | FK |
| requires_supervisor_review | boolean | NO | false | - | - |
| reviewed_by | uuid | YES | - | - | - |
| reviewed_at | timestamp with time zone | YES | - | - | - |
| review_notes | text | YES | - | - | - |
| detected_at | timestamp with time zone | NO | now() | - | - |
| resolved_at | timestamp with time zone | NO | now() | - | - |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| conflict_logs_pkey | btree | ✅ | ✅ | id | 8192 bytes |
| idx_conflict_logs_company | btree | - | - | company_id | 8192 bytes |
| idx_conflict_logs_entity | btree | - | - | entity_type, entity_id | 8192 bytes |
| idx_conflict_logs_job | btree | - | - | job_id | 8192 bytes |
| idx_conflict_logs_review | btree | - | - | requires_supervisor_review, reviewed_at | 8192 bytes |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| Company members view conflict logs | SELECT | PERMISSIVE |  | `((company_id)::text = (((current_setting('request.jwt.claims'::text, true))::json -> 'app_metadata'::text) ->> 'company_id'::text))` |
| Supervisors can review conflicts | UPDATE | PERMISSIVE |  | `(((company_id)::text = (((current_setting('request.jwt.claims'::text, true))::json -> 'app_metadata'::text) ->> 'company_id'::text)) AND ((((current_setting('request.jwt.claims'::text, true))::json -> 'app_metadata'::text) ->> 'role'::text) = ANY (ARRAY['supervisor'::text, 'admin'::text])))` |
| System can insert conflict logs | INSERT | PERMISSIVE |  | `` |

---


### 📊 dev_manifest_history

- **Row Count**: -1
- **Table Size**: 0 bytes
- **Index Size**: 24 kB
- **Total Size**: 32 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (9)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| created_at | timestamp with time zone | NO | now() | - | - |
| manifest_content | text | NO | - | - | - |
| file_count | integer | NO | - | - | - |
| generated_by | uuid | YES | - | - | - |
| branch_name | text | YES | - | - | - |
| commit_hash | text | YES | - | - | - |
| completion_percentage | integer | YES | - | - | - |
| voice_coverage_percentage | integer | YES | - | - | - |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| dev_manifest_history_pkey | btree | ✅ | ✅ | id | 8192 bytes |
| idx_dev_manifest_history_created_at | btree | - | - | created_at | 8192 bytes |
| idx_dev_manifest_history_generated_by | btree | - | - | generated_by | 8192 bytes |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| Developers can insert manifest history | INSERT | PERMISSIVE |  | `` |
| Developers can view manifest history | SELECT | PERMISSIVE |  | `((auth.uid() IN ( SELECT users.id
   FROM auth.users
  WHERE (((users.raw_user_meta_data ->> 'is_developer'::text) = 'true'::text) OR ((users.raw_app_meta_data ->> 'is_developer'::text) = 'true'::text)))) OR ((auth.jwt() ->> 'role'::text) = 'developer'::text))` |
| Users can delete own manifests | DELETE | PERMISSIVE |  | `(generated_by = auth.uid())` |
| Users can update own manifests | UPDATE | PERMISSIVE |  | `(generated_by = auth.uid())` |

---


### 📊 items

- **Row Count**: -1
- **Table Size**: 8192 bytes
- **Index Size**: 168 kB
- **Total Size**: 184 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (38)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| tenant_id | uuid | NO | - | - | FK |
| item_type | text | NO | - | - | - |
| category | text | NO | - | - | - |
| tracking_mode | text | NO | - | - | - |
| name | text | NO | - | - | - |
| description | text | YES | - | - | - |
| manufacturer | text | YES | - | - | - |
| model | text | YES | - | - | - |
| serial_number | text | YES | - | - | - |
| sku | text | YES | - | - | - |
| barcode | text | YES | - | - | - |
| current_quantity | numeric | YES | 0 | - | - |
| unit_of_measure | text | YES | 'each'::text | - | - |
| min_quantity | numeric | YES | - | - | - |
| max_quantity | numeric | YES | - | - | - |
| reorder_point | numeric | YES | - | - | - |
| current_location_id | uuid | YES | - | - | FK |
| home_location_id | uuid | YES | - | - | FK |
| assigned_to_user_id | uuid | YES | - | - | FK |
| assigned_to_job_id | uuid | YES | - | - | FK |
| status | text | NO | 'active'::text | - | - |
| condition | text | YES | - | - | - |
| last_maintenance_date | date | YES | - | - | - |
| next_maintenance_date | date | YES | - | - | - |
| purchase_date | date | YES | - | - | - |
| purchase_price | numeric | YES | - | - | - |
| current_value | numeric | YES | - | - | - |
| depreciation_method | text | YES | - | - | - |
| attributes | jsonb | YES | '{}'::jsonb | - | - |
| tags | ARRAY | YES | - | - | - |
| custom_fields | jsonb | YES | '{}'::jsonb | - | - |
| primary_image_url | text | YES | - | - | - |
| image_urls | ARRAY | YES | - | - | - |
| created_at | timestamp with time zone | YES | now() | - | - |
| created_by | uuid | YES | - | - | - |
| updated_at | timestamp with time zone | YES | now() | - | - |
| updated_by | uuid | YES | - | - | - |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_items_assigned_job | btree | - | - | assigned_to_job_id | 8192 bytes |
| idx_items_assigned_user | btree | - | - | assigned_to_user_id | 8192 bytes |
| idx_items_location | btree | - | - | current_location_id | 16 kB |
| idx_items_tenant_category | btree | - | - | tenant_id, category | 16 kB |
| idx_items_tenant_status | btree | - | - | tenant_id, status | 16 kB |
| idx_items_tenant_type | btree | - | - | tenant_id, item_type | 16 kB |
| items_pkey | btree | ✅ | ✅ | id | 16 kB |
| items_tenant_id_barcode_key | btree | ✅ | - | tenant_id, barcode | 16 kB |
| items_tenant_id_serial_number_key | btree | ✅ | - | tenant_id, serial_number | 16 kB |
| items_tenant_id_sku_key | btree | ✅ | - | tenant_id, sku | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| items_service_role | ALL | PERMISSIVE |  | `((auth.jwt() ->> 'role'::text) = 'service_role'::text)` |
| items_tenant_isolation | ALL | PERMISSIVE |  | `(tenant_id = ((((current_setting('request.jwt.claims'::text, true))::json -> 'app_metadata'::text) ->> 'tenant_id'::text))::uuid)` |

---


### 📊 routing_schedules

- **Row Count**: -1
- **Table Size**: 8192 bytes
- **Index Size**: 64 kB
- **Total Size**: 80 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (18)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| tenant_id | uuid | NO | - | - | FK |
| user_id | uuid | NO | - | - | FK |
| scheduled_date | timestamp with time zone | NO | - | - | - |
| job_ids | ARRAY | NO | - | - | - |
| total_distance_meters | double precision | YES | - | - | - |
| total_duration_minutes | integer | YES | - | - | - |
| route_geometry | text | YES | - | - | - |
| optimization_status | text | NO | 'pending'::text | - | - |
| mapbox_route_geometry | text | YES | - | - | - |
| created_at | timestamp with time zone | YES | now() | - | - |
| updated_at | timestamp with time zone | YES | now() | - | - |
| company_id | uuid | YES | - | - | FK |
| error_message | text | YES | - | - | - |
| start_location_lat | double precision | YES | - | - | - |
| start_location_lng | double precision | YES | - | - | - |
| total_duration_seconds | integer | YES | - | - | - |
| waypoints | jsonb | YES | '[]'::jsonb | - | - |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| routing_schedules_tenant_id_fkey | tenant_id | tenants.id | NO ACTION | CASCADE |
| routing_schedules_user_id_fkey | user_id | users_extended.id | NO ACTION | NO ACTION |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_routing_schedules_date | btree | - | - | scheduled_date | 16 kB |
| idx_routing_schedules_tenant | btree | - | - | tenant_id | 16 kB |
| idx_routing_schedules_user | btree | - | - | user_id | 16 kB |
| routing_schedules_pkey | btree | ✅ | ✅ | id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| routing_schedules_tenant_isolation | ALL | PERMISSIVE |  | `(tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)` |

---


### 📊 intake_requests

- **Row Count**: -1
- **Table Size**: 8192 bytes
- **Index Size**: 64 kB
- **Total Size**: 80 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (17)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| tenant_id | uuid | NO | - | - | FK |
| customer_name | text | NO | - | - | - |
| customer_email | text | YES | - | - | - |
| customer_phone | text | YES | - | - | - |
| service_type | text | YES | - | - | - |
| description | text | YES | - | - | - |
| status | text | NO | 'new'::text | - | - |
| priority | text | NO | 'medium'::text | - | - |
| converted_to_job_id | uuid | YES | - | - | FK |
| created_at | timestamp with time zone | YES | now() | - | - |
| updated_at | timestamp with time zone | YES | now() | - | - |
| assigned_to | uuid | YES | - | - | - |
| lead_score | integer | YES | - | - | - |
| converted_at | timestamp with time zone | YES | - | - | - |
| request_source | text | YES | 'website'::text | - | - |
| source | text | YES | 'website'::text | - | - |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| intake_requests_assigned_to_fkey | assigned_to | users_extended.id | NO ACTION | NO ACTION |
| intake_requests_converted_to_job_id_fkey | converted_to_job_id | jobs.id | NO ACTION | NO ACTION |
| intake_requests_tenant_id_fkey | tenant_id | tenants.id | NO ACTION | CASCADE |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_intake_requests_email | btree | - | - | customer_email | 16 kB |
| idx_intake_requests_phone | btree | - | - | customer_phone | 16 kB |
| idx_intake_requests_tenant | btree | - | - | tenant_id | 16 kB |
| intake_requests_pkey | btree | ✅ | ✅ | id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| intake_requests_tenant_isolation | ALL | PERMISSIVE |  | `(tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)` |

---


### 📊 dev_project_standards

- **Row Count**: -1
- **Table Size**: 8192 bytes
- **Index Size**: 48 kB
- **Total Size**: 64 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (9)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| document_title | text | NO | - | - | - |
| document_content | text | NO | - | - | - |
| version | text | NO | - | - | - |
| last_updated_at | timestamp with time zone | NO | now() | - | - |
| updated_by | uuid | YES | - | - | - |
| category | text | YES | 'general'::text | - | - |
| is_active | boolean | YES | true | - | - |
| tags | ARRAY | YES | - | - | - |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| dev_project_standards_pkey | btree | ✅ | ✅ | id | 16 kB |
| idx_dev_project_standards_category | btree | - | - | category | 16 kB |
| idx_dev_project_standards_title | btree | ✅ | - | document_title | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| Anyone can view project standards | SELECT | PERMISSIVE |  | `(is_active = true)` |
| Developers can delete project standards | DELETE | PERMISSIVE |  | `((auth.uid() IN ( SELECT users.id
   FROM auth.users
  WHERE (((users.raw_user_meta_data ->> 'is_developer'::text) = 'true'::text) OR ((users.raw_app_meta_data ->> 'is_developer'::text) = 'true'::text)))) OR ((auth.jwt() ->> 'role'::text) = 'developer'::text))` |
| Developers can insert project standards | INSERT | PERMISSIVE |  | `` |
| Developers can update project standards | UPDATE | PERMISSIVE |  | `((auth.uid() IN ( SELECT users.id
   FROM auth.users
  WHERE (((users.raw_user_meta_data ->> 'is_developer'::text) = 'true'::text) OR ((users.raw_app_meta_data ->> 'is_developer'::text) = 'true'::text)))) OR ((auth.jwt() ->> 'role'::text) = 'developer'::text))` |

---


### 📊 safety_checklists

- **Row Count**: -1
- **Table Size**: 8192 bytes
- **Index Size**: 48 kB
- **Total Size**: 64 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (12)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| tenant_id | uuid | NO | - | - | FK |
| job_id | uuid | NO | - | - | FK |
| user_id | uuid | NO | - | - | FK |
| checklist_items | jsonb | NO | '[]'::jsonb | - | - |
| completion_status | text | NO | 'in_progress'::text | - | - |
| completed_at | timestamp with time zone | YES | - | - | - |
| created_at | timestamp with time zone | YES | now() | - | - |
| updated_at | timestamp with time zone | YES | now() | - | - |
| supervisor_approved | boolean | YES | false | - | - |
| supervisor_id | uuid | YES | - | - | FK |
| supervisor_notes | text | YES | - | - | - |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| safety_checklists_job_id_fkey | job_id | jobs.id | NO ACTION | NO ACTION |
| safety_checklists_supervisor_id_fkey | supervisor_id | users_extended.id | NO ACTION | NO ACTION |
| safety_checklists_tenant_id_fkey | tenant_id | tenants.id | NO ACTION | CASCADE |
| safety_checklists_user_id_fkey | user_id | users_extended.id | NO ACTION | NO ACTION |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_safety_checklists_job | btree | - | - | job_id | 16 kB |
| idx_safety_checklists_tenant | btree | - | - | tenant_id | 16 kB |
| safety_checklists_pkey | btree | ✅ | ✅ | id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| safety_checklists_tenant_isolation | ALL | PERMISSIVE |  | `(tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)` |

---


### 📊 intake_documents

- **Row Count**: -1
- **Table Size**: 8192 bytes
- **Index Size**: 48 kB
- **Total Size**: 64 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (14)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| tenant_id | uuid | NO | - | - | FK |
| intake_request_id | uuid | NO | - | - | FK |
| document_url | text | NO | - | - | - |
| document_type | text | YES | - | - | - |
| ocr_text | text | YES | - | - | - |
| created_at | timestamp with time zone | YES | now() | - | - |
| ocr_confidence | double precision | YES | - | - | - |
| ocr_metadata | jsonb | YES | '{}'::jsonb | - | - |
| intake_id | uuid | YES | - | - | FK |
| storage_path | text | YES | - | - | - |
| file_size_bytes | bigint | YES | - | - | - |
| uploaded_at | timestamp with time zone | YES | now() | - | - |
| processed_at | timestamp with time zone | YES | - | - | - |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| intake_documents_intake_id_fkey | intake_id | intake_requests.id | NO ACTION | CASCADE |
| intake_documents_intake_request_id_fkey | intake_request_id | intake_requests.id | NO ACTION | CASCADE |
| intake_documents_tenant_id_fkey | tenant_id | tenants.id | NO ACTION | CASCADE |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| idx_intake_documents_request | btree | - | - | intake_request_id | 16 kB |
| idx_intake_documents_tenant | btree | - | - | tenant_id | 16 kB |
| intake_documents_pkey | btree | ✅ | ✅ | id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| intake_documents_tenant_isolation | ALL | PERMISSIVE |  | `(tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid)` |

---


### 📊 vendors

- **Row Count**: -1
- **Table Size**: 8192 bytes
- **Index Size**: 16 kB
- **Total Size**: 32 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (7)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| name | text | NO | - | - | - |
| is_active | boolean | YES | true | - | - |
| created_at | timestamp with time zone | YES | now() | - | - |
| updated_at | timestamp with time zone | YES | now() | - | - |
| intake_session_id | uuid | YES | - | - | FK |
| tenant_id | uuid | YES | - | - | FK |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| vendors_pkey | btree | ✅ | ✅ | id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| tenant_isolation | ALL | PERMISSIVE |  | `((tenant_id)::text = (((current_setting('request.jwt.claims'::text, true))::json -> 'app_metadata'::text) ->> 'tenant_id'::text))` |
| vendors_service_role | ALL | PERMISSIVE | service_role | `true` |

---


### 📊 vendor_aliases

- **Row Count**: -1
- **Table Size**: 8192 bytes
- **Index Size**: 16 kB
- **Total Size**: 32 kB
- **RLS Enabled**: ✅
- **Primary Keys**: id

#### Columns (4)

| Column | Type | Nullable | Default | Identity | Notes |
|--------|------|----------|---------|----------|-------|
| id | uuid | NO | gen_random_uuid() | - | PK |
| vendor_id | uuid | NO | - | - | FK |
| alias | text | NO | - | - | - |
| tenant_id | uuid | YES | - | - | FK |

#### Foreign Keys

| Constraint | Column | References | On Update | On Delete |
|------------|--------|------------|-----------|-----------|
| vendor_aliases_vendor_id_fkey | vendor_id | vendors.id | NO ACTION | CASCADE |

#### Indexes

| Name | Type | Unique | Primary | Columns | Size |
|------|------|--------|---------|---------|------|
| vendor_aliases_pkey | btree | ✅ | ✅ | id | 16 kB |

#### RLS Policies

| Policy | Command | Permissive | Roles | Check Expression |
|--------|---------|------------|-------|------------------|
| tenant_isolation | ALL | PERMISSIVE |  | `((tenant_id)::text = (((current_setting('request.jwt.claims'::text, true))::json -> 'app_metadata'::text) ->> 'tenant_id'::text))` |
| vendor_aliases_service_role | ALL | PERMISSIVE | service_role | `true` |

---


## Recommendations

1. 🔒 Add RLS policies to 2 tables with RLS enabled but no policies
2. 🛡️ Enable RLS on 5 tables containing data
3. 📈 Add indexes to 1 large tables with 1000+ rows

## Relationship Map

```yaml
{
  "gps_tracking_records": {
    "references": [
      {
        "table": "jobs",
        "via": "job_id → id"
      },
      {
        "table": "tenants",
        "via": "tenant_id → id"
      },
      {
        "table": "users_extended",
        "via": "user_id → id"
      }
    ],
    "referenced_by": []
  },
  "notification_queue": {
    "references": [
      {
        "table": "companies",
        "via": "company_id → id"
      }
    ],
    "referenced_by": []
  },
  "auth_audit_log": {
    "references": [
      {
        "table": "user_sessions",
        "via": "session_id → id"
      },
      {
        "table": "tenants",
        "via": "tenant_id → id"
      }
    ],
    "referenced_by": []
  },
  "customers": {
    "references": [
      {
        "table": "tenants",
        "via": "tenant_id → id"
      }
    ],
    "referenced_by": [
      {
        "table": "jobs",
        "via": "customer_id ← id"
      },
      {
        "table": "properties",
        "via": "customer_id ← id"
      }
    ]
  },
  "invoices": {
    "references": [
      {
        "table": "jobs",
        "via": "job_id → id"
      }
    ],
    "referenced_by": []
  },
  "jobs": {
    "references": [
      {
        "table": "users_extended",
        "via": "assigned_to → id"
      },
      {
        "table": "customers",
        "via": "customer_id → id"
      },
      {
        "table": "properties",
        "via": "property_id → id"
      },
      {
        "table": "tenants",
        "via": "tenant_id → id"
      }
    ],
    "referenced_by": [
      {
        "table": "gps_tracking_records",
        "via": "job_id ← id"
      },
      {
        "table": "invoices",
        "via": "job_id ← id"
      },
      {
        "table": "workflow_tasks",
        "via": "job_id ← id"
      },
      {
        "table": "geofences",
        "via": "job_id ← id"
      },
      {
        "table": "material_requests",
        "via": "job_id ← id"
      },
      {
        "table": "customer_feedback",
        "via": "job_id ← id"
      },
      {
        "table": "job_reschedules",
        "via": "original_job_id ← id"
      },
      {
        "table": "intake_requests",
        "via": "converted_to_job_id ← id"
      },
      {
        "table": "safety_checklists",
        "via": "job_id ← id"
      }
    ]
  },
  "users_extended": {
    "references": [
      {
        "table": "tenants",
        "via": "tenant_id → id"
      }
    ],
    "referenced_by": [
      {
        "table": "gps_tracking_records",
        "via": "user_id ← id"
      },
      {
        "table": "jobs",
        "via": "assigned_to ← id"
      },
      {
        "table": "workflow_tasks",
        "via": "completed_by ← id"
      },
      {
        "table": "workflow_tasks",
        "via": "supervisor_id ← id"
      },
      {
        "table": "workflow_tasks",
        "via": "user_id ← id"
      },
      {
        "table": "geofence_events",
        "via": "user_id ← id"
      },
      {
        "table": "routing_schedules",
        "via": "user_id ← id"
      },
      {
        "table": "intake_requests",
        "via": "assigned_to ← id"
      },
      {
        "table": "safety_checklists",
        "via": "supervisor_id ← id"
      },
      {
        "table": "safety_checklists",
        "via": "user_id ← id"
      }
    ]
  },
  "kit_items": {
    "references": [
      {
        "table": "companies",
        "via": "tenant_id → id"
      },
      {
        "table": "kits",
        "via": "kit_id → id"
      }
    ],
    "referenced_by": []
  },
  "properties": {
    "references": [
      {
        "table": "customers",
        "via": "customer_id → id"
      },
      {
        "table": "tenants",
        "via": "tenant_id → id"
      }
    ],
    "referenced_by": [
      {
        "table": "jobs",
        "via": "property_id ← id"
      },
      {
        "table": "travel_logs",
        "via": "from_property_id ← id"
      },
      {
        "table": "travel_logs",
        "via": "to_property_id ← id"
      }
    ]
  },
  "kits": {
    "references": [
      {
        "table": "companies",
        "via": "tenant_id → id"
      }
    ],
    "referenced_by": [
      {
        "table": "kit_items",
        "via": "kit_id ← id"
      },
      {
        "table": "kit_variants",
        "via": "kit_id ← id"
      },
      {
        "table": "kit_assignments",
        "via": "kit_id ← id"
      }
    ]
  },
  "kit_variants": {
    "references": [
      {
        "table": "companies",
        "via": "tenant_id → id"
      },
      {
        "table": "kits",
        "via": "kit_id → id"
      }
    ],
    "referenced_by": [
      {
        "table": "kit_assignments",
        "via": "variant_id ← id"
      }
    ]
  },
  "day_plans": {
    "references": [
      {
        "table": "companies",
        "via": "company_id → id"
      }
    ],
    "referenced_by": []
  },
  "kit_assignments": {
    "references": [
      {
        "table": "kits",
        "via": "kit_id → id"
      },
      {
        "table": "kit_variants",
        "via": "variant_id → id"
      }
    ],
    "referenced_by": []
  },
  "workflow_tasks": {
    "references": [
      {
        "table": "users_extended",
        "via": "completed_by → id"
      },
      {
        "table": "jobs",
        "via": "job_id → id"
      },
      {
        "table": "users_extended",
        "via": "supervisor_id → id"
      },
      {
        "table": "tenants",
        "via": "tenant_id → id"
      },
      {
        "table": "users_extended",
        "via": "user_id → id"
      }
    ],
    "referenced_by": []
  },
  "geofences": {
    "references": [
      {
        "table": "jobs",
        "via": "job_id → id"
      },
      {
        "table": "tenants",
        "via": "tenant_id → id"
      }
    ],
    "referenced_by": [
      {
        "table": "geofence_events",
        "via": "geofence_id ← id"
      }
    ]
  },
  "geofence_events": {
    "references": [
      {
        "table": "geofences",
        "via": "geofence_id → id"
      },
      {
        "table": "tenants",
        "via": "tenant_id → id"
      },
      {
        "table": "users_extended",
        "via": "user_id → id"
      }
    ],
    "referenced_by": []
  },
  "ocr_jobs": {
    "references": [
      {
        "table": "vendors",
        "via": "vendor_id → id"
      }
    ],
    "referenced_by": [
      {
        "table": "ocr_documents",
        "via": "ocr_job_id ← id"
      }
    ]
  },
  "ocr_documents": {
    "references": [
      {
        "table": "ocr_jobs",
        "via": "ocr_job_id → id"
      }
    ],
    "referenced_by": [
      {
        "table": "ocr_line_items",
        "via": "ocr_document_id ← id"
      },
      {
        "table": "ocr_note_entities",
        "via": "ocr_document_id ← id"
      }
    ]
  },
  "ocr_line_items": {
    "references": [
      {
        "table": "ocr_documents",
        "via": "ocr_document_id → id"
      }
    ],
    "referenced_by": []
  },
  "ocr_note_entities": {
    "references": [
      {
        "table": "ocr_documents",
        "via": "ocr_document_id → id"
      }
    ],
    "referenced_by": []
  },
  "vendor_locations": {
    "references": [
      {
        "table": "vendors",
        "via": "vendor_id → id"
      }
    ],
    "referenced_by": []
  },
  "item_transactions": {
    "references": [
      {
        "table": "items",
        "via": "item_id → id"
      }
    ],
    "referenced_by": []
  },
  "user_invitations": {
    "references": [
      {
        "table": "tenants",
        "via": "tenant_id → id"
      }
    ],
    "referenced_by": []
  },
  "tenant_assignments": {
    "references": [
      {
        "table": "tenants",
        "via": "tenant_id → id"
      }
    ],
    "referenced_by": []
  },
  "role_permissions": {
    "references": [
      {
        "table": "permissions",
        "via": "permission_id → id"
      },
      {
        "table": "tenants",
        "via": "tenant_id → id"
      }
    ],
    "referenced_by": []
  },
  "material_requests": {
    "references": [
      {
        "table": "jobs",
        "via": "job_id → id"
      }
    ],
    "referenced_by": []
  },
  "customer_feedback": {
    "references": [
      {
        "table": "jobs",
        "via": "job_id → id"
      }
    ],
    "referenced_by": []
  },
  "user_sessions": {
    "references": [
      {
        "table": "tenants",
        "via": "tenant_id → id"
      }
    ],
    "referenced_by": [
      {
        "table": "auth_audit_log",
        "via": "session_id ← id"
      }
    ]
  },
  "travel_logs": {
    "references": [
      {
        "table": "properties",
        "via": "from_property_id → id"
      },
      {
        "table": "properties",
        "via": "to_property_id → id"
      }
    ],
    "referenced_by": []
  },
  "job_reschedules": {
    "references": [
      {
        "table": "jobs",
        "via": "original_job_id → id"
      }
    ],
    "referenced_by": []
  },
  "routing_schedules": {
    "references": [
      {
        "table": "tenants",
        "via": "tenant_id → id"
      },
      {
        "table": "users_extended",
        "via": "user_id → id"
      }
    ],
    "referenced_by": []
  },
  "intake_requests": {
    "references": [
      {
        "table": "users_extended",
        "via": "assigned_to → id"
      },
      {
        "table": "jobs",
        "via": "converted_to_job_id → id"
      },
      {
        "table": "tenants",
        "via": "tenant_id → id"
      }
    ],
    "referenced_by": [
      {
        "table": "intake_documents",
        "via": "intake_id ← id"
      },
      {
        "table": "intake_documents",
        "via": "intake_request_id ← id"
      }
    ]
  },
  "safety_checklists": {
    "references": [
      {
        "table": "jobs",
        "via": "job_id → id"
      },
      {
        "table": "users_extended",
        "via": "supervisor_id → id"
      },
      {
        "table": "tenants",
        "via": "tenant_id → id"
      },
      {
        "table": "users_extended",
        "via": "user_id → id"
      }
    ],
    "referenced_by": []
  },
  "intake_documents": {
    "references": [
      {
        "table": "intake_requests",
        "via": "intake_id → id"
      },
      {
        "table": "intake_requests",
        "via": "intake_request_id → id"
      },
      {
        "table": "tenants",
        "via": "tenant_id → id"
      }
    ],
    "referenced_by": []
  },
  "vendor_aliases": {
    "references": [
      {
        "table": "vendors",
        "via": "vendor_id → id"
      }
    ],
    "referenced_by": []
  }
}
```
