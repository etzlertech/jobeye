/**
 * @file src/domains/field-intelligence/__tests__/e2e/job-arrival-completion.e2e.ts
 * @phase 3
 * @domain field-intelligence
 * @purpose End-to-end test for complete job lifecycle from arrival to completion
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 250 LoC
 */

import { test, expect } from '@playwright/test';

/**
 * E2E Test Suite: Job Arrival and Completion
 *
 * Tests the complete job lifecycle:
 * 1. Auto arrival detection via geofence
 * 2. Manual arrival logging
 * 3. Safety checklist completion
 * 4. Voice task parsing
 * 5. Job completion with photo verification
 * 6. Supervisor approval
 */

test.describe('Job Arrival and Completion E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/');
    await page.fill('[name="email"]', 'test@jobeye.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // Mock geolocation
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({ latitude: 40.7128, longitude: -74.006 });
  });

  test('should detect job arrival via geofence', async ({ page }) => {
    // Navigate to active job
    await page.click('text=My Jobs');
    await page.click('[data-testid="job-card"]:first-child');

    // Verify arrival button is visible
    await expect(page.locator('[data-testid="arrival-button"]')).toBeVisible();
    await expect(page.locator('text=Log Arrival')).toBeVisible();

    // Wait for auto geofence check
    await expect(page.locator('text=Checking geofence...')).toBeVisible();

    // Simulate entering geofence
    await page.context().setGeolocation({ latitude: 40.7130, longitude: -74.0062 });

    // Wait for auto-arrival detection
    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/field-intelligence/routing/geofence/check') &&
        response.status() === 200,
      { timeout: 35000 } // 30s check interval + buffer
    );

    // Verify arrival confirmed
    await expect(page.locator('text=Arrived at Job Site')).toBeVisible();
    await expect(page.locator('text=📍 Auto-detected')).toBeVisible();

    // Verify arrival time
    await expect(page.locator('[data-testid="arrival-time"]')).toBeVisible();
  });

  test('should log manual arrival', async ({ page }) => {
    // Navigate to job
    await page.click('text=My Jobs');
    await page.click('[data-testid="job-card"]:first-child');

    // Click manual arrival
    await page.click('button:has-text("Log Arrival")');

    // Wait for geolocation and API call
    await page.waitForResponse((response) =>
      response.url().includes('/api/field-intelligence/workflows/arrivals') &&
      response.status() === 200
    );

    // Verify arrival logged
    await expect(page.locator('text=Arrived at Job Site')).toBeVisible();
    await expect(page.locator('text=👆 Manual')).toBeVisible();

    // Verify safety checklist initialized
    await expect(page.locator('[data-testid="checklist-widget"]')).toBeVisible();
  });

  test('should complete safety checklist after arrival', async ({ page }) => {
    // Navigate to arrived job
    await page.click('text=My Jobs');
    const arrivedJob = page.locator('[data-testid="job-card"][data-status="arrived"]').first();
    await arrivedJob.click();

    // Verify checklist is visible
    await expect(page.locator('[data-testid="checklist-widget"]')).toBeVisible();

    // Complete all checklist items
    const checkboxes = page.locator('[data-testid="checklist-item"] input[type="checkbox"]');
    const count = await checkboxes.count();

    for (let i = 0; i < count; i++) {
      const checkbox = checkboxes.nth(i);
      const item = checkbox.locator('xpath=ancestor::*[@data-testid="checklist-item"]');

      // Check for photo requirement
      const photoRequired = await item.locator('text=📷 Photo required').isVisible();

      await checkbox.check();

      if (photoRequired) {
        // Upload photo
        await page
          .locator('input[type="file"]')
          .setInputFiles({
            name: 'safety-check.jpg',
            mimeType: 'image/jpeg',
            buffer: Buffer.from('fake-photo'),
          });
        await page.waitForTimeout(500);
      }

      await page.waitForTimeout(200);
    }

    // Verify checklist complete
    await expect(page.locator('text=100% Complete')).toBeVisible();
    await expect(page.locator('text=✓ Checklist Complete!')).toBeVisible();
  });

  test('should parse voice transcript to tasks', async ({ page }) => {
    // Navigate to job in progress
    await page.click('text=My Jobs');
    await page.click('[data-testid="job-card"][data-status="in_progress"]:first-child');

    // Open voice task input
    await page.click('button:has-text("Add Tasks via Voice")');

    // Enter voice transcript
    await page.fill(
      '[name="transcript"]',
      'Mowed front and back lawn, trimmed hedges along driveway, edged walkways, cleaned up all debris'
    );

    // Submit for parsing
    await page.click('button:has-text("Parse Tasks")');

    // Wait for LLM processing
    await expect(page.locator('text=Parsing tasks...')).toBeVisible();

    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/field-intelligence/workflows/parse-tasks') &&
        response.status() === 200,
      { timeout: 10000 }
    );

    // Verify parsed tasks
    await expect(page.locator('[data-testid="task-list"]')).toBeVisible();

    const tasks = page.locator('[data-testid="task-item"]');
    expect(await tasks.count()).toBeGreaterThan(0);

    // Verify confidence scores
    await expect(page.locator('text=% confidence')).toBeVisible();

    // Mark tasks as completed
    await page.click('[data-testid="task-item"]:first-child [data-testid="status-select"]');
    await page.selectOption(
      '[data-testid="task-item"]:first-child [data-testid="status-select"]',
      'COMPLETED'
    );

    // Verify task status updated
    await expect(
      page.locator('[data-testid="task-item"]:first-child [data-status="COMPLETED"]')
    ).toBeVisible();
  });

  test('should complete job with photo verification', async ({ page }) => {
    // Navigate to job with all tasks done
    await page.click('text=My Jobs');
    await page.click('[data-testid="job-card"][data-tasks-complete="true"]:first-child');

    // Click complete job
    await page.click('button:has-text("Complete Job")');

    // Verify completion verifier
    await expect(page.locator('[data-testid="completion-verifier"]')).toBeVisible();
    await expect(page.locator('text=Job Completion Verification')).toBeVisible();

    // Upload completion photos
    const photoInput = page.locator('input[type="file"]');
    await photoInput.setInputFiles([
      {
        name: 'before.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('before-photo'),
      },
      {
        name: 'after.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('after-photo'),
      },
    ]);

    // Verify photo preview
    await expect(page.locator('img[alt="Photo 1"]')).toBeVisible();
    await expect(page.locator('img[alt="Photo 2"]')).toBeVisible();

    // Submit for verification
    await page.click('button:has-text("Verify Completion")');

    // Wait for AI verification
    await expect(page.locator('text=Verifying with AI...')).toBeVisible();

    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/field-intelligence/workflows/verify-completion') &&
        response.status() === 200,
      { timeout: 15000 }
    );

    // Verify completion result
    const resultCard = page.locator('[data-testid="verification-result"]');
    await expect(resultCard).toBeVisible();

    // Check if verified
    const isVerified = await page.locator('text=Job Verified').isVisible();

    if (isVerified) {
      // Verify success indicators
      await expect(page.locator('text=✓')).toBeVisible();
      await expect(page.locator('text=Quality Score')).toBeVisible();
    } else {
      // Verify failure indicators and issues
      await expect(page.locator('text=Verification Failed')).toBeVisible();
      await expect(page.locator('text=Issues Detected:')).toBeVisible();
      await expect(page.locator('text=Supervisor has been notified')).toBeVisible();
    }
  });

  test('should display completion workflow analytics', async ({ page }) => {
    // Navigate to workflow analytics
    await page.click('text=Analytics');
    await page.click('text=Workflows');
    await page.waitForURL('/analytics/workflows');

    // Verify arrival metrics
    await expect(page.locator('text=Arrival Detection')).toBeVisible();
    await expect(page.locator('[data-testid="auto-arrival-rate"]')).toBeVisible();

    // Verify task parsing metrics
    await expect(page.locator('text=Task Parsing')).toBeVisible();
    await expect(page.locator('[data-testid="avg-confidence"]')).toBeVisible();

    // Verify completion metrics
    await expect(page.locator('text=Completion Rate')).toBeVisible();
    await expect(page.locator('[data-testid="verification-pass-rate"]')).toBeVisible();

    // Verify bottleneck detection
    await expect(page.locator('text=Bottlenecks')).toBeVisible();

    // Check workflow funnel
    await expect(page.locator('[data-testid="workflow-funnel"]')).toBeVisible();
    const stages = page.locator('[data-testid="funnel-stage"]');
    expect(await stages.count()).toBeGreaterThan(0);
  });

  test('should handle job lifecycle from arrival to completion', async ({ page }) => {
    // Navigate to scheduled job
    await page.click('text=My Jobs');
    const scheduledJob = page.locator('[data-testid="job-card"][data-status="scheduled"]').first();
    await scheduledJob.click();

    // Step 1: Log arrival
    await page.click('button:has-text("Log Arrival")');
    await page.waitForResponse((response) =>
      response.url().includes('/workflows/arrivals')
    );
    await expect(page.locator('text=Arrived at Job Site')).toBeVisible();

    // Step 2: Complete safety checklist (quick version)
    const checkboxes = page.locator('[data-testid="checklist-item"] input[type="checkbox"]');
    const checkboxCount = await checkboxes.count();
    for (let i = 0; i < checkboxCount; i++) {
      await checkboxes.nth(i).check();
      await page.waitForTimeout(100);
    }
    await expect(page.locator('text=✓ Checklist Complete!')).toBeVisible();

    // Step 3: Add and complete tasks
    await page.click('button:has-text("Add Tasks via Voice")');
    await page.fill('[name="transcript"]', 'Completed lawn mowing and trimming');
    await page.click('button:has-text("Parse Tasks")');
    await page.waitForResponse((response) => response.url().includes('/parse-tasks'));

    const taskSelect = page.locator('[data-testid="task-item"]:first-child select');
    await taskSelect.selectOption('COMPLETED');

    // Step 4: Complete job with photos
    await page.click('button:has-text("Complete Job")');
    await page
      .locator('input[type="file"]')
      .setInputFiles({
        name: 'completion.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('completion-photo'),
      });
    await page.click('button:has-text("Verify Completion")');
    await page.waitForResponse((response) => response.url().includes('/verify-completion'));

    // Verify job completed
    await expect(page.locator('text=Job Verified')).toBeVisible();
    await expect(page.locator('[data-testid="job-status"]')).toHaveText('COMPLETED');
  });

  test('should send supervisor notifications for issues', async ({ page }) => {
    // Navigate to job
    await page.click('text=My Jobs');
    await page.click('[data-testid="job-card"]:first-child');

    // Complete job with low-quality photos
    await page.click('button:has-text("Complete Job")');
    await page
      .locator('input[type="file"]')
      .setInputFiles({
        name: 'poor-quality.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('low-quality-photo'),
      });

    await page.click('button:has-text("Verify Completion")');
    await page.waitForResponse((response) => response.url().includes('/verify-completion'));

    // Verify failure and notification
    await expect(page.locator('text=Verification Failed')).toBeVisible();
    await expect(page.locator('text=Supervisor has been notified')).toBeVisible();

    // Check notification list
    await page.click('text=Notifications');
    await expect(page.locator('text=Completion verification failed')).toBeVisible();
  });
});