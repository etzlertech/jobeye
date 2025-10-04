-- Remove orphaned tables identified in Feature 009 cleanup
-- These tables have no data and minimal/no code references
-- Verified empty on 2025-10-03

-- 1. Duplicate inventory tracking (use repository_inventory instead)
DROP TABLE IF EXISTS table_inventory CASCADE;

-- 2. Unused migration tracking (Supabase does not use this)
DROP TABLE IF EXISTS migration_tracking CASCADE;

-- 3. Unimplemented features
DROP TABLE IF EXISTS background_filter_preferences CASCADE;
DROP TABLE IF EXISTS offline_sync_queue CASCADE;
DROP TABLE IF EXISTS service_history CASCADE;
DROP TABLE IF EXISTS time_entries CASCADE;

-- 4. Unimplemented scheduling/routing features
DROP TABLE IF EXISTS load_verifications CASCADE;
DROP TABLE IF EXISTS route_stops CASCADE;
DROP TABLE IF EXISTS routes CASCADE;

-- Log completion (non-destructive)
DO $$
BEGIN
  RAISE NOTICE 'Removed 9 orphaned tables as part of Feature 009 cleanup';
END $$;