# Feature Gap Analysis - Job Workflows & Safety Checklists
**Date**: 2025-09-30
**Branch**: 004-voice-vision-inventory
**Database Review**: ACTUAL live schema inspected

---

## Executive Summary

After reviewing the live database schema and existing codebase, we have **significant infrastructure** already in place for job task lists, checklists, and time tracking. However, there are **critical gaps** in implementation, particularly for:

1. **Safety checklists** (trailer hookup, pre-drive inspections)
2. **Special instructions** (video/PDF guidance viewers)
3. **Job arrival/completion workflows** with quality images
4. **Voice/image-based task management**
5. **Time tracking integration** (clock in/out, travel time, hours on job)
6. **Historical context awareness**

---

## ✅ EXISTING Capabilities (Implemented in Database)

### 1. **Jobs Table** (`jobs`)
**Status**: ✅ **IMPLEMENTED**
**Columns**: 34 fields including:
- `checklist_items` (JSONB array) ✅
- `voice_notes`, `voice_created`, `voice_session_id` ✅
- `photos_before`, `photos_after` ✅
- `signature_required`, `signature_data` ✅
- `materials_used`, `equipment_used` ✅
- `completion_notes` ✅
- `scheduled_start`, `scheduled_end`, `actual_start`, `actual_end` ✅
- `estimated_duration`, `actual_duration` ✅

**Gap**: JSONB structure is flexible but **no enforced schema** for checklist items. No dedicated table for **safety checklists**.

---

### 2. **Time Tracking** (`time_entries`)
**Status**: ⚠️ **TABLE EXISTS, EMPTY**
**Expected Columns**: Unknown (empty table, need schema inspection)

**Gap**: No integration with job workflows. Missing:
- Clock in/out timestamps
- Travel time vs. job time differentiation
- GPS tracking for arrival verification
- Automatic time entry creation on job status changes

---

### 3. **Travel Logs** (`travel_logs`)
**Status**: ✅ **PARTIALLY IMPLEMENTED**
**Columns**: 10 fields including:
- `departure_time`, `arrival_time` ✅
- `from_property_id`, `to_property_id` ✅
- `distance_km` ✅
- `equipment_cleaned` ✅

**Gap**: Not integrated with job arrival workflows. Missing:
- Automatic creation on job status change
- GPS verification of arrival
- Route deviation alerts

---

### 4. **Media Assets** (`media_assets`)
**Status**: ✅ **EXISTS** (schema unknown, likely has columns for photos/videos)

**Gap**: Need to verify support for:
- PDF storage (instruction manuals)
- Video streaming/playback metadata
- Thumbnail generation
- Offline caching strategy

---

### 5. **Quality Audits** (`quality_audits`)
**Status**: ✅ **IMPLEMENTED**
**Columns**: 10 fields including:
- `jobs_audited`, `quality_score`, `issues_found` ✅
- `site_inspection_verification_id` ✅

**Gap**: No link to **completion photos** or **before/after comparisons**. Missing:
- Computer vision quality scoring
- Automatic issue detection from images
- Supervisor review workflows

---

### 6. **Equipment Incidents** (`equipment_incidents`)
**Status**: ✅ **IMPLEMENTED**
**Columns**: 10 fields including:
- `incident_type`, `severity`, `status` ✅
- `verification_id` (likely photo evidence) ✅

**Gap**: Not linked to **safety checklists**. Missing:
- Pre-trip inspection integration
- Trailer hookup safety verification

---

### 7. **Maintenance Schedule** (`maintenance_schedule`)
**Status**: ✅ **IMPLEMENTED**
**Columns**: 7 fields including:
- `equipment_id`, `maintenance_type`, `scheduled_date` ✅

**Gap**: Not integrated with **job workflows** or **checklist requirements** (e.g., "Can't use this mower, it's under maintenance").

---

### 8. **Training Certificates** (`training_certificates`)
**Status**: ✅ **IMPLEMENTED**
**Columns**: 9 fields including:
- `certificate_type`, `expires_at`, `score` ✅

**Gap**: Not enforced in **job assignment** or **safety checklist** requirements (e.g., "Technician must have forklift certification to use this equipment").

---

