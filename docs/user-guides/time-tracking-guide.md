# Time Tracking Guide

**Version**: 1.0
**Last Updated**: 2025-09-30
**Audience**: Field crews, supervisors, and payroll administrators

---

## Overview

JobEye automatically tracks work hours using GPS-verified clock in/out, automatic clock-out triggers, and approval workflows. This guide covers time tracking for crews, approval for supervisors, and timesheet generation for payroll.

---

## For Field Crews

### Clocking In

**Manual Clock In**:
1. Open JobEye app
2. Tap **"My Jobs"**
3. Select your current job
4. Tap **"Clock In"** button
5. GPS location captured automatically
6. Confirmation shown: "Clocked in at [Time]"

**Requirements**:
- Must be within job site geofence (typically 200m)
- Location permissions enabled
- Cannot be clocked in to another job
- Job must be scheduled for today

**Clock-In Confirmation**:
- Timer starts showing elapsed time
- Status changes to "Clocked In"
- Location shown on map
- Button changes to "Clock Out"

### During Your Shift

**Real-Time Duration Display**:
- Timer shows hours:minutes:seconds (HH:MM:SS)
- Updates every second
- Visible on job screen
- Example: "03:24:15" = 3 hours, 24 minutes, 15 seconds

**GPS Tracking**:
- Location updated every 30 seconds
- GPS breadcrumb trail recorded
- Used for verification and safety
- Tracking stops when you clock out

**Multiple Jobs**:
- Can only be clocked in to one job at a time
- Must clock out of current job before clocking in to next
- System prevents overlapping time entries

### Clocking Out

**Manual Clock Out**:
1. Tap **"Clock Out"** button on job screen
2. GPS location captured
3. Time entry created automatically
4. Confirmation: "Clocked out at [Time]"
5. Total duration shown (e.g., "4h 32m")

**Automatic Clock Out**:
JobEye automatically clocks you out in three scenarios:

**1. Geofence Exit**:
- You leave job site (>100m from property)
- Triggers after 5 minutes outside geofence
- Notification: "Auto-clocked out - left job site"
- Clock-out time = when you left geofence

**2. Idle Detection**:
- No GPS movement for 30+ minutes
- Triggers if device stationary
- Notification: "Auto-clocked out - idle detected"
- Could indicate break, issue, or phone problem

**3. End of Day**:
- Automatic clock-out at 11:59 PM
- Prevents overnight time entries
- Notification: "Auto-clocked out - end of day"
- Rare scenario (usually already clocked out)

**Auto Clock-Out Notifications**:
- Push notification sent immediately
- In-app notification badge
- Shows reason for auto clock-out
- Time entry created automatically

### Viewing Your Time

**Today's Hours**:
1. Tap **"Time"** in bottom navigation
2. See today's summary:
   - Total hours worked
   - Current clock-in status
   - Jobs worked today
   - Regular vs. overtime hours

**Time Entry Details**:
- Clock-in time and location
- Clock-out time and location
- Total duration
- Job/customer name
- Status (PENDING, APPROVED, REJECTED)

**Weekly/Monthly Summary**:
1. Tap **"Time"** > **"History"**
2. Select period (week, month, custom range)
3. See:
   - Total hours
   - Breakdown by job
   - Regular vs. overtime
   - Earnings (if enabled)

### Overtime Calculation

**Overtime Rules** (Configurable by Company):

**Daily Overtime** (Most Common):
- First 8 hours/day = Regular time
- Hours beyond 8 = Overtime (1.5x pay)
- Example: 10-hour day = 8 regular + 2 overtime

**Weekly Overtime**:
- First 40 hours/week = Regular time
- Hours beyond 40 = Overtime (1.5x pay)
- Example: 45-hour week = 40 regular + 5 overtime

**Overtime Indicator**:
- Orange badge shows "OT" next to time entries with overtime
- Tooltip shows breakdown (e.g., "8h regular, 2h OT")

### Breaks and Meal Periods

**Unpaid Breaks**:
- Clock out for unpaid lunch breaks
- Clock back in when returning to work
- Creates separate time entries
- Example:
  - 8:00 AM - 12:00 PM (4 hours)
  - 12:30 PM - 5:00 PM (4.5 hours)
  - Total: 8.5 hours

