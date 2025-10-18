# Implementation Plan: User Management with Profile Images

**Date**: 2025-10-17
**Feature**: User Management Screen with Square Profile Images
**Estimated Complexity**: Medium (3-5 days)

---

## 📊 Current Database State (Verified via Supabase MCP)

### Existing `users_extended` Schema
```sql
✅ id (uuid, PK)
✅ tenant_id (uuid, NOT NULL)
✅ role (user_role enum: customer, technician, manager, etc.)
✅ display_name (text, nullable)
✅ first_name (text, nullable)
✅ last_name (text, nullable)
✅ phone (text, nullable)
✅ avatar_url (text, nullable) ⭐ ALREADY EXISTS!
✅ timezone (text, default: 'UTC')
✅ preferred_language (text, default: 'en-US')
✅ is_active (boolean, default: true)
✅ email_verified_at (timestamp)
✅ phone_verified_at (timestamp)
✅ last_login_at (timestamp)
✅ password_changed_at (timestamp)
✅ terms_accepted_at (timestamp)
✅ privacy_policy_accepted_at (timestamp)
✅ marketing_consent (boolean)
✅ two_factor_enabled (boolean)
✅ failed_login_attempts (integer)
✅ locked_until (timestamp)
✅ metadata (jsonb)
✅ created_at (timestamp)
✅ updated_at (timestamp)
```

### Current Sample Users
```
7 users in tenant '550e8400-e29b-41d4-a716-446655440000':
- 1 manager (super@tophand.tech)
- 6 technicians (crew members: David, Travis, Rose, Jackson, Jeremiah, "Crew Member")
- ALL users currently have avatar_url = null
```

### Existing Image Pattern (from items, properties, customers, jobs)
```
✅ primary_image_url (full resolution)
✅ medium_url (medium crop)
✅ thumbnail_url (small square crop)
✅ Storage bucket: 'equipment-images'
✅ Upload pattern: {entity}/{id}/{timestamp}-{size}.jpg
```

---

## 🎯 Requirements

### 1. User Management Navigation
- Add "Users" or "User Management" to supervisor side navigation
- Position after "Jobs" or "Job Status" in nav menu
- Icon: Users icon from lucide-react

### 2. User List Page (`/supervisor/users`)
- **Layout**: Grid of square tiles (similar to job tiles)
- **Each Tile Contains**:
  - Square thumbnail image (150x150px or 200x200px)
  - User display name or constructed name
  - User role badge (technician, manager, etc.)
  - Active/inactive status indicator
- **Default Image**: Placeholder avatar for users without images
- **Filtering**: Filter by role, active status
- **Sorting**: By name, role, last login

### 3. User Detail Page (`/supervisor/users/[userId]`)
- **Header Section**:
  - Large profile image (medium size, 400x400px)
  - User name
  - Role
  - Active/inactive toggle
- **Image Upload Section**:
  - Camera capture button (mobile)
  - File upload button (desktop)
  - Image preview before save
  - Square crop editor (like items/properties)
- **Details Form**:
  - Display name (editable)
  - First name (editable)
  - Last name (editable)
  - Phone number (editable)
  - Email (read-only, from auth.users)
  - Role selector (dropdown)
  - Timezone selector
  - Language selector
  - Active status toggle
- **Save/Cancel Buttons**

### 4. Image Processing
- Capture/upload image
- Generate 3 square crops:
  - Thumbnail: 150x150px
  - Medium: 400x400px
  - Full: 800x800px
- Store in Supabase Storage: `user-avatars/{userId}/{timestamp}-{size}.jpg`
- Update `users_extended` table with URLs

### 5. Integration Points
- **CrewAssignmentSection**: Add thumbnail images to crew selection checkboxes
- **Job Assignments Display**: Show thumbnails next to assigned crew names
- **Future**: Use thumbnails throughout app (crew hub, reports, etc.)

---

## 🗄️ Database Changes Required

### Option 1: Add Three Image Columns (RECOMMENDED)
**Matches existing pattern for items/properties/customers/jobs**

```sql
-- Migration: Add user image columns
ALTER TABLE users_extended
  ADD COLUMN IF NOT EXISTS primary_image_url TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS medium_url TEXT;

-- Keep avatar_url for backward compatibility (can point to primary_image_url)
-- Or deprecate avatar_url and migrate existing data
```

**Pros**:
- Consistent with existing entities (items, properties, etc.)
- Explicit columns for each size
- Better performance (no JSON parsing)
- Easier querying and indexing

**Cons**:
- More columns (but matches established pattern)

