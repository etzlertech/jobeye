#!/usr/bin/env npx tsx

import * as pw from 'playwright-core';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testBrowserCatCorrectly() {
  const apiKey = process.env.BROWSERCAT_API_KEY;
  
  if (!apiKey) {
    console.error('❌ BROWSERCAT_API_KEY not found');
    return;
  }

  console.log('🔧 Testing BrowserCat with correct API usage...\n');

  // Test 1: Basic connection with no extra options
  console.log('🧪 Test 1: Basic connection...');
  try {
    const browser = await pw.chromium.connect('wss://api.browsercat.com/connect', {
      headers: { 'Api-Key': apiKey },
      timeout: 30000,
    });
    
    console.log('✅ Basic connection successful!');
    
    // Test actual supervisor page
    const page = await browser.newPage();
    console.log('📄 Navigating to supervisor page...');
    
    await page.goto('https://jobeye-production.up.railway.app/supervisor', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    const title = await page.title();
    const url = page.url();
    console.log('📋 Page title:', title);
    console.log('🔗 Final URL:', url);
    
    // Take screenshot
    const outputDir = 'ui-review-output/browsercat-supervisor';
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
    
    const screenshotPath = join(outputDir, 'supervisor-page.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('📸 Screenshot saved:', screenshotPath);
    
    // Check page content
    const bodyText = await page.locator('body').textContent();
    console.log('📝 Page content preview:', bodyText?.substring(0, 200) + '...');
    
    await browser.close();
    console.log('✅ BrowserCat test completed successfully!');
    return;
    
  } catch (error) {
    console.log('❌ Basic connection failed:', error.message);
  }

  // Test 2: With valid region codes from API docs
  console.log('\n🧪 Test 2: Using correct region codes...');
  const validRegions = ['iad', 'ewr', 'dfw', 'sjc']; // US regions from API docs
  
  for (const region of validRegions) {
    try {
      console.log(`  Testing region: ${region}`);
      const browser = await pw.chromium.connect(`wss://api.browsercat.com/connect?region=${region}`, {
        headers: { 'Api-Key': apiKey },
        timeout: 20000,
      });
      
      console.log(`✅ Connected to region: ${region}`);
      await browser.close();
      return; // Success
      
    } catch (error) {
      console.log(`  ❌ Region ${region} failed:`, error.message);
    }
  }

  // Test 3: With browser type specification
  console.log('\n🧪 Test 3: Specifying browser type...');
  try {
    const browser = await pw.chromium.connect(`wss://api.browsercat.com/connect?browser=chromium`, {
      headers: { 'Api-Key': apiKey },
      timeout: 25000,
    });
    
    console.log('✅ Connected with browser=chromium');
    await browser.close();
    return;
    
  } catch (error) {
    console.log('❌ Browser type specification failed:', error.message);
  }

  console.log('\n❌ All BrowserCat connection attempts failed');
  console.log('\n💡 WSL1 Networking Issue Solutions:');
  console.log('1. **BEST**: Run from Windows PowerShell/CMD instead of WSL');
  console.log('2. Upgrade to WSL2: wsl --set-version Ubuntu 2');
  console.log('3. Use Windows host networking environment variables');
  console.log('4. Consider using local Playwright as fallback');
}

testBrowserCatCorrectly();