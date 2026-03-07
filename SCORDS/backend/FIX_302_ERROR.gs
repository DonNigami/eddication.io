/**
 * 🔧 SCORDS LINE Webhook - 302 Error Fix Guide
 *
 * ปัญหา: Webhook returns HTTP 302 Found แทนี่ 200 OK
 * สาเหา: Google Apps Script Web App deployment settings
 */

// ============================================================
# สาเหาที่อาจเกิดขึ้น
# ============================================================

// 1. Web App URL ถูก redirect (พบบบ่อย)
// 2. Deployment type ไม่ถูกต้อง (ต้องเป็น Web App ไม่ใช่ API Executable)
// 3. Permissions ไม่ถูกต้อง (ต้องเป็น "Anyone")

// ============================================================
# วิธีแก้ไข (Step-by-Step Fix)
# ============================================================

/**
 * Step 1: Deploy ใหม่ Google Apps Script
 * ไปที่: Deploy → New deployment
 */
function fixGASDeployment() {
  console.log("═══════════════════════════════════════════════════");
  console.log("🔧 FIX: Google Apps Script Deployment Settings");
  console.log("═══════════════════════════════════════════════════");
  console.log("");
  console.log("📍 Step 1: Deploy as Web App (NOT API Executable)");
  console.log("──────────────────────────────────────────────────────");
  console.log("1. ไปที่ Google Apps Script Editor");
  console.log("2. คลิกปุ่ม 'Deploy' → 'New deployment'");
  console.log("");
  console.log("⚠️ สำคัญ:");
  console.log("   • Deploy as: Web App ✅ (ไม่ใช่ API Executable)");
  console.log("   • Description: SCORDS LINE Bot Webhook");
  console.log("   • Execute as: Me (email ของคุณ)");
  console.log("   • Who has access: Anyone ⭐ (สำคัญมากที่สุด)");
  console.log("");
  console.log("📍 Step 2: เลือก Version");
  console.log("──────────────────────────────────────────────────────");
  console.log("   • เลือก 'New' version (ไม่ใช่ 'Head')");
  console.log("   • ไม่ต้องเปลี่ยน version number");
  console.log("");
  console.log("📍 Step 3: Copy Web App URL");
  console.log("──────────────────────────────────────────────────────");
  console.log("   • URL จะเป็น: https://script.google.com/macros/s/XXX/exec");
  console.log("   ⚠️ คัดลอก URL นี้ให้ใช้ใน LINE Developers Console");
  console.log("");
  console.log("═══════════════════════════════════════════════════");
}

/**
 * Step 2: ตั้งค่า LINE Developers Console
 */
function fixLineConsole() {
  console.log("");
  console.log("📍 Step 2: ตั้งค่า Webhook URL ใน LINE Developers Console");
  console.log("──────────────────────────────────────────────────────");
  console.log("1. ไปที่ [LINE Developers Console]");
  console.log("   https://developers.line.biz/console/");
  console.log("");
  console.log("2. เลือก Channel → Messaging API → Webhook settings");
  console.log("");
  console.log("3. วาง Webhook URL:");
  console.log("   https://script.google.com/macros/s/XXX/exec");
  console.log("   (ใช้ URL จาก Step 1)");
  console.log("");
  console.log("⚠️ สำคัญ:");
  console.log("   • ไม่ม trailing slash ท้ายสุด (/)");
  console.log("   • ใช้ https: (ไม่ใช่ http:)");
  console.log("");
  console.log("4. คลิก 'Verify' → ต้องได้ ✅ 200 OK");
  console.log("   ❌ ถ้ายังได้ 302 Found → แก้ตาม steps ด้านล่าง");
  console.log("═══════════════════════════════════════════════════");
}

/**
 * Step 3: ตรวจสอบ GAS Script Properties
 */
function fixScriptProperties() {
  console.log("");
  console.log("📍 Step 3: ตรวจสอบ Script Properties");
  console.log("──────────────────────────────────────────────────────");
  console.log("1. ใน Google Apps Script Editor");
  console.log("2. คลิก 'Files' → 'Project properties (script.properties)'");
  console.log("");
  console.log("3. ตั้งค่า properties:");
  console.log("   • LINE_CHANNEL_ACCESS_TOKEN = <token>");
  console.log("   • LINE_CHANNEL_SECRET = <secret>");
  console.log("");
  console.log("⚠️ วิธีหา token/secret:");
  console.log("   • ไปที่ LINE Developers Console → Your Channel");
  console.log("   → Messaging API → Channel access token");
  console.log("   → Channel secret");
  console.log("");
  console.log("4. บันทึก:");
  console.log("   • PropertiesService.setScriptProperties(props);");
  console.log("   • หรือใช้ setupScriptProperties() function");
  console.log("═══════════════════════════════════════════════════");
}

