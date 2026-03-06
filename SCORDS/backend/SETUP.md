# SCORDS SMART CHECK-IN - Google Sheets Setup

## โครงสร้าง Google Sheets

สร้าง Google Sheets ใหม่และตั้งชื่อตามต้องการ จากนั้นสร้าง Sheets (Tabs) ดังนี้:

---

## 1. Users Sheet (ผู้ใช้งาน)

### สร้าง Sheet ชื่อ: `Users`

### Header (Row 1):
| UserID | DisplayName | FirstName | LastName | EmployeeID | Position | Group | Role | ProfilePicture | CreatedAt |
|--------|-------------|-----------|----------|------------|----------|-------|------|----------------|-----------|
| U123abc | สมชาย ใจดี | สมชาย | ใจดี | EMP001 | พนักงานขับรถ | ทีม A | user | | 2026-03-06 |
| U456def | สมหญิง เก่งมาก | สมหญิง | เก่งมาก | EMP002 | ผู้จัดการ | ทีม B | admin | https://profile.line-pic.net/... | 2026-03-06 |

### คำอธิบายคอลัมน์:
- **UserID**: LINE User ID (Unique)
- **DisplayName**: ชื่อที่แสดงใน LINE
- **FirstName**: ชื่อจริง
- **LastName**: นามสกุล
- **EmployeeID**: รหัสพนักงาน (Unique)
- **Position**: ตำแหน่งงาน
- **Group**: กลุ่ม/ทีม
- **Role**: สิทธิ์ (user หรือ admin)
- **ProfilePicture**: รูปโปรไฟล์จาก LINE Profile (URL) - เว้นว่างได้
- **CreatedAt**: วันที่สร้างบัญชี

---

## 2. Activities Sheet (กิจกรรม)

### สร้าง Sheet ชื่อ: `Activities`

### Header (Row 1):
| ID | Name | Date | StartTime | EndTime | Location | Latitude | Longitude | Radius | QRCode | Status |
|----|------|------|-----------|---------|----------|----------|-----------|--------|--------|--------|
| ACT001 | ประชุมประจำเดือน | 2026-03-06 | 08:00 | 09:00 | ห้องประชุม A | 13.7563 | 100.5018 | 100 | CHECK-IN-001 | Active |
| ACT002 | อบรมความปลอดภัย | 2026-03-06 | 14:00 | 16:00 | ห้องฝึกอบรม | 13.7563 | 100.5018 | 100 | CHECK-IN-002 | Active |

### คำอธิบายคอลัมน์:
- **ID**: รหัสกิจกรรม (Unique)
- **Name**: ชื่อกิจกรรม
- **Date**: วันที่จัดกิจกรรม (YYYY-MM-DD)
- **StartTime**: เวลาเริ่ม (HH:MM)
- **EndTime**: เวลาสิ้นสุด (HH:MM)
- **Location**: สถานที่
- **Latitude**: พิกัดละติจูด (สำหรับ GPS Check-in)
- **Longitude**: พิกัดลองจิจูด (สำหรับ GPS Check-in)
- **Radius**: รัศมีที่อนุญาต (เมตร)
- **QRCode**: รหัส QR สำหรับ Scan
- **Status**: สถานะ (Active/Inactive)

---

## 3. Checkin_Log Sheet (ประวัติการเช็คชื่อ)

### สร้าง Sheet ชื่อ: `Checkin_Log`

### Header (Row 1):
| Timestamp | UserID | DisplayName | Group | ActivityID | Status |
|-----------|--------|-------------|-------|------------|--------|
| 2026-03-06 08:15:23 | U123abc | สมชาย ใจดี | ทีม A | ACT001 | ตรงเวลา |
| 2026-03-06 14:30:45 | U456def | สมหญิง เก่งมาก | ทีม B | ACT002 | สาย |

### คำอธิบายคอลัมน์:
- **Timestamp**: เวลาที่เช็คชื่อ
- **UserID**: LINE User ID
- **DisplayName**: ชื่อ-นามสกุลผู้เช็คชื่อ
- **Group**: กลุ่มของผู้เช็คชื่อ
- **ActivityID**: รหัสกิจกรรม
- **Status**: สถานะ (ตรงเวลา/สาย)

---

## 4. Groups Sheet (กลุ่ม/ทีม)

### สร้าง Sheet ชื่อ: `Groups`

### Header (Row 1):
| GroupName |
|-----------|
| ทีม A |
| ทีม B |
| ทีม C |
| สำนักงานใหญ่ |

### คำอธิบายคอลัมน์:
- **GroupName**: ชื่อกลุ่ม

