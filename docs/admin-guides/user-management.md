# User Management Guide

**Version**: 1.0
**Last Updated**: 2025-09-30
**Audience**: System administrators and HR managers

---

## Overview

This guide covers user account management including creating users, assigning roles, managing permissions, onboarding/offboarding, and user data administration.

---

## Creating Users

### Adding Individual Users

**Manual User Creation**:
1. Navigate to **Settings** > **Users** > **All Users**
2. Click **"Add User"**
3. Enter required information:
   - **First Name**
   - **Last Name**
   - **Email** (used for login)
   - **Phone Number** (for SMS notifications)
   - **Role** (Admin, Manager, Supervisor, Dispatcher, Field Crew)
   - **Location/Branch** (if multi-location)
4. Set initial password:
   - **Auto-generate**: System creates secure password, sent via email
   - **Manual**: Enter password (must meet password policy)
5. Optional settings:
   - **Send welcome email**: Enabled (recommended)
   - **Require password change on first login**: Enabled (recommended)
6. Click **"Create User"**

**User Created**:
- User receives welcome email with login credentials
- User can log in immediately
- Password must be changed on first login (if enabled)

### Bulk User Import

**CSV Import**:
1. Navigate to **Settings** > **Users** > **Import Users**
2. Download CSV template
3. Fill in user data:
   - Required: First Name, Last Name, Email, Role
   - Optional: Phone, Location, Department, Employee ID
4. Upload completed CSV
5. Review mapped fields
6. Fix any validation errors
7. Click **"Import Users"**

**CSV Format Example**:
```csv
FirstName,LastName,Email,Phone,Role,Location
John,Smith,john@company.com,555-0100,Field Crew,Main Office
Jane,Doe,jane@company.com,555-0101,Supervisor,Branch 2
```

**Import Results**:
- Summary: X users created, Y errors
- Download error report (if any)
- All created users receive welcome email

---

## User Roles & Permissions

### Standard Roles

**Admin**:
- Full system access
- All settings configuration
- User management
- Billing and subscriptions
- Data export/import
- Typical users: Owner, IT manager

**Manager**:
- View all company data
- Edit jobs, customers, properties
- View reports and analytics
- Cannot change system settings
- Cannot manage users or billing
- Typical users: General manager, operations manager

**Supervisor**:
- Approve time entries
- Review job completions
- View crew performance
- Manage safety compliance
- Cannot change schedules or settings
- Typical users: Foreman, crew leader

**Dispatcher**:
- Create and schedule jobs
- Assign crews
- Optimize routes
- Process intake requests
- Monitor crew locations
- Cannot approve time or change settings
- Typical users: Office manager, dispatcher

**Field Crew**:
- Clock in/out
- View assigned jobs
- Complete tasks
- Upload photos
- Submit safety checklists
- Limited visibility (own jobs only)
- Typical users: Crew members, technicians

### Custom Roles

**Creating Custom Role**:
1. Navigate to **Settings** > **Users** > **Roles**
2. Click **"Create Custom Role"**
3. Name the role (e.g., "Safety Coordinator", "Payroll Specialist")
4. Select permissions by module:

**Permission Modules**:
- **Jobs**: View, Create, Edit, Delete
- **Customers**: View, Create, Edit, Delete
- **Time Entries**: View, Approve, Edit, Export
- **Schedules**: View, Edit
- **Safety**: View, Manage, Reports
- **Analytics**: View, Export
- **Settings**: Company, Users, Integrations
- **Billing**: View, Manage

**Permission Levels**:
- **None**: No access
- **View**: Read-only
- **Edit**: Modify existing data
- **Full**: Create, edit, delete

**Example: Safety Coordinator Custom Role**:
- Jobs: View only
- Safety: Full access
- Analytics: View (safety reports only)
- Users: None
- Settings: None

### Assigning Roles

**Change User Role**:
1. Navigate to **Settings** > **Users** > **All Users**
2. Click user to edit
3. Select new role from dropdown
4. Click **"Save Changes"**
5. User's permissions update immediately

