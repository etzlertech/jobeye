# Feature 005: Field Intelligence - Safety, Routing & Smart Intake

**Branch**: `005-field-intelligence`
**Created**: 2025-09-30
**Status**: Specification Phase
**Foundation**: Gap Analysis (FEATURE_GAP_ANALYSIS_2025-09-30.md)

---

## 🎯 Mission Statement

**Transform JobEye from a documentation tool into a proactive field intelligence system** that guides technicians through safe, efficient job execution with:

1. **Safety & Compliance** - Automated checklists with photo evidence
2. **Smart Routing** - Real-time route optimization with dynamic re-routing
3. **Intelligent Intake** - Voice/photo capture of customers and vendors
4. **Job Workflows** - Seamless arrival → work → completion → quality verification
5. **Time Intelligence** - Automated tracking with GPS verification

---

## 🏗️ Feature Architecture (5 Domains)

### **Domain 1: Safety & Compliance** 🚨
**Tables**: `safety_checklists`, `safety_checklist_completions`
**Integration**: Job templates, equipment requirements, training certificates

**Capabilities**:
- Pre-drive trailer hookup verification (hitch, chains, lights, brakes)
- Equipment operation safety checks (PPE, guards, lockout/tagout)
- Site-specific hazards (confined spaces, chemical handling)
- Photo evidence requirements (critical items)
- Voice completion: "Safety checklist done"
- Blocking mechanism: Can't start job without required checklists

---

### **Domain 2: Intelligent Routing** 🗺️
**Tables**: `daily_routes`, `route_waypoints`, `route_optimizations`, `route_events`
**Integration**: Mapbox Optimization API, jobs scheduling, GPS tracking, traffic data

**Capabilities**:

#### **2.1 Route Optimization**
- **Morning route generation**: Optimize day's jobs for minimal drive time
- **Multi-criteria optimization**:
  - Minimize total distance
  - Honor time windows (customer appointments)
  - Respect lunch breaks (30min, 12-1pm preferred)
  - Account for equipment requirements (stop at shop mid-day if needed)
  - Factor in estimated job durations
- **Crew coordination**: Show other crews' locations, prevent double-booking
- **Material planning**: "Stop at Home Depot before 3rd job - need 5 bags mulch"

#### **2.2 Dynamic Re-routing**
- **Traffic delays**: Update ETAs, notify customers
- **Weather impacts**: Skip outdoor jobs when raining, reschedule automatically
- **Urgent insertions**: Emergency calls bump route, re-optimize remaining stops
- **Equipment failures**: Redirect to nearest truck with backup equipment
- **Job cancellations**: Remove from route, fill gap with pending jobs

#### **2.3 Voice-Driven Navigation**
- "Next stop" → Navigate to next job
- "Skip this job" → Remove from today, add to tomorrow
- "Add gas station stop" → Insert waypoint, re-optimize
- "Where's the nearest truck with a chainsaw?" → Find equipment, route to it
- "ETA to next job?" → Calculate arrival time with current traffic

#### **2.4 Arrival Detection & Verification**
- **GPS geofencing**: Auto-detect arrival within 100m of property
- **Prompt confirmation**: "Arrived at 123 Oak St?"
- **Photo verification**: Take site photo, verify address match (OCR house number)
- **Customer notification**: "Technician has arrived"
- **Automatic time entry**: Start clock, log travel time

---

### **Domain 3: Smart Customer/Vendor Intake** 📸
**Tables**: `intake_sessions`, `intake_extractions`, `contact_candidates`, `property_candidates`
**Integration**: Existing `customers`, `vendors`, `vendor_locations` tables

**Capabilities**:

#### **3.1 Business Card Capture**
**Workflow**:
1. Tech takes photo of business card at job site
2. OCR extracts: name, company, title, phone, email, address, website
3. VLM analyzes: business type, logo colors, branding style
4. System prompts: "Create new customer 'ABC Landscaping'?" or "Add contact to existing customer?"
5. Voice confirmation: "Yes, this is the billing contact"
6. Auto-link to current property/job if applicable

**Smart Matching**:
- Fuzzy match against existing customers (avoid duplicates)
- Detect vendor vs. customer context (at supply store vs. job site)
- Extract multiple contacts from single card (cell + office numbers)

