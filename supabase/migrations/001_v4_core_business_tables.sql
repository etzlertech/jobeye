-- Migration: 001_v4_core_business_tables.sql
-- Purpose: Create core business entities for JobEye v4 Blueprint
-- Dependencies: Existing auth/tenant tables

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Create enum types (with checks for existing types)
DO $$ 
BEGIN
  -- Create job_status if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
    CREATE TYPE job_status AS ENUM (
      'draft',
      'scheduled',
      'dispatched',
      'in_progress',
      'paused',
      'completed',
      'cancelled',
      'failed',
      'voice_created'
    );
  END IF;
  
  -- Create job_priority if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_priority') THEN
    CREATE TYPE job_priority AS ENUM ('low', 'normal', 'high', 'urgent', 'emergency');
  END IF;
  
  -- Create equipment_status if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'equipment_status') THEN
    CREATE TYPE equipment_status AS ENUM ('active', 'maintenance', 'broken', 'retired', 'reserved');
  END IF;
  
  -- Create material_unit if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'material_unit') THEN
    CREATE TYPE material_unit AS ENUM ('each', 'box', 'case', 'pound', 'ounce', 'gallon', 'liter', 'foot', 'meter', 'hour', 'minute');
  END IF;
END $$;

-- Customers table
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_number VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  mobile_phone VARCHAR(50),
  billing_address JSONB,
  service_address JSONB,
  notes TEXT,
  tags TEXT[],
  voice_notes TEXT,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(tenant_id, customer_number)
);

-- Properties table
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  property_number VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  address JSONB NOT NULL,
  location GEOGRAPHY(POINT, 4326),
  property_type VARCHAR(100),
  size_sqft INTEGER,
  lot_size_acres NUMERIC(10,2),
  zones JSONB, -- irrigation zones, areas, etc.
  access_notes TEXT,
  gate_code VARCHAR(50),
  special_instructions TEXT,
  voice_navigation_notes TEXT,
  photos JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, property_number)
);

-- Job templates table
CREATE TABLE job_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  template_code VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  estimated_duration INTEGER, -- in minutes
  default_priority job_priority DEFAULT 'normal',
  required_skills TEXT[],
  required_equipment_types TEXT[],
  default_materials JSONB DEFAULT '[]'::jsonb,
  checklist_items JSONB DEFAULT '[]'::jsonb,
  voice_shortcuts TEXT[],
  voice_instructions TEXT,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, template_code)
);

-- Jobs table
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_number VARCHAR(50) NOT NULL,
  template_id UUID REFERENCES job_templates(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  property_id UUID REFERENCES properties(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status job_status DEFAULT 'draft',
  priority job_priority DEFAULT 'normal',
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  assigned_to UUID REFERENCES users_extended(id),
  assigned_team UUID[], -- array of user IDs
  estimated_duration INTEGER, -- minutes
  actual_duration INTEGER, -- minutes
  completion_notes TEXT,
  voice_notes TEXT,
  voice_created BOOLEAN DEFAULT false,
  voice_session_id UUID,
  checklist_items JSONB DEFAULT '[]'::jsonb,
  materials_used JSONB DEFAULT '[]'::jsonb,
  equipment_used UUID[],
  photos_before JSONB DEFAULT '[]'::jsonb,
  photos_after JSONB DEFAULT '[]'::jsonb,
  signature_required BOOLEAN DEFAULT false,
  signature_data JSONB,
  billing_info JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(tenant_id, job_number)
);

-- Equipment table
CREATE TABLE equipment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  equipment_number VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(100),
  make VARCHAR(100),
  model VARCHAR(100),
  serial_number VARCHAR(255),
  year INTEGER,
  status equipment_status DEFAULT 'active',
  current_location VARCHAR(255),
  home_location VARCHAR(255),
  assigned_to UUID REFERENCES users_extended(id),
  purchase_date DATE,
  purchase_price NUMERIC(12,2),
  current_value NUMERIC(12,2),
  maintenance_schedule JSONB,
  last_maintenance_date DATE,
  next_maintenance_date DATE,
  notes TEXT,
  qr_code VARCHAR(255),
  voice_identifier VARCHAR(100), -- for voice commands
  is_tracked BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, equipment_number)
);

-- Materials/Inventory table
CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sku VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  unit material_unit DEFAULT 'each',
  unit_cost NUMERIC(12,2),
  markup_percentage NUMERIC(5,2) DEFAULT 0,
  quantity_on_hand NUMERIC(12,2) DEFAULT 0,
  reorder_point NUMERIC(12,2),
  reorder_quantity NUMERIC(12,2),
  supplier_info JSONB,
  location VARCHAR(255),
  barcode VARCHAR(255),
  voice_name VARCHAR(100), -- simplified name for voice
  is_active BOOLEAN DEFAULT true,
  is_billable BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, sku)
);

-- Create indexes for performance
CREATE INDEX idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_properties_tenant_customer ON properties(tenant_id, customer_id);
CREATE INDEX idx_properties_location ON properties USING GIST(location);
CREATE INDEX idx_jobs_tenant_status ON jobs(tenant_id, status);
CREATE INDEX idx_jobs_scheduled_start ON jobs(scheduled_start);
CREATE INDEX idx_jobs_assigned_to ON jobs(assigned_to);
CREATE INDEX idx_jobs_customer_property ON jobs(customer_id, property_id);
CREATE INDEX idx_equipment_tenant_status ON equipment(tenant_id, status);
CREATE INDEX idx_materials_tenant_category ON materials(tenant_id, category);

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_job_templates_updated_at BEFORE UPDATE ON job_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON equipment
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security Policies
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

-- RLS Policies (tenant isolation)
CREATE POLICY "Users can view their tenant's customers" ON customers
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can manage their tenant's customers" ON customers
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Repeat similar policies for other tables
CREATE POLICY "Users can view their tenant's properties" ON properties
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can manage their tenant's properties" ON properties
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can view their tenant's job templates" ON job_templates
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can manage their tenant's job templates" ON job_templates
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can view their tenant's jobs" ON jobs
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can manage their tenant's jobs" ON jobs
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can view their tenant's equipment" ON equipment
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can manage their tenant's equipment" ON equipment
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can view their tenant's materials" ON materials
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Users can manage their tenant's materials" ON materials
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_assignments 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );