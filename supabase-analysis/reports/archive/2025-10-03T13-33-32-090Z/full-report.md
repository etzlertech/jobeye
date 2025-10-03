# Supabase Analysis Report

Generated: 2025-10-03T13:33:16.411Z
Database: https://rtwigjwqufozqfwozpvo.supabase.co

## Executive Summary

### Database Overview
- **Total Tables**: 60
- **Total Rows**: 0
- **Tables without RLS**: 3
- **Orphaned Tables**: 43
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
### 2.1 Tables (60 total)

| Table Name | Rows | Columns | RLS | Primary Key | Description |
|------------|------|---------|-----|-------------|-------------|
| customers | 0 | 17 | ✅ | id | Customer data |
| properties | 0 | 20 | ✅ | id | Domain data |
| job_templates | 0 | 18 | ✅ | id | Job tracking |
| jobs | 0 | 34 | ✅ | id | Job tracking |
| equipment | 0 | 26 | ✅ | id | Equipment tracking |
| materials | 0 | 21 | ✅ | id | Material inventory |
| voice_transcripts | 0 | 17 | ✅ | id | Voice interactions |
| intent_recognitions | 0 | 16 | ✅ | id | Domain data |
| media_assets | 0 | 23 | ✅ | id | Domain data |
| vision_verifications | 0 | 15 | ✅ | id | Vision/image processing |
| conversation_sessions | 0 | 23 | ✅ | id | Domain data |
| request_deduplication | 0 | 12 | ✅ | id | Domain data |
| ai_cost_tracking | 0 | 17 | ✅ | id | Domain data |
| irrigation_systems | 0 | 23 | ✅ | id | Domain data |
| irrigation_zones | 0 | 30 | ✅ | id | Domain data |
| irrigation_schedules | 0 | 18 | ✅ | id | Domain data |
| irrigation_runs | 0 | 17 | ✅ | id | Domain data |
| service_history | 0 | 22 | ✅ | id | Domain data |
| time_entries | 0 | 24 | ✅ | id | Domain data |
| routes | 0 | 17 | ✅ | id | Domain data |
| route_stops | 0 | 14 | ✅ | id | Domain data |
| containers | 0 | 14 | ✅ | id | Domain data |
| inventory_images | 0 | 7 | ✅ | id | Domain data |
| job_checklist_items | 0 | 13 | ✅ | id | Job tracking |
| load_verifications | 0 | 14 | ✅ | id | Domain data |
| company_settings | 0 | 8 | ✅ | id | Settings storage |
| companies | 0 | 5 | ✅ | id | Domain data |
| voice_sessions | 0 | 9 | ✅ | id | Voice interactions |
| kits | 0 | 11 | ✅ | id | Domain data |
| kit_items | 0 | 10 | ✅ | id | Domain data |
| kit_variants | 0 | 10 | ✅ | id | Domain data |
| kit_assignments | 0 | 10 | ✅ | id | Domain data |
| kit_override_logs | 0 | 8 | ✅ | id | System logging |
| day_plans | 0 | 16 | ✅ | id | Domain data |
| schedule_events | 0 | 18 | ✅ | id | Domain data |
| crew_assignments | 0 | 13 | ✅ | id | Domain data |
| job_kits | 0 | 15 | ✅ | id | Job tracking |
| notification_queue | 0 | 15 | ✅ | id | Domain data |
| vendors | 0 | 6 | ✅ | id | Domain data |
| vendor_aliases | 0 | 4 | ✅ | id | Domain data |
| vendor_locations | 0 | 8 | ✅ | id | Domain data |
| ocr_jobs | 0 | 6 | ✅ | id | Job tracking |
| ocr_documents | 0 | 6 | ✅ | id | Domain data |
| ocr_line_items | 0 | 9 | ✅ | id | Domain data |
| ocr_note_entities | 0 | 5 | ✅ | id | Domain data |
| vision_detected_items | 0 | 8 | ✅ | id | Vision/image processing |
| vision_cost_records | 0 | 10 | ✅ | id | Vision/image processing |
| vision_confidence_config | 0 | 10 | ✅ | id | Vision/image processing |
| inventory_items | 0 | 16 | ✅ | id | Domain data |
| container_assignments | 0 | 8 | ✅ | id | Domain data |
| inventory_transactions | 0 | 16 | ✅ | id | Domain data |
| purchase_receipts | 0 | 15 | ✅ | id | Domain data |
| training_data_records | 0 | 14 | ✅ | id | Domain data |
| vision_training_annotations | 0 | 7 | ✅ | id | Vision/image processing |
| detection_confidence_thresholds | 0 | 8 | ✅ | id | Domain data |
| background_filter_preferences | 0 | 8 | ✅ | id | Domain data |
| item_relationships | 0 | 6 | ✅ | id | Domain data |
| ai_interaction_logs | 0 | 13 | ❌ | id | System logging |
| intent_classifications | 0 | 10 | ❌ | id | Domain data |
| offline_sync_queue | 0 | 12 | ❌ | id | Domain data |

### 2.2 Table Schemas

