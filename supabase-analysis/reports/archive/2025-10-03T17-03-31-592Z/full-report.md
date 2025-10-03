# Supabase Analysis Report

Generated: 2025-10-03T17:02:30.227Z
Database: https://rtwigjwqufozqfwozpvo.supabase.co

## Executive Summary

### Database Overview
- **Total Tables**: 157
- **Total Rows**: 694
- **Tables without RLS**: 0
- **Orphaned Tables**: 127
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
### 2.1 Tables (157 total)

| Table Name | Rows | Columns | RLS | Primary Key | Description |
|------------|------|---------|-----|-------------|-------------|
| notification_queue | 209 | 15 | ✅ | id | Domain data |
| customers | 86 | 19 | ✅ | id | Customer data |
| tenants | 85 | 5 | ✅ | id | Domain data |
| invoices | 77 | 16 | ✅ | id | Voice interactions |
| jobs | 50 | 51 | ✅ | id | Job tracking |
| properties | 35 | 22 | ✅ | id | Domain data |
| equipment_maintenance | 33 | 13 | ✅ | id | Equipment tracking |
| users_extended | 29 | 24 | ✅ | id | User management |
| role_permissions | 25 | 9 | ✅ | id | Domain data |
| kit_items | 13 | 10 | ✅ | id | Domain data |
| audit_logs | 11 | 10 | ✅ | id | System logging |
| permissions | 11 | 10 | ✅ | id | Domain data |
| kits | 6 | 10 | ✅ | id | Domain data |
| notifications | 6 | 11 | ✅ | id | Domain data |
| companies | 5 | 7 | ✅ | id | Domain data |
| day_plans | 2 | 15 | ✅ | id | Domain data |
| kit_variants | 2 | 9 | ✅ | id | Domain data |
| inventory_images | 1 | 7 | ✅ | id | Domain data |
| kit_assignments | 1 | 9 | ✅ | id | Domain data |
| ocr_documents | 1 | 6 | ✅ | id | Domain data |
| ocr_jobs | 1 | 6 | ✅ | id | Job tracking |
| ocr_line_items | 1 | 9 | ✅ | id | Domain data |
| ocr_note_entities | 1 | 5 | ✅ | id | Domain data |
| vendor_aliases | 1 | 4 | ✅ | id | Domain data |
| vendor_locations | 1 | 8 | ✅ | id | Domain data |
| vendors | 1 | 7 | ✅ | id | Domain data |
| ai_cost_tracking | 0 | 0 | ✅ | None | Domain data |
| ai_interaction_logs | 0 | 0 | ✅ | None | System logging |
| ai_models | 0 | 0 | ✅ | None | Domain data |
| ai_prompts | 0 | 0 | ✅ | None | Domain data |
| attachments | 0 | 0 | ✅ | None | Domain data |
| audit_log_entries | 0 | 0 | ✅ | None | System logging |
| background_filter_preferences | 0 | 0 | ✅ | None | Domain data |
| batch_operations | 0 | 0 | ✅ | None | Domain data |
| billing_accounts | 0 | 0 | ✅ | None | Domain data |
| break_logs | 0 | 0 | ✅ | None | System logging |
| calendar_events | 0 | 0 | ✅ | None | Domain data |
| comments | 0 | 0 | ✅ | None | Domain data |
| company_settings | 0 | 0 | ✅ | None | Settings storage |
| configurations | 0 | 0 | ✅ | None | Configuration |
| container_assignments | 0 | 0 | ✅ | None | Domain data |
| container_locations | 0 | 0 | ✅ | None | Domain data |
| containers | 0 | 0 | ✅ | None | Domain data |
| conversation_sessions | 0 | 0 | ✅ | None | Domain data |
| crew_assignments | 0 | 0 | ✅ | None | Domain data |
| crew_schedules | 0 | 0 | ✅ | None | Domain data |
| customer_contacts | 0 | 0 | ✅ | None | Customer data |
| customer_notes | 0 | 0 | ✅ | None | Customer data |
| detected_items | 0 | 0 | ✅ | None | Domain data |
| detection_confidence_thresholds | 0 | 0 | ✅ | None | Domain data |
| device_registrations | 0 | 0 | ✅ | None | Domain data |
| document_versions | 0 | 0 | ✅ | None | Domain data |
| documents | 0 | 0 | ✅ | None | Domain data |
| email_queue | 0 | 0 | ✅ | None | Domain data |
| employee_schedules | 0 | 0 | ✅ | None | Domain data |
| equipment | 0 | 0 | ✅ | None | Equipment tracking |
| equipment_assignments | 0 | 0 | ✅ | None | Equipment tracking |
| equipment_locations | 0 | 0 | ✅ | None | Equipment tracking |
| estimates | 0 | 0 | ✅ | None | Domain data |
| export_jobs | 0 | 0 | ✅ | None | Job tracking |
| feature_flags | 0 | 0 | ✅ | None | Domain data |
| import_jobs | 0 | 0 | ✅ | None | Job tracking |
| intent_classifications | 0 | 0 | ✅ | None | Domain data |
| intent_recognitions | 0 | 0 | ✅ | None | Domain data |
| inventory_items | 0 | 0 | ✅ | None | Domain data |
| inventory_locations | 0 | 0 | ✅ | None | Domain data |
| inventory_transactions | 0 | 0 | ✅ | None | Domain data |
| invoice_items | 0 | 0 | ✅ | None | Voice interactions |
| irrigation_history | 0 | 0 | ✅ | None | Domain data |
| irrigation_maintenance | 0 | 0 | ✅ | None | Domain data |
| irrigation_runs | 0 | 0 | ✅ | None | Domain data |
| irrigation_schedules | 0 | 0 | ✅ | None | Domain data |
| irrigation_systems | 0 | 0 | ✅ | None | Domain data |
| irrigation_zones | 0 | 0 | ✅ | None | Domain data |
| item_relationships | 0 | 0 | ✅ | None | Domain data |
| job_assignments | 0 | 0 | ✅ | None | Job tracking |
| job_checklist_items | 0 | 0 | ✅ | None | Job tracking |
| job_equipment | 0 | 0 | ✅ | None | Job tracking |
| job_kits | 0 | 0 | ✅ | None | Job tracking |
| job_materials | 0 | 0 | ✅ | None | Job tracking |
| job_notes | 0 | 0 | ✅ | None | Job tracking |
| job_status_history | 0 | 0 | ✅ | None | Job tracking |
| job_templates | 0 | 0 | ✅ | None | Job tracking |
| kit_override_logs | 0 | 0 | ✅ | None | System logging |
| maintenance_logs | 0 | 0 | ✅ | None | System logging |
| maintenance_schedules | 0 | 0 | ✅ | None | Domain data |
| material_inventory | 0 | 0 | ✅ | None | Material inventory |
| material_usage | 0 | 0 | ✅ | None | Material inventory |
| materials | 0 | 0 | ✅ | None | Material inventory |
| media_assets | 0 | 0 | ✅ | None | Domain data |
| media_metadata | 0 | 0 | ✅ | None | Domain data |
| mobile_sessions | 0 | 0 | ✅ | None | Domain data |
| notes | 0 | 0 | ✅ | None | Domain data |
| notification_history | 0 | 0 | ✅ | None | Domain data |
| notification_preferences | 0 | 0 | ✅ | None | Domain data |
| offline_queue | 0 | 0 | ✅ | None | Domain data |
| offline_sync_queue | 0 | 0 | ✅ | None | Domain data |
| overtime_records | 0 | 0 | ✅ | None | Domain data |
| payment_methods | 0 | 0 | ✅ | None | Domain data |
| payments | 0 | 0 | ✅ | None | Domain data |
| profiles | 0 | 0 | ✅ | None | Domain data |
| property_access_codes | 0 | 0 | ✅ | None | Domain data |
| property_notes | 0 | 0 | ✅ | None | Domain data |
| property_zones | 0 | 0 | ✅ | None | Domain data |
| purchase_order_items | 0 | 0 | ✅ | None | Domain data |
| purchase_orders | 0 | 0 | ✅ | None | Domain data |
| purchase_receipts | 0 | 0 | ✅ | None | Domain data |
| push_tokens | 0 | 0 | ✅ | None | Domain data |
| quotes | 0 | 0 | ✅ | None | Domain data |
| receipts | 0 | 0 | ✅ | None | Domain data |
| recurring_schedules | 0 | 0 | ✅ | None | Domain data |
| request_deduplication | 0 | 0 | ✅ | None | Domain data |
| roles | 0 | 0 | ✅ | None | Domain data |
| route_history | 0 | 0 | ✅ | None | Domain data |
| route_optimizations | 0 | 0 | ✅ | None | Domain data |
| route_stops | 0 | 0 | ✅ | None | Domain data |
| routes | 0 | 0 | ✅ | None | Domain data |
| schedule_events | 0 | 0 | ✅ | None | Domain data |
| schedule_templates | 0 | 0 | ✅ | None | Domain data |
| schedules | 0 | 0 | ✅ | None | Domain data |
| service_history | 0 | 0 | ✅ | None | Domain data |
| service_tickets | 0 | 0 | ✅ | None | Domain data |
| settings | 0 | 0 | ✅ | None | Settings storage |
| shift_patterns | 0 | 0 | ✅ | None | Domain data |
| sms_queue | 0 | 0 | ✅ | None | Domain data |
| storage_units | 0 | 0 | ✅ | None | Domain data |
| sync_logs | 0 | 0 | ✅ | None | System logging |
| sync_queue | 0 | 0 | ✅ | None | Domain data |
| system_logs | 0 | 0 | ✅ | None | System logging |
| tag_assignments | 0 | 0 | ✅ | None | Domain data |
| tags | 0 | 0 | ✅ | None | Domain data |
| team_members | 0 | 0 | ✅ | None | Domain data |
| teams | 0 | 0 | ✅ | None | Domain data |
| time_clock_entries | 0 | 0 | ✅ | None | Domain data |
| time_entries | 0 | 0 | ✅ | None | Domain data |
| time_off_requests | 0 | 0 | ✅ | None | Domain data |
| training_data_records | 0 | 0 | ✅ | None | Domain data |
| transactions | 0 | 0 | ✅ | None | Domain data |
| user_permissions | 0 | 0 | ✅ | None | User management |
| user_roles | 0 | 0 | ✅ | None | User management |
| users | 0 | 0 | ✅ | None | User management |
| vendor_contacts | 0 | 0 | ✅ | None | Domain data |
| vendor_invoices | 0 | 0 | ✅ | None | Voice interactions |
| vision_confidence_config | 0 | 0 | ✅ | None | Vision/image processing |
| vision_cost_records | 0 | 0 | ✅ | None | Vision/image processing |
| vision_detected_items | 0 | 0 | ✅ | None | Vision/image processing |
| vision_training_annotations | 0 | 0 | ✅ | None | Vision/image processing |
| vision_verification_records | 0 | 0 | ✅ | None | Vision/image processing |
| vision_verifications | 0 | 0 | ✅ | None | Vision/image processing |
| voice_commands | 0 | 0 | ✅ | None | Voice interactions |
| voice_notes | 0 | 0 | ✅ | None | Voice interactions |
| voice_sessions | 0 | 0 | ✅ | None | Voice interactions |
| voice_transcripts | 0 | 0 | ✅ | None | Voice interactions |
| webhook_logs | 0 | 0 | ✅ | None | System logging |
| webhooks | 0 | 0 | ✅ | None | Domain data |
| week_plans | 0 | 0 | ✅ | None | Domain data |
| work_orders | 0 | 0 | ✅ | None | Domain data |

