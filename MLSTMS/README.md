# MLSTMS - PTG eZView Integration to Google Sheets

สคริปต์สำหรับดึงข้อมูล Trips และ Trip Details จาก PTG eZView API มาบันทึกลงใน Google Sheets

## 📋 ฟีเจอร์

- ✅ Login และรับ Access Token อัตโนมัติ
- ✅ รีเฟรช Token อัตโนมัติเมื่อใกล้หมดอายุ
- ✅ ดึงรายการ Trips พร้อมกรองตามสถานะและวันที่
- ✅ ดึง Trip Details แต่ละ Trip พร้อม Waypoints
- ✅ บันทึกข้อมูลลง Google Sheets พร้อมจัดรูปแบบ
- ✅ รองรับ Rate Limiting
- ✅ เมนู UI ใน Google Sheets สำหรับใช้งานง่ายๆ

## 🚀 วิธีการติดตั้ง

### 1. สร้าง Google Sheets

1. ไปที่ [Google Sheets](https://sheets.google.com)
2. สร้าง Spreadsheet ใหม่
3. ตั้งชื่อตามต้องการ (เช่น "MLSTMS Trips")

### 2. เปิด Apps Script Editor

1. ใน Google Sheets ที่สร้าง คลิกเมนู **Extensions** > **Apps Script**
2. จะเปิดหน้าต่าง Apps Script Editor ใหม่

### 3. สร้างไฟล์สคริปต์

1. สร้างไฟล์ใหม่ชื่อ `TripsToSheets` (หรือชื่ออื่นตามต้องการ)
2. คัดลอกโค้ดจากไฟล์ `TripsToSheets.gs` ไปวาง
3. บันทึกไฟล์ (Ctrl+S หรือ Cmd+S)

### 4. ตั้งค่า Configuration

1. ใน Apps Script Editor เลือกฟังก์ชัน `setupConfig` จาก dropdown
2. แก้ไขค่า config ต่อไปนี้ในฟังก์ชัน `setupConfig`:

```javascript
const config = {
  // API Base URL (ใช้ค่าเดิมหรือแก้ตาม environment)
  'BASE_URL': 'http://203.151.215.230:9000/eZViewIntegrationService/web-service/api',

  // Login Credentials (ต้องแก้ไข)
  'USERNAME': 'your_username',        // เปลี่ยนเป็น username จริง
  'PASSWORD': 'your_password',        // เปลี่ยนเป็น password จริง

  // ชื่อ Sheet (สามารถใช้ค่าเดิม)
  'TRIPS_SHEET_NAME': 'Trips',
  'TRIP_DETAILS_SHEET_NAME': 'TripDetails',

  // Query Parameters (เลือกกรองตามต้องการ)
  'STATUS_ID': '4',                   // สถานะ trip (ว่างเปล่า = ทั้งหมด)
  'START_DATE': '2026-01-01',         // รูปแบบ: YYYY-MM-DD (ว่างเปล่า = ทั้งหมด)
  'END_DATE': '2026-12-31',           // รูปแบบ: YYYY-MM-DD (ว่างเปล่า = ทั้งหมด)
  'LIMIT': '50',                      // จำนวน trips ต่อครั้ง
};
```

3. กดปุ่ม **Run** เพื่อบันทึก configuration
4. อนุญาตให้สคริปต์เข้าถึง spreadsheet (เฉพาะครั้งแรก)

### 5. กลับไปที่ Google Sheets

1. รีเฟรชหน้า Google Sheets
2. จะเห็นเมนูใหม่ชื่อ **🚚 MLSTMS Trips** ที่แถบเมนูด้านบน

## 📖 วิธีใช้งาน

### ดึงข้อมูล Trips ทั้งหมด

1. คลิกเมนู **🚚 MLSTMS Trips** > **📥 Pull Trips to Sheet**
2. สคริปต์จะ:
   - Login และรับ Access Token
   - ดึงรายการ Trips ตามที่ตั้งค่าไว้
   - ดึง Trip Details แต่ละ Trip
   - สร้าง 2 Sheets ใหม่:
     - `Trips` - รายการ trips โดยรวม
     - `TripDetails` - รายละเอียด trips พร้อม waypoints

### ดึง Trip เดี่ยว

ถ้าต้องการดึง Trip เดียว ให้รันฟังก์ชัน `pullSingleTrip(tripId)` ใน Apps Script Editor:

```javascript
pullSingleTrip('1080644'); // เปลี่ยนเป็น Trip ID ที่ต้องการ
```

### ทดสอบการเชื่อมต่อ

คลิกเมนู **🚚 MLSTMS Trips** > **🔍 Test Connection**

### ดู Configuration ปัจจุบัน

คลิกเมนู **🚚 MLSTMS Trips** > **👁️ View Config**

### แก้ไข Configuration

1. เปิด Apps Script Editor
2. แก้ไขฟังก์ชัน `setupConfig`
3. รันฟังก์ชัน `setupConfig` อีกครั้ง
4. หรือคลิกเมนู **🚚 MLSTMS Trips** > **⚙️ Setup Config**

## 📊 โครงสร้างข้อมูลใน Sheets

### Sheet: Trips

| Column | Description |
|--------|-------------|
| Trip ID | รหัส Trip |
| Trip Name | ชื่อ Trip |
| License No | ทะเบียนรถ |
| Status ID | รหัสสถานะ |
| Status Name | ชื่อสถานะ |
| Trip Open DateTime | เวลาเปิด Trip |
| Trip Close DateTime | เวลาปิด Trip |
| Total Distance (km) | ระยะทางรวม |
| Created At | เวลาสร้าง |
| Updated At | เวลาอัปเดตล่าสุด |

### Sheet: TripDetails

ประกอบด้วยข้อมูล Trip พื้นฐาน และ Waypoints สูงสุด 20 จุด:

**Trip Data:**
- ข้อมูล Trip เหมือนใน Sheet Trips
- เพิ่ม Driver Name, Driver Phone, Vehicle Type

**Waypoints (WP1-WP20):**
แต่ละ Waypoint มีข้อมูล:
- Sequence
- Reference ID
- Name
- Address
- Latitude/Longitude
- Arrival DateTime
- Departure DateTime
- Status

## 🔧 API Reference

### Authentication

- **Login:** `POST /v1/login`
- **Refresh Token:** `POST /v1/refresh-token`
- **Logout:** `POST /v1/logout`

### Trips

- **List Trips:** `GET /v1/trips`
  - Query params: `statusId`, `startDate`, `endDate`, `limit`, `cursor`
- **Get Trip Details:** `GET /v1/trips/{tripId}`
- **Create Trips Bulk:** `POST /v1/trips/bulk`
- **Update Trip:** `PUT /v1/trips/{tripId}`

### Waypoints

- **List Waypoints:** `GET /v1/waypoints`

ดูเพิ่มเติมในไฟล์ `PTG eZView Integration Services (v1) 4CUS.postman_collection.json`

## 🛠️ Functions ที่มี

| Function | Description |
|----------|-------------|
| `setupConfig()` | ตั้งค่า configuration ครั้งแรก |
| `pullTripsToSheet()` | ดึง Trips และ TripDetails ลง Sheet |
| `pullSingleTrip(tripId)` | ดึง Trip เดียวตาม ID |
| `testConnection()` | ทดสอบการเชื่อมต่อ API |
| `clearTokens()` | เคลียร์ Tokens (สำหรับทดสอบ) |
| `viewConfig()` | ดู Configuration ปัจจุบัน |
| `onOpen()` | สร้างเมนูใน Google Sheets |

## ⚠️ ข้อควรระวัง

1. **Rate Limiting:** สคริปต์มีการรอ 100ms ระหว่างแต่ละ request เพื่อหลีกเลี่ยงการโดน block
2. **Token Expiry:** Access Token จะหมดอายุใน 1 ชั่วโมง แต่สคริปต์จะรีเฟรชอัตโนมัติ
3. **Permissions:** ต้องอนุญาตให้สคริปต์เข้าถึง Spreadsheet และ UrlFetchApp
4. **Large Data:** ถ้ามี Trips เยอะมาก อาจใช้เวลานาน แนะนำให้ตั้งค่า LIMIT

## 🐛 Troubleshooting

### Login ไม่สำเร็จ

- ตรวจสอบ Username และ Password
- ตรวจสอบ BASE_URL ว่าถูกต้องหรือไม่
- ลองรัน `🔍 Test API Connection` เพื่อดูข้อผิดพลาด

### Token หมดอายุ

- สคริปต์จะรีเฟรชอัตโนมัติ
- ถ้ายังไม่ได้ ลองรัน `🗑️ Clear Credentials` แล้วลองใหม่

### ข้อมูลไม่แสดง / ไม่เห็น Trip List

#### 1. ใช้ Debug Mode
คลิกเมนู **🐛 Debug API Response** เพื่อดูว่า API ตอบกลับมาอย่างไร:
- จะแสดงข้อมูล Response ทั้งหมด
- บันทึกลง Sheet "Debug Log" สำหรับตรวจสอบ

#### 2. ตรวจสอบ Query Parameters
- คลิก **👁️ View Config** เพื่อดูการตั้งค่า
- STATUS_ID: ลองเว้นว่างเพื่อดึงทั้งหมด
- START_DATE/END_DATE: ลองเว้นว่างหรือปรับวันที่
- LIMIT: เพิ่มจำนวน (เช่น 100, 200)

#### 3. ตรวจสอบ Sheets Status
คลิกเมนู **📝 Check Sheets Status** เพื่อดู:
- ว่า Sheet ถูกสร้างหรือยัง
- มีข้อมูลกี่แถว

#### 4. ดู Logs
1. เปิด Apps Script Editor
2. คลิกที่ "View" > "Logs"
3. รันการดึงข้อมูลอีกครั้ง
4. ดูข้อความ Log ทั้งหมด:
   ```
   📋 Fetching trips list...
   📋 API Response received
      - Response type: object
      - Response data: {...}
      - Extracted trips from response.data.trips
   ✅ Found 50 trips
   💾 Saving trips to sheet...
      - Sheet prepared: "Trips"
      - Data rows prepared: 50
      - Writing to range: Row 2, Col 1, 50 rows, 10 cols
      - ✅ Data written successfully
   ```

#### 5. API Response Structure อาจต่างจากที่คาด
ถ้าพบว่า API ตอบกลับรูปแบบอื่น ให้:
1. ดูใน Sheet "Debug Log"
2. ตรวจสอบคอลัมน์ "Trips Location"
3. สคริปต์จะพยายามรองรับรูปแบบต่างๆ:
   - `response.data.trips`
   - `response.data`
   - `response.trips`
   - `response` (direct array)

#### 6. เปลี่ยน BASE_URL
ถ้า API endpoint เปลี่ยน:
1. คลิก **⚙️ Initial Setup**
2. แก้ไข BASE_URL
3. รัน `setupConfig` อีกครั้ง

## 📝 License

MIT

## 👨‍💻 Support

หากมีปัญหา ติดต่อ: PTG Development Team
