#!/usr/bin/env npx tsx

// Hardcoded list from db-analyzer-live.ts
const potentialTables = [
  // Core tables
  'tenants', 'companies', 'company_settings', 'users', 'users_extended', 'profiles', 
  'audit_logs', 'audit_log_entries', 'system_logs',
  
  // Auth & Permissions
  'roles', 'permissions', 'role_permissions', 'user_roles', 'user_permissions',
  
  // Customer & Property
  'customers', 'customer_contacts', 'customer_notes', 
  'properties', 'property_zones', 'property_access_codes', 'property_notes',
  
  // Jobs & Work
  'jobs', 'job_templates', 'job_checklist_items', 'job_kits', 'job_assignments',
  'job_status_history', 'job_notes', 'job_materials', 'job_equipment',
  
  // Equipment & Inventory
  'equipment', 'equipment_maintenance', 'equipment_locations', 'equipment_assignments',
  'materials', 'material_usage', 'material_inventory', 
  'inventory_items', 'inventory_transactions', 'inventory_locations',
  
  // Voice & AI
  'voice_sessions', 'voice_transcripts', 'voice_commands', 'voice_notes',
  'intent_recognitions', 'intent_classifications', 'conversation_sessions',
  'ai_cost_tracking', 'ai_interaction_logs', 'ai_models', 'ai_prompts',
  
  // Vision & Media
  'vision_verifications', 'vision_verification_records', 'detected_items', 
  'vision_cost_records', 'vision_detected_items', 'vision_confidence_config',
  'detection_confidence_thresholds', 'vision_training_annotations', 
  'training_data_records', 'media_assets', 'media_metadata', 'inventory_images',
  
  // Documents & OCR
  'documents', 'document_versions', 'ocr_jobs', 'ocr_documents', 
  'ocr_line_items', 'ocr_note_entities', 'receipts', 'purchase_receipts',
  
  // Scheduling & Routes
  'schedules', 'schedule_events', 'schedule_templates', 'recurring_schedules',
  'routes', 'route_stops', 'route_optimizations', 'route_history',
  'day_plans', 'week_plans', 'calendar_events',
  
  // Teams & Personnel
  'teams', 'team_members', 'crew_assignments', 'crew_schedules',
  'employee_schedules', 'shift_patterns', 'time_off_requests',
  
  // Time & Attendance
  'time_entries', 'time_clock_entries', 'break_logs', 'overtime_records',
  
  // Irrigation
  'irrigation_systems', 'irrigation_zones', 'irrigation_schedules', 
  'irrigation_runs', 'irrigation_history', 'irrigation_maintenance',
  
  // Service & Maintenance
  'service_history', 'service_tickets', 'maintenance_schedules', 
  'maintenance_logs', 'work_orders',
  
  // Containers & Storage
  'containers', 'container_assignments', 'container_locations', 'storage_units',
  
  // Kits & Bundles
  'kits', 'kit_items', 'kit_variants', 'kit_assignments', 'kit_override_logs',
  
  // Notifications & Communication
  'notifications', 'notification_queue', 'notification_preferences', 
  'notification_history', 'push_tokens', 'email_queue', 'sms_queue',
  
  // Vendors & Purchasing
  'vendors', 'vendor_aliases', 'vendor_locations', 'vendor_contacts',
  'purchase_orders', 'purchase_order_items', 'vendor_invoices',
  
  // Financial
  'invoices', 'invoice_items', 'payments', 'payment_methods', 
  'billing_accounts', 'transactions', 'estimates', 'quotes',
  
  // Sync & Offline
  'sync_logs', 'sync_queue', 'offline_sync_queue', 'offline_queue', 
  'mobile_sessions', 'device_registrations',
  
  // Misc
  'settings', 'configurations', 'feature_flags', 'request_deduplication',
  'background_filter_preferences', 'item_relationships', 'tags', 'tag_assignments',
  'notes', 'comments', 'attachments', 'webhooks', 'webhook_logs',
  'import_jobs', 'export_jobs', 'batch_operations'
];

// Actual 66 tables found in the database (from our previous analysis)
const actualTables = [
  'ai_cost_records',
  'audit_logs',
  'companies',
  'company_settings',
  'containers',
  'customers',
  'day_plans',
  'detected_items',
  'detection_confidence_thresholds',
  'equipment',
  'equipment_assignments',
  'equipment_maintenance',
  'feature_flags',
  'intent_classifications',
  'intent_recognitions',
  'inventory_items',
  'inventory_transactions',
  'irrigation_runs',
  'irrigation_schedules',
  'irrigation_systems',
  'irrigation_zones',
  'job_assignments',
  'job_checklist_items',
  'job_kits',
  'job_templates',
  'jobs',
  'kit_items',
  'kits',
  'materials',
  'media_assets',
  'notification_preferences',
  'notifications',
  'ocr_documents',
  'ocr_jobs',
  'ocr_line_items',
  'ocr_note_entities',
  'offline_sync_queue',
  'permissions',
  'properties',
  'property_access_codes',
  'property_zones',
  'request_deduplication',
  'role_permissions',
  'roles',
  'route_optimizations',
  'routes',
  'schedule_events',
  'schedules',
  'system_logs',
  'teams',
  'time_entries',
  'user_permissions',
  'user_roles',
  'users',
  'vendor_aliases',
  'vendor_locations',
  'vendors',
  'vision_cost_records',
  'vision_training_annotations',
  'vision_verification_records',
  'voice_commands',
  'voice_notes',
  'voice_sessions',
  'voice_transcripts',
  'week_plans',
  'webhook_logs'
];

console.log('📊 Table Comparison Analysis\n');

console.log(`Total hardcoded tables: ${potentialTables.length}`);
console.log(`Total actual tables: ${actualTables.length}\n`);

// Find phantom tables (in hardcoded list but not in DB)
const phantomTables = potentialTables.filter(table => !actualTables.includes(table));
console.log(`❌ Phantom tables (${phantomTables.length} tables that don't exist):`);
phantomTables.sort().forEach(table => console.log(`   - ${table}`));

// Find missing tables (in DB but not in hardcoded list)
const missingTables = actualTables.filter(table => !potentialTables.includes(table));
console.log(`\n⚠️  Missing from hardcoded list (${missingTables.length} tables):`);
missingTables.sort().forEach(table => console.log(`   - ${table}`));

// Summary
console.log('\n📈 Summary:');
console.log(`   - Analyzer is looking for ${potentialTables.length} tables`);
console.log(`   - Database actually has ${actualTables.length} tables`);
console.log(`   - ${phantomTables.length} phantom tables (91 non-existent)`);
console.log(`   - ${missingTables.length} tables missing from analyzer`);
console.log(`   - This explains why analyzer always reports "157 tables"`);