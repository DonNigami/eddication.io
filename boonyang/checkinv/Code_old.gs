/**
 * Boonyang CheckInv - LINE Bot for Outstanding Balance Inquiry
 *
 * ระบบตรวจสอบยอดคงค้างผ่าน LINE Messaging API
 * ให้ลูกค้าสามารถตรวจสอบยอดคงค้างได้ด้วยตนเอง
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIGURATION (Loaded from ScriptProperties)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SHEET_NAMES = {
  AR: "AccountReceivables",     // ข้อมูลยอดคงค้าง
  CUSTOMERS: "Customers",        // ข้อมูลลูกค้าที่ลงทะเบียน
  LOG: "MessageLog",             // บันทึกข้อความ
  ADMINS: "Admins",             // รายชื่อ Admin (อ่านจาก Sheet)
  USER_PROFILES: "UserProfiles" // เก็บข้อมูลผู้ใช้ที่ follow
};

/**
 * Get configuration value from ScriptProperties
 * @param {string} key - Property key
 * @returns {string} Property value or empty string if not found
 */
function getConfig(key) {
  const scriptProperties = PropertiesService.getScriptProperties();
  return scriptProperties.getProperty(key) || "";
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WEBHOOK HANDLERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Handle GET requests (for testing)
 * @param {Object} e - Event parameter
 * @returns {Object} Response
 */
function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === "health") {
      return createJsonResponse({
        success: true,
        status: "healthy",
        timestamp: new Date().toISOString(),
        message: "Boonyang CheckInv API is running"
      });
    }

    return createJsonResponse({
      success: true,
      message: "Boonyang CheckInv Webhook is ready"
    });

  } catch (error) {
    console.error("doGet Error: " + error.toString());
    return createJsonResponse({
      success: false,
      error: error.message
    });
  }
}

/**
 * Handle POST requests (LINE Webhook)
 * @param {Object} e - Event parameter
 * @returns {Object} Response
 */
