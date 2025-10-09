// --- AGENT DIRECTIVE BLOCK ---
// file: /scripts/tenant-align-2025-10-09.ts
// phase: 0
// domain: cleanup
// purpose: Align live Supabase schema with tenant_id standard (rename columns, update RLS/functions).
// spec_ref: reports/tenant-alignment-plan-2025-10-09.md
// version: 1.0.0
// complexity_budget: 200 LoC
// offline_capability: NONE
//
// dependencies:
//   external:
//     - @supabase/supabase-js: ^2.43.0
//   internal:
//     - /reports/tenant-alignment-plan-2025-10-09.md
//
// voice_considerations: NONE
// test_requirements:
//   coverage: 0
//   notes: Manual verification via reports/live-tenancy-scan-*.txt
// --- END DIRECTIVE BLOCK ---

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

type Statement = { description: string; sql: string };

const statements: Statement[] = [
  {
    description: 'Rename company_id to tenant_id on conflict_logs',
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'conflict_logs' AND column_name = 'company_id'
        ) THEN
          EXECUTE 'ALTER TABLE public.conflict_logs RENAME COLUMN company_id TO tenant_id';
        END IF;
      END $$;
    `,
  },
  {
    description: 'Rename company_id to tenant_id on day_plans',
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'day_plans' AND column_name = 'company_id'
        ) THEN
          EXECUTE 'ALTER TABLE public.day_plans RENAME COLUMN company_id TO tenant_id';
        END IF;
      END $$;
    `,
  },
  {
    description: 'Rename company_id to tenant_id on equipment_incidents',
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'equipment_incidents' AND column_name = 'company_id'
        ) THEN
          EXECUTE 'ALTER TABLE public.equipment_incidents RENAME COLUMN company_id TO tenant_id';
        END IF;
      END $$;
    `,
  },
  {
    description: 'Rename company_id to tenant_id on inventory_images',
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'inventory_images' AND column_name = 'company_id'
        ) THEN
          EXECUTE 'ALTER TABLE public.inventory_images RENAME COLUMN company_id TO tenant_id';
        END IF;
      END $$;
    `,
  },
  {
    description: 'Rename company_id to tenant_id on maintenance_schedule',
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'maintenance_schedule' AND column_name = 'company_id'
        ) THEN
          EXECUTE 'ALTER TABLE public.maintenance_schedule RENAME COLUMN company_id TO tenant_id';
        END IF;
      END $$;
    `,
  },
  {
    description: 'Rename company_id to tenant_id on notification_queue',
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'notification_queue' AND column_name = 'company_id'
        ) THEN
          EXECUTE 'ALTER TABLE public.notification_queue RENAME COLUMN company_id TO tenant_id';
        END IF;
      END $$;
    `,
  },
  {
    description: 'Rename company_id to tenant_id on ocr_documents',
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'ocr_documents' AND column_name = 'company_id'
        ) THEN
          EXECUTE 'ALTER TABLE public.ocr_documents RENAME COLUMN company_id TO tenant_id';
        END IF;
      END $$;
    `,
  },
  {
    description: 'Rename company_id to tenant_id on ocr_jobs',
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'ocr_jobs' AND column_name = 'company_id'
        ) THEN
          EXECUTE 'ALTER TABLE public.ocr_jobs RENAME COLUMN company_id TO tenant_id';
        END IF;
      END $$;
    `,
  },
  {
    description: 'Rename company_id to tenant_id on ocr_line_items',
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'ocr_line_items' AND column_name = 'company_id'
        ) THEN
          EXECUTE 'ALTER TABLE public.ocr_line_items RENAME COLUMN company_id TO tenant_id';
        END IF;
      END $$;
    `,
  },
  {
    description: 'Rename company_id to tenant_id on quality_audits',
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'quality_audits' AND column_name = 'company_id'
        ) THEN
          EXECUTE 'ALTER TABLE public.quality_audits RENAME COLUMN company_id TO tenant_id';
        END IF;
      END $$;
    `,
  },
  {
    description: 'Rename company_id to tenant_id on training_certificates',
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'training_certificates' AND column_name = 'company_id'
        ) THEN
          EXECUTE 'ALTER TABLE public.training_certificates RENAME COLUMN company_id TO tenant_id';
        END IF;
      END $$;
    `,
  },
  {
    description: 'Rename company_id to tenant_id on training_sessions',
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'training_sessions' AND column_name = 'company_id'
        ) THEN
          EXECUTE 'ALTER TABLE public.training_sessions RENAME COLUMN company_id TO tenant_id';
        END IF;
      END $$;
    `,
  },
  {
    description: 'Rename company_id to tenant_id on user_activity_logs',
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'user_activity_logs' AND column_name = 'company_id'
        ) THEN
          EXECUTE 'ALTER TABLE public.user_activity_logs RENAME COLUMN company_id TO tenant_id';
        END IF;
      END $$;
    `,
  },
  {
    description: 'Drop company_id column from routing_schedules after backfill',
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'routing_schedules' AND column_name = 'company_id'
        ) THEN
          UPDATE public.routing_schedules
          SET tenant_id = company_id
          WHERE tenant_id IS NULL AND company_id IS NOT NULL;
          EXECUTE 'ALTER TABLE public.routing_schedules DROP COLUMN company_id';
        END IF;
      END $$;
    `,
  },
  {
    description: 'Drop routing sync trigger and function tied to company_id',
    sql: `
      DROP TRIGGER IF EXISTS sync_routing_company_id_trigger ON public.routing_schedules;
      DROP FUNCTION IF EXISTS public.sync_routing_company_id();
    `,
  },
  {
    description: 'Rename legacy constraints that still reference company_id in their names',
    sql: `
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kits_company_id_fkey') THEN
          EXECUTE 'ALTER TABLE public.kits RENAME CONSTRAINT kits_company_id_fkey TO kits_tenant_id_fkey';
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kits_company_id_kit_code_key') THEN
          EXECUTE 'ALTER TABLE public.kits RENAME CONSTRAINT kits_company_id_kit_code_key TO kits_tenant_id_kit_code_key';
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kit_items_company_id_fkey') THEN
          EXECUTE 'ALTER TABLE public.kit_items RENAME CONSTRAINT kit_items_company_id_fkey TO kit_items_tenant_id_fkey';
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kit_variants_company_id_fkey') THEN
          EXECUTE 'ALTER TABLE public.kit_variants RENAME CONSTRAINT kit_variants_company_id_fkey TO kit_variants_tenant_id_fkey';
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'day_plans_company_id_fkey') THEN
          EXECUTE 'ALTER TABLE public.day_plans RENAME CONSTRAINT day_plans_company_id_fkey TO day_plans_tenant_id_fkey';
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'day_plans_company_id_user_id_plan_date_key') THEN
          EXECUTE 'ALTER TABLE public.day_plans RENAME CONSTRAINT day_plans_company_id_user_id_plan_date_key TO day_plans_tenant_id_user_id_plan_date_key';
        END IF;
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notification_queue_company_id_fkey') THEN
          EXECUTE 'ALTER TABLE public.notification_queue RENAME CONSTRAINT notification_queue_company_id_fkey TO notification_queue_tenant_id_fkey';
        END IF;
      END $$;
    `,
  },
  {
    description: 'Update companies tenancy policy to tenant_id',
    sql: `
      DROP POLICY IF EXISTS companies_tenant_isolation ON public.companies;
      CREATE POLICY companies_tenant_isolation ON public.companies
        USING (
          tenant_id::text = COALESCE(
            (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id'),
            (current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'tenant_id')
          )
        )
        WITH CHECK (
          tenant_id::text = COALESCE(
            (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id'),
            (current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'tenant_id')
          )
        );
    `,
  },
  {
    description: 'Update conflict_logs RLS policies to tenant_id',
    sql: `
      DROP POLICY IF EXISTS "Company members view conflict logs" ON public.conflict_logs;
      CREATE POLICY "Company members view conflict logs" ON public.conflict_logs
        USING (
          tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
        )
        WITH CHECK (
          tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
        );

      DROP POLICY IF EXISTS "Supervisors can review conflicts" ON public.conflict_logs;
      CREATE POLICY "Supervisors can review conflicts" ON public.conflict_logs
        USING (
          tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
          AND (
            (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'role') IN ('supervisor', 'admin')
          )
        )
        WITH CHECK (
          tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
          AND (
            (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'role') IN ('supervisor', 'admin')
          )
        );
    `,
  },
  {
    description: 'Update day_plans RLS policy to tenant_id',
    sql: `
      DROP POLICY IF EXISTS day_plans_tenant_access ON public.day_plans;
      CREATE POLICY day_plans_tenant_access ON public.day_plans
        USING (
          tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
        )
        WITH CHECK (
          tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
        );
    `,
  },
  {
    description: 'Update inventory_images RLS policy to tenant_id',
    sql: `
      DROP POLICY IF EXISTS inventory_images_tenant_isolation ON public.inventory_images;
      CREATE POLICY inventory_images_tenant_isolation ON public.inventory_images
        USING (
          tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
        )
        WITH CHECK (
          tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
        );
    `,
  },
  {
    description: 'Update notification_queue RLS policy to tenant_id',
    sql: `
      DROP POLICY IF EXISTS notification_queue_tenant_access ON public.notification_queue;
      CREATE POLICY notification_queue_tenant_access ON public.notification_queue
        USING (
          tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
        )
        WITH CHECK (
          tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
        );
    `,
  },
  {
    description: 'Update OCR RLS policies to tenant_id',
    sql: `
      DROP POLICY IF EXISTS ocr_documents_tenant_isolation ON public.ocr_documents;
      CREATE POLICY ocr_documents_tenant_isolation ON public.ocr_documents
        USING (
          tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
        )
        WITH CHECK (
          tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
        );

      DROP POLICY IF EXISTS ocr_jobs_tenant_isolation ON public.ocr_jobs;
      CREATE POLICY ocr_jobs_tenant_isolation ON public.ocr_jobs
        USING (
          tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
        )
        WITH CHECK (
          tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
        );

      DROP POLICY IF EXISTS ocr_line_items_tenant_isolation ON public.ocr_line_items;
      CREATE POLICY ocr_line_items_tenant_isolation ON public.ocr_line_items
        USING (
          tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
        )
        WITH CHECK (
          tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
        );
    `,
  },
  {
    description: 'Update kits domain RLS policies to tenant_id claims',
    sql: `
      DROP POLICY IF EXISTS kits_tenant_access ON public.kits;
      CREATE POLICY kits_tenant_access ON public.kits
        USING (
          tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
        )
        WITH CHECK (
          tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
        );

      DROP POLICY IF EXISTS kit_items_tenant_access ON public.kit_items;
      CREATE POLICY kit_items_tenant_access ON public.kit_items
        USING (
          tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
        )
        WITH CHECK (
          tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
        );

      DROP POLICY IF EXISTS kit_variants_tenant_access ON public.kit_variants;
      CREATE POLICY kit_variants_tenant_access ON public.kit_variants
        USING (
          tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
        )
        WITH CHECK (
          tenant_id::text = (current_setting('request.jwt.claims', true)::json -> 'app_metadata' ->> 'tenant_id')
        );
    `,
  },
  {
    description: 'Update notify_supervisor_on_kit_override trigger function to tenant_id',
    sql: `
      CREATE OR REPLACE FUNCTION public.notify_supervisor_on_kit_override()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $function$
DECLARE
  v_kit_name TEXT;
  v_technician_name TEXT;
  v_message TEXT;
BEGIN
  -- Only notify if supervisor_id is set
  IF NEW.supervisor_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get kit name
  SELECT name INTO v_kit_name
  FROM public.kits
  WHERE id = NEW.kit_id;

  -- Build notification message
  v_message := format(
    'Tech %s needs override for %s kit item %s: %s',
    COALESCE(NEW.technician_id::text, 'Unknown'),
    COALESCE(v_kit_name, 'Unknown'),
    COALESCE(NEW.item_id, 'Unknown'),
    COALESCE(NEW.override_reason, 'No reason provided')
  );

  -- Insert into notification queue
  INSERT INTO public.notification_queue (
    tenant_id,
    recipient_id,
    type,
    priority,
    message,
    data
  ) VALUES (
    NEW.tenant_id,
    NEW.supervisor_id,
    'kit_override',
    'high',
    v_message,
    jsonb_build_object(
      'job_id', NEW.job_id,
      'kit_id', NEW.kit_id,
      'item_id', NEW.item_id,
      'technician_id', NEW.technician_id,
      'override_reason', NEW.override_reason
    )
  );

  -- Update override log to mark notification sent
  NEW.supervisor_notified_at = NOW();

  RETURN NEW;
END;
$function$;
    `,
  },
  {
    description: 'Update check_break_compliance function to tenant_id',
    sql: `
      CREATE OR REPLACE FUNCTION public.check_break_compliance(p_day_plan_id uuid)
      RETURNS jsonb
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $function$
DECLARE
  v_tenant_id TEXT;
  v_user_id UUID;
  v_work_start TIMESTAMPTZ;
  v_last_break TIMESTAMPTZ;
  v_total_work_minutes INTEGER := 0;
  v_break_minutes INTEGER := 0;
  v_hours_since_break NUMERIC;
  v_compliant BOOLEAN := TRUE;
  v_message TEXT;
BEGIN
  -- Get day plan details
  SELECT tenant_id, user_id, actual_start_time
  INTO v_tenant_id, v_user_id, v_work_start
  FROM public.day_plans
  WHERE id = p_day_plan_id;

  IF v_work_start IS NULL THEN
    RETURN jsonb_build_object('compliant', true, 'message', 'Day not started');
  END IF;

  -- Calculate total work time and breaks
  WITH event_times AS (
    SELECT
      event_type,
      actual_start,
      actual_end,
      EXTRACT(EPOCH FROM (COALESCE(actual_end, NOW()) - actual_start)) / 60 AS duration_minutes
    FROM public.schedule_events
    WHERE day_plan_id = p_day_plan_id
      AND actual_start IS NOT NULL
      AND status IN ('completed', 'in_progress')
  )
  SELECT
    SUM(CASE WHEN event_type != 'break' THEN duration_minutes ELSE 0 END)::INTEGER,
    SUM(CASE WHEN event_type = 'break' THEN duration_minutes ELSE 0 END)::INTEGER,
    MAX(CASE WHEN event_type = 'break' THEN actual_start END)
  INTO v_total_work_minutes, v_break_minutes, v_last_break
  FROM event_times;

  -- Calculate hours since last break
  IF v_last_break IS NOT NULL THEN
    v_hours_since_break := EXTRACT(EPOCH FROM (NOW() - v_last_break)) / 3600;
  ELSE
    v_hours_since_break := EXTRACT(EPOCH FROM (NOW() - v_work_start)) / 3600;
  END IF;

  -- Check if 4+ hours without break
  IF v_hours_since_break >= 4 THEN
    v_compliant := FALSE;
    v_message := format('Technician has worked %.1f hours without a break', v_hours_since_break);

    -- Queue warning notification
    INSERT INTO public.notification_queue (
      tenant_id,
      recipient_id,
      type,
      priority,
      message,
      data
    ) VALUES (
      v_tenant_id,
      v_user_id, -- Notify technician for now
      'break_warning',
      'medium',
      v_message,
      jsonb_build_object(
        'technician_id', v_user_id,
        'day_plan_id', p_day_plan_id,
        'hours_since_break', v_hours_since_break
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'compliant', v_compliant,
    'message', COALESCE(v_message, 'Break schedule compliant'),
    'total_work_minutes', COALESCE(v_total_work_minutes, 0),
    'break_minutes', COALESCE(v_break_minutes, 0)
  );
END;
$function$;
    `,
  },
  {
    description: 'Update notify_job_limit_approaching function to tenant_id',
    sql: `
      CREATE OR REPLACE FUNCTION public.notify_job_limit_approaching()
      RETURNS trigger
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $function$
DECLARE
  v_job_count INTEGER;
  v_user_id UUID;
  v_supervisor_id UUID;
  v_max_jobs INTEGER := 6;
BEGIN
  -- Only check for job events
  IF NEW.event_type != 'job' THEN
    RETURN NEW;
  END IF;

  -- Get user_id from day plan
  SELECT user_id INTO v_user_id
  FROM public.day_plans
  WHERE id = NEW.day_plan_id;

  -- Count jobs for this day plan
  SELECT COUNT(*) INTO v_job_count
  FROM public.schedule_events
  WHERE day_plan_id = NEW.day_plan_id
    AND event_type = 'job'
    AND status != 'cancelled';

  -- Notify at 5 jobs (approaching limit)
  IF v_job_count = 5 THEN
    INSERT INTO public.notification_queue (
      tenant_id,
      recipient_id,
      type,
      priority,
      message,
      data
    ) VALUES (
      NEW.tenant_id,
      v_user_id, -- Notify technician for now
      'job_limit_warning',
      'medium',
      format('Technician has %s of %s jobs scheduled for today', v_job_count, v_max_jobs),
      jsonb_build_object(
        'technician_id', v_user_id,
        'day_plan_id', NEW.day_plan_id,
        'current_job_count', v_job_count,
        'max_jobs', v_max_jobs
      )
    );
  END IF;

  -- Notify at limit
  IF v_job_count >= v_max_jobs THEN
    INSERT INTO public.notification_queue (
      tenant_id,
      recipient_id,
      type,
      priority,
      message,
      data
    ) VALUES (
      NEW.tenant_id,
      v_user_id,
      'job_limit_reached',
      'high',
      'Maximum daily job limit reached',
      jsonb_build_object(
        'technician_id', v_user_id,
        'day_plan_id', NEW.day_plan_id,
        'current_job_count', v_job_count
      )
    );
  END IF;

  RETURN NEW;
END;
$function$;
    `,
  },
  {
    description: 'Update get_daily_vision_costs signature to tenant_id',
    sql: `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'vision_cost_records' AND column_name = 'tenant_id'
        ) THEN
          EXECUTE $fn$
            CREATE OR REPLACE FUNCTION public.get_daily_vision_costs(p_tenant_id UUID, p_date DATE DEFAULT CURRENT_DATE)
            RETURNS TABLE(
              total_estimated_usd NUMERIC,
              total_actual_usd NUMERIC,
              request_count BIGINT
            )
            LANGUAGE plpgsql
            STABLE
            AS $function$
          BEGIN
            RETURN QUERY
            SELECT
              COALESCE(SUM(estimated_cost_usd), 0)::DECIMAL(10,2) AS total_estimated_usd,
              COALESCE(SUM(actual_cost_usd), 0)::DECIMAL(10,2) AS total_actual_usd,
              COUNT(*) AS request_count
            FROM vision_cost_records
            WHERE tenant_id = p_tenant_id
              AND DATE(created_at) = p_date;
          END;
          $function$;
          $fn$;

          EXECUTE $cm$
            COMMENT ON FUNCTION public.get_daily_vision_costs IS 'Calculate total vision costs for a tenant on a specific date, used for $10/day budget enforcement';
          $cm$;
        END IF;
      END $$;
    `,
  },
  {
    description: 'Drop legacy create_default_company_settings function',
    sql: `
      DROP FUNCTION IF EXISTS public.create_default_company_settings();
    `,
  },
];

async function run() {
  const client = createClient(supabaseUrl, supabaseServiceKey);

  for (const { description, sql } of statements) {
    console.log(`\n➡️  ${description}`);
    const { error } = await client.rpc('exec_sql', { sql });
    if (error) {
      console.error(`❌ Failed: ${error.message}`);
      console.error('Details:', error);
      process.exit(1);
    }
    console.log('✅ Success');
  }

  console.log('\n🎉 Tenant alignment statements completed.');
}

run().catch((err) => {
  console.error('Unhandled error while aligning tenancy:', err);
  process.exit(1);
});
