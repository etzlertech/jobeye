# Voice Command Center - UI/UX & Implementation Plan

**Date**: 2025-10-25
**Last Updated**: 2025-10-26 (Refinements applied)
**Purpose**: Dedicated conversational interface for voice-driven CRUD operations
**Status**: 🎯 Planning Phase → Ready for Implementation

---

## 🎯 Key Implementation Refinements

**Based on infrastructure review, the following optimizations were made**:

### ✅ Component Reuse (Not Reinvention)
- **REUSE** `useVoiceCommand` hook - no new conversation logic
- **REUSE** `VoiceFloatingButton` with size variant
- **REUSE** `VoiceConfirmationModal` and `VoiceClarificationFlow`
- **NEW** only thin wrapper components for chat layout
- **Result**: Consistent STT/TTS, cost tracking, retry logic

### ✅ Ephemeral Chat History
- Chat messages are **local React state only**
- History resets on page refresh
- Server-side conversation context still tracked during active session
- **Result**: No new persistence API, no schema changes

### ✅ Simplified Database Context
- **NO new API** for table counts or live DB stats
- **REUSE** existing TenantBadge + auth context
- Display: "Voice Commands Enabled ✅" badge
- **Result**: Zero additional backend surface area

### ✅ Feature Flag Strategy
- Use existing `voice_commands_enabled` for API access
- Add new `voice_command_center_enabled` for page visibility
- Enables separate rollout: chat UI vs. floating buttons
- **Result**: A/B testing capability, gradual adoption

### ✅ Accessibility First
- Text input fallback when mic unavailable
- Keyboard navigation (Tab/Enter/Escape/Space)
- Screen reader announcements
- Large touch targets (80px mic button)
- **Result**: Works without microphone access

### ✅ Comprehensive Testing
- Playwright E2E tests for new page
- Auto-scroll, confirmation loop, concurrent sessions
- Text fallback, mic permissions, cleanup on unmount
- **Result**: Production-ready quality

### ✅ Measured Rollout
- **Week 1**: Internal testing (separate feature flag)
- **Week 2**: Pilot users (monitor adoption vs. floating buttons)
- **Week 3+**: Gradual rollout (only after positive feedback)
- **Result**: Data-driven deployment

---

## 🎨 UI/UX Design

### Screen Layout

```
┌─────────────────────────────────────────┐
│  Header: "Voice Assistant"              │
│  [Database Context Indicator]            │
├─────────────────────────────────────────┤
│                                          │
│  Chat Interface (scrollable)             │
│                                          │
│  ┌──────────────────────────────────┐  │
│  │ 👤 User: "Check in 5 hammers"    │  │
│  └──────────────────────────────────┘  │
│                                          │
│  ┌──────────────────────────────────┐  │
│  │ 🤖 Assistant: "From which job?"  │  │
│  │    [Mic Auto-Started]             │  │
│  └──────────────────────────────────┘  │
│                                          │
│  ┌──────────────────────────────────┐  │
│  │ 👤 User: "Job 123"               │  │
│  └──────────────────────────────────┘  │
│                                          │
│  ┌──────────────────────────────────┐  │
│  │ 🤖 Assistant: Confirm check-in:  │  │
│  │    • 5 hammers                    │  │
│  │    • From job 123                 │  │
│  │    • To warehouse                 │  │
│  │    Confidence: 95%                │  │
│  │    [Yes] [No]                     │  │
│  └──────────────────────────────────┘  │
│                                          │
│  ┌──────────────────────────────────┐  │
│  │ ✅ Action completed!              │  │
│  │ Checked in 5 items to warehouse.  │  │
│  └──────────────────────────────────┘  │
│                                          │
├─────────────────────────────────────────┤
│                                          │
│  [Voice Input Panel]                     │
│  "Listening..." / "Processing..." /      │
│  "Ready"                                 │
│                                          │
│                          ┌────┐          │
│                          │ 🎤 │  ← Large │
│                          └────┘   Button │
└─────────────────────────────────────────┘
```

---

## 🎯 Key Features

### 1. **Conversational Chat Interface**
- **User Messages**: Speech-to-text transcriptions
- **Assistant Messages**: Gemini responses with TTS playback
- **Message Types**:
  - `user` - User's spoken input
  - `assistant` - Gemini clarification questions
  - `system` - Status updates ("Processing...", "Action completed")
  - `confirmation` - Confirmation cards with Yes/No buttons
  - `result` - Success/error messages

