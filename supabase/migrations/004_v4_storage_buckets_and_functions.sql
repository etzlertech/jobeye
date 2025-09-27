-- Migration: 004_v4_storage_buckets_and_functions.sql
-- Purpose: Create storage buckets and helper functions for v4 Blueprint
-- Dependencies: Previous migrations (001-003)

-- Create storage buckets (if storage extension is enabled)
-- Note: These need to be created via Supabase dashboard or CLI
-- This is just documentation of required buckets

/*
Required Storage Buckets:
1. job-photos - Public bucket for before/after job photos
2. voice-recordings - Private bucket for voice command recordings  
3. equipment-images - Public bucket for equipment photos
4. documents - Private bucket for documents and signatures
5. profile-avatars - Public bucket for user avatars
*/

-- Helper function to get user's active tenant
CREATE OR REPLACE FUNCTION get_user_tenant_id(user_id UUID)
RETURNS UUID AS $$
DECLARE
  tenant_id UUID;
BEGIN
  SELECT ta.tenant_id INTO tenant_id
  FROM tenant_assignments ta
  WHERE ta.user_id = $1
    AND ta.is_active = true
    AND ta.is_primary = true
  LIMIT 1;
  
  RETURN tenant_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Helper function to check if user has permission
CREATE OR REPLACE FUNCTION user_has_permission(
  user_id UUID,
  permission_name VARCHAR
)
RETURNS BOOLEAN AS $$
DECLARE
  has_permission BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1
    FROM permissions p
    INNER JOIN role_permissions rp ON rp.permission_id = p.id
    INNER JOIN tenant_assignments ta ON ta.role = rp.role
    WHERE ta.user_id = $1
      AND ta.is_active = true
      AND p.name = $2
      AND rp.is_active = true
  ) INTO has_permission;
  
  -- Also check user-specific permissions
  IF NOT has_permission THEN
    SELECT EXISTS(
      SELECT 1
      FROM permissions p
      INNER JOIN user_permissions up ON up.permission_id = p.id
      WHERE up.user_id = $1
        AND p.name = $2
        AND up.granted = true
        AND (up.expires_at IS NULL OR up.expires_at > NOW())
    ) INTO has_permission;
  END IF;
  
  RETURN has_permission;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to handle voice command processing
CREATE OR REPLACE FUNCTION process_voice_command(
  p_transcript_id UUID,
  p_intent_type intent_type,
  p_entities JSONB,
  p_confidence NUMERIC
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_job_id UUID;
  v_user_id UUID;
  v_tenant_id UUID;
BEGIN
  -- Get user and tenant from transcript
  SELECT vt.user_id, vt.tenant_id 
  INTO v_user_id, v_tenant_id
  FROM voice_transcripts vt
  WHERE vt.id = p_transcript_id;
  
  -- Process based on intent type
  CASE p_intent_type
    WHEN 'create_job' THEN
      -- Extract job details from entities
      INSERT INTO jobs (
        tenant_id,
        job_number,
        customer_id,
        property_id,
        title,
        description,
        voice_created,
        created_by
      ) VALUES (
        v_tenant_id,
        'VOX-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MI'),
        (p_entities->>'customer_id')::UUID,
        (p_entities->>'property_id')::UUID,
        p_entities->>'title',
        p_entities->>'description',
        true,
        v_user_id
      ) RETURNING id INTO v_job_id;
      
      v_result := jsonb_build_object(
        'success', true,
        'job_id', v_job_id,
        'message', 'Job created successfully'
      );
      
    WHEN 'update_job' THEN
      -- Update job status or details
      UPDATE jobs 
      SET status = COALESCE((p_entities->>'status')::job_status, status),
          voice_notes = COALESCE(voice_notes, '') || ' | ' || COALESCE(p_entities->>'notes', ''),
          updated_at = NOW()
      WHERE id = (p_entities->>'job_id')::UUID
        AND tenant_id = v_tenant_id;
        
      v_result := jsonb_build_object(
        'success', true,
        'message', 'Job updated successfully'
      );
      
    ELSE
      v_result := jsonb_build_object(
        'success', false,
        'message', 'Intent type not implemented'
      );
  END CASE;
  
  -- Record the intent recognition
  INSERT INTO intent_recognitions (
    tenant_id,
    transcript_id,
    user_id,
    intent_type,
    confidence_score,
    entities,
    action_taken,
    success
  ) VALUES (
    v_tenant_id,
    p_transcript_id,
    v_user_id,
    p_intent_type,
    p_confidence,
    p_entities,
    v_result,
    (v_result->>'success')::boolean
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get job summary for voice response
CREATE OR REPLACE FUNCTION get_job_voice_summary(p_job_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_summary TEXT;
  v_job RECORD;
BEGIN
  SELECT 
    j.job_number,
    j.title,
    j.status,
    c.name as customer_name,
    p.name as property_name,
    j.scheduled_start
  INTO v_job
  FROM jobs j
  LEFT JOIN customers c ON c.id = j.customer_id
  LEFT JOIN properties p ON p.id = j.property_id
  WHERE j.id = p_job_id;
  
  IF NOT FOUND THEN
    RETURN 'Job not found';
  END IF;
  
  v_summary := format(
    'Job %s: %s for %s at %s. Status: %s.',
    v_job.job_number,
    v_job.title,
    v_job.customer_name,
    v_job.property_name,
    v_job.status
  );
  
  IF v_job.scheduled_start IS NOT NULL THEN
    v_summary := v_summary || format(
      ' Scheduled for %s.',
      TO_CHAR(v_job.scheduled_start, 'Month DD at HH12:MI AM')
    );
  END IF;
  
  RETURN v_summary;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to handle irrigation zone voice control
CREATE OR REPLACE FUNCTION control_irrigation_zone_voice(
  p_zone_identifier VARCHAR,
  p_action VARCHAR, -- 'start', 'stop'
  p_duration_minutes INTEGER DEFAULT NULL,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_zone_id UUID;
  v_system_id UUID;
  v_tenant_id UUID;
  v_run_id UUID;
BEGIN
  -- Find zone by voice identifier
  SELECT iz.id, iz.system_id, iz.tenant_id
  INTO v_zone_id, v_system_id, v_tenant_id
  FROM irrigation_zones iz
  WHERE LOWER(iz.voice_identifier) = LOWER(p_zone_identifier)
    AND iz.is_active = true;
    
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Zone not found: ' || p_zone_identifier
    );
  END IF;
  
  CASE p_action
    WHEN 'start' THEN
      -- Check if zone is already running
      IF EXISTS(
        SELECT 1 FROM irrigation_runs
        WHERE zone_id = v_zone_id
          AND status = 'running'
      ) THEN
        RETURN jsonb_build_object(
          'success', false,
          'message', 'Zone is already running'
        );
      END IF;
      
      -- Start irrigation run
      INSERT INTO irrigation_runs (
        tenant_id,
        system_id,
        zone_id,
        started_at,
        scheduled_minutes,
        triggered_by,
        triggered_by_user,
        status
      ) VALUES (
        v_tenant_id,
        v_system_id,
        v_zone_id,
        NOW(),
        COALESCE(p_duration_minutes, 
          (SELECT default_runtime_minutes FROM irrigation_zones WHERE id = v_zone_id)
        ),
        'voice',
        p_user_id,
        'running'
      ) RETURNING id INTO v_run_id;
      
      -- Update zone status
      UPDATE irrigation_zones 
      SET current_status = 'open'::valve_status,
          last_run_date = NOW()
      WHERE id = v_zone_id;
      
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Irrigation started',
        'run_id', v_run_id,
        'duration_minutes', COALESCE(p_duration_minutes, 
          (SELECT default_runtime_minutes FROM irrigation_zones WHERE id = v_zone_id)
        )
      );
      
    WHEN 'stop' THEN
      -- Stop any running irrigation
      UPDATE irrigation_runs
      SET ended_at = NOW(),
          status = 'completed',
          actual_minutes = EXTRACT(EPOCH FROM (NOW() - started_at)) / 60
      WHERE zone_id = v_zone_id
        AND status = 'running';
        
      -- Update zone status
      UPDATE irrigation_zones 
      SET current_status = 'closed'::valve_status
      WHERE id = v_zone_id;
      
      RETURN jsonb_build_object(
        'success', true,
        'message', 'Irrigation stopped'
      );
      
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'message', 'Unknown action: ' || p_action
      );
  END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate daily route
