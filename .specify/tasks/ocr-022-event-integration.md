# Task: Domain Event Generation for OCR

**Slug:** `ocr-022-event-integration`
**Priority:** Medium
**Size:** 1 PR

## Description
Generate and emit domain events from OCR document processing for downstream systems.

## Files to Create
- `src/domains/ocr/events/handlers/inventory-consumption-handler.ts`
- `src/domains/ocr/events/handlers/po-receipt-handler.ts`
- `src/domains/ocr/events/handlers/job-note-handler.ts`

## Files to Modify
- `src/domains/ocr/services/document-event-router.ts` - Emit events

## Acceptance Criteria
- [ ] Emits inventory.consumption.recorded for receipts
- [ ] Emits purchase_order.received for invoices
- [ ] Emits job.note.created for handwritten notes
- [ ] Includes full context in event payload
- [ ] Handlers update respective domains
- [ ] Events are transactional
- [ ] Failed events retry
- [ ] Commit and push after implementation

## Test Files
**Create:** `src/__tests__/domains/ocr/events/event-integration.test.ts`

Test cases:
- `receipt updates inventory`
  - Process receipt
  - Assert event emitted
  - Assert inventory updated
  - Assert quantities reduced
  
- `invoice updates PO`
  - Process invoice with PO#
  - Assert event emitted
  - Assert PO marked received
  - Assert line items matched
  
- `note updates job`
  - Process handwritten note
  - Assert event emitted
  - Assert note added to job
  - Assert entities linked

## Dependencies
- Document event router
- Event bus infrastructure
- Domain services

## Event Flow
```typescript
// 1. OCR completes
const document = await ocrProcessor.process(image);

// 2. Route to event
const event = await eventRouter.route(document);

// 3. Emit event
await eventBus.emit(event);

// 4. Handlers process
// InventoryConsumptionHandler
async handle(event: InventoryConsumptionEvent) {
  for (const item of event.items) {
    await inventoryService.recordConsumption({
      itemId: item.inventoryItemId,
      quantity: item.quantity,
      source: 'ocr_receipt',
      documentId: event.documentId
    });
  }
}

// POReceiptHandler  
async handle(event: PurchaseOrderReceivedEvent) {
  await purchaseOrderService.markReceived({
    poNumber: event.poNumber,
    receivedItems: event.lineItems,
    documentId: event.documentId
  });
}

// JobNoteHandler
async handle(event: JobNoteCreatedEvent) {
  await jobService.addNote({
    jobId: event.jobId,
    content: event.remarks,
    entities: event.entities,
    source: 'ocr_handwritten',
    documentId: event.documentId
  });
}
```

## Transactional Safety
- Wrap in database transaction
- Rollback on handler failure
- Idempotent handlers
- Event replay support

## Rollback
- Disable event emission
- Manual processing only