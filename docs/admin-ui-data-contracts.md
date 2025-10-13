# Admin Console Data Contracts (Draft)

## Phase 3.3.1 – System Admin Dashboard

### `/api/admin/metrics/overview`
```ts
interface AdminOverviewMetrics {
  tenants: {
    total: number;
    active: number;
    pending: number;
    suspended: number;
  };
  users: {
    total: number;
    dailyActive: number;
    weeklyActive: number;
    monthlyActive: number;
  };
  errors: {
    currentRate: number; // errors per hour
    previousRate: number;
    trend: Array<{ timestamp: string; rate: number }>;
  };
  health: Array<{
    service: 'database' | 'storage' | 'supabase' | 'voice' | string;
    status: 'healthy' | 'degraded' | 'down';
    responseTimeMs: number;
    lastCheck: string;
  }>;
}
```

### `/api/admin/events/recent`
```ts
interface SystemEvent {
  id: string;
  timestamp: string;
  type: 'tenant' | 'user' | 'system' | 'error';
  severity: 'info' | 'warning' | 'error';
  message: string;
  metadata?: Record<string, any>;
}
```

## Phase 3.3.1 – Tenant Management

### `/api/admin/tenants`
Query params: `search`, `status`, `page`, `pageSize`.
```ts
interface TenantListResponse {
  data: TenantSummary[];
  page: number;
  pageSize: number;
  total: number;
}

interface TenantSummary {
  id: string;
  name: string;
  domain: string | null;
  status: 'pending' | 'active' | 'suspended' | 'expired';
  plan: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  usage: {
    jobsLast30d: number;
    activeUsers: number;
  };
}
```

### `/api/admin/tenants/{id}`
```ts
interface TenantDetail extends TenantSummary {
  contacts: Array<{ name: string; email: string; role: string }>;
  notes: Array<{ id: string; createdAt: string; author: string; body: string }>;
  billing?: {
    plan: string;
    renewalDate: string;
    invoices: Array<{ id: string; amount: number; status: string; issuedAt: string }>;
  };
}
```

### Approval Actions
- `POST /api/admin/tenants/{id}/approve` { comment?: string }
- `POST /api/admin/tenants/{id}/suspend` { reason: string }
- Response: `{ status: 'success' }`

## Phase 3.3.2 – User Management

### `/api/admin/users`
```ts
interface AdminUserSummary {
  id: string;
  email: string;
  name: string | null;
  tenants: Array<{ tenantId: string; tenantName: string; role: string }>;
  status: 'active' | 'suspended' | 'pending';
  lastLoginAt: string | null;
  securityFlags: string[];
}
```

### `/api/admin/users/{id}`
```ts
interface AdminUserDetail extends AdminUserSummary {
  activity: Array<{ timestamp: string; action: string; context?: Record<string, any> }>;
  impersonationAllowed: boolean;
}
```

### Impersonation
- `POST /api/admin/users/{id}/impersonate` → `{ sessionToken: string }`

## Phase 3.3.2 – System Configuration

### Feature Flags
```ts
interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  environments: Array<{
    env: 'development' | 'staging' | 'production';
    enabled: boolean;
  }>;
  lastUpdated: string;
  updatedBy: string;
}
```

- `GET /api/admin/config/feature-flags`
- `PATCH /api/admin/config/feature-flags/{key}` { environments: [...] }

### Maintenance Mode
```ts
interface MaintenanceSchedule {
  enabled: boolean;
  startsAt?: string;
  endsAt?: string;
  message?: string;
}
```

## Phase 3.4.1 – Tenant Onboarding

### `/api/tenant-admin/onboarding`
```ts
interface OnboardingState {
  status: 'not_started' | 'in_progress' | 'submitted' | 'approved' | 'rejected';
  steps: Array<{
    id: string;
    label: string;
    completed: boolean;
    updatedAt?: string;
  }>;
  submission?: {
    submittedAt: string;
    reviewedAt?: string;
    reviewer?: string;
    notes?: string;
  };
}
```

### Submit Onboarding
- `POST /api/tenant-admin/onboarding` with payload containing company info, initial users, integrations, documents.

## Phase 3.4.1 – Tenant User Management

```ts
interface TenantUserSummary {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'supervisor' | 'crew';
  status: 'active' | 'inactive' | 'pending';
  invitedAt?: string;
}
```

- `POST /api/tenant-admin/users/invite` { email: string; role: string }
- `PATCH /api/tenant-admin/users/{id}` { role?: string; status?: string }

## Phase 3.4.2 – Approvals

```ts
interface TenantApprovalRequest {
  id: string;
  type: 'user_invite' | 'role_change' | 'integration' | string;
  requester: { id: string; name: string | null; email: string };
  submittedAt: string;
  payload: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected';
  history: Array<{
    id: string;
    actor: string;
    action: 'submitted' | 'commented' | 'approved' | 'rejected';
    comment?: string;
    timestamp: string;
  }>;
}
```

- `POST /api/tenant-admin/approvals/{id}/approve` { comment: string }
- `POST /api/tenant-admin/approvals/{id}/reject` { comment: string }

## Phase 3.4.2 – Notifications

```ts
interface TenantNotification {
  id: string;
  type: 'system' | 'announcement' | 'message';
  title: string;
  body: string;
  createdAt: string;
  creator?: { id: string; name: string | null };
  scope: 'all' | 'role' | 'user';
  scopeTarget?: string;
}
```

- `POST /api/tenant-admin/notifications` { title, body, scope, scopeTarget }
- `GET /api/tenant-admin/notifications/preferences`
- `PATCH /api/tenant-admin/notifications/preferences` { categories: Record<string, boolean> }

---

## Notes & Dependencies
- All admin endpoints require `system_admin` or `tenant_admin` role enforcement via middleware.
- Audit logging required for write operations (impersonation, approvals, role changes).
- Real-time updates may subscribe to Supabase channels (`system_events`, `approval_events`).
- Schema stubs in `src/lib/supabase/types.ts` should be kept in sync with these contracts until auto-generated.

