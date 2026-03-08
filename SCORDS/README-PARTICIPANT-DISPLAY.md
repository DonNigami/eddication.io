# SCORDS Participant Display Feature

## 📋 ภาพรวม

ฟีเจอร์หน้าแสดงผล participant ที่ check-in แล้ว ด้วยรูปโปรไฟล์ LINE แบบลอยไปลอยมา (Floating Profile Pictures)

## ✨ ฟีเจอร์หลัก

### 1. รูปโปรไฟล์ลอยไปลอยมา (Floating Profiles)
- **4 ขนาด**: Small (60px), Medium (90px), Large (120px), X-Large (150px)
- **Animation หลากหลาย**: Float, Float-alt, Float-slow
- **Random Position**: กระจายตัวทั่วหน้าจอ
- **Interactive**: Hover เพื่อดูข้อมูล, Click เพื่อดูรายละเอียด

### 2. Real-time Updates
- **Auto-refresh**: ทุก 30 วินาที (สามารถปรับได้)
- **New Arrival Animation**: Pop-in effect เมื่อมี participant ใหม่
- **Confetti Effect**: เฉลิมเมื่อมีคนเช็คอิน

### 3. Statistics & Information
- **Participant Counter**: นับจำนวนคนที่ check-in แล้ว
- **Check-in Time**: แสดงเวลาที่ check-in
- **Last Update**: แสดงเวลาอัปเดตล่าสุด

### 4. Controls
- **Manual Refresh** (กด R)
- **Toggle Auto-refresh** (กด A)
- **Export to CSV**: ส่งออกรายชื่อ participant

## 📁 ไฟล์ที่สร้างใหม่

```
SCORDS/
├── participant-display.html      # หน้าแสดงผลหลัก
├── display-integration.html       # คู่มือการติดตั้ง
└── backend/
    └── APIHandlers.gs            # เพิ่มฟังก์ชัน getParticipantsForDisplay()
```

## 🚀 วิธีการติดตั้ง

### Step 1: เพิ่ม API Handler

ในไฟล์ `backend/APIHandlers.gs` มีฟังก์ชันใหม่ 2 ฟังก์ชัน:

```javascript
// ดึงข้อมูล participant ทั้งหมด
function getParticipantsForDisplay(params) {
  // params.activityId = ID ของกิจกรรม
  // คืนค่า: participants array with profile info
}

// ดึงข้อมูล participant ใหม่ (สำหรับ real-time)
function getParticipantUpdates(params) {
  // params.activityId = ID ของกิจกรรม
  // params.lastUpdate = timestamp ล่าสุดที่ดึงไป
  // คืนค่า: new participants since last update
}
```

### Step 2: Deploy Google Apps Script

1. เปิด Google Apps Script Editor
2. Deploy → New deployment
3. Select type: Web app
4. Description: SCORDS Participant Display API
5. Execute as: **Me (your email)**
6. Who has access: **Anyone**
7. คัดลอก Web app URL

### Step 3: อัปเดต participant-display.html

แก้ไขบรรทัดประมาณ 458:

```javascript
const response = await fetch('YOUR_WEB_APP_URL_HERE', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'getParticipantsForDisplay',
    activityId: ACTIVITY_ID
  })
});
```

### Step 4: เปิดหน้าแสดงผล

```
participant-display.html?activityId=YOUR_ACTIVITY_ID
```

หรือเปิดไฟล์ `display-integration.html` เพื่อดูคู่มือแบบเต็ม

## 🎨 การปรับแต่ง

### ปรับขนาดรูปโปรไฟล์

แก้ไข CSS (บรรทัดประมาณ 100-107):

```css
.size-small { width: 60px; height: 60px; }
.size-medium { width: 90px; height: 90px; }
.size-large { width: 120px; height: 120px; }
.size-xlarge { width: 150px; height: 150px; }
```

### ปรับสีและ Theme

แก้ไข background gradient (บรรทัดประมาณ 28):

```css
body {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  /* เปลี่ยนสีตามต้องการ */
}
```

### ปรับความเร็ว Auto-refresh

