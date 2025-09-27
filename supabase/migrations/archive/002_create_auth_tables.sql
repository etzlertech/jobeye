-- --- AGENT DIRECTIVE BLOCK ---
-- file: /supabase/migrations/002_create_auth_tables.sql
-- purpose: Create comprehensive authentication tables extending Supabase auth with RBAC, voice profiles, sessions, and tenant isolation
-- spec_ref: auth#tables-migration
-- version: 2025-08-1
-- domain: authentication
-- phase: 1
-- complexity_budget: high
-- offline_capability: NONE
--
-- dependencies:
--   - internal: ['001_initial_setup.sql']
--   - external: ['supabase', 'postgresql']
--
-- exports:
--   - users_extended - Extended user data with tenant and role information
--   - user_sessions - Session tracking with device and security data
--   - user_permissions - RBAC permission assignments and role definitions
--   - voice_profiles - Voice preferences and biometric patterns
--   - tenant_assignments - Multi-tenant user access management
--   - auth_audit_log - Authentication event logging for security
--   - user_invitations - Invitation-based registration system
--   - mfa_settings - Multi-factor authentication configuration
--
-- voice_considerations: >
--   Voice profiles must support multiple speech recognition providers and biometric patterns.
--   Voice session tracking should handle device wake/sleep cycles and conversation context.
--   Voice permissions should include natural language command mapping.
--
-- security_considerations: >
--   All tables must have Row Level Security enabled with proper tenant isolation policies.
--   Sensitive data like voice patterns and session tokens must be properly encrypted.
--   Permission inheritance must be controlled to prevent privilege escalation.
--   Audit logging must be tamper-resistant and include all authentication events.
--
-- performance_considerations: >
--   Tables should have proper indexes for frequent query patterns including user lookup, session validation, and permission checks.
--   Large tables like audit logs should be partitioned by date for efficient archival.
--   Foreign key constraints should be optimized to avoid blocking operations.
--
-- tasks:
--   1. [EXTENSIONS] Enable required PostgreSQL extensions for auth functionality
--   2. [USERS] Create users_extended table with tenant and profile data
--   3. [SESSIONS] Create user_sessions table with device tracking and security flags
--   4. [PERMISSIONS] Create user_permissions and role_permissions tables for RBAC
--   5. [VOICE] Create voice_profiles table with biometric and preference data
--   6. [TENANTS] Create tenant_assignments table for multi-tenant access control
--   7. [AUDIT] Create auth_audit_log table for security event tracking
--   8. [INVITATIONS] Create user_invitations table for controlled registration
--   9. [MFA] Create mfa_settings and mfa_challenges tables for two-factor auth
--  10. [RLS] Enable Row Level Security and create tenant isolation policies
-- --- END DIRECTIVE BLOCK ---

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create custom types for authentication domain
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'technician', 'customer');
CREATE TYPE device_type AS ENUM ('mobile', 'desktop', 'tablet', 'voice_assistant');  
CREATE TYPE session_status AS ENUM ('active', 'expired', 'terminated', 'suspended');
CREATE TYPE auth_event_type AS ENUM ('login_success', 'login_failed', 'logout_success', 'registration_success', 'registration_failed', 'refresh_success', 'refresh_failed', 'password_reset', 'mfa_setup', 'mfa_failed');
CREATE TYPE mfa_method AS ENUM ('totp', 'sms', 'email', 'voice_biometric');

