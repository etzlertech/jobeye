# Supervisor Approval Guide

**Version**: 1.0
**Last Updated**: 2025-09-30
**Audience**: Supervisors responsible for reviewing and approving crew work and time entries

---

## Overview

As a supervisor, you review crew work quality, approve time entries, monitor safety compliance, and ensure job standards are met. This guide covers all supervisor approval workflows in JobEye.

---

## Time Entry Approval

### Viewing Approval Queue

**Access Approval Queue**:
1. Log in to JobEye
2. Click **"Approvals"** in the navigation
3. See all pending time entries requiring approval

**Queue Organization**:
- Entries sorted by oldest first (FIFO)
- Filter by:
  - Date range
  - Crew member
  - Job
  - Status (pending, approved, rejected)
  - Flagged (discrepancies detected)

**Entry Details**:
Each entry shows:
- Crew member name
- Job/customer name
- Clock-in time and location
- Clock-out time and location
- Total hours (regular + overtime)
- Discrepancy flags (if any)

### Approving Time Entries

**Single Approval**:
1. Review entry details
2. Verify:
   - Clock-in/out times reasonable
   - Location matches job site
   - No discrepancies flagged
3. Check the entry checkbox
4. Click **"Approve (1)"**
5. Entry moves to approved status

**Bulk Approval**:
1. Check multiple entry checkboxes
2. Click **"Approve (X)"** where X is the count
3. Confirm bulk approval
4. All selected entries approved

**Select All**:
- Click checkbox in header to select all on current page
- Use for approving clean entries quickly
- Review flagged entries individually

### Understanding Discrepancy Flags

Entries flagged with ⚠️ require closer review. Common flags:

**⏱️ Long Duration**:
- Time entry exceeds expected job duration by >50%
- Example: 2-hour job took 4+ hours
- **Action**: Review with crew, approve if justified, or adjust time

**📍 Location Mismatch**:
- Clock-in/out location doesn't match job site
- Distance >200 meters from property
- **Action**: Verify with crew, could be parking location or error

**📅 Outside Schedule**:
- Clock-in before scheduled start time (>30 min early)
- Clock-out after scheduled end time
- **Action**: Confirm with crew or dispatcher

**🔴 Missing Clock-Out**:
- Crew clocked in but didn't clock out
- Auto clock-out triggered
- **Action**: Contact crew to confirm actual end time

**⏸️ Long Break**:
- Gap between clock-out and next clock-in unusually long
- Potential unpaid break not accounted for
- **Action**: Verify break duration, adjust if needed

**🌙 After Hours**:
- Time entry outside normal business hours
- Could be overtime or emergency work
- **Action**: Confirm work was authorized

### Rejecting Time Entries

**When to Reject**:
- Clock-in time incorrect
- Location doesn't match job site (and can't be verified)
- Duplicate entry
- Unauthorized overtime
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
4. Add notes explaining rejection
5. Click **"Confirm Rejection"**

**After Rejection**:
- Crew member notified immediately
- Entry returns to pending with rejection reason visible
- Crew can correct and resubmit
- Corrected entry appears back in your queue

### Editing Time Entries

**Adjusting Times**:
1. Click entry to open details
2. Click **"Edit Times"**
3. Adjust clock-in or clock-out time
4. Add reason for adjustment
5. Click **"Save & Approve"**

**Adding Break Deductions**:
1. Open entry details
2. Click **"Add Break"**
3. Enter break duration (minutes)
4. Select paid/unpaid
5. Save

**Notes**:
- All edits are logged with your name and timestamp
- Crew member notified of changes
- Original times preserved for audit

---

## Job Completion Review

### Viewing Completed Jobs

**Jobs Pending Review**:
1. Navigate to **"Jobs"** > **"Pending Review"**
2. See all jobs marked complete by crews
3. Filter by:
   - Date range
   - Crew
   - Service type
   - Verification score (if AI verification enabled)

**Job Details**:
Click any job to review:
- Tasks completed
- Photos uploaded
- Safety checklist status
- Time on site
- AI completion score (if enabled)
- Customer notes

### Reviewing Work Quality

**Task Review**:
- See all tasks entered by crew
- Voice-transcribed tasks show original audio
- Verify tasks match service requirements
- Edit/add tasks if needed

