/**
 * Manual test for Assign Crew functionality
 */

import { test, expect } from '@playwright/test';

test.describe('Assign Crew Functionality', () => {
  test('supervisor can assign crew to a job', async ({ page }) => {
    // 1. Login as supervisor
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="email"]', 'super@tophand.tech');
    await page.fill('input[name="password"]', 'demo123');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('**/supervisor', { timeout: 10000 });

    // 2. Navigate to a job details page
    await page.goto('http://localhost:3000/supervisor/jobs');
    await page.waitForSelector('[data-testid^="job-tile-"]', { timeout: 5000 });

    // Click first job
    const firstJob = page.locator('[data-testid^="job-tile-"]').first();
    await firstJob.click();

    // Wait for job details page
    await page.waitForURL('**/supervisor/jobs/**');

    // 3. Test Assign Crew button
    console.log('Looking for Assign Crew button...');
    await page.waitForSelector('text="Assign Crew"', { timeout: 5000 });

    const assignButton = page.locator('button:has-text("Assign Crew")');
    await expect(assignButton).toBeVisible();

    // Click Assign Crew button
    await assignButton.click();

    // 4. Wait for dropdown to appear
    console.log('Waiting for crew dropdown...');
    await page.waitForSelector('select[name="crew_member"]', { timeout: 3000 });

    // 5. Verify crew members are loaded
    const dropdown = page.locator('select[name="crew_member"]');
    await expect(dropdown).toBeVisible();

    // Get options
    const options = dropdown.locator('option');
    const optionCount = await options.count();

    console.log(`Found ${optionCount} crew members in dropdown`);

    // Should have at least 7 options (1 placeholder + 6 crew members)
    expect(optionCount).toBeGreaterThanOrEqual(7);

    // 6. Select a crew member
    await dropdown.selectOption({ index: 1 }); // Select first actual crew member

    // 7. Click Assign button
    await page.click('button:has-text("Assign")');

    // 8. Wait for success message
    await page.waitForSelector('text="Crew assigned successfully"', { timeout: 5000 });

    console.log('✅ Crew assignment successful!');
  });
});
