# End-to-End Test Scenarios - Comprehensive Coverage

## Overview
10 diverse test sequences covering edge cases, error handling, business rules, concurrency, and real-world workflows.

---

## Scenario 1: Happy Path - Full Day Planning
**Purpose**: Validate complete workflow from empty state to fully scheduled day

**Steps**:
1. Create day plan for tomorrow
2. Add 6 jobs sequentially (hitting the limit)
3. Try to add 7th job (should fail)
4. List all plans - verify 1 plan exists
5. Query events for the plan - verify 6 jobs
6. Update one job status to 'in_progress'
7. Complete that job (status → 'completed')
8. Verify total counts and states

**Expected**: All operations succeed except 7th job. Final state: 1 plan, 6 jobs (5 pending, 1 completed)

---

## Scenario 2: Edge Case - Date Boundaries
**Purpose**: Test date/time edge cases and timezone handling

**Steps**:
1. Create plan for today
2. Create plan for yesterday (past date - should work)
3. Create plan for 365 days in future
4. Create plan with same date as existing (different user - should work)
5. Try duplicate plan (same user, same date - should fail unique constraint)
6. Query plans by date range (yesterday to tomorrow)
7. Query plans for specific date
8. Verify date filtering works correctly

**Expected**: Unique constraint prevents duplicate user+date. Date queries return correct ranges.

---

## Scenario 3: Concurrency - Race Conditions
**Purpose**: Test concurrent operations and job limit enforcement under load

**Steps**:
1. Create day plan
2. Spawn 10 concurrent POST requests to add jobs
3. Verify only 6 jobs created (race condition handled)
4. Try to add job in separate request (should fail - limit reached)
5. Delete 2 jobs
6. Try to add 3 jobs (should succeed for 2, fail for 3rd)
7. Verify final state: exactly 6 jobs

**Expected**: Database constraints prevent exceeding 6 jobs even with concurrent requests.

---

## Scenario 4: Error Handling - Invalid Data
**Purpose**: Test validation and error responses

**Steps**:
1. POST plan without company_id (should fail 400)
2. POST plan without user_id (should fail 400)
3. POST plan without plan_date (should fail 400)
4. POST plan with invalid date format (should fail)
5. POST event with invalid event_type (should fail)
6. POST event with invalid UUID for day_plan_id (should fail)
7. POST event with non-existent day_plan_id (should fail FK)
8. POST event without required location data (should work - nullable)
9. GET with invalid UUID format in query (should fail)
10. Verify all errors return proper status codes and messages

**Expected**: All validation errors return 400. FK violations return appropriate errors.

---

## Scenario 5: Multi-User Isolation
**Purpose**: Verify data isolation between users and companies

**Steps**:
1. Create User A and User B (different companies)
2. User A creates 2 day plans
3. User B creates 2 day plans
4. User A queries plans (should see only their 2)
5. User B queries plans (should see only their 2)
6. User A tries to add event to User B's plan (should fail - wrong company)
7. Admin queries all plans (should see 4 if RLS bypassed)
8. Verify each user sees only their company's data

**Expected**: Complete tenant isolation. Users cannot access other companies' data.

---

## Scenario 6: Complex Workflow - Day Replanning
**Purpose**: Test realistic workflow of planning, executing, and replanning

**Steps**:
1. Create morning plan with 3 jobs
2. Mark first job as in_progress
3. Mark first job as completed
4. Urgent job comes in - add to plan
5. Second job has issue - mark as cancelled
6. Add replacement job for cancelled one
7. Reorder jobs (update sequence_numbers)
8. Mark all remaining jobs as completed
9. Query final state - verify all status transitions
10. Calculate stats (completed vs cancelled vs pending)

**Expected**: Complex state transitions work. Sequence updates succeed. Final stats correct.

---

## Scenario 7: Geographic Data - Location Queries
**Purpose**: Test PostGIS location data and spatial queries

**Steps**:
1. Create plan with 6 jobs at different locations
2. Jobs spread across NYC boroughs (different coordinates)
3. Add job with invalid PostGIS format (should fail)
4. Query jobs by location (if spatial query implemented)
5. Calculate distances between jobs
6. Verify route optimization considers locations
7. Test with boundary coordinates (0,0), (180, 90), (-180, -90)
8. Test with same location for multiple jobs

