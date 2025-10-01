# Data Model: Mobile PWA Vision UI

**Feature**: 006-mobile-pwa-ui
**Date**: 2025-09-30

## Overview

This feature **REUSES** existing data models from Features 001 and 007. No new database tables required. Only UI state management additions.

## Existing Entities (Reused)

### 1. VisionVerificationRecord (Feature 001)
**Source**: `vision_verification_records` table
**Purpose**: Stores equipment verification sessions

```typescript
interface VisionVerificationRecord {
  id: string;
  tenant_id: string;
  user_id: string;
  job_id?: string;
  photo_url: string;
  detected_items: DetectedItem[];
  verification_status: 'verified' | 'partial' | 'failed';
  confidence_score: number;
  created_at: string;  // Auto-delete after 30 days via pg_cron
}
```

**Validation Rules** (from spec):
- `confidence_score`: 0.0 - 1.0 (trigger VLM if <0.7)
- `verification_status`: Auto-set based on checklist completion
- `created_at`: Indexed for 30-day retention cleanup

### 2. DetectedItem (Feature 001)
**Source**: `detected_items` table
**Purpose**: Individual equipment items found in verification

```typescript
interface DetectedItem {
  id: string;
  verification_id: string;  // FK to vision_verification_records
  item_name: string;
  confidence: number;
  bounding_box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  detection_method: 'yolo' | 'vlm';  // Track which service detected it
}
```

**Validation Rules**:
- `confidence`: 0.0 - 1.0
- `bounding_box`: Coordinates relative to image dimensions
- `detection_method`: Set based on which service succeeded

### 3. OfflineQueueEntry (Feature 007)
**Source**: `offline_queue` table (IndexedDB)
**Purpose**: Queues verifications when offline

```typescript
interface OfflineQueueEntry {
  id: string;
  type: 'VERIFICATION';
  payload: VisionVerificationRecord;
  created_at: number;  // Timestamp for FIFO ordering
  retry_count: number;
  status: 'pending' | 'syncing' | 'failed';
}
```

**New Validation Rules** (extended for this feature):
- **MAX_SIZE**: 200 entries (evict oldest when exceeded)
- **FIFO Eviction**: `DELETE oldest entry WHERE id = (SELECT id ORDER BY created_at ASC LIMIT 1)`

### 4. EquipmentChecklist (Existing - Jobs domain)
**Source**: `job_kits` table join `kit_items`
**Purpose**: Expected equipment for job

```typescript
interface EquipmentChecklist {
  job_id: string;
  items: Array<{
    id: string;
    name: string;
    icon: string;
    required: boolean;
    verified: boolean;  // UI state only, not persisted
  }>;
}
```

**UI State Only** (not stored):
- `verified`: boolean - toggled by detection or manual tap
- Ephemeral: reset on page load

## UI-Only State (Not Persisted)

### VerificationSession (React Context)
**Purpose**: Orchestrate verification workflow in UI
**Lifecycle**: Created on page load, destroyed on unmount

```typescript
interface VerificationSession {
  sessionId: string;
  jobId: string;
  checklist: EquipmentChecklist;
  detectionResults: DetectedItem[];
  cameraStream: MediaStream | null;
  mode: 'camera' | 'manual';  // Auto-set based on camera availability
  status: 'detecting' | 'processing' | 'complete' | 'failed';
  retryCount: number;  // For 3x retry on timeout
}
```

**State Transitions**:
```
camera_unavailable → mode='manual'
detection_timeout (retryCount<3) → retry detection
detection_timeout (retryCount>=3) → trigger VLM fallback
confidence<0.7 → trigger VLM fallback
all_items_verified → status='complete' → save record
```

### CameraPermissions (UI State)
**Purpose**: Track camera access status

```typescript
interface CameraPermissions {
  status: 'prompt' | 'granted' | 'denied';
  error?: string;
}
```

**Transitions**:
- `prompt` → User clicks "Start Camera" → Request permissions
- `granted` → Camera stream starts → mode='camera'
- `denied` → Auto-switch → mode='manual'

## Data Flow

### Verification Workflow
```
1. Page Load:
   → Fetch EquipmentChecklist for job_id
   → Initialize VerificationSession (UI state)
   → Prompt for camera permissions

2. Camera Granted:
   → Start MediaStream
   → Begin 1fps YOLO detection (Web Worker)
   → For each frame:
      - If confidence >=0.7: Mark checklist item verified
      - If confidence <0.7 OR retryCount=3: Trigger VLM fallback
      - If partial detection: Prompt user to reposition

3. All Items Verified:
   → Capture final photo
   → Create VisionVerificationRecord
   → If online: Save to Supabase
   → If offline: Add to OfflineQueueEntry (max 200, FIFO eviction)

4. Camera Denied/Unavailable:
   → mode='manual'
   → Render manual checklist
   → User taps items to verify
   → Save verification without photo
```

### Offline Sync Flow
```
1. Network Restored:
   → OfflineQueueEntry status='syncing'
   → For each entry (oldest first):
      - POST /api/vision/verify with payload
      - If success: DELETE from queue
      - If fail (retries<3): retry_count++
      - If fail (retries>=3): status='failed', keep in queue

2. Queue Full (200 entries):
   → Before insert: DELETE oldest entry
   → Display warning: "Offline queue full - oldest verification discarded"
```

## Integration Points

### Feature 001 (Vision Services)
**Used**: `VisionVerificationService`, `YOLOInferenceService`, `VLMFallbackService`
**No Changes**: Reuse as-is

### Feature 007 (Offline Infrastructure)
**Used**: `OfflineQueueRepository`, `OfflineSyncService`
**Changes**: Extend `OfflineQueueRepository.enqueue()` with 200-limit + FIFO eviction

### Jobs Domain (Existing)
**Used**: Equipment checklist from `job_kits` table
**No Changes**: Read-only access

## Database Changes

**NONE** - All required tables exist from Features 001 and 007.

**Only Extension**:
- Add `pg_cron` scheduled job for 30-day auto-delete:
  ```sql
  SELECT cron.schedule(
    'delete-old-verifications',
    '0 0 * * *',
    $$DELETE FROM vision_verification_records WHERE created_at < NOW() - INTERVAL '30 days'$$
  );
  ```

## Validation Summary

| Requirement | Validation Rule | Enforced Where |
|-------------|----------------|----------------|
| FR-015: 200 record queue | `count(offline_queue) <= 200`, FIFO eviction | IndexedDB (client) |
| FR-026: 30-day retention | `created_at >= NOW() - 30 days` | Supabase pg_cron |
| FR-005: VLM fallback <70% | `confidence < 0.7` → VLM | UI workflow logic |
| FR-005a: 3 retries | `retryCount < 3` → retry, else VLM | UI session state |
| FR-016a: Reposition partial | `bounding_box` at edge → prompt | UI detection logic |

## Schema Diagram

```
[Existing] vision_verification_records
    ↓ (1:N)
[Existing] detected_items

[Existing] offline_queue (IndexedDB)
    → Contains: vision_verification_records (when offline)
    → FIFO eviction when count > 200

[Existing] job_kits + kit_items
    → Provides: EquipmentChecklist (read-only)

[UI State Only] VerificationSession
    → Orchestrates: camera, detection, checklist
    → Not persisted
```

**Total New Tables**: 0
**Total Modified Tables**: 1 (offline_queue - add 200 limit logic)
