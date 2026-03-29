/**
 * Import Data from Google Sheets to Supabase
 * Run this script directly in Google Apps Script Editor
 *
 * SETUP:
 * 1. Open: https://docs.google.com/spreadsheets/d/1BGVpH5-VuDh4iQcZN8gD5pW0n3_EvoSjXXbFGEaLMg8
 * 2. Extensions → Apps Script
 * 3. Create new script file: import-to-supabase.js
 * 4. Paste this code
 * 5. Update SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY below
 * 6. Run function: importAllData()
 */

// ============================================
// CONFIGURATION - UPDATE THESE
// ============================================

const SUPABASE_URL = 'https://cbxicbynxnprscwqnyld.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'YOUR_SERVICE_ROLE_KEY_HERE'; // Get from Supabase Dashboard

// Sheet Configuration
const SHEET_ID = '1BGVpH5-VuDh4iQcZN8gD5pW0n3_EvoSjXXbFGEaLMg8';
const SHEET_BOTDATA = 'BotData';
const SHEET_INVENTDATA = 'InventData';

// Batch size for inserts (Supabase limit: 1000 rows per request)
const BATCH_SIZE = 1000;

// ============================================
// IMPORT FUNCTIONS
// ============================================

/**
 * Import all data to Supabase
 */
function importAllData() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    'Import Data to Supabase',
    'คุณต้องการ import ข้อมูลไปยัง Supabase ใช่หรือไม่?\n\n' +
    'ข้อมูลจะถูกเพิ่มเข้าไปในตาราง:\n' +
    '• botdata\n' +
    '• inventdata\n\n' +
    '⚠️ ข้อมูลเดิมจะไม่ถูกลบ',
    ui.ButtonSet.YES_NO
  );

  if (result !== ui.Button.YES) {
    return;
  }

  try {
    // Import BotData
    importBotData();

    // Import InventData
    importInventData();

    ui.alert(
      '✅ Import เสร็จสมบูรณ์!',
      'ข้อมูลถูก import ไปยัง Supabase เรียบร้อยแล้ว\n\n' +
      'ตรวจสอบได้ที่: https://supabase.com/dashboard/project/cbxicbynxnprscwqnyld/table-editor',
      ui.ButtonSet.OK
    );

  } catch (error) {
    ui.alert(
      '❌ Import ล้มเหลว',
      'เกิดข้อผิดพลาด: ' + error.toString(),
      ui.ButtonSet.OK
    );
  }
}

/**
 * Import BotData to Supabase
 */
function importBotData() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_BOTDATA);

  if (!sheet) {
    throw new Error('ไม่พบ Sheet: ' + SHEET_BOTDATA);
  }

  // Get all data (skip header row)
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow <= 1) {
    Logger.log('⚠️ BotData: ไม่มีข้อมูล');
    return;
  }

  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  Logger.log(`📦 BotData: พบ ${data.length} รายการ`);

  // Transform data
  const transformedData = data.map(row => ({
    item_code: row[0] || null,
    field_unknown: row[1] || null,
    item_name: row[2] || null,
    lot_number: row[3] || null,
    on_hand_quantity: parseInt(row[4]) || 0,
    alternative_key_1: row[5] || null,
    alternative_key_2: row[6] || null
  }));

  // Insert to Supabase
  insertBatch('botdata', transformedData);
}

/**
 * Import InventData to Supabase
 *
 * Sheet columns (in order):
 * A: ItemName
 * B: Standard
 * C: ItemName2
 * D: ItemName3
 * E: OnhandQtyByTotalPiece
 */
function importInventData() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_INVENTDATA);

  if (!sheet) {
    throw new Error('ไม่พบ Sheet: ' + SHEET_INVENTDATA);
  }

  // Get all data (skip header row)
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    Logger.log('⚠️ InventData: ไม่มีข้อมูล');
    return;
  }

  // Get 5 columns: ItemName, Standard, ItemName2, ItemName3, OnhandQtyByTotalPiece
  const data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();

  Logger.log(`📊 InventData: พบ ${data.length} รายการ`);

  // Transform data matching Supabase table structure
  const transformedData = data.map(row => ({
    ItemName: row[0] || null,
    Standard: row[1] || null,
    ItemName2: row[2] || null,
    ItemName3: row[3] || null,
    OnhandQtyByTotalPiece: parseInt(row[4]) || 0
  }));

  // Insert to Supabase
  insertBatch('inventdata', transformedData);
}

