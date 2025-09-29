# Task: Unit Test Coverage Gap Analysis

**Slug:** `tests-005-unit-coverage`
**Priority:** Medium
**Size:** 1 PR

## Description
Identify and fill unit test coverage gaps to achieve ≥80% coverage across all new services.

## Files to Create
- `scripts/coverage-gap-analysis.ts`
- `src/__tests__/unit-test-checklist.md`
- Additional test files as identified

## Files to Modify
- `jest.config.js` - Update coverage thresholds
- `package.json` - Add coverage scripts

## Acceptance Criteria
- [ ] Analyzes current coverage gaps
- [ ] Generates missing test report
- [ ] Adds tests for uncovered branches
- [ ] Achieves ≥80% coverage per file
- [ ] No critical paths untested
- [ ] Coverage trends tracked

## Test Files
**Key areas needing unit tests:**

Vision Services:
- `yolo-model-loader.ts` - Model caching edge cases
- `fps-controller.ts` - Throttling accuracy
- `vlm-fallback-router.ts` - Threshold calculations

Voice Services:
- `wake-word-detector.ts` - Audio processing
- `entity-resolver.ts` - Fuzzy matching algorithms
- `confirmation-service.ts` - State machine

Offline Services:
- `image-compressor.ts` - Compression ratios
- `sync-scheduler.ts` - Retry logic
- `conflict-detector.ts` - Diff algorithms

## Dependencies
- Jest coverage reports

## Coverage Analysis Script
```typescript
// scripts/coverage-gap-analysis.ts
interface CoverageGap {
  file: string;
  currentCoverage: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  missingTests: {
    functions: string[];
    branches: BranchInfo[];
  };
  priority: 'critical' | 'high' | 'medium' | 'low';
}

async function analyzeCoverageGaps(): Promise<CoverageGap[]> {
  const coverage = await loadCoverageReport();
  const gaps: CoverageGap[] = [];
  
  for (const [file, data] of Object.entries(coverage)) {
    if (data.lines.percentage < 80) {
      gaps.push({
        file,
        currentCoverage: data.totals,
        missingTests: identifyMissing(data),
        priority: calculatePriority(file, data)
      });
    }
  }
  
  return gaps.sort((a, b) => 
    priorityScore(a.priority) - priorityScore(b.priority)
  );
}
```

## Unit Test Checklist Template
```markdown
# Unit Test Coverage Checklist

## High Priority (Critical Path)
- [ ] Vision pipeline happy path
- [ ] Voice command processing
- [ ] Offline queue operations
- [ ] Cost budget enforcement
- [ ] RLS policy validation

## Edge Cases to Test
- [ ] Network timeout handling
- [ ] Storage quota exceeded
- [ ] Malformed input data
- [ ] Concurrent operations
- [ ] Service unavailable

## Performance Tests
- [ ] Operation latency bounds
- [ ] Memory leak detection
- [ ] CPU usage limits
```

## Coverage Configuration
```javascript
// jest.config.js additions
module.exports = {
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 80,
      functions: 80,
      lines: 80
    },
    // Critical services need higher coverage
    './src/domains/vision/services/': {
      statements: 90,
      branches: 85
    },
    './src/domains/voice/services/': {
      statements: 90,
      branches: 85
    }
  },
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/',
    '/scripts/',
    '.test.ts$'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.stories.ts'
  ]
};
```

## Missing Test Template
```typescript
// Template for filling coverage gaps
describe('ServiceName - Coverage Gaps', () => {
  describe('uncovered function', () => {
    it('handles edge case 1', () => {
      // Arrange
      const input = edgeCaseData();
      
      // Act
      const result = service.method(input);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.property).toBe(expected);
    });
    
    it('handles error condition', () => {
      // Force error condition
      mockDependency.mockRejectedValue(new Error('Test error'));
      
      // Assert error handled gracefully
      await expect(service.method()).rejects.toThrow('User-friendly error');
    });
  });
});
```