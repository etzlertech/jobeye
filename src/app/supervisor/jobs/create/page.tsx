/*
AGENT DIRECTIVE BLOCK
file: /src/app/supervisor/jobs/create/page.tsx
phase: phase3-feature-007
domain: supervisor
purpose: Maintain legacy /supervisor/jobs/create route by redirecting to unified jobs screen
spec_ref: specs/007-integrate-job-creation-workflow
complexity_budget: 20
dependencies: []
*/

import { redirect } from 'next/navigation';

export default function SupervisorJobCreateRedirectPage() {
  redirect('/supervisor/jobs?create=1');
}
