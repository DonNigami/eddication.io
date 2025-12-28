# Customer Notification Setup Guide

## 📋 Overview
ระบบแจ้งเตือนลูกค้าผ่าน **Google Chat** และ **Email** เมื่อมีการอัปเดตสถานะการจัดส่ง

**การค้นหาข้อมูลติดต่อ:**
ระบบจะค้นหาข้อมูลติดต่อลูกค้าจากหลาย sheets ตามลำดับ:
1. `CustomerContacts` (แนะนำ - มีข้อมูลครบถ้วน)
2. `Email_STA` (fallback - มีข้อมูล email)
3. `Customer` (fallback - มีข้อมูลลูกค้า)

ระบบจะค้นหาคอลัมน์ email แบบอัตโนมัติ รองรับทั้ง: `email`, `E-mail`, `EMAIL`, `e-mail` (case-insensitive)

---

## 🚀 Quick Start

### 1. สร้าง Sheet "CustomerContacts" (อัตโนมัติ ✨)

**ข่าวดี!** ระบบจะสร้าง Sheet `CustomerContacts` ให้อัตโนมัติเมื่อ backend start ครั้งแรก

Sheet ที่จะถูกสร้างอัตโนมัติ:
- ✅ `CustomerContacts` - ข้อมูลติดต่อลูกค้า (แนะนำ)
- ✅ `Awareness` - บันทึกการยอมรับข้อตกลง
- ✅ `POD` - Proof of Delivery
- ✅ `Emergency` - รายงาน SOS
- ✅ `EndTrip` - บันทึกจบทริป
- ✅ `MissingSteps` - ข้อมูลขั้นตอนที่ขาด

**หรือใช้ Sheets ที่มีอยู่แล้ว:**

ระบบรองรับการค้นหาข้อมูลจาก:
- **Email_STA** - ต้องมีคอลัมน์: `shipToCode`, `email` (หรือ E-mail)
- **Customer** - ต้องมีคอลัมน์: `shipToCode`, `email` (หรือ E-mail)

### 2. เพิ่มข้อมูลลูกค้า

**ตัวอย่างใน CustomerContacts:**
```
shipToCode: 001234
shipToName: บริษัท ABC จำกัด
customerName: คุณสมชาย
email: somchai@abc.com
chatEmail: somchai@company.com  ← ส่งข้อความตรงไปยัง Personal Chat
chatWebhook: https://chat.googleapis.com/v1/spaces/xxx/messages?key=xxx&token=xxx (ตัวเลือก)
phoneNumber: 0812345678
notifyOnCheckIn: TRUE
notifyOnNearby: TRUE
notifyOnComplete: TRUE
notifyOnIssue: TRUE
```

**ตัวอย่างใน Email_STA หรือ Customer (แบบง่าย):**
```
shipToCode: 001234
email: somchai@abc.com
(หรือ E-mail: somchai@abc.com)
```

---

## 🔍 Multi-Sheet Contact Search

### ลำดับการค้นหา:

```
1. CustomerContacts Sheet
   └─ มีข้อมูลครบถ้วน (email, chatEmail, chatWebhook, notification preferences)
   └─ แนะนำให้ใช้ sheet นี้สำหรับข้อมูลหลัก
   ↓
2. Email_STA Sheet (ถ้าไม่พบใน CustomerContacts)
   └─ ค้นหา shipToCode + email (หรือ E-mail)
   └─ ใช้เป็น fallback ถ้ามี sheet นี้อยู่แล้ว
   ↓
3. Customer Sheet (ถ้าไม่พบใน Email_STA)
   └─ ค้นหา shipToCode + email (หรือ E-mail)
   └─ ใช้เป็น fallback สุดท้าย
   ↓
4. ไม่พบข้อมูล
   └─ ข้ามการแจ้งเตือนสำหรับลูกค้ารายนี้
```

### รองรับชื่อคอลัมน์ (case-insensitive):

**Email columns:**
- `email`
- `E-mail`
- `EMAIL`
- `e-mail`
- `e_mail`

**ShipTo columns:**
- `shipToCode`
- `shiptocode`
- `ship_to_code`
- `ShipToCode`

