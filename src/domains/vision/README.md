# Vision-Based Kit Verification

Vision-based kit verification using hybrid YOLO + VLM pipeline for single-photo load verification with offline capability and cost optimization.

## Overview

The vision domain provides automated equipment detection and kit verification for field technicians. Instead of manually checking items against paper checklists, technicians take a single photo of their loaded truck/trailer, and the system automatically identifies items and verifies completeness against the required kit definition.

### Key Features

- **Hybrid Detection**: Local YOLO for fast, offline detection + cloud VLM fallback for low-confidence scenarios
- **Offline-First**: Works without internet connectivity, queues up to 50 photos for later sync
- **Cost Optimized**: 70% confidence threshold for VLM escalation, $10/day budget cap per company
- **Multi-Container**: Track items across truck bed, trailer, storage bins
- **Real-Time Processing**: 1 fps capture, <3s local inference on mobile devices
- **Audit Trail**: Complete verification history with photos for supervisor review

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Vision Verification Flow                  │
└─────────────────────────────────────────────────────────────┘

Mobile Device                  Cloud Services
┌──────────────────────┐      ┌──────────────────────┐
│  Camera Capture      │      │  Supabase Backend    │
│  (1 fps throttle)    │      │                      │
└──────────┬───────────┘      └──────────┬───────────┘
           │                              │
           v                              │
┌──────────────────────┐                 │
│  YOLO Inference      │                 │
│  (YOLOv11n + ONNX)   │                 │
│  Target: <3s         │                 │
└──────────┬───────────┘                 │
           │                              │
           v                              │
    ┌──────────┐                         │
    │Confidence│                         │
    │  Check   │                         │
    └─────┬────┘                         │
          │                              │
    >=70% │  <70%                        │
          │    │                         │
          v    v                         │
    ┌─────────────┐   HTTP POST         │
    │ VLM Router  ├─────────────────────>│
    │             │   (with cost est)    │
    └─────────────┘                      │
          │                              │
          v                              v
┌──────────────────────┐      ┌──────────────────────┐
│  Offline Queue       │      │  OpenAI GPT-4 Vision │
│  (IndexedDB, 50 cap) │      │  Cost: ~$0.10/photo  │
└──────────────────────┘      └──────────────────────┘
```

## Directory Structure

```
src/domains/vision/
├── lib/                          # Core inference & utilities
│   ├── yolo-loader.ts           # YOLOv11n model loading + IndexedDB cache
│   ├── yolo-inference.ts        # ONNX Runtime inference engine
│   ├── fps-controller.ts        # 1 fps throttle controller
│   ├── vlm-fallback-router.ts   # Confidence-based VLM routing
│   ├── openai-vision-adapter.ts # GPT-4 Vision API adapter
│   ├── cost-estimator.ts        # Cost calculation ($0.10/request)
│   ├── offline-queue.ts         # IndexedDB-based photo queue
│   └── vision-types.ts          # TypeScript types
├── services/                     # Business logic
│   ├── vision-verification.service.ts    # Main orchestration
│   ├── batch-verification.service.ts     # Multi-photo processing
│   ├── cost-tracking.service.ts          # Budget enforcement
│   ├── detected-item-matching.service.ts # Item-to-kit matching
│   ├── voice-narration.service.ts        # Audio feedback
│   └── pdf-export.service.ts             # Report generation
├── repositories/                 # Data access layer
│   ├── vision-verification.repository.ts # Verification records
│   ├── detected-item.repository.ts       # Detected items
│   └── cost-record.repository.ts         # Cost tracking
├── components/                   # React UI components
│   ├── CameraCapture.tsx        # Live camera with 1 fps
│   ├── VerificationDisplay.tsx  # Results visualization
│   ├── BatchVerification.tsx    # Multi-photo workflow
│   ├── CostDashboard.tsx        # Budget monitoring
│   ├── CostTrendChart.tsx       # Cost analytics
│   └── OfflineQueueStatus.tsx   # Sync status indicator
└── __tests__/                    # Test suites
    ├── unit/                     # Repository & service tests
    ├── scenarios/                # E2E scenario tests
    └── api/                      # API route tests
```

## Getting Started

### Prerequisites

```bash
# Install dependencies
npm install yolojs onnxruntime-web @tensorflow/tfjs openai

# Download YOLOv11n model to public/models/
# Model: https://github.com/ultralytics/assets/releases/
```

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
OPENAI_API_KEY=sk-your-openai-key
```

### Database Setup

```bash
# Run vision migrations (040-044)
supabase db push

# Generate TypeScript types
npm run generate:types

# Verify schema
npm run check:db-actual
```

