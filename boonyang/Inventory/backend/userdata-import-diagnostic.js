/************************************************
 * 🔍 UserData Import Diagnostic Tool
 * ตรวจสอบสาเหตุที่ Import ไม่สมบูรณ์
 ************************************************/

/**
 * Diagnostic: ตรวจสอบปัญหาทั้งหมด
 */
function diagnoseUserDataImport() {
  const ui = SpreadsheetApp.getUi();
  const diagnostics = [];

  try {
    // ==========================================
    // 1. ตรวจสอบ Google Sheets
    // ==========================================
    diagnostics.push('📋 STEP 1: ตรวจสอบ Google Sheets\n');

    const ss = SpreadsheetApp.openById(USER_SHEET_ID);
    const sheet = ss.getSheetByName('UserData');

    if (!sheet) {
      diagnostics.push('❌ ไม่พบ Sheet: UserData');
      ui.alert('❌ ผิดพลาด', diagnostics.join('\n'), ui.ButtonSet.OK);
      return;
    }

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow <= 1) {
      diagnostics.push('❌ ไม่มีข้อมูลใน Sheet');
      ui.alert('❌ ผิดพลาด', diagnostics.join('\n'), ui.ButtonSet.OK);
      return;
    }

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    diagnostics.push(`✅ พบ ${lastRow - 1} rows, ${lastCol} columns`);
    diagnostics.push(`📋 Headers: ${headers.join(' | ')}\n`);

    // ==========================================
    // 2. ตรวจสอบ Header Mapping
    // ==========================================
    diagnostics.push('🔍 STEP 2: ตรวจสอบ Header Mapping\n');

    const mappedColumns = [];
    const unmappedColumns = [];

    headers.forEach((header, idx) => {
      const h = header.toString().trim().toLowerCase();
      const isMapped = isHeaderMapped(h);
      if (isMapped) {
        mappedColumns.push(`[${idx + 1}] ${header} → ${getColumnName(h)}`);
      } else if (h) {
        unmappedColumns.push(`[${idx + 1}] ${header}`);
      }
    });

    diagnostics.push('✅ Columns ที่ Map แล้ว:');
    mappedColumns.forEach(col => diagnostics.push(`  ${col}`));

    if (unmappedColumns.length > 0) {
      diagnostics.push('\n⚠️ Columns ที่ยังไม่ Map:');
      unmappedColumns.forEach(col => diagnostics.push(`  ${col}`));
    }

    // ==========================================
    // 3. ตรวจสอบ Data Quality (Sample 10 rows)
    // ==========================================
    diagnostics.push('\n🔍 STEP 3: ตรวจสอบคุณภาพข้อมูล (Sample 5 rows)\n');

    const sampleRows = Math.min(lastRow - 1, 5);
    const sampleData = sheet.getRange(2, 1, sampleRows, lastCol).getValues();

    sampleData.forEach((row, idx) => {
      const rowNum = idx + 2;
      const issues = [];

      // ตรวจสอบ user_id
      const userIdIdx = headers.findIndex(h =>
        h.toString().trim().toLowerCase() === 'user_id' ||
        h.toString().trim().toLowerCase() === 'userid' ||
        h.toString().trim().toLowerCase() === 'line user id'
      );

      if (userIdIdx === -1) {
        issues.push('ไม่พบ column user_id');
      } else if (!row[userIdIdx]) {
        issues.push('user_id ว่าง');
      }

      // ตรวจสอบ registration_date
      const dateIdx = headers.findIndex(h =>
        h.toString().trim().toLowerCase() === 'registration_date' ||
        h.toString().trim().toLowerCase() === 'date'
      );

      if (dateIdx !== -1 && row[dateIdx]) {
        const dateValue = row[dateIdx];
        if (dateValue instanceof Date) {
          if (isNaN(dateValue.getTime())) {
            issues.push('registration_date เป็น Invalid Date');
          }
        } else if (typeof dateValue === 'string') {
          const parsed = new Date(dateValue);
          if (isNaN(parsed.getTime())) {
            issues.push(`registration_date ไม่สามารถ parse: "${dateValue}"`);
          }
        }
      }

      // ตรวจสอบ registration_time
      const timeIdx = headers.findIndex(h =>
        h.toString().trim().toLowerCase() === 'registration_time' ||
        h.toString().trim().toLowerCase() === 'time'
      );

      if (timeIdx !== -1 && row[timeIdx]) {
        const timeValue = row[timeIdx];
        if (typeof timeValue === 'string' && !/^\d{2}:\d{2}:\d{2}$/.test(timeValue)) {
          const parsed = new Date(timeValue);
          if (isNaN(parsed.getTime())) {
            issues.push(`registration_time ไม่ถูกต้อง: "${timeValue}"`);
          }
        }
      }

      // ตรวจสอบ last_interaction_at
      const lastIntIdx = headers.findIndex(h =>
        h.toString().trim().toLowerCase() === 'last_interaction_at' ||
        h.toString().trim().toLowerCase() === 'last interaction' ||
        h.toString().trim().toLowerCase() === 'last_interaction'
      );

      if (lastIntIdx !== -1 && row[lastIntIdx]) {
        const lastIntValue = row[lastIntIdx];
        if (lastIntValue instanceof Date) {
          if (isNaN(lastIntValue.getTime())) {
            issues.push('last_interaction_at เป็น Invalid Date');
          }
        } else if (typeof lastIntValue === 'string') {
          const parsed = new Date(lastIntValue);
          if (isNaN(parsed.getTime())) {
            issues.push(`last_interaction_at ไม่สามารถ parse: "${lastIntValue}"`);
          }
        }
      }

      if (issues.length > 0) {
        diagnostics.push(`⚠️ Row ${rowNum}: ${issues.join(', ')}`);
      } else {
        diagnostics.push(`✅ Row ${rowNum}: ข้อมูลถูกต้อง`);
      }
    });

    // ==========================================
    // 4. ตรวจสอบ Supabase Connection
    // ==========================================
    diagnostics.push('\n🔗 STEP 4: ตรวจสอบการเชื่อมต่อ Supabase\n');

    try {
      const serviceRoleKey = getServiceRoleKey();
      diagnostics.push('✅ Service Role Key: ตั้งค่าแล้ว');

      const url = `${SUPABASE_URL}/rest/v1/userdata?limit=1`;
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
        diagnostics.push('✅ เชื่อมต่อ Supabase สำเร็จ');
      } else {
        diagnostics.push(`❌ เชื่อมต่อ Supabase ล้มเหลว: HTTP ${responseCode}`);
        diagnostics.push(`Response: ${response.getContentText()}`);
      }
    } catch (error) {
      diagnostics.push(`❌ Error: ${error.toString()}`);
    }

    // ==========================================
    // 5. ตรวจสอบ Existing Data
    // ==========================================
    diagnostics.push('\n📊 STEP 5: ตรวจสอบข้อมูลเดิมใน Supabase\n');

    try {
      const existingData = fetchExistingUserDataFull();
      diagnostics.push(`✅ พบข้อมูลเดิม ${existingData.length} รายการ`);

      if (existingData.length > 0) {
        // ตรวจสอบ duplicate user_id
        const userIds = existingData.map(d => d.user_id);
        const duplicates = userIds.filter((id, idx) => userIds.indexOf(id) !== idx);

        if (duplicates.length > 0) {
          diagnostics.push(`⚠️ พบ duplicate user_id: ${duplicates.length} รายการ`);
        } else {
          diagnostics.push('✅ ไม่พบ duplicate user_id');
        }
      }
    } catch (error) {
      diagnostics.push(`❌ Error: ${error.toString()}`);
    }

    // ==========================================
    // 6. สรุปปัญหาและแนะนำ
    // ==========================================
    diagnostics.push('\n' + '='.repeat(50));
    diagnostics.push('📋 สรุปและแนะนำ\n');

    let hasCriticalIssues = false;

    if (unmappedColumns.length > 0) {
      diagnostics.push('⚠️ พบ Columns ที่ยังไม่ Map:');
      diagnostics.push('   แก้ไข: เพิ่ม case ใน switch statement ของ importUserData()');
      hasCriticalIssues = true;
    }

    // ตรวจสอบ missing required columns
    const requiredColumns = ['user_id'];
    requiredColumns.forEach(col => {
      const found = headers.some(h => h.toString().trim().toLowerCase() === col.toLowerCase());
      if (!found) {
        diagnostics.push(`❌ ขาด Column จำเป็น: ${col}`);
        hasCriticalIssues = true;
      }
    });

    if (!hasCriticalIssues) {
      diagnostics.push('✅ ไม่พบปัญหา Critical');
      diagnostics.push('\nแนะนำ:');
      diagnostics.push('1. รัน testUserDataImport() เพื่อดู sample data');
      diagnostics.push('2. รัน importUserDataImproved() เพื่อ import ใหม่');
      diagnostics.push('3. ติดตาม log ใน Apps Script Dashboard');
    }

    // ==========================================
    // แสดงผล
    // ==========================================
    const result = diagnostics.join('\n');

    // เก็บ log ไว้ใน ScriptProperties
    PropertiesService.getScriptProperties().setProperty('LAST_DIAGNOSTIC_RESULT', result);

    // แสดงใน UI
    ui.alert(
      '📋 Diagnostic Result',
      `ตรวจสอบเสร็จสิ้น\n\n` +
      `(Log ถูกบันทึกไว้ใน ScriptProperties)\n\n` +
      `ดูรายละเอียดได้ที่:\n` +
      `Apps Script Dashboard > Logs`,
      ui.ButtonSet.OK
    );

    // Log ทั้งหมด
    Logger.log(result);

  } catch (error) {
    ui.alert(
      '❌ Diagnostic ล้มเหลว',
      error.toString(),
      ui.ButtonSet.OK
    );
  }
}

