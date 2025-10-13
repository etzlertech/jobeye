# Admin UI Specifications

## Phase 3.3: System Admin Console

### Overview
System-wide administrative interface for managing tenants, users, and system health.

### Components Required

#### 1. **System Admin Dashboard** (`/admin/dashboard`)
**Purpose**: High-level system overview and metrics
**Features**:
- Total tenant count, active/inactive breakdown
- System-wide user count and activity metrics  
- Error rate monitoring (last 24h, 7d, 30d)
- Database health indicators
- Recent system events feed

**Acceptance Criteria**:
- [ ] Display real-time tenant count with status breakdown
- [ ] Show user activity metrics (daily/weekly active users)
- [ ] Error monitoring dashboard with filterable time ranges
- [ ] System health checks (database, storage, external services)
- [ ] Responsive design for mobile admin access

#### 2. **Tenant Management** (`/admin/tenants`)
**Purpose**: View and manage all tenant accounts
**Features**:
- Tenant listing with search/filter capabilities
- Tenant approval workflow for new signups
- Tenant suspension/reactivation controls
- Per-tenant usage analytics
- Bulk operations (export, notifications)

**Acceptance Criteria**:
- [ ] Paginated tenant list with search by company name/domain
- [ ] Filter by status (pending, active, suspended, expired)
- [ ] Tenant approval workflow with comments/notes
- [ ] Individual tenant detail view with usage stats
- [ ] Bulk actions (approve/suspend multiple tenants)

#### 3. **User Management** (`/admin/users`)
**Purpose**: Cross-tenant user administration
**Features**:
- Global user search across all tenants
- User role management and permissions
- Impersonation capabilities for support
- User activity tracking
- Security incident investigation tools

**Acceptance Criteria**:
- [ ] Search users by email, name, or tenant
- [ ] View user's tenant affiliations and roles
- [ ] Support impersonation with audit logging
- [ ] User activity timeline (logins, actions, errors)
- [ ] Security flags (suspicious activity, failed logins)

#### 4. **System Configuration** (`/admin/config`)
**Purpose**: System-wide settings and feature flags
**Features**:
- Feature flag management
- System maintenance mode
- Email/notification templates
- Integration settings (Supabase, external APIs)
- Monitoring and alerting configuration

**Acceptance Criteria**:
- [ ] Feature flag toggles with environment-specific controls
- [ ] Maintenance mode scheduling with user notifications
- [ ] Email template editor with preview functionality
- [ ] Integration health monitoring and configuration
- [ ] Alert threshold configuration for system metrics

---

## Phase 3.4: Tenant Admin Approval Screens

### Overview
Dedicated workflow for tenant administrators to manage their organization's users and approvals.

### Components Required

#### 1. **Tenant Onboarding Review** (`/tenant-admin/onboarding`)
**Purpose**: Guide new tenants through setup and approval process
**Features**:
- Company information verification
- Initial user setup and role assignment
- Integration configuration (optional)
- Approval submission workflow
- Progress tracking

**Acceptance Criteria**:
- [ ] Multi-step onboarding form with validation
- [ ] Company document upload (optional verification)
- [ ] Initial admin user creation with role assignment
- [ ] Integration setup wizard (Supabase, voice services)
- [ ] Approval request submission with status tracking

#### 2. **User Role Assignment Interface** (`/tenant-admin/users`)
**Purpose**: Tenant admins manage their organization's users
**Features**:
- User invitation system
- Role assignment (admin, supervisor, crew)
- User activation/deactivation
- Permission matrix view
- Bulk role changes

**Acceptance Criteria**:
- [ ] Send user invitations with role pre-assignment
- [ ] Role management with clear permission descriptions
- [ ] User status toggle (active/inactive/pending)
- [ ] Permission matrix showing role capabilities
- [ ] Bulk operations for role changes

#### 3. **Approval/Rejection Workflows** (`/tenant-admin/approvals`)
**Purpose**: Handle approval requests within tenant organization
**Features**:
- Pending approval queue
- Approval decision workflow
- Comment/feedback system
- Approval history tracking
- Notification system

**Acceptance Criteria**:
- [ ] Queue of pending user requests and role changes
- [ ] Approve/reject with required comments
- [ ] Email notifications to requesters
- [ ] Approval audit trail with timestamps
- [ ] Escalation workflow for complex requests

#### 4. **Notification System** (`/tenant-admin/notifications`)
**Purpose**: Manage communication within tenant organization
**Features**:
- System-generated notifications
- Custom announcements
- User communication tools
- Notification preferences
- Message templates

**Acceptance Criteria**:
- [ ] System notification feed (approvals, user changes)
- [ ] Create custom announcements for organization
- [ ] Direct messaging capabilities to users
- [ ] User notification preference management
- [ ] Pre-built message templates for common scenarios

---

## Technical Requirements

### Authentication & Authorization
- System admin routes require `system_admin` role
- Tenant admin routes require `tenant_admin` role within specific tenant
- All actions must be audit logged
- Session timeout and re-authentication for sensitive operations

### Data Integration
- Use existing tenant context from JWT app_metadata
- Leverage Supabase RLS for data isolation
- Integrate with existing user repository and auth flows
- Real-time updates via Supabase subscriptions where appropriate

### UI/UX Guidelines
- Follow existing design system and component patterns
- Mobile-responsive design for admin access
- Progressive enhancement for accessibility
- Loading states and error handling
- Confirmation dialogs for destructive actions

### Performance Considerations
- Paginated data loading for large datasets
- Efficient queries with proper indexing
- Caching for frequently accessed data
- Optimistic updates where appropriate

---

## Implementation Priority

1. **Phase 3.3.1**: System Admin Dashboard + Tenant Management
2. **Phase 3.3.2**: User Management + System Configuration  
3. **Phase 3.4.1**: Tenant Onboarding + User Role Assignment
4. **Phase 3.4.2**: Approval Workflows + Notification System

Each phase should include comprehensive testing and documentation before proceeding to the next.