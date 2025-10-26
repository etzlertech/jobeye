-- Migration: Add voice commands feature flag
-- Date: 2025-10-25
-- Purpose: Enable voice-to-CRUD functionality for pilot testing

-- Enable voice commands feature flag for default tenant
UPDATE tenants
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{features,voice_commands_enabled}',
  'true'
)
WHERE id = '550e8400-e29b-41d4-a716-446655440000';

-- Add comment for documentation
COMMENT ON COLUMN tenants.settings IS 'JSON settings including feature flags like voice_commands_enabled';
