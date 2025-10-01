/**
 * @file src/app/api/field-intelligence/time/timesheets/route.ts
 * @phase 3
 * @domain field-intelligence
 * @purpose API endpoint for timesheet generation and export
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 150 LoC
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { TimeTimesheetsService } from '@/domains/field-intelligence/services/time-timesheets.service';
import { logger } from '@/core/logger/voice-logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

/**
 * GET /api/field-intelligence/time/timesheets?userId=xxx&startDate=xxx&endDate=xxx&format=xxx
 * Generate and optionally export timesheet
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = user.user_metadata?.company_id;
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID not found' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const periodType = searchParams.get('periodType') || 'WEEKLY';
    const format = searchParams.get('format');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const timesheetsService = new TimeTimesheetsService(supabase, companyId);

    // Determine period
    let period;
    if (startDate && endDate) {
      period = {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        periodType: periodType as 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY',
      };
    } else {
      period = timesheetsService.getCurrentWeekPeriod();
    }

    // Generate timesheet
    const timesheet = await timesheetsService.generateTimesheet(userId, period);

    // Export if format specified
    if (format) {
      if (!['CSV', 'PDF', 'JSON'].includes(format)) {
        return NextResponse.json(
          { error: 'format must be CSV, PDF, or JSON' },
          { status: 400 }
        );
      }

      const exported = await timesheetsService.exportTimesheet(
        timesheet,
        format as 'CSV' | 'PDF' | 'JSON'
      );

      logger.info('Timesheet exported via API', {
        userId,
        period,
        format,
      });

      // Return as file download
      const headers = new Headers();
      if (format === 'CSV') {
        headers.set('Content-Type', 'text/csv');
        headers.set('Content-Disposition', `attachment; filename="timesheet-${userId}.csv"`);
      } else if (format === 'JSON') {
        headers.set('Content-Type', 'application/json');
        headers.set('Content-Disposition', `attachment; filename="timesheet-${userId}.json"`);
      } else {
        headers.set('Content-Type', 'application/pdf');
        headers.set('Content-Disposition', `attachment; filename="timesheet-${userId}.pdf"`);
      }

      return new NextResponse(exported, { headers });
    }

    // Return timesheet data
    return NextResponse.json({
      success: true,
      data: timesheet,
    });
  } catch (error: any) {
    logger.error('Timesheet generation API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}