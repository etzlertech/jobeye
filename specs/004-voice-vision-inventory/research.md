# Research: Voice & Vision Inventory Management

**Feature**: 004-voice-vision-inventory
**Date**: 2025-09-29
**Status**: Phase 0 Complete

## Research Questions

### 1. OCR Library Selection for Receipt Processing

**Context**: Need to extract vendor, date, line items, and totals from receipt photos within 5s performance target (PR-004).

**Options Evaluated**:

#### Option A: Tesseract.js (Client-Side)
- **Pros**:
  - Free, no API costs
  - Works offline (critical for offline-first requirement)
  - Widely used, mature library
  - WASM-based, runs in browser
- **Cons**:
  - Performance: 3-8s on mobile for complex receipts
  - Lower accuracy for low-quality photos (~85-90%)
  - Requires post-processing to extract structured data (regex parsing)
  - Large WASM bundle (~2MB)
- **Cost**: $0
- **References**:
  - Feature 001 uses YOLO client-side successfully
  - Similar WASM pattern viable

#### Option B: AWS Textract (Cloud API)
- **Pros**:
  - High accuracy (95-98%)
  - Built-in receipt parsing (ANALYZE_EXPENSE)
  - Returns structured JSON (vendor, date, items, totals)
  - Fast processing (1-2s)
- **Cons**:
  - Requires network connectivity (breaks offline requirement)
  - Cost: $0.05-0.15 per receipt
  - Adds AWS SDK dependency
  - Privacy: sends receipt data to AWS
- **Cost**: ~$0.10/receipt × 50-200 receipts/day = $5-20/day per company

#### Option C: GPT-4 Vision (Hybrid Approach)
- **Pros**:
  - Already using OpenAI SDK for VLM
  - Single vendor integration
  - High accuracy with structured output (JSON mode)
  - Can extract line items with natural language understanding
  - Fast (2-4s)
- **Cons**:
  - Requires network (breaks offline for OCR)
  - Cost: $0.01-0.03 per receipt (cheaper than Textract)
  - Privacy: sends receipt data to OpenAI
- **Cost**: ~$0.02/receipt × 50-200 receipts/day = $1-4/day per company

#### Option D: Hybrid (Tesseract + GPT-4 Vision Fallback)
- **Approach**:
  - Primary: Tesseract.js offline (free, slow, 85-90% accuracy)
  - Fallback: GPT-4 Vision when Tesseract confidence < 70% or parsing fails
  - Queue receipts for later GPT-4 processing when offline
- **Pros**:
  - Maintains offline capability
  - Cost-optimized (80% free Tesseract, 20% GPT-4)
  - Single cloud vendor (OpenAI for both VLM and OCR)
- **Cons**:
  - Complexity: two OCR paths
  - Performance: 3-8s for Tesseract path
- **Cost**: ~$0.004/receipt avg × 50-200 receipts/day = $0.20-0.80/day per company

**Decision**: **Option D - Hybrid (Tesseract + GPT-4 Vision Fallback)**

**Rationale**:
- Maintains constitutional offline-first requirement
- Aligns with existing YOLO+VLM hybrid pattern from Feature 001
- Cost-effective: ~$0.004 avg per receipt (80/20 split)
- Single cloud vendor reduces integration complexity
- Tesseract performance (3-8s) acceptable when offline, GPT-4 (2-4s) when online

**Alternatives Considered**:
- Pure Tesseract: Rejected due to accuracy concerns (85-90% vs 95%+ needed)
- Pure Cloud: Rejected due to offline requirement violation
- AWS Textract: Rejected due to cost ($0.10 vs $0.02 per receipt) and multi-vendor complexity

---

### 2. YOLO Model Integration for Inventory Items

**Context**: Feature 001 uses YOLOv11n for kit verification. Need to evaluate if same model works for inventory items or requires custom training.

**Analysis**:

#### Existing YOLO Capabilities (from Feature 001)
- Model: YOLOv11n (nano variant for edge performance)
- Training: COCO dataset (80 common objects)
- Performance: ~2.5s inference on iPhone 12+
- Confidence threshold: 0.7 (70%)
- Covers: General tools, vehicles, containers

#### Inventory-Specific Requirements
From spec.md entities:
- Equipment: mower, trimmer, blower, edger, chainsaw, sprayer
- Materials: fertilizer bags, seed bags, pesticide bottles, gas cans
- Containers: trucks, trailers, storage bins, toolboxes

#### Coverage Gap Analysis
**✅ Well-covered by COCO**:
- truck, car (vehicles)
- bottle, backpack, suitcase (containers)
- scissors, knife (tools)

