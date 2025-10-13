# Admin Console Wireframe Notes

## Phase 3.3.1 – System Admin Dashboard `/admin/dashboard`

### Layout Sketch
- **Header**: breadcrumb (Home / Admin), quick filters (time range selector)
- **Row 1** (metrics cards):
  - Total tenants (active vs suspended)
  - Daily/weekly active users
  - Error rate (current vs previous period)
  - Health summary (DB / Storage / External APIs)
- **Row 2** (split grid):
  - **System Events Feed** (vertical list with timestamp, type, message)
  - **Trend charts** (line charts for errors, logins)
- **Row 3**: Health status table (service name, status, last check, response time)

### Key States
- Loading skeletons for cards/feed
- Empty states (no events / no errors)
- Error state for metrics (unable to load)

## Phase 3.3.1 – Tenant Management `/admin/tenants`

### Layout Sketch
- **Toolbar**: search (company, domain), filters (status chips), bulk action dropdown
- **Tenant Table** (paginated): columns for name, status, plan, created, last active, actions
- **Row Action**: review button (opens detail drawer)
- **Detail Drawer**: tenant info, usage stats (jobs, users), notes, approval controls
- **Approval Modal**: include comment textarea, approval/suspend buttons

### States & Interactions
- Multi-select for bulk actions
- Approval workflow (pending → approved/suspended)
- Analytics mini-chart inside detail view (usage last 30 days)

## Phase 3.3.2 – User Management `/admin/users`

### Layout
- Search bar (email, name, tenant)
- Filter tags (role, status, security flags)
- Table with columns: user, tenant, role(s), status, last activity, actions
- Side panel on row click: user profile, recent activity, impersonate button

### Special elements
- Impersonate confirmation modal with audit warning
- Activity timeline component
- Security flags badge list

## Phase 3.3.2 – System Configuration `/admin/config`

### Layout
- Tabs: Feature Flags / Maintenance / Email Templates / Integrations / Alerts
- Each tab uses form sections with save/apply buttons
- Feature Flags: table of flags (name, env, status, description)
- Maintenance: schedule picker, notification preview
- Email Templates: list → editor with preview panel

---

## Phase 3.4.1 – Tenant Onboarding `/tenant-admin/onboarding`

### Wizard Steps
1. Company Details (form fields + optional document upload)
2. Initial Users (list with role assigner)
3. Integrations (checkboxes, API keys, optional config)
4. Review & Submit
- Progress bar across top, step validation
- Status card after submission (pending / approved / rejected)

## Phase 3.4.1 – Tenant User Management `/tenant-admin/users`

- Invite button (modal for email + role)
- Table with role chips & status toggles
- Permission matrix button (opens dialog showing capabilities per role)
- Bulk role change panel

## Phase 3.4.2 – Approvals `/tenant-admin/approvals`

- Queue list (cards or table) with request type, requester, submitted at
- Detail panel: request info, attachments, comments thread
- Decision footer: approve / reject with comment field
- Audit timeline

## Phase 3.4.2 – Notifications `/tenant-admin/notifications`

- Feed of system notices
- Compose announcement modal (scope: all users / role-specific)
- Direct message drawer: user search → message history
- Settings page: toggle preference categories per user

---

# Phase 3 Wireframe Summary
- Leverage existing admin layout (left nav, top bar)
- Use card + table patterns already in the design system
- Ensure all actions have confirmation & error feedback
- Target stacked layout for narrow screens (cards collapse vertically)

