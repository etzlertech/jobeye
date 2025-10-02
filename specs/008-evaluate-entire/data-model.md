# Data Model: Redundancy Analysis

## Core Entities

### RedundancyFinding
Represents a discovered instance of duplicate or overlapping code.

**Fields**:
- `id`: string (UUID)
- `type`: RedundancyType enum
- `severity`: 'high' | 'medium' | 'low'
- `primaryLocation`: CodeLocation
- `duplicateLocations`: CodeLocation[]
- `impactScore`: ImpactMetrics
- `recommendation`: string
- `estimatedSavings`: number (lines of code)
- `createdAt`: Date

**Validation**:
- At least 2 locations required (primary + 1 duplicate)
- Impact score must have all three metrics
- Recommendation required for high severity findings

### CodeModule
A logical unit of code that may have duplicates.

**Fields**:
- `id`: string (UUID)
- `filePath`: string
- `moduleName`: string
- `type`: 'class' | 'function' | 'component' | 'service' | 'repository'
- `startLine`: number
- `endLine`: number
- `dependencies`: string[] (module IDs)
- `ast`: object (simplified AST representation)
- `metrics`: CodeMetrics

**Validation**:
- File path must exist
- Start line < end line
- AST must be valid TypeScript/JavaScript

### DatabaseTableMapping
Links database tables to their application code implementations.

**Fields**:
- `tableName`: string
- `hasRepository`: boolean
- `repositoryPath`: string | null
- `hasCrudOperations`: CrudOperations
- `usageCount`: number
- `lastModified`: Date | null
- `isAbandoned`: boolean

**Validation**:
- Table name must match database schema
- If hasRepository true, repositoryPath required
- Usage count >= 0

### AnalysisReport
The comprehensive output containing all findings.

**Fields**:
- `id`: string (UUID)
- `projectName`: string
- `analysisDate`: Date
- `totalFiles`: number
- `totalTables`: number
- `findings`: RedundancyFinding[]
- `summary`: AnalysisSummary
- `recommendations`: Recommendation[]

**Validation**:
- At least one finding or empty report flag
- Summary statistics must match findings
- Recommendations sorted by priority

## Supporting Types

### RedundancyType
```typescript
enum RedundancyType {
  EXACT_DUPLICATE = 'exact_duplicate',
  SIMILAR_LOGIC = 'similar_logic',
  OVERLAPPING_FEATURE = 'overlapping_feature',
  UNUSED_CODE = 'unused_code',
  ABANDONED_TABLE = 'abandoned_table',
  DUPLICATE_API = 'duplicate_api'
}
```

### CodeLocation
```typescript
interface CodeLocation {
  filePath: string;
  startLine: number;
  endLine: number;
  snippet: string; // First 3 lines for context
}
```

### ImpactMetrics
```typescript
interface ImpactMetrics {
  scale: number;      // Lines of code affected
  risk: number;       // Number of dependencies
  quality: number;    // 0-100 score based on best practices
}
```

### CrudOperations
```typescript
interface CrudOperations {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}
```

### CodeMetrics
```typescript
interface CodeMetrics {
  linesOfCode: number;
  cyclomaticComplexity: number;
  dependencyCount: number;
  lastModified: Date;
}
```

### AnalysisSummary
```typescript
interface AnalysisSummary {
  totalRedundancy: number; // Total LoC that could be removed
  criticalFindings: number;
  tablesWithoutCrud: number;
  unusedCodePercentage: number;
  topRedundantDomains: string[];
}
```

### Recommendation
```typescript
interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  action: string;
  impact: string;
  effort: 'small' | 'medium' | 'large';
  relatedFindings: string[]; // Finding IDs
}
```

## State Transitions

### Finding Lifecycle
```
DETECTED → ANALYZED → REPORTED → [RESOLVED | IGNORED]
```

### Analysis Status
```
INITIALIZING → SCANNING → ANALYZING → GENERATING_REPORT → COMPLETE
```

## Relationships

1. **RedundancyFinding** ← has many → **CodeModule**
   - One finding can involve multiple code modules

2. **CodeModule** ← depends on → **CodeModule**
   - Modules have dependency relationships

3. **DatabaseTableMapping** ← referenced by → **RedundancyFinding**
   - Abandoned tables create findings

4. **AnalysisReport** ← contains → **RedundancyFinding**
   - Report aggregates all findings

## Constraints

1. **Similarity Threshold**: 70% AST similarity triggers duplicate detection
2. **Minimum Module Size**: 10 LoC to be considered for analysis
3. **Maximum Report Size**: 10MB to ensure readability
4. **Excluded Patterns**: node_modules, .git, build directories

## Data Storage

All data is transient during analysis, with only the final Markdown report persisted to the file system. No database storage required for the analysis tool itself.