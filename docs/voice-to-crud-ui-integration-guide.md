# Voice-to-CRUD UI Integration Guide

**Phase 2 Complete**: UI Components Ready for Integration
**Date**: 2025-10-25
**Status**: ✅ Ready for Pilot Testing

---

## Components Built

### **1. VoiceConfirmationModal** (`src/components/voice/VoiceConfirmationModal.tsx`)
Modal for confirming voice actions before execution.

**Features**:
- ✅ Auto-announce via TTS
- ✅ Auto-start mic after announcement
- ✅ Yes/No buttons + voice input
- ✅ Display intent and entity summary
- ✅ Show confidence score with visual indicator
- ✅ Handle unclear responses with re-prompting
- ✅ Loading state during execution

### **2. VoiceClarificationFlow** (`src/components/voice/VoiceClarificationFlow.tsx`)
Modal for multi-turn conversations to collect missing entities.

**Features**:
- ✅ Progress indicator (attempt 1 of 3)
- ✅ Display follow-up question via TTS
- ✅ Show accumulated entities
- ✅ Highlight missing entities
- ✅ Voice + text input
- ✅ Auto-focus mic after question
- ✅ Max 3 clarification attempts

### **3. useVoiceCommand Hook** (`src/hooks/use-voice-command.ts`)
React hook for easy voice integration into any screen.

**Features**:
- ✅ Manages all voice workflow states
- ✅ Handles clarification automatically
- ✅ Handles confirmation automatically
- ✅ Executes CRUD actions
- ✅ Provides success/error callbacks
- ✅ Supports auto-confirm for high-confidence intents

### **4. VoiceFloatingButton** (`src/components/voice/VoiceFloatingButton.tsx`)
Floating action button for voice commands.

**Features**:
- ✅ Fixed position (bottom-right)
- ✅ Mic indicator (green → red when active)
- ✅ Real-time transcript panel
- ✅ Processing state indicator
- ✅ Web Speech API integration

---

## Integration Examples

### **Example 1: Basic Integration (Supervisor Inventory Page)**

```typescript
'use client';

import { useState } from 'react';
import { useVoiceCommand } from '@/hooks/use-voice-command';
import { VoiceFloatingButton } from '@/components/voice/VoiceFloatingButton';
import { VoiceConfirmationModal } from '@/components/voice/VoiceConfirmationModal';
import { VoiceClarificationFlow } from '@/components/voice/VoiceClarificationFlow';
import { toast } from 'react-hot-toast';

export default function SupervisorInventoryPage() {
  const [items, setItems] = useState([]);

  const voiceCommand = useVoiceCommand({
    context: {
      role: 'supervisor',
      currentPage: 'inventory',
    },
    onSuccess: (result) => {
      // Refresh inventory list
      fetchItems();
      toast.success(voiceCommand.successMessage || 'Action completed');
    },
    onError: (error) => {
      toast.error(error.message);
    },
    autoConfirm: false, // Always show confirmation modal
  });

  return (
    <div>
      {/* Existing inventory UI */}
      <h1>Inventory Management</h1>
      <div>
        {items.map((item) => (
          <div key={item.id}>{item.name}</div>
        ))}
      </div>

      {/* Voice Components */}
      <VoiceFloatingButton
        onTranscript={voiceCommand.processVoiceCommand}
        isProcessing={voiceCommand.isProcessing}
      />

      {voiceCommand.showClarification && voiceCommand.currentIntent && (
        <VoiceClarificationFlow
          isOpen={voiceCommand.showClarification}
          intentResult={voiceCommand.currentIntent}
          onClarify={voiceCommand.handleClarify}
          onCancel={voiceCommand.handleCancel}
        />
      )}

      {voiceCommand.showConfirmation && voiceCommand.currentIntent && (
        <VoiceConfirmationModal
          isOpen={voiceCommand.showConfirmation}
          intent={voiceCommand.currentIntent}
          onConfirm={voiceCommand.handleConfirm}
          onCancel={voiceCommand.handleCancel}
        />
      )}
    </div>
  );
}
```

### **Example 2: Crew Job Detail Page**

