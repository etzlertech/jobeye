# Task: Voice Entity Resolver

**Slug:** `voice-003-entity-resolver`
**Priority:** High
**Size:** 1 PR

## Description
Implement fuzzy matching and disambiguation for customer, property, and service type entities in voice commands.

## Files to Create
- `src/domains/voice/services/entity-resolver.ts`
- `src/domains/voice/utils/fuzzy-matcher.ts`
- `src/domains/voice/models/resolution-context.ts`

## Files to Modify
- `src/domains/job/services/job-from-voice-service.ts` - Integrate resolver

## Acceptance Criteria
- [ ] Fuzzy matches entity names with >80% similarity
- [ ] Uses recent job context for disambiguation
- [ ] Prompts for clarification when multiple matches
- [ ] Learns from user corrections
- [ ] Caches resolution patterns
- [ ] Handles phonetic variations (e.g., "Smith" vs "Smythe")

## Test Files
**Create:** `src/__tests__/domains/voice/services/entity-resolver.test.ts`

Test cases:
- `resolves exact matches`
  - Input: "John Smith"
  - Database has "John Smith"
  - Assert exact match found
  
- `fuzzy matches similar names`
  - Input: "Jon Smythe"
  - Database has "John Smith"
  - Assert match with >80% similarity
  
- `disambiguates using context`
  - Input: "Smith property"
  - Multiple Smiths in database
  - Recent job for "123 Main St Smith"
  - Assert resolves to recent customer
  
- `prompts for multiple matches`
  - Input: "Johnson"
  - Database has 3 Johnsons
  - Assert returns disambiguation prompt
  - Assert includes all options

**Create:** `src/__tests__/domains/voice/utils/fuzzy-matcher.test.ts`

Test cases:
- `calculates Levenshtein distance`
- `handles phonetic matching`
- `weights word order appropriately`

## Dependencies
- NPM: `fuse.js` for fuzzy search
- Existing: Customer/Property repositories

## Resolution Flow
```typescript
interface ResolutionResult {
  type: 'exact' | 'fuzzy' | 'multiple' | 'none';
  matches: EntityMatch[];
  confidence: number;
  disambiguationPrompt?: string;
}

interface EntityMatch {
  id: string;
  type: 'customer' | 'property' | 'service';
  name: string;
  similarity: number;
  context?: {
    lastJobDate?: Date;
    jobCount?: number;
  };
}
```

## Context Weighting
- Recent activity: +20% confidence
- Frequency: +10% for top 20% most serviced
- Geographic proximity: +15% if nearby current location