---

## � Admin Notification Copy

**ฟีเจอร์พิเศษ:** ระบบจะส่งสำเนาการแจ้งเตือนทั้งหมดไปยัง Admin Webhook โดยอัตโนมัติ

### การตั้งค่า:

**ตัวเลือก 1: ใช้ค่า default (แนะนำ)**
- ระบบใช้ webhook ที่กำหนดไว้แล้ว
- ไม่ต้องตั้งค่าเพิ่มเติม

**ตัวเลือก 2: เปลี่ยน webhook**
```env
# ใน .env หรือ Railway Environment Variables
ADMIN_NOTIFICATION_WEBHOOK=https://chat.googleapis.com/v1/spaces/YOUR_SPACE/messages?key=...&token=...
```

### รูปแบบข้อความที่ Admin จะได้รับ:

```
📋 *สำเนาการแจ้งเตือน*

👤 ถึง: customer@company.com
📝 หัวข้อ: แจ้งเตือน: คนขับออกเดินทาง - SH-2025-001
⏰ เวลา: 28/12/2025 14:30:00

🚛 *แจ้งเตือน: คนขับออกเดินทาง*

สวัสดีครับคุณ สมชาย
คนขับ *วิชัย* ได้ออกเดินทางมาส่งของแล้วครับ
...
```

### ข้อดี:
- ✅ ติดตามการแจ้งเตือนทั้งหมดในที่เดียว
- ✅ ตรวจสอบว่าลูกค้าได้รับการแจ้งเตือนหรือไม่
- ✅ Debug ปัญหาการส่งข้อความ
- ✅ Archive ประวัติการแจ้งเตือน

---

## �💬 Google Chat Direct Message Setup (แนะนำ)

### วิธีส่งข้อความตรงไปยัง Personal Chat ของลูกค้า:

1. **Enable Google Chat API:**
   - Google Cloud Console → APIs & Services → Library
   - ค้นหา **"Google Chat API"** 
   - คลิก **"Enable"**

2. **ตั้งค่า Service Account Scopes:**
   - ไปที่ IAM & Admin → Service Accounts
   - เลือก Service Account ของคุณ
   - Tab "Keys" → ดู JSON key
   - ในฟังก์ชั่น `initialize()` ของ `notification-service.js` 
   - ตรวจสอบว่า auth นี้มี scopes:
     - `https://www.googleapis.com/auth/chat.bot` ✅
     - `https://www.googleapis.com/auth/chat.messages` ✅
   
   **หรือใส่ใน .env:**
   ```env
   GOOGLE_CHAT_SCOPES=https://www.googleapis.com/auth/chat.bot https://www.googleapis.com/auth/chat.messages
   ```

3. **ใส่ Email ของลูกค้าในคอลัมน์ `chatEmail`:**
   - ใช้ Google Workspace email (เช่น somchai@company.com)
   - ระบบจะสร้าง DM space ให้อัตโนมัติ
   - ส่งข้อความตรงไปยัง Personal Chat
   - ไม่ต้องสร้าง Webhook

4. **ข้อมูลลูกค้าที่สมบูรณ์:**
```
shipToCode: 001234
chatEmail: somchai@company.com     ← DM ไปยัง Personal Chat (ขอแนะนำ)
chatWebhook: (ปล่อยว่าง)            ← ใช้เมื่อไม่มี chatEmail
```

**ลำดับความสำคัญในการส่ง:**
1. `chatEmail` ถ้ามีค่า → ส่ง DM ไปยัง Personal Chat (✨ ขอแนะนำสุด)
2. `chatWebhook` ถ้าไม่มี chatEmail → ส่งไปยัง Google Chat Space
3. `email` ถ้าไม่มี Chat → ส่งอีเมล
4. ไม่มีทั้งสามตัว → ข้ามไป

---

## 🔧 Google Chat Webhook Setup (ทางเลือก)

### สำหรับ Google Workspace:

