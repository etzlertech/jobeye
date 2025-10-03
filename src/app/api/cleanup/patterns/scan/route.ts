/**
 * @file /src/app/api/cleanup/patterns/scan/route.ts
 * @purpose API endpoint for pattern scanning
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { PatternViolationsRepository } from '@/domains/cleanup-tracking/repositories/pattern-violations.repository';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Simple in-memory tracking of ongoing scans
const activeScanIds = new Set<string>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paths = [], patterns = [] } = body;

    // Validate patterns
    const validPatterns = ['tenant_id_usage', 'functional_repository', 'missing_rls', 'direct_db_access', 'wrong_rls_path'];
    if (patterns.length > 0) {
      const invalidPatterns = patterns.filter((p: string) => !validPatterns.includes(p));
      if (invalidPatterns.length > 0) {
        return NextResponse.json(
          { error: 'Invalid patterns', invalidPatterns, validValues: validPatterns },
          { status: 400 }
        );
      }
    }

    // Check if scan already in progress (simple check)
    if (activeScanIds.size > 0) {
      return NextResponse.json(
        { error: 'Scan already in progress', activeScanCount: activeScanIds.size },
        { status: 429 }
      );
    }

    const scanId = uuidv4();
    activeScanIds.add(scanId);

    // Estimate duration based on scope
    let estimatedDuration = 30; // Base 30 seconds
    if (paths.length > 0) {
      estimatedDuration = Math.max(10, paths.length * 5); // 5 seconds per path
    }
    if (patterns.length > 0 && patterns.length < validPatterns.length) {
      estimatedDuration *= 0.7; // Reduce if only scanning specific patterns
    }

    // Start background scan (in real implementation, would use job queue)
    setImmediate(async () => {
      try {
        await performScan(scanId, paths, patterns);
      } catch (error) {
        console.error('Background scan error:', error);
      } finally {
        activeScanIds.delete(scanId);
      }
    });

    return NextResponse.json({
      scanId,
      estimatedDuration: Math.round(estimatedDuration),
      status: 'started',
      scope: {
        paths: paths.length > 0 ? paths : ['all'],
        patterns: patterns.length > 0 ? patterns : validPatterns
      }
    }, { status: 202 });

  } catch (error) {
    console.error('Pattern scan error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to start pattern scan',
        message: error instanceof Error ? error.message : 'Unknown error',
        code: 'PATTERN_SCAN_ERROR',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

async function performScan(scanId: string, paths: string[], patterns: string[]) {
  const client = createClient(supabaseUrl, supabaseServiceKey);
  const violationsRepo = new PatternViolationsRepository(client);

  console.log(`Starting scan ${scanId} for paths: ${paths.join(', ')} patterns: ${patterns.join(', ')}`);

  // Simulate scanning - in real implementation would:
  // 1. Use ts-morph to parse TypeScript files
  // 2. Use glob to find files in specified paths
  // 3. Apply pattern detection rules
  // 4. Store violations in database

  const mockViolations = [
    {
      file_path: 'src/example/old-code.ts',
      line_number: 15,
      column_number: 20,
      pattern_type: 'tenant_id_usage' as const,
      violation_text: 'const tenantId = data.tenant_id',
      suggested_fix: 'const tenantId = data.tenant_id'
    },
    {
      file_path: 'src/example/old-repository.ts',
      line_number: 5,
      column_number: 1,
      pattern_type: 'functional_repository' as const,
      violation_text: 'export function createUser()',
      suggested_fix: 'Convert to class-based repository extending BaseRepository'
    }
  ];

  // Filter by requested patterns
  const filteredViolations = patterns.length > 0 
    ? mockViolations.filter(v => patterns.includes(v.pattern_type))
    : mockViolations;

  // Clear old violations for scanned files (in real implementation)
  // await violationsRepo.clearAllViolations();

  // Store new violations
  if (filteredViolations.length > 0) {
    await violationsRepo.createMany(filteredViolations);
  }

  console.log(`Scan ${scanId} completed: found ${filteredViolations.length} violations`);
}