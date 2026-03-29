/************************************************
 * ✅ Improved UserData Import Function
 * แก้ไขปัญหา Import ไม่สมบูรณ์
 ************************************************/

/**
 * Import UserData to Supabase (Improved Version)
 * - แก้ไขการแปลงข้อมูลวันที่/เวลา
 * - เพิ่ม logging แยก per row
 * - จัดการ error ทีละ row
 */
function importUserDataImproved() {
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
  Logger.log(`📋 Sheet Headers (${headers.length}): ${headers.join(' | ')}`);

  // ==========================================
  // STEP 1: Transform & Validate Data
  // ==========================================
  const transformedData = [];
  const errors = [];

  for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
    const row = data[rowIndex];
    const item = {};
    let rowHasError = false;

    try {
      // Map ตามลำดับ column ใน Google Sheets
      for (let colIndex = 0; colIndex < headers.length; colIndex++) {
        const header = headers[colIndex] ? headers[colIndex].toString().trim().toLowerCase() : '';

        if (!header) continue;

        const value = row[colIndex];
        const rowNum = rowIndex + 2; // +2 เพราะ row 1 คือ header

        // Map header → database column name
        switch (header) {
          case 'user_id':
          case 'userid':
          case 'line user id':
            item.user_id = value ? String(value).trim() : null;
            break;

          case 'display_name':
          case 'display name':
            item.display_name = value ? String(value).trim() : null;
            break;

          case 'picture_url':
          case 'picture url':
          case 'picture':
          case 'picture_url:':
            item.picture_url = extractImageUrl(value);
            break;

          case 'status_message':
          case 'status message':
          case 'status':
            item.status_message = value ? String(value).trim() : null;
            break;

          case 'image_formula':
          case 'image formula':
            item.image_formula = value ? String(value).trim() : null;
            break;

          case 'registration_date':
          case 'registration date':
          case 'date':
            item.registration_date = convertToDateString(value, rowNum, 'registration_date');
            break;

          case 'registration_time':
          case 'registration time':
          case 'time':
            item.registration_time = convertToTimeString(value, rowNum, 'registration_time');
            break;

          case 'language':
            item.language = value ? String(value).trim() : null;
            break;

          case 'group_name':
          case 'group name':
            item.group_name = value ? String(value).trim() : null;
            break;

          case 'group_id':
          case 'groupid':
            item.group_id = value ? String(value).trim() : null;
            break;

          case 'status_register':
          case 'status register':
            item.status_register = value ? String(value).trim() : null;
            break;

          case 'reference':
            item.reference = value ? String(value).trim() : null;
            break;

          case 'name':
            item.name = value ? String(value).trim() : null;
            break;

          case 'surname':
            item.surname = value ? String(value).trim() : null;
            break;

          case 'shop_name':
          case 'shop name':
            item.shop_name = value ? String(value).trim() : null;
            break;

          case 'tax_id':
          case 'taxid':
            item.tax_id = value ? String(value).trim() : null;
            break;

          case 'userstaff':
            item.userstaff = value ? String(value).trim() : null;
            break;

          case 'last_interaction_at':
          case 'last interaction':
          case 'last_interaction':
            item.last_interaction_at = convertToISOTimestamp(value, rowNum, 'last_interaction_at');
            break;

          default:
            // Log unmapped columns (เฉพาะที่มีค่า)
            if (value && String(value).trim() !== '') {
              Logger.log(`⚠️ Row ${rowNum}: Column "${header}" not mapped (value: ${value})`);
            }
        }
      }

      // Validation: ตรวจสอบ required fields
      if (!item.user_id) {
        errors.push(`Row ${rowIndex + 2}: ไม่มี user_id`);
        rowHasError = true;
      }

      if (!rowHasError) {
        transformedData.push(item);
      }

    } catch (error) {
      errors.push(`Row ${rowIndex + 2}: ${error.toString()}`);
      Logger.log(`❌ Error processing row ${rowIndex + 2}: ${error.toString()}`);
    }
  }

  Logger.log(`\n📊 Transformation Summary:`);
  Logger.log(`  ✅ Success: ${transformedData.length} rows`);
  Logger.log(`  ❌ Errors: ${errors.length} rows`);

  if (errors.length > 0) {
    Logger.log(`\n❌ Errors:\n${errors.join('\n')}`);
  }

  // Log sample data for debugging
  if (transformedData.length > 0) {
    Logger.log(`\n🔍 Sample transformed data (first 3 rows):`);
    transformedData.slice(0, 3).forEach((item, idx) => {
      Logger.log(`  [${idx + 1}] ${JSON.stringify(item)}`);
    });
  }

  // ==========================================
  // STEP 2: Fetch Existing Data
  // ==========================================
  Logger.log('\n🔍 ตรวจสอบข้อมูลเดิมจาก Supabase...');
  const existingData = fetchExistingUserDataFull();
  Logger.log(`📥 พบข้อมูลเดิม ${existingData.length} รายการ`);

  // สร้าง Map สำหรับ lookup ด้วย user_id
  const existingMap = {};
  existingData.forEach(item => {
    if (item.user_id) {
      existingMap[item.user_id] = item;
    }
  });

  // ==========================================
  // STEP 3: Classify Data (Insert/Update/Skip)
  // ==========================================
  const insertItems = [];
  const updateItems = [];
  let skipCount = 0;

  transformedData.forEach(newItem => {
    const existingItem = existingMap[newItem.user_id];

    if (!existingItem) {
      // ไม่พบข้อมูลเดิม → เพิ่มใหม่
      insertItems.push(newItem);
    } else if (!isUserDataEqual(existingItem, newItem)) {
      // พบข้อมูลเดิมแต่ต่างกัน → อัปเดต
      updateItems.push({ old: existingItem, newItem });
    } else {
      // ข้อมูลเหมือนเดิม → ข้าม
      skipCount++;
    }
  });

  Logger.log(`\n📊 Classification Summary:`);
  Logger.log(`  ➕ Insert: ${insertItems.length} rows`);
  Logger.log(`  🔄 Update: ${updateItems.length} rows`);
  Logger.log(`  ⏭️ Skip: ${skipCount} rows`);

  // ==========================================
  // STEP 4: Execute Insert/Update
  // ==========================================

  // Insert รายการใหม่
  if (insertItems.length > 0) {
    Logger.log(`\n📥 Inserting ${insertItems.length} new rows...`);
    insertBatchWithRetry('userdata', insertItems);
  }

  // Update รายการที่มีอยู่
  if (updateItems.length > 0) {
    Logger.log(`\n🔄 Updating ${updateItems.length} existing rows...`);
    updateUserDataItemsDirectly(updateItems);
  }

  Logger.log(`\n✅ Import UserData เสร็จสิ้น!`);
}

