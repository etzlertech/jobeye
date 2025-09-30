# Vision API Documentation

REST API endpoints for vision-based kit verification.

**Base URL**: `/api/vision`

**Authentication**: All endpoints require valid JWT token in `Authorization` header.

**Multi-Tenancy**: Company ID extracted from JWT `app_metadata.company_id` and enforced via RLS.

---

## Endpoints

### POST /api/vision/verify

Verify a single photo against kit definition using hybrid YOLO + VLM pipeline.

**URL**: `/api/vision/verify`

**Method**: `POST`

**Auth Required**: Yes

**Content-Type**: `multipart/form-data`

#### Request Body

```typescript
{
  photo: File;           // Image file (JPEG, PNG, WebP)
  kitId: string;         // Kit definition ID from scheduling system
  jobId?: string;        // Optional job ID for tracking
  containerId?: string;  // Optional container ID (truck, trailer, bin)
}
```

#### Success Response

**Code**: `200 OK`

**Content**:
```json
{
  "verificationId": "vrfy_abc123",
  "verified": true,
  "detectedItems": [
    {
      "id": "item_001",
      "label": "lawn_mower",
      "confidence": 0.94,
      "boundingBox": {
        "x": 120,
        "y": 80,
        "width": 200,
        "height": 180
      },
      "matchedKitItem": "mower_21inch"
    },
    {
      "id": "item_002",
      "label": "string_trimmer",
      "confidence": 0.89,
      "boundingBox": {
        "x": 340,
        "y": 100,
        "width": 150,
        "height": 220
      },
      "matchedKitItem": "trimmer_gas"
    }
  ],
  "missingItems": [],
  "confidence": 0.92,
  "cost": 0.00,
  "method": "yolo",
  "processingTimeMs": 2480,
  "timestamp": "2024-01-15T09:30:00Z"
}
```

#### Incomplete Kit Response

**Code**: `200 OK`

**Content**:
```json
{
  "verificationId": "vrfy_abc124",
  "verified": false,
  "detectedItems": [
    {
      "id": "item_001",
      "label": "lawn_mower",
      "confidence": 0.94,
      "matchedKitItem": "mower_21inch"
    }
  ],
  "missingItems": [
    "chainsaw",
    "safety_harness"
  ],
  "confidence": 0.91,
  "cost": 0.00,
  "method": "yolo",
  "processingTimeMs": 2350,
  "timestamp": "2024-01-15T09:32:00Z"
}
```

#### VLM Fallback Response

**Code**: `200 OK`

**Content**:
```json
{
  "verificationId": "vrfy_abc125",
  "verified": true,
  "detectedItems": [...],
  "missingItems": [],
  "confidence": 0.68,
  "cost": 0.095,
  "method": "vlm",
  "fallbackReason": "low_confidence",
  "processingTimeMs": 4820,
  "timestamp": "2024-01-15T09:35:00Z"
}
```

#### Error Responses

**Code**: `400 Bad Request`
```json
{
  "error": "Missing required field: photo",
  "code": "VALIDATION_ERROR"
}
```

**Code**: `402 Payment Required`
```json
{
  "error": "Daily budget cap exceeded",
  "budgetCap": 10.00,
  "currentSpend": 10.25,
  "code": "BUDGET_EXCEEDED"
}
```

**Code**: `422 Unprocessable Entity`
```json
{
  "error": "Image quality insufficient for detection",
  "suggestions": [
    "Ensure good lighting",
    "Hold camera steady",
    "Get closer to items"
  ],
  "code": "POOR_IMAGE_QUALITY"
}
```

**Code**: `500 Internal Server Error`
```json
{
  "error": "Vision processing failed",
  "code": "PROCESSING_ERROR"
}
```

#### Example Request

```bash
curl -X POST https://api.jobeye.com/api/vision/verify \
  -H "Authorization: Bearer <token>" \
  -F "photo=@truck_load.jpg" \
  -F "kitId=kit_small_yard_001" \
  -F "jobId=job_123" \
  -F "containerId=truck_bed"
```

---

### POST /api/vision/batch-verify

Verify multiple photos for a single kit (e.g., truck bed + trailer + storage bins).

**URL**: `/api/vision/batch-verify`

**Method**: `POST`

**Auth Required**: Yes

