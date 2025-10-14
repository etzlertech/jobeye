/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /src/app/api/supervisor/jobs/today/route.ts
 * phase: 3
 * domain: supervisor
 * purpose: Provide supervisor-facing feed of today's jobs across tenant
 * spec_ref: 007-mvp-intent-driven/contracts/supervisor-api.md
 * complexity_budget: 180
 * dependencies: {
 *   internal: [
 *     '@/lib/auth/with-auth',
 *     '@/lib/supabase/server',
 *     '@/core/errors/error-handler'
 *   ],
 *   external: ['next/server'],
 *   supabase: ['jobs', 'job_assignments', 'customers', 'properties', 'job_templates']
 * }
 * exports: ['GET']
 * voice_considerations: Response feeds dashboard narration
 * test_requirements: {
 *   coverage: 90,
 *   unit_tests: 'src/__tests__/supervisor/api/jobs-today.test.ts'
 * }
 * tasks: [
 *   'Authenticate supervisor user',
 *   'Fetch all jobs for today across tenant',
 *   'Normalize response to crew jobs feed shape'
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/with-auth';
import { createServerClient } from '@/lib/supabase/server';
import { handleApiError } from '@/core/errors/error-handler';

export async function GET(req: NextRequest) {
  return withAuth(req, async (user, tenantId) => {
    try {
      const role = user.app_metadata?.role;
      const roles = user.app_metadata?.roles || [];
      
      // Check both role and roles fields, also accept system_admin
      const hasAccess = role === 'supervisor' || 
                       role === 'admin' || 
                       role === 'system_admin' ||
                       roles.includes('supervisor') || 
                       roles.includes('admin') ||
                       roles.includes('system_admin');
                       
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        );
      }

      const supabase = await createServerClient();
      const today = new Date().toISOString().split('T')[0];

      // TODO: Full query requires job_templates, customers, properties, and job_assignments tables
      // For now, query basic job data only
      const { data: jobRows, error } = await supabase
        .from('jobs')
        .select('id, scheduled_date, scheduled_time, status, special_instructions')
        .eq('tenant_id', tenantId)
        .eq('scheduled_date', today)
        .order('scheduled_time', { ascending: true });

      if (error) {
        throw error;
      }

      const jobs = (jobRows || []).map(job => ({
        id: job.id,
        customer_name: 'Demo Customer',
        property_address: 'Demo Property Address',
        scheduled_date: job.scheduled_date,
        scheduled_time: job.scheduled_time,
        status: job.status,
        special_instructions: job.special_instructions,
        template_name: 'Standard Service',
        estimated_duration: '2 hours',
        assigned_at: null
      }));

      return NextResponse.json(
        {
          jobs,
          total_count: jobs.length,
          date: today
        },
        {
          headers: {
            'Cache-Control': 'private, max-age=30'
          }
        }
      );
    } catch (error) {
      return handleApiError(error);
    }
  });
}