### 9. **Notifications** (`notifications`)
**Status**: ✅ **IMPLEMENTED**
**Columns**: 10 fields including:
- `notification_type`, `priority`, `related_entity_id` ✅

**Gap**: Need to add notification types for:
- Safety checklist incomplete
- Trailer hookup skipped
- Time entry missing (forgot to clock out)

---

### 10. **Vision Verification** (Feature 001 - Kit Verification)
**Status**: ✅ **IMPLEMENTED** (via `vision_verifications` table)
**Columns**: Includes `confidence`, `meets_criteria`, `cost_usd` ✅

**Gap**: **NOT integrated with job checklists**. Currently only used for equipment loading verification, not for:
- Job arrival verification (photo of property)
- Job completion quality images
- Safety checklist photo requirements

---

### 11. **Voice Pipeline** (Feature 003 - Voice Integration)
**Status**: ✅ **IMPLEMENTED** (`voice_transcripts`, `intent_recognitions`)
**Existing**: Voice job creation, voice notes, voice commands

**Gap**: Not integrated with:
- Task list management ("Add task: Check sprinkler zone 3")
- Safety checklist completion ("Trailer lights verified")
- Time tracking ("Clock in for job 1234")

---

### 12. **Inventory Tracking** (Feature 004)
**Status**: ✅ **IMPLEMENTED** (check-in/out, purchases, container tracking)

**Gap**: Not integrated with:
- Job task lists (material usage during job)
- Equipment maintenance alerts during job execution

---

## ❌ MISSING Capabilities (Critical Gaps)

### 1. **Safety Checklists** 🚨 **HIGH PRIORITY**
**Status**: ❌ **NOT IMPLEMENTED**

**Required Tables** (NEW):
```sql
CREATE TABLE safety_checklists (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  name TEXT NOT NULL, -- "Pre-Drive Trailer Hookup", "Equipment Safety", "Forklift Operation"
  description TEXT,
  required_for TEXT[], -- ['has_trailer', 'heavy_equipment', 'all_jobs']
  items JSONB NOT NULL, -- [{id, task, type: 'binary'|'photo'|'numeric', required: true}]
  frequency TEXT, -- 'per_job', 'daily', 'weekly'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE safety_checklist_completions (
  id UUID PRIMARY KEY,
  checklist_id UUID REFERENCES safety_checklists(id),
  job_id UUID REFERENCES jobs(id),
  user_id UUID REFERENCES users(id),
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  items_completed JSONB NOT NULL, -- [{id, value, photo_id, timestamp}]
  notes TEXT,
  location JSONB -- GPS coordinates at completion
);
```

**Examples**:
- **Trailer Hookup Safety**: Hitch locked, chains crossed, lights working, brakes tested
- **Pre-Drive Inspection**: Tire pressure, fluid levels, equipment secured
- **Equipment Safety**: PPE verified, guards in place, lockout/tagout if needed

**Integration Points**:
- Block job start if required checklist incomplete
- Voice completion: "Safety checklist done"
- Photo verification for critical items (e.g., hitch pin installed)

---

### 2. **Special Instructions with Media Guidance** 📄 **HIGH PRIORITY**
**Status**: ⚠️ **PARTIALLY IMPLEMENTED**

**Existing**:
- `jobs.metadata` JSONB could store instructions
- `media_assets` can store PDFs/videos

**Missing**:
- **No viewer integration** (PDF renderer, video player)
- **No training video gating** ("Watch this video before starting job")
- **No reference image comparisons** ("Match this hedge shape")
- **No SOP library** (Standard Operating Procedures)

**Required**:
```sql
CREATE TABLE instruction_documents (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL, -- 'pdf', 'video', 'reference_image'
  media_id UUID REFERENCES media_assets(id),
  required_viewing BOOLEAN DEFAULT FALSE,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE job_instructions (
  id UUID PRIMARY KEY,
  job_id UUID REFERENCES jobs(id),
  instruction_id UUID REFERENCES instruction_documents(id),
  viewed_by UUID[], -- User IDs who have viewed
  viewed_at JSONB, -- {user_id: timestamp}
  acknowledgment_required BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID[]
);
```

**Examples**:
- "Watch pruning technique video before trimming boxwoods"
- "Reference image: Customer wants 2-inch grass height"
- "PDF: Irrigation controller manual for Rainbird ESP-LX"

---

### 3. **Job Arrival Workflow** 📍 **MEDIUM PRIORITY**
**Status**: ⚠️ **INFRASTRUCTURE EXISTS, NO WORKFLOW**

**Existing**:
- `jobs.actual_start` timestamp ✅
- `travel_logs` table ✅
- GPS capability (likely from mobile app)

**Missing**:
- **Automatic arrival detection** (GPS geofence)
- **Arrival confirmation prompt** ("Confirm arrival at 123 Oak St")
- **Pre-work site photo requirement** (document "before" condition)
- **Customer notification** ("Technician has arrived")

**Required Workflow**:
1. GPS detects arrival within 100m of property
2. Prompt: "Arrived at [Property Name]? Confirm location."
3. Require pre-work photo (wide shot of property)
4. Update `jobs.actual_start` timestamp
5. Create `travel_log` entry (from previous location → current)
6. Send notification to customer
7. Voice option: "Arrived at job site"

---

### 4. **Job Completion Quality Verification** ✅ **MEDIUM PRIORITY**
**Status**: ⚠️ **PHOTOS EXIST, NO QUALITY WORKFLOW**

**Existing**:
- `jobs.photos_after` array ✅
- `quality_audits` table ✅
- `vision_verifications` table (Feature 001) ✅

**Missing**:
- **No completion checklist enforcement** ("Did you take after photos?")
- **No before/after comparison UI**
- **No automated quality scoring** (computer vision analysis)
- **No supervisor review prompt** for high-value jobs
- **No customer sign-off** (signature on completion)

**Required Workflow**:
1. Mark job complete triggers checklist:
   - ☑ After photos taken (minimum 3)
   - ☑ Materials used logged
   - ☑ Equipment returned to truck
   - ☑ Work area cleaned
2. Vision AI analyzes completion photos:
   - Detects missed areas (unmowed patches, debris left behind)
   - Compares to before photos (change detection)
   - Scores completion quality (0-100)
3. If quality score < 80, prompt supervisor review
4. If job > $500, require customer signature
5. Voice option: "Job complete, ready for review"

---

### 5. **Voice/Image Task Management** 🎙️ **MEDIUM PRIORITY**
**Status**: ❌ **NOT IMPLEMENTED**

**Missing**:
- **Add tasks via voice**: "Add task: Replace sprinkler head in zone 3"
- **Add tasks from handwritten notes**: Photo of paper → OCR → structured tasks
- **Check off tasks via voice**: "Task done: Mowed front lawn"
- **Check off tasks from photo**: Take photo → Vision AI detects completion
- **Assign tasks via voice**: "Assign this task to Jake for tomorrow"

**Required**:
```sql
CREATE TABLE job_tasks (
  id UUID PRIMARY KEY,
  job_id UUID REFERENCES jobs(id),
  template_task_id UUID, -- Link to reusable task templates
  task_name TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES users(id),
  status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'skipped'
  sequence_order INT,
  required BOOLEAN DEFAULT TRUE,
  completion_method TEXT, -- 'voice', 'photo', 'manual'
  completion_photo_id UUID REFERENCES media_assets(id),
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  voice_transcript_id UUID REFERENCES voice_transcripts(id),
  created_from TEXT -- 'voice', 'ocr_handwriting', 'template', 'manual'
);

CREATE TABLE task_templates (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  default_tasks JSONB NOT NULL, -- Array of {name, description, required, sequence_order}
  tags TEXT[],
  usage_count INT DEFAULT 0
);
```

**Examples**:
- Voice: "Add task: Check irrigation controller battery"
- Handwriting: Photo of note → OCR extracts → "Replace broken sprinkler head"
- Photo completion: Take photo of completed area → AI verifies task done
- Voice completion: "Task 3 done" → Mark task complete

---

### 6. **Time Tracking Integration** ⏱️ **HIGH PRIORITY**
**Status**: ⚠️ **TABLE EXISTS, NO INTEGRATION**

**Existing**:
- `time_entries` table ✅ (empty, need schema)
- Job timestamps (`actual_start`, `actual_end`) ✅

