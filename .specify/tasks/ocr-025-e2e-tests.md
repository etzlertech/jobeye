# Task: OCR End-to-End Test Suite

**Slug:** `ocr-025-e2e-tests`
**Priority:** Medium
**Size:** 1 PR

## Description
Create Playwright E2E tests for OCR user flows including mobile PWA scenarios.

## Files to Create
- `src/__tests__/e2e/ocr-capture-flow.spec.ts`
- `src/__tests__/e2e/ocr-upload-flow.spec.ts`
- `src/__tests__/e2e/ocr-offline-flow.spec.ts`

## Files to Modify
- `playwright.config.ts` - Add OCR test project

## Acceptance Criteria
- [ ] Tests camera capture flow
- [ ] Tests file upload flow
- [ ] Tests offline capture and sync
- [ ] Tests mobile PWA features
- [ ] Tests budget enforcement
- [ ] Includes visual regression
- [ ] Tests error recovery
- [ ] Commit and push after implementation

## Test Files
**Create:** `src/__tests__/e2e/ocr-capture-flow.spec.ts`

Test cases:
- `captures receipt via camera`
  ```typescript
  test('captures and processes receipt', async ({ page }) => {
    // Navigate to OCR
    await page.goto('/ocr/capture');
    
    // Allow camera permission
    await page.click('[data-testid="allow-camera"]');
    
    // Wait for stable capture
    await page.waitForTimeout(2000);
    
    // Verify auto-capture
    await expect(page.locator('[data-testid="capture-preview"]')).toBeVisible();
    
    // Confirm extraction
    await page.click('[data-testid="confirm-ocr"]');
    
    // Verify saved
    await expect(page).toHaveURL(/\/ocr\/documents/);
  });
  ```

- `handles multiple captures`
- `shows OCR confidence indicators`

**Create:** `src/__tests__/e2e/ocr-upload-flow.spec.ts`

Test cases:
- `uploads PDF invoice`
- `processes multiple files`
- `handles large files`

**Create:** `src/__tests__/e2e/ocr-offline-flow.spec.ts`

Test cases:
- `captures while offline`
- `syncs when reconnected`
- `shows sync progress`

## Dependencies
- Playwright
- Test fixtures

## Mobile Test Configuration
```typescript
// Test on mobile viewport
const mobileProject = {
  name: 'Mobile OCR',
  use: {
    ...devices['Pixel 5'],
    permissions: ['camera'],
    offline: false // Toggle for offline tests
  }
};

// Mock camera stream
await page.route('**/getUserMedia', route => {
  route.fulfill({
    body: mockCameraStream
  });
});
```

## Visual Regression
```typescript
// Capture screenshots for comparison
await expect(page).toHaveScreenshot('ocr-capture-screen.png');
await expect(page.locator('.confidence-indicator')).toHaveScreenshot('confidence-colors.png');
```

## Rollback
- E2E tests don't affect app
- Can skip if flaky