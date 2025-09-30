# Dispatcher Desktop Guide

**Version**: 1.0
**Last Updated**: 2025-09-30
**Audience**: Dispatchers managing crew schedules and daily operations

---

## Overview

As a dispatcher, you coordinate crew schedules, optimize routes, manage incoming requests, and monitor field operations in real-time. This guide covers all dispatcher features in the JobEye desktop interface.

---

## Dashboard Overview

### Main Dashboard

When you log in, the dispatcher dashboard shows:

**Today's Overview**:
- Total jobs scheduled
- Crews on the clock
- Pending intake requests
- Route optimization status
- Real-time crew locations (map view)

**Quick Actions**:
- Create new job
- Optimize routes
- View intake requests
- Approve schedule changes
- Send crew notifications

### Navigation

**Left Sidebar**:
- 🏠 Dashboard
- 📋 Jobs
- 👥 Crews
- 📥 Intake
- 🗺️ Routes
- 📊 Analytics
- ⚙️ Settings

---

## Managing Intake Requests

### Viewing Incoming Requests

**Intake Queue**:
1. Click **"Intake"** in the sidebar
2. See all pending requests sorted by:
   - Date received
   - Lead score (0-100)
   - Source (phone, web, referral, etc.)
3. Filter by:
   - Status (new, contacted, scheduled, rejected)
   - Service type
   - Date range
   - Lead score threshold

**Request Details**:
- Click any request to view full details
- See customer information, service requested, notes
- View lead score breakdown (urgency, property size, service type)
- Check duplicate detection warnings

### Processing Requests

**Convert to Job**:
1. Review request details
2. Click **"Convert to Job"**
3. Select or create customer profile
4. Choose service template
5. Assign crew
6. Set schedule date/time
7. Click **"Create Job"**

**Reject Request**:
1. Click **"Reject"**
2. Select reason:
   - Outside service area
   - Duplicate request
   - Customer not qualified
   - Service not offered
3. Add notes (optional)
4. Click **"Confirm Rejection"**

**Mark as Contacted**:
- Use for requests that need follow-up
- Sets reminder for next contact attempt
- Tracks conversion funnel metrics

### OCR Document Processing

**Upload Documents**:
1. Click **"Upload Document"** in Intake section
2. Drag & drop or select file (image/PDF)
3. Select document type:
   - Service request form
   - Property diagram
   - Contract
   - Other
4. Click **"Process with OCR"**

**Review OCR Results**:
- AI extracts structured data (customer name, address, phone, service type, notes)
- Confidence score shows reliability (>90% is excellent)
- Edit any incorrect fields
- Click **"Save"** to create intake request

**Cost Tracking**:
- Each OCR request costs ~$0.01 (GPT-4 Vision)
- Monthly budget tracked in dashboard
- Alert when approaching limit

### Duplicate Detection

**Automatic Detection**:
- When entering customer name, address, or phone, duplicate warnings appear
- Shows similarity percentage (80%+ = likely duplicate)
- Displays existing requests/customers

**Handling Duplicates**:
1. Review the potential duplicate
2. Options:
   - **Merge**: Combine with existing customer
   - **Create New**: Customer is different (similar name/address)
   - **Reject**: This is a duplicate submission

---

## Job Scheduling

### Creating Jobs

**Quick Create**:
1. Click **"+ New Job"** in dashboard
2. Select customer (or create new)
3. Choose service template
4. Set date and time
5. Assign crew
6. Click **"Create"**

**Advanced Create**:
1. Navigate to **Jobs > Create Job**
2. Fill in all fields:
   - Customer & property information
   - Service type and template
   - Scheduled date/time/duration
   - Crew assignment
   - Equipment requirements
   - Special instructions
   - Property boundaries (draw on map)
3. Add photos/documents
4. Set safety checklist template
5. Click **"Create Job"**

### Bulk Job Creation

**CSV Import**:
1. Navigate to **Jobs > Import**
2. Download CSV template
3. Fill in job details (one row per job)
4. Upload completed CSV
5. Review mapped fields
6. Click **"Import Jobs"**
7. Fix any validation errors
8. Click **"Confirm Import"**

**Recurring Jobs** (if configured):
- Jobs marked as recurring automatically generate future instances
- Edit recurrence pattern in job settings

### Managing Jobs

**Job List**:
- View all jobs with filters:
  - Status (scheduled, in-progress, completed, cancelled)
  - Date range
  - Crew assignment
  - Service type
  - Customer
- Sort by date, crew, status, priority

**Job Details**:
- Click any job to view/edit
- See real-time status updates
- View crew check-in/out times
- Monitor task completion
- View photos and notes

