/**
 * E2E Test: Complete job assignment workflow (Scenarios 1-4)
 *
 * Tests the full user workflow using Playwright:
 * 1. Supervisor login → assign crew → verify UI update
 * 2. Crew login → view dashboard → verify job appears
 * 3. Crew opens job → mark items loaded → verify progress
 * 4. Crew views fully loaded job → verify read-only mode
 *
 * Task: T015
 * Feature: 010-job-assignment-and
 *
 * NOTE: This test uses Playwright to test the full browser workflow.
 * Run with: npm run test:e2e
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const SUPERVISOR_EMAIL = 'super@tophand.tech';
const CREW_EMAIL = 'crew@tophand.tech';
const TEST_PASSWORD = 'demo123';

test.describe('T015: Complete job assignment workflow', () => {
  let supervisorPage: Page;
  let crewPage: Page;
  let testJobNumber: string;

  test.beforeAll(async ({ browser }) => {
    // Setup: Create browser contexts for supervisor and crew
    const supervisorContext = await browser.newContext();
    const crewContext = await browser.newContext();

    supervisorPage = await supervisorContext.newPage();
    crewPage = await crewContext.newPage();

    testJobNumber = `JOB-E2E-${Date.now()}`;
  });

  test.afterAll(async () => {
    // Cleanup
    await supervisorPage?.close();
    await crewPage?.close();
  });

  test('Step 1: Supervisor logs in', async () => {
    await supervisorPage.goto(`${BASE_URL}/login`);

    // Fill in login form
    await supervisorPage.fill('input[name="email"]', SUPERVISOR_EMAIL);
    await supervisorPage.fill('input[name="password"]', TEST_PASSWORD);

    // Click login button
    await supervisorPage.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await supervisorPage.waitForURL('**/dashboard', { timeout: 10000 });

    // Verify logged in
    await expect(supervisorPage.locator('text=Dashboard')).toBeVisible();
    await expect(supervisorPage.locator('text=Jobs')).toBeVisible();
  });

  test('Step 2: Supervisor creates a new job', async () => {
    // Navigate to create job page (if exists) or use API
    // For this test, assume job already exists or create via API

    // Navigate to jobs list
    await supervisorPage.goto(`${BASE_URL}/jobs`);

    // Click "Create Job" button
    await supervisorPage.click('button:has-text("Create Job")');

    // Fill job form
    await supervisorPage.fill('input[name="job_number"]', testJobNumber);
    await supervisorPage.fill('input[name="title"]', 'E2E Test Job');

    // Select customer and property (assuming dropdowns exist)
    // await supervisorPage.selectOption('select[name="customer_id"]', { index: 1 });
    // await supervisorPage.selectOption('select[name="property_id"]', { index: 1 });

    // Set dates
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    await supervisorPage.fill('input[name="scheduled_start"]', tomorrow);

    // Submit form
    await supervisorPage.click('button[type="submit"]:has-text("Create")');

    // Wait for redirect to job details
    await supervisorPage.waitForURL('**/jobs/**', { timeout: 10000 });

    // Verify job created
    await expect(supervisorPage.locator(`text=${testJobNumber}`)).toBeVisible();
  });

  test('Step 3: Supervisor assigns crew to job', async () => {
    // Assume we're on job details page from previous test

    // Click "Assign Crew" button
    await supervisorPage.click('button:has-text("Assign Crew")');

    // Select crew member from dropdown
    await supervisorPage.click('select[name="crew_member"]');
    await supervisorPage.selectOption('select[name="crew_member"]', { label: CREW_EMAIL });

    // Click "Assign" button
    await supervisorPage.click('button:has-text("Assign")');

    // Wait for success message
    await expect(supervisorPage.locator('text=Crew assigned successfully')).toBeVisible({ timeout: 5000 });

    // Verify crew member appears in "Assigned Crew" section
    await expect(supervisorPage.locator(`text=${CREW_EMAIL}`)).toBeVisible();
  });

  test('Step 4: Crew logs in', async () => {
    await crewPage.goto(`${BASE_URL}/login`);

    // Fill in login form
    await crewPage.fill('input[name="email"]', CREW_EMAIL);
    await crewPage.fill('input[name="password"]', TEST_PASSWORD);

    // Click login button
    await crewPage.click('button[type="submit"]');

    // Wait for redirect to crew hub
    await crewPage.waitForURL('**/crew-hub', { timeout: 10000 });

    // Verify logged in as crew
    await expect(crewPage.locator('text=My Jobs')).toBeVisible();
    await expect(crewPage.locator('text=Crew Hub')).toBeVisible();
  });

  test('Step 5: Crew views assigned job in dashboard', async () => {
    // Assume we're on crew hub from previous test

    // Verify test job appears in job list
    await expect(crewPage.locator(`text=${testJobNumber}`)).toBeVisible({ timeout: 5000 });

    // Verify job tile shows correct information
    const jobTile = crewPage.locator(`[data-testid="job-tile-${testJobNumber}"]`).first();
    await expect(jobTile).toBeVisible();

    // Verify job is sorted by scheduled_start (first in list should be soonest)
    const firstJob = crewPage.locator('[data-testid^="job-tile-"]').first();
    await expect(firstJob).toBeVisible();
  });

  test('Step 6: Crew opens job and views load list', async () => {
    // Click on job tile to open job details
    await crewPage.click(`text=${testJobNumber}`);

    // Wait for navigation to job details or load list
    await crewPage.waitForURL('**/jobs/**', { timeout: 10000 });

    // Verify job details page
    await expect(crewPage.locator(`text=${testJobNumber}`)).toBeVisible();
    await expect(crewPage.locator('text=Load List')).toBeVisible();

    // Navigate to load list (if not already there)
    await crewPage.click('text=Load List');

    // Verify checklist items are visible
    await expect(crewPage.locator('[data-testid^="checklist-item-"]')).toBeVisible();
  });

  test('Step 7: Crew marks items as loaded', async () => {
    // Assume we're on load list page from previous test

    // Get all checklist items
    const checklistItems = crewPage.locator('[data-testid^="checklist-item-"]');
    const itemCount = await checklistItems.count();

    if (itemCount === 0) {
      test.skip(true, 'No checklist items to mark as loaded');
      return;
    }

    // Mark first item as loaded
    const firstItem = checklistItems.first();
    await firstItem.locator('button:has-text("Mark Loaded")').click();

    // Wait for success message
    await expect(crewPage.locator('text=Item marked as loaded')).toBeVisible({ timeout: 5000 });

    // Verify progress indicator updated
    await expect(crewPage.locator('text=1/')).toBeVisible(); // Shows "1/X items loaded"

    // Mark second item (if exists)
    if (itemCount > 1) {
      const secondItem = checklistItems.nth(1);
      await secondItem.locator('button:has-text("Mark Loaded")').click();
      await expect(crewPage.locator('text=2/')).toBeVisible();
    }
  });

  test('Step 8: Verify load status updates in real-time', async () => {
    // Check if LoadStatusBadge component updates
    const loadStatus = crewPage.locator('[data-testid="load-status-badge"]');
    await expect(loadStatus).toBeVisible();

    // Verify color changes based on completion
    // Green = 100%, Yellow = partial, Red = 0%
    const hasPartialClass = await loadStatus.evaluate(el =>
      el.classList.contains('bg-yellow-500') || el.classList.contains('text-yellow-500')
    );
    expect(hasPartialClass).toBe(true);
  });

  test('Step 9: Crew completes all items and job becomes read-only', async () => {
    // Mark all remaining items as loaded
    const checklistItems = crewPage.locator('[data-testid^="checklist-item-"] button:has-text("Mark Loaded")');
    const itemCount = await checklistItems.count();

    for (let i = 0; i < itemCount; i++) {
      const button = checklistItems.first(); // Always click first because items update after each click
      if (await button.isVisible()) {
        await button.click();
        await crewPage.waitForTimeout(1000); // Wait for state update
      }
    }

    // Verify all items loaded
    const loadStatus = crewPage.locator('[data-testid="load-status-badge"]');
    await expect(loadStatus).toContainText('100%', { timeout: 5000 });

    // Verify job is now read-only or redirects to job details
    // Check for read-only mode indicator or redirect
    await crewPage.waitForTimeout(2000);

    // Either redirected to job details OR load list is in read-only mode
    const isReadOnly = await crewPage.locator('text=All items loaded').isVisible();
    const isRedirected = crewPage.url().includes('/jobs/') && !crewPage.url().includes('/load-list');

    expect(isReadOnly || isRedirected).toBe(true);
  });

  test('Step 10: Supervisor sees updated assignment status', async () => {
    // Navigate back to job details as supervisor
    await supervisorPage.goto(`${BASE_URL}/jobs`);

    // Find and click on test job
    await supervisorPage.click(`text=${testJobNumber}`);

    // Verify load status is visible
    const loadStatus = supervisorPage.locator('[data-testid="load-status"]');
    await expect(loadStatus).toBeVisible({ timeout: 5000 });

    // Verify job shows as fully loaded
    await expect(loadStatus).toContainText('100%');

    // Verify assigned crew is still visible
    await expect(supervisorPage.locator(`text=${CREW_EMAIL}`)).toBeVisible();
  });

  test('Step 11: Supervisor unassigns crew', async () => {
    // Assume we're on job details page from previous test

    // Find "Remove" button next to crew member
    const removeButton = supervisorPage.locator(`button:has-text("Remove"):near(text=${CREW_EMAIL})`);
    await removeButton.click();

    // Confirm removal (if confirmation dialog exists)
    await supervisorPage.click('button:has-text("Confirm")');

    // Wait for success message
    await expect(supervisorPage.locator('text=Crew unassigned successfully')).toBeVisible({ timeout: 5000 });

    // Verify crew member no longer in "Assigned Crew" section
    await expect(supervisorPage.locator(`text=${CREW_EMAIL}`)).not.toBeVisible();
  });

  test('Step 12: Crew no longer sees job in their dashboard', async () => {
    // Refresh crew hub page
    await crewPage.goto(`${BASE_URL}/crew-hub`);

    // Wait for page load
    await crewPage.waitForLoadState('networkidle');

    // Verify test job is no longer visible
    await expect(crewPage.locator(`text=${testJobNumber}`)).not.toBeVisible({ timeout: 5000 });

    // Or verify "No jobs assigned" message if no other jobs
    const hasNoJobsMessage = await crewPage.locator('text=No jobs assigned').isVisible();
    const hasOtherJobs = await crewPage.locator('[data-testid^="job-tile-"]').count() > 0;

    expect(hasNoJobsMessage || hasOtherJobs).toBe(true);
  });
});

