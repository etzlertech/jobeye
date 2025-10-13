/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/app/admin/page.tsx
 * phase: 3
 * domain: admin
 * purpose: Redirect root admin route to dashboard
 * spec_ref: docs/admin-ui-specs.md
 * complexity_budget: 10 LoC
 */

import { redirect } from 'next/navigation';

export default function AdminIndexPage() {
  redirect('/admin/dashboard');
}
