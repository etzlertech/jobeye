/**
 * @file src/domains/field-intelligence/__tests__/e2e/time-tracking.e2e.ts
 * @phase 3
 * @domain field-intelligence
 * @purpose End-to-end test for time tracking and approval workflow
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 250 LoC
 */

import { test, expect } from '@playwright/test';

/**
 * E2E Test Suite: Time Tracking
 *
 * Tests the complete time tracking workflow:
 * 1. Clock in with geolocation
 * 2. Real-time duration tracking
 * 3. Clock out
 * 4. Auto clock-out scenarios
 * 5. Time entry approval
 * 6. Timesheet generation
 */

test.describe('Time Tracking E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/');
    await page.fill('[name="email"]', 'test@jobeye.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // Grant geolocation permission
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({ latitude: 40.7128, longitude: -74.006 });
  });

  test('should clock in with geolocation capture', async ({ page }) => {
    // Navigate to job
    await page.click('text=My Jobs');
    await page.click('[data-testid="job-card"]:first-child');

    // Verify clock in button
    await expect(page.locator('[data-testid="clock-in-button"]')).toBeVisible();
    await expect(page.locator('button:has-text("Clock In")')).toBeVisible();

    // Clock in
    await page.click('button:has-text("Clock In")');

    // Wait for geolocation and API call
    await page.waitForResponse((response) =>
      response.url().includes('/api/field-intelligence/time/clock/in') &&
      response.status() === 200
    );

    // Verify clocked in state
    await expect(page.locator('text=Clocked in')).toBeVisible();
    await expect(page.locator('button:has-text("Clock Out")')).toBeVisible();

    // Verify duration display
    await expect(page.locator('[data-testid="clock-duration"]')).toBeVisible();
    const durationText = await page.locator('[data-testid="clock-duration"]').textContent();
    expect(durationText).toMatch(/\d{2}:\d{2}:\d{2}/); // HH:MM:SS format
  });

  test('should display real-time duration updates', async ({ page }) => {
    // Navigate to job with active clock-in
    await page.click('text=My Jobs');
    const activeJob = page.locator('[data-testid="job-card"][data-clocked-in="true"]').first();
    await activeJob.click();

    // Get initial duration
    const initialDuration = await page.locator('[data-testid="clock-duration"]').textContent();

    // Wait 3 seconds and verify duration updated
    await page.waitForTimeout(3000);

    const updatedDuration = await page.locator('[data-testid="clock-duration"]').textContent();
    expect(updatedDuration).not.toBe(initialDuration);

    // Verify format is still correct
    expect(updatedDuration).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  test('should clock out successfully', async ({ page }) => {
    // Navigate to clocked-in job
    await page.click('text=My Jobs');
    const activeJob = page.locator('[data-testid="job-card"][data-clocked-in="true"]').first();
    await activeJob.click();

    // Verify clocked in
    await expect(page.locator('text=Clocked in')).toBeVisible();

    // Click clock out
    await page.click('button:has-text("Clock Out")');

    // Wait for API call
    await page.waitForResponse((response) =>
      response.url().includes('/api/field-intelligence/time/clock/out') &&
      response.status() === 200
    );

    // Verify clocked out state
    await expect(page.locator('button:has-text("Clock In")')).toBeVisible();
    await expect(page.locator('text=Clocked in')).not.toBeVisible();

    // Verify time entry created
    await page.click('text=Time Entries');
    await expect(page.locator('[data-testid="time-entry"]:first-child')).toBeVisible();
  });

  test('should trigger auto clock-out on geofence exit', async ({ page }) => {
    // Clock in at job site
    await page.click('text=My Jobs');
    await page.click('[data-testid="job-card"]:first-child');
    await page.click('button:has-text("Clock In")');
    await page.waitForResponse((response) => response.url().includes('/clock/in'));

    // Simulate leaving geofence
    await page.context().setGeolocation({ latitude: 40.8, longitude: -74.1 });

    // Wait for auto clock-out detection
    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/field-intelligence/time/clock/out') &&
        response.status() === 200,
      { timeout: 40000 } // Wait for check interval
    );

    // Verify auto clock-out notification
    await expect(page.locator('text=Auto-clocked out')).toBeVisible();
    await expect(page.locator('text=left job site')).toBeVisible();
  });

  test('should handle time entry approval workflow', async ({ page }) => {
    // Login as supervisor
    await page.click('text=Profile');
    await page.click('text=Switch Role');
    await page.click('text=Supervisor');

    // Navigate to approval queue
    await page.click('text=Approvals');
    await page.waitForURL('/approvals');

    // Verify approval queue
    await expect(page.locator('[data-testid="approval-queue"]')).toBeVisible();
    await expect(page.locator('text=Approval Queue')).toBeVisible();

    // Check pending entries
    const pendingEntries = page.locator('[data-testid="pending-entry"]');
    const count = await pendingEntries.count();
    expect(count).toBeGreaterThan(0);

    // Select entry for approval
    const firstEntry = pendingEntries.first();
    await firstEntry.locator('input[type="checkbox"]').check();

    // Approve entry
    await page.click('button:has-text("Approve (1)")');

    // Wait for API call
    await page.waitForResponse((response) =>
      response.url().includes('/api/field-intelligence/time/approve') &&
      response.status() === 200
    );

    // Verify entry removed from queue
    await expect(firstEntry).not.toBeVisible();

    // Verify updated count
    const newCount = await page.locator('[data-testid="pending-entry"]').count();
    expect(newCount).toBe(count - 1);
  });

  test('should handle bulk approval', async ({ page }) => {
    // Navigate to approval queue as supervisor
    await page.click('text=Approvals');

    // Select multiple entries
    const checkboxes = page.locator('[data-testid="pending-entry"] input[type="checkbox"]');
    const count = Math.min(await checkboxes.count(), 3); // Select up to 3

    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).check();
    }

    // Verify bulk action button
    await expect(page.locator(`button:has-text("Approve (${count})")`)).toBeVisible();

    // Approve all selected
    await page.click(`button:has-text("Approve (${count})")`);

    // Wait for batch API call
    await page.waitForResponse((response) =>
      response.url().includes('/time/approve') && response.status() === 200
    );

    // Verify entries removed
    const remainingCount = await page.locator('[data-testid="pending-entry"]').count();
    expect(remainingCount).toBeLessThan(count);
  });

  test('should reject time entry with reason', async ({ page }) => {
    // Navigate to approvals
    await page.click('text=Approvals');

    // Select entry to reject
    const entry = page.locator('[data-testid="pending-entry"]').first();
    await entry.locator('input[type="checkbox"]').check();

    // Click reject
    await page.click('button:has-text("Reject")');

    // Verify rejection modal
    await expect(page.locator('[data-testid="reject-modal"]')).toBeVisible();
    await expect(page.locator('text=Reject Time Entries')).toBeVisible();

    // Enter rejection reason
    await page.fill('[name="rejectionReason"]', 'Clock-in time does not match job schedule');

    // Submit rejection
    await page.click('button:has-text("Reject")');

    // Wait for API call
    await page.waitForResponse((response) =>
      response.url().includes('/time/approve') && response.status() === 200
    );

    // Verify entry removed
    await expect(entry).not.toBeVisible();
  });

  test('should generate and export timesheet', async ({ page }) => {
    // Navigate to timesheets
    await page.click('text=Time');
    await page.click('text=Timesheets');
    await page.waitForURL('/time/timesheets');

    // Verify timesheet viewer
    await expect(page.locator('[data-testid="timesheet-viewer"]')).toBeVisible();
    await expect(page.locator('text=Timesheet')).toBeVisible();

    // Select period
    await page.selectOption('[name="period"]', 'week');

    // Wait for timesheet load
    await page.waitForResponse((response) =>
      response.url().includes('/api/field-intelligence/time/timesheets')
    );

    // Verify summary stats
    await expect(page.locator('text=Regular Hours')).toBeVisible();
    await expect(page.locator('text=Overtime Hours')).toBeVisible();
    await expect(page.locator('text=Total Hours')).toBeVisible();

    // Verify time entries list
    const entries = page.locator('[data-testid="timesheet-entry"]');
    expect(await entries.count()).toBeGreaterThan(0);

    // Export as CSV
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("CSV")');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/timesheet.*\.csv/);
  });

  test('should calculate overtime correctly', async ({ page }) => {
    // Navigate to timesheets
    await page.click('text=Time');
    await page.click('text=Timesheets');

    // Select period with overtime
    await page.selectOption('[name="period"]', 'week');

    // Wait for load
    await page.waitForResponse((response) => response.url().includes('/timesheets'));

    // Find entry with overtime
    const overtimeEntry = page
      .locator('[data-testid="timesheet-entry"]')
      .filter({ has: page.locator('text=OT') })
      .first();

    if (await overtimeEntry.isVisible()) {
      // Verify overtime display
      await expect(overtimeEntry.locator('[data-testid="overtime-hours"]')).toBeVisible();

      // Verify orange highlight
      await expect(overtimeEntry.locator('text=OT')).toHaveClass(/text-orange-600/);

      // Check total hours > 8 for daily overtime
      const totalHours = await overtimeEntry
        .locator('[data-testid="total-hours"]')
        .textContent();
      const hours = parseFloat(totalHours!);
      expect(hours).toBeGreaterThan(8);
    }
  });

  test('should display labor cost analytics', async ({ page }) => {
    // Navigate to labor analytics
    await page.click('text=Analytics');
    await page.click('text=Labor Costs');
    await page.waitForURL('/analytics/labor');

    // Verify labor cost chart
    await expect(page.locator('[data-testid="labor-cost-chart"]')).toBeVisible();
    await expect(page.locator('text=Labor Cost Analytics')).toBeVisible();

    // Verify key metrics
    await expect(page.locator('text=Total Labor Cost')).toBeVisible();
    await expect(page.locator('text=Utilization Rate')).toBeVisible();
    await expect(page.locator('text=Cost per Job')).toBeVisible();
    await expect(page.locator('text=Monthly Forecast')).toBeVisible();

    // Verify hours breakdown
    await expect(page.locator('text=Hours Breakdown')).toBeVisible();
    await expect(page.locator('[data-testid="regular-hours-bar"]')).toBeVisible();
    await expect(page.locator('[data-testid="overtime-hours-bar"]')).toBeVisible();

    // Verify cost breakdown
    await expect(page.locator('text=Cost Breakdown')).toBeVisible();
    await expect(page.locator('text=Regular Pay')).toBeVisible();
    await expect(page.locator('text=Overtime Pay')).toBeVisible();

    // Check for overtime warning if applicable
    const overtimePct = await page.locator('[data-testid="overtime-percentage"]').textContent();
    if (overtimePct && parseInt(overtimePct) > 20) {
      await expect(page.locator('text=High Overtime Alert')).toBeVisible();
    }
  });

  test('should handle discrepancy detection', async ({ page }) => {
    // Navigate to approvals
    await page.click('text=Approvals');

    // Find entry with discrepancy flag
    const flaggedEntry = page
      .locator('[data-testid="pending-entry"]')
      .filter({ has: page.locator('[data-testid="discrepancy-flag"]') })
      .first();

    if (await flaggedEntry.isVisible()) {
      // Verify discrepancy indicators
      await expect(flaggedEntry.locator('text=⚠️')).toBeVisible();

      // Check discrepancy types
      const flags = flaggedEntry.locator('[data-testid="discrepancy-flag"]');
      const flagCount = await flags.count();
      expect(flagCount).toBeGreaterThan(0);

      // Common discrepancy types to check for
      const possibleFlags = [
        'Long duration',
        'Outside schedule',
        'Missing clock-out',
        'Location mismatch',
      ];

      let foundFlag = false;
      for (const flag of possibleFlags) {
        if (await flaggedEntry.locator(`text=${flag}`).isVisible()) {
          foundFlag = true;
          break;
        }
      }
      expect(foundFlag).toBe(true);
    }
  });

  test('should complete full time tracking lifecycle', async ({ page }) => {
    // Step 1: Clock in
    await page.click('text=My Jobs');
    await page.click('[data-testid="job-card"]:first-child');
    await page.click('button:has-text("Clock In")');
    await page.waitForResponse((response) => response.url().includes('/clock/in'));

    // Step 2: Verify tracking
    await expect(page.locator('text=Clocked in')).toBeVisible();
    const duration = page.locator('[data-testid="clock-duration"]');
    await expect(duration).toBeVisible();

    // Step 3: Work for a bit (simulated)
    await page.waitForTimeout(2000);

    // Step 4: Clock out
    await page.click('button:has-text("Clock Out")');
    await page.waitForResponse((response) => response.url().includes('/clock/out'));

    // Step 5: View time entry
    await page.click('text=Time Entries');
    const entry = page.locator('[data-testid="time-entry"]').first();
    await expect(entry).toBeVisible();
    await expect(entry.locator('[data-testid="approval-status"]')).toHaveText('PENDING');

    // Step 6: Supervisor approval
    await page.click('text=Profile');
    await page.click('text=Switch to Supervisor');
    await page.click('text=Approvals');
    await entry.locator('input[type="checkbox"]').check();
    await page.click('button:has-text("Approve (1)")');
    await page.waitForResponse((response) => response.url().includes('/approve'));

    // Step 7: Verify approved in timesheet
    await page.click('text=Timesheets');
    const approvedEntry = page
      .locator('[data-testid="timesheet-entry"]')
      .filter({ has: page.locator('[data-status="APPROVED"]') })
      .first();
    await expect(approvedEntry).toBeVisible();
  });
});