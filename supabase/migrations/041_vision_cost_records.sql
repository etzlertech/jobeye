-- Migration: 041_vision_cost_records
-- Purpose: Create table for detailed VLM cost tracking and budget enforcement
-- Date: 2025-09-29
-- Feature: Vision-Based Kit Verification (001)
-- Reference: DB_PRECHECK_FINDINGS.md - Option A (extend existing schema)
--
-- IMPORTANT: This complements vision_verifications.ai_cost (single value)
-- by providing detailed per-request cost tracking for budget enforcement.

-- Create vision_cost_records table
CREATE TABLE IF NOT EXISTS vision_cost_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL,  -- Using UUID for consistency with media_assets
  verification_id UUID NOT NULL REFERENCES vision_verifications(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,  -- 'openai', 'anthropic', 'google', etc.
  operation_type TEXT NOT NULL,  -- 'vlm_analysis', 'yolo_inference', 'image_upload', etc.
  estimated_cost_usd DECIMAL(6,4) NOT NULL CHECK (estimated_cost_usd >= 0),  -- e.g., 0.1000
  actual_cost_usd DECIMAL(6,4) CHECK (actual_cost_usd >= 0),  -- Populated after billing reconciliation
  request_timestamp TIMESTAMPTZ DEFAULT NOW(),
  response_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for cost queries and budget enforcement
CREATE INDEX IF NOT EXISTS idx_vision_costs_company_date ON vision_cost_records(company_id, DATE(created_at));
CREATE INDEX IF NOT EXISTS idx_vision_costs_verification ON vision_cost_records(verification_id);
CREATE INDEX IF NOT EXISTS idx_vision_costs_provider ON vision_cost_records(provider, created_at);

-- Add helpful comments
COMMENT ON TABLE vision_cost_records IS 'Detailed cost tracking for VLM operations, enables $10/day budget enforcement';
COMMENT ON COLUMN vision_cost_records.estimated_cost_usd IS 'Estimated cost before request (for budget checks)';
COMMENT ON COLUMN vision_cost_records.actual_cost_usd IS 'Actual cost from provider billing (reconciled later)';

-- Create function to calculate daily company costs (for budget enforcement)
CREATE OR REPLACE FUNCTION get_daily_vision_costs(p_company_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  total_estimated_usd DECIMAL(10,2),
  total_actual_usd DECIMAL(10,2),
  request_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(estimated_cost_usd), 0)::DECIMAL(10,2) as total_estimated_usd,
    COALESCE(SUM(actual_cost_usd), 0)::DECIMAL(10,2) as total_actual_usd,
    COUNT(*) as request_count
  FROM vision_cost_records
  WHERE company_id = p_company_id
    AND DATE(created_at) = p_date;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_daily_vision_costs IS 'Calculate total vision costs for a company on a specific date, used for $10/day budget enforcement';