-- Migration: Add jobLoadV2Enabled to tenants.settings.features
-- Purpose: Add feature flag for gradual rollout of new job load verification system
-- Date: 2025-10-20

-- Update existing tenants to add the feature flag structure
UPDATE public.tenants
SET settings = jsonb_set(
  jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{features}',
    COALESCE(settings->'features', '{}'::jsonb),
    true
  ),
  '{features,jobLoadV2Enabled}',
  'false'::jsonb,
  true
)
WHERE settings IS NULL
   OR settings->'features' IS NULL
   OR NOT (settings->'features' ? 'jobLoadV2Enabled');

-- Add comment for documentation
COMMENT ON COLUMN public.tenants.settings IS
  'Tenant-specific settings including features.jobLoadV2Enabled for job load v2 rollout';
