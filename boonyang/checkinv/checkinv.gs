/**
 * AccountReceivables Checker - Utility Functions
 * ตรวจสอบยอดคงค้างจาก Google Sheets
 *
 * เป็นส่วนเสริมของ code_new.gs สำหรับดึงข้อมูลจากชีท "extract"
 *
 * Data Structure (ชีท "extract"):
 * - คอลัมน์ A: ชื่อลูกค้า
 * - คอลัมน์ B: ยอดคงค้าง
 *
 * ใช้ร่วมกับ code_new.gs
 * - spreadsheet, settingBot, userSheet จาก code_new.gs
 * - COL_SHOPNAME_BACKEND (19) จาก code_new.gs - สำหรับค้นหาชื่อร้านในชีท extract
 */

/************************************************
 * CONFIG (ใช้ร่วมกับ code_new.gs)
 ************************************************/
const DATA_SHEET_NAME = "extract";
const DATA_COL_CUSTOMER = 0;  // คอลัมน์ A (index 0)
const DATA_COL_AMOUNT = 1;     // คอลัมน์ B (index 1)

/************************************************
 * ค้นหาชื่อร้านค้าจาก userId
 * ************************************************/
function getStoreNameByUserId(userId) {
  try {
    if (!userSheet) {
      Logger.log('ไม่พบ userSheet');
      return null;
    }

    const data = userSheet.getDataRange().getValues();

    // เริ่มจากแถวที่ 2 (ข้าม header)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const cellUserId = row[COL_USER_ID - 1]; // คอลัมน์ A
      const shopName = row[COL_SHOPNAME_BACKEND - 1]; // คอลัมน์ S (หลังบ้าน)

      // ตรวจสอบ userId ว่าตรงกันไหม
      if (cellUserId && String(cellUserId).trim() === String(userId).trim()) {
        // ตรวจสอบว่ามีชื่อร้านค้าไหม
        if (shopName && String(shopName).trim() !== '') {
          return String(shopName).trim();
        } else {
          // มี userId แต่ยังไม่มีชื่อร้านค้า
          return null;
        }
      }
    }

    // ไม่พบ userId ในระบบ
    return null;

  } catch (error) {
    Logger.log('Error in getStoreNameByUserId: ' + error.toString());
    return null;
  }
}

/************************************************
 * ดึงข้อมูลยอดคงค้างทั้งหมดจากชีท "extract"
 * ************************************************/
function getAccountReceivables_() {
  try {
    const dataSheet = spreadsheet.getSheetByName(DATA_SHEET_NAME);

    if (!dataSheet) {
      Logger.log('ไม่พบชีท: ' + DATA_SHEET_NAME);
      return {};
    }

    const data = dataSheet.getDataRange().getValues();
    const balances = {};

    // วนลูปตั้งแต่แถวที่ 2 (ข้าม header)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const customerCell = row[DATA_COL_CUSTOMER]; // คอลัมน์ A: ชื่อลูกค้า
      const amountCell = row[DATA_COL_AMOUNT]; // คอลัมน์ B: ยอดคงค้าง

      // ตรวจสอบว่ามีชื่อลูกค้าและยอดเงิน
      if (customerCell && String(customerCell).trim() !== '') {
        const customerName = String(customerCell).trim();
        const amount = parseFloat(String(amountCell || 0).replace(/,/g, '')) || 0;

        // เก็บยอดคงค้างตามชื่อลูกค้า
        balances[customerName] = amount;
      }
    }

    return balances;

  } catch (error) {
    Logger.log('Error in getAccountReceivables_: ' + error.toString());
    return {};
  }
}

/************************************************
 * ดึงยอดคงค้างตามชื่อร้านค้า
 ************************************************/