### Option 2: Keep Single `avatar_url` Column
**Use existing column, store only primary image**

```sql
-- No migration needed!
-- Just use existing avatar_url column
```

**Pros**:
- No schema changes
- Simpler initial implementation

**Cons**:
- Inconsistent with other entities
- May need multiple sizes later for performance
- Will require migration if we add thumbnail/medium later

### RECOMMENDATION: Option 1
Use the 3-column pattern to match existing entities. This provides:
- Consistent developer experience
- Optimized performance (serve thumbnails in lists)
- Future-proof design

---

## 📁 File Structure

```
src/
├── app/
│   ├── (authenticated)/
│   │   └── supervisor/
│   │       └── users/
│   │           ├── page.tsx                    # User list grid
│   │           └── [userId]/
│   │               └── page.tsx                # User detail page
│   ├── api/
│   │   └── supervisor/
│   │       └── users/
│   │           ├── route.ts                    # GET /api/supervisor/users (list)
│   │           └── [userId]/
│   │               ├── route.ts                # GET/PATCH /api/supervisor/users/[userId]
│   │               └── image/
│   │                   └── route.ts            # POST /api/supervisor/users/[userId]/image
├── components/
│   └── supervisor/
│       ├── UserTile.tsx                        # Reusable user tile component
│       ├── UserImageUpload.tsx                 # Image upload/crop component
│       └── CrewAssignmentSection.tsx           # UPDATE: Add thumbnail images
├── domains/
│   └── user-management/                        # NEW domain
│       ├── repositories/
│       │   └── user.repository.ts
│       ├── services/
│       │   └── user.service.ts
│       └── types/
│           └── index.ts
└── utils/
    └── image-processor.ts                      # EXISTING: Reuse for user images
```

---

## 🔧 Implementation Tasks

### Phase 1: Database Setup (Day 1, Morning)
**Task 1.1**: Create database migration
- [ ] Add `primary_image_url`, `thumbnail_url`, `medium_url` to `users_extended`
- [ ] Add indexes for image URL columns
- [ ] Test migration on development database

**Task 1.2**: Create Supabase Storage bucket
- [ ] Create `user-avatars` bucket (or use existing `equipment-images`)
- [ ] Set up bucket policies (public read, authenticated write)
- [ ] Test upload/download permissions

**Task 1.3**: Update TypeScript types
- [ ] Run `npm run generate:types` to update database types
- [ ] Verify new columns appear in `Database['public']['Tables']['users_extended']`

### Phase 2: Backend API Routes (Day 1, Afternoon)
**Task 2.1**: Create user list API
- [ ] File: `src/app/api/supervisor/users/route.ts`
- [ ] GET endpoint: List users with filters (role, active status)
- [ ] Include image URLs in response
- [ ] Add pagination support
- [ ] Use service client to bypass RLS (lesson learned!)

**Task 2.2**: Create user detail API
- [ ] File: `src/app/api/supervisor/users/[userId]/route.ts`
- [ ] GET endpoint: Fetch single user with all details
- [ ] PATCH endpoint: Update user fields
- [ ] Include email from `auth.users` (via service client)
- [ ] Validate role changes

**Task 2.3**: Create user image upload API
- [ ] File: `src/app/api/supervisor/users/[userId]/image/route.ts`
- [ ] POST endpoint: Upload and process user image
- [ ] Reuse `ItemImageProcessor` utility
- [ ] Generate 3 square crops (150px, 400px, 800px)
- [ ] Upload to `user-avatars/{userId}/{timestamp}-{size}.jpg`
- [ ] Update `users_extended` with new URLs
- [ ] Return image URLs in response

### Phase 3: Domain Layer (Day 2, Morning)
**Task 3.1**: Create User domain
- [ ] Repository: `src/domains/user-management/repositories/user.repository.ts`
- [ ] Service: `src/domains/user-management/services/user.service.ts`
- [ ] Types: `src/domains/user-management/types/index.ts`
- [ ] Follow job-assignment domain pattern
- [ ] Add business logic (role validation, active status rules)

**Task 3.2**: Create test suite
- [ ] Unit tests for user service
- [ ] Integration tests for user APIs
- [ ] Test image upload/processing
- [ ] Test RLS policies

### Phase 4: UI Components (Day 2, Afternoon - Day 3)
**Task 4.1**: Create UserTile component
- [ ] File: `src/components/supervisor/UserTile.tsx`
- [ ] Square tile design matching job tiles
- [ ] Show thumbnail image or placeholder
- [ ] Display name, role badge, status indicator
- [ ] Click to navigate to user detail
- [ ] Responsive design (grid layout)