/**
 * Step 4: เพิ่ม function ที่ขาดใน Code.gs
 */
function addRequiredFunctions() {
  console.log("");
  console.log("📍 Step 4: เพิ่ม Required Functions ใน Code.gs");
  console.log("──────────────────────────────────────────────────────");
  console.log("ตรวจสอบว่ามี functions ต่อไปนี้ใน Code.gs:");
  console.log("");
  console.log("✅ handleLineWebhook(requestData)");
  console.log("   → รองรับ LINE webhook events");
  console.log("");
  console.log("✅ createJsonResponse(data)");
  console.log("   → สร้าง JSON response with correct headers");
  console.log("");
  console.log("⚠️ ถ้ายังขาดเพิ่ม ให้ Code.gs ด้านล่าง");
  console.log("═══════════════════════════════════════════════════");
}

// ============================================================
# SOLUTION 1: อัปเดต doPost ให้ return 200 OK ชัวร์
# ============================================================

/**
 * แก้ไข doPost ให้ return 200 OK ทันที
 * เพิ่มฟังก์ชันต์ว่า GAS redirects
 */
function doPost_FIXED(e) {
  try {
    console.log("📥 [doPost] Request received");

    // Debug incoming request
    console.log("📥 Content-Type:", e.parameter.content_type);
    console.log("📥 Parameter action:", e.parameter.action);

    // Handle LINE Webhook
    if (e.postData && e.postData.contents) {
      const requestData = JSON.parse(e.postData.contents);

      // Check if this is a LINE webhook request
      const isLineWebhook = requestData.events || requestData.destination;

      if (isLineWebhook) {
        console.log("📱 LINE Webhook detected!");

        // Process webhook
        const result = handleLineWebhook(requestData);

        // CRITICAL: Return JSON response with proper MIME type
        return ContentService.createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON)
          .setContentString(result.success ? "SUCCESS" : "ERROR");
      }
    }

    // Handle other API requests with action parameter
    // ... (rest of code)

  } catch (error) {
    console.error("❌ [doPost] Error:", error);

    // Return error response
    const errorResponse = {
      success: false,
      message: error.message || "Server Error",
      error: error.toString()
    };

    return ContentService.createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON)
      .setContentString("ERROR");
  }
}

// ============================================================
# SOLUTION 2: ใช้ doOptions ร่วมกับ doPost
# ============================================================

/**
 * เพิ่ม doOptions เพื่อรองรับ OPTIONS preflight
 * แก้ปัญหา CORS preflight redirects
 */
function doOptions(e) {
  const output = ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: "SCORDS Webhook is ready"
  }));

  output.setMimeType(ContentService.MimeType.JSON);

  // Important: Set CORS headers
  output.setHeader('Access-Control-Allow-Origin', '*');
  output.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  output.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Line-Signature');

  return output;
}

// ============================================================
# SOLUTION 3: ตรวจสอบ Web App deployment
# ============================================================

/**
 * รัน function นี้ใน Google Apps Script Editor
 * เพื่อตรวจสอบ deployment settings
 */
function debug_checkDeployment() {
  console.log("════════════════════════════════════════════════════");
  console.log("🔍 Web App Deployment Check");
  console.log("════════════════════════════════════════════════════");
  console.log("");

  // Get deployments
  const deployments = ScriptApp.deployments();
  console.log("📦 Number of deployments: " + deployments.length);
  console.log("");

  for (let i = 0; i < deployments.length; i++) {
    const deployment = deployments[i];
    const deploymentId = deployment.getDeploymentId();
    const deploymentInfo = ScriptApp.getDeploymentInfo(deploymentId);

    console.log("Deployment " + (i + 1) + ":");
    console.log("  ID: " + deploymentId);
    console.log("  Description: " + deployment.getDescription());

    if (deploymentInfo) {
      const config = deploymentInfo.getWebAppConfig();
      console.log("  Type: Web App");

      console.log("  Execute as: " + config.getExecuteAs());
      console.log("  Access: " + config.getAccess());

      // Check if settings are correct
      if (config.getAccess() !== ScriptApp.Access.ANYONE) {
        console.log("  ⚠️  WARNING: Access is NOT 'Anyone'!");
        console.log("     This will cause LINE webhook to fail!");
      }

      if (deployment.getDescription() === "") {
        console.log("  ⚠️  WARNING: No description set");
      }
    }

    console.log("");
  }

  // Get web app URL
  const scriptId = ScriptApp.getScriptId();
  const webAppUrl = "https://script.google.com/macros/s/" + scriptId + "/exec";
  console.log("🔗 Web App URL:");
  console.log("   " + webAppUrl);
  console.log("");

  console.log("════════════════════════════════════════════════════");
  console.log("✅ Deployment check complete");
  console.log("════════════════════════════════════════════════════");
}

