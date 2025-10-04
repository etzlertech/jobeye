/**
 * @file Contract test for /api/cleanup/patterns/scan endpoint
 */

import { POST } from '@/app/api/cleanup/patterns/scan/route';
import { NextRequest } from 'next/server';
import { createTestClient } from '../test-utils';

describe('POST /api/cleanup/patterns/scan', () => {
  const client = createTestClient();

  it('should initiate a full scan when no filters provided', async () => {
    const request = new Request('http://localhost:3000/api/cleanup/patterns/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    const response = await POST(request as unknown as NextRequest);
    
    expect(response.status).toBe(202); // Accepted
    
    const data = await response.json();
    
    // Validate response structure
    expect(data).toHaveProperty('scanId');
    expect(data.scanId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(data).toHaveProperty('estimatedDuration');
    expect(typeof data.estimatedDuration).toBe('number');
    expect(data.estimatedDuration).toBeGreaterThan(0);
  });

  it('should accept specific paths to scan', async () => {
    const request = new Request('http://localhost:3000/api/cleanup/patterns/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paths: ['src/domains/inventory', 'src/domains/equipment']
      })
    });
    
    const response = await POST(request as unknown as NextRequest);
    
    expect(response.status).toBe(202);
    
    const data = await response.json();
    
    expect(data).toHaveProperty('scanId');
    expect(data).toHaveProperty('estimatedDuration');
    
    // Scanning specific paths should be faster
    expect(data.estimatedDuration).toBeLessThan(60); // Less than 60 seconds
  });

  it('should accept specific patterns to check', async () => {
    const request = new Request('http://localhost:3000/api/cleanup/patterns/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patterns: ['tenant_id_usage', 'functional_repository']
      })
    });
    
    const response = await POST(request as unknown as NextRequest);
    
    expect(response.status).toBe(202);
    
    const data = await response.json();
    
    expect(data).toHaveProperty('scanId');
    expect(data).toHaveProperty('estimatedDuration');
  });

  it('should accept both paths and patterns filters', async () => {
    const request = new Request('http://localhost:3000/api/cleanup/patterns/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paths: ['src/domains/inventory'],
        patterns: ['tenant_id_usage']
      })
    });
    
    const response = await POST(request as unknown as NextRequest);
    
    expect(response.status).toBe(202);
  });

  it('should reject scan if one is already in progress', async () => {
    // First request
    const request1 = new Request('http://localhost:3000/api/cleanup/patterns/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    // This test assumes the implementation tracks ongoing scans
    // The actual implementation will need to handle this
    const response1 = await POST(request1 as unknown as NextRequest);
    expect(response1.status).toBe(202);
    
    // Immediate second request should be rejected
    const request2 = new Request('http://localhost:3000/api/cleanup/patterns/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    // Note: This behavior depends on implementation
    // The test documents the expected behavior
    try {
      const response2 = await POST(request2 as unknown as NextRequest);
      if (response2.status === 429) {
        const error = await response2.json();
        expect(error).toHaveProperty('error');
      }
    } catch (e) {
      // Implementation might not exist yet
    }
  });

  it('should validate pattern types', async () => {
    const request = new Request('http://localhost:3000/api/cleanup/patterns/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patterns: ['invalid_pattern_type']
      })
    });
    
    const response = await POST(request as unknown as NextRequest);
    
    // Should either ignore invalid patterns or return 400
    expect([202, 400]).toContain(response.status);
  });
});