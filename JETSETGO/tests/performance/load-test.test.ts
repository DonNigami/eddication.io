/**
 * JETSETGO - Performance & Load Tests
 * Tests system performance under various load conditions
 */

import { test, expect } from '@playwright/test';

const AGENT_URL = process.env.AGENT_URL || 'http://localhost:9000/functions/v1/jetsetgo-agent';
const RAG_URL = process.env.RAG_URL || 'http://localhost:9000/functions/v1/jetsetgo-rag-query';

interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
}

test.describe('Performance Tests', () => {
  test('should respond within 5 seconds for simple search', async ({ request }) => {
    const startTime = Date.now();

    const response = await request.post(AGENT_URL, {
      data: JSON.stringify({
        query: 'ยาง Michelin',
        sessionId: 'perf-test-001'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    expect(response.status()).toBe(200);
    expect(responseTime).toBeLessThan(5000); // 5 second SLA

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.executionTime).toBeLessThan(5000);
  });

  test('should respond within 3 seconds for cached queries', async ({ request }) => {
    const sessionId = 'perf-cache-001';
    const query = 'ยาง Bridgestone';

    // First request (cache miss)
    const response1 = await request.post(AGENT_URL, {
      data: JSON.stringify({ query, sessionId }),
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response1.status()).toBe(200);

    // Second request (potential cache hit)
    const startTime = Date.now();
    const response2 = await request.post(AGENT_URL, {
      data: JSON.stringify({ query, sessionId }),
      headers: { 'Content-Type': 'application/json' }
    });
    const endTime = Date.now();

    const responseTime = endTime - startTime;

    expect(response2.status()).toBe(200);
    // Cached or optimized response should be faster
    expect(responseTime).toBeLessThan(3000);
  });

  test('should handle concurrent requests', async ({ request }) => {
    const concurrentRequests = 5;
    const queries = ['ยาง', 'น้ำมัน', 'ปะกลง', 'กรองอากาศ', 'หัวเทียน'];

    const startTime = Date.now();

    const promises = queries.map((query, index) =>
      request.post(AGENT_URL, {
        data: JSON.stringify({
          query,
          sessionId: `perf-concurrent-${index}`
        }),
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const responses = await Promise.all(promises);
    const endTime = Date.now();

    const totalTime = endTime - startTime;

    // All requests should succeed
    for (const response of responses) {
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    }

    // Total time should be reasonable (not sequential)
    expect(totalTime).toBeLessThan(15000); // 3 sec per request max
  });

  test('should maintain response time under load', async ({ request }) => {
    const numberOfRequests = 10;
    const queries = Array(numberOfRequests).fill('ยาง Michelin 205/55R16');

    const responseTimes: number[] = [];

    for (let i = 0; i < numberOfRequests; i++) {
      const startTime = Date.now();

      const response = await request.post(AGENT_URL, {
        data: JSON.stringify({
          query: queries[i],
          sessionId: `perf-load-${i}`
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;
      responseTimes.push(responseTime);

      expect(response.status()).toBe(200);
    }

    // Calculate statistics
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const maxResponseTime = Math.max(...responseTimes);
    const minResponseTime = Math.min(...responseTimes);

    // Average should be under 5 seconds
    expect(avgResponseTime).toBeLessThan(5000);

    // No single request should exceed 10 seconds
    expect(maxResponseTime).toBeLessThan(10000);

    console.log(`Performance Stats:
      Avg: ${avgResponseTime}ms
      Min: ${minResponseTime}ms
      Max: ${maxResponseTime}ms
      Requests: ${numberOfRequests}`);
  });
});

test.describe('Load Tests - Free Tier Limits', () => {
  test('should handle light load (5 concurrent users)', async ({ request }) => {
    const result = await runLoadTest(request, {
      concurrentUsers: 5,
      requestsPerUser: 2,
      testDurationSec: 10
    });

    console.log(`Light Load Test Results:
      Total: ${result.totalRequests}
      Success: ${result.successfulRequests}
      Failed: ${result.failedRequests}
      Avg: ${result.avgResponseTime}ms
      P95: ${result.p95ResponseTime}ms
      Max: ${result.maxResponseTime}ms`);

    expect(result.failedRequests).toBe(0);
    expect(result.avgResponseTime).toBeLessThan(5000);
  });

  test('should handle moderate load (10 concurrent users)', async ({ request }) => {
    const result = await runLoadTest(request, {
      concurrentUsers: 10,
      requestsPerUser: 1,
      testDurationSec: 15
    });

    console.log(`Moderate Load Test Results:
      Total: ${result.totalRequests}
      Success: ${result.successfulRequests}
      Failed: ${result.failedRequests}
      Avg: ${result.avgResponseTime}ms
      P95: ${result.p95ResponseTime}ms
      Max: ${result.maxResponseTime}ms`);

    // Allow some failures under load
    expect(result.failedRequests).toBeLessThan(result.totalRequests * 0.1); // <10% failure rate
    expect(result.avgResponseTime).toBeLessThan(7000); // Slightly higher SLA under load
  });
});

test.describe('Resource Usage Tests', () => {
  test('should not have memory leaks across multiple sessions', async ({ request }) => {
    const sessions = 20;
    const responseTimes: number[] = [];

    for (let i = 0; i < sessions; i++) {
      const startTime = Date.now();

      const response = await request.post(AGENT_URL, {
        data: JSON.stringify({
          query: 'ยาง',
          sessionId: `memory-test-${i}`
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const endTime = Date.now();
      responseTimes.push(endTime - startTime);

      expect(response.status()).toBe(200);
    }

    // Response times should not degrade significantly
    const firstHalf = responseTimes.slice(0, sessions / 2);
    const secondHalf = responseTimes.slice(sessions / 2);

    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    // Second half should not be more than 2x slower (simple memory leak detection)
    expect(avgSecond).toBeLessThan(avgFirst * 2);
  });

  test('should efficiently handle long queries', async ({ request }) => {
    const longQuery = 'ฉันต้องการค้นหายางรถยนต์สำหรับ Honda City ปี 2020 ขนาด 185/65R15 ที่มีคุณภาพดี ราคาไม่แพง และมีสินค้าพร้อมส่ง พร้อมความเข้ากันได้กับรถคันนี้ และมีการรับประกัน';

    const startTime = Date.now();

    const response = await request.post(AGENT_URL, {
      data: JSON.stringify({
        query: longQuery,
        sessionId: 'perf-long-query'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    const endTime = Date.now();
    const responseTime = endTime - startTime;

    expect(response.status()).toBe(200);
    expect(responseTime).toBeLessThan(8000); // Longer SLA for complex queries
  });
});

test.describe('Database Performance', () => {
  test('should efficiently search with vector similarity', async ({ request }) => {
    const queries = [
      'ยาง Michelin',
      'ยาง Bridgestone',
      'ยาง Goodyear',
      'น้ำมันเครื่อง',
      'ปะกลงงพร้อม'
    ];

    const startTime = Date.now();

    const promises = queries.map(query =>
      request.post(AGENT_URL, {
        data: JSON.stringify({
          query,
          sessionId: `db-perf-test`
        }),
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const responses = await Promise.all(promises);
    const endTime = Date.now();

    const avgTime = (endTime - startTime) / queries.length;

    // Vector search should be efficient
    expect(avgTime).toBeLessThan(3000);

    for (const response of responses) {
      expect(response.status()).toBe(200);
    }
  });
});

/**
 * Helper function to run load tests
 */
async function runLoadTest(
  request: any,
  config: {
    concurrentUsers: number;
    requestsPerUser: number;
    testDurationSec: number;
  }
): Promise<LoadTestResult> {
  const results: {
    success: number;
    failed: number;
    responseTimes: number[];
  } = {
    success: 0,
    failed: 0,
    responseTimes: []
  };

  const queries = ['ยาง', 'น้ำมัน', 'ปะกลง', 'กรองอากาศ', 'หัวเทียน'];
  const startTime = Date.now();

  // Create batches of concurrent requests
  for (let batch = 0; batch < config.requestsPerUser; batch++) {
    const promises = Array.from({ length: config.concurrentUsers }, (_, i) => {
      const userIndex = batch * config.concurrentUsers + i;
      return request.post(AGENT_URL, {
        data: JSON.stringify({
          query: queries[userIndex % queries.length],
          sessionId: `load-test-user-${i}-${Date.now()}`
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const batchResults = await Promise.allSettled(promises);

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        const response = result.value;
        if (response.status() === 200) {
          results.success++;
          // Get execution time from response
          try {
            const data = await response.json();
            results.responseTimes.push(data.executionTime || 0);
          } catch {
            results.responseTimes.push(0);
          }
        } else {
          results.failed++;
        }
      } else {
        results.failed++;
      }
    }

    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const endTime = Date.now();
  const totalDuration = (endTime - startTime) / 1000;

  // Calculate statistics
  const validTimes = results.responseTimes.filter(t => t > 0);
  const sortedTimes = [...validTimes].sort((a, b) => a - b);

  return {
    totalRequests: results.success + results.failed,
    successfulRequests: results.success,
    failedRequests: results.failed,
    avgResponseTime: validTimes.length > 0
      ? validTimes.reduce((a, b) => a + b, 0) / validTimes.length
      : 0,
    maxResponseTime: sortedTimes.length > 0 ? sortedTimes[sortedTimes.length - 1] : 0,
    minResponseTime: sortedTimes.length > 0 ? sortedTimes[0] : 0,
    p95ResponseTime: sortedTimes.length > 0
      ? sortedTimes[Math.floor(sortedTimes.length * 0.95)]
      : 0,
    p99ResponseTime: sortedTimes.length > 0
      ? sortedTimes[Math.floor(sortedTimes.length * 0.99)]
      : 0,
    requestsPerSecond: (results.success + results.failed) / totalDuration
  };
}

test.describe('Free Tier Monitoring', () => {
  test('should track API usage for free tier compliance', async ({ request }) => {
    // This test verifies that the system can track usage
    // In a real scenario, this would check against actual Supabase metrics

    const response = await request.post(AGENT_URL, {
      data: JSON.stringify({
        query: 'ยาง',
        sessionId: 'usage-test'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    // Verify execution time is being tracked
    expect(data.executionTime).toBeDefined();
    expect(data.executionTime).toBeGreaterThan(0);
  });

  test('should handle rate limiting gracefully', async ({ request }) => {
    const rapidRequests = 15;
    const responses = [];

    for (let i = 0; i < rapidRequests; i++) {
      const startTime = Date.now();

      const response = await request.post(AGENT_URL, {
        data: JSON.stringify({
          query: 'ทดสอบ',
          sessionId: `rate-limit-${i}`
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      const endTime = Date.now();

      responses.push({
        status: response.status(),
        time: endTime - startTime
      });

      // Small delay to avoid overwhelming
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // All requests should complete (may be queued)
    const successCount = responses.filter(r => r.status === 200).length;
    expect(successCount).toBeGreaterThan(rapidRequests * 0.8); // At least 80% success
  });
});
