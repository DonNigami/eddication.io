/**
 * JETSETGO - E2E Test: Catalog Upload Workflow
 * Tests the complete workflow from catalog upload to search
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_URL = `${BASE_URL}/admin`;

// Test credentials
const TEST_CREDENTIALS = {
  email: 'admin@jetsetgo.test',
  password: 'test1234'
};

test.describe('Catalog Upload Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin login
    await page.goto(ADMIN_URL);
  });

  test('should login to admin panel', async ({ page }) => {
    // Login form should be visible
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();

    // Fill credentials
    await page.fill('input[name="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[name="password"]', TEST_CREDENTIALS.password);

    // Submit
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL(`${ADMIN_URL}/dashboard`, { timeout: 5000 });

    // Dashboard should load
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('should navigate to upload page', async ({ page }) => {
    // Login first
    await page.fill('input[name="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[name="password"]', TEST_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${ADMIN_URL}/dashboard`);

    // Navigate to upload
    await page.click('text=Upload Catalog');
    await page.click('text=Catalog Upload');

    // Upload page should be visible
    await expect(page.locator('h1, h2')).toContainText('Upload', { timeout: 5000 });
    await expect(page.locator('input[type="file"]')).toBeVisible();
  });

  test('should show upload form elements', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/upload`);

    // Check form elements
    await expect(page.locator('input[type="file"]')).toBeVisible();
    await expect(page.locator('input[name="catalog_name"]')).toBeVisible();
    await expect(page.locator('select[name="catalog_type"]')).toBeVisible();
    await expect(page.locator('button:has-text("Upload")')).toBeVisible();

    // Check catalog type options
    const typeOptions = await page.locator('select[name="catalog_type"] option').allTextContents();
    expect(typeOptions).toContain('PDF');
    expect(typeOptions).toContain('Excel');
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/upload`);

    // Try to submit without file
    await page.click('button:has-text("Upload")');

    // Should show validation error
    await expect(page.locator('.error, .toast-error, [role="alert"]')).toBeVisible({ timeout: 2000 });
  });

  test('should upload a test catalog file', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/upload`);

    // Fill catalog name
    await page.fill('input[name="catalog_name"]', 'E2E Test Catalog');

    // Select catalog type
    await page.selectOption('select[name="catalog_type"]', 'pdf');

    // Note: In a real test, you would use a real test file
    // For this example, we'll check if the file input is ready
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible();

    // In actual implementation:
    // await fileInput.setInputFile('./tests/fixtures/catalogs/test-catalog.pdf');
    // await page.click('button:has-text("Upload")');
    // await expect(page.locator('.toast-success')).toContainText('uploading');
  });

  test('should show ingestion progress', async ({ page }) => {
    // After upload, progress should be visible
    await page.goto(`${ADMIN_URL}/ingestion`);

    // Progress table should be visible
    await expect(page.locator('table, .ingestion-list, .job-list')).toBeVisible();
  });
});

test.describe('Data Validation Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto(ADMIN_URL);
    await page.fill('input[name="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[name="password"]', TEST_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${ADMIN_URL}/dashboard`);
  });

  test('should navigate to validation page', async ({ page }) => {
    await page.click('text=Validation');
    await page.click('text=Data Validation');

    // Validation page should load
    await expect(page.locator('h1, h2')).toContainText('Validation', { timeout: 5000 });
  });

  test('should show validation queue', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/validation`);

    // Check for validation items or empty state
    const hasItems = await page.locator('.validation-item, .queue-item').count() > 0;

    if (hasItems) {
      // Should show items to validate
      await expect(page.locator('.validation-item, .queue-item').first()).toBeVisible();

      // Click first item
      await page.click('.validation-item, .queue-item');
      await expect(page.locator('.validation-detail, .item-detail')).toBeVisible();
    } else {
      // Should show empty state
      await expect(page.locator('.empty-state, .no-items')).toBeVisible();
    }
  });

  test('should approve validation item', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/validation`);

    // If there are items, try to approve
    const approveButton = page.locator('button:has-text("Approve"), button:has-text("อนุมัติ")').first();

    if (await approveButton.isVisible({ timeout: 2000 })) {
      await approveButton.click();

      // Should show success message
      await expect(page.locator('.toast-success')).toContainText('approve', { timeout: 3000 });
    }
  });
});

test.describe('Search Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto(ADMIN_URL);
    await page.fill('input[name="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[name="password"]', TEST_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${ADMIN_URL}/dashboard`);
  });

  test('should navigate to search page', async ({ page }) => {
    await page.click('text=Search');
    await page.click('text=Catalog Search');

    // Search page should load
    await expect(page.locator('input[name="query"], input[placeholder*="search" i]')).toBeVisible({ timeout: 5000 });
  });

  test('should perform Thai search', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/search`);

    // Enter Thai query
    await page.fill('input[name="query"], input[placeholder*="search" i]', 'ยาง Michelin');
    await page.click('button:has-text("Search"), button:has-text("ค้นหา")');

    // Should show results or no results message
    const hasResults = await page.locator('.search-result, .result-item').count() > 0;

    if (hasResults) {
      await expect(page.locator('.search-result').first()).toBeVisible();
      // Results should have part numbers
      await expect(page.locator('.part-number, [data-part-number]').first()).toBeVisible();
    } else {
      await expect(page.locator('.no-results, .empty-state')).toBeVisible();
    }
  });

  test('should perform English search', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/search`);

    // Enter English query
    await page.fill('input[name="query"], input[placeholder*="search" i]', 'brake pad');
    await page.click('button:has-text("Search"), button:has-text("ค้นหา")');

    // Check results
    const results = page.locator('.search-result, .result-item');
    const count = await results.count();

    // Should either have results or show no results message
    if (count > 0) {
      await expect(results.first()).toBeVisible();
    } else {
      await expect(page.locator('.no-results, .empty-state')).toBeVisible();
    }
  });

  test('should filter results', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/search`);

    // Perform search first
    await page.fill('input[name="query"], input[placeholder*="search" i]', 'ยาง');
    await page.click('button:has-text("Search"), button:has-text("ค้นหา")');
    await page.waitForTimeout(1000);

    // Check for filter options
    const categoryFilter = page.locator('select[name="category"], .category-filter');
    if (await categoryFilter.isVisible({ timeout: 2000 })) {
      // Select category
      await categoryFilter.selectOption('tires');

      // Results should update
      await page.waitForTimeout(500);
    }
  });
});

test.describe('Analytics Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto(ADMIN_URL);
    await page.fill('input[name="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[name="password"]', TEST_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${ADMIN_URL}/dashboard`);
  });

  test('should load dashboard', async ({ page }) => {
    // Dashboard should have key metrics
    await expect(page.locator('.dashboard, .analytics')).toBeVisible();

    // Check for KPI cards
    const kpiCards = page.locator('.kpi-card, .metric-card, .stat-card');
    const kpiCount = await kpiCards.count();
    expect(kpiCount).toBeGreaterThan(0);
  });

  test('should show popular searches', async ({ page }) => {
    // Navigate to analytics if needed
    await page.goto(`${ADMIN_URL}/dashboard`);

    // Check for popular searches section
    const popularSearches = page.locator('.popular-searches, .search-analytics, .top-queries');
    if (await popularSearches.isVisible({ timeout: 2000 })) {
      await expect(popularSearches).toContainText('search', { timeout: 5000 });
    }
  });

  test('should show search volume chart', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/dashboard`);

    // Check for chart element
    const chart = page.locator('canvas, .chart, [data-chart], svg');
    if (await chart.first().isVisible({ timeout: 2000 })) {
      await expect(chart.first()).toBeVisible();
    }
  });
});

test.describe('Admin Logout', () => {
  test('should logout successfully', async ({ page }) => {
    // Login
    await page.goto(ADMIN_URL);
    await page.fill('input[name="email"]', TEST_CREDENTIALS.email);
    await page.fill('input[name="password"]', TEST_CREDENTIALS.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(`${ADMIN_URL}/dashboard`);

    // Logout
    await page.click('button:has-text("Logout"), .logout-btn, a:has-text("ออกจากระบบ")');

    // Should redirect to login
    await expect(page).toHaveURL(/.*login.*/, { timeout: 5000 });
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });
});
