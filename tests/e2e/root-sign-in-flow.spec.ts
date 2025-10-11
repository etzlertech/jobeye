/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /tests/e2e/root-sign-in-flow.spec.ts
 * phase: 3
 * domain: authentication
 * purpose: Verify root route renders sign-in and redirects to supervisor dashboard
 * spec_ref: auth-routing-simplification
 * complexity_budget: 180
 * dependencies:
 *   external:
 *     - '@playwright/test'
 *   internal:
 *     - none
 * voice_considerations:
 *   - Voice features remain disabled during authentication
 */

import { test, expect } from '@playwright/test';

const SUPERVISOR_EMAIL =
  process.env.PLAYWRIGHT_SUPERVISOR_EMAIL ?? 'super@tophand.tech';
const SUPERVISOR_PASSWORD =
  process.env.PLAYWRIGHT_SUPERVISOR_PASSWORD ?? 'demo123';

test('root route shows sign-in and redirects supervisor after login', async ({ page }, testInfo) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: /sign in to continue/i })
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: /jobeye/i })
  ).toBeVisible();
  await expect(page.getByText(/enter demo hub/i)).toHaveCount(0);

  const rootScreenshot = testInfo.outputPath('01-root-sign-in.png');
  await page.screenshot({ path: rootScreenshot, fullPage: true });
  await testInfo.attach('01 - Root Sign-In', {
    path: rootScreenshot,
    contentType: 'image/png',
  });

  await page.getByLabel(/email address/i).fill(SUPERVISOR_EMAIL);
  await page.getByLabel(/password/i).fill(SUPERVISOR_PASSWORD);

  const filledScreenshot = testInfo.outputPath('02-filled-credentials.png');
  await page.screenshot({ path: filledScreenshot, fullPage: true });
  await testInfo.attach('02 - Credentials Filled', {
    path: filledScreenshot,
    contentType: 'image/png',
  });

  await page.getByRole('button', { name: /^sign in$/i }).click();

  await expect(
    page.locator('text=/Welcome Back|Authenticating/i')
  ).toBeVisible({ timeout: 5000 });

  const redirectingScreenshot = testInfo.outputPath(
    '03-redirecting-to-dashboard.png'
  );
  await page.screenshot({ path: redirectingScreenshot, fullPage: true });
  await testInfo.attach('03 - Redirecting', {
    path: redirectingScreenshot,
    contentType: 'image/png',
  });

  await page.waitForURL(/\/supervisor\/?$/);
  await expect(
    page.getByRole('heading', { name: /supervisor dashboard/i })
  ).toBeVisible();

  const dashboardScreenshot = testInfo.outputPath(
    '04-supervisor-dashboard.png'
  );
  await page.screenshot({ path: dashboardScreenshot, fullPage: true });
  await testInfo.attach('04 - Supervisor Dashboard', {
    path: dashboardScreenshot,
    contentType: 'image/png',
  });
});