### 2.2 Table Schemas

#### ai_cost_tracking

**Row Count**: 0 | **RLS**: Enabled

#### ai_interaction_logs

**Row Count**: 0 | **RLS**: Enabled

#### ai_models

**Row Count**: 0 | **RLS**: Enabled

#### ai_prompts

**Row Count**: 0 | **RLS**: Enabled

#### attachments

**Row Count**: 0 | **RLS**: Enabled

#### audit_log_entries

**Row Count**: 0 | **RLS**: Enabled

#### audit_logs

**Row Count**: 11 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| tenant_id | uuid | No | - | Foreign key reference |
| entity_type | varchar | No | - | Data field |
| entity_id | uuid | No | - | Foreign key reference |
| action | varchar | No | - | Data field |
| performed_by | uuid | No | - | Data field |
| details | jsonb | No | - | Data field |
| ip_address | unknown | Yes | - | Physical address |
| user_agent | unknown | Yes | - | Data field |
| created_at | timestamp | No | - | Timestamp |

**Foreign Keys**:
- tenant_id → tenants.id (undefined)
- entity_id → entitys.id (undefined)

#### background_filter_preferences

**Row Count**: 0 | **RLS**: Enabled

#### batch_operations

**Row Count**: 0 | **RLS**: Enabled

#### billing_accounts

**Row Count**: 0 | **RLS**: Enabled

#### break_logs

**Row Count**: 0 | **RLS**: Enabled

#### calendar_events

**Row Count**: 0 | **RLS**: Enabled

#### comments

**Row Count**: 0 | **RLS**: Enabled

#### companies

**Row Count**: 5 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| tenant_id | uuid | Yes | - | Foreign key reference |
| name | varchar | Yes | - | Display name |
| created_at | timestamp | No | - | Timestamp |
| updated_at | timestamp | No | - | Timestamp |
| domain | varchar | Yes | - | Data field |
| is_active | boolean | No | - | Boolean flag |

