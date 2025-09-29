# Task: Commit and Push Procedure

**Slug:** `ops-001-commit-push`
**Priority:** Critical
**Size:** Reusable

## Description
Reusable operational task for committing changes and immediately pushing with proper error handling.

## Files to Create
- `scripts/git-commit-push.ts`
- `docs/git-workflow.md`
- `.github/hooks/post-commit`

## Files to Modify
- `.gitmessage` - Add template
- `package.json` - Add git helper scripts

## Acceptance Criteria
- [ ] Commits with structured message
- [ ] Attempts push immediately after commit
- [ ] Handles auth failures gracefully
- [ ] Provides clear remediation steps
- [ ] Logs all operations
- [ ] Supports dry-run mode
- [ ] Never leaves commits unpushed

## Test Files
**Create:** `src/__tests__/scripts/git-commit-push.test.ts`

Test cases:
- `commits with proper message format`
- `pushes immediately after commit`
- `handles push auth failure`
- `provides remediation instructions`
- `supports batch operations`

## Dependencies
- Git CLI
- GitHub CLI (optional)

## Script Structure
```typescript
// scripts/git-commit-push.ts
interface CommitPushOptions {
  message: string;
  files?: string[];
  push?: boolean;
  dryRun?: boolean;
  force?: boolean;
}

interface CommitPushResult {
  success: boolean;
  commitHash?: string;
  pushStatus?: 'success' | 'failed' | 'skipped';
  error?: Error;
  remediation?: string;
}

async function commitAndPush(options: CommitPushOptions): Promise<CommitPushResult> {
  // 1. Validate git state
  // 2. Stage files
  // 3. Commit with message
  // 4. Attempt push
  // 5. Handle errors
  // 6. Provide remediation
}
```

## Usage Patterns
```bash
# Basic commit and push
npm run git:commit-push -- -m "feat: add vision service"

# Commit specific files
npm run git:commit-push -- -m "fix: RLS policy" --files "migrations/*.sql"

# Dry run to preview
npm run git:commit-push -- -m "test commit" --dry-run

# Force push (with confirmation)
npm run git:commit-push -- -m "chore: cleanup" --force

# Commit without push (NOT RECOMMENDED)
npm run git:commit-push -- -m "wip: testing" --no-push
```

## Error Handling Flow
```typescript
async function handlePushFailure(error: Error): Promise<void> {
  console.error('❌ Push failed:', error.message);
  
  // Diagnose the issue
  const diagnosis = await diagnoseGitIssue(error);
  
  switch (diagnosis.type) {
    case 'AUTH_REQUIRED':
      console.log(`
🔐 Authentication Required

GitHub requires authentication to push to this repository.

Option 1: Use GitHub CLI (recommended)
  $ gh auth login
  
Option 2: Use Personal Access Token
  $ git remote set-url origin https://[PAT]@github.com/[user]/[repo].git
  
Option 3: Use SSH
  $ git remote set-url origin git@github.com:[user]/[repo].git

After authentication, run:
  $ git push

Your commit ${diagnosis.commitHash} is saved locally.
`);
      break;
      
    case 'REMOTE_REJECTED':
      console.log(`
⚠️ Remote Rejected Push

The remote repository rejected your push.
Common reasons:
- Branch protection rules
- Outdated local branch
- Force push required

Try:
  $ git pull --rebase origin ${diagnosis.branch}
  $ git push

If conflicts occur, resolve them and continue.
`);
      break;
      
    case 'NETWORK_ERROR':
      console.log(`
🌐 Network Error

Cannot reach GitHub. Check your internet connection.

Your commit is saved locally. To retry:
  $ git push

To see unpushed commits:
  $ git log origin/${diagnosis.branch}..HEAD --oneline
`);
      break;
  }
}
```

## Git Message Template
```bash
# .gitmessage
# Type: feat|fix|docs|style|refactor|test|chore
# Scope: optional, e.g., (vision), (voice), (rls)
# 
# <type>(<scope>): <subject>
#
# <body>
#
# <footer>

# Example:
# feat(vision): add YOLO model caching
#
# - Cache models in IndexedDB for offline use
# - Implement LRU eviction at 100MB
# - Add progress callback during download
#
# Closes #123
```

## NPM Scripts
```json
{
  "scripts": {
    "git:commit-push": "tsx scripts/git-commit-push.ts",
    "git:status": "git status --short",
    "git:unpushed": "git log origin/HEAD..HEAD --oneline",
    "git:setup-hooks": "cp .github/hooks/* .git/hooks/",
    "git:check-auth": "gh auth status || echo 'Not authenticated'"
  }
}
```

## Post-Commit Hook
```bash
#!/bin/bash
# .github/hooks/post-commit

echo "📝 Commit created. Attempting push..."

# Attempt push
if git push 2>/dev/null; then
  echo "✅ Pushed successfully to $(git remote get-url origin)"
else
  echo "❌ Push failed. Run 'npm run git:commit-push' for assistance"
  echo "💡 Your commit is saved locally. Don't forget to push!"
fi
```

## Monitoring Unpushed Commits
```typescript
// Check for unpushed commits on startup
async function checkUnpushedCommits(): Promise<void> {
  const unpushed = await getUnpushedCommits();
  
  if (unpushed.length > 0) {
    console.warn(`
⚠️ You have ${unpushed.length} unpushed commits:
${unpushed.map(c => `  - ${c.hash} ${c.message}`).join('\n')}

Run 'git push' to sync with remote.
`);
  }
}
```

## CI Integration
```yaml
# Check for unpushed commits in CI
- name: Check All Commits Pushed
  run: |
    UNPUSHED=$(git log origin/HEAD..HEAD --oneline)
    if [ -n "$UNPUSHED" ]; then
      echo "❌ Unpushed commits detected:"
      echo "$UNPUSHED"
      exit 1
    fi
```