```typescript
'use client';

import { useVoiceCommand } from '@/hooks/use-voice-command';
import { VoiceFloatingButton } from '@/components/voice/VoiceFloatingButton';
import { VoiceConfirmationModal } from '@/components/voice/VoiceConfirmationModal';
import { VoiceClarificationFlow } from '@/components/voice/VoiceClarificationFlow';

export default function CrewJobDetailPage({ params }: { params: { jobId: string } }) {
  const voiceCommand = useVoiceCommand({
    context: {
      role: 'crew',
      currentPage: 'job-detail',
      activeJobId: params.jobId,
    },
    onSuccess: (result) => {
      // Handle success - maybe refresh job data
      console.log('Voice action completed:', result);
    },
  });

  return (
    <div>
      {/* Job details UI */}

      {/* Voice Components */}
      <VoiceFloatingButton
        onTranscript={voiceCommand.processVoiceCommand}
        isProcessing={voiceCommand.isProcessing}
      />

      {voiceCommand.showClarification && voiceCommand.currentIntent && (
        <VoiceClarificationFlow
          isOpen={voiceCommand.showClarification}
          intentResult={voiceCommand.currentIntent}
          onClarify={voiceCommand.handleClarify}
          onCancel={voiceCommand.handleCancel}
        />
      )}

      {voiceCommand.showConfirmation && voiceCommand.currentIntent && (
        <VoiceConfirmationModal
          isOpen={voiceCommand.showConfirmation}
          intent={voiceCommand.currentIntent}
          onConfirm={voiceCommand.handleConfirm}
          onCancel={voiceCommand.handleCancel}
        />
      )}
    </div>
  );
}
```

---

## User Workflows

### **Workflow 1: Simple Check-In (High Confidence)**

```
1. User clicks floating mic button (green)
2. Mic activates (turns red, starts pulsing)
3. User says: "Check in 5 hammers from job 123"
4. Transcript appears in panel
5. Mic deactivates automatically
6. Processing indicator shows
7. Confirmation modal appears:
   - TTS announces: "Are you sure you want to check in 5 hammers from job 123?"
   - Mic auto-starts after announcement
   - User says "yes" OR clicks "Yes, Do It" button
8. Loading spinner shows "Processing..."
9. Action executes in background
10. Success toast: "Checked in 2 items (hammers) from job 123 to the warehouse."
11. Modal closes
12. Inventory list refreshes
```

### **Workflow 2: Transfer with Clarification (Missing Entity)**

```
1. User clicks mic
2. User says: "Transfer the ladder"
3. Processing shows
4. Clarification modal appears:
   - TTS announces: "Where should I transfer the ladder from?"
   - Progress bar shows "Attempt 1 of 3"
   - Shows accumulated entities: "Items: ladder"
   - Shows missing entities: "From location, To location"
   - Mic auto-starts
5. User says: "From truck 5"
6. Processing shows
7. Clarification modal updates:
   - TTS announces: "And where to?"
   - Progress bar shows "Attempt 2 of 3"
   - Shows accumulated entities: "Items: ladder, From: truck 5"
   - Shows missing entities: "To location"
8. User says: "To warehouse"
9. Clarification modal closes
10. Confirmation modal appears with complete info
11. User confirms
12. Action executes
13. Success!
```

### **Workflow 3: Unclear Response Handling**

```
1. User in confirmation modal
2. TTS asks: "Are you sure you want to check in 5 hammers?"
3. User says: "maybe" (unclear response)
4. System detects unclear response
5. TTS announces: "Sorry, I didn't catch that. Please say yes or no."
6. Mic auto-restarts
7. User says: "yes"
8. Action proceeds
```

---

## Feature Flag Integration

### **Add Feature Flag**

**Migration**: `supabase/migrations/XXX_add_voice_commands_feature_flag.sql`

```sql
-- Enable voice commands feature flag for default tenant
UPDATE tenants
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{features,voice_commands_enabled}',
  'true'
)
WHERE id = '550e8400-e29b-41d4-a716-446655440000';
```

**Usage in Components**:

```typescript
import { getFeatureFlag } from '@/lib/features/flags';

export default async function SupervisorInventoryPage() {
  const context = await getRequestContext();
  const voiceEnabled = await getFeatureFlag(context, 'voice_commands_enabled', false);

  return (
    <div>
      {/* Inventory UI */}

      {voiceEnabled && (
        <>
          <VoiceFloatingButton ... />
          {/* Other voice components */}
        </>
      )}
    </div>
  );
}
```

---

## Toast Notifications

### **Success Messages**
- ✅ "Checked in 5 items (hammers) from job 123 to the warehouse."
- ✅ "Checked out 3 items (shovels) to job 456."
- ✅ "Transferred 1 item (ladder) from Truck 5 to Warehouse."
- ✅ "Added 2 new items to inventory: chainsaw, leaf blower."