**Content-Type**: `multipart/form-data`

#### Request Body

```typescript
{
  photos: File[];         // Array of image files
  kitId: string;          // Kit definition ID
  jobId?: string;         // Optional job ID
  containerIds?: string[];// Optional container IDs (one per photo)
}
```

#### Success Response

**Code**: `200 OK`

**Content**:
```json
{
  "batchId": "batch_xyz789",
  "verified": true,
  "totalPhotos": 3,
  "verifications": [
    {
      "verificationId": "vrfy_001",
      "containerId": "truck_bed",
      "detectedItems": ["mower", "trimmer"],
      "confidence": 0.93,
      "cost": 0.00,
      "method": "yolo"
    },
    {
      "verificationId": "vrfy_002",
      "containerId": "trailer",
      "detectedItems": ["blower", "edger"],
      "confidence": 0.88,
      "cost": 0.00,
      "method": "yolo"
    },
    {
      "verificationId": "vrfy_003",
      "containerId": "storage_bin_1",
      "detectedItems": ["chainsaw", "safety_gear"],
      "confidence": 0.91,
      "cost": 0.00,
      "method": "yolo"
    }
  ],
  "allDetectedItems": [
    "mower", "trimmer", "blower", "edger", "chainsaw", "safety_gear"
  ],
  "missingItems": [],
  "totalCost": 0.00,
  "totalProcessingTimeMs": 7840,
  "timestamp": "2024-01-15T09:40:00Z"
}
```

#### Example Request

```bash
curl -X POST https://api.jobeye.com/api/vision/batch-verify \
  -H "Authorization: Bearer <token>" \
  -F "photos=@truck.jpg" \
  -F "photos=@trailer.jpg" \
  -F "photos=@bin.jpg" \
  -F "kitId=kit_large_commercial_001" \
  -F "jobId=job_456" \
  -F "containerIds=truck_bed" \
  -F "containerIds=trailer" \
  -F "containerIds=storage_bin_1"
```

---

### GET /api/vision/verifications

Retrieve verification history with filters.

**URL**: `/api/vision/verifications`

**Method**: `GET`

**Auth Required**: Yes

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `jobId` | string | No | Filter by job ID |
| `technicianId` | string | No | Filter by technician |
| `startDate` | ISO 8601 | No | Start of date range |
| `endDate` | ISO 8601 | No | End of date range |
| `verified` | boolean | No | Filter by success/failure |
| `method` | string | No | Filter by method (yolo/vlm) |
| `limit` | number | No | Page size (default: 50, max: 100) |
| `offset` | number | No | Pagination offset |

#### Success Response

**Code**: `200 OK`

**Content**:
```json
{
  "verifications": [
    {
      "id": "vrfy_abc123",
      "jobId": "job_123",
      "kitId": "kit_small_yard_001",
      "technicianId": "tech_789",
      "technicianName": "John Doe",
      "verified": true,
      "detectedItemsCount": 6,
      "missingItemsCount": 0,
      "confidence": 0.92,
      "cost": 0.00,
      "method": "yolo",
      "photoUrl": "https://storage.supabase.co/...",
      "timestamp": "2024-01-15T09:30:00Z"
    },
    {
      "id": "vrfy_abc124",
      "jobId": "job_124",
      "kitId": "kit_small_yard_001",
      "technicianId": "tech_790",
      "technicianName": "Jane Smith",
      "verified": false,
      "detectedItemsCount": 4,
      "missingItemsCount": 2,
      "missingItems": ["chainsaw", "safety_harness"],
      "confidence": 0.88,
      "cost": 0.00,
      "method": "yolo",
      "photoUrl": "https://storage.supabase.co/...",
      "timestamp": "2024-01-15T09:35:00Z"
    }
  ],
  "pagination": {
    "total": 142,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

#### Example Request

```bash
curl -X GET "https://api.jobeye.com/api/vision/verifications?\
technicianId=tech_789&\
startDate=2024-01-15T00:00:00Z&\
endDate=2024-01-15T23:59:59Z&\
verified=false" \
  -H "Authorization: Bearer <token>"
