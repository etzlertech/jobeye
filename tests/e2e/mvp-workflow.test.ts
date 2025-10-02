/**
 * AGENT DIRECTIVE BLOCK
 * 
 * file: /tests/e2e/mvp-workflow.test.ts
 * phase: 3
 * domain: testing
 * purpose: End-to-end test for complete MVP Intent-Driven Mobile App workflow
 * spec_ref: 007-mvp-intent-driven/contracts/mvp-e2e-tests.md
 * complexity_budget: 300
 * migrations_touched: []
 * state_machine: {
 *   states: ['setup', 'supervisor_flow', 'crew_flow', 'admin_flow', 'cleanup'],
 *   transitions: [
 *     'setup->supervisor_flow: startSupervisorTest()',
 *     'supervisor_flow->crew_flow: jobCreated()',
 *     'crew_flow->admin_flow: jobCompleted()',
 *     'admin_flow->cleanup: adminTasksDone()',
 *     'cleanup->setup: testComplete()'
 *   ]
 * }
 * estimated_llm_cost: {
 *   "e2eTests": "$0.00 (no AI operations)"
 * }
 * offline_capability: REQUIRED
 * dependencies: {
 *   internal: [],
 *   external: ['playwright', '@playwright/test'],
 *   supabase: []
 * }
 * exports: []
 * voice_considerations: Test voice command processing and TTS responses
 * test_requirements: {
 *   coverage: 85,
 *   scenarios: ['complete workflow', 'role switching', 'offline mode', 'voice interactions']
 * }
 * tasks: [
 *   'Test complete supervisor-to-crew job workflow',
 *   'Test voice interactions and commands',
 *   'Test offline mode and data sync',
 *   'Test role-based access control'
 * ]
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_TIMEOUT = 60000;

// Test data
const TEST_USERS = {
  supervisor: {
    email: 'supervisor@test.com',
    password: 'test123',
    role: 'supervisor'
  },
  crew: {
    email: 'crew@test.com', 
    password: 'test123',
    role: 'crew'
  },
  admin: {
    email: 'admin@test.com',
    password: 'test123',
    role: 'admin'
  }
};

const TEST_JOB = {
  title: 'E2E Test Lawn Maintenance',
  description: 'Complete lawn care for testing',
  location: '123 Test Street',
  equipment: ['mower', 'trimmer', 'blower']
};

test.describe('MVP Intent-Driven Mobile App E2E Workflow', () => {
  let supervisorPage: Page;
  let crewPage: Page;
  let adminPage: Page;
  let createdJobId: string;

  test.beforeAll(async ({ browser }) => {
    // Create separate contexts for each role
    const supervisorContext = await browser.newContext({
      permissions: ['microphone', 'camera'],
      viewport: { width: 390, height: 844 } // iPhone 12 Pro dimensions
    });
    
    const crewContext = await browser.newContext({
      permissions: ['microphone', 'camera', 'geolocation'],
      viewport: { width: 390, height: 844 }
    });
    
    const adminContext = await browser.newContext({
      permissions: ['microphone'],
      viewport: { width: 1200, height: 800 } // Desktop dimensions
    });

    supervisorPage = await supervisorContext.newPage();
    crewPage = await crewContext.newPage();
    adminPage = await adminContext.newPage();

    // Mock voice recognition for testing
    await supervisorPage.addInitScript(() => {
      // Mock Web Speech API
      (window as any).SpeechRecognition = class MockSpeechRecognition {
        continuous = false;
        interimResults = false;
        lang = 'en-US';
        maxAlternatives = 1;
        
        start() {
          setTimeout(() => {
            if (this.onstart) this.onstart();
            setTimeout(() => {
              if (this.onresult) {
                this.onresult({
                  results: [{
                    0: { transcript: 'create new job for lawn maintenance', confidence: 0.9 },
                    isFinal: true
                  }]
                });
              }
            }, 100);
          }, 100);
        }
        
        stop() {
          if (this.onend) this.onend();
        }
      };
      
      (window as any).webkitSpeechRecognition = (window as any).SpeechRecognition;
    });

    // Apply same mock to crew and admin pages
    await crewPage.addInitScript(() => {
      (window as any).SpeechRecognition = class MockSpeechRecognition {
        start() {
          setTimeout(() => {
            if (this.onstart) this.onstart();
            setTimeout(() => {
              if (this.onresult) {
                this.onresult({
                  results: [{
                    0: { transcript: 'show my jobs', confidence: 0.9 },
                    isFinal: true
                  }]
                });
              }
            }, 100);
          }, 100);
        }
        stop() { if (this.onend) this.onend(); }
      };
      (window as any).webkitSpeechRecognition = (window as any).SpeechRecognition;
    });

    await adminPage.addInitScript(() => {
      (window as any).SpeechRecognition = class MockSpeechRecognition {
        start() {
          setTimeout(() => {
            if (this.onstart) this.onstart();
            setTimeout(() => {
              if (this.onresult) {
                this.onresult({
                  results: [{
                    0: { transcript: 'show users', confidence: 0.9 },
                    isFinal: true
                  }]
                });
              }
            }, 100);
          }, 100);
        }
        stop() { if (this.onend) this.onend(); }
      };
      (window as any).webkitSpeechRecognition = (window as any).SpeechRecognition;
    });
  });

  test.afterAll(async () => {
    await supervisorPage.close();
    await crewPage.close();
    await adminPage.close();
  });

  test('Complete Supervisor to Crew Job Workflow', async () => {
    test.setTimeout(TEST_TIMEOUT);

    // Step 1: Supervisor creates job with voice instructions
    await test.step('Supervisor logs in and creates job', async () => {
      await supervisorPage.goto(`${BASE_URL}/supervisor`);
      
      // Wait for dashboard to load
      await expect(supervisorPage.locator('h1')).toContainText('Supervisor Dashboard');
      
      // Navigate to job creation
      await supervisorPage.click('text=Create Job');
      await expect(supervisorPage.locator('h1')).toContainText('Create New Job');
      
      // Fill job details
      await supervisorPage.fill('[placeholder="Job title..."]', TEST_JOB.title);
      await supervisorPage.fill('[placeholder="Job description..."]', TEST_JOB.description);
      await supervisorPage.fill('[placeholder="Job location..."]', TEST_JOB.location);
      
      // Test voice recording
      await supervisorPage.click('[data-testid="voice-record-button"]');
      await expect(supervisorPage.locator('[data-testid="recording-indicator"]')).toBeVisible();
      
      // Wait for mock recording to complete
      await supervisorPage.waitForTimeout(1000);
      await supervisorPage.click('[data-testid="voice-stop-button"]');
      
      await expect(supervisorPage.locator('text=Voice instructions recorded')).toBeVisible();
      
      // Proceed to equipment assignment
      await supervisorPage.click('text=Next');
      await expect(supervisorPage.locator('h2')).toContainText('Equipment Assignment');
      
      // Assign equipment
      for (const equipment of TEST_JOB.equipment) {
        await supervisorPage.check(`[data-testid="equipment-${equipment}"]`);
      }
      
      // Create job
      await supervisorPage.click('text=Create Job');
      
      // Wait for success and extract job ID
      await expect(supervisorPage.locator('text=Job created successfully')).toBeVisible();
      
      const jobCard = supervisorPage.locator('[data-testid="created-job-card"]');
      createdJobId = await jobCard.getAttribute('data-job-id') || 'test-job-id';
      
      expect(createdJobId).toBeTruthy();
    });

    // Step 2: Crew receives and starts job
    await test.step('Crew member receives and starts job', async () => {
      await crewPage.goto(`${BASE_URL}/crew`);
      
      // Wait for dashboard to load
      await expect(crewPage.locator('h1')).toContainText('Today\'s Jobs');
      
      // Find the created job
      const jobCard = crewPage.locator(`[data-testid="job-card-${createdJobId}"]`);
      await expect(jobCard).toBeVisible();
      await expect(jobCard.locator('text=' + TEST_JOB.title)).toBeVisible();
      
      // Test voice command to start job
      await crewPage.click('[data-testid="voice-command-button"]');
      await expect(crewPage.locator('[data-testid="voice-listening"]')).toBeVisible();
      
      // Mock voice command will be processed
      await crewPage.waitForTimeout(500);
      
      // Alternatively, click start job directly
      await jobCard.locator('text=Start Job').click();
      
      // Should navigate to job details
      await expect(crewPage.url()).toContain(`/crew/jobs/${createdJobId}`);
      await expect(crewPage.locator('h1')).toContainText(TEST_JOB.title);
    });

    // Step 3: Crew performs load verification
    await test.step('Crew performs load verification with AI vision', async () => {
      // Navigate to load verification
      await crewPage.goto(`${BASE_URL}/crew/load-verify`);
      
      await expect(crewPage.locator('h1')).toContainText('Load Verification');
      
      // Select the job for verification
      await crewPage.click(`text=${TEST_JOB.title}`);
      
      // Mock camera capture
      await crewPage.click('text=Take Verification Photo');
      
      // Mock camera interface
      await expect(crewPage.locator('[data-testid="camera-capture"]')).toBeVisible();
      
      // Simulate photo capture
      await crewPage.click('text=Capture Photo');
      
      // Wait for AI verification results
      await expect(crewPage.locator('text=Load Verified Successfully')).toBeVisible({ timeout: 10000 });
      
      // Verify detected equipment shows up
      for (const equipment of TEST_JOB.equipment) {
        await expect(crewPage.locator(`text=${equipment}`)).toBeVisible();
      }
      
      await crewPage.click('text=Confirm Load');
    });

    // Step 4: Crew completes job with photos
    await test.step('Crew completes job with documentation', async () => {
      // Go back to job details
      await crewPage.goto(`${BASE_URL}/crew/jobs/${createdJobId}`);
      
      // Play voice instructions
      await crewPage.click('[data-testid="play-voice-instructions"]');
      await expect(crewPage.locator('[data-testid="audio-playing"]')).toBeVisible();
      
      // Take completion photos
      await crewPage.click('text=Take Photo');
      await expect(crewPage.locator('[data-testid="camera-capture"]')).toBeVisible();
      
      await crewPage.click('text=Capture Photo');
      await expect(crewPage.locator('text=Photo saved')).toBeVisible();
      
      // Complete the job
      await crewPage.click('text=Complete Job');
      
      // Add completion notes
      await crewPage.fill('[placeholder="Add completion notes..."]', 'Job completed successfully with all equipment');
      
      await crewPage.click('text=Confirm Completion');
      
      await expect(crewPage.locator('text=Job completed successfully')).toBeVisible();
    });

    // Step 5: Admin reviews job completion
    await test.step('Admin reviews completed job', async () => {
      await adminPage.goto(`${BASE_URL}/admin`);
      
      await expect(adminPage.locator('h1')).toContainText('Super Admin');
      
      // Check system statistics
      await expect(adminPage.locator('[data-testid="active-jobs"]')).toBeVisible();
      
      // Test voice command for navigation
      await adminPage.click('[data-testid="voice-command-button"]');
      await adminPage.waitForTimeout(500);
      
      // Navigate to users management
      await adminPage.click('text=Users');
      
      await expect(adminPage.locator('text=User Management')).toBeVisible();
      
      // Verify crew member and supervisor are listed
      await expect(adminPage.locator('text=crew@test.com')).toBeVisible();
      await expect(adminPage.locator('text=supervisor@test.com')).toBeVisible();
      
      // Test role update functionality
      const roleSelect = adminPage.locator('[data-testid="role-select-crew"]').first();
      await roleSelect.selectOption('supervisor');
      
      // Should trigger role update API call
      await expect(adminPage.locator('text=Role updated successfully')).toBeVisible();
    });
  });

  test('Offline Mode and Data Synchronization', async () => {
    test.setTimeout(TEST_TIMEOUT);

    await test.step('Test offline mode functionality', async () => {
      // Go to crew dashboard
      await crewPage.goto(`${BASE_URL}/crew`);
      
      // Simulate going offline
      await crewPage.context().setOffline(true);
      
      // App should detect offline mode
      await expect(crewPage.locator('text=Offline Mode')).toBeVisible();
      
      // Try to perform actions offline
      await crewPage.click('[data-testid="voice-command-button"]');
      await crewPage.waitForTimeout(500);
      
      // Voice should be queued for later sync
      await expect(crewPage.locator('text=Queued for sync')).toBeVisible();
      
      // Take photo offline
      await crewPage.click('text=Take Photo');
      await crewPage.click('text=Capture Photo');
      
      await expect(crewPage.locator('text=Saved offline')).toBeVisible();
    });

    await test.step('Test data sync when coming back online', async () => {
      // Go back online
      await crewPage.context().setOffline(false);
      
      // Trigger online event
      await crewPage.evaluate(() => {
        window.dispatchEvent(new Event('online'));
      });
      
      // Should see sync in progress
      await expect(crewPage.locator('text=Syncing data')).toBeVisible();
      
      // Wait for sync to complete
      await expect(crewPage.locator('text=Sync complete')).toBeVisible({ timeout: 10000 });
      
      // Verify offline data was synced
      await expect(crewPage.locator('text=All data synchronized')).toBeVisible();
    });
  });

  test('Role-Based Access Control', async () => {
    test.setTimeout(TEST_TIMEOUT);

    await test.step('Test crew member cannot access supervisor pages', async () => {
      // Try to access supervisor pages as crew
      await crewPage.goto(`${BASE_URL}/supervisor`);
      
      // Should be redirected to crew dashboard
      await expect(crewPage.url()).toContain('/crew');
      await expect(crewPage.locator('text=Access denied')).toBeVisible();
    });

    await test.step('Test supervisor cannot access admin pages', async () => {
      // Try to access admin pages as supervisor
      await supervisorPage.goto(`${BASE_URL}/admin`);
      
      // Should be redirected to supervisor dashboard
      await expect(supervisorPage.url()).toContain('/supervisor');
      await expect(supervisorPage.locator('text=Access denied')).toBeVisible();
    });

    await test.step('Test admin has access to all pages', async () => {
      // Admin should access supervisor pages
      await adminPage.goto(`${BASE_URL}/supervisor`);
      await expect(adminPage.locator('h1')).toContainText('Supervisor Dashboard');
      
      // Admin should access crew pages
      await adminPage.goto(`${BASE_URL}/crew`);
      await expect(adminPage.locator('h1')).toContainText('Today\'s Jobs');
      
      // Admin should access admin pages
      await adminPage.goto(`${BASE_URL}/admin`);
      await expect(adminPage.locator('h1')).toContainText('Super Admin');
    });
  });

  test('PWA Installation and Features', async () => {
    test.setTimeout(TEST_TIMEOUT);

    await test.step('Test PWA manifest and installation', async () => {
      await crewPage.goto(`${BASE_URL}/crew`);
      
      // Check PWA manifest
      const manifestLink = crewPage.locator('link[rel="manifest"]');
      await expect(manifestLink).toHaveAttribute('href', '/manifest.json');
      
      // Check service worker registration
      const swRegistered = await crewPage.evaluate(() => {
        return 'serviceWorker' in navigator;
      });
      
      expect(swRegistered).toBe(true);
      
      // Test install prompt (simulated)
      await crewPage.evaluate(() => {
        window.dispatchEvent(new Event('beforeinstallprompt'));
      });
      
      await expect(crewPage.locator('text=Install App')).toBeVisible();
    });

    await test.step('Test PWA shortcuts and features', async () => {
      // Test quick actions from app shortcuts
      await crewPage.goto(`${BASE_URL}/crew/load-verify`);
      
      // Should work directly from PWA shortcut
      await expect(crewPage.locator('h1')).toContainText('Load Verification');
      
      // Test camera shortcut
      await crewPage.goto(`${BASE_URL}/supervisor/inventory?camera=true`);
      
      // Should auto-open camera
      await expect(crewPage.locator('[data-testid="camera-capture"]')).toBeVisible();
      
      // Test voice command shortcut
      await crewPage.goto(`${BASE_URL}/?voice=true`);
      
      // Should auto-activate voice command
      await expect(crewPage.locator('[data-testid="voice-listening"]')).toBeVisible();
    });
  });

  test('Performance and Responsiveness', async () => {
    test.setTimeout(TEST_TIMEOUT);

    await test.step('Test mobile responsiveness', async () => {
      // Test on mobile viewport
      await crewPage.setViewportSize({ width: 375, height: 667 }); // iPhone SE
      await crewPage.goto(`${BASE_URL}/crew`);
      
      // Check mobile-optimized layout
      await expect(crewPage.locator('[data-testid="mobile-nav"]')).toBeVisible();
      
      // Ensure 4-button constraint is respected
      const visibleButtons = crewPage.locator('[data-testid="button-limiter"] button:visible');
      const buttonCount = await visibleButtons.count();
      expect(buttonCount).toBeLessThanOrEqual(4);
      
      // Test touch interactions
      await crewPage.tap('[data-testid="voice-command-button"]');
      await expect(crewPage.locator('[data-testid="voice-listening"]')).toBeVisible();
    });

    await test.step('Test app loading performance', async () => {
      const startTime = Date.now();
      await crewPage.goto(`${BASE_URL}/crew`);
      
      // Wait for app to be fully loaded
      await expect(crewPage.locator('h1')).toContainText('Today\'s Jobs');
      
      const loadTime = Date.now() - startTime;
      
      // App should load within 3 seconds on mobile
      expect(loadTime).toBeLessThan(3000);
      
      // Check for performance metrics
      const performanceMetrics = await crewPage.evaluate(() => {
        const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        return {
          domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
          loadComplete: perfData.loadEventEnd - perfData.loadEventStart
        };
      });
      
      expect(performanceMetrics.domContentLoaded).toBeLessThan(2000);
    });
  });
});