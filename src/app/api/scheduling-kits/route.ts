/**
 * AGENT DIRECTIVE BLOCK
 * file: src/app/api/scheduling-kits/route.ts
 * phase: 3
 * domain: scheduling-kits
 * purpose: REST API for listing and creating scheduling kits tied to tenant company context
 * spec_ref: .specify/features/003-scheduling-kits/tasks.md#Phase-3.4
 * complexity_budget: 250
 * dependencies:
 *   - internal: KitService via buildKitService, scheduling kit repositories
 *   - external: next/server, zod
 * exports: GET, POST
 * voice_considerations:
 *   - Responses include summaries suitable for voice prompts when reading kit availability.
 * offline_capability: OPTIONAL
 * test_requirements:
 *   - coverage: via tests/api/scheduling-kits.api.test.ts
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildKitService, extractCompanyId, mapPgErrorToHttp, requireSession } from './_shared';

const CreateKitSchema = z.object({
  kitCode: z.string().min(1).max(50),
  name: z.string().min(1).max(255),
  isActive: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
  items: z
    .array(
      z.object({
        itemType: z.enum(['equipment', 'material', 'tool']),
        quantity: z.number().positive(),
        unit: z.string().min(1).max(50),
        isRequired: z.boolean(),
        metadata: z.record(z.any()).optional(),
      }),
    )
    .min(1),
});

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ('response' in auth) return auth.response;

    const tenantId = extractCompanyId(auth.session, request);
    const kitService = buildKitService();
    const kits = await kitService.listKits(tenantId);

    return NextResponse.json(
      {
        kits,
        count: kits.length,
        voice_summary: `Found ${kits.length} kits`,
      },
      { status: 200 },
    );
  } catch (error) {
    const status = error instanceof Error && error.message.includes('company') ? 400 : 500;
    const message = error instanceof Error ? error.message : 'Unexpected error';

    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ('response' in auth) return auth.response;

    const body = await request.json();
    const parsed = CreateKitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const tenantId = extractCompanyId(auth.session, request);
    const kitService = buildKitService();
    const kit = await kitService.createKitWithSteps(parsed.data, tenantId);

    return NextResponse.json(
      {
        kit,
        voice_response: `Created kit ${kit.kitCode}`,
      },
      { status: 201 },
    );
  } catch (error) {
    const mapped = mapPgErrorToHttp(error);
    if (mapped) {
      return NextResponse.json(mapped.body, { status: mapped.status });
    }

    const message = error instanceof Error ? error.message : 'Failed to create kit';
    const status = message.includes('company') ? 400 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