**Multi-Role Assignment** (Enterprise Only):
- Users can have multiple roles
- Example: User is both Supervisor AND Dispatcher
- Permissions are additive (most permissive wins)

---

## User Profiles

### Viewing User Profiles

**User Details**:
1. Navigate to **Settings** > **Users** > **All Users**
2. Click user name
3. View:
   - Personal information
   - Contact details
   - Role and permissions
   - Assigned location/branch
   - Employment information
   - Last login
   - Account status

### Editing User Information

**Update User Profile**:
1. Open user profile
2. Click **"Edit"**
3. Modify fields as needed
4. Click **"Save Changes"**

**Editable Fields**:
- First name, last name
- Email address (used for login)
- Phone number
- Role
- Location/branch
- Employee ID
- Hourly rate (for labor cost tracking)
- Default equipment/truck assignment

---

## Employment Information

### Setting Hourly Rates

**Labor Cost Tracking**:
1. Open user profile
2. Scroll to **Employment Information**
3. Enter:
   - **Regular Hourly Rate**: Base pay rate
   - **Overtime Multiplier**: 1.5x (default), 2.0x for double-time
   - **Effective Date**: When rate takes effect
4. Save

**Rate History**:
- All previous rates retained
- Labor cost calculations use rate active on work date
- Useful for accurate historical reporting

### Equipment Assignment

**Default Equipment**:
1. Open user profile
2. Scroll to **Equipment**
3. Select:
   - **Primary Truck**: Assigned vehicle
   - **Equipment Kit**: Default kit (e.g., "Mower Kit A")
   - **Tools**: Individual tools assigned
4. Save

**Benefits**:
- Pre-fills equipment on job assignments
- Tracks equipment usage by crew member
- Verifies correct equipment loaded

---

## User Status Management

### Active/Inactive Status

**Deactivating User**:
1. Open user profile
2. Click **"Deactivate User"**
3. Confirm deactivation
4. User can no longer log in
5. Historical data preserved

**Use Cases for Deactivation**:
- Employee on leave (temporarily away)
- Seasonal employee (winter layoff)
- Employee terminated (permanent)

**Reactivating User**:
1. Navigate to **Settings** > **Users** > **Inactive Users**
2. Click user to reactivate
3. Click **"Reactivate User"**
4. User can log in again

### Deleting Users

**Permanent Deletion**:
1. Deactivate user first
2. Open inactive user profile
3. Click **"Delete User Permanently"**
4. Confirm deletion
5. User account and login deleted
6. Historical data anonymized (e.g., "Deleted User")

⚠️ **Warning**: Deletion is permanent and cannot be undone. Deactivation is recommended instead.

---

## Onboarding New Users

### Onboarding Checklist

**For Admins**:
1. ✅ Create user account
2. ✅ Assign correct role
3. ✅ Set initial password (auto-generated recommended)
4. ✅ Assign to location/branch
5. ✅ Set equipment assignments (for field crew)
6. ✅ Send welcome email
7. ✅ Provide training materials

**For Field Crew Specifically**:
8. ✅ Ensure mobile device has JobEye app installed
9. ✅ Verify location permissions enabled
10. ✅ Test clock in/out functionality
11. ✅ Review safety checklist requirements
12. ✅ Demonstrate voice command features

### Welcome Email Customization

**Customize Welcome Email**:
1. Navigate to **Settings** > **Users** > **Welcome Email**
2. Edit email template:
   - Company introduction
   - Login instructions
   - Link to training resources
   - Support contact information
3. Save template

**Template Variables**:
- `{{firstName}}` - User's first name
- `{{email}}` - Login email
- `{{temporaryPassword}}` - Initial password
- `{{companyName}}` - Your company name

---

## Offboarding Users

### Offboarding Checklist

**When Employee Leaves**:
1. ✅ Deactivate user account immediately
2. ✅ Review and approve any pending time entries
3. ✅ Export user's data (if requested)
4. ✅ Reassign incomplete jobs to other crew
5. ✅ Retrieve company equipment
6. ✅ Remove from all schedules
7. ✅ Update payroll system
8. ✅ Document offboarding in notes

