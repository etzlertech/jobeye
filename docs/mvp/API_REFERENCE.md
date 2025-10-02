# MVP API Reference

> **Feature 007**: Intent-Driven Mobile App API Documentation

## Base Configuration

- **Base URL**: `http://localhost:3000/api` (development)
- **Authentication**: Supabase JWT tokens
- **Content-Type**: `application/json`
- **File Uploads**: `multipart/form-data`

## Authentication

All API endpoints require authentication via Supabase JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

Role-based access control is enforced at the middleware level:
- **Super Admin**: Full access to all endpoints
- **Supervisor**: Job management and crew oversight
- **Crew Member**: Job execution and verification

## Intent Recognition API

### POST /api/intent/recognize

Analyze uploaded image to determine user intent and trigger appropriate workflow.

**Request:**
```typescript
interface IntentRecognizeRequest {
  image: File;              // Image file for analysis
  context?: string;         // Optional context (job_id, location)
  user_role: 'supervisor' | 'crew';
  timestamp?: string;       // ISO timestamp
}
```

**Response:**
```typescript
interface IntentRecognizeResponse {
  intent: {
    type: 'inventory' | 'job_load' | 'receipt' | 'maintenance' | 'unknown';
    confidence: number;     // 0.0 - 1.0
    description: string;
    workflow_trigger?: string;
  };
  detected_items?: string[];
  next_action: {
    type: 'navigate' | 'capture_more' | 'confirm' | 'manual_entry';
    description: string;
    route?: string;
  };
  cost: number;             // VLM processing cost
  processing_time: number;  // Milliseconds
}
```

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -F "image=@equipment_photo.jpg" \
  -F "context=job_123" \
  -F "user_role=crew" \
  http://localhost:3000/api/intent/recognize