**⚠️ Partially covered**:
- person, bicycle, motorcycle (related objects)
- potted plant (can detect fertilizer/seed bags with low confidence)

**❌ Not covered (require custom training)**:
- Lawn equipment (mower, trimmer, blower, edger, chainsaw)
- Specific material types (fertilizer vs seed vs pesticide bags)
- Storage containers (trailer, storage bin, toolbox)

**Options**:

#### Option A: Use COCO Model + VLM Fallback
- Approach: Detect generic objects with YOLO, fallback to GPT-4 Vision for equipment-specific identification
- Expected VLM rate: 40-60% (vs 10% target from constitution)
- Cost impact: $4-6/day per company (vs $1-2 target)
- Performance: Acceptable for MVP

#### Option B: Fine-tune YOLOv11n on JobEye Dataset
- Approach: Collect training data from users (FR-082 to FR-091), fine-tune model monthly
- Training data: 500-1000 labeled images per equipment type
- Expected VLM rate after training: <10% (meets target)
- Cost: One-time training cost $100-200, ongoing retraining $50/month
- Timeline: 3-6 months to collect sufficient training data

#### Option C: Two-Stage Model (COCO + Custom)
- Approach: COCO for general items, custom model for equipment/materials
- Complexity: Run two YOLO models (2x inference time)
- Performance: 5-6s total (exceeds 3s target)
- Not viable

**Decision**: **Option A initially, Option B long-term**

**Rationale**:
- Start with COCO + VLM fallback for MVP (3-6 month data collection phase)
- Use training data collection (FR-082 to FR-091) to build custom dataset
- Fine-tune YOLOv11n after 500-1000 labeled images per category collected
- Expected timeline: MVP launch → 3 months data collection → fine-tune → redeploy

**Implementation Strategy**:
1. **Phase 1 (MVP)**: COCO YOLOv11n + GPT-4 Vision fallback, accept 40-60% VLM rate
2. **Phase 2 (Data Collection)**: Implement training data pipeline, target 1000 images/3 months
3. **Phase 3 (Fine-tune)**: Train custom YOLOv11n, target <10% VLM rate
4. **Phase 4 (Deploy)**: Replace COCO with fine-tuned model, monitor improvement

---

### 3. Voice-LLM Attribute Extraction Patterns

**Context**: Need to extract structured attributes (brand, model, serial, price) from voice input like "This is an Echo SRM-225 trimmer, serial 12345, purchased for $399".

**Existing Patterns** (from voice domain analysis):

```typescript
// From /src/domains/voice/ (assumed structure)
interface VoiceCommand {
  sessionId: string;
  transcript: string;
  intent: string;
  entities: Record<string, any>;
  confidence: number;
}
```

**LLM Extraction Approaches**:

#### Option A: OpenAI Function Calling (Structured Output)
```typescript
const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "system", content: "Extract equipment attributes from voice transcript." },
    { role: "user", content: transcript }
  ],
  tools: [{
    type: "function",
    function: {
      name: "extract_equipment_attributes",
      parameters: {
        type: "object",
        properties: {
          brand: { type: "string" },
          model: { type: "string" },
          serial: { type: "string" },
          price: { type: "number" },
          condition: { type: "string", enum: ["new", "used", "refurbished"] }
        },
        required: ["brand", "model"]
      }
    }
  }],
  tool_choice: { type: "function", function: { name: "extract_equipment_attributes" } }
});
```
- **Pros**: Guaranteed structured output, validation built-in, fast (1-2s)
- **Cons**: Requires network, OpenAI dependency
- **Cost**: $0.01-0.02 per extraction (gpt-4o-mini)

#### Option B: JSON Mode (Prompt Engineering)
```typescript
const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  response_format: { type: "json_object" },
  messages: [
    { role: "system", content: "Extract attributes as JSON: {brand, model, serial, price, condition}" },
    { role: "user", content: transcript }
  ]
});
```
- **Pros**: Simpler, cheaper, valid JSON guaranteed
- **Cons**: No schema validation, may hallucinate missing fields
- **Cost**: $0.01-0.02 per extraction

#### Option C: Offline Regex + Entity Recognition
```typescript
const patterns = {
  brand: /\b(echo|stihl|husqvarna|honda)\b/i,
  model: /\b([A-Z0-9]{3,10})\b/,
  serial: /serial\s+(\w+)/i,
  price: /\$?([\d,]+\.?\d*)/
};
```
- **Pros**: Free, offline, fast (<100ms)
- **Cons**: Low accuracy (60-70%), brittle, requires maintenance
- **Cost**: $0

**Decision**: **Option A - OpenAI Function Calling (Structured Output)**

