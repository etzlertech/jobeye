/*
AGENT DIRECTIVE BLOCK
file: /src/app/demo-hub/page.tsx
phase: 1
domain: routing
purpose: Deprecate legacy demo hub by redirecting to the primary sign-in page
spec_ref: auth-routing-simplification
complexity_budget: 12
dependencies:
  external:
    - next/navigation
voice_considerations:
  - No voice features on deprecated routes
*/

import { redirect } from 'next/navigation';

export default function DemoHubRedirect() {
  redirect('/');
}
