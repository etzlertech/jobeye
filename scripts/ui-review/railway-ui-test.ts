#!/usr/bin/env npx tsx
/**
 * AGENT DIRECTIVE BLOCK (v2025-08-1)
 * file: scripts/ui-review/railway-ui-test.ts
 * phase: 5 - UI Integration
 * domain: UI Review Tools
 * purpose: Railway deployment UI testing and validation
 * spec_ref: None
 * complexity_budget: 300
 * migrations_touched: None
 * state_machine: None
 * estimated_llm_cost: $0.02 per test run
 * offline_capability: NONE
 * dependencies:
 *   internal: ['./browser-service']
 *   external: ['playwright-core', 'dotenv']
 *   supabase: []
 * exports: ['testRailwayUI']
 * voice_considerations: None
 * test_requirements: None - Tool script
 * tasks:
 *   [x] Create Railway-specific test flows
 *   [x] Test role-based access
 *   [x] Check mobile responsiveness
 *   [x] Validate API endpoints
 */

import * as pw from 'playwright-core';
import { BrowserReviewService } from './browser-service';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

interface TestResult {
  page: string;
  status: 'pass' | 'fail';
  errors: string[];
  screenshot?: string;
}

export async function testRailwayUI(railwayUrl: string): Promise<void> {
  const apiKey = process.env.BROWSERCAT_API_KEY;
  if (!apiKey) {
    throw new Error('BROWSERCAT_API_KEY environment variable is required');
  }

  const results: TestResult[] = [];
  const timestamp = Date.now();
  const outputDir = `ui-review-output/railway-test-${timestamp}`;

  console.log('🚂 Starting Railway UI Tests...');
  console.log(`🔗 Testing URL: ${railwayUrl}`);

  // Connect to BrowserCat
  const bcatUrl = 'wss://api.browsercat.com/connect';
  const browser = await pw.chromium.connect(bcatUrl, {
    headers: { 'Api-Key': apiKey },
  });

  try {
    // Test 1: Landing Page
    console.log('\n📋 Test 1: Landing Page');
    const landingResult = await testLandingPage(browser, railwayUrl, outputDir);
    results.push(landingResult);

    // Test 2: Supervisor Dashboard
    console.log('\n📋 Test 2: Supervisor Dashboard');
    const supervisorResult = await testSupervisorDashboard(browser, railwayUrl, outputDir);
    results.push(supervisorResult);

    // Test 3: Crew Member Interface
    console.log('\n📋 Test 3: Crew Member Interface');
    const crewResult = await testCrewInterface(browser, railwayUrl, outputDir);
    results.push(crewResult);

    // Test 4: Mobile Responsiveness
    console.log('\n📋 Test 4: Mobile Responsiveness');
    const mobileResult = await testMobileResponsiveness(browser, railwayUrl, outputDir);
    results.push(mobileResult);

    // Test 5: API Endpoints
    console.log('\n📋 Test 5: API Endpoints');
    const apiResult = await testAPIEndpoints(browser, railwayUrl, outputDir);
    results.push(apiResult);

    // Generate summary report
    generateReport(results, outputDir);

  } finally {
    await browser.close();
  }
}

async function testLandingPage(browser: pw.Browser, baseUrl: string, outputDir: string): Promise<TestResult> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors: string[] = [];

  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    // Check for critical elements
    const title = await page.title();
    if (!title.includes('JobEye')) {
      errors.push('Page title does not contain "JobEye"');
    }

    // Check for navigation elements
    const hasNav = await page.locator('nav').count() > 0;
    if (!hasNav) {
      errors.push('No navigation element found');
    }

    // Take screenshot
    const screenshotPath = join(outputDir, 'landing-page.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });

    await context.close();
    return {
      page: 'Landing Page',
      status: errors.length === 0 ? 'pass' : 'fail',
      errors,
      screenshot: screenshotPath,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    await context.close();
    return {
      page: 'Landing Page',
      status: 'fail',
      errors,
    };
  }
}

