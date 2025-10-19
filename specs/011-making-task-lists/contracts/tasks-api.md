# API Contract: Job Tasks

**Base Path**: `/api/jobs/:jobId/tasks`
**Authentication**: Required (JWT with app_metadata.tenant_id)
**RLS**: Enforced via Supabase client

---

## GET /api/jobs/:jobId/tasks

**Purpose**: List all non-deleted tasks for a job

### Request

```http
GET /api/jobs/:jobId/tasks HTTP/1.1
Authorization: Bearer <jwt_token>
```

**Query Parameters**:
- `includeDeleted` (optional, boolean, default=false): Include soft-deleted tasks

### Response 200 OK

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "jobId": "uuid",
      "taskDescription": "Check oil level",
      "taskOrder": 0,
      "status": "pending",
      "isRequired": true,
      "isDeleted": false,
      "requiresPhotoVerification": false,
      "requiresSupervisorApproval": false,
      "completedBy": null,
      "completedAt": null,
      "verificationPhotoUrl": null,
      "aiConfidence": null,
      "verificationMethod": "manual",
      "verificationData": {},
      "supervisorApproved": null,
      "supervisorNotes": null,
      "templateId": "uuid",
      "createdAt": "2025-10-18T10:00:00Z",
      "updatedAt": "2025-10-18T10:00:00Z"
    }
  ]
}
```

### Response 404 Not Found

```json
{
  "success": false,
  "error": {
    "code": "JOB_NOT_FOUND",
    "message": "Job not found or access denied"
  }
}
```

---

## POST /api/jobs/:jobId/tasks

**Purpose**: Create a new task for a job

### Request

```http
POST /api/jobs/:jobId/tasks HTTP/1.1
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "taskDescription": "Check backup generator",
  "taskOrder": 5,
  "isRequired": true,
  "requiresPhotoVerification": true,
  "requiresSupervisorApproval": false,
  "acceptanceCriteria": "Generator starts within 30 seconds"
}
```

**Body Schema**:
```typescript
{
  taskDescription: string (1-500 chars, required)
  taskOrder: number (>= 0, required)
  isRequired: boolean (default: true)
  requiresPhotoVerification: boolean (default: false)
  requiresSupervisorApproval: boolean (default: false)
  acceptanceCriteria?: string (max 1000 chars)
}
```

### Response 201 Created

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "jobId": "uuid",
    "taskDescription": "Check backup generator",
    "taskOrder": 5,
    "status": "pending",
    "isRequired": true,
    "isDeleted": false,
    "requiresPhotoVerification": true,
    "requiresSupervisorApproval": false,
    "createdAt": "2025-10-18T10:05:00Z",
    "updatedAt": "2025-10-18T10:05:00Z"
  }
}
```

### Response 400 Bad Request

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid task data",
    "details": [
      {
        "field": "taskDescription",
        "message": "Task description must be 1-500 characters"
      }
    ]
  }
}
```

---

## PATCH /api/jobs/:jobId/tasks/:taskId

**Purpose**: Update a task (status, completion, verification)

### Request

```http
PATCH /api/jobs/:jobId/tasks/:taskId HTTP/1.1
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "status": "complete",
  "completedAt": "2025-10-18T11:00:00Z",
  "verificationPhotoUrl": "https://storage.supabase.co/...",
  "aiConfidence": 0.95,
  "verificationMethod": "vlm",
  "verificationData": {
    "model": "gpt-4-vision",
    "cost": 0.15,
    "prompt": "Verify oil level check..."
  }
}
```

**Body Schema** (all optional):
```typescript
{
  taskDescription?: string (1-500 chars)
  taskOrder?: number (>= 0)
  status?: 'pending' | 'in-progress' | 'complete' | 'skipped' | 'failed'
  completedAt?: string (ISO 8601)
  verificationPhotoUrl?: string (URL)
  aiConfidence?: number (0.0-1.0)
  verificationMethod?: 'manual' | 'vlm' | 'yolo'
  verificationData?: object
  supervisorNotes?: string (max 1000 chars)
}
```

### Response 200 OK

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "complete",
    "completedBy": "uuid",
    "completedAt": "2025-10-18T11:00:00Z",
    "verificationPhotoUrl": "https://storage.supabase.co/...",
    "aiConfidence": 0.95,
    "updatedAt": "2025-10-18T11:00:05Z"
  }
}
```

### Response 409 Conflict

```json
{
  "success": false,
  "error": {
    "code": "PHOTO_VERIFICATION_REQUIRED",
    "message": "Cannot complete task: photo verification required but not provided"
  }
}
```

---

## DELETE /api/jobs/:jobId/tasks/:taskId

**Purpose**: Soft-delete a task (sets is_deleted=true)

### Request

```http
DELETE /api/jobs/:jobId/tasks/:taskId HTTP/1.1
Authorization: Bearer <jwt_token>
```

### Response 200 OK

```json
{
  "success": true,
  "message": "Task marked as deleted"
}
```

### Response 409 Conflict

```json
{
  "success": false,
  "error": {
    "code": "JOB_ALREADY_STARTED",
    "message": "Cannot delete task: job has already started. Task will be marked as deleted instead."
  }
}
```

**Note**: After job starts (actual_start set), DELETE always soft-deletes (sets is_deleted=true) instead of hard-deleting.

---

## Validation Rules

### Task Creation
- `taskDescription`: Required, 1-500 characters
- `taskOrder`: Required, >= 0, duplicate orders allowed (app handles sorting)
- `isRequired`: Optional, defaults to true
- Must have valid `jobId` that user's tenant can access

### Task Update
- Cannot change `isRequired` from true to false after job starts
- Cannot set status='complete' if `requiresPhotoVerification=true` without `verificationPhotoUrl`
- Setting status='complete' auto-sets `completedBy` to current user and `completedAt` to now()
- `aiConfidence` only valid when `verificationMethod` in ('vlm', 'yolo')

### Task Deletion
- Before job starts: Hard delete allowed
- After job starts: Soft delete only (is_deleted=true)
- Deleted tasks still count in task_order to preserve sequence

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `JOB_NOT_FOUND` | 404 | Job doesn't exist or user lacks access |
| `TASK_NOT_FOUND` | 404 | Task doesn't exist or user lacks access |
| `VALIDATION_ERROR` | 400 | Request body validation failed |
| `PHOTO_VERIFICATION_REQUIRED` | 409 | Tried to complete task requiring photo without photo |
| `JOB_ALREADY_STARTED` | 409 | Tried to hard-delete after job started |
| `REQUIRED_TASK_INCOMPLETE` | 409 | Tried to complete job with incomplete required tasks |
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `FORBIDDEN` | 403 | Valid JWT but wrong tenant |

---

**Contract Version**: 1.0
**Last Updated**: 2025-10-18
