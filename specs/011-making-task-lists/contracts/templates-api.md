# API Contract: Task Templates

**Base Path**: `/api/task-templates`
**Authentication**: Required (JWT with app_metadata.tenant_id)
**RLS**: Enforced via Supabase client

---

## GET /api/task-templates

**Purpose**: List all active task templates for the current tenant

### Request

```http
GET /api/task-templates HTTP/1.1
Authorization: Bearer <jwt_token>
```

**Query Parameters**:
- `jobType` (optional, string): Filter by job_type
- `includeInactive` (optional, boolean, default=false): Include inactive templates

### Response 200 OK

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "tenantId": "uuid",
      "name": "HVAC Maintenance Standard",
      "description": "Standard checklist for HVAC maintenance visits",
      "jobType": "HVAC Maintenance",
      "isActive": true,
      "itemCount": 12,
      "createdBy": "uuid",
      "createdAt": "2025-10-01T10:00:00Z",
      "updatedAt": "2025-10-15T14:30:00Z"
    }
  ]
}
```

---

## GET /api/task-templates/:id

**Purpose**: Get a specific template with all its items

### Request

```http
GET /api/task-templates/:id HTTP/1.1
Authorization: Bearer <jwt_token>
```

### Response 200 OK

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "tenantId": "uuid",
    "name": "HVAC Maintenance Standard",
    "description": "Standard checklist for HVAC maintenance visits",
    "jobType": "HVAC Maintenance",
    "isActive": true,
    "createdBy": "uuid",
    "createdAt": "2025-10-01T10:00:00Z",
    "updatedAt": "2025-10-15T14:30:00Z",
    "items": [
      {
        "id": "uuid",
        "templateId": "uuid",
        "taskOrder": 0,
        "taskDescription": "Check refrigerant levels",
        "isRequired": true,
        "requiresPhotoVerification": true,
        "requiresSupervisorApproval": false,
        "acceptanceCriteria": "Refrigerant within manufacturer spec",
        "createdAt": "2025-10-01T10:00:00Z"
      },
      {
        "id": "uuid",
        "templateId": "uuid",
        "taskOrder": 1,
        "taskDescription": "Inspect electrical connections",
        "isRequired": true,
        "requiresPhotoVerification": false,
        "requiresSupervisorApproval": false,
        "acceptanceCriteria": null,
        "createdAt": "2025-10-01T10:00:00Z"
      }
    ]
  }
}
```

### Response 404 Not Found

```json
{
  "success": false,
  "error": {
    "code": "TEMPLATE_NOT_FOUND",
    "message": "Template not found or access denied"
  }
}
```

---

## POST /api/task-templates

**Purpose**: Create a new task template with items

### Request

```http
POST /api/task-templates HTTP/1.1
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "Electrical Inspection",
  "description": "Standard electrical safety inspection",
  "jobType": "Electrical Inspection",
  "items": [
    {
      "taskOrder": 0,
      "taskDescription": "Test GFCI outlets",
      "isRequired": true,
      "requiresPhotoVerification": false,
      "requiresSupervisorApproval": false
    },
    {
      "taskOrder": 1,
      "taskDescription": "Inspect breaker panel",
      "isRequired": true,
      "requiresPhotoVerification": true,
      "requiresSupervisorApproval": false,
      "acceptanceCriteria": "No signs of overheating or damage"
    }
  ]
}
```

**Body Schema**:
```typescript
{
  name: string (1-255 chars, required, unique per tenant)
  description?: string (max 1000 chars)
  jobType?: string (max 100 chars)
  items: Array<{
    taskOrder: number (>= 0, required)
    taskDescription: string (1-500 chars, required)
    isRequired: boolean (default: true)
    requiresPhotoVerification: boolean (default: false)
    requiresSupervisorApproval: boolean (default: false)
    acceptanceCriteria?: string (max 1000 chars)
  }> (min 1 item)
}
```

### Response 201 Created

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "tenantId": "uuid",
    "name": "Electrical Inspection",
    "description": "Standard electrical safety inspection",
    "jobType": "Electrical Inspection",
    "isActive": true,
    "createdBy": "uuid",
    "createdAt": "2025-10-18T12:00:00Z",
    "updatedAt": "2025-10-18T12:00:00Z",
    "items": [...]
  }
}
```

### Response 400 Bad Request

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid template data",
    "details": [
      {
        "field": "name",
        "message": "Template name must be 1-255 characters"
      }
    ]
  }
}
```

