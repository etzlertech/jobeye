# System Configuration Guide

**Version**: 1.0
**Last Updated**: 2025-09-30
**Audience**: System administrators and IT managers

---

## Overview

This guide covers the configuration and administration of JobEye for your organization. Topics include company settings, feature toggles, integrations, security, and system maintenance.

---

## Initial Setup

### Company Profile

**Accessing Company Settings**:
1. Log in as Admin
2. Navigate to **Settings** > **Company Profile**
3. Complete required fields

**Required Information**:
- **Company Name**: Legal business name
- **Business Type**: Landscape, lawn care, tree service, etc.
- **Primary Address**: Main office location
- **Phone Number**: Main business phone
- **Email**: Admin contact email
- **Time Zone**: Default for all timestamps
- **Business Hours**: Default operating hours (e.g., 7:00 AM - 6:00 PM)

**Optional Information**:
- Company logo (uploaded image)
- Website URL
- Tax ID / EIN
- License numbers
- Insurance information

**Branding**:
- Upload company logo (PNG/JPG, max 2MB)
- Logo appears on:
  - Customer-facing documents
  - Mobile app (crew view)
  - Timesheet exports
  - Email notifications

### Company Hierarchy

**Multi-Location Setup**:
1. Navigate to **Settings** > **Locations**
2. Click **"Add Location"**
3. Enter:
   - Location name
   - Address
   - Manager (user assignment)
   - Phone number
   - Operating hours (if different from company default)

**Branch/Division Structure**:
- Create branches for multi-location companies
- Each branch can have its own:
  - Crews
  - Equipment
  - Service areas
  - Pricing
- Reporting rolls up to company level

---

## Feature Configuration

### Field Intelligence Features

**GPS Tracking**:
1. Navigate to **Settings** > **Field Intelligence** > **GPS Tracking**
2. Configure:
   - **Tracking Interval**: 30 seconds (default), 15-60 seconds
   - **Accuracy Threshold**: 100m (default), 50-200m
   - **Offline Queue Size**: 1000 points (default), 500-2000
   - **Geofence Arrival Threshold**: 50m (default), 25-100m
   - **Geofence Departure Threshold**: 100m (default), 50-200m

**Auto Clock-Out Settings**:
1. Navigate to **Settings** > **Time Tracking** > **Auto Clock-Out**
2. Configure:
   - **Geofence Exit**: Enabled/Disabled
   - **Geofence Exit Delay**: 5 minutes (default), 1-15 minutes
   - **Idle Detection**: Enabled/Disabled
   - **Idle Threshold**: 30 minutes (default), 15-60 minutes
   - **End of Day**: Enabled (always), time: 11:59 PM

**Route Optimization**:
1. Navigate to **Settings** > **Routing** > **Optimization**
2. Configure:
   - **Mapbox API Key**: Required for optimization
   - **Daily Limit**: 1 per dispatcher (Mapbox free tier)
   - **Fallback Algorithm**: Greedy nearest-neighbor (enabled by default)
   - **Optimization Objectives**: Minimize distance, minimize time, balance both

**Safety Checklists**:
1. Navigate to **Settings** > **Safety** > **Checklists**
2. Configure:
   - **Require Photo Proof**: By item, by category, or all
   - **Block Job Completion**: Until checklist complete (recommended: ON)
   - **Supervisor Notification**: Immediate, daily summary, or off
   - **Compliance Threshold**: Alert when compliance <X% (default 95%)

**Voice Commands**:
1. Navigate to **Settings** > **Voice** > **Configuration**
2. Configure:
   - **Voice Features**: Enabled/Disabled
   - **AI Task Parsing**: Enabled/Disabled
   - **Language**: English (more coming soon)
   - **Confidence Threshold**: 70% (default), 60-90%
   - **Voice Audio Retention**: 30 days (default), 7-90 days

---

## Time Tracking Configuration

### Overtime Rules

**Daily Overtime**:
1. Navigate to **Settings** > **Time Tracking** > **Overtime**
2. Select **"Daily Overtime"**
3. Configure:
   - **Threshold**: 8 hours (default), 8-12 hours
   - **Multiplier**: 1.5x (default), 1.5-2.0x
   - **Double Time Threshold**: 12 hours (optional)

**Weekly Overtime**:
1. Select **"Weekly Overtime"**
2. Configure:
   - **Threshold**: 40 hours (default), 35-40 hours
   - **Multiplier**: 1.5x

**State-Specific Rules**:
- Pre-configured templates for:
  - California (daily OT, double time, meal breaks)
  - New York (spread of hours)
  - Other states
- Select your state for automatic configuration

### Break Policies