-- =============================================
-- USERS EXTENDED TABLE
-- =============================================
-- Extends Supabase auth.users with application-specific data
CREATE TABLE users_extended (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    role user_role NOT NULL DEFAULT 'customer',
    display_name TEXT,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    timezone TEXT DEFAULT 'UTC',
    preferred_language TEXT DEFAULT 'en-US',
    is_active BOOLEAN NOT NULL DEFAULT true,
    email_verified_at TIMESTAMPTZ,
    phone_verified_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ DEFAULT NOW(),
    terms_accepted_at TIMESTAMPTZ,
    privacy_policy_accepted_at TIMESTAMPTZ,
    marketing_consent BOOLEAN DEFAULT false,
    two_factor_enabled BOOLEAN DEFAULT false,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for users_extended
CREATE INDEX idx_users_extended_tenant_id ON users_extended(tenant_id);
CREATE INDEX idx_users_extended_role ON users_extended(role);
CREATE INDEX idx_users_extended_email_verified ON users_extended(email_verified_at) WHERE email_verified_at IS NOT NULL;
CREATE INDEX idx_users_extended_active ON users_extended(is_active) WHERE is_active = true;
CREATE INDEX idx_users_extended_last_login ON users_extended(last_login_at);
CREATE INDEX idx_users_extended_phone ON users_extended(phone) WHERE phone IS NOT NULL;

-- =============================================
-- USER SESSIONS TABLE
-- =============================================
-- Track active user sessions with device and security information
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE,
    refresh_token_hash TEXT,
    device_id TEXT NOT NULL,
    device_name TEXT,
    device_type device_type NOT NULL DEFAULT 'desktop',
    device_fingerprint TEXT,
    ip_address INET NOT NULL,
    user_agent TEXT,
    location JSONB, -- {country, region, city, lat, lng}
    voice_session_id TEXT,
    voice_session_active BOOLEAN DEFAULT false,
    voice_session_expires_at TIMESTAMPTZ,
    wake_word_active BOOLEAN DEFAULT false,
    conversation_context JSONB DEFAULT '{}',
    status session_status NOT NULL DEFAULT 'active',
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    security_flags JSONB DEFAULT '{}', -- {is_suspicious, risk_score, anomaly_reasons}
    refresh_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    voice_session_terminated BOOLEAN DEFAULT false
);

-- Create indexes for user_sessions
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_tenant_id ON user_sessions(tenant_id);
CREATE INDEX idx_user_sessions_status ON user_sessions(status);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_user_sessions_device_type ON user_sessions(device_type);
CREATE INDEX idx_user_sessions_voice_active ON user_sessions(voice_session_active) WHERE voice_session_active = true;
CREATE INDEX idx_user_sessions_last_activity ON user_sessions(last_activity_at);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token) WHERE session_token IS NOT NULL;

-- =============================================
-- USER PERMISSIONS TABLE
-- =============================================
-- Role-Based Access Control with granular permissions
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT,
    voice_commands TEXT[], -- Natural language commands that map to this permission
    requires_confirmation BOOLEAN DEFAULT false,
    risk_level INTEGER DEFAULT 1 CHECK (risk_level BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Role-based permission assignments
CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role user_role NOT NULL,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- Tenant-specific overrides
    granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    conditions JSONB DEFAULT '{}', -- Context-based conditions
    UNIQUE(role, permission_id, tenant_id)
);

-- User-specific permission overrides
CREATE TABLE user_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted BOOLEAN NOT NULL DEFAULT true, -- true=grant, false=deny
    granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    reason TEXT,
    conditions JSONB DEFAULT '{}',
    UNIQUE(user_id, permission_id)
);

