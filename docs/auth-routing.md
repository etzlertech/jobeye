# Auth & Routing Matrix

_Last updated: 2025-10-05_

This document captures the intended access control rules for JobEye routes. It mirrors the configuration consumed by `src/lib/auth/route-access.ts` and is used to keep middleware, Supabase RLS, and UI navigation in sync.

## Role Hierarchy

- Admin inherits Supervisor and Crew access
- Supervisor inherits Crew access
- Crew has access only to Crew routes

## Public Routes

Accessible without authentication. Middleware should bypass auth for these paths (and any `*` suffix).

- `/`
- `/sign-in`
- `/simple-signin`
- `/sign-up`
- `/reset-password`
- `/demo-crud`
- `/mobile`
- `/mobile/loading-complete`
- `/api/health`
- `/api/webhook`
- `/api/debug/auth`
- `/api/test-crud`
- `/api/demo-crud`

## Supervisor Routes

Require supervisor or higher.

- `/supervisor`
- `/supervisor/dashboard`
- `/supervisor/customers`
- `/supervisor/properties`
- `/supervisor/jobs`
- `/supervisor/inventory`
- `/jobs`
- `/jobs/*`
- `/crew/job-load`
- `/crew/jobs`
- `/crew/load-verify`
- `/mobile/equipment-verification`
- `/mobile/job-load-checklist-start`

## Crew Routes

Require crew or higher (supervisors and admins inherit access).

- `/crew`
- `/crew/jobs`
- `/crew/job-load`
- `/crew/load-verify`
- `/mobile/equipment-verification`
- `/mobile/job-load-checklist-start`
- `/mobile/loading-complete`

## Admin Routes

Require admin role.

- `/admin`
- `/control-tower`
- `/control-tower/*`
- `/vision/admin`

## Shared Routes

Routes shared between specific roles.

- Admin + Supervisor: `/reports`, `/analytics`
- Supervisor + Crew: `/equipment`, `/profile`

## API Routes

Role-specific API prefixes that require authentication.

- `/api/admin/*` - admin
- `/api/supervisor/*` - supervisor or admin
- `/api/crew/*` - crew, supervisor, admin
- `/api/intent`, `/api/inventory`, `/api/scheduling` - follow service-specific policies (default: supervisor)
- `/api/vision/*` - supervisor or admin

## Demo Mode

When `isDemo=true` cookie is present, middleware should trust the `demoRole` cookie for role enforcement. Demo users must still follow the above route restrictions.

## Testing Checklist

- Seed users for each role with `app_metadata.role` and `app_metadata.tenant_id`
- Verify middleware unit tests cover public, crew, supervisor, admin, and demo flows
- Confirm UI hides navigation to disallowed routes per role
- Validate Supabase RLS policies match this matrix via integration tests

