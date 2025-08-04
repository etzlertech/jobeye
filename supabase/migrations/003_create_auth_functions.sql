-- --- AGENT DIRECTIVE BLOCK ---
-- file: /supabase/migrations/003_create_auth_functions.sql
-- purpose: Create authentication helper functions, triggers, and scheduled jobs for user management, session cleanup, and audit logging
-- spec_ref: auth#functions-migration
-- version: 2025-08-1
-- domain: authentication
-- phase: 1
-- complexity_budget: medium
-- offline_capability: NONE
--
-- dependencies:
--   - internal: ['002_create_auth_tables.sql']
--   - external: ['supabase', 'postgresql', 'pg_cron']
--
-- exports:
--   - handle_new_user() - Automatic user profile creation on auth.users insert
--   - cleanup_expired_sessions() - Remove expired sessions and update statistics
--   - log_auth_event() - Centralized authentication event logging
--   - get_user_permissions() - Aggregate user permissions with role inheritance
--   - validate_tenant_access() - Validate user access to specific tenant
--   - update_user_last_login() - Update user login timestamp
--   - generate_invitation_code() - Create secure invitation codes
--   - validate_voice_session() - Check voice session validity and extend timeout
--   - calculate_session_risk_score() - Security risk assessment for sessions
--   - archive_old_audit_logs() - Archive old audit log entries
--
-- voice_considerations: >
--   Voice session validation should handle device sleep/wake cycles gracefully.
--   Voice profile initialization should set appropriate defaults for speech recognition.
--   Voice audit logging should capture voice-specific events and confidence scores.
--
-- security_considerations: >
--   All functions must enforce Row Level Security and tenant isolation.
--   Audit logging functions must be tamper-resistant and log their own failures.
--   Session cleanup must securely delete sensitive data without leaving traces.
--   Permission aggregation must prevent privilege escalation through role inheritance.
--   Tenant validation must be cryptographically secure and prevent domain spoofing.
--
-- performance_considerations: >
--   Functions should be optimized for frequent execution with minimal database load.
--   Session cleanup should use efficient batch operations to avoid lock contention.
--   Permission aggregation should use cached results where possible.
--   Audit logging should be asynchronous to avoid blocking user operations.
--   Scheduled jobs should be optimized to run during low-traffic periods.
--
-- tasks:
--   1. [USER_SETUP] Create handle_new_user trigger function for automatic profile creation
--   2. [SESSION_CLEANUP] Create cleanup_expired_sessions function with batch processing
--   3. [AUDIT_LOG] Create log_auth_event function for centralized event logging
--   4. [PERMISSIONS] Create get_user_permissions function with role inheritance
--   5. [TENANT_ACCESS] Create validate_tenant_access function with security validation
--   6. [LOGIN_UPDATE] Create update_user_last_login function for timestamp management
--   7. [INVITATIONS] Create generate_invitation_code function for secure codes
--   8. [VOICE_SESSION] Create validate_voice_session function for voice timeout management
--   9. [RISK_ASSESSMENT] Create calculate_session_risk_score function for security monitoring
--  10. [SCHEDULED_JOBS] Create scheduled jobs for maintenance and cleanup operations
-- --- END DIRECTIVE BLOCK ---

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- USER SETUP FUNCTIONS
-- =============================================

-- Function to handle new user creation and setup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    default_tenant_id UUID;
    user_role user_role := 'customer';
    display_name TEXT;