function getCustomerBalance_(customerName) {
  if (!customerName) return 0;

  const balances = getAccountReceivables_();
  const searchName = String(customerName).trim().toLowerCase();

  // ลบช่องว่างซ้ำและตัวอักษรพิเศษ
  const normalizeName = (name) => {
    return name.toLowerCase()
      .replace(/\s+/g, ' ')  // ลบช่องว่างซ้ำ
      .replace(/[^\w\s\u0E00-\u0E7F]/g, '')  // ลบตัวอักษรพิเศษ (ยกเว้นภาษาไทย)
      .trim();
  };

  const normalizedSearch = normalizeName(searchName);

  // 1. ค้นหาที่ตรงเป๊ะ (exact match) ก่อน
  for (const [key, value] of Object.entries(balances)) {
    const normalizedKey = normalizeName(key);
    if (normalizedKey === normalizedSearch) {
      Logger.log('✅ Exact match: "' + customerName + '" → "' + key + '" (' + value + ')');
      return value;
    }
  }

  // 2. ค้นหาแบบ includes (partial match)
  for (const [key, value] of Object.entries(balances)) {
    const normalizedKey = normalizeName(key);
    if (normalizedKey.includes(normalizedSearch) || normalizedSearch.includes(normalizedKey)) {
      Logger.log('⚠️ Partial match: "' + customerName + '" → "' + key + '" (' + value + ')');
      return value;
    }
  }

  // 3. ค้นหาแบบ fuzzy (ตรวจสอบว่ามีคำศัพท์หลักตรงกันหรือไม่)
  const searchWords = normalizedSearch.split(' ').filter(w => w.length > 2);

  for (const [key, value] of Object.entries(balances)) {
    const normalizedKey = normalizeName(key);
    const keyWords = normalizedKey.split(' ').filter(w => w.length > 2);

    // ตรวจสอบว่ามีคำที่ตรงกันอย่างน้อย 1 คำ
    const hasMatch = searchWords.some(sw => keyWords.some(kw => kw.includes(sw) || sw.includes(kw)));

    if (hasMatch) {
      Logger.log('🔍 Fuzzy match: "' + customerName + '" → "' + key + '" (' + value + ')');
      return value;
    }
  }

  Logger.log('❌ No match found for: "' + customerName + '"');
  return 0;
}

/************************************************
 * แปลงยอดเงินเป็นรูปแบบไทย
 ************************************************/
function formatAmount_(amount) {
  return amount.toLocaleString('th-TH') + ' บาท';
}

/************************************************
 * ตรวจสอบยอดคงค้างตาม userId (สำหรับเรียกจาก code_new.gs)
 * ************************************************/
function checkOutstandingBalance_(userId) {
  try {
    // Step 1: ตรวจสอบสิทธิ์และดึงชื่อร้านค้า
    const storeName = getStoreNameByUserId(userId);

    if (!storeName) {
      return 'คุณยังไม่ได้รับอนุญาติ โปรดติดต่อแอดมิน';
    }

    // Step 2: ดึงยอดคงค้างจากชีท data
    const amount = getCustomerBalance_(storeName);

    // Step 3: จัดรูปแบบข้อความตอบกลับ
    const formattedAmount = formatAmount_(amount);
    const timestamp = Utilities.formatDate(new Date(), 'GMT+7', 'dd/MM/yyyy HH:mm');

    return `📊 ยอดคงค้างสำหรับร้าน ${storeName}\n` +
           `💰 ยอดรวม: ${formattedAmount}\n\n` +
           `━━━━━━━━━━━━━━━━━━━━━━\n` +
           `📅 อัพเดทล่าสุด: ${timestamp}`;

  } catch (error) {
    Logger.log('Error in checkOutstandingBalance_: ' + error.toString());
    return '❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
  }
}

/************************************************
 * ตรวจสอบว่าข้อความเป็นการเช็คยอดคงค้างหรือไม่
 ************************************************/
function isCheckBalanceQuery_(text) {
  const t = String(text || "").trim().toLowerCase();
  return t.includes('เช็คยอดคงค้า') || t.includes('เช็คยอดคงค้ำ') || t.includes('check balance');
}

/************************************************
 * เตรียมข้อความตอบกลับสำหรับการเช็คยอดคงค้าง
 * (สำหรับเรียกจาก code_new.gs)
 ************************************************/
