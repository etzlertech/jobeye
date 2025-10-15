/**
 * @file /src/app/api/cleanup/tables/orphaned/route.ts
 * @purpose API endpoint for orphaned tables
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { TableInventoryRepository } from '@/domains/cleanup-tracking/repositories/table-inventory.repository';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const client = createClient(supabaseUrl, supabaseServiceKey);
    const tableRepo = new TableInventoryRepository(client);

    // Get orphaned tables
    const orphanedTables = await tableRepo.findOrphanedTables();

    // Get table sizes from database
    const tablesWithSizes = await Promise.all(
      orphanedTables.map(async (table) => {
        try {
          // Get table size
          const { data: sizeResult } = await client.rpc('exec_sql', {
            sql: `
              SELECT 
                pg_total_relation_size('${table.table_name}') as size_bytes,
                obj_description(c.oid) as comment
              FROM pg_class c 
              WHERE c.relname = '${table.table_name}';
            `
          });

          const sizeBytes = sizeResult[0]?.size_bytes || 0;

          return {
            schemaName: table.schema_name,
            tableName: table.table_name,
            rowCount: table.row_count,
            sizeBytes: parseInt(sizeBytes),
            lastModified: table.last_modified,
            hasCodeReferences: table.has_code_references,
            decision: table.decision,
            decisionReason: table.decision_reason
          };
        } catch (error) {
          // If size query fails, return with 0 size
          return {
            schemaName: table.schema_name,
            tableName: table.table_name,
            rowCount: table.row_count,
            sizeBytes: 0,
            lastModified: table.last_modified,
            hasCodeReferences: table.has_code_references,
            decision: table.decision,
            decisionReason: table.decision_reason
          };
        }
      })
    );

    // Sort by size descending
    tablesWithSizes.sort((a, b) => b.sizeBytes - a.sizeBytes);

    // Calculate totals
    const totalCount = tablesWithSizes.length;
    const totalSizeBytes = tablesWithSizes.reduce((sum, table) => sum + table.sizeBytes, 0);

    // Format total size
    const formatSize = (bytes: number): string => {
      if (bytes === 0) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB'];
      let size = bytes;
      let unitIndex = 0;
      
      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
      }
      
      return `${size.toFixed(1)} ${units[unitIndex]}`;
    };

    const result = {
      tables: tablesWithSizes,
      totalCount,
      totalSize: formatSize(totalSizeBytes)
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Orphaned tables error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to get orphaned tables',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'ORPHANED_TABLES_ERROR',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}