แก้ไข JavaScript (บรรทัดประมาณ 458):

```javascript
setInterval(async () => {
  if (IS_AUTO_REFRESH) {
    await loadParticipants();
  }
}, 30000); // เปลี่ยน 30000 เป็นมิลลิวินาทีที่ต้องการ
```

## 📊 โครงสร้างข้อมูล

### Request Format

```json
{
  "action": "getParticipantsForDisplay",
  "activityId": "ACTIVITY_001"
}
```

### Response Format

```json
{
  "success": true,
  "activity": {
    "id": "ACTIVITY_001",
    "name": "Activity Name",
    "date": "2026-03-08",
    "startTime": "09:00",
    "endTime": "17:00"
  },
  "participants": [
    {
      "userId": "U1234567890",
      "displayName": "สมชาย ใจดี",
      "pictureUrl": "https://profile.line.scdn.net/...",
      "employeeId": "EMP1234",
      "department": "IT",
      "checkInTime": "2026-03-08T09:15:30.000Z",
      "status": "Checked In",
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
    "byMethod": {
      "QR Code": 20,
      "GPS": 5
    }
  },
  "timestamp": "2026-03-08T09:20:00.000Z"
}
```

## 🎮 การใช้งาน

### Keyboard Shortcuts

- **R** - รีเฟรชข้อมูล
- **A** - เปิด/ปิด Auto-refresh

### Controls

- **🔄 รีเฟรช** - โหลดข้อมูลใหม่
- **⏱️ อัตโนมัติ** - เปิด/ปิด auto-refresh
- **📊 ส่งออก** - ส่งออกรายชื่อเป็น CSV

### Interactions

- **Hover** - ดูชื่อและเวลา check-in
- **Click** - ดูรายละเอียด participant

## 🔧 การแก้ไขปัญหา

### รูปโปรไฟล์ไม่แสดง

1. ตรวจสอบว่า user มี `PictureUrl` ใน database
2. ตรวจสอบ CORS policy สำหรับ LINE profile pictures
3. ใช้ fallback image ถ้าไม่มี picture:

```javascript
img.onerror = () => {
  img.src = 'https://via.placeholder.com/150?text=' + participant.displayName;
};
```

### ข้อมูลไม่อัปเดต

1. ตรวจสอบ Web App URL ว่าถูกต้อง
2. ตรวจสอบ CacheService ว่าทำงานได้
3. กด Manual refresh ดูว่าได้ผลไหม

### รูปลอยชนกัน

ปรับค่า `position` ให้ไม่ซ้ำกัน:

```javascript
const posX = Math.random() * 80 + 10; // 10% - 90%
const posY = Math.random() * 70 + 15; // 15% - 85%
```

## 📱 Mobile Support

หน้าแสดงผลนี้ responsive แต่เหมาะสำหรับ:
- Desktop (1920x1080 หรือสูงกว่า)
- TV Display
- Projector

## 🚀 Performance Tips

1. **Caching**: ใช้ CacheService เพื่อลด load ใน spreadsheet
2. **Lazy Loading**: โหลดรูปเมื่อจำเป็น
3. **Debouncing**: หลีกเลี่ยง request ซ้ำซ้อน
4. **CDN**: ใช้ CDN สำหรับ static assets

## 📝 TODO (Optional Enhancements)

- [ ] เพิ่ม sound effect เมื่อมีคนเช็คอิน
- [ ] เพิ่ม leaderboard/top participants
- [ ] เพิ่ม countdown timer สำหรับ activity
- [ ] เพิ่ม photo slideshow ของ participants
- [ ] เพิ่ม real-time chat/discussion
- [ ] เพิ่ม gamification (points, badges)
- [ ] เพิ่ม photo booth feature

## 📞 การติดต่อ

หากมีปัญหาหรือข้อสงสัย:
1. ตรวจสอบ Console Log (F12)
2. ตรวจสอบ Google Apps Script execution log
3. ดูคู่มือใน `display-integration.html`

## 📄 License

ส่วนหนึ่งของ SCORDS Project

---

**สร้างด้วย ❤️ สำหรับทีม PTG SCORDS**
