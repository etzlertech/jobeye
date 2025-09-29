# Task: Admin Audit System

**Slug:** `data-002-admin-audit-system`
**Priority:** High
**Size:** 1 PR

## Description
Implement admin audit logging for RLS bypass operations with full before/after tracking.

## Files to Create
- `supabase/migrations/010_admin_audit_log.sql`
- `src/lib/admin/admin-audit-service.ts`
- `src/lib/admin/types/audit-types.ts`

## Files to Modify
- `src/lib/supabase/admin-client.ts` - Add audit wrapper

## Acceptance Criteria
- [ ] Creates admin_audit_log table (no RLS)
- [ ] Logs who, what, when, why for every bypass
- [ ] Captures before/after state diff
- [ ] Only accessible via service role
- [ ] Implements admin_bypass_rls() function
- [ ] Auto-generates JSON diff

## Test Files
**Create:** `src/__tests__/lib/admin/admin-audit-service.test.ts`

Test cases:
- `logs RLS bypass operation`
  - Perform admin update
  - Assert audit entry created
  - Assert all fields populated
  - Assert diff generated
  
- `prevents non-admin bypass`
  - Try bypass as regular user
  - Assert permission denied
  - Assert no audit entry
  
- `captures full context`
  - Update with reason
  - Assert reason stored
  - Assert user ID captured
  - Assert timestamp accurate

## Dependencies
- Existing: Supabase service role setup

## Database Schema
```sql
-- Migration: 010_admin_audit_log.sql
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL,
  target_table TEXT NOT NULL,
  target_id UUID NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE', 'SELECT')),
  
  -- Change tracking
  before_data JSONB,
  after_data JSONB,
  data_diff JSONB GENERATED ALWAYS AS (
    jsonb_object_agg(
      key,
      jsonb_build_object(
        'before', before_data->key,
        'after', after_data->key
      )
    )
  ) STORED,
  
  -- Context
  reason TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- No RLS on audit log (service-role only)
-- Create index for performance
CREATE INDEX idx_audit_log_admin ON admin_audit_log(admin_id);
CREATE INDEX idx_audit_log_target ON admin_audit_log(target_table, target_id);
CREATE INDEX idx_audit_log_created ON admin_audit_log(created_at);

-- Admin bypass function
CREATE OR REPLACE FUNCTION admin_bypass_rls(
  p_table TEXT,
  p_operation TEXT,
  p_target_id UUID,
  p_data JSONB,
  p_reason TEXT
) RETURNS JSONB AS $$
DECLARE
  v_before JSONB;
  v_after JSONB;
  v_result JSONB;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (
    SELECT 1 FROM auth.users 
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;
  
  -- Capture before state for UPDATE/DELETE
  IF p_operation IN ('UPDATE', 'DELETE') THEN
    EXECUTE format('SELECT to_jsonb(t) FROM %I t WHERE id = $1', p_table)
    INTO v_before
    USING p_target_id;
  END IF;
  
  -- Execute operation (simplified, expand as needed)
  -- ... operation logic here ...
  
  -- Log the bypass
  INSERT INTO admin_audit_log (
    admin_id, target_table, target_id, operation,
    before_data, after_data, reason
  ) VALUES (
    auth.uid(), p_table, p_target_id, p_operation,
    v_before, v_after, p_reason
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Service Interface
```typescript
interface AdminAuditEntry {
  adminId: string;
  targetTable: string;
  targetId: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'SELECT';
  beforeData?: any;
  afterData?: any;
  reason: string;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
  };
}
```