#### **3.2 Building/Property Intake**
**Workflow**:
1. Tech photographs house facade or business sign
2. Vision AI extracts: building type, colors, distinguishing features
3. OCR reads: house numbers, business names, suite numbers
4. GPS captures: exact coordinates
5. System prompts: "Create property for new customer?" or "Link to existing customer [Name]?"
6. Stores reference image for future navigation ("Blue house with red door")

**Smart Features**:
- Visual property matching (avoid duplicate properties)
- Automatic property type classification (residential, commercial, HOA)
- Curb appeal assessment (lot size estimation, lawn area)

#### **3.3 Vehicle Identification**
**Workflow**:
1. Tech photographs customer's truck/van/trailer
2. OCR reads: license plate, VIN (if visible), fleet numbers
3. Vision AI detects: make, model, year, color, condition
4. System prompts: "Link this vehicle to customer [Name]?"
5. Use case: Equipment rental tracking, vendor fleet management

#### **3.4 Signage Capture (Vendor Registration)**
**Workflow**:
1. Tech at supplier, photographs storefront sign
2. OCR extracts: business name, phone, hours
3. GPS captures: location coordinates
4. System prompts: "Register as vendor 'Home Depot #4523'?"
5. Auto-populate vendor record with location, contact info

**Smart Context**:
- Detect when near known suppliers (geofencing)
- Auto-suggest vendor registration when purchasing materials
- Link vendor locations to purchase history

---

### **Domain 4: Job Execution Workflows** ✅
**Tables**: `workflow_tasks`, `task_templates`, `instruction_documents`, `job_instructions`
**Integration**: Existing `jobs`, `time_entries`, `travel_logs`, `quality_audits`
**Note**: `workflow_tasks` is the canonical job task table (job_tasks never existed in production)

**Capabilities**:

#### **4.1 Job Arrival Workflow**
1. GPS detects arrival (100m geofence)
2. Prompt: "Arrived at [Property Name]? Confirm location."
3. Required: Pre-work site photo (wide shot)
4. Update `jobs.actual_start`, create `time_entry` (switch from travel → job_work)
5. Create `travel_log` entry (from previous location → current)
6. Send customer notification
7. Voice option: "Arrived at job site"

#### **4.2 Task Management**
**Add Tasks**:
- Voice: "Add task: Replace sprinkler head in zone 3"
- Handwriting: Photo of note → OCR → structured task
- Template: Apply saved task list from similar job

**Complete Tasks**:
- Voice: "Task 3 done" → Mark complete
- Photo: Take image → Vision AI verifies completion
- Manual: Tap checkbox

**Assign Tasks**:
- Voice: "Assign this task to Jake"
- Bulk: "Assign all bed prep tasks to crew 2"

#### **4.3 Special Instructions Viewer**
- **PDF Documents**: Irrigation controller manual, SOP checklist
- **Video Player**: Required viewing enforcement ("Watch pruning technique video")
- **Reference Images**: Side-by-side comparison ("Match this hedge shape")
- **Acknowledgment Tracking**: Who viewed, when, did they acknowledge?

#### **4.4 Job Completion Workflow**
1. Mark job complete triggers checklist:
   - ☑ After photos taken (minimum 3)
   - ☑ Materials used logged
   - ☑ Equipment returned to truck
   - ☑ Work area cleaned
2. Vision AI analyzes completion photos:
   - Detects missed areas (unmowed patches)
   - Compares to before photos (change detection)
   - Scores completion quality (0-100)
3. If quality < 80 OR job value > $500: Require supervisor review
4. Customer signature if > $500
5. Voice option: "Job complete"

#### **4.5 Time Tracking Integration**
**Clock In**: "Clock in" → Create `time_entry`, `type='job_work'`, capture GPS
**Travel**: Job status → `in_transit` → Switch to `type='travel'`
**Arrival**: GPS confirms → Switch back to `type='job_work'`
**Break**: "Start break" → Create `time_entry`, `type='break'`
**Clock Out**: "Clock out" → End entry, calculate duration
**Daily Summary**: "How many hours today?" → Sum all entries

---

