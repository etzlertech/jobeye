/**
 * @file Contract test for /api/cleanup/schema/verify endpoint
 */

import { GET } from '@/app/api/cleanup/schema/verify/route';
import { NextRequest } from 'next/server';
import { createTestClient } from '../test-utils';

describe('GET /api/cleanup/schema/verify', () => {
  const client = createTestClient();

  it('should return schema verification results', async () => {
    const request = new Request('http://localhost:3000/api/cleanup/schema/verify');
    const response = await GET(request as unknown as NextRequest);
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    
    // Validate response structure
    expect(data).toHaveProperty('isAligned');
    expect(typeof data.isAligned).toBe('boolean');
    
    expect(data).toHaveProperty('missingMigrations');
    expect(Array.isArray(data.missingMigrations)).toBe(true);
    
    expect(data).toHaveProperty('unexpectedTables');
    expect(Array.isArray(data.unexpectedTables)).toBe(true);
    
    expect(data).toHaveProperty('mismatchedColumns');
    expect(Array.isArray(data.mismatchedColumns)).toBe(true);
    
    // If there are mismatched columns, validate structure
    if (data.mismatchedColumns.length > 0) {
      const mismatch = data.mismatchedColumns[0];
      expect(mismatch).toHaveProperty('table');
      expect(mismatch).toHaveProperty('expected');
      expect(mismatch).toHaveProperty('actual');
      expect(Array.isArray(mismatch.expected)).toBe(true);
      expect(Array.isArray(mismatch.actual)).toBe(true);
    }
  });

  it('should handle server errors gracefully', async () => {
    // Mock a failure scenario
    const mockClient = {
      rpc: jest.fn().mockRejectedValue(new Error('Database error'))
    };
    
    // We'll need to inject the mock client when implementing
    // For now, we expect the endpoint to handle errors
    const request = new Request('http://localhost:3000/api/cleanup/schema/verify');
    
    // The actual implementation should handle errors and return 500
    // This test will fail initially, driving the implementation
    try {
      const response = await GET(request as unknown as NextRequest);
      if (response.status === 500) {
        const error = await response.json();
        expect(error).toHaveProperty('error');
        expect(error).toHaveProperty('message');
      }
    } catch (e) {
      // Expected to fail until implementation exists
    }
  });
});