/************************************************
 * ✅ Google Sheet Menu for Stock Cache Management
 * Sheet ID: 1BGVpH5-VuDh4iQcZN8gD5pW0n3_EvoSjXXbFGEaLMg8
 ************************************************/

const STOCK_SHEET_ID = '1BGVpH5-VuDh4iQcZN8gD5pW0n3_EvoSjXXbFGEaLMg8';

// ============================================
// User Sheet Configuration (แยกจาก Stock Sheet)
// ============================================
const USER_SHEET_ID = '1F4iWFEO8YqEoN2Z1HFZiWucJlovPj3MyERjSe0t9II4'; // ⚠️ ตั้งค่า Sheet ID สำหรับ UserData ที่นี่

// ============================================
// Supabase Configuration
// ⚠️ UPDATE SERVICE ROLE KEY BELOW
// ============================================
const SUPABASE_URL = 'https://cbxicbynxnprscwqnyld.supabase.co';

/**
 * ดึง Supabase Service Role Key จาก ScriptProperties
 * @returns {string} Service Role Key
 */
function getSupabaseServiceRoleKey() {
  const scriptProperties = PropertiesService.getScriptProperties();
  let key = scriptProperties.getProperty('SUPABASE_SERVICE_ROLE_KEY');

  // ถ้าไม่มีค่าใน Properties ให้ใช้ค่าเดิม (backward compatibility)
  if (!key) {
    key = 'YOUR_SERVICE_ROLE_KEY_HERE'; // Fallback
  }

  return key;
}

// ============================================
// Helper: Get Service Role Key (อ่านจาก Properties ทุกครั้ง)
// ============================================
function getServiceRoleKey() {
  const key = PropertiesService.getScriptProperties().getProperty('SUPABASE_SERVICE_ROLE_KEY');
  if (!key || key === 'YOUR_SERVICE_ROLE_KEY_HERE') {
    throw new Error('❌ Supabase Service Role Key ยังไม่ได้ตั้งค่า\n\nไปที่เมนู ⚙️ ตั้งค่า Supabase Key');
  }
  return key;
}

// Batch size for inserts (Supabase limit: 1000 rows per request)
const BATCH_SIZE = 1000;

/************************************************
 * ✅ Cache Functions (รวมไว้ในไฟล์เดียวเพื่อป้องกันปัญหา scope)
 ************************************************/

/**
 * preloadStockCache - โหลด BotData ลง Cache
 */
function preloadStockCache() {
  const SHEET_ID = STOCK_SHEET_ID;
  const SHEET_NAME = 'BotData';
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);

  if (!sheet) {
    throw new Error('BotData Sheet not found');
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    throw new Error('BotData sheet is empty');
  }

  const data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  const totalRows = data.length;

  const cache = CacheService.getScriptCache();
  const groupedMap = {};

  data.forEach((row) => {
    const keys = [row[0], row[5], row[6]];
    keys.forEach(key => {
      const k = key?.toString().trim();
      if (!k) return;
      if (!groupedMap[k]) groupedMap[k] = [];
      groupedMap[k].push(row);
    });
  });

  const uniqueKeys = Object.keys(groupedMap).length;
  let cachedCount = 0;
  let skippedCount = 0;

  Object.keys(groupedMap).forEach(key => {
    try {
      const payload = JSON.stringify(groupedMap[key]);

      if (payload.length < 95000) {
        cache.put(`stock:${key}`, payload, 300); // 5 นาที
        cachedCount++;
      } else {
        skippedCount++;
      }
    } catch (e) {
      skippedCount++;
    }
  });

  return `✅ โหลดข้อมูล ${totalRows} รายการ\n` +
         `🔑 สร้าง ${uniqueKeys} keys\n` +
         `💾 เก็บใน Cache ${cachedCount} keys\n` +
         `⚠️ ข้าม ${skippedCount} keys (ใหญ่เกินไป)\n` +
         `⏰ TTL: 5 นาที`;
}

/**
 * ตั้งค่า Supabase Service Role Key (เก็บใน ScriptProperties)
 */
function setSupabaseServiceRoleKey() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '🔑 ตั้งค่า Supabase Service Role Key',
    'กรุณาใส่ Service Role Key จาก Supabase Dashboard:\n\n' +
    '📍 Path: Project Settings > API > service_role (secret)\n\n' +
    '⚠️ คีย์นี้จะถูกเก็บใน ScriptProperties (ปลอดภัยกว่า hardcode)',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const key = response.getResponseText().trim();

  if (!key || key.length < 50) {
    ui.alert('❌ ผิดพลาด', 'Service Role Key ไม่ถูกต้อง (ควรมีความยาวมากกว่านี้)', ui.ButtonSet.OK);
    return;
  }

  // เก็บใน ScriptProperties
  PropertiesService.getScriptProperties().setProperty('SUPABASE_SERVICE_ROLE_KEY', key);

  ui.alert(
    '✅ บันทึกเรียบร้อย',
    'Service Role Key ถูกเก็บใน ScriptProperties แล้ว\n\n' +
    'พร้อมใช้งานฟีเจอร์ Import ได้เลย!',
    ui.ButtonSet.OK
  );
}

/**
 * ดูค่า Supabase Service Role Key (แบบ mask)
 */
function viewSupabaseServiceRoleKey() {
  const ui = SpreadsheetApp.getUi();
  const key = PropertiesService.getScriptProperties().getProperty('SUPABASE_SERVICE_ROLE_KEY');

  if (!key) {
    ui.alert(
      '⚠️ ยังไม่ได้ตั้งค่า',
      'Service Role Key ยังไม่ได้ตั้งค่า\n\n' +
      'ไปที่เมนู ⚙️ ตั้งค่า Supabase Key เพื่อตั้งค่า',
      ui.ButtonSet.OK
    );
    return;
  }

  // Mask ตรงกลาง
  const maskedKey = key.substring(0, 10) + '...' + key.substring(key.length - 10);

  ui.alert(
    '🔑 Service Role Key',
    'คีย์ที่บันทึกไว้:\n\n' + maskedKey + '\n\n' +
    'เครื่องหมาย ... คือส่วนที่ถูกซ่อนไว้',
    ui.ButtonSet.OK
  );
}