```

### GET /api/intent/history

Get intent recognition history for the current user.

**Query Parameters:**
- `limit`: Number of records (default: 50, max: 100)
- `offset`: Pagination offset
- `intent_type`: Filter by intent type
- `date_from`: Start date (ISO string)
- `date_to`: End date (ISO string)

**Response:**
```typescript
interface IntentHistoryResponse {
  intents: Array<{
    id: string;
    intent_type: string;
    confidence: number;
    detected_items: string[];
    created_at: string;
    cost: number;
    image_url?: string;
  }>;
  total_count: number;
  has_more: boolean;
}
```

## Supervisor API

### POST /api/supervisor/jobs

Create a new job assignment with voice instructions.

**Request:**
```typescript
interface CreateJobRequest {
  title: string;
  description?: string;
  assigned_crew_ids: string[];
  scheduled_date: string;     // ISO date
  location: {
    address: string;
    coordinates?: [number, number]; // [lat, lng]
  };
  equipment_list: string[];
  voice_instruction?: {
    audio_blob: Blob;
    transcript?: string;
    duration: number;
  };
  priority: 'low' | 'medium' | 'high';
  estimated_duration?: number; // Minutes
}
```

**Response:**
```typescript
interface CreateJobResponse {
  job: {
    id: string;
    title: string;
    status: 'scheduled';
    assigned_crew: Array<{
      id: string;
      name: string;
      role: string;
    }>;
    voice_instruction_url?: string;
    created_at: string;
  };
  notifications_sent: number;
}
```

### GET /api/supervisor/jobs

List jobs created by the supervisor.

**Query Parameters:**
- `status`: Filter by job status
- `date_from`: Start date
- `date_to`: End date
- `crew_id`: Filter by assigned crew
- `limit`: Page size (default: 20)
- `offset`: Pagination offset

**Response:**
```typescript
interface SupervisorJobsResponse {
  jobs: Array<{
    id: string;
    title: string;
    status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
    assigned_crew: Array<{ id: string; name: string; }>;
    scheduled_date: string;
    completion_date?: string;
    load_verified: boolean;
    created_at: string;
  }>;
  total_count: number;
  has_more: boolean;
}
```

### POST /api/supervisor/voice

Upload voice instruction for a job.

**Request:**
- `Content-Type: multipart/form-data`
- `job_id`: Job identifier
- `audio`: Audio file (WAV, MP3, or WebM)
- `transcript`: Optional text transcript

**Response:**
```typescript
interface VoiceUploadResponse {
  voice_instruction: {
    id: string;
    url: string;
    duration: number;
    transcript?: string;
    uploaded_at: string;
  };
}
```

## Crew API

### GET /api/crew/jobs

Get jobs assigned to the current crew member.

**Query Parameters:**
- `date`: Specific date (ISO date string, defaults to today)
- `status`: Filter by job status
- `include_completed`: Include completed jobs (boolean)

**Response:**
```typescript
interface CrewJobsResponse {
  jobs: Array<{
    id: string;
    title: string;
    description?: string;
    status: 'scheduled' | 'in_progress' | 'completed';
    location: {
      address: string;
      coordinates?: [number, number];
    };
    equipment_list: string[];
    voice_instruction_url?: string;
    scheduled_time?: string;
    supervisor: {
      id: string;
      name: string;
    };
    load_verified: boolean;
  }>;
  daily_stats: {
    total_jobs: number;
    completed_jobs: number;
    remaining_jobs: number;
  };
}
```

### PATCH /api/crew/jobs/:id

Update job status or add completion details.

**Request:**
```typescript
interface UpdateJobRequest {
  status?: 'in_progress' | 'completed';
  completion_notes?: string;
  completion_photos?: File[];
  voice_note?: {
    audio_blob: Blob;
    transcript?: string;
    duration: number;
  };
  location_confirmation?: boolean;
}
```

**Response:**
```typescript
interface UpdateJobResponse {
  job: {
    id: string;
    status: string;
    updated_at: string;
    completion_details?: {
      notes?: string;
      photos: string[];
      voice_note_url?: string;
      completed_at: string;
    };
  };
}
```

### POST /api/crew/verify

Submit load verification with equipment photos.

**Request:**
- `Content-Type: multipart/form-data`
- `job_id`: Job identifier
- `photos`: Array of image files
- `verification_type`: 'pre_job' | 'post_job'
- `notes`: Optional verification notes

**Response:**
```typescript
interface LoadVerificationResponse {
  verification: {
    id: string;
    job_id: string;
    verification_type: string;
    photos: Array<{
      url: string;
      thumbnail_url: string;
      detected_items: string[];
      confidence_score: number;
    }>;
    status: 'verified' | 'issues_found' | 'pending_review';
    created_at: string;
  };
  missing_equipment?: string[];
  next_steps?: string;
}
```

## Vision Integration API

### POST /api/vision/verify

Equipment verification using computer vision.

**Request:**
```typescript
interface VisionVerifyRequest {
  image: File;
  kit_id?: string;
  job_id?: string;
  expected_items?: string[];
  verification_type: 'equipment' | 'inventory' | 'damage_assessment';
}
```

**Response:**
```typescript
interface VisionVerifyResponse {
  verification: {
    verified: boolean;
    confidence: number;
    detected_items: Array<{
      name: string;
      confidence: number;
      bounding_box?: [number, number, number, number];
    }>;
    missing_items: string[];
    unexpected_items: string[];
  };
  cost: number;
  processing_method: 'local_yolo' | 'cloud_vlm';
  processing_time: number;
}
```

### GET /api/vision/cost/summary

Get VLM usage and cost summary.

**Query Parameters:**
- `period`: 'today' | 'week' | 'month'
- `breakdown`: Include detailed breakdown (boolean)

**Response:**
```typescript
interface CostSummaryResponse {
  period: string;
  total_cost: number;
  budget_limit: number;
  usage_percentage: number;
  request_count: number;
  average_cost_per_request: number;
  breakdown?: {
    local_requests: number;
    cloud_requests: number;
    cost_by_day: Array<{
      date: string;
      cost: number;
      requests: number;
    }>;
  };
  warnings?: string[];
}
```

## Field Intelligence API

### POST /api/field-intelligence/time/timesheets

Submit timesheet data for field work.

**Request:**
```typescript
interface TimesheetRequest {
  job_id: string;
  start_time: string;        // ISO timestamp
  end_time?: string;         // ISO timestamp
  break_duration?: number;   // Minutes
  activities: Array<{
    type: string;
    duration: number;        // Minutes
    description?: string;
  }>;
  location_logs: Array<{
    timestamp: string;
    coordinates: [number, number];
    accuracy?: number;
  }>;
}
```

**Response:**
```typescript
interface TimesheetResponse {
  timesheet: {
    id: string;
    job_id: string;
    total_hours: number;
    status: 'draft' | 'submitted' | 'approved';
    created_at: string;
  };
  warnings?: string[];
}
```

## Health & Status API

### GET /api/health

System health check endpoint.

**Response:**
```typescript
interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: 'up' | 'down';
    storage: 'up' | 'down';
    vision_api: 'up' | 'down';
    voice_processing: 'up' | 'down';
  };
  version: string;
}
```

## Error Handling

All API endpoints return consistent error responses:

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
  };
  request_id: string;
}
```

