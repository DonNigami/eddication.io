# 📋 Frontend Grouped Display + Backend Multi-row Update

## 🎯 Concept

**แนวคิด:**
- **Database (jobdata)** → เก็บข้อมูลแยกรายแถวเหมือนเดิม (ไม่ merge)
- **Frontend** → แสดงแบบรวมจุดที่ซ้ำกัน (ship_to_code เดียวกัน)
- **Update** → บันทึกลงทุกแถวที่มี ship_to_code เดียวกัน

## 📊 ตัวอย่าง

### Database (jobdata) - 4 แถว

| id | reference  | seq | ship_to_code | materials         | total_qty | status  |
|----|------------|-----|--------------|-------------------|-----------|---------|
| 1  | 2601M01559 | 1   | 11000973     | PT MAX GASOHOL 95 | 3.00      | pending |
| 2  | 2601M01559 | 2   | 11000973     | PT MAX DIESEL     | 8.00      | pending |
| 3  | 2601M01559 | 3   | ZSF76        | PT MAX GASOHOL 95 | 3.00      | pending |
| 4  | 2601M01559 | 4   | ZSF76        | PT MAX DIESEL     | 4.00      | pending |

### Frontend Display - 2 จุด (รวมแล้ว)

| seq | ship_to_code | materials                          | total_qty | item_count | item_ids |
|-----|--------------|-------------------------------------|-----------|------------|----------|
| 1   | 11000973     | PT MAX DIESEL, PT MAX GASOHOL 95   | 11.00     | 2          | [1, 2]   |
| 3   | ZSF76        | PT MAX DIESEL, PT MAX GASOHOL 95   | 7.00      | 2          | [3, 4]   |

### เมื่อ Check-in ที่จุด 11000973

**Frontend:** User กด Check-in ที่จุดเดียว (11000973)  
**Backend:** อัพเดท 2 แถว (id=1,2) พร้อมกัน

```sql
UPDATE jobdata SET status='checkin', checkin_time=NOW() 
WHERE reference='2601M01559' AND ship_to_code='11000973';
-- Updated 2 rows
```

---

## 🗂️ ไฟล์ที่สร้าง

### 1. SQL Migration
**`supabase/migrations/20260117_jobdata_grouped_view.sql`**
- สร้าง VIEW `jobdata_grouped` สำหรับ query แบบรวม
- สร้าง Functions:
  - `update_grouped_stop_checkin()` - Check-in หลายแถวพร้อมกัน
  - `update_grouped_stop_checkout()` - Check-out หลายแถวพร้อมกัน
  - `update_grouped_stop_fueling()` - Fueling หลายแถวพร้อมกัน
  - `update_grouped_stop_unload()` - Unload หลายแถวพร้อมกัน

### 2. Test Script
**`supabase/test_jobdata_grouped.sql`**
- ทดสอบการทำงานทั้งหมด
- Insert test data, query, update, verify

### 3. JavaScript API
**`PTGLG/driverconnect/driverapp/js/jobdata-grouped-api.js`**
- `getGroupedJobs(reference)` - ดึงข้อมูลแบบรวม
- `checkinGroupedStop(params)` - Check-in
- `checkoutGroupedStop(params)` - Check-out
- `isWithinRadius()` - ตรวจสอบรัศมี
- `formatMaterials()` - Format materials

### 4. HTML Example
**`PTGLG/driverconnect/driverapp/test-grouped-jobdata.html`**
- ตัวอย่างการใช้งานครบวงจร
- แสดงข้อมูลแบบรวม
- Check-in/Check-out ได้

---

## 🚀 Quick Start

### 1. Setup Database

```sql
-- Apply migration
\i supabase/migrations/20260117_jobdata_grouped_view.sql
```

### 2. Test

```sql
-- Run test script
\i supabase/test_jobdata_grouped.sql
```

### 3. Use in Frontend

