# Boonyang CheckInv - ระบบตรวจสอบยอดคงค้างผ่าน LINE

ระบบให้ลูกค้าสามารถตรวจสอบยอดคงค้างได้ด้วยตนเองตลอด 24 ชั่วโมงผ่านทาง LINE โดยไม่ต้องโทรสอบถาม

## 📋 Features

- ✅ ตรวจสอบยอดคงค้างรวมทันทีด้วยคำสั่ง "ยอดคงค้าง"
- ✅ ลงทะเบียนผ่าน LIFF (LINE Front-end Framework)
- ✅ ระบุตัวตนด้วย LINE User ID
- ✅ **ระบบอนุมัติลูกค้า** - ลูกค้าต้องได้รับการอนุมัติจาก Admin ก่อนใช้งาน
- ✅ ระบบจัดการ Admin - อนุมัติ/ปฏิเสธ/ระงับบัญชีลูกค้า
- ✅ บันทึกประวัติการสนทนา
- ✅ รองรับหลายร้านค้าในระบบเดียว

## 🏗️ Architecture

```
LINE Official Account
    ↓
LINE Messaging API (Webhook)
    ↓
Google Apps Script (Code.gs)
    ↓
Google Sheets
    ├── AccountReceivables (ยอดคงค้าง)
    ├── Customers (ข้อมูลลูกค้าที่ลงทะเบียน)
    └── MessageLog (ประวัติการสนทนา)
```

## 🚀 Quick Start

### 1. สร้าง Google Sheets

1. แปลงไฟล์ Excel `AccountReceivablesReportByDocument-5.xlsx` เป็น Google Sheets
2. สร้าง Sheets เพิ่มเติม 3 sheets:
   - **Customers**: เก็บข้อมูลลูกค้าที่ลงทะเบียน
   - **MessageLog**: บันทึกประวัติการสนทนา
   - **Admins**: เก็บรายชื่อ Admin (จะสร้างให้อัตโนมัติโดยฟังก์ชัน setupSheets)

3. ตั้งค่า Headers:

**Sheet: Customers**
```
A: Timestamp
B: LINE User ID
C: ชื่อ-นามสกุล
D: ชื่อร้านค้า
E: เลขประจำตัวผู้เสียภาษี
F: สถานะ
```

**Sheet: MessageLog**
```
A: Timestamp
B: LINE User ID
C: ข้อความที่ส่ง
D: ข้อความตอบกลับ
```

**Sheet: Admins** (สร้างอัตโนมัติโดยฟังก์ชัน setupSheets)
```
A: Timestamp
B: LINE User ID ⭐ (ใช้ตรวจสอบสิทธิ์ Admin)
C: ชื่อ-นามสกุล
D: Email (optional)
E: สถานะ (active/inactive)
F: Role (admin/super_admin)
```

**⚠️ สำคัญมาก**: ต้องเพิ่ม Admin อย่างน้อย 1 คนใน Sheet "Admins" ก่อนใช้งานระบบ!