### 2. **Large Mic Button (Bottom Right)**
- **States**:
  - 🟢 **Idle** (Green): Ready to listen
  - 🔴 **Recording** (Red, pulsing): Actively listening
  - 🔵 **Processing** (Blue, spinner): Analyzing intent
  - ⚪ **Disabled** (Gray): Waiting for user response
- **Size**: 80px circle (larger than floating button)
- **Position**: Fixed bottom-right corner
- **Accessibility**: Large tap target, clear visual feedback

### 3. **Live Database Context Indicator**
- **Top Bar Display**:
  ```
  🗄️ Connected to: JobEye Production
  📊 Tables: 45 | Rows: 12,453
  ✅ Live sync enabled
  ```
- **Shows**:
  - Database connection status
  - Available tables for CRUD
  - Last sync timestamp
  - Tenant context (Demo Company)

### 4. **Conversation Flow**

#### **Step 1: Initial Command**
```
User: "Check in 5 hammers"
  ↓ STT (Web Speech API)
  ↓ Send to /api/voice/command
  ↓ Gemini analyzes intent
  ↓ Missing entity: jobId
Assistant: "Which job are these hammers from?"
  ↓ TTS plays question
  ↓ Mic auto-starts
```

#### **Step 2: Clarification (Max 3 turns)**
```
User: "Job 123"
  ↓ STT
  ↓ Send to /api/voice/command (with conversation_id)
  ↓ Gemini merges entities
  ↓ All entities present
Assistant: [Confirmation Card]
  "Confirm check-in:
   • 5 hammers
   • From job 123
   • To warehouse
   Confidence: 95%
   [Yes] [No]"
```

#### **Step 3: Confirmation**
```
User: "Yes" (via voice or button)
  ↓ Send to /api/voice/confirm
  ↓ Execute CRUD via InventoryVoiceOrchestrator
  ↓ Action executes
Assistant: ✅ "Checked in 5 items (hammers) from job 123 to warehouse."
  ↓ Show success message
  ↓ Offer "Start new command" button
```

---

## 🛠️ Technical Architecture

### Component Reuse Strategy

**✅ REUSE Existing Components** (from Phase 2):
- `useVoiceCommand` - Already handles STT/TTS, conversation flow, API calls
- `VoiceFloatingButton` - Reuse with larger styling variant
- `VoiceConfirmationModal` - Already shows confirmation cards
- `VoiceClarificationFlow` - Already handles multi-turn clarifications

**🆕 NEW Wrapper Components**:
- `VoiceChatLayout` - Chat-style layout wrapper around existing modals
- `ChatMessageList` - Display message history (ephemeral state only)
- `ChatMessage` - Individual message bubbles (wraps existing modal content)

### Components

```
Voice Command Center Page
├── VoiceChatLayout (NEW wrapper)
│   ├── TenantContextHeader (reuse existing tenant badge + voice enabled flag)
│   ├── ChatMessageList (NEW - ephemeral state)
│   │   └── ChatMessage (NEW bubble wrapper)
│   └── VoiceFloatingButton (REUSE with size="large" prop)
│
├── useVoiceCommand (REUSE existing hook)
│   ├── STT/TTS control ✅
│   ├── Conversation flow ✅
│   ├── API integration ✅
│   └── Cost tracking ✅
│
├── VoiceConfirmationModal (REUSE - render inline in chat)
└── VoiceClarificationFlow (REUSE - render inline in chat)
```

**Key Design Decision**: Chat messages are **ephemeral** (local React state). History resets on page refresh. This avoids:
- New conversation persistence API
- Database schema changes
- Conversation cleanup logic
- Multi-device sync complexity

