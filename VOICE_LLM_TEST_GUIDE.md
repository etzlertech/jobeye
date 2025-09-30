# Voice + LLM Integration Testing Guide

## Overview

This guide covers testing the full voice-to-scheduling pipeline with real Claude API calls. This validates that:
1. Voice commands are properly understood by the LLM
2. Intents are correctly extracted
3. Scheduling operations execute successfully
4. Natural language responses are generated

## Setup

### Prerequisites

1. **Supabase credentials** (already in `.env.local`)
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```

2. **Anthropic API key** (add to `.env.local`)
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

   Get your API key from: https://console.anthropic.com/

### Installation

```bash
npm install @anthropic-ai/sdk
```

## Running the Test

```bash
npx tsx scripts/test-scheduling-voice-llm.ts
```

You'll see a conversational interface:

```
🎙️  VOICE + LLM SCHEDULING TEST

This tests the full voice pipeline with real Claude API calls.

Example commands:
  - "Create a schedule for tomorrow"
  - "Add a job at 456 Oak Street for 90 minutes"
  - "What's on my schedule today?"
  - "Check for any conflicts"
  - "When can I fit in a 2 hour job?"

Type "quit" to exit and cleanup

🎤 You: _
```

## Example Conversations

### Conversation 1: Create Schedule and Add Jobs

```
🎤 You: Create a schedule for tomorrow

🤖 Processing with Claude API...
📋 Intent: create_day_plan
📋 Parameters: {"date":"2025-10-02"}

⚙️  Executing scheduling operation...
Creating day plan for 2025-10-02...
✅ Day plan created: 4b317227-...

🎤 Generating voice response...
🤖 Assistant: I've created your schedule for tomorrow, October 2nd. It's ready for you to add jobs.

🎤 You: Add a job at 123 Main Street for 90 minutes

🤖 Processing with Claude API...
📋 Intent: add_job
📋 Parameters: {"address":"123 Main Street","duration_minutes":90}

⚙️  Executing scheduling operation...
Adding job: 123 Main Street (90 min)...
✅ Job added: 123 Main Street at 8:00:00 AM
   📊 Jobs on schedule: 1/6

🤖 Assistant: Got it! I've added a 90 minute job at 123 Main Street to your schedule at 8 AM.

🎤 You: Add another job at 456 Oak Avenue for 2 hours

🤖 Processing with Claude API...
📋 Intent: add_job
📋 Parameters: {"address":"456 Oak Avenue","duration_minutes":120}

⚙️  Executing scheduling operation...
Adding job: 456 Oak Avenue (120 min)...
✅ Job added: 456 Oak Avenue at 9:30:00 AM
   📊 Jobs on schedule: 2/6

🤖 Assistant: Added! Your 2 hour job at 456 Oak Avenue is scheduled for 9:30 AM.
```

### Conversation 2: Query and Check Conflicts

```
🎤 You: What's on my schedule today?

🤖 Processing with Claude API...
📋 Intent: query_schedule
📋 Parameters: {}

⚙️  Executing scheduling operation...
Querying schedule for 2025-10-01...
✅ Found 4 jobs
   📊 Total jobs: 4

🤖 Assistant: You have 4 jobs scheduled for today. Starting with your first job at 8 AM.

🎤 You: Check for any conflicts

🤖 Processing with Claude API...
📋 Intent: check_conflicts
📋 Parameters: {}

⚙️  Executing scheduling operation...
Checking for conflicts...
✅ Found 0 conflicts

🤖 Assistant: Good news! Your schedule looks clean with no conflicts. All your jobs are properly spaced.
```

### Conversation 3: Optimal Time Slot

```
🎤 You: When can I fit in a 60 minute job?

🤖 Processing with Claude API...
📋 Intent: suggest_time
📋 Parameters: {"duration_minutes":60}

⚙️  Executing scheduling operation...
Finding optimal 60 minute slot...
✅ Found slot after Job 2

