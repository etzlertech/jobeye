# Task: Document Event Router Service

**Slug:** `ocr-011-document-event-router`
**Priority:** Medium
**Size:** 1 PR

## Description
Create event router to generate domain events from processed OCR documents.

## Files to Create
- `src/domains/ocr/services/document-event-router.ts`
- `src/domains/ocr/events/ocr-events.ts`
- `src/lib/events/event-emitter.ts`

## Files to Modify
- None (new service)

## Acceptance Criteria
- [ ] Routes receipts → inventory consumption events
- [ ] Routes invoices → PO receipt events
- [ ] Routes notes → job note events
- [ ] Includes full context in events
- [ ] Validates data before routing
- [ ] Handles routing failures gracefully
- [ ] Logs all events for audit
- [ ] Commit and push after implementation

## Test Files
**Create:** `src/__tests__/domains/ocr/services/document-event-router.test.ts`

Test cases:
- `routes receipt to inventory`
  - Input: Processed receipt
  - Assert event type = 'inventory.consumption.recorded'
  - Assert line items included
  - Assert vendor/date present
  
- `routes invoice to PO`
  - Input: Invoice with PO#
  - Assert event type = 'purchase_order.received'
  - Assert PO number in payload
  
- `routes note to job`
  - Input: Note with job ID
  - Assert event type = 'job.note.created'
  - Assert entities included
  
- `handles missing data`
  - Input: Incomplete document
  - Assert validation error
  - Assert no event emitted

## Dependencies
- Event emitter infrastructure
- Domain event handlers

## Event Definitions
```typescript
interface InventoryConsumptionEvent {
  type: 'inventory.consumption.recorded';
  documentId: string;
  vendorId: string;
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    inventoryItemId?: string;
  }[];
  metadata: EventMetadata;
}

interface PurchaseOrderReceivedEvent {
  type: 'purchase_order.received';
  documentId: string;
  vendorId: string;
  poNumber: string;
  lineItems: POLineItem[];
  metadata: EventMetadata;
}

interface JobNoteCreatedEvent {
  type: 'job.note.created';
  documentId: string;
  jobId: string;
  entities: ExtractedEntity[];
  remarks: string;
  metadata: EventMetadata;
}
```

## Routing Rules
```typescript
// Route based on document type and content
if (doc.type === 'receipt' && doc.lineItems.length > 0) {
  emit('inventory.consumption.recorded', payload);
} else if (doc.type === 'invoice' && doc.poNumber) {
  emit('purchase_order.received', payload);
} else if (doc.type === 'note' && doc.jobId) {
  emit('job.note.created', payload);
}
```

## Rollback
- Disable event emission
- Queue for manual processing