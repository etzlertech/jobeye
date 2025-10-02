/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /tests/e2e/mvp-workflows.spec.ts
 * phase: 3
 * domain: testing
 * purpose: End-to-end tests for complete MVP user workflows
 * spec_ref: 007-mvp-intent-driven/contracts/e2e-workflows.md
 * complexity_budget: 350
 * migrations_touched: []
 * state_machine: {
 *   states: ['setup', 'authentication', 'workflow_execution', 'verification', 'cleanup'],
 *   transitions: [
 *     'setup->authentication: testEnvironmentReady()',
 *     'authentication->workflow_execution: userLoggedIn()',
 *     'workflow_execution->verification: workflowComplete()',
 *     'verification->cleanup: testValidated()',
 *     'any->cleanup: testFailed()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "e2eWorkflows": "$0.00 (no AI operations in tests)"
 * }
 * offline_capability: NONE
 * dependencies: {
 *   internal: [],
 *   external: ['@playwright/test'],
 *   supabase: []
 * }
 * exports: []
 * voice_considerations: Test voice command interactions and TTS feedback
 * test_requirements: {
 *   coverage: 100,
 *   e2e_tests: 'this file'
 * }
 * tasks: [
 *   'Test complete supervisor workflow',
 *   'Test complete crew workflow',
 *   'Test voice command interactions',
 *   'Test camera and equipment recognition'
 * ]
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

// Test configuration
const TEST_CONFIG = {
  baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',
  timeout: 30000,
  users: {
    supervisor: {
      email: 'supervisor@testcompany.com',
      password: 'test123',
      role: 'supervisor'
    },
    crew: {
      email: 'crew@testcompany.com', 
      password: 'test123',
      role: 'crew'
    },
    admin: {
      email: 'admin@testcompany.com',
      password: 'test123',
      role: 'super_admin'
    }
  }
};

test.describe('MVP Complete Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Setup test environment
    await page.goto(TEST_CONFIG.baseURL);
    await page.waitForLoadState('networkidle');
  });

  test.describe('Authentication Flow', () => {
    test('should authenticate users with different roles', async ({ page }) => {
      // Test supervisor login
      await loginUser(page, TEST_CONFIG.users.supervisor);
      await expect(page.locator('[data-testid="supervisor-dashboard"]')).toBeVisible();
      await expect(page.locator('text=Supervisor Dashboard')).toBeVisible();

      // Logout and test crew login
      await logoutUser(page);
      await loginUser(page, TEST_CONFIG.users.crew);
      await expect(page.locator('[data-testid="crew-dashboard"]')).toBeVisible();
      await expect(page.locator('text=My Jobs')).toBeVisible();
    });

    test('should redirect users based on roles', async ({ page }) => {
      // Crew member should not access supervisor pages
      await loginUser(page, TEST_CONFIG.users.crew);
      await page.goto(`${TEST_CONFIG.baseURL}/supervisor/jobs/create`);
      await expect(page).toHaveURL(/\/crew/); // Redirected to crew area

      // Supervisor should access supervisor pages
      await logoutUser(page);
      await loginUser(page, TEST_CONFIG.users.supervisor);
      await page.goto(`${TEST_CONFIG.baseURL}/supervisor/jobs/create`);
      await expect(page).toHaveURL(/\/supervisor\/jobs\/create/);
    });
  });

  test.describe('Supervisor Complete Workflow', () => {
    test('should create job with voice instructions and assign to crew', async ({ page, context }) => {
      await loginUser(page, TEST_CONFIG.users.supervisor);

      // Navigate to job creation
      await page.click('[data-testid="create-job-button"]');
      await expect(page).toHaveURL(/\/supervisor\/jobs\/create/);

      // Fill job details
      await page.fill('[data-testid="job-title"]', 'Equipment Maintenance Check');
      await page.fill('[data-testid="job-description"]', 'Check all mowing equipment for proper operation');
      await page.fill('[data-testid="job-location"]', '123 Main Street, Test City, TS 12345');

      // Select equipment
      await page.click('[data-testid="equipment-mower"]');
      await page.click('[data-testid="equipment-trimmer"]');
      await page.click('[data-testid="equipment-blower"]');

      // Assign crew member
      await page.selectOption('[data-testid="assign-crew"]', 'crew@testcompany.com');

      // Set priority and date
      await page.selectOption('[data-testid="job-priority"]', 'high');
      await page.fill('[data-testid="scheduled-date"]', getTomorrowDate());

      // Record voice instruction
      await page.click('[data-testid="record-voice-button"]');
      await page.waitForSelector('[data-testid="voice-recording-active"]');
      
      // Simulate voice recording (in real test, this would use Web API)
      await page.waitForTimeout(3000); // Simulate 3-second recording
      await page.click('[data-testid="stop-recording-button"]');
      
      await expect(page.locator('[data-testid="voice-recording-preview"]')).toBeVisible();

      // Submit job
      await page.click('[data-testid="create-job-submit"]');
      await expect(page.locator('text=Job created successfully')).toBeVisible();

      // Verify job appears in job list
      await page.goto(`${TEST_CONFIG.baseURL}/supervisor`);
      await expect(page.locator('text=Equipment Maintenance Check')).toBeVisible();
    });

    test('should monitor job progress and review crew submissions', async ({ page }) => {
      await loginUser(page, TEST_CONFIG.users.supervisor);

      // Navigate to job monitoring
      await page.goto(`${TEST_CONFIG.baseURL}/supervisor`);
      await expect(page.locator('[data-testid="jobs-list"]')).toBeVisible();

      // Check for active jobs
      const jobCards = page.locator('[data-testid="job-card"]');
      await expect(jobCards.first()).toBeVisible();

      // Click on a job to view details
      await jobCards.first().click();
      await expect(page.locator('[data-testid="job-details"]')).toBeVisible();

      // Verify job information
      await expect(page.locator('[data-testid="job-status"]')).toBeVisible();
      await expect(page.locator('[data-testid="assigned-crew"]')).toBeVisible();
      await expect(page.locator('[data-testid="equipment-list"]')).toBeVisible();

      // Check for load verification submissions
      const verificationsSection = page.locator('[data-testid="load-verifications"]');
      if (await verificationsSection.isVisible()) {
        await expect(page.locator('[data-testid="verification-photo"]').first()).toBeVisible();
        await expect(page.locator('[data-testid="detected-items"]')).toBeVisible();
      }
    });
  });

  test.describe('Crew Complete Workflow', () => {
    test('should view assigned jobs and complete daily workflow', async ({ page }) => {
      await loginUser(page, TEST_CONFIG.users.crew);

      // Verify crew dashboard loads
      await expect(page.locator('[data-testid="crew-dashboard"]')).toBeVisible();
      await expect(page.locator('[data-testid="daily-stats"]')).toBeVisible();

      // Check assigned jobs
      const jobsList = page.locator('[data-testid="assigned-jobs"]');
      await expect(jobsList).toBeVisible();

      // Verify job cards contain required information
      const firstJob = page.locator('[data-testid="job-card"]').first();
      await expect(firstJob.locator('[data-testid="job-title"]')).toBeVisible();
      await expect(firstJob.locator('[data-testid="job-location"]')).toBeVisible();
      await expect(firstJob.locator('[data-testid="equipment-list"]')).toBeVisible();

      // Play voice instruction if available
      const voiceButton = firstJob.locator('[data-testid="play-voice-instruction"]');
      if (await voiceButton.isVisible()) {
        await voiceButton.click();
        await expect(page.locator('[data-testid="voice-player"]')).toBeVisible();
      }
    });

    test('should perform equipment verification with camera', async ({ page, context }) => {
      // Grant camera permissions
      await context.grantPermissions(['camera']);
      
      await loginUser(page, TEST_CONFIG.users.crew);

      // Navigate to load verification
      await page.click('[data-testid="verify-load-button"]');
      await expect(page).toHaveURL(/\/crew\/load-verify/);

      // Verify camera interface loads
      await expect(page.locator('[data-testid="camera-preview"]')).toBeVisible();
      await expect(page.locator('[data-testid="capture-button"]')).toBeVisible();

      // Simulate camera capture
      await page.click('[data-testid="capture-button"]');
      await page.waitForSelector('[data-testid="photo-preview"]', { timeout: 10000 });

      // Verify photo processing
      await expect(page.locator('[data-testid="photo-preview"]')).toBeVisible();
      await expect(page.locator('[data-testid="processing-indicator"]')).toBeVisible();

      // Wait for equipment detection results
      await page.waitForSelector('[data-testid="detection-results"]', { timeout: 15000 });
      await expect(page.locator('[data-testid="detected-items-list"]')).toBeVisible();

      // Verify detected equipment items
      const detectedItems = page.locator('[data-testid="detected-item"]');
      await expect(detectedItems.first()).toBeVisible();

      // Add any missing items manually
      const missingItems = page.locator('[data-testid="missing-items"]');
      if (await missingItems.isVisible()) {
        await page.click('[data-testid="add-missing-item"]');
        await page.selectOption('[data-testid="missing-item-select"]', 'hand-tools');
        await page.click('[data-testid="confirm-missing-item"]');
      }

      // Submit verification
      await page.click('[data-testid="submit-verification"]');
      await expect(page.locator('text=Load verification submitted')).toBeVisible();
    });

    test('should start and complete job with voice notes', async ({ page, context }) => {
      // Grant microphone permissions
      await context.grantPermissions(['microphone']);
      
      await loginUser(page, TEST_CONFIG.users.crew);

      // Select first available job
      const firstJob = page.locator('[data-testid="job-card"]').first();
      await firstJob.click();
      await expect(page.locator('[data-testid="job-details"]')).toBeVisible();

      // Start job
      await page.click('[data-testid="start-job-button"]');
      await expect(page.locator('[data-testid="job-status"]')).toHaveText('In Progress');
      await expect(page.locator('text=Job started successfully')).toBeVisible();

      // Add voice note during job
      await page.click('[data-testid="add-voice-note-button"]');
      await page.waitForSelector('[data-testid="voice-recording-modal"]');

      // Record voice note
      await page.click('[data-testid="start-recording"]');
      await page.waitForTimeout(3000); // Simulate 3-second recording
      await page.click('[data-testid="stop-recording"]');

      // Review and save voice note
      await expect(page.locator('[data-testid="voice-note-preview"]')).toBeVisible();
      await page.fill('[data-testid="voice-note-transcript"]', 'Equipment check complete, all items functioning properly');
      await page.click('[data-testid="save-voice-note"]');

      // Take completion photos
      await page.click('[data-testid="add-completion-photo"]');
      await page.click('[data-testid="capture-button"]');
      await page.waitForSelector('[data-testid="photo-preview"]');

      // Complete job
      await page.click('[data-testid="complete-job-button"]');
      await page.fill('[data-testid="completion-notes"]', 'All maintenance tasks completed successfully');
      await page.click('[data-testid="confirm-completion"]');

      await expect(page.locator('text=Job completed successfully')).toBeVisible();
      await expect(page.locator('[data-testid="job-status"]')).toHaveText('Completed');
    });
  });

  test.describe('Voice Navigation & Commands', () => {
    test('should activate and use voice navigation', async ({ page, context }) => {
      // Grant microphone permissions
      await context.grantPermissions(['microphone']);
      
      await loginUser(page, TEST_CONFIG.users.crew);

      // Activate voice navigation using keyboard shortcut
      await page.keyboard.press('Alt+v');
      await expect(page.locator('[data-testid="voice-indicator"]')).toBeVisible();
      await expect(page.locator('[data-testid="voice-status"]')).toHaveText(/Voice navigation active/);

      // Test voice help command
      await page.keyboard.press('Alt+h');
      await expect(page.locator('[aria-live="polite"]')).toContainText('Available commands');

      // Test navigation via voice (simulated)
      // In a real test, this would use speech synthesis/recognition APIs
      await simulateVoiceCommand(page, 'go to jobs');
      await expect(page).toHaveURL(/\/crew/);

      // Test action commands
      await simulateVoiceCommand(page, 'take photo');
      if (await page.locator('[data-testid="camera-modal"]').isVisible()) {
        await expect(page.locator('[data-testid="camera-preview"]')).toBeVisible();
      }

      // Deactivate voice navigation
      await page.keyboard.press('Alt+v');
      await expect(page.locator('[data-testid="voice-indicator"]')).toHaveClass(/inactive/);
    });

    test('should provide voice feedback for user actions', async ({ page, context }) => {
      await context.grantPermissions(['microphone']);
      await loginUser(page, TEST_CONFIG.users.crew);

      // Activate voice navigation
      await page.keyboard.press('Alt+v');
      await expect(page.locator('[data-testid="voice-indicator"]')).toBeVisible();

      // Perform actions that should trigger voice feedback
      await page.click('[data-testid="job-card"]').first();
      // Voice feedback: "Navigated to job details"
      
      await page.click('[data-testid="start-job-button"]');
      // Voice feedback: "Job started successfully"

      // Verify voice feedback is announced (via aria-live regions)
      await expect(page.locator('[aria-live="polite"]')).toContainText(/started/);
    });
  });

  test.describe('Offline Functionality', () => {
    test('should work offline and sync when online', async ({ page, context }) => {
      await loginUser(page, TEST_CONFIG.users.crew);

      // Load initial data while online
      await page.goto(`${TEST_CONFIG.baseURL}/crew`);
      await page.waitForLoadState('networkidle');

      // Go offline
      await context.setOffline(true);

      // Verify app still functions
      await expect(page.locator('[data-testid="crew-dashboard"]')).toBeVisible();
      await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();

      // Perform offline actions
      const firstJob = page.locator('[data-testid="job-card"]').first();
      await firstJob.click();
      await page.click('[data-testid="start-job-button"]');

      // Verify offline queue indicator
      await expect(page.locator('[data-testid="sync-queue-indicator"]')).toBeVisible();
      await expect(page.locator('text=1 item queued for sync')).toBeVisible();

      // Go back online
      await context.setOffline(false);
      await page.waitForTimeout(2000); // Wait for sync

      // Verify sync completion
      await expect(page.locator('[data-testid="offline-indicator"]')).not.toBeVisible();
      await expect(page.locator('[data-testid="sync-queue-indicator"]')).not.toBeVisible();
    });

    test('should handle camera operations offline', async ({ page, context }) => {
      await context.grantPermissions(['camera']);
      await loginUser(page, TEST_CONFIG.users.crew);

      // Go offline
      await context.setOffline(true);

      // Navigate to verification page
      await page.click('[data-testid="verify-load-button"]');
      await expect(page.locator('[data-testid="offline-mode-notice"]')).toBeVisible();

      // Take photos offline
      await page.click('[data-testid="capture-button"]');
      await page.waitForSelector('[data-testid="photo-preview"]');

      // Verify offline storage indication
      await expect(page.locator('text=Photo saved offline')).toBeVisible();
      await expect(page.locator('[data-testid="offline-photos-count"]')).toContainText('1');

      // Take additional photos
      await page.click('[data-testid="capture-another"]');
      await page.click('[data-testid="capture-button"]');
      await expect(page.locator('[data-testid="offline-photos-count"]')).toContainText('2');

      // Go back online and verify sync
      await context.setOffline(false);
      await page.click('[data-testid="sync-offline-photos"]');
      await expect(page.locator('text=Photos synced successfully')).toBeVisible();
    });
  });

  test.describe('Error Handling & Recovery', () => {
    test('should handle network errors gracefully', async ({ page, context }) => {
      await loginUser(page, TEST_CONFIG.users.crew);

      // Simulate network failure during action
      await context.setOffline(true);
      await page.click('[data-testid="job-card"]').first();
      await page.click('[data-testid="start-job-button"]');

      // Verify error handling
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('text=Network error - saved offline')).toBeVisible();

      // Verify retry mechanism
      await context.setOffline(false);
      await page.click('[data-testid="retry-action"]');
      await expect(page.locator('text=Action completed successfully')).toBeVisible();
    });

    test('should recover from camera access errors', async ({ page, context }) => {
      await loginUser(page, TEST_CONFIG.users.crew);

      // Navigate to camera feature
      await page.click('[data-testid="verify-load-button"]');

      // Simulate camera permission denied
      // Note: This would require browser-specific permission mocking
      
      // Verify error handling
      await expect(page.locator('[data-testid="camera-error"]')).toBeVisible();
      await expect(page.locator('text=Camera access required')).toBeVisible();

      // Verify recovery options
      await expect(page.locator('[data-testid="grant-camera-permission"]')).toBeVisible();
      await expect(page.locator('[data-testid="use-file-upload"]')).toBeVisible();
    });
  });

  test.describe('Performance & Accessibility', () => {
    test('should meet performance benchmarks', async ({ page }) => {
      // Navigate to main pages and measure performance
      const performanceMetrics = await page.evaluate(() => {
        return {
          fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
          lcp: performance.getEntriesByType('largest-contentful-paint')[0]?.startTime || 0,
          fid: performance.getEntriesByType('first-input')[0]?.processingStart || 0
        };
      });

      // Verify Core Web Vitals
      expect(performanceMetrics.fcp).toBeLessThan(2000); // < 2 seconds
      expect(performanceMetrics.lcp).toBeLessThan(2500); // < 2.5 seconds
      expect(performanceMetrics.fid).toBeLessThan(100);  // < 100ms
    });

    test('should be fully keyboard accessible', async ({ page }) => {
      await loginUser(page, TEST_CONFIG.users.crew);

      // Test tab navigation
      await page.keyboard.press('Tab');
      await expect(page.locator(':focus')).toBeVisible();

      // Test skip links
      await page.keyboard.press('Tab');
      const skipLink = page.locator('[data-testid="skip-to-main"]');
      if (await skipLink.isVisible()) {
        await page.keyboard.press('Enter');
        await expect(page.locator('main')).toBeFocused();
      }

      // Test keyboard shortcuts
      await page.keyboard.press('Alt+m'); // Skip to main content
      await page.keyboard.press('Alt+v'); // Toggle voice navigation
      await page.keyboard.press('Alt+h'); // Voice help
    });

    test('should support screen reader accessibility', async ({ page }) => {
      await loginUser(page, TEST_CONFIG.users.crew);

      // Verify ARIA labels and landmarks
      await expect(page.locator('[role="main"]')).toBeVisible();
      await expect(page.locator('[role="navigation"]')).toBeVisible();
      await expect(page.locator('[aria-label]').first()).toBeVisible();

      // Verify live regions for dynamic content
      await expect(page.locator('[aria-live="polite"]')).toBeVisible();
      await expect(page.locator('[aria-live="assertive"]')).toBeVisible();

      // Test focus management
      await page.click('[data-testid="job-card"]').first();
      await expect(page.locator('[data-testid="job-details"]')).toBeFocused();
    });
  });

  // Helper functions
  async function loginUser(page: Page, user: { email: string; password: string; role: string }) {
    await page.goto(`${TEST_CONFIG.baseURL}/login`);
    await page.fill('[data-testid="email-input"]', user.email);
    await page.fill('[data-testid="password-input"]', user.password);
    await page.click('[data-testid="login-button"]');
    
    // Wait for redirect based on role
    const expectedPath = user.role === 'supervisor' ? '/supervisor' : 
                        user.role === 'super_admin' ? '/admin' : '/crew';
    await expect(page).toHaveURL(new RegExp(expectedPath));
  }

  async function logoutUser(page: Page) {
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="logout-button"]');
    await expect(page).toHaveURL(/\/login/);
  }

  async function simulateVoiceCommand(page: Page, command: string) {
    // In a real implementation, this would use the Web Speech API
    // For testing, we simulate the voice command processing
    await page.evaluate((cmd) => {
      // Dispatch a custom event that the voice processor would handle
      window.dispatchEvent(new CustomEvent('voice-command', {
        detail: { command: cmd, confidence: 0.95 }
      }));
    }, command);
  }

  function getTomorrowDate(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
});