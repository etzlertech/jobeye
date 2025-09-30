# GPS Tracking Guide

**Version**: 1.0
**Last Updated**: 2025-09-30
**Audience**: All JobEye users (field crews, dispatchers, supervisors)

---

## Overview

JobEye uses GPS tracking to automatically detect job arrivals/departures, verify work locations, optimize routes, and enhance crew safety. This guide explains how GPS tracking works, privacy policies, and troubleshooting.

---

## How GPS Tracking Works

### When Tracking Occurs

**Active Tracking** (Only When Clocked In):
- GPS location captured every **30 seconds**
- Tracking starts when crew clocks in
- Tracking stops when crew clocks out
- **No tracking occurs outside work hours**

**Tracking Disabled**:
- When not clocked in
- When location permissions denied
- In airplane mode or offline (queued for later sync)
- After manual clock-out or auto clock-out

### What Data is Collected

**Location Data**:
- Latitude and longitude coordinates
- Timestamp
- GPS accuracy (in meters)
- Speed (if moving)

**Additional Context**:
- Associated job ID
- Crew member ID
- Clock-in/out status
- Battery level (optional, for offline detection)

### Data Storage and Privacy

**Security**:
- All GPS data encrypted in transit and at rest
- Multi-tenant isolation (your company data only)
- Supabase Row Level Security enforced
- No third-party sharing

**Retention**:
- Active tracking data: 90 days
- Historical aggregates: 1 year
- After retention period: Automatically deleted

**Privacy Policy**:
- GPS tracking only during work hours
- Location not tracked when off the clock
- Crew members can see their own tracking data
- Supervisors/dispatchers see crew locations only when clocked in

---

## For Field Crews

### Enabling GPS Tracking

**Initial Setup (iOS)**:
1. Open iOS Settings
2. Navigate to JobEye app
3. Tap **"Location"**
4. Select **"While Using the App"**
5. Enable **"Precise Location"**

**Initial Setup (Android)**:
1. Open Android Settings
2. Navigate to Apps > JobEye
3. Tap **"Permissions"**
4. Tap **"Location"**
5. Select **"Allow only while using the app"**
6. Enable **"Use precise location"**

**Background Location** (Optional for Auto Clock-Out):
- iOS: Select "Always" for location permission
- Android: Select "Allow all the time"
- This enables geofence-based auto clock-out when you leave job site
- Not required but highly recommended

### How Crews Experience GPS Tracking

**Clock In**:
- Tap "Clock In" button
- GPS location captured immediately
- Location shown on job screen
- Accuracy displayed (e.g., "Accurate to 15m")

**During Work**:
- GPS updates every 30 seconds in background
- No action required from crew
- Location icon appears in status bar
- Battery impact minimal (<5% per hour)

**Job Arrival Detection**:
- When you arrive within 50m of job site, automatic detection triggers
- Notification: "Arrived at [Customer Name]"
- Job status updates to "In Progress"
- No manual action needed

**Job Departure Detection**:
- When you leave 100m+ from job site, departure detected
- Auto clock-out triggered (if enabled)
- Notification: "Auto-clocked out - left job site"
- Time entry created automatically

### Viewing Your Location Data

**Current Location**:
1. Open JobEye app
2. See your location on job map
3. Blue dot shows your current position
4. Accuracy radius displayed

**GPS Breadcrumbs**:
1. Navigate to **"My Time"** > **"Today"**
2. Click any time entry
3. Tap **"View Route"**
4. See your GPS trail for that shift
5. Useful for verifying time and location

### Troubleshooting for Crews

**"GPS unavailable" Warning**:
- Check location permissions (Settings > JobEye > Location)
- Ensure location services enabled globally (Settings > Privacy > Location Services)
- Move to area with clearer sky view
- Restart app

**Arrival Not Detected**:
- Ensure you're within 50m of property
- Wait 30 seconds for next GPS update
- Check GPS accuracy (<50m is good)
- Manually tap "I've Arrived" if needed

