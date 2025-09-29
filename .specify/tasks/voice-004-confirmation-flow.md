# Task: Voice Confirmation Flow

**Slug:** `voice-004-confirmation-flow`
**Priority:** Medium
**Size:** 1 PR

## Description
Build voice confirmation dialogues for job creation with natural language understanding of yes/no responses.

## Files to Create
- `src/domains/voice/services/confirmation-service.ts`
- `src/domains/voice/utils/response-parser.ts`
- `src/domains/voice/templates/confirmation-templates.ts`

## Files to Modify
- `src/domains/job/services/job-from-voice-service.ts` - Add confirmations

## Acceptance Criteria
- [ ] Generates natural confirmation prompts
- [ ] Understands various yes/no responses
- [ ] Allows corrections ("change the customer")
- [ ] Times out after 10s silence
- [ ] Supports partial confirmations
- [ ] Maintains conversation context

## Test Files
**Create:** `src/__tests__/domains/voice/services/confirmation-service.test.ts`

Test cases:
- `generates job confirmation prompt`
  - Input job details
  - Assert natural language summary
  - Assert includes all key fields
  
- `parses affirmative responses`
  - Test "yes", "yeah", "correct", "that's right"
  - Assert all parse as confirmation
  
- `parses negative responses`
  - Test "no", "nope", "incorrect", "change that"
  - Assert all parse as rejection
  
- `handles correction requests`
  - Response: "change the customer to Smith"
  - Assert extracts field and new value
  - Assert updates only that field

**Create:** `src/__tests__/domains/voice/utils/response-parser.test.ts`

Test cases:
- `extracts intent from response`
- `handles ambiguous responses`
- `identifies field corrections`

## Dependencies
- `voice-001-stt-service` - For listening
- `voice-002-tts-service` - For speaking

## Confirmation Templates
```typescript
// Example templates
export const CONFIRMATION_TEMPLATES = {
  job: {
    full: "I'll create a {service} job for {customer} at {property} on {date}. Is that correct?",
    field: "Did you say {value} for {field}?",
    correction: "What should the {field} be?",
    timeout: "I didn't hear a response. Should I create this job?"
  }
};

interface ConfirmationState {
  awaiting: 'full' | 'field' | 'correction' | null;
  context: any;
  attempts: number;
  timeout: NodeJS.Timeout | null;
}
```