**Meal Breaks**:
1. Navigate to **Settings** > **Time Tracking** > **Breaks**
2. Configure:
   - **Auto-Deduct**: Enabled/Disabled
   - **Break Duration**: 30 minutes (default), 15-60 minutes
   - **Trigger**: After X hours (e.g., after 5 hours worked)
   - **Paid/Unpaid**: Unpaid (default)

**Rest Breaks**:
- **Paid Short Breaks**: 5-15 minutes, no clock-out required
- **Unpaid Meal Breaks**: 30+ minutes, clock-out required

**State Compliance**:
- California: Auto-deduct 30-min meal break after 5 hours
- Enable in settings for California employees

### Time Entry Approvals

**Approval Workflow**:
1. Navigate to **Settings** > **Time Tracking** > **Approvals**
2. Configure:
   - **Require Approval**: All entries, flagged only, or none
   - **Auto-Approve After**: X days (e.g., 7 days for unclaimed entries)
   - **Approval Hierarchy**: Direct supervisor, any supervisor, manager only
   - **Payroll Cutoff**: Day and time (e.g., Friday 5:00 PM)

**Discrepancy Detection**:
- **Long Duration**: Flag if >50% over estimate
- **Location Mismatch**: Flag if >200m from job site
- **Outside Schedule**: Flag if >30 min before/after scheduled time
- **After Hours**: Flag if before 6 AM or after 8 PM
- Adjust thresholds in Settings > Time Tracking > Discrepancies

---

## Security & Access Control

### User Roles

**Standard Roles**:
1. **Admin**: Full system access, all settings
2. **Manager**: View all data, limited settings access
3. **Supervisor**: Approve time, view crew data, cannot change settings
4. **Dispatcher**: Schedule jobs, assign crews, view locations
5. **Field Crew**: Clock in/out, complete jobs, limited visibility

**Custom Roles**:
1. Navigate to **Settings** > **Users** > **Roles**
2. Click **"Create Custom Role"**
3. Name the role (e.g., "Safety Coordinator")
4. Select permissions:
   - View permissions (read-only)
   - Edit permissions (modify data)
   - Delete permissions (remove data)
   - Admin permissions (system settings)
5. Save role

**Granular Permissions**:
- Jobs (view, create, edit, delete)
- Time entries (view, approve, edit, export)
- Customers (view, create, edit, delete)
- Reports (view, export)
- Settings (company, users, integrations, billing)

### Multi-Tenant Security

**Row Level Security (RLS)**:
- Enabled by default on all database tables
- Ensures data isolation between companies
- No configuration needed (automatic)

**Tenant Isolation**:
- Each company's data is isolated at database level
- Company ID injected in all queries
- Cross-tenant data leakage prevented

**Admin Bypass** (Support Only):
- JobEye support can access any company (with permission)
- All actions logged
- Used for technical support only

### Authentication

**Login Methods**:
1. **Email/Password**: Standard login (default)
2. **SSO (Single Sign-On)**: SAML, OAuth (enterprise plans)
3. **Multi-Factor Authentication (MFA)**: SMS, authenticator app

**Configuring MFA**:
1. Navigate to **Settings** > **Security** > **MFA**
2. Enable **"Require MFA for all users"**
3. Select method:
   - SMS (text message code)
   - Authenticator app (Google Authenticator, Authy, etc.)
   - Both (user choice)
4. Grace period: 7 days (users must enable within 7 days)

**Password Policy**:
1. Navigate to **Settings** > **Security** > **Password Policy**
2. Configure:
   - **Minimum Length**: 8 characters (default), 8-16
   - **Require Uppercase**: Yes/No
   - **Require Numbers**: Yes/No
   - **Require Symbols**: Yes/No
   - **Password Expiration**: 90 days (default), 30-365 or never
   - **Prevent Reuse**: Last 5 passwords (default), 0-10

### API Access

**API Keys**:
1. Navigate to **Settings** > **Integrations** > **API Keys**
2. Click **"Generate New Key"**
3. Name the key (e.g., "Payroll Integration")
4. Select permissions:
   - Read-only
   - Read/write
   - Full access
5. Set expiration (30 days, 90 days, 1 year, never)
6. Copy key (shown only once)

**Webhook Configuration**:
1. Navigate to **Settings** > **Integrations** > **Webhooks**
2. Click **"Add Webhook"**
3. Enter:
   - Webhook URL (your server endpoint)
   - Events to trigger webhook:
     - Job completed
     - Time entry approved
     - Safety incident reported
     - Customer created
   - Authentication (optional): API key, bearer token
4. Test webhook
5. Save

---

## Integration Configuration

### Mapbox (Route Optimization)

**Setup**:
1. Sign up for Mapbox account (free tier: 100,000 requests/month)
2. Create API token at mapbox.com/account
3. Navigate to **Settings** > **Integrations** > **Mapbox**
4. Paste API token
5. Test connection
6. Save