```javascript
import { 
  getGroupedJobs, 
  checkinGroupedStop 
} from './js/jobdata-grouped-api.js';

// ดึงข้อมูล (แสดงแบบรวม)
const stops = await getGroupedJobs('2601M01559');
console.log(stops);
// [
//   { group_id: '2601M01559_11000973', ship_to_code: '11000973', 
//     materials: 'DIESEL, GASOHOL 95', total_qty: 11, item_count: 2, item_ids: [1,2] },
//   { group_id: '2601M01559_ZSF76', ship_to_code: 'ZSF76', 
//     materials: 'DIESEL, GASOHOL 95', total_qty: 7, item_count: 2, item_ids: [3,4] }
// ]

// Check-in (อัพเดททุกแถว)
const result = await checkinGroupedStop({
  reference: '2601M01559',
  shipToCode: '11000973',
  checkinLat: 14.3595500,
  checkinLng: 100.8792200,
  checkinOdo: 12500,
  updatedBy: 'U001'
});

console.log(result);
// { updated_count: 2, updated_ids: [1, 2], message: 'Updated 2 row(s)...' }
```

---

## 📝 SQL Functions

### 1. Query: jobdata_grouped (VIEW)

```sql
SELECT * FROM jobdata_grouped WHERE reference = '2601M01559';
```

**Returns:**
- `group_id` - Composite key (reference_shiptocode)
- `reference`, `ship_to_code`, `ship_to_name`
- `materials` - รวมทั้งหมด (comma-separated)
- `total_qty` - รวมปริมาณ
- `item_count` - จำนวนแถว
- `item_ids` - Array ของ IDs
- `status` - สถานะที่ "ก้าวหน้าที่สุด"
- `checkin_time`, `checkout_time`, etc.

### 2. Check-in

```sql
SELECT * FROM update_grouped_stop_checkin(
  '2601M01559',                     -- reference
  '11000973',                        -- ship_to_code
  '2026-01-17 08:30:00+07'::TIMESTAMPTZ,
  14.3595500,                        -- lat
  100.8792200,                       -- lng
  12500,                             -- odo (optional)
  15.5,                              -- accuracy (optional)
  'U001'                             -- updated_by (optional)
);
```

**Returns:**
```
updated_count | updated_ids | message
--------------|-------------|---------------------------
2             | {1,2}       | Updated 2 row(s) for...
```

### 3. Check-out

```sql
SELECT * FROM update_grouped_stop_checkout(
  '2601M01559',
  '11000973',
  '2026-01-17 09:15:00+07'::TIMESTAMPTZ,
  14.3595600,
  100.8792300,
  12550,                             -- odo (optional)
  'นายสมชาย',                       -- receiver_name (optional)
  'พนักงาน',                        -- receiver_type (optional)
  'U001'
);
```

### 4. Fueling

```sql
SELECT * FROM update_grouped_stop_fueling(
  '2601M01559',
  'ZSF76',
  '2026-01-17 10:00:00+07'::TIMESTAMPTZ,
  'U001'
);
```

### 5. Unload

```sql
SELECT * FROM update_grouped_stop_unload(
  '2601M01559',
  'ZSF76',
  '2026-01-17 10:30:00+07'::TIMESTAMPTZ,
  'U001'
);
```

---

## 💡 Key Points

### ✅ ข้อดี
1. **Database ไม่ซับซ้อน** - เก็บแยกรายแถวเหมือนเดิม
2. **Frontend เรียบง่าย** - Query view เดียวได้ข้อมูลรวม
3. **Update ง่าย** - เรียก function เดียว update หลายแถว
4. **Flexible** - สามารถ query raw data หรือ grouped ก็ได้
5. **No data loss** - ข้อมูลดิบยังอยู่ครบ

### ⚙️ Logic

**GROUP BY:**
```sql
GROUP BY reference, ship_to_code, ship_to_name
```