**Photo Review**:
- View all before/after photos
- Check photo quality and coverage
- Verify work completed as specified
- Look for issues or concerns

**AI Verification Score**:
- Score of 0-100 indicates completion quality
- Scores <70 flagged for review
- Based on photo analysis of completed work
- Click "View Analysis" to see AI reasoning

### Approving Job Completion

**Standard Approval**:
1. Review job details
2. Verify all tasks completed
3. Check photos and safety compliance
4. Click **"Approve Completion"**
5. Job status updates to "Approved"

**Approval with Notes**:
1. Review job
2. Click **"Approve with Notes"**
3. Add feedback (e.g., "Great job, customer will love it!")
4. Notes visible to crew
5. Click **"Approve"**

**Request Rework**:
1. Review job and identify issues
2. Click **"Request Rework"**
3. Select tasks needing rework
4. Add detailed instructions
5. Upload reference photos if helpful
6. Click **"Send to Crew"**
7. Job status changes to "Rework Required"
8. Crew receives notification

**Reject Completion**:
- Use for major quality issues
- Job returns to "In Progress"
- Requires crew to redo significant work
- Should be rare if standards are clear

---

## Safety Compliance Monitoring

### Viewing Safety Checklists

**Checklist Dashboard**:
1. Navigate to **"Safety"** > **"Checklists"**
2. See completion rates for:
   - Today
   - This week
   - This month
3. View pending and completed checklists

**Checklist Details**:
Click any checklist to review:
- All items checked off
- Photos uploaded for required items
- Completion time
- Location of completion
- Crew member who completed

### Reviewing Photo Proof

**Photo Requirements**:
- Items marked 📷 require photo proof
- Common examples:
  - PPE worn (hard hat, safety glasses, gloves)
  - Safety cones placed
  - Equipment secured
  - Hazard mitigation
- Photos must be clear and show compliance

**Verification**:
1. Open checklist with photo items
2. Click photo thumbnails to view full size
3. Verify photo shows required safety measure
4. Approve or request resubmit

**Requesting Better Photo**:
1. Click photo
2. Click **"Request Better Photo"**
3. Add note explaining what's needed
4. Crew receives notification
5. Checklist remains pending

### Safety Incident Reports

**Viewing Incidents**:
1. Navigate to **"Safety"** > **"Incidents"**
2. See all reported incidents
3. Filter by:
   - Severity (minor, moderate, severe)
   - Status (reported, investigating, resolved)
   - Date range

**Incident Details**:
- Type of incident
- Description from crew
- Photos of scene/injury
- Location and time
- Crew members involved
- Immediate actions taken

**Incident Response**:
1. Review incident report
2. Click **"Acknowledge"**
3. Update status:
   - **Investigating**: Gathering more info
   - **Resolved**: No further action needed
   - **Escalated**: Sent to management/safety officer
4. Add notes documenting actions taken
5. Schedule follow-up if needed

---

## Performance Monitoring

### Crew Performance Metrics

**Individual Crew Dashboard**:
1. Navigate to **"Crews"** > [Crew Name]
2. View metrics:
   - Jobs completed (today, week, month)
   - Average time per job type
   - Completion quality scores
   - Safety checklist compliance rate
   - Time entry accuracy
   - Customer feedback scores

**Identifying Issues**:
- Low completion scores (<80)
- Frequent time discrepancies
- Safety checklist non-compliance
- Customer complaints

**Coaching Opportunities**:
- High quality scores: Share best practices with team
- Improving trends: Recognize and encourage
- Voice transcription usage: Efficiency indicator

### Team Analytics

**Supervision Dashboard**:
1. Navigate to **"Analytics"** > **"Team Performance"**
2. View aggregate metrics:
   - Team completion rate
   - Average job duration by service type
   - Overtime trends
   - Safety compliance rate
   - Quality score distribution

**Reports**:
- Daily summary (emailed each morning)
- Weekly performance report
- Monthly trends analysis
- Export data to CSV/Excel

---

## Best Practices

### Time Approval Workflow

**Daily Routine**:
1. ✅ Review time entries each morning
2. ✅ Approve clean entries in bulk
3. ✅ Investigate flagged entries
4. ✅ Contact crews about discrepancies before noon
5. ✅ Aim to clear queue daily

