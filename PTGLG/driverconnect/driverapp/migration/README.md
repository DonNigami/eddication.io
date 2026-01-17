# Migration Guide: Google Sheets → Supabase

คู่มือการย้ายข้อมูลจาก Google Sheets ไปยัง Supabase

## ภาพรวมขั้นตอน

```
┌─────────────────┐      ┌─────────────┐      ┌─────────────┐
│  Google Sheets  │ ──▶  │  JSON Files │ ──▶  │  Supabase   │
│  (เดิม)         │      │  (Export)   │      │  (ใหม่)     │
└─────────────────┘      └─────────────┘      └─────────────┘
     Step 1-2                Step 3              Step 4-5
```

---

## Step 1: สร้าง Supabase Project

1. ไปที่ https://supabase.com/dashboard
2. คลิก **New Project**
3. ตั้งชื่อ Project และ Password
4. เลือก Region (แนะนำ: Singapore)
5. รอสร้างเสร็จ (~2 นาที)

### บันทึกข้อมูลสำคัญ:
- **Project URL**: `https://xxxxx.supabase.co`
- **anon key**: สำหรับ Frontend (index-supabase.html)
- **service_role key**: สำหรับ Migration script

> ดูได้ที่: Settings → API

---

## Step 2: สร้างตารางใน Supabase

1. ไปที่ **SQL Editor** ใน Supabase Dashboard
2. คลิก **New Query**
3. Copy เนื้อหาจากไฟล์ `supabase-schema.sql`
4. คลิก **Run**

### ตารางที่จะถูกสร้าง:
| ตาราง | คำอธิบาย |
|-------|----------|
| `jobdata` | ข้อมูลงาน/จุดส่ง |
| `alcohol_checks` | บันทึกแอลกอฮอล์ |
| `close_job_data` | ประวัติปิดงาน |
| `user_profiles` | โปรไฟล์ผู้ใช้ |
| `stations` | สถานีต้นทาง/ปลายทาง |

---

## Step 3: Export ข้อมูลจาก Google Sheets

### วิธีที่ 1: ใช้ Google Apps Script (แนะนำ)

1. เปิด Google Sheets ที่มีข้อมูล
2. ไปที่ **Extensions → Apps Script**
3. Copy โค้ดจากไฟล์ `export-sheets.js` ไปวาง
4. แก้ไข `SHEET_ID` ให้ตรงกับ Spreadsheet ของคุณ
5. Run function **`exportAllData`**
6. ดาวน์โหลดไฟล์ JSON จาก Google Drive

### วิธีที่ 2: Export เป็น CSV แล้วแปลงเป็น JSON

1. เปิดแต่ละ Sheet
2. File → Download → CSV
3. ใช้เครื่องมือออนไลน์แปลง CSV เป็น JSON
   - https://csvjson.com/csv2json

### ไฟล์ที่ต้อง Export:
```
📁 data/
├── jobdata.json
├── alcoholcheck.json
├── userprofile.json
├── station.json
└── origin.json (optional)
```

---

## Step 4: Import ข้อมูลเข้า Supabase

### ติดตั้ง Dependencies

```bash
cd migration
npm init -y
npm install @supabase/supabase-js
```

### แก้ไข Configuration

เปิดไฟล์ `import-supabase.js` แล้วแก้ไข:

```javascript
const SUPABASE_URL = 'https://xxxxx.supabase.co';  // ← ใส่ URL ของคุณ
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIs...';  // ← ใส่ service_role key
```

> ⚠️ **สำคัญ**: ใช้ `service_role` key ไม่ใช่ `anon` key

### วางไฟล์ JSON

```
📁 migration/
├── import-supabase.js
└── data/
    ├── jobdata.json
    ├── alcoholcheck.json
    ├── userprofile.json
    └── station.json
```

### Run Migration

```bash
node import-supabase.js
```

### ผลลัพธ์:
```
=====================================================
  SUPABASE MIGRATION SCRIPT
=====================================================
  Supabase URL: https://xxxxx.supabase.co
  Data folder: ./data
=====================================================

✅ Connected to Supabase

📦 Importing 1500 jobdata records...
  Inserted: 1500/1500
✅ Imported 1500 jobdata records

🍺 Importing 250 alcohol_checks records...
✅ Imported 250 alcohol_checks records

👤 Importing 50 user_profiles records...
✅ Imported 50 user_profiles records

📍 Importing 30 stations records...
✅ Imported 30 stations records

=====================================================
  MIGRATION COMPLETE
=====================================================
```

---

## Step 5: สร้าง Storage Bucket

1. ไปที่ **Storage** ใน Supabase Dashboard
2. คลิก **New bucket**
3. ตั้งชื่อ: `images`
4. เลือก **Public bucket**
5. คลิก **Create bucket**

### ตั้งค่า Policy (ถ้าจำเป็น):
```sql
-- อนุญาตให้ทุกคนอ่านรูป
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'images');

-- อนุญาตให้ authenticated users upload
CREATE POLICY "Allow uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'images');
```

---

## Step 6: อัปเดต Frontend

แก้ไขไฟล์ `index-supabase.html`:

```javascript
const SUPABASE_URL = 'https://xxxxx.supabase.co';  // ← URL ของคุณ
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIs...';  // ← anon key
```

---

## Step 7: ทดสอบ

1. เปิด `index-supabase.html` ใน browser
2. ค้นหา Reference ที่มีอยู่
3. ตรวจสอบว่าข้อมูลแสดงถูกต้อง
4. ทดสอบ Check-in / Check-out
5. ตรวจสอบ Realtime updates

---

## Troubleshooting

### ❌ "Cannot connect to Supabase"
- ตรวจสอบ URL และ Key
- ใช้ `service_role` key สำหรับ migration

### ❌ "Error: duplicate key value"
- ข้อมูลซ้ำใน database
- ลบข้อมูลเก่าก่อน หรือใช้ upsert

### ❌ "RLS policy violation"
- ใช้ `service_role` key แทน `anon` key
- หรือปิด RLS ชั่วคราวระหว่าง migrate

### ❌ รูปภาพไม่แสดง
- ตรวจสอบว่า bucket เป็น public
- URL รูปต้องเป็น Supabase Storage URL

---

## Rollback

ถ้าต้องการลบข้อมูลทั้งหมดและเริ่มใหม่:

```sql
-- ลบข้อมูลทั้งหมด (ระวัง!)
TRUNCATE TABLE jobdata CASCADE;
TRUNCATE TABLE alcohol_checks CASCADE;
TRUNCATE TABLE user_profiles CASCADE;
TRUNCATE TABLE stations CASCADE;
```

---

## รายการตรวจสอบ

- [ ] สร้าง Supabase project
- [ ] Run supabase-schema.sql
- [ ] Export ข้อมูลจาก Google Sheets
- [ ] Run import-supabase.js
- [ ] สร้าง Storage bucket 'images'
- [ ] อัปเดต index-supabase.html
- [ ] ทดสอบการทำงาน
- [ ] เปิดใช้งานจริง

---

## ติดต่อ

หากพบปัญหาหรือต้องการความช่วยเหลือเพิ่มเติม สามารถติดต่อได้ที่ทีมพัฒนา
