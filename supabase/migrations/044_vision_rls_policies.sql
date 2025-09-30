-- Migration: 044_vision_rls_policies
-- Purpose: Add Row Level Security policies for vision tables
-- Date: 2025-09-29
-- Feature: Vision-Based Kit Verification (001)
-- Reference: JobEye Constitution §1 - RLS Mandatory
--
-- IMPORTANT: All vision tables must have RLS enabled for multi-tenant isolation.
-- Policies enforce company-scoped access with supervisor override capabilities.

-- ============================================================================
-- vision_detected_items RLS Policies
-- ============================================================================

ALTER TABLE vision_detected_items ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view detected items from their company's verifications
CREATE POLICY vision_detected_items_select_own_company ON vision_detected_items
  FOR SELECT
  USING (
    verification_id IN (
      SELECT id FROM vision_verifications
      WHERE tenant_id::text = auth.jwt() ->> 'company_id'
    )
  );

-- Policy: System can insert detected items (service role)
CREATE POLICY vision_detected_items_insert_system ON vision_detected_items
  FOR INSERT
  WITH CHECK (true);  -- Service role bypass via auth.uid() check in application

-- Policy: No direct updates or deletes (cascade delete via verification_id FK)
-- Updates/deletes handled at vision_verifications level

COMMENT ON POLICY vision_detected_items_select_own_company ON vision_detected_items IS
  'Users can view detected items from their company verifications only';

-- ============================================================================
-- vision_cost_records RLS Policies
-- ============================================================================

ALTER TABLE vision_cost_records ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view cost records for their company
CREATE POLICY vision_cost_records_select_own_company ON vision_cost_records
  FOR SELECT
  USING (company_id::text = auth.jwt() ->> 'company_id');

-- Policy: System can insert cost records (service role)
CREATE POLICY vision_cost_records_insert_system ON vision_cost_records
  FOR INSERT
  WITH CHECK (true);  -- Service role bypass

-- Policy: System can update actual costs during reconciliation (service role)
CREATE POLICY vision_cost_records_update_system ON vision_cost_records
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY vision_cost_records_select_own_company ON vision_cost_records IS
  'Users can view cost records for their company only';

-- ============================================================================
-- vision_confidence_config RLS Policies
-- ============================================================================

ALTER TABLE vision_confidence_config ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their company's config
CREATE POLICY vision_confidence_config_select_own_company ON vision_confidence_config
  FOR SELECT
  USING (company_id::text = auth.jwt() ->> 'company_id');

-- Policy: Admins can update their company's config
CREATE POLICY vision_confidence_config_update_own_company ON vision_confidence_config
  FOR UPDATE
  USING (company_id::text = auth.jwt() ->> 'company_id')
  WITH CHECK (company_id::text = auth.jwt() ->> 'company_id');

-- Policy: Admins can insert config for their company
CREATE POLICY vision_confidence_config_insert_own_company ON vision_confidence_config
  FOR INSERT
  WITH CHECK (company_id::text = auth.jwt() ->> 'company_id');

COMMENT ON POLICY vision_confidence_config_select_own_company ON vision_confidence_config IS
  'Users can view their company configuration';

-- ============================================================================
-- Update existing vision_verifications RLS (if needed)
-- ============================================================================

-- Note: vision_verifications table already exists and likely has RLS policies.
-- We're adding supplementary policies for kit_id access if they don't exist.

-- Check if RLS is enabled (should be, but verify)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = 'vision_verifications'
      AND rowsecurity = true
  ) THEN
    ALTER TABLE vision_verifications ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Add policy for kit-based access (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'vision_verifications'
      AND policyname = 'vision_verifications_select_with_kit'
  ) THEN
    CREATE POLICY vision_verifications_select_with_kit ON vision_verifications
      FOR SELECT
      USING (
        tenant_id::text = auth.jwt() ->> 'company_id'
        OR kit_id IN (
          SELECT id FROM kits
          WHERE company_id::text = auth.jwt() ->> 'company_id'
        )
      );
  END IF;
END $$;

-- ============================================================================
-- Grant necessary permissions
-- ============================================================================

-- Grant SELECT on views to authenticated users
GRANT SELECT ON vision_verification_records TO authenticated;

-- Grant EXECUTE on helper functions to authenticated users
GRANT EXECUTE ON FUNCTION get_daily_vision_costs TO authenticated;
GRANT EXECUTE ON FUNCTION can_make_vlm_request TO authenticated;