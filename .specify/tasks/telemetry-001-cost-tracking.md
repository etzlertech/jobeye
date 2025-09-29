# Task: AI Cost Tracking Service

**Slug:** `telemetry-001-cost-tracking`
**Priority:** High
**Size:** 1 PR

## Description
Implement cost tracking for all AI operations (STT, TTS, VLM, LLM) with hierarchical reporting.

## Files to Create
- `supabase/migrations/013_ai_cost_tracking.sql`
- `src/domains/telemetry/services/cost-tracking-service.ts`
- `src/domains/telemetry/models/cost-record.ts`

## Files to Modify
- `src/domains/vision/services/multi-object-vision-service.ts` - Add cost tracking
- `src/domains/voice/services/stt-service.ts` - Track costs

## Acceptance Criteria
- [ ] Records cost for every AI operation
- [ ] Tracks company/job/user hierarchy
- [ ] Enforces daily budget limits
- [ ] Provides real-time budget status
- [ ] Supports cost drill-down queries
- [ ] Alerts at 80% and 100% budget

## Test Files
**Create:** `src/__tests__/domains/telemetry/services/cost-tracking-service.test.ts`

Test cases:
- `records operation cost`
  - Track VLM operation at $0.10
  - Assert record created
  - Assert hierarchy captured
  - Assert running total updated
  
- `enforces daily budgets`
  - Set VLM budget to $1.00
  - Track 10 operations at $0.10
  - Assert 11th operation blocked
  - Assert error returned
  
- `provides drill-down`
  - Track costs across 3 jobs
  - Query by job
  - Assert correct totals
  - Assert user breakdown available
  
- `alerts at thresholds`
  - Set budget to $10
  - Track $8 worth
  - Assert 80% alert fired
  - Track $2 more
  - Assert 100% alert fired

## Dependencies
- Existing: company_settings for budgets

## Database Schema
```sql
-- Migration: 013_ai_cost_tracking.sql
CREATE TABLE ai_cost_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  job_id UUID REFERENCES jobs(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  -- Operation details
  service_type TEXT NOT NULL CHECK (service_type IN ('stt', 'tts', 'vlm', 'llm', 'yolo')),
  operation_type TEXT NOT NULL, -- 'transcribe', 'synthesize', 'analyze', etc.
  model_name TEXT,
  
  -- Cost information
  estimated_cost DECIMAL(10,4) NOT NULL,
  actual_cost DECIMAL(10,4),
  units_consumed INTEGER, -- tokens, seconds, images
  unit_type TEXT, -- 'tokens', 'seconds', 'images'
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily aggregates for performance
CREATE TABLE ai_cost_daily_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id),
  date DATE NOT NULL,
  service_type TEXT NOT NULL,
  
  total_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  operation_count INTEGER NOT NULL DEFAULT 0,
  budget_limit DECIMAL(10,2),
  
  UNIQUE(company_id, date, service_type)
);

-- RLS policies
ALTER TABLE ai_cost_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_cost_daily_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_costs_tenant_isolation" ON ai_cost_records
  FOR ALL USING (company_id = auth.jwt() ->> 'company_id');
  
CREATE POLICY "ai_summary_tenant_isolation" ON ai_cost_daily_summary
  FOR ALL USING (company_id = auth.jwt() ->> 'company_id');

-- Function to check budget
CREATE OR REPLACE FUNCTION check_ai_budget(
  p_company_id UUID,
  p_service_type TEXT,
  p_estimated_cost DECIMAL
) RETURNS JSONB AS $$
DECLARE
  v_daily_total DECIMAL;
  v_budget_limit DECIMAL;
  v_remaining DECIMAL;
BEGIN
  -- Get current daily total
  SELECT COALESCE(total_cost, 0)
  INTO v_daily_total
  FROM ai_cost_daily_summary
  WHERE company_id = p_company_id
    AND date = CURRENT_DATE
    AND service_type = p_service_type;
    
  -- Get budget limit
  SELECT (budget_limits->p_service_type)::DECIMAL
  INTO v_budget_limit
  FROM company_settings
  WHERE company_id = p_company_id;
  
  v_remaining := v_budget_limit - v_daily_total;
  
  RETURN jsonb_build_object(
    'allowed', v_daily_total + p_estimated_cost <= v_budget_limit,
    'daily_total', v_daily_total,
    'budget_limit', v_budget_limit,
    'remaining', v_remaining,
    'percentage_used', (v_daily_total / v_budget_limit * 100)::INTEGER
  );
END;
$$ LANGUAGE plpgsql;
```

## Service Interface
```typescript
interface CostRecord {
  serviceType: 'stt' | 'tts' | 'vlm' | 'llm' | 'yolo';
  operationType: string;
  estimatedCost: number;
  metadata?: {
    modelName?: string;
    duration?: number;
    tokenCount?: number;
  };
}

interface BudgetStatus {
  allowed: boolean;
  dailyTotal: number;
  budgetLimit: number;
  remaining: number;
  percentageUsed: number;
}
```