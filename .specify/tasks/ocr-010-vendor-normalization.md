# Task: Vendor Normalization Service

**Slug:** `ocr-010-vendor-normalization`
**Priority:** Medium
**Size:** 1 PR

## Description
Create service for fuzzy matching vendor names and managing aliases with location awareness.

## Files to Create
- `src/domains/vendor/services/vendor-normalization-service.ts`
- `src/domains/vendor/utils/fuzzy-matcher.ts`
- `src/domains/vendor/repositories/vendor-alias.repository.ts`

## Files to Modify
- None (new service)

## Acceptance Criteria
- [ ] Fuzzy matches vendor names >80% similarity
- [ ] Creates/updates vendor aliases
- [ ] Suggests vendors by GPS location
- [ ] Handles common variations (The, Inc, LLC)
- [ ] Learns from user corrections
- [ ] Merges duplicate vendors
- [ ] Respects company scope
- [ ] Commit and push after implementation

## Test Files
**Create:** `src/__tests__/domains/vendor/services/vendor-normalization-service.test.ts`

Test cases:
- `normalizes vendor variants`
  - Input: "The Home Depot"
  - Match: "HOME DEPOT #123"
  - Assert same vendor_id
  
- `creates alias on new variant`
  - Unknown: "HD Supply"
  - User selects: "Home Depot"
  - Assert alias created
  
- `suggests by location`
  - GPS near Home Depot
  - OCR text ambiguous
  - Assert suggests Home Depot first
  
- `respects similarity threshold`
  - Input: "Walmart"
  - Don't match: "Walgreens"
  - Assert no match <80%

**Create:** `src/__tests__/domains/vendor/utils/fuzzy-matcher.test.ts`

Test cases:
- `calculates edit distance`
- `handles case variations`
- `strips common suffixes`

## Dependencies
- `ocr-001-vendors-table-check` - Vendors table
- `ocr-003-ocr-dependent-tables` - Alias tables

## Service Interface
```typescript
interface VendorNormalizationService {
  normalizeVendorName(
    rawName: string,
    location?: { lat: number; lng: number }
  ): Promise<NormalizationResult>;
  
  createAlias(
    vendorId: string,
    aliasName: string,
    type: 'ocr_variant' | 'abbreviation'
  ): Promise<void>;
  
  suggestByLocation(
    lat: number,
    lng: number,
    radius: number
  ): Promise<Vendor[]>;
  
  mergeVendors(
    primaryId: string,
    duplicateId: string
  ): Promise<void>;
}

interface NormalizationResult {
  vendorId?: string;
  vendorName?: string;
  confidence: number;
  isNew: boolean;
  suggestions: VendorMatch[];
}
```

## Fuzzy Matching Rules
- Remove "The" prefix
- Remove suffixes: Inc, LLC, Corp, Ltd
- Normalize spaces/punctuation
- Use Levenshtein distance
- Weight by usage frequency

## Rollback
- Disable auto-matching
- Manual vendor selection only