1. **สร้าง Google Chat Space:**
   - เปิด Google Chat: https://chat.google.com
   - คลิก **"+"** → **"Create a space"**
   - ตั้งชื่อ Space (เช่น "ABC Company Notifications")
   - เพิ่มสมาชิก (ถ้าต้องการ)

2. **สร้าง Webhook:**
   - คลิกที่ชื่อ Space → **"Apps & integrations"**
   - คลิก **"Add webhooks"**
   - ตั้งชื่อ webhook (เช่น "Delivery Alerts")
   - Copy **Webhook URL**
   - นำไปวางในคอลัมน์ `chatWebhook` ใน Sheet

3. **ทดสอบ Webhook:**
```bash
curl -X POST 'WEBHOOK_URL' \
  -H 'Content-Type: application/json' \
  -d '{"text":"ทดสอบการแจ้งเตือน"}'
```

---

## 📧 Email Setup (Optional)

ถ้าต้องการส่ง Email ต้องตั้งค่า Gmail API:

### 1. Enable Gmail API:
- ไปที่ https://console.cloud.google.com/apis/library/gmail.googleapis.com
- คลิก **"Enable"**

### 2. เพิ่ม Scope ใน Service Account:
- เพิ่ม scope: `https://www.googleapis.com/auth/gmail.send`

### 3. Gmail Delegation (สำหรับ Workspace):
- ไปที่ Admin Console → Security → API Controls
- เพิ่ม Domain-wide delegation
- Client ID: จาก Service Account
- Scopes: `https://www.googleapis.com/auth/gmail.send`

---

## 🔔 การใช้งาน

### 1. แจ้งเตือนอัตโนมัติเมื่อ Check-in:

ใน `sheet-actions.js` → `updateStop()` เพิ่ม:
```javascript
// After successful check-in
if (type === 'checkin') {
  // Send notification
  try {
    await axios.post(`${process.env.BACKEND_URL}/api/send-notification`, {
      type: 'checkin',
      shipToCode: stop.shipToCode,
      reference: stop.referenceNo,
      shipmentNo: stop.shipmentNo,
      driverName: userId,
      estimatedArrival: '30 นาที'
    });
  } catch (err) {
    console.error('Failed to send notification:', err);
  }
}
```

### 2. แจ้งเตือนเมื่อใกล้ถึง (Nearby):

เพิ่มใน frontend `test.html`:
```javascript
// Check distance and notify
async function checkNearbyAndNotify(stop, currentLat, currentLng) {
  const distance = calculateDistance(
    currentLat, currentLng,
    stop.destLat, stop.destLng
  );
  
  // If within 5km and not notified yet
  if (distance <= 5 && !stop.notifiedNearby) {
    try {
      await fetch(CONFIG.WEB_APP_URL + '/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'nearby',
          shipToCode: stop.shipToCode,
          reference: stop.referenceNo,
          shipmentNo: stop.shipmentNo,
          driverName: userName,
          minutesAway: Math.round(distance / 0.5) // estimate
        })
      });
      
      stop.notifiedNearby = true;
    } catch (err) {
      console.error('Failed to send nearby notification:', err);
    }
  }
}
```

### 3. แจ้งเตือนเมื่อส่งเสร็จ (Completed):

ใน `sheet-actions.js` → `updateStop()` เมื่อ `type === 'checkout'`:
```javascript
if (type === 'checkout') {
  // Send completion notification
  try {
    await axios.post(`${process.env.BACKEND_URL}/api/send-notification`, {
      type: 'completed',
      shipToCode: stop.shipToCode,
      reference: stop.referenceNo,
      shipmentNo: stop.shipmentNo,
      driverName: userId,
      deliveryTime: new Date().toLocaleTimeString('th-TH')
    });
  } catch (err) {
    console.error('Failed to send completion notification:', err);
  }
}
```

### 4. แจ้งเตือนเมื่อมีปัญหา (Issue):

