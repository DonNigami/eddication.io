/**
 * 🔍 SCORDS LINE Bot - Comprehensive Debug Tool
 *
 * รันฟังก์ชันนี้ใน Google Apps Script Editor
 * เพื่อหาปัญหา LINE Bot แบบละเอียด
 */

// ============================================================
// STEP 1: DIAGNOSTIC TEST
// ============================================================

/**
 * รันฟังก์ชันนี้เพื่อ diagnostic ทั้งหมด
 */
function debug_runFullDiagnostic() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║  🔍 SCORDS LINE Bot - Full Diagnostic              ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("");

  const results = {
    step1_basic: debug_basicChecks(),
    step2_deployment: debug_checkDeployment(),
    step3_lineToken: debug_checkLineToken(),
    step4_webhookTest: debug_testWebhookEndpoint(),
    step5_fullTest: debug_testFullFlow()
  };

  console.log("");
  console.log("════════════════════════════════════════════════════════");
  console.log("📊 DIAGNOSTIC SUMMARY");
  console.log("════════════════════════════════════════════════════════");

  let passCount = 0;
  let failCount = 0;

  for (const [step, result] of Object.entries(results)) {
    const status = result.success ? "✅ PASS" : "❌ FAIL";
    console.log(`${step}: ${status}`);

    if (result.success) {
      passCount++;
    } else {
      failCount++;
      console.log(`  └─ Error: ${result.error}`);
    }
  }

  console.log("");
  console.log(`Total: ${passCount} passed, ${failCount} failed`);
  console.log("════════════════════════════════════════════════════════");

  return results;
}

// ============================================================
// STEP 1: BASIC CHECKS
// ============================================================

function debug_basicChecks() {
  console.log("📍 STEP 1: Basic Checks");
  console.log("──────────────────────────────────────────────────────");

  const issues = [];

  // Check spreadsheet
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    console.log("✅ Spreadsheet: Connected");

    // Check required sheets
    const requiredSheets = ["Users", "Activities", "Checkin_Log"];
    for (const sheetName of requiredSheets) {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        issues.push(`Missing sheet: ${sheetName}`);
        console.log(`❌ Sheet "${sheetName}": NOT FOUND`);
      } else {
        console.log(`✅ Sheet "${sheetName}": OK`);
      }
    }
  } catch (error) {
    issues.push(`Spreadsheet error: ${error.message}`);
    console.log(`❌ Spreadsheet: ${error.message}`);
  }

  return {
    success: issues.length === 0,
    error: issues.join("; ")
  };
}

// ============================================================
// STEP 2: DEPLOYMENT CHECK
// ============================================================

function debug_checkDeployment() {
  console.log("");
  console.log("📍 STEP 2: Deployment Check");
  console.log("──────────────────────────────────────────────────────");

  const issues = [];

  // Get current script URL
  try {
    const scriptId = ScriptApp.getScriptId();
    const scriptUrl = `https://script.google.com/macros/s/${scriptId}/exec`;

    console.log(`📝 Script ID: ${scriptId}`);
    console.log(`🔗 Web App URL: ${scriptUrl}`);

    // Check if deployment exists
    const deployments = ScriptApp.deployments();
    console.log(`📦 Number of deployments: ${deployments.length}`);

    if (deployments.length === 0) {
      issues.push("No deployments found - must deploy as Web App");
      console.log("❌ No deployments found!");
    } else {
      deployments.forEach((deployment, index) => {
        console.log(`   Deployment ${index + 1}:`);
        console.log(`     - ID: ${deployment.getDeploymentId()}`);
        console.log(`     - Version: ${deployment.getVersion().getVersionNumber()}`);
        console.log(`     - Description: ${deployment.getDescription()}`);

        const deploymentId = deployment.getDeploymentId();
        const entry = ScriptApp.getDeploymentInfo(deploymentId);

        console.log(`     - Type: ${entry ? entry.getWebAppConfig().getExecuteAs() : 'Unknown'}`);

        // This will show if it's properly configured
        if (entry) {
          const config = entry.getWebAppConfig();
          console.log(`     - Execute as: ${config.getExecuteAs()}`);
          console.log(`     - Access: ${config.getAccess()}`);

          if (config.getAccess() !== "ANYONE") {
            issues.push("Deployment access is not 'ANYONE' - LINE cannot reach it");
            console.log(`     ⚠️  WARNING: Access should be 'ANYONE', got '${config.getAccess()}'`);
          }
        }
      });
    }
  } catch (error) {
    issues.push(`Deployment check error: ${error.message}`);
    console.log(`❌ Error: ${error.message}`);
  }

  return {
    success: issues.length === 0,
    error: issues.join("; ")
  };
}

// ============================================================
// STEP 3: LINE TOKEN CHECK
// ============================================================

function debug_checkLineToken() {
  console.log("");
  console.log("📍 STEP 3: LINE Token Check");
  console.log("──────────────────────────────────────────────────────");

  const token = ScriptProperties.getProperty("LINE_CHANNEL_ACCESS_TOKEN");

  if (!token) {
    console.log("❌ LINE_CHANNEL_ACCESS_TOKEN: NOT SET");
    console.log("   Run this to set:");
    console.log("   setupScriptProperties()");
    return {
      success: false,
      error: "LINE_CHANNEL_ACCESS_TOKEN not set in ScriptProperties"
    };
  }

  console.log("✅ LINE_CHANNEL_ACCESS_TOKEN: SET");
  console.log(`   Length: ${token.length} chars`);
  console.log(`   Preview: ${token.substring(0, 20)}...`);

  // Test token by making a simple API call
  try {
    const testUrl = "https://api.line.me/v2/bot/info";
    const response = UrlFetchApp.fetch(testUrl, {
      method: "get",
      headers: {
        "Authorization": `Bearer ${token}`
      },
      muteHttpExceptions: true
    });

    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      console.log("✅ Token validation: VALID");
      const botInfo = JSON.parse(response.getContentText());
      console.log(`   Bot Name: ${botInfo.displayName}`);
      console.log(`   Bot ID: ${botInfo.userId}`);
      return { success: true };
    } else {
      const responseBody = response.getContentText();
      console.log(`❌ Token validation: INVALID (${responseCode})`);
      console.log(`   Response: ${responseBody}`);

      return {
        success: false,
        error: `Token validation failed: ${responseCode} - ${responseBody}`
      };
    }
  } catch (error) {
    console.log(`❌ Token validation error: ${error.message}`);
    return {
      success: false,
      error: `Token validation error: ${error.message}`
    };
  }
}

// ============================================================
// STEP 4: WEBHOOK ENDPOINT TEST
// ============================================================

