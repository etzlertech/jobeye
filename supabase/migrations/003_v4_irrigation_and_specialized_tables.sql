-- Migration: 003_v4_irrigation_and_specialized_tables.sql
-- Purpose: Create irrigation systems and other specialized tables for v4 Blueprint
-- Dependencies: 001_v4_core_business_tables.sql, 002_v4_voice_vision_media_tables.sql

-- Create enum types for irrigation (with checks for existing types)
DO $$ 
BEGIN
  -- Create irrigation_controller_type if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'irrigation_controller_type') THEN
    CREATE TYPE irrigation_controller_type AS ENUM ('smart', 'conventional', 'hybrid');
  END IF;
  
  -- Create zone_type if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'zone_type') THEN
    CREATE TYPE zone_type AS ENUM ('lawn', 'shrubs', 'trees', 'drip', 'garden', 'other');
  END IF;
  
  -- Create valve_status if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'valve_status') THEN
    CREATE TYPE valve_status AS ENUM ('open', 'closed', 'fault', 'unknown');
  END IF;
  
  -- Create schedule_type if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'schedule_type') THEN
    CREATE TYPE schedule_type AS ENUM ('fixed', 'smart', 'weather_based', 'seasonal', 'manual');
  END IF;
END $$;

-- Irrigation systems table
CREATE TABLE irrigation_systems (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  system_name VARCHAR(255) NOT NULL,
  controller_type irrigation_controller_type,
  controller_make VARCHAR(100),
  controller_model VARCHAR(100),
  controller_location TEXT,
  wifi_enabled BOOLEAN DEFAULT false,
  remote_access_enabled BOOLEAN DEFAULT false,
  rain_sensor_installed BOOLEAN DEFAULT false,
  flow_sensor_installed BOOLEAN DEFAULT false,
  backflow_device_info JSONB,
  last_inspection_date DATE,
  next_inspection_due DATE,
  winterization_date DATE,
  activation_date DATE,
  notes TEXT,
  voice_control_enabled BOOLEAN DEFAULT false,
  voice_commands JSONB DEFAULT '[]'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Irrigation zones table
CREATE TABLE irrigation_zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  system_id UUID NOT NULL REFERENCES irrigation_systems(id) ON DELETE CASCADE,
  zone_number INTEGER NOT NULL,
  zone_name VARCHAR(255),
  zone_type zone_type,
  area_sqft INTEGER,
  plant_type VARCHAR(100),
  soil_type VARCHAR(100),
  sun_exposure VARCHAR(50), -- 'full_sun', 'partial_shade', 'full_shade'
  slope_percentage INTEGER,
  
  -- Technical details
  valve_location TEXT,
  valve_size VARCHAR(20),
  valve_type VARCHAR(50),
  gpm_flow_rate NUMERIC(6,2),
  head_count INTEGER,
  head_type VARCHAR(100),
  nozzle_types JSONB,
  
  -- Runtime settings
  default_runtime_minutes INTEGER,
  cycle_soak_enabled BOOLEAN DEFAULT false,
  cycle_count INTEGER DEFAULT 1,
  soak_minutes INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  current_status valve_status DEFAULT 'closed',
  last_run_date TIMESTAMPTZ,
  total_runtime_ytd INTEGER DEFAULT 0, -- minutes this year
  
  -- Voice
  voice_identifier VARCHAR(100), -- "front lawn", "back shrubs", etc.
  
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(system_id, zone_number)
);

