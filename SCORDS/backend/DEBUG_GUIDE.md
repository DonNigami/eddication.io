# LINE Bot Debug Guide

## 📋 ภาพรวม

วิธีการ debug LINE Bot ด้วย logging ที่เพิ่มขึ้น

---

## 🔍 การดู Logs

### 1. Google Apps Script Executions Log

1. เปิด Google Apps Script project
2. คลิก **Executions** ที่เมนูด้านซ้าย
3. จะเห็นรายการ executions ล่าสุด
4. คลิกที่ execution ที่ต้องการดู
5. จะเห็น logs แบบละเอียด

### 2. Real-time Logging

ถ้าต้องการดู logs แบบ real-time:
1. เปิด Google Apps Script project
2. คลิก **Edit** > **Current project's triggers**
3. หรือดูใน **Executions** หลังจากส่งข้อความ

---

## 📊 Log Tags และความหมาย

### Webhook Logs
```
📱 [WEBHOOK] LINE Message Received
📱 [WEBHOOK] User ID: xxx
📱 [WEBHOOK] Message: "xxx"
📱 [WEBHOOK] Quote Token: YES/NO
📱 [WEBHOOK] Chat ID: xxx
📱 [WEBHOOK] Source Type: GROUP/ROOM/USER
```

**ความหมาย:**
- User ID: ไอดีผู้ใช้ LINE
- Message: ข้อความที่ส่งมา
- Quote Token: มี quote token หรือไม่
- Chat ID: ไอดีแชท (สำหรับ loading animation)
- Source Type: ประเภทของแชท (1-on-1, Group, Room)

### Process Logs
```
🔍 [PROCESS] Starting message processing...
👤 [USER INFO]: { name, group, role } หรือ 'Not registered'
🔍 [COMMAND] Checking for special commands: "xxx"
```

**ความหมาย:**
- แสดงว่ากำลังประมวลผลข้อความ
- แสดงข้อมูลผู้ใช้ (ถ้าลงทะเบียนแล้ว)
- แสดงคำสั่งที่ตรวจสอบ

### Command Logs
```
✅ [COMMAND] Status command detected
📊 [STATUS] User points: 150
```
```
✅ [COMMAND] Help command detected
```

**ความหมาย:**
- แสดงว่าตรวจพบคำสั่งพิเศษ
- แสดงข้อมูลที่เกี่ยวข้องกับคำสั่งนั้นๆ

### AI Chat Logs
```
🤖 [AI] AI chat requested
🤖 [AI] User: xxx
🤖 [AI] Query: "xxx"
⏳ [AI] Starting loading animation...
🔄 [LOADING] Starting loading animation for chat: xxx
✅ [LOADING] Loading animation started successfully
🤖 [AI] Sending request to AI API...
🤖 [AI] AI API response: SUCCESS/FAILED
✅ [AI] AI response received
💰 [AI] Cost: $0.0023 USD
📊 [AI] Model: gemini-1.5-flash (google)
💬 [AI] Sending reply with quote...
✅ [AI] AI chat completed successfully
```

**ความหมาย:**
- แสดงขั้นตอนการทำงานของ AI Chat
- Loading animation ถูกเริ่มต้นหรือไม่
- AI API response: สำเร็จหรือล้มเหลว
- Cost: ค่าใช้จ่าย
- Model: โมเดลที่ใช้

### Loading Animation Logs
```
🔄 [LOADING] Starting loading animation for chat: xxx
✅ [LOADING] Token found, preparing request...
📤 [LOADING] Request URL: https://api.line.me/v2/bot/chat/loading/start
📤 [LOADING] Payload: {"chatId":"xxx","loadingSeconds":20}
📥 [LOADING] Response Code: 200
📥 [LOADING] Response Body: {}
✅ [LOADING] Loading animation started successfully
```

**ความหมาย:**
- แสดง request ที่ส่งไป LINE API
- Response code: 200 = สำเร็จ
- Response body: ข้อมูลที่ LINE ตอบกลับ

### Reply Logs
```
💬 [REPLY] Sending reply...
💬 [REPLY] Message length: 250 chars
💬 [REPLY] Quote token: YES/NO
💬 [REPLY] Reply token: xxx...
✅ [REPLY] Token found, preparing request...
✅ [REPLY] Quote token added: xxx... (ถ้ามี)
⚠️ [REPLY] No quote token provided (this is OK for follow events) (ถ้าไม่มี)
📤 [REPLY] Request URL: https://api.line.me/v2/bot/message/reply
📤 [REPLY] Payload: {...}
📥 [REPLY] Response Code: 200
📥 [REPLY] Response Body: {}
✅ [REPLY] Reply sent successfully!
```

