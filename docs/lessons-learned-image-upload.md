# Lessons Learned: Image Upload Implementation

## Overview
This document captures key lessons learned while implementing the image upload feature for the Item Profile page. The feature involved capturing images via camera or file upload, processing them into multiple sizes, storing them in Supabase Storage, and displaying them in the UI.

## Key Issues Encountered and Solutions

### 1. Field Name Transformation (Snake Case vs Camel Case)
**Issue**: The most critical issue was a mismatch between database field names (snake_case) and JavaScript object properties (camelCase).

**What Happened**:
- Database columns use snake_case: `primary_image_url`, `thumbnail_url`, `medium_url`
- ItemRepository correctly transforms these to camelCase: `primaryImageUrl`, `thumbnailUrl`, `mediumUrl`
- BUT the UI components were still referencing snake_case properties

**Symptoms**:
- Console showed successful upload: `Upload successful, response: {imageUrls: {...}}`
- Console showed URLs were loaded: `Item image URLs: {primary: 'https://...', medium: '...', thumbnail: '...'}`
- But images wouldn't display on the page

**Solution**:
- Ensure consistency throughout the stack: database → repository → API → UI
- Always check field name transformations when data appears to be missing
- Use TypeScript interfaces to catch these mismatches at compile time

### 2. Multi-Tenant Security
**Issue**: Image upload API wasn't filtering by tenant_id when updating items.

**What Happened**:
- Initial implementation: `.eq('id', itemId)` only
- This could allow cross-tenant data updates in a multi-tenant environment

**Solution**:
```typescript
.eq('id', itemId)
.eq('tenant_id', tenantId)  // Always include tenant filter
```

**Lesson**: In multi-tenant systems, ALWAYS include tenant_id in:
- All database queries
- All update operations
- Storage bucket paths (consider: `equipment-images/{tenant_id}/items/...`)

### 3. Debugging Approach
**Issue**: Initial debugging was difficult without proper logging.

**What We Added**:
1. **Client-side logging**:
   ```javascript
   console.log('Starting image processing...');
   console.log('Image processing complete:', {
     thumbnailLength: processedImages.thumbnail.length,
     mediumLength: processedImages.medium.length,
     fullLength: processedImages.full.length
   });
   ```

2. **API logging**:
   ```javascript
   console.log('Image upload API called for item:', itemId, 'tenant:', tenantId);
   console.log('Updating database with:', imageUrls);
   ```

3. **Direct database testing**:
   - Created Python script to test database updates directly
   - Bypassed application layer to isolate issues

**Lesson**: When debugging data flow issues:
- Add logging at every transformation point
- Test each layer independently
- Use direct database queries to verify data persistence

### 4. Camera Stream Management
**Issue**: Camera preview wasn't showing after clicking "Take Photo".

**What Happened**:
- MediaStream was obtained successfully
- But video element wasn't ready when trying to attach stream

**Solution**:
```javascript
useEffect(() => {
  if (mode === 'camera' && videoRef.current && streamRef.current) {
    videoRef.current.srcObject = streamRef.current;
  }
}, [mode]);
```

**Lesson**: When working with media streams and React:
- Use refs to persist stream objects
- Use useEffect to handle timing issues
- Always clean up streams when component unmounts

### 5. Image Size Optimization
**Issue**: Large image files (1.5MB+) from camera capture.

**Initial Solution**: Three-tier image processing (too small for practical use)

**Updated Solution** (based on user feedback):
```javascript
- Thumbnail: 256x256px (~30-50KB) for lists - large enough to see item details
- Medium: 1024x1024px (~300-500KB) for cards and standard viewing
- Full: 2048x2048px (~1-2MB) for zooming, inspection, and archival
```

**Lesson**: Always process images client-side before upload to:
- Reduce bandwidth usage
- Improve upload speed
- Optimize storage costs
- Enhance page load performance

### 6. HEIC/HEIF Format Support
**Issue**: iOS devices often produce HEIC format images which browsers can't process.

**Solution**:
```javascript
if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
  alert('HEIC format not supported. Please convert to JPEG.');
  return;
}
```

**Lesson**: Always validate file types and provide clear user guidance for unsupported formats.

## Best Practices Established

### 1. Consistent Naming Conventions
- Database: snake_case (`primary_image_url`)
- API Responses: camelCase (`primaryImageUrl`)
- TypeScript: camelCase with proper interfaces
- Use repository pattern to handle transformations

### 2. Error Handling
- Provide user-friendly error messages
- Log detailed errors for debugging
- Handle edge cases (no camera, denied permissions, etc.)

### 3. Performance Optimization
- Process images client-side
- Use appropriate image sizes for different contexts
- Implement loading states for better UX

