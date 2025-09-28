# JobEye v4 - Continuous Vision Verification System

## Overview
This document extends the multi-object vision system to support continuous, real-time load verification with intelligent context awareness and state persistence.

## Key Features

### 1. Continuous Camera Capture (1 FPS)
```typescript
interface ContinuousVisionConfig {
  captureRate: 1; // frames per second
  autoProcessing: true;
  backgroundMode: true;
  batteryOptimized: true;
}
```

### 2. Progressive Item Checking
- Single item detection preserves previous checks
- Multi-item detection handles batch updates
- No duplicate checking of already verified items
- Visual feedback overlay in real-time

### 3. Context-Aware Resumption
When camera reopens, system automatically detects:
- Active job based on GPS location
- Unfinished load lists in vicinity
- Previously detected containers
- Time continuity (same loading session)

## Implementation Design

### 1. Enhanced Load Verification State
```typescript
interface LoadVerificationSession {
  id: string;
  jobId: string;
  startedAt: Date;
  lastActiveAt: Date;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  
  // Persistent state
  verifiedItems: Set<string>; // Already checked items
  detectedContainers: Map<string, DetectedContainer>;
  currentContainer?: string; // Last active container
  
  // Session metadata
  totalFramesProcessed: number;
  totalItemsVerified: number;
  batteryLevelStart: number;
  networkConditions: 'wifi' | '4g' | '5g' | 'offline';
}
```

### 2. Frame Processing Pipeline
```typescript
interface FrameProcessor {
  async processFrame(
    frameData: ImageData,
    session: LoadVerificationSession,
    previousFrame?: FrameAnalysis
  ): Promise<FrameAnalysis>;
  
  async mergeWithPrevious(
    newAnalysis: FrameAnalysis,
    session: LoadVerificationSession
  ): Promise<IncrementalUpdate>;
}

interface FrameAnalysis {
  timestamp: Date;
  detectedItems: DetectedItem[];
  detectedContainers: DetectedContainer[];
  confidence: number;
  processingTimeMs: number;
}

interface IncrementalUpdate {
  newlyVerifiedItems: string[];
  maintainedItems: string[]; // Still visible
  removedItems: string[]; // No longer visible
  confidenceBoosts: Map<string, number>; // Increased confidence
}
```

### 3. Smart Context Detection
```typescript
interface ContextDetector {
  async detectActiveJob(
    location: GeolocationPosition,
    userId: string,
    companyId: string
  ): Promise<ActiveJobContext | null>;
  
  async matchContainerToJob(
    detectedContainer: DetectedContainer,
    nearbyJobs: Job[]
  ): Promise<JobContainerMatch | null>;
}

interface ActiveJobContext {
  job: Job;
  loadList: JobChecklistItem[];
  unfinishedItems: JobChecklistItem[];
  lastActivity?: Date;
  confidenceScore: number; // How sure we are this is the right job
}

interface JobContainerMatch {
  jobId: string;
  containerId: string;
  matchConfidence: number;
  matchReasons: string[]; // ["gps_proximity", "container_id_match", "time_continuity"]
}
```

### 4. Real-Time UI Feedback
```typescript
interface LoadVerificationUI {
  // Camera overlay components
  cameraPreview: {
    fps: 1;
    overlayMode: 'minimal' | 'detailed';
    showBoundingBoxes: boolean;
    showConfidence: boolean;
  };
  
  // Item status indicators
  itemFeedback: {
    checkAnimation: 'slide' | 'fade' | 'bounce';
    successColor: string;
    pendingColor: string;
    errorColor: string;
  };
  
  // Container indicators
  containerDisplay: {
    showActiveContainer: boolean;
    showCapacityBar: boolean;
    showItemCount: boolean;
  };
  
  // Progress tracking
  progressIndicators: {
    itemsComplete: number;
    itemsTotal: number;
    estimatedTimeRemaining?: number;
  };
}
```

### 5. State Persistence
```typescript
// Local storage for session continuity
interface VerificationStateStore {
  async saveSession(session: LoadVerificationSession): Promise<void>;
  async loadSession(jobId: string): Promise<LoadVerificationSession | null>;
  async clearOldSessions(olderThan: Date): Promise<void>;
}

// Sync with backend
interface VerificationSync {
  async syncProgress(
    session: LoadVerificationSession,
    checkpoint: boolean = false
  ): Promise<void>;
  
  async resolveConflicts(
    local: LoadVerificationSession,
    remote: LoadVerification
  ): Promise<LoadVerificationSession>;
}
```

## User Experience Flow

### 1. Initial Loading
```
User opens job → Taps camera icon → Camera activates
                                  ↓
                        1 FPS capture begins
                                  ↓
                   First container detected → Job matched
                                  ↓
                   Items start checking off automatically
```