/**
 * Convert value to Date String (YYYY-MM-DD)
 */
function convertToDateString(value, rowNum, fieldName) {
  if (!value) return null;

  try {
    if (value instanceof Date) {
      return Utilities.formatDate(value, 'GMT', 'yyyy-MM-dd');
    } else if (typeof value === 'string') {
      // Try to parse string date
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return Utilities.formatDate(date, 'GMT', 'yyyy-MM-dd');
      }
    } else if (typeof value === 'number') {
      // Excel serial date
      const date = new Date((value - 25569) * 86400 * 1000);
      return Utilities.formatDate(date, 'GMT', 'yyyy-MM-dd');
    }
  } catch (e) {
    Logger.log(`⚠️ Row ${rowNum}: Invalid ${fieldName}: ${value}`);
  }

  return null;
}

/**
 * Convert value to Time String (HH:MM:SS)
 */
function convertToTimeString(value, rowNum, fieldName) {
  if (!value) return null;

  try {
    if (value instanceof Date) {
      return Utilities.formatDate(value, 'GMT', 'HH:mm:ss');
    } else if (typeof value === 'string') {
      // If already in time format
      if (/^\d{2}:\d{2}:\d{2}$/.test(value)) {
        return value;
      }
      // Try to parse
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return Utilities.formatDate(date, 'GMT', 'HH:mm:ss');
      }
    } else if (typeof value === 'number') {
      // Excel serial time
      const date = new Date((value - 25569) * 86400 * 1000);
      return Utilities.formatDate(date, 'GMT', 'HH:mm:ss');
    }
  } catch (e) {
    Logger.log(`⚠️ Row ${rowNum}: Invalid ${fieldName}: ${value}`);
  }

  return null;
}