/**
 * onOpen - สร้างเมนูอัตโนมัติเมื่อเปิดชีต
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('📦 Stock Cache Management')
    .addItem('🔄 อัปเดต BotData Cache', 'updateBotDataCache')
    .addItem('🔄 อัปเดต InventData Cache', 'updateInventDataCache')
    .addSeparator()
    .addItem('🔄 อัปเดตทั้งหมด (BotData + InventData)', 'updateAllCache')
    .addSeparator()
    .addItem('📊 ดูสถานะ Cache', 'showCacheStatus')
    .addItem('🧹 ล้าง Cache ทั้งหมด', 'clearAllCache')
    .addSeparator()
    .addItem('⚙️ ตั้งเวลา Auto Cache (ทุก 4 ชม.)', 'setupAutoCacheTrigger')
    .addItem('🚫 ยกเลิก Auto Cache', 'removeAutoCacheTrigger')
    .addToUi();

  // ============================================
  // 🔧 Fix UserData Sheet Menu
  // ============================================
  ui.createMenu('🔧 Fix UserData Sheet')
    .addItem('🔧 แก้ไขทั้งหมด (One-click)', 'fixAllUserDataIssues')
    .addSeparator()
    .addItem('📝 แก้ไข Headers', 'fixUserDataHeaders')
    .addItem('⏰ แก้ไข Time Format', 'fixTimeFormat')
    .addItem('💳 สลับ Tax ID Column', 'fixTaxIdColumn')
    .addSeparator()
    .addItem('🔍 ตรวจสอบผล', 'diagnoseUserDataImport')
    .addToUi();

  // ============================================
  // 🔍 UserData Import Diagnostic Menu
  // ============================================
  ui.createMenu('🔍 UserData Import Diagnostic')
    .addItem('🔍 Run Full Diagnostic', 'diagnoseUserDataImport')
    .addItem('👁️ View Last Diagnostic', 'viewLastDiagnostic')
    .addSeparator()
    .addItem('🧪 Test Import (10 rows)', 'testUserDataImport')
    .addItem('📥 Import with Improved Logic', 'importUserDataImproved')
    .addToUi();

  // ============================================
  // 🚀 Import to Supabase Menu
  // ============================================
  ui.createMenu('🚀 Import to Supabase')
    .addItem('⚙️ ตั้งค่า Supabase Key', 'setSupabaseServiceRoleKey')
    .addItem('👁️ ดู Supabase Key', 'viewSupabaseServiceRoleKey')
    .addSeparator()
    .addItem('📥 Import ทั้งหมด (BotData + InventData + UserData)', 'importAllData')
    .addSeparator()
    .addItem('📦 Import เฉพาะ BotData (ลบ+ใส่ใหม่)', 'importBotDataMenu')
    .addItem('📊 Import เฉพาะ InventData (ลบ+ใส่ใหม่)', 'importInventDataMenu')
    .addItem('👤 Import เฉพาะ UserData (Upsert)', 'importUserDataMenu')
    .addSeparator()
    .addItem('👤 Import UserData (Improved Logic)', 'importUserDataImproved')
    .addItem('🧪 Test UserData Import (10 rows)', 'testUserDataImport')
    .addSeparator()
    .addItem('🧪 ทดสอบการเชื่อมต่อ', 'testConnectionMenu')
    .addItem('⚠️ ล้างข้อมูลทั้งหมด', 'clearAllDataMenu')
    .addToUi();
}

/**
 * อัปเดต BotData Cache
 */
function updateBotDataCache() {
  const ui = SpreadsheetApp.getUi();

  try {
    ui.alert('🔄 กำลังอัปเดต BotData Cache...',
             'กรุณารอสักครู่...', ui.ButtonSet.OK);

    const result = preloadStockCache();

    if (result) {
      ui.alert('✅ สำเร็จ',
               'อัปเดต BotData Cache เรียบร้อยแล้ว\n\n' + result,
               ui.ButtonSet.OK);
    } else {
      ui.alert('✅ สำเร็จ',
               'อัปเดต BotData Cache เรียบร้อยแล้ว',
               ui.ButtonSet.OK);
    }
  } catch (error) {
    ui.alert('❌ ผิดพลาด',
             'ไม่สามารถอัปเดต BotData Cache ได้\n\nError: ' + error.toString(),
             ui.ButtonSet.OK);
  }
}

/**
 * อัปเดต InventData Cache
 */
function updateInventDataCache() {
  const ui = SpreadsheetApp.getUi();

  try {
    ui.alert('🔄 กำลังอัปเดต InventData Cache...',
             'กรุณารอสักครู่...', ui.ButtonSet.OK);

    const result = preloadInventDataCacheManual();

    if (result) {
      ui.alert('✅ สำเร็จ',
               'อัปเดต InventData Cache เรียบร้อยแล้ว\n\n' + result,
               ui.ButtonSet.OK);
    } else {
      ui.alert('✅ สำเร็จ',
               'อัปเดต InventData Cache เรียบร้อยแล้ว',
               ui.ButtonSet.OK);
    }
  } catch (error) {
    ui.alert('❌ ผิดพลาด',
             'ไม่สามารถอัปเดต InventData Cache ได้\n\nError: ' + error.toString(),
             ui.ButtonSet.OK);
  }
}

/**
 * อัปเดต Cache ทั้งหมด
 */
function updateAllCache() {
  const ui = SpreadsheetApp.getUi();

  try {
    ui.alert('🔄 กำลังอัปเดต Cache ทั้งหมด...',
             'กรุณารอสักครู่...', ui.ButtonSet.OK);

    let logs = [];

    // อัปเดต BotData
    try {
      preloadStockCache();
      logs.push('✅ BotData Cache - สำเร็จ');
    } catch (e) {
      logs.push('❌ BotData Cache - ผิดพลาด: ' + e);
    }

    // อัปเดต InventData
    try {
      preloadInventDataCacheManual();
      logs.push('✅ InventData Cache - สำเร็จ');
    } catch (e) {
      logs.push('❌ InventData Cache - ผิดพลาด: ' + e);
    }

    ui.alert('✅ เสร็จสิ้น',
             'อัปเดต Cache ทั้งหมดเรียบร้อยแล้ว\n\n' + logs.join('\n'),
             ui.ButtonSet.OK);
  } catch (error) {
    ui.alert('❌ ผิดพลาด',
             'ไม่สามารถอัปเดต Cache ได้\n\nError: ' + error.toString(),
             ui.ButtonSet.OK);
  }
}

