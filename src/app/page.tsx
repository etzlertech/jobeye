/*
AGENT DIRECTIVE BLOCK
file: /src/app/page.tsx
phase: 1
domain: authentication
purpose: Root route renders the simple sign-in experience
spec_ref: auth-routing-simplification
complexity_budget: 20
dependencies:
  internal:
    - /src/app/simple-signin/page
voice_considerations:
  - Authentication pages do not activate voice controls
*/

export { default } from './simple-signin/page';
