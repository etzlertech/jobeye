#!/usr/bin/env npx tsx
/**
 * @file create-e2e-tables.ts
 * @purpose Create missing tables for E2E tests
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function execSQL(sql: string, description: string) {
  console.log(`📝 ${description}...`);
  const { error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    console.error(`❌ Error: ${error.message}`);
    return false;
  }

  console.log(`✅ Success`);
  return true;
}

async function createE2ETables() {
  console.log('🔧 Creating missing tables for E2E tests...\n');

  // 1. equipment_incidents
  await execSQL(`
    CREATE TABLE IF NOT EXISTS equipment_incidents (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id TEXT NOT NULL,
      reported_by UUID NOT NULL,
      incident_type TEXT NOT NULL,
      equipment_item TEXT NOT NULL,
      description TEXT,
      verification_id UUID,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_equipment_incidents_company ON equipment_incidents(company_id);
    CREATE INDEX IF NOT EXISTS idx_equipment_incidents_reported_by ON equipment_incidents(reported_by);
  `, 'Create equipment_incidents table');

  // 2. notifications
  await execSQL(`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id TEXT NOT NULL,
      user_id UUID NOT NULL,
      notification_type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      priority TEXT NOT NULL,
      related_entity_type TEXT,
      related_entity_id UUID,
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at);
    CREATE INDEX IF NOT EXISTS idx_notifications_company ON notifications(company_id);
  `, 'Create notifications table');

  // 3. daily_reports
  await execSQL(`
    CREATE TABLE IF NOT EXISTS daily_reports (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id TEXT NOT NULL,
      report_date DATE NOT NULL,
      created_by UUID NOT NULL,
      technician_count INTEGER NOT NULL,
      jobs_assigned INTEGER NOT NULL,
      equipment_audit_id UUID,
      summary_text TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_daily_reports_company_date ON daily_reports(company_id, report_date);
  `, 'Create daily_reports table');

  // 4. quality_audits
  await execSQL(`
    CREATE TABLE IF NOT EXISTS quality_audits (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id TEXT NOT NULL,
      auditor_id UUID NOT NULL,
      audit_date DATE NOT NULL,
      jobs_audited INTEGER NOT NULL,
      site_inspection_verification_id UUID,
      quality_score DECIMAL(5,2),
      issues_found INTEGER,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_quality_audits_company_date ON quality_audits(company_id, audit_date);
  `, 'Create quality_audits table');

  // 5. training_sessions
  await execSQL(`
    CREATE TABLE IF NOT EXISTS training_sessions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id TEXT NOT NULL,
      trainer_id UUID NOT NULL,
      training_type TEXT NOT NULL,
      session_date TIMESTAMPTZ NOT NULL,
      demo_verification_id UUID,
      equipment_demo_score DECIMAL(5,2),
      status TEXT NOT NULL,
      completion_date TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_training_sessions_company ON training_sessions(company_id);
  `, 'Create training_sessions table');

  // 6. training_certificates
  await execSQL(`
    CREATE TABLE IF NOT EXISTS training_certificates (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id TEXT NOT NULL,
      training_session_id UUID NOT NULL,
      trainee_id UUID NOT NULL,
      certificate_type TEXT NOT NULL,
      issued_date TIMESTAMPTZ NOT NULL,
      score DECIMAL(5,2),
      status TEXT NOT NULL,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_training_certificates_trainee ON training_certificates(trainee_id);
  `, 'Create training_certificates table');

  // 7. equipment_maintenance
  await execSQL(`
    CREATE TABLE IF NOT EXISTS equipment_maintenance (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id TEXT NOT NULL,
      equipment_id TEXT NOT NULL,
      performed_by UUID NOT NULL,
      maintenance_type TEXT NOT NULL,
      maintenance_date TIMESTAMPTZ NOT NULL,
      actions_performed TEXT[],
      pre_maintenance_verification_id UUID,
      post_maintenance_verification_id UUID,
      status TEXT NOT NULL,
      completion_date TIMESTAMPTZ,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_company ON equipment_maintenance(company_id);
    CREATE INDEX IF NOT EXISTS idx_equipment_maintenance_equipment ON equipment_maintenance(equipment_id);
  `, 'Create equipment_maintenance table');

  // 8. maintenance_schedule
  await execSQL(`
    CREATE TABLE IF NOT EXISTS maintenance_schedule (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id TEXT NOT NULL,
      equipment_id TEXT NOT NULL,
      scheduled_date TIMESTAMPTZ NOT NULL,
      maintenance_type TEXT NOT NULL,
      assigned_to UUID,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_maintenance_schedule_company ON maintenance_schedule(company_id);
    CREATE INDEX IF NOT EXISTS idx_maintenance_schedule_date ON maintenance_schedule(scheduled_date);
  `, 'Create maintenance_schedule table');

  // 9. user_activity_logs
  await execSQL(`
    CREATE TABLE IF NOT EXISTS user_activity_logs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL,
      company_id TEXT NOT NULL,
      activity_date DATE NOT NULL,
      jobs_completed INTEGER,
      equipment_return_verification_id UUID,
      summary TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_date ON user_activity_logs(user_id, activity_date);
    CREATE INDEX IF NOT EXISTS idx_user_activity_logs_company ON user_activity_logs(company_id);
  `, 'Create user_activity_logs table');

  console.log('\n✅ All E2E tables created successfully!');
  console.log('\nYou can now run:');
  console.log('  npm test src/__tests__/e2e/complete-workflows.e2e.test.ts\n');
}

createE2ETables().catch((error) => {
  console.error('❌ Failed to create tables:', error);
  process.exit(1);
});