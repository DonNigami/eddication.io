/**
 * AccountReceivables Data Extractor
 * ดึงข้อมูลยอดคงค้างจาก Google Sheets ชีต "data"
 *
 * Data Structure:
 * - เริ่มจากแถวที่ 5 หรือแถวที่คอลัมน์ A มีคำว่า "รหัสลูกค้า"
 * - คอลัมน์ B: ชื่อลูกค้า (ไม่ขึ้นต้นด้วย CA หรือ INV)
 * - ยอดค้างรับคงเหลืออยู่ในคอลัมน์ K ของแถวว่างแรกหลังจากชื่อลูกค้า
 *
 * Output:
 * - ชีต "extract" โดยคอลัมน์ A เป็น Shopname และคอลัมน์ B เป็น Amount
 */

/************************************************
 * CONFIG
 ************************************************/
const SOURCE_SHEET_NAME = "data";
const TARGET_SHEET_NAME = "extract";
const HEADER_MARKER = "รหัสลูกค้า"; // ข้อความในคอลัมน์ A ที่ใช้หาจุดเริ่มต้น
const COL_CUSTOMER = 1; // คอลัมน์ B (index 1)
const COL_AMOUNT = 10;  // คอลัมน์ K (index 10)
const SKIP_PREFIXES = ["CA", "INV", "CN", "ca", "inv", "cn", "Ca", "Inv", "Cn"];

/************************************************
 * CREATE MENU - เมนูสำหรับรันฟังก์ชัน
 ************************************************/
/**
 * สร้างเมนูเมื่อเปิดไฟล์
 * Run automatically when spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('📊 ดึงข้อมูล AR')
    .addItem('✅ ดึงข้อมูลไปยังชีต extract', 'extractDataToExtractSheet')
    .addSeparator()
    .addSubMenu(ui.createMenu('🔧 Debug Tools')
      .addItem('📋 แสดงข้อมูลในชีต data (30 แถวแรก)', 'debugSourceData')
      .addItem('🔍 ทดสอบการดึงข้อมูล (ไม่เขียนชีต)', 'debugExtractOnly')
      .addItem('🧪 ทดสอบ validation ชื่อลูกค้า', 'debugCustomerNameValidation')
      .addItem('📍 แสดงตำแหน่งที่ใช้ค้นหา', 'debugFindPositions'))
    .addSeparator()
    .addItem('🗑️ เคลียร์ชีต extract', 'clearExtractSheet')
    .addToUi();
}

/************************************************
 * ค้นหาแถวเริ่มต้น (แถวที่มีคำว่า "รหัสลูกค้า" ในคอลัมน์ A)
 ************************************************/
function findStartRow_(sheet) {
  const data = sheet.getDataRange().getValues();

  for (let i = 0; i < data.length; i++) {
    const colA = String(data[i][0] || "").trim();
    if (colA.includes(HEADER_MARKER)) {
      return i + 1; // แปลงเป็น 1-based index
    }
  }

  // ถ้าไม่พบ ให้เริ่มจากแถวที่ 5
  return 5;
}

/************************************************
 * ตรวจสอบว่าเป็นชื่อลูกค้าที่ถูกต้องหรือไม่
 ************************************************/
function isValidCustomerName_(name) {
  if (!name || String(name).trim() === "") {
    return false;
  }

  const trimmedName = String(name).trim();

  // ตรวจสอบว่าไม่ขึ้นต้นด้วย CA หรือ INV
  for (const prefix of SKIP_PREFIXES) {
    if (trimmedName.startsWith(prefix)) {
      return false;
    }
  }

  // ตรวจสอบว่าไม่ใช่ยอดรวมหรือข้อความสรุป
  const summaryKeywords = ["ยอดรวม", "รวมทั้งหมด", "สรุป", "Total", "SUM"];
  for (const keyword of summaryKeywords) {
    if (trimmedName.includes(keyword)) {
      return false;
    }
  }

  return true;
}

/************************************************
 * ดึงข้อมูลทั้งหมดจากชีต "data"
 ************************************************/
