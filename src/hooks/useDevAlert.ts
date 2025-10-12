/*
AGENT DIRECTIVE BLOCK
file: /src/hooks/useDevAlert.ts
phase: dev-crud
domain: supervisor
purpose: Shared alert helper for demo CRUD flows
spec_ref: DEV_CRUD_PORT_PLAN.md
complexity_budget: 80
dependencies:
  internal: []
  external:
    - 'react'
voice_considerations:
  - Allows callers to surface voice-friendly prompts for dev tools
*/

import { useCallback, useState } from 'react';

export type DevAlertTone = 'info' | 'success' | 'error';

export interface DevAlertState {
  text: string;
  tone: DevAlertTone;
}

export function useDevAlert() {
  const [alert, setAlert] = useState<DevAlertState | null>(null);

  const setAlertMessage = useCallback((text: string, tone: DevAlertTone = 'info') => {
    setAlert({ text, tone });
  }, []);

  const clearAlert = useCallback(() => setAlert(null), []);

  return {
    alert,
    setAlertMessage,
    clearAlert
  };
}
