const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to login
  await page.goto('http://localhost:3000/login');
  await page.waitForLoadState('networkidle');

  // Fill login form
  await page.fill('#email', 'super@tophand.tech');
  await page.fill('#password', 'demo123');

  // Click sign in
  await page.click('button[type="submit"]');

  // Wait for navigation
  await page.waitForTimeout(3000);

  console.log('Current URL:', page.url());

  // Go to supervisor jobs
  await page.goto('http://localhost:3000/supervisor');
  await page.waitForTimeout(2000);

  // Find and click first job
  const jobLinks = await page.locator('a[href*="/supervisor/jobs/"]').all();

  if (jobLinks.length > 0) {
    await jobLinks[0].click();
    await page.waitForTimeout(2000);

    console.log('Job details URL:', page.url());

    // Take screenshot
    await page.screenshot({ path: 'job-details-debug.png', fullPage: true });

    // Get console logs
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

    // Wait for component to render
    await page.waitForTimeout(2000);

    // Check if button exists and is disabled
    const button = page.locator('button:has-text("Assign Crew")');
    const isVisible = await button.isVisible();
    const isDisabled = await button.isDisabled();

    console.log('Button visible:', isVisible);
    console.log('Button disabled:', isDisabled);

    // Get the console logs from the page
    const logs = await page.evaluate(() => {
      return window.__consoleLogs || [];
    });
    console.log('Console logs:', logs);

    await page.waitForTimeout(5000);
  }

  await browser.close();
})();