**Aggregate:**
- `materials` → `STRING_AGG(DISTINCT materials, ', ')`
- `total_qty` → `SUM(total_qty)`
- `item_ids` → `ARRAY_AGG(id)`

**Status Priority:**
```sql
CASE 
  WHEN BOOL_OR(status = 'checkout') THEN 'checkout'
  WHEN BOOL_OR(status = 'checkin') THEN 'checkin'
  ELSE 'pending'
END
```

**Update All Rows:**
```sql
UPDATE jobdata 
SET status='checkin', checkin_time=NOW()
WHERE reference=? AND ship_to_code=?
```

---

## 🔍 Testing

### Test Flow

```sql
-- 1. Insert 4 rows (raw data)
INSERT INTO jobdata (reference, seq, ship_to_code, materials, total_qty)
VALUES 
  ('2601M01559', 1, '11000973', 'GASOHOL 95', 3.00),
  ('2601M01559', 2, '11000973', 'DIESEL', 8.00),
  ('2601M01559', 3, 'ZSF76', 'GASOHOL 95', 3.00),
  ('2601M01559', 4, 'ZSF76', 'DIESEL', 4.00);

-- 2. Query grouped (should return 2 rows)
SELECT * FROM jobdata_grouped WHERE reference = '2601M01559';

-- 3. Check-in at stop 11000973
SELECT * FROM update_grouped_stop_checkin('2601M01559', '11000973', NOW(), 14.35, 100.87);

-- 4. Verify: Both rows (id=1,2) should be updated
SELECT id, ship_to_code, status, checkin_time FROM jobdata WHERE reference = '2601M01559';
```

---

## 🔄 Migration from Old System

ถ้ามีระบบเก่าที่เก็บแบบรวมอยู่แล้ว:

```sql
-- แปลงข้อมูลจาก merged → separated
INSERT INTO jobdata (reference, seq, ship_to_code, materials, total_qty, ...)
SELECT 
  reference,
  ROW_NUMBER() OVER (PARTITION BY reference ORDER BY seq),
  ship_to_code,
  unnest(string_to_array(materials, ', ')), -- แยก materials
  total_qty / array_length(string_to_array(materials, ', '), 1), -- แบ่ง qty
  ...
FROM old_jobdata_merged;
```

---

## 🛠️ Troubleshooting

### ❌ Error: view "jobdata_grouped" does not exist

**Solution:** Run migration
```sql
\i supabase/migrations/20260117_jobdata_grouped_view.sql
```

### ❌ updated_count = 0

**Check:**
```sql
-- ตรวจสอบว่ามีข้อมูลหรือไม่
SELECT * FROM jobdata WHERE reference = '2601M01559' AND ship_to_code = '11000973';
```

### ⚠️ View shows wrong total_qty

**Check:**
```sql
-- ดู raw data
SELECT ship_to_code, materials, total_qty FROM jobdata WHERE reference = '2601M01559';

-- ดู grouped
SELECT ship_to_code, materials, total_qty FROM jobdata_grouped WHERE reference = '2601M01559';
```

---

## 📚 Related Files

- [20260117_jobdata_grouped_view.sql](supabase/migrations/20260117_jobdata_grouped_view.sql) - Migration
- [test_jobdata_grouped.sql](supabase/test_jobdata_grouped.sql) - Test script
- [jobdata-grouped-api.js](PTGLG/driverconnect/driverapp/js/jobdata-grouped-api.js) - JS API
- [test-grouped-jobdata.html](PTGLG/driverconnect/driverapp/test-grouped-jobdata.html) - HTML example

---

## ✨ Summary

✅ Frontend แสดงแบบรวม (2 จุด)  
✅ Database เก็บแบบแยก (4 แถว)  
✅ Update ครั้งเดียว → อัพเดททุกแถว  
✅ ไม่ต้อง migrate ข้อมูล  
✅ มี test script ครบ  
✅ มี JavaScript API  
✅ มีตัวอย่าง HTML

**Ready to use!** 🚀
