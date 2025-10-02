/**
 * @file /tests/e2e/offline-sync-flow.test.ts
 * @purpose Integration test for offline mode and sync functionality
 * @phase 3
 * @domain E2E Testing
 * @complexity_budget 250
 * @test_coverage 100%
 */

import { test, expect } from '@playwright/test';

test.describe('Offline Mode and Sync Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Set up authentication
    await page.addInitScript(() => {
      localStorage.setItem('auth-token', 'mock-crew-token');
      localStorage.setItem('user-role', 'crew');
      localStorage.setItem('user-id', 'crew-123');
    });

    // Initialize IndexedDB with test data
    await page.addInitScript(() => {
      const initDB = async () => {
        const request = indexedDB.open('jobeye_offline', 1);
        request.onsuccess = () => {
          const db = request.result;
          
          // Pre-populate some cached data
          const tx = db.transaction(['cached_jobs', 'cached_inventory'], 'readwrite');
          
          const jobStore = tx.objectStore('cached_jobs');
          jobStore.put({
            id: 'job-offline-1',
            data: {
              id: 'job-offline-1',
              customerName: 'Offline Test Customer',
              propertyAddress: '789 Offline St',
              scheduledDate: new Date().toISOString(),
              status: 'assigned',
              assignedItems: [
                { id: 'item-1', name: 'Mower', verified: false }
              ]
            },
            timestamp: Date.now(),
            expiresAt: Date.now() + (24 * 60 * 60 * 1000)
          });

          const inventoryStore = tx.objectStore('cached_inventory');
          inventoryStore.put({
            id: 'item-1',
            data: {
              id: 'item-1',
              name: 'Mower',
              category: 'equipment',
              thumbnailUrl: '/images/mower-512x512.jpg'
            },
            timestamp: Date.now()
          });
        };
      };
      initDB();
    });
  });

  test('should work offline and sync when connection returns', async ({ page }) => {
    // Start online
    await page.goto('/crew');
    await expect(page).toHaveTitle(/Crew Dashboard/);

    // Go offline
    await page.context().setOffline(true);
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
    await expect(page.locator('text=Working Offline')).toBeVisible();

    // Should still show cached jobs
    await expect(page.locator('[data-testid="job-card"]')).toBeVisible();
    await expect(page.locator('text=Offline Test Customer')).toBeVisible();

    // Start a job offline
    await page.click('[data-testid="job-card-job-offline-1"]');
    await page.click('button:has-text("Start Job")');

    // Should queue the action
    await expect(page.locator('[data-testid="action-queued"]')).toBeVisible();
    await expect(page.locator('[data-testid="sync-queue-badge"]')).toContainText('1');

    // Manually verify equipment (camera not available offline)
    await page.click('button:has-text("Verify Equipment")');
    await expect(page.locator('text=Manual verification only')).toBeVisible();
    
    await page.click('input[data-item-id="item-1"]');
    await page.click('button:has-text("Submit Verification")');

    // Should queue verification
    await expect(page.locator('[data-testid="sync-queue-badge"]')).toContainText('2');

    // Report maintenance issue offline
    await page.click('button:has-text("Report Issue")');
    await page.fill('textarea[name="description"]', 'Mower blade needs sharpening');
    await page.selectOption('select[name="severity"]', 'medium');
    
    // Take photo placeholder
    await page.click('button:has-text("Add Photo")');
    await expect(page.locator('text=Camera unavailable offline')).toBeVisible();
    await page.click('button:has-text("Skip Photo")');
    
    await page.click('button:has-text("Submit Report")');

    // Should queue maintenance report
    await expect(page.locator('[data-testid="sync-queue-badge"]')).toContainText('3');

    // Go back online
    await page.context().setOffline(false);
    
    // Should start syncing automatically
    await expect(page.locator('[data-testid="sync-in-progress"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="sync-status"]')).toContainText('Syncing 3 items');

    // Monitor sync progress
    await expect(page.locator('[data-testid="sync-progress-bar"]')).toBeVisible();
    
    // Wait for sync completion
    await expect(page.locator('[data-testid="sync-complete"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="sync-queue-badge"]')).not.toBeVisible();

    // Verify actions were applied
    await expect(page.locator('[data-testid="job-status"]')).toContainText('In Progress');
    await expect(page.locator('[data-testid="verification-status"]')).toContainText('Verified');
    
    // Success notification
    await expect(page.locator('[role="alert"][data-type="success"]')).toContainText('All offline actions synced');
  });

  test('should handle sync conflicts gracefully', async ({ page }) => {
    await page.goto('/crew');

    // Queue some offline actions
    await page.evaluate(() => {
      const queueAction = async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('jobeye_offline', 1);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });

        const tx = db.transaction(['offline_sync_queue'], 'readwrite');
        const store = tx.objectStore('offline_sync_queue');
        
        // Add conflicting actions
        store.add({
          operation: 'update',
          entity: 'jobs',
          entityId: 'job-123',
          data: { status: 'in_progress', startTime: new Date().toISOString() },
          syncStatus: 'pending',
          timestamp: Date.now() - 10000, // 10 seconds ago
          retryCount: 0
        });

        store.add({
          operation: 'update',
          entity: 'jobs',
          entityId: 'job-123',
          data: { status: 'completed', endTime: new Date().toISOString() },
          syncStatus: 'pending',
          timestamp: Date.now() - 5000, // 5 seconds ago
          retryCount: 0
        });
      };
      queueAction();
    });

    // Mock server rejecting first update (job already started by someone else)
    await page.route('**/api/sync/jobs/job-123', async route => {
      if (route.request().postDataJSON()?.status === 'in_progress') {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Job already started by another user',
            currentStatus: 'in_progress',
            startedBy: 'crew-456'
          })
        });
      } else {
        await route.fulfill({ status: 200 });
      }
    });

    // Trigger sync
    await page.click('button[aria-label="Sync now"]');

    // Should show conflict resolution
    await expect(page.locator('[data-testid="sync-conflict"]')).toBeVisible();
    await expect(page.locator('text=Job already started by another user')).toBeVisible();

    // Should continue with remaining items
    await expect(page.locator('[data-testid="sync-partial-success"]')).toBeVisible();
    await expect(page.locator('text=2 of 3 items synced')).toBeVisible();
  });

  test('should expire old offline data', async ({ page }) => {
    // Add expired cache data
    await page.evaluate(() => {
      const addExpiredData = async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('jobeye_offline', 1);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });

        const tx = db.transaction(['cached_jobs'], 'readwrite');
        const store = tx.objectStore('cached_jobs');
        
        // Add expired job (24 hours old)
        store.add({
          id: 'expired-job',
          data: {
            id: 'expired-job',
            customerName: 'Old Customer',
            scheduledDate: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
          },
          timestamp: Date.now() - 25 * 60 * 60 * 1000,
          expiresAt: Date.now() - 60 * 60 * 1000 // Expired 1 hour ago
        });
      };
      addExpiredData();
    });

    await page.goto('/crew');
    await page.context().setOffline(true);

    // Expired job should not appear
    await expect(page.locator('text=Old Customer')).not.toBeVisible();

    // Should show only valid cached data
    await expect(page.locator('[data-testid="job-card"]')).toHaveCount(1);
    await expect(page.locator('text=Offline Test Customer')).toBeVisible();
  });

  test('should handle failed sync with retry', async ({ page }) => {
    await page.goto('/crew');

    // Add action to queue
    await page.evaluate(() => {
      const queueFailingAction = async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('jobeye_offline', 1);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });

        const tx = db.transaction(['offline_sync_queue'], 'readwrite');
        const store = tx.objectStore('offline_sync_queue');
        
        store.add({
          operation: 'create',
          entity: 'maintenance_reports',
          data: { severity: 'high', description: 'Engine failure' },
          syncStatus: 'pending',
          timestamp: Date.now(),
          retryCount: 0
        });
      };
      queueFailingAction();
    });

    // Mock server errors
    let attemptCount = 0;
    await page.route('**/api/sync/maintenance_reports', async route => {
      attemptCount++;
      if (attemptCount < 3) {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Server error' })
        });
      } else {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'report-123', success: true })
        });
      }
    });

    // Trigger sync
    await page.click('button[aria-label="Sync now"]');

    // Should show retry attempts
    await expect(page.locator('[data-testid="sync-retry"]')).toBeVisible();
    await expect(page.locator('text=Retry 1 of 3')).toBeVisible();

    // Wait for successful retry
    await expect(page.locator('[data-testid="sync-complete"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Sync completed after 2 retries')).toBeVisible();
  });

  test('should prioritize critical items during sync', async ({ page }) => {
    await page.goto('/crew');

    // Queue multiple items with different priorities
    await page.evaluate(() => {
      const queuePrioritizedItems = async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('jobeye_offline', 1);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });

        const tx = db.transaction(['offline_sync_queue'], 'readwrite');
        const store = tx.objectStore('offline_sync_queue');
        
        // Low priority
        store.add({
          operation: 'update',
          entity: 'inventory',
          priority: 'low',
          data: { quantity: 5 },
          syncStatus: 'pending',
          timestamp: Date.now() - 3000
        });

        // Critical priority (safety issue)
        store.add({
          operation: 'create',
          entity: 'maintenance_reports',
          priority: 'critical',
          data: { severity: 'critical', description: 'Safety hazard' },
          syncStatus: 'pending',
          timestamp: Date.now() - 1000
        });

        // Medium priority
        store.add({
          operation: 'update',
          entity: 'jobs',
          priority: 'medium',
          data: { status: 'completed' },
          syncStatus: 'pending',
          timestamp: Date.now() - 2000
        });
      };
      queuePrioritizedItems();
    });

    // Monitor sync order
    let syncOrder: string[] = [];
    await page.route('**/api/sync/**', async route => {
      const url = route.request().url();
      if (url.includes('maintenance_reports')) syncOrder.push('critical');
      else if (url.includes('jobs')) syncOrder.push('medium');
      else if (url.includes('inventory')) syncOrder.push('low');
      
      await route.fulfill({ status: 200 });
    });

    // Trigger sync
    await page.click('button[aria-label="Sync now"]');

    // Wait for completion
    await expect(page.locator('[data-testid="sync-complete"]')).toBeVisible({ timeout: 10000 });

    // Verify priority order
    expect(syncOrder[0]).toBe('critical');
    expect(syncOrder[1]).toBe('medium');
    expect(syncOrder[2]).toBe('low');
  });

  test('should show offline capabilities clearly', async ({ page }) => {
    await page.goto('/crew');
    
    // Check offline capabilities info
    await page.click('button[aria-label="Offline info"]');
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('h2')).toContainText('Offline Capabilities');

    // Should list what works offline
    await expect(page.locator('text=View assigned jobs')).toBeVisible();
    await expect(page.locator('text=Manual equipment checks')).toBeVisible();
    await expect(page.locator('text=Basic job updates')).toBeVisible();
    
    // Should list what doesn't work offline
    await expect(page.locator('text=AI vision verification')).toBeVisible();
    await expect(page.locator('text=Voice commands')).toBeVisible();
    await expect(page.locator('text=Real-time notifications')).toBeVisible();

    // Close dialog
    await page.click('button[aria-label="Close"]');

    // Go offline and verify UI changes
    await page.context().setOffline(true);

    // Disabled features should be clearly marked
    await expect(page.locator('[data-testid="camera-button"][disabled]')).toBeVisible();
    await expect(page.locator('[data-testid="voice-button"][disabled]')).toBeVisible();
    
    // Tooltips should explain why
    await page.hover('[data-testid="camera-button"]');
    await expect(page.locator('[role="tooltip"]')).toContainText('Not available offline');
  });

  test('should maintain data integrity during offline/online transitions', async ({ page }) => {
    await page.goto('/crew/jobs/job-offline-1');
    
    // Make changes while online
    await page.click('button:has-text("Start Job")');
    await expect(page.locator('[data-testid="job-status"]')).toContainText('In Progress');

    // Go offline immediately
    await page.context().setOffline(true);

    // Continue working offline
    await page.click('button:has-text("Add Note")');
    await page.fill('textarea[name="note"]', 'Started mowing front lawn');
    await page.click('button:has-text("Save Note")');

    // Go online
    await page.context().setOffline(false);

    // Both changes should be preserved and synced
    await expect(page.locator('[data-testid="sync-in-progress"]')).toBeVisible();
    await expect(page.locator('[data-testid="sync-complete"]')).toBeVisible({ timeout: 10000 });

    // Verify all data is intact
    await page.reload();
    await expect(page.locator('[data-testid="job-status"]')).toContainText('In Progress');
    await expect(page.locator('[data-testid="job-note"]')).toContainText('Started mowing front lawn');
  });
});