**High Battery Drain**:
- Normal: 3-5% per hour when tracking
- High drain (>10%/hr) troubleshooting:
  - Close other location-using apps
  - Ensure app is updated to latest version
  - Check for iOS/Android OS updates
  - Restart device

**Location Inaccurate**:
- GPS accuracy depends on:
  - Sky visibility (buildings/trees block signal)
  - Number of satellites visible
  - Weather conditions
- Best accuracy: Open areas, clear sky
- Accuracy shown in meters (<20m is excellent)

---

## For Dispatchers

### Viewing Crew Locations

**Real-Time Map**:
1. Navigate to **"Dashboard"** or **"Crews"**
2. Enable map view
3. See all clocked-in crews' live locations
4. Blue dots = crew current position
5. Color-coded pins = job locations

**Crew Details**:
- Click crew marker on map
- See:
  - Crew member name
  - Current job
  - Time at location
  - Distance to next job
  - ETA to next job

**GPS Breadcrumbs**:
1. Click crew on map
2. Select **"View Route"**
3. See historical GPS trail
4. Filter by:
   - Date range
   - Specific job
   - Time of day

**Route Verification**:
- Compare actual route taken vs optimized route
- Identify route deviations
- Calculate actual distance traveled
- Useful for mileage reimbursement

### Monitoring Crew Progress

**Job Arrival Monitoring**:
- See real-time crew arrivals on dashboard
- Notification when crew enters job geofence
- Compare actual arrival vs scheduled time
- Track on-time performance

**Distance to Next Job**:
- See crew location relative to next scheduled job
- Calculate ETA based on current location
- Useful for adjusting schedules dynamically

**Idle Detection**:
- System detects no movement for 30+ minutes
- Flags crew as potentially idle
- Could indicate break, issue, or GPS problem
- Contact crew to verify status

### Geofence Configuration

**Property Boundaries**:
1. Navigate to **"Properties"** > [Select Property]
2. Click **"Edit Boundaries"**
3. Options:
   - **Circular**: Set radius (default 50m)
   - **Polygon**: Draw custom boundary on map
4. Click **"Save"**

**Arrival/Departure Thresholds**:
- **Arrival**: 50 meters (customizable per property)
- **Departure**: 100 meters (customizable per property)
- Adjust for:
  - Large properties: Increase arrival threshold
  - Urban areas with parking: Increase both thresholds
  - High accuracy needs: Decrease thresholds

---

## For Supervisors

### GPS Data for Time Verification

**Verifying Clock-In Location**:
1. Open time entry in approval queue
2. See clock-in location on map
3. Verify location matches job site
4. Check GPS accuracy (shown in meters)

**Location Discrepancy Flags**:
- System flags if clock-in >200m from job site
- Common valid reasons:
  - Crew parked on street
  - Large property
  - GPS accuracy low at time of clock-in
- Invalid reasons:
  - Clocked in from home
  - Clocked in for different job

**GPS Breadcrumb Review**:
1. Open time entry
2. Click **"View Route"**
3. See crew's GPS trail during shift
4. Verify:
   - Started at job site
   - Stayed at job site
   - Left job site at clock-out time

**Distance Calculation**:
- System calculates total distance traveled during shift
- Useful for mileage reimbursement
- Based on GPS breadcrumbs
- Accuracy: ±5% typically

### Geofence Event Monitoring

**Viewing Geofence Events**:
1. Navigate to **"Analytics"** > **"Geofence Events"**
2. See all arrival/departure events
3. Filter by:
   - Date range
   - Crew
   - Job/property
   - Event type (arrival/departure)

**Event Details**:
- Timestamp
- GPS coordinates
- Crew member
- Job associated
- Event type

**Anomaly Detection**:
- Multiple departures/arrivals (crew leaving and returning)
- Very short time on site (<10 minutes)
- Arrival without corresponding departure
- Use to identify:
  - Forgotten items (returned to shop)
  - Customer interruptions
  - GPS issues

