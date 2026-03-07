# 🤖 SCORDS LINE Bot - Debug & Troubleshooting Guide

## 📋 ปัญหา: LINE Bot ไม่ตอบสนองและ Logging ไม่ทำงาน

---

## 🔍 ตรวจสอบสิ่งต่อไปนี้ (ตามลำดับความสำคัญ)

### 1️⃣ **CRITICAL: ตรวจสอบ Webhook URL ใน LINE Developers Console**

#### ขั้นตอน:
1. ไปที่ [LINE Developers Console](https://developers.line.biz/console/)
2. เลือก Channel ของคุณ
3. ไปที่ **Messaging API** tab
4. ดูที่ **Webhook settings**

#### ต้องตรวจสอบ:
- ✅ **Use webhook**: เลือก **Enabled**
- ✅ **Webhook URL**: ต้องเป็น URL ของ Google Apps Script Web App
  - ตัวอย่าง: `https://script.google.com/macros/s/XXXXX/exec`
  - **สำคัญ**: ต้องลงท้ายด้วย `/exec` **ไม่ใช่** `/dev`

#### วิธีหา Webhook URL ของคุณ:
1. ไปที่ Google Apps Script Editor
2. คลิก **Deploy** > **New deployment**
3. เลือก **Web app**
4. Copy URL ที่ได้ (ลงท้ายด้วย `/exec`)
5. นำไปวางใน LINE Developers Console
6. คลิก **Verify** เพื่อยืนยัน

---

### 2️⃣ **CRITICAL: ตรวจสอบ LINE_CHANNEL_ACCESS_TOKEN**

#### ตรวจสอบใน Google Apps Script:
1. ไปที่ Script Editor
2. คลิก **Settings** (齿轮 icon) > **Script Properties**
3. ตรวจสอบว่ามี `LINE_CHANNEL_ACCESS_TOKEN` หรือไม่
4. ถ้าไม่มี ให้รันฟังก์ชันนี้:

```javascript
function setupScriptProperties() {
  ScriptProperties.setProperty("LINE_CHANNEL_ACCESS_TOKEN", "your-token-here");
  console.log("✅ Token saved!");
}
```

#### วิธีรับ LINE_CHANNEL_ACCESS_TOKEN:
1. ไปที่ [LINE Developers Console](https://developers.line.biz/console/)
2. เลือก Channel ของคุณ
3. ไปที่ **Messaging API** tab
4. ดูที่ **Channel access token (long-lived)**
5. คลิก **Issue** ถ้ายังไม่มี
6. Copy token และนำไปใช้

---

### 3️⃣ **CRITICAL: ตรวจสอบ Deployment Type**

#### ปัญหาที่พบบ่อย:
- ❌ Deploy เป็น **API Executable** (จะไม่ทำงานกับ LINE Webhook)
- ✅ ต้อง Deploy เป็น **Web App**

#### วิธี Deploy ใหม่:
1. ไปที่ Google Apps Script Editor
2. คลิก **Deploy** > **Manage deployments**
3. ลบ deployment เก่าทั้งหมด
4. คลิก **Deploy** > **New deployment**
5. เลือก type: **Web app** (⚠️ สำคัญมาก!)
6. Description: `LINE Bot Webhook`
7. Execute as: **Me (your-email@gmail.com)**
8. Who has access: **Anyone** (⚠️ สำคัญมาก!)

#### ⚠️ **"Who has access" ต้องเป็น "Anyone" เท่านั้น!**
ไม่เช่นนั้น LINE จะไม่สามารถส่ง webhook มาได้

---

### 4️⃣ **ตรวจสอบ doPost() ฟังก์ชัน**

#### ตรวจสอบว่า Code.gs มีฟังก์ชันนี้:

```javascript
function doPost(e) {
  try {
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;

    switch (action) {
      case "lineWebhook":
        return createJsonResponse(handleLineWebhook(requestData));
      default:
        throw new Error("Invalid action specified.");
    }
  } catch (error) {
    console.error("doPost Error: " + error.toString());
    return createJsonResponse({
      success: false,
      message: "Server Error: " + error.message
    });
  }
}
```

#### ⚠️ **ปัญหาสำคัญ**: LINE ส่ง Webhook โดยตรง ไม่ได้มี `action: "lineWebhook"`

ต้องแก้ไข `doPost()` ให้รับ LINE webhook โดยตรง:

```javascript
function doPost(e) {
  try {
    // Log ทุก request เพื่อ debugging
    console.log("=== doPost Received ===");
    console.log("postData: " + e.postData.contents);
    console.log("parameter: " + JSON.stringify(e.parameter));

    const requestData = JSON.parse(e.postData.contents);

    // ตรวจสอบว่าเป็น LINE Webhook หรือไม่
    if (requestData.events || (requestData.destination && requestData.events)) {
      console.log("📱 LINE Webhook detected!");
      return createJsonResponse(handleLineWebhook(requestData));
    }

    // Handle request อื่นๆ
    const action = requestData.action;
    if (action) {
      switch (action) {
        case "registerUser":
          return createJsonResponse(registerUser(requestData));
        case "checkIn":
          return createJsonResponse(processCheckIn(requestData));
        case "askAI":
          return createJsonResponse(askAI(requestData));
        // ... case อื่นๆ
        default:
          throw new Error("Invalid action specified.");
      }
    }

    return createJsonResponse({
      success: true,
      message: "Request received but no action specified."
    });

  } catch (error) {
    console.error("doPost Error: " + error.toString());
    console.error("Stack: " + error.stack);
    return createJsonResponse({
      success: false,
      message: "Server Error: " + error.message
    });
  }
}
```

---

### 5️⃣ **เปิดใช้งาน Logging**

#### Google Apps Script Logging:
1. ไปที่ Script Editor
2. รันฟังก์ชัน `test_lineWebhook()` (ด้านล่าง)
3. ดู log ที่ **Executions** (รูปนาฬิกา)
4. หรือดูที่ **Stackdriver Logging**:
   - คลิก **View** > **Logs** (หรือ Cmd+Enter / Ctrl+Enter)

#### เพิ่มฟังก์ชัน test webhook:
```javascript
/**
 * ทดสอบ LINE Webhook
 */
function test_lineWebhook() {
  console.log("=== Testing LINE Webhook ===");

  // ทดสอบด้วย mock data
  const mockEvent = {
    destination: "Uxxxxxxxxxxxx",
    events: [
      {
        type: "message",
        message: {
          type: "text",
          text: "test",
          quoteToken: null
        },
        replyToken: "test-reply-token",
        source: {
          userId: "test-user-id",
          type: "user"
        },
        timestamp: 1234567890
      }
    ]
  };

  const result = handleLineWebhook(mockEvent);
  console.log("Result: " + JSON.stringify(result));

  return result;
}
```

---

### 6️⃣ **ตรวจสอบ LINE Webhook Signature**

เพิ่มการตรวจสอบ security (ถ้าต้องการ):

```javascript
function doPost(e) {
  try {
    // ตรวจสอบ LINE Signature (ถ้าต้องการความปลอดภัย)
    const signature = e.parameter.signature || e.header["X-Line-Signature"];
    if (signature) {
      console.log("✅ LINE Signature present");
    } else {
      console.log("⚠️ No LINE Signature - may be in dev mode");
    }

    const requestData = JSON.parse(e.postData.contents);

    // Handle LINE Webhook
    if (requestData.events) {
      return createJsonResponse(handleLineWebhook(requestData));
    }

    // ... rest of code
  } catch (error) {
    // ... error handling
  }
}
```

---

## 🧪 การทดสอบแบบ Step-by-Step

### Step 1: ทดสอบ Script โดยตรง
```javascript
// รันใน Script Editor
function test_basicConnection() {
  const token = ScriptProperties.getProperty("LINE_CHANNEL_ACCESS_TOKEN");
  console.log("LINE Token exists: " + (token ? "YES" : "NO"));
  console.log("Token length: " + (token ? token.length : 0));

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  console.log("Spreadsheet connected: YES");

  return { token: !!token, spreadsheet: true };
}
```

### Step 2: ทดสอบ Webhook URL
1. Copy Webhook URL ของคุณ
2. ใช้ curl ทดสอบ:
```bash
curl -X POST "https://script.google.com/macros/s/XXXXX/exec" \
  -H "Content-Type: application/json" \
  -d '{"events": [], "destination": "test"}'
```

### Step 3: ทดสออบผ่าน LINE
1. ส่งข้อความใน LINE
2. ดูที่ **Executions** ใน Script Editor ทันที
3. ต้องเห็น log ปรากฏขึ้น

---

## 🎯 Quick Fix Checklist

แก้ไขตามลำดับนี้:

- [ ] **1. Deploy เป็น Web App (ไม่ใช่ API Executable)**
- [ ] **2. Who has access: Anyone (ไม่ใช่ Only myself)**
- [ ] **3. LINE Webhook URL: ต้องลงท้าย /exec**
- [ ] **4. LINE_CHANNEL_ACCESS_TOKEN: ตั้งค่าใน ScriptProperties**
- [ ] **5. doPost(): รองรับ LINE webhook โดยตรง**
- [ ] **6. Use webhook: Enabled ใน LINE Console**
- [ ] **7. Verify: กด Verify ใน LINE Console (ต้องเป็น 200 OK)**

---

## 📱 ดู Logging ที่ไหน

### 1. Google Apps Script Executions (แนะนำ)
- อยู่ใน Script Editor
- คลิกที่รูปนาฬิกา (Executions)
- จะเห็นทุกครั้งที่มีการเรียก script

### 2. Stackdriver Logging
```javascript
// เพิ่มใน code
console.log("Normal log");
console.error("Error log");
console.warn("Warning log");

// ดูที่: View > Logs (Cmd+Enter / Ctrl+Enter)
```

### 3. Spreadsheet Log (เพิ่มเติม)
```javascript
function logToSheet(message, data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const logSheet = ss.getSheetByName("Debug_Log") ||
                   ss.insertSheet("Debug_Log");

  logSheet.appendRow([
    new Date(),
    message,
    JSON.stringify(data)
  ]);
}
```

---

## 🔧 การ Deploy ใหม่ที่ถูกต้อง

### Full Step:
1. **Script Editor** > **Deploy** > **Manage deployments**
2. ลบ deployment เก่าทั้งหมด (click 3 dots > Delete)
3. **Deploy** > **New deployment**
4. Select type: **⭐ Web app ⭐**
5. Description: `LINE Bot Webhook v2`
6. Execute as: **Me (your-email@gmail.com)**
7. Who has access: **Anyone** (⚠️ สำคัญ!)
8. Click **Deploy**
9. Copy **Web app URL** (ลงท้ายด้วย `/exec`)
10. ไป LINE Console > วาง URL > **Verify**
11. เปิด **Use webhook**: **Enabled**
12. ส่งข้อความใน LINE
13. ดู log ที่ **Executions** ใน Script Editor

---

## 🆘 ถ้ายังไม่ได้

### ตรวจสอบสิทธิ์:
- [ ] คุณเป็น **Owner** ของ Script?
- [ ] LINE Channel ถูกตั้งค่าอย่างถูกต้อง?
- [� Webhook URL ถูกต้อง 100%?

### ดู error detail:
```javascript
// เพิ่มใน doPost()
function doPost(e) {
  try {
    if (!e) {
      console.error("❌ No event object!");
      return createJsonResponse({ error: "No event" });
    }

    if (!e.postData) {
      console.error("❌ No postData!");
      console.log("Full event: " + JSON.stringify(e));
      return createJsonResponse({ error: "No postData" });
    }

    // ... rest of code
  } catch (error) {
    console.error("ERROR: " + error.toString());
    console.log("Stack: " + error.stack);
    console.log("Event: " + JSON.stringify(e));
    throw error;
  }
}
```

---

## 📞 ติดต่อ/ถามเพิ่มเติม

ถ้าทำตามทุกขั้นตอนแล้วยังไม่ได้:
1. Screenshot หน้า **Deployments**
2. Screenshot หน้า **LINE Console > Webhook settings**
3. Copy log จาก **Executions**
4. แจ้งปัญหาพร้อมรายละเอียด

---

**สำคัญที่สุด**: 95% ของปัญหาคือ deployment ไม่ถูกต้อง หรือ Webhook URL ผิด!
