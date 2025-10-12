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

**Solution**: Three-tier image processing:
```javascript
- Thumbnail: 32x32px (~1-5KB) for lists
- Medium: 256x256px (~10-50KB) for cards  
- Full: 1024x1024px (~100-500KB) for detail views
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

## Conclusion

The main takeaway: when data seems to "disappear" between layers, it's often a naming/transformation issue. Always verify field names at each layer of the stack, and implement comprehensive logging before starting to debug complex data flow issues.