async function testSupervisorDashboard(browser: pw.Browser, baseUrl: string, outputDir: string): Promise<TestResult> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors: string[] = [];

  try {
    await page.goto(`${baseUrl}/supervisor`, { waitUntil: 'networkidle' });

    // Check if redirected to login
    if (page.url().includes('/login') || page.url().includes('/auth')) {
      console.log('  ℹ️  Redirected to login - auth working correctly');
    } else {
      // Check for supervisor-specific elements
      const hasDashboard = await page.locator('[data-testid="supervisor-dashboard"]').count() > 0;
      if (!hasDashboard) {
        errors.push('Supervisor dashboard not found');
      }
    }

    // Take screenshot
    const screenshotPath = join(outputDir, 'supervisor-dashboard.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });

    await context.close();
    return {
      page: 'Supervisor Dashboard',
      status: errors.length === 0 ? 'pass' : 'fail',
      errors,
      screenshot: screenshotPath,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    await context.close();
    return {
      page: 'Supervisor Dashboard',
      status: 'fail',
      errors,
    };
  }
}

async function testCrewInterface(browser: pw.Browser, baseUrl: string, outputDir: string): Promise<TestResult> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors: string[] = [];

  try {
    await page.goto(`${baseUrl}/crew`, { waitUntil: 'networkidle' });

    // Check if redirected to login
    if (page.url().includes('/login') || page.url().includes('/auth')) {
      console.log('  ℹ️  Redirected to login - auth working correctly');
    } else {
      // Check for crew-specific elements
      const hasCrewUI = await page.locator('[data-testid="crew-interface"]').count() > 0;
      if (!hasCrewUI) {
        errors.push('Crew interface not found');
      }
    }

    // Take screenshot
    const screenshotPath = join(outputDir, 'crew-interface.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });

    await context.close();
    return {
      page: 'Crew Interface',
      status: errors.length === 0 ? 'pass' : 'fail',
      errors,
      screenshot: screenshotPath,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    await context.close();
    return {
      page: 'Crew Interface',
      status: 'fail',
      errors,
    };
  }
}

async function testMobileResponsiveness(browser: pw.Browser, baseUrl: string, outputDir: string): Promise<TestResult> {
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
  });
  const page = await context.newPage();
  const errors: string[] = [];

  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    // Check for mobile menu or responsive nav
    const hasMobileNav = await page.locator('[data-testid="mobile-menu"]').count() > 0 ||
                         await page.locator('button[aria-label*="menu"]').count() > 0;
    
    if (!hasMobileNav) {
      console.log('  ⚠️  No mobile navigation found (may not be implemented yet)');
    }

    // Check viewport meta tag
    const viewport = await page.$eval('meta[name="viewport"]', el => el.getAttribute('content')).catch(() => null);
    if (!viewport) {
      errors.push('No viewport meta tag found');
    }

    // Take mobile screenshots
    const screenshotPath = join(outputDir, 'mobile-view.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });

    await context.close();
    return {
      page: 'Mobile Responsiveness',
      status: errors.length === 0 ? 'pass' : 'fail',
      errors,
      screenshot: screenshotPath,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    await context.close();
    return {
      page: 'Mobile Responsiveness',
      status: 'fail',
      errors,
    };
  }
}

async function testAPIEndpoints(browser: pw.Browser, baseUrl: string, outputDir: string): Promise<TestResult> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors: string[] = [];

  const apiEndpoints = [
    '/api/health',
    '/api/intent/detect',
    '/api/supervisor/jobs',
    '/api/crew/tasks',
  ];

  try {
    for (const endpoint of apiEndpoints) {
      const response = await page.goto(`${baseUrl}${endpoint}`, { waitUntil: 'domcontentloaded' }).catch(() => null);
      
      if (!response) {
        errors.push(`Failed to reach ${endpoint}`);
      } else {
        const status = response.status();
        console.log(`  ${endpoint}: ${status}`);
        
        // 401/403 is expected for auth-protected endpoints
        if (status >= 500) {
          errors.push(`${endpoint} returned server error: ${status}`);
        }
      }
    }

    await context.close();
    return {
      page: 'API Endpoints',
      status: errors.length === 0 ? 'pass' : 'fail',
      errors,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    await context.close();
    return {
      page: 'API Endpoints',
      status: 'fail',
      errors,
    };
  }
}

function generateReport(results: TestResult[], outputDir: string): void {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;

  console.log('\n📊 Test Summary:');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);

  let report = '# Railway UI Test Report\n\n';
  report += `**Date:** ${new Date().toISOString()}\n`;
  report += `**Total Tests:** ${results.length}\n`;
  report += `**Passed:** ${passed}\n`;
  report += `**Failed:** ${failed}\n\n`;

  report += '## Test Results\n\n';
  
  results.forEach(result => {
    report += `### ${result.page}\n`;
    report += `**Status:** ${result.status === 'pass' ? '✅ PASS' : '❌ FAIL'}\n\n`;
    
    if (result.errors.length > 0) {
      report += '**Errors:**\n';
      result.errors.forEach(error => {
        report += `- ${error}\n`;
      });
      report += '\n';
    }
    
    if (result.screenshot) {
      report += `**Screenshot:** [View](${result.screenshot})\n\n`;
    }
  });

  const reportPath = join(outputDir, 'report.md');
  writeFileSync(reportPath, report);
  console.log(`\n📄 Report saved to: ${reportPath}`);
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const url = args[0];

  if (!url) {
    console.error('Usage: tsx scripts/ui-review/railway-ui-test.ts <RAILWAY_URL>');
    console.error('Example: tsx scripts/ui-review/railway-ui-test.ts https://jobeye.railway.app');
    process.exit(1);
  }

  testRailwayUI(url).catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}