// ============================================================
# SOLUTION 4: เพิ่ม function createJsonResponse
# ============================================================

/**
 * สร้าง JSON response ที่มี headers ถูกต้อง
 * ป้องกันการ redirect ของ GAS
 */
function createJsonResponse(data) {
  const jsonString = JSON.stringify(data);

  return ContentService.createTextOutput(jsonString)
    .setMimeType(ContentService.MimeType.JSON)
    .setContentString(jsonString);
}

// ============================================================
# SOLUTION 5: Test webhook endpoint
# ============================================================

/**
 * Test webhook endpoint จากภายนอก
 * ใช้ curl หรือ Postman
 */
function testWebhookEndpoint() {
  console.log("════════════════════════════════════════════════════");
  console.log("🧪 Test Webhook Endpoint");
  console.log("════════════════════════════════════════════════════");
  console.log("");

  const scriptId = ScriptApp.getScriptId();
  const webhookUrl = "https://script.google.com/macros/s/" + scriptId + "/exec";

  console.log("🔗 Webhook URL: " + webhookUrl);
  console.log("");

  // Create test payload
  const testPayload = {
    destination: "U1234567890",
    events: [
      {
        type: "follow",
        replyToken: "test-reply-token",
        timestamp: Date.now(),
        mode: "active",
        source: {
          type: "user",
          userId: "U9876543210"
        },
        webhookEventId: "01HTEST"
      }
    ]
  };

  console.log("📤 Test Payload:");
  console.log(JSON.stringify(testPayload, null, 2));
  console.log("");

  // Send test request
  try {
    const response = UrlFetchApp.fetch(webhookUrl, {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        "X-Line-Signature": "test_signature" // Will fail validation but tests URL
      },
      payload: JSON.stringify(testPayload),
      muteHttpExceptions: true
    });

    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    console.log("📥 Response Code: " + responseCode);
    console.log("📥 Response Body:");
    console.log(responseBody || "(empty)");
    console.log("");

    if (responseCode === 200) {
      console.log("✅ SUCCESS: Webhook returns 200 OK");
    } else if (responseCode >= 300 && responseCode < 400) {
      console.log("❌ FAIL: Webhook returns redirect (" + responseCode + ")");
      console.log("   This is the problem! GAS is redirecting the request.");
      console.log("");
      console.log("🔧 FIX: Redeploy with correct settings:");
      console.log("   1. Deploy → New deployment");
      console.log("   2. Type: Web App");
      console.log("   3. Execute as: Me");
      console.log("   4. Who has access: Anyone");
    } else {
      console.log("❌ FAIL: Webhook returns " + responseCode);
    }

  } catch (error) {
    console.log("❌ Error testing webhook:");
    console.log(error.toString());
  }

  console.log("════════════════════════════════════════════════════");
}

// ============================================================
# QUICK FIX SUMMARY
# ============================================================

/**
 * สรุปปแก้ไของ่าย (Quick Fix)
 * รัน function นี้ใน Google Apps Script Editor
 */
