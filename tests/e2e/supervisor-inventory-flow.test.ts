/**
 * @file /tests/e2e/supervisor-inventory-flow.test.ts
 * @purpose Integration test for supervisor adding inventory through camera
 * @phase 3
 * @domain E2E Testing
 * @complexity_budget 250
 * @test_coverage 100%
 */

import { test, expect } from '@playwright/test';

test.describe('Supervisor Inventory Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.addInitScript(() => {
      localStorage.setItem('auth-token', 'mock-supervisor-token');
      localStorage.setItem('user-role', 'supervisor');
    });
  });

  test('should add new inventory item via camera intent recognition', async ({ page }) => {
    // Navigate to supervisor dashboard
    await page.goto('/supervisor');
    await expect(page).toHaveTitle(/Supervisor Dashboard/);

    // Click on inventory management
    await page.click('text=Manage Inventory');
    await expect(page).toHaveURL('/supervisor/inventory');

    // Click camera button to add new item
    await page.click('button[aria-label="Add item with camera"]');
    
    // Mock camera permissions
    await page.context().grantPermissions(['camera']);

    // Wait for camera to initialize
    await expect(page.locator('video')).toBeVisible({ timeout: 5000 });

    // Simulate taking a photo
    await page.evaluate(() => {
      // Mock camera capture
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d')!;
      
      // Draw a simple representation of a tool
      ctx.fillStyle = '#666';
      ctx.fillRect(100, 100, 200, 50);
      ctx.fillStyle = '#333';
      ctx.fillRect(300, 100, 100, 50);
      
      // Trigger capture event
      canvas.toBlob((blob) => {
        if (blob) {
          window.dispatchEvent(new CustomEvent('camera-capture', {
            detail: { blob, imageUrl: URL.createObjectURL(blob) }
          }));
        }
      }, 'image/jpeg', 0.9);
    });

    // Wait for intent recognition
    await expect(page.locator('[data-testid="intent-result"]')).toContainText('inventory_add', { timeout: 3000 });

    // Verify add inventory form appears
    await expect(page.locator('h2')).toContainText('Add New Inventory Item');
    
    // Fill in item details
    await page.fill('input[name="name"]', 'DeWalt Power Drill');
    await page.selectOption('select[name="category"]', 'power-tools');
    
    // Select container (optional)
    await page.click('button[aria-label="Select container"]');
    await page.click('text=Truck 1 - Tool Box');

    // Submit form
    await page.click('button[type="submit"]');

    // Verify success message
    await expect(page.locator('[role="alert"]')).toContainText('Item added successfully');

    // Verify item appears in inventory list
    await expect(page.locator('[data-testid="inventory-item"]')).toContainText('DeWalt Power Drill');
    
    // Verify thumbnail was generated
    const thumbnail = page.locator('[data-testid="inventory-item"] img');
    await expect(thumbnail).toHaveAttribute('src', /512x512/);
  });

  test('should handle camera permission denial gracefully', async ({ page }) => {
    await page.goto('/supervisor/inventory');

    // Deny camera permissions
    await page.context().clearPermissions();

    // Try to add item with camera
    await page.click('button[aria-label="Add item with camera"]');

    // Should show permission request message
    await expect(page.locator('.camera-permission-denied')).toBeVisible();
    await expect(page.locator('text=Camera access is required')).toBeVisible();

    // Should offer manual entry option
    await page.click('text=Add Manually Instead');
    await expect(page).toHaveURL('/supervisor/inventory/add');
  });

  test('should detect and prevent duplicate inventory items', async ({ page }) => {
    await page.goto('/supervisor/inventory');

    // Mock existing inventory
    await page.evaluate(() => {
      window.localStorage.setItem('mock-inventory', JSON.stringify([
        { id: '1', name: 'Lawn Mower', category: 'equipment' }
      ]));
    });

    // Simulate camera capture of existing item
    await page.click('button[aria-label="Add item with camera"]');
    await page.context().grantPermissions(['camera']);

    // Mock capturing image of lawn mower
    await page.evaluate(() => {
      // Simulate VLM response detecting lawn mower
      window.dispatchEvent(new CustomEvent('vlm-response', {
        detail: {
          intent: 'inventory_add',
          detectedItems: ['lawn mower'],
          confidence: 0.95
        }
      }));
    });

    // Should show duplicate warning
    await expect(page.locator('[role="alert"][data-type="warning"]')).toContainText('Similar item already in inventory');
    await expect(page.locator('text=Lawn Mower')).toBeVisible();

    // Should offer to add anyway or cancel
    await expect(page.locator('button:has-text("Add Anyway")')).toBeVisible();
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
  });

  test('should update inventory count via voice command', async ({ page }) => {
    await page.goto('/supervisor/inventory');

    // Grant microphone permission for voice
    await page.context().grantPermissions(['microphone']);

    // Click voice command button
    await page.click('button[aria-label="Voice command"]');

    // Mock speech recognition
    await page.evaluate(() => {
      // Simulate STT result
      window.dispatchEvent(new CustomEvent('speech-recognized', {
        detail: {
          transcript: 'Add 5 more leaf blowers to inventory',
          confidence: 0.92
        }
      }));
    });

    // Wait for voice processing
    await expect(page.locator('[data-testid="voice-processing"]')).toBeVisible();

    // Verify intent understood
    await expect(page.locator('[data-testid="voice-intent"]')).toContainText('update_inventory_quantity');

    // Should show confirmation dialog
    await expect(page.locator('[role="dialog"]')).toContainText('Add 5 leaf blowers?');
    
    // Confirm action
    await page.click('button:has-text("Confirm")');

    // Verify quantity updated
    await expect(page.locator('[data-testid="item-leaf-blower"] .quantity')).toContainText('8'); // Was 3, now 8
  });

  test('should handle offline mode for inventory viewing', async ({ page }) => {
    // Pre-populate offline cache
    await page.evaluate(() => {
      const mockInventory = [
        {
          id: '1',
          name: 'Chainsaw',
          category: 'equipment',
          thumbnailUrl: '/images/chainsaw-512x512.jpg',
          quantity: 2
        },
        {
          id: '2',
          name: 'Safety Helmet',
          category: 'safety',
          thumbnailUrl: '/images/helmet-512x512.jpg',
          quantity: 10
        }
      ];
      
      // Store in IndexedDB
      const request = indexedDB.open('jobeye_offline', 1);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(['cached_inventory'], 'readwrite');
        const store = tx.objectStore('cached_inventory');
        mockInventory.forEach(item => {
          store.put({
            id: item.id,
            data: item,
            timestamp: Date.now()
          });
        });
      };
    });

    // Simulate offline mode
    await page.context().setOffline(true);

    // Navigate to inventory
    await page.goto('/supervisor/inventory');

    // Should show offline indicator
    await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();

    // Should still display cached inventory
    await expect(page.locator('[data-testid="inventory-item"]')).toHaveCount(2);
    await expect(page.locator('text=Chainsaw')).toBeVisible();
    await expect(page.locator('text=Safety Helmet')).toBeVisible();

    // Camera features should be disabled
    await expect(page.locator('button[aria-label="Add item with camera"]')).toBeDisabled();
    
    // Should show offline message
    await expect(page.locator('text=Camera features unavailable offline')).toBeVisible();
  });

  test('should enforce 4-button limit on inventory screens', async ({ page }) => {
    await page.goto('/supervisor/inventory');

    // Count visible action buttons
    const actionButtons = page.locator('button[data-action]');
    await expect(actionButtons).toHaveCount(4);

    // Verify primary actions are visible
    await expect(page.locator('button:has-text("Add Item")')).toBeVisible();
    await expect(page.locator('button:has-text("Search")')).toBeVisible();
    await expect(page.locator('button[aria-label="Voice command"]')).toBeVisible();
    await expect(page.locator('button:has-text("More")')).toBeVisible();

    // Click "More" to see additional actions
    await page.click('button:has-text("More")');
    
    // Should show dropdown with additional actions
    await expect(page.locator('[role="menu"]')).toBeVisible();
    await expect(page.locator('[role="menuitem"]:has-text("Export")')).toBeVisible();
    await expect(page.locator('[role="menuitem"]:has-text("Categories")')).toBeVisible();
  });
});