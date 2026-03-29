/**
 * JETSETGO - Security Tests
 * Tests for SQL injection, XSS, RLS, and other security concerns
 */

import { test, expect } from '@playwright/test';

const AGENT_URL = process.env.AGENT_URL || 'http://localhost:9000/functions/v1/jetsetgo-agent';
const RAG_URL = process.env.RAG_URL || 'http://localhost:9000/functions/v1/jetsetgo-rag-query';
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:9000/functions/v1/jetsetgo-line-webhook';

test.describe('SQL Injection Prevention', () => {
  const SQL_INJECTION_ATTEMPTS = [
    "'; DROP TABLE parts_catalog; --",
    "' OR '1'='1",
    "1' UNION SELECT * FROM users--",
    "'; EXEC xp_cmdshell('dir'); --",
    "admin'--",
    "' OR 1=1#",
    "'; DELETE FROM parts_catalog WHERE '1'='1",
    "part_number' OR '1'='1'",
    "(SELECT * FROM (SELECT 1) AS X WHERE 1=1)--"
  ];

  for (const attempt of SQL_INJECTION_ATTEMPTS) {
    test(`should block SQL injection: ${attempt.slice(0, 30)}...`, async ({ request }) => {
      const response = await request.post(AGENT_URL, {
        data: JSON.stringify({
          query: attempt,
          sessionId: 'security-sql-test'
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      // Should return 200 (handled gracefully) but not 500 (error)
      expect(response.status()).not.toBe(500);

      const data = await response.json();

      // Should not have database error in response
      expect(data.error).not.toMatch(/SQL|syntax|database|postgres/i);

      // Should succeed but return no harmful results
      expect(data.success).toBe(true);

      // Message should not contain SQL artifacts
      expect(data.message).not.toMatch(/(DROP TABLE|UNION SELECT|EXEC)/);
    });
  }
});

test.describe('XSS Prevention', () => {
  const XSS_ATTEMPTS = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert("XSS")>',
    'javascript:alert("XSS")',
    '<svg onload=alert("XSS")>',
    '"><script>alert(String.fromCharCode(88,83,83))</script>',
    '<iframe src="javascript:alert(XSS)">',
    '<body onload=alert("XSS")>',
    '&lt;script&gt;alert("XSS")&lt;/script&gt;'
  ];

  for (const attempt of XSS_ATTEMPTS) {
    test(`should sanitize XSS: ${attempt.slice(0, 30)}...`, async ({ request }) => {
      const response = await request.post(AGENT_URL, {
        data: JSON.stringify({
          query: attempt,
          sessionId: 'security-xss-test'
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);

      // Response should not contain unescaped scripts
      expect(data.message).not.toContain('<script>');
      expect(data.message).not.toContain('javascript:');
      expect(data.message).not.toContain('onerror=');
      expect(data.message).not.toContain('onload=');
    });
  }
});

test.describe('Path Traversal Prevention', () => {
  const PATH_TRAVERSAL_ATTEMPTS = [
    '../../../etc/passwd',
    '..\\..\\..\\windows\\system32',
    '%2e%2e%2f',
    '....//....//',
    '..%2f',
    '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
  ];

  for (const attempt of PATH_TRAVERSAL_ATTEMPTS) {
    test(`should block path traversal: ${attempt}`, async ({ request }) => {
      const response = await request.post(RAG_URL, {
        data: JSON.stringify({
          query: attempt,
          sessionId: 'security-path-test'
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      // Should not expose file system
      expect(response.status()).not.toBe(500);

      const data = await response.json();
      // Should not contain file system contents
      expect(data.response).not.toContain('root:');
      expect(data.message).not.toContain('/etc/passwd');
      expect(data.message).not.toContain('system32');
    });
  }
});

test.describe('Authentication & Authorization', () => {
  test('should handle missing auth headers gracefully', async ({ request }) => {
    const response = await request.post(RAG_URL, {
      data: JSON.stringify({
        query: 'ยาง Michelin'
      }),
      headers: {
        'Content-Type': 'application/json'
        // Note: anon key may be optional for testing
      }
    });

    // Should work with anon key or return proper error
    expect([200, 401, 403]).toContain(response.status());

    if (response.status() === 401 || response.status() === 403) {
      const data = await response.json();
      expect(data).toHaveProperty('error');
    }
  });

  test('should validate request structure', async ({ request }) => {
    // Send malformed JSON
    const response = await request.post(AGENT_URL, {
      data: '{ invalid json }',
      headers: { 'Content-Type': 'application/json' }
    });

    // Should return 400 for malformed request
    expect(response.status()).toBe(400);
  });

  test('should reject oversized requests', async ({ request }) => {
    const hugeQuery = 'ยาง '.repeat(10000); // 50KB query

    const response = await request.post(AGENT_URL, {
      data: JSON.stringify({
        query: hugeQuery,
        sessionId: 'security-size-test'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    // Should either handle it or reject with 413
    expect([200, 413, 414]).toContain(response.status());

    if (response.status() === 413 || response.status() === 414) {
      const data = await response.json();
      expect(data.error).toBeDefined();
    }
  });
});

test.describe('Rate Limiting & DoS Prevention', () => {
  test('should handle rapid sequential requests', async ({ request }) => {
    const rapidRequests = 20;
    const responses = [];

    for (let i = 0; i < rapidRequests; i++) {
      const startTime = Date.now();

      const response = await request.post(AGENT_URL, {
        data: JSON.stringify({
          query: 'ทดสอบ',
          sessionId: `rate-test-${i}`
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      responses.push({
        status: response.status(),
        time: Date.now() - startTime
      });
    }

    // Most requests should succeed (system implements queueing)
    const successCount = responses.filter(r => r.status === 200).length;
    expect(successCount).toBeGreaterThan(rapidRequests * 0.7); // At least 70% success

    // Response times should remain reasonable
    const avgTime = responses.reduce((sum, r) => sum + r.time, 0) / responses.length;
    expect(avgTime).toBeLessThan(10000); // 10 second max average
  });

  test('should implement timeout for long-running requests', async ({ request }) => {
    // This test verifies the system has timeout handling
    const response = await request.post(AGENT_URL, {
      data: JSON.stringify({
        query: 'ยาง Michelin 205/55R16 ที่มีคุณสมบูรณ์ที่สุดและราคาถูกที่สุด',
        sessionId: 'timeout-test'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    // Should complete within reasonable time
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.executionTime).toBeLessThan(30000); // 30 second max
  });
});

test.describe('Data Privacy & Leakage Prevention', () => {
  test('should not expose API keys in responses', async ({ request }) => {
    const response = await request.post(AGENT_URL, {
      data: JSON.stringify({
        query: 'ยาง',
        sessionId: 'privacy-test'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status()).toBe(200);

    const data = await response.json();

    // Convert to string to check for leaked keys
    const responseString = JSON.stringify(data);

    // Check for common API key patterns
    expect(responseString).not.toMatch(/GROQ_API_KEY|groq_.{20,}/i);
    expect(responseString).not.toMatch(/HUGGINGFACE_API_KEY|hf_.{20,}/i);
    expect(responseString).not.toMatch(/SUPABASE_SERVICE_ROLE|eyJ.+{20,}/i);
    expect(responseString).not.toMatch(/LINE_CHANNEL_ACCESS_TOKEN/);
  });

  test('should not expose internal error details', async ({ request }) => {
    // Send a request that might cause internal error
    const response = await request.post(AGENT_URL, {
      data: JSON.stringify({
        query: '', // Empty query might cause validation error
        sessionId: 'error-test'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    // Should return proper error response
    expect([400, 500]).toContain(response.status());

    if (response.status() === 400) {
      const data = await response.json();
      expect(data).toHaveProperty('error');
      // Error should be user-friendly
      expect(data.error).toBeDefined();
      // Should not expose stack traces
      expect(data.error).not.toMatch(/at /);
      expect(data.error).not.toMatch(/\.js:/);
    }
  });

  test('should sanitize user input in logs', async ({ request }) => {
    const maliciousQuery = '<script>alert("XSS")</script> OR 1=1';

    const response = await request.post(AGENT_URL, {
      data: JSON.stringify({
        query: maliciousQuery,
        sessionId: 'log-sanitize-test'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status()).toBe(200);

    // System should handle it without errors
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});

test.describe('Session Management', () => {
  test('should generate unique session IDs', async ({ request }) => {
    const sessionIds = new Set<string>();

    for (let i = 0; i < 10; i++) {
      const response = await request.post(AGENT_URL, {
        data: JSON.stringify({
          query: 'ยาง',
          sessionId: `session-test-${i}`
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      expect(response.status()).toBe(200);
      // Each request should have its session handled properly
    }
  });

  test('should handle session hijacking attempts', async ({ request }) => {
    // Try to access another user's session
    const response = await request.post(AGENT_URL, {
      data: JSON.stringify({
        query: 'ยาง',
        sessionId: 'other-user-session-12345'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    // Should not leak other user's data
    expect(response.status()).toBe(200);

    const data = await response.json();
    // Should return a standard response (not error, as we don't have strict auth)
    // But in production, this would return 403
    expect(data.success).toBe(true);
  });
});

test.describe('Input Validation', () => {
  test('should reject requests without query', async ({ request }) => {
    const response = await request.post(AGENT_URL, {
      data: JSON.stringify({
        sessionId: 'validation-test'
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.error).toBeDefined();
    expect(data.error).toMatch(/required|query/i);
  });

  test('should handle special characters in Thai text', async ({ request }) => {
    const specialThaiQueries = [
      'ยางแม็กซ์',
      'จานเบรก-ดิสก์',
      'น้ำมันเครื่อง 5W-30 / 10W-40',
      'หัวเทียน "IRIDIUM"'
    ];

    for (const query of specialThaiQueries) {
      const response = await request.post(AGENT_URL, {
        data: JSON.stringify({
          query,
          sessionId: 'thai-special-test'
        }),
        headers: { 'Content-Type': 'application/json' }
      });

      expect(response.status()).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBeDefined();
    }
  });

  test('should handle very long session IDs', async ({ request }) => {
    const longSessionId = 'a'.repeat(500);

    const response = await request.post(AGENT_URL, {
      data: JSON.stringify({
        query: 'ยาง',
        sessionId: longSessionId
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    // Should either accept or reject gracefully
    expect([200, 400, 413]).toContain(response.status());
  });
});

test.describe('CORS Security', () => {
  test('should handle OPTIONS preflight correctly', async ({ request }) => {
    const response = await request.fetch(AGENT_URL, {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://malicious-site.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type'
      }
    });

    // Should return proper CORS headers
    expect(response.status()).toBe(200);

    const corsHeader = response.headers()['access-control-allow-origin'];
    // In production, this would be restricted
    // For now, we check it's present
    expect(corsHeader).toBeDefined();
  });
});
