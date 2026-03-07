/**
 * 🔧 LINE Webhook Test Tool
 *
 * Usage:
 *   node test-webhook.js <webhook-url>
 *
 * Example:
 *   node test-webhook.js https://your-domain.com/api/line-webhook
 *
 * This tool sends a mock LINE webhook request to your endpoint
 * to verify it's working correctly and not returning 302 redirects.
 */

const https = require('https');
const http = require('http');
const url = require('url');

// Mock LINE webhook event (similar to what LINE Platform sends)
const mockWebhook = {
  destination: "U1234567890abcdef1234567890abcdef",
  events: [
    {
      type: "message",
      message: {
        type: "text",
        text: "test_webhook_debug",
        id: "1234567890"
      },
      replyToken: "test-reply-token-debug",
      source: {
        userId: "U9876543210fedcba9876543210fedcba",
        type: "user"
      },
      timestamp: Date.now(),
      mode: "active",
      webhookEventId: "01HDEBUG",
      deliveryContext: {
        isRedelivery: false
      }
    }
  ]
};

/**
 * Test webhook endpoint
 */
async function testWebhook(webhookUrl) {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║  🔧 LINE Webhook Test Tool                          ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("");

  if (!webhookUrl) {
    console.error("❌ Error: Webhook URL required");
    console.log("Usage: node test-webhook.js <webhook-url>");
    console.log("");
    console.log("Example:");
    console.log("  node test-webhook.js https://your-domain.com/api/line-webhook");
    process.exit(1);
  }

  console.log(`🔗 Testing webhook: ${webhookUrl}`);
  console.log("");

  const parsedUrl = url.parse(webhookUrl);
  const isHttps = parsedUrl.protocol === 'https:';
  const client = isHttps ? https : http;

  // Test 1: Check if URL redirects (302)
  console.log("📍 Test 1: Checking for redirects...");
  await testForRedirects(webhookUrl, client);

  console.log("");

  // Test 2: Send actual webhook POST request
  console.log("📍 Test 2: Sending webhook POST request...");
  await testWebhookPost(webhookUrl, client);

  console.log("");
  console.log("════════════════════════════════════════════════════════");
  console.log("✅ Test complete");
  console.log("════════════════════════════════════════════════════════");
}

/**
 * Test for redirects
 */
async function testForRedirects(targetUrl, client) {
  return new Promise((resolve) => {
    const parsedUrl = url.parse(targetUrl);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.path,
      method: 'GET',
      headers: {
        'User-Agent': 'LINE-Webhook-Tester/1.0'
      }
    };

    const req = client.request(options, (res) => {
      console.log(`   Response Code: ${res.statusCode}`);

      if (res.statusCode >= 300 && res.statusCode < 400) {
        console.log(`   ⚠️  WARNING: Redirect detected!`);
        console.log(`   Location: ${res.headers.location}`);
        console.log(`   ℹ️  This may cause issues with LINE webhook. The webhook URL`);
        console.log(`      should return 200 directly, not redirect.`);
      } else if (res.statusCode === 200) {
        console.log(`   ✅ No redirect (GET returns 200)`);
      } else {
        console.log(`   ⚠️  Unexpected status code: ${res.statusCode}`);
      }

      resolve();
    });

    req.on('error', (err) => {
      console.log(`   ❌ Error: ${err.message}`);
      console.log(`   ℹ️  Make sure the server is running and the URL is correct`);
      resolve();
    });

    req.end();
  });
}

/**
 * Test webhook POST request
 */
async function testWebhookPost(webhookUrl, client) {
  return new Promise((resolve) => {
    const parsedUrl = url.parse(webhookUrl);
    const postData = JSON.stringify(mockWebhook);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'LINE-Webhook-Tester/1.0',
        'X-Line-Signature': 'test_signature_' + Date.now() // Mock signature
      }
    };

    console.log(`   Sending POST to: ${parsedUrl.pathname}`);
    console.log(`   Payload size: ${postData.length} bytes`);

    const req = client.request(options, (res) => {
      console.log(`   Response Code: ${res.statusCode}`);

      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        console.log(`   Response Body: ${responseData || '(empty)'}`);

        if (res.statusCode === 200) {
          console.log(`   ✅ SUCCESS: Webhook returned 200 OK`);
          try {
            const responseObj = JSON.parse(responseData);
            if (responseObj.success) {
              console.log(`   ✅ Response indicates success: true`);
            } else {
              console.log(`   ⚠️  Response indicates success: false`);
              if (responseObj.message) {
                console.log(`   Message: ${responseObj.message}`);
              }
            }
          } catch (e) {
            console.log(`   ℹ️  Response is not JSON (this is okay for 200 OK)`);
          }
        } else if (res.statusCode >= 300 && res.statusCode < 400) {
          console.log(`   ❌ FAIL: Webhook returned redirect (${res.statusCode})`);
          console.log(`   Location: ${res.headers.location || '(not specified)'}`);
          console.log(`   ℹ️  LINE Platform does NOT follow redirects. You must fix this.`);
          console.log(`   Common causes:`);
          console.log(`      - Trailing slash mismatch (check LINE Developers Console)`);
          console.log(`      - HTTP to HTTPS redirect (use HTTPS in webhook URL)`);
          console.log(`      - Reverse proxy misconfiguration`);
        } else {
          console.log(`   ❌ FAIL: Webhook returned ${res.statusCode}`);
          console.log(`   ℹ️  Expected: 200 OK`);
        }

        resolve();
      });
    });

    req.on('error', (err) => {
      console.log(`   ❌ Error: ${err.message}`);
      console.log(`   ℹ️  Make sure the server is running and accessible`);
      resolve();
    });

    req.write(postData);
    req.end();
  });
}

// Run test if called directly
if (require.main === module) {
  const webhookUrl = process.argv[2];
  testWebhook(webhookUrl);
}

module.exports = { testWebhook, mockWebhook };