**Features Enabled**:
- Route optimization (directions API)
- Geocoding (address → coordinates)
- Map visualization

**Cost Management**:
- Daily optimization limit: 1 per dispatcher
- Enforced in application
- Alerts when approaching monthly limit

### OpenAI (AI Features)

**Setup**:
1. Sign up for OpenAI account
2. Create API key at platform.openai.com
3. Navigate to **Settings** > **Integrations** > **OpenAI**
4. Paste API key
5. Set budget cap (e.g., $100/month)
6. Save

**Features Enabled**:
- OCR document processing (GPT-4 Vision)
- Voice task parsing (GPT-4)
- Completion verification (GPT-4 Vision)
- Instruction search (embeddings)

**Cost Tracking**:
- Real-time cost monitoring
- Daily/monthly spending limits
- Alert when approaching cap
- Auto-disable when cap reached

### Payroll Systems

**QuickBooks**:
1. Navigate to **Settings** > **Integrations** > **QuickBooks**
2. Click **"Connect to QuickBooks"**
3. Authorize access (OAuth)
4. Map fields:
   - JobEye User → QuickBooks Employee
   - Job Type → QuickBooks Service Item
5. Configure sync:
   - Sync frequency: Daily, weekly, manual
   - What to sync: Time entries, invoices, customers
6. Test sync
7. Save

**ADP**:
1. Navigate to **Settings** > **Integrations** > **ADP**
2. Enter ADP API credentials
3. Map employee IDs (JobEye User ID → ADP Employee ID)
4. Configure sync settings
5. Test integration
6. Save

**Generic CSV Export**:
- For unsupported payroll systems
- Navigate to **Time** > **Export**
- Select date range and employees
- Export as CSV
- Import to your payroll system

### Accounting Systems

**Supported Integrations**:
- QuickBooks Online
- Xero
- FreshBooks

**Setup Process** (similar for all):
1. Navigate to **Settings** > **Integrations** > [System Name]
2. Authorize connection (OAuth)
3. Map accounts and items
4. Configure sync settings
5. Test integration

---

## System Maintenance

### Database Backups

**Automatic Backups**:
- Supabase performs automatic backups
- Frequency: Daily (full), hourly (incremental)
- Retention: 30 days
- No configuration required

**Manual Backups**:
1. Navigate to **Settings** > **System** > **Backups**
2. Click **"Create Manual Backup"**
3. Backup created and stored
4. Download backup file (optional)

**Restore from Backup**:
1. Contact support@jobeye.com
2. Provide backup date/time to restore
3. Support team performs restore
4. Typical restore time: 1-2 hours

### Data Export

**Full Data Export**:
1. Navigate to **Settings** > **System** > **Export Data**
2. Select data to export:
   - All data (full export)
   - Specific tables (jobs, customers, time entries, etc.)
3. Select format:
   - CSV (Excel-compatible)
   - JSON (API format)
   - SQL (database dump)
4. Click **"Export"**
5. Receive download link via email (large exports)

**Scheduled Exports**:
1. Navigate to **Settings** > **System** > **Scheduled Exports**
2. Configure:
   - Data to export
   - Format
   - Frequency (daily, weekly, monthly)
   - Delivery method (email, SFTP, S3 bucket)
3. Save schedule

### System Monitoring

**Health Dashboard**:
1. Navigate to **Settings** > **System** > **Health**
2. View metrics:
   - API response times
   - Database performance
   - GPS tracking status
   - Background job queue
   - Error rates

**Alerts**:
- Configure alerts for:
  - High error rates (>1% of requests)
  - Slow API responses (>2 seconds)
  - Failed background jobs
  - Approaching budget caps (AI, Mapbox)
- Alerts sent via:
  - Email
  - SMS
  - Slack (if integrated)

### Logs & Audit Trails

**Viewing Logs**:
1. Navigate to **Settings** > **System** > **Logs**
2. Filter by:
   - Date range
   - User
   - Action type (login, data change, error)
   - Severity (info, warning, error, critical)

**Audit Trail**:
- All data changes logged:
  - User who made change
  - Timestamp
  - Old value → New value
  - IP address
- Retention: 1 year
- Exportable for compliance

---

## Performance Optimization

### Caching

**Result Caching**:
1. Navigate to **Settings** > **Performance** > **Caching**
2. Configure cache TTL (Time To Live):
   - Instruction search: 60 minutes (default)
   - Customer data: 15 minutes
   - Job schedules: 5 minutes
3. Clear cache:
   - Clear all caches
   - Clear specific cache type

**Offline Queue**:
- GPS queue size: 1,000 points (default)
- Task queue size: 100 tasks (default)
- Adjust in **Settings** > **Offline**