---

## Technical Details

### GPS Accuracy

**Accuracy Levels**:
- **Excellent**: <10 meters
- **Good**: 10-20 meters
- **Fair**: 20-50 meters
- **Poor**: 50-100 meters
- **Very Poor**: >100 meters

**Factors Affecting Accuracy**:
- ✅ Number of GPS satellites visible
- ✅ Sky visibility (open areas = better)
- ❌ Buildings, trees, tunnels (block signal)
- ❌ Weather (heavy clouds, storms)
- ❌ Urban canyons (tall buildings)
- ❌ Indoor locations

**Accuracy Filtering**:
- JobEye only records GPS points with accuracy <100m
- Points with accuracy >100m are discarded
- Prevents inaccurate data from affecting geofence detection

### Distance Calculation

**Haversine Formula**:
JobEye uses the Haversine formula to calculate distance between GPS coordinates:
```
d = 2 * R * arcsin(√(sin²(Δφ/2) + cos(φ1) * cos(φ2) * sin²(Δλ/2)))
```
Where:
- R = Earth radius (6,371 km)
- φ = latitude in radians
- λ = longitude in radians

**Accuracy**:
- Accurate to ±0.5% for distances <1000km
- Accounts for Earth's curvature
- More accurate than simple Pythagorean distance

### Geofence Detection

**Ray Casting Algorithm** (for polygon geofences):
- Determines if GPS point is inside polygon boundary
- Casts ray from point to infinity
- Counts intersections with polygon edges
- Odd intersections = inside, even = outside

**Circular Geofences**:
- Simple distance calculation from center point
- If distance < radius → inside geofence
- If distance > radius → outside geofence

**Event Deduplication**:
- Multiple arrival events within 5 minutes are deduplicated
- Prevents notification spam from GPS jitter
- First event is recorded, subsequent events ignored

### Offline GPS Queue

**How Offline Queueing Works**:
1. When offline, GPS points stored in device IndexedDB
2. Queue capacity: 1,000 points (≈8 hours of tracking)
3. When back online, queued points uploaded
4. Batch upload (50 points at a time)
5. Queue cleared after successful upload

**Queue Indicator**:
- Orange badge shows pending GPS points
- Example: "24 GPS points queued"
- Tap to see queue details
- Auto-syncs when connection restored

**Queue Overflow**:
- If queue reaches 1,000 points, oldest points dropped
- Rare scenario (requires 8+ hours offline)
- Warning notification shown

---

## Best Practices

### For Crews

**Battery Management**:
- Keep phone charged (GPS uses 3-5% battery per hour)
- Bring portable charger for long days
- Enable low power mode if battery <20% (GPS still works)

**GPS Accuracy**:
- Keep phone in pocket or belt holster (not bag/truck)
- Avoid keeping phone in metal toolbox
- Periodically check GPS accuracy in app

**Manual Overrides**:
- Use "I've Arrived" if auto-detection fails
- Manually clock out if auto clock-out doesn't trigger
- Report GPS issues to supervisor

### For Dispatchers

**Route Optimization**:
- Use GPS breadcrumbs to analyze actual routes taken
- Identify inefficient route patterns
- Adjust future optimizations based on real data

**Schedule Adjustments**:
- Monitor crew progress via GPS
- Adjust schedules dynamically if crew running late
- Notify customers proactively

**Geofence Tuning**:
- Adjust thresholds based on property characteristics
- Larger properties = larger geofence
- Dense urban areas = smaller geofence (avoid false triggers)

### For Supervisors

**Time Verification**:
- Use GPS as one factor in verification (not sole factor)
- Consider GPS accuracy when reviewing location
- Trust crew but verify unusual patterns

**Privacy Respect**:
- Only view GPS data when necessary for verification
- Don't monitor crew locations obsessively
- Focus on results, not real-time surveillance