-- Irrigation schedules table
CREATE TABLE irrigation_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  system_id UUID NOT NULL REFERENCES irrigation_systems(id) ON DELETE CASCADE,
  schedule_name VARCHAR(255) NOT NULL,
  schedule_type schedule_type DEFAULT 'fixed',
  is_active BOOLEAN DEFAULT true,
  
  -- Schedule details
  start_date DATE,
  end_date DATE,
  days_of_week INTEGER[], -- 0-6 (Sun-Sat)
  start_times TIME[],
  
  -- Smart scheduling
  weather_adjustment_enabled BOOLEAN DEFAULT false,
  rain_delay_threshold NUMERIC(3,2), -- inches
  temperature_threshold INTEGER, -- fahrenheit
  wind_threshold INTEGER, -- mph
  
  -- Zone assignments
  zone_runtimes JSONB, -- {zone_id: minutes}
  
  -- Seasonal adjustments
  seasonal_adjustment INTEGER DEFAULT 100, -- percentage
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Irrigation runs history
CREATE TABLE irrigation_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  system_id UUID NOT NULL REFERENCES irrigation_systems(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES irrigation_schedules(id),
  zone_id UUID NOT NULL REFERENCES irrigation_zones(id),
  
  -- Run details
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  scheduled_minutes INTEGER,
  actual_minutes INTEGER,
  
  -- Trigger info
  triggered_by VARCHAR(50), -- 'schedule', 'manual', 'voice', 'api'
  triggered_by_user UUID REFERENCES auth.users(id),
  voice_command_id UUID REFERENCES voice_transcripts(id),
  
  -- Water usage
  gallons_used NUMERIC(10,2),
  
  -- Status
  status VARCHAR(50), -- 'running', 'completed', 'cancelled', 'failed'
  cancellation_reason TEXT,
  
  -- Weather at time of run
  weather_data JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Service history table (for tracking maintenance on any entity)
CREATE TABLE service_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Polymorphic association
  entity_type VARCHAR(50) NOT NULL, -- 'job', 'equipment', 'irrigation_system', 'vehicle', etc.
  entity_id UUID NOT NULL,
  
  -- Service details
  service_date DATE NOT NULL,
  service_type VARCHAR(100) NOT NULL,
  description TEXT,
  performed_by UUID REFERENCES users_extended(id),
  external_vendor VARCHAR(255),
  
  -- Parts and costs
  parts_used JSONB DEFAULT '[]'::jsonb,
  labor_hours NUMERIC(5,2),
  parts_cost NUMERIC(10,2),
  labor_cost NUMERIC(10,2),
  total_cost NUMERIC(10,2),
  
  -- Documentation
  notes TEXT,
  media_assets UUID[],
  voice_notes_id UUID REFERENCES voice_transcripts(id),
  
  -- Next service
  next_service_date DATE,
  next_service_type VARCHAR(100),
  
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Time entries table (for labor tracking)
CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users_extended(id),
  job_id UUID REFERENCES jobs(id),
  
  -- Time details
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  break_minutes INTEGER DEFAULT 0,
  total_minutes INTEGER,
  
  -- Location tracking
  clock_in_location GEOGRAPHY(POINT, 4326),
  clock_out_location GEOGRAPHY(POINT, 4326),
  clock_in_address TEXT,
  clock_out_address TEXT,
  
  -- Voice tracking
  voice_clock_in BOOLEAN DEFAULT false,
  voice_clock_out BOOLEAN DEFAULT false,
  voice_notes TEXT,
  
  -- Approval
  approved_by UUID REFERENCES users_extended(id),
  approved_at TIMESTAMPTZ,
  approval_notes TEXT,
  
  -- Billing
  billable BOOLEAN DEFAULT true,
  hourly_rate NUMERIC(10,2),
  total_cost NUMERIC(10,2),
  
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Routes and stops (for route optimization)
CREATE TABLE routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  route_name VARCHAR(255) NOT NULL,
  route_date DATE NOT NULL,
  assigned_to UUID REFERENCES users_extended(id),
  assigned_vehicle UUID REFERENCES equipment(id),
  
  -- Route details
  start_location GEOGRAPHY(POINT, 4326),
  end_location GEOGRAPHY(POINT, 4326),
  planned_start_time TIME,
  planned_duration_minutes INTEGER,
  
  -- Actual tracking
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  total_miles NUMERIC(6,1),
  
  -- Status
  status VARCHAR(50) DEFAULT 'planned', -- 'planned', 'in_progress', 'completed', 'cancelled'
  
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE route_stops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(id),
  stop_order INTEGER NOT NULL,
  
  -- Planning
  planned_arrival TIME,
  planned_duration_minutes INTEGER,
  
  -- Actual
  arrival_time TIMESTAMPTZ,
  departure_time TIMESTAMPTZ,
  
  -- Navigation
  distance_from_previous NUMERIC(6,1), -- miles
  drive_time_from_previous INTEGER, -- minutes
  
  -- Status
  completed BOOLEAN DEFAULT false,
  skipped BOOLEAN DEFAULT false,
  skip_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(route_id, stop_order)
);