function prepareBalanceReply_(userId, message) {
  try {
    // ถ้ามี userId ให้ตรวจสอบยอดคงค้างตาม userId
    if (userId) {
      return checkOutstandingBalance_(userId);
    }

    // ถ้าไม่มี userId ให้ตรวจสอบจากข้อความ
    const msg = String(message || "").trim();

    if (!isCheckBalanceQuery_(msg)) {
      return null;
    }

    // แยกชื่อร้านค้าออกจากข้อความ
    const parts = msg.replace(/เช็คยอดคงค้า|เช็คยอดคงค้ำ|check balance/gi, '').trim();

    if (parts) {
      // มีชื่อร้านค้า - แสดงเฉพาะร้านนั้น
      const amount = getCustomerBalance_(parts);
      return `📊 ยอดคงค้างของ ${parts}:\n💰 ${formatAmount_(amount)}`;
    } else {
      // ไม่มีชื่อร้านค้า - แสดงทั้งหมด
      const balances = getAccountReceivables_();
      const customers = Object.keys(balances);

      if (customers.length === 0) {
        return '📊 ไม่พบข้อมูลยอดคงค้าง';
      }

      let reply = '📊 ยอดคงค้างทั้งหมด:\n\n';
      let grandTotal = 0;

      for (const customer of customers) {
        const amount = balances[customer];
        grandTotal += amount;
        reply += `🏪 ${customer}\n💰 ${formatAmount_(amount)}\n\n`;
      }

      reply += `━━━━━━━━━━━━━━━\n📈 ยอดรวมทั้งหมด: ${formatAmount_(grandTotal)}`;

      return reply;
    }

  } catch (error) {
    Logger.log('Error in prepareBalanceReply_: ' + error.toString());
    return '❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
  }
}

/************************************************
 * ฟังก์ชันทดสอบ (สำหรับรันใน Google Apps Script Editor)
 ************************************************/

/**
 * ทดสอบการเช็คยอดคงค้างทั้งหมด
 */
function testCheckBalanceAll() {
  const result = prepareBalanceReply_(null, 'เช็คยอดคงค้า');
  Logger.log(result);
}

/**
 * ทดสอบการเช็คยอดคงค้างตามชื่อร้านค้า
 */
function testCheckBalanceByStore() {
  const result = prepareBalanceReply_(null, 'เช็คยอดคงค้า ร้านค้า A');
  Logger.log(result);
}

/**
 * ทดสอบการเช็คยอดคงค้างตาม userId
 * แก้ไข userId ตรงนี้เพื่อทดสอบ
 */
function testCheckBalanceByUserId() {
  // แก้ไข userId ตรงนี้เพื่อทดสอบ
  const testUserId = 'YOUR_TEST_USER_ID_HERE';
  const result = checkOutstandingBalance_(testUserId);
  Logger.log(result);
}

/**
 * ทดสอบการดึงชื่อร้านค้าจาก userId
 */
function testGetStoreName() {
  // แก้ไข userId ตรงนี้เพื่อทดสอบ
  const testUserId = 'YOUR_TEST_USER_ID_HERE';
  const storeName = getStoreNameByUserId(testUserId);

  if (storeName) {
    Logger.log('✅ ชื่อร้านค้า: ' + storeName);
  } else {
    Logger.log('❌ ไม่พบชื่อร้านค้า หรือยังไม่ได้รับอนุญาติ');
  }
}

/**
 * ทดสอบการดึงข้อมูลยอดคงค้างทั้งหมด
 */
function testGetAccountReceivables() {
  const balances = getAccountReceivables_();

  Logger.log('=== ยอดคงค้างทั้งหมด (' + Object.keys(balances).length + ' ร้าน) ===');

  for (const [store, amount] of Object.entries(balances)) {
    Logger.log(store + ': ' + formatAmount_(amount));
  }

  const grandTotal = Object.values(balances).reduce((sum, val) => sum + val, 0);
  Logger.log('ยอดรวมทั้งหมด: ' + formatAmount_(grandTotal));
}

/************************************************
 * ฟังก์ชันเสริมสำหรับ Admin (ถ้าต้องการ)
 ************************************************/

/**
 * ดึงข้อมูลแบบ JSON (สำหรับ Dashboard หรือระบบอื่น)
 * @param {string} customerName ชื่อร้านค้า (optional)
 * @returns {Object} ข้อมูลในรูปแบบ JSON
 */
