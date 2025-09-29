/**
 * AGENT DIRECTIVE BLOCK
 * file: src/app/api/scheduling-kits/[kitCode]/assign/route.ts
 * phase: 3
 * domain: scheduling-kits
 * purpose: Assign a kit to an external reference (job placeholder) using default variant
 * spec_ref: .specify/features/003-scheduling-kits/tasks.md#Phase-3.4
 * complexity_budget: 200
 * dependencies:
 *   - internal: KitService via buildKitService
 *   - external: next/server, zod
 * exports: POST
 * voice_considerations:
 *   - Returns short voice acknowledgement for assignment confirmation.
 * offline_capability: OPTIONAL
 * test_requirements:
 *   - Covered by tests/api/scheduling-kits.api.test.ts
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildKitService, extractCompanyId, requireSession } from '../../_shared';

interface RouteParams {
  params: {
    kitCode: string;
  };
}

const AssignKitSchema = z.object({
  externalRef: z.string().min(1).max(120),
  notes: z.string().max(500).optional(),
  metadata: z.record(z.any()).optional(),
});

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireSession();
    if ('response' in auth) return auth.response;

    const body = await request.json();
    const parsed = AssignKitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const companyId = extractCompanyId(auth.session, request);
    const kitService = buildKitService();
    const assignment = await kitService.assignKitByCode({
      companyId,
      kitCode: params.kitCode,
      externalRef: parsed.data.externalRef,
      notes: parsed.data.notes ?? undefined,
      metadata: parsed.data.metadata ?? {},
    });

    return NextResponse.json(
      {
        assignment: {
          ...assignment,
          createdAt: assignment.createdAt.toISOString(),
          updatedAt: assignment.updatedAt.toISOString(),
        },
        voice_response: `Assigned kit ${params.kitCode}`,
      },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to assign kit';

    if (message.includes('not available')) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const status = message.includes('company') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