Conversation context is still tracked server-side for the duration of the interaction via existing `conversation_id` in `GeminiIntentService`.

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Voice Command Center Screen                                 │
│  src/app/(authenticated)/voice/page.tsx                      │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│  useVoiceConversation Hook                                   │
│  src/hooks/use-voice-conversation.ts                         │
│  • Manages message history                                   │
│  • Controls STT/TTS                                           │
│  • Handles conversation flow                                 │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│  Voice Command API                                           │
│  src/app/api/voice/command/route.ts                          │
│  • Receives transcript + conversation_id                     │
│  • Routes to GeminiIntentService                             │
│  • Returns intent + entities + follow_up                     │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│  GeminiIntentService                                         │
│  src/domains/intent/services/gemini-intent.service.ts        │
│  • Classifies intent (check_in, transfer, etc.)             │
│  • Extracts entities (items, quantities, locations)          │
│  • Tracks conversation context                               │
│  • Determines if clarification needed                        │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│  InventoryVoiceOrchestrator                                  │
│  src/domains/inventory/services/inventory-voice-orchestrator │
│  • Resolves item names → IDs (fuzzy search)                  │
│  • Executes CRUD via domain services                         │
│  • Returns success/error messages                            │
└───────────────┬─────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│  Database (via RLS-protected repos)                          │
│  • inventory_items                                           │
│  • item_transactions (check-in/out)                          │
│  • jobs                                                       │
│  • locations                                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Implementation Steps

### Phase 1: Screen Setup (30 min)
- [ ] Create `/voice` route under authenticated layout
- [ ] Add navigation links:
  - Side nav: "Voice Assistant" with 🎤 icon
  - Supervisor dashboard: "Voice" button
  - Crew nav: "Voice" option
- [ ] Build basic page scaffold with header

### Phase 2: Chat Interface (1 hour)
- [ ] Create `VoiceChatInterface` component
- [ ] Build message list with auto-scroll
- [ ] Implement message types:
  - UserMessage bubble (right-aligned, blue)
  - AssistantMessage bubble (left-aligned, gray)
  - ConfirmationCard (centered, yellow border)
  - SystemMessage (centered, italic)
- [ ] Add timestamp to messages
- [ ] Style chat for mobile (375px width)

### Phase 3: Voice Input (45 min)
- [ ] Create `LargeMicButton` component
  - 80px circle
  - 4 states (idle, recording, processing, disabled)
  - Ripple animation when active
- [ ] Create `StatusIndicator` component
  - Shows "Listening...", "Processing...", "Ready"
  - Visual waveform during recording
- [ ] Integrate Web Speech API for STT
- [ ] Add TTS playback for assistant messages

### Phase 4: Conversation Logic (1 hour)
- [ ] Build `useVoiceConversation` hook
- [ ] Implement message state management
- [ ] Add conversation flow:
  - Initial command → clarification → confirmation → action
- [ ] Handle conversation context (turn tracking)
- [ ] Auto-scroll to latest message
- [ ] Auto-start mic after assistant questions

### Phase 5: Simplified Context Header (15 min)
- [ ] **SIMPLIFIED**: Reuse existing TenantBadge component
- [ ] Add "Voice Commands Enabled ✅" indicator
- [ ] Show current user role (supervisor/crew)
- [ ] Add "What can I ask?" help tooltip
- [ ] **NO new APIs** - use existing tenant context from auth

### Phase 6: Integration & Testing (1 hour)
- [ ] Wire up to existing voice API endpoints
- [ ] Test full conversation flows:
  - Simple check-in (high confidence)
  - Transfer with clarifications
  - Error handling (item not found)
  - Unclear responses
- [ ] Add loading states
- [ ] Add error handling UI
- [ ] Test on mobile viewport

---

## 🗺️ Navigation Updates

### Feature Flag Gating
```typescript
// In MobileNavigation component
import { isVoiceCommandsEnabled } from '@/lib/features/flags';

const showVoiceLink = await isVoiceCommandsEnabled(context);

{showVoiceLink && (
  <NavLink href="/voice" icon={Mic}>
    Voice Assistant
  </NavLink>
)}
```

### Update Points
1. **Side Navigation** (`src/components/navigation/MobileNavigation.tsx`)
   - Add "Voice Assistant" link with 🎤 icon
   - Gate by `voice_commands_enabled` feature flag
   - Position between "Jobs" and "Reports"
   - Add analytics tracking: `track('voice_nav_clicked')`

2. **Supervisor Dashboard** (`src/app/supervisor/page.tsx`)
   - Change "Materials" button to "Voice" button
   - Route: `/voice` (instead of `/supervisor/materials`)
   - Icon: `Mic` (instead of `Package`)
   - Gate by feature flag

