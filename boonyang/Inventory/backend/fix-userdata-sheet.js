/************************************************
 * 🔧 UserData Sheet Fix Functions
 * ช่วยแก้ไข format ข้อมูลใน Google Sheets
 ************************************************/

/**
 * แก้ไข Headers ให้ถูกต้อง
 */
function fixUserDataHeaders() {
  const ss = SpreadsheetApp.openById(USER_SHEET_ID);
  const sheet = ss.getSheetByName('UserData');

  if (!sheet) {
    throw new Error('ไม่พบ Sheet: UserData');
  }

  const ui = SpreadsheetApp.getUi();

  const result = ui.alert(
    '🔧 แก้ไข Headers',
    'ต้องการแก้ไข Headers ให้ถูกต้องหรือไม่?\n\n' +
    'การแก้ไขจะเปลี่ยน:\n' +
    '• User_Id → user_id\n' +
    '• DisplayName → display_name\n' +
    '• ProfileUrl → picture_url\n' +
    '• Status → status_message\n' +
    '• image → image_formula\n' +
    '• 15/03/2026 → registration_date\n' +
    '• Time → registration_time\n' +
    '• GroupName → group_name\n' +
    '• GroupId → group_id\n' +
    '• shopname → shop_name\n' +
    '• taxid → tax_id',
    ui.ButtonSet.YES_NO
  );

  if (result !== ui.Button.YES) {
    return;
  }

  // อ่าน headers เดิม
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  // สร้าง mapping
  const newHeaders = headers.map(h => {
    if (!h) return '';

    const header = h.toString().trim().toLowerCase();

    switch (header) {
      case 'user_id':
      case 'userid':
        return 'user_id';
      case 'displayname':
      case 'display name':
        return 'display_name';
      case 'profileurl':
      case 'profile url':
      case 'picture':
      case 'picture_url':
        return 'picture_url';
      case 'status':
      case 'status message':
        return 'status_message';
      case 'image':
        return 'image_formula';
      case 'ภาษา':
      case 'language':
        return 'language';
      case 'time':
        return 'registration_time';
      case 'groupname':
      case 'group name':
        return 'group_name';
      case 'groupid':
        return 'group_id';
      case 'statusregister':
      case 'status register':
        return 'status_register';
      case 'shopname':
      case 'shop name':
        return 'shop_name';
      case 'taxid':
        return 'tax_id';
      case 'userstaff':
        return 'userstaff';
      default:
        // ถ้าเป็นวันที่ (เช่น 15/03/2026)
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(h)) {
          return 'registration_date';
        }
        return h; // คงเดิม
    }
  });

  // เขียน headers ใหม่
  sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);

  ui.alert(
    '✅ เสร็จสิ้น',
    'แก้ไข Headers เรียบร้อยแล้ว\n\n' +
    'Headers ใหม่:\n' +
    newHeaders.join(' | '),
    ui.ButtonSet.OK
  );
}

/**
 * แก้ไข Time Format (14.12 th → 14:12)
 */
function fixTimeFormat() {
  const ss = SpreadsheetApp.openById(USER_SHEET_ID);
  const sheet = ss.getSheetByName('UserData');

  if (!sheet) {
    throw new Error('ไม่พบ Sheet: UserData');
  }

  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    throw new Error('ไม่มีข้อมูล');
  }

  // หา column registration_time
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const timeColIdx = headers.findIndex(h =>
    h.toString().trim().toLowerCase() === 'registration_time'
  );

  if (timeColIdx === -1) {
    throw new Error('ไม่พบ column registration_time');
  }

  const ui = SpreadsheetApp.getUi();
  const result = ui.alert(
    '🔧 แก้ไข Time Format',
    `ต้องการแก้ไข Time Format ใน Column ${timeColIdx + 1} หรือไม่?\n\n` +
    'จะแก้ไข:\n' +
    '• 14.12 th → 14:12\n' +
    '• 14.12 → 14:12\n' +
    '• 14:12 th → 14:12',
    ui.ButtonSet.YES_NO
  );

  if (result !== ui.Button.YES) {
    return;
  }

  const timeData = sheet.getRange(2, timeColIdx + 1, lastRow - 1, 1).getValues();
  let fixedCount = 0;

  timeData.forEach((row, idx) => {
    const value = row[0];

    if (!value) return;

    const timeStr = value.toString().trim();
    let newTime = timeStr;

    // ลบ " th" และแก้ . เป็น :
    if (timeStr.includes('.') || timeStr.toLowerCase().includes('th')) {
      newTime = timeStr
        .replace(/\./g, ':')
        .replace(/\s+th$/gi, '')
        .replace(/\s+TH$/gi, '')
        .trim();

      // ตรวจสอบ format
      if (/^\d{1,2}:\d{2}$/.test(newTime) || /^\d{1,2}:\d{2}:\d{2}$/.test(newTime)) {
        const rowNum = idx + 2;
        sheet.getRange(rowNum, timeColIdx + 1).setValue(newTime);
        fixedCount++;
      }
    }
  });

  ui.alert(
    '✅ เสร็จสิ้น',
    `แก้ไข Time Format เรียบร้อยแล้ว\n\n` +
    `แก้ไข ${fixedCount} รายการ`,
    ui.ButtonSet.OK
  );
}