**Data Retention**:
- Keep user deactivated for 90 days (payroll/compliance)
- After 90 days, can permanently delete if desired
- Export user data before deletion (compliance)

---

## Password Management

### Resetting Passwords

**Admin Password Reset**:
1. Navigate to **Settings** > **Users** > **All Users**
2. Click user
3. Click **"Reset Password"**
4. Options:
   - **Send reset link**: User resets via email link (recommended)
   - **Auto-generate**: System creates new password, emails to user
   - **Set manually**: Enter new password (less secure)
5. Confirm

**User Self-Service Reset**:
- Users click "Forgot Password?" on login screen
- Enter email address
- Receive password reset link
- Create new password

### Password Policy Enforcement

**Company Password Policy**:
1. Navigate to **Settings** > **Security** > **Password Policy**
2. Configure requirements:
   - Minimum length (8-16 characters)
   - Require uppercase letters
   - Require numbers
   - Require symbols (!@#$%^&*)
   - Password expiration (30-365 days or never)
   - Prevent reuse (last 0-10 passwords)
3. Save policy
4. Applies to all new passwords

---

## Multi-Factor Authentication (MFA)

### Enabling MFA

**Company-Wide MFA**:
1. Navigate to **Settings** > **Security** > **MFA**
2. Toggle **"Require MFA for all users"** ON
3. Select method:
   - **SMS**: Text message codes
   - **Authenticator App**: Google Authenticator, Authy, etc.
   - **Both**: Users choose preferred method
4. Set grace period (7-30 days for users to enable)
5. Save

**Individual User MFA**:
1. Open user profile
2. Under **Security**, click **"Require MFA"**
3. User must enable MFA on next login

### User MFA Setup

**For Users**:
1. Log in to JobEye
2. If MFA required, prompted to set up
3. Choose method (SMS or app)
4. Follow setup instructions:
   - **SMS**: Enter phone number, verify with code
   - **App**: Scan QR code with authenticator app
5. Enter backup codes (store securely)
6. MFA enabled

**Disabling MFA** (Admin Override):
- If user loses MFA device
- Admin can disable MFA for user temporarily
- User must re-enable MFA on next login

---

## User Activity Monitoring

### Viewing User Activity

**Activity Log**:
1. Navigate to **Settings** > **Users** > **All Users**
2. Click user
3. Click **"Activity Log"** tab
4. View recent activities:
   - Logins/logouts
   - Jobs completed
   - Time entries submitted
   - Data modifications
   - Last location (if clocked in)

**Filtering Activity**:
- Date range
- Activity type (login, data change, etc.)
- Export to CSV

### Login History

**Tracking Logins**:
1. Open user profile
2. View **Login History**:
   - Date and time
   - IP address
   - Device type
   - Location (approximate)
   - Success/failure

**Suspicious Activity**:
- Login from unusual location
- Multiple failed login attempts
- Login from multiple devices simultaneously

---

## User Data Export

### Exporting User Data

**Individual User Export** (GDPR/CCPA):
1. Open user profile
2. Click **"Export User Data"**
3. Select data to include:
   - Personal information
   - Time entries
   - Job history
   - GPS location history
   - Photos uploaded
   - Voice recordings
4. Select format (CSV, JSON, PDF)
5. Click **"Generate Export"**
6. Download link sent via email

**Bulk User Export**:
1. Navigate to **Settings** > **Users** > **All Users**
2. Click **"Export Users"**
3. Select users (all or filtered)
4. Choose export format
5. Download immediately or via email

---

## User Permissions Matrix

| Feature | Admin | Manager | Supervisor | Dispatcher | Field Crew |
|---------|-------|---------|------------|------------|------------|
| View all jobs | ✅ | ✅ | ✅ | ✅ | Own only |
| Create jobs | ✅ | ✅ | ❌ | ✅ | ❌ |
| Edit jobs | ✅ | ✅ | ❌ | ✅ | ❌ |
| Delete jobs | ✅ | ✅ | ❌ | ❌ | ❌ |
| Approve time | ✅ | ✅ | ✅ | ❌ | ❌ |
| View all time entries | ✅ | ✅ | ✅ | ❌ | Own only |
| Export timesheets | ✅ | ✅ | ✅ | ❌ | Own only |
| Manage users | ✅ | ❌ | ❌ | ❌ | ❌ |
| View settings | ✅ | View only | ❌ | ❌ | ❌ |
| Edit settings | ✅ | ❌ | ❌ | ❌ | ❌ |
| View analytics | ✅ | ✅ | Team only | ❌ | Own only |
| Manage billing | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Best Practices

### Security

- ✅ Enable MFA for all admin users (required)
- ✅ Enforce strong password policy
- ✅ Review user permissions quarterly
- ✅ Deactivate users immediately upon termination
- ✅ Use least privilege principle (minimum permissions needed)
- ❌ Don't share login credentials
- ❌ Don't use the same password for multiple accounts
- ❌ Don't grant admin access unless absolutely necessary

### User Management

- ✅ Assign appropriate roles based on job function
- ✅ Keep user information up to date
- ✅ Document role changes in user notes
- ✅ Conduct periodic access reviews
- ✅ Train users on their permissions
- ❌ Don't create generic/shared accounts (e.g., "crew1@company.com")
- ❌ Don't grant excessive permissions "just in case"

### Onboarding

- ✅ Provide training before granting access
- ✅ Start with limited permissions, expand as needed
- ✅ Assign mentor/buddy for new field crew
- ✅ Verify equipment assignments are correct

### Offboarding

- ✅ Have offboarding checklist
- ✅ Deactivate account same day as termination
- ✅ Export user data before deletion (if requested)
- ✅ Reassign open jobs immediately
- ✅ Update org chart/contact lists

---

## Troubleshooting

### User Cannot Log In

**Common Causes**:
1. **Account deactivated**: Reactivate account
2. **Wrong password**: Reset password
3. **MFA issues**: Temporarily disable MFA
4. **Email not verified**: Resend verification email
5. **Account locked**: Too many failed login attempts, unlock account

**Unlocking Account**:
1. Open user profile
2. Click **"Unlock Account"**
3. Account immediately unlocked

### User Missing Permissions

**Troubleshooting**:
1. Verify correct role assigned
2. Check if custom role has required permissions
3. Check if multi-location setup limits visibility
4. Log out and back in (permissions refresh)
5. Contact support if issue persists

### User Not Receiving Emails

**Troubleshooting**:
1. Verify email address correct in profile
2. Check spam/junk folder
3. Whitelist emails from @jobeye.com
4. Test email: Click **"Send Test Email"** in user profile
5. Check email service status (Settings > System > Status)

---

## FAQs

**Q: How many users can I have?**
A: Depends on your plan. Starter: 5 users, Professional: 25 users, Enterprise: Unlimited.

**Q: Can users have multiple roles?**
A: Only on Enterprise plans. Standard plans allow one role per user.

**Q: What happens to a user's data when they're deleted?**
A: Historical data (time entries, jobs completed) is anonymized to "Deleted User". Login and personal info are permanently removed.

**Q: Can users change their own email address?**
A: No, email addresses can only be changed by admins to prevent unauthorized account changes.

**Q: How do I know when a user last logged in?**
A: Open user profile, see "Last Login" timestamp.

**Q: Can I export a list of all users?**
A: Yes, Settings > Users > All Users > Export Users.

**Q: What's the difference between deactivating and deleting?**
A: Deactivating preserves all data and can be reversed. Deleting is permanent and anonymizes historical data.

**Q: How do I assign a user to multiple locations?**
A: Create user at primary location. In profile, add secondary locations under "Access". User sees jobs from all assigned locations.

---

## Support

**Need Help?**
- Email: support@jobeye.com
- Phone: 1-800-JOBEYE-1
- In-app: Settings > Help > Contact Support

---

**Document Version**: 1.0
**Last Updated**: 2025-09-30
**Maintained By**: JobEye Admin Team