**Editing Jobs**:
1. Open job details
2. Click **"Edit"**
3. Modify any fields
4. Click **"Save Changes"**
5. Crew is notified of changes

**Cancelling Jobs**:
1. Open job details
2. Click **"Cancel Job"**
3. Select reason
4. Add notes
5. Click **"Confirm Cancellation"**
6. Customer and crew are notified

---

## Route Optimization

### Daily Route Optimization

**Optimize Routes**:
1. Navigate to **Routes** section
2. Select date
3. Select crew (or "All Crews")
4. See list of scheduled jobs
5. Click **"Optimize Route"**
6. Review optimized order:
   - Total distance
   - Total duration
   - Estimated fuel savings
   - Distance reduced
7. Click **"Apply Optimization"** to update crew schedules

**Daily Optimization Limit**:
- 1 optimization per dispatcher per day (Mapbox API limit)
- Use wisely for complex schedules
- Manual reordering available anytime

**Fallback Mode**:
- If Mapbox limit reached, greedy nearest-neighbor algorithm used
- Less optimal but still improves on unoptimized routes
- No additional cost

### Manual Route Ordering

**Drag & Drop**:
1. Navigate to **Routes > [Crew Name]**
2. View job list in scheduled order
3. Drag jobs to reorder
4. Changes save automatically
5. Crew sees updated order immediately

### Route Map Visualization

**Map View**:
- See all jobs for selected crew on map
- Color-coded pins:
  - 🟢 Green = Next job
  - 🔵 Blue = Scheduled
  - 🟡 Yellow = In progress
  - ✅ Green checkmark = Completed
  - 🔴 Red = Overdue
- Click any pin to view job details
- See optimized route line connecting jobs

**Live Crew Tracking**:
- See crew's current location (blue dot)
- GPS breadcrumb trail shows route taken
- Real-time ETA to next job
- Distance from next job

---

## Real-Time Monitoring

### Crew Locations

**Map View**:
1. Navigate to **Dashboard** or **Crews**
2. Enable map view
3. See all active crews' real-time locations
4. Click crew marker for details:
   - Current job
   - Time on site
   - Today's completed jobs
   - Clock-in status

**GPS Breadcrumbs**:
- See historical route taken
- Useful for route verification
- Filtered by date/time range

### Job Status Tracking

**Live Updates**:
- Job cards update in real-time as crews work
- Status changes appear immediately:
  - Crew arrived
  - Task completed
  - Photo uploaded
  - Safety checklist completed
  - Job marked complete

**Notifications**:
- Desktop notifications for:
  - Job arrivals
  - Jobs completed
  - Safety incidents reported
  - Time discrepancies
  - Crew issues/notes

### Geofence Events

**Arrival/Departure Detection**:
- Automatic detection when crew enters/exits job site geofence
- Events logged with timestamp and GPS coordinates
- Useful for time verification

**Geofence Settings**:
- Arrival threshold: 50 meters
- Departure threshold: 100 meters
- Circular or polygon boundaries (configured per property)

---

## Crew Management

### Viewing Crew Status

**Crew List**:
1. Navigate to **Crews**
2. See all crews with:
   - Current status (on job, en route, available, off duty)
   - Clock-in time
   - Current job
   - Today's completed jobs
   - Location (if clocked in)

**Crew Details**:
- Click any crew to view:
  - Today's schedule
  - Time entries
  - Performance metrics
  - Recent jobs

### Crew Communication

**Send Messages**:
1. Open crew details
2. Click **"Send Message"**
3. Type message
4. Click **"Send"**
5. Crew receives in-app notification

**Broadcast to All Crews**:
1. Navigate to **Crews > Broadcast**
2. Type message
3. Select recipients (all or specific crews)
4. Click **"Send Broadcast"**

### Schedule Changes

**Reassign Jobs**:
1. Open job details
2. Click **"Reassign"**
3. Select new crew
4. Add reason/notes
5. Click **"Confirm"**
6. Both crews notified

**Add Jobs to Schedule**:
1. Drag job from unassigned list
2. Drop onto crew's schedule
3. Set time slot
4. Click **"Assign"**

---

## Analytics & Reports

### Daily Reports

**Daily Summary**:
- Jobs completed vs scheduled
- Total labor hours
- Average job duration
- Route efficiency
- Customer satisfaction

**Crew Performance**:
- Jobs completed per crew
- Average time per job type
- Route adherence
- Safety checklist compliance

### Intake Analytics

**Lead Performance**:
- Conversion rate by source
- Average lead score
- Time to conversion
- Rejection reasons breakdown

**OCR Usage**:
- Total documents processed
- Average confidence score
- Cost per document
- Monthly spending

### Route Analytics