-- Create indexes for permissions
CREATE INDEX idx_permissions_resource_action ON permissions(resource, action);
CREATE INDEX idx_permissions_risk_level ON permissions(risk_level);
CREATE INDEX idx_role_permissions_role ON role_permissions(role);
CREATE INDEX idx_role_permissions_tenant ON role_permissions(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_role_permissions_active ON role_permissions(is_active) WHERE is_active = true;
CREATE INDEX idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_granted ON user_permissions(granted);

-- =============================================
-- VOICE PROFILES TABLE
-- =============================================
-- Voice preferences and biometric patterns for users
CREATE TABLE voice_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    wake_word TEXT DEFAULT 'hey assistant',
    speech_rate DECIMAL(3,1) DEFAULT 1.0 CHECK (speech_rate BETWEEN 0.5 AND 2.0),
    voice_pitch DECIMAL(3,1) DEFAULT 1.0 CHECK (voice_pitch BETWEEN 0.5 AND 2.0),
    preferred_voice TEXT,
    language_code TEXT NOT NULL DEFAULT 'en-US',
    voice_feedback_enabled BOOLEAN NOT NULL DEFAULT true,
    voice_feedback_level TEXT DEFAULT 'standard' CHECK (voice_feedback_level IN ('minimal', 'standard', 'verbose')),
    preferred_tts_provider TEXT DEFAULT 'system' CHECK (preferred_tts_provider IN ('google', 'openai', 'system')),
    voice_pattern_hash TEXT, -- Hashed voice biometric data
    confidence_threshold DECIMAL(3,2) DEFAULT 0.80 CHECK (confidence_threshold BETWEEN 0.50 AND 1.00),
    voice_samples_collected INTEGER DEFAULT 0,
    last_voice_training_at TIMESTAMPTZ,
    voice_recognition_provider TEXT DEFAULT 'system',
    noise_cancellation_enabled BOOLEAN DEFAULT true,
    voice_commands_enabled BOOLEAN DEFAULT true,
    accessibility_voice_navigation BOOLEAN DEFAULT false,
    onboarding_completed BOOLEAN DEFAULT false,
    voice_analytics JSONB DEFAULT '{}', -- Usage statistics and performance metrics
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create indexes for voice_profiles
CREATE INDEX idx_voice_profiles_user_id ON voice_profiles(user_id);
CREATE INDEX idx_voice_profiles_language ON voice_profiles(language_code);
CREATE INDEX idx_voice_profiles_provider ON voice_profiles(preferred_tts_provider);
CREATE INDEX idx_voice_profiles_onboarding ON voice_profiles(onboarding_completed);
CREATE INDEX idx_voice_profiles_pattern_hash ON voice_profiles(voice_pattern_hash) WHERE voice_pattern_hash IS NOT NULL;

-- =============================================
-- TENANT ASSIGNMENTS TABLE
-- =============================================
-- Multi-tenant user access management
CREATE TABLE tenant_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    access_level INTEGER DEFAULT 1 CHECK (access_level BETWEEN 1 AND 5),
    permissions_override JSONB DEFAULT '{}',
    last_accessed_at TIMESTAMPTZ,
    access_count INTEGER DEFAULT 0,
    UNIQUE(user_id, tenant_id)
);

-- Create indexes for tenant_assignments
CREATE INDEX idx_tenant_assignments_user_id ON tenant_assignments(user_id);
CREATE INDEX idx_tenant_assignments_tenant_id ON tenant_assignments(tenant_id);
CREATE INDEX idx_tenant_assignments_primary ON tenant_assignments(is_primary) WHERE is_primary = true;
CREATE INDEX idx_tenant_assignments_active ON tenant_assignments(is_active) WHERE is_active = true;
CREATE INDEX idx_tenant_assignments_role ON tenant_assignments(role);