**Foreign Keys**:
- tenant_id → tenants.id (undefined)

#### company_settings

**Row Count**: 0 | **RLS**: Enabled

#### configurations

**Row Count**: 0 | **RLS**: Enabled

#### container_assignments

**Row Count**: 0 | **RLS**: Enabled

#### container_locations

**Row Count**: 0 | **RLS**: Enabled

#### containers

**Row Count**: 0 | **RLS**: Enabled

#### conversation_sessions

**Row Count**: 0 | **RLS**: Enabled

#### crew_assignments

**Row Count**: 0 | **RLS**: Enabled

#### crew_schedules

**Row Count**: 0 | **RLS**: Enabled

#### customer_contacts

**Row Count**: 0 | **RLS**: Enabled

#### customer_notes

**Row Count**: 0 | **RLS**: Enabled

#### customers

**Row Count**: 86 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| tenant_id | uuid | No | - | Foreign key reference |
| customer_number | varchar | No | - | Data field |
| name | varchar | No | - | Display name |
| email | varchar | No | - | Email address |
| phone | varchar | Yes | - | Phone number |
| mobile_phone | unknown | Yes | - | Phone number |
| billing_address | jsonb | Yes | - | Physical address |
| service_address | varchar | Yes | - | Physical address |
| notes | unknown | Yes | - | User notes |
| tags | unknown | Yes | - | Data field |
| voice_notes | unknown | Yes | - | User notes |
| is_active | boolean | No | - | Boolean flag |
| metadata | jsonb | No | - | Additional data |
| created_at | timestamp | No | - | Timestamp |
| updated_at | timestamp | No | - | Timestamp |
| created_by | unknown | Yes | - | Data field |
| version | integer | No | - | Data field |
| intake_session_id | unknown | Yes | - | Foreign key reference |

**Foreign Keys**:
- tenant_id → tenants.id (undefined)
- intake_session_id → intake_sessions.id (undefined)

#### day_plans

**Row Count**: 2 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| company_id | uuid | No | - | Foreign key reference |
| user_id | uuid | No | - | Foreign key reference |
| plan_date | date | No | - | Data field |
| status | varchar | No | - | Current status/state |
| route_data | jsonb | No | - | Data field |
| total_distance_miles | numeric | No | - | Total/sum value |
| estimated_duration_minutes | integer | No | - | Data field |
| actual_start_time | unknown | Yes | - | Data field |
| actual_end_time | unknown | Yes | - | Data field |
| voice_session_id | unknown | Yes | - | Foreign key reference |
| auto_schedule_breaks | boolean | No | - | Data field |
| metadata | jsonb | No | - | Additional data |
| created_at | timestamp | No | - | Timestamp |
| updated_at | timestamp | No | - | Timestamp |

**Foreign Keys**:
- company_id → companies.id (undefined)
- user_id → users.id (undefined)
- voice_session_id → voice_sessions.id (undefined)

#### detected_items

**Row Count**: 0 | **RLS**: Enabled

#### detection_confidence_thresholds

**Row Count**: 0 | **RLS**: Enabled

#### device_registrations

**Row Count**: 0 | **RLS**: Enabled

#### document_versions

**Row Count**: 0 | **RLS**: Enabled

#### documents

**Row Count**: 0 | **RLS**: Enabled

#### email_queue

**Row Count**: 0 | **RLS**: Enabled

#### employee_schedules

**Row Count**: 0 | **RLS**: Enabled

#### equipment

**Row Count**: 0 | **RLS**: Enabled

#### equipment_assignments

**Row Count**: 0 | **RLS**: Enabled

#### equipment_locations

**Row Count**: 0 | **RLS**: Enabled

#### equipment_maintenance

**Row Count**: 33 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| equipment_id | varchar | No | - | Foreign key reference |
| performed_by | uuid | No | - | Data field |
| maintenance_type | varchar | No | - | Data field |
| maintenance_date | timestamp | No | - | Data field |
| actions_performed | array | No | - | Data field |
| pre_maintenance_verification_id | uuid | No | - | Foreign key reference |
| post_maintenance_verification_id | uuid | No | - | Foreign key reference |
| status | varchar | No | - | Current status/state |
| completion_date | timestamp | No | - | Data field |
| notes | varchar | No | - | User notes |
| created_at | timestamp | No | - | Timestamp |
| tenant_id | unknown | Yes | - | Foreign key reference |

**Foreign Keys**:
- equipment_id → equipment.id (undefined)
- pre_maintenance_verification_id → pre_maintenance_verifications.id (undefined)
- post_maintenance_verification_id → post_maintenance_verifications.id (undefined)
- tenant_id → tenants.id (undefined)

#### estimates

**Row Count**: 0 | **RLS**: Enabled

#### export_jobs

**Row Count**: 0 | **RLS**: Enabled

#### feature_flags

**Row Count**: 0 | **RLS**: Enabled

#### import_jobs

**Row Count**: 0 | **RLS**: Enabled

#### intent_classifications

**Row Count**: 0 | **RLS**: Enabled

#### intent_recognitions

**Row Count**: 0 | **RLS**: Enabled

#### inventory_images

**Row Count**: 1 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| company_id | varchar | No | - | Foreign key reference |
| media_id | unknown | Yes | - | Foreign key reference |
| file_path | varchar | No | - | Data field |
| mime_type | varchar | No | - | Data field |
| size_bytes | integer | No | - | Data field |
| created_at | timestamp | No | - | Timestamp |

**Foreign Keys**:
- company_id → companies.id (undefined)
- media_id → medias.id (undefined)

#### inventory_items

**Row Count**: 0 | **RLS**: Enabled

#### inventory_locations

**Row Count**: 0 | **RLS**: Enabled

#### inventory_transactions

**Row Count**: 0 | **RLS**: Enabled

#### invoice_items

**Row Count**: 0 | **RLS**: Enabled

#### invoices

**Row Count**: 77 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| tenant_id | uuid | No | - | Foreign key reference |
| invoice_number | varchar | No | - | Data field |
| customer_id | uuid | No | - | Foreign key reference |
| job_id | uuid | No | - | Foreign key reference |
| amount | integer | No | - | Data field |
| tax_amount | integer | No | - | Data field |
| total_amount | integer | No | - | Total/sum value |
| status | varchar | No | - | Current status/state |
| created_by | uuid | No | - | Data field |
| due_date | date | No | - | Data field |
| paid_date | unknown | Yes | - | Data field |
| payment_method | unknown | Yes | - | Data field |
| notes | unknown | Yes | - | User notes |
| created_at | timestamp | No | - | Timestamp |
| updated_at | timestamp | No | - | Timestamp |

**Foreign Keys**:
- tenant_id → tenants.id (undefined)
- customer_id → customers.id (undefined)
- job_id → jobs.id (undefined)

#### irrigation_history

