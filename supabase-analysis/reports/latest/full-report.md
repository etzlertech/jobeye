# Supabase Live Database Analysis Report

Generated: 2025-10-03T20:55:00.409Z
Database: https://rtwigjwqufozqfwozpvo.supabase.co

## Executive Summary

### Database Overview
- **Total Tables**: 69
- **Total Rows**: 10,945
- **Database Size**: 0 B
- **Tables with Data**: 46
- **Empty Tables**: 23

### Storage Overview
- **Total Buckets**: 4
- **Total Files**: 0
- **Total Size**: 0 Bytes
- **Public Buckets**: 2
- **Empty Buckets**: 4

## Database Tables

### Tables by Row Count

| Table Name | Row Count | RLS Enabled | Has Primary Key |
|------------|-----------|-------------|-----------------|
| spatial_ref_sys | 8,500 | ❌ | ❌ |
| gps_tracking_records | 1,046 | ❌ | ❌ |
| code_pattern_violations | 277 | ❌ | ❌ |
| notification_queue | 209 | ❌ | ❌ |
| auth_audit_log | 140 | ❌ | ❌ |
| customers | 88 | ❌ | ❌ |
| tenants | 85 | ❌ | ❌ |
| invoices | 77 | ❌ | ❌ |
| jobs | 50 | ❌ | ❌ |
| equipment_incidents | 36 | ❌ | ❌ |
| training_sessions | 36 | ❌ | ❌ |
| properties | 35 | ❌ | ❌ |
| active_jobs_view | 34 | ❌ | ❌ |
| equipment_maintenance | 33 | ❌ | ❌ |
| maintenance_schedule | 33 | ❌ | ❌ |
| training_certificates | 33 | ❌ | ❌ |
| users_extended | 29 | ❌ | ❌ |
| repository_inventory | 28 | ❌ | ❌ |
| role_permissions | 25 | ❌ | ❌ |
| user_activity_logs | 22 | ❌ | ❌ |


### Empty Tables (23)

- conflict_logs
- dev_manifest_history
- geofence_events
- geofences
- geometry_columns
- intake_documents
- intake_requests
- item_availability
- item_transactions
- items
- maintenance_tickets
- mfa_challenges
- mfa_settings
- migration_tracking
- safety_checklist_completions
- safety_checklists
- table_inventory
- tenant_assignments
- user_assignments
- user_invitations
- user_sessions
- voice_profiles
- workflow_tasks

## Storage Buckets

| Bucket Name | Files | Total Size | Public |
|-------------|-------|------------|--------|
| verification-photos | undefined | 0 Bytes | ❌ |
| job-photos | undefined | 0 Bytes | ✅ |
| voice-recordings | undefined | 0 Bytes | ❌ |
| equipment-images | undefined | 0 Bytes | ✅ |


## Recommendations

1. Review 23 empty tables for potential removal
2. Add primary keys to 46 tables: spatial_ref_sys, gps_tracking_records, code_pattern_violations, notification_queue, auth_audit_log...
3. Enable RLS on 46 tables containing data

## Next Steps

1. **Database Cleanup**:
   - Review and potentially remove 23 empty tables
   - Enable RLS on tables containing sensitive data

2. **Performance**:
   - Add primary keys to tables without them
   - Consider indexes for frequently queried columns

3. **Security**:
   - Enable RLS on all production tables
   - Review public storage buckets for sensitive content

4. **Monitoring**:
   - Set up alerts for table growth
   - Monitor storage usage trends