function doPost(e) {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║ 🔴 doPost() CALLED - WEBHOOK RECEIVED              ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("Timestamp: " + new Date().toISOString());

  try {
    if (!e.postData) {
      console.error("❌ No postData found");
      return createJsonResponse({
        success: false,
        error: "No postData received"
      });
    }

    if (!e.postData.contents) {
      console.error("❌ postData has no contents");
      return createJsonResponse({
        success: false,
        error: "postData has no contents"
      });
    }

    const requestData = JSON.parse(e.postData.contents);
    console.log("✅ Parsed webhook data");

    // Detect LINE Webhook
    const isLineWebhook = requestData.events || requestData.destination;

    if (isLineWebhook) {
      console.log("📱 LINE Webhook detected");
      console.log("Events: " + (requestData.events ? requestData.events.length : 0));

      const result = handleLineWebhook(requestData);

      console.log("✅ Webhook processed successfully");
      return createJsonResponse(result);
    }

    // Handle other requests with 'action' parameter
    const action = requestData.action;

    switch (action) {
      case "register":
        return createJsonResponse(registerCustomer(requestData));

      default:
        return createJsonResponse({
          success: false,
          error: "Unknown action: " + action
        });
    }

  } catch (error) {
    console.error("❌ doPost Error: " + error.toString());
    console.error(error.stack);

    return createJsonResponse({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}

/**
 * Handle OPTIONS requests (CORS Preflight)
 * @param {Object} e - Event parameter
 * @returns {Object} Response
 */
function doOptions(e) {
  console.log("🔑 CORS Preflight Request (OPTIONS)");

  const output = ContentService.createTextOutput("");
  output.setMimeType(ContentService.MimeType.JSON);

  // Set CORS headers for preflight requests
  output.setHeader("Access-Control-Allow-Origin", "*");
  output.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  output.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  output.setHeader("Access-Control-Max-Age", "3600");

  return output;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LINE WEBHOOK & MESSAGING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Handle LINE Webhook events
 * @param {Object} requestData - Webhook request data
 * @returns {Object} Response
 */
function handleLineWebhook(requestData) {
  const { events } = requestData;

  if (!events || events.length === 0) {
    return { success: true, message: "No events to process" };
  }

  const results = [];

  for (const event of events) {
    try {
      // Handle message event
      if (event.type === "message" && event.message.type === "text") {
        const result = handleLineMessage(event);
        results.push(result);
      }
      // Handle follow event
      else if (event.type === "follow") {
        const result = handleLineFollow(event);
        results.push(result);
      }
      // Handle unfollow event
      else if (event.type === "unfollow") {
        const result = handleLineUnfollow(event);
        results.push(result);
      }
      // Handle other event types
      else {
        results.push({
          success: true,
          message: `Event type "${event.type}" received but not processed`
        });
      }
    } catch (error) {
      console.error("Error processing LINE event: " + error.toString());
      results.push({
        success: false,
        error: error.message,
        eventType: event.type
      });
    }
  }

  return {
    success: true,
    processed: results.length
  };
}

/**
 * Handle LINE message event
 * @param {Object} event - LINE webhook event
 * @returns {Object} Response
 */
function handleLineMessage(event) {
  const { replyToken, source, message } = event;
  const userId = source?.userId;
  const text = message?.text || "";

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📱 LINE Message Received");
  console.log("User ID: " + userId);
  console.log("Message: \"" + text + "\"");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    // Check for special commands
    const lowerText = text.trim().toLowerCase();

    // Admin commands
    if (lowerText.startsWith("admin ")) {
      if (!isAdmin(userId)) {
        const msg = "❌ คำสั่งนี้สงวนสำหรับ Admin เท่านั้น";
        sendLineReply(replyToken, msg);
        return { success: true, action: "admin_unauthorized" };
      }
      return handleAdminCommand(replyToken, userId, text);
    }

    // Outstanding balance command
    if (lowerText === "ยอดคงค้าง") {
      console.log("✅ Outstanding balance command detected");

      const customer = getCustomerByLineId(userId);

      if (!customer) {
        const msg = "❌ คุณยังไม่ได้ลงทะเบียนในระบบ\n\n" +
                    "กรุณาลงทะเบียนก่อนใช้งานครับ 🙏\n\n" +
                    "📝 ลงทะเบียนที่: [LIFF URL]";

        sendLineReply(replyToken, msg);
        logMessage(userId, text, msg);
        return { success: true, action: "balance_check", registered: false };
      }

      // Check approval status
      if (customer.status === "pending") {
        const msg = "⏳ บัญชีของคุณอยู่ระหว่างการตรวจสอบ\n\n" +
                    "เจ้าหน้าที่จะดำเนินการอนุมัติภายใน 24 ชั่วโมง\n\n" +
                    "หากมีคำถาม ติดต่อผู้ดูแลระบบ 📞";

        sendLineReply(replyToken, msg);
        logMessage(userId, text, msg);
        return { success: true, action: "balance_check", status: "pending" };
      }

      if (customer.status === "inactive") {
        const msg = "⚠️ บัญชีของคุณถูกระงับชั่วคราว\n\n" +
                    "กรุณาติดต่อผู้ดูแลระบบ 📞";

        sendLineReply(replyToken, msg);
        logMessage(userId, text, msg);
        return { success: true, action: "balance_check", status: "inactive" };
      }

      const shopName = customer.shopName;
      console.log("🏪 Shop: " + shopName);

      const balance = getOutstandingBalance(shopName);

      if (balance <= 0) {
        const msg = "✅ ร้าน " + shopName + "\n\n" +
                    "ยอดคงค้าง: 0.00 บาท\n\n" +
                    "ขอบคุณที่ใช้บริการครับ 🙏";

        sendLineReply(replyToken, msg);
        logMessage(userId, text, msg);
        return { success: true, action: "balance_check", balance: 0 };
      }

      const formattedBalance = formatCurrency(balance);
      const msg = "📊 ร้าน " + shopName + "\n\n" +
                  "💰 ยอดคงค้าง: " + formattedBalance + " บาท\n\n" +
                  "กรุณาชำระภายในกำหนดครับ 🙏";

      sendLineReply(replyToken, msg);
      logMessage(userId, text, msg);

      console.log("✅ Balance sent: " + formattedBalance);
      return { success: true, action: "balance_check", balance: balance };
    }

    // Help command
    if (lowerText === "help" || lowerText === "ช่วยเหลือ" || lowerText === "วิธีใช้") {
      const msg = "📖 วิธีใช้ระบบตรวจสอบยอดคงค้าง\n\n" +
                  "พิมพ์: ยอดคงค้าง\n" +
                  "เพื่อตรวจสอบยอดคงค้างของร้านคุณ\n\n" +
                  "❓ ติดต่อผู้ดูแลระบบ";

      sendLineReply(replyToken, msg);
      return { success: true, action: "help" };
    }

    // Unknown command
    const msg = "❓ ไม่เข้าใจคำสั่งที่พิมพ์\n\n" +
                "พิมพ์ \"ยอดคงค้าง\" เพื่อตรวจสอบยอด\n" +
                "หรือพิมพ์ \"help\" เพื่อดูวิธีใช้";

    sendLineReply(replyToken, msg);
    return { success: true, action: "unknown_command" };

  } catch (error) {
    console.error("❌ Error in handleLineMessage: " + error.toString());

    const errorMsg = "⚠️ เกิดข้อผิดพลาดกรุณาลองใหม่ภายหลัง";
    sendLineReply(replyToken, errorMsg);

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Handle LINE follow event
 * @param {Object} event - LINE webhook event
 * @returns {Object} Response
 */
function handleLineFollow(event) {
  const { replyToken, source } = event;
  const userId = source?.userId;

  console.log("👤 New follower: " + userId);

  // Get and save user profile
  const userProfile = getUserProfile(userId);
  if (userProfile) {
    saveUserProfile(userProfile);
    console.log("✅ User profile saved: " + userId);

    // Notify admin via Telegram
    const telegramMsg = "👤 ผู้ใช้ใหม่ติดตามบอท\n\n" +
                        "ชื่อ: " + userProfile.displayName + "\n" +
                        "LINE User ID: " + userId + "\n" +
                        "ภาษา: " + userProfile.language + "\n" +
                        "เวลา: " + formatDate(new Date());

    sendTelegramNotification(telegramMsg);
  }

  const msg = "🙏 สวัสดีครับ ยินดีต้อนรับสู่ระบบตรวจสอบยอดคงค้าง\n\n" +
              "เพื่อใช้งานระบบ กรุณาลงทะเบียนที่:\n[LIFF URL]\n\n" +
              "หลังจากลงทะเบียนแล้ว สามารถพิมพ์ \"ยอดคงค้าง\" " +
              "เพื่อตรวจสอบยอดได้ทันทีครับ";

  sendLineReply(replyToken, msg);

  return { success: true, action: "follow" };
}

/**
 * Handle LINE unfollow event
 * @param {Object} event - LINE webhook event
 * @returns {Object} Response
 */
function handleLineUnfollow(event) {
  const { source } = event;
  const userId = source?.userId;

  console.log("👋 User unfollowed: " + userId);

  // Delete user profile
  const deleted = deleteUserProfile(userId);

  if (deleted) {
    console.log("✅ User profile deleted: " + userId);
  } else {
    console.log("⚠️ User profile not found or already deleted: " + userId);
  }

  return { success: true, action: "unfollow" };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USER PROFILE FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get user profile from LINE API
 * @param {string} userId - LINE User ID
 * @returns {Object|null} User profile or null
 */
function getUserProfile(userId) {
  console.log("👤 Getting user profile: " + userId);

  try {
    const response = UrlFetchApp.fetch(
      "https://api.line.biz/v2/bot/profile/" + userId,
      {
        method: "get",
        headers: {
          "Authorization": "Bearer " + getConfig('LINE_CHANNEL_ACCESS_TOKEN')
        },
        muteHttpExceptions: true
      }
    );

    const responseCode = response.getResponseCode();

    if (responseCode !== 200) {
      console.error("❌ LINE API Error: " + responseCode);
      console.error(response.getContentText());
      return null;
    }

    const profile = JSON.parse(response.getContentText());

    const userProfile = {
      userId: profile.userId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl || "",
      statusMessage: profile.statusMessage || "",
      language: profile.language || "th",
      followTime: new Date().toISOString()
    };

    console.log("✅ User profile retrieved: " + userProfile.displayName);
    return userProfile;

  } catch (error) {
    console.error("❌ Error in getUserProfile: " + error.toString());
    return null;
  }
}

/**
 * Save user profile to UserProfiles sheet
 * @param {Object} profile - User profile from LINE API
 * @returns {boolean} Success status
 */
function saveUserProfile(profile) {
  console.log("💾 Saving user profile: " + profile.userId);

  try {
    const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
    const profilesSheet = ss.getSheetByName(SHEET_NAMES.USER_PROFILES);

    if (!profilesSheet) {
      console.error("❌ UserProfiles sheet not found");
      return false;
    }

    // Check if user already exists
    const data = profilesSheet.getDataRange().getValues();
    let existingRowIndex = -1;

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === profile.userId) {
        existingRowIndex = i;
        break;
      }
    }

    if (existingRowIndex > 0) {
      // Update existing record
      profilesSheet.getRange(existingRowIndex + 1, 2).setValue(profile.displayName);
      profilesSheet.getRange(existingRowIndex + 1, 3).setValue(profile.pictureUrl);
      profilesSheet.getRange(existingRowIndex + 1, 4).setValue(profile.statusMessage);
      profilesSheet.getRange(existingRowIndex + 1, 5).setValue(profile.language);
      profilesSheet.getRange(existingRowIndex + 1, 7).setValue("following");
      profilesSheet.getRange(existingRowIndex + 1, 8).setValue(new Date());

      console.log("✅ User profile updated: " + profile.userId);
    } else {
      // Add new record
      profilesSheet.appendRow([
        profile.userId,
        profile.displayName,
        profile.pictureUrl,
        profile.statusMessage,
        profile.language,
        profile.followTime,
        "following",
        new Date()
      ]);

      console.log("✅ User profile saved: " + profile.userId);
    }

    return true;

  } catch (error) {
    console.error("❌ Error in saveUserProfile: " + error.toString());
    return false;
  }
}

/**
 * Delete user profile from UserProfiles sheet
 * @param {string} userId - LINE User ID
 * @returns {boolean} Success status
 */
function deleteUserProfile(userId) {
  console.log("🗑️ Deleting user profile: " + userId);

  try {
    const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
    const profilesSheet = ss.getSheetByName(SHEET_NAMES.USER_PROFILES);

    if (!profilesSheet) {
      console.error("❌ UserProfiles sheet not found");
      return false;
    }

    const data = profilesSheet.getDataRange().getValues();

    // Find and delete row
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === userId) {
        profilesSheet.deleteRow(i + 1);
        console.log("✅ User profile deleted: " + userId);
        return true;
      }
    }

    console.log("⚠️ User profile not found: " + userId);
    return false;

  } catch (error) {
    console.error("❌ Error in deleteUserProfile: " + error.toString());
    return false;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ACCOUNT RECEIVABLES FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get outstanding balance for a shop
 * @param {string} shopName - Shop name to search for
 * @returns {number} Outstanding balance
 */
function getOutstandingBalance(shopName) {
  console.log("💰 Getting outstanding balance for: " + shopName);

  try {
    const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
    const arSheet = ss.getSheetByName(SHEET_NAMES.AR);

    if (!arSheet) {
      console.error("❌ AccountReceivables sheet not found");
      return 0;
    }

    // Get all data
    const data = arSheet.getDataRange().getValues();

    // Remove header row if exists
    const rows = data.length > 0 && data[0][0] === "เลขที่เอกสาร"
      ? data.slice(1)
      : data;

    let totalBalance = 0;
    let currentShopName = null;

    // Column indices (0-based)
    const COL_B = 1; // Shop name
    const COL_G = 6; // "ยอดรวม"
    const COL_H = 7; // Amount

    console.log("📊 Processing " + rows.length + " rows...");

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cellB = row[COL_B]; // Shop name
      const cellG = row[COL_G]; // "ยอดรวม" or empty
      const cellH = row[COL_H]; // Amount

      // Update current shop name when we find a shop name in Column B
      if (cellB && cellB.toString().trim() !== "") {
        currentShopName = cellB.toString().trim();
      }

      // Check if this is a "ยอดรวม" row
      if (cellG && cellG.toString().trim() === "ยอดรวม") {
        // Check if the current shop matches the one we're looking for
        if (currentShopName === shopName) {
          // Add the amount from Column H
          const amount = parseFloat(cellH) || 0;
          totalBalance += amount;

          console.log("  ✓ Found: " + currentShopName + " = " + amount);
        }
      }
    }

    console.log("💰 Total balance for " + shopName + ": " + totalBalance);
    return totalBalance;

  } catch (error) {
    console.error("❌ Error in getOutstandingBalance: " + error.toString());
    console.error(error.stack);
    return 0;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CUSTOMER MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Get customer by LINE User ID
 * @param {string} lineUserId - LINE User ID
 * @returns {Object|null} Customer data or null
 */
function getCustomerByLineId(lineUserId) {
  console.log("👤 Looking up customer: " + lineUserId);

  try {
    const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
    const customersSheet = ss.getSheetByName(SHEET_NAMES.CUSTOMERS);

    if (!customersSheet) {
      console.error("❌ Customers sheet not found");
      return null;
    }

    const data = customersSheet.getDataRange().getValues();

    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // Column B (index 1) is LINE User ID
      if (row[1] === lineUserId) {
        const customer = {
          timestamp: row[0],
          lineUserId: row[1],
          fullName: row[2],
          shopName: row[3],
          taxId: row[4],
          status: row[5] || "active"
        };

        console.log("✅ Customer found: " + customer.shopName);
        return customer;
      }
    }

    console.log("⚠️ Customer not found");
    return null;

  } catch (error) {
    console.error("❌ Error in getCustomerByLineId: " + error.toString());
    return null;
  }
}

/**
 * Register new customer
 * @param {Object} data - Registration data
 * @returns {Object} Registration result
 */
function registerCustomer(data) {
  console.log("📝 Registering customer: " + data.shopName);

  try {
    const { lineUserId, fullName, shopName, taxId } = data;

    // Validate required fields
    if (!lineUserId || !fullName || !shopName || !taxId) {
      return {
        success: false,
        message: "กรุณากรอกข้อมูลให้ครบถ้วน"
      };
    }

    // Check if already registered
    const existing = getCustomerByLineId(lineUserId);
    if (existing) {
      return {
        success: false,
        message: "LINE User ID นี้ลงทะเบียนแล้ว"
      };
    }

    // Validate tax ID format (13 digits)
    const taxIdClean = taxId.replace(/[^0-9]/g, '');
    if (taxIdClean.length !== 13) {
      return {
        success: false,
        message: "เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก"
      };
    }

    // Verify shop name exists in AccountReceivables
    const balance = getOutstandingBalance(shopName);
    if (balance === 0 && !shopExistsInAR(shopName)) {
      return {
        success: false,
        message: "ไม่พบชื่อร้านค้า " + shopName + " ในระบบ กรุณาติดต่อผู้ดูแล"
      };
    }

    // Save to spreadsheet
    const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
    const customersSheet = ss.getSheetByName(SHEET_NAMES.CUSTOMERS);

    customersSheet.appendRow([
      new Date(),
      lineUserId,
      fullName,
      shopName,
      taxIdClean,
      "pending" // เปลี่ยนจาก "active" เป็น "pending" รอการอนุมัติ
    ]);

    console.log("✅ Customer registered successfully (pending approval)");

    // แจ้ง admin (ถ้ามีการตั้งค่า)
    notifyAdminNewCustomer({
      lineUserId: lineUserId,
      fullName: fullName,
      shopName: shopName,
      taxId: taxIdClean
    });

    return {
      success: true,
      message: "ลงทะเบียนสำเร็จครับ 🎉\n\n" +
               "บัญชีของคุณอยู่ระหว่างการตรวจสอบ\n" +
               "เจ้าหน้าที่จะดำเนินการอนุมัติภายใน 24 ชั่วโมง\n\n" +
               "เมื่ออนุมัติแล้ว จะสามารถพิมพ์ \"ยอดคงค้าง\" " +
               "เพื่อตรวจสอบยอดได้ทันทีครับ"
    };

  } catch (error) {
    console.error("❌ Error in registerCustomer: " + error.toString());

    return {
      success: false,
      message: "เกิดข้อผิดพลาด: " + error.message
    };
  }
}

/**
 * Check if shop name exists in AccountReceivables sheet
 * @param {string} shopName - Shop name to check
 * @returns {boolean} True if shop exists
 */
function shopExistsInAR(shopName) {
  try {
    const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
    const arSheet = ss.getSheetByName(SHEET_NAMES.AR);

    if (!arSheet) return false;

    const data = arSheet.getDataRange().getValues();
    const COL_B = 1; // Shop name column

    for (let i = 0; i < data.length; i++) {
      const cellB = data[i][COL_B];
      if (cellB && cellB.toString().trim() === shopName) {
        return true;
      }
    }

    return false;

  } catch (error) {
    console.error("❌ Error in shopExistsInAR: " + error.toString());
    return false;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MESSAGING & LOGGING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Send reply via LINE Messaging API
 * @param {string} replyToken - Reply token from LINE event
 * @param {string} message - Message to send
 */
function sendLineReply(replyToken, message) {
  console.log("📤 Sending LINE reply...");

  try {
    const response = UrlFetchApp.fetch(
      "https://api.line.biz/v2/bot/message/reply",
      {
        method: "post",
        headers: {
          "Authorization": "Bearer " + getConfig('LINE_CHANNEL_ACCESS_TOKEN'),
          "Content-Type": "application/json"
        },
        payload: JSON.stringify({
          replyToken: replyToken,
          messages: [
            {
              type: "text",
              text: message
            }
          ]
        }),
        muteHttpExceptions: true
      }
    );

    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode !== 200) {
      console.error("❌ LINE API Error: " + responseCode);
      console.error(responseBody);
    } else {
      console.log("✅ Reply sent successfully");
    }

  } catch (error) {
    console.error("❌ Error in sendLineReply: " + error.toString());
  }
}

/**
 * Log message to MessageLog sheet
 * @param {string} userId - LINE User ID
 * @param {string} incomingMessage - Message from user
 * @param {string} replyMessage - Message sent to user
 */
function logMessage(userId, incomingMessage, replyMessage) {
  try {
    const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
    const logSheet = ss.getSheetByName(SHEET_NAMES.LOG);

    if (!logSheet) {
      console.warn("⚠️ MessageLog sheet not found, skipping log");
      return;
    }

    logSheet.appendRow([
      new Date(),
      userId,
      incomingMessage,
      replyMessage
    ]);

  } catch (error) {
    console.error("❌ Error in logMessage: " + error.toString());
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ADMIN FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Check if user is admin
 * @param {string} userId - LINE User ID
 * @returns {boolean} True if admin
 */
function isAdmin(userId) {
  try {
    const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
    const adminsSheet = ss.getSheetByName(SHEET_NAMES.ADMINS);

    if (!adminsSheet) {
      console.warn("⚠️ Admins sheet not found");
      return false;
    }

    const data = adminsSheet.getDataRange().getValues();

    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const status = row[4] || "active";

      // Check if LINE User ID matches and status is active
      if (row[1] === userId && status === "active") {
        console.log("✅ User is admin: " + userId);
        return true;
      }
    }

    console.log("⚠️ User is not admin: " + userId);
    return false;

  } catch (error) {
    console.error("❌ Error in isAdmin: " + error.toString());
    return false;
  }
}

/**
 * Notify all admins with a message
 * @param {string} message - Message to send
 */
function notifyAdmins(message) {
  console.log("🔔 Notifying admins");

  try {
    const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
    const adminsSheet = ss.getSheetByName(SHEET_NAMES.ADMINS);

    if (!adminsSheet) {
      console.warn("⚠️ Admins sheet not found");
      return;
    }

    const data = adminsSheet.getDataRange().getValues();
    let notifiedCount = 0;

    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const status = row[4] || "active";

      // Send to active admins only
      if (row[1] && status === "active") {
        const adminUserId = row[1];

        try {
          UrlFetchApp.fetch(
            "https://api.line.biz/v2/bot/message/push",
            {
              method: "post",
              headers: {
                "Authorization": "Bearer " + getConfig('LINE_CHANNEL_ACCESS_TOKEN'),
                "Content-Type": "application/json"
              },
              payload: JSON.stringify({
                to: adminUserId,
                messages: [
                  {
                    type: "text",
                    text: message
                  }
                ]
              }),
              muteHttpExceptions: true
            }
          );
          notifiedCount++;
        } catch (error) {
          console.error("❌ Error notifying admin " + adminUserId + ": " + error.toString());
        }
      }
    }

    console.log("✅ Notified " + notifiedCount + " admins");

  } catch (error) {
    console.error("❌ Error in notifyAdmins: " + error.toString());
  }
}

/**
 * Handle admin commands
 * @param {string} replyToken - Reply token
 * @param {string} adminUserId - Admin LINE User ID
 * @param {string} text - Command text
 * @returns {Object} Response
 */
function handleAdminCommand(replyToken, adminUserId, text) {
  const parts = text.trim().split(/\s+/);
  const command = parts[1].toLowerCase();

  console.log("🔑 Admin command: " + command + " from " + adminUserId);

  switch (command) {
    case "pending":
      return handleAdminPending(replyToken);

    case "approve":
      if (parts.length < 3) {
        const msg = "❌ รูปแบบคำสั่งไม่ถูกต้อง\n\n" +
                    "วิธีใช้: admin approve {LINE_USER_ID}";
        sendLineReply(replyToken, msg);
        return { success: false, error: "Missing LINE User ID" };
      }
      return handleAdminApprove(replyToken, parts[2]);

    case "reject":
      if (parts.length < 3) {
        const msg = "❌ รูปแบบคำสั่งไม่ถูกต้อง\n\n" +
                    "วิธีใช้: admin reject {LINE_USER_ID} {เหตุผล}";
        sendLineReply(replyToken, msg);
        return { success: false, error: "Missing LINE User ID" };
      }
      const reason = parts.slice(3).join(" ") || "ไม่ระบุ";
      return handleAdminReject(replyToken, parts[2], reason);

    case "status":
      if (parts.length < 3) {
        const msg = "❌ รูปแบบคำสั่งไม่ถูกต้อง\n\n" +
                    "วิธีใช้: admin status {LINE_USER_ID}";
        sendLineReply(replyToken, msg);
        return { success: false, error: "Missing LINE User ID" };
      }
      return handleAdminStatus(replyToken, parts[2]);

    case "help":
      const helpMsg = "📖 Admin Commands\n\n" +
                      "• admin pending\n" +
                      "  ดูรายชื่อลูกค้าที่รออนุมัติ\n\n" +
                      "• admin approve {LINE_USER_ID}\n" +
                      "  อนุมัติบัญชีลูกค้า\n\n" +
                      "• admin reject {LINE_USER_ID} {เหตุผล}\n" +
                      "  ปฏิเสธ/ระงับบัญชี\n\n" +
                      "• admin status {LINE_USER_ID}\n" +
                      "  ดูสถานะบัญชี\n\n" +
                      "• admin count\n" +
                      "  ดูจำนวนลูกค้าทั้งหมด\n\n" +
                      "• admin add {LINE_USER_ID} {ชื่อ}\n" +
                      "  เพิ่ม Admin ใหม่\n\n" +
                      "• admin remove {LINE_USER_ID}\n" +
                      "  ลบ Admin\n\n" +
                      "• admin list\n" +
                      "  ดูรายชื่อ Admin ทั้งหมด";
      sendLineReply(replyToken, helpMsg);
      return { success: true, action: "admin_help" };

    case "count":
      return handleAdminCount(replyToken);

    default:
      const msg = "❌ ไม่รู้จักคำสั่ง: " + command + "\n\n" +
                  "พิมพ์ \"admin help\" เพื่อดูคำสั่งทั้งหมด";
      sendLineReply(replyToken, msg);
      return { success: false, error: "Unknown command" };
  }
}

/**
 * Admin: List pending customers
 * @param {string} replyToken - Reply token
 * @returns {Object} Response
 */
function handleAdminPending(replyToken) {
  console.log("📋 Listing pending customers");

  try {
    const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
    const customersSheet = ss.getSheetByName(SHEET_NAMES.CUSTOMERS);

    if (!customersSheet) {
      sendLineReply(replyToken, "❌ ไม่พบข้อมูลลูกค้า");
      return { success: false, error: "Customers sheet not found" };
    }

    const data = customersSheet.getDataRange().getValues();
    const pendingCustomers = [];

    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[5] === "pending") { // Column F is status
        pendingCustomers.push({
          lineUserId: row[1],
          fullName: row[2],
          shopName: row[3],
          taxId: row[4],
          timestamp: row[0]
        });
      }
    }

    if (pendingCustomers.length === 0) {
      sendLineReply(replyToken, "✅ ไม่มีลูกค้าที่รออนุมัติ");
      return { success: true, count: 0 };
    }

    let msg = "📋 รายชื่อลูกค้าที่รออนุมัติ (" + pendingCustomers.length + " ราย)\n\n";

    pendingCustomers.forEach((customer, index) => {
      msg += (index + 1) + ". " + customer.shopName + "\n";
      msg += "   ชื่อ: " + customer.fullName + "\n";
      msg += "   LINE ID: " + customer.lineUserId + "\n";
      msg += "   ลงทะเบียนเมื่อ: " + formatDate(customer.timestamp) + "\n\n";
    });

    msg += "วิธีอนุมัติ: admin approve {LINE_USER_ID}";

    sendLineReply(replyToken, msg);
    return { success: true, count: pendingCustomers.length };

  } catch (error) {
    console.error("❌ Error in handleAdminPending: " + error.toString());
    sendLineReply(replyToken, "❌ เกิดข้อผิดพลาด: " + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Admin: Approve customer
 * @param {string} replyToken - Reply token
 * @param {string} lineUserId - Customer LINE User ID
 * @returns {Object} Response
 */
function handleAdminApprove(replyToken, lineUserId) {
  console.log("✅ Approving customer: " + lineUserId);

  try {
    const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
    const customersSheet = ss.getSheetByName(SHEET_NAMES.CUSTOMERS);

    if (!customersSheet) {
      sendLineReply(replyToken, "❌ ไม่พบข้อมูลลูกค้า");
      return { success: false, error: "Customers sheet not found" };
    }

    const data = customersSheet.getDataRange().getValues();

    // Skip header row
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === lineUserId) { // Column B is LINE User ID
        // Update status to "active"
        customersSheet.getRange(i + 1, 6).setValue("active");

        const shopName = data[i][3];
        const fullName = data[i][2];

        const msg = "✅ อนุมัติบัญชีสำเร็จ!\n\n" +
                    "ร้าน: " + shopName + "\n" +
                    "ชื่อ: " + fullName + "\n" +
                    "LINE ID: " + lineUserId;

        sendLineReply(replyToken, msg);

        // ไม่แจ้งเตือนลูกค้า - ลูกค้าต้องมาพิมพ์ "ยอดคงค้าง" เอง
        console.log("✅ Customer approved: " + lineUserId);
        return { success: true, action: "approved" };
      }
    }

    sendLineReply(replyToken, "❌ ไม่พบ LINE User ID: " + lineUserId);
    return { success: false, error: "User not found" };

  } catch (error) {
    console.error("❌ Error in handleAdminApprove: " + error.toString());
    sendLineReply(replyToken, "❌ เกิดข้อผิดพลาด: " + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Admin: Reject customer
 * @param {string} replyToken - Reply token
 * @param {string} lineUserId - Customer LINE User ID
 * @param {string} reason - Rejection reason
 * @returns {Object} Response
 */
function handleAdminReject(replyToken, lineUserId, reason) {
  console.log("❌ Rejecting customer: " + lineUserId + " Reason: " + reason);

  try {
    const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
    const customersSheet = ss.getSheetByName(SHEET_NAMES.CUSTOMERS);

    if (!customersSheet) {
      sendLineReply(replyToken, "❌ ไม่พบข้อมูลลูกค้า");
      return { success: false, error: "Customers sheet not found" };
    }

    const data = customersSheet.getDataRange().getValues();

    // Skip header row
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === lineUserId) {
        // Update status to "inactive"
        customersSheet.getRange(i + 1, 6).setValue("inactive");

        const shopName = data[i][3];
        const fullName = data[i][2];

        const msg = "❌ ปฏิเสธ/ระงับบัญชีสำเร็จ\n\n" +
                    "ร้าน: " + shopName + "\n" +
                    "ชื่อ: " + fullName + "\n" +
                    "LINE ID: " + lineUserId + "\n" +
                    "เหตุผล: " + reason;

        sendLineReply(replyToken, msg);

        // ไม่แจ้งเตือนลูกค้า
        console.log("❌ Customer rejected: " + lineUserId);
        return { success: true, action: "rejected" };
      }
    }

    sendLineReply(replyToken, "❌ ไม่พบ LINE User ID: " + lineUserId);
    return { success: false, error: "User not found" };

  } catch (error) {
    console.error("❌ Error in handleAdminReject: " + error.toString());
    sendLineReply(replyToken, "❌ เกิดข้อผิดพลาด: " + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Admin: Check customer status
 * @param {string} replyToken - Reply token
 * @param {string} lineUserId - Customer LINE User ID
 * @returns {Object} Response
 */
function handleAdminStatus(replyToken, lineUserId) {
  console.log("🔍 Checking status: " + lineUserId);

  try {
    const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
    const customersSheet = ss.getSheetByName(SHEET_NAMES.CUSTOMERS);

    if (!customersSheet) {
      sendLineReply(replyToken, "❌ ไม่พบข้อมูลลูกค้า");
      return { success: false, error: "Customers sheet not found" };
    }

    const data = customersSheet.getDataRange().getValues();

    // Skip header row
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === lineUserId) {
        const customer = {
          timestamp: data[i][0],
          lineUserId: data[i][1],
          fullName: data[i][2],
          shopName: data[i][3],
          taxId: data[i][4],
          status: data[i][5] || "pending"
        };

        let statusIcon = "⏳";
        if (customer.status === "active") statusIcon = "✅";
        else if (customer.status === "inactive") statusIcon = "❌";

        const msg = statusIcon + " สถานะบัญชี\n\n" +
                    "ร้าน: " + customer.shopName + "\n" +
                    "ชื่อ: " + customer.fullName + "\n" +
                    "LINE ID: " + customer.lineUserId + "\n" +
                    "สถานะ: " + customer.status + "\n" +
                    "ลงทะเบียนเมื่อ: " + formatDate(customer.timestamp);

        sendLineReply(replyToken, msg);
        return { success: true, customer: customer };
      }
    }

    sendLineReply(replyToken, "❌ ไม่พบ LINE User ID: " + lineUserId);
    return { success: false, error: "User not found" };

  } catch (error) {
    console.error("❌ Error in handleAdminStatus: " + error.toString());
    sendLineReply(replyToken, "❌ เกิดข้อผิดพลาด: " + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Admin: Count customers
 * @param {string} replyToken - Reply token
 * @returns {Object} Response
 */
function handleAdminCount(replyToken) {
  console.log("📊 Counting customers");

  try {
    const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
    const customersSheet = ss.getSheetByName(SHEET_NAMES.CUSTOMERS);

    if (!customersSheet) {
      sendLineReply(replyToken, "❌ ไม่พบข้อมูลลูกค้า");
      return { success: false, error: "Customers sheet not found" };
    }

    const data = customersSheet.getDataRange().getValues();

    let total = 0;
    let active = 0;
    let pending = 0;
    let inactive = 0;

    // Skip header row
    for (let i = 1; i < data.length; i++) {
      total++;
      const status = data[i][5] || "pending";
      if (status === "active") active++;
      else if (status === "pending") pending++;
      else if (status === "inactive") inactive++;
    }

    const msg = "📊 สถิติลูกค้าทั้งหมด\n\n" +
                "✅ ใช้งานอยู่: " + active + " ราย\n" +
                "⏳ รออนุมัติ: " + pending + " ราย\n" +
                "❌ ระงับใช้งาน: " + inactive + " ราย\n" +
                "━━━━━━━━━━━━━━━━━━━\n" +
                "📋 รวมทั้งหมด: " + total + " ราย";

    sendLineReply(replyToken, msg);
    return { success: true, total: total, active: active, pending: pending, inactive: inactive };

  } catch (error) {
    console.error("❌ Error in handleAdminCount: " + error.toString());
    sendLineReply(replyToken, "❌ เกิดข้อผิดพลาด: " + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Notify admin about new customer registration
 * @param {Object} customer - Customer data
 */
function notifyAdminNewCustomer(customer) {
  console.log("🔔 Notifying admins about new customer: " + customer.shopName);

  const msg = "🔔 ลูกค้าใหม่ลงทะเบียน\n\n" +
              "ร้าน: " + customer.shopName + "\n" +
              "ชื่อ: " + customer.fullName + "\n" +
              "เลขประจำตัวผู้เสียภาษี: " + customer.taxId + "\n" +
              "LINE ID: " + customer.lineUserId + "\n\n" +
              "อนุมัติ: admin approve " + customer.lineUserId;

  // Send to Telegram
  sendTelegramNotification(msg);
}

/**
 * Admin: Add new admin
 * @param {string} replyToken - Reply token
 * @param {string} lineUserId - LINE User ID to add as admin
 * @param {string} name - Admin name
 * @returns {Object} Response
 */
function handleAdminAdd(replyToken, lineUserId, name) {
  console.log("➕ Adding admin: " + lineUserId + " (" + name + ")");

  try {
    const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
    const adminsSheet = ss.getSheetByName(SHEET_NAMES.ADMINS);

    if (!adminsSheet) {
      sendLineReply(replyToken, "❌ ไม่พบ Admins sheet");
      return { success: false, error: "Admins sheet not found" };
    }

    // Check if already exists
    const data = adminsSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === lineUserId) {
        // Update status to active if exists
        adminsSheet.getRange(i + 1, 5).setValue("active");

        const msg = "✅ คืนสถานะ Admin แล้ว\n\n" +
                    "LINE ID: " + lineUserId + "\n" +
                    "ชื่อ: " + name;

        sendLineReply(replyToken, msg);
        return { success: true, action: "admin_reactivated" };
      }
    }

    // Add new admin
    adminsSheet.appendRow([
      new Date(),
      lineUserId,
      name,
      "", // Email optional
      "active",
      "admin"
    ]);

    const msg = "✅ เพิ่ม Admin ใหม่สำเร็จ!\n\n" +
                "LINE ID: " + lineUserId + "\n" +
                "ชื่อ: " + name;

    sendLineReply(replyToken, msg);
    console.log("✅ Admin added: " + lineUserId);
    return { success: true, action: "admin_added" };

  } catch (error) {
    console.error("❌ Error in handleAdminAdd: " + error.toString());
    sendLineReply(replyToken, "❌ เกิดข้อผิดพลาด: " + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Admin: Remove admin
 * @param {string} replyToken - Reply token
 * @param {string} lineUserId - LINE User ID to remove
 * @returns {Object} Response
 */
function handleAdminRemove(replyToken, lineUserId) {
  console.log("➖ Removing admin: " + lineUserId);

  try {
    const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
    const adminsSheet = ss.getSheetByName(SHEET_NAMES.ADMINS);

    if (!adminsSheet) {
      sendLineReply(replyToken, "❌ ไม่พบ Admins sheet");
      return { success: false, error: "Admins sheet not found" };
    }

    const data = adminsSheet.getDataRange().getValues();

    // Find and update status to inactive
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === lineUserId) {
        const adminName = data[i][2];

        // Don't allow removing the last admin
        const activeAdmins = data.filter(row => (row[4] === "active" || !row[4]) && row[1] !== lineUserId);
        if (activeAdmins.length <= 1) {
          const msg = "❌ ไม่สามารถลบ Admin คนสุดท้ายได้\n\n" +
                      "กรุณาเพิ่ม Admin ใหม่ก่อนลบ";
          sendLineReply(replyToken, msg);
          return { success: false, error: "Cannot remove last admin" };
        }

        adminsSheet.getRange(i + 1, 5).setValue("inactive");

        const msg = "✅ ลบ Admin สำเร็จ\n\n" +
                    "LINE ID: " + lineUserId + "\n" +
                    "ชื่อ: " + adminName;

        sendLineReply(replyToken, msg);
        console.log("✅ Admin removed: " + lineUserId);
        return { success: true, action: "admin_removed" };
      }
    }

    sendLineReply(replyToken, "❌ ไม่พบ Admin: " + lineUserId);
    return { success: false, error: "Admin not found" };

  } catch (error) {
    console.error("❌ Error in handleAdminRemove: " + error.toString());
    sendLineReply(replyToken, "❌ เกิดข้อผิดพลาด: " + error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Admin: List all admins
 * @param {string} replyToken - Reply token
 * @returns {Object} Response
 */
function handleAdminList(replyToken) {
  console.log("📋 Listing admins");

  try {
    const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));
    const adminsSheet = ss.getSheetByName(SHEET_NAMES.ADMINS);

    if (!adminsSheet) {
      sendLineReply(replyToken, "❌ ไม่พบ Admins sheet");
      return { success: false, error: "Admins sheet not found" };
    }

    const data = adminsSheet.getDataRange().getValues();
    const admins = [];

    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const status = row[4] || "active";

      admins.push({
        lineUserId: row[1],
        name: row[2],
        email: row[3],
        status: status,
        role: row[5] || "admin",
        timestamp: row[0]
      });
    }

    if (admins.length === 0) {
      sendLineReply(replyToken, "⚠️ ไม่มี Admin ในระบบ\n\n" +
                          "ใช้: admin add {LINE_USER_ID} {ชื่อ}\n" +
                          "เพื่อเพิ่ม Admin");
      return { success: true, count: 0 };
    }

    let msg = "📋 รายชื่อ Admin (" + admins.length + " ราย)\n\n";

    const activeAdmins = admins.filter(a => a.status === "active");
    const inactiveAdmins = admins.filter(a => a.status === "inactive");

    if (activeAdmins.length > 0) {
      msg += "✅ ใช้งานอยู่ (" + activeAdmins.length + "):\n";
      activeAdmins.forEach((admin, index) => {
        msg += (index + 1) + ". " + admin.name + "\n";
        msg += "   LINE ID: " + admin.lineUserId + "\n\n";
      });
    }

    if (inactiveAdmins.length > 0) {
      msg += "❌ ระงับใช้งาน (" + inactiveAdmins.length + "):\n";
      inactiveAdmins.forEach((admin, index) => {
        msg += (index + 1) + ". " + admin.name + "\n";
        msg += "   LINE ID: " + admin.lineUserId + "\n\n";
      });
    }

    sendLineReply(replyToken, msg);
    return { success: true, count: admins.length, active: activeAdmins.length, inactive: inactiveAdmins.length };

  } catch (error) {
    console.error("❌ Error in handleAdminList: " + error.toString());
    sendLineReply(replyToken, "❌ เกิดข้อผิดพลาด: " + error.message);
    return { success: false, error: error.message };
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TELEGRAM NOTIFICATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Send notification via Telegram Bot
 * @param {string} message - Message to send
 * @returns {boolean} Success status
 */
function sendTelegramNotification(message) {
  console.log("📱 Sending Telegram notification...");

  try {
    // Validate config
    if (!getConfig('TELEGRAM_BOT_TOKEN') || !getConfig('TELEGRAM_CHAT_ID')) {
      console.warn("⚠️ Telegram config not set, skipping notification");
      return false;
    }

    const telegramUrl = "https://api.telegram.org/bot" + getConfig('TELEGRAM_BOT_TOKEN') + "/sendMessage";

    const response = UrlFetchApp.fetch(telegramUrl, {
      method: "post",
      headers: {
        "Content-Type": "application/json"
      },
      payload: JSON.stringify({
        chat_id: getConfig('TELEGRAM_CHAT_ID'),
        text: message,
        parse_mode: "HTML"
      }),
      muteHttpExceptions: true
    });

    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode !== 200) {
      console.error("❌ Telegram API Error: " + responseCode);
      console.error(responseBody);
      return false;
    }

    const result = JSON.parse(responseBody);
    if (!result.ok) {
      console.error("❌ Telegram Error: " + result.description);
      return false;
    }

    console.log("✅ Telegram notification sent successfully");
    return true;

  } catch (error) {
    console.error("❌ Error in sendTelegramNotification: " + error.toString());
    return false;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UTILITY FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Create JSON response with CORS headers
 * @param {Object} data - Data to return
 * @returns {Object} ContentService output
 */
function createJsonResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);

  // Set CORS headers for cross-origin requests
  output.setHeader("Access-Control-Allow-Origin", "*");
  output.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  output.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  output.setHeader("Access-Control-Max-Age", "3600");

  return output;
}

/**
 * Format number as Thai currency
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency
 */
function formatCurrency(amount) {
  return amount.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Format date for display
 * @param {Date} date - Date to format
 * @returns {string} Formatted date
 */
function formatDate(date) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  return Utilities.formatDate(date, "Asia/Bangkok", "dd/MM/yyyy HH:mm");
}

/**
 * Setup function - Create required sheets
 */
function setupSheets() {
  const ss = SpreadsheetApp.openById(getConfig('SPREADSHEET_ID'));

  // Create Customers sheet if not exists
  let customersSheet = ss.getSheetByName(SHEET_NAMES.CUSTOMERS);
  if (!customersSheet) {
    customersSheet = ss.insertSheet(SHEET_NAMES.CUSTOMERS);
    customersSheet.appendRow([
      "Timestamp",
      "LINE User ID",
      "ชื่อ-นามสกุล",
      "ชื่อร้านค้า",
      "เลขประจำตัวผู้เสียภาษี",
      "สถานะ"
    ]);
  }

  // Create MessageLog sheet if not exists
  let logSheet = ss.getSheetByName(SHEET_NAMES.LOG);
  if (!logSheet) {
    logSheet = ss.insertSheet(SHEET_NAMES.LOG);
    logSheet.appendRow([
      "Timestamp",
      "LINE User ID",
      "ข้อความที่ส่ง",
      "ข้อความตอบกลับ"
    ]);
  }

  // Create Admins sheet if not exists
  let adminsSheet = ss.getSheetByName(SHEET_NAMES.ADMINS);
  if (!adminsSheet) {
    adminsSheet = ss.insertSheet(SHEET_NAMES.ADMINS);
    adminsSheet.appendRow([
      "Timestamp",
      "LINE User ID",
      "ชื่อ-นามสกุล",
      "Email",
      "สถานะ",
      "Role"
    ]);

    // Add note
    adminsSheet.getRange(2, 1).setValue("⚠️ ใส่ LINE User ID ของ Admin ที่นี่");
    adminsSheet.getRange(2, 1).setFontWeight("bold");
    adminsSheet.getRange(2, 1).setFontColor("#e74c3c");
  }

  // Create UserProfiles sheet if not exists
  let profilesSheet = ss.getSheetByName(SHEET_NAMES.USER_PROFILES);
  if (!profilesSheet) {
    profilesSheet = ss.insertSheet(SHEET_NAMES.USER_PROFILES);
    profilesSheet.appendRow([
      "LINE User ID",
      "Display Name",
      "Picture URL",
      "Status Message",
      "Language",
      "Follow Time",
      "Status",
      "Last Updated"
    ]);

    // Set column widths
    profilesSheet.setColumnWidth(1, 250); // LINE User ID
    profilesSheet.setColumnWidth(2, 200); // Display Name
    profilesSheet.setColumnWidth(3, 300); // Picture URL
    profilesSheet.setColumnWidth(4, 300); // Status Message
    profilesSheet.setColumnWidth(5, 100); // Language
    profilesSheet.setColumnWidth(6, 200); // Follow Time
    profilesSheet.setColumnWidth(7, 120); // Status
    profilesSheet.setColumnWidth(8, 200); // Last Updated

    // Freeze header row
    profilesSheet.setFrozenRows(1);
  }

  console.log("✅ Sheets setup completed");
}

/**
 * Setup ScriptProperties - Run this ONCE to set configuration
 * Run this function from Google Apps Script editor
 */
function setupConfig() {
  const scriptProperties = PropertiesService.getScriptProperties();

  const props = {
    SPREADSHEET_ID: "", // TODO: ใส่ Google Sheet ID
    LINE_CHANNEL_ACCESS_TOKEN: "", // TODO: ใส่ LINE Channel Access Token
    TELEGRAM_BOT_TOKEN: "", // TODO: ใส่ Telegram Bot Token
    TELEGRAM_CHAT_ID: ""   // TODO: ใส่ Telegram Chat ID
  };

  scriptProperties.setProperties(props);

  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║ ✅ ScriptProperties setup completed                 ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("");
  console.log("⚠️  IMPORTANT: Edit the properties in:");
  console.log("   Project Settings > Script Properties");
  console.log("");
  console.log("Required properties:");
  console.log("  • SPREADSHEET_ID");
  console.log("  • LINE_CHANNEL_ACCESS_TOKEN");
  console.log("  • TELEGRAM_BOT_TOKEN");
  console.log("  • TELEGRAM_CHAT_ID");
}

/**
 * Update a single configuration value
 * @param {string} key - Property key
 * @param {string} value - Property value
 */
function updateConfig(key, value) {
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty(key, value);
  console.log("✅ Updated " + key + ": " + value.substring(0, 20) + "...");
}

/**
 * View all configuration values
 */
function viewConfig() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const properties = scriptProperties.getProperties();

  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║ 📋 Current Configuration                            ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log("");

  for (const key in properties) {
    const value = properties[key];
    const maskedValue = key.includes('TOKEN') || key.includes('SECRET')
      ? value.substring(0, 10) + "...[HIDDEN]..." + value.substring(Math.max(0, value.length - 5))
      : value;

    console.log(key + ": " + maskedValue);
  }
}