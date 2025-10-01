# Quickstart Guide: MVP Intent-Driven Mobile App

This guide helps you quickly set up and test the MVP intent-driven mobile app.

## Prerequisites

- Node.js 20.x installed
- Supabase project with credentials
- Gemini API key (primary VLM)
- GPT-4 API key (fallback VLM)
- Modern mobile browser with camera access

## Environment Setup

1. **Clone the repository**:
```bash
git clone <repository-url>
cd jobeye
git checkout 007-mvp-intent-driven
```

2. **Install dependencies**:
```bash
npm install
```

3. **Configure environment**:
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# AI Services
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key

# App Config
NEXT_PUBLIC_APP_NAME="JobEye MVP"
NEXT_PUBLIC_MAX_BUTTONS=4
NEXT_PUBLIC_OFFLINE_ENABLED=true
```

4. **Run database migrations**:
```bash
npm run db:migrate
```

## Quick Test Scenarios

### Scenario 1: Supervisor Adds Inventory Item

1. **Login as Supervisor**:
   - Navigate to `/auth/sign-in`
   - Use: `supervisor@test.com` / `TestPass123!`

2. **Navigate to Camera**:
   - Tap "Start Camera" button
   - Point at any tool/equipment

3. **Verify Intent Detection**:
   - System should detect "New Inventory Item"
   - Show "Add to Inventory" button

4. **Complete Addition**:
   - Tap "Add to Inventory"
   - Speak or type item name
   - Confirm with voice "Yes, save it"

5. **Verify Success**:
   - Item appears in inventory list
   - 512x512 thumbnail generated
   - AI interaction logged

### Scenario 2: Crew Member Job Load Verification

1. **Login as Crew**:
   - Navigate to `/auth/sign-in`
   - Use: `crew1@test.com` / `TestPass123!`

2. **View Assigned Jobs**:
   - Dashboard shows today's jobs
   - Tap first job card

3. **Start Load Verification**:
   - Tap "Verify Load List"
   - Camera opens automatically

4. **Scan Items**:
   - Point at equipment items
   - Watch items auto-check
   - Manual check if offline

5. **Complete Verification**:
   - All items checked
   - Tap "Complete Verification"
   - Supervisor notified

### Scenario 3: Voice-Driven Job Creation

1. **As Supervisor**:
   - From any screen
   - Tap microphone button

2. **Speak Command**:
   - "Create new job for tomorrow"
   - System asks: "Which customer?"
   - "Johnson property on Main Street"

3. **Assign Items**:
   - "Add mower, trimmer, and blower"
   - System confirms each item

4. **Assign Crew**:
   - "Assign to John Smith"
   - System checks daily limit
   - Confirms assignment

### Scenario 4: Offline Mode

1. **Enable Airplane Mode**

2. **As Crew Member**:
   - Open assigned job
   - Start load verification
   - Check items manually

3. **Complete Offline**:
   - Items marked locally
   - "Pending Sync" indicator

4. **Restore Connection**:
   - Disable airplane mode
   - Watch auto-sync
   - Verify in supervisor view

## Development Commands

```bash
# Start development server
npm run dev

# Run tests
npm test

# Run specific test suite
npm test -- domains/intent

# Generate TypeScript types from Supabase
npm run generate:types

# Check code quality
npm run lint
npm run type-check
```

## Testing the Intent System

### Test Different Intents

1. **Inventory Add**:
   - Show new tool
   - Verify "Add to Inventory" flow

2. **Receipt Scan**:
   - Show paper receipt
   - Verify OCR and expense tracking

3. **Maintenance Event**:
   - Show damaged equipment
   - Verify severity detection

4. **Vehicle Detection**:
   - Show truck/trailer
   - Verify container hierarchy

## Performance Validation

1. **Intent Recognition Speed**:
   - Should classify in <3 seconds
   - Gemini first, GPT-4 fallback

2. **Page Load Times**:
   - Initial load <2 seconds
   - Route changes <500ms

3. **Offline Sync**:
   - Queue operations instantly
   - Sync within 10s of reconnection

## Troubleshooting

### Camera Not Working
- Check browser permissions
- Ensure HTTPS (or localhost)
- Try different browser

### Voice Commands Not Recognized
- Check microphone permissions
- Speak clearly, pause after prompt
- Fallback to text input

### Offline Sync Issues
- Check IndexedDB in DevTools
- Clear offline queue if stuck
- Verify service worker active

### Intent Misclassification
- Use feedback button
- Check lighting conditions
- Try different angle

## API Testing

Use the provided Postman collection or curl:

```bash
# Test intent classification
curl -X POST http://localhost:3000/api/intent/classify \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "image": "base64_image_data",
    "userId": "user_uuid"
  }'

# Get crew jobs
curl http://localhost:3000/api/crew/jobs \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Next Steps

1. **Customize Branding**:
   - Update `public/` assets
   - Modify theme in `tailwind.config.js`

2. **Add Test Data**:
   - Run `npm run seed:demo`
   - Creates sample users, jobs, inventory

3. **Deploy to Staging**:
   - Push to main branch
   - Railway auto-deploys
   - Test on real devices

## Support

- Check logs: `npm run logs:dev`
- Database inspector: Supabase Dashboard
- AI costs: Check AI interaction logs table