/**
 * @file /src/app/api/cleanup/migration/execute/route.ts
 * @purpose API endpoint for executing migrations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MigrationTrackingRepository } from '@/domains/cleanup-tracking/repositories/migration-tracking.repository';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tableName, dryRun = false } = body;

    if (!tableName) {
      return NextResponse.json(
        { error: 'tableName is required' },
        { status: 400 }
      );
    }

    const client = createClient(supabaseUrl, supabaseServiceKey);
    const migrationRepo = new MigrationTrackingRepository(client);

    // Check if table exists in tracking
    const tracking = await migrationRepo.findByTableName(tableName);
    if (!tracking) {
      return NextResponse.json(
        { error: 'Table not found in migration tracking' },
        { status: 400 }
      );
    }

    // Check if migration is already in progress
    if (tracking.migration_status === 'in_progress') {
      return NextResponse.json(
        { error: 'Migration already in progress for this table' },
        { status: 409 }
      );
    }

    // Check if migration is already completed
    if (tracking.migration_status === 'completed') {
      return NextResponse.json(
        { error: 'Migration already completed for this table' },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    const migrationId = tracking.id;

    if (dryRun) {
      // Dry run - just return what would happen
      return NextResponse.json({
        migrationId,
        tableName,
        rowsAffected: tracking.row_count,
        duration: 0,
        status: 'started',
        dryRun: true,
        preview: {
          steps: [
            'Add tenant_id column if not exists',
            'Copy tenant_id to tenant_id',
            'Set tenant_id as NOT NULL',
            'Verify data integrity'
          ]
        }
      }, { status: 202 });
    }

    // Mark as in progress
    await migrationRepo.update(migrationId, {
      migration_status: 'in_progress'
    });

    try {
      // Execute migration steps
      const steps = [
        `ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS tenant_id UUID;`,
        `UPDATE "${tableName}" SET tenant_id = tenant_id WHERE tenant_id IS NULL;`,
        `ALTER TABLE "${tableName}" ALTER COLUMN tenant_id SET NOT NULL;`
      ];

      let rowsAffected = 0;

      for (const sql of steps) {
        const { error } = await client.rpc('exec_sql', { sql });
        if (error) {
          throw new Error(`Migration step failed: ${error.message}`);
        }
      }

      // Get final row count
      const { data: countResult } = await client.rpc('exec_sql', {
        sql: `SELECT COUNT(*) as count FROM "${tableName}";`
      });
      rowsAffected = parseInt(countResult[0].count);

      // Mark as completed
      await migrationRepo.update(migrationId, {
        has_tenant_id: true,
        migration_status: 'completed',
        migrated_at: new Date()
      });

      const duration = Date.now() - startTime;

      return NextResponse.json({
        migrationId,
        tableName,
        rowsAffected,
        duration,
        status: 'completed'
      }, { status: 202 });

    } catch (migrationError) {
      // Mark as failed
      await migrationRepo.update(migrationId, {
        migration_status: 'failed',
        error_message: migrationError instanceof Error ? migrationError.message : String(migrationError)
      });

      return NextResponse.json(
        {
          error: 'Migration execution failed',
          message: migrationError instanceof Error ? migrationError.message : 'Unknown error',
          migrationId,
          tableName
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Migration execute error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to execute migration',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'MIGRATION_EXECUTE_ERROR',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}