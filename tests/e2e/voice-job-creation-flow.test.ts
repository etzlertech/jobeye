/**
 * @file /tests/e2e/voice-job-creation-flow.test.ts
 * @purpose Integration test for voice-driven job creation
 * @phase 3
 * @domain E2E Testing
 * @complexity_budget 250
 * @test_coverage 100%
 */

import { test, expect } from '@playwright/test';

test.describe('Voice-Driven Job Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication as supervisor
    await page.addInitScript(() => {
      localStorage.setItem('auth-token', 'mock-supervisor-token');
      localStorage.setItem('user-role', 'supervisor');
      localStorage.setItem('user-id', 'supervisor-123');
    });

    // Mock existing customers and properties
    await page.route('**/api/customers', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          customers: [
            {
              id: 'customer-1',
              name: 'Smith Property Management',
              properties: [
                {
                  id: 'property-1',
                  address: '123 Main Street',
                  thumbnailUrl: '/images/property-1-512x512.jpg'
                }
              ]
            },
            {
              id: 'customer-2',
              name: 'Johnson Estate',
              properties: [
                {
                  id: 'property-2',
                  address: '456 Oak Avenue',
                  thumbnailUrl: '/images/property-2-512x512.jpg'
                }
              ]
            }
          ]
        })
      });
    });

    // Mock crew members
    await page.route('**/api/crew/available', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          crewMembers: [
            { id: 'crew-1', name: 'John Doe', jobsToday: 3, maxJobs: 6 },
            { id: 'crew-2', name: 'Jane Smith', jobsToday: 5, maxJobs: 6 },
            { id: 'crew-3', name: 'Bob Wilson', jobsToday: 6, maxJobs: 6 } // At limit
          ]
        })
      });
    });
  });

  test('should create job using voice commands end-to-end', async ({ page }) => {
    // Navigate to supervisor dashboard
    await page.goto('/supervisor');
    
    // Grant microphone permission
    await page.context().grantPermissions(['microphone']);

    // Click voice command button
    await page.click('button[aria-label="Voice command"]');
    await expect(page.locator('[data-testid="voice-indicator"]')).toBeVisible();

    // Simulate voice command
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('speech-recognized', {
        detail: {
          transcript: 'Create a new job for Smith property tomorrow at 9 AM',
          confidence: 0.94
        }
      }));
    });

    // Wait for LLM processing
    await expect(page.locator('[data-testid="voice-processing"]')).toBeVisible();

    // Should understand intent and navigate to job creation
    await expect(page.locator('[data-testid="voice-intent"]')).toContainText('create_job');
    await expect(page).toHaveURL('/supervisor/jobs/create');

    // Form should be pre-filled from voice command
    await expect(page.locator('input[name="customerSearch"]')).toHaveValue('Smith');
    
    // Select the customer from dropdown
    await page.click('[data-testid="customer-suggestion-customer-1"]');
    await expect(page.locator('[data-testid="selected-customer"]')).toContainText('Smith Property Management');

    // Date should be set to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateValue = tomorrow.toISOString().split('T')[0];
    await expect(page.locator('input[name="scheduledDate"]')).toHaveValue(dateValue);

    // Time should be set to 9 AM
    await expect(page.locator('input[name="scheduledTime"]')).toHaveValue('09:00');

    // Voice prompt for additional details
    await expect(page.locator('[data-testid="voice-response"]')).toContainText('Which property and what services?');

    // Continue with voice
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('speech-recognized', {
        detail: {
          transcript: 'Main street property, standard lawn maintenance with the riding mower kit',
          confidence: 0.91
        }
      }));
    });

    // Property should be selected
    await expect(page.locator('[data-testid="selected-property"]')).toContainText('123 Main Street');

    // Kit should be suggested
    await expect(page.locator('[data-testid="suggested-kit"]')).toContainText('Riding Mower Kit');
    await page.click('[data-testid="suggested-kit"]');

    // Voice prompt for crew assignment
    await expect(page.locator('[data-testid="voice-response"]')).toContainText('Who should I assign this to?');

    // Assign via voice
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('speech-recognized', {
        detail: {
          transcript: 'Assign it to John',
          confidence: 0.89
        }
      }));
    });

    // Should select John Doe
    await expect(page.locator('[data-testid="selected-crew-member"]')).toContainText('John Doe');
    await expect(page.locator('[data-testid="crew-availability"]')).toContainText('3/6 jobs');

    // Voice confirmation
    await expect(page.locator('[data-testid="voice-response"]')).toContainText('Ready to create the job. Should I save it?');

    // Confirm via voice
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('speech-recognized', {
        detail: {
          transcript: 'Yes, create it',
          confidence: 0.95
        }
      }));
    });

    // Should submit form
    await expect(page.locator('[data-testid="creating-job"]')).toBeVisible();

    // Success confirmation
    await expect(page.locator('[role="alert"][data-type="success"]')).toContainText('Job created successfully');
    
    // Voice confirmation
    await expect(page.locator('[data-testid="voice-response"]')).toContainText('Job created and John has been notified');

    // Should navigate back to dashboard
    await expect(page).toHaveURL('/supervisor');
  });

  test('should handle voice corrections during job creation', async ({ page }) => {
    await page.goto('/supervisor/jobs/create');
    await page.context().grantPermissions(['microphone']);

    // Initial voice command
    await page.click('button[aria-label="Voice command"]');
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('speech-recognized', {
        detail: {
          transcript: 'Schedule Johnson estate for Friday at 2 PM',
          confidence: 0.90
        }
      }));
    });

    // Wait for form to populate
    await expect(page.locator('input[name="customerSearch"]')).toHaveValue('Johnson');
    
    // Voice correction
    await page.click('button[aria-label="Voice command"]');
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('speech-recognized', {
        detail: {
          transcript: 'Actually make it Thursday at 10 AM',
          confidence: 0.92
        }
      }));
    });

    // Should update date and time
    await expect(page.locator('[data-testid="voice-processing"]')).toBeVisible();
    
    // Date should change to Thursday
    const thursday = new Date();
    const dayOfWeek = thursday.getDay();
    const daysUntilThursday = (4 - dayOfWeek + 7) % 7 || 7;
    thursday.setDate(thursday.getDate() + daysUntilThursday);
    const thursdayValue = thursday.toISOString().split('T')[0];
    
    await expect(page.locator('input[name="scheduledDate"]')).toHaveValue(thursdayValue);
    await expect(page.locator('input[name="scheduledTime"]')).toHaveValue('10:00');

    // Voice confirmation of change
    await expect(page.locator('[data-testid="voice-response"]')).toContainText('Updated to Thursday at 10 AM');
  });

  test('should validate business rules via voice', async ({ page }) => {
    await page.goto('/supervisor');
    await page.context().grantPermissions(['microphone']);

    // Try to create job for crew member at limit
    await page.click('button[aria-label="Voice command"]');
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('speech-recognized', {
        detail: {
          transcript: 'Create a job for tomorrow and assign it to Bob Wilson',
          confidence: 0.93
        }
      }));
    });

    // Should detect Bob is at his limit
    await expect(page.locator('[data-testid="voice-processing"]')).toBeVisible();
    
    // Voice should inform about the limit
    await expect(page.locator('[data-testid="voice-response"]')).toContainText('Bob Wilson already has 6 jobs tomorrow');
    await expect(page.locator('[data-testid="voice-response"]')).toContainText('Would you like to assign to someone else?');

    // Should show available crew members
    await expect(page.locator('[data-testid="available-crew"]')).toBeVisible();
    await expect(page.locator('[data-testid="crew-suggestion"]')).toContainText('John Doe (3/6)');
    await expect(page.locator('[data-testid="crew-suggestion"]')).toContainText('Jane Smith (5/6)');

    // Choose alternative via voice
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('speech-recognized', {
        detail: {
          transcript: 'Assign it to John instead',
          confidence: 0.91
        }
      }));
    });

    await expect(page.locator('[data-testid="selected-crew-member"]')).toContainText('John Doe');
  });

  test('should support voice-driven special instructions', async ({ page }) => {
    await page.goto('/supervisor/jobs/create');
    await page.context().grantPermissions(['microphone']);

    // Fill basic job details
    await page.fill('input[name="customerSearch"]', 'Smith');
    await page.click('[data-testid="customer-suggestion-customer-1"]');
    await page.fill('input[name="scheduledDate"]', '2025-02-01');
    await page.fill('input[name="scheduledTime"]', '09:00');

    // Add special instructions via voice
    await page.click('[data-testid="add-voice-instructions"]');
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('speech-recognized', {
        detail: {
          transcript: 'Gate code is 1234, park in the driveway, and watch out for the dog',
          confidence: 0.88
        }
      }));
    });

    // Instructions should be captured
    await expect(page.locator('textarea[name="specialInstructions"]')).toHaveValue(
      'Gate code is 1234, park in the driveway, and watch out for the dog'
    );

    // Should also create audio version
    await expect(page.locator('[data-testid="audio-instructions-recorded"]')).toBeVisible();
    
    // Play back instructions
    await page.click('button[aria-label="Play instructions"]');
    await expect(page.locator('audio')).toHaveAttribute('src', /audio\/instructions/);
  });

  test('should handle offline voice commands with queueing', async ({ page }) => {
    await page.goto('/supervisor');
    await page.context().grantPermissions(['microphone']);

    // Go offline
    await page.context().setOffline(true);
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();

    // Try voice command
    await page.click('button[aria-label="Voice command"]');
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('speech-recognized', {
        detail: {
          transcript: 'Create a job for Smith property next Monday',
          confidence: 0.90
        }
      }));
    });

    // Should process locally
    await expect(page.locator('[data-testid="offline-processing"]')).toBeVisible();
    
    // Should queue for later
    await expect(page.locator('[role="alert"][data-type="info"]')).toContainText('Job creation queued');
    await expect(page.locator('[data-testid="sync-queue-count"]')).toContainText('1');

    // Go back online
    await page.context().setOffline(false);
    
    // Should auto-sync
    await expect(page.locator('[data-testid="syncing"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="sync-complete"]')).toBeVisible();
    await expect(page.locator('[data-testid="sync-queue-count"]')).toContainText('0');
  });

  test('should enforce 4-button limit with voice as primary action', async ({ page }) => {
    await page.goto('/supervisor/jobs/create');

    // Check action buttons
    const actionButtons = page.locator('.primary-actions button');
    await expect(actionButtons).toHaveCount(4);

    // Voice should always be one of the 4
    await expect(page.locator('button[aria-label="Voice command"]')).toBeVisible();
    await expect(page.locator('button:has-text("Save Job")')).toBeVisible();
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
    await expect(page.locator('button:has-text("More")')).toBeVisible();

    // Additional actions in dropdown
    await page.click('button:has-text("More")');
    await expect(page.locator('[role="menuitem"]:has-text("Save as Template")')).toBeVisible();
    await expect(page.locator('[role="menuitem"]:has-text("Preview")')).toBeVisible();
  });

  test('should provide voice feedback for all actions', async ({ page }) => {
    await page.goto('/supervisor');
    await page.context().grantPermissions(['microphone', 'autoplay']);

    // Enable voice feedback
    await page.evaluate(() => {
      localStorage.setItem('voice-feedback', 'true');
    });

    // Voice command
    await page.click('button[aria-label="Voice command"]');
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('speech-recognized', {
        detail: {
          transcript: 'Show me today\'s job summary',
          confidence: 0.92
        }
      }));
    });

    // Should speak response
    await expect(page.locator('audio[data-testid="tts-audio"]')).toHaveAttribute('src');
    
    // Visual indication of speaking
    await expect(page.locator('[data-testid="speaking-indicator"]')).toBeVisible();

    // Text should also be shown
    await expect(page.locator('[data-testid="voice-response"]')).toContainText('You have 5 jobs scheduled');
  });
});