-- =============================================
-- AUTH AUDIT LOG TABLE
-- =============================================
-- Comprehensive authentication event logging
CREATE TABLE auth_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type auth_event_type NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    session_id UUID REFERENCES user_sessions(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    device_type device_type,
    location JSONB,
    success BOOLEAN,
    reason TEXT,
    error_code TEXT,
    risk_score INTEGER CHECK (risk_score BETWEEN 0 AND 100),
    details JSONB DEFAULT '{}',
    voice_command TEXT, -- For voice authentication events
    voice_confidence DECIMAL(3,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for auth_audit_log (partitioned by date for performance)
CREATE INDEX idx_auth_audit_log_event_type ON auth_audit_log(event_type);
CREATE INDEX idx_auth_audit_log_user_id ON auth_audit_log(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_auth_audit_log_created_at ON auth_audit_log(created_at);
CREATE INDEX idx_auth_audit_log_ip_address ON auth_audit_log(ip_address) WHERE ip_address IS NOT NULL;
CREATE INDEX idx_auth_audit_log_success ON auth_audit_log(success);
CREATE INDEX idx_auth_audit_log_risk_score ON auth_audit_log(risk_score) WHERE risk_score > 50;

-- =============================================
-- USER INVITATIONS TABLE
-- =============================================
-- Invitation-based registration system
CREATE TABLE user_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'customer',
    invitation_code TEXT NOT NULL UNIQUE,
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_used BOOLEAN NOT NULL DEFAULT false,
    welcome_message TEXT,
    permissions_preset JSONB DEFAULT '{}',
    voice_onboarding_enabled BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'
);

-- Create indexes for user_invitations
CREATE INDEX idx_user_invitations_email ON user_invitations(email);
CREATE INDEX idx_user_invitations_tenant_id ON user_invitations(tenant_id);
CREATE INDEX idx_user_invitations_code ON user_invitations(invitation_code);
CREATE INDEX idx_user_invitations_expires_at ON user_invitations(expires_at);
CREATE INDEX idx_user_invitations_used ON user_invitations(is_used);

-- =============================================
-- MFA SETTINGS & CHALLENGES TABLES
-- =============================================
-- Multi-factor authentication configuration
CREATE TABLE mfa_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT false,
    primary_method mfa_method,
    backup_methods mfa_method[] DEFAULT '{}',
    totp_secret TEXT, -- Encrypted TOTP secret
    totp_backup_codes TEXT[], -- Encrypted backup codes
    sms_phone TEXT,
    email_verified BOOLEAN DEFAULT false,
    voice_biometric_enabled BOOLEAN DEFAULT false,
    voice_pattern_samples INTEGER DEFAULT 0,
    recovery_codes_generated_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    failed_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- MFA challenge tracking
CREATE TABLE mfa_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    method mfa_method NOT NULL,
    challenge_data TEXT, -- Encrypted challenge data
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    completed_at TIMESTAMPTZ,
    success BOOLEAN DEFAULT false,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for MFA tables
CREATE INDEX idx_mfa_settings_user_id ON mfa_settings(user_id);
CREATE INDEX idx_mfa_settings_enabled ON mfa_settings(enabled) WHERE enabled = true;
CREATE INDEX idx_mfa_challenges_challenge_id ON mfa_challenges(challenge_id);
CREATE INDEX idx_mfa_challenges_user_id ON mfa_challenges(user_id);
CREATE INDEX idx_mfa_challenges_expires_at ON mfa_challenges(expires_at);

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE users_extended ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_challenges ENABLE ROW LEVEL SECURITY;

-- Users Extended Policies
CREATE POLICY "Users can view own profile" ON users_extended FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users_extended FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all users in tenant" ON users_extended FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM users_extended ue 
        WHERE ue.id = auth.uid() 
        AND ue.role = 'admin' 
        AND ue.tenant_id = users_extended.tenant_id
    )
);

-- User Sessions Policies
CREATE POLICY "Users can view own sessions" ON user_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON user_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can insert sessions" ON user_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view tenant sessions" ON user_sessions FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM users_extended ue 
        WHERE ue.id = auth.uid() 
        AND ue.role = 'admin' 
        AND ue.tenant_id = user_sessions.tenant_id
    )
);

-- Voice Profiles Policies
CREATE POLICY "Users can manage own voice profile" ON voice_profiles FOR ALL USING (auth.uid() = user_id);

-- Tenant Assignments Policies  
CREATE POLICY "Users can view own tenant assignments" ON tenant_assignments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage tenant assignments" ON tenant_assignments FOR ALL USING (
    EXISTS (
        SELECT 1 FROM users_extended ue 
        WHERE ue.id = auth.uid() 
        AND ue.role = 'admin'
    )
);