BEGIN
    -- Extract role and tenant from user metadata
    IF NEW.raw_user_meta_data IS NOT NULL THEN
        user_role := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'customer');
        default_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::UUID;
    END IF;

    -- Get default tenant if none specified
    IF default_tenant_id IS NULL THEN
        SELECT id INTO default_tenant_id 
        FROM tenants 
        WHERE is_default = true 
        LIMIT 1;
    END IF;

    -- Generate display name from email
    display_name := COALESCE(
        NEW.raw_user_meta_data->>'display_name',
        split_part(NEW.email, '@', 1)
    );

    -- Create extended user profile
    INSERT INTO users_extended (
        id,
        tenant_id,
        role,
        display_name,
        first_name,
        last_name,
        phone,
        timezone,
        preferred_language,
        is_active,
        email_verified_at,
        terms_accepted_at,
        marketing_consent,
        metadata,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        default_tenant_id,
        user_role,
        display_name,
        NEW.raw_user_meta_data->>'first_name',
        NEW.raw_user_meta_data->>'last_name',
        NEW.phone,
        COALESCE(NEW.raw_user_meta_data->>'timezone', 'UTC'),
        COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'en-US'),
        true,
        CASE WHEN NEW.email_confirmed_at IS NOT NULL THEN NEW.email_confirmed_at ELSE NULL END,
        (NEW.raw_user_meta_data->>'terms_accepted_at')::TIMESTAMPTZ,
        COALESCE((NEW.raw_user_meta_data->>'marketing_consent')::BOOLEAN, false),
        COALESCE(NEW.raw_user_meta_data, '{}'::JSONB),
        NOW(),
        NOW()
    );

    -- Create tenant assignment
    INSERT INTO tenant_assignments (
        user_id,
        tenant_id,
        role,
        is_primary,
        assigned_at,
        is_active
    ) VALUES (
        NEW.id,
        default_tenant_id,
        user_role,
        true,
        NOW(),
        true
    );

    -- Create default voice profile
    INSERT INTO voice_profiles (
        user_id,
        wake_word,
        speech_rate,
        voice_pitch,
        language_code,
        voice_feedback_enabled,
        preferred_tts_provider,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        'hey assistant',
        1.0,
        1.0,
        COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'en-US'),
        true,
        'system',
        NOW(),
        NOW()
    );

    -- Log user creation event
    PERFORM log_auth_event(
        'registration_success',
        NEW.id,
        NEW.email,
        default_tenant_id,
        NULL, -- session_id
        (NEW.raw_user_meta_data->>'registration_ip')::INET,
        NEW.raw_user_meta_data->>'registration_user_agent',
        NULL, -- device_type
        NULL, -- location
        true, -- success
        'User profile created automatically',
        NULL, -- error_code
        NULL, -- risk_score
        jsonb_build_object(
            'role', user_role,
            'tenant_id', default_tenant_id,
            'display_name', display_name
        )
    );

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the user creation
        PERFORM log_auth_event(
            'registration_failed',
            NEW.id,
            NEW.email,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            NULL,
            false,
            'Profile creation failed: ' || SQLERRM,
            SQLSTATE,
            NULL,
            jsonb_build_object('error', SQLERRM)
        );
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new user handling
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- SESSION MANAGEMENT FUNCTIONS
-- =============================================

-- Function to cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS TABLE (
    sessions_cleaned INTEGER,
    voice_sessions_cleaned INTEGER,
    mfa_challenges_cleaned INTEGER
)
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    session_count INTEGER := 0;
    voice_session_count INTEGER := 0;
    mfa_challenge_count INTEGER := 0;
    cleanup_date TIMESTAMPTZ := NOW() - INTERVAL '30 days';
BEGIN
    -- Update expired sessions to terminated status
    UPDATE user_sessions 
    SET 
        status = 'expired',
        ended_at = NOW(),
        voice_session_active = false,
        voice_session_terminated = true
    WHERE 
        status = 'active' 
        AND expires_at < NOW();
    
    GET DIAGNOSTICS session_count = ROW_COUNT;

    -- Clean up old voice session data
    UPDATE user_sessions
    SET 
        conversation_context = '{}',
        voice_session_id = NULL,
        wake_word_active = false
    WHERE 
        voice_session_expires_at < NOW() - INTERVAL '1 hour'
        AND voice_session_active = true;
    
    GET DIAGNOSTICS voice_session_count = ROW_COUNT;

    -- Remove old expired session records (keep for 30 days)
    DELETE FROM user_sessions 
    WHERE 
        status IN ('expired', 'terminated') 
        AND ended_at < cleanup_date;

    -- Clean up expired MFA challenges
    DELETE FROM mfa_challenges 
    WHERE expires_at < NOW() - INTERVAL '1 hour';
    
    GET DIAGNOSTICS mfa_challenge_count = ROW_COUNT;

    -- Log cleanup activity
    PERFORM log_auth_event(
        'session_cleanup',
        NULL, -- user_id
        NULL, -- user_email
        NULL, -- tenant_id
        NULL, -- session_id
        NULL, -- ip_address
        'system', -- user_agent
        NULL, -- device_type
        NULL, -- location
        true, -- success
        'Automated session cleanup completed',
        NULL, -- error_code
        NULL, -- risk_score
        jsonb_build_object(
            'sessions_cleaned', session_count,
            'voice_sessions_cleaned', voice_session_count,
            'mfa_challenges_cleaned', mfa_challenge_count,
            'cleanup_date', cleanup_date
        )
    );

    RETURN QUERY SELECT session_count, voice_session_count, mfa_challenge_count;