**Row Count**: 0 | **RLS**: Enabled

#### irrigation_maintenance

**Row Count**: 0 | **RLS**: Enabled

#### irrigation_runs

**Row Count**: 0 | **RLS**: Enabled

#### irrigation_schedules

**Row Count**: 0 | **RLS**: Enabled

#### irrigation_systems

**Row Count**: 0 | **RLS**: Enabled

#### irrigation_zones

**Row Count**: 0 | **RLS**: Enabled

#### item_relationships

**Row Count**: 0 | **RLS**: Enabled

#### job_assignments

**Row Count**: 0 | **RLS**: Enabled

#### job_checklist_items

**Row Count**: 0 | **RLS**: Enabled

#### job_equipment

**Row Count**: 0 | **RLS**: Enabled

#### job_kits

**Row Count**: 0 | **RLS**: Enabled

#### job_materials

**Row Count**: 0 | **RLS**: Enabled

#### job_notes

**Row Count**: 0 | **RLS**: Enabled

#### job_status_history

**Row Count**: 0 | **RLS**: Enabled

#### job_templates

**Row Count**: 0 | **RLS**: Enabled

#### jobs

**Row Count**: 50 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| tenant_id | uuid | No | - | Foreign key reference |
| job_number | varchar | No | - | Data field |
| template_id | unknown | Yes | - | Foreign key reference |
| customer_id | uuid | No | - | Foreign key reference |
| property_id | uuid | No | - | Foreign key reference |
| title | varchar | No | - | Data field |
| description | varchar | Yes | - | Detailed description |
| status | varchar | No | - | Current status/state |
| priority | varchar | No | - | Data field |
| scheduled_start | timestamp | Yes | - | Data field |
| scheduled_end | unknown | Yes | - | Data field |
| actual_start | timestamp | Yes | - | Data field |
| actual_end | timestamp | Yes | - | Data field |
| assigned_to | uuid | Yes | - | Data field |
| assigned_team | unknown | Yes | - | Data field |
| estimated_duration | integer | Yes | - | Data field |
| actual_duration | unknown | Yes | - | Data field |
| completion_notes | varchar | Yes | - | User notes |
| voice_notes | varchar | Yes | - | User notes |
| voice_created | boolean | No | - | Data field |
| voice_session_id | unknown | Yes | - | Foreign key reference |
| checklist_items | array | No | - | Data field |
| materials_used | array | No | - | Data field |
| equipment_used | unknown | Yes | - | Data field |
| photos_before | array | No | - | Data field |
| photos_after | array | No | - | Data field |
| signature_required | boolean | No | - | Data field |
| signature_data | unknown | Yes | - | Data field |
| billing_info | unknown | Yes | - | Data field |
| metadata | jsonb | No | - | Additional data |
| created_at | timestamp | No | - | Timestamp |
| updated_at | timestamp | No | - | Timestamp |
| created_by | unknown | Yes | - | Data field |
| arrival_photo_id | unknown | Yes | - | Foreign key reference |
| arrival_confirmed_at | unknown | Yes | - | Timestamp |
| completion_quality_score | unknown | Yes | - | Data field |
| requires_supervisor_review | boolean | No | - | Data field |
| arrival_timestamp | unknown | Yes | - | Data field |
| arrival_gps_coords | unknown | Yes | - | Data field |
| arrival_method | unknown | Yes | - | Data field |
| arrival_confidence | unknown | Yes | - | Data field |
| completion_timestamp | unknown | Yes | - | Data field |
| completion_photo_url | unknown | Yes | - | Web URL |
| tool_reload_verified | boolean | No | - | Data field |
| offline_modified_at | unknown | Yes | - | Timestamp |
| offline_modified_by | unknown | Yes | - | Data field |
| special_instructions_audio | unknown | Yes | - | Data field |
| estimated_duration_minutes | unknown | Yes | - | Data field |
| actual_duration_minutes | unknown | Yes | - | Data field |
| completion_photo_urls | unknown | Yes | - | Web URL |

**Foreign Keys**:
- tenant_id → tenants.id (undefined)
- template_id → templates.id (undefined)
- customer_id → customers.id (undefined)
- property_id → properties.id (undefined)
- voice_session_id → voice_sessions.id (undefined)
- arrival_photo_id → arrival_photos.id (undefined)

#### kit_assignments

**Row Count**: 1 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| kit_id | uuid | No | - | Foreign key reference |
| variant_id | uuid | No | - | Foreign key reference |
| external_ref | varchar | No | - | Data field |
| notes | varchar | No | - | User notes |
| metadata | jsonb | No | - | Additional data |
| created_at | timestamp | No | - | Timestamp |
| updated_at | timestamp | No | - | Timestamp |
| tenant_id | unknown | Yes | - | Foreign key reference |

**Foreign Keys**:
- kit_id → kits.id (undefined)
- variant_id → variants.id (undefined)
- tenant_id → tenants.id (undefined)

#### kit_items

**Row Count**: 13 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| tenant_id | uuid | No | - | Foreign key reference |
| kit_id | uuid | No | - | Foreign key reference |
| item_type | varchar | No | - | Data field |
| quantity | integer | No | - | Data field |
| unit | varchar | No | - | Data field |
| is_required | boolean | No | - | Boolean flag |
| metadata | jsonb | No | - | Additional data |
| created_at | timestamp | No | - | Timestamp |
| updated_at | timestamp | No | - | Timestamp |

**Foreign Keys**:
- tenant_id → tenants.id (undefined)
- kit_id → kits.id (undefined)

#### kit_override_logs

**Row Count**: 0 | **RLS**: Enabled

#### kit_variants

**Row Count**: 2 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| tenant_id | uuid | No | - | Foreign key reference |
| kit_id | uuid | No | - | Foreign key reference |
| variant_code | varchar | No | - | Data field |
| name | varchar | No | - | Display name |
| is_default | boolean | No | - | Boolean flag |
| metadata | jsonb | No | - | Additional data |
| created_at | timestamp | No | - | Timestamp |
| updated_at | timestamp | No | - | Timestamp |

**Foreign Keys**:
- tenant_id → tenants.id (undefined)
- kit_id → kits.id (undefined)

#### kits

**Row Count**: 6 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| tenant_id | uuid | No | - | Foreign key reference |
| kit_code | varchar | No | - | Data field |
| name | varchar | No | - | Display name |
| description | unknown | Yes | - | Detailed description |
| category | unknown | Yes | - | Data field |
| is_active | boolean | No | - | Boolean flag |
| metadata | jsonb | No | - | Additional data |
| created_at | timestamp | No | - | Timestamp |
| updated_at | timestamp | No | - | Timestamp |

**Foreign Keys**:
- tenant_id → tenants.id (undefined)

#### maintenance_logs

**Row Count**: 0 | **RLS**: Enabled