---

## วิธีการตั้งค่า Google Apps Script

### 1. เปิด Google Apps Script Editor
1. ใน Google Sheets ไปที่ **Extensions** > **Apps Script**
2. ลบโค้ดเดิมทั้งหมด
3. คัดลอกโค้ดจากไฟล์ `backend/Code.gs` มาวาง
4. บันทึกไฟล์ (Ctrl+S)

### 2. อัปเดต SPREADSHEET_ID
```javascript
const SPREADSHEET_ID = "YOUR_SPREADSHEET_ID_HERE";
```
วิธีหา ID:
- เปิด Google Sheets
- ดูจาก URL: `https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit`

### 3. ทำให้ Script เป็น Web App
1. คลิก **Deploy** > **New deployment**
2. เลือก **Web app**
3. ตั้งค่า:
   - Description: SCORDS Check-In API
   - Execute as: **Me** (อีเมลของคุณ)
   - Who has access: **Anyone** (ทุกคน)
4. คลิก **Deploy**
5. คัดลอก **Web app URL**

### 4. อัปเดต API_URL ใน checkin.html
แก้ไขไฟล์ `SCORDS/checkin.html` บรรทัดที่ 456:
```javascript
const API_URL = "YOUR_WEB_APP_URL_HERE";
```

---

## การทดสอบระบบ

### 1. ทดสอบการลงทะเบียนผู้ใช้
- เปิด LIFF App ใน LINE
- กรอกข้อมูล:
  - ชื่อ: ทดสอบ
  - นามสกุล: ระบบ
  - รหัสพนักงาน: TEST001
  - ตำแหน่ง: พนักงานทดสอบ
  - กลุ่ม: เลือกกลุ่ม
- คลิก "ลงทะเบียน"
- ตรวจสอบใน Users Sheet ว่ามีข้อมูล

### 2. ทดสอบการลงทะเบียนซ้ำ
- พยายามลงทะเบียนด้วย LINE User ID เดิม
- ควรแสดง error: "LINE User ID นี้ลงทะเบียนแล้ว"

### 3. ทดสอบการลงทะเบียนด้วยรหัสพนักงานซ้ำ
- ใช้ LINE User ID อื่น แต่ใช้รหัสพนักงาน TEST001
- ควรแสดง error: "รหัสพนักงานนี้ถูกใช้งานแล้ว"

---

## ข้อควรระวัง

### ความปลอดภัย
- **อย่า** เปิดเผย SPREADSHEET_ID และ Web App URL ในที่สาธารณะ
- **ควร** ใช้ Google Apps Script ที่มี Authentication สำหรับการผลิตจริง
- **ควร** ตั้งค่า Sheet Permissions ให้เฉพาะผู้ที่ได้รับอนุญาตเท่านั้น

### การจัดการข้อมูล
- อย่าลบ Header rows (Row 1) ของแต่ละ Sheet
- รูปแบบวันที่ต้องเป็น YYYY-MM-DD
- เวลาต้องอยู่ในรูปแบบ HH:MM (24 ชั่วโมง)

---

## การปรับปรุง Backend

หากต้องการอัปเดต Backend หลังจาก Deploy แล้ว:

1. เปิด Apps Script Editor
2. แก้ไขโค้ด
3. ไปที่ **Deploy** > **Manage deployments**
4. เลือก deployment ที่ต้องการ
5. คลิก **Edit** > **Deploy**
6. เลือก **New version** และ Deploy

---

## ปัญหาที่อาจเกิดขึ้น

### 1. Error: "ไม่พบกิจกรรมนี้ในระบบ"
- ตรวจสอบว่า Activity ID ใน Activities Sheet ตรงกับที่ใช้ใน QR Code

### 2. Error: "QR Code ไม่ถูกต้อง"
- ตรวจสอบว่า QR Code ใน Activities Sheet ตรงกับที่ Scan

### 3. Error: "คุณอยู่นอกพื้นที่"
- ตรวจสอบ Latitude, Longitude, และ Radius ใน Activities Sheet
- ตรวจสอบว่าเปิด GPS ในมือถือ

### 4. Error: "Server Error"
- ตรวจสอบว่า Header ในแต่ละ Sheet ถูกต้อง
- ตรวจสอบ SPREADSHEET_ID ว่าตรงกัน
- เปิด Apps Script Editor และดูที่ **Executions** เพื่อดู error log

---

## ติดต่อผู้พัฒนา

สำหรับคำถามเพิ่มเติม ติดต่อ:
- GitHub: [eddication-io](https://github.com/eddication-io)
- Project: SCORDS SMART CHECK-IN
