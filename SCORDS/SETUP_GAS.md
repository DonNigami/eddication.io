# 🚀 วิธีการ Setup SCORDS Backend (Google Apps Script)

## ✅ ที่คุณทำแล้ว
- ✅ สร้าง Google Sheets พร้อม sheets ทั้งหมด
- ✅ สร้าง Google Apps Script project
- ✅ Copy โค้ดจาก `Code.gs` ไปวางแล้ว
- ✅ Drive Folder ID: `1qvA0sMG024kezPynLHidvpCFUtkj-TjS`

## 📝 ขั้นตอนที่เหลือ

### 1. ตั้งค่า ScriptProperties

เปิด Google Apps Script Editor แล้วรันฟังก์ชันนี้:

```javascript
function setupScriptProperties() {
  // Z.AI API Key (หลัก - ถูกกว่า OpenAI)
  // รับจาก: https://z.ai/
  ScriptProperties.setProperty("ZAI_API_KEY", "your-zai-api-key-here");

  // OpenAI API Key (สำรอง)
  // รับจาก: https://platform.openai.com/api-keys
  ScriptProperties.setProperty("OPENAI_API_KEY", "your-openai-api-key-here");

  // Google Drive Folder ID สำหรับเก็บ PDF documents
  // Folder URL: https://drive.google.com/drive/folders/1qvA0sMG024kezPynLHidvpCFUtkj-TjS
  ScriptProperties.setProperty("PDF_FOLDER_ID", "1qvA0sMG024kezPynLHidvpCFUtkj-TjS");

  console.log("✅ Script Properties setup complete!");
  console.log("PDF Folder ID: " + ScriptProperties.getProperty("PDF_FOLDER_ID"));
  console.log("ZAI API Key: " + (ScriptProperties.getProperty("ZAI_API_KEY") ? "✅ Set" : "❌ Not set"));
  console.log("OpenAI API Key: " + (ScriptProperties.getProperty("OPENAI_API_KEY") ? "✅ Set" : "❌ Not set"));
}
```

**วิธีรัน:**
1. ใน Apps Script Editor เลือกฟังก์ชัน `setupScriptProperties` จาก dropdown
2. คลิก **"Run"** หรือกด `Ctrl + Enter`
3. อนุญาต permissions ที่ถาม (Review permissions → Allow)
4. ดูผลลัพธ์ใน **Execution Log**

### 2. รับ API Keys

