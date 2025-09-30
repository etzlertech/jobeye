#!/usr/bin/env npx tsx
/**
 * Apply vision_cost_records migration with fixed index
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function applyFixedMigration() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔧 Applying vision_cost_records migration (fixed)...\n');

  // Fixed SQL - removed DATE() function from index, use created_at directly
  const fixedSql = `
-- Create vision_cost_records table
CREATE TABLE IF NOT EXISTS vision_cost_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL,
  verification_id UUID NOT NULL REFERENCES vision_verifications(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  estimated_cost_usd DECIMAL(6,4) NOT NULL CHECK (estimated_cost_usd >= 0),
  actual_cost_usd DECIMAL(6,4) CHECK (actual_cost_usd >= 0),
  request_timestamp TIMESTAMPTZ DEFAULT NOW(),
  response_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes (FIXED: removed DATE() function from index)
CREATE INDEX IF NOT EXISTS idx_vision_costs_company_date ON vision_cost_records(company_id, created_at);
CREATE INDEX IF NOT EXISTS idx_vision_costs_verification ON vision_cost_records(verification_id);
CREATE INDEX IF NOT EXISTS idx_vision_costs_provider ON vision_cost_records(provider, created_at);

-- Add helpful comments
COMMENT ON TABLE vision_cost_records IS 'Detailed cost tracking for VLM operations, enables $10/day budget enforcement';
COMMENT ON COLUMN vision_cost_records.estimated_cost_usd IS 'Estimated cost before request (for budget checks)';
COMMENT ON COLUMN vision_cost_records.actual_cost_usd IS 'Actual cost from provider billing (reconciled later)';

-- Create function to calculate daily company costs
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
`;

  const { error } = await client.rpc('exec_sql', { sql: fixedSql });

  if (error) {
    console.error('❌ Failed:', error.message);
    console.error('Details:', error);
    process.exit(1);
  }

  console.log('✅ vision_cost_records table created successfully!\n');

  // Verify
  const { error: verifyError } = await client
    .from('vision_cost_records')
    .select('count')
    .limit(0);

  if (verifyError) {
    console.error('❌ Verification failed:', verifyError.message);
    process.exit(1);
  }

  console.log('✅ Table verified accessible\n');
  console.log('🎉 Migration complete!');
}

applyFixedMigration().catch(console.error);