# 📋 คู่มือรวมข้อมูล driver_jobs ไป jobdata

## 🎯 วัตถุประสงค์

ฟังก์ชันนี้จะดึงข้อมูลจาก `driver_jobs` มาบันทึกลงใน `jobdata` โดย:
- **รวมจุดที่ซ้ำกัน** (ship_to_code เดียวกันภายใต้ reference เดียวกัน) ให้เป็น 1 แถว
- **รวม materials** หลายรายการมาเป็น string (คั่นด้วย comma)
- **รวม total_qty** โดยบวกจำนวนทั้งหมด

---

## 📊 ตัวอย่างข้อมูล

### ก่อนรวม (driver_jobs)

| reference  | shipment_no | ship_to | material_desc     | delivery_qty |
|------------|-------------|---------|-------------------|--------------|
| 2601M01559 | 6100555337  | 11000973| PT MAX GASOHOL 95 | 3.00         |
| 2601M01559 | 6100555337  | 11000973| PT MAX DIESEL     | 8.00         |
| 2601M01559 | 6301158878  | ZSF76   | PT MAX GASOHOL 95 | 3.00         |
| 2601M01559 | 6301158878  | ZSF76   | PT MAX DIESEL     | 4.00         |

### หลังรวม (jobdata)

| id | reference  | ship_to_code | materials                          | total_qty | seq |
|----|------------|--------------|-------------------------------------|-----------|-----|
| 9  | 2601M01559 | 11000973     | PT MAX DIESEL, PT MAX GASOHOL 95   | 11.00     | 1   |
| 10 | 2601M01559 | ZSF76        | PT MAX DIESEL, PT MAX GASOHOL 95   | 7.00      | 2   |

---

## 🚀 วิธีใช้งาน

### วิธีที่ 1: ใช้ Batch Script (แนะนำ)

```bash
# Windows
sync-driver-jobs-to-jobdata.bat
```

### วิธีที่ 2: Run SQL ใน Supabase SQL Editor

#### 2.1 สร้าง Functions (ครั้งแรกเท่านั้น)

```sql
-- Apply migration file
-- supabase/migrations/20260117_merge_driver_jobs_to_jobdata.sql
```

#### 2.2 รัน Sync ทั้งหมด

```sql
-- รวมข้อมูลทั้งหมด
SELECT * FROM sync_all_driver_jobs_to_jobdata();
```

**ผลลัพธ์:**
```
total_inserted | total_merged | references_processed | message
---------------|--------------|----------------------|----------------------------------
2              | 2            | 1                    | Processed 1 references: 2 stops inserted, 2 items merged
```

#### 2.3 รัน Sync เฉพาะ Reference

```sql
-- รวมข้อมูลเฉพาะ reference
SELECT * FROM merge_driver_jobs_to_jobdata('2601M01559');
```

**ผลลัพธ์:**
```
inserted_count | merged_count | message
---------------|--------------|----------------------------------
2              | 2            | Inserted 2 new stops, merged 2 duplicate items
```

---

## 📝 SQL Functions

### 1. `merge_driver_jobs_to_jobdata(p_reference TEXT)`

รวมข้อมูลสำหรับ reference เดียว

**Parameters:**
- `p_reference` (TEXT): เลข reference ที่ต้องการรวม

**Returns:**
- `inserted_count` (INTEGER): จำนวนแถวใหม่ที่เพิ่ม
- `merged_count` (INTEGER): จำนวนแถวที่ถูกรวม
- `message` (TEXT): ข้อความสรุปผลลัพธ์

**Logic:**
1. GROUP BY `(reference, ship_to_code)` เพื่อรวมจุดที่ซ้ำกัน
2. ใช้ `STRING_AGG()` รวม materials
3. ใช้ `SUM()` รวม total_qty
4. ใช้ `ARRAY_AGG()[1]` เลือกค่าแรกสำหรับพิกัดและข้อมูลอื่นๆ
5. UPSERT ลง jobdata (UPDATE ถ้ามีอยู่แล้ว, INSERT ถ้ายังไม่มี)

### 2. `sync_all_driver_jobs_to_jobdata()`

รวมข้อมูลทั้งหมดจาก driver_jobs

**Returns:**
- `total_inserted` (INTEGER): จำนวนแถวใหม่ทั้งหมด
- `total_merged` (INTEGER): จำนวนแถวที่ถูกรวมทั้งหมด
- `references_processed` (INTEGER): จำนวน reference ที่ประมวลผล
- `message` (TEXT): ข้อความสรุปผลลัพธ์

