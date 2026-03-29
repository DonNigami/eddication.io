# 📥 Import Data from Google Sheets to Supabase

## Overview

Script นี้ใช้สำหรับ import ข้อมูลสินค้าจาก Google Sheets (BotData, InventData) ไปยัง Supabase database

## Prerequisites

### 1. Google Cloud Console Setup

1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/)
2. สร้าง Project ใหม่ (หรือใช้ที่มีอยู่)
3. เปิดใช้งาน **Google Sheets API**
   - APIs & Services → Library
   - ค้นหา "Google Sheets API"
   - คลิก "Enable"

### 2. Create Service Account

1. ไปที่ **APIs & Services** → **Credentials**
2. คลิก **Create Credentials** → **Service Account**
3. ตั้งชื่อ: `Boonyang Inventory Import`
4. คลิก **Create and Continue**
5. เลือกบทบาท: **Editor** (หรือ skip ได้)
6. คลิก **Done**

### 3. Export Service Account Key

1. คลิกที่ Service Account ที่สร้าง
2. ไปที่ tab **Keys**
3. คลิก **Add Key** → **Create New Key**
4. เลือก **JSON**
5. คลิก **Create** → ไฟล์ JSON จะถูก download มา
6. เปลี่ยนชื่อไฟล์เป็น `service-account.json`
7. ย้ายไปไว้ที่ `boonyang/Inventory/scripts/`

### 4. Share Google Sheets with Service Account

1. เปิดไฟล์ `service-account.json` และ copy `client_email`
2. เปิด Google Sheet: https://docs.google.com/spreadsheets/d/1BGVpH5-VuDh4iQcZN8gD5pW0n3_EvoSjXXbFGEaLMg8
3. คลิกปุ่ม **Share** มุมขวาบน
4. วาง `client_email` ลงในช่อง
5. ตั้งค่าเป็น **Editor**
6. คลิก **Send**

## Installation

```bash
cd boonyang/Inventory/scripts
npm install googleapis @supabase/supabase-js
```

## Environment Variables

สร้างไฟล์ `.env` ในโฟลเดอร์ `scripts`:

```bash
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

วิธีหา Service Role Key:
1. ไปที่ [Supabase Dashboard](https://supabase.com/dashboard/project/cbxicbynxnprscwqnyld/settings/api)
2. คัดลอก `service_role` key (เริ่มต้นด้วย `eyJ...`)

## Usage

### Run Import Script

```bash
# Using tsx (recommended)
npx tsx import-data-from-sheets.ts

# Or compile and run
tsc import-data-from-sheets.ts
node import-data-from-sheets.js
```

### Expected Output

```
🔗 Connected to Supabase
🔗 Connected to Google Sheets
📥 Fetching BotData...
✅ Fetched 1234 rows from BotData

📦 Importing BotData...
✅ Inserted batch 1 (1000 rows)
✅ Inserted batch 2 (234 rows)

✅ Total BotData imported: 1234 rows

📥 Fetching InventData...
✅ Fetched 567 rows from InventData

📊 Importing InventData...
✅ Inserted batch 1 (567 rows)

✅ Total InventData imported: 567 rows

==================================================
✅ Import completed successfully!
==================================================
```

## Troubleshooting

### Error: "The caller does not have permission"

แก้ไข: ตรวจสอบว่าได้ share Google Sheets กับ service account email แล้ว

### Error: "API key not valid"

แก้ไข: ตรวจสอบว่าได้เปิด Google Sheets API ใน Google Cloud Console แล้ว

### Error: "SUPABASE_SERVICE_ROLE_KEY environment variable is required"

แก้ไข: สร้างไฟล์ `.env` และใส่ service role key

### Error: "Relation does not exist"

แก้ไข: ตรวจสอบว่าได้ run database migration แล้ว:
```bash
cd boonyang/Inventory
supabase db push
```

## Data Mapping

### BotData Sheet → botdata table

| Column | Sheet Column | Database Field |
|--------|--------------|----------------|
| A | item_code | item_code |
| B | field_unknown | field_unknown |
| C | item_name | item_name |
| D | lot_number | lot_number |
| E | on_hand_quantity | on_hand_quantity |
| F | alternative_key_1 | alternative_key_1 |
| G | alternative_key_2 | alternative_key_2 |

### InventData Sheet → inventdata table

| Column | Sheet Column | Database Field |
|--------|--------------|----------------|
| A | item_name | item_name |
| B | stock_quantity | stock_quantity |

## Next Steps

หลังจาก import ข้อมูลแล้ว:

1. **ตรวจสอบข้อมูลใน Supabase**
   - ไปที่ [Table Editor](https://supabase.com/dashboard/project/cbxicbynxnprscwqnyld/table-editor)
   - ตรวจสอบตาราง `botdata` และ `inventdata`

2. **Deploy TypeScript Backend**
   ```bash
   cd boonyang/Inventory/ts
   npm install
   npm run build
   npm start
   ```

3. **Test LINE Bot**
   - ส่งข้อความถามสต็อกไปที่ LINE Bot
   - ตรวจสอบว่าได้รับข้อมูลจาก Supabase

## Security Notes

⚠️ **IMPORTANT**: อย่า commit `service-account.json` หรือ `.env` ไปที่ Git!

เพิ่มไว้ใน `.gitignore`:
```
service-account.json
.env
*.env.local
```

## Support

หากติดปัญหา:
1. ตรวจสอบ Google Cloud logs
2. ตรวจสอบ Supabase logs
3. ตรวจสอบ service account permissions