4. คัดลอก **Spreadsheet ID** จาก URL:
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
   ```

### 2. สร้าง Google Apps Script

1. เปิด Google Sheets → Extensions → Apps Script
2. ลบไฟล์ `Code.gs` เดิม (ถ้ามี)
3. สร้างไฟล์ใหม่ชื่อ `Code.gs`
4. คัดลอกโค้ดจาก `Code.gs` ในโปรเจกต์นี้ไปวาง
5. แก้ไขค่า CONFIG:

```javascript
const CONFIG = {
  SPREADSHEET_ID: "YOUR_SPREADSHEET_ID", // ใส่ Spreadsheet ID ที่ได้จากขั้นตอนที่ 1
  SHEET_NAMES: {
    AR: "AccountReceivables",
    CUSTOMERS: "Customers",
    LOG: "MessageLog",
    ADMINS: "Admins"  // Admin IDs ถูกอ่านจาก Sheet นี้
  },
  LINE_CHANNEL_ACCESS_TOKEN: "YOUR_CHANNEL_ACCESS_TOKEN", // จะได้จากขั้นตอนที่ 3
};
```

**สำคัญ**: Admin IDs ถูกอ่านจาก Sheet "Admins" โดยอัตโนมัติ ไม่ต้อง hardcode อีกต่อไป!

**วิธีเพิ่ม Admin คนแรก**:
1. รันฟังก์ชัน `setupSheets()` เพื่อสร้าง Sheet Admins
2. เพิ่ม Admin คนแรกโดยตรง (directly) ใน Sheet Admins:
   - คอลัมน์ A: Timestamp
   - คอลัมน์ B: LINE User ID
   - คอลัมน์ C: ชื่อ-นามสกุล
   - คอลัมน์ D: Email (optional)
   - คอลัมน์ E: active
   - คอลัมน์ F: admin
3. หลังจากนั้นสามารถเพิ่ม Admin ผ่าน LINE: `admin add {LINE_USER_ID} {ชื่อ}`

6. รันฟังก์ชัน `setupSheets` เพื่อสร้าง Sheets ที่จำเป็น:
   - เลือกฟังก์ชัน `setupSheets` จาก dropdown
   - กด Run
   - ให้สิทธิ์การเข้าถึง (Authorization) เมื่อถาม

### 3. สร้าง LINE Messaging API Channel

1. ไปที่ [LINE Developers Console](https://developers.line.biz/console/)
2. สร้าง Provider ใหม่ (ถ้ายังไม่มี)
3. สร้าง Messaging API Channel ใหม่
4. ได้รับ:
   - **Channel Access Token** (Long-lived) → ใช้ใน Apps Script
   - **Channel Secret** → เก็บไว้ใช้ตรวจสอบ webhook (ถ้าต้องการ)

5. ตั้งค่า Webhook:
   - ไปที่ Messaging API settings
   - เปิด Use webhook
   - ใส่ Webhook URL: จะได้จากขั้นตอนที่ 4
   - กด Verify เพื่อทดสอบ

### 4. Deploy Google Apps Script

1. ใน Apps Script editor:
   - กด **Deploy** → **New deployment**
   - Click select type → เลือก **Web app**
   - Description: `Boonyang CheckInv Webhook`
   - Execute as: **Me** (อีเมลของคุณ)
   - Who has access: **Anyone** ⭐ (สำคัญมาก)
   - กด **Deploy**

2. คัดลอก **Web App URL**:
   ```
   https://script.google.com/macros/s/WEB_APP_URL/exec
   ```

3. นำ Web App URL ไปใส่ใน LINE Developers Console → Webhook URL

4. กด Verify ใน LINE Console เพื่อทดสอบ webhook

### 5. สร้าง LIFF App

1. ใน LINE Developers Console:
   - ไปที่ LIFF → Add
   - ตั้งค่า:
     - LIFF app name: `Boonyang Registration`
     - Size: `Tall` หรือ `Compact`
     - Endpoint URL: URL ของ `register/index.html` (ดูขั้นตอนถัดไป)
     - Scope: `profile`
     - Bot link feature: เปิดเพื่อให้ลูกค้า follow อัตโนมัติ

2. คัดลอก **LIFF ID** ที่ได้

### 6. Deploy LIFF Registration Form

1. เปิดไฟล์ `register/index.html`
2. แก้ไขค่า CONFIG:

```javascript
const CONFIG = {
  LIFF_ID: "YOUR_LIFF_ID", // ใส่ LIFF ID ที่ได้จากขั้นตอนที่ 5
  WEB_APP_URL: "YOUR_WEB_APP_URL", // ใส่ Web App URL จากขั้นตอนที่ 4
};
```

และแก้ไขบรรทัดนี้ (สำหรับ redirect หลังลงทะเบียนสำเร็จ):
```javascript
window.location.href = "https://line.me/ti/p/@YOUR_LINE_ID"; // ใส่ LINE ID ของคุณ
```

3. Deploy ไฟล์นี้ไปยัง hosting service:
   - **Vercel**: ฟรี แนะนำ
   - **Netlify**: ฟรี ใช้ง่าย
   - **GitHub Pages**: ฟรี
   - หรือ hosting อื่นๆ

4. นำ URL ที่ได้ไปใส่ใน LINE LIFF Endpoint URL

### 7. เพิ่ม LIFF Link ใน LINE Official Account

1. ไปที่ LINE Official Account Manager
2. ไปที่ Conversation settings → Rich menu หรือ greeting messages
3. เพิ่มลิงก์สำหรับลงทะเบียน:
   ```
   ลงทะเบียนเพื่อใช้งานระบบ:
   https://liff.line.me/YOUR_LIFF_ID
   ```

## 📱 How to Use

### สำหรับลูกค้า:

1. **ลงทะเบียนครั้งแรก**
   - คลิกลิงก์ลงทะเบียนใน LINE Official Account
   - กรอกข้อมูล:
     - ชื่อ-นามสกุล
     - ชื่อร้านค้า (ต้องตรงกับในระบบบัญชี)
     - เลขประจำตัวผู้เสียภาษี (13 หลัก)
   - กดลงทะเบียน
   - ⏳ **รอการอนุมัติจาก Admin** (ภายใน 24 ชั่วโมง)

2. **ตรวจสอบยอดคงค้าง** (หลังได้รับการอนุมัติแล้ว)
   - เปิด LINE → พิมพ์ `ยอดคงค้าง`
   - รับยอดคงค้างทันที!

### สำหรับ Admin:

ใช้คำสั่งต่อไปนี้ใน LINE (เฉพาะ Admin เท่านั้น):

**คำสั่งจัดการลูกค้า:**
- `admin pending` - ดูรายชื่อลูกค้าที่รออนุมัติ
- `admin approve {LINE_USER_ID}` - อนุมัติบัญชีลูกค้า
- `admin reject {LINE_USER_ID} {เหตุผล}` - ปฏิเสธ/ระงับบัญชี
- `admin status {LINE_USER_ID}` - ดูสถานะบัญชี
- `admin count` - ดูจำนวนลูกค้าทั้งหมด

**คำสั่งจัดการ Admin:**
- `admin add {LINE_USER_ID} {ชื่อ}` - เพิ่ม Admin ใหม่
- `admin remove {LINE_USER_ID}` - ลบ Admin
- `admin list` - ดูรายชื่อ Admin ทั้งหมด
- `admin help` - ดูคำสั่งทั้งหมด

**ตัวอย่าง**:
```
admin pending
admin approve U1234567890
admin reject U1234567890 ข้อมูลไม่ถูกต้อง
admin status U1234567890
admin count
admin add U9876543210 สมชาย ใจดี
admin remove U9876543210
admin list
```

### คำสั่งอื่นๆ:

- `help` หรือ `ช่วยเหลือ` - ดูวิธีใช้

## 🔧 Testing

### ทดสอบ Webhook

ใน Apps Script editor:
1. เลือกฟังก์ชัน `doGet`
2. กด Run
3. ดูผลใน Execution log

### ทดสอบด้วย Postman/curl

```bash
curl -X POST "WEB_APP_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "destination": "U123456",
    "events": [{
      "type": "message",
      "replyToken": "test",
      "source": {"userId": "TEST_USER_ID"},
      "message": {"type": "text", "text": "ยอดคงค้าง"}
    }]
  }'
