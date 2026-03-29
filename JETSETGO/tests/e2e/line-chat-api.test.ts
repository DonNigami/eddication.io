/**
 * JETSETGO - E2E Test: LINE Chat Flow (Extended)
 * Extended tests for complete LINE chatbot conversation flow
 */

import { test, expect } from '@playwright/test';

// Simulated LINE webhook endpoint
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:9000/functions/v1/jetsetgo-line-webhook';
const AGENT_URL = process.env.AGENT_URL || 'http://localhost:9000/functions/v1/jetsetgo-agent';

test.describe('LINE Chat Flow Tests (Extended)', () => {
  // Helper to create LINE webhook event
  function createWebhookEvent(message: string, userId: string = 'test-user-123') {
    return {
      destination: 'test-line-id',
      events: [
        {
          type: 'message',
          mode: 'active',
          timestamp: Date.now(),
          source: {
            type: 'user',
            userId: userId
          },
          message: {
            type: 'text',
            text: message
          },
          replyToken: 'test-reply-token'
        }
      ]
    };
  }

  test('should handle greeting message', async ({ request }) => {
    const event = createWebhookEvent('สวัสดีครับ');

    const response = await request.post(WEBHOOK_URL, {
      data: JSON.stringify(event),
      headers: {
        'Content-Type': 'application/json',
        'x-line-signature': 'test-signature'
      }
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty('success');
    expect(data.success).toBe(true);
  });

  test('should handle Thai parts search query', async ({ request }) => {
    const event = createWebhookEvent('หายาง Michelin 205/55R16');

    const response = await request.post(WEBHOOK_URL, {
      data: JSON.stringify(event),
      headers: {
        'Content-Type': 'application/json',
        'x-line-signature': 'test-signature'
      }
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.intent).toBe('search');

    // Should return messages
    expect(data.messages).toBeDefined();
    expect(Array.isArray(data.messages)).toBe(true);
  });

  test('should handle compatibility check', async ({ request }) => {
    const event = createWebhookEvent('ยาง 205/55R16 ใส่ Honda City ได้ไหม');

    const response = await request.post(WEBHOOK_URL, {
      data: JSON.stringify(event),
      headers: {
        'Content-Type': 'application/json',
        'x-line-signature': 'test-signature'
      }
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.intent).toBe('compatibility_check');
  });

  test('should handle price inquiry', async ({ request }) => {
    const event = createWebhookEvent('ราคายาง Michelin เท่าไหร่');

    const response = await request.post(WEBHOOK_URL, {
      data: JSON.stringify(event),
      headers: {
        'Content-Type': 'application/json',
        'x-line-signature': 'test-signature'
      }
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.intent).toBe('price_inquiry');
  });

  test('should handle recommendation request', async ({ request }) => {
    const event = createWebhookEvent('แนะนำยางที่ดีสุด');

    const response = await request.post(WEBHOOK_URL, {
      data: JSON.stringify(event),
      headers: {
        'Content-Type': 'application/json',
        'x-line-signature': 'test-signature'
      }
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.intent).toBe('recommendation');
  });

  test('should handle English query', async ({ request }) => {
    const event = createWebhookEvent('Search for brake pads for Toyota Vios');

    const response = await request.post(WEBHOOK_URL, {
      data: JSON.stringify(event),
      headers: {
        'Content-Type': 'application/json',
        'x-line-signature': 'test-signature'
      }
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.language).toBe('en');
  });
});

test.describe('Agent Orchestrator Tests', () => {
  test('should process search query', async ({ request }) => {
    const response = await request.post(AGENT_URL, {
      data: JSON.stringify({
        query: 'ยาง Michelin 205/55R16',
        sessionId: 'test-session-001'
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.intent).toBe('search');
    expect(data.involvedAgents).toContain('search');
    expect(data.executionTime).toBeGreaterThan(0);
  });

  test('should process compatibility check with vehicle context', async ({ request }) => {
    const response = await request.post(AGENT_URL, {
      data: JSON.stringify({
        query: 'ใส่รถฉันได้ไหม',
        sessionId: 'test-session-002',
        vehicleContext: {
          make: 'Honda',
          model: 'City',
          year: 2020
        }
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.involvedAgents).toContain('compatibility');
  });

  test('should maintain conversation context', async ({ request }) => {
    const sessionId = 'test-session-context-001';

    // First message
    const response1 = await request.post(AGENT_URL, {
      data: JSON.stringify({
        query: 'สวัสดี',
        sessionId: sessionId
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    expect(response1.status()).toBe(200);
    const data1 = await response1.json();
    expect(data1.intent).toBe('greeting');

    // Follow-up message
    const response2 = await request.post(AGENT_URL, {
      data: JSON.stringify({
        query: 'หายาง Honda City',
        sessionId: sessionId
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    expect(response2.status()).toBe(200);
    const data2 = await response2.json();
    expect(data2.intent).toBe('search');
  });

  test('should provide follow-up suggestions', async ({ request }) => {
    const response = await request.post(AGENT_URL, {
      data: JSON.stringify({
        query: 'ยาง Bridgestone',
        sessionId: 'test-session-003'
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.followUpSuggestions).toBeDefined();
    expect(Array.isArray(data.followUpSuggestions)).toBe(true);
    expect(data.followUpSuggestions.length).toBeGreaterThan(0);
  });

  test('should handle empty query gracefully', async ({ request }) => {
    const response = await request.post(AGENT_URL, {
      data: JSON.stringify({
        query: '',
        sessionId: 'test-session-004'
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('required');
  });

  test('should return Thai response for Thai query', async ({ request }) => {
    const response = await request.post(AGENT_URL, {
      data: JSON.stringify({
        query: 'ราคาน้ำมันเครื่องเท่าไหร่',
        sessionId: 'test-session-005',
        preferences: {
          language: 'th'
        }
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain('ราคา'); // Should contain Thai text
  });

  test('should return English response for English query', async ({ request }) => {
    const response = await request.post(AGENT_URL, {
      data: JSON.stringify({
        query: 'How much is the engine oil?',
        sessionId: 'test-session-006',
        preferences: {
          language: 'en'
        }
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.message).toMatch(/price|cost/i); // Should contain English text
  });
});

test.describe('Multi-Turn Conversation', () => {
  test('should handle clarification flow', async ({ request }) => {
    const sessionId = 'test-session-multi-001';

    // User: "ต้องการยาง"
    let response = await request.post(AGENT_URL, {
      data: JSON.stringify({
        query: 'ต้องการยาง',
        sessionId: sessionId
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    let data = await response.json();
    expect(data.success).toBe(true);

    // System should ask for more details
    expect(data.followUpSuggestions).toBeDefined();

    // User: "สำหรับ Honda City ปี 2020"
    response = await request.post(AGENT_URL, {
      data: JSON.stringify({
        query: 'สำหรับ Honda City ปี 2020',
        sessionId: sessionId,
        vehicleContext: {
          make: 'Honda',
          model: 'City',
          year: 2020
        }
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    data = await response.json();
    expect(data.success).toBe(true);
    expect(data.involvedAgents).toContain('search');
  });

  test('should handle comparison flow', async ({ request }) => {
    const sessionId = 'test-session-compare-001';

    // User: "เปรียบเทียบยาง Michelin กับ Bridgestone"
    let response = await request.post(AGENT_URL, {
      data: JSON.stringify({
        query: 'เปรียบเทียบยาง Michelin กับ Bridgestone',
        sessionId: sessionId
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    let data = await response.json();
    expect(data.success).toBe(true);
    expect(data.intent).toBe('comparison');

    // Should provide comparison or recommendation
    expect(data.involvedAgents).toContain('recommendation');
  });

  test('should handle thank you and closing', async ({ request }) => {
    const sessionId = 'test-session-close-001';

    // User: "ขอบคุณครับ"
    const response = await request.post(AGENT_URL, {
      data: JSON.stringify({
        query: 'ขอบคุณครับ',
        sessionId: sessionId
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.intent).toBe('thanks');
    expect(data.message).toMatch(/ช่วย|help|thank/i);
  });
});