**Expected**: PostGIS handles all valid coordinates. Invalid formats rejected. Spatial data intact.

---

## Scenario 8: Event Types - Mixed Schedule
**Purpose**: Test different event types beyond just jobs

**Steps**:
1. Create day plan
2. Add job event (sequence 1)
3. Add break event (sequence 2) - 30 min lunch
4. Add job event (sequence 3)
5. Add travel event (sequence 4) - driving time
6. Add job event (sequence 5)
7. Add meeting event (sequence 6) - team standup
8. Verify only job events count toward 6-job limit
9. Try to add 6 more jobs (should fail)
10. Verify breaks/travel/meetings don't count toward limit

**Expected**: 6-job limit applies only to 'job' events. Other event types unlimited.

---

## Scenario 9: Voice Integration - Session Tracking
**Purpose**: Test voice-related fields and session linking

**Steps**:
1. Create plan with voice_session_id
2. Add jobs via voice (include voice metadata)
3. Query plans by voice_session_id
4. Verify voice_created_at timestamps
5. Test voice error handling (voice service down)
6. Create plan without voice (null voice fields)
7. Mix voice and non-voice operations
8. Verify voice fields are optional

**Expected**: Voice fields work when provided, nullable when not. Session tracking functional.

---

## Scenario 10: Performance & Stress - Bulk Operations
**Purpose**: Test system under load and measure performance

**Steps**:
1. Create 20 users
2. Each user creates 5 day plans (100 total plans)
3. Each plan gets 4-6 jobs (500+ jobs total)
4. Measure creation time (should be <10s total)
5. Query all plans (paginated) - measure response time
6. Query with complex filters (date range + user + status)
7. Update 50 jobs concurrently
8. Delete 10 plans (cascade deletes events)
9. Measure final database size and query performance
10. Verify no data corruption or constraint violations

**Expected**: System handles bulk operations. Queries remain fast (<500ms). No data corruption.

---

## Test Execution Plan

### Pre-Test Setup
- Clean database state
- Create test companies
- Prepare test users
- Set up authentication tokens

### Test Execution Order
1. **Scenario 1** (Happy Path) - Baseline validation
2. **Scenario 4** (Error Handling) - Validate error paths
3. **Scenario 2** (Date Boundaries) - Edge case testing
4. **Scenario 5** (Multi-User Isolation) - Security validation
5. **Scenario 7** (Geographic Data) - PostGIS validation
6. **Scenario 8** (Event Types) - Business rule testing
7. **Scenario 9** (Voice Integration) - Feature-specific testing
8. **Scenario 6** (Complex Workflow) - Realistic simulation
9. **Scenario 3** (Concurrency) - Race condition testing
10. **Scenario 10** (Performance) - Load testing

### Post-Test Validation
- Verify database integrity
- Check for orphaned records
- Validate constraint enforcement
- Review performance metrics
- Clean up test data

---

## Success Criteria

### Per Scenario
- All expected operations succeed
- All expected failures fail correctly
- Error messages are clear and actionable
- Response times are acceptable
- Data integrity maintained

### Overall Suite
- **Target**: 90%+ tests passing
- **Performance**: <1s per operation average
- **Coverage**: All major features tested
- **Edge Cases**: All known edge cases covered
- **Security**: Tenant isolation verified

---

## Metrics to Track

1. **Timing**
   - Total suite execution time
   - Per-scenario execution time
   - Per-operation response time
   - Slowest operations identified

2. **Success Rate**
   - Tests passed vs failed
   - Expected failures vs unexpected failures
   - Pass rate by category

3. **Database**
   - Records created/modified/deleted
   - Query performance
   - Constraint violations
   - Data integrity checks

4. **Errors**
   - Error types encountered
   - Error message clarity
   - Error recovery success

---

## Implementation Notes

- Each scenario runs independently
- Database cleaned between scenarios
- Scenarios can be run individually for debugging
- All operations logged for troubleshooting
- Results saved to structured report
- Screenshots/logs captured on failures
