-- MVP Intent-Driven Mobile App tables
-- Feature: 007-mvp-intent-driven
-- Date: 2025-01-27

-- Create ai_interaction_logs table
CREATE TABLE IF NOT EXISTS ai_interaction_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    interaction_type TEXT NOT NULL CHECK (interaction_type IN ('intent', 'stt', 'tts', 'llm', 'vlm')),
    model_used TEXT NOT NULL,
    prompt TEXT NOT NULL,
    image_url TEXT,
    response JSONB NOT NULL,
    response_time_ms INTEGER NOT NULL,
    cost_usd DECIMAL(10,6) NOT NULL,
    error TEXT,
    metadata JSONB
);

-- Create indexes for ai_interaction_logs
CREATE INDEX IF NOT EXISTS idx_ai_logs_user_created ON ai_interaction_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_logs_tenant_type ON ai_interaction_logs (tenant_id, interaction_type);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created ON ai_interaction_logs (created_at DESC);

-- Create intent_classifications table
CREATE TABLE IF NOT EXISTS intent_classifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    image_url TEXT NOT NULL,
    detected_intent TEXT NOT NULL CHECK (detected_intent IN ('inventory_add', 'job_load_verify', 'receipt_scan', 'maintenance_event', 'vehicle_add', 'unknown')),
    confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    context_data JSONB,
    user_action TEXT,
    ai_log_id UUID REFERENCES ai_interaction_logs(id)
);

-- Create indexes for intent_classifications
CREATE INDEX IF NOT EXISTS idx_intent_user_created ON intent_classifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intent_type_confidence ON intent_classifications (detected_intent, confidence);

-- Create offline_sync_queue table
CREATE TABLE IF NOT EXISTS offline_sync_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    operation_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    operation_data JSONB NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'completed', 'failed')),
    synced_at TIMESTAMPTZ,
    error TEXT,
    retry_count INTEGER DEFAULT 0
);

-- Create indexes for offline_sync_queue
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON offline_sync_queue (sync_status, created_at);
CREATE INDEX IF NOT EXISTS idx_sync_queue_user ON offline_sync_queue (user_id, sync_status);

-- Extend jobs table with new columns
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_vehicle_id UUID REFERENCES equipment_containers(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS special_instructions_audio TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS actual_duration_minutes INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completion_photo_urls TEXT[];