function getBalanceJSON(customerName) {
  try {
    const balances = getAccountReceivables_();

    if (customerName) {
      const amount = getCustomerBalance_(customerName);
      return {
        customer: customerName,
        balance: amount,
        formatted: formatAmount_(amount)
      };
    }

    // ส่งคืนทั้งหมด
    const result = [];
    let grandTotal = 0;

    for (const [customer, amount] of Object.entries(balances)) {
      result.push({
        customer: customer,
        balance: amount,
        formatted: formatAmount_(amount)
      });
      grandTotal += amount;
    }

    return {
      data: result,
      summary: {
        total_customers: result.length,
        grand_total: grandTotal,
        formatted: formatAmount_(grandTotal)
      }
    };

  } catch (error) {
    Logger.log('Error in getBalanceJSON: ' + error.toString());
    return {
      error: error.toString()
    };
  }
}

/**
 * สรุปข้อมูลยอดคงค้าง (สำหรับ Dashboard)
 * @returns {Object} ข้อมูลสรุป
 */
function getBalanceSummary() {
  try {
    const balances = getAccountReceivables_();
    const customers = Object.keys(balances);

    let total = 0;
    let maxAmount = 0;
    let minAmount = Infinity;
    let maxCustomer = '';
    let minCustomer = '';

    for (const [customer, amount] of Object.entries(balances)) {
      total += amount;

      if (amount > maxAmount) {
        maxAmount = amount;
        maxCustomer = customer;
      }

      if (amount < minAmount) {
        minAmount = amount;
        minCustomer = customer;
      }
    }

    return {
      total_customers: customers.length,
      total_amount: total,
      average: customers.length > 0 ? total / customers.length : 0,
      highest: {
        customer: maxCustomer,
        amount: maxAmount
      },
      lowest: {
        customer: minCustomer,
        amount: customers.length > 0 ? minAmount : 0
      },
      formatted: {
        total: formatAmount_(total),
        average: formatAmount_(customers.length > 0 ? total / customers.length : 0)
      }
    };

  } catch (error) {
    Logger.log('Error in getBalanceSummary: ' + error.toString());
    return null;
  }
}

/**
 * รายการร้านค้าทั้งหมด
 * @returns {Array} รายชื่อร้านค้า
 */
function getAllCustomers() {
  try {
    const balances = getAccountReceivables_();
    return Object.keys(balances);
  } catch (error) {
    Logger.log('Error in getAllCustomers: ' + error.toString());
    return [];
  }
}

/************************************************
 * DEBUG FUNCTIONS - สำหรับตรวจสอบปัญหา
 ************************************************/

/**
 * Debug: ตรวจสอบข้อมูลจริงในชีท "extract"
 */
function debugDataSheet() {
  try {
    const dataSheet = spreadsheet.getSheetByName(DATA_SHEET_NAME);

    if (!dataSheet) {
      Logger.log('❌ ไม่พบชีท: ' + DATA_SHEET_NAME);
      return;
    }

    const data = dataSheet.getDataRange().getValues();
    Logger.log('=== ข้อมูลในชีท "' + DATA_SHEET_NAME + '" ===');
    Logger.log('ทั้งหมด ' + data.length + ' แถว');
    Logger.log('');

    // แสดง 30 แถวแรกเพื่อตรวจสอบ
    for (let i = 0; i < Math.min(data.length, 30); i++) {
      const row = data[i];
      const colA = row[DATA_COL_CUSTOMER]; // คอลัมน์ A: ชื่อลูกค้า
      const colB = row[DATA_COL_AMOUNT]; // คอลัมน์ B: ยอดคงค้าง

      if (colA || colB) {
        Logger.log('แถว ' + (i + 1) + ':');
        Logger.log('  A (ชื่อลูกค้า): "' + colA + '"');
        Logger.log('  B (ยอดคงค้าง): "' + colB + '"');
        Logger.log('');
      }
    }

  } catch (error) {
    Logger.log('Error in debugDataSheet: ' + error.toString());
  }
}

/**
 * Debug: ค้นหาชื่อร้านที่ใกล้เคียงกับ "Racing Wheel"
 */