function extractAccountReceivables_() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sourceSheet = ss.getSheetByName(SOURCE_SHEET_NAME);

    if (!sourceSheet) {
      Logger.log('❌ ไม่พบชีต: ' + SOURCE_SHEET_NAME);
      return [];
    }

    // หาแถวเริ่มต้น
    const startRow = findStartRow_(sourceSheet);
    Logger.log('เริ่มอ่านข้อมูลจากแถวที่: ' + startRow);

    // ดึงข้อมูลทั้งหมด
    const lastRow = sourceSheet.getLastRow();
    const data = sourceSheet.getRange(startRow, 1, lastRow - startRow + 1, 11).getValues();

    const results = [];
    let currentCustomer = null;
    let customerRow = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const actualRow = startRow + i; // แถวจริงในชีต

      const customerCell = row[COL_CUSTOMER]; // คอลัมน์ B
      const colA = String(row[0] || "").trim(); // คอลัมน์ A

      // ตรวจสอบคอลัมน์ B - ชื่อลูกค้า
      if (customerCell && isValidCustomerName_(customerCell)) {
        // ถ้ามีลูกค้าก่อนหน้านี้แล้ว ให้บันทึกก่อน
        if (currentCustomer) {
          Logger.log('⚠️ พบชื่อลูกค้าใหม่ก่อนที่จะพบยอดเงิน: ' + currentCustomer);
        }

        currentCustomer = String(customerCell).trim();
        customerRow = actualRow;
        Logger.log('✅ พบชื่อลูกค้า: "' + currentCustomer + '" (แถว ' + actualRow + ')');
        continue;
      }

      // ตรวจสอบว่าเป็นแถวว่างแรกหลังจากชื่อลูกค้าหรือไม่
      if (currentCustomer) {
        // เช็คว่าแถวนี้ว่างหรือไม่ (คอลัมน์ A และ B ว่าง)
        const isRowEmpty = (!colA || colA === "") &&
                          (!customerCell || String(customerCell).trim() === "");

        if (isRowEmpty) {
          // แถวว่างแรก - ดึงยอดค้างรับคงเหลือจากคอลัมน์ K
          const amountCell = row[COL_AMOUNT]; // คอลัมน์ K

          if (amountCell && String(amountCell).trim() !== "") {
            const amount = parseFloat(String(amountCell).replace(/,/g, '')) || 0;

            results.push({
              shopname: currentCustomer,
              amount: amount,
              shopnameRow: customerRow,
              amountRow: actualRow
            });

            Logger.log('💰 พบยอดค้างรับคงเหลือ: "' + currentCustomer + '" = ' + amount.toLocaleString('th-TH') + ' (แถว ' + actualRow + ')');
          } else {
            Logger.log('⚠️ แถวว่างแต่ไม่พบยอดค้างรับคงเหลือ: "' + currentCustomer + '" (แถว ' + actualRow + ')');
          }

          // รีเซ็ตเพื่อค้นหาลูกค้าคนถัดไป
          currentCustomer = null;
          customerRow = 0;
        }
      }
    }

    // ตรวจสอบกรณีที่ไม่พบแถวว่าง
    if (currentCustomer) {
      Logger.log('⚠️ ไม่พบแถวว่างสำหรับลูกค้า: "' + currentCustomer + '"');
    }

    return results;

  } catch (error) {
    Logger.log('❌ Error in extractAccountReceivables_: ' + error.toString());
    return [];
  }
}

/************************************************
 * เขียนข้อมูลไปยังชีต "extract"
 ************************************************/
function writeToExtractSheet_(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let targetSheet = ss.getSheetByName(TARGET_SHEET_NAME);

    // ถ้ายังไม่มีชีตให้สร้างใหม่
    if (!targetSheet) {
      targetSheet = ss.insertSheet(TARGET_SHEET_NAME);
    }

    // เคลียร์ข้อมูลเก่า
    targetSheet.clear();

    // เขียน Header
    targetSheet.getRange(1, 1).setValue("Shopname");
    targetSheet.getRange(1, 2).setValue("Amount");
    targetSheet.getRange(1, 3).setValue("Shopname Row");
    targetSheet.getRange(1, 4).setValue("Amount Row");

    // จัดรูปแบบ Header
    const headerRange = targetSheet.getRange(1, 1, 1, 4);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#4CAF50");
    headerRange.setFontColor("#FFFFFF");

    if (data.length === 0) {
      Logger.log('⚠️ ไม่มีข้อมูลที่จะเขียน');
      return;
    }

    // เตรียมข้อมูล
    const outputData = data.map(item => [
      item.shopname,
      item.amount,
      item.shopnameRow,
      item.amountRow
    ]);

    // เขียนข้อมูล
    if (outputData.length > 0) {
      targetSheet.getRange(2, 1, outputData.length, 4).setValues(outputData);
    }

    // จัดรูปแบบคอลัมน์ Amount (เป็นเงิน)
    const amountRange = targetSheet.getRange(2, 2, outputData.length, 1);
    amountRange.setNumberFormat("#,##0.00");
    amountRange.setHorizontalAlignment("right");

    // จัดรูปแบบคอลัมน์ Shopname
    const shopRange = targetSheet.getRange(2, 1, outputData.length, 1);
    shopRange.setHorizontalAlignment("left");

    // ปรับความกว้างของคอลัมน์
    targetSheet.setColumnWidth(1, 300); // Shopname
    targetSheet.setColumnWidth(2, 150); // Amount
    targetSheet.setColumnWidth(3, 120); // Shopname Row
    targetSheet.setColumnWidth(4, 120); // Amount Row

    // แช่แข็งแถว Header
    targetSheet.setFrozenRows(1);

    Logger.log('✅ เขียนข้อมูล ' + data.length + ' รายการ ไปยังชีต "' + TARGET_SHEET_NAME + '" เรียบร้อยแล้ว');

  } catch (error) {
    Logger.log('❌ Error in writeToExtractSheet_: ' + error.toString());
  }
}

