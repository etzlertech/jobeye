/**
 * @file /src/app/tenant-admin/page.tsx
 * @purpose Redirect root tenant admin route to dashboard
 */

import { redirect } from 'next/navigation';

export default function TenantAdminIndexPage() {
  redirect('/tenant-admin/dashboard');
}