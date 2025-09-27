# JobEye v4 Blueprint Migration Order

Run these migrations in the following order to set up the complete v4 database schema:

## Prerequisites
- Existing auth tables (auth_audit_log, tenant_assignments, user_permissions, etc.)
- Existing tenants table
- Existing users_extended table
- PostgreSQL extensions: uuid-ossp, postgis

## Migration Order

1. **001_v4_core_business_tables.sql**
   - Creates core business entities: customers, properties, jobs, job_templates, equipment, materials
   - Establishes foundation for field service management

2. **002_v4_voice_vision_media_tables.sql**
   - Creates voice interaction tables: voice_transcripts, intent_recognitions
   - Creates media handling: media_assets, vision_verifications
   - Creates conversation tracking: conversation_sessions, request_deduplication
   - Adds AI cost tracking

3. **003_v4_irrigation_and_specialized_tables.sql**
   - Creates irrigation system tables: irrigation_systems, zones, schedules, runs
   - Adds service history tracking
   - Adds time entry management
   - Creates route planning tables

4. **004_v4_storage_buckets_and_functions.sql**
   - Documents required storage buckets
   - Creates helper functions for permissions, voice commands, irrigation control
   - Creates useful views for common queries

## Post-Migration Steps

1. Create storage buckets via Supabase dashboard:
   - job-photos (public)
   - voice-recordings (private)
   - equipment-images (public)
   - documents (private)
   - profile-avatars (public)

2. Enable required PostgreSQL extensions if not already enabled:
   ```sql
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS "postgis";
   ```

3. Verify RLS policies are working correctly by testing with different user roles

4. Consider enabling pg_cron for scheduled cleanup tasks (optional)

## Rollback
To rollback, drop tables in reverse order due to foreign key constraints.