#!/usr/bin/env npx tsx

import * as pw from 'playwright-core';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function debugBrowserCatConnection() {
  const apiKey = process.env.BROWSERCAT_API_KEY;
  
  if (!apiKey) {
    console.error('❌ BROWSERCAT_API_KEY not found');
    return;
  }

  console.log('🔑 API Key:', apiKey.substring(0, 20) + '...');
  
  // Test 1: Try different connection timeout settings
  console.log('\n🧪 Test 1: Connection with custom timeout...');
  try {
    const browser = await pw.chromium.connect('wss://api.browsercat.com/connect', {
      headers: { 'Api-Key': apiKey },
      timeout: 30000, // 30 second timeout
    });
    
    console.log('✅ Connected successfully!');
    await browser.close();
    
  } catch (error) {
    console.log('❌ Connection failed:', error.message);
  }

  // Test 2: Try with different headers format
  console.log('\n🧪 Test 2: Different header format...');
  try {
    const browser = await pw.chromium.connect('wss://api.browsercat.com/connect', {
      headers: { 
        'Api-Key': apiKey,
        'User-Agent': 'Playwright/1.55.1'
      },
      timeout: 15000,
    });
    
    console.log('✅ Connected with custom headers!');
    await browser.close();
    
  } catch (error) {
    console.log('❌ Custom headers failed:', error.message);
  }

  // Test 3: Test basic network connectivity
  console.log('\n🧪 Test 3: Testing network connectivity...');
  try {
    const response = await fetch('https://api.browsercat.com/health');
    console.log('🌐 BrowserCat API response:', response.status);
  } catch (error) {
    console.log('❌ Network test failed:', error.message);
  }

  // Test 4: Try with explicit browser path
  console.log('\n🧪 Test 4: Local browser test for comparison...');
  try {
    const browser = await pw.chromium.launch({ 
      headless: true,
      timeout: 10000
    });
    console.log('✅ Local browser works fine');
    await browser.close();
  } catch (error) {
    console.log('❌ Local browser failed:', error.message);
  }

  // Test 5: Check if it's a WSL networking issue
  console.log('\n🧪 Test 5: WSL networking check...');
  console.log('Environment:', process.platform);
  console.log('Node version:', process.version);
  
  // Check if we're in WSL
  try {
    const { execSync } = require('child_process');
    const result = execSync('uname -r', { encoding: 'utf8' });
    if (result.includes('microsoft') || result.includes('WSL')) {
      console.log('🐧 Running in WSL environment - this might affect websocket connections');
    }
  } catch (e) {
    // Not a big deal if this fails
  }
}

debugBrowserCatConnection();