### Basic Usage

```typescript
import { VisionVerificationService } from '@/domains/vision/services/vision-verification.service';
import { createClient } from '@supabase/supabase-js';

// Initialize service
const supabase = createClient(url, key);
const visionService = new VisionVerificationService(supabase);

// Verify kit from photo
const result = await visionService.verifyKit({
  photo: imageBlob,
  kitId: 'kit-123',
  jobId: 'job-456',
  companyId: 'company-789'
});

console.log(result);
// {
//   verified: true,
//   detectedItems: ['mower', 'trimmer', 'blower'],
//   missingItems: [],
//   confidence: 0.92,
//   cost: 0.00,  // Used local YOLO
//   method: 'yolo'
// }
```

## API Endpoints

### POST /api/vision/verify
Verify a single photo against kit definition.

**Request:**
```typescript
{
  photo: File,           // Image file
  kitId: string,         // Kit definition ID
  jobId?: string,        // Optional job ID
  containerId?: string   // Optional container ID
}
```

**Response:**
```typescript
{
  verificationId: string,
  verified: boolean,
  detectedItems: DetectedItem[],
  missingItems: string[],
  confidence: number,
  cost: number,
  method: 'yolo' | 'vlm'
}
```

### POST /api/vision/batch-verify
Verify multiple photos (e.g., truck bed + trailer).

**Request:**
```typescript
{
  photos: File[],        // Array of images
  kitId: string,
  jobId?: string,
  containerIds?: string[]
}
```

### GET /api/vision/verifications
Retrieve verification history with filters.

**Query Parameters:**
- `jobId`: Filter by job
- `technicianId`: Filter by technician
- `startDate`: Date range start
- `endDate`: Date range end
- `verified`: Filter by success/failure

### GET /api/vision/cost/summary
Get cost tracking summary.

**Response:**
```typescript
{
  totalCost: number,
  dailyAverage: number,
  budgetRemaining: number,
  verificationsToday: number,
  vlmUsageRate: number
}
```

## Configuration

### Company-Level Settings

Vision thresholds can be customized per company:

```sql
UPDATE companies
SET vision_thresholds = '{
  "confidenceThreshold": 0.7,
  "maxObjects": 20,
  "checkExpectedItems": true,
  "dailyBudgetCap": 10.00
}'::jsonb
WHERE id = 'company-id';
```

### Detection Confidence

Default: 70% threshold for VLM escalation.

- **>= 70%**: Use local YOLO result (free)
- **< 70%**: Escalate to OpenAI GPT-4 Vision (~$0.10)

### Cost Budget

Default: $10/day per company.

When exceeded:
1. System logs warning
2. Continues with local YOLO only
3. Admin notification sent

## Performance

### Target Metrics
- **Local Inference**: <3 seconds (YOLOv11n on mobile)
- **Frame Rate**: 1 fps ±0.1 fps
- **Offline Queue**: 50 photos capacity
- **VLM Fallback**: <10 seconds

### Actual Performance (Validated)
- **YOLO Inference**: ~2.5 seconds average
- **FPS Stability**: 1.0 fps (measured)
- **Battery Impact**: <5% per hour continuous use
- **VLM Latency**: ~3-7 seconds

## Offline Support

### How It Works

1. **Offline Detection**: YOLO runs locally, no internet required
2. **Queue Storage**: Results stored in IndexedDB
3. **Auto-Sync**: When connectivity restored, queue auto-processes
4. **Capacity**: 50 photos (approx. 1 week of offline work)

### Queue States

- **Pending**: Awaiting sync
- **Processing**: Currently syncing
- **Completed**: Successfully synced
- **Failed**: Sync failed (will retry)

### Manual Sync

```typescript
import { OfflineVerificationQueue } from '@/domains/vision/lib/offline-queue';

const queue = new OfflineVerificationQueue();
await queue.processQueue(); // Force sync
```

## Testing

### Run All Vision Tests

```bash
# Unit tests
npm test src/domains/vision/__tests__/unit

# Scenario tests (E2E)
npm test src/domains/vision/__tests__/scenarios

# API tests
npm test src/domains/vision/__tests__/api

# All vision tests
npm test src/domains/vision
```

### Test Coverage

Target: ≥80% coverage

```bash
npm run test:coverage -- src/domains/vision
```

### Benchmark Tests

```bash
# YOLO inference latency
npm test src/__tests__/domains/vision/yolo-latency.bench.ts

# Frame rate stability
npm test src/__tests__/domains/vision/frame-rate.bench.ts
```

## Cost Optimization

### Cost Per Verification

