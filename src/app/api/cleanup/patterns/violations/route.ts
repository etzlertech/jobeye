/**
 * @file /src/app/api/cleanup/patterns/violations/route.ts
 * @purpose API endpoint for pattern violations
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PatternViolationsRepository } from '@/domains/cleanup-tracking/repositories/pattern-violations.repository';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const client = createClient(supabaseUrl, supabaseServiceKey);
    const violationsRepo = new PatternViolationsRepository(client);

    const { searchParams } = new URL(request.url);
    const typeFilter = searchParams.get('type') as any;
    const fixedFilter = searchParams.get('fixed');
    const fileFilter = searchParams.get('file');

    // Validate type filter
    const validTypes = ['tenant_id_usage', 'functional_repository', 'missing_rls', 'direct_db_access', 'wrong_rls_path'];
    if (typeFilter && !validTypes.includes(typeFilter)) {
      return NextResponse.json(
        { error: 'Invalid type parameter', validValues: validTypes },
        { status: 400 }
      );
    }

    // Build filters
    const filters: any = {};
    if (typeFilter) filters.patternType = typeFilter;
    if (fixedFilter !== null) filters.isFixed = fixedFilter === 'true';
    if (fileFilter) filters.filePathPrefix = fileFilter;

    // Get violations
    const violations = await violationsRepo.findAll(filters);

    // Get summary
    const summary = await violationsRepo.getSummary();

    // Transform for API response
    const result = {
      violations: violations.map(v => ({
        id: v.id,
        filePath: v.file_path,
        lineNumber: v.line_number,
        columnNumber: v.column_number,
        patternType: v.pattern_type,
        violationText: v.violation_text,
        suggestedFix: v.suggested_fix,
        isFixed: v.is_fixed,
        fixedAt: v.fixed_at,
        createdAt: v.created_at
      })),
      summary: {
        total: summary.total,
        fixed: summary.fixed,
        pending: summary.pending,
        byType: summary.byType
      }
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Pattern violations error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to get pattern violations',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'PATTERN_VIOLATIONS_ERROR',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}