**ความหมาย:**
- แสดงการส่งข้อความตอบกลับ
- Message length: ความยาวข้อความ
- Quote token: มี quote token หรือไม่
- Response code: 200 = สำเร็จ

### Error Logs
```
❌ [ERROR] Error handling LINE message
❌ [ERROR] Message: xxx
❌ [ERROR] Stack: xxx
```
```
❌ [LOADING] LINE_CHANNEL_ACCESS_TOKEN not configured
```
```
❌ [REPLY] Failed with code 400: {"message":"Invalid reply token"}
```

**ความหมาย:**
- แสดง error ที่เกิดขึ้น
- Message: ข้อความ error
- Stack: stack trace สำหรับ debug

---

## 🐛 ปัญหาที่พบบ่อย

### 1. Loading Animation ไม่แสดง

**Logs ที่ควรเห็น:**
```
🔄 [LOADING] Starting loading animation for chat: xxx
📥 [LOADING] Response Code: 400
📥 [LOADING] Response Body: {"message":"Invalid chat ID"}
```

**สาเหตุ:**
- Chat ID ไม่ถูกต้อง
- Webhook URL ไม่ถูกต้อง

**วิธีแก้:**
1. ตรวจสอบว่า Webhook URL ถูกต้อง
2. ตรวจสอบว่า Deploy เป็น "Anyone"
3. ลอง deploy ใหม่

### 2. Quote ไม่แสดง

**Logs ที่ควรเห็น:**
```
📱 [WEBHOOK] Quote Token: NO
⚠️ [REPLY] No quote token provided (this is OK for follow events)
```

**สาเหตุ:**
- LINE ไม่ส่ง quoteToken มากับ webhook event
- ปกติจะเกิดในบางกรณี (เช่น ทดสอบผ่าน LINE Developers Console)

**วิธีแก้:**
1. ทดสอบจาก LINE app จริง (ไม่ใช่จาก console)
2. ตรวจสอบว่า LINE Messaging API version เป็นล่าสุด

### 3. AI ไม่ตอบ

**Logs ที่ควรเห็น:**
```
🤖 [AI] Sending request to AI API...
❌ [AI] AI API response: FAILED
❌ [AI] Error: All AI providers failed
```

**สาเหตุ:**
- ไม่มี AI API Key
- AI API Key ผิด
- AI provider ล้มเหลวทั้งหมด

**วิธีแก้:**
1. ตรวจสอบ Script Properties
2. รัน `setupScriptProperties()`
3. ทดสอบ AI ด้วย `test_askAI()`

### 4. Webhook ไม่ทำงาน

**Logs ที่ควรเห็น:**
```
ไม่มี logs เลย
```

**สาเหตุ:**
- Webhook URL ไม่ถูกต้อง
- LINE Developers Console ไม่ได้ตั้งค่า Webhook

**วิธีแก้:**
1. ตรวจสอบ Webhook URL ใน LINE Developers Console
2. คลิก "Verify" เพื่อยืนยัน Webhook
3. ตรวจสอบว่า "Use webhook" เปิดอยู่

### 5. Error: Invalid reply token

**Logs ที่ควรเห็น:**
```
📥 [REPLY] Response Code: 400
📥 [REPLY] Response Body: {"message":"Invalid reply token"}
```

**สาเหตุ:**
- Reply token หมดอายุ
- ใช้ reply token ซ้ำ

**วิธีแก้:**
1. ตรวจสอบว่าเรียก `sendLineReplyDirect()` แค่ครั้งเดียวต่อ event
2. ตรวจสอบว่าไม่มีการเรียกซ้ำ

---

## 🧪 การทดสอบ

### 1. ทดสอบ Loading Animation

ส่งข้อความ: `SCOR คืออะไร?`

**Logs ที่ควรเห็น:**
```
🔄 [LOADING] Starting loading animation for chat: xxx
✅ [LOADING] Loading animation started successfully
```

**ใน LINE:**
- ควรเห็น animation "..." ปรากฏขึ้น

### 2. ทดสอบ Quote Reply

ส่งข้อความ: `test`

**Logs ที่ควรเห็น:**
```
📱 [WEBHOOK] Quote Token: YES - xxx...
💬 [REPLY] Quote token: YES
✅ [REPLY] Quote token added: xxx...
```

**ใน LINE:**
- ข้อความตอบกลับควรอ้างอิงข้อความต้นทาง

### 3. ทดสอบ AI Chat

ส่งข้อความ: `SCOR คืออะไร?`

**Logs ที่ควรเห็น:**
```
🤖 [AI] AI chat requested
⏳ [AI] Starting loading animation...
✅ [AI] AI chat completed successfully
💰 [AI] Cost: $0.0023 USD
📊 [AI] Model: gemini-1.5-flash (google)
```

