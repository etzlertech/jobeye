-- Migration: 042_vision_confidence_config
-- Purpose: Create table for company-specific vision detection thresholds and budgets
-- Date: 2025-09-29
-- Feature: Vision-Based Kit Verification (001)
-- Reference: spec.md - 70% confidence threshold, $10/day budget cap
--
-- This table stores per-company configuration for:
-- - When to escalate from local YOLO to cloud VLM (confidence threshold)
-- - Daily budget limits for cloud VLM usage
-- - Maximum VLM requests per day

-- Create vision_confidence_config table
CREATE TABLE IF NOT EXISTS vision_confidence_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL UNIQUE,  -- One config per company
  confidence_threshold DECIMAL(3,2) NOT NULL DEFAULT 0.70
    CHECK (confidence_threshold BETWEEN 0.50 AND 0.95),
  max_daily_vlm_requests INTEGER NOT NULL DEFAULT 100
    CHECK (max_daily_vlm_requests > 0),
  daily_budget_usd DECIMAL(6,2) NOT NULL DEFAULT 10.00
    CHECK (daily_budget_usd > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_vision_config_company ON vision_confidence_config(company_id);

-- Add helpful comments
COMMENT ON TABLE vision_confidence_config IS 'Company-specific vision detection configuration: thresholds, budgets, and limits';
COMMENT ON COLUMN vision_confidence_config.confidence_threshold IS 'YOLO confidence below this triggers VLM fallback (default: 0.70)';
COMMENT ON COLUMN vision_confidence_config.max_daily_vlm_requests IS 'Maximum VLM requests per day before blocking (default: 100)';
COMMENT ON COLUMN vision_confidence_config.daily_budget_usd IS 'Daily budget cap for VLM costs (default: $10.00)';

-- Create function to check if company can make VLM request
CREATE OR REPLACE FUNCTION can_make_vlm_request(p_company_id UUID, p_estimated_cost DECIMAL(6,4) DEFAULT 0.10)
RETURNS TABLE (
  allowed BOOLEAN,
  reason TEXT,
  current_cost_usd DECIMAL(10,2),
  budget_usd DECIMAL(6,2),
  request_count BIGINT,
  max_requests INTEGER
) AS $$
DECLARE
  v_config RECORD;
  v_daily_costs RECORD;
BEGIN
  -- Get company config (or use defaults)
  SELECT * INTO v_config
  FROM vision_confidence_config
  WHERE company_id = p_company_id;

  IF NOT FOUND THEN
    -- Use default values if no config exists
    v_config.daily_budget_usd := 10.00;
    v_config.max_daily_vlm_requests := 100;
  END IF;

  -- Get today's costs
  SELECT * INTO v_daily_costs
  FROM get_daily_vision_costs(p_company_id, CURRENT_DATE);

  -- Check budget
  IF (v_daily_costs.total_estimated_usd + p_estimated_cost) > v_config.daily_budget_usd THEN
    RETURN QUERY SELECT
      FALSE,
      'Daily budget exceeded'::TEXT,
      v_daily_costs.total_estimated_usd,
      v_config.daily_budget_usd,
      v_daily_costs.request_count,
      v_config.max_daily_vlm_requests;
    RETURN;
  END IF;

  -- Check request count
  IF v_daily_costs.request_count >= v_config.max_daily_vlm_requests THEN
    RETURN QUERY SELECT
      FALSE,
      'Daily request limit exceeded'::TEXT,
      v_daily_costs.total_estimated_usd,
      v_config.daily_budget_usd,
      v_daily_costs.request_count,
      v_config.max_daily_vlm_requests;
    RETURN;
  END IF;

  -- Allow request
  RETURN QUERY SELECT
    TRUE,
    'OK'::TEXT,
    v_daily_costs.total_estimated_usd,
    v_config.daily_budget_usd,
    v_daily_costs.request_count,
    v_config.max_daily_vlm_requests;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION can_make_vlm_request IS 'Check if company can make VLM request based on budget and request limits';

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_vision_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER vision_config_updated
  BEFORE UPDATE ON vision_confidence_config
  FOR EACH ROW
  EXECUTE FUNCTION update_vision_config_timestamp();