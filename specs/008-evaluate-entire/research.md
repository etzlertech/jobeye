# Research: Codebase Redundancy Analysis

## Overview
Research findings for implementing a comprehensive codebase redundancy analyzer for the JobEye project.

## Key Decisions

### 1. AST Parsing Approach
**Decision**: Use TypeScript Compiler API (ts-morph) for TypeScript/JavaScript analysis
**Rationale**: 
- Native understanding of TypeScript syntax and types
- Preserves semantic information during analysis
- Better accuracy for identifying true duplicates vs similar patterns
**Alternatives considered**:
- Babel parser: Good but lacks TypeScript semantic understanding
- ESLint custom rules: Too limited for comprehensive analysis
- Regular expressions: Too primitive for accurate detection

### 2. Similarity Detection Algorithm
**Decision**: Combination of structural and semantic analysis
**Rationale**:
- Structural: AST node comparison for exact duplicates
- Semantic: Variable renaming tolerance, type-aware comparison
- Threshold-based scoring (70% similarity = potential duplicate)
**Alternatives considered**:
- Hash-based: Too strict, misses renamed variables
- Token-based: Misses semantic meaning
- ML-based: Overkill for this use case

### 3. Database Schema Analysis
**Decision**: Direct Supabase client queries using information_schema
**Rationale**:
- Already proven approach in existing scripts
- Real-time accurate schema information
- Can correlate with actual row counts
**Alternatives considered**:
- Migration file parsing: Often out of sync with reality
- pg_dump analysis: Requires additional tooling
- Static analysis: Misses runtime relationships

### 4. Report Generation
**Decision**: Markdown with structured sections and actionable recommendations
**Rationale**:
- Version control friendly
- Easy to read and share
- Supports tables, code blocks, and formatting
- Can be converted to other formats if needed
**Alternatives considered**:
- JSON: Too technical for stakeholders
- HTML: Harder to version control
- PDF: Not developer-friendly

### 5. Code Quality Metrics
**Decision**: Three-factor scoring system
**Rationale**:
- Scale (LoC): Objective measure of duplication size
- Risk (Dependencies): Impact assessment
- Quality: Alignment with modern practices
**Alternatives considered**:
- Cyclomatic complexity only: Too narrow
- Test coverage: Not available for all code
- Last modified date only: Doesn't reflect quality

## Technical Patterns

### Pattern 1: Repository Duplication
**Finding**: Multiple repository implementations for same entities
**Example**: Kits have repositories in both `/domains/repos/` and `/scheduling/`
**Solution**: Consolidate to single source of truth per entity

### Pattern 2: Service Layer Redundancy
**Finding**: Similar services in different domains (vision, job-workflows, crew)
**Example**: Multiple offline sync implementations
**Solution**: Extract to shared services layer

### Pattern 3: API Endpoint Overlap
**Finding**: Different routes serving same data
**Example**: `/api/vision/verify` vs `/api/jobs/[jobId]/kits/[kitId]/verify`
**Solution**: Standardize REST patterns, deprecate duplicates

### Pattern 4: Abandoned Tables
**Finding**: 71% of database tables lack repository implementations
**Example**: `irrigation_*` tables, `vendor_*` tables
**Solution**: Either implement CRUD or remove from schema

## Implementation Approach

### Phase 1: Static Analysis
1. Parse all TypeScript/JavaScript files
2. Build dependency graph
3. Identify duplicate function signatures
4. Find similar class structures

### Phase 2: Dynamic Analysis  
1. Query live database schema
2. Map tables to repositories
3. Trace API endpoints to implementations
4. Identify unreachable code

### Phase 3: Report Generation
1. Categorize findings by type
2. Calculate impact scores
3. Generate recommendations
4. Output structured Markdown

## Performance Considerations

### Memory Management
- Stream file processing to handle large codebases
- Process domains in isolation
- Clear AST cache between analyses

### Parallelization
- Analyze independent domains concurrently
- Batch database queries
- Parallel similarity calculations

## Integration Points

### Existing Tools
- TypeScript compiler API
- Supabase JavaScript client
- Node.js file system APIs
- Glob for file matching

### Output Integration
- Reports saved in `/reports` directory
- Timestamped for tracking progress
- Can be committed to version control

## Best Practices

### For Redundancy Detection
1. Semantic comparison over syntactic
2. Consider context and purpose
3. Validate with manual review
4. Track false positives

### For Code Consolidation
1. Preserve git history during moves
2. Update all imports systematically
3. Maintain backward compatibility
4. Document deprecations

## Next Steps
With this research complete, we can proceed to Phase 1 design, creating the data model and contracts for the redundancy analyzer tool.