/**
 * สลับข้อมูล Tax ID (ถ้าอยู่ผิด column)
 */
function fixTaxIdColumn() {
  const ss = SpreadsheetApp.openById(USER_SHEET_ID);
  const sheet = ss.getSheetByName('UserData');

  if (!sheet) {
    throw new Error('ไม่พบ Sheet: UserData');
  }

  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    throw new Error('ไม่มีข้อมูล');
  }

  // หา columns
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const shopColIdx = headers.findIndex(h =>
    h.toString().trim().toLowerCase() === 'shop_name'
  );
  const taxColIdx = headers.findIndex(h =>
    h.toString().trim().toLowerCase() === 'tax_id'
  );

  if (shopColIdx === -1 || taxColIdx === -1) {
    throw new Error('ไม่พบ column shop_name หรือ tax_id');
  }

  const ui = SpreadsheetApp.getUi();

  // ตรวจสอบว่ามีปัญหาหรือไม่
  const sampleShop = sheet.getRange(2, shopColIdx + 1).getValue();
  const sampleTax = sheet.getRange(2, taxColIdx + 1).getValue();

  const hasIssue = /^\d{10,}$/.test(sampleShop?.toString() || '') &&
                   (!sampleTax || sampleTax.toString().trim() === '');

  if (!hasIssue) {
    ui.alert(
      'ℹ️ ไม่พบปัญหา',
      'ข้อมูล Tax ID ดูเหมือนถูกต้องแล้ว\n\n' +
      `shop_name: ${sampleShop}\n` +
      `tax_id: ${sampleTax}`,
      ui.ButtonSet.OK
    );
    return;
  }

  const result = ui.alert(
    '🔧 สลับข้อมูล Tax ID',
    `พบว่า Tax ID อาจอยู่ใน column shop_name\n\n` +
    `ตัวอย่าง:\n` +
    `shop_name (Column ${shopColIdx + 1}): ${sampleShop}\n` +
    `tax_id (Column ${taxColIdx + 1}): ${sampleTax || '(ว่าง)'}\n\n` +
    `ต้องการย้าย Tax ID ไป column tax_id หรือไม่?`,
    ui.ButtonSet.YES_NO
  );

  if (result !== ui.Button.YES) {
    return;
  }

  let movedCount = 0;

  for (let i = 2; i <= lastRow; i++) {
    const shopValue = sheet.getRange(i, shopColIdx + 1).getValue();
    const taxValue = sheet.getRange(i, taxColIdx + 1).getValue();

    // ถ้า shop_name เป็นตัวเลข 10+ หลัก และ tax_id ว่าง
    if (/^\d{10,}$/.test(shopValue?.toString() || '') &&
        (!taxValue || taxValue.toString().trim() === '')) {

      // ย้ายค่า
      sheet.getRange(i, taxColIdx + 1).setValue(shopValue);
      sheet.getRange(i, shopColIdx + 1).setValue('');
      movedCount++;
    }
  }

  ui.alert(
    '✅ เสร็จสิ้น',
    `ย้าย Tax ID เรียบร้อยแล้ว\n\n` +
    `ย้าย ${movedCount} รายการ`,
    ui.ButtonSet.OK
  );
}

/**
 * แก้ไขทั้งหมด (One-click fix)
 */
function fixAllUserDataIssues() {
  const ui = SpreadsheetApp.getUi();

  const result = ui.alert(
    '🔧 แก้ไขทั้งหมด',
    'ต้องการแก้ไขทั้งหมดหรือไม่?\n\n' +
    '1. แก้ไข Headers\n' +
    '2. แก้ไข Time Format\n' +
    '3. สลับ Tax ID ถ้าจำเป็น',
    ui.ButtonSet.YES_NO
  );

  if (result !== ui.Button.YES) {
    return;
  }

  try {
    fixUserDataHeaders();
    Utilities.sleep(1000);

    fixTimeFormat();
    Utilities.sleep(1000);

    fixTaxIdColumn();

    ui.alert(
      '✅ เสร็จสิ้นทั้งหมด',
      'แก้ไขปัญหาทั้งหมดเรียบร้อยแล้ว\n\n' +
      'พร้อม import ข้อมูลได้เลย!',
      ui.ButtonSet.OK
    );

  } catch (error) {
    ui.alert(
      '❌ ผิดพลาด',
      error.toString(),
      ui.ButtonSet.OK
    );
  }
}

/**
 * เพิ่มเมนู Fix Sheet
 */
function addFixSheetMenu() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('🔧 Fix UserData Sheet')
    .addItem('🔧 แก้ไขทั้งหมด (One-click)', 'fixAllUserDataIssues')
    .addSeparator()
    .addItem('📝 แก้ไข Headers', 'fixUserDataHeaders')
    .addItem('⏰ แก้ไข Time Format', 'fixTimeFormat')
    .addItem('💳 สลับ Tax ID Column', 'fixTaxIdColumn')
    .addSeparator()
    .addItem('🔍 ตรวจสอบผล', 'diagnoseUserDataImport')
    .addToUi();
}
