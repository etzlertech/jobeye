# Scheduling Test Harness - Interactive Testing Guide

## Overview

This interactive test harness lets you test scheduling operations with real-world values without needing a UI. It uses the actual database and services to validate everything works correctly.

## Setup

```bash
# Ensure environment variables are set in .env.local
NEXT_PUBLIC_SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# Run the interactive harness
npx tsx scripts/test-scheduling-interactive.ts
```

## What It Tests

### 1. Create Day Plan
- **Real-world input**: Enter any date, user ID
- **Tests**: Database insertion, unique constraints, date validation
- **Validates**: Company FK constraint, user_id format, date format

**Try this:**
- Create plan for tomorrow
- Create plan for same date twice (should fail with unique constraint)
- Create plan with invalid date format

### 2. Add Schedule Events
- **Real-world input**: Number of jobs (1-7)
- **Tests**: Event creation, 6-job limit enforcement, sequencing
- **Validates**: FK constraints, time formatting, location data

**Try this:**
- Add 3 jobs (should succeed)
- Add 7 jobs (should stop at 6)
- Check job count before/after

### 3. Check Conflicts
- **Tests**: Time overlap detection, travel time conflicts, break violations
- **Uses**: Real ScheduleConflictService with actual event data
- **Validates**: Conflict detection logic works with DB data

**Try this:**
- Add 2 jobs close together
- Add jobs that overlap
- Add jobs requiring long travel time

### 4. Query Day Plans
- **Real-world input**: Date ranges for filtering
- **Tests**: Repository filtering, pagination, date range queries
- **Validates**: SQL queries work correctly, RLS (if using anon key)

**Try this:**
- Query all plans for user
- Filter by date range
- Query future plans only

### 5. Test 6-Job Limit
- **Automated test**: Creates plan, attempts to add 7 jobs
- **Tests**: Business rule enforcement at repository level
- **Validates**: countJobEvents() returns correct count, limit enforced

**Expected behavior:**
- Jobs 1-6 create successfully
- Job 7 is blocked (count check returns 6)

### 6. Test RLS (Multi-tenant)
- **Tests**: Row-level security, company isolation
- **Creates**: Plans for two different companies
- **Validates**: Cannot access other company's data

**Note**: Using service role bypasses RLS. For real test, modify script to use anon key with auth token.

## Test Scenarios

### Scenario 1: Normal Day Setup
```
1. Create day plan for tomorrow
2. Add 4 jobs (typical workday)
3. Check for conflicts
4. Query to verify it's there
```

**Expected**: All operations succeed, no conflicts

### Scenario 2: Busy Day (6-Job Limit)
```
1. Create day plan
2. Add 6 jobs
3. Try to add 7th job
4. Verify count is 6
```

**Expected**: 6 jobs succeed, 7th blocked with message about limit

### Scenario 3: Conflicting Schedule
```
1. Create day plan
2. Add job at 9:00 AM, 60 min
3. Add job at 9:30 AM, 60 min
4. Check conflicts
```

**Expected**: Conflict detected (overlap detected)

### Scenario 4: Query and Filter
```
1. Create plans for multiple dates
2. Query with date range
3. Verify filtering works
```

**Expected**: Only plans in range returned

### Scenario 5: Multi-tenant Isolation
```
1. Create plan for company 1
2. Create plan for company 2
3. Query as company 1
4. Verify can't see company 2's data
```

**Expected**: Only see own company's plans (with proper RLS setup)

## Common Issues to Test

### Database Constraints
- ❓ Foreign key violations (invalid company_id)
- ❓ Unique constraints (duplicate plan date)
- ❓ NOT NULL violations (missing required fields)

**How to test**: Try creating records with invalid/missing data

### Business Rules
- ❓ 6-job limit not enforced
- ❓ Events created out of sequence
- ❓ Invalid event types accepted

**How to test**: Try boundary cases (6th vs 7th job)

### Conflict Detection
- ❓ Overlapping events not detected
- ❓ Travel time not calculated correctly
- ❓ Break violations missed

**How to test**: Create intentionally conflicting schedules

