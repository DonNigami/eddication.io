# Coordinate Enrichment Implementation Summary

## วันที่: 2026-01-17

## สิ่งที่ทำ

### 1. ✅ ใช้ตารางที่มีอยู่แล้วใน Supabase
**ตาราง:** `origin`, `customer`, `station` มีอยู่แล้วใน Supabase

**คุณสมบัติของ enrichment function:**
- รองรับหลาย column naming conventions:
  - `latitude` หรือ `lat` หรือ `customer_lat`
  - `longitude` หรือ `lng` หรือ `customer_lng`
- ใช้ `.or()` query สำหรับ flexible matching
- มี error handling ที่ดี (ถ้า query ล้มเหลวจะคืน stops เดิม)
- ใช้ `.maybeSingle()` แทน `.single()` เพื่อหลีกเลี่ยง error เมื่อไม่เจอข้อมูล

### 2. ✅ สร้างฟังก์ชัน Enrich Coordinates
✅ ไฟล์: `PTGLG/driverconnect/driverapp/js/supabase-api.js`

**ฟังก์ชัน:** `enrichStopsWithCoordinates(stops, route)`

**Logic:**
1. ดึงพิกัด origin จากตาราง `origin` โดยใช้ route code (3 ตัวแรก)
2. ดึงพิกัดลูกค้าจากตาราง `customer` โดยใช้ `customer_code`
3. ดึงพิกัดสถานีจากตาราง `station` โดยใช้ `station_code`
4. Enrich แต่ละ stop:
   - Origin stop → ใช้พิกัดจาก origin table
   - Customer stop → ใช้พิกัดจาก customer table (ใช้ shipToCode match กับ customer_code)
   - Station stop → ใช้พิกัดจาก station table (ใช้ shipToCode match กับ station_code)
   - ถ้ามีพิกัดอยู่แล้ว → เก็บพิกัดเดิม

**เรียกใช้ใน:**
- `SupabaseAPI.search()` - เมื่อดึงข้อมูลจาก `jobdata` table
- `SupabaseAPI.search()` - เมื่อดึงข้อมูลจาก `driver_jobs` table (fallback)

### 3. ✅ อัพเดท renderTimeline ให้รวมรายการตาม shipto_code
✅ ไฟล์: `PTGLG/driverconnect/driverapp/js/app.js`

**การทำงาน:**
1. Group stops ด้วย `shipToCode` หรือ `shipToName`
2. รวม materials จากทุก stop ในกลุ่มเดียวกัน
3. แสดง badge จำนวนรายการ (เช่น "2 รายการ")
4. ใช้ stop แรกในกลุ่มสำหรับปุ่ม check-in/check-out

### 4. ✅ Edge Function (สำรอง - ถ้าต้องการใช้ server-side enrichment)
✅ ไฟล์: `supabase/functions/enrich-coordinates/index.ts`

สามารถใช้แทนการ enrich ที่ client-side ถ้าต้องการ centralize logic

## ตัวอย่างการทำงาน

### ก่อน (ไม่มีพิกัด)
```json
{
  "stops": [
    {"seq": 1, "shipToCode": "C001", "destLat": null, "destLng": null},
    {"seq": 2, "shipToCode": "C001", "destLat": null, "destLng": null}
  ]
}
```

### หลัง (มีพิกัดจาก customer table)
```json
{
  "stops": [
    {"seq": 1, "shipToCode": "C001", "destLat": 13.6699, "destLng": 100.6092},
    {"seq": 2, "shipToCode": "C001", "destLat": 13.6699, "destLng": 100.6092}
  ]
}
```

### แสดงใน Timeline (Grouped)
```
📍 จุดที่ 1 [2 รายการ]
   PTT Station Bangna
   สินค้า: น้ำมัน 95, ดีเซล B7
   [Check-in] [ลงน้ำมัน] [ลงเสร็จ] [Check-out] [🧭]
```

## การใช้งาน

### 1. ตรวจสอบโครงสร้างตารางที่มีอยู่
```bash
# Run this SQL in Supabase SQL Editor
cd supabase
# Execute check-location-tables.sql
```

### 2. ทดสอบ
```javascript
// ระบบจะ auto-enrich พิกัดเมื่อค้นหางาน
await SupabaseAPI.search('2601S16472', userId);
// stops จะมีพิกัดจาก master location tables
```

### 3. ตรวจสอบผลลัพธ์ใน Console
```
🔍 Enriching coordinates for 5 stops
✅ Found origin: คลังลำลูกกา (13.9879, 100.7329)
✅ Found 3 customers with coordinates
✅ Found 2 stations with coordinates
✅ Enriched 5/5 stops with coordinates
```

## Column Naming Conventions ที่รองรับ

### Origin Table
- `latitude` หรือ `lat`
- `longitude` หรือ `lng`
- `route_code` หรือ `code`
- `name` หรือ `origin_name`

### Customer Table
- `customer_code` (primary key)
- `latitude` หรือ `lat` หรือ `customer_lat`
- `longitude` หรือ `lng` หรือ `customer_lng`

### Station Table
- `station_code` (primary key)
- `latitude` หรือ `lat` หรือ `station_lat`
- `longitude` หรือ `lng` หรือ `station_lng`

## ประโยชน์

1. **ปุ่มนำทาง (🧭)** จะแสดงทุก stop ที่มีพิกัด
2. **รวมรายการ** ที่ส่งไปยังจุดเดียวกันแสดงพร้อมกัน
3. **GPS Check-in Validation** สามารถใช้พิกัดจาก master tables ได้
4. **Flexible Column Names** รองรับหลาย naming conventions
5. **Error Resilient** ถ้า enrichment ล้มเหลวจะใช้ข้อมูลเดิม

## ไฟล์ที่เกี่ยวข้อง

1. ✅ `PTGLG/driverconnect/driverapp/js/supabase-api.js` - Client-side enrichment
2. ✅ `PTGLG/driverconnect/driverapp/js/app.js` - Timeline grouping
3. ✅ `supabase/functions/enrich-coordinates/index.ts` - Edge function (สำรอง)
4. ✅ `supabase/check-location-tables.sql` - SQL สำหรับตรวจสอบโครงสร้าง

## Note

- ✅ ระบบจะใช้พิกัดเดิมถ้ามีอยู่แล้วใน `destLat`, `destLng`
- ✅ Origin stops จะดึงพิกัดจาก `origin` table โดยใช้ route code
- ✅ Customer/Station stops จะดึงพิกัดจาก `customer` และ `station` tables
- ✅ ถ้าไม่เจอพิกัด stop นั้นจะไม่มีปุ่มนำทาง (🧭)
- ✅ ไม่ต้อง migrate table ใหม่ เพราะใช้ตารางที่มีอยู่แล้ว
- ✅ รองรับหลาย column naming conventions (latitude/lat/customer_lat)

