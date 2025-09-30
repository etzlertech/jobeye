/**
 * @file src/domains/field-intelligence/__tests__/e2e/routing-optimization.e2e.ts
 * @phase 3
 * @domain field-intelligence
 * @purpose End-to-end test for routing optimization workflow
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 200 LoC
 */

import { test, expect } from '@playwright/test';

/**
 * E2E Test Suite: Routing Optimization
 *
 * Tests the complete routing optimization workflow:
 * 1. Create multiple jobs for routing
 * 2. Trigger route optimization
 * 3. Verify optimized route display
 * 4. Check distance and duration calculations
 * 5. Verify route progress tracking
 */

test.describe('Routing Optimization E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app and login
    await page.goto('/');
    await page.fill('[name="email"]', 'test@jobeye.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('should create jobs and optimize route', async ({ page }) => {
    // Navigate to scheduling page
    await page.click('text=Scheduling');
    await page.waitForURL('/scheduling');

    // Create first job
    await page.click('text=New Job');
    await page.fill('[name="customerName"]', 'Customer A');
    await page.fill('[name="propertyAddress"]', '123 Main St, City, State 12345');
    await page.fill('[name="latitude"]', '40.7128');
    await page.fill('[name="longitude"]', '-74.0060');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Job created')).toBeVisible();

    // Create second job
    await page.click('text=New Job');
    await page.fill('[name="customerName"]', 'Customer B');
    await page.fill('[name="propertyAddress"]', '456 Oak Ave, City, State 12345');
    await page.fill('[name="latitude"]', '40.7580');
    await page.fill('[name="longitude"]', '-73.9855');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Job created')).toBeVisible();

    // Create third job
    await page.click('text=New Job');
    await page.fill('[name="customerName"]', 'Customer C');
    await page.fill('[name="propertyAddress"]', '789 Pine Rd, City, State 12345');
    await page.fill('[name="latitude"]', '40.7489');
    await page.fill('[name="longitude"]', '-73.9680');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Job created')).toBeVisible();

    // Navigate to route optimization
    await page.click('text=Optimize Route');
    await page.waitForSelector('[data-testid="route-optimization"]');

    // Select jobs for optimization
    await page.check('[data-testid="job-checkbox-1"]');
    await page.check('[data-testid="job-checkbox-2"]');
    await page.check('[data-testid="job-checkbox-3"]');

    // Trigger optimization
    await page.click('button:has-text("Optimize Route")');

    // Wait for optimization to complete
    await expect(page.locator('text=Route optimized')).toBeVisible({ timeout: 10000 });

    // Verify route display
    await expect(page.locator('[data-testid="optimized-route-map"]')).toBeVisible();
    await expect(page.locator('text=3 stops')).toBeVisible();

    // Verify distance and duration
    const distanceText = await page.locator('[data-testid="total-distance"]').textContent();
    expect(distanceText).toMatch(/\d+\.\d+ mi/);

    const durationText = await page.locator('[data-testid="total-duration"]').textContent();
    expect(durationText).toMatch(/\d+h \d+m|\d+m/);

    // Verify job sequence
    await expect(page.locator('[data-testid="job-sequence-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="job-sequence-2"]')).toBeVisible();
    await expect(page.locator('[data-testid="job-sequence-3"]')).toBeVisible();
  });

  test('should display route progress during execution', async ({ page }) => {
    // Navigate to active routes
    await page.click('text=Active Routes');
    await page.waitForURL('/routes/active');

    // Select a route with jobs
    await page.click('[data-testid="route-card"]:first-child');

    // Verify route progress display
    await expect(page.locator('[data-testid="route-progress"]')).toBeVisible();
    await expect(page.locator('text=Route Progress')).toBeVisible();

    // Check progress bar
    const progressBar = page.locator('[data-testid="progress-bar"]');
    await expect(progressBar).toBeVisible();

    // Verify current job display
    await expect(page.locator('[data-testid="current-job"]')).toBeVisible();

    // Verify next job display
    await expect(page.locator('[data-testid="next-job"]')).toBeVisible();

    // Check ETA display
    await expect(page.locator('text=ETA:')).toBeVisible();

    // Verify job list
    const jobList = page.locator('[data-testid="job-list"]');
    await expect(jobList).toBeVisible();

    // Count jobs in list
    const jobCount = await page.locator('[data-testid="job-list-item"]').count();
    expect(jobCount).toBeGreaterThan(0);
  });

  test('should handle route optimization with Mapbox API', async ({ page }) => {
    // Navigate to route optimization
    await page.click('text=Optimize Route');

    // Select jobs
    await page.check('[data-testid="job-checkbox"]:nth-child(1)');
    await page.check('[data-testid="job-checkbox"]:nth-child(2)');

    // Set start location
    await page.fill('[name="startLocation"]', '40.7128,-74.0060');

    // Trigger optimization with Mapbox
    await page.click('button:has-text("Optimize with Mapbox")');

    // Wait for API response
    await page.waitForResponse((response) =>
      response.url().includes('/api/field-intelligence/routing/optimize') &&
      response.status() === 200
    );

    // Verify optimization result
    await expect(page.locator('text=Mapbox optimization complete')).toBeVisible();

    // Check that route geometry is displayed
    await expect(page.locator('[data-testid="route-polyline"]')).toBeVisible();

    // Verify savings display
    await expect(page.locator('text=Distance saved:')).toBeVisible();
    await expect(page.locator('text=Time saved:')).toBeVisible();
  });

  test('should use greedy fallback when Mapbox limit exceeded', async ({ page }) => {
    // Navigate to route optimization
    await page.click('text=Optimize Route');

    // Select many jobs to trigger fallback
    const checkboxes = page.locator('[data-testid="job-checkbox"]');
    const count = await checkboxes.count();
    for (let i = 0; i < Math.min(count, 10); i++) {
      await checkboxes.nth(i).check();
    }

    // Trigger optimization
    await page.click('button:has-text("Optimize Route")');

    // Wait for response
    await page.waitForResponse((response) =>
      response.url().includes('/api/field-intelligence/routing/optimize')
    );

    // Check for fallback notification
    const notification = page.locator('text=Greedy algorithm used');
    if (await notification.isVisible()) {
      // Verify fallback message
      await expect(page.locator('text=Daily Mapbox limit reached')).toBeVisible();
    }

    // Verify route still optimized
    await expect(page.locator('[data-testid="optimized-route-map"]')).toBeVisible();
  });

  test('should track GPS breadcrumbs during route execution', async ({ page }) => {
    // Navigate to active route
    await page.click('text=My Route');
    await page.waitForURL('/routes/my-route');

    // Verify GPS tracker component
    await expect(page.locator('[data-testid="gps-tracker"]')).toBeVisible();

    // Start GPS tracking
    await page.click('button:has-text("Start Tracking")');

    // Wait for location permission (mock in test)
    await page.evaluate(() => {
      navigator.geolocation.getCurrentPosition = (success) => {
        success({
          coords: {
            latitude: 40.7128,
            longitude: -74.0060,
            accuracy: 5,
          },
          timestamp: Date.now(),
        } as any);
      };
    });

    // Wait for first breadcrumb
    await expect(page.locator('[data-testid="breadcrumb-item"]').first()).toBeVisible({
      timeout: 5000,
    });

    // Verify breadcrumb data
    const breadcrumb = page.locator('[data-testid="breadcrumb-item"]').first();
    await expect(breadcrumb).toContainText(/\d+\.\d+, -?\d+\.\d+/);

    // Verify distance traveled
    await expect(page.locator('text=Distance:')).toBeVisible();

    // Stop tracking
    await page.click('button:has-text("Stop Tracking")');
    await expect(page.locator('text=Tracking stopped')).toBeVisible();
  });
});