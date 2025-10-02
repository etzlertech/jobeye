#!/usr/bin/env npx tsx

import * as pw from 'playwright-core';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testBrowserCat() {
  const apiKey = process.env.BROWSERCAT_API_KEY;
  
  if (!apiKey) {
    console.error('❌ BROWSERCAT_API_KEY not found in environment');
    return;
  }

  console.log('🔑 API Key found:', apiKey.substring(0, 10) + '...');
  
  try {
    console.log('🌐 Connecting to BrowserCat...');
    const bcatUrl = 'wss://api.browsercat.com/connect';
    
    const browser = await pw.chromium.connect(bcatUrl, {
      headers: { 'Api-Key': apiKey },
    });

    console.log('✅ Connected to BrowserCat successfully');

    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('📄 Navigating to test page...');
    await page.goto('https://example.com');
    
    const title = await page.title();
    console.log('📋 Page title:', title);

    await browser.close();
    console.log('✅ Test completed successfully');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testBrowserCat();