### **Domain 5: Historical Context** 🧠
**Tables**: `job_history_insights`, `route_history`, `performance_baselines`
**Integration**: Jobs, properties, customers, routes

**Capabilities** (Limited Scope - P1):
- **"Same as last time"**: Quick apply previous job settings
- **Anomaly detection**: "This job usually takes 2 hours, today took 5 - why?"
- **Material predictions**: "Last time used 10 bags fertilizer, order enough?"
- **Typical durations**: Show baseline for similar jobs
- **Route patterns**: "You always take I-95 south, try Route 1 today - 10min faster"

---

## 🎨 User Experience Flows

### **Flow 1: Morning Start**
```
1. Dispatcher creates route: 8 jobs, optimized for Truck 214
2. Tech opens app: "Good morning! Your route is ready. 8 stops, 47 miles, finish by 4pm."
3. "First job: 123 Oak St, arrive by 8:30am. Special instructions available."
4. Tech taps "View instructions" → PDF opens (gate code, customer preferences)
5. "Start safety checklist?" → Photo of trailer hitch, chains, lights
6. "Safety checklist complete ✓ Ready to depart."
7. "Navigate to first stop" → Mapbox directions, ETA 8:28am
```

### **Flow 2: Job Arrival**
```
1. GPS detects arrival: "Arrived at 123 Oak St?"
2. Tech confirms: "Yes"
3. "Take pre-work photo" → Captures wide shot of property
4. Auto: Clock switches from travel → job work
5. Auto: Travel log created (Shop → 123 Oak St, 12.3 miles, 18min)
6. Auto: Customer notified "Technician arrived"
7. "Task list ready: 5 tasks. Tap to view."
```

### **Flow 3: Mid-Job Smart Intake**
```
1. Customer: "Can you give my lawn care guy a call? Here's his card."
2. Tech: Takes photo of business card
3. OCR extracts: "John Smith, Green Thumb Lawn Care, 555-1234, john@greenthumb.com"
4. System: "Create vendor 'Green Thumb Lawn Care'?"
5. Tech: "Yes" (voice)
6. Auto: Vendor registered, linked to current property
7. System: "Would you like to call now?" → One-tap dial
```

### **Flow 4: Dynamic Re-routing**
```
1. Tech on route, 3 jobs remaining
2. Emergency call: Broken sprinkler, 456 Elm St (3 miles away)
3. System: "Emergency job inserted. Re-optimizing route..."
4. New ETA for remaining jobs calculated
5. Auto: Customer notifications sent ("Delayed 30min due to emergency")
6. Voice: "Next stop is now 456 Elm St, emergency repair. ETA 15 minutes."
```

### **Flow 5: Job Completion**
```
1. Tech: "Job complete"
2. System: "Checklist: ☑ Photos taken? ☑ Materials logged? ☑ Area cleaned?"
3. Tech takes 3 after photos
4. Vision AI analyzes: Quality score 92/100 ✓
5. System: "Completion verified. Customer signature required (job value $650)."
6. Customer signs on tablet
7. Auto: Clock switches to travel, navigates to next stop
8. Daily summary: "4 jobs done, 4 remaining. On track to finish by 4:15pm."
```

---

## 📊 Database Schema (Additive Only)

### **Safety & Compliance**
```sql
CREATE TABLE safety_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  description TEXT,
  required_for JSONB, -- {job_types: [], equipment_types: [], conditions: []}
  items JSONB NOT NULL, -- [{id, task, type, photo_required, critical}]
  frequency TEXT, -- 'per_job', 'daily', 'weekly', 'monthly'
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE safety_checklist_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID REFERENCES safety_checklists(id),
  job_id UUID REFERENCES jobs(id),
  user_id UUID REFERENCES users(id),
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  items_completed JSONB NOT NULL, -- [{item_id, value, photo_id, timestamp, notes}]
  location JSONB, -- {lat, lng, accuracy}
  signature TEXT, -- Base64 if required
  notes TEXT
);
```