### 4. Testing Strategy
When implementing complex features:
1. Test storage layer independently
2. Test database updates directly
3. Test API endpoints with tools like curl/Postman
4. Add comprehensive logging before debugging
5. Use browser DevTools Network tab to inspect requests

## Common Pitfalls to Avoid

1. **Assuming field names match** across layers - always verify
2. **Missing tenant_id filters** in multi-tenant queries
3. **Not handling media stream timing** in React components
4. **Uploading full-size images** without optimization
5. **Incomplete error handling** for device permissions
6. **Not testing on actual devices** (camera behavior differs)

## Recommended Development Flow

1. **Design the data model** with clear field naming
2. **Implement repository pattern** with explicit field mapping
3. **Add logging at key points** before testing
4. **Test each layer independently** before integration
5. **Use TypeScript interfaces** to catch type mismatches
6. **Test on real devices** early in development

## Tools That Helped

- **Direct database queries** (Python/SQL) to verify data
- **Browser DevTools** Network tab for API inspection
- **Console logging** at transformation points
- **TypeScript** for catching type issues (when properly configured)
- **Git history** to track what changes fixed issues

### 7. User Profile Updates: Three-Layer Debugging Journey (October 2025)

**Issue**: Supervisor couldn't update user profiles or upload user photos - getting 404 and 400 errors consistently.

**What Made This Challenging**:
This was a THREE-LAYER problem that required fixing issues at the authentication, RLS, and validation levels. Each fix revealed the next hidden issue.

#### Layer 1: Missing Session Credentials (404 Errors - First Discovery)
**Problem**: `credentials: 'include'` missing from fetch requests
```typescript
// ❌ WRONG - No session cookies sent
fetch('/api/supervisor/users/[userId]', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});

// ✅ CORRECT - Session cookies included
fetch('/api/supervisor/users/[userId]', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',  // Critical!
  body: JSON.stringify(payload)
});
```

**Why This Failed**:
- Without `credentials: 'include'`, session cookies aren't sent to the API
- Backend `getRequestContext()` returns `tenantId: null`
- Repository query: `WHERE tenant_id = NULL AND id = userId` → no match → 404

**Red Herring**: We first thought the issue was missing `tenant_id` in JWT metadata, which led us down a path of updating `auth.users.raw_app_meta_data`. That was actually correct, but didn't solve the problem because credentials weren't being sent!

#### Layer 2: RLS Policies Blocking Updates (404 Errors - Second Discovery)
**Problem**: Even with credentials, RLS was still rejecting updates

**Root Cause**:
- API routes used `createClient()` which enforces RLS policies
- RLS policy: "Users can update their own profile" ✅
- **No policy for supervisors to update OTHER users** ❌
- Result: Every supervisor update was blocked by RLS

**Solution**: Switch to service role client to bypass RLS
```typescript
// ❌ WRONG - Uses user's JWT, hits RLS
const supabase = await createClient();

// ✅ CORRECT - Uses service role, bypasses RLS
const supabase = createServiceClient();
```

**Security Consideration**:
- API still enforces `context.isSupervisor` check
- Tenant filtering still applied in application code
- Service client bypasses RLS but NOT business logic

**Files Changed**:
- `src/app/api/supervisor/users/[userId]/route.ts` (GET & PATCH)
- `src/app/api/supervisor/users/[userId]/image/route.ts` (POST)

#### Layer 3: Zod Schema Validation (400 Errors - Final Discovery)
**Problem**: Even after fixing credentials and RLS, still getting 400 Bad Request

**Root Cause**: Schema didn't accept `null` values
```typescript
// ❌ WRONG - Only accepts string | undefined
const updateSchema = z.object({
  display_name: z.string().optional(),  // Rejects null!
  phone: z.string().optional()
});

// Frontend sends:
{ display_name: null, phone: null }  // ❌ Validation fails!

// ✅ CORRECT - Accepts string | null | undefined
const updateSchema = z.object({
  display_name: z.string().nullable().optional(),
  phone: z.string().nullable().optional()
});
```

**Why This Happened**:
- Frontend uses `formData.displayName || null` to convert empty strings to null
- This is correct API design (null = explicitly empty)
- But Zod's `.optional()` only means "can be undefined", not "can be null"
- Must use `.nullable().optional()` to accept both

#### Layer 4: Empty Image Payloads (Bonus Issue)
**Problem**: Camera dismissal sent empty strings causing 400 errors

**Solution**: Guard clause to ignore empty payloads
```typescript
const handleImageCapture = async (images: ProcessedImages) => {
  // Early return for empty payloads
  if (!images.thumbnail || !images.medium || !images.full) {
    setShowImageUpload(false);
    return;
  }

  // Only call API with real images
  await fetch('/api/supervisor/users/[userId]/image', {
    method: 'POST',
    credentials: 'include',
    body: JSON.stringify({ images })
  });
};
```

