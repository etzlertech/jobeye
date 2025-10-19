-- Migration: Drop job_checklist_items table
-- Date: 2025-10-19
-- Purpose: Remove legacy job_checklist_items table - replaced by item_transactions
--
-- Context:
-- - job_checklist_items was used to track items assigned to jobs
-- - Replaced by item_transactions as the single source of truth
-- - All API routes and services updated to use item_transactions
-- - This migration completes the removal of the legacy system

-- Drop dependent policies first
DROP POLICY IF EXISTS "Users can view checklist items for their assigned jobs" ON job_checklist_items;
DROP POLICY IF EXISTS "Service role can manage all checklist items" ON job_checklist_items;
DROP POLICY IF EXISTS "Users can update checklist items for their assigned jobs" ON job_checklist_items;

-- Drop indexes
DROP INDEX IF EXISTS idx_job_checklist_items_job_id;
DROP INDEX IF EXISTS idx_job_checklist_items_item_id;
DROP INDEX IF EXISTS idx_job_checklist_items_status;

-- Drop the table
DROP TABLE IF EXISTS job_checklist_items;

-- Confirmation
COMMENT ON SCHEMA public IS 'job_checklist_items table dropped - using item_transactions instead';