END;
$$ LANGUAGE plpgsql;

-- Function to validate and extend voice sessions
CREATE OR REPLACE FUNCTION validate_voice_session(
    p_user_id UUID,
    p_session_id UUID DEFAULT NULL,
    p_extend_timeout BOOLEAN DEFAULT true
)
RETURNS TABLE (
    is_valid BOOLEAN,
    expires_at TIMESTAMPTZ,
    voice_session_id TEXT,
    conversation_context JSONB
)
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    session_record RECORD;
    new_expires_at TIMESTAMPTZ;
BEGIN
    -- Find active voice session
    SELECT 
        us.id,
        us.voice_session_id,
        us.voice_session_expires_at,
        us.voice_session_active,
        us.conversation_context,
        us.wake_word_active
    INTO session_record
    FROM user_sessions us
    WHERE 
        us.user_id = p_user_id
        AND us.device_type = 'voice_assistant'
        AND us.status = 'active'
        AND us.voice_session_active = true
        AND (p_session_id IS NULL OR us.id = p_session_id)
        AND us.voice_session_expires_at > NOW()
    ORDER BY us.last_activity_at DESC
    LIMIT 1;

    IF session_record.id IS NULL THEN
        -- No valid voice session found
        RETURN QUERY SELECT false, NULL::TIMESTAMPTZ, NULL::TEXT, NULL::JSONB;
        RETURN;
    END IF;

    -- Extend voice session timeout if requested
    IF p_extend_timeout THEN
        new_expires_at := NOW() + INTERVAL '8 hours'; -- Voice sessions get 8 hour timeout
        
        UPDATE user_sessions
        SET 
            voice_session_expires_at = new_expires_at,
            last_activity_at = NOW(),
            updated_at = NOW()
        WHERE id = session_record.id;
    ELSE
        new_expires_at := session_record.voice_session_expires_at;
    END IF;

    -- Return session validity and data
    RETURN QUERY SELECT 
        true,
        new_expires_at,
        session_record.voice_session_id,
        session_record.conversation_context;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- AUDIT LOGGING FUNCTIONS
-- =============================================

