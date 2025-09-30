/**
 * @file src/app/api/field-intelligence/intake/requests/route.ts
 * @phase 3
 * @domain field-intelligence
 * @purpose API endpoint for intake request operations
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 200 LoC
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { IntakeRequestsRepository } from '@/domains/field-intelligence/repositories/intake-requests.repository';
import { IntakeDuplicateMatchingService } from '@/domains/field-intelligence/services/intake-duplicate-matching.service';
import { logger } from '@/core/logger/voice-logger';

/**
 * GET /api/field-intelligence/intake/requests
 * List intake requests with filters
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = user.user_metadata?.company_id;
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID not found' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const source = searchParams.get('source');

    const repository = new IntakeRequestsRepository(supabase, companyId);

    const filters: any = {};
    if (status) filters.status = status;
    if (source) filters.source = source;

    const requests = await repository.findAll(filters);

    return NextResponse.json({
      success: true,
      data: requests,
    });
  } catch (error: any) {
    logger.error('Get intake requests API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/field-intelligence/intake/requests
 * Create new intake request with duplicate detection
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const companyId = user.user_metadata?.company_id;
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID not found' }, { status: 400 });
    }

    const body = await request.json();
    const {
      customerName,
      propertyAddress,
      phoneNumber,
      email,
      serviceType,
      source,
      checkDuplicates,
    } = body;

    if (!customerName) {
      return NextResponse.json(
        { error: 'customerName is required' },
        { status: 400 }
      );
    }

    const repository = new IntakeRequestsRepository(supabase, companyId);

    // Check for duplicates if requested
    let duplicates = null;
    if (checkDuplicates) {
      const matchingService = new IntakeDuplicateMatchingService(supabase, companyId);
      duplicates = await matchingService.findDuplicates({
        customerName,
        propertyAddress,
        phoneNumber,
        email,
      });
    }

    // Create request
    const intakeRequest = await repository.create({
      customer_name: customerName,
      property_address: propertyAddress || null,
      phone_number: phoneNumber || null,
      email: email || null,
      service_type: serviceType || null,
      source: source || 'WEB',
      status: 'NEW',
    });

    logger.info('Intake request created via API', {
      requestId: intakeRequest.id,
      customerName,
      isDuplicate: duplicates?.isDuplicate || false,
    });

    return NextResponse.json({
      success: true,
      data: {
        request: intakeRequest,
        duplicates: duplicates?.isDuplicate ? duplicates.matches : [],
      },
    });
  } catch (error: any) {
    logger.error('Create intake request API error', { error });
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}