3. **Crew Navigation**
   - Add to crew menu if voice is enabled
   - Same feature flag check
   - Analytics tracking

### Analytics Events
```typescript
// Track adoption
analytics.track('voice_center_opened', {
  source: 'supervisor_dashboard' | 'side_nav' | 'crew_menu',
  user_role: context.role,
  tenant_id: context.tenantId
});
```

---

## ♿ Accessibility & Fallbacks

### Microphone Access Denied
```typescript
// Detect permission denial
navigator.permissions.query({ name: 'microphone' }).then((result) => {
  if (result.state === 'denied') {
    showFallbackUI();
  }
});
```

**Fallback UI**:
- Show text input field when mic is unavailable
- Display: "Microphone not available. Type your command below:"
- Allow keyboard-only interaction
- Show clear error message with browser instructions

### Keyboard Navigation
- **Tab**: Cycle through mic button → Yes/No buttons → text input
- **Enter**: Activate mic or submit text
- **Escape**: Cancel current operation
- **Space**: Toggle mic recording

### Touch Alternatives
- Large tap targets (80px mic button)
- Yes/No buttons (minimum 48px height)
- Swipe to dismiss modals
- Long-press mic for continuous recording

### Disabled States
```jsx
<VoiceFloatingButton
  disabled={!isMicrophoneAvailable || isProcessing}
  fallbackMode="text"
  aria-label="Start voice command (or type below)"
/>

{!isMicrophoneAvailable && (
  <div className="fallback-input">
    <input
      type="text"
      placeholder="Type your command here..."
      onSubmit={handleTextCommand}
    />
  </div>
)}
```

### Screen Reader Support
- Announce conversation state changes
- Read assistant responses aloud (via TTS)
- Announce when mic starts/stops
- Label all interactive elements

---

## 🧪 Testing Plan

### Unit Tests
- [ ] Chat message rendering (all types)
- [ ] Auto-scroll behavior
- [ ] Message state management
- [ ] Mic button state transitions
- [ ] Fallback text input

### Integration Tests
- [ ] Full conversation flow (3+ turns)
- [ ] Confirmation loop (voice + button)
- [ ] Error handling (API failures)
- [ ] Cost tracking (verify no duplication)

### Playwright E2E Tests
**New test file**: `tests/e2e/voice-command-center.test.ts`

```typescript
test.describe('Voice Command Center', () => {
  test('should display chat interface', async ({ page }) => {
    await page.goto('/voice');
    await expect(page.locator('.chat-interface')).toBeVisible();
    await expect(page.locator('.mic-button')).toBeVisible();
  });

  test('should handle text input fallback', async ({ page, context }) => {
    // Deny microphone permission
    await context.grantPermissions([], { origin: page.url() });

    await page.goto('/voice');
    await expect(page.locator('input[placeholder*="Type"]')).toBeVisible();

    await page.fill('input[placeholder*="Type"]', 'Check in 5 hammers');
    await page.press('input[placeholder*="Type"]', 'Enter');

    await expect(page.locator('.chat-message').last()).toContainText('hammers');
  });

  test('should auto-scroll to latest message', async ({ page }) => {
    // Fill chat with multiple messages
    for (let i = 0; i < 10; i++) {
      await simulateMessage(page, `Message ${i}`);
    }

    const lastMessage = page.locator('.chat-message').last();
    await expect(lastMessage).toBeInViewport();
  });

  test('should handle confirmation by button click', async ({ page }) => {
    await page.goto('/voice');

    // Simulate full conversation leading to confirmation
    await simulateConversation(page);

    // Click Yes button
    await page.click('button:has-text("Yes")');

    // Verify success message
    await expect(page.locator('.success-message')).toBeVisible();
  });

  test('should prevent concurrent mic sessions', async ({ page }) => {
    await page.goto('/voice');

    // Start mic
    await page.click('.mic-button');
    await expect(page.locator('.mic-button[data-state="recording"]')).toBeVisible();

    // Try to start again - should be disabled
    await expect(page.locator('.mic-button')).toBeDisabled();
  });

  test('should cleanup on unmount', async ({ page }) => {
    await page.goto('/voice');
    await page.click('.mic-button'); // Start recording

    await page.goto('/supervisor'); // Navigate away

    // Verify mic was stopped (check via console logs or network)
  });
});
```