-- Create indexes
CREATE INDEX idx_irrigation_systems_property ON irrigation_systems(property_id);
CREATE INDEX idx_irrigation_zones_system ON irrigation_zones(system_id);
CREATE INDEX idx_irrigation_zones_voice ON irrigation_zones(voice_identifier);
CREATE INDEX idx_irrigation_schedules_system ON irrigation_schedules(system_id);
CREATE INDEX idx_irrigation_schedules_active ON irrigation_schedules(is_active);
CREATE INDEX idx_irrigation_runs_system_zone ON irrigation_runs(system_id, zone_id);
CREATE INDEX idx_irrigation_runs_date ON irrigation_runs(started_at);
CREATE INDEX idx_service_history_entity ON service_history(entity_type, entity_id);
CREATE INDEX idx_service_history_date ON service_history(service_date);
CREATE INDEX idx_time_entries_user_date ON time_entries(user_id, clock_in);
CREATE INDEX idx_time_entries_job ON time_entries(job_id);
CREATE INDEX idx_routes_date_user ON routes(route_date, assigned_to);
CREATE INDEX idx_route_stops_route ON route_stops(route_id);

-- Add updated_at triggers
CREATE TRIGGER update_irrigation_systems_updated_at BEFORE UPDATE ON irrigation_systems
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_irrigation_zones_updated_at BEFORE UPDATE ON irrigation_zones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_irrigation_schedules_updated_at BEFORE UPDATE ON irrigation_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_history_updated_at BEFORE UPDATE ON service_history
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON routes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE irrigation_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE irrigation_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE irrigation_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE irrigation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_stops ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their tenant's irrigation systems" ON irrigation_systems
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can manage their tenant's irrigation systems" ON irrigation_systems
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Similar policies for other tables
CREATE POLICY "Users can view their tenant's irrigation zones" ON irrigation_zones
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can manage their tenant's irrigation zones" ON irrigation_zones
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can view their tenant's service history" ON service_history
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can manage their tenant's service history" ON service_history
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can view their own time entries" ON time_entries
  FOR SELECT USING (
    user_id = auth.uid() OR
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments 
      WHERE user_id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Users can create their own time entries" ON time_entries
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their tenant's routes" ON routes
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can manage their tenant's routes" ON routes
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can view route stops for their tenant's routes" ON route_stops
  FOR SELECT USING (
    route_id IN (
      SELECT id FROM routes WHERE tenant_id IN (
        SELECT tenant_id FROM tenant_assignments 
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

-- Helper function to calculate time entry duration
CREATE OR REPLACE FUNCTION calculate_time_entry_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.clock_out IS NOT NULL AND NEW.clock_in IS NOT NULL THEN
    NEW.total_minutes = EXTRACT(EPOCH FROM (NEW.clock_out - NEW.clock_in)) / 60 - COALESCE(NEW.break_minutes, 0);
    IF NEW.hourly_rate IS NOT NULL THEN
      NEW.total_cost = (NEW.total_minutes / 60.0) * NEW.hourly_rate;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_time_entry_before_save
  BEFORE INSERT OR UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION calculate_time_entry_duration();