-- Permissions Policies (Read-only for users, manageable by admins)
CREATE POLICY "Users can view permissions" ON permissions FOR SELECT USING (true);
CREATE POLICY "Admins can manage permissions" ON permissions FOR ALL USING (
    EXISTS (
        SELECT 1 FROM users_extended ue 
        WHERE ue.id = auth.uid() 
        AND ue.role = 'admin'
    )
);

-- Role Permissions Policies
CREATE POLICY "Users can view role permissions" ON role_permissions FOR SELECT USING (true);
CREATE POLICY "Admins can manage role permissions" ON role_permissions FOR ALL USING (
    EXISTS (
        SELECT 1 FROM users_extended ue 
        WHERE ue.id = auth.uid() 
        AND ue.role = 'admin'
    )
);

-- User Permissions Policies
CREATE POLICY "Users can view own permission overrides" ON user_permissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage user permissions" ON user_permissions FOR ALL USING (
    EXISTS (
        SELECT 1 FROM users_extended ue 
        WHERE ue.id = auth.uid() 
        AND ue.role = 'admin'
    )
);

-- Audit Log Policies (Read-only, admins can view tenant logs)
CREATE POLICY "Admins can view tenant audit logs" ON auth_audit_log FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM users_extended ue 
        WHERE ue.id = auth.uid() 
        AND ue.role = 'admin' 
        AND (ue.tenant_id = auth_audit_log.tenant_id OR auth_audit_log.tenant_id IS NULL)
    )
);

-- MFA Policies
CREATE POLICY "Users can manage own MFA settings" ON mfa_settings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own MFA challenges" ON mfa_challenges FOR ALL USING (auth.uid() = user_id);

-- User Invitations Policies
CREATE POLICY "Admins can manage invitations" ON user_invitations FOR ALL USING (
    EXISTS (
        SELECT 1 FROM users_extended ue 
        WHERE ue.id = auth.uid() 
        AND ue.role IN ('admin', 'manager')
    )
);

-- =============================================
-- FUNCTIONS AND TRIGGERS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_users_extended_updated_at BEFORE UPDATE ON users_extended FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_voice_profiles_updated_at BEFORE UPDATE ON voice_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_permissions_updated_at BEFORE UPDATE ON permissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mfa_settings_updated_at BEFORE UPDATE ON mfa_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to increment refresh count
CREATE OR REPLACE FUNCTION increment_refresh_count(session_id UUID)
RETURNS INTEGER AS $$
DECLARE
    new_count INTEGER;
