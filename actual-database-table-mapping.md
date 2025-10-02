# Actual Database Table Mapping and Repository Analysis

Generated: 2025-10-02
Total Tables Found: 105 tables in production database

## Core Business Tables with Repository Implementations

### 1. Companies Domain
| Table | Repository | Status |
|-------|-----------|--------|
| `companies` | ❌ No dedicated repository | Missing CRUD |
| `company_settings` | ✅ `CompanySettingsRepository` | `/src/lib/repositories/company-settings.repository.ts` |
| `tenants` | ✅ `TenantRepository` | `/src/domains/tenant/repositories/tenant-repository.ts` |
| `tenant_assignments` | ❌ Referenced but no repository | Missing CRUD |

### 2. Customer Domain
| Table | Repository | Status |
|-------|-----------|--------|
| `customers` | ✅ `CustomerRepository` | `/src/lib/repositories/customer.repository.ts` |
| `customer_feedback` | ❌ No repository | Missing CRUD |
| `properties` | ✅ `PropertyRepository` | `/src/domains/property/repositories/property-repository.ts` |

### 3. Job Management
| Table | Repository | Status |
|-------|-----------|--------|
| `jobs` | ✅ `JobRepository` | `/src/domains/job/repositories/job-repository.ts` |
| `job_templates` | ✅ `JobTemplateRepository` | `/src/domains/job-templates/repositories/job-template-repository.ts` |
| `job_kits` | ✅ `JobKitRepository` | `/src/scheduling/repositories/job-kit.repository.ts` |
| `job_reschedules` | ❌ No repository | Missing CRUD |
| `active_jobs_view` | N/A | View, not a table |

### 4. Equipment & Inventory
| Table | Repository | Status |
|-------|-----------|--------|
| `equipment` | ✅ `EquipmentRepository` | `/src/domains/equipment/repositories/equipment-repository.ts` |
| `equipment_incidents` | ❌ No repository | Missing CRUD |
| `equipment_maintenance` | ❌ No repository | Missing CRUD |
| `containers` | ✅ `ContainerRepository` | `/src/domains/equipment/repositories/container-repository.ts` |
| `container_assignments` | ❌ No repository | Missing CRUD |
| `inventory_items` | ❌ No repository | Missing CRUD |
| `inventory_transactions` | ❌ No repository | Missing CRUD |
| `inventory_images` | ✅ `InventoryImageRepository` | `/src/domains/inventory/repositories/inventory-image-repository.ts` |

### 5. Materials
| Table | Repository | Status |
|-------|-----------|--------|
| `materials` | ✅ `MaterialRepository` | `/src/domains/material/repositories/material-repository.ts` |
| `material_requests` | ❌ No repository | Missing CRUD |

### 6. Scheduling & Kits
| Table | Repository | Status |
|-------|-----------|--------|
| `kits` | ✅ Multiple implementations | `/src/domains/repos/scheduling-kits/kit-repository.ts` and `/src/scheduling/repositories/kit.repository.ts` |
| `kit_items` | ✅ `KitItemRepository` | `/src/scheduling/repositories/kit-item.repository.ts` |
| `kit_variants` | ✅ Multiple implementations | Both domains/repos and scheduling paths |
| `kit_assignments` | ✅ `KitAssignmentRepository` | `/src/domains/repos/scheduling-kits/kit-assignment-repository.ts` |
| `kit_override_logs` | ✅ Multiple implementations | Both domains/repos and scheduling paths |

### 7. Vision & AI Features
| Table | Repository | Status |
|-------|-----------|--------|
| `vision_verifications` | ✅ `LoadVerificationRepository` | `/src/domains/vision/repositories/load-verification-repository.ts` |
| `vision_detected_items` | ❌ Referenced but no dedicated repository | Missing CRUD |
| `vision_cost_records` | ❌ Referenced but no dedicated repository | Missing CRUD |
| `vision_training_annotations` | ❌ No repository | Missing CRUD |
| `detection_confidence_thresholds` | ❌ No repository | Missing CRUD |

### 8. Voice & AI Interactions
| Table | Repository | Status |
|-------|-----------|--------|
| `voice_transcripts` | ❌ No repository | Missing CRUD |
| `voice_sessions` | ❌ No repository | Missing CRUD |
| `voice_profiles` | ❌ No repository | Missing CRUD |
| `ai_interaction_logs` | ✅ `AiInteractionLogRepository` | `/src/domains/intent/repositories/ai-interaction-log.repository.ts` |
| `ai_cost_tracking` | ❌ No repository | Missing CRUD |
| `intent_recognitions` | ❌ No repository | Missing CRUD |
| `intent_classifications` | ✅ `IntentClassificationRepository` | `/src/domains/intent/repositories/intent-classification.repository.ts` |

### 9. Media & Documents
| Table | Repository | Status |
|-------|-----------|--------|
| `media_assets` | ❌ No repository | Missing CRUD |
| `ocr_documents` | ❌ No repository | Missing CRUD |
| `ocr_jobs` | ❌ No repository | Missing CRUD |
| `ocr_line_items` | ❌ No repository | Missing CRUD |
| `ocr_note_entities` | ❌ No repository | Missing CRUD |

