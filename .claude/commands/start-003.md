# Start Implementation of Feature 003 - Scheduling Kits

## STEP 1: Load Context
Read these files in order:
1. `.specify/constitution.md`
2. `.specify/features/003-scheduling-kits/tasks.md` 
3. `docs/003-scheduling-kits/NOTES.md`

## STEP 2: Create Todo List
Parse the tasks from `.specify/features/003-scheduling-kits/tasks.md` and:
- Create a todo list using TodoWrite
- Identify which tasks are already DONE (check NOTES.md)
- Show a status table

## STEP 3: Check Database State
Before any database work:
```bash
npm run check:db-actual
```
Or if that fails:
```bash
npx tsx scripts/check-actual-db.ts
```

## STEP 4: Execute Next Tasks
- Work on tasks marked TODO
- Update task status as you progress
- Follow TDD - write tests first

## IMPORTANT RULES:
- Use Write tool for file creation (not shell heredocs)
- Respect 300 LoC complexity budget
- Include AGENT DIRECTIVE BLOCKS in all files
- Write tests FIRST (they should fail initially)
- Push after each commit