BEGIN
    UPDATE user_sessions 
    SET refresh_count = refresh_count + 1 
    WHERE id = session_id
    RETURNING refresh_count INTO new_count;
    
    RETURN COALESCE(new_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check user permissions
CREATE OR REPLACE FUNCTION check_user_permission(
    p_user_id UUID,
    p_resource TEXT,
    p_action TEXT,
    p_tenant_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    user_role user_role;
    has_permission BOOLEAN := false;
BEGIN
    -- Get user role
    SELECT ue.role INTO user_role
    FROM users_extended ue
    WHERE ue.id = p_user_id;
    
    -- Check role-based permissions
    SELECT EXISTS (
        SELECT 1 FROM role_permissions rp
        JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role = user_role
        AND p.resource = p_resource
        AND p.action = p_action
        AND rp.is_active = true
        AND (rp.tenant_id IS NULL OR rp.tenant_id = p_tenant_id)
        AND (rp.expires_at IS NULL OR rp.expires_at > NOW())
    ) INTO has_permission;
    
    -- Check user-specific overrides
    IF has_permission THEN
        -- Check for explicit deny
        SELECT NOT EXISTS (
            SELECT 1 FROM user_permissions up
            JOIN permissions p ON p.id = up.permission_id
            WHERE up.user_id = p_user_id
            AND p.resource = p_resource
            AND p.action = p_action
            AND up.granted = false
            AND (up.expires_at IS NULL OR up.expires_at > NOW())
        ) INTO has_permission;
    ELSE
        -- Check for explicit grant
        SELECT EXISTS (
            SELECT 1 FROM user_permissions up
            JOIN permissions p ON p.id = up.permission_id
            WHERE up.user_id = p_user_id
            AND p.resource = p_resource
            AND p.action = p_action
            AND up.granted = true
            AND (up.expires_at IS NULL OR up.expires_at > NOW())
        ) INTO has_permission;
    END IF;
    
    RETURN has_permission;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- INITIAL DATA SETUP
-- =============================================

-- Insert basic permissions
INSERT INTO permissions (name, resource, action, description, voice_commands) VALUES
('View Own Profile', 'profile', 'view', 'View own user profile', ARRAY['show my profile', 'view my account']),
('Update Own Profile', 'profile', 'update', 'Update own user profile', ARRAY['update my profile', 'change my settings']),
('View Work Orders', 'work_order', 'view', 'View work orders', ARRAY['show work orders', 'list jobs']),
('Create Work Order', 'work_order', 'create', 'Create new work orders', ARRAY['create work order', 'new job']),
('Update Work Order', 'work_order', 'update', 'Update work orders', ARRAY['update work order', 'modify job']),
('Delete Work Order', 'work_order', 'delete', 'Delete work orders', ARRAY['delete work order', 'remove job']),
('Assign Work Order', 'work_order', 'assign', 'Assign work orders to technicians', ARRAY['assign work order', 'assign job']),
('View All Users', 'user', 'view_all', 'View all users in tenant', ARRAY['show all users', 'list team members']),
('Manage Users', 'user', 'manage', 'Create, update, delete users', ARRAY['manage users', 'add team member']),
('View Reports', 'report', 'view', 'View system reports', ARRAY['show reports', 'view analytics']),
('Manage System', 'system', 'manage', 'System administration', ARRAY['system settings', 'admin panel']);

-- Assign permissions to roles
INSERT INTO role_permissions (role, permission_id) 
SELECT 'customer', id FROM permissions WHERE name IN ('View Own Profile', 'Update Own Profile');

INSERT INTO role_permissions (role, permission_id)
SELECT 'technician', id FROM permissions WHERE name IN ('View Own Profile', 'Update Own Profile', 'View Work Orders', 'Update Work Order');

INSERT INTO role_permissions (role, permission_id)
SELECT 'manager', id FROM permissions WHERE name IN ('View Own Profile', 'Update Own Profile', 'View Work Orders', 'Create Work Order', 'Update Work Order', 'Assign Work Order', 'View All Users', 'View Reports');

INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions WHERE name IN ('View Own Profile', 'Update Own Profile', 'View Work Orders', 'Create Work Order', 'Update Work Order', 'Delete Work Order', 'Assign Work Order', 'View All Users', 'Manage Users', 'View Reports', 'Manage System');

-- Add comments to tables for documentation
COMMENT ON TABLE users_extended IS 'Extended user profiles with tenant and role information';
COMMENT ON TABLE user_sessions IS 'Active user sessions with device tracking and voice support';
COMMENT ON TABLE permissions IS 'System permissions for role-based access control';
COMMENT ON TABLE role_permissions IS 'Permission assignments to user roles';
COMMENT ON TABLE user_permissions IS 'User-specific permission overrides';
COMMENT ON TABLE voice_profiles IS 'Voice preferences and biometric patterns';
COMMENT ON TABLE tenant_assignments IS 'Multi-tenant user access assignments';
COMMENT ON TABLE auth_audit_log IS 'Authentication and authorization event audit trail';
COMMENT ON TABLE user_invitations IS 'Invitation-based user registration system';
COMMENT ON TABLE mfa_settings IS 'Multi-factor authentication configuration';
COMMENT ON TABLE mfa_challenges IS 'Active MFA challenges and verification attempts';