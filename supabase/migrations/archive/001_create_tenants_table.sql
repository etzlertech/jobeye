-- --- AGENT DIRECTIVE BLOCK ---
-- file: /supabase/migrations/001_create_tenants_table.sql
-- purpose: Create foundational tenants table with multi-tenant architecture support and voice-first configuration
-- spec_ref: tenant#tables-migration
-- version: 2025-08-1
-- domain: tenant
-- phase: 1
-- complexity_budget: medium
-- offline_capability: NONE
--
-- dependencies:
--   - internal: []
--   - external: ['supabase', 'postgresql']
--
-- exports:
--   - tenants - Core tenant/organization table with settings and configuration
--   - tenant_voice_configs - Voice-specific settings per tenant
--   - tenant_subscriptions - Subscription and billing information
--   - tenant_domains - Domain management and validation
--   - tenant_features - Feature flags and capabilities per tenant
--
-- voice_considerations: >
--   Tenant voice configurations should support organization-specific wake words and branding.
--   Voice settings should be isolated per tenant for security and customization.
--   Voice analytics should be tracked per tenant for usage insights.
--
-- security_considerations: >
--   All tenant tables must have Row Level Security enabled for data isolation.
--   Tenant access must be strictly controlled and validated.
--   Domain validation must prevent tenant impersonation and cross-tenant access.
--
-- performance_considerations: >
--   Tenant tables should be optimized for frequent lookups by ID and domain.
--   Indexes should support tenant resolution and user access patterns.
--   Large tenants should not impact smaller tenant performance.
--
-- tasks:
--   1. [EXTENSIONS] Enable required PostgreSQL extensions
--   2. [TYPES] Create custom types for tenant management
--   3. [TENANTS] Create core tenants table with comprehensive configuration
--   4. [VOICE] Create tenant_voice_configs for voice-first settings
--   5. [SUBSCRIPTIONS] Create tenant_subscriptions for billing
--   6. [DOMAINS] Create tenant_domains for domain management
--   7. [FEATURES] Create tenant_features for capability control
--   8. [INDEXES] Add performance indexes for common queries
--   9. [RLS] Enable Row Level Security on all tables
--  10. [DATA] Insert default tenant and initial configuration
-- --- END DIRECTIVE BLOCK ---

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types for tenant management
CREATE TYPE tenant_status AS ENUM ('active', 'suspended', 'cancelled', 'trial');
CREATE TYPE subscription_plan AS ENUM ('starter', 'professional', 'enterprise', 'custom');
CREATE TYPE tenant_size AS ENUM ('small', 'medium', 'large', 'enterprise');

-- =============================================
-- CORE TENANTS TABLE
-- =============================================
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    description TEXT,
    
    -- Domain and branding
    primary_domain VARCHAR(255),
    allowed_domains TEXT[] DEFAULT '{}',
    logo_url TEXT,
    brand_colors JSONB DEFAULT '{}',
    
    -- Organization details
    industry VARCHAR(100),
    size tenant_size DEFAULT 'small',
    timezone VARCHAR(50) DEFAULT 'UTC',
    locale VARCHAR(10) DEFAULT 'en-US',
    
    -- Status and lifecycle
    status tenant_status DEFAULT 'active',
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    
    -- Subscription and limits
    subscription_plan subscription_plan DEFAULT 'starter',
    max_users INTEGER DEFAULT 10,
    max_storage_gb INTEGER DEFAULT 5,
    
    -- Configuration
    settings JSONB DEFAULT '{}',
    features JSONB DEFAULT '{}',
    
    -- Audit fields
    created_by UUID,
    updated_by UUID,
    deleted_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    deletion_reason TEXT,
    
    -- Constraints
    CONSTRAINT tenants_name_length CHECK (length(name) >= 2),
    CONSTRAINT tenants_slug_length CHECK (length(slug) >= 2),
    CONSTRAINT tenants_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
    CONSTRAINT tenants_max_users_positive CHECK (max_users > 0),
    CONSTRAINT tenants_max_storage_positive CHECK (max_storage_gb > 0)
);

-- Create indexes for tenants table
CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_primary_domain ON tenants(primary_domain) WHERE primary_domain IS NOT NULL;
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_active ON tenants(is_active) WHERE is_active = true;
CREATE INDEX idx_tenants_subscription ON tenants(subscription_plan);
CREATE INDEX idx_tenants_created_at ON tenants(created_at);
CREATE INDEX idx_tenants_allowed_domains ON tenants USING GIN(allowed_domains);

