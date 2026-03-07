# วิธีการ Deploy SCORDS Backend (Google Apps Script)

## ขั้นตอนการ Deploy

### 1. เปิด Google Apps Script Project
1. ไปที่ [script.google.com](https://script.google.com)
2. สร้าง project ใหม่หรือเปิด project ที่มีอยู่
3. วางโค้ดจาก `SCORDS/backend/Code.gs` ลงใน `Code.gs`

### 2. ตั้งค่า Script Properties
รันฟังก์ชันนี้ครั้งเดียวเพื่อตั้งค่า:

```javascript
function setupScriptProperties() {
  // Spreadsheet ID (จาก Google Sheets URL)
  // ตัวอย่าง: https://docs.google.com/spreadsheets/d/1nvNFkeUUU7tTnTlE0UkKt0tZqxYe4fxOI7crTtiEsrM/edit
  ScriptProperties.setProperty("SPREADSHEET_ID", "1nvNFkeUUU7tTnTlE0UkKt0tZqxYe4fxOI7crTtiEsrM");

  // Z.AI API Key (สำหรับ GLM-5 model - ถูกกว่า OpenAI)
  // รับจาก: https://z.ai/
  ScriptProperties.setProperty("ZAI_API_KEY", "your-zai-api-key-here");

  // OpenAI API Key (Fallback option)
  // รับจาก: https://platform.openai.com/api-keys
  ScriptProperties.setProperty("OPENAI_API_KEY", "your-openai-api-key-here");

  // Google Drive Folder ID (สำหรับเก็บ PDF documents)
  // สร้าง folder ใน Google Drive แล้ว copy ID จาก URL
  // ตัวอย่าง: https://drive.google.com/drive/folders/1ABC123xyz...
  ScriptProperties.setProperty("PDF_FOLDER_ID", "your-drive-folder-id");

  console.log("✅ Script Properties setup complete!");
}
```

วิธีรัน:
1. วางโค้ดใน `Code.gs`
2. เลือกฟังก์ชัน `setupScriptProperties` จาก dropdown
3. คลิก **"Run"**
4. อนุญาต permissions ที่ถาม

### 3. Enable Required APIs

ใน Apps Script Editor:

1. คลิก **"Services"** (+ รูปเฟือง) ที่แถบซ้าย
2. เพิ่ม services ต่อไปนี้:

| Service | ID | Version |
|---------|-------|---------|
| Google Sheets API | `Sheets` | v2 |
| Drive API | `Drive` | v2 |
| Documents API | `DocumentApp` | ในตัว (ไม่ต้องเพิ่ม) |

### 4. Deploy เป็น Web App

1. คลิก **"Deploy"** → **"New deployment"**
2. ตั้งค่า:
   - **Description**: "SCORDS Backend v1"
   - **Execute as**: "Me" (อีเมลของคุณ)
   - **Who has access**: "Anyone" (ทุกคน) หรือ "Anyone with Google Account"
3. คลิก **"Deploy"**
4. **Copy Web App URL** เช่น:
   ```
   https://script.google.com/macros/s/AKfycbx.../exec
   ```

### 5. อัปเดต Configuration ใน Frontend

อัปเดต URL ในไฟล์ frontend:

```javascript
// ใน config.js หรือไฟล์ที่เกี่ยวข้อง
const CONFIG = {
  GAS_API_URL: "https://script.google.com/macros/s/AKfycbx.../exec",
  // ... configuration อื่นๆ
};
```

### 6. ทดสอบ API

ทดสอบด้วย curl หรือ Postman:

```bash
# Test GET request
curl "https://script.google.com/macros/s/AKfycbx.../exec?action=getDashboard&group=all"

# Test POST request (ตรวจสอบสถานะ)
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"action":"checkIn", ...}' \
  "https://script.google.com/macros/s/AKfycbx.../exec"
```

---

## 🔧 Troubleshooting

### Error: "ScriptFunction not found"
- ตรวจสอบว่าชื่อฟังก์ชันถูกต้อง
- บันทึกไฟล์ (Ctrl+S) ก่อนรัน

### Error: "You do not have permission"
- Deploy ใหม่ด้วย "Who has access" = "Anyone"

### Error: "ZAI_API_KEY not found"
- รัน `setupScriptProperties()` อีกครั้ง
- ตรวจสอบ ScriptProperties ใน Project Settings

### Performance ช้า
- ใช้ "Anyone" แทน "Anyone with Google Account" (เร็วกว่า)
- พิจารณาใช้ Supabase แทน Google Sheets ถ้าข้อมูลเยอะ

---

## 📊 โครงสร้าง Google Sheets

สร้าง sheets ต่อไปนี้ใน Google Spreadsheet:

| Sheet Name | Description |
|------------|-------------|
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

## 🔐 API Keys ที่ต้องการ

### Z.AI API (แนะนำ - ถูกกว่า)
- Website: https://z.ai/
- ราคา: ~0.5 THB/M input tokens, ~2 THB/M output tokens
- Model: `glm-5` (รองรับภาษาไทยดีมาก)

### OpenAI API (สำรอง)
- Website: https://platform.openai.com/
- ราคา: ~0.15 USD/M input, ~0.60 USD/M output
- Model: `gpt-4o-mini`

---

## 📝 Notes

- **Google Apps Script Quota**: ฟรี 20,000 การเรียกต่อวัน
- **Execution Time**: จำกัด 6 นาทีต่อคำขอ
- **Best Practice**: Cache ข้อมูลใน frontend ลดการเรียก API
