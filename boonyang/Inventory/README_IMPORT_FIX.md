# 🔧 UserData Import Fix - สรุปโดยย่อ

## 📋 ปัญหาหลักที่พบ

จากการวิเคราะห์โค้ด [menu.js:1-1585](boonyang/Inventory/backend/menu.js) พบปัญหาดังนี้:

### 1. Date/Time Conversion ❌
```javascript
// ❌ OLD CODE - ไม่รองรับทุก format
if (row[i] instanceof Date) {
  item.registration_date = Utilities.formatDate(row[i], 'GMT', 'yyyy-MM-dd');
}

// ✅ NEW CODE - รองรับทุก format
item.registration_date = convertToDateString(row[i], rowNum, 'registration_date');
```

### 2. Error Handling ❌
```javascript
// ❌ OLD - ไม่รู้ว่า row ไหน error
transformedData.forEach(newItem => { ... });

// ✅ NEW - Log ทุก row ที่ error
const errors = [];
for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
  try {
    // ... process ...
  } catch (error) {
    errors.push(`Row ${rowIndex + 2}: ${error.toString()}`);
  }
}
```

### 3. Batch Size ❌
```javascript
// ❌ OLD - ใหญ่เกินไป
const BATCH_SIZE = 1000; // อาจ timeout

// ✅ NEW - เล็กลง + retry
const BATCH_SIZE = 100;
// + Exponential backoff retry logic
```

---

## 🚀 Files ใหม่ที่สร้าง

### 1. [import-userdata-fixed.js](boonyang/Inventory/backend/import-userdata-fixed.js)
- Function import ที่ปรับปรุงแล้ว
- Error handling ดีขึ้น
- Date/Time conversion รองรับทุก format
- Retry logic สำหรับ batch insert

**Functions หลัก**:
- `importUserDataImproved()` - Import แบบใหม่
- `convertToDateString()` - แปลงวันที่
- `convertToTimeString()` - แปลงเวลา
- `convertToISOTimestamp()` - แปลง timestamp
- `insertBatchWithRetry()` - Insert พร้อม retry
- `testUserDataImport()` - Test import 10 rows

### 2. [userdata-import-diagnostic.js](boonyang/Inventory/backend/userdata-import-diagnostic.js)
- Tool สำหรับ diagnostic ปัญหา
- ตรวจสอบ headers, data quality, connection
- สรุปปัญหาและแนะนำวิธีแก้

**Functions หลัก**:
- `diagnoseUserDataImport()` - Diagnostic แบบเต็ม
- `viewLastDiagnostic()` - ดูผลล่าสุด
- `isHeaderMapped()` - ตรวจสอบ header mapping
- `getColumnName()` - ดู mapping

### 3. [USERDATA_IMPORT_GUIDE.md](boonyang/Inventory/USERDATA_IMPORT_GUIDE.md)
- คู่มือแก้ไขปัญหาทั้งหมด
- Common issues & solutions
- Checklist ก่อน import

---

## 📖 วิธีใช้งาน

### STEP 1: รัน Diagnostic
```javascript
// ใน Apps Script Editor
diagnoseUserDataImport();
```

### STEP 2: ดูผลลัพธ์
- **Apps Script Dashboard** > **Logs**
- หรือเมนู **🔍 UserData Import Diagnostic** > **👁️ View Last Diagnostic**

### STEP 3: Test Import
```javascript
// Test 10 rows ก่อน
testUserDataImport();
```

### STEP 4: Import จริง
```javascript
// Import ด้วย logic ใหม่
importUserDataImproved();
```

---

## 🔧 วิธีอัปเดตเมนู

แก้ไข `onOpen()` function ใน [menu.js](boonyang/Inventory/backend/menu.js):

