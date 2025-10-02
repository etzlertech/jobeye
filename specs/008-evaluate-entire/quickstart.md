# Quickstart: Redundancy Analyzer

## Installation

```bash
# Navigate to the analyzer directory
cd tools/redundancy-analyzer

# Install dependencies
npm install

# Build the tool
npm run build
```

## Basic Usage

### 1. Run Full Analysis

```bash
# Analyze the entire JobEye codebase
npm run analyze -- --project-root ../..

# With custom options
npm run analyze -- \
  --project-root ../.. \
  --exclude "tests,docs" \
  --threshold 80
```

### 2. View Progress

```bash
# Check analysis status
npm run status -- --analysis-id <id>
```

### 3. Access Report

```bash
# Open the generated report
cat reports/redundancy-analysis-*.md
```

## Example Workflow

### Scenario: Identify Duplicate Repository Implementations

1. **Start Analysis**
   ```bash
   npm run analyze -- --project-root ../.. --focus repositories
   ```

2. **Monitor Progress**
   ```bash
   # Analysis will show progress bar
   Scanning: [████████████████████░░░░░] 80% | 412/500 files
   ```

3. **Review Findings**
   ```markdown
   ## High Priority: Duplicate Repository Pattern
   
   Found 2 implementations of KitRepository:
   - /domains/repos/scheduling-kits/kit-repository.ts (156 LoC)
   - /scheduling/repositories/kit.repository.ts (143 LoC)
   
   Recommendation: Consolidate to single implementation
   Impact: Remove ~150 lines of duplicate code
   ```

### Scenario: Find Abandoned Database Tables

1. **Run Database-Focused Analysis**
   ```bash
   npm run analyze -- --project-root ../.. --focus database
   ```

2. **Check Report Section**
   ```markdown
   ## Abandoned Tables (No CRUD Operations)
   
   - irrigation_systems (5 tables, 0 repositories)
   - vendor_management (3 tables, 0 repositories)  
   - training_records (3 tables, 0 repositories)
   
   Total: 75 tables without application code
   ```

## Understanding the Report

### Report Structure

```markdown
# Redundancy Analysis Report

## Executive Summary
- Total redundant code: X,XXX lines
- Critical findings: XX
- Estimated cleanup effort: XX days

## Findings by Category
1. Duplicate Implementations
2. Overlapping Features  
3. Unused Code
4. Abandoned Tables

## Recommendations
[Prioritized list of actions]

## Detailed Findings
[Complete analysis with code locations]
```

### Interpreting Impact Scores

- **Scale (LoC)**: Higher = more code to remove
- **Risk (Dependencies)**: Higher = more careful refactoring needed
- **Quality**: Lower = older/poor quality code, good cleanup candidate

## CLI Options

```bash
Options:
  --project-root    Path to project root (required)
  --exclude         Comma-separated exclude patterns
  --threshold       Similarity threshold (default: 70)
  --focus           Analysis focus: all|code|database|api
  --output          Output directory for report
  --format          Report format: markdown|json
  --verbose         Show detailed progress
  --help            Show help
```

## Validation

After running the analyzer, validate findings by:

1. **Spot Check Duplicates**
   ```bash
   # Open identified duplicate files
   code <file1> <file2>
   ```

2. **Verify Unused Code**
   ```bash
   # Search for references to "unused" code
   grep -r "unusedFunction" --exclude-dir=node_modules
   ```

3. **Confirm Table Mappings**
   ```bash
   # Check if table has repository
   find . -name "*.repository.ts" | xargs grep -l "table_name"
   ```

## Troubleshooting

### Analysis Takes Too Long
- Use `--exclude` to skip large directories
- Run focused analysis with `--focus` option
- Check available memory

### High False Positive Rate
- Increase `--threshold` to 80-90%
- Review similarity algorithm settings
- Check for framework boilerplate

### Missing Findings
- Ensure all source directories are included
- Check file extensions are recognized
- Verify database connection for schema analysis

## Next Steps

1. Review the generated report
2. Prioritize high-impact findings
3. Create cleanup tasks from recommendations
4. Track progress with follow-up analyses

For detailed documentation, see the [full specification](./spec.md).