-- =============================================
-- TENANT VOICE CONFIGURATIONS
-- =============================================
CREATE TABLE tenant_voice_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Voice identity and branding
    wake_words TEXT[] DEFAULT ARRAY['hey assistant'],
    default_voice VARCHAR(100) DEFAULT 'system',
    voice_branding JSONB DEFAULT '{}', -- Custom voice characteristics
    
    -- Language and speech settings
    language_codes TEXT[] DEFAULT ARRAY['en-US'],
    speech_rate DECIMAL(3,1) DEFAULT 1.0 CHECK (speech_rate BETWEEN 0.5 AND 2.0),
    voice_pitch DECIMAL(3,1) DEFAULT 1.0 CHECK (voice_pitch BETWEEN 0.5 AND 2.0),
    
    -- Provider configurations
    recognition_providers TEXT[] DEFAULT ARRAY['system'],
    tts_providers TEXT[] DEFAULT ARRAY['system'],
    provider_settings JSONB DEFAULT '{}',
    
    -- Voice command customization
    voice_commands JSONB DEFAULT '{}', -- Custom command mappings
    command_confirmations JSONB DEFAULT '{}', -- Which commands require confirmation
    
    -- Accessibility and features
    accessibility_features JSONB DEFAULT '{}',
    noise_cancellation BOOLEAN DEFAULT true,
    voice_analytics_enabled BOOLEAN DEFAULT true,
    
    -- Session and timeout settings
    session_timeout_minutes INTEGER DEFAULT 30,
    wake_word_sensitivity DECIMAL(3,2) DEFAULT 0.70 CHECK (wake_word_sensitivity BETWEEN 0.10 AND 1.00),
    confidence_threshold DECIMAL(3,2) DEFAULT 0.70 CHECK (confidence_threshold BETWEEN 0.10 AND 1.00),
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id)
);

-- Create indexes for tenant voice configs
CREATE INDEX idx_tenant_voice_configs_tenant_id ON tenant_voice_configs(tenant_id);
CREATE INDEX idx_tenant_voice_configs_wake_words ON tenant_voice_configs USING GIN(wake_words);
CREATE INDEX idx_tenant_voice_configs_languages ON tenant_voice_configs USING GIN(language_codes);

-- =============================================
-- TENANT SUBSCRIPTIONS
-- =============================================
CREATE TABLE tenant_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Subscription details
    plan subscription_plan NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    billing_cycle VARCHAR(20) DEFAULT 'monthly', -- monthly, yearly
    
    -- Pricing and billing
    monthly_price DECIMAL(10,2),
    yearly_price DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Limits and quotas
    user_limit INTEGER,
    storage_limit_gb INTEGER,
    api_call_limit INTEGER,
    voice_minutes_limit INTEGER,
    
    -- Subscription lifecycle
    trial_ends_at TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    
    -- External billing integration
    stripe_subscription_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id)
);

-- Create indexes for tenant subscriptions
CREATE INDEX idx_tenant_subscriptions_tenant_id ON tenant_subscriptions(tenant_id);
CREATE INDEX idx_tenant_subscriptions_status ON tenant_subscriptions(status);
CREATE INDEX idx_tenant_subscriptions_plan ON tenant_subscriptions(plan);
CREATE INDEX idx_tenant_subscriptions_period_end ON tenant_subscriptions(current_period_end);

-- =============================================
-- TENANT DOMAINS
-- =============================================
CREATE TABLE tenant_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Domain details
    domain VARCHAR(255) NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    
    -- Verification
    verification_token VARCHAR(255),
    verification_method VARCHAR(50) DEFAULT 'dns', -- dns, file, email
    verified_at TIMESTAMPTZ,
    
    -- SSL and security
    ssl_enabled BOOLEAN DEFAULT true,
    ssl_cert_expires_at TIMESTAMPTZ,
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(domain),
    CONSTRAINT tenant_domains_valid_domain CHECK (domain ~ '^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}$')
);

-- Create indexes for tenant domains
CREATE INDEX idx_tenant_domains_tenant_id ON tenant_domains(tenant_id);
CREATE INDEX idx_tenant_domains_domain ON tenant_domains(domain);
CREATE INDEX idx_tenant_domains_primary ON tenant_domains(is_primary) WHERE is_primary = true;
CREATE INDEX idx_tenant_domains_verified ON tenant_domains(is_verified) WHERE is_verified = true;

