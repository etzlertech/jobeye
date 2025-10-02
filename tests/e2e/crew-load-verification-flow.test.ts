/**
 * @file /tests/e2e/crew-load-verification-flow.test.ts
 * @purpose Integration test for crew member verifying job load
 * @phase 3
 * @domain E2E Testing
 * @complexity_budget 250
 * @test_coverage 100%
 */

import { test, expect } from '@playwright/test';

test.describe('Crew Load Verification Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication as crew member
    await page.addInitScript(() => {
      localStorage.setItem('auth-token', 'mock-crew-token');
      localStorage.setItem('user-role', 'crew');
      localStorage.setItem('user-id', 'crew-member-123');
    });

    // Mock assigned job with load list
    await page.route('**/api/crew/jobs', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          jobs: [{
            id: 'job-123',
            customerName: 'Smith Property',
            propertyAddress: '123 Main St',
            scheduledDate: new Date().toISOString(),
            status: 'assigned',
            assignedItems: [
              {
                id: 'item-1',
                name: 'Lawn Mower',
                thumbnailUrl: '/images/mower-512x512.jpg',
                verified: false
              },
              {
                id: 'item-2',
                name: 'Leaf Blower',
                thumbnailUrl: '/images/blower-512x512.jpg',
                verified: false
              },
              {
                id: 'item-3',
                name: 'String Trimmer',
                thumbnailUrl: '/images/trimmer-512x512.jpg',
                verified: false
              }
            ]
          }],
          dailyStats: {
            completed: 0,
            remaining: 1,
            totalForDay: 1
          }
        })
      });
    });
  });

  test('should verify all job items using camera AI', async ({ page }) => {
    // Navigate to crew dashboard
    await page.goto('/crew');
    await expect(page).toHaveTitle(/Crew Dashboard/);

    // Click on today's job
    await page.click('[data-testid="job-card-job-123"]');
    await expect(page).toHaveURL('/crew/jobs/job-123');

    // Start job
    await page.click('button:has-text("Start Job")');
    await expect(page.locator('[data-testid="job-status"]')).toContainText('In Progress');

    // Click verify load button
    await page.click('button:has-text("Verify Equipment")');
    await expect(page).toHaveURL('/crew/jobs/job-123/verify');

    // Grant camera permission
    await page.context().grantPermissions(['camera']);

    // Should show load list with unverified items
    await expect(page.locator('[data-testid="load-item"]')).toHaveCount(3);
    await expect(page.locator('[data-testid="item-item-1"][data-verified="false"]')).toBeVisible();

    // Start camera verification
    await page.click('button:has-text("Start Camera Verification")');
    await expect(page.locator('video')).toBeVisible();

    // Simulate AI detection of lawn mower
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('ai-detection', {
        detail: {
          detectedItems: ['lawn mower'],
          confidence: 0.92,
          boundingBoxes: [{
            x: 100, y: 100, width: 200, height: 150, label: 'lawn mower'
          }]
        }
      }));
    });

    // Should automatically check off lawn mower
    await expect(page.locator('[data-testid="item-item-1"][data-verified="true"]')).toBeVisible();
    await expect(page.locator('[data-testid="item-item-1"] .check-icon')).toBeVisible();

    // Simulate detection of leaf blower
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('ai-detection', {
        detail: {
          detectedItems: ['leaf blower'],
          confidence: 0.88,
          boundingBoxes: [{
            x: 150, y: 120, width: 180, height: 140, label: 'leaf blower'
          }]
        }
      }));
    });

    await expect(page.locator('[data-testid="item-item-2"][data-verified="true"]')).toBeVisible();

    // Simulate detection of string trimmer
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('ai-detection', {
        detail: {
          detectedItems: ['string trimmer', 'weed eater'],
          confidence: 0.95
        }
      }));
    });

    await expect(page.locator('[data-testid="item-item-3"][data-verified="true"]')).toBeVisible();

    // All items verified - should show completion
    await expect(page.locator('[data-testid="verification-complete"]')).toBeVisible();
    await expect(page.locator('text=All equipment verified!')).toBeVisible();

    // Submit verification
    await page.click('button:has-text("Submit Verification")');

    // Should navigate back to job details
    await expect(page).toHaveURL('/crew/jobs/job-123');
    await expect(page.locator('[data-testid="load-verified"]')).toBeVisible();
  });

  test('should handle missing items during verification', async ({ page }) => {
    await page.goto('/crew/jobs/job-123');
    await page.click('button:has-text("Start Job")');
    await page.click('button:has-text("Verify Equipment")');

    // Grant camera permission
    await page.context().grantPermissions(['camera']);

    // Start verification
    await page.click('button:has-text("Start Camera Verification")');

    // Simulate finding only 2 of 3 items
    await page.evaluate(() => {
      // Found lawn mower
      window.dispatchEvent(new CustomEvent('ai-detection', {
        detail: { detectedItems: ['lawn mower'], confidence: 0.90 }
      }));
      
      // Found leaf blower
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('ai-detection', {
          detail: { detectedItems: ['leaf blower'], confidence: 0.85 }
        }));
      }, 1000);
    });

    // Wait for detections
    await page.waitForTimeout(1500);

    // Manually mark string trimmer as missing
    await page.click('[data-testid="item-item-3"] button[aria-label="Mark as missing"]');
    
    // Should show missing item dialog
    await expect(page.locator('[role="dialog"]')).toContainText('Report Missing Item');
    
    // Add note about missing item
    await page.fill('textarea[name="notes"]', 'String trimmer not found in truck');
    await page.click('button:has-text("Report Missing")');

    // Should show warning about incomplete load
    await expect(page.locator('[role="alert"][data-type="warning"]')).toBeVisible();
    await expect(page.locator('text=Load verification incomplete')).toBeVisible();

    // Submit with missing item
    await page.click('button:has-text("Submit with Missing Items")');

    // Should notify supervisor
    await expect(page.locator('[data-testid="notification"]')).toContainText('Supervisor notified of missing equipment');
  });

  test('should support manual verification in offline mode', async ({ page }) => {
    // Set offline before navigation
    await page.context().setOffline(true);

    await page.goto('/crew/jobs/job-123');
    
    // Should show offline indicator
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();

    // Start job should work offline
    await page.click('button:has-text("Start Job")');
    
    // Verify equipment button should be available
    await page.click('button:has-text("Verify Equipment")');

    // Camera verification should be disabled
    await expect(page.locator('button:has-text("Start Camera Verification")')).toBeDisabled();
    await expect(page.locator('text=Camera verification unavailable offline')).toBeVisible();

    // Manual checklist should be available
    await expect(page.locator('[data-testid="manual-checklist"]')).toBeVisible();

    // Manually check items
    await page.click('[data-testid="item-item-1"] input[type="checkbox"]');
    await page.click('[data-testid="item-item-2"] input[type="checkbox"]');
    await page.click('[data-testid="item-item-3"] input[type="checkbox"]');

    // Submit manual verification
    await page.click('button:has-text("Submit Manual Verification")');

    // Should queue for sync
    await expect(page.locator('[data-testid="queued-for-sync"]')).toBeVisible();
    await expect(page.locator('text=Verification will sync when online')).toBeVisible();
  });

  test('should use voice commands during verification', async ({ page }) => {
    await page.goto('/crew/jobs/job-123/verify');
    
    // Grant microphone permission
    await page.context().grantPermissions(['microphone', 'camera']);

    // Use voice to check off items
    await page.click('button[aria-label="Voice command"]');

    // Simulate voice command
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('speech-recognized', {
        detail: {
          transcript: 'Check off lawn mower',
          confidence: 0.91
        }
      }));
    });

    // Should process voice command
    await expect(page.locator('[data-testid="voice-processing"]')).toBeVisible();
    
    // Should check off lawn mower
    await expect(page.locator('[data-testid="item-item-1"][data-verified="true"]')).toBeVisible();
    
    // Voice feedback
    await expect(page.locator('[data-testid="voice-response"]')).toContainText('Lawn mower verified');

    // Use voice for missing item
    await page.click('button[aria-label="Voice command"]');
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('speech-recognized', {
        detail: {
          transcript: 'String trimmer is missing',
          confidence: 0.88
        }
      }));
    });

    // Should mark as missing
    await expect(page.locator('[data-testid="item-item-3"][data-missing="true"]')).toBeVisible();
    await expect(page.locator('[data-testid="voice-response"]')).toContainText('String trimmer marked as missing');
  });

  test('should enforce 4-button limit during verification', async ({ page }) => {
    await page.goto('/crew/jobs/job-123/verify');

    // Count primary action buttons
    const primaryButtons = page.locator('.action-bar button[data-primary="true"]');
    await expect(primaryButtons).toHaveCount(4);

    // Verify essential actions are visible
    await expect(page.locator('button:has-text("Camera")')).toBeVisible();
    await expect(page.locator('button[aria-label="Voice command"]')).toBeVisible();
    await expect(page.locator('button:has-text("Submit")')).toBeVisible();
    await expect(page.locator('button:has-text("More")')).toBeVisible();

    // Additional actions in dropdown
    await page.click('button:has-text("More")');
    await expect(page.locator('[role="menu"]')).toBeVisible();
    await expect(page.locator('[role="menuitem"]:has-text("Add Note")')).toBeVisible();
    await expect(page.locator('[role="menuitem"]:has-text("Skip Verification")')).toBeVisible();
  });

  test('should track verification time and AI costs', async ({ page }) => {
    await page.goto('/crew/jobs/job-123/verify');
    await page.context().grantPermissions(['camera']);

    const startTime = Date.now();

    // Start verification
    await page.click('button:has-text("Start Camera Verification")');

    // Simulate AI verifications
    await page.evaluate(() => {
      // Each AI call has a cost
      window.dispatchEvent(new CustomEvent('ai-detection', {
        detail: { 
          detectedItems: ['lawn mower'], 
          confidence: 0.92,
          aiCost: 0.02 
        }
      }));

      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('ai-detection', {
          detail: { 
            detectedItems: ['leaf blower'], 
            confidence: 0.88,
            aiCost: 0.02 
          }
        }));
      }, 500);

      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('ai-detection', {
          detail: { 
            detectedItems: ['string trimmer'], 
            confidence: 0.90,
            aiCost: 0.02 
          }
        }));
      }, 1000);
    });

    // Wait for all verifications
    await page.waitForTimeout(1500);

    // Submit verification
    await page.click('button:has-text("Submit Verification")');

    // Should show summary with metrics
    await expect(page.locator('[data-testid="verification-summary"]')).toBeVisible();
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

    // Should show AI cost
    await expect(page.locator('[data-testid="ai-cost"]')).toContainText('$0.06');
  });
});