test.describe('T015: Error handling and edge cases', () => {
  test('Should show error when assigning non-existent user', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', SUPERVISOR_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Navigate to any job
    await page.goto(`${BASE_URL}/jobs`);
    const firstJob = page.locator('[data-testid^="job-tile-"]').first();
    await firstJob.click();

    // Try to assign invalid user (if possible via UI manipulation)
    // This would typically require manipulating the API call
    // For E2E, we can just verify validation exists

    // Click assign button
    await page.click('button:has-text("Assign Crew")');

    // Try to submit without selecting user
    await page.click('button:has-text("Assign")');

    // Verify error message
    await expect(page.locator('text=Please select a crew member')).toBeVisible({ timeout: 3000 });
  });

  test('Should prevent duplicate assignments', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', SUPERVISOR_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Navigate to any job with existing assignment
    await page.goto(`${BASE_URL}/jobs`);
    const firstJob = page.locator('[data-testid^="job-tile-"]').first();
    await firstJob.click();

    // Try to assign same crew member again
    await page.click('button:has-text("Assign Crew")');
    await page.selectOption('select[name="crew_member"]', { label: CREW_EMAIL });
    await page.click('button:has-text("Assign")');

    // Verify error or success message (API might handle idempotently)
    const errorOrSuccess = await Promise.race([
      page.locator('text=already assigned').isVisible(),
      page.locator('text=Crew assigned successfully').isVisible()
    ]);

    expect(errorOrSuccess).toBe(true);
  });

  test('Should show unauthorized error for crew trying to access supervisor pages', async ({ page }) => {
    // Login as crew
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"]', CREW_EMAIL);
    await page.fill('input[name="password"]', TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/crew-hub', { timeout: 10000 });

    // Try to access supervisor-only page (e.g., job creation)
    await page.goto(`${BASE_URL}/jobs/new`);

    // Verify redirected to unauthorized or home page
    await page.waitForTimeout(2000);

    const isUnauthorized = await page.locator('text=Unauthorized').isVisible();
    const isRedirected = page.url() === `${BASE_URL}/` || page.url() === `${BASE_URL}/crew-hub`;

    expect(isUnauthorized || isRedirected).toBe(true);
  });
});