#### maintenance_schedules

**Row Count**: 0 | **RLS**: Enabled

#### material_inventory

**Row Count**: 0 | **RLS**: Enabled

#### material_usage

**Row Count**: 0 | **RLS**: Enabled

#### materials

**Row Count**: 0 | **RLS**: Enabled

#### media_assets

**Row Count**: 0 | **RLS**: Enabled

#### media_metadata

**Row Count**: 0 | **RLS**: Enabled

#### mobile_sessions

**Row Count**: 0 | **RLS**: Enabled

#### notes

**Row Count**: 0 | **RLS**: Enabled

#### notification_history

**Row Count**: 0 | **RLS**: Enabled

#### notification_preferences

**Row Count**: 0 | **RLS**: Enabled

#### notification_queue

**Row Count**: 209 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| company_id | uuid | No | - | Foreign key reference |
| recipient_id | uuid | No | - | Foreign key reference |
| type | varchar | No | - | Classification type |
| priority | varchar | No | - | Data field |
| message | varchar | No | - | Data field |
| data | jsonb | No | - | Data field |
| method | unknown | Yes | - | Data field |
| status | varchar | No | - | Current status/state |
| attempts | integer | No | - | Data field |
| last_attempt_at | unknown | Yes | - | Timestamp |
| delivered_at | unknown | Yes | - | Timestamp |
| error | unknown | Yes | - | Data field |
| created_at | timestamp | No | - | Timestamp |
| updated_at | timestamp | No | - | Timestamp |

**Foreign Keys**:
- company_id → companies.id (undefined)
- recipient_id → recipients.id (undefined)

#### notifications

**Row Count**: 6 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| user_id | uuid | No | - | Foreign key reference |
| notification_type | varchar | No | - | Data field |
| title | varchar | No | - | Data field |
| message | varchar | No | - | Data field |
| priority | varchar | No | - | Data field |
| related_entity_type | varchar | No | - | Data field |
| related_entity_id | uuid | No | - | Foreign key reference |
| read_at | unknown | Yes | - | Timestamp |
| created_at | timestamp | No | - | Timestamp |
| tenant_id | unknown | Yes | - | Foreign key reference |

**Foreign Keys**:
- user_id → users.id (undefined)
- related_entity_id → related_entitys.id (undefined)
- tenant_id → tenants.id (undefined)

#### ocr_documents

**Row Count**: 1 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| company_id | varchar | No | - | Foreign key reference |
| ocr_job_id | uuid | No | - | Foreign key reference |
| file_path | varchar | No | - | Data field |
| page_count | integer | No | - | Numeric count |
| created_at | timestamp | No | - | Timestamp |

**Foreign Keys**:
- company_id → companies.id (undefined)
- ocr_job_id → ocr_jobs.id (undefined)

#### ocr_jobs

**Row Count**: 1 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| company_id | varchar | No | - | Foreign key reference |
| vendor_id | uuid | No | - | Foreign key reference |
| status | varchar | No | - | Current status/state |
| created_at | timestamp | No | - | Timestamp |
| completed_at | timestamp | No | - | Timestamp |

**Foreign Keys**:
- company_id → companies.id (undefined)
- vendor_id → vendors.id (undefined)

#### ocr_line_items

**Row Count**: 1 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| company_id | varchar | No | - | Foreign key reference |
| ocr_document_id | uuid | No | - | Foreign key reference |
| line_index | integer | No | - | Data field |
| sku | varchar | No | - | Data field |
| description | varchar | No | - | Detailed description |
| qty | integer | No | - | Data field |
| unit_price | integer | No | - | Monetary value |
| total | integer | No | - | Total/sum value |

**Foreign Keys**:
- company_id → companies.id (undefined)
- ocr_document_id → ocr_documents.id (undefined)

#### ocr_note_entities

**Row Count**: 1 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| ocr_document_id | uuid | No | - | Foreign key reference |
| label | varchar | No | - | Data field |
| value | varchar | No | - | Data field |
| tenant_id | unknown | Yes | - | Foreign key reference |

**Foreign Keys**:
- ocr_document_id → ocr_documents.id (undefined)
- tenant_id → tenants.id (undefined)

#### offline_queue

**Row Count**: 0 | **RLS**: Enabled

#### offline_sync_queue

**Row Count**: 0 | **RLS**: Enabled

#### overtime_records

**Row Count**: 0 | **RLS**: Enabled

#### payment_methods

**Row Count**: 0 | **RLS**: Enabled

#### payments

**Row Count**: 0 | **RLS**: Enabled

#### permissions

**Row Count**: 11 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| name | varchar | No | - | Display name |
| resource | varchar | No | - | Data field |
| action | varchar | No | - | Data field |
| description | varchar | No | - | Detailed description |
| voice_commands | array | No | - | Data field |
| requires_confirmation | boolean | No | - | Data field |
| risk_level | integer | No | - | Data field |
| created_at | timestamp | No | - | Timestamp |
| updated_at | timestamp | No | - | Timestamp |

#### profiles

**Row Count**: 0 | **RLS**: Enabled

#### properties

**Row Count**: 35 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| tenant_id | uuid | No | - | Foreign key reference |
| customer_id | uuid | No | - | Foreign key reference |
| property_number | varchar | No | - | Data field |
| name | varchar | No | - | Display name |
| address | jsonb | No | - | Physical address |
| location | unknown | Yes | - | Data field |
| property_type | varchar | Yes | - | Data field |
| size_sqft | unknown | Yes | - | Data field |
| lot_size_acres | unknown | Yes | - | Data field |
| zones | unknown | Yes | - | Data field |
| access_notes | unknown | Yes | - | User notes |
| gate_code | unknown | Yes | - | Data field |
| special_instructions | unknown | Yes | - | Data field |
| voice_navigation_notes | unknown | Yes | - | User notes |
| photos | array | No | - | Data field |
| is_active | boolean | No | - | Boolean flag |
| metadata | jsonb | No | - | Additional data |
| created_at | timestamp | No | - | Timestamp |
| updated_at | timestamp | No | - | Timestamp |
| intake_session_id | unknown | Yes | - | Foreign key reference |
| reference_image_id | unknown | Yes | - | Foreign key reference |

**Foreign Keys**:
- tenant_id → tenants.id (undefined)
- customer_id → customers.id (undefined)
- intake_session_id → intake_sessions.id (undefined)
- reference_image_id → reference_images.id (undefined)

#### property_access_codes

**Row Count**: 0 | **RLS**: Enabled

#### property_notes

**Row Count**: 0 | **RLS**: Enabled

#### property_zones

**Row Count**: 0 | **RLS**: Enabled

#### purchase_order_items

**Row Count**: 0 | **RLS**: Enabled

#### purchase_orders

**Row Count**: 0 | **RLS**: Enabled

#### purchase_receipts

