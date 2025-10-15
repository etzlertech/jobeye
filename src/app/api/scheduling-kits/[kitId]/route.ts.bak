/**
 * AGENT DIRECTIVE BLOCK
 * file: src/app/api/scheduling-kits/[kitId]/route.ts
 * phase: 3
 * domain: scheduling-kits
 * purpose: Retrieve scheduling kit detail scoped to tenant
 * spec_ref: .specify/features/003-scheduling-kits/tasks.md#Phase-3.4
 * complexity_budget: 180
 * dependencies:
 *   - internal: KitService via buildKitService
 *   - external: next/server
 * exports: GET
 * voice_considerations:
 *   - Provides voice-friendly summary for detailed kit readouts.
 * offline_capability: OPTIONAL
 * test_requirements:
 *   - Covered by tests/api/scheduling-kits.api.test.ts
 */

import { NextResponse } from 'next/server';
import { buildKitService, extractCompanyId, requireSession } from '../_shared';

interface RouteParams {
  params: {
    kitId: string;
  };
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireSession();
    if ('response' in auth) return auth.response;

    const tenantId = extractCompanyId(auth.session, request);
    const kitService = buildKitService();
    const kit = await kitService.getKitOrThrow(tenantId, params.kitId);

    return NextResponse.json(
      {
        kit,
        voice_summary: `Kit ${kit.kitCode} has ${kit.items.length} items`,
      },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('Kit not found')) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const message = error instanceof Error ? error.message : 'Failed to load kit';
    const status = message.includes('company') ? 400 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
