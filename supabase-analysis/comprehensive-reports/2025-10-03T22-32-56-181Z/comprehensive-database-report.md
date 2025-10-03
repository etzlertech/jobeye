# COMPREHENSIVE Database Analysis Report

Generated: 2025-10-03T22:32:56.180Z
Database: https://rtwigjwqufozqfwozpvo.supabase.co

## Executive Summary

- **Total Tables**: 65
- **Total Rows**: 10,458
- **Total Columns**: 0
- **Total Indexes**: 240
- **Total Foreign Keys**: 62
- **Total RLS Policies**: 0
- **Tables with Data**: 19
- **Tables with RLS**: 49
- **Tables with Policies**: 0

## Key Insights

### Largest Tables by Row Count
- **spatial_ref_sys**: 8,500 rows (7144 kB)
- **gps_tracking_records**: 1,046 rows (488 kB)
- **code_pattern_violations**: 277 rows (168 kB)
- **notification_queue**: 175 rows (264 kB)
- **auth_audit_log**: 138 rows (176 kB)
- **customers**: 83 rows (128 kB)
- **tenants**: 71 rows (88 kB)
- **invoices**: 57 rows (168 kB)
- **jobs**: 47 rows (200 kB)
- **equipment_maintenance**: 26 rows (80 kB)

### Tables Without Primary Keys
None - all tables have primary keys ✅

### Tables Without Indexes
None - all tables have indexes ✅

### Tables with RLS but No Policies
- gps_tracking_records
- notification_queue
- auth_audit_log
- customers
- tenants
- invoices
- jobs
- users_extended
- kit_items
- properties
- kits
- companies
- kit_variants
- kit_assignments
- workflow_tasks
- geofences
- geofence_events
- inventory_images
- ocr_jobs
- ocr_documents
- ocr_line_items
- ocr_note_entities
- vendor_locations
- item_transactions
- mfa_challenges
- mfa_settings
- user_invitations
- tenant_assignments
- voice_profiles
- role_permissions
- permissions
- material_requests
- customer_feedback
- maintenance_tickets
- user_sessions
- travel_logs
- audit_logs
- job_reschedules
- safety_checklist_completions
- conflict_logs
- dev_manifest_history
- items
- routing_schedules
- intake_requests
- dev_project_standards
- safety_checklists
- intake_documents
- vendors
- vendor_aliases

## Detailed Table Information


## Recommendations

1. 🔒 Add RLS policies to 49 tables with RLS enabled but no policies
2. 🛡️ Enable RLS on 5 tables containing data
3. 📈 Add indexes to 1 large tables with 1000+ rows

## Relationship Map