**Row Count**: 0 | **RLS**: Enabled

#### push_tokens

**Row Count**: 0 | **RLS**: Enabled

#### quotes

**Row Count**: 0 | **RLS**: Enabled

#### receipts

**Row Count**: 0 | **RLS**: Enabled

#### recurring_schedules

**Row Count**: 0 | **RLS**: Enabled

#### request_deduplication

**Row Count**: 0 | **RLS**: Enabled

#### role_permissions

**Row Count**: 25 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| role | varchar | No | - | Data field |
| permission_id | uuid | No | - | Foreign key reference |
| tenant_id | unknown | Yes | - | Foreign key reference |
| granted_by | unknown | Yes | - | Data field |
| granted_at | timestamp | No | - | Timestamp |
| expires_at | unknown | Yes | - | Timestamp |
| is_active | boolean | No | - | Boolean flag |
| conditions | jsonb | No | - | Data field |

**Foreign Keys**:
- permission_id → permissions.id (undefined)
- tenant_id → tenants.id (undefined)

#### roles

**Row Count**: 0 | **RLS**: Enabled

#### route_history

**Row Count**: 0 | **RLS**: Enabled

#### route_optimizations

**Row Count**: 0 | **RLS**: Enabled

#### route_stops

**Row Count**: 0 | **RLS**: Enabled

#### routes

**Row Count**: 0 | **RLS**: Enabled

#### schedule_events

**Row Count**: 0 | **RLS**: Enabled

#### schedule_templates

**Row Count**: 0 | **RLS**: Enabled

#### schedules

**Row Count**: 0 | **RLS**: Enabled

#### service_history

**Row Count**: 0 | **RLS**: Enabled

#### service_tickets

**Row Count**: 0 | **RLS**: Enabled

#### settings

**Row Count**: 0 | **RLS**: Enabled

#### shift_patterns

**Row Count**: 0 | **RLS**: Enabled

#### sms_queue

**Row Count**: 0 | **RLS**: Enabled

#### storage_units

**Row Count**: 0 | **RLS**: Enabled

#### sync_logs

**Row Count**: 0 | **RLS**: Enabled

#### sync_queue

**Row Count**: 0 | **RLS**: Enabled

#### system_logs

**Row Count**: 0 | **RLS**: Enabled

#### tag_assignments

**Row Count**: 0 | **RLS**: Enabled

#### tags

**Row Count**: 0 | **RLS**: Enabled

#### team_members

**Row Count**: 0 | **RLS**: Enabled

#### teams

**Row Count**: 0 | **RLS**: Enabled

#### tenants

**Row Count**: 85 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| name | varchar | No | - | Display name |
| slug | varchar | No | - | Data field |
| created_at | timestamp | No | - | Timestamp |
| updated_at | timestamp | No | - | Timestamp |

#### time_clock_entries

**Row Count**: 0 | **RLS**: Enabled

#### time_entries

**Row Count**: 0 | **RLS**: Enabled

#### time_off_requests

**Row Count**: 0 | **RLS**: Enabled

#### training_data_records

**Row Count**: 0 | **RLS**: Enabled

#### transactions

**Row Count**: 0 | **RLS**: Enabled

#### user_permissions

**Row Count**: 0 | **RLS**: Enabled

#### user_roles

**Row Count**: 0 | **RLS**: Enabled

#### users

**Row Count**: 0 | **RLS**: Enabled

#### users_extended

**Row Count**: 29 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| tenant_id | uuid | No | - | Foreign key reference |
| role | varchar | No | - | Data field |
| display_name | unknown | Yes | - | Display name |
| first_name | unknown | Yes | - | Display name |
| last_name | unknown | Yes | - | Display name |
| phone | unknown | Yes | - | Phone number |
| avatar_url | unknown | Yes | - | Web URL |
| timezone | varchar | No | - | Data field |
| preferred_language | varchar | No | - | Data field |
| is_active | boolean | No | - | Boolean flag |
| email_verified_at | unknown | Yes | - | Timestamp |
| phone_verified_at | unknown | Yes | - | Timestamp |
| last_login_at | unknown | Yes | - | Timestamp |
| password_changed_at | timestamp | No | - | Timestamp |
| terms_accepted_at | unknown | Yes | - | Timestamp |
| privacy_policy_accepted_at | unknown | Yes | - | Timestamp |
| marketing_consent | boolean | No | - | Data field |
| two_factor_enabled | boolean | No | - | Data field |
| failed_login_attempts | integer | No | - | Data field |
| locked_until | unknown | Yes | - | Data field |
| metadata | jsonb | No | - | Additional data |
| created_at | timestamp | No | - | Timestamp |
| updated_at | timestamp | No | - | Timestamp |

**Foreign Keys**:
- tenant_id → tenants.id (undefined)

#### vendor_aliases

**Row Count**: 1 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| vendor_id | uuid | No | - | Foreign key reference |
| alias | varchar | No | - | Data field |
| tenant_id | unknown | Yes | - | Foreign key reference |

**Foreign Keys**:
- vendor_id → vendors.id (undefined)
- tenant_id → tenants.id (undefined)

#### vendor_contacts

**Row Count**: 0 | **RLS**: Enabled

#### vendor_invoices

**Row Count**: 0 | **RLS**: Enabled

#### vendor_locations

**Row Count**: 1 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| vendor_id | uuid | No | - | Foreign key reference |
| address | varchar | No | - | Physical address |
| city | varchar | No | - | Data field |
| state | varchar | No | - | Data field |
| postal_code | varchar | No | - | Data field |
| country | varchar | No | - | Numeric count |
| tenant_id | unknown | Yes | - | Foreign key reference |

**Foreign Keys**:
- vendor_id → vendors.id (undefined)
- tenant_id → tenants.id (undefined)

#### vendors

**Row Count**: 1 | **RLS**: Enabled

**Columns**:
| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | uuid | No | - | Primary identifier |
| name | varchar | No | - | Display name |
| is_active | boolean | No | - | Boolean flag |
| created_at | timestamp | No | - | Timestamp |
| updated_at | timestamp | No | - | Timestamp |
| intake_session_id | unknown | Yes | - | Foreign key reference |
| tenant_id | unknown | Yes | - | Foreign key reference |

**Foreign Keys**:
- intake_session_id → intake_sessions.id (undefined)
- tenant_id → tenants.id (undefined)

#### vision_confidence_config

**Row Count**: 0 | **RLS**: Enabled

#### vision_cost_records

**Row Count**: 0 | **RLS**: Enabled

#### vision_detected_items

**Row Count**: 0 | **RLS**: Enabled

#### vision_training_annotations

**Row Count**: 0 | **RLS**: Enabled

#### vision_verification_records

**Row Count**: 0 | **RLS**: Enabled

#### vision_verifications

**Row Count**: 0 | **RLS**: Enabled

