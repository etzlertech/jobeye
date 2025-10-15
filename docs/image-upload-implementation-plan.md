# 📋 Complete Implementation Plan: Image Uploads for Customers, Properties & Jobs

## 🎯 Overview
Add image upload functionality (with 3-size processing: thumbnail/medium/full) to Customers, Properties, and Jobs - matching the pattern already implemented for Inventory Items.

---

## 🗄️ **PHASE 1: Database Schema Changes**

### Required Migrations
All three tables need the same three columns added:

```sql
-- Migration: Add image URL columns to customers, properties, jobs

-- 1. Add to customers table
ALTER TABLE customers
ADD COLUMN thumbnail_url TEXT,
ADD COLUMN medium_url TEXT,
ADD COLUMN primary_image_url TEXT;

-- 2. Add to properties table
ALTER TABLE properties
ADD COLUMN thumbnail_url TEXT,
ADD COLUMN medium_url TEXT,
ADD COLUMN primary_image_url TEXT;

-- 3. Add to jobs table
ALTER TABLE jobs
ADD COLUMN thumbnail_url TEXT,
ADD COLUMN medium_url TEXT,
ADD COLUMN primary_image_url TEXT;
```

**Note**: Each table already has some image-related columns:
- **customers**: None (cleanest case)
- **properties**: Has `photos` array and `reference_image_id` (can coexist)
- **jobs**: Has `photos_before`, `photos_after`, `completion_photo_url(s)`, `arrival_photo_id` (can coexist)

**Strategy**: Add the new standardized columns alongside existing ones. The new columns will serve as the "primary/hero" image for list views and detail headers, while existing columns can continue to store additional photos.

---

## 💻 **PHASE 2: Backend API Endpoints**

### Pattern to Follow (from Items):
- `POST /api/supervisor/items/[itemId]/image` - Upload endpoint
- Uses `ItemImageProcessor` to create 3 sizes
- Uploads to Supabase Storage bucket `equipment-images`
- Saves URLs to database

### New Endpoints Needed:

#### 2.1 Customer Image Upload
```
POST /api/supervisor/customers/[customerId]/image
```
- Storage bucket: `customer-images` (or reuse `equipment-images`)
- Path pattern: `customers/{customerId}/{timestamp}-{size}.jpg`

#### 2.2 Property Image Upload
```
POST /api/supervisor/properties/[propertyId]/image
```
- Storage bucket: `property-images` (or reuse `equipment-images`)
- Path pattern: `properties/{propertyId}/{timestamp}-{size}.jpg`

#### 2.3 Job Image Upload
```
POST /api/supervisor/jobs/[jobId]/image
```
- Storage bucket: `job-images` (or reuse `equipment-images`)
- Path pattern: `jobs/{jobId}/{timestamp}-{size}.jpg`

### Existing Files to Reference:
- `/src/app/api/supervisor/items/[itemId]/image/route.ts` - Copy this pattern
- `/src/utils/image-processor.ts` - Already handles 3-size processing

---

## 🎨 **PHASE 3: Frontend Components**

### 3.1 Customers
**Current State**:
- List view: `/src/app/supervisor/customers/page.tsx`
- No detail/edit page exists yet

**Work Needed**:
1. Create `/src/app/supervisor/customers/[customerId]/page.tsx` - Detail/edit page with ItemImageUpload component
2. Update list cards in `customers/page.tsx` to show thumbnail on left side
3. Update GET API to include image URL fields in SELECT

**Files to Create/Modify**:
- ✅ Modify: `/src/app/supervisor/customers/page.tsx` - Add thumbnail to cards + clickable navigation
- ⭐ Create: `/src/app/supervisor/customers/[customerId]/page.tsx` - Detail page with image upload
- ⭐ Create: `/src/app/api/supervisor/customers/[customerId]/image/route.ts` - Upload endpoint
- ✅ Modify: `/src/app/api/supervisor/customers/route.ts` - Add image fields to SELECT

### 3.2 Properties
**Current State**:
- List view: `/src/app/supervisor/properties/page.tsx`
- No detail/edit page exists yet

**Work Needed**:
1. Create `/src/app/supervisor/properties/[propertyId]/page.tsx` - Detail/edit page with ItemImageUpload
2. Update list cards in `properties/page.tsx` to show thumbnail on left side
3. Update GET API to include image URL fields in SELECT

