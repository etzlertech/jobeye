# Task: File Upload UI Component

**Slug:** `ocr-013-file-upload-ui`
**Priority:** High
**Size:** 1 PR

## Description
Create file upload component with drag-drop, multi-file support, and PDF page preview.

## Files to Create
- `src/components/ocr/upload/file-upload-zone.tsx`
- `src/components/ocr/upload/pdf-preview.tsx`
- `src/hooks/use-file-upload.ts`

## Files to Modify
- `src/app/ocr/upload/page.tsx` - Add route

## Acceptance Criteria
- [ ] Drag and drop zone with visual feedback
- [ ] Click to browse file selector
- [ ] Accepts JPG, PNG, PDF (max 10MB)
- [ ] Shows file preview thumbnails
- [ ] PDF shows page selector
- [ ] Progress bars during upload
- [ ] Supports multiple files
- [ ] Commit and push after implementation

## Test Files
**Create:** `src/__tests__/components/ocr/upload/file-upload-zone.test.tsx`

Test cases:
- `accepts valid file types`
  - Drop JPG file
  - Assert accepted
  - Drop TXT file
  - Assert rejected
  
- `enforces size limit`
  - Drop 15MB file
  - Assert error shown
  - Assert file rejected
  
- `shows upload progress`
  - Upload file
  - Assert progress bar visible
  - Assert percentage updates
  
- `handles multiple files`
  - Select 5 files
  - Assert all shown
  - Assert batch upload

**Create:** `src/__tests__/components/ocr/upload/pdf-preview.test.tsx`

Test cases:
- `renders PDF pages`
- `allows page selection`
- `extracts selected pages`

## Dependencies
- PDF.js for PDF rendering
- File API

## UI Layout
```
+--------------------------------+
| [Back] Upload Documents        |
+--------------------------------+
|                                |
| +----------------------------+ |
| |                            | |
| |   📄 Drop files here       | |
| |      or click to browse    | |
| |                            | |
| | JPG, PNG, PDF (max 10MB)   | |
| +----------------------------+ |
|                                |
| Files:                         |
| ☑ receipt1.jpg [====] 100%    |
| ☑ invoice.pdf  [===] 75%      |
| ☐ receipt2.png [...] 25%      |
|                                |
| [Cancel] [Process All]         |
+--------------------------------+
```

## Upload Hook
```typescript
interface UseFileUpload {
  files: UploadFile[];
  addFiles: (files: File[]) => void;
  removeFile: (id: string) => void;
  upload: () => Promise<void>;
  progress: Record<string, number>;
  errors: Record<string, string>;
}

interface UploadFile {
  id: string;
  file: File;
  preview?: string;
  status: 'pending' | 'uploading' | 'complete' | 'error';
}
```

## Rollback
- Basic file input only
- Single file at a time