#### ai_cost_tracking

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| tenant_id | UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| user_id | UUID NOT NULL REFERENCES auth.users(id) | Yes | - | Foreign key reference |
| service_type | VARCHAR(50) | No | - | Data field |
| provider | VARCHAR(50) | No | - | Data field |
| model | VARCHAR(100) | Yes | - | Data field |
| input_tokens | INTEGER | Yes | - | Data field |
| output_tokens | INTEGER | Yes | - | Data field |
| audio_seconds | NUMERIC(10 | Yes | - | Data field |
| image_count | INTEGER | Yes | - | Data field |
| unit_cost | NUMERIC(10 | Yes | - | Data field |
| total_cost | NUMERIC(10 | Yes | - | Data field |
| voice_transcript_id | UUID REFERENCES voice_transcripts(id) | Yes | - | Foreign key reference |
| intent_recognition_id | UUID REFERENCES intent_recognitions(id) | Yes | - | Foreign key reference |
| vision_verification_id | UUID REFERENCES vision_verifications(id) | Yes | - | Foreign key reference |
| media_asset_id | UUID REFERENCES media_assets(id) | Yes | - | Foreign key reference |
| created_at | TIMESTAMPTZ | Yes | NOW() | Record creation timestamp |

#### ai_interaction_logs

**Row Count**: 0 | **RLS**: Disabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| tenant_id | UUID NOT NULL REFERENCES tenants(id) | Yes | - | Foreign key reference |
| created_at | TIMESTAMPTZ | No | NOW() | Record creation timestamp |
| user_id | UUID NOT NULL REFERENCES auth.users(id) | Yes | - | Foreign key reference |
| interaction_type | TEXT NOT NULL CHECK (interaction_type IN ('intent' | Yes | - | Numeric value |
| model_used | TEXT | No | - | Data field |
| prompt | TEXT | No | - | Data field |
| image_url | TEXT | Yes | - | Data field |
| response | JSONB | No | - | Data field |
| response_time_ms | INTEGER | No | - | Data field |
| cost_usd | DECIMAL(10 | Yes | - | Data field |
| error | TEXT | Yes | - | Data field |
| metadata | JSONB | Yes | - | Data field |

#### background_filter_preferences

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| company_id | TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| user_id | UUID | Yes | - | Foreign key reference |
| object_label | TEXT | No | - | Data field |
| action | filter_action | No | - | Data field |
| context_filters | JSONB | Yes | - | Data field |
| created_at | TIMESTAMPTZ | No | NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | No | NOW() | Last modification timestamp |

#### companies

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | gen_random_uuid() | Primary identifier |
| tenant_id | UUID | No | - | Foreign key reference |
| name | TEXT | Yes | - | Display name |
| created_at | TIMESTAMPTZ | No | now() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | No | now() | Last modification timestamp |

#### company_settings

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | Yes | uuid_generate_v4() | Primary identifier |
| company_id | uuid | No | - | Foreign key reference |
| vision_thresholds | jsonb | Yes | '{ | Structured data |
| voice_preferences | jsonb | Yes | '{ | Structured data |
| budget_limits | jsonb | Yes | '{ | Structured data |
| features | jsonb | Yes | '{ | Structured data |
| created_at | timestamptz | Yes | NOW() | Record creation timestamp |
| updated_at | timestamptz | Yes | NOW() | Last modification timestamp |

#### container_assignments

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| container_id | UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| item_id | UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| quantity | INTEGER | No | 1 | Data field |
| checked_in_at | TIMESTAMPTZ | No | NOW() | Data field |
| checked_out_at | TIMESTAMPTZ | Yes | - | Data field |
| job_id | UUID | Yes | - | Foreign key reference |
| status | assignment_status | No | 'active' | Current status/state |

#### containers

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| company_id | TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| type | container_type | No | - | Classification type |
| name | TEXT | No | - | Display name |
| identifier | TEXT | Yes | - | Data field |
| capacity | INTEGER | Yes | - | Data field |
| parent_container_id | UUID REFERENCES containers(id) ON DELETE SET | Yes | - | Foreign key reference |
| default_location_gps | GEOMETRY(POINT | Yes | - | Data field |
| photo_url | TEXT | Yes | - | Data field |
| voice_name | TEXT | Yes | - | Data field |
| is_active | BOOLEAN | No | TRUE | Data field |
| is_default | BOOLEAN | No | FALSE | Data field |
| created_at | TIMESTAMPTZ | No | NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | No | NOW() | Last modification timestamp |

#### conversation_sessions

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| tenant_id | UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| user_id | UUID NOT NULL REFERENCES auth.users(id) | Yes | - | Foreign key reference |
| session_token | VARCHAR(255) UNIQUE | No | - | Data field |
| job_id | UUID REFERENCES jobs(id) | Yes | - | Foreign key reference |
| customer_id | UUID REFERENCES customers(id) | Yes | - | Foreign key reference |
| property_id | UUID REFERENCES properties(id) | Yes | - | Foreign key reference |
| started_at | TIMESTAMPTZ | Yes | NOW() | Data field |
| ended_at | TIMESTAMPTZ | Yes | - | Data field |
| is_active | BOOLEAN | Yes | true | Data field |
| wake_word_count | INTEGER | Yes | 0 | Data field |
| turn_count | INTEGER | Yes | 0 | Data field |
| current_context | JSONB | Yes | '{}'::jsonb | Data field |
| conversation_history | JSONB | Yes | '[]'::jsonb | Data field |
| pending_confirmations | JSONB | Yes | '[]'::jsonb | Data field |
| total_duration | INTEGER | Yes | - | Data field |
| active_duration | INTEGER | Yes | - | Data field |
| intent_success_rate | NUMERIC(5 | Yes | - | Data field |
| user_satisfaction_score | INTEGER | Yes | - | Data field |
| total_stt_cost | NUMERIC(10 | Yes | - | Data field |
| total_llm_cost | NUMERIC(10 | Yes | - | Data field |
| total_tts_cost | NUMERIC(10 | Yes | - | Data field |
| metadata | JSONB | Yes | '{}'::jsonb | Data field |

#### crew_assignments

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | gen_random_uuid() | Primary identifier |
| company_id | TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| schedule_event_id | UUID NOT NULL REFERENCES public.schedule_events(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| user_id | UUID | No | - | Foreign key reference |
| role | TEXT NOT NULL CHECK (role IN ('lead' | Yes | - | Data field |
| assigned_by | UUID | No | - | Data field |
| assigned_at | TIMESTAMPTZ | No | NOW() | Data field |
| confirmed_at | TIMESTAMPTZ | Yes | - | Data field |
| voice_confirmed | BOOLEAN | Yes | FALSE | Data field |
| metadata | JSONB | No | '{}'::jsonb | Data field |
| created_at | TIMESTAMPTZ | No | NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | No | NOW() | Last modification timestamp |
| UNIQUE | (schedule_event_id | Yes | - | Data field |

#### customers

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| tenant_id | UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| customer_number | VARCHAR(50) | No | - | Data field |
| name | VARCHAR(255) | No | - | Display name |
| email | VARCHAR(255) | Yes | - | Email address |
| phone | VARCHAR(50) | Yes | - | Phone number |
| mobile_phone | VARCHAR(50) | Yes | - | Data field |
| billing_address | JSONB | Yes | - | Data field |
| service_address | JSONB | Yes | - | Data field |
| notes | TEXT | Yes | - | Data field |
| tags | TEXT[] | Yes | - | Data field |
| voice_notes | TEXT | Yes | - | Data field |
| is_active | BOOLEAN | Yes | true | Data field |
| metadata | JSONB | Yes | '{}'::jsonb | Data field |
| created_at | TIMESTAMPTZ | Yes | NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | NOW() | Last modification timestamp |
| created_by | UUID REFERENCES auth.users(id) | Yes | - | User who created record |

**Foreign Keys**:
- NOT → tenants.id (undefined)
- created_by → users.id (undefined)
- NOT → tenants.id (undefined)
- NOT → customers.id (undefined)
- NOT → tenants.id (undefined)
- NOT → tenants.id (undefined)
- template_id → job_templates.id (undefined)
- NOT → customers.id (undefined)
- property_id → properties.id (undefined)
- assigned_to → users_extended.id (undefined)
- created_by → users.id (undefined)
- NOT → tenants.id (undefined)
- assigned_to → users_extended.id (undefined)
- NOT → tenants.id (undefined)

#### day_plans

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | gen_random_uuid() | Primary identifier |
| company_id | TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| user_id | UUID | No | - | Foreign key reference |
| plan_date | DATE | No | - | Data field |
| status | TEXT | No | 'draft' CHECK (status IN ('draft' | Current status/state |
| route_data | JSONB | Yes | - | Data field |
| total_distance_miles | DECIMAL(10 | Yes | - | Data field |
| estimated_duration_minutes | INTEGER | Yes | - | Data field |
| actual_start_time | TIMESTAMPTZ | Yes | - | Data field |
| actual_end_time | TIMESTAMPTZ | Yes | - | Data field |
| voice_session_id | UUID | Yes | - | Foreign key reference |
| auto_schedule_breaks | BOOLEAN | Yes | FALSE | Data field |
| metadata | JSONB | No | '{}'::jsonb | Data field |
| created_at | TIMESTAMPTZ | No | NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | No | NOW() | Last modification timestamp |
| UNIQUE | (company_id | Yes | - | Data field |

#### detection_confidence_thresholds

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| company_id | TEXT NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| local_confidence_threshold | DECIMAL(3 | Yes | - | Data field |
| max_daily_vlm_requests | INTEGER | No | 100 | Data field |
| daily_cost_budget_cap | DECIMAL(6 | Yes | - | Data field |
| is_active | BOOLEAN | No | TRUE | Data field |
| created_at | TIMESTAMPTZ | No | NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | No | NOW() | Last modification timestamp |

#### equipment

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| tenant_id | UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| equipment_number | VARCHAR(50) | No | - | Data field |
| name | VARCHAR(255) | No | - | Display name |
| type | VARCHAR(100) | Yes | - | Classification type |
| make | VARCHAR(100) | Yes | - | Data field |
| model | VARCHAR(100) | Yes | - | Data field |
| serial_number | VARCHAR(255) | Yes | - | Data field |
| year | INTEGER | Yes | - | Data field |
| status | equipment_status | Yes | 'active' | Current status/state |
| current_location | VARCHAR(255) | Yes | - | Data field |
| home_location | VARCHAR(255) | Yes | - | Data field |
| assigned_to | UUID REFERENCES users_extended(id) | Yes | - | Data field |
| purchase_date | DATE | Yes | - | Data field |
| purchase_price | NUMERIC(12 | Yes | - | Data field |
| current_value | NUMERIC(12 | Yes | - | Data field |
| maintenance_schedule | JSONB | Yes | - | Data field |
| last_maintenance_date | DATE | Yes | - | Data field |
| next_maintenance_date | DATE | Yes | - | Data field |
| notes | TEXT | Yes | - | Data field |
| qr_code | VARCHAR(255) | Yes | - | Data field |
| voice_identifier | VARCHAR(100) | Yes | - | Data field |
| is_tracked | BOOLEAN | Yes | true | Data field |
| metadata | JSONB | Yes | '{}'::jsonb | Data field |
| created_at | TIMESTAMPTZ | Yes | NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | NOW() | Last modification timestamp |

#### intent_classifications

**Row Count**: 0 | **RLS**: Disabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| tenant_id | UUID NOT NULL REFERENCES tenants(id) | Yes | - | Foreign key reference |
| created_at | TIMESTAMPTZ | No | NOW() | Record creation timestamp |
| user_id | UUID NOT NULL REFERENCES auth.users(id) | Yes | - | Foreign key reference |
| image_url | TEXT | No | - | Data field |
| detected_intent | TEXT NOT NULL CHECK (detected_intent IN ('inventory_add' | Yes | - | Numeric value |
| confidence | DECIMAL(3 | Yes | - | Data field |
| context_data | JSONB | Yes | - | Data field |
| user_action | TEXT | Yes | - | Data field |
| ai_log_id | UUID REFERENCES ai_interaction_logs(id) | Yes | - | Foreign key reference |

#### intent_recognitions

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| tenant_id | UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| transcript_id | UUID NOT NULL REFERENCES voice_transcripts(id) | Yes | - | Foreign key reference |
| user_id | UUID NOT NULL REFERENCES auth.users(id) | Yes | - | Foreign key reference |
| intent_type | intent_type | Yes | - | Numeric value |
| confidence_score | NUMERIC(5 | Yes | - | Data field |
| entities | JSONB | Yes | - | Data field |
| context | JSONB | Yes | - | Data field |
| action_taken | JSONB | Yes | - | Data field |
| success | BOOLEAN | Yes | - | Data field |
| error_message | TEXT | Yes | - | Data field |
| feedback_given | BOOLEAN | Yes | false | Data field |
| feedback_score | INTEGER | Yes | - | Data field |
| provider | VARCHAR(50) | Yes | - | Data field |
| cost | NUMERIC(10 | Yes | - | Data field |
| created_at | TIMESTAMPTZ | Yes | NOW() | Record creation timestamp |

#### inventory_images

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | gen_random_uuid() | Primary identifier |
| company_id | TEXT | No | - | Foreign key reference |
| media_id | UUID | Yes | - | Foreign key reference |
| file_path | TEXT | No | - | Data field |
| mime_type | TEXT | Yes | - | Data field |
| size_bytes | INTEGER | Yes | - | Data field |
| created_at | TIMESTAMPTZ | Yes | NOW() | Record creation timestamp |

**Foreign Keys**:
- NOT → vendors.id (undefined)
- NOT → vendors.id (undefined)
- vendor_id → vendors.id (undefined)
- ocr_job_id → ocr_jobs.id (undefined)
- ocr_document_id → ocr_documents.id (undefined)
- ocr_document_id → ocr_documents.id (undefined)

#### inventory_items

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| company_id | TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| type | item_type | No | - | Classification type |
| name | TEXT | No | - | Display name |
| category | TEXT | Yes | - | Data field |
| status | item_status | No | 'active' | Current status/state |
| current_location_id | UUID | Yes | - | Foreign key reference |
| specifications | JSONB | Yes | '{}' | Data field |
| attributes | JSONB | Yes | '{}' | Data field |
| images | JSONB[] | No | '{}' | Data field |
| tracking_mode | tracking_mode | No | - | Data field |
| current_quantity | INTEGER | Yes | - | Data field |
| reorder_level | INTEGER | Yes | - | Data field |
| created_at | TIMESTAMPTZ | No | NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | No | NOW() | Last modification timestamp |
| created_by | UUID | Yes | - | User who created record |

#### inventory_transactions

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| company_id | TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| type | transaction_type | No | - | Classification type |
| item_ids | UUID[] | No | - | Data field |
| quantity | INTEGER | Yes | - | Data field |
| source_container_id | UUID REFERENCES containers(id) ON DELETE SET | Yes | - | Foreign key reference |
| destination_container_id | UUID REFERENCES containers(id) ON DELETE SET | Yes | - | Foreign key reference |
| job_id | UUID | Yes | - | Foreign key reference |
| performer_id | UUID | No | - | Foreign key reference |
| verification_method | verification_method | No | - | Data field |
| photo_evidence_url | TEXT | Yes | - | Data field |
| voice_session_id | UUID | Yes | - | Foreign key reference |
| voice_transcript | TEXT | Yes | - | Data field |
| notes | TEXT | Yes | - | Data field |
| cost_data | JSONB | Yes | - | Data field |
| created_at | TIMESTAMPTZ | No | NOW() | Record creation timestamp |

#### irrigation_runs

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| tenant_id | UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| system_id | UUID NOT NULL REFERENCES irrigation_systems(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| schedule_id | UUID REFERENCES irrigation_schedules(id) | Yes | - | Foreign key reference |
| zone_id | UUID NOT NULL REFERENCES irrigation_zones(id) | Yes | - | Foreign key reference |
| started_at | TIMESTAMPTZ | No | - | Data field |
| ended_at | TIMESTAMPTZ | Yes | - | Data field |
| scheduled_minutes | INTEGER | Yes | - | Data field |
| actual_minutes | INTEGER | Yes | - | Data field |
| triggered_by | VARCHAR(50) | Yes | - | Data field |
| triggered_by_user | UUID REFERENCES auth.users(id) | Yes | - | Data field |
| voice_command_id | UUID REFERENCES voice_transcripts(id) | Yes | - | Foreign key reference |
| gallons_used | NUMERIC(10 | Yes | - | Data field |
| status | VARCHAR(50) | Yes | - | Current status/state |
| cancellation_reason | TEXT | Yes | - | Data field |
| weather_data | JSONB | Yes | - | Data field |
| created_at | TIMESTAMPTZ | Yes | NOW() | Record creation timestamp |

#### irrigation_schedules

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| tenant_id | UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| system_id | UUID NOT NULL REFERENCES irrigation_systems(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| schedule_name | VARCHAR(255) | No | - | Data field |
| schedule_type | schedule_type | Yes | 'fixed' | Data field |
| is_active | BOOLEAN | Yes | true | Data field |
| start_date | DATE | Yes | - | Data field |
| end_date | DATE | Yes | - | Data field |
| days_of_week | INTEGER[] | Yes | - | Data field |
| start_times | TIME[] | Yes | - | Data field |
| weather_adjustment_enabled | BOOLEAN | Yes | false | Data field |
| rain_delay_threshold | NUMERIC(3 | Yes | - | Data field |
| temperature_threshold | INTEGER | Yes | - | Data field |
| wind_threshold | INTEGER | Yes | - | Data field |
| zone_runtimes | JSONB | Yes | - | Data field |
| seasonal_adjustment | INTEGER | Yes | 100 | Data field |
| created_at | TIMESTAMPTZ | Yes | NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | NOW() | Last modification timestamp |

#### irrigation_systems

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| tenant_id | UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| property_id | UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| system_name | VARCHAR(255) | No | - | Data field |
| controller_type | irrigation_controller_type | Yes | - | Data field |
| controller_make | VARCHAR(100) | Yes | - | Data field |
| controller_model | VARCHAR(100) | Yes | - | Data field |
| controller_location | TEXT | Yes | - | Data field |
| wifi_enabled | BOOLEAN | Yes | false | Data field |
| remote_access_enabled | BOOLEAN | Yes | false | Data field |
| rain_sensor_installed | BOOLEAN | Yes | false | Data field |
| flow_sensor_installed | BOOLEAN | Yes | false | Data field |
| backflow_device_info | JSONB | Yes | - | Data field |
| last_inspection_date | DATE | Yes | - | Data field |
| next_inspection_due | DATE | Yes | - | Data field |
| winterization_date | DATE | Yes | - | Data field |
| activation_date | DATE | Yes | - | Data field |
| notes | TEXT | Yes | - | Data field |
| voice_control_enabled | BOOLEAN | Yes | false | Data field |
| voice_commands | JSONB | Yes | '[]'::jsonb | Data field |
| metadata | JSONB | Yes | '{}'::jsonb | Data field |
| created_at | TIMESTAMPTZ | Yes | NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | NOW() | Last modification timestamp |

**Foreign Keys**:
- NOT → tenants.id (undefined)
- NOT → properties.id (undefined)
- NOT → tenants.id (undefined)
- NOT → irrigation_systems.id (undefined)
- NOT → tenants.id (undefined)
- NOT → irrigation_systems.id (undefined)
- NOT → tenants.id (undefined)
- NOT → irrigation_systems.id (undefined)
- schedule_id → irrigation_schedules.id (undefined)
- NOT → irrigation_zones.id (undefined)
- triggered_by_user → users.id (undefined)
- voice_command_id → voice_transcripts.id (undefined)
- NOT → tenants.id (undefined)
- performed_by → users_extended.id (undefined)
- voice_notes_id → voice_transcripts.id (undefined)
- NOT → tenants.id (undefined)
- NOT → users_extended.id (undefined)
- job_id → jobs.id (undefined)
- approved_by → users_extended.id (undefined)
- NOT → tenants.id (undefined)
- assigned_to → users_extended.id (undefined)
- assigned_vehicle → equipment.id (undefined)
- NOT → routes.id (undefined)
- NOT → jobs.id (undefined)

#### irrigation_zones

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| tenant_id | UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| system_id | UUID NOT NULL REFERENCES irrigation_systems(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| zone_number | INTEGER | No | - | Data field |
| zone_name | VARCHAR(255) | Yes | - | Data field |
| zone_type | zone_type | Yes | - | Data field |
| area_sqft | INTEGER | Yes | - | Data field |
| plant_type | VARCHAR(100) | Yes | - | Data field |
| soil_type | VARCHAR(100) | Yes | - | Data field |
| sun_exposure | VARCHAR(50) | Yes | - | Data field |
| slope_percentage | INTEGER | Yes | - | Data field |
| valve_location | TEXT | Yes | - | Data field |
| valve_size | VARCHAR(20) | Yes | - | Data field |
| valve_type | VARCHAR(50) | Yes | - | Data field |
| gpm_flow_rate | NUMERIC(6 | Yes | - | Data field |
| head_count | INTEGER | Yes | - | Data field |
| head_type | VARCHAR(100) | Yes | - | Data field |
| nozzle_types | JSONB | Yes | - | Data field |
| default_runtime_minutes | INTEGER | Yes | - | Data field |
| cycle_soak_enabled | BOOLEAN | Yes | false | Data field |
| cycle_count | INTEGER | Yes | 1 | Data field |
| soak_minutes | INTEGER | Yes | 0 | Data field |
| is_active | BOOLEAN | Yes | true | Data field |
| current_status | valve_status | Yes | 'closed' | Data field |
| last_run_date | TIMESTAMPTZ | Yes | - | Data field |
| total_runtime_ytd | INTEGER | Yes | 0 | Data field |
| voice_identifier | VARCHAR(100) | Yes | - | Data field |
| metadata | JSONB | Yes | '{}'::jsonb | Data field |
| created_at | TIMESTAMPTZ | Yes | NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | NOW() | Last modification timestamp |

#### item_relationships

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| parent_item_id | UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| related_item_id | UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| relationship_type | relationship_type | No | - | Data field |
| notes | TEXT | Yes | - | Data field |
| created_at | TIMESTAMPTZ | No | NOW() | Record creation timestamp |

#### job_checklist_items

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| job_id | UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| sequence_number | INT | No | - | Data field |
| item_type | TEXT NOT NULL CHECK (item_type IN ('equipment' | Yes | - | Data field |
| item_id | UUID | No | - | Foreign key reference |
| item_name | TEXT | No | - | Data field |
| quantity | INT | Yes | 1 | Data field |
| container_id | UUID REFERENCES containers(id) | Yes | - | Foreign key reference |
| status | TEXT | Yes | 'pending' CHECK (status IN ('pending' | Current status/state |
| vlm_prompt | TEXT | Yes | - | Data field |
| acceptance_criteria | TEXT | Yes | - | Data field |
| created_at | TIMESTAMPTZ | Yes | NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | NOW() | Last modification timestamp |

#### job_kits

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | gen_random_uuid() | Primary identifier |
| company_id | TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| job_id | TEXT | No | - | Foreign key reference |
| kit_id | UUID NOT NULL REFERENCES public.kits(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| variant_id | UUID REFERENCES public.kit_variants(id) ON DELETE SET | Yes | - | Foreign key reference |
| assigned_by | UUID | No | - | Data field |
| assigned_at | TIMESTAMPTZ | No | NOW() | Data field |
| verified_at | TIMESTAMPTZ | Yes | - | Data field |
| verified_by | UUID | Yes | - | Data field |
| verification_status | TEXT CHECK (verification_status IN ('pending' | Yes | - | Data field |
| notes | TEXT | Yes | - | Data field |
| metadata | JSONB | No | '{}'::jsonb | Data field |
| created_at | TIMESTAMPTZ | No | NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | No | NOW() | Last modification timestamp |
| UNIQUE | (company_id | Yes | - | Data field |

#### job_templates

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| tenant_id | UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| template_code | VARCHAR(100) | No | - | Data field |
| name | VARCHAR(255) | No | - | Display name |
| description | TEXT | Yes | - | Detailed description |
| category | VARCHAR(100) | Yes | - | Data field |
| estimated_duration | INTEGER | Yes | - | Data field |
| default_priority | job_priority | Yes | 'normal' | Data field |
| required_skills | TEXT[] | Yes | - | Data field |
| required_equipment_types | TEXT[] | Yes | - | Data field |
| default_materials | JSONB | Yes | '[]'::jsonb | Data field |
| checklist_items | JSONB | Yes | '[]'::jsonb | Data field |
| voice_shortcuts | TEXT[] | Yes | - | Data field |
| voice_instructions | TEXT | Yes | - | Data field |
| is_active | BOOLEAN | Yes | true | Data field |
| metadata | JSONB | Yes | '{}'::jsonb | Data field |
| created_at | TIMESTAMPTZ | Yes | NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | NOW() | Last modification timestamp |

#### jobs

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| tenant_id | UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| job_number | VARCHAR(50) | No | - | Data field |
| template_id | UUID REFERENCES job_templates(id) | Yes | - | Foreign key reference |
| customer_id | UUID NOT NULL REFERENCES customers(id) | Yes | - | Foreign key reference |
| property_id | UUID REFERENCES properties(id) | Yes | - | Foreign key reference |
| title | VARCHAR(255) | No | - | Data field |
| description | TEXT | Yes | - | Detailed description |
| status | job_status | Yes | 'draft' | Current status/state |
| priority | job_priority | Yes | 'normal' | Data field |
| scheduled_start | TIMESTAMPTZ | Yes | - | Data field |
| scheduled_end | TIMESTAMPTZ | Yes | - | Data field |
| actual_start | TIMESTAMPTZ | Yes | - | Data field |
| actual_end | TIMESTAMPTZ | Yes | - | Data field |
| assigned_to | UUID REFERENCES users_extended(id) | Yes | - | Data field |
| assigned_team | UUID[] | Yes | - | Data field |
| estimated_duration | INTEGER | Yes | - | Data field |
| actual_duration | INTEGER | Yes | - | Data field |
| completion_notes | TEXT | Yes | - | Data field |
| voice_notes | TEXT | Yes | - | Data field |
| voice_created | BOOLEAN | Yes | false | Data field |
| voice_session_id | UUID | Yes | - | Foreign key reference |
| checklist_items | JSONB | Yes | '[]'::jsonb | Data field |
| materials_used | JSONB | Yes | '[]'::jsonb | Data field |
| equipment_used | UUID[] | Yes | - | Data field |
| photos_before | JSONB | Yes | '[]'::jsonb | Data field |
| photos_after | JSONB | Yes | '[]'::jsonb | Data field |
| signature_required | BOOLEAN | Yes | false | Data field |
| signature_data | JSONB | Yes | - | Data field |
| billing_info | JSONB | Yes | - | Data field |
| metadata | JSONB | Yes | '{}'::jsonb | Data field |
| created_at | TIMESTAMPTZ | Yes | NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | NOW() | Last modification timestamp |
| created_by | UUID REFERENCES auth.users(id) | Yes | - | User who created record |

#### kit_assignments

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | gen_random_uuid() | Primary identifier |
| company_id | TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| kit_id | UUID NOT NULL REFERENCES public.kits(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| variant_id | UUID REFERENCES public.kit_variants(id) ON DELETE SET | Yes | - | Foreign key reference |
| external_ref | TEXT | No | - | Data field |
| notes | TEXT | Yes | - | Data field |
| metadata | JSONB | No | '{}'::jsonb | Data field |
| created_at | TIMESTAMPTZ | No | NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | No | NOW() | Last modification timestamp |
| UNIQUE | (company_id | Yes | - | Data field |

#### kit_items

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | gen_random_uuid() | Primary identifier |
| company_id | TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| kit_id | UUID NOT NULL REFERENCES public.kits(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| item_type | TEXT NOT NULL CHECK (item_type IN ('equipment' | Yes | - | Data field |
| quantity | NUMERIC(12 | Yes | - | Data field |
| unit | VARCHAR(50) | Yes | - | Data field |
| is_required | BOOLEAN | No | TRUE | Data field |
| metadata | JSONB | No | '{}'::jsonb | Data field |
| created_at | TIMESTAMPTZ | No | NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | No | NOW() | Last modification timestamp |

#### kit_override_logs

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | gen_random_uuid() | Primary identifier |
| company_id | TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| assignment_id | UUID NOT NULL REFERENCES public.kit_assignments(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| item_id | UUID REFERENCES public.kit_items(id) ON DELETE SET | Yes | - | Foreign key reference |
| reason | TEXT | No | - | Data field |
| delta | JSONB | No | '{}'::jsonb | Data field |
| metadata | JSONB | No | '{}'::jsonb | Data field |
| created_at | TIMESTAMPTZ | No | NOW() | Record creation timestamp |

#### kit_variants

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | gen_random_uuid() | Primary identifier |
| company_id | TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| kit_id | UUID NOT NULL REFERENCES public.kits(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| variant_code | VARCHAR(50) | No | - | Data field |
| name | VARCHAR(255) | No | - | Display name |
| is_default | BOOLEAN | No | FALSE | Data field |
| metadata | JSONB | No | '{}'::jsonb | Data field |
| created_at | TIMESTAMPTZ | No | NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | No | NOW() | Last modification timestamp |
| UNIQUE | (kit_id | Yes | - | Data field |

#### kits

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | gen_random_uuid() | Primary identifier |
| company_id | TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| kit_code | VARCHAR(50) | No | - | Data field |
| name | VARCHAR(255) | No | - | Display name |
| description | TEXT | Yes | - | Detailed description |
| category | VARCHAR(100) | Yes | - | Data field |
| is_active | BOOLEAN | No | TRUE | Data field |
| metadata | JSONB | No | '{}'::jsonb | Data field |
| created_at | TIMESTAMPTZ | No | NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | No | NOW() | Last modification timestamp |
| UNIQUE | (company_id | Yes | - | Data field |

#### load_verifications

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| job_id | UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| media_id | UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| provider | TEXT | No | - | Data field |
| model_id | TEXT | No | - | Foreign key reference |
| detected_containers | JSONB | Yes | '[]'::jsonb | Data field |
| detected_items | JSONB | Yes | '[]'::jsonb | Data field |
| verified_checklist_items | UUID[] | Yes | - | Data field |
| missing_items | UUID[] | Yes | - | Data field |
| unexpected_items | JSONB | Yes | - | Data field |
| tokens_used | INT | Yes | - | Data field |
| cost_usd | NUMERIC(18 | Yes | - | Data field |
| processing_time_ms | INT | Yes | - | Data field |
| created_at | TIMESTAMPTZ | Yes | NOW() | Record creation timestamp |

#### materials

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| tenant_id | UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| sku | VARCHAR(100) | No | - | Data field |
| name | VARCHAR(255) | No | - | Display name |
| description | TEXT | Yes | - | Detailed description |
| category | VARCHAR(100) | Yes | - | Data field |
| unit | material_unit | Yes | 'each' | Data field |
| unit_cost | NUMERIC(12 | Yes | - | Data field |
| markup_percentage | NUMERIC(5 | Yes | - | Data field |
| quantity_on_hand | NUMERIC(12 | Yes | - | Data field |
| reorder_point | NUMERIC(12 | Yes | - | Data field |
| reorder_quantity | NUMERIC(12 | Yes | - | Data field |
| supplier_info | JSONB | Yes | - | Data field |
| location | VARCHAR(255) | Yes | - | Data field |
| barcode | VARCHAR(255) | Yes | - | Data field |
| voice_name | VARCHAR(100) | Yes | - | Data field |
| is_active | BOOLEAN | Yes | true | Data field |
| is_billable | BOOLEAN | Yes | true | Data field |
| metadata | JSONB | Yes | '{}'::jsonb | Data field |
| created_at | TIMESTAMPTZ | Yes | NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | NOW() | Last modification timestamp |

#### media_assets

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| tenant_id | UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| uploaded_by | UUID NOT NULL REFERENCES auth.users(id) | Yes | - | Data field |
| media_type | media_type | No | - | Data field |
| file_name | VARCHAR(255) | No | - | Data field |
| file_size | INTEGER | Yes | - | Data field |
| mime_type | VARCHAR(100) | Yes | - | Data field |
| storage_path | TEXT | No | - | Data field |
| public_url | TEXT | Yes | - | Data field |
| thumbnail_url | TEXT | Yes | - | Data field |
| job_id | UUID REFERENCES jobs(id) | Yes | - | Foreign key reference |
| customer_id | UUID REFERENCES customers(id) | Yes | - | Foreign key reference |
| property_id | UUID REFERENCES properties(id) | Yes | - | Foreign key reference |
| equipment_id | UUID REFERENCES equipment(id) | Yes | - | Foreign key reference |
| voice_transcript_id | UUID REFERENCES voice_transcripts(id) | Yes | - | Foreign key reference |
| voice_description | TEXT | Yes | - | Data field |
| vision_analysis | JSONB | Yes | - | Data field |
| ocr_text | TEXT | Yes | - | Data field |
| tags | TEXT[] | Yes | - | Data field |
| is_public | BOOLEAN | Yes | false | Data field |
| metadata | JSONB | Yes | '{}'::jsonb | Data field |
| created_at | TIMESTAMPTZ | Yes | NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | NOW() | Last modification timestamp |

#### notification_queue

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | gen_random_uuid() | Primary identifier |
| company_id | TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| recipient_id | UUID | No | - | Foreign key reference |
| type | TEXT | No | - | Classification type |
| priority | TEXT | No | 'medium' CHECK (priority IN ('low' | Data field |
| message | TEXT | No | - | Data field |
| data | JSONB | Yes | - | Data field |
| method | TEXT CHECK (method IN ('sms' | Yes | - | Data field |
| status | TEXT | No | 'pending' CHECK (status IN ('pending' | Current status/state |
| attempts | INTEGER | Yes | 0 | Data field |
| last_attempt_at | TIMESTAMPTZ | Yes | - | Data field |
| delivered_at | TIMESTAMPTZ | Yes | - | Data field |
| error | TEXT | Yes | - | Data field |
| created_at | TIMESTAMPTZ | No | NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | No | NOW() | Last modification timestamp |

#### ocr_documents

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | gen_random_uuid() | Primary identifier |
| company_id | TEXT | No | - | Foreign key reference |
| ocr_job_id | UUID REFERENCES public.ocr_jobs(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| file_path | TEXT | No | - | Data field |
| page_count | INTEGER | Yes | - | Data field |
| created_at | TIMESTAMPTZ | Yes | NOW() | Record creation timestamp |

#### ocr_jobs

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | gen_random_uuid() | Primary identifier |
| company_id | TEXT | No | - | Foreign key reference |
| vendor_id | UUID REFERENCES public.vendors(id) | Yes | - | Foreign key reference |
| status | TEXT NOT NULL CHECK (status IN ('queued' | Yes | - | Current status/state |
| created_at | TIMESTAMPTZ | Yes | NOW() | Record creation timestamp |
| completed_at | TIMESTAMPTZ | Yes | - | Data field |

#### ocr_line_items

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | gen_random_uuid() | Primary identifier |
| company_id | TEXT | No | - | Foreign key reference |
| ocr_document_id | UUID REFERENCES public.ocr_documents(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| line_index | INTEGER | No | - | Data field |
| sku | TEXT | Yes | - | Data field |
| description | TEXT | Yes | - | Detailed description |
| qty | NUMERIC(18 | Yes | - | Data field |
| unit_price | NUMERIC(18 | Yes | - | Data field |
| total | NUMERIC(18 | Yes | - | Data field |

#### ocr_note_entities

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | gen_random_uuid() | Primary identifier |
| company_id | TEXT | No | - | Foreign key reference |
| ocr_document_id | UUID REFERENCES public.ocr_documents(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| label | TEXT | No | - | Data field |
| value | TEXT | Yes | - | Data field |

#### offline_sync_queue

**Row Count**: 0 | **RLS**: Disabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| tenant_id | UUID NOT NULL REFERENCES tenants(id) | Yes | - | Foreign key reference |
| created_at | TIMESTAMPTZ | No | NOW() | Record creation timestamp |
| user_id | UUID NOT NULL REFERENCES auth.users(id) | Yes | - | Foreign key reference |
| operation_type | TEXT | No | - | Data field |
| entity_type | TEXT | No | - | Data field |
| entity_id | UUID | Yes | - | Foreign key reference |
| operation_data | JSONB | No | - | Data field |
| sync_status | TEXT | No | 'pending' CHECK (sync_status IN ('pending' | Data field |
| synced_at | TIMESTAMPTZ | Yes | - | Data field |
| error | TEXT | Yes | - | Data field |
| retry_count | INTEGER | Yes | 0 | Data field |

#### properties

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| tenant_id | UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| customer_id | UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| property_number | VARCHAR(50) | No | - | Data field |
| name | VARCHAR(255) | No | - | Display name |
| address | JSONB | No | - | Physical address |
| location | GEOGRAPHY(POINT | Yes | - | Data field |
| property_type | VARCHAR(100) | Yes | - | Data field |
| size_sqft | INTEGER | Yes | - | Data field |
| lot_size_acres | NUMERIC(10 | Yes | - | Data field |
| zones | JSONB | Yes | - | Data field |
| access_notes | TEXT | Yes | - | Data field |
| gate_code | VARCHAR(50) | Yes | - | Data field |
| special_instructions | TEXT | Yes | - | Data field |
| voice_navigation_notes | TEXT | Yes | - | Data field |
| photos | JSONB | Yes | '[]'::jsonb | Data field |
| is_active | BOOLEAN | Yes | true | Data field |
| metadata | JSONB | Yes | '{}'::jsonb | Data field |
| created_at | TIMESTAMPTZ | Yes | NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | NOW() | Last modification timestamp |

#### purchase_receipts

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| company_id | TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| vendor_name | TEXT | No | - | Data field |
| vendor_location | TEXT | Yes | - | Data field |
| purchase_date | DATE | No | - | Data field |
| total_amount | DECIMAL(10 | Yes | - | Data field |
| line_items | JSONB[] | No | - | Data field |
| receipt_photo_url | TEXT | No | - | Data field |
| ocr_extracted_data | JSONB | No | - | Data field |
| ocr_confidence_scores | JSONB | Yes | - | Data field |
| ocr_method | ocr_method | No | - | Data field |
| po_reference | TEXT | Yes | - | Data field |
| assigned_job_id | UUID | Yes | - | Foreign key reference |
| created_at | TIMESTAMPTZ | No | NOW() | Record creation timestamp |
| created_by | UUID | No | - | User who created record |

#### request_deduplication

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| tenant_id | UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| user_id | UUID NOT NULL REFERENCES auth.users(id) | Yes | - | Foreign key reference |
| request_hash | VARCHAR(64) | No | - | Data field |
| request_type | VARCHAR(50) | No | - | Data field |
| request_data | JSONB | No | - | Data field |
| first_seen_at | TIMESTAMPTZ | Yes | NOW() | Data field |
| last_seen_at | TIMESTAMPTZ | Yes | NOW() | Data field |
| occurrence_count | INTEGER | Yes | 1 | Data field |
| was_executed | BOOLEAN | Yes | false | Data field |
| execution_result | JSONB | Yes | - | Data field |
| expires_at | TIMESTAMPTZ | Yes | NOW() + INTERVAL '5 minutes' | Data field |

#### route_stops

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| route_id | UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| job_id | UUID NOT NULL REFERENCES jobs(id) | Yes | - | Foreign key reference |
| stop_order | INTEGER | No | - | Data field |
| planned_arrival | TIME | Yes | - | Data field |
| planned_duration_minutes | INTEGER | Yes | - | Data field |
| arrival_time | TIMESTAMPTZ | Yes | - | Data field |
| departure_time | TIMESTAMPTZ | Yes | - | Data field |
| distance_from_previous | NUMERIC(6 | Yes | - | Data field |
| drive_time_from_previous | INTEGER | Yes | - | Data field |
| completed | BOOLEAN | Yes | false | Data field |
| skipped | BOOLEAN | Yes | false | Data field |
| skip_reason | TEXT | Yes | - | Data field |
| created_at | TIMESTAMPTZ | Yes | NOW() | Record creation timestamp |

#### routes

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| tenant_id | UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| route_name | VARCHAR(255) | No | - | Data field |
| route_date | DATE | No | - | Data field |
| assigned_to | UUID REFERENCES users_extended(id) | Yes | - | Data field |
| assigned_vehicle | UUID REFERENCES equipment(id) | Yes | - | Data field |
| start_location | GEOGRAPHY(POINT | Yes | - | Data field |
| end_location | GEOGRAPHY(POINT | Yes | - | Data field |
| planned_start_time | TIME | Yes | - | Data field |
| planned_duration_minutes | INTEGER | Yes | - | Data field |
| actual_start | TIMESTAMPTZ | Yes | - | Data field |
| actual_end | TIMESTAMPTZ | Yes | - | Data field |
| total_miles | NUMERIC(6 | Yes | - | Data field |
| status | VARCHAR(50) | Yes | 'planned' | Current status/state |
| metadata | JSONB | Yes | '{}'::jsonb | Data field |
| created_at | TIMESTAMPTZ | Yes | NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | NOW() | Last modification timestamp |

#### schedule_events

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | gen_random_uuid() | Primary identifier |
| company_id | TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| day_plan_id | UUID NOT NULL REFERENCES public.day_plans(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| event_type | TEXT NOT NULL CHECK (event_type IN ('job' | Yes | - | Data field |
| job_id | TEXT | Yes | - | Foreign key reference |
| sequence_order | INTEGER | No | - | Data field |
| scheduled_start | TIMESTAMPTZ | Yes | - | Data field |
| scheduled_duration_minutes | INTEGER | Yes | - | Data field |
| actual_start | TIMESTAMPTZ | Yes | - | Data field |
| actual_end | TIMESTAMPTZ | Yes | - | Data field |
| status | TEXT | No | 'pending' CHECK (status IN ('pending' | Current status/state |
| location_data | GEOGRAPHY(POINT) | Yes | - | Data field |
| address | JSONB | Yes | - | Physical address |
| notes | TEXT | Yes | - | Data field |
| voice_notes | TEXT | Yes | - | Data field |
| metadata | JSONB | No | '{}'::jsonb | Data field |
| created_at | TIMESTAMPTZ | No | NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | No | NOW() | Last modification timestamp |

#### service_history

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| tenant_id | UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| entity_type | VARCHAR(50) | No | - | Data field |
| entity_id | UUID | No | - | Foreign key reference |
| service_date | DATE | No | - | Data field |
| service_type | VARCHAR(100) | No | - | Data field |
| description | TEXT | Yes | - | Detailed description |
| performed_by | UUID REFERENCES users_extended(id) | Yes | - | Data field |
| external_vendor | VARCHAR(255) | Yes | - | Data field |
| parts_used | JSONB | Yes | '[]'::jsonb | Data field |
| labor_hours | NUMERIC(5 | Yes | - | Data field |
| parts_cost | NUMERIC(10 | Yes | - | Data field |
| labor_cost | NUMERIC(10 | Yes | - | Data field |
| total_cost | NUMERIC(10 | Yes | - | Data field |
| notes | TEXT | Yes | - | Data field |
| media_assets | UUID[] | Yes | - | Data field |
| voice_notes_id | UUID REFERENCES voice_transcripts(id) | Yes | - | Foreign key reference |
| next_service_date | DATE | Yes | - | Data field |
| next_service_type | VARCHAR(100) | Yes | - | Data field |
| metadata | JSONB | Yes | '{}'::jsonb | Data field |
| created_at | TIMESTAMPTZ | Yes | NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | NOW() | Last modification timestamp |

#### time_entries

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| tenant_id | UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| user_id | UUID NOT NULL REFERENCES users_extended(id) | Yes | - | Foreign key reference |
| job_id | UUID REFERENCES jobs(id) | Yes | - | Foreign key reference |
| clock_in | TIMESTAMPTZ | No | - | Data field |
| clock_out | TIMESTAMPTZ | Yes | - | Data field |
| break_minutes | INTEGER | Yes | 0 | Data field |
| total_minutes | INTEGER | Yes | - | Data field |
| clock_in_location | GEOGRAPHY(POINT | Yes | - | Data field |
| clock_out_location | GEOGRAPHY(POINT | Yes | - | Data field |
| clock_in_address | TEXT | Yes | - | Data field |
| clock_out_address | TEXT | Yes | - | Data field |
| voice_clock_in | BOOLEAN | Yes | false | Data field |
| voice_clock_out | BOOLEAN | Yes | false | Data field |
| voice_notes | TEXT | Yes | - | Data field |
| approved_by | UUID REFERENCES users_extended(id) | Yes | - | Data field |
| approved_at | TIMESTAMPTZ | Yes | - | Data field |
| approval_notes | TEXT | Yes | - | Data field |
| billable | BOOLEAN | Yes | true | Data field |
| hourly_rate | NUMERIC(10 | Yes | - | Data field |
| total_cost | NUMERIC(10 | Yes | - | Data field |
| metadata | JSONB | Yes | '{}'::jsonb | Data field |
| created_at | TIMESTAMPTZ | Yes | NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | NOW() | Last modification timestamp |

#### training_data_records

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| company_id | TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| user_id | UUID | No | - | Foreign key reference |
| original_photo_url | TEXT | No | - | Data field |
| yolo_detections | JSONB | No | - | Data field |
| vlm_analysis | JSONB | Yes | - | Data field |
| user_selections | INTEGER[] | No | - | Data field |
| user_corrections | JSONB[] | No | '{}' | Data field |
| user_exclusions | JSONB[] | No | '{}' | Data field |
| context | JSONB | No | - | Data field |
| voice_transcript | TEXT | Yes | - | Data field |
| quality_metrics | JSONB | Yes | - | Data field |
| created_record_ids | UUID[] | No | - | Data field |
| created_at | TIMESTAMPTZ | No | NOW() | Record creation timestamp |

#### vendor_aliases

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | gen_random_uuid() | Primary identifier |
| company_id | TEXT | No | - | Foreign key reference |
| vendor_id | UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| alias | TEXT | No | - | Data field |

#### vendor_locations

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | gen_random_uuid() | Primary identifier |
| company_id | TEXT | No | - | Foreign key reference |
| vendor_id | UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| address | TEXT | Yes | - | Physical address |
| city | TEXT | Yes | - | Data field |
| state | TEXT | Yes | - | Data field |
| postal_code | TEXT | Yes | - | Data field |
| country | TEXT | Yes | - | Data field |

#### vendors

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | gen_random_uuid() | Primary identifier |
| company_id | TEXT | No | - | Foreign key reference |
| name | TEXT | No | - | Display name |
| is_active | BOOLEAN | Yes | TRUE | Data field |
| created_at | TIMESTAMPTZ | Yes | NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | NOW() | Last modification timestamp |

#### vision_confidence_config

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| company_id | UUID NOT NULL UNIQUE | Yes | - | Foreign key reference |
| confidence_threshold | DECIMAL(3 | Yes | - | Data field |
| CHECK | (confidence_threshold BETWEEN 0.50 AND 0.95) | Yes | - | Data field |
| max_daily_vlm_requests | INTEGER | No | 100 | Data field |
| CHECK | (max_daily_vlm_requests > 0) | Yes | - | Data field |
| daily_budget_usd | DECIMAL(6 | Yes | - | Data field |
| CHECK | (daily_budget_usd > 0) | Yes | - | Data field |
| created_at | TIMESTAMPTZ | Yes | NOW() | Record creation timestamp |
| updated_at | TIMESTAMPTZ | Yes | NOW() | Last modification timestamp |

#### vision_cost_records

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| company_id | UUID | No | - | Foreign key reference |
| verification_id | UUID NOT NULL REFERENCES vision_verifications(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| provider | TEXT | No | - | Data field |
| operation_type | TEXT | No | - | Data field |
| estimated_cost_usd | DECIMAL(6 | Yes | - | Data field |
| actual_cost_usd | DECIMAL(6 | Yes | - | Data field |
| request_timestamp | TIMESTAMPTZ | Yes | NOW() | Data field |
| response_timestamp | TIMESTAMPTZ | Yes | - | Data field |
| created_at | TIMESTAMPTZ | Yes | NOW() | Record creation timestamp |

#### vision_detected_items

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| verification_id | UUID NOT NULL REFERENCES vision_verifications(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| item_type | TEXT | No | - | Data field |
| confidence_score | DECIMAL(3 | Yes | - | Data field |
| bounding_box | JSONB | Yes | - | Data field |
| matched_kit_item_id | UUID REFERENCES kit_items(id) | Yes | - | Foreign key reference |
| match_status | TEXT NOT NULL CHECK (match_status IN ('matched' | Yes | - | Data field |
| created_at | TIMESTAMPTZ | Yes | NOW() | Record creation timestamp |

#### vision_training_annotations

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| training_record_id | UUID NOT NULL REFERENCES training_data_records(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| item_detection_number | INTEGER | No | - | Data field |
| corrected_label | TEXT | No | - | Data field |
| corrected_bbox | JSONB | No | - | Data field |
| correction_reason | TEXT | Yes | - | Data field |
| created_at | TIMESTAMPTZ | No | NOW() | Record creation timestamp |

#### vision_verifications

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| tenant_id | UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| job_id | UUID REFERENCES jobs(id) | Yes | - | Foreign key reference |
| media_asset_id | UUID NOT NULL REFERENCES media_assets(id) | Yes | - | Foreign key reference |
| verification_type | vision_verification_type | No | - | Data field |
| verified_by | UUID NOT NULL REFERENCES auth.users(id) | Yes | - | Data field |
| ai_verified | BOOLEAN | Yes | - | Data field |
| ai_confidence | NUMERIC(5 | Yes | - | Data field |
| ai_findings | JSONB | Yes | - | Data field |
| ai_provider | VARCHAR(50) | Yes | - | Data field |
| ai_cost | NUMERIC(10 | Yes | - | Data field |
| manual_verified | BOOLEAN | Yes | - | Data field |
| manual_notes | TEXT | Yes | - | Data field |
| voice_annotation_id | UUID REFERENCES voice_transcripts(id) | Yes | - | Foreign key reference |
| created_at | TIMESTAMPTZ | Yes | NOW() | Record creation timestamp |

#### voice_sessions

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | text | Yes | - | Primary identifier |
| company_id | text | Yes | - | Foreign key reference |
| user_id | text | Yes | - | Foreign key reference |
| session_type | text | Yes | - | Data field |
| start_time | timestamptz | Yes | - | Date/time value |
| end_time | timestamptz | Yes | - | Date/time value |
| is_active | boolean | Yes | true | Flag/toggle |
| created_at | timestamptz | Yes | now() | Record creation timestamp |
| updated_at | timestamptz | Yes | now() | Last modification timestamp |

#### voice_transcripts

**Row Count**: 0 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | Yes | uuid_generate_v4() | Primary identifier |
| tenant_id | UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE | Yes | - | Foreign key reference |
| user_id | UUID NOT NULL REFERENCES auth.users(id) | Yes | - | Foreign key reference |
| session_id | UUID REFERENCES user_sessions(id) | Yes | - | Foreign key reference |
| job_id | UUID REFERENCES jobs(id) | Yes | - | Foreign key reference |
| audio_url | TEXT | Yes | - | Data field |
| audio_duration | NUMERIC(10 | Yes | - | Data field |
| transcript | TEXT | Yes | - | Data field |
| confidence_score | NUMERIC(5 | Yes | - | Data field |
| status | transcription_status | Yes | 'pending' | Current status/state |
| language_code | VARCHAR(10) | Yes | 'en-US' | Data field |
| provider | VARCHAR(50) | Yes | - | Data field |
| provider_transcript_id | VARCHAR(255) | Yes | - | Foreign key reference |
| cost | NUMERIC(10 | Yes | - | Data field |
| metadata | JSONB | Yes | '{}'::jsonb | Data field |
| created_at | TIMESTAMPTZ | Yes | NOW() | Record creation timestamp |
| processed_at | TIMESTAMPTZ | Yes | - | Data field |

**Foreign Keys**:
- NOT → tenants.id (undefined)
- NOT → users.id (undefined)
- session_id → user_sessions.id (undefined)
- job_id → jobs.id (undefined)
- NOT → tenants.id (undefined)
- NOT → voice_transcripts.id (undefined)
- NOT → users.id (undefined)
- NOT → tenants.id (undefined)
- NOT → users.id (undefined)
- job_id → jobs.id (undefined)
- customer_id → customers.id (undefined)
- property_id → properties.id (undefined)
- equipment_id → equipment.id (undefined)
- voice_transcript_id → voice_transcripts.id (undefined)
- NOT → tenants.id (undefined)
- job_id → jobs.id (undefined)
- NOT → media_assets.id (undefined)
- NOT → users.id (undefined)
- voice_annotation_id → voice_transcripts.id (undefined)
- NOT → tenants.id (undefined)
- NOT → users.id (undefined)
- job_id → jobs.id (undefined)
- customer_id → customers.id (undefined)
- property_id → properties.id (undefined)
- NOT → tenants.id (undefined)
- NOT → users.id (undefined)
- NOT → tenants.id (undefined)
- NOT → users.id (undefined)
- voice_transcript_id → voice_transcripts.id (undefined)
- intent_recognition_id → intent_recognitions.id (undefined)
- vision_verification_id → vision_verifications.id (undefined)
- media_asset_id → media_assets.id (undefined)

### 2.4 Tables Without RLS (3 total)

⚠️ **Security Risk**: These tables do not have Row Level Security enabled:

- ai_interaction_logs
- intent_classifications
- offline_sync_queue
### 2.5 Orphaned Tables (43 total)

🧹 **Cleanup Candidates**: These tables have no relationships and no data:

- materials
- conversation_sessions
- request_deduplication
- ai_cost_tracking
- irrigation_runs
- service_history
- time_entries
- route_stops
- containers
- job_checklist_items
- load_verifications
- company_settings
- companies
- voice_sessions
- kits
- kit_items
- kit_variants
- kit_assignments
- kit_override_logs
- day_plans
- schedule_events
- crew_assignments
- job_kits
- notification_queue
- vendor_aliases
- vendor_locations
- ocr_line_items
- ocr_note_entities
- vision_detected_items
- vision_cost_records
- vision_confidence_config
- inventory_items
- container_assignments
- inventory_transactions
- purchase_receipts
- training_data_records
- vision_training_annotations
- detection_confidence_thresholds
- background_filter_preferences
- item_relationships
- ai_interaction_logs
- intent_classifications
- offline_sync_queue

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

- Enable RLS on 3 tables: ai_interaction_logs, intent_classifications, offline_sync_queue
- Review 60 empty tables for potential removal
- Add indexes on 76 foreign key columns for better join performance

### 4.2 Storage Recommendations

- Remove 4 unused buckets: verification-photos, job-photos, voice-recordings, equipment-images
- Add RLS policies to 4 buckets without access control

### 4.3 Priority Actions

3. **Clean up 47 unused resources** - Free up space and reduce clutter

## Appendices
### A.1 API Endpoint Mapping Guide

Based on the analysis, here are suggested API endpoints for each major table:

### A.2 Cleanup Script Template

```typescript
// Cleanup script for orphaned tables and unused resources
import { createClient } from "@supabase/supabase-js";

const client = createClient(url, serviceKey);

// Remove orphaned tables
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS materials;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS conversation_sessions;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS request_deduplication;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS ai_cost_tracking;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS irrigation_runs;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS service_history;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS time_entries;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS route_stops;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS containers;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS job_checklist_items;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS load_verifications;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS company_settings;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS companies;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS voice_sessions;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS kits;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS kit_items;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS kit_variants;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS kit_assignments;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS kit_override_logs;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS day_plans;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS schedule_events;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS crew_assignments;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS job_kits;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS notification_queue;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS vendor_aliases;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS vendor_locations;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS ocr_line_items;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS ocr_note_entities;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS vision_detected_items;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS vision_cost_records;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS vision_confidence_config;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS inventory_items;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS container_assignments;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS inventory_transactions;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS purchase_receipts;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS training_data_records;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS vision_training_annotations;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS detection_confidence_thresholds;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS background_filter_preferences;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS item_relationships;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS ai_interaction_logs;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS intent_classifications;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS offline_sync_queue;" });

// Remove empty buckets
// await client.storage.deleteBucket("verification-photos");
// await client.storage.deleteBucket("job-photos");
// await client.storage.deleteBucket("voice-recordings");
// await client.storage.deleteBucket("equipment-images");
```