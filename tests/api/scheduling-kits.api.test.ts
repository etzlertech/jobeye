jest.mock('next/server', () => {
  class MockNextResponse {
    constructor(private readonly payload: unknown, public readonly status: number) {}

    static json(body: unknown, init: { status?: number } = {}) {
      return new MockNextResponse(body, init.status ?? 200);
    }

    async json() {
      return this.payload;
    }
  }

  return {
    NextResponse: MockNextResponse,
  };
});

import { createServiceSupabaseClient } from '@/lib/supabase/service-client';

const mockGetSession = jest.fn();

let listKits: typeof import('@/app/api/scheduling-kits/route')['GET'];
let createKit: typeof import('@/app/api/scheduling-kits/route')['POST'];
let getKitDetail: typeof import('@/app/api/scheduling-kits/[kitId]/route')['GET'];
let assignKit: typeof import('@/app/api/scheduling-kits/[kitCode]/assign/route')['POST'];

jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createRouteHandlerClient: () => ({
    auth: {
      getSession: mockGetSession,
    },
  }),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

const COMPANY_A = '00000000-0000-4000-a000-000000000003';
const COMPANY_B = '00000000-0000-4000-a000-0000000000bb';

type MockRequestInit = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

function createMockRequest(url: string, init: MockRequestInit = {}) {
  const headerMap = new Map<string, string>();
  if (init.headers) {
    for (const [key, value] of Object.entries(init.headers)) {
      headerMap.set(key.toLowerCase(), value);
    }
  }

  if (init.body && !headerMap.has('content-type')) {
    headerMap.set('content-type', 'application/json');
  }

  return {
    url,
    method: init.method ?? 'GET',
    headers: {
      get: (key: string) => headerMap.get(key.toLowerCase()) ?? null,
      set: (key: string, value: string) => headerMap.set(key.toLowerCase(), value),
    },
    json: async () => init.body ?? {},
  } as unknown as Request;
}

function buildSession(companyId: string) {
  return {
    data: {
      session: {
        user: {
          id: `user-${companyId}`,
          app_metadata: { company_id: companyId },
          user_metadata: {},
        },
      },
    },
    error: null,
  };
}

describe('Scheduling Kits API', () => {
  const createdKitIds: string[] = [];
  const createdAssignmentIds: string[] = [];
  const serviceClient = createServiceSupabaseClient();

  beforeAll(async () => {
    const listModule = await import('@/app/api/scheduling-kits/route');
    listKits = listModule.GET;
    createKit = listModule.POST;
    const detailModule = await import('@/app/api/scheduling-kits/[kitId]/route');
    getKitDetail = detailModule.GET;
    const assignModule = await import('@/app/api/scheduling-kits/[kitCode]/assign/route');
    assignKit = assignModule.POST;
  });

  beforeEach(() => {
    mockGetSession.mockReset();
    mockGetSession.mockResolvedValue(buildSession(COMPANY_A));
  });

  afterAll(async () => {
    if (createdAssignmentIds.length > 0) {
      await serviceClient
        .from('kit_assignments')
        .delete()
        .in('id', createdAssignmentIds);
    }

    if (createdKitIds.length > 0) {
      await serviceClient
        .from('kit_items')
        .delete()
        .in('kit_id', createdKitIds);

      await serviceClient
        .from('kits')
        .delete()
        .in('id', createdKitIds);
    }
  });

  async function createKitViaApi(suffix: string) {
    const payload = {
      kitCode: `API-KIT-${suffix}`,
      name: `API Kit ${suffix}`,
      items: [
        { itemType: 'tool', quantity: 1, unit: 'pcs', isRequired: true },
        { itemType: 'material', quantity: 2, unit: 'bags', isRequired: false },
      ],
    };

    const response = await createKit(
      createMockRequest('http://localhost/api/scheduling-kits', {
        method: 'POST',
        body: payload,
      }),
    );

    const body = await response.json();

    if (response.status !== 201) {
      throw new Error(`Failed to create test kit: ${JSON.stringify(body)}`);
    }

    createdKitIds.push(body.kit.id);
    return body.kit;
  }

  it('GET /scheduling-kits returns kits for the authenticated company', async () => {
    const response = await listKits(createMockRequest('http://localhost/api/scheduling-kits'));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body.kits)).toBe(true);
    expect(body.kits.every((kit: any) => kit.companyId === COMPANY_A)).toBe(true);
  });

  it('GET /scheduling-kits/:id returns kit detail with items', async () => {
    const kit = await createKitViaApi(`DETAIL-${Date.now()}`);

    const response = await getKitDetail(createMockRequest('http://localhost'), {
      params: { kitId: kit.id },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.kit.id).toBe(kit.id);
    expect(body.kit.items.length).toBeGreaterThan(0);
  });

  it('POST /scheduling-kits creates a kit and list endpoint includes it', async () => {
    const kitCodeSuffix = `CREATE-${Date.now()}`;
    const kit = await createKitViaApi(kitCodeSuffix);

    const listResponse = await listKits(createMockRequest('http://localhost/api/scheduling-kits'));
    expect(listResponse.status).toBe(200);

    const listBody = await listResponse.json();
    const found = listBody.kits.find((existing: any) => existing.id === kit.id);
    expect(found).toBeDefined();
  });

  it('POST /scheduling-kits returns 409 when kit_code already exists', async () => {
    const duplicateCode = `DUP-${Date.now()}`;

    const firstCreate = await createKit(
      createMockRequest('http://localhost/api/scheduling-kits', {
        method: 'POST',
        body: {
          kitCode: duplicateCode,
          name: 'Duplicate Kit',
          items: [
            {
              itemType: 'tool',
              quantity: 1,
              unit: 'pcs',
              isRequired: true,
            },
          ],
        },
      }),
    );

    expect(firstCreate.status).toBe(201);
    const firstBody = await firstCreate.json();
    createdKitIds.push(firstBody.kit.id);

    const secondCreate = await createKit(
      createMockRequest('http://localhost/api/scheduling-kits', {
        method: 'POST',
        body: {
          kitCode: duplicateCode,
          name: 'Duplicate Kit Again',
          items: [
            {
              itemType: 'tool',
              quantity: 1,
              unit: 'pcs',
              isRequired: true,
            },
          ],
        },
      }),
    );

    expect(secondCreate.status).toBe(409);
    const dupBody = await secondCreate.json();
    expect(String(dupBody.error).toLowerCase()).toContain('duplicate');
  });

  it('denies cross-tenant access to kit detail', async () => {
    const kit = await createKitViaApi(`DENY-${Date.now()}`);

    mockGetSession.mockResolvedValueOnce(buildSession(COMPANY_B));

    const response = await getKitDetail(createMockRequest('http://localhost'), {
      params: { kitId: kit.id },
    });

    expect(response.status).toBe(404);
  });

  it('POST /scheduling-kits/:kitCode/assign creates an assignment', async () => {
    const kit = await createKitViaApi(`ASSIGN-${Date.now()}`);

    const response = await assignKit(
      createMockRequest(`http://localhost/api/scheduling-kits/${kit.kitCode}/assign`, {
        method: 'POST',
        body: {
          externalRef: `EXT-${Date.now()}`,
          metadata: { reason: 'api-test' },
        },
      }),
      { params: { kitCode: kit.kitCode } },
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.assignment.kitId).toBe(kit.id);
    expect(body.assignment.externalRef).toContain('EXT-');

    createdAssignmentIds.push(body.assignment.id);
  });
});
