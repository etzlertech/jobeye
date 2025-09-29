# CODEX Initialization Script

## Purpose
This command ensures CODEX always starts with proper context and follows the constitution.

## Execution Steps

1. **Load Project Constitution**
   ```
   Read .specify/constitution.md
   ```

2. **Load Project Instructions**
   ```
   Read AGENTS.md
   Read CLAUDE.md
   ```

3. **Check Current Branch & Status**
   ```bash
   git branch --show-current
   git status --short
   ```

4. **Initialize Todo System**
   ```
   Use TodoRead to check existing tasks
   If empty, prompt for feature/task to work on
   ```

5. **Verify Environment**
   ```bash
   node --version
   npm --version
   ```

## Next Steps
After initialization, CODEX should ask:
"Which feature or task should I work on? (e.g., 'feature 003', 'fix tests', etc.)"