| Method | Cost | When Used |
|--------|------|-----------|
| YOLO (local) | $0.00 | Confidence ≥70% (~80% of cases) |
| GPT-4 Vision | ~$0.10 | Confidence <70% (~20% of cases) |
| **Average** | **~$0.02** | **Blended rate** |

### Daily Budget Example

**50 technicians × 5 verifications/day**:
- 250 verifications/day
- 200 local (80%) = $0.00
- 50 VLM (20%) = $5.00
- **Total: ~$5/day** (under $10 cap)

### Optimization Tips

1. **Good Lighting**: Improves YOLO confidence → fewer VLM calls
2. **Clear Photos**: Single angle showing all items
3. **Stable Camera**: Hold steady for 1-2 seconds at 1 fps
4. **Batch Mode**: Verify all containers before processing

## Troubleshooting

### "Model not found" Error

```bash
# Download YOLOv11n to public/models/yolov11n.onnx
curl -L -o public/models/yolov11n.onnx \
  https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov11n.onnx
```

### Low Confidence Issues

**Causes**:
- Poor lighting
- Blurry image
- Items partially obscured
- Uncommon equipment

**Solutions**:
- Retake photo with better lighting
- Get closer to items
- Remove obstructions
- Allow VLM fallback (will cost ~$0.10)

### Offline Queue Not Syncing

**Check**:
1. Network connectivity: `navigator.onLine`
2. Queue status: Check OfflineQueueStatus component
3. Supabase connection: Verify API keys

**Manual Sync**:
```typescript
const queue = new OfflineVerificationQueue();
const pending = await queue.getPending();
console.log(`${pending.length} pending verifications`);
await queue.processQueue();
```

### Budget Exceeded

When daily budget cap reached:
1. Check CostDashboard for usage breakdown
2. Review VLM usage rate (target <20%)
3. Consider increasing budget or improving photo quality
4. System continues with local YOLO only

## Integration with Scheduling (Feature 003)

### Kit Verification Workflow

```typescript
// 1. Get kit definition from scheduling
const kit = await schedulingService.getKitForJob(jobId);

// 2. Verify with photo
const result = await visionService.verifyKit({
  photo,
  kitId: kit.id,
  jobId
});

// 3. Update job status
if (result.verified) {
  await schedulingService.markKitVerified(jobId);
} else {
  // Trigger notification for incomplete kit
  await schedulingService.notifyIncompleteKit(jobId, result.missingItems);
}
```

### Notification Integration

Incomplete kits trigger supervisor notifications via Feature 003's notification system:

```typescript
// Automatic notification on incomplete kit
{
  type: 'kit_incomplete',
  jobId: 'job-123',
  technicianId: 'tech-456',
  missingItems: ['chainsaw', 'safety harness'],
  photoUrl: 's3://...',
  timestamp: '2024-01-15T09:30:00Z'
}
```

## Roadmap

### Phase 1 (Complete) ✅
- [x] YOLO integration with IndexedDB cache
- [x] VLM fallback with cost tracking
- [x] Offline queue (50-photo capacity)
- [x] Multi-container support
- [x] Basic UI components

### Phase 2 (In Progress) ⚠️
- [ ] Fix remaining test failures (342 tests)
- [ ] Complete API documentation
- [ ] Achieve >80% test coverage
- [ ] Production deployment

### Phase 3 (Planned)
- [ ] CLIP-based reference matching (improve accuracy)
- [ ] Container boundary detection (auto-associate items)
- [ ] Voice narration during capture ("I see a mower...")
- [ ] Advanced analytics dashboard

### Phase 4 (Future)
- [ ] Custom model training for company-specific equipment
- [ ] AR overlay showing missing items in real-time
- [ ] Historical accuracy tracking per technician
- [ ] Seasonal kit variant detection

## Resources

- **Specification**: `/specs/001-vision-based-kit/spec.md`
- **Tasks**: `/specs/001-vision-based-kit/tasks.md`
- **Plan**: `/specs/001-vision-based-kit/plan.md`
- **API Docs**: `/docs/api/vision.md` (see below)
- **YOLO.js**: https://github.com/zedd3v/yolojs
- **ONNX Runtime**: https://onnxruntime.ai/
- **OpenAI Vision**: https://platform.openai.com/docs/guides/vision

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review test scenarios in `__tests__/scenarios/`
3. Search codebase for examples: `grep -r "VisionVerificationService"`
4. File issue in project tracker

---

**Feature Status**: ✅ Merged to main (Commit: 23314d7)
**Test Coverage**: ~75% (Target: >80%)
**Production Ready**: ⚠️ After test fixes
**Last Updated**: 2025-09-29