```

## 📊 Data Structure

### AccountReceivables Sheet

```
แถว 10:  ร้านค้า A           (คอลัมน์ B)
แถว 11:                          ยอดรวม     10,000   (คอลัมน์ G, H)
แถว 12:  ร้านค้า B
แถว 13:                          ยอดรวม     20,000
```

- **คอลัมน์ B**: ชื่อร้านค้า (อยู่ด้านบน ไม่ใช่แถวเดียวกับยอดรวม)
- **คอลัมน์ G**: มีคำว่า "ยอดรวม" ในแถวที่เป็นยอดรวม
- **คอลัมน์ H**: ยอดเงิน

### อัลกอริทึมการคำนวณยอดคงค้าง:

1. วนลูปผ่านทุกแถว
2. เมื่อพบ "ยอดรวม" ในคอลัมน์ G:
   - ย้อนขึ้นไปหาชื่อร้านค้าในคอลัมน์ B (ด้านบนสุด)
   - ถ้าชื่อตรง → เพิ่มยอดเงินจากคอลัมน์ H
3. รวมยอดเงินทั้งหมดของร้านค้านั้นๆ

## 🔒 Security

- เก็บ LINE Channel Access Token ใน Script Properties (ไม่ hardcode)
- ใช้ HTTPS สำหรับทุกการเชื่อมต่อ
- จำกัดการเข้าถึง Google Sheets (เฉพาะ owner)
- ไม่แสดงข้อมูลส่วนตัวของลูกค้าที่ไม่จำเป็น

### การเก็บ Token แบบปลอดภัย (แนะนำ)

ใน Apps Script:
1. ไปที่ Project Settings (gear icon)
2. ติ๊ก **Show "appsscript.json" manifest file**
3. แก้ไข `appsscript.json`:
   ```json
   {
     "timeZone": "Asia/Bangkok",
     "dependencies": {},
     "exceptionLogging": "STACKDRIVER",
     "runtimeVersion": "V8"
   }
   ```
4. ใช้ Properties Service แทน hardcode:

```javascript
// ในฟังก์ชันแรกที่รัน
function setProperties() {
  PropertiesService.getScriptProperties()
    .setProperty("LINE_CHANNEL_ACCESS_TOKEN", "your_token_here")
    .setProperty("SPREADSHEET_ID", "your_sheet_id_here");
}

