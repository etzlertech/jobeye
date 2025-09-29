# Task: Receipt Entity Extraction Service

**Slug:** `ocr-008-receipt-extractor`
**Priority:** High
**Size:** 1 PR

## Description
Create service to extract structured data from OCR text for receipts and invoices.

## Files to Create
- `src/domains/ocr/services/receipt-extraction-service.ts`
- `src/domains/ocr/parsers/receipt-parser.ts`
- `src/domains/ocr/parsers/invoice-parser.ts`
- `src/domains/ocr/utils/currency-detector.ts`

## Files to Modify
- None (new service)

## Acceptance Criteria
- [ ] Extracts vendor name with normalization
- [ ] Parses dates in multiple formats
- [ ] Detects currency (USD default)
- [ ] Extracts line items with qty/price
- [ ] Calculates and validates totals
- [ ] Identifies tax amounts
- [ ] Provides field-level confidence
- [ ] Commit and push after implementation

## Test Files
**Create:** `src/__tests__/domains/ocr/services/receipt-extraction-service.test.ts`

Test cases:
- `extracts receipt fields`
  - Input: OCR text from receipt
  - Assert vendor = "HOME DEPOT"
  - Assert date parsed correctly
  - Assert total = sum(items) + tax
  
- `handles multiple date formats`
  - Test MM/DD/YYYY
  - Test DD-MM-YY
  - Test "Jan 15, 2024"
  - Assert all parse correctly
  
- `extracts line items`
  - Parse multi-line items
  - Assert description, qty, price
  - Assert extended price calculated
  
- `detects currency`
  - Test $, USD, dollars
  - Test €, EUR, euros
  - Assert correct currency code

**Create:** `src/__tests__/domains/ocr/parsers/receipt-parser.test.ts`

Test cases:
- `parses various receipt formats`
- `handles missing fields gracefully`
- `validates arithmetic`

## Dependencies
- None (processes OCR text)

## Extraction Patterns
```typescript
interface ExtractionPatterns {
  vendor: RegExp[];
  date: RegExp[];
  lineItem: RegExp;
  tax: RegExp[];
  total: RegExp[];
  currency: RegExp[];
}

interface ExtractedReceipt {
  vendor: { value: string; confidence: number };
  date: { value: Date; confidence: number };
  currency: string;
  lineItems: ExtractedLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  confidence: number; // Overall
}
```

## Rollback
- Manual entry fallback
- Show raw OCR text