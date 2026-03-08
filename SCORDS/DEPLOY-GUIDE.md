# 🚀 คู่มือการ Deploy และใช้งาน SCORDS Participant Display

## 📋 ภาพรวะ

ฟีเจอร์นี้ใช้ backend จาก `Code_Old_Reorganized.gs` โดยตรงผ่าน Google Apps Script Web App

---

## ⚡ ขั้นตอนการ Deploy (3 ขั้นตอน)

### Step 1: เตรียม Google Apps Script

1. เปิดไฟล์ [backend/Code_Old_Reorganized.gs](backend/Code_Old_Reorganized.gs)
2. ตรวจสอบว่ามีฟังก์ชัน `getParticipantsForDisplay` แล้ว (บรรทัดประมาณ 430-540)
3. ตรวจสอบว่ามี action handler ใน `doGet` (บรรทัดประมาณ 85-90):

```javascript
if (action === "getParticipantsForDisplay") {
  const activityId = e.parameter.activityId;
  if (!activityId) throw new Error("Activity ID is required.");
  return createJsonResponse(getParticipantsForDisplay(activityId));
}
```

### Step 2: Deploy เป็น Web App

1. ใน Google Apps Script Editor:
   - คลิก **Deploy** → **New deployment**
   - หรือถ้าเคย deploy แล้ว: **Deploy** → **Manage deployments** → **Edit**

2. ตั้งค่า:
   - **Description**: `SCORDS Participant Display API`
   - **Execute as**: เลือก **Me (your-email@example.com)** ⚠️ สำคัญ!
   - **Who has access**: เลือก **Anyone** ⚠️ สำคัญ!

3. คลิก **Deploy**

4. **คัดลอก Web App URL** เช่น: `https://script.google.com/macros/s/XXXXX/exec`

### Step 3: อัปเดต participant-display.html

เปิดไฟล์ [participant-display.html](participant-display.html) และแก้ไขบรรทัดที่ 423:

```javascript
// แทนที่ด้วย Web App URL จาก Step 2
const SCORDS_API_URL = 'https://script.google.com/macros/s/XXXXX/exec';
```

---

## 🎮 วิธีการใช้งาน

### วิธีที่ 1: เปิดหน้า Display

1. เปิดไฟล์: `participant-display.html?activityId=YOUR_ACTIVITY_ID`
2. ตัวอย่าง: `participant-display.html?activityId=ACT001`

**หมายเหตุ:** `activityId` ต้องตรงกับ ID ใน Google Sheet > Activities sheet > คอลัมน์ ID

### วิธีที่ 2: Demo Mode (ทดสอบ)

เปิดไฟล์: `participant-display.html?activityId=demo`

หรือถ้ายังไม่ได้แก้ `SCORDS_API_URL` ระบบจะใช้ mock data อัตโนมัติ

---

## 🎨 ฟีเจอร์และการควบคุม

### Keyboard Shortcuts
- **R** - รีเฟรชข้อมูล
- **A** - เปิด/ปิด Auto-refresh

### Controls
- **🔄 รีเฟรช** - โหลดข้อมูลใหม่
- **⏱️ อัตโนมัติ** - เปิด/ปิด auto-refresh (ทุก 30 วินาที)
- **📊 ส่งออก** - ส่งออกรายชื่อเป็น CSV

### Interactive
- **Hover** ที่รูปเพื่อดูข้อมูล (ชื่อ, เวลา check-in, สถานะ)
- **Click** ที่รูปเพื่อดูรายละเอียด

---

## 📊 โครงสร้างข้อมูล

### Request (GET)
```
GET https://script.google.com/macros/s/XXXXX/exec?action=getParticipantsForDisplay&activityId=ACT001
```

### Response Format
```json
{
  "success": true,
  "activity": {
    "id": "ACT001",
    "name": "กิจกรรมต้อนรับตำแหน่ง",
    "date": "2026-03-08",
    "startTime": "09:00",
    "endTime": "17:00",
    "location": "ห้องประชุม A",
    "qrCode": "123456"
  },
  "participants": [
    {
      "userId": "U1234567890",
      "displayName": "สมชาย ใจดี",
      "pictureUrl": "https://profile.line.scdn.net/...",
      "employeeId": "EMP1234",
      "position": "ผู้จัดการ",
      "department": "IT",
      "checkInTime": "2026-03-08T09:15:30.000Z",
      "status": "ตรงเวลา",
      "checkInMethod": "QR Code"
    }
  ],
  "stats": {
    "total": 25,
    "byDepartment": {
      "IT": 10,
      "HR": 8,
      "Sales": 7
    },
    "byStatus": {
      "ตรงเวลา": 20,
      "สาย": 5
    }
  },
  "timestamp": "2026-03-08T09:20:00.000Z"
}
```

---

## 🔧 การปรับแต่ง

### ปรับขนาดรูปโปรไฟล์

แก้ไข CSS (บรรทัดประมาณ 140-149):

```css
.size-small { width: 60px; height: 60px; }
.size-medium { width: 90px; height: 90px; }
.size-large { width: 120px; height: 120px; }
.size-xlarge { width: 150px; height: 150px; }
```

### ปรับสี Background

แก้ไข CSS (บรรทัดประมาณ 28-30):

```css
body {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  /* เปลี่ยนสีตามต้องการ */
}
```

### ปรับความเร็ว Auto-refresh