function debug_testWebhookEndpoint() {
  console.log("");
  console.log("📍 STEP 4: Webhook Endpoint Test");
  console.log("──────────────────────────────────────────────────────");

  const scriptId = ScriptApp.getScriptId();
  const webhookUrl = `https://script.google.com/macros/s/${scriptId}/exec`;

  console.log(`🔗 Testing endpoint: ${webhookUrl}`);

  // Simulate LINE webhook request
  const mockWebhook = {
    destination: "U1234567890abcdef1234567890abcdef",
    events: [
      {
        type: "message",
        message: {
          type: "text",
          text: "debug_test",
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

  console.log("📤 Sending mock webhook request...");

  try {
    const response = UrlFetchApp.fetch(webhookUrl, {
      method: "post",
      headers: {
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(mockWebhook),
      muteHttpExceptions: true
    });

    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    console.log(`📥 Response Code: ${responseCode}`);
    console.log(`📥 Response Body: ${responseBody}`);

    if (responseCode === 200) {
      console.log("✅ Webhook endpoint: WORKING");

      try {
        const responseObj = JSON.parse(responseBody);
        console.log(`   Success: ${responseObj.success}`);
        if (responseObj.data) {
          console.log(`   Processed: ${responseObj.data.processed} events`);
        }
      } catch (e) {
        // Response might not be JSON
      }

      return { success: true };
    } else {
      console.log("❌ Webhook endpoint: FAILED");
      return {
        success: false,
        error: `Webhook returned ${responseCode}: ${responseBody}`
      };
    }
  } catch (error) {
    console.log(`❌ Webhook test error: ${error.message}`);
    return {
      success: false,
      error: `Webhook test error: ${error.message}`
    };
  }
}

// ============================================================
// STEP 5: FULL FLOW TEST
// ============================================================

function debug_testFullFlow() {
  console.log("");
  console.log("📍 STEP 5: Full Flow Test");
  console.log("──────────────────────────────────────────────────────");

  try {
    // Test 1: Load spreadsheet
    console.log("📊 Test 1: Loading spreadsheet...");
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    console.log("✅ Spreadsheet loaded");

    // Test 2: Get user info
    console.log("👤 Test 2: Getting user info...");
    const users = getSheetData(ss.getSheetByName(SHEET_NAMES.USERS));
    console.log(`✅ Found ${users.length} users`);

    // Test 3: Test LINE webhook handler
    console.log("📱 Test 3: Testing LINE webhook handler...");
    const mockEvent = {
      destination: "U1234567890",
      events: [
        {
          type: "message",
          message: {
            type: "text",
            text: "help",
            id: "12345"
          },
          replyToken: "test-token",
          source: {
            userId: "test-user",
            type: "user"
          },
          timestamp: Date.now()
        }
      ]
    };

    const webhookResult = handleLineWebhook(mockEvent);
    console.log(`✅ Webhook handler: ${webhookResult.success ? "OK" : "FAILED"}`);

    if (!webhookResult.success) {
      console.log(`   Error: ${webhookResult.message}`);
    }

    return {
      success: webhookResult.success,
      error: webhookResult.message
    };
  } catch (error) {
    console.log(`❌ Full flow test error: ${error.message}`);
    console.log(`   Stack: ${error.stack}`);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================
// DEBUG SHEET LOGGER
// ============================================================

/**
 * สร้าง Debug Log Sheet และ log ทุกอย่าง
 */
function debug_enableSheetLogging() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let debugSheet = ss.getSheetByName("Debug_Log");

  if (!debugSheet) {
    debugSheet = ss.insertSheet("Debug_Log");
    debugSheet.appendRow([
      "Timestamp",
      "Level",
      "Component",
      "Message",
      "Data"
    ]);
    debugSheet.setFrozenRows(1);
  }

  console.log("✅ Debug logging enabled to 'Debug_Log' sheet");
  return "Debug_Log sheet created";
}

function debug_log(level, component, message, data = null) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const debugSheet = ss.getSheetByName("Debug_Log");

  if (debugSheet) {
    debugSheet.appendRow([
      new Date(),
      level,
      component,
      message,
      data ? JSON.stringify(data) : ""
    ]);
  }
}

// ============================================================
// MANUAL VERIFICATION
// ============================================================

/**
 * สร้าง Verification Checklist
 */
function debug_createVerificationChecklist() {
  console.log("════════════════════════════════════════════════════════");
  console.log("✅ VERIFICATION CHECKLIST");
  console.log("════════════════════════════════════════════════════════");
  console.log("");
  console.log("📱 LINE DEVELOPERS CONSOLE:");
  console.log("  [ ] Use webhook: Enabled");
  console.log("  [ ] Webhook URL: https://script.google.com/macros/s/XXX/exec");
  console.log("  [ ] Verify button shows: 200 OK");
  console.log("");
  console.log("🔧 GOOGLE APPS SCRIPT:");
  console.log("  [ ] Deploy type: Web app (NOT API Executable)");
  console.log("  [ ] Execute as: Me (your email)");
  console.log("  [ ] Who has access: Anyone");
  console.log("  [ ] Version: Latest (not Head)");
  console.log("");
  console.log("🔑 SCRIPT PROPERTIES:");
  console.log("  [ ] LINE_CHANNEL_ACCESS_TOKEN: Set");
  console.log("  [ ] Token length: ~172 characters");
  console.log("  [ ] Token validation: Successful");
  console.log("");
  console.log("📊 SPREADSHEET:");
  console.log("  [ ] Users sheet: Exists");
  console.log("  [ ] Activities sheet: Exists");
  console.log("  [ ] Checkin_Log sheet: Exists");
  console.log("");
  console.log("🧪 TESTING:");
  console.log("  [ ] debug_runFullDiagnostic(): All PASS");
  console.log("  [ ] Send 'help' in LINE: Bot responds");
  console.log("  [ ] Check Executions log: Shows webhook calls");
  console.log("════════════════════════════════════════════════════════");

  return "Checklist printed to console";
}