---

## 🔍 การตรวจสอบผลลัพธ์

### ดูข้อมูลที่รวมแล้ว

```sql
-- ดูข้อมูลที่ถูกรวม
SELECT 
  reference,
  seq,
  ship_to_code,
  ship_to_name,
  materials,
  total_qty
FROM jobdata
WHERE reference = '2601M01559'
ORDER BY seq;
```

### เปรียบเทียบก่อน-หลัง

```sql
-- นับจำนวนแถวใน driver_jobs
SELECT 
  reference,
  ship_to,
  COUNT(*) as row_count,
  STRING_AGG(material_desc, ', ') as materials,
  SUM(delivery_qty) as total_qty
FROM driver_jobs
WHERE reference = '2601M01559'
GROUP BY reference, ship_to
ORDER BY MIN(shipment_item::INTEGER);

-- นับจำนวนแถวใน jobdata
SELECT 
  reference,
  ship_to_code,
  materials,
  total_qty
FROM jobdata
WHERE reference = '2601M01559'
ORDER BY seq;
```

---

## ⚙️ Configuration

### เงื่อนไขในการรวมข้อมูล

ข้อมูลจะถูกรวมเมื่อ:
- `reference` เหมือนกัน
- `ship_to_code` เหมือนกัน

ข้อมูลที่ถูกรวม:
- `materials`: รวม material_desc (DISTINCT, เรียงตาม alphabetical)
- `total_qty`: รวม delivery_qty
- `seq`: ใช้ค่าต่ำสุดจาก shipment_item

ข้อมูลที่ใช้ค่าแรก:
- `dest_lat`, `dest_lng`: พิกัดจากแถวแรก
- `ship_to_address`, `receiving_plant`: ข้อมูลจากแถวแรก

---

## 🛠️ Troubleshooting

### ไม่มีข้อมูลถูกรวม

```sql
-- ตรวจสอบว่ามีข้อมูลใน driver_jobs หรือไม่
SELECT COUNT(*) FROM driver_jobs;

-- ตรวจสอบ reference ที่มี
SELECT DISTINCT reference FROM driver_jobs;
```

### ข้อมูลถูกรวมไม่ถูกต้อง

```sql
-- ตรวจสอบข้อมูลดิบ
SELECT 
  reference,
  ship_to,
  material_desc,
  delivery_qty,
  shipment_item
FROM driver_jobs
WHERE reference = 'YOUR_REFERENCE'
ORDER BY shipment_item;
```

### ลบข้อมูลและรัน sync ใหม่

```sql
-- ลบข้อมูลใน jobdata
DELETE FROM jobdata WHERE reference = '2601M01559';

-- รัน sync ใหม่
SELECT * FROM merge_driver_jobs_to_jobdata('2601M01559');
```

---

## 📦 Files

- **Migration**: `supabase/migrations/20260117_merge_driver_jobs_to_jobdata.sql`
- **Batch Script**: `sync-driver-jobs-to-jobdata.bat`
- **Guide**: `MERGE_DRIVER_JOBS_GUIDE.md`

---

## 💡 Tips

1. **ทดสอบกับ reference เดียวก่อน** ใช้ `merge_driver_jobs_to_jobdata('REFERENCE')`
2. **ตรวจสอบผลลัพธ์** ก่อนรัน sync ทั้งหมด
3. **Backup ข้อมูล** ก่อนทำการ sync ครั้งแรก
4. **Run sync อัตโนมัติ** ตั้งเวลารันเป็นระยะ (เช่น ทุกวันเวลา 00:00)

---

## 🔄 Automation

### Supabase Edge Function (ทำงานอัตโนมัติ)

สร้าง Edge Function ที่เรียก sync ทุก 1 ชั่วโมง:

```typescript
// supabase/functions/sync-jobs/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { data, error } = await supabase.rpc('sync_all_driver_jobs_to_jobdata')

  return new Response(
    JSON.stringify({ data, error }),
    { headers: { "Content-Type": "application/json" } }
  )
})
```

---

## ✅ Summary

- ✅ รวมจุดที่ซ้ำกันให้เหลือ 1 แถว
- ✅ รวม materials และ total_qty
- ✅ รองรับ UPSERT (UPDATE ถ้ามีอยู่แล้ว)
- ✅ สามารถรัน sync ทั้งหมด หรือ เฉพาะ reference
- ✅ มี batch script สำหรับรันง่ายๆ