**Missing**:
- **Clock in/out workflow** ("Clock in for job 1234")
- **Automatic time entry creation** (when job status changes)
- **Travel time vs. work time** differentiation
- **Lunch break tracking**
- **Overtime alerts**
- **Timesheet approval workflow**

**Required Workflow**:
1. **Clock In**: "Clock in" → Create `time_entry` with `job_id`, `type='job_work'`, `start_time`
2. **Travel**: Job status → `in_transit` → Create `time_entry` with `type='travel'`
3. **Arrival**: GPS confirms arrival → Switch to `type='job_work'`
4. **Breaks**: "Start break" → Create `time_entry` with `type='break'`
5. **Clock Out**: "Clock out" → Update `time_entry.end_time`, calculate duration
6. **Daily Summary**: "How many hours today?" → Sum all entries

**Required Schema**:
```sql
-- Assuming time_entries exists, needs columns:
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS type TEXT; -- 'job_work', 'travel', 'break', 'admin'
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id);
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS start_location JSONB; -- GPS
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS end_location JSONB; -- GPS
```

---

### 7. **Historical Context Awareness** 🧠 **LOW PRIORITY**
**Status**: ❌ **NOT IMPLEMENTED**

**Missing**:
- **"Same as last time"** prompts (reuse previous job settings)
- **Anomaly detection** ("This job usually takes 2 hours, today took 5 - why?")
- **Seasonal patterns** ("Last spring, we used 10 bags of fertilizer here")
- **Customer preferences** ("Mrs. Smith always wants photos texted, not emailed")
- **Equipment usage patterns** ("Truck 214 goes to north side routes")

**Required**:
```sql
CREATE TABLE job_history_insights (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL,
  property_id UUID REFERENCES properties(id),
  customer_id UUID REFERENCES customers(id),
  insight_type TEXT NOT NULL, -- 'typical_duration', 'material_usage', 'seasonal_pattern', 'customer_preference'
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  confidence NUMERIC, -- 0-1 score
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id, insight_type, key)
);
```

**Examples**:
- "This property typically needs 5 bags of mulch"
- "Customer prefers Friday appointments 9-11 AM"
- "Zone 3 sprinkler head fails every 6 months"

---

## 🔄 Integration Gaps (Existing Systems Not Connected)

### 1. **Vision Verification (001) → Job Checklists**
**Current**: Vision AI verifies equipment kits before jobs
**Missing**: Use same AI for:
- Job arrival verification (photo of property matches address)
- Completion quality scoring (after photo analysis)
- Safety checklist photo requirements (e.g., trailer hitch photo)

---

### 2. **Voice Pipeline (003) → Task Management**
**Current**: Voice creates jobs, adds notes
**Missing**:
- Voice task list management
- Voice time tracking commands
- Voice safety checklist completion

---

### 3. **Inventory (004) → Job Execution**
**Current**: Tracks equipment/material check-in/out
**Missing**:
- Link to job task lists (material usage during job)
- Alert if required equipment unavailable (under maintenance)
- Auto-deduct materials when task completed

---

### 4. **Scheduling (003) → Safety Checklists**
**Current**: Job scheduling with kit definitions
**Missing**:
- Enforce safety checklist requirements based on job type
- Block job start if checklist incomplete
- Include checklist templates in job templates

---

## 🎯 Recommended Feature 005 Scope

Based on gap analysis, **Feature 005** should focus on:

### **Feature 005: Job Execution Workflows & Safety Compliance**

**Theme**: "Complete the job loop - from arrival to completion with safety and quality"

#### **Core Features** (P0):
1. ✅ **Safety Checklists**
   - Pre-drive trailer hookup
   - Equipment operation safety
   - Configurable per company/job type
   - Photo evidence requirements
   - Voice/photo completion

2. ✅ **Job Arrival Workflow**
   - GPS-triggered arrival confirmation
   - Pre-work site photo requirement
   - Customer notification
   - Automatic time entry creation

3. ✅ **Job Completion Quality Workflow**
   - After photo requirements (min 3)
   - Before/after comparison UI
   - Computer vision quality scoring
   - Supervisor review for high-value jobs
   - Customer signature capture