### Manual Testing Checklist
- [ ] Mic permission denied → shows text input
- [ ] Keyboard-only navigation works
- [ ] Screen reader announces messages
- [ ] Mobile touch targets are large enough
- [ ] Conversation survives network blip
- [ ] Multiple tabs don't conflict
- [ ] Page unmount stops mic

---

## 🚀 Deployment Timeline & Rollout

### Build Timeline (Updated)
- **Day 1**: Phase 1-2 (Screen + Chat) - 2 hours
- **Day 2**: Phase 3-4 (Voice + Logic) - 2 hours
- **Day 3**: Phase 5-6 (Polish + Testing) - 2 hours
- **Day 4**: E2E tests + bug fixes - 2 hours
- **Day 5**: Documentation + code review - 1 hour

**Total**: ~9 hours (reduced from original 4.5 by reusing existing components)

### Rollout Sequence

#### Stage 1: Internal Testing (Week 1)
```sql
-- Enable only for internal test users
UPDATE tenants
SET settings = jsonb_set(
  settings,
  '{features,voice_command_center_enabled}',
  'false' -- Initially disabled, separate from voice_commands_enabled
)
WHERE id = '550e8400-e29b-41d4-a716-446655440000';
```

**Criteria to advance**:
- [ ] No console errors
- [ ] Mic permissions work correctly
- [ ] Text fallback works
- [ ] Auto-scroll works
- [ ] 10+ successful conversations
- [ ] Cost tracking accurate

#### Stage 2: Pilot Users (Week 2)
- Enable `voice_command_center_enabled` for pilot tenant
- Keep floating buttons on inventory/crew pages
- Monitor which interface users prefer
- Collect feedback: chat vs. modal UX

**Metrics to track**:
- Page views: `/voice`
- Conversation completion rate
- Average turns per conversation
- Text fallback usage %
- Mic permission denial rate

#### Stage 3: Gradual Rollout (Week 3+)
**Only after**:
- ✅ Pilot feedback positive
- ✅ Floating button usage data collected
- ✅ No critical bugs
- ✅ Cost per command stays <$0.02

**Then**:
- Enable for all supervisors (opt-in)
- Add to crew dashboard
- Deprecate floating buttons (or keep as quick-action alternative)
- Update onboarding to showcase voice center

### Feature Flag Strategy
```typescript
// Two separate flags:
1. voice_commands_enabled: true
   - Controls API access (/api/voice/*)
   - Required for ALL voice features

2. voice_command_center_enabled: false (initially)
   - Controls /voice page visibility
   - Separate rollout from floating buttons
   - Allows A/B testing: chat UI vs. modal UI
```

---

## 🎨 Message Styling

### User Message
```jsx
<div className="flex justify-end mb-4">
  <div className="max-w-[80%] bg-blue-600 text-white rounded-lg p-3 shadow">
    <p className="text-sm">Check in 5 hammers</p>
    <span className="text-xs text-blue-200">10:23 AM</span>
  </div>
</div>
```

### Assistant Message
```jsx
<div className="flex justify-start mb-4">
  <div className="max-w-[80%] bg-gray-700 text-white rounded-lg p-3 shadow">
    <div className="flex items-center gap-2 mb-1">
      <span className="text-lg">🤖</span>
      <span className="text-xs text-gray-400">Gemini Assistant</span>
    </div>
    <p className="text-sm">Which job are these hammers from?</p>
    <span className="text-xs text-gray-400">10:23 AM</span>
  </div>
</div>
```

### Confirmation Card
```jsx
<div className="flex justify-center mb-4">
  <div className="w-full max-w-sm bg-yellow-900 bg-opacity-20 border-2 border-yellow-600 rounded-lg p-4">
    <h3 className="text-sm font-semibold text-yellow-400 mb-2">
      Confirm Action
    </h3>
    <div className="space-y-1 text-sm text-white mb-3">
      <div>• 5 hammers</div>
      <div>• From job 123</div>
      <div>• To warehouse</div>
    </div>
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs text-gray-400">Confidence:</span>
      <span className="text-sm font-semibold text-green-400">95%</span>
    </div>
    <div className="flex gap-2">
      <button className="flex-1 bg-red-600 hover:bg-red-700 py-2 rounded">
        No
      </button>
      <button className="flex-1 bg-green-600 hover:bg-green-700 py-2 rounded">
        Yes
      </button>
    </div>
  </div>
</div>
```

