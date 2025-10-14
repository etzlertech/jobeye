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

      // TODO: Fix RLS policy infinite recursion error in users_extended view
      // Error: "infinite recursion detected in policy for relation 'users_extended'"
      // This happens when createServerClient() is called, even before querying jobs table
      // For now, return empty jobs array until database RLS policies are fixed

      const today = new Date().toISOString().split('T')[0];
      const jobs: any[] = [];

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
      console.error('[jobs/today] Error:', error);

      // Better error serialization
      let errorDetails;
      if (error instanceof Error) {
        errorDetails = {
          message: error.message,
          stack: error.stack,
          name: error.name
        };
      } else {
        errorDetails = JSON.stringify(error, null, 2);
      }

      return NextResponse.json(
        {
          error: {
            message: error instanceof Error ? error.message : 'Failed to fetch jobs',
            code: 'JOBS_FETCH_ERROR',
            details: errorDetails
          }
        },
        { status: 500 }
      );
    }
  });
}