#### Diagnostic Logging That Saved Us
Added comprehensive logging to see each layer:
```typescript
console.log('[PATCH /api/supervisor/users/[userId]] Request received', {
  userId: params.userId,
  tenantId: context.tenantId,        // ← Revealed NULL tenant
  isSupervisor: context.isSupervisor,
  roles: context.roles,
  source: context.source
});

console.log('[PATCH /api/supervisor/users/[userId]] User lookup', {
  userId: params.userId,
  userFound: !!userCheck,
  userTenantId: userCheck?.tenant_id,
  contextTenantId: context.tenantId,
  tenantMatch: userCheck?.tenant_id === context.tenantId,  // ← Revealed mismatch
});

console.log('[PATCH /api/supervisor/users/[userId]] Validation failed', {
  error: parsed.error.flatten()  // ← Revealed null rejection
});
```

#### The Debugging Journey
1. **First Attempt**: Added diagnostic logging → revealed `tenantId: null`
2. **Second Attempt**: Added `credentials: 'include'` to image upload → still failed
3. **Third Attempt**: Updated JWT metadata in `auth.users` → still failed
4. **Fourth Attempt**: Added `credentials: 'include'` to PATCH → still failed (403/404)
5. **Fifth Attempt**: Switched to `createServiceClient()` → still failed (400)
6. **Sixth Attempt**: Updated schema to `.nullable()` → **SUCCESS!** ✅

#### Key Lessons Learned

**1. Multi-Layer Problems Require Multi-Layer Debugging**
- Don't stop at the first fix
- Each layer can hide the next issue
- Use diagnostic logging at EVERY layer

**2. Credentials Are Critical for Session-Based Auth**
```typescript
// ALWAYS include credentials when calling authenticated APIs
fetch('/api/...', {
  credentials: 'include'  // Required for session cookies
});
```

**3. RLS vs Service Client Trade-offs**
- **User Client (`createClient`)**: Enforces RLS, limited by user permissions
- **Service Client (`createServiceClient`)**: Bypasses RLS, requires application-level security
- Use service client for admin operations, but ALWAYS check permissions in code

**4. Zod Schema Design for Nullable Fields**
```typescript
// For optional fields that can be null:
field: z.string().nullable().optional()  // string | null | undefined

// For optional fields that should never be null:
field: z.string().optional()  // string | undefined
```

**5. Empty Payload Guard Clauses**
- Validate inputs before making API calls
- Distinguish between "cancelled" and "submitted empty data"
- Early returns prevent unnecessary API calls

**6. Diagnostic Logging Best Practices**
- Log at entry point (context, params)
- Log before validation (payload structure)
- Log before database operations (user lookup)
- Log at decision points (tenant match, RLS results)
- Log at exit (success or specific failure reason)

**7. The "Credentials Include" Pattern**
Apply this pattern to ALL authenticated API calls:
```typescript
// Standard fetch pattern for authenticated endpoints
const response = await fetch('/api/...', {
  method: 'POST',  // or GET, PATCH, DELETE
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',  // ← CRITICAL for session-based auth
  body: JSON.stringify(payload)
});
```

#### Common Multi-Tenant Gotchas

1. **Null Tenant Context** → Check credentials are being sent
2. **RLS Blocking Admin Operations** → Use service client with permission checks
3. **Schema Rejecting Null** → Use `.nullable()` for fields that can be null
4. **Empty vs Missing Values** → Guard against empty payloads
5. **JWT Not Refreshing** → User must logout/login after metadata changes

#### Prevention Checklist

Before implementing authenticated endpoints:
- [ ] Add `credentials: 'include'` to ALL fetch calls
- [ ] Use `createServiceClient()` for admin operations
- [ ] Add `context.isSupervisor` or similar permission checks
- [ ] Use `.nullable().optional()` for fields that accept null
- [ ] Add guard clauses for empty payloads
- [ ] Add comprehensive diagnostic logging
- [ ] Test with Railway logs before assuming success

#### Time Investment vs Value

**Total Iterations**: 6 attempts over multiple hours
**Root Causes**: 4 separate issues (credentials, RLS, validation, empty payloads)
**Value**: Deep understanding of:
- Next.js session management
- Supabase RLS patterns
- Zod schema validation
- Multi-tenant security models

**Moral**: Complex bugs teach more than simple bugs. The pain is the lesson.

## Conclusion

The main takeaway: when data seems to "disappear" between layers, it's often a naming/transformation issue. Always verify field names at each layer of the stack, and implement comprehensive logging before starting to debug complex data flow issues.

**Additional takeaway from user profile debugging**: Modern web apps have many layers (client → network → auth → RLS → validation → business logic → database). A bug at ANY layer can manifest as the same symptom. Systematic debugging requires checking each layer independently with comprehensive logging.