**Task 4.2**: Create UserImageUpload component
- [ ] File: `src/components/supervisor/UserImageUpload.tsx`
- [ ] Reuse camera/file upload logic from items
- [ ] Square crop editor (react-easy-crop or similar)
- [ ] Preview before save
- [ ] Upload progress indicator
- [ ] Handle upload errors gracefully

**Task 4.3**: Create User List Page
- [ ] File: `src/app/(authenticated)/supervisor/users/page.tsx`
- [ ] Grid layout of UserTile components
- [ ] Role filter dropdown
- [ ] Active/inactive filter toggle
- [ ] Search by name
- [ ] Loading states
- [ ] Empty state (no users)

**Task 4.4**: Create User Detail Page
- [ ] File: `src/app/(authenticated)/supervisor/users/[userId]/page.tsx`
- [ ] Profile image display (medium size)
- [ ] UserImageUpload component integration
- [ ] Editable form fields
- [ ] Role selector
- [ ] Active status toggle
- [ ] Save/Cancel buttons
- [ ] Success/error notifications
- [ ] Loading states

### Phase 5: Navigation Integration (Day 3, Afternoon)
**Task 5.1**: Add Users to supervisor navigation
- [ ] Find/create supervisor layout/navigation component
- [ ] Add "Users" menu item
- [ ] Add Users icon (lucide-react)
- [ ] Position after "Jobs" or "Job Status"
- [ ] Test navigation flow

**Task 5.2**: Add breadcrumbs
- [ ] User list: "Home > Users"
- [ ] User detail: "Home > Users > {User Name}"

### Phase 6: Crew Assignment Integration (Day 4)
**Task 6.1**: Update CrewAssignmentSection
- [ ] File: `src/components/supervisor/CrewAssignmentSection.tsx`
- [ ] Add thumbnail images to checkbox list
- [ ] Show placeholder if no image
- [ ] Update User interface to include image URLs
- [ ] Style thumbnails (24x24px or 32x32px circular)

**Task 6.2**: Update job detail assignments display
- [ ] Show thumbnails next to assigned crew names
- [ ] Circular thumbnails (32x32px or 40x40px)
- [ ] Placeholder for users without images

**Task 6.3**: Update API responses
- [ ] Ensure `/api/users?role=technician` includes image URLs
- [ ] Ensure `/api/supervisor/jobs/[jobId]` includes user thumbnails in assignments

### Phase 7: Testing & Polish (Day 5)
**Task 7.1**: End-to-end testing
- [ ] Upload user images via camera
- [ ] Upload user images via file
- [ ] Edit user details
- [ ] Change user role
- [ ] Toggle active status
- [ ] Verify images appear in crew assignment
- [ ] Verify images appear in job assignments list
- [ ] Test on mobile devices
- [ ] Test on desktop browsers

**Task 7.2**: Performance optimization
- [ ] Add loading indicators
- [ ] Optimize image sizes
- [ ] Add image caching headers
- [ ] Test with 50+ users

**Task 7.3**: Error handling
- [ ] Handle upload failures gracefully
- [ ] Show validation errors
- [ ] Handle network errors
- [ ] Add retry mechanisms

**Task 7.4**: Documentation
- [ ] Update API documentation
- [ ] Add user management to feature docs
- [ ] Update lessons learned if issues arise

---

## 🎨 UI Design Specifications

