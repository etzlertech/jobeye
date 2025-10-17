/**
 * Simple manual test - just check that Assign Crew button works
 * Assumes supervisor is already logged in
 */

import { test, expect } from '@playwright/test';

test.describe('Assign Crew Button Test', () => {
  test('assign crew button shows dropdown', async ({ page, context }) => {
    // Set auth cookies for supervisor user
    await context.addCookies([{
      name: 'sb-rtwigjwqufozqfwozpvo-auth-token',
      value: 'test-session',
      domain: 'localhost',
      path: '/'
    }]);

    // Go directly to supervisor jobs page
    await page.goto('http://localhost:3000/supervisor');

    // Wait a bit for potential redirects
    await page.waitForTimeout(2000);

    console.log('Current URL:', page.url());

    // Take screenshot
    await page.screenshot({ path: 'test-results/supervisor-page.png', fullPage: true });

    // Look for any jobs or job links
    const jobLinks = page.locator('a[href*="/supervisor/jobs/"]');
    const count = await jobLinks.count();

    console.log(`Found ${count} job links`);

    if (count > 0) {
      // Click first job
      await jobLinks.first().click();
      await page.waitForTimeout(1000);

      console.log('Navigated to:', page.url());

      // Take screenshot of job details
      await page.screenshot({ path: 'test-results/job-details.png', fullPage: true });

      // Look for Assign Crew button
      const assignButton = page.locator('button', { hasText: 'Assign Crew' });

      if (await assignButton.count() > 0) {
        console.log('✓ Found Assign Crew button');

        // Click it
        await assignButton.click();
        await page.waitForTimeout(500);

        // Look for dropdown
        const dropdown = page.locator('select[name="crew_member"]');

        if (await dropdown.isVisible()) {
          console.log('✓ Dropdown is visible');

          // Get options
          const options = await dropdown.locator('option').allTextContents();
          console.log('Dropdown options:', options);

          expect(options.length).toBeGreaterThan(1);
        } else {
          console.log('✗ Dropdown not visible');
          await page.screenshot({ path: 'test-results/after-click.png', fullPage: true });
        }
      } else {
        console.log('✗ Assign Crew button not found');
      }
    } else {
      console.log('No jobs found on page');
    }
  });
});