```javascript
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('📦 Stock Cache Management')
    .addItem('🔄 อัปเดต BotData Cache', 'updateBotDataCache')
    // ... existing menu items ...
    .addToUi();

  ui.createMenu('🚀 Import to Supabase')
    // ... existing menu items ...
    .addToUi();

  // ✅ เพิ่มเมนูใหม่
  ui.createMenu('🔍 UserData Import Diagnostic')
    .addItem('🔍 Run Full Diagnostic', 'diagnoseUserDataImport')
    .addItem('👁️ View Last Diagnostic', 'viewLastDiagnostic')
    .addSeparator()
    .addItem('🧪 Test Import (10 rows)', 'testUserDataImport')
    .addItem('📥 Import with Improved Logic', 'importUserDataImproved')
    .addToUi();
}
```

---

## 🎯 Issues ที่พบบ่อย

### Issue 1: "registration_date is invalid"
**เหตุผล**: ข้อมูลใน Sheets เป็น text ที่ format ไม่ standard

**วิธีแก้**:
1. เปลี่ยน format cells: **Format** > **Number** > **Date**
2. หรือใช้ formula: `=DATEVALUE(A2)`

### Issue 2: "user_id is required"
**เหตุผล**: บาง rows ไม่มี user_id

**วิธีแก้**:
```javascript
// ใน Sheets ใช้ formula ตรวจสอบ
=COUNTBLANK(A2:A)  // นับ user_id ว่าง

=FILTER(A2:Z, A2:A="")  // ดู rows ที่ไม่มี user_id
```

### Issue 3: "Duplicate key violation"
**เหตุผล**: user_id ซ้ำใน database

**วิธีแก้**:
```sql
-- รันใน Supabase SQL Editor
DELETE FROM userdata
WHERE id NOT IN (
  SELECT MIN(id)
  FROM userdata
  GROUP BY user_id
);
```

---

## 📊 Schema Reference

### userdata table structure:
```sql
┌─────────────────────────────┬──────────────────────────┐
│ Column                      │ Type                     │
├─────────────────────────────┼──────────────────────────┤
│ id                          │ bigint (primary key)     │
│ user_id                     │ text (unique)            │
│ display_name                │ text                     │
│ picture_url                 │ text                     │
│ status_message              │ text                     │
│ image_formula               │ text                     │
│ registration_date           │ date (YYYY-MM-DD)        │
│ registration_time           │ time (HH:MM:SS)          │
│ language                    │ text                     │
│ group_name                  │ text                     │
│ group_id                    │ text                     │
│ status_register             │ text                     │
│ reference                   │ text                     │
│ name                        │ text                     │
│ surname                     │ text                     │
│ shop_name                   │ text                     │
│ tax_id                      │ text                     │
│ last_interaction_at         │ timestamp with time zone │
│ created_at                  │ timestamp with time zone │
│ updated_at                  │ timestamp with time zone │
└─────────────────────────────┴──────────────────────────┘
```

---

## ✅ Checklist ก่อน Import

- [ ] ตรวจสอบ headers ถูกต้อง
- [ ] ตรวจสอบทุก row มี user_id
- [ ] ตรวจสอบ format วันที่/เวลา
- [ ] รัน diagnostic
- [ ] Test import 10 rows
- [ ] Backup ข้อมูลเดิม
- [ ] เปิด Apps Script Logs

---

## 🆘 ถ้ายังไม่ได้

1. **เปิด log เต็มรูปแบบ**:
   ```javascript
   Logger.log(`Processing row ${rowNum}: ${JSON.stringify(item)}`);
   ```

2. **Import ทีละน้อย**:
   ```javascript
   const testRows = 10;
   ```

3. **ตรวจสอบ Supabase logs**:
   - Supabase Dashboard > Database > Logs

---

## 📚 References

- [Supabase REST API Docs](https://supabase.com/docs/guides/api)
- [Apps Script UrlFetchApp](https://developers.google.com/apps-script/reference/url-fetch)
- [PostgreSQL Date/Time Types](https://www.postgresql.org/docs/current/datatype-datetime.html)

---

**สร้าง**: 2026-03-15
**เวอร์ชัน**: 1.0