/************************************************
 * ฟังก์ชันหลัก - ดึงและเขียนข้อมูล
 ************************************************/
function extractDataToExtractSheet() {
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('🚀 เริ่มต้นการดึงข้อมูล...');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const data = extractAccountReceivables_();

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('📊 สรุปผล:');
  Logger.log('  พบข้อมูลทั้งหมด: ' + data.length + ' รายการ');

  let totalAmount = 0;
  for (const item of data) {
    totalAmount += item.amount;
  }
  Logger.log('  ยอดรวมทั้งหมด: ' + totalAmount.toLocaleString('th-TH') + ' บาท');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  writeToExtractSheet_(data);

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('✅ เสร็จสิ้น');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

/************************************************
 * DEBUG FUNCTIONS - สำหรับตรวจสอบข้อมูล
 ************************************************/

/**
 * Debug: แสดงข้อมูลในชีต "data" 30 แถวแรก
 */
function debugSourceData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName(SOURCE_SHEET_NAME);

  if (!sourceSheet) {
    Logger.log('❌ ไม่พบชีต: ' + SOURCE_SHEET_NAME);
    return;
  }

  const startRow = findStartRow_(sourceSheet);
  const data = sourceSheet.getRange(startRow, 1, Math.min(30, sourceSheet.getLastRow() - startRow + 1), 11).getValues();

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('📋 ข้อมูลในชีต "data" (เริ่มจากแถว ' + startRow + ')');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const actualRow = startRow + i;
    const colA = String(row[0] || "").trim();
    const colB = String(row[1] || "").trim();
    const colK = String(row[10] || "").trim();

    Logger.log('แถว ' + actualRow + ':');
    Logger.log('  A: "' + colA + '"');
    Logger.log('  B: "' + colB + '"');
    Logger.log('  K: "' + colK + '"');
    Logger.log('');
  }
}

/**
 * Debug: ทดสอบการตรวจสอบชื่อลูกค้า
 */
function debugCustomerNameValidation() {
  const testNames = [
    "Recing Wheel",
    "CA1234",
    "INV-2023-001",
    "ยอดรวม",
    "ร้านค้า A",
    "ca test",
    "inv test"
  ];

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('🧪 ทดสอบการตรวจสอบชื่อลูกค้า');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  for (const name of testNames) {
    const isValid = isValidCustomerName_(name);
    Logger.log('"' + name + '" → ' + (isValid ? '✅ ถูกต้อง' : '❌ ไม่ถูกต้อง'));
  }
}

/**
 * Debug: แสดงผลการดึงข้อมูลโดยไม่เขียนไปชีต
 */
function debugExtractOnly() {
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('🔍 ทดสอบการดึงข้อมูล (ไม่เขียนไปชีต)');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const data = extractAccountReceivables_();

  Logger.log('พบข้อมูลทั้งหมด: ' + data.length + ' รายการ');
  Logger.log('');

  for (const item of data) {
    Logger.log('🏪 ' + item.shopname);
    Logger.log('   💰 ' + item.amount.toLocaleString('th-TH') + ' บาท');
    Logger.log('   📍 ชื่ออยู่แถว ' + item.shopnameRow + ', ยอดอยู่แถว ' + item.amountRow);
    Logger.log('');
  }

  let totalAmount = 0;
  for (const item of data) {
    totalAmount += item.amount;
  }

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('📈 ยอดรวมทั้งหมด: ' + totalAmount.toLocaleString('th-TH') + ' บาท');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

/**
 * Debug: แสดงตำแหน่งที่ใช้ในการค้นหา
 */
function debugFindPositions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName(SOURCE_SHEET_NAME);

  if (!sourceSheet) {
    Logger.log('❌ ไม่พบชีต: ' + SOURCE_SHEET_NAME);
    return;
  }

  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('📍 ตำแหน่งที่ใช้ในการค้นหา');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const startRow = findStartRow_(sourceSheet);
  Logger.log('แถวเริ่มต้น: ' + startRow);
  Logger.log('คอลัมน์ชื่อลูกค้า: ' + (COL_CUSTOMER + 1) + ' (B)');
  Logger.log('คอลัมน์ยอดค้างรับคงเหลือ: ' + (COL_AMOUNT + 1) + ' (K)');
  Logger.log('แถวสุดท้าย: ' + sourceSheet.getLastRow());
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

/**
 * เคลียร์ชีต "extract"
 */
function clearExtractSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const targetSheet = ss.getSheetByName(TARGET_SHEET_NAME);

  if (targetSheet) {
    targetSheet.clear();
    Logger.log('✅ เคลียร์ชีต "' + TARGET_SHEET_NAME + '" เรียบร้อยแล้ว');
  } else {
    Logger.log('⚠️ ไม่พบชีต "' + TARGET_SHEET_NAME + '"');
  }
}