แก้ไข JavaScript (บรรทัดประมาณ 660):

```javascript
setInterval(async () => {
  if (IS_AUTO_REFRESH) {
    await loadParticipants();
  }
}, 30000); // เปลี่ยน 30000 เป็นมิลลิวินาทีที่ต้องการ
```

---

## 🐛 การแก้ไขปัญหา

### ปัญหา: ข้อมูลไม่โหลด

**สาเหตุที่เป็นไปได้:**
1. ยังไม่ Deploy Web App
2. ไม่ได้แก้ `SCORDS_API_URL`
3. Activity ID ไม่ถูกต้อง

**วิธีแก้:**
1. ตรวจสอบ Console (F12) ดู error message
2. ตรวจสอบว่า Deploy เป็น "Me" และ "Anyone"
3. ทดลองเปิด Demo Mode: `?activityId=demo`

### ปัญหา: รูปโปรไฟล์ไม่แสดง

**สาเหตุ:**
- User ไม่มี ProfilePicture ใน Users sheet
- รูปไม่สามารถเข้าถึงได้ (URL หมดอายุ)

**วิธีแก้:**
- ระบบมี fallback เป็น UI Avatar อัตโนมัติ (ใช้ชื่อสร้างรูป)
- ตรวจสอบ Users sheet คอลัมน์ ProfilePicture

### ปัญหา: CORS Error

**สาเหตุ:** ยังไม่ Deploy หรือ Deploy ไม่ถูกต้อง

**วิธีแก้:**
- Deploy ใหม่ โดยเลือก **Execute as: Me** และ **Who has access: Anyone**
- รอ 1-2 นาทีหลัง Deploy แล้วลองใหม่

---

## 📱 การใช้งานบนหน้าจอต่างๆ

### Desktop/PC (แนะนำ)
- ✅ เหมาะสมที่สุด
- ขนาด 1920x1080 หรือสูงกว่า
- แสดงบนหน้าจอขนาดใหญ่

### TV Display
- ✅ เหมาะสม
- ใช้ HDMI หรือ wireless casting

### Tablet
- ⚠️ ใช้งานได้แต่รูปอาจชนกันถ้าจำนวนมาก

### Mobile
- ⚠️ ใช้งานได้แต่ไม่แนะนำ (หน้าจอเล็กเกินไป)

---

## 🎯 การใช้งานจริง

### การตั้งค่าหน้าจอแสดงผล

**แนะนำ:**
1. เปิด `participant-display.html` บน Desktop/PC
2. เชื่อมต่อกับหน้าจอ TV/Projector (HDMI, AirPlay, Chromecast)
3. Zoom หน้าเว็บให้เต็มหน้าจอ (F11 → Fullscreen)
4. เปิด Auto-refresh เพื่ออัปเดตอัตโนมัติ

### การตรวจสอบ Activity ID

1. เปิด Google Sheets
2. ไปที่ **Activities** sheet
3. ดูคอลัมน์ **ID** (คอลัมน์แรก)
4. ใช้ ID นี้ใน URL: `?activityId=ACT001`

---

## 📝 Checklist ก่อนใช้งาน

- [ ] ✅ ตรวจสอบว่ามีฟังก์ชัน `getParticipantsForDisplay` ใน `Code_Old_Reorganized.gs`
- [ ] ✅ Deploy Google Apps Script เป็น Web App (Execute as: Me, Access: Anyone)
- [ ] ✅ คัดลอก Web App URL
- [ ] ✅ อัปเดต `SCORDS_API_URL` ใน `participant-display.html`
- [ ] ✅ ตรวจสอบ Activity ID ใน Google Sheets
- [ ] ✅ ทดสอบเปิด `participant-display.html?activityId=demo`
- [ ] ✅ ทดสอบเปิดด้วย activity ID จริง
- [ ] ✅ ทดสอบ check-in ดูว่ารูปปรากฏขึ้นมาไหม

---

## 🔗 ไฟล์ที่เกี่ยวข้อง

1. **[participant-display.html](participant-display.html)** - หน้าแสดงผลหลัก
2. **[backend/Code_Old_Reorganized.gs](backend/Code_Old_Reorganized.gs)** - Backend API (มีฟังก์ชัน getParticipantsForDisplay)
3. **[checkin.html](checkin.html)** - หน้า Check-in (user ใช้เช็คอิน)

---

## 💡 Tips

1. **ทดสอบก่อนใช้งานจริง** - ใช้ Demo Mode หรือ activity ID ทดสอบก่อน
2. **เปิด Auto-refresh** - กดปุ่ม "อัตโนมัติ" เพื่อให้ข้อมูลอัปเดตเอง
3. **Fullscreen Mode** - กด F11 เพื่อแสดงเต็มหน้าจอ
4. **Export Data** - ส่งออกรายชื่อ participant เป็น CSV ได้ทันที
5. **Monitor Console** - เปิด Console (F12) เพื่อดู error ถ้ามีปัญหา

---

## 📞 การติดต่อ

หากมีปัญหา:
1. ตรวจสอบ Console Log (F12 → Console tab)
2. อ่าน Google Apps Script execution log
3. ตรวจสอบ Deploy settings (Execute as: Me, Access: Anyone)
4. ทดลอง Demo Mode ดูว่าใช้งานได้ไหม

---

**สร้างด้วย ❤️ สำหรับทีม SCORDS**
**อัปเดตล่าสุด: มีนาคม 2026**
