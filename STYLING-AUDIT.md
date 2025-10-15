# Supervisor Pages Styling Audit

**Date**: 2025-10-15
**Golden Standard**: `src/app/supervisor/properties/page.tsx` and `src/app/supervisor/inventory/page.tsx`

## Pages to Audit

### ✅ Already Golden Standard
1. **Properties** (`src/app/supervisor/properties/page.tsx`)
   - Status: ✅ GOLDEN STANDARD
   - Has: Mobile container, golden buttons, proper notifications, card styling

2. **Inventory** (`src/app/supervisor/inventory/page.tsx`)
   - Status: ✅ GOLDEN STANDARD
   - Has: Mobile container, camera flow, stat cards, golden buttons

### 📋 Needs Styling Update

#### 3. Dashboard (`src/app/supervisor/page.tsx`)
- **Status**: ✅ COMPLETED (Commit 9801b7b)
- **Completed**:
  - [x] Replace generic components with golden standard styled-jsx
  - [x] Update stat cards to use golden borders/colors
  - [x] Update Quick Actions buttons to btn-primary/btn-secondary
  - [x] Ensure Today's Jobs cards match property-card styling
  - [x] Update crew status and inventory alert cards
- **Behavior Preserved**: ✅ All dashboard API calls, job navigation, stats calculation

#### 4. Customers (`src/app/supervisor/customers/page.tsx`)
- **Status**: ✅ COMPLETED (Commit 0426551)
- **Completed**:
  - [x] Mobile container with golden theme
  - [x] Header bar with golden icon
  - [x] List cards with golden borders and hover effects
  - [x] Bottom actions with btn-primary/btn-secondary
  - [x] Form fields with golden focus rings
  - [x] Notification bars for success/error
- **Behavior Preserved**: ✅ Customer CRUD, address fields, phone/email validation

#### 5. Jobs List (`src/app/(authenticated)/supervisor/jobs/page.tsx`)
- **Current**: Part of Phase 3 work (check current styling)
- **Needs**:
  - [ ] Ensure matches golden mobile-container
  - [ ] Job cards with golden borders
  - [ ] Status badges with proper colors
  - [ ] Bottom actions bar
- **Behavior to Preserve**: Job filtering, customer/property dropdowns, transaction logic

#### 6. Job Detail/Items (`src/app/(authenticated)/supervisor/jobs/[jobId]/page.tsx`)
- **Current**: Transaction-based item assignment
- **Needs**:
  - [ ] Golden mobile container
  - [ ] Item list cards with golden styling
  - [ ] Add/remove item buttons
  - [ ] Quantity input fields with golden focus
- **Behavior to Preserve**: Check-in/check-out logic, transaction API calls

## Pages NOT in Scope (Different Roles)
- Crew pages (`src/app/crew/*`)
- Admin pages (`src/app/admin/*`)
- Demo pages (`src/app/demo-*`)
- Public pages (sign-in, etc.)

## Styling Components to Extract

### Candidate for Shared Component
- `<GoldenMobileContainer>` - Wraps entire page
- `<GoldenHeaderBar>` - Top header with title
- `<GoldenNotification>` - Success/error messages
- `<GoldenBottomActions>` - Button bar at bottom
- `<GoldenCard>` - List item cards
- `<GoldenButton>` - Primary/secondary buttons
- `<GoldenInput>` - Form fields with golden focus

**Note**: May keep styled-jsx per-page for now to avoid over-abstraction. Decision pending after manual review.

## Testing Strategy

For each page updated:
1. **Before**: Screenshot in browser at 375px width
2. **Update**: Apply golden styling, preserve all logic
3. **After**: Screenshot at 375px width
4. **Verify**:
   - All buttons clickable
   - All forms submit correctly
   - All navigation works
   - All data loads
   - Mobile layout intact

## Success Criteria

- [ ] All supervisor pages use #000 background
- [ ] All buttons use #FFD700 golden or white/transparent secondary
- [ ] All cards have `rgba(255, 215, 0, 0.2)` borders
- [ ] All inputs have golden focus rings
- [ ] All pages use mobile-container (375px max-width)
- [ ] All bottom actions use same spacing and styling
- [ ] All existing CRUD flows still work
- [ ] All API calls unchanged
- [ ] All hooks unchanged