**Paid Breaks**:
- Stay clocked in
- Short breaks (5-15 min) typically paid
- No action needed

**Company Policy**:
- Check your company's break policy
- Some states require meal breaks
- Auto-deduction may apply (check with supervisor)

### Time Entry Status

**PENDING**:
- Awaiting supervisor approval
- Typical for all new time entries
- Appears in supervisor's approval queue

**APPROVED**:
- Supervisor approved your time
- Eligible for payroll
- Cannot be edited by crew
- Contact supervisor if correction needed

**REJECTED**:
- Supervisor rejected time entry
- Reason shown in entry details
- Correct the issue
- Resubmit for approval

**Common Rejection Reasons**:
- Incorrect clock-in time
- Location doesn't match job site
- Duplicate entry
- Unauthorized overtime
- Missing break deduction

### Editing Time Entries

**Before Approval**:
- Cannot edit time entries yourself
- Contact supervisor to adjust clock-in/out times
- Supervisor makes corrections and approves

**After Rejection**:
- If entry rejected, supervisor may allow you to edit
- Make requested corrections
- Resubmit for approval

**Disputed Time**:
- If you disagree with rejection or edit:
  1. Contact supervisor directly
  2. Explain discrepancy
  3. Provide context (GPS breadcrumbs, photos, etc.)
  4. Supervisor can override and approve

---

## For Supervisors

### Approval Queue

**Accessing Approval Queue**:
1. Navigate to **"Approvals"** > **"Time Entries"**
2. See all pending time entries
3. Sorted by oldest first (FIFO)

**Filtering**:
- Date range
- Crew member
- Job/customer
- Flagged entries (discrepancies detected)
- Status (pending, approved, rejected)

**Queue Overview**:
- Total pending entries
- Total hours awaiting approval
- Flagged entries count
- Oldest pending entry age

### Reviewing Time Entries

**Entry Details**:
Click any entry to view:
- Crew member name
- Job/customer name
- Clock-in time and GPS location
- Clock-out time and GPS location
- Total duration (regular + OT)
- Method (manual, auto-geofence, auto-idle, auto-EOD)
- GPS accuracy at clock-in/out
- Distance from job site

**Verification Checklist**:
- ✅ Clock-in time reasonable (matches schedule)
- ✅ Clock-in location matches job site
- ✅ Clock-out time reasonable
- ✅ Clock-out location matches job site
- ✅ Duration aligns with job estimate
- ✅ No overlapping time entries
- ✅ GPS accuracy acceptable (<100m)

**GPS Location Verification**:
1. Click location pin icon
2. View map showing:
   - Clock-in location (green pin)
   - Clock-out location (red pin)
   - Job site location (blue pin)
   - Distance between points
3. Verify pins align with expected locations

**GPS Breadcrumb Trail**:
1. Click **"View Route"**
2. See crew's GPS trail during shift
3. Verify:
   - Started at job site
   - Stayed at job site
   - No unexplained departures
   - Ended at job site

### Understanding Discrepancy Flags

Time entries with potential issues are flagged with ⚠️:

**⏱️ Long Duration**:
- Entry duration >50% longer than job estimate
- Example: 2-hour job took 4+ hours
- **Common Causes**:
  - Job estimate too low
  - Unexpected issues found
  - Crew worked slower than expected
- **Action**: Review with crew, approve if justified

**📍 Location Mismatch**:
- Clock-in/out location >200m from job site
- **Common Causes**:
  - Parking on street (not in driveway)
  - Large property
  - GPS inaccuracy
- **Action**: Check GPS accuracy, review map, verify with crew

**📅 Outside Schedule**:
- Clock-in >30 min before scheduled start
- Clock-out significantly after scheduled end
- **Common Causes**:
  - Schedule change not updated
  - Crew arrived early
  - Job took longer than scheduled
- **Action**: Verify with dispatcher and crew

**🔴 Missing Clock-Out**:
- No manual clock-out recorded
- Auto clock-out triggered
- **Common Causes**:
  - Crew forgot to clock out
  - Phone died
  - App closed/crashed
- **Action**: Contact crew to confirm actual end time, adjust if needed