เพิ่ม API endpoint ใหม่สำหรับรายงานปัญหา:
```javascript
// In frontend
async function reportIssue(issueType, description) {
  try {
    await fetch(CONFIG.WEB_APP_URL + '/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'issue',
        shipToCode: currentStop.shipToCode,
        reference: currentReference,
        shipmentNo: currentStop.shipmentNo,
        driverName: userName,
        issueType: issueType,
        issueDescription: description
      })
    });
    
    showToastSuccess('แจ้งปัญหาเรียบร้อยแล้ว');
  } catch (err) {
    showToastError('แจ้งปัญหาไม่สำเร็จ');
  }
}
```

---

## 🎨 Customization

### ปรับแต่งข้อความแจ้งเตือน:

แก้ไขใน `notification-service.js`:
```javascript
async notifyCheckIn({ ... }) {
  const message = `
🚛 *คุณ${customerName}ครับ*

คนขับ *${driverName}* ออกเดินทางแล้วครับ
📦 Shipment: ${shipmentNo}
📍 ปลายทาง: ${destination}

// เพิ่มข้อความของคุณที่นี่
  `.trim();
  
  // ...
}
```

### เพิ่ม Notification Channel ใหม่:

เช่น LINE Notify:
```javascript
async _sendLineNotify(token, message) {
  try {
    await axios.post('https://notify-api.line.me/api/notify', 
      `message=${encodeURIComponent(message)}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    console.log('✅ LINE notification sent');
    return { success: true };
  } catch (err) {
    console.error('❌ Failed to send LINE:', err.message);
    return { success: false, error: err.message };
  }
}
```

---

## 📊 API Reference

### GET `/api/customer-contact`
```bash
GET /api/customer-contact?shipToCode=001234
```
**Response:**
```json
{
  "success": true,
  "data": {
    "shipToCode": "001234",
    "customerName": "คุณสมชาย",
    "email": "somchai@abc.com",
    "chatWebhook": "https://...",
    "notifyOnCheckIn": true,
    "notifyOnNearby": true,
    "notifyOnComplete": true,
    "notifyOnIssue": true
  }
}
```

### POST `/api/customer-contact`
```bash
POST /api/customer-contact
Content-Type: application/json

{
  "shipToCode": "001234",
  "shipToName": "บริษัท ABC",
  "customerName": "คุณสมชาย",
  "email": "somchai@abc.com",
  "chatWebhook": "https://...",
  "notifyOnCheckIn": true,
  "notifyOnNearby": true,
  "notifyOnComplete": true,
  "notifyOnIssue": true
}
```

### POST `/api/send-notification`
```bash
POST /api/send-notification
Content-Type: application/json

{
  "type": "checkin",  // checkin, nearby, completed, issue
  "shipToCode": "001234",
  "reference": "REF001",
  "shipmentNo": "SH001",
  "driverName": "คุณสมศักดิ์",
  "estimatedArrival": "30 นาที"
}
```

---

## ✅ Checklist

- [ ] สร้าง Sheet `CustomerContacts` พร้อม headers
- [ ] เพิ่มข้อมูลลูกค้าตัวอย่าง
- [ ] ตั้งค่า Google Chat Webhook (ถ้าใช้)
- [ ] ตั้งค่า Gmail API (ถ้าใช้)
- [ ] ทดสอบ API `/api/customer-contact`
- [ ] ทดสอบส่งการแจ้งเตือน
- [ ] เพิ่ม notification logic ใน `updateStop()`
- [ ] Deploy ไป Railway
- [ ] ทดสอบจริงกับลูกค้า

---

## 🐛 Troubleshooting

### ❌ Google Chat webhook ไม่ work:
- ตรวจสอบ URL ว่าถูกต้อง
- ลองส่งทดสอบด้วย `curl`
- ตรวจสอบว่า Space ยังมีอยู่

### ❌ Email ไม่ส่ง:
- ตรวจสอบ Gmail API enabled
- ตรวจสอบ Service Account scope
- ตรวจสอบ Domain-wide delegation (Workspace)

### ❌ Notification ไม่ถูกส่ง:
- ตรวจสอบว่ามีข้อมูลใน `CustomerContacts` sheet
- ตรวจสอบ `notifyOnXXX` เป็น `TRUE`
- ดู backend logs: `railway logs`

---

**ต้องการความช่วยเหลือ?** แจ้งได้เลยครับ! 🚀