🤖 Assistant: I can fit that in at 11:30 AM, right after your Oak Avenue job. That gives you time to travel.
```

### Conversation 4: Hit 6-Job Limit

```
🎤 You: Add a job at 789 Pine Street for 1 hour

[... after adding 5 jobs ...]

🎤 You: Add another job at 999 Elm Street for 45 minutes

🤖 Processing with Claude API...
📋 Intent: add_job
📋 Parameters: {"address":"999 Elm Street","duration_minutes":45}

⚙️  Executing scheduling operation...
Adding job: 999 Elm Street (45 min)...
⚠️  6-job limit reached!

🤖 Assistant: I can't add that job - you've already reached the maximum of 6 jobs per day. Would you like to reschedule one of your existing jobs?
```

## What Gets Tested

### 1. LLM Intent Recognition ✅
- Natural language understanding
- Parameter extraction (addresses, times, durations)
- Context awareness (current day plan, previous jobs)

### 2. Scheduling Operations ✅
- Create day plans
- Add jobs to schedule
- Query schedules
- Check for conflicts
- Suggest optimal time slots

### 3. Business Rules ✅
- 6-job limit enforcement
- Sequence ordering
- Travel time consideration
- Conflict detection

### 4. Voice Response Generation ✅
- Natural language responses
- Concise and conversational
- Context-aware feedback

### 5. Database Integration ✅
- Real Supabase operations
- PostGIS location data
- Foreign key constraints
- RLS policies (via service role)

## Architecture

```
┌─────────────┐
│ User Input  │  "Add a job at 123 Main St for 90 minutes"
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│  Claude API         │  Intent extraction + parameters
│  (processVoiceInput)│  → intent: "add_job"
└──────┬──────────────┘  → params: {address, duration}
       │
       ▼
┌─────────────────────────┐
│  Scheduling Operations  │  Execute based on intent
│  (executeSchedulingOp)  │  → addJobToSchedule()
└──────┬──────────────────┘  → Check 6-job limit
       │                      → Insert to Supabase
       ▼
┌─────────────────────────┐
│  Database (Supabase)    │  Real operations
│  - day_plans            │  - FK constraints
│  - schedule_events      │  - PostGIS location
└──────┬──────────────────┘  - RLS policies
       │
       ▼
┌─────────────────────────┐
│  Voice Response         │  Natural language
│  (generateVoiceResponse)│  → "Job added at 8 AM!"
└─────────────────────────┘
```

## Cost Tracking

Each conversation with Claude incurs API costs:
- **Input tokens**: User message + context + system prompt
- **Output tokens**: Assistant response

**Typical costs per exchange**:
- Simple intent recognition: ~$0.002-0.005
- Complex parameter extraction: ~$0.005-0.01
- Voice response generation: ~$0.001-0.003

**Per conversation (5-10 exchanges)**: ~$0.03-0.08

Monitor usage at: https://console.anthropic.com/

## Conversation Context

The test harness maintains context across exchanges:

```typescript
interface ConversationContext {
  currentDayPlanId?: string;           // Active day plan
  lastJobLocation?: { lat, lng };      // For travel time
  conversationHistory: Array<{         // Full conversation
    role: 'user' | 'assistant';
    content: string;
  }>;
}
```

This allows natural conversations like:
```
You: Create a schedule for tomorrow
Bot: Done! Your schedule is ready.
You: Add a job at 123 Main [Bot knows which day plan to use]
Bot: Added! That's your first job at 8 AM.
You: Add another one at 456 Oak [Bot knows to add to same plan]
```

## Intent Recognition

Currently uses **simple pattern matching** on Claude's response text:

```typescript
function parseIntent(response: string): string {
  if (response.includes('create') && response.includes('plan'))
    return 'create_day_plan';
  if (response.includes('add') && response.includes('job'))
    return 'add_job';
  // ... etc
}
```

**Production version** should use:
- Claude's **tool use** feature for structured output
- Explicit function calling
- Type-safe parameter extraction

See: https://docs.anthropic.com/claude/docs/tool-use

## Limitations & Future Enhancements

### Current Limitations
1. **Simple intent parsing** - Uses regex, not tool_use
2. **Mock locations** - Generates random lat/lng instead of geocoding
3. **No real voice input** - Text-only simulation
4. **No voice output** - Text response only (no TTS)
5. **Single user** - Hardcoded test user ID

### Future Enhancements
1. **Add tool_use blocks** for structured intent extraction
2. **Integrate geocoding** for real address → coordinates
3. **Add Deepgram** for real speech-to-text
4. **Add ElevenLabs** for text-to-speech
5. **Multi-user support** with authentication
6. **Add photo capture** for kit verification (Feature 001)
7. **Add conflict resolution** suggestions
8. **Add route optimization** integration

## Debugging

### Enable verbose logging

Add to script:
```typescript
const DEBUG = true;