function debugFindSimilarStores() {
  try {
    const dataSheet = spreadsheet.getSheetByName(DATA_SHEET_NAME);

    if (!dataSheet) {
      Logger.log('❌ ไม่พบชีท: ' + DATA_SHEET_NAME);
      return;
    }

    const data = dataSheet.getDataRange().getValues();
    const searchTerms = ['Racing Wheel', 'Recing Wheel', 'racing', 'wheel', 'recing'];

    Logger.log('=== ค้นหาชื่อร้านที่ใกล้เคียง ===');

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const customerCell = row[DATA_COL_CUSTOMER];

      if (customerCell) {
        const customerName = String(customerCell).trim().toLowerCase();

        // เช็คว่าใกล้เคียงกับคำค้นหาหรือไม่
        for (const term of searchTerms) {
          if (customerName.includes(term.toLowerCase())) {
            Logger.log('พบ: "' + customerCell + '" (แถว ' + (i + 1) + ')');
            break;
          }
        }
      }
    }

  } catch (error) {
    Logger.log('Error in debugFindSimilarStores: ' + error.toString());
  }
}

/**
 * Debug: ตรวจสอบ userId และชื่อร้าน
 */
function debugUserIdToStore() {
  // แก้ไข userId ที่ต้องการตรวจสอบ
  const testUserId = 'YOUR_TEST_USER_ID_HERE';

  const storeName = getStoreNameByUserId(testUserId);

  Logger.log('=== Debug userId → Store Name ===');
  Logger.log('userId: ' + testUserId);
  Logger.log('Store Name: "' + storeName + '"');

  if (storeName) {
    const balance = getCustomerBalance_(storeName);
    Logger.log('Balance: ' + balance);
  }
}

/**
 * Debug: ทดสอบ matching ระหว่างชื่อร้าน
 */
function testNameMatching() {
  const balances = getAccountReceivables_();

  Logger.log('=== Test Name Matching ===');
  Logger.log('ร้านค้าทั้งหมดในชีท data (' + Object.keys(balances).length + ' ร้าน):');

  for (const store of Object.keys(balances)) {
    Logger.log('  - "' + store + '" (Balance: ' + formatAmount_(balances[store]) + ')');
  }

  // ทดสอบค้นหา
  const testNames = ['Racing Wheel', 'Recing Wheel', ' racing wheel ', 'RacingWheel', 'racing'];

  Logger.log('');
  Logger.log('=== ทดสอบการค้นหา ===');

  for (const name of testNames) {
    const result = getCustomerBalance_(name);
    Logger.log('ค้นหา "' + name + '" → ' + formatAmount_(result));
  }
}

/**
 * Debug: แสดงรายละเอียดการทำงานของ getAccountReceivables_
 */
function debugAccountReceivablesProcess() {
  try {
    const dataSheet = spreadsheet.getSheetByName(DATA_SHEET_NAME);

    if (!dataSheet) {
      Logger.log('❌ ไม่พบชีท: ' + DATA_SHEET_NAME);
      return;
    }

    const data = dataSheet.getDataRange().getValues();
    const balances = {};

    Logger.log('=== Debug การทำงานของ getAccountReceivables_ ===');
    Logger.log('');

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const customerCell = row[DATA_COL_CUSTOMER]; // คอลัมน์ A: ชื่อลูกค้า
      const amountCell = row[DATA_COL_AMOUNT]; // คอลัมน์ B: ยอดคงค้าง

      // ตรวจสอบว่ามีชื่อลูกค้า
      if (customerCell && String(customerCell).trim() !== '') {
        const customerName = String(customerCell).trim();
        const amount = parseFloat(String(amountCell || 0).replace(/,/g, '')) || 0;

        balances[customerName] = amount;

        Logger.log('แถว ' + (i + 1) + ': พบ "' + customerName + '" → ' + formatAmount_(amount));
      }
    }

    Logger.log('');
    Logger.log('=== ผลลัพธ์สุดท้าย ===');

    for (const [store, amount] of Object.entries(balances)) {
      Logger.log(store + ': ' + formatAmount_(amount));
    }

  } catch (error) {
    Logger.log('Error in debugAccountReceivablesProcess: ' + error.toString());
  }
}