**⏸️ Long Break**:
- Gap >2 hours between clock-out and next clock-in
- Potential unpaid break not accounted for
- **Action**: Verify with crew, ensure break time not paid

**🌙 After Hours**:
- Time entry outside normal business hours (before 6 AM or after 8 PM)
- Could be overtime or emergency work
- **Action**: Verify work was authorized

### Approving Time Entries

**Single Approval**:
1. Review entry details
2. Verify all checks pass
3. Check entry checkbox
4. Click **"Approve (1)"**
5. Entry moves to APPROVED status
6. Crew notified

**Bulk Approval**:
1. Filter queue to clean entries (no flags)
2. Click "Select All" checkbox
3. Review count
4. Click **"Approve (X)"**
5. Confirm bulk approval
6. All entries approved at once

**Approval Best Practices**:
- Review flagged entries individually
- Bulk approve clean entries
- Aim to clear queue daily
- Prioritize entries approaching payroll cutoff

### Rejecting Time Entries

**When to Reject**:
- Clock-in time clearly incorrect
- Location not job site (and can't be verified)
- Duplicate entry
- Unauthorized work
- Crew requests correction

**Rejection Process**:
1. Select entry checkbox
2. Click **"Reject"**
3. Select rejection reason:
   - Incorrect clock-in time
   - Incorrect clock-out time
   - Location discrepancy
   - Duplicate entry
   - Unauthorized work
   - Other (specify)
4. Add detailed notes explaining rejection
5. Click **"Confirm Rejection"**

**After Rejection**:
- Crew notified immediately
- Entry status changes to REJECTED
- Crew sees rejection reason
- Entry can be corrected and resubmitted
- Resubmitted entry returns to your queue

### Editing Time Entries

**Adjusting Times**:
1. Click entry to open details
2. Click **"Edit Times"**
3. Adjust clock-in time (if needed)
4. Adjust clock-out time (if needed)
5. Add reason for adjustment
6. Click **"Save & Approve"**

**Edit Audit Trail**:
- All edits logged with:
  - Original clock-in/out times
  - New clock-in/out times
  - Reason for edit
  - Supervisor name
  - Edit timestamp
- Crew notified of changes

**Adding Break Deductions**:
1. Open entry details
2. Click **"Add Break"**
3. Enter break duration (minutes)
4. Select paid or unpaid
5. Click **"Save"**
6. Total hours recalculated

**Common Adjustments**:
- Rounding clock-in time to scheduled start
- Correcting missing clock-out (based on GPS or crew confirmation)
- Adding meal break deduction (e.g., 30 minutes unpaid)
- Adjusting for auto clock-out triggered incorrectly

---

## For Payroll Administrators

### Generating Timesheets

**Timesheet Viewer**:
1. Navigate to **"Time"** > **"Timesheets"**
2. Select parameters:
   - User (individual crew or "All")
   - Period (day, week, bi-weekly, month, custom range)
   - Status (approved only, all)
3. Click **"Generate"**

**Timesheet Summary**:
- Total regular hours
- Total overtime hours
- Total hours (regular + OT)
- Number of jobs worked
- Breakdown by day
- Breakdown by job (optional)

**Timesheet Details**:
- List of all time entries
- Each entry shows:
  - Date
  - Job/customer
  - Clock-in time
  - Clock-out time
  - Duration
  - Regular hours
  - Overtime hours
  - Status (APPROVED)
  - Supervisor who approved

### Exporting Timesheets

**Export Formats**:

**CSV** (Excel-compatible):
1. Click **"Export"** > **"CSV"**
2. File downloads automatically
3. Filename: `timesheet-[user]-[period].csv`
4. Columns:
   - Date, Employee, Job, Clock In, Clock Out, Regular Hours, Overtime Hours, Total Hours, Status, Approved By

**PDF** (Printable):
1. Click **"Export"** > **"PDF"**
2. PDF generated and downloads
3. Formatted for printing
4. Includes:
   - Company header
   - Employee details
   - Period summary
   - Detailed time entries
   - Signatures (crew, supervisor, payroll)

**JSON** (API/Integration):
1. Click **"Export"** > **"JSON"**
2. Structured JSON file downloads
3. Use for payroll system integration
4. Example structure:
```json
{
  "employee": "John Smith",
  "period": "2025-09-23 to 2025-09-29",
  "summary": {
    "regularHours": 40.0,
    "overtimeHours": 5.5,
    "totalHours": 45.5
  },
  "entries": [...]
}
```

### Payroll Integration

**Direct Integration** (API):
- JobEye provides REST API for time entry data
- Endpoint: `GET /api/field-intelligence/time/timesheets`
- Returns approved time entries for specified period
- Parameters:
  - `userId` (optional, for specific employee)
  - `startDate` (ISO format)
  - `endDate` (ISO format)
  - `format` (json, csv, pdf)

**Automated Export**:
- Schedule automatic timesheet generation
- Email timesheets to payroll system
- Configure in Settings > Integrations > Payroll

**Supported Payroll Systems**:
- QuickBooks (CSV import)
- ADP (API integration)
- Paychex (CSV import)
- Gusto (API integration)
- Custom integrations available

### Labor Cost Analytics

**Cost Dashboard**:
1. Navigate to **"Analytics"** > **"Labor Costs"**
2. View metrics:
   - Total labor cost (period)
   - Regular pay
   - Overtime pay
   - Labor utilization rate
   - Cost per job
   - Average hourly rate

**Labor Cost Chart**:
- Visualize labor costs over time
- Compare regular vs overtime costs
- Identify cost trends
- Export data for further analysis

**Overtime Alerts**:
- Notification when employee nearing daily/weekly OT threshold
- Alert when overtime exceeds company policy (e.g., >20% of hours)
- Used to control labor costs

**Labor Forecasting**:
- Predict labor costs for upcoming period
- Based on:
  - Scheduled jobs
  - Average job durations
  - Historical overtime rates
- Helps with budgeting and scheduling

---

## Best Practices

### For Crews

**Accurate Time Tracking**:
- ✅ Clock in immediately when starting work
- ✅ Clock out immediately when finished
- ✅ Clock out for unpaid meal breaks
- ✅ Verify clock-in/out confirmations appear
- ❌ Don't clock in before arriving at job site
- ❌ Don't forget to clock out
- ❌ Don't clock in for another crew member

**Overtime Management**:
- Be aware of daily/weekly OT thresholds
- Communicate with supervisor if job will exceed estimate
- Don't work unauthorized overtime

**Troubleshooting**:
- If clock in/out fails, try again immediately
- Take screenshot of error if issue persists
- Contact supervisor if unable to clock in/out
- Supervisor can manually create time entry

### For Supervisors

**Approval Workflow**:
- Review pending entries daily (not weekly)
- Clear queue before payroll cutoff
- Investigate all flagged entries (don't auto-approve)
- Provide clear feedback on rejections

**Communication**:
- Contact crew directly for discrepancies
- Don't reject without explanation
- Be available for crew questions
- Trust crew but verify unusual entries

**Documentation**:
- Add notes to time entry edits
- Document reasons for adjustments
- Keep records of verbal confirmations
- Use GPS breadcrumbs for verification

### For Payroll Administrators

**Payroll Processing**:
- Only export approved time entries
- Verify totals before processing
- Cross-check overtime calculations
- Audit random sample of entries

**Compliance**:
- Ensure breaks properly deducted per state law
- Verify overtime calculated correctly (federal/state rules)
- Maintain time entry records per retention requirements
- Generate audit reports quarterly

---

## Troubleshooting

### Clock In Button Disabled

**Possible Reasons**:
- Already clocked in to another job
- Job hasn't started yet (check scheduled time)
- Job has been cancelled
- Location permission denied

**Solutions**:
1. Check "My Time" to see current clock-in status
2. Clock out of other job if applicable
3. Verify job schedule with dispatcher
4. Check location permissions in device settings

### Auto Clock-Out Triggered Incorrectly

**Example**: Auto-clocked out but still at job site

**Causes**:
- GPS inaccuracy (showed you leaving when you didn't)
- Idle detection triggered (phone not moving)
- Phone lost signal (appeared offline)

**Solutions**:
1. Clock back in immediately
2. Note issue in time entry
3. Contact supervisor to explain
4. Supervisor can merge time entries or adjust times

### Missing Time Entries

**Symptoms**: Clocked in/out but entry not showing

**Solutions**:
1. Check if in offline mode (orange indicator)
2. Open app to trigger sync
3. Wait a few minutes for sync to complete
4. Contact supervisor if still missing
5. Supervisor can manually create entry based on GPS breadcrumbs

### Time Entry Shows Wrong Duration

**Example**: Worked 8 hours, shows 6 hours

**Causes**:
- Forgot to clock out (auto clock-out triggered early)
- Break deducted incorrectly
- Clock-in/out time adjusted by supervisor

**Solutions**:
1. Review time entry details
2. Check for supervisor notes/edits
3. Contact supervisor to discuss
4. Provide context (GPS, photos, work completed)
5. Supervisor can adjust time

### Overtime Not Calculated

**Example**: Worked 10 hours, all shows as regular time

**Causes**:
- Company overtime policy different than expected
- Overtime calculated weekly (not daily)
- Overtime threshold misconfigured

**Solutions**:
1. Verify company OT policy with HR
2. Check weekly totals (OT may apply at week end)
3. Contact payroll if OT still missing

---

## Time Tracking FAQs

**Q: Do I need to clock in for each job?**
A: Yes, you must clock in/out for each separate job. Helps track time per job and ensures accurate GPS verification.

**Q: Can I clock in before arriving at the job site?**
A: No. Clock-in is restricted to job site geofence (typically 200m). Prevents time theft and ensures GPS accuracy.

**Q: What if I forget to clock out?**
A: Auto clock-out will trigger after 30 minutes of idle time or when you leave the geofence. Contact supervisor to confirm actual end time.

**Q: How long does it take for time entries to be approved?**
A: Depends on supervisor workflow. Typical: 24-48 hours. Must be approved before payroll cutoff (usually Friday noon).

**Q: Can I edit my time entries?**
A: No, crew members cannot edit time entries. Contact supervisor to request adjustments.

**Q: What if GPS location is wrong?**
A: GPS accuracy is shown with each entry. If <100m accuracy, location is generally reliable. Discuss with supervisor if significantly off.

**Q: Do I get paid for drive time between jobs?**
A: Depends on company policy. Typically, drive time between jobs is paid. Check with HR.

**Q: What if I work through lunch without clocking out?**
A: Some companies auto-deduct lunch break. Check your company policy. If no auto-deduction and you didn't take break, notify supervisor.

**Q: Can I see my coworkers' time entries?**
A: No. You can only see your own time entries. Supervisors see all crew time entries.

**Q: How far back can I view my time entries?**
A: All time entries are available for the current year. Previous years available via export request.

---

## Compliance and Legal

### Fair Labor Standards Act (FLSA)

JobEye time tracking helps ensure FLSA compliance:
- **Record Keeping**: All clock-in/out times recorded with GPS verification
- **Overtime**: Automatic calculation based on federal/state rules
- **Minimum Wage**: Total hours tracked for wage calculation
- **Youth Employment**: Limits enforceable (if configured)

**Audit Trail**:
- All time entries immutable once approved
- Edits logged with supervisor name and reason
- GPS breadcrumbs retained for verification
- Export data for DOL audits

### State-Specific Rules

**California**:
- Daily overtime after 8 hours
- Double-time after 12 hours
- Meal break requirements enforced

**New York**:
- Spread of hours rules
- Weekly overtime after 40 hours

**Other States**:
- JobEye configurable for state-specific rules
- Contact support for state-specific configuration

### Employee Rights

**Access to Time Records**:
- Employees can view all their time entries
- Export personal timesheet data anytime
- Request corrections from supervisor

**Privacy**:
- GPS tracked only when clocked in
- Location data not shared outside company
- Compliant with privacy regulations

---

## Support

**Need Help?**
- Email: support@jobeye.com
- In-app: Help > Time Tracking > Contact Support
- Phone: 1-800-JOBEYE-1

**Payroll Issues?**
- Email: payroll@jobeye.com
- For missing time entries, incorrect calculations, or integration issues

---

**Document Version**: 1.0
**Last Updated**: 2025-09-30
**Maintained By**: JobEye Documentation Team