/**
 * ตรวจสอบว่า header ถูก map หรือยัง
 */
function isHeaderMapped(header) {
  const mappedHeaders = [
    'user_id', 'userid', 'line user id',
    'display_name', 'display name',
    'picture_url', 'picture url', 'picture',
    'status_message', 'status message', 'status',
    'image_formula', 'image formula',
    'registration_date', 'registration date', 'date',
    'registration_time', 'registration time', 'time',
    'language',
    'group_name', 'group name',
    'group_id', 'groupid',
    'status_register', 'status register',
    'reference',
    'name',
    'surname',
    'shop_name', 'shop name',
    'tax_id', 'taxid',
    'userstaff',
    'last_interaction_at', 'last interaction', 'last_interaction'
  ];

  return mappedHeaders.includes(header);
}

/**
 * ดูชื่อ column ใน database
 */
function getColumnName(header) {
  const columnMap = {
    'user_id': 'user_id',
    'userid': 'user_id',
    'line user id': 'user_id',
    'display_name': 'display_name',
    'display name': 'display_name',
    'picture_url': 'picture_url',
    'picture url': 'picture_url',
    'picture': 'picture_url',
    'status_message': 'status_message',
    'status message': 'status_message',
    'status': 'status_message',
    'image_formula': 'image_formula',
    'image formula': 'image_formula',
    'registration_date': 'registration_date',
    'registration date': 'registration_date',
    'date': 'registration_date',
    'registration_time': 'registration_time',
    'registration time': 'registration_time',
    'time': 'registration_time',
    'language': 'language',
    'group_name': 'group_name',
    'group name': 'group_name',
    'group_id': 'group_id',
    'groupid': 'group_id',
    'status_register': 'status_register',
    'status register': 'status_register',
    'reference': 'reference',
    'name': 'name',
    'surname': 'surname',
    'shop_name': 'shop_name',
    'shop name': 'shop_name',
    'tax_id': 'tax_id',
    'taxid': 'tax_id',
    'userstaff': 'userstaff',
    'last_interaction_at': 'last_interaction_at',
    'last interaction': 'last_interaction_at',
    'last_interaction': 'last_interaction_at'
  };

  return columnMap[header] || header;
}

/**
 * ดู Diagnostic Result ล่าสุด
 */
function viewLastDiagnostic() {
  const result = PropertiesService.getScriptProperties().getProperty('LAST_DIAGNOSTIC_RESULT');

  const ui = SpreadsheetApp.getUi();

  if (!result) {
    ui.alert(
      '⚠️ ไม่พบข้อมูล',
      'ยังไม่มีการรัน Diagnostic\n\n' +
      'ไปที่เมนู 🔍 Diagnostic > Run Diagnostic',
      ui.ButtonSet.OK
    );
    return;
  }

  ui.alert(
    '📋 Diagnostic Result (ล่าสุด)',
    result,
    ui.ButtonSet.OK
  );
}