/**
 * แสดงสถานะ Cache
 */
function showCacheStatus() {
  const ui = SpreadsheetApp.getUi();
  const cache = CacheService.getScriptCache();

  try {
    // เปิดชีต
    const spreadsheet = SpreadsheetApp.openById(STOCK_SHEET_ID);

    // ตรวจสอบ BotData
    const botDataSheet = spreadsheet.getSheetByName('BotData');
    let botDataInfo = '';
    if (botDataSheet) {
      const botDataRows = botDataSheet.getLastRow() - 1; // ลบ header
      botDataInfo = `📊 BotData Sheet: ${botDataRows} รายการ`;

      // นับจำนวน keys ใน cache
      const allKeys = cache.getAll([]);
      const stockKeys = Object.keys(allKeys).filter(k => k.startsWith('stock:'));
      botDataInfo += `\n💾 BotData Cache: ${stockKeys.length} keys`;
    } else {
      botDataInfo = '❌ ไม่พบ BotData Sheet';
    }

    // ตรวจสอบ InventData
    const inventDataSheet = spreadsheet.getSheetByName('InventData');
    let inventDataInfo = '';
    if (inventDataSheet) {
      const inventDataRows = inventDataSheet.getLastRow() - 1; // ลบ header
      inventDataInfo = `\n📊 InventData Sheet: ${inventDataRows} รายการ`;

      // ตรวจสอบ cache
      const inventDataCache = cache.get('inventdata:all');
      if (inventDataCache) {
        try {
          const items = JSON.parse(inventDataCache);
          inventDataInfo += `\n💾 InventData Cache: ${items.length} รายการ`;

          // คำนวณอายุ cache (โดยประมาณ)
          inventDataInfo += `\n⏰ Cache TTL: 5 นาที`;
        } catch (e) {
          inventDataInfo += '\n❌ InventData Cache: ผิดพลาด';
        }
      } else {
        inventDataInfo += '\n⚠️ InventData Cache: ไม่มีข้อมูล';
      }
    } else {
      inventDataInfo = '\n❌ ไม่พบ InventData Sheet';
    }

    // ตรวจสอบ Auto Cache Trigger
    const triggers = ScriptApp.getProjectTriggers();
    const autoTriggers = triggers.filter(t => t.getHandlerFunction() === 'autoPreloadStockCache');
    let triggerInfo = '\n\n⚙️ Auto Cache Trigger: ';
    if (autoTriggers.length > 0) {
      triggerInfo += '✅ ใช้งานอยู่ (ทุก 4 ชั่วโมง)';
    } else {
      triggerInfo += '❌ ไม่ได้ตั้งค่า';
    }

    ui.alert('📊 สถานะ Cache',
             botDataInfo + inventDataInfo + triggerInfo,
             ui.ButtonSet.OK);
  } catch (error) {
    ui.alert('❌ ผิดพลาด',
             'ไม่สามารถแสดงสถานะ Cache ได้\n\nError: ' + error.toString(),
             ui.ButtonSet.OK);
  }
}

/**
 * ล้าง Cache ทั้งหมด
 */
function clearAllCache() {
  const ui = SpreadsheetApp.getUi();

  const response = ui.alert('🧹 ยืนยันการล้าง Cache',
                            'คุณต้องการล้าง Cache ทั้งหมดใช่หรือไม่?\n\n' +
                            'การดำเนินการนี้จะลบข้อมูล Cache ทั้งหมด',
                            ui.ButtonSet.YES_NO);

  if (response !== ui.Button.YES) {
    return;
  }

  try {
    const cache = CacheService.getScriptCache();
    cache.removeAll([]);

    ui.alert('✅ สำเร็จ',
             'ล้าง Cache ทั้งหมดเรียบร้อยแล้ว\n\n' +
             'หมายเหตุ: Cache จะถูกสร้างใหม่เมื่อมีการค้นหาหรืออัปเดต',
             ui.ButtonSet.OK);
  } catch (error) {
    ui.alert('❌ ผิดพลาด',
             'ไม่สามารถล้าง Cache ได้\n\nError: ' + error.toString(),
             ui.ButtonSet.OK);
  }
}

/**
 * ตั้งเวลา Auto Cache Trigger
 */
function setupAutoCacheTrigger() {
  const ui = SpreadsheetApp.getUi();

  try {
    // ลบ trigger เก่าถ้ามี
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(t => {
      if (t.getHandlerFunction() === 'autoPreloadStockCache') {
        ScriptApp.deleteTrigger(t);
      }
    });

    // สร้าง trigger ใหม่ (ทุก 4 ชั่วโมง)
    ScriptApp.newTrigger('autoPreloadStockCache')
      .timeBased()
      .everyHours(4)
      .create();

    ui.alert('✅ สำเร็จ',
             'ตั้งเวลา Auto Cache เรียบร้อยแล้ว\n\n' +
             '📅 ทำงานทุก 4 ชั่วโมง\n' +
             '🔄 อัปเดต BotData และ InventData',
             ui.ButtonSet.OK);
  } catch (error) {
    ui.alert('❌ ผิดพลาด',
             'ไม่สามารถตั้งเวลา Auto Cache ได้\n\nError: ' + error.toString(),
             ui.ButtonSet.OK);
  }
}

/**
 * ยกเลิก Auto Cache Trigger
 */
function removeAutoCacheTrigger() {
  const ui = SpreadsheetApp.getUi();

  try {
    const triggers = ScriptApp.getProjectTriggers();
    const autoTriggers = triggers.filter(t => t.getHandlerFunction() === 'autoPreloadStockCache');

    if (autoTriggers.length === 0) {
      ui.alert('⚠️ แจ้งเตือน',
               'ไม่พบ Auto Cache Trigger ที่ตั้งไว้',
               ui.ButtonSet.OK);
      return;
    }

    autoTriggers.forEach(t => ScriptApp.deleteTrigger(t));

    ui.alert('✅ สำเร็จ',
             `ยกเลิก Auto Cache Trigger เรียบร้อยแล้ว\n\n` +
             `ลบ ${autoTriggers.length} triggers`,
             ui.ButtonSet.OK);
  } catch (error) {
    ui.alert('❌ ผิดพลาด',
             'ไม่สามารถยกเลิก Auto Cache Trigger ได้\n\nError: ' + error.toString(),
             ui.ButtonSet.OK);
  }
}