### **Routing & Navigation**
```sql
CREATE TABLE daily_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  route_date DATE NOT NULL,
  assigned_to UUID REFERENCES users(id),
  vehicle_id UUID, -- Link to equipment (truck)
  status TEXT DEFAULT 'draft', -- 'draft', 'optimized', 'active', 'completed', 'cancelled'
  optimization_params JSONB, -- {criteria: 'distance'|'time', avoid_tolls: true, etc}
  total_distance_km NUMERIC,
  estimated_duration_min INT,
  actual_duration_min INT,
  mapbox_route_id TEXT, -- Mapbox Optimization API response ID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE TABLE route_waypoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID REFERENCES daily_routes(id) ON DELETE CASCADE,
  waypoint_type TEXT NOT NULL, -- 'start', 'job', 'break', 'material_stop', 'equipment_swap', 'end'
  sequence_order INT NOT NULL,
  job_id UUID REFERENCES jobs(id),
  location JSONB NOT NULL, -- {lat, lng, address, name}
  scheduled_arrival TIMESTAMPTZ,
  actual_arrival TIMESTAMPTZ,
  scheduled_departure TIMESTAMPTZ,
  actual_departure TIMESTAMPTZ,
  estimated_duration_min INT, -- Time at this stop
  notes TEXT,
  skipped BOOLEAN DEFAULT FALSE,
  skip_reason TEXT
);

CREATE TABLE route_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID REFERENCES daily_routes(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'start', 'arrival', 'departure', 're-optimization', 'delay', 'completion'
  waypoint_id UUID REFERENCES route_waypoints(id),
  event_time TIMESTAMPTZ DEFAULT NOW(),
  location JSONB, -- Current GPS when event occurred
  metadata JSONB -- {reason, traffic_delay_min, weather_condition, etc}
);

CREATE TABLE route_optimizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID REFERENCES daily_routes(id) ON DELETE CASCADE,
  optimization_time TIMESTAMPTZ DEFAULT NOW(),
  trigger TEXT, -- 'manual', 'job_added', 'job_cancelled', 'traffic_delay', 'equipment_failure'
  before_waypoints JSONB, -- Snapshot before re-optimization
  after_waypoints JSONB, -- New optimized sequence
  distance_saved_km NUMERIC,
  time_saved_min INT,
  mapbox_request_id TEXT,
  cost_usd NUMERIC(10,4) -- Mapbox API cost
);
```

### **Smart Intake**
```sql
CREATE TABLE intake_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  user_id UUID REFERENCES users(id),
  session_type TEXT NOT NULL, -- 'business_card', 'property', 'vehicle', 'signage'
  media_id UUID REFERENCES media_assets(id),
  location JSONB, -- GPS at time of capture
  context JSONB, -- {job_id, property_id, customer_id} if applicable
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE intake_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES intake_sessions(id) ON DELETE CASCADE,
  extraction_method TEXT NOT NULL, -- 'ocr', 'vlm', 'hybrid'
  provider TEXT, -- 'tesseract', 'openai_vision', etc
  raw_text TEXT, -- OCR output
  structured_data JSONB NOT NULL, -- {name, company, phone, email, address, etc}
  confidence_scores JSONB, -- {field: confidence} per field
  cost_usd NUMERIC(10,4),
  processing_time_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE contact_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_session_id UUID REFERENCES intake_sessions(id),
  candidate_type TEXT NOT NULL, -- 'customer_contact', 'vendor_contact', 'property_owner'
  extracted_data JSONB NOT NULL,
  match_confidence NUMERIC, -- 0-1, similarity to existing records
  existing_customer_id UUID REFERENCES customers(id), -- If matched
  existing_vendor_id UUID REFERENCES vendors(id), -- If matched
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'duplicate'
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_record_id UUID -- ID of customer/vendor record if created
);

CREATE TABLE property_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_session_id UUID REFERENCES intake_sessions(id),
  extracted_data JSONB NOT NULL, -- {address, coordinates, type, features, reference_image}
  match_confidence NUMERIC,
  existing_property_id UUID REFERENCES properties(id),
  status TEXT DEFAULT 'pending',
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  created_property_id UUID REFERENCES properties(id)
);
```

