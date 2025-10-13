/**
 * Helper to create properly typed Supabase client mocks
 */

export function createMockSupabaseClient() {
  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    upsert: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    like: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    contains: jest.fn().mockReturnThis(),
    containedBy: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    and: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
    // Make it thenable
    then: jest.fn((resolve) => Promise.resolve({ data: null, error: null }).then(resolve)),
  };

  const mockAuth = {
    getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
    getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    signIn: jest.fn().mockResolvedValue({ data: null, error: null }),
    signUp: jest.fn().mockResolvedValue({ data: null, error: null }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: jest.fn().mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    }),
    admin: {
      listUsers: jest.fn().mockResolvedValue({ data: { users: [] }, error: null }),
      getUserById: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      updateUserById: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  };

  const mockStorage = {
    from: jest.fn().mockReturnValue({
      upload: jest.fn().mockResolvedValue({ data: null, error: null }),
      download: jest.fn().mockResolvedValue({ data: null, error: null }),
      createSignedUrl: jest.fn().mockResolvedValue({ data: null, error: null }),
      remove: jest.fn().mockResolvedValue({ data: null, error: null }),
      list: jest.fn().mockResolvedValue({ data: [], error: null }),
    }),
  };

  const mockRpc = jest.fn().mockResolvedValue({ data: null, error: null });

  const mockClient = {
    from: jest.fn().mockReturnValue(mockQueryBuilder),
    rpc: mockRpc,
    auth: mockAuth,
    storage: mockStorage,
  };

  return {
    client: mockClient,
    queryBuilder: mockQueryBuilder,
    auth: mockAuth,
    storage: mockStorage,
  };
}

/**
 * Helper to mock a successful query response
 */
export function mockSuccessResponse<T>(data: T) {
  return Promise.resolve({ data, error: null, count: null, status: 200, statusText: 'OK' });
}

/**
 * Helper to mock an error response
 */
export function mockErrorResponse(message: string, code?: string) {
  return Promise.resolve({ 
    data: null, 
    error: { message, code: code || 'UNKNOWN', details: null, hint: null },
    count: null,
    status: 400,
    statusText: 'Bad Request'
  });
}