CREATE OR REPLACE FUNCTION generate_daily_route(
  p_user_id UUID,
  p_date DATE
)
RETURNS UUID AS $$
DECLARE
  v_route_id UUID;
  v_tenant_id UUID;
  v_stop_order INTEGER := 0;
  r RECORD;
BEGIN
  -- Get user's tenant
  v_tenant_id := get_user_tenant_id(p_user_id);
  
  -- Create route
  INSERT INTO routes (
    tenant_id,
    route_name,
    route_date,
    assigned_to,
    status
  ) VALUES (
    v_tenant_id,
    'Route for ' || TO_CHAR(p_date, 'Mon DD'),
    p_date,
    p_user_id,
    'planned'
  ) RETURNING id INTO v_route_id;
  
  -- Add scheduled jobs as stops
  FOR r IN (
    SELECT j.id as job_id
    FROM jobs j
    WHERE j.assigned_to = p_user_id
      AND j.scheduled_start::date = p_date
      AND j.status IN ('scheduled', 'dispatched')
    ORDER BY j.scheduled_start
  ) LOOP
    v_stop_order := v_stop_order + 1;
    
    INSERT INTO route_stops (
      route_id,
      job_id,
      stop_order
    ) VALUES (
      v_route_id,
      r.job_id,
      v_stop_order
    );
  END LOOP;
  
  RETURN v_route_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Views for common queries
CREATE OR REPLACE VIEW active_jobs_view AS
SELECT 
  j.*,
  c.name as customer_name,
  c.phone as customer_phone,
  p.name as property_name,
  p.address as property_address,
  u.display_name as assigned_to_name
FROM jobs j
LEFT JOIN customers c ON c.id = j.customer_id
LEFT JOIN properties p ON p.id = j.property_id
LEFT JOIN users_extended u ON u.id = j.assigned_to
WHERE j.status NOT IN ('completed', 'cancelled');

CREATE OR REPLACE VIEW irrigation_zone_status AS
SELECT 
  iz.*,
  isys.system_name,
  isys.property_id,
  p.name as property_name,
  (
    SELECT COUNT(*) 
    FROM irrigation_runs ir 
    WHERE ir.zone_id = iz.id 
    AND ir.status = 'running'
  ) > 0 as is_running
FROM irrigation_zones iz
JOIN irrigation_systems isys ON isys.id = iz.system_id
JOIN properties p ON p.id = isys.property_id
WHERE iz.is_active = true;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_user_tenant_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_permission(UUID, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION process_voice_command(UUID, intent_type, JSONB, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION get_job_voice_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION control_irrigation_zone_voice(VARCHAR, VARCHAR, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_daily_route(UUID, DATE) TO authenticated;

GRANT SELECT ON active_jobs_view TO authenticated;
GRANT SELECT ON irrigation_zone_status TO authenticated;