### Common Error Codes

- `AUTH_REQUIRED`: Authentication token missing or invalid
- `INSUFFICIENT_PERMISSIONS`: User lacks required role permissions
- `VALIDATION_ERROR`: Request validation failed
- `RESOURCE_NOT_FOUND`: Requested resource doesn't exist
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `FILE_TOO_LARGE`: Uploaded file exceeds size limit
- `UNSUPPORTED_FILE_TYPE`: Invalid file format
- `STORAGE_QUOTA_EXCEEDED`: Storage limit reached
- `VLM_BUDGET_EXCEEDED`: Daily VLM cost limit reached
- `SERVICE_UNAVAILABLE`: External service temporarily unavailable

### HTTP Status Codes

- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `413`: Payload Too Large
- `422`: Unprocessable Entity
- `429`: Too Many Requests
- `500`: Internal Server Error
- `503`: Service Unavailable

## Rate Limiting

API endpoints are rate limited to prevent abuse:

- **Authentication**: 5 requests per minute
- **File Upload**: 10 requests per minute
- **Vision API**: 20 requests per hour (due to cost constraints)
- **Standard API**: 100 requests per minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## SDK Usage Examples

### JavaScript/TypeScript

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Recognize intent from image
async function recognizeIntent(imageFile: File) {
  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('user_role', 'crew');
  
  const response = await fetch('/api/intent/recognize', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`
    },
    body: formData
  });
  
  return response.json();
}

// Create job with voice instruction
async function createJob(jobData: CreateJobRequest) {
  const response = await fetch('/api/supervisor/jobs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify(jobData)
  });
  
  return response.json();
}
```

### React Hook Usage

```typescript
import { useVoiceNavigation } from '@/hooks/use-voice-navigation';

function JobManagement() {
  const voiceNav = useVoiceNavigation({
    context: 'job-management',
    customCommands: [
      {
        command: 'create new job',
        handler: () => router.push('/supervisor/jobs/create'),
        description: 'Navigate to job creation page'
      }
    ]
  });

  return (
    <div>
      {/* Component content */}
    </div>
  );
}
```

## WebSocket Real-time Updates

For real-time features, the app uses Supabase real-time subscriptions:

```typescript
// Subscribe to job updates
const subscription = supabase
  .channel('job-updates')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'jobs',
    filter: `assigned_crew_id=eq.${userId}`
  }, (payload) => {
    console.log('Job updated:', payload.new);
  })
  .subscribe();
```

## Testing API Endpoints

### Using curl

```bash
# Health check
curl http://localhost:3000/api/health

# Recognize intent (with authentication)
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -F "image=@photo.jpg" \
  -F "user_role=crew" \
  http://localhost:3000/api/intent/recognize

# Get crew jobs
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/crew/jobs
```

### Using HTTPie

```bash
# Create job
http POST localhost:3000/api/supervisor/jobs \
  Authorization:"Bearer <token>" \
  title="Equipment Check" \
  assigned_crew_ids:='["crew-123"]' \
  scheduled_date="2025-01-28" \
  equipment_list:='["mower", "trimmer"]'
```

---

This API reference covers all MVP endpoints. For implementation details, see the source code in `/src/app/api/` directory.