/**
 * @file tests/e2e/supervisor-login.spec.ts
 * @description Logs in with supervisor credentials and captures a dashboard screenshot.
 */

import { test, expect } from '@playwright/test';

const SUPERVISOR_EMAIL = process.env.PLAYWRIGHT_SUPERVISOR_EMAIL ?? 'super@tophand.tech';
const SUPERVISOR_PASSWORD = process.env.PLAYWRIGHT_SUPERVISOR_PASSWORD ?? 'demo123';

test('supervisor can sign in and view dashboard', async ({ page }, testInfo) => {
  await page.goto('/sign-in');

  await page.getByLabel(/email/i).fill(SUPERVISOR_EMAIL);
  await page.getByLabel(/password/i).fill(SUPERVISOR_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();

  await page.waitForURL(/\/supervisor/);
  await expect(page.getByRole('heading', { name: /customer management/i })).toBeVisible();

  const screenshotPath = testInfo.outputPath('supervisor-dashboard.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach('Dashboard Screenshot', {
    path: screenshotPath,
    contentType: 'image/png'
  });
});
