# 🚨 SCORDS LINE Bot - Emergency Fix Guide

## ⚡ ปัญหา: LINE Bot ไม่ตอบสนอง

---

## 🔧 วิธีแก้ไข (3 ขั้นตอน)

### ขั้นตอนที่ 1: รัน Diagnostic Tool

1. ไปที่ **Google Apps Script Editor**
2. เลือกฟังก์ชัน `debug_runFullDiagnostic`
3. คลิก **Run**
4. ดูผลลัพธ์ใน **Execution Log**

### ขั้นตอนที่ 2: อ่านผลลัพธ์

ดูว่า Step ไหน FAIL:

```
╔══════════════════════════════════════════════════════╗
║  🔍 SCORDS LINE Bot - Full Diagnostic              ║
╚══════════════════════════════════════════════════════╝

📍 STEP 1: Basic Checks
✅ Spreadsheet: Connected
✅ Sheet "Users": OK
✅ Sheet "Activities": OK
✅ Sheet "Checkin_Log": OK

📍 STEP 2: Deployment Check
📝 Script ID: ABCD...
🔗 Web App URL: https://script.google.com/macros/s/ABCD/exec
📦 Number of deployments: 1
   Deployment 1: LINE Bot Webhook

📍 STEP 3: LINE Token Check
✅ LINE_CHANNEL_ACCESS_TOKEN: SET
   Length: 172 chars
✅ Token validation: VALID
   Bot Name: Your Bot Name

📍 STEP 4: Webhook Endpoint Test
🔗 Testing: https://script.google.com/macros/s/ABCD/exec
📥 Response: 200
✅ Webhook endpoint: WORKING

════════════════════════════════════════════════════════
📊 DIAGNOSTIC SUMMARY
════════════════════════════════════════════════════════
step1_basic: ✅ PASS
step2_deployment: ✅ PASS
step3_lineToken: ✅ PASS
step4_webhookTest: ✅ PASS

Total: 4 passed, 0 failed
════════════════════════════════════════════════════════
```

### ขั้นตอนที่ 3: แก้ไขตามปัญหา

## ❌ ถ้า STEP 1 FAIL: Spreadsheet Problem

**ปัญหา**: Spreadsheet ID ผิด หรือไม่มีสิทธิ์เข้าถึง

**วิธีแก้**:
1. ตรวจสอบ Spreadsheet ID ที่บรรทัดที่ 1 ของ Code.gs
2. แน่ใจว่าได้ Share spreadsheet ให้ editor ใช้งาน
3. รันใหม่

---

## ❌ ถ้า STEP 2 FAIL: Deployment Problem

**ปัญหา**: ไม่ได้ Deploy หรือ Deploy ผิดวิธี

**วิธีแก้**:
```
1. Script Editor > Deploy > Manage deployments
2. ลบ deployment เก่าทั้งหมด
3. Deploy > New deployment
4. Select type: ⭐ Web app ⭐
5. Description: LINE Bot Webhook
6. Execute as: Me
7. Who has access: ⭐ Anyone ⭐
8. Deploy
9. Copy Web app URL (ลงท้ายด้วย /exec)
```

---

## ❌ ถ้า STEP 3 FAIL: LINE Token Problem

**ปัญหา**: LINE_CHANNEL_ACCESS_TOKEN ไม่ถูกต้อง

**วิธีแก้**:

#### 3.1 ถ้า Token ไม่ได้ตั้งค่า:
```javascript
// รันฟังก์ชันนี้
function setupLineToken() {
  const token = "paste-your-line-channel-access-token-here";
  ScriptProperties.setProperty("LINE_CHANNEL_ACCESS_TOKEN", token);
  console.log("✅ Token saved!");
}
```