**Optimization Impact**:
- Distance saved (miles/km)
- Time saved (hours)
- Estimated fuel savings ($)
- Route efficiency score

**Comparison**:
- Optimized vs actual route taken
- Adherence percentage
- Deviation reasons

---

## Best Practices

### Morning Routine

1. ✅ Review today's schedule for all crews
2. ✅ Check for any overnight intake requests
3. ✅ Optimize routes if needed (before crews start)
4. ✅ Verify crew clock-ins
5. ✅ Send any schedule updates to crews

### Throughout the Day

1. 📍 Monitor crew locations and progress
2. 🚨 Respond to crew issues/questions promptly
3. 📥 Process incoming intake requests within 1 hour
4. 🔔 Watch for notifications (incidents, delays, etc.)
5. 📊 Track job completion rates

### End of Day

1. ✅ Verify all crews clocked out
2. 📋 Review completed vs scheduled jobs
3. 📝 Address any flagged jobs
4. 📊 Review daily performance metrics
5. 📅 Preview tomorrow's schedule

### Route Optimization Tips

- Optimize routes early morning before crews depart
- Group jobs by geographic clusters
- Account for traffic patterns (avoid rush hour routing)
- Consider equipment requirements (minimize shop returns)
- Use manual ordering for small adjustments

### Intake Management Tips

- Process high lead score (80+) requests first
- Contact new requests within 1 hour for best conversion
- Use OCR for handwritten forms to save time
- Review duplicate warnings carefully before creating jobs
- Track source performance monthly to optimize marketing

---

## Troubleshooting

### Crew Not Showing on Map

**Possible Causes**:
- Crew not clocked in
- Location permissions denied on crew device
- Poor GPS signal
- Crew in offline mode (location queued)

**Solutions**:
1. Verify crew clock-in status
2. Contact crew to check location permissions
3. Wait for crew to move to area with better signal
4. Location will update once back online

### Route Optimization Failed

**Error**: "Optimization limit reached"
- You've used today's daily optimization
- Use manual reordering or try again tomorrow
- Greedy fallback available (no Mapbox cost)

**Error**: "Invalid job locations"
- One or more jobs missing GPS coordinates
- Edit job and add property address
- Geocode will calculate coordinates automatically

### Jobs Not Appearing in Crew App

**Solutions**:
1. Verify job is assigned to correct crew
2. Check job scheduled date/time
3. Ask crew to refresh app
4. Verify crew has internet connection
5. Check job status (not cancelled)

### Duplicate Detection Too Sensitive

**Adjustment**:
1. Navigate to **Settings > Intake**
2. Adjust "Duplicate Threshold" (default 80%)
3. Lower threshold = fewer warnings (70-75%)
4. Save changes

---

## Keyboard Shortcuts

**Global**:
- `Ctrl+N` / `Cmd+N`: New job
- `Ctrl+F` / `Cmd+F`: Search
- `Ctrl+R` / `Cmd+R`: Refresh dashboard
- `/`: Focus search bar

**Navigation**:
- `D`: Dashboard
- `J`: Jobs
- `C`: Crews
- `I`: Intake
- `R`: Routes
- `A`: Analytics

**Job Management**:
- `E`: Edit selected job
- `Delete`: Cancel selected job
- `Ctrl+S` / `Cmd+S`: Save changes

---

## FAQs

**Q: How often does crew location update?**
A: Every 30 seconds when crew is clocked in and has internet connection.

**Q: Can I optimize routes multiple times per day?**
A: Only 1 Mapbox optimization per dispatcher per day. Manual reordering available unlimited.

**Q: What happens if I assign two crews to the same job?**
A: System prevents this. You'll see an error and must choose one crew.

**Q: Can I see completed jobs from previous days?**
A: Yes, navigate to Jobs and use date range filter.

**Q: How do I export job data?**
A: Navigate to Reports > Export Data, select date range and format (CSV/Excel).

**Q: Can I create custom service templates?**
A: Yes, navigate to Settings > Service Templates > Create New.

**Q: What's the difference between lead score and confidence?**
A: Lead score (0-100) predicts conversion likelihood. Confidence (%) shows OCR data extraction accuracy.

**Q: Can I undo a route optimization?**
A: Yes, click "Revert to Original Order" within 5 minutes of applying. After that, manual reordering required.

---

## Support

**Need Help?**
- Email: support@jobeye.com
- In-app: Help > Contact Support
- Phone: 1-800-JOBEYE-1

**Training Resources**:
- Video tutorials: Help > Training Videos
- Knowledge base: help.jobeye.com
- Weekly dispatcher office hours (Fridays 2-3pm)

---

**Document Version**: 1.0
**Last Updated**: 2025-09-30
**Maintained By**: JobEye Documentation Team