```

---

### GET /api/vision/verifications/:id

Get detailed information for a specific verification.

**URL**: `/api/vision/verifications/:id`

**Method**: `GET`

**Auth Required**: Yes

#### Success Response

**Code**: `200 OK`

**Content**:
```json
{
  "id": "vrfy_abc123",
  "jobId": "job_123",
  "kitId": "kit_small_yard_001",
  "kitName": "Small Yard Kit",
  "technicianId": "tech_789",
  "technicianName": "John Doe",
  "verified": true,
  "detectedItems": [
    {
      "id": "item_001",
      "label": "lawn_mower",
      "confidence": 0.94,
      "boundingBox": {...},
      "matchedKitItem": "mower_21inch",
      "containerId": "truck_bed"
    }
  ],
  "missingItems": [],
  "confidence": 0.92,
  "cost": 0.00,
  "method": "yolo",
  "processingTimeMs": 2480,
  "photoUrl": "https://storage.supabase.co/...",
  "photoThumbnailUrl": "https://storage.supabase.co/.../thumb",
  "metadata": {
    "deviceModel": "iPhone 14 Pro",
    "appVersion": "1.2.3",
    "location": {
      "lat": 37.7749,
      "lng": -122.4194
    }
  },
  "timestamp": "2024-01-15T09:30:00Z"
}
```

---

### GET /api/vision/cost/summary

Get cost tracking summary for budget monitoring.

**URL**: `/api/vision/cost/summary`

**Method**: `GET`

**Auth Required**: Yes (Admin or Supervisor role)

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | ISO 8601 | No | Start of date range (default: today) |
| `endDate` | ISO 8601 | No | End of date range (default: today) |

#### Success Response

**Code**: `200 OK`

**Content**:
```json
{
  "period": {
    "startDate": "2024-01-15T00:00:00Z",
    "endDate": "2024-01-15T23:59:59Z"
  },
  "totalCost": 4.85,
  "budgetCap": 10.00,
  "budgetRemaining": 5.15,
  "budgetUsedPercent": 48.5,
  "verifications": {
    "total": 248,
    "yolo": 198,
    "vlm": 50,
    "vlmRate": 20.2
  },
  "costBreakdown": {
    "yolo": 0.00,
    "vlm": 4.85,
    "averagePerVerification": 0.02
  },
  "dailyAverage": 4.85,
  "projectedMonthlyCost": 145.50,
  "topUsers": [
    {
      "technicianId": "tech_789",
      "name": "John Doe",
      "verifications": 32,
      "cost": 0.80,
      "vlmRate": 25.0
    }
  ],
  "alerts": []
}
```

#### Budget Warning Response

**Code**: `200 OK`

**Content**:
```json
{
  ...,
  "totalCost": 9.25,
  "budgetCap": 10.00,
  "budgetRemaining": 0.75,
  "budgetUsedPercent": 92.5,
  "alerts": [
    {
      "type": "budget_warning",
      "severity": "high",
      "message": "92.5% of daily budget used",
      "recommendation": "Review VLM usage rate and photo quality"
    }
  ]
}
```

---

### PUT /api/vision/cost/budget

Update daily budget cap for company (Admin only).

**URL**: `/api/vision/cost/budget`

**Method**: `PUT`

**Auth Required**: Yes (Admin role)

**Content-Type**: `application/json`

#### Request Body

```json
{
  "dailyBudgetCap": 15.00
}
```

#### Success Response

**Code**: `200 OK`

**Content**:
```json
{
  "success": true,
  "dailyBudgetCap": 15.00,
  "previousCap": 10.00,
  "updatedAt": "2024-01-15T10:00:00Z"
}
```

---

### POST /api/jobs/:jobId/kits/:kitId/verify

Convenience endpoint for kit verification directly from job context.

**URL**: `/api/jobs/:jobId/kits/:kitId/verify`

**Method**: `POST`

**Auth Required**: Yes

**Content-Type**: `multipart/form-data`

#### URL Parameters

- `jobId`: Job ID from scheduling system
- `kitId`: Kit ID from scheduling system

#### Request Body

```typescript
{
  photo: File;          // Image file
  containerId?: string; // Optional container ID
}
```

#### Success Response

Same as `/api/vision/verify`, with additional job status update:

```json
{
  "verificationId": "vrfy_abc123",
  "verified": true,
  "jobUpdated": true,
  "jobStatus": "kit_verified",
  ...
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Missing or invalid request parameters |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication token |
| `FORBIDDEN` | 403 | Insufficient permissions for operation |
| `NOT_FOUND` | 404 | Verification, kit, or job not found |
| `BUDGET_EXCEEDED` | 402 | Daily cost budget cap reached |
| `POOR_IMAGE_QUALITY` | 422 | Image quality insufficient for detection |
| `PROCESSING_ERROR` | 500 | Vision processing failed |
| `SERVICE_UNAVAILABLE` | 503 | Vision service temporarily unavailable |

---

## Rate Limits

| Endpoint | Rate Limit | Burst |
|----------|------------|-------|
| `/verify` | 60 req/min | 10 |
| `/batch-verify` | 20 req/min | 5 |
| `/verifications` | 120 req/min | 20 |
| `/cost/summary` | 60 req/min | 10 |

Rate limits are per-company and enforced at the API gateway level.

---

## Webhooks

Vision events can trigger webhooks for real-time notifications.

### Events

- `verification.completed` - Verification finished successfully
- `verification.failed` - Verification failed
- `kit.incomplete` - Kit missing items
- `budget.warning` - 80% of daily budget used
- `budget.exceeded` - Daily budget cap reached

### Payload Example

```json
{
  "event": "kit.incomplete",
  "timestamp": "2024-01-15T09:35:00Z",
  "companyId": "company_abc",
  "data": {
    "verificationId": "vrfy_abc124",
    "jobId": "job_124",
    "technicianId": "tech_790",
    "missingItems": ["chainsaw", "safety_harness"],
    "photoUrl": "https://storage.supabase.co/..."
  }
}
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, key);

// Verify kit
async function verifyKit(photo: File, kitId: string) {
  const formData = new FormData();
  formData.append('photo', photo);
  formData.append('kitId', kitId);

  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch('/api/vision/verify', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session?.access_token}`
    },
    body: formData
  });

  return response.json();
}

