#!/usr/bin/env npx tsx

import * as pw from 'playwright-core';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testBrowserCatWSLFixes() {
  const apiKey = process.env.BROWSERCAT_API_KEY;
  
  if (!apiKey) {
    console.error('❌ BROWSERCAT_API_KEY not found');
    return;
  }

  console.log('🔧 Testing BrowserCat WSL fixes...\n');

  // Fix 1: Try with browser configuration headers
  console.log('🧪 Fix 1: Using BrowserCat-Opts header...');
  try {
    const browser = await pw.chromium.connect('wss://api.browsercat.com/connect', {
      headers: { 
        'Api-Key': apiKey,
        'BrowserCat-Opts': JSON.stringify({
          region: 'us-east',
          headless: true,
          timeout: 60000
        })
      },
      timeout: 60000,
    });
    
    console.log('✅ Fix 1 worked! Connected with BrowserCat-Opts');
    
    const page = await browser.newPage();
    await page.goto('https://jobeye-production.up.railway.app/supervisor');
    const title = await page.title();
    console.log('📋 Page title:', title);
    
    await browser.close();
    return; // Success, no need to try other fixes
    
  } catch (error) {
    console.log('❌ Fix 1 failed:', error.message);
  }

  // Fix 2: Try different regions
  console.log('\n🧪 Fix 2: Trying different regions...');
  const regions = ['us-west', 'eu-west', 'ap-southeast'];
  
  for (const region of regions) {
    try {
      console.log(`  Testing region: ${region}`);
      const browser = await pw.chromium.connect('wss://api.browsercat.com/connect', {
        headers: { 
          'Api-Key': apiKey,
          'BrowserCat-Opts': JSON.stringify({ region })
        },
        timeout: 30000,
      });
      
      console.log(`✅ Fix 2 worked! Connected to region: ${region}`);
      await browser.close();
      return; // Success
      
    } catch (error) {
      console.log(`  ❌ Region ${region} failed:`, error.message);
    }
  }

  // Fix 3: Try with proxy configuration for WSL
  console.log('\n🧪 Fix 3: Using exposeNetwork for WSL...');
  try {
    const browser = await pw.chromium.connect('wss://api.browsercat.com/connect', {
      headers: { 
        'Api-Key': apiKey,
        'BrowserCat-Opts': JSON.stringify({
          exposeNetwork: '<loopback>',
          headless: true
        })
      },
      timeout: 45000,
    });
    
    console.log('✅ Fix 3 worked! Connected with exposeNetwork');
    await browser.close();
    return;
    
  } catch (error) {
    console.log('❌ Fix 3 failed:', error.message);
  }

  // Fix 4: Try puppeteer instead of playwright
  console.log('\n🧪 Fix 4: Testing if it\'s a Playwright-specific issue...');
  try {
    // Test with raw WebSocket connection approach
    const WebSocket = require('ws');
    const ws = new WebSocket('wss://api.browsercat.com/connect', {
      headers: { 'Api-Key': apiKey },
      timeout: 30000
    });
    
    await new Promise((resolve, reject) => {
      ws.on('open', () => {
        console.log('✅ Fix 4 worked! Raw WebSocket connection successful');
        ws.close();
        resolve(true);
      });
      
      ws.on('error', (error) => {
        console.log('❌ Fix 4 failed:', error.message);
        reject(error);
      });
      
      setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket timeout'));
      }, 30000);
    });
    
    return;
    
  } catch (error) {
    console.log('❌ Fix 4 failed:', error.message);
  }

  // Fix 5: Try Windows host networking
  console.log('\n🧪 Fix 5: WSL networking troubleshooting...');
  try {
    const { execSync } = require('child_process');
    
    // Check WSL version
    const wslVersion = execSync('wsl --version 2>/dev/null || echo "WSL1"', { encoding: 'utf8' });
    console.log('WSL Version:', wslVersion.trim());
    
    // Check if we can reach the WebSocket endpoint
    const curlTest = execSync('curl -I --max-time 10 https://api.browsercat.com/health 2>/dev/null || echo "FAILED"', { encoding: 'utf8' });
    console.log('HTTPS connectivity:', curlTest.includes('200') ? 'OK' : 'FAILED');
    
    // Suggest Windows host approach
    console.log('\n💡 Suggested WSL fixes:');
    console.log('1. Try running from Windows PowerShell instead of WSL');
    console.log('2. Use Windows host networking: set NODE_OPTIONS="--dns-result-order=ipv4first"');
    console.log('3. Check Windows firewall/antivirus blocking WebSocket connections');
    console.log('4. Try connecting from a different network');
    
  } catch (error) {
    console.log('WSL diagnostics failed:', error.message);
  }

  console.log('\n❌ All BrowserCat connection attempts failed');
  console.log('💡 Recommendations:');
  console.log('1. Run this script from Windows Command Prompt or PowerShell');
  console.log('2. Check if corporate firewall is blocking WebSocket connections');
  console.log('3. Try from a different network (mobile hotspot)');
  console.log('4. Contact BrowserCat support with your connection logs');
}

testBrowserCatWSLFixes();