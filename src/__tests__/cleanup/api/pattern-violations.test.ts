/**
 * @file Contract test for /api/cleanup/patterns/violations endpoint
 */

import { GET } from '@/app/api/cleanup/patterns/violations/route';
import { NextRequest } from 'next/server';
import { createTestClient, cleanupTestData } from '../test-utils';

describe('GET /api/cleanup/patterns/violations', () => {
  const client = createTestClient();

  beforeEach(async () => {
    // Seed test violations
    await client.from('code_pattern_violations').insert([
      {
        file_path: 'src/test/file1.ts',
        line_number: 10,
        column_number: 15,
        pattern_type: 'tenant_id_usage',
        violation_text: 'const tenantId = data.tenant_id',
        suggested_fix: 'const tenantId = data.tenant_id',
        is_fixed: false
      },
      {
        file_path: 'src/test/file2.ts',
        line_number: 25,
        column_number: 5,
        pattern_type: 'functional_repository',
        violation_text: 'export function getUserRepository()',
        suggested_fix: 'Convert to class-based repository extending BaseRepository',
        is_fixed: true,
        fixed_at: new Date()
      },
      {
        file_path: 'src/test/file3.ts',
        line_number: 42,
        column_number: 8,
        pattern_type: 'wrong_rls_path',
        violation_text: 'auth.jwt() ->> tenant_id',
        suggested_fix: 'current_setting(\'request.jwt.claims\', true)::json -> \'app_metadata\' ->> \'tenant_id\'',
        is_fixed: false
      }
    ]);
  });

  afterEach(async () => {
    await cleanupTestData(client, ['code_pattern_violations']);
  });

  it('should return all violations', async () => {
    const request = new Request('http://localhost:3000/api/cleanup/patterns/violations');
    const response = await GET(request as unknown as NextRequest);
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    
    // Validate response structure
    expect(data).toHaveProperty('violations');
    expect(Array.isArray(data.violations)).toBe(true);
    expect(data.violations.length).toBeGreaterThan(0);
    
    // Validate violation structure
    const violation = data.violations[0];
    expect(violation).toHaveProperty('id');
    expect(violation).toHaveProperty('filePath');
    expect(violation).toHaveProperty('lineNumber');
    expect(violation).toHaveProperty('columnNumber');
    expect(violation).toHaveProperty('patternType');
    expect(violation).toHaveProperty('violationText');
    expect(violation).toHaveProperty('suggestedFix');
    expect(violation).toHaveProperty('isFixed');
    
    // Validate summary
    expect(data).toHaveProperty('summary');
    expect(data.summary).toHaveProperty('total');
    expect(data.summary).toHaveProperty('fixed');
    expect(data.summary).toHaveProperty('pending');
    expect(data.summary).toHaveProperty('byType');
    expect(typeof data.summary.byType).toBe('object');
  });

  it('should filter by pattern type', async () => {
    const request = new Request('http://localhost:3000/api/cleanup/patterns/violations?type=tenant_id_usage');
    const response = await GET(request as unknown as NextRequest);
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    
    // All violations should be of the requested type
    expect(data.violations.every((v: any) => v.patternType === 'tenant_id_usage')).toBe(true);
  });

  it('should filter by fix status', async () => {
    const request = new Request('http://localhost:3000/api/cleanup/patterns/violations?fixed=false');
    const response = await GET(request as unknown as NextRequest);
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    
    // All violations should be unfixed
    expect(data.violations.every((v: any) => !v.isFixed)).toBe(true);
  });

  it('should filter by file path prefix', async () => {
    const request = new Request('http://localhost:3000/api/cleanup/patterns/violations?file=src/test/file1');
    const response = await GET(request as unknown as NextRequest);
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    
    // All violations should be from files matching the prefix
    expect(data.violations.every((v: any) => v.filePath.startsWith('src/test/file1'))).toBe(true);
  });

  it('should combine multiple filters', async () => {
    const request = new Request('http://localhost:3000/api/cleanup/patterns/violations?type=tenant_id_usage&fixed=false');
    const response = await GET(request as unknown as NextRequest);
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    
    // Violations should match all filters
    expect(data.violations.every((v: any) => 
      v.patternType === 'tenant_id_usage' && !v.isFixed
    )).toBe(true);
  });
});