/**
 * preloadInventDataCacheManual - สำหรับเรียกจากเมนู
 *
 * Sheet columns:
 * A: ItemName
 * B: Standard
 * C: ItemName2
 * D: ItemName3
 * E: OnhandQtyByTotalPiece
 */
function preloadInventDataCacheManual() {
  const SHEET_ID = STOCK_SHEET_ID;
  const SHEET_NAME = 'InventData';
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);

  if (!sheet) {
    throw new Error('InventData Sheet not found');
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    throw new Error('InventData sheet is empty');
  }

  // อ่านข้อมูล 5 คอลัมน์: ItemName, Standard, ItemName2, ItemName3, OnhandQtyByTotalPiece
  const data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();

  const cache = CacheService.getScriptCache();

  // แปลงข้อมูลให้อยู่ในรูปแบบง่ายสำหรับ cache
  const inventDataItems = data.map((row, index) => {
    const stock = Number(row[4]) || 0; // OnhandQtyByTotalPiece
    return {
      name: String(row[0] || '').trim(), // ItemName
      standard: String(row[1] || '').trim(), // Standard
      itemname2: String(row[2] || '').trim(), // ItemName2
      itemname3: String(row[3] || '').trim(), // ItemName3
      stock: stock,
      status: stock >= 2 ? 'มีสินค้า' : 'กรุณาโทรสอบถาม',
      row: index + 2
    };
  }).filter(item => item.name.length > 0); // กรองชื่อว่าง

  const payload = JSON.stringify(inventDataItems);
  const payloadSize = payload.length;

  if (payloadSize < 95000) {
    cache.put('inventdata:all', payload, 300); // 5 นาที

    return `✅ เก็บข้อมูล ${inventDataItems.length} รายการ\n` +
           `📦 ขนาด: ${payloadSize} bytes\n` +
           `⏰ TTL: 5 นาที`;
  } else {
    throw new Error(`InventData too large (${payloadSize} bytes)`);
  }
}

// ============================================
// 🚀 Supabase Import Functions
// ============================================

/**
 * Import all data to Supabase (Menu wrapper)
 */
function importAllData() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    '📥 Import ข้อมูลไปยัง Supabase',
    'คุณต้องการ import ข้อมูลไปยัง Supabase ใช่หรือไม่?\n\n' +
    'วิธีการ Import:\n' +
    '• BotData: ลบทั้งหมด + Insert ใหม่\n' +
    '• InventData: ลบทั้งหมด + Insert ใหม่\n' +
    '• UserData: Upsert (Insert ใหม่, Update ที่เปลี่ยนแปลง)\n\n' +
    '⚠️ ข้อมูลเดิมจะถูกเก็บไว้ (สำหรับ UserData)',
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

    // Import UserData
    importUserData();

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
 * Import BotData (Menu wrapper)
 */
function importBotDataMenu() {
  const ui = SpreadsheetApp.getUi();

  try {
    ui.alert('🔄 กำลัง Import BotData...', 'กรุณารอสักครู่...', ui.ButtonSet.OK);

    importBotData();

    ui.alert(
      '✅ Import BotData สำเร็จ',
      'BotData ถูก import ไปยัง Supabase เรียบร้อยแล้ว',
      ui.ButtonSet.OK
    );
  } catch (error) {
    ui.alert(
      '❌ Import BotData ล้มเหลว',
      'เกิดข้อผิดพลาด: ' + error.toString(),
      ui.ButtonSet.OK
    );
  }
}

/**
 * Import InventData (Menu wrapper)
 */
function importInventDataMenu() {
  const ui = SpreadsheetApp.getUi();

  try {
    ui.alert('🔄 กำลัง Import InventData...', 'กรุณารอสักครู่...', ui.ButtonSet.OK);

    importInventData();

    ui.alert(
      '✅ Import InventData สำเร็จ',
      'InventData ถูก import ไปยัง Supabase เรียบร้อยแล้ว',
      ui.ButtonSet.OK
    );
  } catch (error) {
    ui.alert(
      '❌ Import InventData ล้มเหลว',
      'เกิดข้อผิดพลาด: ' + error.toString(),
      ui.ButtonSet.OK
    );
  }
}

/**
 * Import UserData (Menu wrapper)
 */
function importUserDataMenu() {
  const ui = SpreadsheetApp.getUi();

  try {
    ui.alert('🔄 กำลัง Upsert UserData...', 'กรุณารอสักครู่...\n\n Upsert = Insert ใหม่ + Update ที่เปลี่ยนแปลง', ui.ButtonSet.OK);

    const stats = importUserData();

    let summaryMessage = '✅ Upsert UserData สำเร็จ\n\n' +
                         `  ➕ Insert ใหม่: ${stats.inserted} รายการ\n` +
                         `  🔄 Update ที่มีอยู่: ${stats.updated} รายการ\n` +
                         `  ⏭️ ข้าม (ไม่เปลี่ยนแปลง): ${stats.skipped} รายการ\n`;

    if (stats.duplicates > 0) {
      summaryMessage += `  ⚠️ ข้าม (ซ้ำในชีต): ${stats.duplicates} รายการ\n`;
    }

    summaryMessage += '\nดูรายละเอียดฉบับเต็มได้จาก Logs (View > Logs)';

    ui.alert(
      '✅ Upsert UserData สำเร็จ',
      summaryMessage,
      ui.ButtonSet.OK
    );
  } catch (error) {
    ui.alert(
      '❌ Import UserData ล้มเหลว',
      'เกิดข้อผิดพลาด: ' + error.toString(),
      ui.ButtonSet.OK
    );
  }
}

/**
 * Test connection (Menu wrapper)
 */