-- Centralized authentication event logging
CREATE OR REPLACE FUNCTION log_auth_event(
    p_event_type auth_event_type,
    p_user_id UUID DEFAULT NULL,
    p_user_email TEXT DEFAULT NULL,
    p_tenant_id UUID DEFAULT NULL,
    p_session_id UUID DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_device_type device_type DEFAULT NULL,
    p_location JSONB DEFAULT NULL,
    p_success BOOLEAN DEFAULT NULL,
    p_reason TEXT DEFAULT NULL,
    p_error_code TEXT DEFAULT NULL,
    p_risk_score INTEGER DEFAULT NULL,
    p_details JSONB DEFAULT '{}',
    p_voice_command TEXT DEFAULT NULL,
    p_voice_confidence DECIMAL DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO auth_audit_log (
        event_type,
        user_id,
        user_email,
        tenant_id,
        session_id,
        ip_address,
        user_agent,
        device_type,
        location,
        success,
        reason,
        error_code,
        risk_score,
        details,
        voice_command,
        voice_confidence,
        created_at
    ) VALUES (
        p_event_type,
        p_user_id,
        p_user_email,
        p_tenant_id,
        p_session_id,
        p_ip_address,
        p_user_agent,
        p_device_type,
        p_location,
        p_success,
        p_reason,
        p_error_code,
        p_risk_score,
        p_details,
        p_voice_command,
        p_voice_confidence,
        NOW()
    ) RETURNING id INTO log_id;

    RETURN log_id;
EXCEPTION
    WHEN OTHERS THEN
        -- If audit logging fails, we don't want to break the main operation
        -- Log to PostgreSQL's system log instead
        RAISE WARNING 'Audit logging failed for event %: %', p_event_type, SQLERRM;
        RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to archive old audit logs
CREATE OR REPLACE FUNCTION archive_old_audit_logs(
    p_archive_days INTEGER DEFAULT 90
)
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    archive_date TIMESTAMPTZ := NOW() - (p_archive_days || ' days')::INTERVAL;
    archived_count INTEGER := 0;
BEGIN
    -- Create archive table if it doesn't exist
    CREATE TABLE IF NOT EXISTS auth_audit_log_archive (
        LIKE auth_audit_log INCLUDING ALL
    );

    -- Move old records to archive
    WITH archived_records AS (
        DELETE FROM auth_audit_log 
        WHERE created_at < archive_date
        RETURNING *
    )
    INSERT INTO auth_audit_log_archive 
    SELECT * FROM archived_records;
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;

    -- Log the archival
    PERFORM log_auth_event(
        'system_maintenance',
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        'system',
        NULL,
        NULL,
        true,
        'Audit log archival completed',
        NULL,
        NULL,
        jsonb_build_object(
            'archived_count', archived_count,
            'archive_date', archive_date,
            'archive_days', p_archive_days
        )
    );

    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- PERMISSION FUNCTIONS
-- =============================================

-- Function to get aggregated user permissions
CREATE OR REPLACE FUNCTION get_user_permissions(
    p_user_id UUID,
    p_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE (
    permission_name TEXT,
    resource TEXT,
    action TEXT,
    granted BOOLEAN,
    source TEXT,
    voice_commands TEXT[]
)
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_role user_role;
    user_tenant_id UUID;
BEGIN
    -- Get user role and tenant
    SELECT ue.role, ue.tenant_id
    INTO user_role, user_tenant_id
    FROM users_extended ue
    WHERE ue.id = p_user_id;

    IF user_role IS NULL THEN
        RETURN;
    END IF;

    -- Use provided tenant_id or user's primary tenant
    user_tenant_id := COALESCE(p_tenant_id, user_tenant_id);

    -- Return role-based permissions
    RETURN QUERY
    SELECT 
        p.name,
        p.resource,
        p.action,
        true as granted,
        'role:' || user_role::TEXT as source,
        p.voice_commands
    FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    WHERE 
        rp.role = user_role
        AND rp.is_active = true
        AND (rp.tenant_id IS NULL OR rp.tenant_id = user_tenant_id)
        AND (rp.expires_at IS NULL OR rp.expires_at > NOW())
    
    UNION ALL
    
    -- Return user-specific permission overrides
    SELECT 
        p.name,
        p.resource,
        p.action,
        up.granted,
        'user_override' as source,
        p.voice_commands
    FROM user_permissions up
    JOIN permissions p ON p.id = up.permission_id
    WHERE 
        up.user_id = p_user_id
        AND (up.expires_at IS NULL OR up.expires_at > NOW())
    
    ORDER BY resource, action, source;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- TENANT ACCESS FUNCTIONS
-- =============================================

-- Function to validate tenant access
CREATE OR REPLACE FUNCTION validate_tenant_access(
    p_user_id UUID,
    p_tenant_id UUID,
    p_required_role user_role DEFAULT NULL
)
RETURNS TABLE (
    has_access BOOLEAN,
    user_role user_role,
    is_primary BOOLEAN,
    access_level INTEGER
)
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    assignment_record RECORD;
BEGIN
    -- Check tenant assignment
    SELECT 
        ta.role,
        ta.is_primary,
        ta.access_level,
        ta.is_active,
        ta.expires_at
    INTO assignment_record
    FROM tenant_assignments ta
    WHERE 
        ta.user_id = p_user_id
        AND ta.tenant_id = p_tenant_id
        AND ta.is_active = true
        AND (ta.expires_at IS NULL OR ta.expires_at > NOW());

    -- Check if assignment exists and meets role requirement
    IF assignment_record.role IS NOT NULL THEN
        -- Check role hierarchy if required role specified
        IF p_required_role IS NOT NULL THEN
            IF NOT check_role_hierarchy(assignment_record.role, p_required_role) THEN
                RETURN QUERY SELECT false, assignment_record.role, assignment_record.is_primary, assignment_record.access_level;
                RETURN;
            END IF;
        END IF;

        RETURN QUERY SELECT true, assignment_record.role, assignment_record.is_primary, assignment_record.access_level;
    ELSE
        RETURN QUERY SELECT false, NULL::user_role, false, 0;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Helper function to check role hierarchy
CREATE OR REPLACE FUNCTION check_role_hierarchy(
    p_user_role user_role,
    p_required_role user_role
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    role_levels JSONB := '{
        "customer": 1,
        "technician": 2,
        "manager": 3,
        "admin": 4
    }';
BEGIN
    RETURN (role_levels->>p_user_role::TEXT)::INTEGER >= (role_levels->>p_required_role::TEXT)::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- USER MANAGEMENT FUNCTIONS
-- =============================================

-- Function to update user last login
CREATE OR REPLACE FUNCTION update_user_last_login(
    p_user_id UUID,
    p_ip_address INET DEFAULT NULL,
    p_device_type device_type DEFAULT NULL
)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE users_extended
    SET 
        last_login_at = NOW(),
        failed_login_attempts = 0,
        locked_until = NULL,
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Log successful login
    PERFORM log_auth_event(
        'login_success',
        p_user_id,
        NULL,
        NULL,
        NULL,
        p_ip_address,
        NULL,
        p_device_type,
        NULL,
        true,
        'Login timestamp updated',
        NULL,
        NULL,
        jsonb_build_object('timestamp_updated', true)
    );

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to generate secure invitation codes
CREATE OR REPLACE FUNCTION generate_invitation_code()
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    code_length INTEGER := 32;
    characters TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..code_length LOOP
        result := result || substr(characters, floor(random() * length(characters) + 1)::INTEGER, 1);
    END LOOP;
    
    -- Ensure uniqueness
    WHILE EXISTS(SELECT 1 FROM user_invitations WHERE invitation_code = result) LOOP
        result := '';
        FOR i IN 1..code_length LOOP
            result := result || substr(characters, floor(random() * length(characters) + 1)::INTEGER, 1);
        END LOOP;
    END LOOP;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- SECURITY FUNCTIONS
-- =============================================

-- Function to calculate session risk score
CREATE OR REPLACE FUNCTION calculate_session_risk_score(
    p_user_id UUID,
    p_ip_address INET,
    p_device_fingerprint TEXT DEFAULT NULL,
    p_location JSONB DEFAULT NULL
)
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    risk_score INTEGER := 0;
    recent_logins INTEGER;
    different_locations INTEGER;
    failed_attempts INTEGER;
BEGIN
    -- Check for multiple recent logins from different IPs
    SELECT COUNT(DISTINCT ip_address)
    INTO recent_logins
    FROM user_sessions
    WHERE 
        user_id = p_user_id
        AND created_at > NOW() - INTERVAL '1 hour'
        AND ip_address != p_ip_address;

    risk_score := risk_score + (recent_logins * 10);

    -- Check for logins from unusual locations
    IF p_location IS NOT NULL THEN
        SELECT COUNT(*)
        INTO different_locations
        FROM user_sessions
        WHERE 
            user_id = p_user_id
            AND created_at > NOW() - INTERVAL '24 hours'
            AND location IS NOT NULL
            AND location->>'country' != p_location->>'country';

        risk_score := risk_score + (different_locations * 15);
    END IF;

    -- Check recent failed login attempts
    SELECT failed_login_attempts
    INTO failed_attempts
    FROM users_extended
    WHERE id = p_user_id;

    risk_score := risk_score + (COALESCE(failed_attempts, 0) * 5);

    -- Check for suspicious patterns in audit log
    SELECT COUNT(*)
    INTO recent_logins
    FROM auth_audit_log
    WHERE 
        user_id = p_user_id
        AND event_type = 'login_failed'
        AND created_at > NOW() - INTERVAL '1 hour';

    risk_score := risk_score + (recent_logins * 8);

    -- Cap risk score at 100
    RETURN LEAST(risk_score, 100);
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- SCHEDULED JOBS
-- =============================================

-- Schedule session cleanup job (runs every hour)
SELECT cron.schedule(
    'cleanup-expired-sessions',
    '0 * * * *', -- Every hour at minute 0
    'SELECT cleanup_expired_sessions();'
);

-- Schedule audit log archival job (runs daily at 2 AM)
SELECT cron.schedule(
    'archive-audit-logs',
    '0 2 * * *', -- Daily at 2 AM
    'SELECT archive_old_audit_logs(90);'
);

-- Schedule MFA challenge cleanup (runs every 15 minutes)
SELECT cron.schedule(
    'cleanup-mfa-challenges',
    '*/15 * * * *', -- Every 15 minutes
    'DELETE FROM mfa_challenges WHERE expires_at < NOW() - INTERVAL ''1 hour'';'
);

-- =============================================
-- ADDITIONAL TRIGGERS
-- =============================================

-- Trigger to automatically log login attempts
CREATE OR REPLACE FUNCTION log_login_attempt()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- This would be called from application layer
    -- Included here for completeness
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update session activity
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.last_activity_at := NOW();
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply session activity trigger
CREATE TRIGGER update_user_sessions_activity
    BEFORE UPDATE ON user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_session_activity();

-- =============================================
-- GRANTS AND PERMISSIONS
-- =============================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_user_permissions(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_tenant_access(UUID, UUID, user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_voice_session(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_last_login(UUID, INET, device_type) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_session_risk_score(UUID, INET, TEXT, JSONB) TO authenticated;

-- Grant execute permissions to service role for system functions
GRANT EXECUTE ON FUNCTION cleanup_expired_sessions() TO service_role;
GRANT EXECUTE ON FUNCTION archive_old_audit_logs(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION log_auth_event(auth_event_type, UUID, TEXT, UUID, UUID, INET, TEXT, device_type, JSONB, BOOLEAN, TEXT, TEXT, INTEGER, JSONB, TEXT, DECIMAL) TO service_role;
GRANT EXECUTE ON FUNCTION generate_invitation_code() TO service_role;

-- Add function comments for documentation
COMMENT ON FUNCTION handle_new_user() IS 'Automatically creates user profile, tenant assignment, and voice profile when new user registers';
COMMENT ON FUNCTION cleanup_expired_sessions() IS 'Removes expired sessions and cleans up old session data';
COMMENT ON FUNCTION log_auth_event(auth_event_type, UUID, TEXT, UUID, UUID, INET, TEXT, device_type, JSONB, BOOLEAN, TEXT, TEXT, INTEGER, JSONB, TEXT, DECIMAL) IS 'Centralized authentication event logging with error handling';
COMMENT ON FUNCTION get_user_permissions(UUID, UUID) IS 'Returns aggregated user permissions including role-based and user-specific overrides';
COMMENT ON FUNCTION validate_tenant_access(UUID, UUID, user_role) IS 'Validates user access to specific tenant with role requirements';
COMMENT ON FUNCTION validate_voice_session(UUID, UUID, BOOLEAN) IS 'Validates and optionally extends voice session timeouts';
COMMENT ON FUNCTION calculate_session_risk_score(UUID, INET, TEXT, JSONB) IS 'Calculates security risk score for user sessions based on behavior patterns';