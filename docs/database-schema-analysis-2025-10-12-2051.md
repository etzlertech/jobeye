# Database Schema Analysis
Generated: 2025-10-12-2051

## Tables Found

### ✅ tenants

Columns:
- `id`
- `name`
- `slug`
- `status`
- `plan`
- `settings`
- `created_at`
- `updated_at`
- `created_by`

Sample data structure:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Demo Company",
  "slug": "demo-company",
  "status": "active",
  "plan": "free",
  "settings": {
    "features": {
      "maxItems": 1000,
      "maxUsers": 10,
      "advancedReporting": false
    }
  },
  "created_at": "2025-10-13T01:32:46.935586+00:00",
  "updated_at": "2025-10-13T01:32:46.935586+00:00",
  "created_by": null
}
```

### ✅ tenant_members

Columns:
- `id`
- `tenant_id`
- `user_id`
- `role`
- `status`
- `joined_at`
- `invited_at`
- `invited_by`
- `updated_at`

Sample data structure:
```json
{
  "id": "28d742ec-42b7-4e64-8512-e7df6bd7bbe9",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "38f002ce-c28b-4f0c-87fb-0c17b872ea93",
  "role": "tenant_admin",
  "status": "active",
  "joined_at": "2025-10-13T01:32:47.558+00:00",
  "invited_at": null,
  "invited_by": null,
  "updated_at": "2025-10-13T01:32:47.649017+00:00"
}
```

### ✅ tenant_invitations

(Empty table - no columns detected)

### ✅ users_extended

Columns:
- `id`
- `tenant_id`
- `role`
- `display_name`
- `first_name`
- `last_name`
- `phone`
- `avatar_url`
- `timezone`
- `preferred_language`
- `is_active`
- `email_verified_at`
- `phone_verified_at`
- `last_login_at`
- `password_changed_at`
- `terms_accepted_at`
- `privacy_policy_accepted_at`
- `marketing_consent`
- `two_factor_enabled`
- `failed_login_attempts`
- `locked_until`
- `metadata`
- `created_at`
- `updated_at`

Sample data structure:
```json
{
  "id": "030e96c1-f7e6-4059-bf48-99bb255e242a",
  "tenant_id": "00000000-0000-0000-0000-000000000099",
  "role": "customer",
  "display_name": null,
  "first_name": null,
  "last_name": null,
  "phone": null,
  "avatar_url": null,
  "timezone": "UTC",
  "preferred_language": "en-US",
  "is_active": true,
  "email_verified_at": null,
  "phone_verified_at": null,
  "last_login_at": null,
  "password_changed_at": "2025-09-30T06:10:07.852044+00:00",
  "terms_accepted_at": null,
  "privacy_policy_accepted_at": null,
  "marketing_consent": false,
  "two_factor_enabled": false,
  "failed_login_attempts": 0,
  "locked_until": null,
  "metadata": {},
  "created_at": "2025-09-30T06:10:07.852044+00:00",
  "updated_at": "2025-09-30T06:10:07.852044+00:00"
}
```

### ✅ user_sessions

(Empty table - no columns detected)

### ✅ auth_audit_log

Columns:
- `id`
- `event_type`
- `user_id`
- `user_email`
- `tenant_id`
- `session_id`
- `ip_address`
- `user_agent`
- `device_type`
- `location`
- `success`
- `reason`
- `error_code`
- `risk_score`
- `details`
- `voice_command`
- `voice_confidence`
- `created_at`

Sample data structure:
```json
{
  "id": "5727c808-0be0-4087-bdaa-96bce5207b79",
  "event_type": "registration_failed",
  "user_id": null,
  "user_email": "test-1758986334256-mjlsn@jobeye.test",
  "tenant_id": null,
  "session_id": null,
  "ip_address": null,
  "user_agent": null,
  "device_type": null,
  "location": null,
  "success": false,
  "reason": "Profile creation failed: column \"is_default\" does not exist",
  "error_code": "42703",
  "risk_score": null,
  "details": {
    "error": "column \"is_default\" does not exist"
  },
  "voice_command": null,
  "voice_confidence": null,
  "created_at": "2025-09-27T15:18:54.797611+00:00"
}
```

### ✅ customers

Columns:
- `id`
- `tenant_id`
- `customer_number`
- `name`
- `email`
- `phone`
- `mobile_phone`
- `billing_address`
- `service_address`
- `notes`
- `tags`
- `voice_notes`
- `is_active`
- `metadata`
- `created_at`
- `updated_at`
- `created_by`
- `version`
- `intake_session_id`

Sample data structure:
```json
{
  "id": "e5f3c30a-52f3-42e6-93a3-664a4a5d18cf",
  "tenant_id": "86a0f1f5-30cd-4891-a7d9-bfc85d8b259e",
  "customer_number": "CUST-1758986343919",
  "name": "Test Customer 1758986343919",
  "email": "test-1758986343919-snpa58@jobeye.test",
  "phone": "555-4405",
  "mobile_phone": null,
  "billing_address": {
    "zip": "12345",
    "city": "Test City",
    "state": "CA",
    "street": "123 Test St"
  },
  "service_address": null,
  "notes": null,
  "tags": null,
  "voice_notes": null,
  "is_active": true,
  "metadata": {},
  "created_at": "2025-09-27T15:19:04.289025+00:00",
  "updated_at": "2025-09-27T15:19:04.289025+00:00",
  "created_by": null,
  "version": 1,
  "intake_session_id": null
}
```

### ✅ properties

Columns:
- `id`
- `tenant_id`
- `customer_id`
- `property_number`
- `name`
- `address`
- `location`
- `property_type`
- `size_sqft`
- `lot_size_acres`
- `zones`
- `access_notes`
- `gate_code`
- `special_instructions`
- `voice_navigation_notes`
- `photos`
- `is_active`
- `metadata`
- `created_at`
- `updated_at`
- `intake_session_id`
- `reference_image_id`

Sample data structure:
```json
{
  "id": "6a4f9b4f-d14d-479a-bec4-ada976d9449a",
  "tenant_id": "86a0f1f5-30cd-4891-a7d9-bfc85d8b259e",
  "customer_id": "e5f3c30a-52f3-42e6-93a3-664a4a5d18cf",
  "property_number": "PROP-1758986344562-1",
  "name": "Main Property",
  "address": {
    "street": "123 Main St"
  },
  "location": null,
  "property_type": null,
  "size_sqft": null,
  "lot_size_acres": null,
  "zones": null,
  "access_notes": null,
  "gate_code": null,
  "special_instructions": null,
  "voice_navigation_notes": null,
  "photos": [],
  "is_active": true,
  "metadata": {},
  "created_at": "2025-09-27T15:19:04.804143+00:00",
  "updated_at": "2025-09-27T15:19:04.804143+00:00",
  "intake_session_id": null,
  "reference_image_id": null
}
```

### ✅ jobs

Columns:
- `id`
- `tenant_id`
- `job_number`
- `template_id`
- `customer_id`
- `property_id`
- `title`
- `description`
- `status`
- `priority`
- `scheduled_start`
- `scheduled_end`
- `actual_start`
- `actual_end`
- `assigned_to`
- `assigned_team`
- `estimated_duration`
- `actual_duration`
- `completion_notes`
- `voice_notes`
- `voice_created`
- `voice_session_id`
- `checklist_items`
- `materials_used`
- `equipment_used`
- `photos_before`
- `photos_after`
- `signature_required`
- `signature_data`
- `billing_info`
- `metadata`
- `created_at`
- `updated_at`
- `created_by`
- `arrival_photo_id`
- `arrival_confirmed_at`
- `completion_quality_score`
- `requires_supervisor_review`
- `arrival_timestamp`
- `arrival_gps_coords`
- `arrival_method`
- `arrival_confidence`
- `completion_timestamp`
- `completion_photo_url`
- `tool_reload_verified`
- `offline_modified_at`
- `offline_modified_by`
- `special_instructions_audio`
- `estimated_duration_minutes`
- `actual_duration_minutes`
- `completion_photo_urls`

Sample data structure:
```json
{
  "id": "bace6afd-c0da-4d28-9923-1a52e5089e8b",
  "tenant_id": "00000000-0000-0000-0000-000000000099",
  "job_number": "JOB-DUPE-1759214446791",
  "template_id": null,
  "customer_id": "00000000-0000-0000-0000-000000000001",
  "property_id": "00000000-0000-0000-0000-000000000002",
  "title": "Commercial Property - Green Acres HOA",
  "description": null,
  "status": "completed",
  "priority": "normal",
  "scheduled_start": "2025-10-01T14:00:00+00:00",
  "scheduled_end": null,
  "actual_start": "2025-09-30T06:40:52.01+00:00",
  "actual_end": "2025-09-30T06:40:52.132+00:00",
  "assigned_to": "231504d8-05e3-403f-afeb-e2bb3f030cd0",
  "assigned_team": null,
  "estimated_duration": 120,
  "actual_duration": null,
  "completion_notes": "Property A service completed - herbicide application",
  "voice_notes": "Job paused - waiting for materials. Request: 17fee7f2-5c42-421e-b9ff-62aa0992b70c",
  "voice_created": false,
  "voice_session_id": null,
  "checklist_items": [
    {
      "icon": "\ud83d\ude9c",
      "name": "Commercial Mower (60\")",
      "checked": false,
      "category": "primary"
    },
    {
      "icon": "\ud83d\ude9c",
      "name": "Zero-Turn Mower",
      "checked": false,
      "category": "primary"
    },
    {
      "icon": "\u2702\ufe0f",
      "name": "String Trimmer",
      "checked": false,
      "category": "primary",
      "quantity": 2
    },
    {
      "icon": "\ud83d\udd2a",
      "name": "Edger",
      "checked": false,
      "category": "primary",
      "quantity": 2
    },
    {
      "icon": "\ud83c\udf92",
      "name": "Backpack Blower",
      "checked": false,
      "category": "primary",
      "quantity": 2
    },
    {
      "icon": "\ud83d\udea7",
      "name": "Safety Cones",
      "checked": false,
      "category": "safety",
      "quantity": 6
    },
    {
      "icon": "\ud83e\uddba",
      "name": "Team Safety Gear",
      "checked": false,
      "category": "safety",
      "quantity": 2
    },
    {
      "icon": "\u26fd",
      "name": "Gas Can (5 gal)",
      "checked": false,
      "category": "support",
      "quantity": 2
    },
    {
      "icon": "\ud83d\udee2\ufe0f",
      "name": "2-Cycle Mix",
      "checked": false,
      "category": "support",
      "quantity": 4
    },
    {
      "icon": "\ud83d\ude9b",
      "name": "Trailer",
      "checked": false,
      "category": "support"
    },
    {
      "icon": "\u2702\ufe0f",
      "name": "Hedge Trimmer",
      "checked": false,
      "category": "primary"
    },
    {
      "icon": "\ud83c\udf3f",
      "name": "Mulch (bags)",
      "checked": false,
      "category": "materials",
      "quantity": 20
    }
  ],
  "materials_used": [],
  "equipment_used": null,
  "photos_before": [],
  "photos_after": [],
  "signature_required": false,
  "signature_data": null,
  "billing_info": null,
  "metadata": {},
  "created_at": "2025-09-30T06:40:46.911091+00:00",
  "updated_at": "2025-10-02T04:21:48.155903+00:00",
  "created_by": null,
  "arrival_photo_id": null,
  "arrival_confirmed_at": null,
  "completion_quality_score": null,
  "requires_supervisor_review": false,
  "arrival_timestamp": null,
  "arrival_gps_coords": null,
  "arrival_method": null,
  "arrival_confidence": null,
  "completion_timestamp": null,
  "completion_photo_url": null,
  "tool_reload_verified": false,
  "offline_modified_at": null,
  "offline_modified_by": null,
  "special_instructions_audio": null,
  "estimated_duration_minutes": null,
  "actual_duration_minutes": null,
  "completion_photo_urls": null
}
```

### ✅ items

Columns:
- `id`
- `tenant_id`
- `item_type`
- `category`
- `tracking_mode`
- `name`
- `description`
- `manufacturer`
- `model`
- `serial_number`
- `sku`
- `barcode`
- `current_quantity`
- `unit_of_measure`
- `min_quantity`
- `max_quantity`
- `reorder_point`
- `current_location_id`
- `home_location_id`
- `assigned_to_user_id`
- `assigned_to_job_id`
- `status`
- `condition`
- `last_maintenance_date`
- `next_maintenance_date`
- `purchase_date`
- `purchase_price`
- `current_value`
- `depreciation_method`
- `attributes`
- `tags`
- `custom_fields`
- `primary_image_url`
- `image_urls`
- `created_at`
- `created_by`
- `updated_at`
- `updated_by`
- `thumbnail_url`
- `medium_url`

Sample data structure:
```json
{
  "id": "4a276f92-22c9-4871-afe7-e8a7ad110a9f",
  "tenant_id": "00000000-0000-0000-0000-000000000000",
  "item_type": "equipment",
  "category": "lawn-care",
  "tracking_mode": "individual",
  "name": "Test Lawn Mower",
  "description": "Test from API script",
  "manufacturer": null,
  "model": null,
  "serial_number": null,
  "sku": null,
  "barcode": null,
  "current_quantity": 1.0,
  "unit_of_measure": "each",
  "min_quantity": null,
  "max_quantity": null,
  "reorder_point": null,
  "current_location_id": null,
  "home_location_id": null,
  "assigned_to_user_id": null,
  "assigned_to_job_id": null,
  "status": "active",
  "condition": null,
  "last_maintenance_date": null,
  "next_maintenance_date": null,
  "purchase_date": null,
  "purchase_price": null,
  "current_value": null,
  "depreciation_method": null,
  "attributes": {},
  "tags": null,
  "custom_fields": {},
  "primary_image_url": null,
  "image_urls": null,
  "created_at": "2025-10-12T14:50:39.814592+00:00",
  "created_by": null,
  "updated_at": "2025-10-12T14:50:39.814592+00:00",
  "updated_by": null,
  "thumbnail_url": null,
  "medium_url": null
}
```

### ✅ item_transactions

Columns:
- `id`
- `tenant_id`
- `transaction_type`
- `item_id`
- `quantity`
- `from_location_id`
- `to_location_id`
- `from_user_id`
- `to_user_id`
- `job_id`
- `purchase_order_id`
- `work_order_id`
- `cost`
- `notes`
- `reason`
- `voice_session_id`
- `detection_session_id`
- `confidence_score`
- `metadata`
- `created_at`
- `created_by`

Sample data structure:
```json
{
  "id": "dbf07e05-cdb9-4738-9533-f5b9aeed3498",
  "tenant_id": "86a0f1f5-30cd-4891-a7d9-bfc85d8b259e",
  "transaction_type": "check_in",
  "item_id": "075639d9-0299-407a-941a-62384b2799c4",
  "quantity": 1.0,
  "from_location_id": null,
  "to_location_id": null,
  "from_user_id": null,
  "to_user_id": null,
  "job_id": null,
  "purchase_order_id": null,
  "work_order_id": null,
  "cost": null,
  "notes": "Initial check-in",
  "reason": null,
  "voice_session_id": null,
  "detection_session_id": null,
  "confidence_score": null,
  "metadata": {},
  "created_at": "2025-10-12T14:19:32.863293+00:00",
  "created_by": null
}
```

### ✅ voice_profiles

(Empty table - no columns detected)


## Tables Not Found

- ❌ **contacts**: Table 'contacts' not found
- ❌ **job_assignments**: Table 'job_assignments' not found
- ❌ **job_verifications**: Table 'job_verifications' not found
- ❌ **inventory_items**: Table 'inventory_items' not found
- ❌ **equipment**: Table 'equipment' not found
- ❌ **materials**: Table 'materials' not found
- ❌ **media_assets**: Table 'media_assets' not found
- ❌ **voice_transcripts**: Table 'voice_transcripts' not found
- ❌ **intent_recognitions**: Table 'intent_recognitions' not found
- ❌ **company_settings**: Table 'company_settings' not found
- ❌ **routes**: Table 'routes' not found
- ❌ **work_orders**: Table 'work_orders' not found
