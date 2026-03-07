# 🧪 วิธีการทดสอบ SCORDS Backend (Google Apps Script)

## 📋 ขั้นตอนการทดสอบ

### 1. ทดสอบใน Apps Script Editor (ก่อน Deploy)

เปิด Google Apps Script Editor → เลือกฟังก์ชัน → คลิก **Run**

#### ทดสอบฟังก์ชันพื้นฐาน

```javascript
// 1. ทดสอบ setup
function test_setup() {
  setupScriptProperties();
  console.log("✅ Setup test passed!");
}

// 2. ทดสอบการเชื่อมต่อ Google Sheets
function test_sheetsConnection() {
  const ss = SpreadsheetApp.openById("1nvNFkeUUU7tTnTlE0UkKt0tZqxYe4fxOI7crTtiEsrM");
  const users = getSheetData(ss.getSheetByName("Users"));
  console.log("✅ Users found: " + users.length);
  console.log("First user: " + JSON.stringify(users[0] || "No users yet"));
}

// 3. ทดสอบ Dashboard
function test_dashboard() {
  const result = getDashboardData("all", null, true);
  console.log("✅ Dashboard data:");
  console.log(JSON.stringify(result, null, 2));
}

// 4. ทดสอบ Leaderboard
function test_leaderboard() {
  const result = getLeaderboard("7");
  console.log("✅ Leaderboard (Top 10):");
  console.log(JSON.stringify(result, null, 2));
}

// 5. ทดสอบ Points Leaderboard
function test_pointsLeaderboard() {
  const result = getPointsLeaderboard();
  console.log("✅ Points Leaderboard:");
  console.log(JSON.stringify(result, null, 2));
}
```

**วิธีรัน:**
1. วางฟังก์ชันทดสอบใน Code.gs
2. เลือกฟังก์ชันจาก dropdown (เช่น `test_dashboard`)
3. คลิก **Run** → ดูผลลัพธ์ใน **Execution Log**

---

### 2. ทดสอบผ่าน Web App URL (หลัง Deploy)

หลังจาก Deploy แล้ว จะได้ URL เช่น:
```
https://script.google.com/macros/s/AKfycbx.../exec
```

#### ทดสอบ GET Requests

**เปิดใน Browser หรือใช้ curl:**

```bash
# 1. ทดสอบ API Status
curl "https://script.google.com/macros/s/AKfycbx.../exec"

# 2. ทดสอบ Dashboard
curl "https://script.google.com/macros/s/AKfycbx.../exec?action=getDashboard&group=all"

# 3. ทดสอบ Leaderboard (7 วันล่าสุด)
curl "https://script.google.com/macros/s/AKfycbx.../exec?action=getLeaderboard&days=7"

# 4. ทดสอบ Points Leaderboard
curl "https://script.google.com/macros/s/AKfycbx.../exec?action=getPointsLeaderboard"

# 5. ทดสอบ QR Generation History
curl "https://script.google.com/macros/s/AKfycbx.../exec?action=getQRGenerationHistory"

# 6. ทดสอบ User Points (แทนที่ USER_ID)
curl "https://script.google.com/macros/s/AKfycbx.../exec?action=getUserPoints&userId=USER_ID"
```

**ผลลัพธ์ที่ควรได้:**
```json
{
  "success": true,
  "data": {
    "checkedIn": 0,
    "total": 0,
    "onTime": 0,
    "late": 0,
    "absent": 0,
    "recentActivity": []
  }
}
```

#### ทดสอบ POST Requests

**ใช้ curl หรือ Postman:**

```bash
# 1. ทดสอบ Register User
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "action": "registerUser",
    "userId": "test_user_001",
    "displayName": "Test User",
    "firstName": "Test",
    "lastName": "User",
    "employeeId": "EMP001",
    "position": "Developer",
    "group": "IT",
    "pictureUrl": "https://example.com/photo.jpg"
  }' \
  "https://script.google.com/macros/s/AKfycbx.../exec"

# 2. ทดสอบ AI Assistant (ต้องมี API Key ก่อน)
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "action": "askAI",
    "query": "SCOR คืออะไร",
    "context": {
      "userId": "test_user_001",
      "group": "IT"
    },
    "provider": "zai"
  }' \
  "https://script.google.com/macros/s/AKfycbx.../exec"

# 3. ทดสอบ Add Game Points
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "action": "addGamePoints",
    "userId": "test_user_001",
    "activity": "เล่นเกมสล็อต",
    "points": 10,
    "displayName": "Test User"
  }' \
  "https://script.google.com/macros/s/AKfycbx.../exec"
```