### **Job Workflows**
```sql
-- Note: workflow_tasks is the canonical job task table (job_tasks never existed in production)
CREATE TABLE workflow_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  template_task_id UUID, -- Link to reusable templates
  task_name TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES users(id),
  status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'skipped', 'blocked'
  sequence_order INT,
  required BOOLEAN DEFAULT TRUE,
  depends_on_task_id UUID REFERENCES workflow_tasks(id), -- Task dependencies
  estimated_duration_min INT,
  actual_duration_min INT,
  completion_method TEXT, -- 'voice', 'photo', 'manual', 'auto'
  completion_photo_id UUID REFERENCES media_assets(id),
  completion_evidence JSONB, -- {vision_confidence, voice_transcript_id, etc}
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id),
  voice_transcript_id UUID REFERENCES voice_transcripts(id),
  created_from TEXT, -- 'voice', 'ocr', 'template', 'manual'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name TEXT NOT NULL,
  description TEXT,
  job_type TEXT, -- Link to job types
  default_tasks JSONB NOT NULL, -- [{name, description, required, sequence_order, estimated_duration}]
  tags TEXT[],
  usage_count INT DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE instruction_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  title TEXT NOT NULL,
  document_type TEXT NOT NULL, -- 'pdf', 'video', 'reference_image', 'sop'
  media_id UUID REFERENCES media_assets(id),
  required_viewing BOOLEAN DEFAULT FALSE,
  category TEXT, -- 'equipment', 'technique', 'safety', 'customer_preference'
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE job_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  instruction_id UUID REFERENCES instruction_documents(id),
  required BOOLEAN DEFAULT FALSE,
  viewed_by JSONB, -- {user_id: {viewed_at, duration_sec, acknowledged}}
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### **Historical Context**
```sql
CREATE TABLE job_history_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  property_id UUID REFERENCES properties(id),
  customer_id UUID REFERENCES customers(id),
  job_type TEXT,
  insight_type TEXT NOT NULL, -- 'typical_duration', 'material_usage', 'crew_size', 'seasonal_pattern'
  insight_key TEXT NOT NULL,
  insight_value JSONB NOT NULL,
  confidence NUMERIC, -- 0-1, statistical confidence
  sample_size INT, -- Number of jobs analyzed
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(property_id, job_type, insight_type, insight_key)
);

CREATE TABLE route_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  user_id UUID REFERENCES users(id),
  route_pattern TEXT, -- Hash of sequence of properties
  avg_duration_min INT,
  avg_distance_km NUMERIC,
  times_used INT,
  last_used TIMESTAMPTZ
);
```

### **Schema Updates (Existing Tables)**
```sql
-- time_entries: Add new columns
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS type TEXT; -- 'job_work', 'travel', 'break', 'admin'
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES jobs(id);
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS start_location JSONB;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS end_location JSONB;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS auto_created BOOLEAN DEFAULT FALSE;

