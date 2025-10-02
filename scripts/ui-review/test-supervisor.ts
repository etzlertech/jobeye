#!/usr/bin/env npx tsx

import * as pw from 'playwright-core';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

async function testSupervisorPage() {
  const outputDir = 'ui-review-output/supervisor-test';
  
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const consoleLogs: Array<{ type: string; text: string; timestamp: number }> = [];
  const networkRequests: Array<{ url: string; method: string; status?: number }> = [];
  let pageError: string | null = null;

  try {
    console.log('🌐 Testing Supervisor page...');
    
    const browser = await pw.chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();

    // Set up console logging
    page.on('console', (msg) => {
      consoleLogs.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now()
      });
      
      if (msg.type() === 'error') {
        console.log(`🔴 Console Error: ${msg.text()}`);
      }
    });

    // Set up network monitoring
    page.on('request', (req) => {
      networkRequests.push({
        url: req.url(),
        method: req.method()
      });
    });

    page.on('response', (res) => {
      const req = networkRequests.find(r => r.url === res.url());
      if (req) {
        req.status = res.status();
        if (res.status() >= 400) {
          console.log(`🔴 Network Error: ${req.method} ${res.url()} - ${res.status()}`);
        }
      }
    });

    // Set up page error handling
    page.on('pageerror', (error) => {
      pageError = error.message;
      console.log(`🔴 Page Error: ${error.message}`);
    });

    console.log('📄 Navigating to supervisor page...');
    await page.goto('https://jobeye-production.up.railway.app/supervisor', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    const title = await page.title();
    const url = page.url();
    console.log('📋 Page title:', title);
    console.log('🔗 Final URL:', url);

    // Check if redirected
    if (url !== 'https://jobeye-production.up.railway.app/supervisor') {
      console.log('🔄 Page was redirected to:', url);
    }

    // Wait a bit for any dynamic content to load
    await page.waitForTimeout(3000);

    // Take desktop screenshot
    const desktopScreenshot = join(outputDir, 'supervisor-desktop.png');
    await page.screenshot({ path: desktopScreenshot, fullPage: true });
    console.log('📸 Desktop screenshot saved:', desktopScreenshot);

    // Take mobile screenshot
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    const mobileScreenshot = join(outputDir, 'supervisor-mobile.png');
    await page.screenshot({ path: mobileScreenshot, fullPage: true });
    console.log('📱 Mobile screenshot saved:', mobileScreenshot);

    // Check for specific elements
    const elements = {
      nav: await page.locator('nav').count(),
      mainContent: await page.locator('main').count(),
      buttons: await page.locator('button').count(),
      forms: await page.locator('form').count(),
      loginForm: await page.locator('[data-testid="login-form"]').count(),
      supervisorDashboard: await page.locator('[data-testid="supervisor-dashboard"]').count(),
    };

    console.log('🔍 Element analysis:');
    Object.entries(elements).forEach(([key, count]) => {
      console.log(`  ${key}: ${count}`);
    });

    // Try to get page content for analysis
    const bodyText = await page.locator('body').textContent();
    const hasAuthMessage = bodyText?.includes('login') || bodyText?.includes('sign in') || bodyText?.includes('authenticate');
    
    if (hasAuthMessage) {
      console.log('🔐 Authentication flow detected');
    }

    await browser.close();

    // Generate report
    const report = {
      timestamp: new Date().toISOString(),
      url: 'https://jobeye-production.up.railway.app/supervisor',
      finalUrl: url,
      title,
      redirected: url !== 'https://jobeye-production.up.railway.app/supervisor',
      elements,
      authenticationDetected: hasAuthMessage,
      consoleLogs: consoleLogs.length,
      errorLogs: consoleLogs.filter(log => log.type === 'error').length,
      networkRequests: networkRequests.length,
      failedRequests: networkRequests.filter(req => req.status && req.status >= 400).length,
      pageError,
      screenshots: {
        desktop: desktopScreenshot,
        mobile: mobileScreenshot
      }
    };

    // Save detailed report
    writeFileSync(
      join(outputDir, 'analysis.json'), 
      JSON.stringify(report, null, 2)
    );

    // Save console logs
    if (consoleLogs.length > 0) {
      writeFileSync(
        join(outputDir, 'console-logs.txt'),
        consoleLogs.map(log => `[${log.type}] ${log.text}`).join('\n')
      );
    }

    // Save network requests
    writeFileSync(
      join(outputDir, 'network-requests.txt'),
      networkRequests.map(req => `${req.method} ${req.url} ${req.status || 'pending'}`).join('\n')
    );

    console.log('\n📊 Summary:');
    console.log(`✅ Page loaded successfully`);
    console.log(`📋 Title: ${title}`);
    console.log(`🔗 Final URL: ${url}`);
    console.log(`📝 Console logs: ${consoleLogs.length} (${consoleLogs.filter(l => l.type === 'error').length} errors)`);
    console.log(`🌐 Network requests: ${networkRequests.length} (${networkRequests.filter(r => r.status && r.status >= 400).length} failed)`);
    console.log(`📸 Screenshots saved to: ${outputDir}`);

    if (pageError) {
      console.log(`❌ Page error: ${pageError}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testSupervisorPage();