-- =============================================
-- TENANT FEATURES
-- =============================================
CREATE TABLE tenant_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Core features
    voice_enabled BOOLEAN DEFAULT true,
    mobile_app BOOLEAN DEFAULT true,
    api_access BOOLEAN DEFAULT false,
    custom_branding BOOLEAN DEFAULT false,
    advanced_analytics BOOLEAN DEFAULT false,
    
    -- Voice-specific features
    voice_biometrics BOOLEAN DEFAULT false,
    custom_wake_words BOOLEAN DEFAULT false,
    voice_analytics BOOLEAN DEFAULT true,
    multi_language_voice BOOLEAN DEFAULT false,
    
    -- Integration features
    webhook_integrations BOOLEAN DEFAULT false,
    sso_enabled BOOLEAN DEFAULT false,
    ldap_sync BOOLEAN DEFAULT false,
    audit_logs BOOLEAN DEFAULT true,
    
    -- Limits and quotas
    max_voice_minutes_per_month INTEGER DEFAULT 1000,
    max_api_calls_per_month INTEGER DEFAULT 10000,
    max_webhook_endpoints INTEGER DEFAULT 5,
    
    -- Feature flags
    beta_features JSONB DEFAULT '{}',
    experimental_features JSONB DEFAULT '{}',
    
    -- Audit fields
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id)
);

-- Create indexes for tenant features
CREATE INDEX idx_tenant_features_tenant_id ON tenant_features(tenant_id);
CREATE INDEX idx_tenant_features_voice_enabled ON tenant_features(voice_enabled) WHERE voice_enabled = true;
CREATE INDEX idx_tenant_features_api_access ON tenant_features(api_access) WHERE api_access = true;

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Enable RLS on all tenant tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_voice_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_features ENABLE ROW LEVEL SECURITY;

-- Tenant policies (will be refined after auth tables are created)
CREATE POLICY "Users can view own tenant" ON tenants FOR SELECT USING (true);
CREATE POLICY "Service role can manage tenants" ON tenants FOR ALL USING (auth.role() = 'service_role');

-- Voice config policies
CREATE POLICY "Users can view own tenant voice config" ON tenant_voice_configs FOR SELECT USING (true);
CREATE POLICY "Service role can manage voice configs" ON tenant_voice_configs FOR ALL USING (auth.role() = 'service_role');

-- Subscription policies
CREATE POLICY "Users can view own tenant subscription" ON tenant_subscriptions FOR SELECT USING (true);
CREATE POLICY "Service role can manage subscriptions" ON tenant_subscriptions FOR ALL USING (auth.role() = 'service_role');

-- Domain policies
CREATE POLICY "Users can view own tenant domains" ON tenant_domains FOR SELECT USING (true);
CREATE POLICY "Service role can manage domains" ON tenant_domains FOR ALL USING (auth.role() = 'service_role');

-- Feature policies
CREATE POLICY "Users can view own tenant features" ON tenant_features FOR SELECT USING (true);
CREATE POLICY "Service role can manage features" ON tenant_features FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- FUNCTIONS AND TRIGGERS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tenant_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_tenant_updated_at();
CREATE TRIGGER update_tenant_voice_configs_updated_at BEFORE UPDATE ON tenant_voice_configs FOR EACH ROW EXECUTE FUNCTION update_tenant_updated_at();
CREATE TRIGGER update_tenant_subscriptions_updated_at BEFORE UPDATE ON tenant_subscriptions FOR EACH ROW EXECUTE FUNCTION update_tenant_updated_at();
CREATE TRIGGER update_tenant_domains_updated_at BEFORE UPDATE ON tenant_domains FOR EACH ROW EXECUTE FUNCTION update_tenant_updated_at();
CREATE TRIGGER update_tenant_features_updated_at BEFORE UPDATE ON tenant_features FOR EACH ROW EXECUTE FUNCTION update_tenant_updated_at();