---

### 3. ทดสอบ AI Assistant (ต้อง setup API Keys ก่อน)

#### เตรียมข้อมูลใน Google Sheets

**สร้าง Sheet "SCOR_Knowledge" พร้อมข้อมูล:**

| Category | Topic | Question | Answer | Keywords | Priority |
|----------|-------|----------|--------|----------|----------|
| SCOR | Overview | SCOR คืออะไร | SCOR (Supply Chain Operations Reference) คือเฟรมเวิร์กสากลสำหรับจัดการซัพพลายเชน | SCOR, supply chain, เฟรมเวิร์ก | High |
| Points | Rules | ได้แต้มอย่างไร | คุณสามารถได้แต้มจากการเช็คชื่อตรงเวลา, เล่นเกม, และสแกน QR Code | แต้ม, คะแนน, ได้แต้ม | Medium |

#### ทดสอบ AI ด้วย Postman

**Request:**
```json
POST https://script.google.com/macros/s/AKfycbx.../exec

{
  "action": "askAI",
  "query": "ได้แต้มอย่างไร",
  "context": {
    "userId": "test_user_001",
    "group": "IT",
    "role": "user"
  },
  "provider": "zai"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "answer": "🎯 คุณสามารถสะสมแต้มได้หลายวิธีครับ:\n\n✨ เช็คชื่อตรงเวลา: 10 แต้ม\n🎮 เล่นเกมต่างๆ\n📱 สแกน QR Code รับแต้ม",
    "sources": [
      "Points_Rules: การได้แต้ม",
      "SCOR_Knowledge: Points Rules"
    ],
    "cost": 0.000014,
    "costTHB": 0.0005,
    "model": "glm-5 (z.ai)",
    "fallback": null
  }
}
```

---

### 4. ทดสอบจาก Frontend (JavaScript)

**สร้างไฟล์ test.html:**

```html
<!DOCTYPE html>
<html>
<head>
  <title>SCORDS API Test</title>
</head>
<body>
  <h1>🧪 SCORDS API Test</h1>
  <div id="results"></div>

  <script>
    const API_URL = "https://script.google.com/macros/s/AKfycbx.../exec";

    async function testAPI() {
      const results = document.getElementById('results');

      // Test 1: Get Dashboard
      try {
        const response = await fetch(`${API_URL}?action=getDashboard&group=all`);
        const data = await response.json();
        results.innerHTML += `<h3>✅ Dashboard</h3><pre>${JSON.stringify(data, null, 2)}</pre>`;
      } catch (error) {
        results.innerHTML += `<h3>❌ Dashboard Error</h3><p>${error.message}</p>`;
      }

      // Test 2: Get Leaderboard
      try {
        const response = await fetch(`${API_URL}?action=getLeaderboard&days=7`);
        const data = await response.json();
        results.innerHTML += `<h3>✅ Leaderboard</h3><pre>${JSON.stringify(data, null, 2)}</pre>`;
      } catch (error) {
        results.innerHTML += `<h3>❌ Leaderboard Error</h3><p>${error.message}</p>`;
      }

      // Test 3: Register User (POST)
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          mode: 'no-cors', // GAS requires this
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'registerUser',
            userId: 'test_' + Date.now(),
            displayName: 'Test User',
            firstName: 'Test',
            lastName: 'User',
            employeeId: 'TEST001',
            position: 'Tester',
            group: 'IT'
          })
        });
        results.innerHTML += `<h3>✅ Register User Sent</h3>`;
      } catch (error) {
        results.innerHTML += `<h3>❌ Register Error</h3><p>${error.message}</p>`;
      }
    }

    // Run tests on page load
    testAPI();
  </script>
</body>
</html>
```

---

### 5. ทดสอบ GPS Check-in (ต้องมี Activity)

#### เตรียมข้อมูล Activity

**สร้าง Sheet "Activities" พร้อมข้อมูล:**

