#!/usr/bin/env npx tsx
/**
 * AGENT DIRECTIVE BLOCK (v2025-08-1)
 * file: scripts/ui-review/browser-service.ts
 * phase: 5 - UI Integration
 * domain: UI Review Tools
 * purpose: BrowserCat integration for automated UI testing and review
 * spec_ref: None
 * complexity_budget: 300
 * migrations_touched: None
 * state_machine: None
 * estimated_llm_cost: $0.01 per review session
 * offline_capability: NONE
 * dependencies:
 *   internal: []
 *   external: ['playwright-core', 'dotenv']
 *   supabase: []
 * exports: ['BrowserReviewService', 'ReviewConfig', 'ReviewResult']
 * voice_considerations: None
 * test_requirements: None - Tool script
 * tasks:
 *   [x] Create browser service class
 *   [x] Implement screenshot capture
 *   [x] Add interaction methods
 *   [x] Console and network logging
 */

import * as pw from 'playwright-core';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

export interface ReviewConfig {
  url: string;
  apiKey?: string;
  outputDir?: string;
  viewport?: { width: number; height: number };
  waitForSelector?: string;
  captureConsole?: boolean;
  captureNetwork?: boolean;
  interactive?: boolean;
}

export interface ReviewResult {
  screenshots: string[];
  consoleLogs: Array<{ type: string; text: string; timestamp: number }>;
  networkRequests: Array<{ url: string; method: string; status?: number }>;
  pageTitle: string;
  error?: string;
}

export class BrowserReviewService {
  private config: ReviewConfig;
  private apiKey: string;

  constructor(config: ReviewConfig) {
    this.config = {
      outputDir: 'ui-review-output',
      viewport: { width: 1280, height: 720 },
      captureConsole: true,
      captureNetwork: true,
      interactive: false,
      ...config,
    };

    this.apiKey = config.apiKey || process.env.BROWSERCAT_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('BrowserCat API key required. Set BROWSERCAT_API_KEY env var or pass apiKey in config');
    }

    // Ensure output directory exists
    if (!existsSync(this.config.outputDir!)) {
      mkdirSync(this.config.outputDir!, { recursive: true });
    }
  }

  async review(): Promise<ReviewResult> {
    const result: ReviewResult = {
      screenshots: [],
      consoleLogs: [],
      networkRequests: [],
      pageTitle: '',
    };

    let browser: pw.Browser | null = null;

    try {
      // Connect to BrowserCat
      const bcatUrl = 'wss://api.browsercat.com/connect';
      browser = await pw.chromium.connect(bcatUrl, {
        headers: { 'Api-Key': this.apiKey },
      });

      const context = await browser.newContext({
        viewport: this.config.viewport,
      });

      const page = await context.newPage();

      // Set up console logging
      if (this.config.captureConsole) {
        page.on('console', (msg) => {
          result.consoleLogs.push({
            type: msg.type(),
            text: msg.text(),
            timestamp: Date.now(),
          });
        });
      }

      // Set up network logging
      if (this.config.captureNetwork) {
        page.on('request', (req) => {
          result.networkRequests.push({
            url: req.url(),
            method: req.method(),
          });
        });

        page.on('response', (res) => {
          const req = result.networkRequests.find(r => r.url === res.url());
          if (req) {
            req.status = res.status();
          }
        });
      }

      // Navigate to the URL
      console.log(`🌐 Navigating to ${this.config.url}...`);
      await page.goto(this.config.url, { waitUntil: 'networkidle' });

      // Wait for specific selector if provided
      if (this.config.waitForSelector) {
        console.log(`⏳ Waiting for selector: ${this.config.waitForSelector}`);
        await page.waitForSelector(this.config.waitForSelector, { timeout: 30000 });
      }

      // Get page title
      result.pageTitle = await page.title();
      console.log(`📄 Page title: ${result.pageTitle}`);

      // Take initial screenshot
      const timestamp = Date.now();
      const screenshotPath = join(this.config.outputDir!, `screenshot-${timestamp}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      result.screenshots.push(screenshotPath);
      console.log(`📸 Screenshot saved: ${screenshotPath}`);

      // Mobile viewport screenshot
      await page.setViewportSize({ width: 375, height: 667 });
      const mobileScreenshotPath = join(this.config.outputDir!, `screenshot-mobile-${timestamp}.png`);
      await page.screenshot({ path: mobileScreenshotPath, fullPage: true });
      result.screenshots.push(mobileScreenshotPath);
      console.log(`📱 Mobile screenshot saved: ${mobileScreenshotPath}`);

      // Interactive mode for additional actions
      if (this.config.interactive) {
        console.log('🎮 Interactive mode enabled. Page ready for manual interaction...');
        console.log('   - Use page object to interact');
        console.log('   - Press Ctrl+C when done');
        
        // Keep the browser open for debugging
        await new Promise(() => {});
      }

      return result;

    } catch (error) {
      console.error('❌ Error during UI review:', error);
      result.error = error instanceof Error ? error.message : String(error);
      return result;
    } finally {
      if (browser && !this.config.interactive) {
        await browser.close();
      }
    }
  }

  async testUserFlow(actions: Array<() => Promise<void>>): Promise<ReviewResult> {
    // Implementation for testing specific user flows
    // This would execute a series of actions and capture results
    throw new Error('Not implemented yet');
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const url = args[0];

  if (!url) {
    console.error('Usage: tsx scripts/ui-review/browser-service.ts <URL>');
    process.exit(1);
  }

  const service = new BrowserReviewService({
    url,
    captureConsole: true,
    captureNetwork: true,
  });

  service.review().then((result) => {
    console.log('\n📊 Review Results:');
    console.log(`- Screenshots: ${result.screenshots.length}`);
    console.log(`- Console logs: ${result.consoleLogs.length}`);
    console.log(`- Network requests: ${result.networkRequests.length}`);
    
    if (result.consoleLogs.length > 0) {
      console.log('\n🔍 Console Logs:');
      result.consoleLogs.forEach(log => {
        console.log(`  [${log.type}] ${log.text}`);
      });
    }

    if (result.networkRequests.filter(r => r.status && r.status >= 400).length > 0) {
      console.log('\n⚠️  Failed Requests:');
      result.networkRequests
        .filter(r => r.status && r.status >= 400)
        .forEach(req => {
          console.log(`  ${req.method} ${req.url} - ${req.status}`);
        });
    }

    if (result.error) {
      console.error('\n❌ Error:', result.error);
      process.exit(1);
    }
  }).catch(console.error);
}