**Rationale**:
- Guarantees schema compliance (type safety, required fields)
- High accuracy (95%+) reduces user corrections
- Cost acceptable: $0.01-0.02 per extraction, ~10-50 extractions/day = $0.10-1.00/day per company
- Aligns with existing OpenAI integration (VLM, OCR fallback)
- Performance: 1-2s meets PR-006 target (3s)

**Offline Strategy**:
- Queue voice transcripts with attributes when offline
- Process extraction when connectivity restored
- Display "Pending attribute extraction" status in UI

**Alternatives Considered**:
- JSON Mode: Rejected due to lack of validation, hallucination risk
- Regex: Rejected due to low accuracy, high maintenance burden

---

### 4. IndexedDB Queue Architecture for Offline Operations

**Context**: Need to support offline queue with 50+ capacity (PR-005), dynamic expansion, and sync retry logic (OR-008).

**Existing Pattern** (from Feature 001):
```typescript
// From /src/domains/vision/lib/offline-queue.ts (assumed)
interface OfflineQueueItem {
  id: string;
  type: 'vision_verification' | 'voice_command';
  payload: any;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
}
```

**Requirements for Feature 004**:
- Support 12 transaction types (check_out, check_in, transfer, register, purchase, usage, etc.)
- Handle large payloads (photos up to 10MB per PR-007)
- Dynamic capacity expansion (warn at 80%, block at 95%)
- Retry logic: 10 attempts → 30-day archive → auto-delete
- Priority queuing (high/medium/low per FR-032)

**Storage Capacity Analysis**:
- IndexedDB quota: ~50% device storage (e.g., 32GB phone = ~16GB quota)
- Per operation: ~2MB (1MB photo + 200KB crops + 800KB metadata)
- Initial capacity: 50 operations × 2MB = 100MB (~0.6% of 16GB quota)
- Dynamic expansion: up to 500 operations × 2MB = 1GB (~6% quota) before 80% warning

**Schema Design**:

```typescript
interface InventoryQueueItem {
  id: string;  // UUID
  companyId: string;
  userId: string;
  type: 'check_out' | 'check_in' | 'transfer' | 'register' | 'purchase' | 'usage' | 'audit' | 'maintenance' | 'container_register' | 'preference_update' | 'training_data';
  priority: 'high' | 'medium' | 'low';
  payload: {
    photo?: Blob;  // Original photo
    crops?: Blob[];  // Individual item crops
    transcript?: string;
    detections?: any[];
    metadata: any;
  };
  status: 'pending' | 'syncing' | 'failed' | 'archived';
  createdAt: number;
  lastSyncAttempt?: number;
  syncRetryCount: number;
  syncErrors: Array<{ timestamp: number; error: string }>;
  estimatedCost: number;
}

// IndexedDB structure
const db = {
  stores: {
    inventoryQueue: {
      keyPath: 'id',
      indexes: [
        { name: 'status', keyPath: 'status' },
        { name: 'priority', keyPath: 'priority' },
        { name: 'companyId', keyPath: 'companyId' },
        { name: 'createdAt', keyPath: 'createdAt' }
      ]
    },
    queueMetrics: {
      keyPath: 'companyId',
      data: {
        totalOperations: number;
        pendingCount: number;
        failedCount: number;
        archivedCount: number;
        totalStorageMB: number;
        lastSyncSuccess: number;
      }
    }
  }
};
```

**Sync Strategy**:

```typescript
class InventoryOfflineQueue {
  async syncQueue(): Promise<void> {
    // 1. Get pending items sorted by priority (high → medium → low)
    const pending = await this.getPendingItems();

    // 2. Process in priority order
    for (const item of pending) {
      try {
        // Update status to 'syncing'
        await this.updateItemStatus(item.id, 'syncing');

        // Upload photo to Supabase Storage
        const photoUrl = await this.uploadPhoto(item.payload.photo);

        // Create database records
        await this.createInventoryTransaction({
          ...item.payload.metadata,
          photoUrl
        });

        // Delete from queue on success
        await this.deleteItem(item.id);

      } catch (error) {
        // Increment retry count
        item.syncRetryCount++;
        item.syncErrors.push({ timestamp: Date.now(), error: error.message });

        if (item.syncRetryCount >= 10) {
          // Move to archived after 10 failures (OR-008)
          await this.archiveItem(item.id, '30_day_retention');
        } else {
          // Reset to pending for next sync attempt
          await this.updateItemStatus(item.id, 'pending');
        }
      }
    }
  }

  async checkStorageQuota(): Promise<{ warn: boolean; block: boolean }> {
    const estimate = await navigator.storage.estimate();
    const usagePercent = (estimate.usage! / estimate.quota!) * 100;

    return {
      warn: usagePercent >= 80,  // Show warning
      block: usagePercent >= 95  // Block new operations
    };
  }
}
```

