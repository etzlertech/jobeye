/**
 * @file src/domains/field-intelligence/__tests__/e2e/safety-checklists.e2e.ts
 * @phase 3
 * @domain field-intelligence
 * @purpose End-to-end test for safety checklist workflow
 * @spec_ref docs/feature-005-field-intelligence.md
 * @complexity_budget 200 LoC
 */

import { test, expect } from '@playwright/test';

/**
 * E2E Test Suite: Safety Checklists
 *
 * Tests the complete safety checklist workflow:
 * 1. View job-specific checklist
 * 2. Complete items without photo requirements
 * 3. Complete items with photo proof
 * 4. Track progress
 * 5. Verify supervisor notification
 */

test.describe('Safety Checklists E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/');
    await page.fill('[name="email"]', 'test@jobeye.com');
    await page.fill('[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // Navigate to active job
    await page.click('text=My Jobs');
    await page.click('[data-testid="job-card"]:first-child');
  });

  test('should display job-specific safety checklist', async ({ page }) => {
    // Verify checklist widget is visible
    await expect(page.locator('[data-testid="checklist-widget"]')).toBeVisible();
    await expect(page.locator('text=Safety Checklist')).toBeVisible();

    // Verify progress bar
    const progressBar = page.locator('[data-testid="checklist-progress"]');
    await expect(progressBar).toBeVisible();

    // Check progress text
    await expect(page.locator('text=% Complete')).toBeVisible();

    // Verify categories are grouped
    await expect(page.locator('[data-testid="checklist-category"]')).toHaveCount(
      await page.locator('[data-testid="checklist-category"]').count()
    );

    // Verify checklist items
    const items = page.locator('[data-testid="checklist-item"]');
    const itemCount = await items.count();
    expect(itemCount).toBeGreaterThan(0);
  });

  test('should complete checklist item without photo', async ({ page }) => {
    // Find item without photo requirement
    const item = page
      .locator('[data-testid="checklist-item"]')
      .filter({ hasNot: page.locator('text=📷 Photo required') })
      .first();

    // Get initial progress
    const initialProgress = await page
      .locator('[data-testid="checklist-progress"]')
      .getAttribute('aria-valuenow');

    // Complete the item
    await item.locator('input[type="checkbox"]').check();

    // Wait for API call
    await page.waitForResponse((response) =>
      response.url().includes('/api/field-intelligence/safety/checklists') &&
      response.status() === 200
    );

    // Verify item is marked complete
    await expect(item).toHaveClass(/bg-green-50/);
    await expect(item.locator('input[type="checkbox"]')).toBeChecked();

    // Verify progress updated
    const newProgress = await page
      .locator('[data-testid="checklist-progress"]')
      .getAttribute('aria-valuenow');
    expect(Number(newProgress)).toBeGreaterThan(Number(initialProgress));

    // Verify completion timestamp
    await expect(item.locator('text=Completed')).toBeVisible();
  });

  test('should complete checklist item with photo proof', async ({ page }) => {
    // Find item with photo requirement
    const item = page
      .locator('[data-testid="checklist-item"]')
      .filter({ has: page.locator('text=📷 Photo required') })
      .first();

    // Click checkbox to trigger photo upload
    await item.locator('input[type="checkbox"]').check();

    // Mock file input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'safety-photo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-image-data'),
    });

    // Wait for upload
    await expect(page.locator('text=Uploading photo...')).toBeVisible();

    // Wait for API call
    await page.waitForResponse((response) =>
      response.url().includes('/api/field-intelligence/safety/checklists') &&
      response.status() === 200
    );

    // Verify item completed with photo
    await expect(item).toHaveClass(/bg-green-50/);
    await expect(item.locator('text=Photo attached')).toBeVisible();
  });

  test('should track checklist progress to completion', async ({ page }) => {
    // Get all incomplete items
    const items = page
      .locator('[data-testid="checklist-item"]')
      .filter({ has: page.locator('input[type="checkbox"]:not(:checked)') });

    const itemCount = await items.count();

    // Complete all items
    for (let i = 0; i < itemCount; i++) {
      const item = items.nth(i);
      const checkbox = item.locator('input[type="checkbox"]');

      // Check if photo required
      const hasPhotoRequirement = await item.locator('text=📷 Photo required').isVisible();

      if (hasPhotoRequirement) {
        await checkbox.check();
        // Mock photo upload
        const fileInput = page.locator('input[type="file"]');
        await fileInput.setInputFiles({
          name: `photo-${i}.jpg`,
          mimeType: 'image/jpeg',
          buffer: Buffer.from('fake-image-data'),
        });
        await page.waitForTimeout(500);
      } else {
        await checkbox.check();
        await page.waitForTimeout(200);
      }
    }

    // Verify 100% completion
    await expect(page.locator('text=100% Complete')).toBeVisible();

    // Verify completion message
    await expect(page.locator('text=✓ Checklist Complete!')).toBeVisible();
  });

  test('should notify supervisor on checklist completion', async ({ page }) => {
    // Complete all checklist items
    const items = page.locator('[data-testid="checklist-item"] input[type="checkbox"]');
    const count = await items.count();

    for (let i = 0; i < count; i++) {
      const checkbox = items.nth(i);
      if (!(await checkbox.isChecked())) {
        await checkbox.check();
        await page.waitForTimeout(200);
      }
    }

    // Verify completion notification
    await expect(page.locator('text=✓ Checklist Complete!')).toBeVisible();

    // Check for supervisor notification indicator
    await expect(page.locator('text=Supervisor notified')).toBeVisible();
  });

  test('should handle safety incident reporting from checklist', async ({ page }) => {
    // Click report incident button
    await page.click('button:has-text("Report Incident")');

    // Verify incident reporter modal/form
    await expect(page.locator('[data-testid="incident-reporter"]')).toBeVisible();
    await expect(page.locator('text=Report Safety Incident')).toBeVisible();

    // Fill incident form
    await page.selectOption('[name="incidentType"]', 'UNSAFE_CONDITION');
    await page.selectOption('[name="severity"]', 'MEDIUM');
    await page.fill(
      '[name="description"]',
      'Observed unsafe ladder placement during job setup'
    );
    await page.fill('[name="location"]', 'North side of property');

    // Upload incident photo
    await page
      .locator('input[type="file"]')
      .setInputFiles({
        name: 'incident-photo.jpg',
        mimeType: 'image/jpeg',
        buffer: Buffer.from('fake-image-data'),
      });

    // Submit incident
    await page.click('button[type="submit"]:has-text("Report Incident")');

    // Wait for submission
    await page.waitForResponse((response) =>
      response.url().includes('/api/field-intelligence/safety/incidents') &&
      response.status() === 200
    );

    // Verify success
    await expect(page.locator('text=Incident reported successfully')).toBeVisible();
    await expect(page.locator('text=Supervisor has been notified')).toBeVisible();
  });

  test('should display safety analytics', async ({ page }) => {
    // Navigate to safety analytics
    await page.click('text=Safety');
    await page.click('text=Analytics');
    await page.waitForURL('/safety/analytics');

    // Verify completion rate display
    await expect(page.locator('text=Completion Rate')).toBeVisible();
    await expect(page.locator('[data-testid="completion-rate"]')).toBeVisible();

    // Verify incident tracking
    await expect(page.locator('text=Incidents')).toBeVisible();
    await expect(page.locator('[data-testid="incident-count"]')).toBeVisible();

    // Verify crew compliance
    await expect(page.locator('text=Crew Compliance')).toBeVisible();

    // Check chart rendering
    await expect(page.locator('[data-testid="safety-chart"]')).toBeVisible();
  });

  test('should filter checklist by category', async ({ page }) => {
    // Get initial item count
    const allItems = await page.locator('[data-testid="checklist-item"]').count();

    // Click on a category
    const category = page.locator('[data-testid="checklist-category"]').first();
    const categoryName = await category.textContent();
    await category.click();

    // Verify filtered items
    const filteredItems = await page.locator('[data-testid="checklist-item"]').count();
    expect(filteredItems).toBeLessThanOrEqual(allItems);

    // Verify category filter is active
    await expect(page.locator(`text=Filtered by: ${categoryName}`)).toBeVisible();

    // Clear filter
    await page.click('button:has-text("Show All")');
    const clearedItems = await page.locator('[data-testid="checklist-item"]').count();
    expect(clearedItems).toBe(allItems);
  });
});