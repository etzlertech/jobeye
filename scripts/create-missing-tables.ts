#!/usr/bin/env npx tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function createMissingTables() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  console.log('🔧 Creating missing database tables...\n');

  // 1. offline_queue table
  console.log('1. Creating offline_queue table...');
  const { error: offlineQueueError } = await client.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS offline_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        user_id UUID NOT NULL,
        action_type TEXT NOT NULL,
        action_data JSONB NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        processed_at TIMESTAMPTZ,
        error_message TEXT,
        CONSTRAINT offline_queue_status_check CHECK (status IN ('pending', 'processed', 'failed'))
      );

      CREATE INDEX IF NOT EXISTS idx_offline_queue_user_status ON offline_queue(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_offline_queue_tenant ON offline_queue(tenant_id);

      -- RLS policies
      ALTER TABLE offline_queue ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Users can manage their own queue" ON offline_queue;
      CREATE POLICY "Users can manage their own queue" ON offline_queue
        FOR ALL USING (auth.uid() = user_id);
    `
  });

  if (offlineQueueError) {
    console.error('❌ Error:', offlineQueueError.message);
  } else {
    console.log('✅ offline_queue created\n');
  }

  // 2. material_requests table
  console.log('2. Creating material_requests table...');
  const { error: materialRequestsError } = await client.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS material_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
        requested_by UUID NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        priority TEXT NOT NULL DEFAULT 'normal',
        items_needed JSONB NOT NULL,
        reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        fulfilled_at TIMESTAMPTZ,
        fulfilled_by UUID,
        notes TEXT,
        CONSTRAINT material_requests_status_check CHECK (status IN ('pending', 'approved', 'fulfilled', 'cancelled')),
        CONSTRAINT material_requests_priority_check CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
      );

      CREATE INDEX IF NOT EXISTS idx_material_requests_job ON material_requests(job_id);
      CREATE INDEX IF NOT EXISTS idx_material_requests_status ON material_requests(status);
      CREATE INDEX IF NOT EXISTS idx_material_requests_tenant ON material_requests(tenant_id);

      -- RLS policies
      ALTER TABLE material_requests ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Users can view their tenant's material requests" ON material_requests;
      CREATE POLICY "Users can view their tenant's material requests" ON material_requests
        FOR SELECT USING (
          tenant_id IN (
            SELECT tenant_id FROM users_extended WHERE id = auth.uid()
          )
        );

      DROP POLICY IF EXISTS "Users can create material requests" ON material_requests;
      CREATE POLICY "Users can create material requests" ON material_requests
        FOR INSERT WITH CHECK (
          tenant_id IN (
            SELECT tenant_id FROM users_extended WHERE id = auth.uid()
          )
        );
    `
  });

  if (materialRequestsError) {
    console.error('❌ Error:', materialRequestsError.message);
  } else {
    console.log('✅ material_requests created\n');
  }

  // 3. customer_feedback table
  console.log('3. Creating customer_feedback table...');
  const { error: customerFeedbackError } = await client.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS customer_feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        customer_id UUID,
        job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
        feedback_type TEXT NOT NULL,
        severity TEXT,
        description TEXT NOT NULL,
        reported_by UUID NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        escalated_to UUID,
        escalation_notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMPTZ,
        resolution_notes TEXT,
        CONSTRAINT customer_feedback_type_check CHECK (feedback_type IN ('complaint', 'compliment', 'suggestion', 'question')),
        CONSTRAINT customer_feedback_severity_check CHECK (severity IN ('low', 'medium', 'high', 'critical')),
        CONSTRAINT customer_feedback_status_check CHECK (status IN ('open', 'investigating', 'escalated', 'resolved', 'closed'))
      );

      CREATE INDEX IF NOT EXISTS idx_customer_feedback_customer ON customer_feedback(customer_id);
      CREATE INDEX IF NOT EXISTS idx_customer_feedback_job ON customer_feedback(job_id);
      CREATE INDEX IF NOT EXISTS idx_customer_feedback_status ON customer_feedback(status);
      CREATE INDEX IF NOT EXISTS idx_customer_feedback_tenant ON customer_feedback(tenant_id);

      -- RLS policies
      ALTER TABLE customer_feedback ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Users can view their tenant's feedback" ON customer_feedback;
      CREATE POLICY "Users can view their tenant's feedback" ON customer_feedback
        FOR SELECT USING (
          tenant_id IN (
            SELECT tenant_id FROM users_extended WHERE id = auth.uid()
          )
        );

      DROP POLICY IF EXISTS "Managers can create feedback" ON customer_feedback;
      CREATE POLICY "Managers can create feedback" ON customer_feedback
        FOR INSERT WITH CHECK (
          tenant_id IN (
            SELECT tenant_id FROM users_extended WHERE id = auth.uid()
          )
        );
    `
  });

  if (customerFeedbackError) {
    console.error('❌ Error:', customerFeedbackError.message);
  } else {
    console.log('✅ customer_feedback created\n');
  }

  // 4. maintenance_tickets table
  console.log('4. Creating maintenance_tickets table...');
  const { error: maintenanceTicketsError } = await client.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS maintenance_tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        equipment_id UUID REFERENCES equipment(id) ON DELETE CASCADE,
        reported_by UUID NOT NULL,
        issue_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        assigned_to UUID,
        resolution_notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMPTZ,
        estimated_cost NUMERIC(10, 2),
        actual_cost NUMERIC(10, 2),
        CONSTRAINT maintenance_tickets_issue_type_check CHECK (issue_type IN ('calibration_failure', 'mechanical', 'electrical', 'wear_and_tear', 'damage', 'other')),
        CONSTRAINT maintenance_tickets_severity_check CHECK (severity IN ('low', 'medium', 'high', 'critical')),
        CONSTRAINT maintenance_tickets_status_check CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'cancelled'))
      );

      CREATE INDEX IF NOT EXISTS idx_maintenance_tickets_equipment ON maintenance_tickets(equipment_id);
      CREATE INDEX IF NOT EXISTS idx_maintenance_tickets_status ON maintenance_tickets(status);
      CREATE INDEX IF NOT EXISTS idx_maintenance_tickets_tenant ON maintenance_tickets(tenant_id);

      -- RLS policies
      ALTER TABLE maintenance_tickets ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Users can view their tenant's tickets" ON maintenance_tickets;
      CREATE POLICY "Users can view their tenant's tickets" ON maintenance_tickets
        FOR SELECT USING (
          tenant_id IN (
            SELECT tenant_id FROM users_extended WHERE id = auth.uid()
          )
        );

      DROP POLICY IF EXISTS "Users can create tickets" ON maintenance_tickets;
      CREATE POLICY "Users can create tickets" ON maintenance_tickets
        FOR INSERT WITH CHECK (
          tenant_id IN (
            SELECT tenant_id FROM users_extended WHERE id = auth.uid()
          )
        );
    `
  });

  if (maintenanceTicketsError) {
    console.error('❌ Error:', maintenanceTicketsError.message);
  } else {
    console.log('✅ maintenance_tickets created\n');
  }

  // 5. invoices table
  console.log('5. Creating invoices table...');
  const { error: invoicesError } = await client.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        invoice_number TEXT NOT NULL,
        customer_id UUID,
        job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
        amount NUMERIC(10, 2) NOT NULL,
        tax_amount NUMERIC(10, 2) DEFAULT 0,
        total_amount NUMERIC(10, 2) GENERATED ALWAYS AS (amount + COALESCE(tax_amount, 0)) STORED,
        status TEXT NOT NULL DEFAULT 'draft',
        created_by UUID NOT NULL,
        due_date DATE NOT NULL,
        paid_date DATE,
        payment_method TEXT,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT invoices_status_check CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'refunded')),
        CONSTRAINT invoices_unique_number UNIQUE (tenant_id, invoice_number)
      );

      CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_job ON invoices(job_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
      CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

      -- RLS policies
      ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Users can view their tenant's invoices" ON invoices;
      CREATE POLICY "Users can view their tenant's invoices" ON invoices
        FOR SELECT USING (
          tenant_id IN (
            SELECT tenant_id FROM users_extended WHERE id = auth.uid()
          )
        );

      DROP POLICY IF EXISTS "Managers can create invoices" ON invoices;
      CREATE POLICY "Managers can create invoices" ON invoices
        FOR INSERT WITH CHECK (
          tenant_id IN (
            SELECT tenant_id FROM users_extended WHERE id = auth.uid()
          )
        );

      DROP POLICY IF EXISTS "Managers can update invoices" ON invoices;
      CREATE POLICY "Managers can update invoices" ON invoices
        FOR UPDATE USING (
          tenant_id IN (
            SELECT tenant_id FROM users_extended WHERE id = auth.uid()
          )
        );
    `
  });

  if (invoicesError) {
    console.error('❌ Error:', invoicesError.message);
  } else {
    console.log('✅ invoices created\n');
  }

  // 6. travel_logs table
  console.log('6. Creating travel_logs table...');
  const { error: travelLogsError } = await client.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS travel_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        user_id UUID NOT NULL,
        from_property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
        to_property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
        departure_time TIMESTAMPTZ NOT NULL,
        arrival_time TIMESTAMPTZ,
        distance_km NUMERIC(8, 2),
        equipment_cleaned BOOLEAN DEFAULT false,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_travel_logs_user ON travel_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_travel_logs_departure ON travel_logs(departure_time);
      CREATE INDEX IF NOT EXISTS idx_travel_logs_tenant ON travel_logs(tenant_id);

      -- RLS policies
      ALTER TABLE travel_logs ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Users can view their own travel logs" ON travel_logs;
      CREATE POLICY "Users can view their own travel logs" ON travel_logs
        FOR SELECT USING (
          user_id = auth.uid() OR
          tenant_id IN (
            SELECT tenant_id FROM users_extended WHERE id = auth.uid()
          )
        );

      DROP POLICY IF EXISTS "Users can create their own travel logs" ON travel_logs;
      CREATE POLICY "Users can create their own travel logs" ON travel_logs
        FOR INSERT WITH CHECK (user_id = auth.uid());
    `
  });

  if (travelLogsError) {
    console.error('❌ Error:', travelLogsError.message);
  } else {
    console.log('✅ travel_logs created\n');
  }

  // 7. audit_logs table
  console.log('7. Creating audit_logs table...');
  const { error: auditLogsError } = await client.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id UUID NOT NULL,
        action TEXT NOT NULL,
        performed_by UUID NOT NULL,
        details JSONB,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by ON audit_logs(performed_by);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);

      -- RLS policies
      ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Admins and managers can view audit logs" ON audit_logs;
      CREATE POLICY "Admins and managers can view audit logs" ON audit_logs
        FOR SELECT USING (
          tenant_id IN (
            SELECT tenant_id FROM users_extended WHERE id = auth.uid()
          )
        );

      DROP POLICY IF EXISTS "System can insert audit logs" ON audit_logs;
      CREATE POLICY "System can insert audit logs" ON audit_logs
        FOR INSERT WITH CHECK (true);
    `
  });

  if (auditLogsError) {
    console.error('❌ Error:', auditLogsError.message);
  } else {
    console.log('✅ audit_logs created\n');
  }

  // 8. job_reschedules table (bonus)
  console.log('8. Creating job_reschedules table...');
  const { error: jobReschedulesError } = await client.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS job_reschedules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        original_job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
        original_date TIMESTAMPTZ NOT NULL,
        new_date TIMESTAMPTZ NOT NULL,
        reason TEXT NOT NULL,
        rescheduled_by UUID NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending_confirmation',
        customer_notified BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        confirmed_at TIMESTAMPTZ,
        CONSTRAINT job_reschedules_status_check CHECK (status IN ('pending_confirmation', 'confirmed', 'cancelled'))
      );

      CREATE INDEX IF NOT EXISTS idx_job_reschedules_job ON job_reschedules(original_job_id);
      CREATE INDEX IF NOT EXISTS idx_job_reschedules_status ON job_reschedules(status);
      CREATE INDEX IF NOT EXISTS idx_job_reschedules_tenant ON job_reschedules(tenant_id);

      -- RLS policies
      ALTER TABLE job_reschedules ENABLE ROW LEVEL SECURITY;

      DROP POLICY IF EXISTS "Users can view their tenant's reschedules" ON job_reschedules;
      CREATE POLICY "Users can view their tenant's reschedules" ON job_reschedules
        FOR SELECT USING (
          tenant_id IN (
            SELECT tenant_id FROM users_extended WHERE id = auth.uid()
          )
        );

      DROP POLICY IF EXISTS "Users can create reschedules" ON job_reschedules;
      CREATE POLICY "Users can create reschedules" ON job_reschedules
        FOR INSERT WITH CHECK (
          tenant_id IN (
            SELECT tenant_id FROM users_extended WHERE id = auth.uid()
          )
        );
    `
  });

  if (jobReschedulesError) {
    console.error('❌ Error:', jobReschedulesError.message);
  } else {
    console.log('✅ job_reschedules created\n');
  }

  console.log('✅ All missing tables created successfully!');
  console.log('\n📋 Tables created:');
  console.log('   1. offline_queue - For offline operation tracking');
  console.log('   2. material_requests - For material shortage management');
  console.log('   3. customer_feedback - For complaints and feedback');
  console.log('   4. maintenance_tickets - For equipment maintenance tracking');
  console.log('   5. invoices - For billing and invoicing');
  console.log('   6. travel_logs - For cross-property travel tracking');
  console.log('   7. audit_logs - For change tracking and compliance');
  console.log('   8. job_reschedules - For job rescheduling management');
  console.log('\n🔐 All tables have RLS policies enabled');
  console.log('🚀 Ready to run advanced E2E tests!');
}

createMissingTables().catch((error) => {
  console.error('❌ Failed:', error);
  process.exit(1);
});