#### Z.AI API (แนะนำ - ถูกกว่า)
1. ไปที่ [https://z.ai/](https://z.ai/)
2. ลงทะเบียน / ล็อกอิน
3. ไปที่ Settings → API Keys
4. สร้าง API Key ใหม่
5. Copy และแทนที่ `"your-zai-api-key-here"`

#### OpenAI API (สำรอง - ถ้า Z.AI ไม่ทำงาน)
1. ไปที่ [https://platform.openai.com/](https://platform.openai.com/)
2. ล็อกอิน
3. ไปที่ API Keys → Create new secret key
4. Copy และแทนที่ `"your-openai-api-key-here"`

### 3. ตรวจสอบ ScriptProperties

หลังจากรัน `setupScriptProperties()` แล้ว ตรวจสอบว่าตั้งค่าถูกต้อง:

```javascript
function checkScriptProperties() {
  console.log("=== Script Properties Check ===");
  console.log("PDF Folder ID: " + ScriptProperties.getProperty("PDF_FOLDER_ID"));
  console.log("ZAI API Key: " + (ScriptProperties.getProperty("ZAI_API_KEY") ? "✅ Set" : "❌ Not set"));
  console.log("OpenAI API Key: " + (ScriptProperties.getProperty("OPENAI_API_KEY") ? "✅ Set" : "❌ Not set"));
}
```

### 4. Deploy เป็น Web App

1. คลิก **"Deploy"** → **"New deployment"**
2. ตั้งค่าตามนี้:
   - **Description**: `SCORDS Backend v1`
   - **Execute as**: `Me` (อีเมล Google ของคุณ)
   - **Who has access**: `Anyone` ⭐️ (สำคัญ!)
3. คลิก **"Deploy"**
4. **Authorize access** ถ้าถาม → คลิก **"Access"** → **"Allow"**
5. **Copy Web App URL** เช่น:
   ```
   https://script.google.com/macros/s/AKfycbx.../exec
   ```

### 5. อัปเดต Frontend Configuration

อัปเดต URL ในไฟล์ frontend:

```javascript
// ใน config.js หรือไฟล์ที่เกี่ยวข้อง
const CONFIG = {
  GAS_API_URL: "https://script.google.com/macros/s/AKfycbx.../exec",

  // หรือถ้าใช้ environment variable
  VITE_GAS_API_URL: "https://script.google.com/macros/s/AKfycbx.../exec"
};
```

### 6. ทดสอบ API

ทดสอบด้วย curl หรือ Browser:

```bash
# Test GET request (Browser ก็ได้)
curl "https://script.google.com/macros/s/AKfycbx.../exec?action=getDashboard&group=all"

# หรือเปิดใน Browser
https://script.google.com/macros/s/AKfycbx.../exec?action=getDashboard&group=all
```

ผลลัพธ์ที่ควรได้:
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

---

## 🔧 Troubleshooting

### ❌ Error: "ScriptFunction not found"
**วิธีแก้:**
- บันทึกไฟล์ก่อน (Ctrl+S)
- รันฟังก์ชันใหม่

### ❌ Error: "You do not have permission"
**วิธีแก้:**
- Deploy ใหม่ด้วย "Who has access" = **"Anyone"**
- ไม่ใช่ "Anyone with Google Account"

### ❌ Error: "ZAI_API_KEY not found"
**วิธีแก้:**
1. รัน `setupScriptProperties()` อีกครั้ง
2. แทนที่ `"your-zai-api-key-here"` ด้วย key จริง
3. รัน `checkScriptProperties()` เพื่อตรวจสอบ

### ❌ Error: "PDF_FOLDER_ID not found"
**วิธีแก้:**
- ตรวจสอบว่า Drive Folder ID ถูกต้อง: `1qvA0sMG024kezPynLHidvpCFUtkj-TjS`
- ลองเปิด URL: https://drive.google.com/drive/folders/1qvA0sMG024kezPynLHidvpCFUtkj-TjS

### ❌ Performance ช้า / Time out
**วิธีแก้:**
- ใช้ "Anyone" แทน "Anyone with Google Account"
- ลดจำนวนข้อมูลที่ดึง (limit parameter)
- พิจารณา migrate ไป Supabase ถ้าข้อมูลเยอะ

---

## 📊 โครงสร้าง Google Sheets

ตรวจสอบว่ามี sheets ทั้งหมดนี้:

| Sheet Name | Columns |
|------------|---------|
| `Users` | UserID, DisplayName, FirstName, LastName, EmployeeID, Position, Group, Role, ProfilePicture, CreatedAt |
| `Activities` | ID, Name, Date, StartTime, EndTime, QRCode, Latitude, Longitude, Radius, Status |
| `Checkin_Log` | Timestamp, UserID, DisplayName, Group, ActivityID, Status |
| `Groups` | GroupName |
| `Points` | UserID, Points, UpdatedAt |
| `Points_History` | Timestamp, UserID, UserName, Points, Activity, QRCodeData |
| `QR_Generation_History` | Timestamp, AdminID, AdminName, Points, Note, Uses, QRCodeData, RedeemedCount |
| `SCOR_Knowledge` | Category, Topic, Question, Answer, Keywords, Priority |
| `Points_Rules` | RuleType, Description, Points, MaxDaily, Conditions |

---

## 🎯 Next Steps

หลังจาก deploy สำเร็จ:

1. ✅ เพิ่มข้อมูล Users ใน Sheets
2. ✅ สร้าง Activities พร้อม QR Codes
3. ✅ Upload PDF documents ลงใน Drive folder
4. ✅ เพิ่ม SCOR Knowledge ใน SCOR_Knowledge sheet
5. ✅ ทดสอบ AI Assistant ด้วย `askAI` action
6. ✅ เชื่อมต่อกับ LINE LIFF / Frontend

---

## 💡 Tips

- **Quota**: Google Apps Script ฟรี 20,000 requests/day
- **Execution Time**: จำกัด 6 นาทีต่อ request
- **Best Practice**: Cache ข้อมูลใน frontend ลดการเรียก API
- **AI Costs**: Z.AI ถูกกว่า OpenAI มาก (สำหรับภาษาไทย)

---

## 📞 ติดปัญหา?

ติดต่อได้ที่:
- ตรวจสอบ Execution Log ใน Apps Script Editor
- ดู Deployments ว่า URL ถูกต้องไหม
- Test แต่ละ API endpoint แยกก่อน

🎉 **ขอให้โชคดีกับการ deploy SCORDS ครับ!**