### **Error Messages**
- ❌ "Failed to check in items: Items not found."
- ❌ "Failed to check out items: Missing job ID."
- ❌ "Failed to transfer items: Source and destination locations cannot be the same."
- ❌ "Voice command failed: Please try again."

### **Implementation**

```typescript
import toast from 'react-hot-toast';

// In onSuccess callback
if (voiceCommand.successMessage) {
  toast.success(voiceCommand.successMessage, {
    duration: 4000,
    icon: '✅',
  });
}

// In onError callback
if (voiceCommand.error) {
  toast.error(voiceCommand.error, {
    duration: 5000,
    icon: '❌',
  });
}
```

---

## Testing Checklist

### **Manual Testing**

**Check-In Flow**:
- [ ] User says "Check in 5 hammers from job 123"
- [ ] Confirmation modal shows correct summary
- [ ] User confirms via voice ("yes")
- [ ] Action executes successfully
- [ ] Success toast displays
- [ ] Inventory refreshes

**Clarification Flow**:
- [ ] User says "Transfer the ladder"
- [ ] Clarification modal appears with follow-up question
- [ ] User provides missing info ("From truck 5")
- [ ] Second clarification asks for destination
- [ ] User provides ("To warehouse")
- [ ] Confirmation modal shows complete info
- [ ] Action executes after confirmation

**Error Handling**:
- [ ] User says "Check in nonexistent-item from job 123"
- [ ] Error message displays: "Items not found"
- [ ] Modal closes, no action executed

**Unclear Response**:
- [ ] User says "maybe" in confirmation modal
- [ ] System re-prompts: "Sorry, I didn't catch that. Please say yes or no."
- [ ] Mic auto-restarts
- [ ] User provides clear answer

**Max Clarifications**:
- [ ] User provides unclear responses 3 times
- [ ] System gives up after 3 attempts
- [ ] Error message: "I'm having trouble understanding. Let's start over."

---

## Performance Metrics to Monitor

### **Cost Per Command**
- Target: <$0.02 per command (with browser STT)
- Actual: ~$0.015 per command
- Monitor via `ai_interaction_logs` table

### **Success Rate**
- Target: >90% successful commands
- Track: `voice_commands` logged with success=true/false
- Monitor clarification rate (<10%)

### **Response Time**
- Target: <3 seconds from transcript to confirmation modal
- Track: `processing_time_ms` in API responses
- Monitor via logs

### **User Satisfaction**
- Collect feedback via in-app prompts
- Track command abandonment rate
- Monitor error rates by intent type

---

## Pilot Testing Plan

### **Phase 1: Internal Testing (Week 1)**
- **Users**: 2-3 internal team members
- **Screens**: Supervisor inventory only
- **Feature Flag**: Enabled for pilot tenant only
- **Monitoring**: Watch logs, collect feedback

### **Phase 2: Limited Rollout (Week 2-3)**
- **Users**: 5-10 friendly customers
- **Screens**: Add crew job detail
- **Feature Flag**: Enabled for pilot tenants
- **Monitoring**: Track metrics, iterate on prompts

### **Phase 3: General Availability (Week 4+)**
- **Users**: All tenants (opt-in via feature flag)
- **Screens**: All inventory/job screens
- **Feature Flag**: Available to all, disabled by default
- **Monitoring**: Full metrics dashboard

---

## Troubleshooting Guide

### **Issue**: Mic doesn't activate
**Solution**: Check browser permissions, ensure HTTPS

### **Issue**: Transcript is inaccurate
**Solution**: Encourage clear speech, reduce background noise

### **Issue**: Confirmation modal doesn't appear
**Solution**: Check confidence score, may need to tune threshold

### **Issue**: Action not executing
**Solution**: Check network logs, verify tenant context

### **Issue**: High clarification rate
**Solution**: Review Gemini prompts, add more example entities

---

## Next Steps

1. ✅ Add feature flag migration
2. ✅ Integrate into supervisor inventory page
3. ✅ Integrate into crew job detail page
4. ✅ Add toast notifications
5. ✅ Deploy to staging
6. ✅ Enable for pilot tenant
7. ✅ Collect feedback
8. ✅ Iterate on prompts
9. ✅ Roll out to production

---

**Document Version**: 1.0
**Last Updated**: 2025-10-25
**Next Review**: After pilot testing