4. ✅ **Time Tracking Integration**
   - Clock in/out via voice or button
   - Automatic travel time tracking
   - Break management
   - Daily hours summary
   - Timesheet approval

5. ✅ **Voice/Image Task Management**
   - Add tasks via voice or handwritten notes
   - Check off tasks via voice or photo
   - Task templates for common jobs
   - Assign tasks to crew members

#### **Secondary Features** (P1):
6. ✅ **Special Instructions Viewer**
   - PDF document viewer
   - Video player with required viewing enforcement
   - Reference image side-by-side comparison
   - SOP library

7. ✅ **Task Assignment & Templates**
   - Save task lists as templates
   - Apply templates to new jobs
   - Team task assignment
   - Task completion notifications

#### **Nice-to-Have** (P2):
8. ⚠️ **Historical Context** (limited scope)
   - "Same as last time" quick apply
   - Typical duration warnings (if > 2x expected)
   - Material usage predictions

---

## 🚫 OUT OF SCOPE for Feature 005

**Reserve for Feature 006+ or later phases**:
- ❌ Mapping & route optimization (complex, needs Mapbox deep integration)
- ❌ Customer/vendor intake (already partially covered by existing Customer domain)
- ❌ Visual Q&A ("What's wrong with this plant?") - requires agronomic knowledge base
- ❌ Site intelligence & upsell detection - requires advanced change detection
- ❌ Supplier auto-discovery - nice-to-have, not critical path

---

## 📊 Database Migration Requirements for Feature 005

### **New Tables Needed**:
1. `safety_checklists` - Checklist definitions
2. `safety_checklist_completions` - Completion records
3. `instruction_documents` - PDF/video guidance
4. `job_instructions` - Link instructions to jobs
5. `job_tasks` - Task tracking per job
6. `task_templates` - Reusable task lists
7. `job_history_insights` - Historical patterns (P2)

### **Schema Updates Needed**:
1. `time_entries` - Add `type`, `job_id`, `start_location`, `end_location`
2. `jobs` - Add `arrival_photo_id`, `completion_quality_score`
3. `quality_audits` - Add `before_photo_ids`, `after_photo_ids`, `vision_analysis`

### **No Breaking Changes**: All additive, backward compatible.

---

## ✅ Next Steps

1. ✅ **Review this gap analysis** with team - DONE (this document)
2. ⏳ **Prioritize P0 features** for Feature 005 specification
3. ⏳ **Create Feature 005 SPECIFY workflow**:
   - User scenarios (safety checklists, arrival, completion, time tracking, task management)
   - Clarification questions
   - Functional requirements (FR-001 through FR-100+)
   - Database schema design
   - API contracts
4. ⏳ **Plan migrations** - CRITICAL: Use Supabase client RPC method (per CLAUDE.md)
5. ⏳ **Implement & test** - TDD approach, RLS enforcement, offline support

---

## 📝 Notes for Feature 005 SPECIFY

### **User Personas**:
- **Field Technician**: Needs simple, voice-first, offline-capable workflows
- **Supervisor**: Needs quality review, approval, anomaly detection
- **Dispatcher**: Needs to create jobs with safety requirements
- **Admin**: Needs to configure safety checklists, templates, approval workflows

### **Voice Prompts** (must include):
- "Start safety checklist"
- "Trailer hookup complete"
- "Arrived at job site"
- "Clock in for job 1234"
- "Add task: Fix broken sprinkler"
- "Task 3 done"
- "Clock out"
- "Job complete, ready for review"

### **Image/OCR Use Cases**:
- Safety checklist photo evidence (trailer hitch, PPE)
- Job arrival site photo (GPS + visual verification)
- Job completion photos (before/after)
- Task completion verification (photo proves work done)
- Handwritten note OCR → structured tasks

### **Integration Points**:
- Feature 001 (Vision): Reuse YOLO + VLM pipeline for quality scoring
- Feature 003 (Scheduling): Enforce safety checklist requirements per job type
- Feature 004 (Inventory): Link material usage to job tasks
- Existing `jobs`, `time_entries`, `media_assets`, `quality_audits` tables

---

**END OF GAP ANALYSIS**