### Success Message
```jsx
<div className="flex justify-center mb-4">
  <div className="bg-green-900 bg-opacity-20 border border-green-600 rounded-lg p-3 max-w-sm">
    <div className="flex items-center gap-2">
      <span className="text-xl">✅</span>
      <p className="text-sm text-green-400">
        Checked in 5 items (hammers) from job 123 to warehouse.
      </p>
    </div>
  </div>
</div>
```

---

## 🧪 Example Conversations

### Conversation 1: Simple Check-In
```
User: "Check in 5 hammers from job 123"
Assistant: [Confirmation Card]
           Confirm check-in:
           • 5 hammers
           • From job 123
           • To warehouse
           Confidence: 95%
           [Yes] [No]
User: [Clicks Yes]
System: ✅ Checked in 5 items (hammers) from job 123 to warehouse.
```

### Conversation 2: Multi-Turn Clarification
```
User: "Transfer the ladder"
Assistant: "Where should I transfer the ladder from?"
          [Mic auto-starts]
User: "From truck 5"
Assistant: "And where to?"
          [Mic auto-starts]
User: "To warehouse"
Assistant: [Confirmation Card]
           Confirm transfer:
           • 1 ladder
           • From truck 5
           • To warehouse
           Confidence: 90%
           [Yes] [No]
User: [Says "yes" via voice]
System: ✅ Transferred 1 item (ladder) from truck 5 to warehouse.
```

### Conversation 3: Error Handling
```
User: "Check in unicorns from job 999"
Assistant: "I couldn't find 'unicorns' in inventory. Did you mean:
           • Wrench
           • Hammer
           • Ladder
           Please try again."
```

---

## 🔧 Configuration

### Feature Flag
```sql
-- Already exists in database
SELECT settings->'features'->>'voice_commands_enabled'
FROM tenants
WHERE id = '550e8400-e29b-41d4-a716-446655440000';
-- Returns: true
```

### Context Awareness
```typescript
// Database context provided to Gemini
{
  availableTables: ['inventory_items', 'jobs', 'locations', 'item_transactions'],
  recentItems: ['hammer', 'ladder', 'shovel'], // Top 10 most used
  activeJobs: ['123', '456', '789'], // Today's jobs
  locations: ['warehouse', 'truck 5', 'truck 12'],
  userRole: 'supervisor',
  tenantId: '550e8400-e29b-41d4-a716-446655440000'
}
```

---

## 📊 Success Metrics

### UX Metrics
- **Time to Complete Action**: <30 seconds (including clarifications)
- **Clarification Rate**: <15% of commands need clarification
- **Success Rate**: >90% of commands execute successfully
- **User Satisfaction**: Collect in-app feedback

### Technical Metrics
- **Cost per Command**: <$0.02 (currently $0.015)
- **Response Time**: <3 seconds from speech to assistant response
- **STT Accuracy**: >95% (via Web Speech API)
- **Intent Classification Accuracy**: >90% (Gemini Flash)

---

## 🚀 Rollout Plan

### Week 1: Build
- Day 1-2: Screen setup + chat interface
- Day 3: Voice input + conversation logic
- Day 4: Database context + integration
- Day 5: Testing + bug fixes

### Week 2: Pilot
- Enable for 2-3 internal users
- Collect feedback
- Iterate on UX
- Refine Gemini prompts

### Week 3: Rollout
- Enable for all supervisors (opt-in)
- Monitor metrics
- Add help documentation
- Plan additional intents

---

## 📚 Related Documentation

- **Existing Components**: `docs/voice-to-crud-ui-integration-guide.md`
- **Test Summary**: `docs/voice-to-crud-test-summary.md`
- **API Endpoints**:
  - `/api/voice/command` - Intent classification
  - `/api/voice/confirm` - Confirmation processing
- **Services**:
  - `GeminiIntentService` - Intent analysis
  - `GeminiConfirmationService` - Yes/no processing
  - `InventoryVoiceOrchestrator` - CRUD execution

---

**Next Steps**: Review this plan, get approval, then begin implementation in Phase 1.
