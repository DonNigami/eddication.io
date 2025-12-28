# UUID Columns Documentation

## Overview
UUID (Universally Unique Identifier) columns ถูกเพิ่มเข้ามาในระบบเพื่อป้องกันปัญหาการชนกัน (race condition) เมื่อมีหลาย user ทำงานพร้อมกัน

## ปัญหาที่แก้ไข
เมื่อก่อนระบบใช้ `rowIndex` ในการอัปเดตข้อมูล ซึ่งอาจเกิดปัญหา:
- หลาย user อัปเดต row เดียวกันพร้อมกัน
- ข้อมูลถูก overwrite ทับกัน
- ไม่สามารถติดตามได้ว่าใครอัปเดตอะไรเมื่อไหร่

## UUID Columns ใน jobdata Sheet

### Check-in
- **Column:** `checkInId`
- **Type:** UUID v4
- **Generated:** เมื่อ driver กด check-in
- **Purpose:** Unique identifier สำหรับแต่ละ check-in action

### Check-out  
- **Column:** `checkOutId`
- **Type:** UUID v4
- **Generated:** เมื่อ driver กด check-out
- **Purpose:** Unique identifier สำหรับแต่ละ check-out action

### Fueling
- **Column:** `fuelingId`
- **Type:** UUID v4
- **Generated:** เมื่อ driver กด ลงน้ำมัน
- **Purpose:** Unique identifier สำหรับแต่ละ fueling action

### Unload Done
- **Column:** `unloadDoneId`
- **Type:** UUID v4
- **Generated:** เมื่อ driver กด ลงเสร็จ
- **Purpose:** Unique identifier สำหรับแต่ละ unload action

### Review
- **Column:** `reviewedId`
- **Type:** UUID v4
- **Generated:** เมื่อ driver กด ประเมิน
- **Purpose:** Unique identifier สำหรับแต่ละ review action

## Implementation

### Backend (sheet-actions.js)
```javascript
const { v4: uuidv4 } = require('uuid');

// Generate UUID on each update
const updateId = uuidv4();

// Store in appropriate column
if (type === 'checkin') {
  uuidColName = 'checkInId';
}
// ... etc
```

### UUID Format
- Format: `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`
- Example: `550e8400-e29b-41d4-a716-446655440000`
- Version: UUID v4 (random)

## Benefits

1. **ป้องกันการชนกัน:** แต่ละ action มี unique ID ไม่ซ้ำกัน
2. **Audit Trail:** สามารถติดตาม history ของแต่ละ action
3. **Debugging:** ง่ายต่อการ debug เมื่อเกิดปัญหา
4. **Scalability:** รองรับหลาย user ทำงานพร้อมกันได้

## Google Sheets Setup

### เพิ่ม Columns ใน jobdata Sheet
1. เปิด Google Sheets
2. ไปที่ sheet `jobdata`
3. เพิ่ม columns ต่อไปนี้ (หลังจาก columns ที่มีอยู่):
   - `checkInId`
   - `checkOutId`
   - `fuelingId`
   - `unloadDoneId`
   - `reviewedId`

### Column Headers (เรียงตาม Google Apps Script)
```
referenceNo, jobDate, shipToCode, shipToName, driverName, headTruck, tailTruck, 
seq, destination1, destination2, shipmentNo, status, 
checkIn, checkOut, fuelingTime, unloadDoneTime, reviewedTime,
checkInId, checkOutId, fuelingId, unloadDoneId, reviewedId,
checkInLat, checkInLng, checkOutLat, checkOutLng,
checkInOdo, Distance, isOriginStop
```

## Testing
1. มี 2 drivers login พร้อมกัน
2. ทั้งคู่พยายาม check-in ที่ stop เดียวกัน
3. ระบบจะสร้าง 2 UUID แยกกัน
4. ตรวจสอบ sheet ว่ามี checkInId ที่ไม่ซ้ำกัน

## Troubleshooting

### Column not found
- **Error:** `Column checkInId not found`
- **Solution:** เพิ่ม column ใน Google Sheets ตามที่ระบุข้างต้น

### UUID ว่างเปล่า
- **Cause:** Column มีอยู่แต่ backend ไม่ได้อัปเดต
- **Solution:** ตรวจสอบ `uuidColIdx !== -1` condition ใน code

### UUID ซ้ำกัน
- **Cause:** ไม่น่าจะเกิดขึ้น (probability ~10^-37)
- **Solution:** UUID v4 รับประกันความไม่ซ้ำ

## Migration Note
- ข้อมูลเก่าที่มีอยู่แล้วจะไม่มี UUID (empty cell)
- UUID จะถูกสร้างเฉพาะ action ใหม่ตั้งแต่หลังการ deploy
- ไม่ต้อง migrate ข้อมูลเก่า