#### voice_commands

**Row Count**: 0 | **RLS**: Enabled

#### voice_notes

**Row Count**: 0 | **RLS**: Enabled

#### voice_sessions

**Row Count**: 0 | **RLS**: Enabled

#### voice_transcripts

**Row Count**: 0 | **RLS**: Enabled

#### webhook_logs

**Row Count**: 0 | **RLS**: Enabled

#### webhooks

**Row Count**: 0 | **RLS**: Enabled

#### week_plans

**Row Count**: 0 | **RLS**: Enabled

#### work_orders

**Row Count**: 0 | **RLS**: Enabled

### 2.5 Orphaned Tables (127 total)

🧹 **Cleanup Candidates**: These tables have no relationships and no data:

- ai_cost_tracking
- ai_interaction_logs
- ai_models
- ai_prompts
- attachments
- audit_log_entries
- background_filter_preferences
- batch_operations
- billing_accounts
- break_logs
- calendar_events
- comments
- company_settings
- configurations
- container_assignments
- container_locations
- containers
- conversation_sessions
- crew_assignments
- crew_schedules
- customer_contacts
- customer_notes
- detected_items
- detection_confidence_thresholds
- device_registrations
- document_versions
- documents
- email_queue
- employee_schedules
- equipment_assignments
- equipment_locations
- estimates
- export_jobs
- feature_flags
- import_jobs
- intent_classifications
- intent_recognitions
- inventory_items
- inventory_locations
- inventory_transactions
- invoice_items
- irrigation_history
- irrigation_maintenance
- irrigation_runs
- irrigation_schedules
- irrigation_systems
- irrigation_zones
- item_relationships
- job_assignments
- job_checklist_items
- job_equipment
- job_kits
- job_materials
- job_notes
- job_status_history
- job_templates
- kit_override_logs
- maintenance_logs
- maintenance_schedules
- material_inventory
- material_usage
- materials
- media_assets
- media_metadata
- mobile_sessions
- notes
- notification_history
- notification_preferences
- offline_queue
- offline_sync_queue
- overtime_records
- payment_methods
- payments
- profiles
- property_access_codes
- property_notes
- property_zones
- purchase_order_items
- purchase_orders
- purchase_receipts
- push_tokens
- quotes
- receipts
- recurring_schedules
- request_deduplication
- route_history
- route_optimizations
- route_stops
- routes
- schedule_events
- schedule_templates
- schedules
- service_history
- service_tickets
- settings
- shift_patterns
- sms_queue
- storage_units
- sync_logs
- sync_queue
- system_logs
- tag_assignments
- tags
- team_members
- teams
- time_clock_entries
- time_entries
- time_off_requests
- training_data_records
- transactions
- user_permissions
- user_roles
- vendor_contacts
- vendor_invoices
- vision_confidence_config
- vision_cost_records
- vision_detected_items
- vision_training_annotations
- vision_verification_records
- vision_verifications
- voice_commands
- voice_notes
- voice_transcripts
- webhook_logs
- webhooks
- week_plans
- work_orders

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

- Review 131 empty tables for potential removal
- Investigate 131 tables without clear primary keys: ai_cost_tracking, ai_interaction_logs, ai_models, ai_prompts, attachments

### 4.2 Storage Recommendations

- Remove 4 unused buckets: verification-photos, job-photos, voice-recordings, equipment-images
- Add RLS policies to 4 buckets without access control

### 4.3 Priority Actions

3. **Clean up 131 unused resources** - Free up space and reduce clutter

## Appendices
### A.1 API Endpoint Mapping Guide

Based on the analysis, here are suggested API endpoints for each major table:

**notification_queue**:
- GET /api/notification_queue - List all notification_queue
- GET /api/notification_queue/:id - Get single notification_queue
- POST /api/notification_queue - Create new notification_queue
- PUT /api/notification_queue/:id - Update notification_queue
- DELETE /api/notification_queue/:id - Delete notification_queue
- Filters: ?company_id=value, ?recipient_id=value

**customers**:
- GET /api/customers - List all customers
- GET /api/customers/:id - Get single customer
- POST /api/customers - Create new customer
- PUT /api/customers/:id - Update customer
- DELETE /api/customers/:id - Delete customer
- Filters: ?tenant_id=value, ?intake_session_id=value

**tenants**:
- GET /api/tenants - List all tenants
- GET /api/tenants/:id - Get single tenant
- POST /api/tenants - Create new tenant
- PUT /api/tenants/:id - Update tenant
- DELETE /api/tenants/:id - Delete tenant

**invoices**:
- GET /api/invoices - List all invoices
- GET /api/invoices/:id - Get single invoic
- POST /api/invoices - Create new invoic
- PUT /api/invoices/:id - Update invoic
- DELETE /api/invoices/:id - Delete invoic
- Filters: ?tenant_id=value, ?customer_id=value, ?job_id=value

**jobs**:
- GET /api/jobs - List all jobs
- GET /api/jobs/:id - Get single job
- POST /api/jobs - Create new job
- PUT /api/jobs/:id - Update job
- DELETE /api/jobs/:id - Delete job
- Filters: ?tenant_id=value, ?template_id=value, ?customer_id=value, ?property_id=value, ?voice_session_id=value, ?arrival_photo_id=value

**properties**:
- GET /api/properties - List all properties
- GET /api/properties/:id - Get single property
- POST /api/properties - Create new property
- PUT /api/properties/:id - Update property
- DELETE /api/properties/:id - Delete property
- Filters: ?tenant_id=value, ?customer_id=value, ?intake_session_id=value, ?reference_image_id=value

**equipment_maintenance**:
- GET /api/equipment_maintenance - List all equipment_maintenance
- GET /api/equipment_maintenance/:id - Get single equipment_maintenance
- POST /api/equipment_maintenance - Create new equipment_maintenance
- PUT /api/equipment_maintenance/:id - Update equipment_maintenance
- DELETE /api/equipment_maintenance/:id - Delete equipment_maintenance
- Filters: ?equipment_id=value, ?pre_maintenance_verification_id=value, ?post_maintenance_verification_id=value, ?tenant_id=value

**users_extended**:
- GET /api/users_extended - List all users_extended
- GET /api/users_extended/:id - Get single users_extended
- POST /api/users_extended - Create new users_extended
- PUT /api/users_extended/:id - Update users_extended
- DELETE /api/users_extended/:id - Delete users_extended
- Filters: ?tenant_id=value

**role_permissions**:
- GET /api/role_permissions - List all role_permissions
- GET /api/role_permissions/:id - Get single role_permission
- POST /api/role_permissions - Create new role_permission
- PUT /api/role_permissions/:id - Update role_permission
- DELETE /api/role_permissions/:id - Delete role_permission
- Filters: ?permission_id=value, ?tenant_id=value