/**
 * Insert data to Supabase in batches
 */
function insertBatch(tableName, data) {
  if (!data || data.length === 0) {
    Logger.log(`⚠️ ${tableName}: ไม่มีข้อมูลที่จะ insert`);
    return;
  }

  let insertedCount = 0;
  let errorCount = 0;

  // Split into batches
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, Math.min(i + BATCH_SIZE, data.length));

    try {
      const response = insertToSupabase(tableName, batch);

      if (response && response.error) {
        Logger.log(`❌ ${tableName} Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${response.error}`);
        errorCount += batch.length;
      } else {
        Logger.log(`✅ ${tableName} Batch ${Math.floor(i / BATCH_SIZE) + 1}: Inserted ${batch.length} rows`);
        insertedCount += batch.length;
      }

      // Sleep to avoid rate limiting
      Utilities.sleep(100);

    } catch (error) {
      Logger.log(`❌ ${tableName} Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.toString()}`);
      errorCount += batch.length;
    }
  }

  Logger.log(`\n📊 ${tableName} Summary:`);
  Logger.log(`  ✅ Inserted: ${insertedCount} rows`);
  Logger.log(`  ❌ Errors: ${errorCount} rows`);
  Logger.log(`  📝 Total: ${data.length} rows\n`);
}

/**
 * Insert data to Supabase via REST API
 */
function insertToSupabase(tableName, data) {
  const url = `${SUPABASE_URL}/rest/v1/${tableName}`;

  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'headers': {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    'payload': JSON.stringify(data),
    'muteHttpExceptions': true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();

  if (responseCode >= 400) {
    Logger.log(`HTTP ${responseCode}: ${responseBody}`);
    return { error: responseBody };
  }

  try {
    return JSON.parse(responseBody);
  } catch (e) {
    return { success: true };
  }
}

/**
 * Test Supabase connection
 */
function testConnection() {
  try {
    const url = `${SUPABASE_URL}/rest/v1/botdata?limit=1`;

    const options = {
      'method': 'get',
      'headers': {
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      'muteHttpExceptions': true
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      Logger.log('✅ เชื่อมต่อ Supabase สำเร็จ!');
      Logger.log(`URL: ${SUPABASE_URL}`);
      return true;
    } else {
      Logger.log(`❌ เชื่อมต่อ Supabase ล้มเหลว: HTTP ${responseCode}`);
      Logger.log(`Response: ${response.getContentText()}`);
      return false;
    }

  } catch (error) {
    Logger.log(`❌ เชื่อมต่อ Supabase ล้มเหลว: ${error.toString()}`);
    return false;
  }
}

/**
 * Clear all data from Supabase tables
 * ⚠️ USE WITH CAUTION!
 */
function clearAllData() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    '⚠️ ล้างข้อมูลทั้งหมด?',
    'คุณต้องการลบข้อมูลทั้งหมดจาก Supabase ใช่หรือไม่?\n\n' +
    'การกระทำนี้ไม่สามารถย้อนกลับได้!\n\n' +
    'ตารางที่จะถูกล้าง:\n' +
    '• botdata\n' +
    '• inventdata',
    ui.ButtonSet.YES_NO
  );

  if (result !== ui.Button.YES) {
    return;
  }

  try {
    deleteAllRows('botdata');
    deleteAllRows('inventdata');

    ui.alert(
      '✅ ล้างข้อมูลเสร็จสมบูรณ์',
      'ข้อมูลทั้งหมดถูกลบออกจาก Supabase แล้ว',
      ui.ButtonSet.OK
    );

  } catch (error) {
    ui.alert(
      '❌ ล้างข้อมูลล้มเหลว',
      'เกิดข้อผิดพลาด: ' + error.toString(),
      ui.ButtonSet.OK
    );
  }
}

/**
 * Delete all rows from a table
 */
function deleteAllRows(tableName) {
  const url = `${SUPABASE_URL}/rest/v1/${tableName}`;

  const options = {
    'method': 'delete',
    'headers': {
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
    },
    'muteHttpExceptions': true
  };

  const response = UrlFetchApp.fetch(url, options);
  Logger.log(`🗑️ Cleared ${tableName}`);
}
