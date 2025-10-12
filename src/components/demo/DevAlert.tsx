/*
AGENT DIRECTIVE BLOCK
file: /src/components/demo/DevAlert.tsx
phase: dev-crud
domain: supervisor
purpose: Render consistent alert styling for demo CRUD tooling
spec_ref: DEV_CRUD_PORT_PLAN.md
complexity_budget: 80
dependencies:
  internal:
    - '@/hooks/useDevAlert'
  external:
    - 'clsx'
voice_considerations:
  - Ensures alerts are visually distinct for agents cross-checking voice prompts
*/

import clsx from 'clsx';
import type { DevAlertState } from '@/hooks/useDevAlert';

interface DevAlertProps {
  alert: DevAlertState | null;
}

export function DevAlert({ alert }: DevAlertProps) {
  if (!alert) {
    return null;
  }

  const className = clsx(
    'mb-4 rounded-lg border px-4 py-3 text-sm',
    alert.tone === 'success' && 'border-green-600 bg-green-900/40 text-green-200',
    alert.tone === 'error' && 'border-red-600 bg-red-900/40 text-red-200',
    alert.tone === 'info' && 'border-gray-700 bg-gray-900/60 text-gray-200'
  );

  return <div className={className}>{alert.text}</div>;
}