// Get verification history
async function getHistory(filters: any) {
  const params = new URLSearchParams(filters);
  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch(`/api/vision/verifications?${params}`, {
    headers: {
      'Authorization': `Bearer ${session?.access_token}`
    }
  });

  return response.json();
}
```

### React Hook

```typescript
import { useState } from 'react';

export function useVisionVerification() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const verify = async (photo: File, kitId: string) => {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('photo', photo);
      formData.append('kitId', kitId);

      const response = await fetch('/api/vision/verify', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Verification failed');
      }

      return await response.json();
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { verify, loading, error };
}
```

---

## Testing

### cURL Examples

```bash
# Verify single photo
curl -X POST http://localhost:3000/api/vision/verify \
  -H "Authorization: Bearer eyJ..." \
  -F "photo=@test_photo.jpg" \
  -F "kitId=kit_123"

# Get verification history
curl -X GET "http://localhost:3000/api/vision/verifications?limit=10" \
  -H "Authorization: Bearer eyJ..."

# Get cost summary
curl -X GET http://localhost:3000/api/vision/cost/summary \
  -H "Authorization: Bearer eyJ..."
```

### Test Data

Test images available in `src/domains/vision/__tests__/fixtures/`:
- `good_lighting.jpg` - High confidence detection
- `poor_lighting.jpg` - Low confidence (triggers VLM)
- `missing_items.jpg` - Incomplete kit
- `multiple_containers.jpg` - For batch verification

---

## Performance

### Response Times (Target)

| Endpoint | P50 | P95 | P99 |
|----------|-----|-----|-----|
| `/verify` (YOLO) | 2.5s | 3.5s | 5s |
| `/verify` (VLM) | 5s | 8s | 12s |
| `/batch-verify` | 8s | 15s | 20s |
| `/verifications` | 100ms | 250ms | 500ms |
| `/cost/summary` | 80ms | 150ms | 300ms |

### Optimization Tips

1. **Image Size**: Resize to max 1920x1080 before upload (reduces transfer time)
2. **Batch Requests**: Use `/batch-verify` for multiple photos (single round trip)
3. **Caching**: Cache verification results locally for offline access
4. **Pagination**: Use small page sizes for `/verifications` (50 items max)

---

**Version**: 1.0.0
**Last Updated**: 2025-09-29
**Status**: Production Ready (pending test fixes)