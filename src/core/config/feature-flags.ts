// --- AGENT DIRECTIVE BLOCK ---
// file: /src/core/config/feature-flags.ts
// phase: 3
// domain: scheduling-kits
// purpose: Centralized feature flag registry for toggling in-app previews
// spec_ref: docs/003-scheduling-kits/NOTES.md
// complexity_budget: 80
// dependencies:
//   - internal: none
//   - external: process.env
// exports: featureFlags, FeatureFlags
// voice_considerations: |
//   Flags gate voice-enabled previews to avoid exposing unfinished voice flows.
// offline_capability: OPTIONAL
// test_requirements:
//   - Covered indirectly by UI smoke tests.
// --- END DIRECTIVE BLOCK ---

export interface FeatureFlags {
  schedulingKitsPreview: boolean;
}

const parseFlag = (value: string | undefined) => value === 'true' || value === '1';

export const featureFlags: FeatureFlags = {
  schedulingKitsPreview: parseFlag(process.env.NEXT_PUBLIC_FEATURE_SCHEDULING_KITS),
};
