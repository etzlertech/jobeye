# Task: Handwritten Note Entity Extraction

**Slug:** `ocr-009-note-entity-extractor`
**Priority:** Medium
**Size:** 1 PR

## Description
Create service to extract entities from handwritten note OCR text including names, phones, and materials.

## Files to Create
- `src/domains/ocr/services/note-entity-extraction-service.ts`
- `src/domains/ocr/utils/phone-normalizer.ts`
- `src/domains/ocr/utils/material-quantity-parser.ts`

## Files to Modify
- None (new service)

## Acceptance Criteria
- [ ] Extracts customer names using patterns
- [ ] Normalizes phone numbers to E.164
- [ ] Identifies job IDs from context
- [ ] Parses material + quantity pairs
- [ ] Preserves unmatched text as remarks
- [ ] Handles misspellings/variations
- [ ] Returns confidence per entity
- [ ] Commit and push after implementation

## Test Files
**Create:** `src/__tests__/domains/ocr/services/note-entity-extraction-service.test.ts`

Test cases:
- `extracts customer names`
  - Input: "Call John Smith about job"
  - Assert extracts "John Smith"
  - Assert type = 'customer_name'
  
- `normalizes phone numbers`
  - Test "(555) 123-4567"
  - Test "555.123.4567"
  - Test "5551234567"
  - Assert all → "+15551234567"
  
- `parses material quantities`
  - Input: "Need 5 bags mulch"
  - Assert material = "mulch"
  - Assert quantity = 5
  - Assert unit = "bags"
  
- `preserves unknown text`
  - Input mixed entities
  - Assert known entities extracted
  - Assert remainder as remarks

## Dependencies
- None (processes OCR text)

## Entity Patterns
```typescript
interface EntityPatterns {
  customerName: RegExp[];
  phoneNumber: RegExp[];
  jobId: RegExp[];
  material: {
    pattern: RegExp;
    units: string[];
  };
  email: RegExp;
  address: RegExp[];
}

interface ExtractedEntity {
  type: EntityType;
  rawText: string;
  normalizedValue: string;
  confidence: number;
  position?: { start: number; end: number };
}
```

## Phone Normalization
```typescript
// Handles US phone numbers
// Input: Various formats
// Output: E.164 format (+1XXXXXXXXXX)
// Validates area codes
```

## Rollback
- Show raw text only
- Manual entity tagging