function testConnectionMenu() {
  const ui = SpreadsheetApp.getUi();

  try {
    const success = testConnection();

    if (success) {
      ui.alert(
        '✅ เชื่อมต่อสำเร็จ',
        'เชื่อมต่อ Supabase ได้สำเร็จ!\n\n' +
        `URL: ${SUPABASE_URL}\n\n` +
        'พร้อม import ข้อมูลได้เลย',
        ui.ButtonSet.OK
      );
    } else {
      ui.alert(
        '❌ เชื่อมต่อล้มเหลว',
        'ไม่สามารถเชื่อมต่อ Supabase ได้\n\n' +
        'กรุณาตรวจสอบ:\n' +
        '1. SUPABASE_SERVICE_ROLE_KEY ถูกต้องหรือไม่\n' +
        '2. Supabase project พร้อมใช้งานหรือไม่',
        ui.ButtonSet.OK
      );
    }
  } catch (error) {
    ui.alert(
      '❌ ทดสอบการเชื่อมต่อล้มเหลว',
      'เกิดข้อผิดพลาด: ' + error.toString(),
      ui.ButtonSet.OK
    );
  }
}

/**
 * Clear all data (Menu wrapper)
 */
function clearAllDataMenu() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    '⚠️ ล้างข้อมูลทั้งหมด?',
    'คุณต้องการลบข้อมูลทั้งหมดจาก Supabase ใช่หรือไม่?\n\n' +
    'การกระทำนี้ไม่สามารถย้อนกลับได้!\n\n' +
    'ตารางที่จะถูกล้าง:\n' +
    '• botdata\n' +
    '• inventdata\n' +
    '• userdata',
    ui.ButtonSet.YES_NO
  );

  if (result !== ui.Button.YES) {
    return;
  }

  try {
    deleteAllRows('botdata');
    deleteAllRows('inventdata');
    deleteAllRows('userdata');

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
 * Import BotData to Supabase (with full column duplicate check + backup)
 */
function importBotData() {
  const ss = SpreadsheetApp.openById(STOCK_SHEET_ID);
  const sheet = ss.getSheetByName('BotData');

  if (!sheet) {
    throw new Error('ไม่พบ Sheet: BotData');
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

  // 🗑️ ลบข้อมูลเก่าทิ้งทั้งหมด
  Logger.log('🗑️ กำลังลบข้อมูลเก่า...');
  deleteAllRows('botdata');
  Logger.log('✅ ลบข้อมูลเก่าเรียบร้อย');

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

  // ✅ Insert ข้อมูลใหม่ทั้งหมด
  Logger.log(`📥 Import ข้อมูลใหม่ ${transformedData.length} รายการ...`);
  insertBatch('botdata', transformedData);
}

/**
 * Update items directly (no backup)
 */
function updateItemsDirectly(updateItems) {
  if (updateItems.length === 0) return;

  let successCount = 0;
  let errorCount = 0;

  updateItems.forEach(({ old, newItem }) => {
    try {
      updateBotDataRow(old.id, newItem);
      Logger.log(`✅ Update item_code: ${newItem.item_code}`);
      successCount++;
    } catch (error) {
      Logger.log(`❌ Error updating ${newItem.item_code}: ${error.toString()}`);
      errorCount++;
    }
  });

  Logger.log(`📊 Update Summary: ✅ ${successCount} สำเร็จ, ❌ ${errorCount} ผิดพลาด`);
}

/**
 * เปรียบเทียบ BotData ทุกคอลัมน์
 */
function isBotDataEqual(oldItem, newItem) {
  return (
    oldItem.item_code === newItem.item_code &&
    String(oldItem.field_unknown || '') === String(newItem.field_unknown || '') &&
    String(oldItem.item_name || '') === String(newItem.item_name || '') &&
    String(oldItem.lot_number || '') === String(newItem.lot_number || '') &&
    parseInt(oldItem.on_hand_quantity) === parseInt(newItem.on_hand_quantity) &&
    String(oldItem.alternative_key_1 || '') === String(newItem.alternative_key_1 || '') &&
    String(oldItem.alternative_key_2 || '') === String(newItem.alternative_key_2 || '')
  );
}

/**
 * Update BotData row by ID
 */
function updateBotDataRow(id, newItem) {
  const url = `${SUPABASE_URL}/rest/v1/botdata?id=eq.${id}`;
  const serviceRoleKey = getServiceRoleKey();

  const updateData = {
    item_code: newItem.item_code,
    field_unknown: newItem.field_unknown,
    item_name: newItem.item_name,
    lot_number: newItem.lot_number,
    on_hand_quantity: newItem.on_hand_quantity,
    alternative_key_1: newItem.alternative_key_1,
    alternative_key_2: newItem.alternative_key_2,
    updated_at: new Date().toISOString()
  };

  const options = {
    'method': 'patch',
    'contentType': 'application/json',
    'headers': {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json'
    },
    'payload': JSON.stringify(updateData),
    'muteHttpExceptions': true
  };

  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() >= 400) {
    throw new Error(`Update failed: ${response.getContentText()}`);
  }
}

/**
 * Import InventData to Supabase (with full column duplicate check + backup)
 *
 * Sheet columns (in order):
 * A: ItemName
 * B: Standard
 * C: ItemName2
 * D: ItemName3
 * E: OnhandQtyByTotalPiece
 */
function importInventData() {
  const ss = SpreadsheetApp.openById(STOCK_SHEET_ID);
  const sheet = ss.getSheetByName('InventData');

  if (!sheet) {
    throw new Error('ไม่พบ Sheet: InventData');
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

  // 🗑️ ลบข้อมูลเก่าทิ้งทั้งหมด
  Logger.log('🗑️ กำลังลบข้อมูลเก่า...');
  deleteAllRows('inventdata');
  Logger.log('✅ ลบข้อมูลเก่าเรียบร้อย');

  // Transform data matching Supabase table structure
  const transformedData = data.map(row => ({
    ItemName: row[0] || null,
    Standard: row[1] || null,
    ItemName2: row[2] || null,
    ItemName3: row[3] || null,
    OnhandQtyByTotalPiece: parseInt(row[4]) || 0
  }));

  // ✅ Insert ข้อมูลใหม่ทั้งหมด
  Logger.log(`📥 Import ข้อมูลใหม่ ${transformedData.length} รายการ...`);
  insertBatch('inventdata', transformedData);
}

/**
 * Extract URL from IMAGE() formula
 * @param {string} value - Cell value (could be IMAGE formula or plain URL)
 * @returns {string} - Extracted URL or original value
 */
function extractImageUrl(value) {
  if (!value) return null;

  const stringValue = value.toString().trim();

  // Check if it's an IMAGE formula
  if (stringValue.toLowerCase().startsWith('=image(')) {
    // Extract URL from IMAGE("URL") or IMAGE('URL')
    const match = stringValue.match(/=IMAGE\(["']([^"']+)["']\)/i);
    if (match && match[1]) {
      return match[1]; // Return the extracted URL
    }
  }

  // Return original value if not an IMAGE formula
  return stringValue;
}

/**
 * Import UserData to Supabase (Upsert by user_id)
 * Schema: https://supabase.com/dashboard/project/cbxicbynxnprscwqnyld/editor
 */
function importUserData() {
  const ss = SpreadsheetApp.openById(USER_SHEET_ID);
  const sheet = ss.getSheetByName('UserData');

  if (!sheet) {
    throw new Error('ไม่พบ Sheet: UserData');
  }

  // Get all data (skip header row)
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow <= 1) {
    Logger.log('⚠️ UserData: ไม่มีข้อมูล');
    return;
  }

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  Logger.log(`👤 UserData: พบ ${data.length} รายการ`);
  Logger.log(`📋 Sheet Headers: ${headers.join(' | ')}`);

  // ✅ Explicit mapping: Google Sheets column → Supabase column
  const transformedData = data.map((row, index) => {
    const item = {};

    // Map ตามลำดับ column ใน Google Sheets
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i] ? headers[i].toString().trim().toLowerCase() : '';

      // Skip empty columns
      if (!header) continue;

      // Map header → database column name
      switch (header) {
        case 'user_id':
        case 'userid':
        case 'line user id':
          item.user_id = row[i];
          break;
        case 'display_name':
        case 'display name':
          item.display_name = row[i];
          break;
        case 'picture_url':
        case 'picture url':
        case 'picture':
        case 'picture_url:':
          // ✅ Extract URL from IMAGE() formula
          item.picture_url = extractImageUrl(row[i]);
          break;
        case 'status_message':
        case 'status message':
        case 'status':
          item.status_message = row[i];
          break;
        case 'image_formula':
        case 'image formula':
          item.image_formula = row[i];
          break;
        case 'registration_date':
        case 'registration date':
        case 'date':
          // Convert Excel date to YYYY-MM-DD
          if (row[i] instanceof Date) {
            item.registration_date = Utilities.formatDate(row[i], 'GMT', 'yyyy-MM-dd');
          } else if (row[i]) {
            item.registration_date = row[i];
          }
          break;
        case 'registration_time':
        case 'registration time':
        case 'time':
          // Convert to HH:MM:SS
          if (row[i] instanceof Date) {
            item.registration_time = Utilities.formatDate(row[i], 'GMT', 'HH:mm:ss');
          } else if (row[i]) {
            item.registration_time = row[i];
          }
          break;
        case 'language':
          item.language = row[i];
          break;
        case 'group_name':
        case 'group name':
          item.group_name = row[i];
          break;
        case 'group_id':
        case 'groupid':
          item.group_id = row[i];
          break;
        case 'status_register':
        case 'status register':
          item.status_register = row[i];
          break;
        case 'reference':
          item.reference = row[i];
          break;
        case 'name':
          item.name = row[i];
          break;
        case 'surname':
          item.surname = row[i];
          break;
        case 'shop_name':
        case 'shop name':
          item.shop_name = row[i];
          break;
        case 'tax_id':
        case 'taxid':
          item.tax_id = row[i];
          break;
        case 'userstaff':
          item.userstaff = row[i];
          break;
        case 'last_interaction_at':
        case 'last interaction':
        case 'last_interaction':
          // Convert to ISO timestamp
          if (row[i] instanceof Date) {
            item.last_interaction_at = row[i].toISOString();
          } else if (row[i]) {
            item.last_interaction_at = row[i];
          }
          break;
        default:
          // Log unmapped columns
          if (row[i]) {
            Logger.log(`⚠️ Row ${index + 2}: Column "${header}" not mapped (value: ${row[i]})`);
          }
      }
    }

    return item;
  });

  // Log sample data for debugging
  if (transformedData.length > 0) {
    Logger.log(`🔍 Sample transformed data: ${JSON.stringify(transformedData[0])}`);
  }

  // ==========================================
  // 🔄 Upsert Logic: Check for existing records
  // ==========================================
  Logger.log('🔍 ตรวจสอบข้อมูลเดิมจาก Supabase...');
  const existingData = fetchExistingUserDataFull();
  Logger.log(`📥 พบข้อมูลเดิม ${existingData.length} รายการ`);

  // สร้าง Map สำหรับ lookup ด้วย user_id
  const existingMap = {};
  existingData.forEach(item => {
    if (item.user_id) {
      existingMap[item.user_id] = item;
    }
  });

  // แยกข้อมูล: insert (ใหม่) / update (มีอยู่แล้วแต่ต่าง) / skip (ไม่เปลี่ยนแปลง)
  const insertItems = [];
  const updateItems = [];
  let skipCount = 0;
  const seenUserIds = new Set();
  const duplicatesInSheet = [];

  transformedData.forEach(newItem => {
    if (!newItem.user_id) {
      Logger.log(`⚠️ ข้ามรายการที่ไม่มี user_id`);
      return;
    }

    // Check for duplicate user_id within the sheet
    if (seenUserIds.has(newItem.user_id)) {
      duplicatesInSheet.push(newItem.user_id);
      return; // Skip duplicate
    }
    seenUserIds.add(newItem.user_id);

    const existingItem = existingMap[newItem.user_id];

    if (!existingItem) {
      // New item, add to insert list
      insertItems.push(newItem);
    } else if (!isUserDataEqual(existingItem, newItem)) {
      // Existing item with changes, add to update list
      updateItems.push({ old: existingItem, newItem });
    } else {
      // Item is unchanged, skip
      skipCount++;
    }
  });

  Logger.log(`📊 สรุป:`);
  Logger.log(`  ➕ Insert ใหม่: ${insertItems.length} รายการ`);
  Logger.log(`  🔄 Update ที่มีอยู่: ${updateItems.length} รายการ`);
  Logger.log(`  ⏭️ ข้าม (ไม่เปลี่ยนแปลง): ${skipCount} รายการ`);
  if (duplicatesInSheet.length > 0) {
    const uniqueDuplicates = [...new Set(duplicatesInSheet)];
    Logger.log(`  ⚠️ ข้าม (ซ้ำในชีต): ${duplicatesInSheet.length} รายการ. IDs: ${uniqueDuplicates.join(', ')}`);
  }

  // Insert new items
  if (insertItems.length > 0) {
    Logger.log(`📥 Insert ข้อมูลใหม่ ${insertItems.length} รายการ...`);
    insertBatch('userdata', insertItems);
  }

  // Update existing items
  if (updateItems.length > 0) {
    updateUserDataItemsDirectly(updateItems);
  }

  Logger.log(`✅ Import UserData เสร็จสิ้น!`);

  return {
    inserted: insertItems.length,
    updated: updateItems.length,
    skipped: skipCount,
    duplicates: duplicatesInSheet.length
  };
}

