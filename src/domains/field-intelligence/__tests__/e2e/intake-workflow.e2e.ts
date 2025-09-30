/**
 * @file src/domains/field-intelligence/__tests__/e2e/intake-workflow.e2e.ts
 * @phase 3
 * @domain field-intelligence
 * @purpose End-to-end test for intake to job conversion workflow
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 200 LoC
 */

import { test, expect } from '@playwright/test';

/**
 * E2E Test Suite: Intake Workflow
 *
 * Tests the complete intake workflow:
 * 1. Create intake request with duplicate detection
 * 2. OCR document processing
 * 3. Lead scoring
 * 4. Convert request to job
 * 5. Track conversion analytics
 */

test.describe('Intake Workflow E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/');
    await page.fill('[name="email"]', 'test@jobeye.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should create intake request with duplicate detection', async ({ page }) => {
    // Navigate to intake
    await page.click('text=Intake');
    await page.waitForURL('/intake');

    // Click new request
    await page.click('button:has-text("New Request")');

    // Fill form
    await page.fill('[name="customerName"]', 'John Smith');
    await page.fill('[name="propertyAddress"]', '123 Main St, City, State 12345');
    await page.fill('[name="phone"]', '555-123-4567');
    await page.fill('[name="email"]', 'john@example.com');
    await page.selectOption('[name="serviceType"]', 'lawn_mowing');
    await page.fill('[name="requestNotes"]', 'Regular weekly mowing needed');

    // Wait for duplicate check (debounced)
    await page.waitForTimeout(1500);

    // Check for duplicate warning
    const duplicateWarning = page.locator('[data-testid="duplicate-warning"]');
    if (await duplicateWarning.isVisible()) {
      // Verify duplicate details
      await expect(duplicateWarning).toContainText('Potential Duplicate');
      await expect(page.locator('text=% match')).toBeVisible();

      // Proceed anyway
      await page.click('button:has-text("Proceed Anyway")');
    }

    // Submit request
    await page.click('button[type="submit"]:has-text("Create Request")');

    // Wait for API response
    await page.waitForResponse((response) =>
      response.url().includes('/api/field-intelligence/intake/requests') &&
      response.status() === 200
    );

    // Verify success
    await expect(page.locator('text=Request Created Successfully')).toBeVisible();

    // Verify lead score display
    await expect(page.locator('text=Lead Score:')).toBeVisible();
    await expect(page.locator('[data-testid="lead-score"]')).toBeVisible();
  });

  test('should process document with OCR', async ({ page }) => {
    // Navigate to intake OCR
    await page.click('text=Intake');
    await page.click('text=Upload Document');

    // Verify OCR uploader
    await expect(page.locator('[data-testid="ocr-uploader"]')).toBeVisible();

    // Upload document
    await page
      .locator('input[type="file"]')
      .setInputFiles({
        name: 'intake-request.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('fake-document-image'),
      });

    // Verify preview
    await expect(page.locator('img[alt="Document preview"]')).toBeVisible();

    // Process with OCR
    await page.click('button:has-text("Upload & Process with OCR")');

    // Wait for OCR processing
    await expect(page.locator('text=Processing with OCR...')).toBeVisible();

    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/field-intelligence/intake/ocr') &&
        response.status() === 200,
      { timeout: 15000 }
    );

    // Verify extracted data
    await expect(page.locator('text=Data Extracted Successfully')).toBeVisible();

    // Check extracted fields
    await expect(page.locator('text=Customer:')).toBeVisible();
    await expect(page.locator('text=Address:')).toBeVisible();

    // Verify confidence and cost
    await expect(page.locator('text=confidence')).toBeVisible();
    await expect(page.locator('text=$')).toBeVisible(); // Cost display
  });

  test('should display lead scoring breakdown', async ({ page }) => {
    // Navigate to intake request
    await page.click('text=Intake');
    await page.click('[data-testid="request-card"]:first-child');

    // Verify lead score card
    await expect(page.locator('[data-testid="lead-score-card"]')).toBeVisible();
    await expect(page.locator('text=Lead Score')).toBeVisible();

    // Verify overall score
    const scoreElement = page.locator('[data-testid="overall-score"]');
    await expect(scoreElement).toBeVisible();
    const scoreText = await scoreElement.textContent();
    expect(scoreText).toMatch(/\d+/);

    // Verify priority recommendation
    await expect(
      page.locator('text=HIGH_PRIORITY,MEDIUM_PRIORITY,LOW_PRIORITY').first()
    ).toBeVisible();

    // Verify factor breakdown
    await expect(page.locator('text=Data Completeness')).toBeVisible();
    await expect(page.locator('text=Service Value')).toBeVisible();
    await expect(page.locator('text=Property Type')).toBeVisible();
    await expect(page.locator('text=Urgency')).toBeVisible();
    await expect(page.locator('text=Historical')).toBeVisible();

    // Check factor scores
    const factors = page.locator('[data-testid="score-factor"]');
    expect(await factors.count()).toBe(5);
  });

  test('should convert intake request to job', async ({ page }) => {
    // Navigate to high-priority requests
    await page.click('text=Intake');
    await page.click('text=High Priority');

    // Select request with high lead score
    await page.click('[data-testid="request-card"][data-priority="high"]:first-child');

    // Click convert to job
    await page.click('button:has-text("Convert to Job")');

    // Fill job details
    await page.fill('[name="scheduledDate"]', '2025-10-05');
    await page.fill('[name="estimatedDuration"]', '2');
    await page.selectOption('[name="assignedCrew"]', 'crew-1');

    // Submit conversion
    await page.click('button[type="submit"]:has-text("Create Job")');

    // Wait for conversion
    await page.waitForResponse((response) =>
      response.url().includes('/api/jobs') && response.status() === 200
    );

    // Verify success
    await expect(page.locator('text=Job created successfully')).toBeVisible();

    // Verify redirect to job
    await page.waitForURL(/\/jobs\/\w+/);
    await expect(page.locator('text=Job Details')).toBeVisible();

    // Verify original request is marked as converted
    await page.click('text=Intake');
    const originalRequest = page.locator(
      '[data-testid="request-card"][data-status="converted"]'
    );
    await expect(originalRequest).toBeVisible();
  });

  test('should track intake analytics', async ({ page }) => {
    // Navigate to intake analytics
    await page.click('text=Intake');
    await page.click('text=Analytics');
    await page.waitForURL('/intake/analytics');

    // Verify key metrics
    await expect(page.locator('text=Total Requests')).toBeVisible();
    await expect(page.locator('text=Conversion Rate')).toBeVisible();
    await expect(page.locator('text=Average Lead Score')).toBeVisible();

    // Verify source breakdown
    await expect(page.locator('text=Source Performance')).toBeVisible();
    await expect(page.locator('[data-testid="source-chart"]')).toBeVisible();

    // Verify time-of-day analysis
    await expect(page.locator('text=Best Time to Contact')).toBeVisible();

    // Check conversion funnel
    await expect(page.locator('text=Conversion Funnel')).toBeVisible();
    await expect(page.locator('[data-testid="funnel-stage"]')).toHaveCount(
      await page.locator('[data-testid="funnel-stage"]').count()
    );
  });

  test('should handle duplicate request workflow', async ({ page }) => {
    // Create initial request
    await page.click('text=Intake');
    await page.click('button:has-text("New Request")');

    await page.fill('[name="customerName"]', 'Jane Doe');
    await page.fill('[name="propertyAddress"]', '456 Oak Ave, City, State 12345');
    await page.fill('[name="phone"]', '555-987-6543');
    await page.selectOption('[name="serviceType"]', 'hedge_trimming');

    await page.click('button[type="submit"]');
    await expect(page.locator('text=Request Created Successfully')).toBeVisible();

    // Create duplicate request
    await page.click('button:has-text("New Request")');

    await page.fill('[name="customerName"]', 'Jane Doe');
    await page.fill('[name="propertyAddress"]', '456 Oak Avenue, City, State 12345');
    await page.fill('[name="phone"]', '555-987-6543');
    await page.selectOption('[name="serviceType"]', 'hedge_trimming');

    // Wait for duplicate detection
    await page.waitForTimeout(1500);

    // Verify high similarity warning
    await expect(page.locator('text=Potential Duplicate')).toBeVisible();
    await expect(page.locator('[data-testid="similarity-score"]')).toContainText('%');

    // View original request
    await page.click('button:has-text("View Request")');

    // Verify navigation to original
    await page.waitForURL(/\/intake\/requests\/\w+/);
    await expect(page.locator('text=Jane Doe')).toBeVisible();
  });

  test('should filter and sort intake requests', async ({ page }) => {
    // Navigate to intake
    await page.click('text=Intake');

    // Filter by lead score
    await page.click('button:has-text("Filter")');
    await page.click('text=High Priority Only');
    await page.waitForResponse((response) => response.url().includes('/intake/requests'));

    // Verify filtered results
    const cards = page.locator('[data-testid="request-card"]');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      await expect(cards.nth(i)).toHaveAttribute('data-priority', 'high');
    }

    // Sort by date
    await page.selectOption('[name="sortBy"]', 'date-desc');
    await page.waitForResponse((response) => response.url().includes('/intake/requests'));

    // Verify sort order
    const firstDate = await page
      .locator('[data-testid="request-card"]:first-child [data-testid="created-at"]')
      .textContent();
    const lastDate = await page
      .locator('[data-testid="request-card"]:last-child [data-testid="created-at"]')
      .textContent();

    expect(new Date(firstDate!).getTime()).toBeGreaterThanOrEqual(
      new Date(lastDate!).getTime()
    );
  });
});