-- Function to generate tenant slug from name
CREATE OR REPLACE FUNCTION generate_tenant_slug(tenant_name TEXT)
RETURNS TEXT AS $$
DECLARE
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER := 0;
BEGIN
    -- Convert name to slug format
    base_slug := lower(trim(tenant_name));
    base_slug := regexp_replace(base_slug, '[^a-z0-9\s-]', '', 'g');
    base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
    base_slug := regexp_replace(base_slug, '-+', '-', 'g');
    base_slug := trim(base_slug, '-');
    
    -- Ensure uniqueness
    final_slug := base_slug;
    WHILE EXISTS(SELECT 1 FROM tenants WHERE slug = final_slug) LOOP
        counter := counter + 1;
        final_slug := base_slug || '-' || counter;
    END LOOP;
    
    RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Function to set up default tenant configuration
CREATE OR REPLACE FUNCTION setup_default_tenant_config()
RETURNS TRIGGER AS $$
BEGIN
    -- Create default voice config
    INSERT INTO tenant_voice_configs (tenant_id) VALUES (NEW.id);
    
    -- Create default subscription
    INSERT INTO tenant_subscriptions (
        tenant_id,
        plan,
        user_limit,
        storage_limit_gb,
        api_call_limit,
        voice_minutes_limit
    ) VALUES (
        NEW.id,
        NEW.subscription_plan,
        NEW.max_users,
        NEW.max_storage_gb,
        CASE NEW.subscription_plan
            WHEN 'starter' THEN 1000
            WHEN 'professional' THEN 10000
            WHEN 'enterprise' THEN 100000
            ELSE 1000
        END,
        CASE NEW.subscription_plan
            WHEN 'starter' THEN 500
            WHEN 'professional' THEN 2000
            WHEN 'enterprise' THEN 10000
            ELSE 500
        END
    );
    
    -- Create default features
    INSERT INTO tenant_features (
        tenant_id,
        voice_enabled,
        mobile_app,
        api_access,
        custom_branding,
        advanced_analytics,
        voice_biometrics,
        custom_wake_words
    ) VALUES (
        NEW.id,
        true,
        true,
        NEW.subscription_plan != 'starter',
        NEW.subscription_plan IN ('enterprise', 'custom'),
        NEW.subscription_plan IN ('professional', 'enterprise', 'custom'),
        NEW.subscription_plan IN ('enterprise', 'custom'),
        NEW.subscription_plan != 'starter'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set up default config on tenant creation
CREATE TRIGGER setup_tenant_defaults
    AFTER INSERT ON tenants
    FOR EACH ROW
    EXECUTE FUNCTION setup_default_tenant_config();

-- =============================================
-- INITIAL DATA
-- =============================================

-- Create default tenant
INSERT INTO tenants (
    name,
    slug,
    display_name,
    description,
    is_default,
    subscription_plan,
    max_users,
    max_storage_gb,
    settings,
    features
) VALUES (
    'Default Organization',
    'default',
    'Default Organization',
    'Default tenant for new users',
    true,
    'starter',
    100,
    10,
    '{
        "features": {
            "voice_enabled": true,
            "mobile_app": true,
            "api_access": false,
            "custom_branding": false,
            "advanced_analytics": false
        },
        "security": {
            "mfa_required": false,
            "session_timeout": 24,
            "password_policy": "standard"
        },
        "voice": {
            "default_language": "en-US",
            "voice_timeout": 30,
            "confidence_threshold": 0.7
        }
    }',
    '{
        "voice_enabled": true,
        "mobile_app": true,
        "advanced_analytics": false
    }'
);

-- Add table comments for documentation
COMMENT ON TABLE tenants IS 'Core tenant/organization table with settings and branding';
COMMENT ON TABLE tenant_voice_configs IS 'Voice-specific configuration per tenant';
COMMENT ON TABLE tenant_subscriptions IS 'Subscription plans and billing information';
COMMENT ON TABLE tenant_domains IS 'Domain management and verification';
COMMENT ON TABLE tenant_features IS 'Feature flags and capabilities per tenant';

-- Add column comments for key fields
COMMENT ON COLUMN tenants.slug IS 'URL-friendly identifier for tenant';
COMMENT ON COLUMN tenants.allowed_domains IS 'Array of domains allowed for this tenant';
COMMENT ON COLUMN tenants.settings IS 'JSON configuration for tenant features and security';
COMMENT ON COLUMN tenant_voice_configs.wake_words IS 'Array of wake words for voice activation';
COMMENT ON COLUMN tenant_voice_configs.voice_commands IS 'Custom voice command mappings';
COMMENT ON COLUMN tenant_subscriptions.voice_minutes_limit IS 'Monthly voice interaction minutes limit';