function quickFix() {
  console.log("═══════════════════════════════════════════════════");
  console.log("🚀 QUICK FIX: 302 Error Solution");
  console.log("═══════════════════════════════════════════════════");
  console.log("");
  console.log("📍 Option 1: Redeploy Web App (แก้ได่ที่สุด)");
  console.log("──────────────────────────────────────────────────────");
  console.log("1. Deploy → New deployment");
  console.log("2. Description: SCORDS LINE Bot");
  console.log("3. Execute as: Me");
  console.log("   ⚠️ ใช้อ้อย email ของคุณ (service account จะไม่มี permission)");
  console.log("4. Who has access: Anyone");
  console.log("");
  console.log("📍 Option 2: Add doOptions function");
  console.log("──────────────────────────────────────────────────────");
  console.log("เพิ่ม function doOptions(e) ด้านบนของ Code.gs:");
  console.log("");
  console.log("function doOptions(e) {");
  console.log("  const output = ContentService.createTextOutput(JSON.stringify({");
  console.log("    success: true,");
  console.log("    message: 'SCORDS Webhook ready'");
  console.log("  }));");
  console.log("  output.setMimeType(ContentService.MimeType.JSON);");
  console.log("  return output;");
  console.log("}");
  console.log("");
  console.log("📍 Option 3: Fix URL format");
  console.log("──────────────────────────────────────────────────────");
  console.log("ตรวจสอบ webhook URL ใน LINE Developers Console:");
  console.log("✅ ใช้: https://script.google.com/macros/s/XXX/exec");
  console.log("❌ ห้ามใช้: https://script.google.com/macros/s/XXX/exec/");
  console.log("                                           ↑ ไม่ม / ท้ายสุด");
  console.log("════════════════════════════════════════════════════");
  console.log("");
  console.log("📋 Next Steps:");
  console.log("──────────────────────────────────────────────────────");
  console.log("1. Run debug_checkDeployment() in GAS Editor");
  console.log("2. Fix any deployment issues found");
  console.log("3. Run testWebhookEndpoint() to verify");
  console.log("4. Test with real LINE webhook from LINE Console");
  console.log("════════════════════════════════════════════════════");
}

// ============================================================
# EXPORT functions (สำหรับ run ใน GAS Editor)
# ============================================================

// Add to Code.gs and run these functions:

/**
 * Webhook handler หลักที่รองรับ LINE events
 */
function handleLineWebhook(requestData) {
  try {
    const events = requestData.events || [];
    const destination = requestData.destination;

    console.log("📱 LINE Webhook received");
    console.log("   Destination: " + destination);
    console.log("   Events: " + events.length);

    let processed = 0;
    const responses = [];

    for (const event of events) {
      try {
        const result = processLineEvent(event, requestData);
        responses.push(result);
        processed++;
      } catch (eventError) {
        console.error("❌ Error processing event:", eventError);
        responses.push({
          success: false,
          message: eventError.toString()
        });
      }
    }

    // Send LINE replies for message/follow events
    sendLineReplies(responses, requestData);

    return {
      success: true,
      processed: processed,
      responses: responses
    };

  } catch (error) {
    console.error("❌ handleLineWebhook error:", error);
    return {
      success: false,
      message: error.toString()
    };
  }
}

/**
 * Process individual LINE event
 */
function processLineEvent(event, requestData) {
  const eventType = event.type;
  const source = event.source;
  const timestamp = event.timestamp;

  console.log("   Processing: " + eventType + " from " + source.userId);

  switch (eventType) {
    case 'follow':
      return handleFollowEvent(event, requestData);
    case 'message':
      return handleMessageEvent(event, requestData);
    case 'postback':
      return handlePostbackEvent(event, requestData);
    default:
      console.log("   ⚠️ Unsupported event type: " + eventType);
      return { success: false, message: "Unsupported event type" };
  }
}

/**
 * Get LINE user profile
 */
function getLINEUserProfile(userId) {
  const token = PropertiesService.getScriptProperties().getProperty("LINE_CHANNEL_ACCESS_TOKEN");

  const response = UrlFetchApp.fetch(
    "https://api.line.biz/v2/bot/profile/" + userId,
    {
      method: "get",
      headers: {
        "Authorization": "Bearer " + token
      },
      muteHttpExceptions: true
    }
  );

  if (response.getResponseCode() === 200) {
    return JSON.parse(response.getContentText());
  }

  return null;
}

/**
 * Send reply via LINE Messaging API
 */
function sendLineReply(replyToken, message, channelAccessToken) {
  const response = UrlFetchApp.fetch(
    "https://api.line.biz/v2/bot/message/reply",
    {
      method: "post",
      headers: {
        "Authorization": "Bearer " + channelAccessToken,
        "Content-Type": "application/json"
      },
      payload: JSON.stringify({
        replyToken: replyToken,
        messages: [{ type: "text", text: message }]
      }),
      muteHttpExceptions: true
    }
  );

  return response.getResponseCode() === 200;
}

// ============================================================
# INSTRUCTIONS TO RUN
# ============================================================

/**
 * HOW TO USE:
 *
 * 1. Open Google Apps Script Editor (Code.gs)
 * 2. Scroll to bottom of file
 * 3. Add these helper functions
 * 4. Run quickFix() to see the fix guide
 *
 * OR run individual functions:
 * - debug_checkDeployment() - Check deployment settings
 * - testWebhookEndpoint() - Test webhook URL
 * - quickFix() - See all fixes
 */