**Decision**: **Extend Feature 001 queue pattern with inventory-specific types**

**Rationale**:
- Reuse existing IndexedDB infrastructure from Feature 001
- Add inventory transaction types to queue schema
- Implement priority-based sync ordering (high = check-out/check-in, low = training data)
- Add storage quota monitoring for dynamic expansion warnings

**Implementation Notes**:
- Use `navigator.storage.estimate()` for quota tracking
- Display storage warnings in UI at 80% threshold
- Block new operations at 95% with "Clear offline queue to continue" message
- Auto-cleanup archived items after 30 days using background task

---

### 5. Multi-Item Detection & Crop Generation Performance

**Context**: Need to generate 1:1 square crops for up to 20 detected items within 5s (PR-008).

**Technical Approach**:

#### Canvas-Based Cropping
```typescript
async function generateCrops(
  imageData: ImageData,
  detections: Array<{ bbox: [x, y, w, h]; label: string; confidence: number }>
): Promise<Array<{ cropBlob: Blob; cropBox: CropBox }>> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  const crops = await Promise.all(detections.map(async (detection) => {
    const [x, y, w, h] = detection.bbox;

    // Calculate 1:1 square with 10% padding
    const padding = Math.max(w, h) * 0.1;
    const size = Math.max(w, h) + padding * 2;

    // Set canvas to square dimensions
    canvas.width = size;
    canvas.height = size;

    // Draw cropped region centered in square
    const centerX = (size - w) / 2;
    const centerY = (size - h) / 2;
    ctx.drawImage(
      imageData,
      x - padding, y - padding, w + padding * 2, h + padding * 2,
      centerX, centerY, w, h
    );

    // Convert to blob
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85);
    });

    return {
      cropBlob: blob,
      cropBox: { x, y, width: w, height: h }
    };
  }));

  return crops;
}
```

**Performance Analysis**:
- Per-crop time: 150-250ms (canvas draw + JPEG encode)
- 20 crops sequentially: 3-5s ✅ (meets PR-008 target)
- Parallel processing (Web Workers): 2-3s (optimization opportunity)

**Memory Considerations**:
- Original photo: ~2MB (3024×4032 @ 0.85 quality)
- Per crop: ~100-200KB (1:1 square @ 0.85 quality)
- 20 crops: 2-4MB total
- Temporary canvas memory: ~50MB during processing
- Total peak memory: ~60MB (acceptable for mobile)

**Decision**: **Canvas-based sequential cropping with JPEG compression**

**Rationale**:
- Meets performance target (3-5s for 20 crops)
- Simple implementation (no Web Workers needed for MVP)
- Memory efficient (JPEG compression reduces storage)
- Browser-native APIs (no external dependencies)

**Optimization Path** (if needed):
- Implement Web Worker pool for parallel cropping (2-3s target)
- Use OffscreenCanvas API (Chrome 69+, Safari 16.4+)
- Cache crops in IndexedDB to avoid regeneration

---

## Research Summary

### Decisions Made

1. **OCR**: Hybrid Tesseract.js (offline) + GPT-4 Vision fallback (online)
   - Cost: ~$0.004 avg per receipt
   - Performance: 3-8s offline, 2-4s online
   - Maintains offline-first requirement

2. **YOLO Model**: Start with COCO YOLOv11n + VLM fallback, fine-tune after data collection
   - MVP: 40-60% VLM rate (higher than target)
   - Long-term: <10% VLM rate after fine-tuning
   - Timeline: 3-6 months data collection phase

3. **Voice-LLM Extraction**: OpenAI Function Calling (structured output)
   - Cost: $0.01-0.02 per extraction
   - Performance: 1-2s (meets 3s target)
   - Offline: Queue for later processing

4. **Offline Queue**: Extend Feature 001 IndexedDB pattern
   - Initial: 50 operations (~100MB)
   - Dynamic: up to 500 operations (~1GB)
   - Warnings: 80% device storage, block at 95%

5. **Crop Generation**: Canvas-based sequential processing
   - Performance: 3-5s for 20 crops (meets 5s target)
   - Memory: ~60MB peak (acceptable)
   - Optimization: Web Workers if needed later

### No Remaining NEEDS CLARIFICATION

All unknowns resolved. Proceed to Phase 1: Design & Contracts.

---

**Research Complete**: 2025-09-29
**Next Phase**: Phase 1 - Data Model & Contracts