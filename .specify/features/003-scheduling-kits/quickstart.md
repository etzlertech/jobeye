# Quickstart: Scheduling, Day Plan & Kit Assignment

This guide walks through common scenarios for the scheduling and kit management system.

## Prerequisites

- JobEye application running locally
- Test company with technicians set up
- Sample customers and properties in the system
- Voice command system enabled (optional)

## Scenario 1: Create and Optimize a Day Plan

### Step 1: Create a Day Plan for a Technician

```typescript
// POST /api/scheduling/day-plans
const dayPlan = await createDayPlan({
  user_id: "tech-123",
  plan_date: "2024-02-15",
  status: "draft"
});

console.log(`Created day plan ${dayPlan.id} for ${dayPlan.plan_date}`);
```

### Step 2: Add Jobs to the Day Plan

```typescript
// Create multiple schedule events (jobs)
const jobs = [
  {
    customer: "Smith Residence",
    address: "123 Main St",
    scheduled_start: "2024-02-15T08:00:00Z",
    duration_minutes: 45,
    job_type: "small_yard"
  },
  {
    customer: "Johnson Property",
    address: "456 Oak Ave",
    scheduled_start: "2024-02-15T09:00:00Z",
    duration_minutes: 60,
    job_type: "large_yard"
  },
  // ... more jobs
];

for (const [index, job] of jobs.entries()) {
  await createScheduleEvent({
    day_plan_id: dayPlan.id,
    event_type: "job",
    sequence_order: index + 1,
    scheduled_start: job.scheduled_start,
    scheduled_duration_minutes: job.duration_minutes,
    address: parseAddress(job.address),
    // Auto-assign appropriate kit based on job type
  });
}
```

### Step 3: Optimize the Route

```typescript
// POST /api/scheduling/day-plans/{id}/optimize
const optimized = await optimizeDayPlan(dayPlan.id, {
  optimization_type: "balanced", // Balance time and distance
  constraints: {
    max_route_duration_minutes: 480, // 8-hour day
    honor_time_windows: true
  }
});

console.log(`Route optimized! Saved ${optimized.improvements.time_saved_minutes} minutes`);
```

### Step 4: Publish the Day Plan

```typescript
// PATCH /api/scheduling/day-plans/{id}
await updateDayPlan(dayPlan.id, {
  status: "published"
});

// Technician receives notification of their day plan
```

## Scenario 2: Voice-Driven Scheduling

### Voice Command Examples

```text
Technician: "Schedule a small yard service for tomorrow at 2PM"
System: "I'll schedule a small yard service for tomorrow, February 16th at 2PM. 
         Which customer is this for?"
Technician: "The Smith property on Main Street"
System: "Scheduled small yard service for Smith Residence at 123 Main St 
         on February 16th at 2PM. Standard small yard kit will be loaded."
```

### Behind the Scenes

```typescript
// Voice intent processed
const intent = {
  type: "schedule_job",
  entities: {
    job_type: "small_yard",
    date: "tomorrow",
    time: "2PM",
    customer: "Smith property"
  }
};

// Convert to API call
const response = await processSchedulingIntent(intent);
```

## Scenario 3: Kit Management and Loading

### Step 1: Define a Standard Kit

```typescript
// POST /api/kits
const smallYardKit = await createKit({
  kit_code: "SY-001",
  name: "Small Yard Service Kit",
  category: "yard_maintenance",
  voice_identifier: "small yard kit",
  typical_job_types: ["small_yard", "quick_cleanup"]
});

// Add items to the kit
const items = [
  { type: "equipment", name: "Push Mower", quantity: 1, required: true },
  { type: "equipment", name: "String Trimmer", quantity: 1, required: true },
  { type: "equipment", name: "Leaf Blower", quantity: 1, required: true },
  { type: "material", name: "Trash Bags", quantity: 5, required: false },
  { type: "tool", name: "Hand Tools Set", quantity: 1, required: true }
];

for (const item of items) {
  await addKitItem(smallYardKit.id, item);
}
```

### Step 2: Create Seasonal Variant

```typescript
// POST /api/kits/{id}/variants
await createKitVariant(smallYardKit.id, {
  variant_code: "WINTER",
  variant_type: "seasonal",
  conditions: {
    months: [12, 1, 2] // December, January, February
  },
  item_modifications: {
    remove: ["leaf_blower_id"],
    add: [{
      item_type: "equipment",
      name: "Snow Shovel",
      quantity: 1,
      is_required: true
    }]
  },
  valid_from: "2024-12-01",
  valid_until: "2025-02-28"
});
```

### Step 3: Kit Loading Verification