**kit_items**:
- GET /api/kit_items - List all kit_items
- GET /api/kit_items/:id - Get single kit_item
- POST /api/kit_items - Create new kit_item
- PUT /api/kit_items/:id - Update kit_item
- DELETE /api/kit_items/:id - Delete kit_item
- Filters: ?tenant_id=value, ?kit_id=value

**audit_logs**:
- GET /api/audit_logs - List all audit_logs
- GET /api/audit_logs/:id - Get single audit_log
- POST /api/audit_logs - Create new audit_log
- PUT /api/audit_logs/:id - Update audit_log
- DELETE /api/audit_logs/:id - Delete audit_log
- Filters: ?tenant_id=value, ?entity_id=value

**permissions**:
- GET /api/permissions - List all permissions
- GET /api/permissions/:id - Get single permission
- POST /api/permissions - Create new permission
- PUT /api/permissions/:id - Update permission
- DELETE /api/permissions/:id - Delete permission

**kits**:
- GET /api/kits - List all kits
- GET /api/kits/:id - Get single kit
- POST /api/kits - Create new kit
- PUT /api/kits/:id - Update kit
- DELETE /api/kits/:id - Delete kit
- Filters: ?tenant_id=value

**notifications**:
- GET /api/notifications - List all notifications
- GET /api/notifications/:id - Get single notification
- POST /api/notifications - Create new notification
- PUT /api/notifications/:id - Update notification
- DELETE /api/notifications/:id - Delete notification
- Filters: ?user_id=value, ?related_entity_id=value, ?tenant_id=value

**companies**:
- GET /api/companies - List all companies
- GET /api/companies/:id - Get single company
- POST /api/companies - Create new company
- PUT /api/companies/:id - Update company
- DELETE /api/companies/:id - Delete company
- Filters: ?tenant_id=value

**day_plans**:
- GET /api/day_plans - List all day_plans
- GET /api/day_plans/:id - Get single day_plan
- POST /api/day_plans - Create new day_plan
- PUT /api/day_plans/:id - Update day_plan
- DELETE /api/day_plans/:id - Delete day_plan
- Filters: ?company_id=value, ?user_id=value, ?voice_session_id=value

**kit_variants**:
- GET /api/kit_variants - List all kit_variants
- GET /api/kit_variants/:id - Get single kit_variant
- POST /api/kit_variants - Create new kit_variant
- PUT /api/kit_variants/:id - Update kit_variant
- DELETE /api/kit_variants/:id - Delete kit_variant
- Filters: ?tenant_id=value, ?kit_id=value

**inventory_images**:
- GET /api/inventory_images - List all inventory_images
- GET /api/inventory_images/:id - Get single inventory_imag
- POST /api/inventory_images - Create new inventory_imag
- PUT /api/inventory_images/:id - Update inventory_imag
- DELETE /api/inventory_images/:id - Delete inventory_imag
- Filters: ?company_id=value, ?media_id=value

**kit_assignments**:
- GET /api/kit_assignments - List all kit_assignments
- GET /api/kit_assignments/:id - Get single kit_assignment
- POST /api/kit_assignments - Create new kit_assignment
- PUT /api/kit_assignments/:id - Update kit_assignment
- DELETE /api/kit_assignments/:id - Delete kit_assignment
- Filters: ?kit_id=value, ?variant_id=value, ?tenant_id=value

**ocr_documents**:
- GET /api/ocr_documents - List all ocr_documents
- GET /api/ocr_documents/:id - Get single ocr_document
- POST /api/ocr_documents - Create new ocr_document
- PUT /api/ocr_documents/:id - Update ocr_document
- DELETE /api/ocr_documents/:id - Delete ocr_document
- Filters: ?company_id=value, ?ocr_job_id=value

### A.2 Cleanup Script Template

```typescript
// Cleanup script for orphaned tables and unused resources
import { createClient } from "@supabase/supabase-js";

const client = createClient(url, serviceKey);

// Remove orphaned tables
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS ai_cost_tracking;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS ai_interaction_logs;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS ai_models;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS ai_prompts;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS attachments;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS audit_log_entries;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS background_filter_preferences;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS batch_operations;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS billing_accounts;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS break_logs;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS calendar_events;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS comments;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS company_settings;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS configurations;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS container_assignments;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS container_locations;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS containers;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS conversation_sessions;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS crew_assignments;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS crew_schedules;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS customer_contacts;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS customer_notes;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS detected_items;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS detection_confidence_thresholds;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS device_registrations;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS document_versions;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS documents;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS email_queue;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS employee_schedules;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS equipment_assignments;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS equipment_locations;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS estimates;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS export_jobs;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS feature_flags;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS import_jobs;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS intent_classifications;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS intent_recognitions;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS inventory_items;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS inventory_locations;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS inventory_transactions;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS invoice_items;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS irrigation_history;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS irrigation_maintenance;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS irrigation_runs;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS irrigation_schedules;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS irrigation_systems;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS irrigation_zones;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS item_relationships;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS job_assignments;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS job_checklist_items;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS job_equipment;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS job_kits;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS job_materials;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS job_notes;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS job_status_history;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS job_templates;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS kit_override_logs;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS maintenance_logs;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS maintenance_schedules;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS material_inventory;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS material_usage;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS materials;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS media_assets;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS media_metadata;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS mobile_sessions;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS notes;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS notification_history;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS notification_preferences;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS offline_queue;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS offline_sync_queue;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS overtime_records;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS payment_methods;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS payments;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS profiles;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS property_access_codes;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS property_notes;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS property_zones;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS purchase_order_items;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS purchase_orders;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS purchase_receipts;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS push_tokens;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS quotes;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS receipts;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS recurring_schedules;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS request_deduplication;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS route_history;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS route_optimizations;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS route_stops;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS routes;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS schedule_events;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS schedule_templates;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS schedules;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS service_history;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS service_tickets;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS settings;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS shift_patterns;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS sms_queue;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS storage_units;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS sync_logs;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS sync_queue;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS system_logs;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS tag_assignments;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS tags;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS team_members;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS teams;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS time_clock_entries;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS time_entries;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS time_off_requests;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS training_data_records;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS transactions;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS user_permissions;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS user_roles;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS vendor_contacts;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS vendor_invoices;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS vision_confidence_config;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS vision_cost_records;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS vision_detected_items;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS vision_training_annotations;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS vision_verification_records;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS vision_verifications;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS voice_commands;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS voice_notes;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS voice_transcripts;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS webhook_logs;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS webhooks;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS week_plans;" });
// await client.rpc("exec_sql", { sql: "DROP TABLE IF EXISTS work_orders;" });

// Remove empty buckets
// await client.storage.deleteBucket("verification-photos");
// await client.storage.deleteBucket("job-photos");
// await client.storage.deleteBucket("voice-recordings");
// await client.storage.deleteBucket("equipment-images");
```