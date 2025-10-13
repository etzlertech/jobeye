/**
 * AGENT DIRECTIVE BLOCK
 * file: src/app/api/containers/route.ts
 * phase: 2
 * domain: equipment
 * purpose: API endpoint for container management
 * spec_ref: v4-vision-blueprint-extended.md
 * complexity_budget: 150
 * dependencies:
 *   - internal: ContainerService, createServerClient
 *   - external: next
 * exports: GET, POST
 * voice_considerations:
 *   - Support voice queries for containers
 *   - Return voice-friendly container names
 * offline_capability: OPTIONAL
 * test_requirements:
 *   - coverage: 90%
 *   - test_file: src/app/api/containers/__tests__/route.test.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { ContainerService } from '@/domains/equipment/services/container-service';
import { VoiceLogger } from '@/core/logger/voice-logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const logger = new VoiceLogger();

  try {
    // Get authenticated user
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const containerService = new ContainerService(supabase, undefined, logger);
    
    // Parse query parameters
    const url = new URL(request.url);
    const voiceQuery = url.searchParams.get('voice_query');
    const containerType = url.searchParams.get('type');
    const isActive = url.searchParams.get('active');
    const isDefault = url.searchParams.get('default');

    // Handle voice query
    if (voiceQuery) {
      // Get tenant ID from user metadata
      const tenantId = user.app_metadata?.tenant_id || 'default';
      
      const voiceCommand = {
        action: 'select' as const,
        containerIdentifier: voiceQuery
      };
      
      const result = await containerService.processVoiceCommand(voiceCommand, tenantId, user.id);
      
      if (!result) {
        return NextResponse.json({
          found: false,
          message: 'No matching container found',
          voice_response: 'I couldn\'t find a container matching that description'
        });
      }

      // Handle single container result
      const container = Array.isArray(result) ? result[0] : result;
      
      return NextResponse.json({
        found: true,
        container,
        voice_response: `Found ${container.name}`
      });
    }

    // Handle default container request
    if (isDefault === 'true') {
      // Get tenant ID from user metadata
      const tenantId = user.app_metadata?.tenant_id || 'default';
      const defaultContainer = await containerService.getDefaultContainer(tenantId);
      
      if (!defaultContainer) {
        return NextResponse.json({
          default: null,
          message: 'No default container set',
          voice_response: 'No default container is configured'
        });
      }

      return NextResponse.json({
        default: defaultContainer,
        voice_response: `Default container is ${defaultContainer.name}`
      });
    }

    // Get all containers with filters
    // Get tenant ID from user metadata
    const tenantId = user.app_metadata?.tenant_id || 'default';
    const containers = await containerService.listActiveContainers(tenantId);

    return NextResponse.json({
      containers,
      count: containers.length,
      voice_summary: `Found ${containers.length} containers`
    });

  } catch (error) {
    await logger.error('Failed to get containers', error as Error);
    
    return NextResponse.json(
      { error: 'Failed to retrieve containers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const logger = new VoiceLogger();

  try {
    // Get authenticated user
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const containerService = new ContainerService(supabase, undefined, logger);

    // Validate required fields
    const { container_type, identifier, name } = body;
    
    if (!container_type || !identifier || !name) {
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          message: 'container_type, identifier, and name are required'
        },
        { status: 400 }
      );
    }

    // Create container
    // Get tenant ID from user metadata
    const tenantId = user.app_metadata?.tenant_id || 'default';
    
    const container = await containerService.createContainer({
      containerType: container_type,
      identifier,
      name,
      color: body.color,
      capacityInfo: body.capacity_info,
      primaryImageUrl: body.primary_image_url,
      additionalImageUrls: body.additional_image_urls,
      isDefault: body.is_default,
      metadata: body.metadata
    }, tenantId, user.id);

    if (!container) {
      return NextResponse.json(
        { error: 'Failed to create container' },
        { status: 500 }
      );
    }

    await logger.info('Container created', {
      containerId: (container as any).id,
      identifier: container.identifier,
      userId: user.id
    });

    return NextResponse.json({
      success: true,
      container,
      message: 'Container created successfully',
      voice_response: `Created ${container.name}`
    }, { status: 201 });

  } catch (error) {
    await logger.error('Failed to create container', error as Error);
    
    return NextResponse.json(
      { error: 'Failed to create container' },
      { status: 500 }
    );
  }
}