if (DEBUG) {
  console.log('LLM Request:', JSON.stringify(request, null, 2));
  console.log('LLM Response:', JSON.stringify(response, null, 2));
}
```

### Check database state

During conversation, in another terminal:
```bash
npx tsx scripts/test-scheduling-simple.ts
```

Or query directly:
```typescript
const { data } = await supabase
  .from('day_plans')
  .select('*, schedule_events(*)')
  .eq('user_id', TEST_USER_ID);

console.log(JSON.stringify(data, null, 2));
```

### Claude API errors

Common issues:
- **401 Unauthorized**: Invalid API key
- **429 Too Many Requests**: Rate limit hit
- **500 Server Error**: Try again or check status page

## Cleanup

The script **automatically cleans up** all test data when you type `quit`:

```typescript
async function cleanup() {
  await supabase.from('schedule_events').delete().eq('company_id', TEST_COMPANY_ID);
  await supabase.from('day_plans').delete().eq('company_id', TEST_COMPANY_ID);
}
```

If script crashes, manually cleanup:
```bash
# In psql or Supabase SQL editor:
DELETE FROM schedule_events WHERE company_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM day_plans WHERE company_id = '00000000-0000-0000-0000-000000000001';
```

## Integration with Voice Pipeline

This test harness demonstrates the **core architecture** for the real voice pipeline:

```
Mobile App              Edge Function            Supabase
──────────              ─────────────            ────────

[Microphone] ────▶ [Speech-to-Text]
    │                   │ (Deepgram)
    │                   ▼
    │              [Claude API]
    │                   │
    │                   │ Intent + Params
    │                   ▼
    │              [Scheduling Service] ─────▶ [day_plans]
    │                   │                      [schedule_events]
    │                   ▼
    │              [Text-to-Speech]
    │                   │ (ElevenLabs)
    │                   ▼
[Speaker] ◀──────  [Voice Response]
```

The test harness proves:
- ✅ Claude can understand scheduling commands
- ✅ Intent extraction works
- ✅ Scheduling operations execute
- ✅ Database operations succeed
- ✅ Responses are natural and conversational

## Next Steps

1. **Test thoroughly** - Try various commands and edge cases
2. **Document common patterns** - What works, what doesn't
3. **Refine prompts** - Improve intent recognition accuracy
4. **Add tool_use** - Switch from regex to structured output
5. **Integrate with voice** - Add Deepgram + ElevenLabs
6. **Build mobile UI** - Make it finger-free and voice-first

## Success Criteria

After testing, you should be able to:
- ✅ Create day plans via voice
- ✅ Add jobs with natural language
- ✅ Query schedules conversationally
- ✅ Detect conflicts automatically
- ✅ Get optimal time suggestions
- ✅ Hit 6-job limit and get feedback
- ✅ Complete full scheduling workflow
- ✅ All operations persist to database

If all work naturally in conversation, the voice pipeline is **ready for production** integration! 🎉