**Efficiency Tips**:
- Use filters to focus on flagged entries first
- Approve bulk clean entries at end of day
- Set up notifications for urgent flags
- Review location on map for verification

**Discrepancy Handling**:
- Contact crew directly for clarification
- Check GPS breadcrumbs for location verification
- Compare to dispatcher schedule
- Trust crew but verify unusual entries

### Job Completion Review

**Quality Standards**:
- Define clear completion criteria per service type
- Use AI verification scores as guide, not absolute
- Review photos for thoroughness
- Check customer-facing areas carefully

**Feedback**:
- Provide specific, actionable feedback
- Recognize excellent work publicly
- Address issues privately and constructively
- Use rework requests sparingly

**Timeliness**:
- Review completed jobs within 24 hours
- Delayed reviews hold up invoicing
- Prioritize jobs with customer complaints

### Safety Oversight

**Proactive Monitoring**:
- Review safety checklists daily
- Address non-compliance immediately
- Investigate patterns (same crew/item skipped)
- Reinforce safety culture

**Photo Verification**:
- Be strict on photo requirements
- Photos protect crew and company
- Request better photos if unclear
- Don't approve if safety uncertain

**Incident Response**:
- Acknowledge incidents immediately
- Investigate thoroughly
- Document all actions
- Follow up with crew

---

## Troubleshooting

### Missing Time Entries

**Crew Says They Clocked In, But No Entry**:
1. Check if crew is in offline mode
2. Ask crew to open app (triggers sync)
3. Check crew's "My Time" section
4. If still missing, crew should resubmit

### Can't Approve Entry

**"Entry locked" Error**:
- Another supervisor is editing this entry
- Wait a moment and try again
- Contact other supervisor if urgent

### Discrepancy Flag Incorrect

**False Positive Flags**:
1. Review entry details
2. If flag is incorrect, approve anyway
3. Report issue to admin to adjust thresholds
4. Common causes:
   - Job duration estimate too low
   - Parking location far from property
   - Schedule changed after job assigned

### Photos Not Loading

**Solutions**:
1. Check internet connection
2. Refresh page
3. Try different browser
4. Photos may still be uploading from crew device
5. Wait a few minutes and check again

---

## Keyboard Shortcuts

**Approval Queue**:
- `Space`: Check/uncheck selected entry
- `A`: Approve selected entries
- `R`: Reject selected entries
- `↓` / `↑`: Navigate entries
- `Enter`: Open entry details
- `Esc`: Close details

**General**:
- `Ctrl+F` / `Cmd+F`: Search
- `Ctrl+R` / `Cmd+R`: Refresh
- `/`: Focus search bar

---

## FAQs

**Q: How long do I have to approve time entries?**
A: Recommended within 24 hours. Required before payroll cutoff (typically Friday noon).

**Q: Can I approve my own time entries?**
A: No, time entries must be approved by a different supervisor or admin.

**Q: What if a crew member forgot to clock out?**
A: Entry will have auto clock-out time. Verify with crew and adjust if needed before approving.

**Q: Can I see historical approvals I've made?**
A: Yes, navigate to Approvals > Approved tab, filter by "Approved by: [Your Name]".

**Q: What happens if I accidentally reject an entry?**
A: Contact crew to resubmit. You can also undo rejection within 5 minutes (Approvals > Recently Rejected).

**Q: How do I know if a crew's location is accurate?**
A: Click the location pin to view on map. Check GPS accuracy (shown in meters). <50m is reliable.

**Q: Should I always investigate flagged entries?**
A: Yes, flags indicate potential issues. Most have valid explanations, but always verify.

**Q: Can I adjust overtime after approval?**
A: Yes, but requires admin permissions. Contact admin to edit approved entries.

**Q: What's the difference between "Approve" and "Approve with Notes"?**
A: Both approve the entry. Notes provide feedback to crew member.

**Q: How often should I review job completions?**
A: Daily is recommended. At minimum, before invoicing customers.

---

## Support

**Need Help?**
- Email: support@jobeye.com
- In-app: Help > Contact Support
- Phone: 1-800-JOBEYE-1

**Training Resources**:
- Video tutorials: Help > Training Videos
- Supervisor handbook: help.jobeye.com/supervisors
- Monthly supervisor training webinars

---

**Document Version**: 1.0
**Last Updated**: 2025-09-30
**Maintained By**: JobEye Documentation Team