-- jobs: Add workflow fields
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS arrival_photo_id UUID REFERENCES media_assets(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS arrival_confirmed_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completion_quality_score INT; -- 0-100
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS requires_supervisor_review BOOLEAN DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS supervisor_reviewed_by UUID REFERENCES users(id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS supervisor_reviewed_at TIMESTAMPTZ;

-- properties: Add intake reference
ALTER TABLE properties ADD COLUMN IF NOT EXISTS intake_session_id UUID REFERENCES intake_sessions(id);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS reference_image_id UUID REFERENCES media_assets(id);

-- customers: Add intake reference
ALTER TABLE customers ADD COLUMN IF NOT EXISTS intake_session_id UUID REFERENCES intake_sessions(id);

-- vendors: Add intake and location support
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS intake_session_id UUID REFERENCES intake_sessions(id);
ALTER TABLE vendor_locations ADD COLUMN IF NOT EXISTS coordinates JSONB; -- {lat, lng}
ALTER TABLE vendor_locations ADD COLUMN IF NOT EXISTS geofence_radius_m INT DEFAULT 100;
```

---

## 🔗 Integration Points

### **Feature 001 (Vision Kit Verification)**
- Reuse YOLO + VLM pipeline for:
  - Job arrival property verification (photo matches address)
  - Job completion quality analysis (detect missed areas)
  - Safety checklist photo evidence (verify hitch locked, PPE worn)
  - Smart intake (business card OCR, property photos)

### **Feature 003 (Scheduling)**
- Fetch job kit definitions for route planning
- Link safety checklist requirements to job templates
- Trigger notifications for incomplete checklists

### **Feature 004 (Inventory)**
- Material stop insertions in routes ("Low on mulch, stop at supplier")
- Link material usage to job tasks
- Equipment availability for route assignment

### **Existing Infrastructure**
- `jobs` table: Add workflow fields (arrival photo, quality score, etc)
- `time_entries` table: Extend with GPS tracking, auto-creation
- `media_assets`: Store PDFs, videos, reference images, intake photos
- `quality_audits`: Link to completion photos, vision analysis

---

## 🎙️ Voice Commands (Comprehensive)

### **Safety**
- "Start safety checklist"
- "Trailer hookup complete"
- "All safety checks done"
- "Skip this check" (with reason prompt)

### **Routing & Navigation**
- "Optimize my route"
- "Next stop"
- "Navigate"
- "Skip this job"
- "Add stop: Home Depot"
- "Add stop: gas station"
- "Where's nearest truck with [equipment]?"
- "ETA to next job?"
- "Delay 15 minutes" (notify customer)

### **Arrival**
- "Arrived"
- "Arrived at job site"
- "Confirm location"

### **Smart Intake**
- "Add this business card"
- "Create customer from this photo"
- "Register this vendor"
- "Save this property"

### **Task Management**
- "Add task: [description]"
- "Task [number] done"
- "All tasks done"
- "Assign this task to [name]"
- "Show task list"
- "Skip task [number]" (with reason)

### **Time Tracking**
- "Clock in"
- "Clock in for job [number]"
- "Start break"
- "End break"
- "Clock out"
- "How many hours today?"

### **Completion**
- "Job complete"
- "Ready for review"
- "Take completion photos"

---

## 🎯 Success Metrics

### **Safety & Compliance**
- **100%** of required checklists completed before job start
- **<2%** safety incidents (vs. baseline without checklists)
- **Average 90 seconds** to complete trailer hookup checklist

### **Routing Efficiency**
- **15-20%** reduction in daily drive time
- **95%** route adherence (jobs completed in optimized sequence)
- **<5 minutes** average delay for emergency re-routing

### **Smart Intake**
- **<30 seconds** average business card → customer record
- **90%** OCR accuracy on contact info
- **<5%** duplicate customer/vendor creation

### **Job Workflows**
- **100%** of jobs have arrival confirmation photo
- **80%** of completions pass auto-quality check (score >80)
- **<2 minutes** average time from "job complete" to quality verification

### **Time Tracking**
- **95%** automatic time entry accuracy (vs. manual entry)
- **Zero** missed clock-outs (GPS auto-detects day end)
- **10 hours/month** admin time saved per technician

---

## 🚫 OUT OF SCOPE (Defer to 006+)

**Reserved for Feature 006**:
- ❌ Visual Q&A for plants/equipment ("What's wrong with this plant?")
- ❌ Site intelligence & upsell detection (change detection for revenue opportunities)
- ❌ Advanced route analytics (seasonal patterns, optimal crew pairing)
- ❌ Customer portal integration (self-service scheduling)

---

## 📅 Implementation Phases

### **Phase 1: Safety & Time Tracking** (Weeks 1-2)
- Safety checklist tables & RLS
- Safety checklist completion workflow
- Time entry auto-creation on job status changes
- Clock in/out voice commands

### **Phase 2: Routing Foundation** (Weeks 3-4)
- Daily route tables & Mapbox integration
- Route optimization service
- Waypoint management
- GPS arrival detection

### **Phase 3: Smart Intake** (Weeks 5-6)
- Intake session tables
- Business card OCR workflow
- Property photo intake
- Vendor registration from signage

### **Phase 4: Job Workflows** (Weeks 7-8)
- Job tasks tables & templates
- Task voice/photo completion
- Instruction document viewer
- Completion quality scoring

### **Phase 5: Integration & Polish** (Weeks 9-10)
- Connect routing → time tracking → tasks
- Historical insights generation
- Voice command refinement
- Offline queue sync for all new features

---

**Next Step**: Generate full SPECIFY document with:
1. 100+ detailed user scenarios
2. 200+ functional requirements
3. Complete API contracts
4. Test specifications
5. Migration scripts

**Status**: ✅ **SCOPE APPROVED - READY FOR SPECIFY**