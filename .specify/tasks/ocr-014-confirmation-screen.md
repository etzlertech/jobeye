# Task: OCR Confirmation Screen

**Slug:** `ocr-014-confirmation-screen`
**Priority:** High
**Size:** 2 PRs

## Description
Create confirmation screen for reviewing and editing extracted OCR data with confidence indicators.

## Files to Create
- `src/components/ocr/confirmation/ocr-confirmation-modal.tsx`
- `src/components/ocr/confirmation/confidence-indicator.tsx`
- `src/components/ocr/confirmation/line-item-editor.tsx`
- `src/components/ocr/confirmation/field-editor.tsx`

## Files to Modify
- None (new components)

## Acceptance Criteria
- [ ] Shows original image with zoom
- [ ] Displays extracted fields with edit capability
- [ ] Color-codes confidence (green >0.8, yellow 0.5-0.8, red <0.5)
- [ ] Line item table with add/remove
- [ ] Validates totals match
- [ ] Vendor autocomplete from existing
- [ ] Confirm/Re-scan/Cancel actions
- [ ] Commit and push after implementation

## Test Files
**Create:** `src/__tests__/components/ocr/confirmation/ocr-confirmation-modal.test.tsx`

Test cases:
- `displays extracted data`
  - Pass OCR result
  - Assert all fields shown
  - Assert confidence colors
  
- `allows field editing`
  - Edit vendor name
  - Assert value updates
  - Assert marked as modified
  
- `validates totals`
  - Edit line item price
  - Assert total recalculated
  - Assert mismatch warning
  
- `saves edited data`
  - Make changes
  - Click confirm
  - Assert saves modified data

**Create:** `src/__tests__/components/ocr/confirmation/line-item-editor.test.tsx`

Test cases:
- `adds new line item`
- `removes line item`
- `calculates extended price`

## Dependencies
- Receipt extraction service output
- Vendor normalization service

## UI Layout
```
+----------------------------------+
| Review Extracted Data            |
+----------------------------------+
| [Image Preview]  | Vendor: HOME DEPOT ✓
|                  | Date: 01/15/24 ⚠️
| [Zoom +/-]       | Receipt #: 1234 ✓
|                  |
|                  | Items:
|                  | +-------------+---+-----+
|                  | | Description |Qty|Price|
|                  | +-------------+---+-----+
|                  | | Mulch       | 5 |$3.99|✓
|                  | | Shovel      | 1 |$15.99|⚠️
|                  | | [Add Item]  |   |     |
|                  | +-------------+---+-----+
|                  |
|                  | Subtotal: $35.94 ✓
|                  | Tax: $2.52 ✓
|                  | Total: $38.46 ✓
|                  |
| [Re-scan] [Cancel] [Confirm]     |
+----------------------------------+
```

## Confidence Indicators
```typescript
interface ConfidenceProps {
  value: number;
  size?: 'sm' | 'md' | 'lg';
}

// Colors:
// >0.8: green-500 ✓
// 0.5-0.8: yellow-500 ⚠️
// <0.5: red-500 ✗
```

## Rollback
- Skip confirmation
- Direct save with warnings