### Database Optimization

**Indexing**:
- Automatic indexing on key fields
- No configuration needed
- Monitored by JobEye team

**Query Optimization**:
- Slow query detection
- Automatic optimization suggestions
- View in **Settings** > **System** > **Performance**

---

## Compliance & Reporting

### GDPR Compliance

**Data Subject Rights**:
1. Navigate to **Settings** > **Compliance** > **GDPR**
2. Configure:
   - **Data Export Requests**: Auto-approve or require admin review
   - **Data Deletion Requests**: Grace period (30 days), then auto-delete
   - **Data Retention**: Configure per data type

**Cookie Consent**:
- Enabled by default
- Banner shown to EU users
- Tracks consent status

### CCPA Compliance

**California Privacy Rights**:
1. Navigate to **Settings** > **Compliance** > **CCPA**
2. Enable "Do Not Sell My Data" option
3. Configure data export process
4. Set up opt-out workflow

### Labor Law Compliance

**FLSA (Fair Labor Standards Act)**:
- Automatic overtime calculation
- Time entry record keeping (required)
- Audit-ready export

**State-Specific**:
- California: Meal break tracking, double-time OT
- New York: Spread of hours calculation
- Configure in **Settings** > **Time Tracking** > **State Rules**

---

## Troubleshooting

### Common Issues

**Issue: GPS Not Tracking**
- Check: GPS Tracking enabled in settings
- Check: Crew has location permissions on device
- Check: GPS tracking interval not too long (30s recommended)

**Issue: Time Entries Not Syncing**
- Check: Internet connectivity
- Check: Offline queue not full
- Check: No system errors in logs

**Issue: Route Optimization Failing**
- Check: Mapbox API key valid
- Check: Daily limit not exceeded
- Check: Job locations have valid GPS coordinates

**Issue: Slow Performance**
- Check: Database query performance in logs
- Check: Cache hit rates
- Clear caches
- Contact support if persistent

### Support Contact

**Technical Support**:
- Email: support@jobeye.com
- Phone: 1-800-JOBEYE-1
- In-app: Settings > Help > Contact Support
- Hours: Monday-Friday 8 AM - 6 PM EST

**Emergency Support** (Enterprise Plans):
- 24/7 phone support
- Dedicated account manager
- SLA: 1-hour response time

---

## Best Practices

### Security

- ✅ Enable MFA for all admin users
- ✅ Use strong password policy
- ✅ Rotate API keys every 90 days
- ✅ Limit API key permissions (least privilege)
- ✅ Review audit logs monthly
- ❌ Don't share admin credentials
- ❌ Don't use personal email for company account

### Performance

- ✅ Monitor system health dashboard weekly
- ✅ Clear caches during low-usage periods
- ✅ Export old data periodically (>1 year)
- ✅ Optimize crew schedules (fewer overlapping jobs)

### Compliance

- ✅ Review data retention policies annually
- ✅ Train employees on privacy policies
- ✅ Document all system configuration changes
- ✅ Export audit logs quarterly for records

---

## Appendix

### Default Configuration Values

| Setting | Default Value | Range |
|---------|---------------|-------|
| GPS Tracking Interval | 30 seconds | 15-60s |
| GPS Accuracy Threshold | 100 meters | 50-200m |
| Geofence Arrival | 50 meters | 25-100m |
| Geofence Departure | 100 meters | 50-200m |
| Auto Clock-Out Idle | 30 minutes | 15-60min |
| Daily Overtime Threshold | 8 hours | 8-12hr |
| Weekly Overtime Threshold | 40 hours | 35-40hr |
| Time Approval Cutoff | Friday 5 PM | Configurable |
| Voice Audio Retention | 30 days | 7-90 days |
| GPS Data Retention | 90 days | 30-365 days |

### Recommended Settings by Company Size

**Small (1-10 employees)**:
- GPS Tracking: 30s interval, 100m accuracy
- Auto Clock-Out: All enabled
- Time Approvals: Required for all
- Voice Features: Enabled

**Medium (11-50 employees)**:
- GPS Tracking: 30s interval, 50m accuracy
- Auto Clock-Out: Geofence + idle enabled
- Time Approvals: Flagged entries only
- Voice Features: Enabled
- Route Optimization: Multiple dispatchers

**Large (51+ employees)**:
- GPS Tracking: 30s interval, 50m accuracy
- Auto Clock-Out: All enabled with tight thresholds
- Time Approvals: Automated with manager overrides
- Voice Features: Enabled
- Multi-location setup recommended
- Enterprise plan for dedicated support

---

**Document Version**: 1.0
**Last Updated**: 2025-09-30
**Maintained By**: JobEye Admin Team