### RLS Policies
- ❓ Can see other company's data
- ❓ Can modify other company's data
- ❓ Service role bypasses too much

**How to test**: Create data for multiple companies, query

## Debugging with the Harness

### When Tests Fail

The harness shows:
- ✅ Green: Operation succeeded
- ❌ Red: Operation failed with error details
- ⚠️  Yellow: Warning or expected behavior

**Error details include:**
- Error message
- Error code (PostgreSQL codes)
- Details and hints from database

### Reading Output

```
✅ Day plan created successfully!
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "company_id": "00000000-0000-0000-0000-000000000001",
  "user_id": "123e4567-e89b-12d3-a456-426614174000",
  "plan_date": "2025-10-01",
  "status": "draft",
  ...
}
```

This shows:
- Operation succeeded
- Full object returned from database
- All fields populated correctly

### Common Error Codes

- `23503`: Foreign key violation (referenced record doesn't exist)
- `23505`: Unique constraint violation (duplicate)
- `23502`: NOT NULL violation (missing required field)
- `PGRST116`: Record not found

## Real-World Test Values

### Dates
- Use actual dates: `2025-10-01`
- Tomorrow: Script calculates automatically
- Past dates: Test historical queries

### User IDs
- Default: `123e4567-e89b-12d3-a456-426614174000`
- Use real user IDs from your auth system
- Test multiple technicians

### Locations
- Script generates: `123 Test St, City 1`
- Modify to use real addresses
- Test with actual lat/long

### Times
- Jobs start at 8 AM by default
- 90 minutes apart (realistic)
- Modify for different schedules

## Integration with Unit Tests

This harness complements unit tests:

**Unit tests**: Test individual functions with mocks
**Test harness**: Test full stack with real database

**Use harness to:**
1. Validate unit test assumptions are correct
2. Test scenarios too complex for unit tests
3. Debug issues found in production
4. Explore edge cases interactively

## Next Steps

After using the harness:

1. **Document bugs found** in issues or docs
2. **Add unit tests** for any bugs discovered
3. **Update constraints** if business rules are wrong
4. **Fix RLS policies** if isolation fails

## Example Session

```bash
$ npx tsx scripts/test-scheduling-interactive.ts

🗓️  SCHEDULING MODULE - INTERACTIVE TEST HARNESS
Test real-world scheduling scenarios with actual database operations

------------------------------------------------------------
MENU:
1. Create Day Plan
2. Add Schedule Events
3. Check Conflicts
4. Query Day Plans
5. Test 6-Job Limit
6. Test RLS (Multi-tenant)
7. Run All Tests
8. Cleanup
9. Exit
------------------------------------------------------------

Select option (1-9): 7

Running all tests...

============================================================
TEST 1: Create Day Plan
============================================================
Enter plan date (YYYY-MM-DD) [default: tomorrow]:
Creating day plan for user 123e4567-e89b-12d3-a456-426614174000 on 2025-10-01...
✅ Day plan created successfully!
{
  "id": "...",
  ...
}

============================================================
TEST 2: Add Schedule Events
============================================================
How many job events to add? [1-7]: 3
Adding 3 job events to day plan...
✅ Job 1 created at 8:00:00 AM
✅ Job 2 created at 9:30:00 AM
✅ Job 3 created at 11:00:00 AM

Created 3 events

... (continues)
```

## Safety

- ✅ Uses test company ID by default
- ✅ Cleanup function to remove test data
- ✅ Service role for testing (bypasses RLS)
- ⚠️  Don't run against production database
- ⚠️  Always cleanup after testing

## Modifications

Want to customize? Edit `scripts/test-scheduling-interactive.ts`:

- Change test company/user IDs
- Add more test scenarios
- Modify timing/spacing of jobs
- Add custom validation logic
- Test different event types

## Success Criteria

After running all tests, you should have:
- [x] Created day plans successfully
- [x] Added multiple events
- [x] Verified 6-job limit works
- [x] Detected conflicts correctly
- [x] Queried and filtered plans
- [x] Confirmed RLS (if properly configured)

If all pass: Scheduling module is working correctly!
If any fail: Debug with error details provided.