---

## Troubleshooting

### Common Issues

**Issue**: "Location permission denied"
**Solution**:
1. Open device Settings
2. Find JobEye app
3. Enable location permission
4. Select "While Using App" or "Always"

**Issue**: Frequent "GPS unavailable" warnings
**Solution**:
1. Check for iOS/Android updates
2. Reset location services (Settings > Privacy > Location Services > System Services > Reset)
3. Reinstall JobEye app (data preserved)

**Issue**: Auto clock-out not triggering
**Solution**:
1. Verify background location permission enabled ("Always")
2. Ensure app not forced closed
3. Check battery optimization settings (exclude JobEye)

**Issue**: Location accuracy always "Poor" (>50m)
**Solution**:
1. Enable "Precise Location" in settings
2. Move to area with clearer sky view
3. Restart device to refresh GPS
4. Check for GPS hardware issues

**Issue**: GPS points not uploading from offline queue
**Solution**:
1. Verify internet connection restored
2. Open JobEye app (triggers sync)
3. Wait 1-2 minutes for batch upload
4. Check queue status in app

---

## Compliance and Legal

### Data Privacy Compliance

**GDPR Compliance** (EU):
- GPS data classified as personal data
- Crew members have right to access their data
- Data retention limited to 90 days
- Data deletion upon request

**CCPA Compliance** (California):
- Crew members can request data export
- Opt-out available (requires admin approval)
- Data not sold to third parties

**Labor Law Compliance**:
- GPS tracking only during work hours
- No tracking during breaks (if manually clocked out)
- No tracking outside work hours

### Employee Rights

**Crew Member Rights**:
- ✅ View own GPS data anytime
- ✅ Request data export (CSV format)
- ✅ Question location discrepancies
- ✅ Request data deletion (with admin approval)
- ❌ Cannot disable GPS while clocked in (policy enforcement)

**Notification Requirements**:
- Crew members informed of GPS tracking in onboarding
- Consent obtained before app usage
- Tracking status visible in app at all times

---

## FAQs

**Q: Can my employer track me when I'm not working?**
A: No. GPS tracking only occurs when you're clocked in. No location data is collected outside work hours.

**Q: How much battery does GPS tracking use?**
A: Approximately 3-5% battery per hour. JobEye uses efficient background updates every 30 seconds.

**Q: Can I turn off GPS tracking?**
A: You can deny location permissions, but this will prevent you from clocking in, as GPS is required for job verification.

**Q: How accurate is GPS tracking?**
A: Typically 10-30 meters in open areas. Accuracy depends on sky visibility, satellite count, and environmental factors.

**Q: What happens if I lose cell signal?**
A: GPS points are queued locally and uploaded when connection restores. You can work offline without interruption.

**Q: Can supervisors see my location when I'm off the clock?**
A: No. Your location is only visible when you're clocked in and actively working.

**Q: How long is my GPS data stored?**
A: Active tracking data is retained for 90 days, then automatically deleted. Aggregates (total distance, etc.) are kept for 1 year.

**Q: What if GPS shows the wrong location?**
A: GPS accuracy is displayed with each point. If accuracy is poor (>50m), this is noted. You can contest location discrepancies with your supervisor.

**Q: Does GPS tracking work indoors?**
A: Limited. GPS signal is weak indoors. Best used for outdoor work. Indoor jobs may require manual check-in.

**Q: Can I request my GPS data?**
A: Yes. Navigate to Settings > Privacy > Export My Data. You'll receive a CSV file with all your GPS data.

---

## Support

**Need Help?**
- Email: support@jobeye.com
- In-app: Help > Contact Support
- Phone: 1-800-JOBEYE-1

**Privacy Concerns?**
- Email: privacy@jobeye.com
- Data export requests: privacy@jobeye.com

---

**Document Version**: 1.0
**Last Updated**: 2025-09-30
**Maintained By**: JobEye Documentation Team
