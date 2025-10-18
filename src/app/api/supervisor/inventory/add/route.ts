/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /src/app/api/supervisor/inventory/add/route.ts
 * phase: 3
 * domain: supervisor
 * purpose: API endpoint for adding inventory items
 * spec_ref: 007-mvp-intent-driven/contracts/supervisor-api.md
 * complexity_budget: 150
 * migrations_touched: ['inventory']
 * state_machine: null
 * estimated_llm_cost: {
 *   "POST": "$0.02 (if image provided for VLM)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [
 *     '@/domains/supervisor/services/supervisor-workflow.service',
 *     '@/lib/auth/with-auth',
 *     '@/core/errors/error-handler'
 *   ],
 *   external: [],
 *   supabase: ['inventory']
 * }
 * exports: ['POST']
 * voice_considerations: Can be triggered via voice command
 * test_requirements: {
 *   coverage: 90,
 *   contract_tests: 'tests/domains/supervisor/api/test_inventory_add_contract.test.ts'
 * }
 * tasks: [
 *   'Implement POST handler for inventory addition',
 *   'Validate inventory data',
 *   'Check for duplicates',
 *   'Return created item'
 * ]
 */

import { NextRequest, NextResponse } from 'next/server';
import { SupervisorWorkflowService } from '@/domains/supervisor/services/supervisor-workflow.service';
import { withAuth } from '@/lib/auth/with-auth';
import { handleApiError } from '@/core/errors/error-handler';
import { z } from 'zod';
import { createServerClient } from '@/lib/supabase/server';

// Request validation schema
const inventoryAddRequestSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.enum(['equipment', 'materials', 'tools', 'safety', 'other']),
  quantity: z.number().int().min(1).default(1),
  container: z.string().optional(),
  imageUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  metadata: z.record(z.any()).optional()
});

// Response schema
const inventoryAddResponseSchema = z.object({
  success: z.boolean(),
  item: z.object({
    id: z.string(),
    name: z.string(),
    category: z.string(),
    quantity: z.number(),
    containerId: z.string().optional(),
    imageUrl: z.string().optional(),
    thumbnailUrl: z.string().optional(),
    createdAt: z.string()
  }).optional(),
  requiresConfirmation: z.boolean().optional(),
  duplicates: z.array(z.object({
    id: z.string(),
    name: z.string()
  })).optional(),
  message: z.string()
});

export async function POST(req: NextRequest) {
  return withAuth(req, async (user, tenantId) => {
    try {
      // Check role permission
      const userRole = user.app_metadata?.role;
      if (userRole !== 'supervisor' && userRole !== 'admin') {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        );
      }

      // Parse and validate request
      const body = await req.json();
      const validatedData = inventoryAddRequestSchema.parse(body);

      // Initialize service
      const supabase = await createServerClient();
      const supervisorService = new SupervisorWorkflowService(supabase);

      // Add inventory item
      const result = await supervisorService.addInventoryItem(
        validatedData,
        tenantId,
        user.id
      );

      // Build response based on result
      let response: any = {
        success: result.success,
        message: result.message
      };

      if (result.requiresConfirmation) {
        // Duplicate check scenario
        response.requiresConfirmation = true;
        response.duplicates = result.data?.possibleDuplicates;
      } else if (result.success && result.data) {
        // Successfully added
        response.item = {
          id: result.data.id,
          name: result.data.name,
          category: result.data.category,
          quantity: result.data.quantity,
          containerId: result.data.container_id,
          imageUrl: result.data.image_url,
          thumbnailUrl: result.data.thumbnail_url,
          createdAt: result.data.created_at
        };
      }

      // Validate response
      const validatedResponse = inventoryAddResponseSchema.parse(response);

      return NextResponse.json(
        validatedResponse,
        { status: result.success ? 200 : 400 }
      );

    } catch (error) {
      // Handle validation errors
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Validation error',
            details: error.errors
          },
          { status: 400 }
        );
      }

      // Handle other errors
      return handleApiError(error);
    }
  });
}
