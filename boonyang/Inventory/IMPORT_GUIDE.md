# 📥 Import ข้อมูลจาก Google Sheets ไป Supabase
## วิธีรันใน Google Apps Script (ง่ายที่สุด!)

---

## ⚡ ขั้นตอนรวดเร็ว (3 นาที)

### 1️⃣ เปิด Google Apps Script Editor

1. เปิด Google Sheet: https://docs.google.com/spreadsheets/d/1BGVpH5-VuDh4iQcZN8gD5pW0n3_EvoSjXXbFGEaLMg8
2. ไปที่เมนู **Extensions** → **Apps Script**
3. คลิกปุ่ม **+** ( alongside "Files")
4. เลือก **Script**
5. ตั้งชื่อไฟล์: `import-to-supabase`

### 2️⃣ Copy Script ไปวาง

1. เปิดไฟล์: [import-to-supabase.js](backend/import-to-supabase.js)
2. Copy โค้ดทั้งหมด
3. วางใน Apps Script Editor
4. **สำคัญ**: แก้ไขบรรทัดที่ 11:

```javascript
const SUPABASE_SERVICE_ROLE_KEY = 'YOUR_SERVICE_ROLE_KEY_HERE';
```

เปลี่ยนเป็น Service Role Key ของคุณ:

**วิธีหา Key:**
1. ไปที่ [Supabase Dashboard](https://supabase.com/dashboard/project/cbxicbynxnprscwqnyld/settings/api)
2. คัดลอก `service_role` key (เริ่มต้นด้วย `eyJ...`)
3. วางในโค้ด

```javascript
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

### 3️⃣ บันทึกและรัน

1. กด **Ctrl+S** (หรือ 💾 บันทึก)
2. เลือกฟังก์ชัน: `importAllData` จาก dropdown
3. คลิกปุ่ม **▶ Run**
4. อนุญาตให้ script ทำงาน (ถ้าถาม)
5. คลิก **Yes** เพื่อยืนยันการ import

### 4️⃣ ดูผลลัพธ์

- **Execution Log** จะแสดงผลลัพธ์
- เปิด [Supabase Table Editor](https://supabase.com/dashboard/project/cbxicbynxnprscwqnyld/table-editor) เพื่อดูข้อมูล

---

## 🎯 ฟังก์ชันที่มี

| ฟังก์ชัน | รายละเอียด |
|---------|-----------|
| `importAllData()` | Import ข้อมูลทั้งหมด (BotData + InventData) |
| `testConnection()` | ทดสอบการเชื่อมต่อ Supabase |
| `importBotData()` | Import เฉพาะ BotData |
| `importInventData()` | Import เฉพาะ InventData |
| `clearAllData()` | ⚠️ ล้างข้อมูลทั้งหมด (ไม่แนะนำ) |

---

## ✅ ตรวจสอบก่อนรัน

### ✏️ Checklist:

- [ ] Service Role Key ถูกต้อง
- [ ] BotData sheet มีข้อมูล
- [ ] InventData sheet มีข้อมูล
- [ ] Database migration ถูก apply แล้ว

### 🧪 ทดสอบการเชื่อมต่อก่อน:

```javascript
// เลือกฟังก์ชัน: testConnection
// คลิก Run
```

ถ้าเห็น:
```
✅ เชื่อมต่อ Supabase สำเร็จ!
URL: https://cbxicbynxnprscwqnyld.supabase.co
```

= พร้อม import ข้อมูลได้เลย!

---

## 📊 ข้อมูลที่จะ Import

### BotData Sheet → botdata table

| Sheet Column | Database Field | ตัวอย่าง |
|-------------|---------------|----------|
| A | item_code | ABC123 |
| B | field_unknown | - |
| C | item_name | สินค้า A |
| D | lot_number | 1234 |
| E | on_hand_quantity | 10 |
| F | alternative_key_1 | KEY1 |
| G | alternative_key_2 | KEY2 |

### InventData Sheet → inventdata table

| Sheet Column | Database Field | ตัวอย่าง |
|-------------|---------------|----------|
| A | item_name | สินค้า A |
| B | stock_quantity | 5 |

---

## 🐛 ปัญหาที่อาจเกิดขึ้น

### Error: "Authorization failed"

**แก้ไข:** ตรวจสอบ Service Role Key
- ต้องเป็น `service_role` key (ไม่ใช่ `anon` key)
- ต้องไม่มีช่องว่างหรือตัวอักษรพิเศษ

### Error: "Relation does not exist"

**แก้ไข:** ต้อง apply database migration ก่อน
```bash
cd boonyang/Inventory
supabase db push
```

### Error: "Rate limit exceeded"

**แก้ไข:** Script จะ sleep 100ms ระหว่าง batch ถ้ายัง error ให้:
```javascript
// แก้ไขบรรทัดนี้ใน script (บรรทัด ~200)
Utilities.sleep(100); // เปลี่ยนเป็น 500
```

### Script ทำงานช้า

**ปกติ**: ถ้าข้อมูลเยอะๆ (1000+ rows) อาจใช้เวลา 1-2 นาที
- Script จะ insert ทีละ 1000 rows
- มี progress log ใน Execution Log

---

## 📝 Execution Log ตัวอย่าง

```
📦 BotData: พบ 1234 รายการ
✅ botdata Batch 1: Inserted 1000 rows
✅ botdata Batch 2: Inserted 234 rows

📊 botdata Summary:
  ✅ Inserted: 1234 rows
  ❌ Errors: 0 rows
  📝 Total: 1234 rows

📊 InventData: พบ 567 รายการ
✅ inventdata Batch 1: Inserted 567 rows

📊 inventdata Summary:
  ✅ Inserted: 567 rows
  ❌ Errors: 0 rows
  📝 Total: 567 rows
```

---

## 🔒 ความปลอดภัย

⚠️ **สำคัญมาก:**
- Service Role Key มีสิทธิ์เข้าถึงทุกอย่าง
- อย่าแชร์ key กับผู้อื่น
- อย่า commit ไฟล์ที่มี key ไปที่ Git
- Script ทำงานบน Google Servers ปลอดภัย

---

## 🚀 ถัดไป

หลังจาก import ข้อมูลสำเร็จ:

### 1. ตรวจสอบข้อมูลใน Supabase
ไปที่: [Table Editor](https://supabase.com/dashboard/project/cbxicbynxnprscwqnyld/table-editor)

### 2. Deploy TypeScript Backend
```bash
cd boonyang/Inventory/ts
npm install
npm run build
npm start
```

### 3. Test LINE Bot
- ส่งข้อความถามสต็อกไปที่ LINE Bot
- ตรวจสอบว่าได้รับข้อมูลจาก Supabase

---

## 💡 Tips

- **Import ซ้ำได้**: Script จะเพิ่มข้อมูลเข้าไป (ไม่ลบข้อมูลเดิม)
- **เช็คก่อน import**: ใช้ `testConnection()` ตรวจสอบก่อน
- **ดู log เสมอ**: Execution Log จะบอกสถานะทุกขั้นตอน
- **ปิดหน้าต่างได้**: Script ทำงานบน Cloud ไม่ต้องเปิด browser ค้าง

---

**ติดปัญหาตรงไหนบอกได้เลยครับ! 🙏**