// ใน Code.gs
const CONFIG = {
  SPREADSHEET_ID: PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID"),
  LINE_CHANNEL_ACCESS_TOKEN: PropertiesService.getScriptProperties().getProperty("LINE_CHANNEL_ACCESS_TOKEN"),
  // ...
};
```

## 🐛 Troubleshooting

### Webhook ไม่ทำงาน

1. ตรวจสอบว่า Deploy เป็น **Web app** ไม่ใช่ API Executable
2. ตรวจสอบว่า **Who has access: Anyone**
3. ตรวจสอบ Webhook URL ใน LINE Console
4. ดู Log ใน Apps Script: Executions → View

### ลูกค้าลงทะเบียนแล้วแต่พิมพ์ "ยอดคงค้าง" ไม่ได้

1. ตรวจสอบว่าชื่อร้านค้าตรงกับใน AccountReceivables Sheet
2. ตรวจสอบ Log ใน MessageLog Sheet
3. ดู Console Log ใน Apps Script

### LIFF ไม่ทำงาน

1. ตรวจสอบ LIFF ID
2. ตรวจสอบว่า Endpoint URL ถูกต้อง
3. ตรวจสอบ Scope: `profile`

## 📝 Maintenance

### อัปเดตโค้ด

1. แก้ไขโค้ดใน Apps Script Editor
2. Deploy → **New deployment** → Web app
3. ใส่ Version (เช่น `v2`, `v3`)
4. Deploy

เวอร์ชันใหม่จะไม่กระทบเวอร์ชันเก่า สามารถย้อนกลับได้

### ดูประวัติการใช้งาน

- เปิด MessageLog Sheet เพื่อดูประวัติการสนทนา
- เปิด Customers Sheet เพื่อดูรายชื่อลูกค้า

## 🚀 Future Enhancements

- [ ] ส่งสรุปยอดคงค้างรายเดือน
- [ ] ส่งแจ้งเตือนเมื่อมีเอกสารใหม่
- [ ] ดูรายละเอียดทีละเอกสาร
- [ ] ส่งใบแจ้งหนี้ผ่าน LINE
- [ ] ระบบชำระเงินออนไลน์

## 📞 Support

หากต้องการความช่วยเหลือ ติดต่อ:
- อีเมล: support@boonyang.com
- LINE: @boonyang

## 📄 License

Copyright © 2025 Boonyang. All rights reserved.
