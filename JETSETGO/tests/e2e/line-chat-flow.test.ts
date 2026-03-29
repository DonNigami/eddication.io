/**
 * LINE Chat Flow E2E Tests
 * Tests complete conversation flows in LINE chatbot
 */

import { test, expect } from '@playwright/test';

test.describe('LINE Chat Flow - Search', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to LINE simulator or actual LINE OA
    await page.goto(process.env.LINE_TEST_URL || '/line-simulator');
  });

  test('should complete tire search conversation', async ({ page }) => {
    // Send initial search message
    await page.fill('.chat-input', 'หายาง Honda City 185/65R15');
    await page.click('.send-button');

    // Wait for bot response with results
    await expect(page.locator('.bot-message:last-child')).toBeVisible({ timeout: 10000 });
    const botResponse = await page.locator('.bot-message:last-child').textContent();

    // Verify response contains relevant information
    expect(botResponse).toMatch(/(ยาง|Honda|185|65R15|Part)/i);

    // Check for Flex message or carousel
    const hasCarousel = await page.locator('.carousel-container, .flex-carousel').count();
    if (hasCarousel > 0) {
      await expect(page.locator('.carousel-container, .flex-carousel')).toBeVisible();
    }
  });

  test('should handle compatibility check', async ({ page }) => {
    // Send compatibility question
    await page.fill('.chat-input', 'ยาง 205/55R16 ใส่ Honda City ปี 2020 ได้ไหม');
    await page.click('.send-button');

    // Wait for response
    await expect(page.locator('.bot-message:last-child')).toBeVisible({ timeout: 10000 });
    const botResponse = await page.locator('.bot-message:last-child').textContent();

    // Should mention compatibility
    expect(botResponse).toMatch(/(ได้|ไม่ได้|compatib|fit)/i);
  });

  test('should handle price inquiry', async ({ page }) => {
    await page.fill('.chat-input', 'ราคายาง Michelin 205/55R16 เท่าไหร่');
    await page.click('.send-button');

    await expect(page.locator('.bot-message:last-child')).toBeVisible({ timeout: 10000 });
    const botResponse = await page.locator('.bot-message:last-child').textContent();

    // Should contain price information or Baht symbol
    expect(botResponse).toMatch(/(ราค|บาท|\d+฿|\d,\d{3})/);
  });
});

test.describe('LINE Chat Flow - No Results', () => {
  test('should handle no results gracefully', async ({ page }) => {
    await page.goto(process.env.LINE_TEST_URL || '/line-simulator');

    // Search for non-existent product
    await page.fill('.chat-input', 'ยางสำหรับเครื่องบินโบอมิง 777');
    await page.click('.send-button');

    await expect(page.locator('.bot-message:last-child')).toBeVisible({ timeout: 10000 });
    const botResponse = await page.locator('.bot-message:last-child').textContent();

    // Should inform user no results found
    expect(botResponse).toMatch(/(ไม่พบ|ไม่มีข้อมูล|not found|no results)/i);

    // Should offer alternatives
    expect(botResponse).toMatch(/(ลอง|ค้นหา|alternatives|suggest)/i);
  });
});

test.describe('LINE Chat Flow - Follow-up', () => {
  test('should maintain context in conversation', async ({ page }) => {
    await page.goto(process.env.LINE_TEST_URL || '/line-simulator');

    // First query
    await page.fill('.chat-input', 'ยาง Honda City');
    await page.click('.send-button');
    await expect(page.locator('.bot-message:last-child')).toBeVisible();

    // Follow-up question (implicit context)
    await page.fill('.chat-input', 'ราคาเท่าไหร่');
    await page.click('.send-button');
    await expect(page.locator('.bot-message:last-child')).toBeVisible();

    // Response should refer to previously searched tires
    const botResponse = await page.locator('.bot-message:last-child').textContent();
    expect(botResponse).toMatch(/(ยาง|ราค|บาท)/i);
  });
});

test.describe('LINE Chat Flow - Rate Limiting', () => {
  test('should handle rapid messages gracefully', async ({ page }) => {
    await page.goto(process.env.LINE_TEST_URL || '/line-simulator');

    // Send multiple messages rapidly
    const queries = ['ยาง', 'น้ำมัน', 'ปะกลง', 'กรองอากาศ'];

    for (const query of queries) {
      await page.fill('.chat-input', query);
      await page.click('.send-button');
      await page.waitForTimeout(100); // Small delay
    }

    // All messages should eventually be processed
    const botMessages = await page.locator('.bot-message').count();
    expect(botMessages).toBeGreaterThanOrEqual(queries.length);
  });
});
