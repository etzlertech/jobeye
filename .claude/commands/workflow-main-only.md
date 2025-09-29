# Main-Only Workflow

## Purpose
As a single developer using multiple agents, all work should be done directly on the main branch to avoid complexity.

## Workflow Rules

### 1. NO FEATURE BRANCHES
- Always work directly on main
- Commit frequently with clear messages
- Push after each logical unit of work

### 2. AGENT HANDOFFS
When switching between agents:
1. Commit all changes: `git add -A && git commit -m "feat: [description]"`
2. Push to remote: `git push`
3. Document status in relevant docs/notes
4. Next agent pulls latest: `git pull`

### 3. WORK ORGANIZATION
Instead of branches, use:
- **Feature Flags**: Toggle incomplete features
- **Task Lists**: Track progress in TodoWrite
- **Documentation**: Keep notes in docs/[feature]/NOTES.md
- **Commits**: Small, focused commits act as checkpoints

### 4. ROLLBACK STRATEGY
If something breaks:
- Use `git revert` for specific commits
- Use `git reset --hard HEAD~N` for recent mistakes
- Keep backup tags for major milestones: `git tag backup-before-003`

### 5. TYPICAL WORKFLOW
```bash
# Start work
git pull
git status

# Make changes
# ... edit files ...

# Commit frequently
git add -A
git commit -m "feat: implement kit repository"
git push

# Continue with next task
# ... more edits ...
git add -A
git commit -m "test: add kit repository tests"
git push
```

### 6. AGENT INSTRUCTIONS
Add to all agent prompts:
```
IMPORTANT: Work directly on main branch. Do not create feature branches.
Commit and push frequently. Each commit should be a working state.
```

## Benefits
- No merge conflicts
- No branch management
- Clear linear history
- Easy rollbacks
- Simple handoffs between agents