/**
 * Convert value to ISO Timestamp
 */
function convertToISOTimestamp(value, rowNum, fieldName) {
  if (!value) return null;

  try {
    if (value instanceof Date) {
      return value.toISOString();
    } else if (typeof value === 'string') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    } else if (typeof value === 'number') {
      // Excel serial date
      const date = new Date((value - 25569) * 86400 * 1000);
      return date.toISOString();
    }
  } catch (e) {
    Logger.log(`⚠️ Row ${rowNum}: Invalid ${fieldName}: ${value}`);
  }

  return null;
}

/**
 * Insert batch with retry logic
 */
function insertBatchWithRetry(tableName, data) {
  if (!data || data.length === 0) {
    Logger.log(`⚠️ ${tableName}: ไม่มีข้อมูลที่จะ insert`);
    return;
  }

  let insertedCount = 0;
  let errorCount = 0;
  const BATCH_SIZE = 100; // เล็กลงเพื่อลด timeout

  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(data.length / BATCH_SIZE);
    const batch = data.slice(i, Math.min(i + BATCH_SIZE, data.length));

    Logger.log(`  📦 Batch ${batchNum}/${totalBatches}: ${batch.length} rows...`);

    let retryCount = 0;
    const maxRetries = 3;
    let success = false;

    while (!success && retryCount < maxRetries) {
      try {
        const response = insertToSupabase(tableName, batch);

        if (response && response.error) {
          if (retryCount < maxRetries - 1) {
            Logger.log(`  ⚠️ Batch ${batchNum} failed, retrying... (${retryCount + 1}/${maxRetries})`);
            Utilities.sleep(1000 * (retryCount + 1)); // Exponential backoff
            retryCount++;
          } else {
            Logger.log(`❌ Batch ${batchNum}: ${response.error}`);
            errorCount += batch.length;
          }
        } else {
          Logger.log(`  ✅ Batch ${batchNum}: Inserted ${batch.length} rows`);
          insertedCount += batch.length;
          success = true;
        }

      } catch (error) {
        if (retryCount < maxRetries - 1) {
          Logger.log(`  ⚠️ Batch ${batchNum} error: ${error.toString()}, retrying...`);
          Utilities.sleep(1000 * (retryCount + 1));
          retryCount++;
        } else {
          Logger.log(`❌ Batch ${batchNum}: ${error.toString()}`);
          errorCount += batch.length;
        }
      }
    }

    // Sleep between batches to avoid rate limiting
    if (i + BATCH_SIZE < data.length) {
      Utilities.sleep(200);
    }
  }

  Logger.log(`\n📊 ${tableName} Insert Summary:`);
  Logger.log(`  ✅ Inserted: ${insertedCount} rows`);
  Logger.log(`  ❌ Errors: ${errorCount} rows`);
}

/**
 * Test Import (Run แค่ 10 rows เพื่อ debug)
 */
function testUserDataImport() {
  const ss = SpreadsheetApp.openById(USER_SHEET_ID);
  const sheet = ss.getSheetByName('UserData');

  if (!sheet) {
    throw new Error('ไม่พบ Sheet: UserData');
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow <= 1) {
    Logger.log('⚠️ UserData: ไม่มีข้อมูล');
    return;
  }

  // Test เฉพาะ 10 rows
  const testRows = Math.min(lastRow - 1, 10);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const data = sheet.getRange(2, 1, testRows, lastCol).getValues();

  Logger.log(`🧪 Test Import: ${testRows} rows`);
  Logger.log(`📋 Headers: ${headers.join(' | ')}`);

  data.forEach((row, idx) => {
    Logger.log(`\n--- Row ${idx + 2} ---`);
    const item = {};

    for (let i = 0; i < headers.length; i++) {
      const header = headers[i] ? headers[i].toString().trim().toLowerCase() : '';
      if (header) {
        item[header] = row[i];
      }
    }

    Logger.log(JSON.stringify(item, null, 2));
  });
}