```typescript
// Morning kit loading process
const todaysJobs = await getJobsForToday(technicianId);

for (const job of todaysJobs) {
  const kit = await getAssignedKit(job.id);
  
  // Technician uses voice or app to verify
  const verification = await verifyKitLoading(job.id, kit.id, {
    checklist_confirmations: kit.items.map(item => ({
      item_id: item.id,
      is_present: true // or false if missing
    }))
  });
}
```

## Scenario 4: Handling Missing Kit Items

### Voice Override Flow

```text
Technician: "Override missing item string trimmer"
System: "Why can't you load the string trimmer?"
Technician: "It's broken and in the shop for repair"
System: "I've recorded that the string trimmer is unavailable due to repairs. 
         Your supervisor has been notified. You may proceed with the job."
```

### Supervisor Notification

```typescript
// Automatic notification triggered
{
  message: "Kit Override Alert: John Smith marked 'String Trimmer' as missing on Job #1234. Reason: Broken and in shop for repair",
  channels: ["sms", "push"],
  priority: "high"
}
```

## Scenario 5: Technician's Daily Workflow

### Morning Start

```typescript
// Technician opens app or uses voice
const dayPlan = await getMyDayPlan(technicianId, today);

// Start the day
await updateDayPlan(dayPlan.id, {
  status: "in_progress",
  actual_start_time: new Date().toISOString()
});
```

### Navigate Through Day

```text
Technician: "What's my next job?"
System: "Your next job is at Johnson Property, 456 Oak Ave. 
         It's a large yard service scheduled for 9 AM. 
         Travel time is 12 minutes. Would you like directions?"
```

### Complete Jobs with Voice

```text
Technician: "Mark current job complete"
System: "Marked Smith Residence job as complete at 8:42 AM. 
         Your route has been updated. 
         Your next stop is now Thompson Estate, saving you 8 minutes of travel time."
```

### End of Day

```typescript
// Close out the day
await updateDayPlan(dayPlan.id, {
  status: "completed",
  actual_end_time: new Date().toISOString()
});

// Analytics tracked automatically
{
  jobs_completed: 8,
  miles_driven: 47.3,
  time_saved_via_optimization: 34, // minutes
  kit_overrides: 1
}
```

## Scenario 6: Offline Operations

### Work Offline

```typescript
// Service worker handles offline
if (!navigator.onLine) {
  // Queue operations locally
  await offlineQueue.add({
    type: "update_job_status",
    data: {
      job_id: currentJob.id,
      status: "completed",
      completed_at: new Date().toISOString()
    }
  });
  
  // Show optimistic update
  updateUI({ job: { ...currentJob, status: "completed" } });
}
```

### Sync When Reconnected

```typescript
// Automatic sync when back online
window.addEventListener('online', async () => {
  const syncResult = await syncOfflineQueue();
  
  if (syncResult.conflicts.length > 0) {
    // Handle conflicts based on role priority
    await resolveConflicts(syncResult.conflicts);
  }
  
  showNotification(`Synced ${syncResult.success} changes`);
});
```

## Testing the System

### 1. Test Route Optimization

```bash
# Create a day plan with multiple jobs
npm run test:e2e -- --grep "route optimization"

# Verify:
# - Jobs are reordered for efficiency
# - Travel time is minimized
# - Time windows are respected
```

### 2. Test Kit Assignment

```bash
# Test automatic kit assignment
npm run test:integration -- --grep "kit assignment"

# Verify:
# - Correct kit assigned based on job type
# - Seasonal variants applied correctly
# - Override notifications work
```

### 3. Test Offline Sync

```bash
# Test offline operations
npm run test:e2e -- --grep "offline sync"

# Verify:
# - Changes queued when offline
# - Sync completes when reconnected
# - Conflicts resolved by role priority
```

## Common Issues and Solutions

### Issue: Route not optimizing properly
**Solution**: Check that all jobs have valid addresses with geocoded coordinates. Ensure PostGIS extensions are enabled.

### Issue: Kit override notifications not sending
**Solution**: Verify Twilio credentials are configured in Supabase Edge Functions. Check notification preferences for supervisors.

### Issue: Offline sync conflicts
**Solution**: Review role-based priority rules. Ensure technicians understand which fields they can modify offline.

### Issue: Voice commands not recognized
**Solution**: Check voice profile settings. Ensure wake word is configured. Review intent patterns for common phrases.

## Next Steps

1. **Customize Kits**: Define kits specific to your services
2. **Train Voice Commands**: Add company-specific terminology
3. **Configure Notifications**: Set up supervisor preferences
4. **Monitor Performance**: Use analytics to optimize routes
5. **Gather Feedback**: Iterate based on technician usage

For more details, see the full [API documentation](./contracts/) and [data model](./data-model.md).