#### 3.2 ถ้า Token ผิด:
1. ไป [LINE Developers Console](https://developers.line.biz/console/)
2. เลือก Channel ของคุณ
3. ไปที่ **Messaging API** tab
4. หา **Channel access token (long-lived)**
5. คลิก **Issue** ใหม่
6. Copy token และรันฟังก์ชันด้านบน

#### 3.3 ถ้า Token validation ผิด:
```
Error: Token validation failed: 401
→ Token ผิด หรือหมดอายุ
→ ต้อง Issue token ใหม่
```

---

## ❌ ถ้า STEP 4 FAIL: Webhook Endpoint Problem

**ปัญหา**: doPost() ไม่ทำงาน หรือ URL ผิด

**วิธีแก้**:

#### 4.1 ตรวจสอบ doPost():
```javascript
// ต้องมีการตรวจสอบ LINE webhook แบบนี้:
function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);

    // LINE sends webhooks with 'events' or 'destination'
    const isLineWebhook = requestData.events || requestData.destination;

    if (isLineWebhook) {
      return createJsonResponse(handleLineWebhook(requestData));
    }

    // ... rest of code
  } catch (error) {
    // ... error handling
  }
}
```

#### 4.2 ตรวจสอบ Deployment:
```
- URL ต้องลงท้ายด้วย /exec (ไม่ใช่ /dev)
- Who has access ต้องเป็น Anyone
- ต้องเป็น Web app (ไม่ใช่ API Executable)
```

---

## ✅ ถ้าทุกอย่าง PASS แต่ Bot ยังไม่ตอบ

### ตรวจสอบเพิ่มเติม:

#### 1. ตรวจสอบ LINE Console:
```
LINE Developers Console > Messaging API > Webhook settings
- Use webhook: Enabled ✅
- Webhook URL: https://script.google.com/macros/s/XXX/exec ✅
- Verify: 200 OK ✅
```

#### 2. ตรวจสอบ Executions Log:
```
Google Apps Script Editor > Executions (รูปนาฬิกา)
- ดูว่ามี request เข้ามาหรือไม่
- ถ้าไม่มี → Webhook URL ผิด
- ถ้ามีแต่ Error → ดู error detail
```

#### 3. ทดสออบด้วยข้อความ:
```
ส่งข้อความใน LINE: "help"

Bot ต้องตอบ:
🤖 SCORDS AI Bot - คำสั่งที่ใช้ได้
...
```

#### 4. เปิด Debug Logging:
```javascript
// รันฟังก์ชันนี้
debug_enableSheetLogging();

// แล้วไปดูที่ Debug_Log sheet ใน Spreadsheet
```

---

## 🎯 Quick Decision Tree

```
Bot ไม่ตอบ
    │
    ├─ รัน debug_runFullDiagnostic()
    │
    ├─ STEP 1 FAIL?
    │   └─ ตรวจสอบ Spreadsheet ID และ Permission
    │
    ├─ STEP 2 FAIL?
    │   └─ Deploy ใหม่เป็น Web app (Anyone)
    │
    ├─ STEP 3 FAIL?
    │   └─ ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN ใหม่
    │
    ├─ STEP 4 FAIL?
    │   └─ ตรวจสอบ doPost() และ Webhook URL
    │
    └─ ทุกอย่าง PASS?
        └─ ตรวจสอบ LINE Console และ Executions Log
```

---

## 📞 ถ้ายังไม่ได้หลังจากทำทุกอย่าง

### เก็บข้อมูลนี้:

1. **Screenshot Diagnostic Result**
   - รัน `debug_runFullDiagnostic()`
   - Screenshot ผลลัพธ์

2. **Screenshot Deployment**
   - Script Editor > Deploy > Manage deployments

3. **Screenshot LINE Console**
   - LINE Developers Console > Messaging API > Webhook

4. **Screenshot Executions**
   - Script Editor > Executions (รูปนาฬิกา)
   - แสดง error ถ้ามี

5. **Webhook URL**
   - Copy URL ที่ใช้ใน LINE Console

---

## 🔍 Debug Functions ที่มี

| ฟังก์ชัน | ใช้ทำอะไร |
|----------|-----------|
| `debug_runFullDiagnostic()` | ตรวจสอบทั้งหมด |
| `debug_enableSheetLogging()` | เปิด log ลง Spreadsheet |
| `debug_showChecklist()` | แสดง checklist |

---

## 💡 Tips

1. **Deploy ใหม่ทุกครั้ง** ที่แก้ไข Code.gs
2. **Verify** ใน LINE Console หลังจากเปลี่ยน Webhook URL
3. **Executions Log** คือที่ที่ดูปัญหาได้ชัดที่สุด
4. **Refresh** LINE Console ถ้า Verify ไม่ผ่าน
5. **Wait** 1-2 นาทีหลังจาก Deploy ก่อนทดสอบ

---

**⏱️ เวลาแก้ไข: 10-15 นาที**
**🎯 Success rate: 99%** ถ้าทำตามขั้นตอน