### 2. Continuous Loading
```
User loads item → Points camera → Item detected → ✓ Checked
        ↓                                              ↓
  Loads another                               Previous checks maintained
        ↓                                              ↓
  Multiple items visible → All processed → Only new items checked
```

### 3. Interrupted Flow
```
User closes app → Returns later → Opens camera
                                       ↓
                              GPS check → Same location?
                                       ↓
                           Container detected → Matches previous?
                                       ↓
                           Load list resumes → Continue checking
```

### 4. Automatic Context Switch
```
User at job site → Multiple trucks → Points at Truck A
                                            ↓
                                    System detects VH-TKR
                                            ↓
                                 Loads Job #123 checklist
                                            ↓
User walks to Truck B → Camera detects TR-DU12R
                                 ↓
                      Auto-switches to Job #456 checklist
```

## Database Schema Extensions

### 1. Verification Sessions Table
```sql
CREATE TABLE verification_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(id),
  user_id UUID NOT NULL REFERENCES users(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Location tracking
  start_location GEOGRAPHY(POINT),
  last_location GEOGRAPHY(POINT),
  location_accuracy FLOAT,
  
  -- Session state
  verified_items UUID[], -- job_checklist_items.id
  detected_containers JSONB DEFAULT '[]'::jsonb,
  current_container_id UUID REFERENCES containers(id),
  
  -- Metrics
  total_frames_processed INT DEFAULT 0,
  total_items_verified INT DEFAULT 0,
  total_processing_time_ms INT DEFAULT 0,
  
  -- Device info
  device_info JSONB,
  app_version VARCHAR(50),
  
  is_active BOOLEAN DEFAULT true,
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Frame analysis cache (for recovery/debugging)
CREATE TABLE frame_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES verification_sessions(id),
  frame_number INT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  
  -- Analysis results
  detected_items JSONB,
  detected_containers JSONB,
  incremental_updates JSONB,
  
  -- Performance
  processing_time_ms INT,
  model_used VARCHAR(100),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(session_id, frame_number)
);
```

### 2. Indexes for Performance
```sql
-- Spatial index for GPS-based job detection
CREATE INDEX idx_sessions_location ON verification_sessions USING GIST (last_location);
CREATE INDEX idx_sessions_active_job ON verification_sessions(job_id, is_active);
CREATE INDEX idx_frame_analyses_session ON frame_analyses(session_id, frame_number);
```

## API Endpoints

### 1. Start/Resume Session
```typescript
POST /api/jobs/{jobId}/verification/session
Body: {
  location: { latitude, longitude, accuracy },
  deviceInfo?: { model, os, appVersion }
}
Response: {
  sessionId: string,
  existingSession: boolean,
  verifiedItems: string[],
  unfinishedItems: JobChecklistItem[],
  detectedContainers: Container[]
}
```

### 2. Process Frame
```typescript
POST /api/verification/session/{sessionId}/frame
Body: {
  frameData: string, // base64 image
  frameNumber: number,
  timestamp: string,
  location?: { latitude, longitude }
}
Response: {
  newlyVerified: string[],
  allVerified: string[],
  detectedContainers: Container[],
  suggestions?: string[], // "Move closer to chainsaw"
  warnings?: string[] // "Item in wrong container"
}
```

### 3. Get Nearby Active Jobs
```typescript
GET /api/jobs/nearby?lat={lat}&lng={lng}&radius={meters}
Response: {
  jobs: Array<{
    id: string,
    distance: number,
    unfinishedItems: number,
    assignedContainers: Container[],
    lastActivity?: string
  }>
}
```

## Performance Optimizations

### 1. Frame Processing
- Skip identical frames (motion detection)
- Downscale images before processing
- Cache container detections (they don't move)
- Progressive JPEG for slow connections

### 2. Battery Optimization
- Reduce FPS when no motion detected
- Pause processing when battery < 20%
- Use on-device models when available
- Batch API calls

### 3. Offline Support
- Queue frames for later processing
- Use cached job data
- Store verification state locally
- Sync when connection restored

## Security Considerations

### 1. Location Privacy
- Only store location during active sessions
- Automatic cleanup after 24 hours
- User can disable location features

### 2. Image Privacy  
- Images processed but not stored by default
- Optional image retention for disputes
- Automatic deletion after verification

### 3. Multi-Tenant Isolation
- GPS queries respect company boundaries
- Container matching within company only
- Session data fully isolated

## Conclusion

This continuous vision verification system transforms the loading process into a seamless, context-aware experience. Field workers simply open the camera and load items naturally - the system handles all the complexity of tracking, matching, and verifying in real-time. The intelligent resumption and context detection ensure that work can be interrupted and resumed without any manual steps, making the technology truly invisible to the user.