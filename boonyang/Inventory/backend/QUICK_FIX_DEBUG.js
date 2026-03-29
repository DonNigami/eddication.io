/************************************************
 * QUICK FIX DEBUG MODE
 *
 * วิธีใช้:
 * 1. ไปที่ Google Sheets > setting sheet
 * 2. ตั้งค่าดังนี้:
 *    - B20 = OFF (ปิดระบบชั่วคราวเพื่อใช้ debug mode)
 *    - B21 = ON
 *    - B22 = OFF (ปิด Require Approval)
 *    - B23 = OFF (ปิด Register Required)
 *
 * หรือวิธีเร็ว: แก้โค้ดบรรทัด 30-33 ใน code.js
 * จาก:
 *   function isBotEnabled_()           { return readSwitch_("B20", true); }
 * เป็น:
 *   function isBotEnabled_()           { return true; } // Force ON
 *   function isRegisterRequired_()     { return false; } // Force OFF
 *   function isStockRequireApproval_() { return false; } // Force OFF
 ************************************************/

// Debug script สำหรับแก้ไข setting sheet ทันที
function quickFixDebugMode() {
  const spreadsheet = SpreadsheetApp.openById("1izokvbl6DQMg81JdTzRDr3Vk6evTgIir5pBU-HHUZOk");
  const settingBot = spreadsheet.getSheetByName("setting");

  // Force ON all switches
  settingBot.getRange("B20").setValue("ON");  // Bot ON
  settingBot.getRange("B21").setValue("ON");  // Stock ON
  settingBot.getRange("B22").setValue("OFF"); // Require Approval OFF
  settingBot.getRange("B23").setValue("OFF"); // Register Required OFF

  Logger.log("✅ Debug mode enabled - bot will answer everything");
  Logger.log("📋 Settings:");
  Logger.log("   B20 (BOT) = ON");
  Logger.log("   B21 (STOCK) = ON");
  Logger.log("   B22 (APPROVAL) = OFF");
  Logger.log("   B23 (REGISTER) = OFF");
}

// สคริปต์สำหรับดูสถานะ user ทั้งหมด
function checkAllUsersStatus() {
  const spreadsheet = SpreadsheetApp.openById("1izokvbl6DQMg81JdTzRDr3Vk6evTgIir5pBU-HHUZOk");
  const userSheet = spreadsheet.getSheetByName("UserData");
  const lastRow = userSheet.getLastRow();

  if (lastRow < 2) {
    Logger.log("❌ No users found");
    return;
  }

  const data = userSheet.getRange(2, 1, lastRow - 1, 18).getValues();

  Logger.log("=== USER STATUS REPORT ===");
  Logger.log("Total users: " + data.length);

  let registeredCount = 0;
  let adminCount = 0;
  let customerCount = 0;
  let pendingCount = 0;

  data.forEach((row, i) => {
    const userId = row[0];
    const displayName = row[1];
    const userStaff = String(row[11] || "").trim().toLowerCase();
    const regStatus = String(row[12] || "").trim();
    const flowStatus = String(row[13] || "").trim();

    if (regStatus === "สำเร็จ") registeredCount++;
    if (userStaff === "admin") adminCount++;
    if (userStaff === "customer") customerCount++;
    if (flowStatus && flowStatus !== "") pendingCount++;

    Logger.log(`Row ${i+2}: ${displayName}`);
    Logger.log(`  ├─ Staff: ${userStaff || "(blank)"}`);
    Logger.log(`  ├─ Register: ${regStatus || "(blank)"}`);
    Logger.log(`  └─ Flow: ${flowStatus || "(blank)"}`);
  });

  Logger.log("=== SUMMARY ===");
  Logger.log("✅ Registered: " + registeredCount);
  Logger.log("👑 Admins: " + adminCount);
  Logger.log("👥 Customers: " + customerCount);
  Logger.log("⏳ Pending registration: " + pendingCount);
}

// สคริปต์สำหรับตั้งค่า user เป็น admin (แทนการพิมพ์ใน LINE)
function setUserAsAdmin(userId) {
  const spreadsheet = SpreadsheetApp.openById("1izokvbl6DQMg81JdTzRDr3Vk6evTgIir5pBU-HHUZOk");
  const userSheet = spreadsheet.getSheetByName("UserData");

  // Find user
  const data = userSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) {
      userSheet.getRange(i + 1, 12).setValue("admin");
      Logger.log("✅ Set " + data[i][1] + " as ADMIN");
      return;
    }
  }
  Logger.log("❌ User not found: " + userId);
}

// สคริปต์สำหรับตั้งค่า user เป็น customer
function setUserAsCustomer(userId) {
  const spreadsheet = SpreadsheetApp.openById("1izokvbl6DQMg81JdTzRDr3Vk6evTgIir5pBU-HHUZOk");
  const userSheet = spreadsheet.getSheetByName("UserData");

  const data = userSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) {
      userSheet.getRange(i + 1, 12).setValue("customer");
      Logger.log("✅ Set " + data[i][1] + " as CUSTOMER");
      return;
    }
  }
  Logger.log("❌ User not found: " + userId);
}

// สคริปต์สำหรับ force complete registration ของ user
function forceCompleteRegistration(userId) {
  const spreadsheet = SpreadsheetApp.openById("1izokvbl6DQMg81JdTzRDr3Vk6evTgIir5pBU-HHUZOk");
  const userSheet = spreadsheet.getSheetByName("UserData");

  const data = userSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) {
      userSheet.getRange(i + 1, 13).setValue("สำเร็จ"); // COL_STATUS_REGISTER
      userSheet.getRange(i + 1, 14).setValue("");         // COL_FLOW_STATUS
      Logger.log("✅ Force completed registration for " + data[i][1]);
      return;
    }
  }
  Logger.log("❌ User not found: " + userId);
}
