# Pre-Commit Testing Guide

## Overview

After experiencing multiple failed deployments due to TypeScript errors, we've implemented a comprehensive pre-commit testing system to catch errors before they reach the repository.

## Quick Start

1. **Install dependencies** (if not already done):
   ```bash
   npm install
   ```

2. **Set up git hooks**:
   ```bash
   ./scripts/setup-git-hooks.sh
   ```

3. **Manual testing** (before committing):
   ```bash
   npm run quick-check  # Fast TypeScript check
   npm run pre-commit   # Full validation suite
   ```

## Available Commands

### Fast Checks (< 5 seconds)
- `npm run quick-check` - Basic TypeScript compilation check
- `npm run type-check` - TypeScript check without build

### Comprehensive Checks (30-60 seconds)
- `npm run pre-commit` - Full validation including:
  - TypeScript compilation
  - TypeScript strict mode (warnings only)
  - ESLint validation
  - Import validation
  - Directive validation
  - Dependency validation
  - Full build test

### Other Utilities
- `npm run type-check:strict` - Check with TypeScript strict mode
- `npm run lint:directives` - Validate AGENT DIRECTIVE blocks
- `npm run validate:deps` - Check dependency graph

## Git Hooks

Once set up, the following hooks run automatically:

### pre-commit
- Runs TypeScript type checking
- Runs lint-staged on changed files
- Prevents commits if errors are found

### commit-msg
- Enforces conventional commit format
- Format: `<type>(<scope>): <subject>`
- Example: `fix: correct TypeScript compilation errors`

## Lint-Staged Configuration

The `.lintstagedrc.json` file runs these checks on staged files:
- TypeScript compilation check
- ESLint with auto-fix
- Full type check for src/ files

## Pre-Commit Check Details

The `pre-commit-checks.ts` script runs:

1. **TypeScript Compilation** - Catches type errors
2. **TypeScript Strict Mode** - Shows potential issues (non-blocking)
3. **ESLint** - Code quality and style
4. **Import Validation** - Catches common import mistakes
5. **Directive Validation** - Ensures AGENT DIRECTIVE blocks are valid
6. **Dependency Validation** - Checks internal dependencies
7. **Build Test** - Full Next.js build (catches all errors)

## Common Issues and Solutions

### "Type 'string | null' is not assignable to type 'string | undefined'"
Convert null to undefined:
```typescript
// Before
voice_error: someValue  // might be null

// After
voice_error: someValue || undefined
```

### "Property does not exist on type"
Check Supabase query joins and array handling:
```typescript
// Before
invitation.tenant.name

// After
Array.isArray(invitation.tenants) ? invitation.tenants[0].name : invitation.tenants.name
```

### Import errors
Ensure correct imports:
```typescript
// Wrong
import { logger } from '@/core/logger/logger';
import { Logger } from '@/core/logger/logger';

// Correct
import { createLogger } from '@/core/logger/logger';
const logger = createLogger('module-name');
```

## Bypassing Checks (Emergency Only)

If you absolutely need to commit without checks:
```bash
git commit --no-verify -m "emergency: your message"
```

⚠️ **Use sparingly!** This defeats the purpose of preventing deployment failures.

## Troubleshooting

1. **Hooks not running**: Re-run `./scripts/setup-git-hooks.sh`
2. **Permission denied**: Check file permissions with `chmod +x`
3. **Build taking too long**: Use `npm run quick-check` for faster feedback

## Best Practices

1. Run `npm run quick-check` frequently during development
2. Run `npm run pre-commit` before pushing to remote
3. Fix all TypeScript errors immediately
4. Don't ignore strict mode warnings - they often indicate real issues
5. Keep the build passing at all times