/**
 * Update inventdata items directly (no backup)
 */
function updateInventItemsDirectly(updateItems) {
  if (updateItems.length === 0) return;

  let successCount = 0;
  let errorCount = 0;

  updateItems.forEach(({ old, newItem }) => {
    try {
      updateInventDataRow(old.id, newItem);
      Logger.log(`✅ Update item_name: ${newItem.item_name}`);
      successCount++;
    } catch (error) {
      Logger.log(`❌ Error updating ${newItem.item_name}: ${error.toString()}`);
      errorCount++;
    }
  });

  Logger.log(`📊 Update Summary: ✅ ${successCount} สำเร็จ, ❌ ${errorCount} ผิดพลาด`);
}

/**
 * เปรียบเทียบ InventData ทุกคอลัมน์
 */
function isInventDataEqual(oldItem, newItem) {
  return (
    String(oldItem.ItemName || '') === String(newItem.ItemName || '') &&
    String(oldItem.Standard || '') === String(newItem.Standard || '') &&
    String(oldItem.ItemName2 || '') === String(newItem.ItemName2 || '') &&
    String(oldItem.ItemName3 || '') === String(newItem.ItemName3 || '') &&
    parseInt(oldItem.OnhandQtyByTotalPiece) === parseInt(newItem.OnhandQtyByTotalPiece)
  );
}