**Files to Create/Modify**:
- ✅ Modify: `/src/app/supervisor/properties/page.tsx` - Add thumbnail to cards + clickable navigation
- ⭐ Create: `/src/app/supervisor/properties/[propertyId]/page.tsx` - Detail page with image upload
- ⭐ Create: `/src/app/api/supervisor/properties/[propertyId]/image/route.ts` - Upload endpoint
- ✅ Modify: `/src/app/api/supervisor/properties/route.ts` - Add image fields to SELECT (if exists)

### 3.3 Jobs
**Current State**:
- List view: `/src/app/(authenticated)/supervisor/jobs/page.tsx`
- Detail view: `/src/app/(authenticated)/supervisor/jobs/[jobId]/page.tsx` (already exists!)

**Work Needed**:
1. Update existing detail page to add ItemImageUpload component
2. Update list cards in `jobs/page.tsx` to show thumbnail on left side
3. Update GET APIs to include image URL fields in SELECT

**Files to Create/Modify**:
- ✅ Modify: `/src/app/(authenticated)/supervisor/jobs/page.tsx` - Add thumbnail to job cards
- ✅ Modify: `/src/app/(authenticated)/supervisor/jobs/[jobId]/page.tsx` - Add image upload section
- ⭐ Create: `/src/app/api/supervisor/jobs/[jobId]/image/route.ts` - Upload endpoint
- ✅ Modify: `/src/app/api/supervisor/jobs/route.ts` - Add image fields to SELECT

---

## 🔄 **Reusable Components** (Already Built)

These components can be reused across all entities:
- ✅ `/src/components/items/ItemImageUpload.tsx` - Camera/upload component
- ✅ `/src/utils/image-processor.ts` - 3-size image processing

**Usage Pattern**:
```tsx
import { ItemImageUpload } from '@/components/items/ItemImageUpload';

<ItemImageUpload
  onImageCapture={handleImageCapture}
  currentImageUrl={entity.mediumUrl}
  disabled={isUploading}
/>
```

---

## 📝 **Implementation Order** (Recommended)

### Step 1: Database Migration
Run SQL to add columns to all 3 tables (5 min)

### Step 2: Customers (Simplest - no existing detail page)
1. Create customer detail page with image upload (30 min)
2. Create image upload API endpoint (15 min)
3. Update customers list API to return image fields (5 min)
4. Add thumbnails to customer list cards (10 min)
**Total: ~60 min**

### Step 3: Properties (Similar to customers)
1. Create property detail page with image upload (30 min)
2. Create image upload API endpoint (15 min)
3. Update properties list API to return image fields (5 min)
4. Add thumbnails to property list cards (10 min)
**Total: ~60 min**

### Step 4: Jobs (Detail page already exists)
1. Add image upload to existing job detail page (20 min)
2. Create image upload API endpoint (15 min)
3. Update jobs list API to return image fields (5 min)
4. Add thumbnails to job list cards (10 min)
**Total: ~50 min**

---

## 🎨 **UI Consistency Guidelines**

All thumbnails in list cards should:
- Be positioned on the **left side** of the card
- Use size: **3rem x 3rem** (48px x 48px)
- Have rounded corners: `border-radius: 0.5rem`
- Show fallback icon when no image (Customer icon, Home icon, Briefcase icon)
- Be clickable to navigate to detail page

All detail pages should:
- Show larger image at top (300px height container)
- Use `ItemImageUpload` component
- Support both camera capture and file upload
- Auto-refresh after successful upload
- Display success/error notifications

---

## ✅ **Summary**

### Database Changes: **YES** ✅
- Add 3 columns to each of 3 tables (9 columns total)
- Non-breaking: Existing image columns remain untouched

### Code Changes: **YES** ✅
- 3 new detail pages (customers, properties; jobs exists)
- 3 new API upload endpoints
- 3 API list updates (add image fields to SELECT)
- 3 list page updates (add thumbnails to cards)
- **Total: ~12-15 files to create/modify**

### Complexity: **Medium** 🟡
- Pattern already proven with inventory items
- Mostly copy-paste with entity-specific adjustments
- Biggest work: Creating detail pages for customers & properties

### Estimated Time: **2-3 hours** ⏱️
- Database: 5 min
- Customers: 60 min
- Properties: 60 min
- Jobs: 50 min
- Testing: 15 min

---

## 🚀 **Next Steps**

1. Review and approve this plan
2. Run database migration first (Phase 1)
3. Implement one entity at a time to validate pattern:
   - Start with Customers (cleanest, no existing detail page)
   - Then Properties (similar to customers)
   - Finally Jobs (detail page already exists, just add image upload)
4. Test each entity before moving to next
5. Deploy and verify in production

---

**Created**: 2025-10-15
**Status**: Planning Complete - Ready for Implementation