| ID | Name | Date | StartTime | EndTime | QRCode | Latitude | Longitude | Radius | Status |
|----|------|------|-----------|---------|--------|----------|-----------|--------|--------|
| ACT001 | พบประจำเดือน | 2026-03-07 | 08:00 | 09:00 | 12345 | 13.7563 | 100.5018 | 100 | Active |

> 📍 **Latitude/Longitude:** ใส่พิกัดของสถานที่จริง
>
> **Radius:** รัศมีในเมตร (เช่น 100 เมตร)

#### ทดสอบ Check-in

```javascript
// ใน Console Browser หรือ Script
fetch("https://script.google.com/macros/s/AKfycbx.../exec", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    action: "checkIn",
    userId: "test_user_001",
    displayName: "Test User",
    activityId: "ACT001",
    qrCode: "12345",
    timestamp: new Date().toISOString(),
    latitude: 13.7563,  // พิกัดจริงของคุณ
    longitude: 100.5018
  })
})
.then(r => r.json())
.then(data => console.log("Check-in result:", data));
```

---

## ✅ Checklist การทดสอบ

### ขั้นตอนก่อน Deploy
- [ ] รัน `test_sheetsConnection()` - เชื่อมต่อ Sheets ได้
- [ ] รัน `test_dashboard()` - ดึงข้อมูล Dashboard ได้
- [ ] รัน `test_leaderboard()` - ดึง Leaderboard ได้
- [ ] รัน `setupScriptProperties()` - ตั้งค่า Properties ครบ

### ขั้นตอนหลัง Deploy
- [ ] GET `/` - API ตอบสนอง
- [ ] GET `?action=getDashboard&group=all` - ได้ข้อมูล Dashboard
- [ ] GET `?action=getLeaderboard&days=7` - ได้ Leaderboard
- [ ] POST `registerUser` - ลงทะเบียนผู้ใช้ได้
- [ ] POST `addGamePoints` - เพิ่มแต้มได้

### ทดสอบ AI (ต้องมี API Keys)
- [ ] ตั้งค่า ZAI_API_KEY หรือ OPENAI_API_KEY
- [ ] เพิ่มข้อมูลใน SCOR_Knowledge sheet
- [ ] POST `askAI` - AI ตอบคำถามได้
- [ ] Check sources ใน response - ค้นหาจาก Sheets ได้

---

## 🔧 Troubleshooting

### ❌ Error: "You do not have permission"
**วิธีแก้:**
- Deploy ใหม่ → "Who has access" = **"Anyone"**

### ❌ Error: "ScriptFunction not found"
**วิธีแก้:**
- บันทึกไฟล์ (Ctrl+S)
- Deploy ใหม่

### ❌ Error: "ZAI_API_KEY not found"
**วิธีแก้:**
- รัน `setupScriptProperties()` อีกครั้ง
- ใส่ API Key จริง

### ❌ Error: "SCOR_Knowledge sheet not found"
**วิธีแก้:**
- สร้าง Sheet "SCOR_Knowledge" ใน Google Sheets

### ❌ CORS Error (จาก Frontend)
**วิธีแก้:**
```javascript
// ใช้ mode: 'no-cors' สำหรับ Google Apps Script
fetch(API_URL, {
  method: 'POST',
  mode: 'no-cors',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});
```

---

## 📊 Performance Testing

### ทดสอบความเร็ว

```javascript
// วัดเวลาตอบสนอง
console.time('API Response');
fetch(`${API_URL}?action=getDashboard&group=all`)
  .then(r => r.json())
  .then(data => {
    console.timeEnd('API Response');
    console.log('Data:', data);
  });
```

### Quota Limits

| Resource | Limit |
|----------|-------|
| Requests/day | 20,000 |
| Execution time | 6 minutes/request |
| Total execution time/day | 90 minutes |

---

## 🎯 Next Steps

หลังจากทดสอบผ่านหมด:

1. ✅ เชื่อมต่อกับ LINE LIFF / Frontend
2. ✅ เพิ่มข้อมูล Users จริง
3. ✅ สร้าง Activities พร้อม QR Codes
4. ✅ Upload PDF documents ลง Drive folder
5. ✅ เพิ่ม SCOR Knowledge ใน Sheets
6. ✅ ติดตั้งใน Production

---

🎉 **ขอให้ทดสอบสนุกครับ!**