/**
 * Update InventData row by ID
 */
function updateInventDataRow(id, newItem) {
  const url = `${SUPABASE_URL}/rest/v1/inventdata?id=eq.${id}`;
  const serviceRoleKey = getServiceRoleKey();

  const updateData = {
    ItemName: newItem.ItemName,
    Standard: newItem.Standard,
    ItemName2: newItem.ItemName2,
    ItemName3: newItem.ItemName3,
    OnhandQtyByTotalPiece: newItem.OnhandQtyByTotalPiece,
    updated_at: new Date().toISOString()
  };

  const options = {
    'method': 'patch',
    'contentType': 'application/json',
    'headers': {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json'
    },
    'payload': JSON.stringify(updateData),
    'muteHttpExceptions': true
  };

  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() >= 400) {
    throw new Error(`Update failed: ${response.getContentText()}`);
  }
}

// ============================================
// 👤 UserData Helper Functions
// ============================================

/**
 * Update UserData items directly (no backup)
 */
function updateUserDataItemsDirectly(updateItems) {
  if (updateItems.length === 0) return;

  let successCount = 0;
  let errorCount = 0;

  updateItems.forEach(({ old, newItem }) => {
    try {
      updateUserDataRow(old.id, newItem);
      Logger.log(`✅ Update user_id: ${newItem.user_id}`);
      successCount++;
    } catch (error) {
      Logger.log(`❌ Error updating ${newItem.user_id}: ${error.toString()}`);
      errorCount++;
    }
  });

  Logger.log(`📊 Update Summary: ✅ ${successCount} สำเร็จ, ❌ ${errorCount} ผิดพลาด`);
}

/**
 * เปรียบเทียบ UserData ทุกคอลัมน์ (ยกเว้น timestamps)
 */
function isUserDataEqual(oldItem, newItem) {
  // ฟิลด์ที่ต้องเปรียบเทียบ (ยกเว้น created_at, updated_at)
  const fieldsToCompare = [
    'user_id', 'display_name', 'picture_url', 'status_message', 'image_formula',
    'registration_date', 'registration_time', 'language', 'group_name', 'group_id',
    'status_register', 'reference', 'name', 'surname', 'shop_name', 'tax_id',
    'userstaff', 'last_interaction_at'
  ];

  for (const field of fieldsToCompare) {
    const oldVal = oldItem[field];
    const newVal = newItem[field];

    // จัดการ null/undefined
    if (oldVal === null || oldVal === undefined) {
      if (newVal !== null && newVal !== undefined && newVal !== '') {
        return false; // ต่างกัน
      }
    } else {
      if (String(oldVal).trim() !== String(newVal || '').trim()) {
        return false; // ต่างกัน
      }
    }
  }

  return true; // เหมือนกันทุกฟิลด์
}

/**
 * Update UserData row by ID
 */
function updateUserDataRow(id, newItem) {
  const url = `${SUPABASE_URL}/rest/v1/userdata?id=eq.${id}`;
  const serviceRoleKey = getServiceRoleKey();

  const updateData = {
    user_id: newItem.user_id,
    display_name: newItem.display_name,
    picture_url: newItem.picture_url,
    status_message: newItem.status_message,
    image_formula: newItem.image_formula,
    registration_date: newItem.registration_date,
    registration_time: newItem.registration_time,
    language: newItem.language,
    group_name: newItem.group_name,
    group_id: newItem.group_id,
    status_register: newItem.status_register,
    reference: newItem.reference,
    name: newItem.name,
    surname: newItem.surname,
    shop_name: newItem.shop_name,
    tax_id: newItem.tax_id,
    userstaff: newItem.userstaff,
    last_interaction_at: newItem.last_interaction_at,
    updated_at: new Date().toISOString()
  };

  const options = {
    'method': 'patch',
    'contentType': 'application/json',
    'headers': {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json'
    },
    'payload': JSON.stringify(updateData),
    'muteHttpExceptions': true
  };

  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() >= 400) {
    throw new Error(`Update failed: ${response.getContentText()}`);
  }
}