### 10. Time & Route Tracking
| Table | Repository | Status |
|-------|-----------|--------|
| `time_entries` | ✅ `TimeEntryRepository` | `/src/domains/time-tracking/repositories/time-entry.repository.ts` |
| `routes` | ❌ Referenced but no direct repository | Missing CRUD |
| `route_stops` | ❌ No repository | Missing CRUD |
| `routing_schedules` | ❌ No repository | Missing CRUD |
| `travel_logs` | ❌ No repository | Missing CRUD |

### 11. Scheduling & Planning
| Table | Repository | Status |
|-------|-----------|--------|
| `day_plans` | ✅ `DayPlanRepository` | `/src/scheduling/repositories/day-plan.repository.ts` |
| `schedule_events` | ✅ `ScheduleEventRepository` | `/src/scheduling/repositories/schedule-event.repository.ts` |
| `crew_assignments` | ✅ `CrewAssignmentRepository` | `/src/scheduling/repositories/crew-assignment.repository.ts` |

### 12. Offline & Sync
| Table | Repository | Status |
|-------|-----------|--------|
| `offline_sync_queue` | ✅ `OfflineSyncQueueRepository` | `/src/domains/intent/repositories/offline-sync-queue.repository.ts` |
| `offline_queue` | ❌ No repository | Missing CRUD |
| `mobile_sessions` | ❌ No repository | Missing CRUD |

### 13. Safety & Compliance
| Table | Repository | Status |
|-------|-----------|--------|
| `safety_checklists` | ✅ `SafetyChecklistRepository` | `/src/domains/safety/repositories/safety-checklist.repository.ts` |
| `safety_checklist_completions` | ✅ `SafetyCompletionRepository` | `/src/domains/safety/repositories/safety-completion.repository.ts` |

### 14. Irrigation Systems
| Table | Repository | Status |
|-------|-----------|--------|
| `irrigation_systems` | ❌ No repository | Missing CRUD |
| `irrigation_zones` | ❌ No repository | Missing CRUD |
| `irrigation_zone_status` | ❌ No repository | Missing CRUD |
| `irrigation_schedules` | ❌ No repository | Missing CRUD |
| `irrigation_runs` | ❌ No repository | Missing CRUD |

### 15. Other Tables Without Repositories
- `audit_logs`
- `auth_audit_log`
- `background_filter_preferences`
- `conflict_logs`
- `conversation_sessions`
- `daily_reports`
- `dev_manifest_history`
- `dev_project_standards`
- `geofences`
- `geofence_events`
- `gps_tracking_records`
- `intake_documents`
- `intake_requests`
- `invoices`
- `item_relationships`
- `maintenance_schedule`
- `maintenance_tickets`
- `mfa_challenges`
- `mfa_settings`
- `notification_queue`
- `notifications`
- `permissions`
- `purchase_receipts`
- `quality_audits`
- `request_deduplication`
- `role_permissions`
- `service_history`
- `training_certificates`
- `training_data_records`
- `training_sessions`
- `user_activity_logs`
- `user_assignments`
- `user_invitations`
- `user_permissions`
- `user_sessions`
- `users_extended`
- `vendor_aliases`
- `vendor_locations`
- `vendors`
- `workflow_tasks`

### System Tables (PostGIS/Supabase)
- `geography_columns`
- `geometry_columns`
- `spatial_ref_sys`

## Summary Statistics

- **Total Tables**: 105
- **Tables with Repositories**: ~30 (28.6%)
- **Tables without Repositories**: ~75 (71.4%)
- **Duplicate Repository Implementations**: 5 tables (kits domain has duplicates)

## Key Findings

1. **Major Gap**: Most voice/vision/AI tables lack repository implementations despite being core features
2. **Duplication Issue**: Kits domain has duplicate repositories in different paths (`/domains/repos/` vs `/scheduling/`)
3. **Missing Core CRUD**: Critical tables like `companies`, `equipment_incidents`, `media_assets` lack repositories
4. **Irrigation Domain**: Entire irrigation system (5 tables) has no repository implementations
5. **Offline/Sync**: Mixed implementation - some tables have repos, others don't

## Recommended Actions

1. **Priority 1**: Implement repositories for core business tables without CRUD
2. **Priority 2**: Add repositories for vision/voice/AI tables to support Feature 001/007
3. **Priority 3**: Resolve duplicate kit repository implementations
4. **Priority 4**: Complete offline/sync repository coverage
5. **Priority 5**: Add repositories for irrigation and other specialized domains

## Repository Pattern Used

All existing repositories follow the pattern:
```typescript
export class XxxRepository extends BaseRepository<Database['public']['Tables']['table_name']> {
  constructor(supabase: SupabaseClient<Database>) {
    super(supabase, 'table_name');
  }
}
```

Located in domain-specific folders under `/src/domains/[domain]/repositories/`