```yaml
{
  "gps_tracking_records": {
    "references": [
      {
        "table": "jobs",
        "via": "job_id → id"
      },
      {
        "table": "tenants",
        "via": "tenant_id → id"
      },
      {
        "table": "users_extended",
        "via": "user_id → id"
      }
    ],
    "referenced_by": []
  },
  "notification_queue": {
    "references": [
      {
        "table": "companies",
        "via": "company_id → id"
      }
    ],
    "referenced_by": []
  },
  "auth_audit_log": {
    "references": [
      {
        "table": "user_sessions",
        "via": "session_id → id"
      },
      {
        "table": "tenants",
        "via": "tenant_id → id"
      }
    ],
    "referenced_by": []
  },
  "customers": {
    "references": [
      {
        "table": "tenants",
        "via": "tenant_id → id"
      }
    ],
    "referenced_by": [
      {
        "table": "jobs",
        "via": "customer_id ← id"
      },
      {
        "table": "properties",
        "via": "customer_id ← id"
      }
    ]
  },
  "invoices": {
    "references": [
      {
        "table": "jobs",
        "via": "job_id → id"
      }
    ],
    "referenced_by": []
  },
  "jobs": {
    "references": [
      {
        "table": "users_extended",
        "via": "assigned_to → id"
      },
      {
        "table": "customers",
        "via": "customer_id → id"
      },
      {
        "table": "properties",
        "via": "property_id → id"
      },
      {
        "table": "tenants",
        "via": "tenant_id → id"
      }
    ],
    "referenced_by": [
      {
        "table": "gps_tracking_records",
        "via": "job_id ← id"
      },
      {
        "table": "invoices",
        "via": "job_id ← id"
      },
      {
        "table": "workflow_tasks",
        "via": "job_id ← id"
      },
      {
        "table": "geofences",
        "via": "job_id ← id"
      },
      {
        "table": "material_requests",
        "via": "job_id ← id"
      },
      {
        "table": "customer_feedback",
        "via": "job_id ← id"
      },
      {
        "table": "job_reschedules",
        "via": "original_job_id ← id"
      },
      {
        "table": "intake_requests",
        "via": "converted_to_job_id ← id"
      },
      {
        "table": "safety_checklists",
        "via": "job_id ← id"
      }
    ]
  },
  "users_extended": {
    "references": [
      {
        "table": "tenants",
        "via": "tenant_id → id"
      }
    ],
    "referenced_by": [
      {
        "table": "gps_tracking_records",
        "via": "user_id ← id"
      },
      {
        "table": "jobs",
        "via": "assigned_to ← id"
      },
      {
        "table": "workflow_tasks",
        "via": "completed_by ← id"
      },
      {
        "table": "workflow_tasks",
        "via": "supervisor_id ← id"
      },
      {
        "table": "workflow_tasks",
        "via": "user_id ← id"
      },
      {
        "table": "geofence_events",
        "via": "user_id ← id"
      },
      {
        "table": "routing_schedules",
        "via": "user_id ← id"
      },
      {
        "table": "intake_requests",
        "via": "assigned_to ← id"
      },
      {
        "table": "safety_checklists",
        "via": "supervisor_id ← id"
      },
      {
        "table": "safety_checklists",
        "via": "user_id ← id"
      }
    ]
  },
  "kit_items": {
    "references": [
      {
        "table": "companies",
        "via": "tenant_id → id"
      },
      {
        "table": "kits",
        "via": "kit_id → id"
      }
    ],
    "referenced_by": []
  },
  "properties": {
    "references": [
      {
        "table": "customers",
        "via": "customer_id → id"
      },
      {
        "table": "tenants",
        "via": "tenant_id → id"
      }
    ],
    "referenced_by": [
      {
        "table": "jobs",
        "via": "property_id ← id"
      },
      {
        "table": "travel_logs",
        "via": "from_property_id ← id"
      },
      {
        "table": "travel_logs",
        "via": "to_property_id ← id"
      }
    ]
  },
  "kits": {
    "references": [
      {
        "table": "companies",
        "via": "tenant_id → id"
      }
    ],
    "referenced_by": [
      {
        "table": "kit_items",
        "via": "kit_id ← id"
      },
      {
        "table": "kit_variants",
        "via": "kit_id ← id"
      },
      {
        "table": "kit_assignments",
        "via": "kit_id ← id"
      }
    ]
  },
  "kit_variants": {
    "references": [
      {
        "table": "companies",
        "via": "tenant_id → id"
      },
      {
        "table": "kits",
        "via": "kit_id → id"
      }
    ],
    "referenced_by": [
      {
        "table": "kit_assignments",
        "via": "variant_id ← id"
      }
    ]
  },
  "day_plans": {
    "references": [
      {
        "table": "companies",
        "via": "company_id → id"
      }
    ],
    "referenced_by": []
  },
  "kit_assignments": {
    "references": [
      {
        "table": "kits",
        "via": "kit_id → id"
      },
      {
        "table": "kit_variants",
        "via": "variant_id → id"
      }
    ],
    "referenced_by": []
  },
  "workflow_tasks": {
    "references": [
      {
        "table": "users_extended",
        "via": "completed_by → id"
      },
      {
        "table": "jobs",
        "via": "job_id → id"
      },
      {
        "table": "users_extended",
        "via": "supervisor_id → id"
      },
      {
        "table": "tenants",
        "via": "tenant_id → id"
      },
      {
        "table": "users_extended",
        "via": "user_id → id"
      }
    ],
    "referenced_by": []
  },
  "geofences": {
    "references": [
      {
        "table": "jobs",
        "via": "job_id → id"
      },
      {
        "table": "tenants",
        "via": "tenant_id → id"
      }
    ],
    "referenced_by": [
      {
        "table": "geofence_events",
        "via": "geofence_id ← id"
      }
    ]
  },
  "geofence_events": {
    "references": [
      {
        "table": "geofences",
        "via": "geofence_id → id"
      },
      {
        "table": "tenants",
        "via": "tenant_id → id"
      },
      {
        "table": "users_extended",
        "via": "user_id → id"
      }
    ],
    "referenced_by": []
  },
  "ocr_jobs": {
    "references": [
      {
        "table": "vendors",
        "via": "vendor_id → id"
      }
    ],
    "referenced_by": [
      {
        "table": "ocr_documents",
        "via": "ocr_job_id ← id"
      }
    ]
  },
  "ocr_documents": {
    "references": [
      {
        "table": "ocr_jobs",
        "via": "ocr_job_id → id"
      }
    ],
    "referenced_by": [
      {
        "table": "ocr_line_items",
        "via": "ocr_document_id ← id"
      },
      {
        "table": "ocr_note_entities",
        "via": "ocr_document_id ← id"
      }
    ]
  },
  "ocr_line_items": {
    "references": [
      {
        "table": "ocr_documents",
        "via": "ocr_document_id → id"
      }
    ],
    "referenced_by": []
  },
  "ocr_note_entities": {
    "references": [
      {
        "table": "ocr_documents",
        "via": "ocr_document_id → id"
      }
    ],
    "referenced_by": []
  },
  "vendor_locations": {
    "references": [
      {
        "table": "vendors",
        "via": "vendor_id → id"
      }
    ],
    "referenced_by": []
  },
  "item_transactions": {
    "references": [
      {
        "table": "items",
        "via": "item_id → id"
      }
    ],
    "referenced_by": []
  },
  "user_invitations": {
    "references": [
      {
        "table": "tenants",
        "via": "tenant_id → id"
      }
    ],
    "referenced_by": []
  },
  "tenant_assignments": {
    "references": [
      {
        "table": "tenants",
        "via": "tenant_id → id"
      }
    ],
    "referenced_by": []
  },
  "role_permissions": {
    "references": [
      {
        "table": "permissions",
        "via": "permission_id → id"
      },
      {
        "table": "tenants",
        "via": "tenant_id → id"
      }
    ],
    "referenced_by": []
  },
  "material_requests": {
    "references": [
      {
        "table": "jobs",
        "via": "job_id → id"
      }
    ],
    "referenced_by": []
  },
  "customer_feedback": {
    "references": [
      {
        "table": "jobs",
        "via": "job_id → id"
      }
    ],
    "referenced_by": []
  },
  "user_sessions": {
    "references": [
      {
        "table": "tenants",
        "via": "tenant_id → id"
      }
    ],
    "referenced_by": [
      {
        "table": "auth_audit_log",
        "via": "session_id ← id"
      }
    ]
  },
  "travel_logs": {
    "references": [
      {
        "table": "properties",
        "via": "from_property_id → id"
      },
      {
        "table": "properties",
        "via": "to_property_id → id"
      }
    ],
    "referenced_by": []
  },
  "job_reschedules": {
    "references": [
      {
        "table": "jobs",
        "via": "original_job_id → id"
      }
    ],
    "referenced_by": []
  },
  "routing_schedules": {
    "references": [
      {
        "table": "tenants",
        "via": "tenant_id → id"
      },
      {
        "table": "users_extended",
        "via": "user_id → id"
      }
    ],
    "referenced_by": []
  },
  "intake_requests": {
    "references": [
      {
        "table": "users_extended",
        "via": "assigned_to → id"
      },
      {
        "table": "jobs",
        "via": "converted_to_job_id → id"
      },
      {
        "table": "tenants",
        "via": "tenant_id → id"
      }
    ],
    "referenced_by": [
      {
        "table": "intake_documents",
        "via": "intake_id ← id"
      },
      {
        "table": "intake_documents",
        "via": "intake_request_id ← id"
      }
    ]
  },
  "safety_checklists": {
    "references": [
      {
        "table": "jobs",
        "via": "job_id → id"
      },
      {
        "table": "users_extended",
        "via": "supervisor_id → id"
      },
      {
        "table": "tenants",
        "via": "tenant_id → id"
      },
      {
        "table": "users_extended",
        "via": "user_id → id"
      }
    ],
    "referenced_by": []
  },
  "intake_documents": {
    "references": [
      {
        "table": "intake_requests",
        "via": "intake_id → id"
      },
      {
        "table": "intake_requests",
        "via": "intake_request_id → id"
      },
      {
        "table": "tenants",
        "via": "tenant_id → id"
      }
    ],
    "referenced_by": []
  },
  "vendor_aliases": {
    "references": [
      {
        "table": "vendors",
        "via": "vendor_id → id"
      }
    ],
    "referenced_by": []
  }
}
```