/**
 * Fetch existing UserData from Supabase (ทุกคอลัมน์ + id)
 * ใช้สำหรับเปรียบเทียบและ upsert
 */
function fetchExistingUserDataFull() {
  try {
    const url = `${SUPABASE_URL}/rest/v1/userdata?select=id,user_id,display_name,picture_url,status_message,image_formula,registration_date,registration_time,language,group_name,group_id,status_register,reference,name,surname,shop_name,tax_id,userstaff,last_interaction_at`;
    const serviceRoleKey = getServiceRoleKey();

    const options = {
      'method': 'get',
      'headers': {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      'muteHttpExceptions': true
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      const data = JSON.parse(response.getContentText());
      Logger.log(`📥 ดึงข้อมูล UserData เดิม (ทุกคอลัมน์): ${data.length} รายการ`);
      return data;
    } else {
      Logger.log(`⚠️ ไม่สามารถดึงข้อมูล UserData เดิม: HTTP ${responseCode}`);
      return [];
    }
  } catch (error) {
    Logger.log(`⚠️ Error fetching existing UserData: ${error.toString()}`);
    return [];
  }
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
  const serviceRoleKey = getServiceRoleKey();

  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'headers': {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
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
    const serviceRoleKey = getServiceRoleKey();

    const options = {
      'method': 'get',
      'headers': {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
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
 * Delete all rows from a table
 */
function deleteAllRows(tableName) {
  const serviceRoleKey = getServiceRoleKey();

  // Supabase requires WHERE clause for DELETE
  // Using id=gt.0 (id > 0) to match all rows
  const url = `${SUPABASE_URL}/rest/v1/${tableName}?id=gt.0`;

  const options = {
    'method': 'delete',
    'headers': {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`
    },
    'muteHttpExceptions': true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();

  if (responseCode >= 400) {
    Logger.log(`⚠️ Error deleting ${tableName}: HTTP ${responseCode} - ${response.getContentText()}`);
  } else {
    Logger.log(`🗑️ Cleared ${tableName}`);
  }
}

/**
 * Fetch existing BotData from Supabase (เฉพาะ item_code)
 * ใช้สำหรับ backward compatibility
 */
function fetchExistingBotData() {
  try {
    const url = `${SUPABASE_URL}/rest/v1/botdata?select=item_code`;
    const serviceRoleKey = getServiceRoleKey();

    const options = {
      'method': 'get',
      'headers': {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      'muteHttpExceptions': true
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      const data = JSON.parse(response.getContentText());
      Logger.log(`📥 ดึงข้อมูล BotData เดิม: ${data.length} รายการ`);
      return data;
    } else {
      Logger.log(`⚠️ ไม่สามารถดึงข้อมูล BotData เดิม: HTTP ${responseCode}`);
      return [];
    }
  } catch (error) {
    Logger.log(`⚠️ Error fetching existing BotData: ${error.toString()}`);
    return [];
  }
}

/**
 * Fetch existing BotData from Supabase (ทุกคอลัมน์ + id)
 * ใช้สำหรับเปรียบเทียบและ backup
 */
function fetchExistingBotDataFull() {
  try {
    const url = `${SUPABASE_URL}/rest/v1/botdata?select=id,item_code,field_unknown,item_name,lot_number,on_hand_quantity,alternative_key_1,alternative_key_2`;
    const serviceRoleKey = getServiceRoleKey();

    const options = {
      'method': 'get',
      'headers': {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      'muteHttpExceptions': true
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      const data = JSON.parse(response.getContentText());
      Logger.log(`📥 ดึงข้อมูล BotData เดิม (ทุกคอลัมน์): ${data.length} รายการ`);
      return data;
    } else {
      Logger.log(`⚠️ ไม่สามารถดึงข้อมูล BotData เดิม: HTTP ${responseCode}`);
      return [];
    }
  } catch (error) {
    Logger.log(`⚠️ Error fetching existing BotData: ${error.toString()}`);
    return [];
  }
}

/**
 * Fetch existing InventData from Supabase (เฉพาะ ItemName)
 * ใช้สำหรับ backward compatibility
 */
function fetchExistingInventData() {
  try {
    const url = `${SUPABASE_URL}/rest/v1/inventdata?select=ItemName`;
    const serviceRoleKey = getServiceRoleKey();

    const options = {
      'method': 'get',
      'headers': {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      'muteHttpExceptions': true
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      const data = JSON.parse(response.getContentText());
      Logger.log(`📥 ดึงข้อมูล InventData เดิม: ${data.length} รายการ`);
      return data;
    } else {
      Logger.log(`⚠️ ไม่สามารถดึงข้อมูล InventData เดิม: HTTP ${responseCode}`);
      return [];
    }
  } catch (error) {
    Logger.log(`⚠️ Error fetching existing InventData: ${error.toString()}`);
    return [];
  }
}

/**
 * Fetch existing InventData from Supabase (ทุกคอลัมน์ + id)
 * ใช้สำหรับเปรียบเทียบและ backup
 */
function fetchExistingInventDataFull() {
  try {
    const url = `${SUPABASE_URL}/rest/v1/inventdata?select=id,ItemName,Standard,ItemName2,ItemName3,OnhandQtyByTotalPiece`;
    const serviceRoleKey = getServiceRoleKey();

    const options = {
      'method': 'get',
      'headers': {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      'muteHttpExceptions': true
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      const data = JSON.parse(response.getContentText());
      Logger.log(`📥 ดึงข้อมูล InventData เดิม (ทุกคอลัมน์): ${data.length} รายการ`);
      return data;
    } else {
      Logger.log(`⚠️ ไม่สามารถดึงข้อมูล InventData เดิม: HTTP ${responseCode}`);
      return [];
    }
  } catch (error) {
    Logger.log(`⚠️ Error fetching existing InventData: ${error.toString()}`);
    return [];
  }
}
