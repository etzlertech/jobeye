/**
 * @file /src/app/api/cleanup/migration/status/route.ts
 * @purpose API endpoint for migration status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MigrationTrackingRepository } from '@/domains/cleanup-tracking/repositories/migration-tracking.repository';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const client = createClient(supabaseUrl, supabaseServiceKey);
    const migrationRepo = new MigrationTrackingRepository(client);

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') as any;

    // Validate status filter
    const validStatuses = ['pending', 'in_progress', 'completed', 'failed', 'skipped'];
    if (statusFilter && !validStatuses.includes(statusFilter)) {
      return NextResponse.json(
        { error: 'Invalid status parameter', validValues: validStatuses },
        { status: 400 }
      );
    }

    // Get migrations with optional filter
    const filters = statusFilter ? { status: statusFilter } : undefined;
    const migrations = await migrationRepo.findAll(filters);

    // Get summary
    const summary = await migrationRepo.getSummary();

    // Transform for API response
    const result = {
      migrations: migrations.map(m => ({
        id: m.id,
        tableName: m.table_name,
        hasCompanyId: m.has_company_id,
        hasTenantId: m.has_tenant_id,
        rowCount: m.row_count,
        status: m.migration_status,
        migratedAt: m.migrated_at,
        errorMessage: m.error_message,
        createdAt: m.created_at,
        updatedAt: m.updated_at
      })),
      summary: {
        total: summary.total,
        pending: summary.pending,
        inProgress: summary.inProgress,
        completed: summary.completed,
        failed: summary.failed,
        skipped: summary.skipped
      }
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Migration status error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to get migration status',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'MIGRATION_STATUS_ERROR',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}