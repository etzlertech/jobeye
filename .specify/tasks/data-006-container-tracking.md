# Task: Container Item Tracking Tables

**Slug:** `data-006-container-tracking`
**Priority:** High
**Size:** 1 PR

## Description
Create database schema for tracking item-container relationships and container utilization history.

## Files to Create
- `supabase/migrations/014_container_tracking.sql`
- `src/domains/equipment/repositories/container-tracking.repository.ts`

## Files to Modify
- `src/domains/equipment/services/container-service.ts` - Add tracking methods

## Acceptance Criteria
- [ ] Creates container_items junction table
- [ ] Creates container_history table
- [ ] Tracks item movements between containers
- [ ] Stores utilization snapshots
- [ ] Supports capacity calculations
- [ ] Enables utilization reporting

## Test Files
**Create:** `src/__tests__/domains/equipment/repositories/container-tracking.repository.test.ts`

Test cases:
- `tracks item placement`
- `records container transfers`
- `calculates current utilization`
- `maintains history`

## Dependencies
- Existing: containers, inventory tables

## Database Schema
```sql
-- Container-item relationships
CREATE TABLE container_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  container_id UUID NOT NULL REFERENCES containers(id),
  item_type TEXT NOT NULL,
  item_id UUID,
  quantity INTEGER DEFAULT 1,
  placed_at TIMESTAMPTZ DEFAULT NOW(),
  removed_at TIMESTAMPTZ,
  placed_by UUID REFERENCES auth.users(id)
);

-- Container utilization history
CREATE TABLE container_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  container_id UUID NOT NULL REFERENCES containers(id),
  job_id UUID REFERENCES jobs(id),
  utilization_percent INTEGER,
  item_count INTEGER,
  snapshot_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE container_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE container_history ENABLE ROW LEVEL SECURITY;
```