### Response 409 Conflict

```json
{
  "success": false,
  "error": {
    "code": "TEMPLATE_NAME_EXISTS",
    "message": "A template with this name already exists for your tenant"
  }
}
```

---

## PATCH /api/task-templates/:id

**Purpose**: Update template metadata (name, description, isActive)

**Note**: To modify items, use dedicated item endpoints

### Request

```http
PATCH /api/task-templates/:id HTTP/1.1
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "HVAC Maintenance Standard v2",
  "description": "Updated checklist with new safety requirements",
  "isActive": false
}
```

**Body Schema** (all optional):
```typescript
{
  name?: string (1-255 chars)
  description?: string (max 1000 chars)
  jobType?: string (max 100 chars)
  isActive?: boolean
}
```

### Response 200 OK

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "HVAC Maintenance Standard v2",
    "description": "Updated checklist with new safety requirements",
    "isActive": false,
    "updatedAt": "2025-10-18T12:30:00Z"
  }
}
```

---

## DELETE /api/task-templates/:id

**Purpose**: Delete a template and all its items (cascade)

### Request

```http
DELETE /api/task-templates/:id HTTP/1.1
Authorization: Bearer <jwt_token>
```

### Response 200 OK

```json
{
  "success": true,
  "message": "Template deleted successfully"
}
```

### Response 409 Conflict

```json
{
  "success": false,
  "error": {
    "code": "TEMPLATE_IN_USE",
    "message": "Cannot delete template: 5 jobs are currently using this template"
  }
}
```

**Note**: Before deleting, check if any workflow_tasks reference this template_id. If yes, recommend deactivating (isActive=false) instead.

---

## POST /api/task-templates/:id/instantiate

**Purpose**: Instantiate a template into a job (create workflow_tasks from template items)

### Request

```http
POST /api/task-templates/:id/instantiate HTTP/1.1
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "jobId": "uuid"
}
```

**Body Schema**:
```typescript
{
  jobId: string (uuid, required)
}
```

### Response 201 Created

```json
{
  "success": true,
  "data": {
    "jobId": "uuid",
    "templateId": "uuid",
    "tasksCreated": 12,
    "tasks": [
      {
        "id": "uuid",
        "jobId": "uuid",
        "taskDescription": "Check refrigerant levels",
        "taskOrder": 0,
        "isRequired": true,
        "status": "pending",
        "templateId": "uuid",
        "createdAt": "2025-10-18T13:00:00Z"
      }
    ]
  }
}
```

### Response 400 Bad Request

```json
{
  "success": false,
  "error": {
    "code": "JOB_ALREADY_HAS_TASKS",
    "message": "Cannot instantiate template: job already has 5 tasks. Add items manually instead."
  }
}
```

---

## Validation Rules

### Template Creation
- `name`: Required, unique per tenant, 1-255 characters
- `items`: Must have at least 1 item
- Each item must have unique `taskOrder` within template
- `jobType`: Optional categorization for filtering

### Template Update
- Cannot rename to a name already used by another active template in tenant
- Deactivating (isActive=false) does not affect existing jobs using the template

### Template Deletion
- Cascade deletes all template_items
- Checks for active job references (workflow_tasks.template_id)
- Recommends deactivation if template in use

### Template Instantiation
- Job must exist and belong to user's tenant
- Job should not have existing tasks (warn if it does)
- All template items copied with status='pending'
- Sets template_id reference on created tasks

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `TEMPLATE_NOT_FOUND` | 404 | Template doesn't exist or user lacks access |
| `VALIDATION_ERROR` | 400 | Request body validation failed |
| `TEMPLATE_NAME_EXISTS` | 409 | Template name already used in tenant |
| `TEMPLATE_IN_USE` | 409 | Cannot delete template with active job references |
| `JOB_ALREADY_HAS_TASKS` | 400 | Job has existing tasks, instantiation not allowed |
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `FORBIDDEN` | 403 | Valid JWT but wrong tenant |

---

**Contract Version**: 1.0
**Last Updated**: 2025-10-18
