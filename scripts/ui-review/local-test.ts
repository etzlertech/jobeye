#!/usr/bin/env npx tsx

import * as pw from 'playwright-core';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

async function testLocalPlaywright() {
  const outputDir = 'ui-review-output';
  
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  try {
    console.log('🌐 Testing local Playwright...');
    
    // Try to launch local browser first
    const browser = await pw.chromium.launch({ headless: true });
    console.log('✅ Local browser launched successfully');

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();

    console.log('📄 Testing Railway URL...');
    await page.goto('https://jobeye-production.up.railway.app', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    const title = await page.title();
    console.log('📋 Page title:', title);

    // Take screenshot
    const screenshotPath = join(outputDir, 'railway-test.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('📸 Screenshot saved:', screenshotPath);

    // Check for errors in console
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleLogs.push(msg.text());
      }
    });

    // Navigate around a bit
    await page.waitForTimeout(2000);
    
    if (consoleLogs.length > 0) {
      console.log('⚠️  Console errors found:');
      consoleLogs.forEach(log => console.log('  ', log));
    } else {
      console.log('✅ No console errors detected');
    }

    await browser.close();
    console.log('✅ Local test completed successfully');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testLocalPlaywright();