**ใน LINE:**
- ควรเห็น loading → AI ตอบ

---

## 📱 การทดสอบผ่าน LINE App

### 1. เพิ่ม LINE Official Account เป็นเพื่อน

1. เปิด LINE บนมือถือ
2. แอด LINE Official Account ของคุณ
3. รอสักครู่ให้ระบบอัปเดต

### 2. ส่งข้อความทดสอบ

```
help
```

ควรได้รับตอบกลับพร้อมเมนูคำสั่ง

### 3. ทดสอบ AI Chat

```
SCOR คืออะไร?
```

ควรได้รับ:
- Loading animation
- คำตอบจาก AI
- Quote ข้อความต้นทาง

---

## 🔧 การแก้ไขปัญหา

### 1. Deploy Code ใหม่

1. เปิด Google Apps Script project
2. **Deploy** > **Manage deployments**
3. เลือก deployment ที่ใช้อยู่
4. คลิก **Edit**
5. เลือก **New version**
6. คลิก **Deploy**

### 2. ตรวจสอบ Script Properties

1. **Files** > **Project properties** > **Script properties**
2. ตรวจสอบว่ามี:
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `GEMINI_API_KEY` (หรือ AI provider อื่นๆ)

### 3. ตรวจสอบ Webhook URL

1. ไปที่ [LINE Developers Console](https://developers.line.biz/console/)
2. เลือก Channel ของคุณ
3. **Messaging API** > **Webhook settings**
4. ตรวจสอบ Webhook URL
5. คลิก **Verify**

---

## 📊 ตัวอย่าง Logs แบบเต็ม

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 [WEBHOOK] LINE Message Received
📱 [WEBHOOK] User ID: U1234567890
📱 [WEBHOOK] Message: "SCOR คืออะไร?"
📱 [WEBHOOK] Quote Token: YES - abc123...
📱 [WEBHOOK] Chat ID: U1234567890
📱 [WEBHOOK] Source Type: USER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 [PROCESS] Starting message processing...
👤 [USER INFO]: { name: "สมชาย ใจดี", group: "IT", role: "user" }
🔍 [COMMAND] Checking for special commands: "scor คืออะไร?"
🤖 [AI] AI chat requested
🤖 [AI] User: U1234567890
🤖 [AI] Query: "SCOR คืออะไร?"
⏳ [AI] Starting loading animation...
🔄 [LOADING] Starting loading animation for chat: U1234567890
✅ [LOADING] Token found, preparing request...
📤 [LOADING] Request URL: https://api.line.me/v2/bot/chat/loading/start
📤 [LOADING] Payload: {"chatId":"U1234567890","loadingSeconds":20}
📥 [LOADING] Response Code: 200
📥 [LOADING] Response Body: {}
✅ [LOADING] Loading animation started successfully
⏳ [AI] Loading animation result: SUCCESS
🤖 [AI] Sending request to AI API...
🤖 [AI] AI API response: SUCCESS
✅ [AI] AI response received
💰 [AI] Cost: $0.0023 USD
📊 [AI] Model: gemini-1.5-flash (google)
💬 [AI] Sending reply with quote...
💬 [REPLY] Sending reply...
💬 [REPLY] Message length: 450 chars
💬 [REPLY] Quote token: YES
💬 [REPLY] Reply token: xyz789...
✅ [REPLY] Token found, preparing request...
✅ [REPLY] Quote token added: abc123...
📤 [REPLY] Request URL: https://api.line.me/v2/bot/message/reply
📤 [REPLY] Payload: {...}
📥 [REPLY] Response Code: 200
📥 [REPLY] Response Body: {}
✅ [REPLY] Reply sent successfully!
✅ [AI] AI chat completed successfully
```

---

## 💡 Tips

1. **ดู logs ทุกครั้ง** หลังจากส่งข้อความทดสอบ
2. **เปรียบเทียบ logs** ระหว่างที่ทำงานได้และไม่ได้
3. **ตรวจสอบ response code** - 200 = สำเร็จ, อื่นๆ = ล้มเหลว
4. **ตรวจสอบ response body** - มักมีข้อความ error ที่ชัดเจน
5. **Deploy version ใหม่ทุกครั้ง** หลังจากแก้ไข code

---

## 📚 อ้างอิง

- [Google Apps Script Execution Logs](https://developers.google.com/apps-script/guides/logging)
- [LINE Messaging API Docs](https://developers.line.biz/en/reference/messaging-api/)
- [Debugging Webhooks](https://developers.line.biz/en/docs/messaging-api/receiving-messages/)
