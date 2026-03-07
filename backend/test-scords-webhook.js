/**
 * 🔧 SCORDS LINE Webhook Test Tool
 *
 * ใช้ทดสอบ LINE webhook สำหรับ SCORDS project
 * รันด้วย: node test-scords-webhook.js <webhook-url>
 *
 * Example:
 *   node test-scords-webhook.js https://your-domain.com/api/scords/webhook
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');

// Webhook URL จาก command line argument
const webhookUrl = process.argv[2];

if (!webhookUrl) {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║  🔧 SCORDS LINE Webhook Test Tool                   ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
  console.log('❌ Error: Missing webhook URL');
  console.log('');
  console.log('Usage:');
  console.log('  node test-scords-webhook.js <webhook-url>');
  console.log('');
  console.log('Example:');
  console.log('  node test-scords-webhook.js https://your-domain.com/api/scords/webhook');
  console.log('');
  process.exit(1);
}

console.log('╔══════════════════════════════════════════════════════╗');
console.log('║  🔧 SCORDS LINE Webhook Test Tool                   ║');
console.log('╚══════════════════════════════════════════════════════╝');
console.log('');
console.log(`🔗 Testing: ${webhookUrl}`);
console.log('');

// Mock LINE webhook events for testing
const mockEvents = {
  follow: {
    destination: "U1234567890abcdef1234567890abcdef",
    events: [{
      type: "follow",
      replyToken: "test-reply-token-follow",
      timestamp: Date.now(),
      mode: "active",
      source: {
        type: "user",
        userId: "U9876543210fedcba9876543210fedcba"
      },
      webhookEventId: "01HDEBUG-FOLLOW",
      deliveryContext: {
        isRedelivery: false
      }
    }]
  },

  message: {
    destination: "U1234567890abcdef1234567890abcdef",
    events: [{
      type: "message",
      replyToken: "test-reply-token-message",
      timestamp: Date.now(),
      mode: "active",
      source: {
        type: "user",
        userId: "U9876543210fedcba9876543210fedcba"
      },
      message: {
        id: "1234567890",
        type: "text",
        text: "help"
      },
      webhookEventId: "01HDEBUG-MESSAGE",
      deliveryContext: {
        isRedelivery: false
      }
    }]
  },

  postback: {
    destination: "U1234567890abcdef1234567890abcdef",
    events: [{
      type: "postback",
      replyToken: "test-reply-token-postback",
      timestamp: Date.now(),
      mode: "active",
      source: {
        type: "user",
        userId: "U9876543210fedcba9876543210fedcba"
      },
      postback: {
        data: "check_status"
      },
      webhookEventId: "01HDEBUG-POSTBACK",
      deliveryContext: {
        isRedelivery: false
      }
    }]
  }
};

/**
 * Test specific event type
 */
async function testEventType(eventType) {
  const mockEvent = mockEvents[eventType];

  if (!mockEvent) {
    console.log(`❌ Invalid event type: ${eventType}`);
    console.log('   Available types: follow, message, postback');
    return false;
  }

  console.log(`📍 Testing ${eventType.toUpperCase()} event...`);
  console.log(`   Payload:`, JSON.stringify(mockEvent, null, 2).substring(0, 200) + '...');

  const url = new URL(webhookUrl);
  const isHttps = url.protocol === 'https:';
  const client = isHttps ? https : http;

  // Generate signature (if CHANNEL_SECRET is available)
  const body = JSON.stringify(mockEvent);
  const signature = crypto
    .createHmac('sha256', process.env.CHANNEL_SECRET || 'test-secret')
    .update(body)
    .digest('base64');

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Line-Signature': signature,
        'User-Agent': 'SCORDS-Webhook-Tester/1.0'
      },
      body: body
    });

    const responseCode = response.status;
    const responseText = await response.text();

    console.log(`   Response Code: ${responseCode}`);
    console.log(`   Response Body: ${responseText || '(empty)'}`);

    if (responseCode === 200) {
      console.log(`   ✅ ${eventType.toUpperCase()} event: SUCCESS`);
      try {
        const responseJson = JSON.parse(responseText);
        if (responseJson.success) {
          console.log(`   ✓ Webhook returned success: true`);
        }
      } catch (e) {
        // Response might not be JSON
      }
      return true;
    } else {
      console.log(`   ❌ ${eventType.toUpperCase()} event: FAILED`);
      console.log(`   ℹ️ Expected: 200 OK`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ ${eventType.toUpperCase()} event: ERROR`);
    console.log(`   Error: ${error.message}`);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('════════════════════════════════════════════════════════');
  console.log('📊 TEST RESULTS');
  console.log('════════════════════════════════════════════════════════');
  console.log('');

  const results = [];

  // Test 1: Follow event
  console.log('📍 TEST 1: Follow Event (เมื่อ user แอด LINE OA)');
  console.log('──────────────────────────────────────────────────────');
  const followTest = await testEventType('follow');
  results.push({ test: 'Follow Event', success: followTest });
  console.log('');

  // Test 2: Message event
  console.log('📍 TEST 2: Message Event (เมื่อ user ส่งข้อความ "help")');
  console.log('──────────────────────────────────────────────────────');
  const messageTest = await testEventType('message');
  results.push({ test: 'Message Event', success: messageTest });
  console.log('');

  // Test 3: Postback event
  console.log('📍 TEST 3: Postback Event (เมื่อ user กดเมนู)');
  console.log('──────────────────────────────────────────────────────');
  const postbackTest = await testEventType('postback');
  results.push({ test: 'Postback Event', success: postbackTest });
  console.log('');

  // Summary
  console.log('════════════════════════════════════════════════════════');
  console.log('📊 TEST SUMMARY');
  console.log('════════════════════════════════════════════════════════');

  let passCount = 0;
  let failCount = 0;

  results.forEach(result => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${result.test.padEnd(20)} ${status}`);
    if (result.success) passCount++;
    else failCount++;
  });

  console.log('──────────────────────────────────────────────────────');
  console.log(`Total: ${passCount} passed, ${failCount} failed`);
  console.log('════════════════════════════════════════════════════════');

  // Additional checks
  console.log('');
  console.log('📋 ADDITIONAL CHECKS');
  console.log('──────────────────────────────────────────────────────');

  // Check URL format
  if (webhookUrl.includes('/api/scords/webhook')) {
    console.log('✅ Webhook URL format: Correct (includes /api/scords/webhook)');
  } else {
    console.log('⚠️  Webhook URL format: Warning (should include /api/scords/webhook)');
  }

  // Check if testing localhost
  if (webhookUrl.includes('localhost') || webhookUrl.includes('127.0.0.1')) {
    console.log('⚠️  Localhost detected: LINE cannot reach localhost');
    console.log('   Use ngrok or similar service for testing');
  }

  // Check environment variables
  if (process.env.CHANNEL_ACCESS_TOKEN || process.env.SCORDS_CHANNEL_ACCESS_TOKEN) {
    console.log('✅ LINE Channel Access Token: Set');
  } else {
    console.log('❌ LINE Channel Access Token: Not set');
  }

  if (process.env.CHANNEL_SECRET || process.env.SCORDS_CHANNEL_SECRET) {
    console.log('✅ LINE Channel Secret: Set');
  } else {
    console.log('❌ LINE Channel Secret: Not set');
  }

  console.log('');
  console.log('════════════════════════════════════════════════════════');
  console.log('✅ Test complete');
  console.log('════════════════════════════════════════════════════════');
  console.log('');

  // Exit with proper code
  process.exit(failCount > 0 ? 1 : 0);
}

// Run tests
runTests();
