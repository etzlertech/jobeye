# Database Tables Mapping and Repository Analysis

## Tables Found in Migrations

### Core Business Tables (001_v4_core_business_tables.sql)
1. **customers** - Customer records
2. **properties** - Property locations
3. **job_templates** - Job template definitions
4. **jobs** - Job execution records
5. **equipment** - Equipment inventory
6. **materials** - Materials/supplies inventory

### Voice, Vision & Media Tables (002_v4_voice_vision_media_tables.sql)
7. **voice_transcripts** - Voice command transcripts
8. **intent_recognitions** - AI intent detection
9. **media_assets** - Photo/video/audio storage
10. **vision_verifications** - AI vision verification results
11. **conversation_sessions** - Voice conversation tracking
12. **request_deduplication** - Duplicate request prevention
13. **ai_cost_tracking** - AI service cost tracking

### Irrigation & Specialized Tables (003_v4_irrigation_and_specialized_tables.sql)
14. **irrigation_systems** - Irrigation system definitions
15. **irrigation_zones** - Irrigation zone configuration
16. **irrigation_schedules** - Watering schedules
17. **irrigation_runs** - Irrigation run history
18. **service_history** - Maintenance/service records
19. **time_entries** - Labor time tracking
20. **routes** - Route planning
21. **route_stops** - Route stop details

### Companies & Multi-tenant (009-015)
22. **companies** - Company/tenant records

### Scheduling & Kits (035-036)
23. **kits** - Equipment kit definitions
24. **kit_items** - Items within kits
25. **kit_variants** - Kit variations
26. **kit_assignments** - Kit assignments to jobs
27. **kit_override_logs** - Kit override tracking

### Vision Detection (040-044)
28. **vision_detected_items** - Individual YOLO detections
29. **vision_cost_records** - Vision API cost tracking
30. **detection_confidence_thresholds** - Confidence settings

### MVP Intent-Driven (20250127_1900)
31. **ai_interaction_logs** - All AI service interactions
32. **intent_classifications** - Photo intent classification
33. **offline_sync_queue** - Offline operation queue

### Other Tables Referenced (but not created in these migrations)
- **tenants** - Multi-tenant base table (referenced)
- **users_extended** - Extended user profiles (referenced)
- **user_sessions** - User session tracking (referenced)
- **tenant_assignments** - User-tenant relationships (referenced)
- **auth.users** - Supabase auth users (built-in)

## Total Count: 33 main tables created + 4 referenced tables