### User List Grid
```
┌─────────────────────────────────────────────────────────────┐
│  Users                                    [+ Add User]        │
│                                                               │
│  [All Roles ▼]  [Active ✓]  [Search users...]               │
│                                                               │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │  [IMG]  │  │  [IMG]  │  │  [IMG]  │  │  [IMG]  │        │
│  │         │  │         │  │         │  │         │        │
│  │ David   │  │ Travis  │  │  Rose   │  │Jackson  │        │
│  │Heneke   │  │ Etzler  │  │  Egan   │  │ Etzler  │        │
│  │[Tech]   │  │[Tech]   │  │[Tech]   │  │[Tech]   │        │
│  │ ✓Active │  │ ✓Active │  │ ✓Active │  │ ✓Active │        │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### User Detail Page
```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Users                                             │
│                                                               │
│  ┌─────────────┐                                             │
│  │             │  David Heneke                              │
│  │  [IMG]      │  Technician                                │
│  │  400x400    │  ✓ Active                                  │
│  │             │                                             │
│  └─────────────┘                                             │
│  [📷 Camera] [📁 Upload]                                     │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Profile Information                                      ││
│  │                                                          ││
│  │ Display Name:  [David Heneke...................]        ││
│  │ First Name:    [David........................]         ││
│  │ Last Name:     [Heneke.......................]         ││
│  │ Email:         david@tophand.tech (read-only)          ││
│  │ Phone:         [+1 (555) 123-4567............]         ││
│  │ Role:          [Technician ▼]                           ││
│  │ Timezone:      [America/New_York ▼]                    ││
│  │ Language:      [English ▼]                              ││
│  │ Active:        [Toggle On/Off]                          ││
│  │                                                          ││
│  │ [Cancel]  [Save Changes]                                ││
│  └─────────────────────────────────────────────────────────┘│
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Crew Assignment with Images
```
┌─────────────────────────────────────────────────────────────┐
│  Assigned Crew                                [+ Assign]     │
│                                                               │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ ○ [IMG] David Heneke                              [×]   ││
│  │ ○ [IMG] Travis Etzler                             [×]   ││
│  │ ○ [IMG] Rose Egan                                 [×]   ││
│  └──────────────────────────────────────────────────────────┘│
│                                                               │
│  Available Crew (Select to assign):                          │
│  ☐ [IMG] Jackson Etzler                                     │
│  ☐ [IMG] Jeremiah Vasquez                                   │
│  ☐ [👤] Crew Member (no image)                              │
│                                                               │
│  [Cancel]  [Assign (2)]                                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚠️ Lessons Learned (Applied)

### From Job Assignment Implementation:

1. **Always use service role clients** for API routes
   ```typescript
   // ✅ CORRECT
   const {createClient: createServiceClient} = await import('@supabase/supabase-js');
   const supabase = createServiceClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL!,
     process.env.SUPABASE_SERVICE_ROLE_KEY!
   );
   ```

2. **Verify database schema via MCP first**
   - Don't assume column names
   - Check actual data structure
   - Document MCP queries in planning

3. **Comprehensive logging**
   ```typescript
   console.log('============================================');
   console.log('[ENDPOINT] Operation - Commit ID');
   console.log('[ENDPOINT] Input:', params);
   console.log('[ENDPOINT] Result:', { count, error });
   console.log('============================================');
   ```

4. **Email is in auth.users, not users_extended**
   - Use `supabase.auth.admin.getUserById()` for email
   - Join with auth tables when needed

---

## 🔐 Security Considerations

1. **RLS Policies**:
   - Users can view their own profile
   - Supervisors/managers can view all users in tenant
   - Only supervisors/managers can edit users
   - Only supervisors/managers can upload images

2. **Storage Bucket Policies**:
   - Public read access (for displaying images)
   - Authenticated write access (for uploading)
   - Scoped to tenant via path: `user-avatars/{tenantId}/{userId}/`

3. **Input Validation**:
   - Validate image file types (JPEG, PNG only)
   - Validate image size (max 10MB)
   - Sanitize user input fields
   - Validate role changes (can't promote to admin via UI)

4. **API Rate Limiting**:
   - Limit image uploads per user per hour
   - Prevent abuse of list endpoints

---

## 📊 Success Metrics

- [ ] All users can be assigned profile images
- [ ] Images display correctly in user list
- [ ] Images display correctly in crew assignment dropdowns
- [ ] Images display correctly in job assignment lists
- [ ] Image upload works via camera and file
- [ ] Page loads in < 2 seconds with 50 users
- [ ] Mobile responsive design works on iOS and Android
- [ ] No RLS permission errors (learned from job assignment!)

---

## 🚀 Future Enhancements (Not in Initial Scope)

1. **Bulk operations**: Bulk edit user roles, bulk activate/deactivate
2. **User import**: Import users from CSV
3. **User groups**: Create groups for easier assignment
4. **Skills/certifications**: Add skills and certifications to users
5. **Availability calendar**: Manage user availability
6. **Image gallery**: Multiple images per user (before/after work photos)

---

## 🎯 Ready to Start?

**Recommended Order**:
1. ✅ Database migration (add 3 image columns)
2. ✅ Update TypeScript types
3. ✅ Create API routes (list, detail, image upload)
4. ✅ Build UI components (tile, image upload, forms)
5. ✅ Create pages (list, detail)
6. ✅ Add navigation
7. ✅ Update crew assignment components
8. ✅ Test end-to-end
9. ✅ Deploy and monitor

**Estimated Timeline**: 3-5 days
**Priority**: High (needed for crew assignment UX improvement)
**Dependencies**: None (all prerequisites met)

---

**Document Owner**: Claude Code
**Last Updated**: 2025-10-17
**Status**: 📋 Planning Complete - Ready for Implementation
