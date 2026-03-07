# LINE Bot - Loading Animation & Quote Reply Features

## 🎯 ภาพรวม

เพิ่มฟีเจอร์ใหม่ 2 อย่างเพื่อให้การตอบกลับของ LINE Bot ราบรื่นและเป็นมิตรมากขึ้น:

1. **Loading Animation** - แสดง animation ขณะประมวลผล AI
2. **Quote Reply** - อ้างอิงข้อความต้นทางเมื่อตอบกลับ

---

## ✨ ฟีเจอร์ใหม่

### 1. Loading Animation (`/chat/loading/start`)

เมื่อผู้ใช้ส่งข้อความ ระบบจะแสดง loading animation แบบ "is typing..." ก่อนที่ AI จะตอบ

**ข้อดี:**
- ✅ ผู้ใช้รู้ว่าระบบกำลังทำงาน
- ✅ ไม่รู้สึกว่าระบบค้าง
- ✅ ประสบการณ์การใช้งานที่ราบรื่นกว่า

**การทำงาน:**
```
User Message → Start Loading → AI Processing → Stop Loading → Reply
```

### 2. Quote Reply (`quoteToken`)

เมื่อตอบกลับ ระบบจะอ้างอิงข้อความต้นทาง (quote) เพื่อให้เห็นบริบทของการสนทนา

**ข้อดี:**
- ✅ เห็นได้ชัดว่าตอบกลับข้อความไหน
- ✅ มีบริบทของการสนทนาตลอดเวลา
- ✅ ดูเป็นมิตรและเป็นทางการมากขึ้น

**ตัวอย่าง:**
```
User: SCOR คืออะไร?

Bot: 🤖 *SCORDS AI Assistant*

SCOR (Supply Chain Operations Reference)...
```

---

## 🔧 การเปลี่ยนแปลงใน Code.gs

### ฟังก์ชันใหม่

#### 1. `sendLineLoadingStart(chatId)`

```javascript
/**
 * Send chat loading animation to LINE
 * @param {string} chatId - LINE chat ID
 * @returns {boolean} Success status
 */
function sendLineLoadingStart(chatId) {
  try {
    const channelAccessToken = ScriptProperties.getProperty("LINE_CHANNEL_ACCESS_TOKEN");

    if (!channelAccessToken) {
      console.error("LINE_CHANNEL_ACCESS_TOKEN not configured");
      return false;
    }

    const url = "https://api.line.me/v2/bot/chat/loading/start";
    const payload = {
      chatId: chatId,
      loadingSeconds: 20 // Maximum: 20 seconds
    };

    const response = UrlFetchApp.fetch(url, {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${channelAccessToken}`
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const responseCode = response.getResponseCode();

    if (responseCode === 200 || responseCode === 202) {
      console.log("✅ LINE loading animation started");
      return true;
    } else {
      console.warn(`⚠️ LINE loading start failed: ${response.getContentText()}`);
      return false;
    }
  } catch (error) {
    console.error("Error sending LINE loading: " + error.toString());
    return false;
  }
}
```

**คำอธิบาย:**
- ใช้ `POST /v2/bot/chat/loading/start` API
- ระบุ `chatId` (userId, groupId, หรือ roomId)
- ตั้งเวลา loading เป็น 20 วินาที (สูงสุด)
- Return `true` ถ้าสำเร็จ

#### 2. `sendLineReplyDirect()` - อัปเดต

**ก่อน:**
```javascript
function sendLineReplyDirect(replyToken, messageText) {
  // ...
}
```

**หลัง:**
```javascript
function sendLineReplyDirect(replyToken, messageText, quoteToken = null) {
  // ...
  const message = {
    type: "text",
    text: messageText
  };

  // Add quote token if provided
  if (quoteToken) {
    message.quoteToken = quoteToken;
  }

  const payload = {
    replyToken: replyToken,
    messages: [message]
  };
  // ...
}
```

**คำอธิบาย:**
- เพิ่ม parameter `quoteToken` (optional)
- ถ้ามี `quoteToken` จะเพิ่มลงใน message object
- ระบบ LINE จะแสดง quote อัตโนมัติ

### ฟังก์ชันที่อัปเดต

#### `handleLineMessage()`

**ก่อน:**
```javascript
const { replyToken, source, message } = event;
const userId = source?.userId;
const text = message?.text || "";

// Status command
if (lowerText === "status") {
  sendLineReplyDirect(replyToken, replyText);
  return { ... };
}

// AI Chat
const aiResponse = askAI(aiRequest);
sendLineReplyDirect(replyToken, replyText);
```

**หลัง:**
```javascript
const { replyToken, source, message } = event;
const userId = source?.userId;
const text = message?.text || "";
const quoteToken = message?.quoteToken || null;
const chatId = source?.groupId || source?.roomId || source?.userId;

// Status command
if (lowerText === "status") {
  sendLineReplyDirect(replyToken, replyText, quoteToken);
  return { ... };
}

// AI Chat - Start loading first
sendLineLoadingStart(chatId);
const aiResponse = askAI(aiRequest);
sendLineReplyDirect(replyToken, replyText, quoteToken);
```

**คำอธิบาย:**
- ดึง `quoteToken` จาก message object
- คำนวณ `chatId` (group/room/user)
- เรียก `sendLineLoadingStart()` ก่อนประมวลผล AI
- ส่ง `quoteToken` ไปกับทุกการตอบกลับ

---

## 📊 Flow การทำงาน

```
┌─────────────────────────────────────────────────────────┐
│  User sends message: "SCOR คืออะไร?"                   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  LINE Webhook → handleLineMessage()                     │
│  - Extract: replyToken, quoteToken, chatId             │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Send Loading Animation                                  │
│  POST /v2/bot/chat/loading/start                        │
│  { chatId, loadingSeconds: 20 }                         │
└─────────────────────────────────────────────────────────┘
                          ↓
        [User sees "..." animation]
                          ↓
┌─────────────────────────────────────────────────────────┐
│  AI Processing (askAI)                                   │
│  - Search knowledge base                                │
│  - Call AI API (Gemini/Z.AI/OpenAI)                     │
│  - Generate response                                    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  Send Reply with Quote                                   │
│  POST /v2/bot/message/reply                             │
│  {                                                       │
│    replyToken,                                          │
│    messages: [{                                         │
│      type: "text",                                      │
│      text: "AI Response...",                            │
│      quoteToken: "<original_message_token>"             │
│    }]                                                   │
│  }                                                      │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  User sees quoted reply                                  │
│  ┌──────────────────────────────────────┐              │
│  │ User: SCOR คืออะไร?                 │              │
│  └──────────────────────────────────────┘              │
│  Bot: 🤖 SCOR (Supply Chain Operations...)              │
└─────────────────────────────────────────────────────────┘
```

---

## 🎨 ตัวอย่างการใช้งาน

### Example 1: AI Chat with Quote

```
User: SCOR คืออะไร?
       ↓
    [Loading...]
       ↓
Bot: 🤖 *SCORDS AI Assistant*

SCOR (Supply Chain Operations Reference) เป็นกรอบงานมาตรฐาน...
```

### Example 2: Status Command with Quote

```
User: status
       ↓
Bot: 👤 สถานะของคุณ:
ชื่อ: สมชาย ใจดี
แต้มสะสม: 150 แต้ม
✅ ลงทะเบียนแล้ว
```

### Example 3: Help Menu with Quote

```
User: help
       ↓
Bot: 🤖 SCORDS AI Bot - คำสั่งที่ใช้ได้
• "status" - เช็คสถานะ
• "help" - ดูเมนู
...
```

---

## 🔍 Technical Details

### Chat ID Detection

```javascript
// Priority: Group > Room > User
const chatId = source?.groupId || source?.roomId || source?.userId;
```

**Use Cases:**
- **1-on-1 chat**: `source.userId`
- **Group chat**: `source.groupId`
- **Room chat**: `source.roomId`

### Loading Duration

```javascript
loadingSeconds: 20  // Maximum: 20 seconds
```

**หมายเหตุ:**
- 20 วินาทีเป็นค่าสูงสุดที่ LINE API อนุญาต
- ถ้า AI ประมวลผลนานกว่านี้ loading จะหายไปเอง
- แต่ข้อความตอบกลับจะยังส่งได้ปกติ

### Quote Token Lifetime

- `quoteToken` มีอายุสั้นมาก (ใช้ได้ครั้งเดียว)
- ถ้าใช้ซ้ำจะได้ error `Invalid quote token`
- ดังนั้นต้องดึงจาก webhook event ทุกครั้ง

---

## 🚀 วิธีใช้งาน

### 1. Deploy Code ใหม่

1. เปิด [SCORDS/backend/Code.gs](SCORDS/backend/Code.gs)
2. คลิก **Deploy** > **Manage deployments**
3. คลิก deployment ที่ใช้อยู่
4. คลิก **Edit**
5. เลือก version: **New version**
6. คลิก **Deploy**

### 2. ทดสอบ

1. เปิด LINE บนมือถือ
2. ส่งข้อความ: `SCOR คืออะไร?`
3. ควรเห็น:
   - ✅ Loading animation "..." ปรากฏ
   - ✅ ข้อความตอบกลับพร้อม quote ข้อความต้นทาง

---

## ⚠️ ข้อควรระวัง

### 1. Chat ID ต้องถูกต้อง

ถ้าส่ง loading ไปยัง chatId ผิด:
- Loading จะไม่แสดง
- แต่ reply ยังทำงานได้ปกติ

### 2. Quote Token หมดอายุ

ถ้าใช้ quoteToken เดิมซ้ำ:
- ได้ error: `Invalid reply token`
- วิธีแก้: ต้องดึง quoteToken ใหม่จาก webhook event

### 3. Loading Duration

ถ้า AI ประมวลผลนานกว่า 20 วินาที:
- Loading จะหายไป
- แต่ข้อความตอบกลับยังส่งได้

---

## 📚 เอกสารอ้างอิง

### LINE Messaging API Docs

- [Reply Message API](https://developers.line.biz/en/reference/messaging-api/#send-reply-message)
- [Chat Loading Start API](https://developers.line.biz/en/reference/messaging-api/#send-chat-loading-start)
- [Message Types (Quote)](https://developers.line.biz/en/reference/messaging-api/#wh-quote)

### Example Request/Response

**Loading Start Request:**
```json
POST https://api.line.me/v2/bot/chat/loading/start
Authorization: Bearer {channel access token}
Content-Type: application/json

{
  "chatId": "U1234567890",
  "loadingSeconds": 20
}
```

**Reply with Quote Request:**
```json
POST https://api.line.me/v2/bot/message/reply
Authorization: Bearer {channel access token}
Content-Type: application/json

{
  "replyToken": "replyToken...",
  "messages": [
    {
      "type": "text",
      "text": "AI Response...",
      "quoteToken": "quoteToken..."
    }
  ]
}
```

---

## ✅ สรุป

ฟีเจอร์ใหม่นี้ทำให้ LINE Bot:
- ✅ **ราบรื่นขึ้น** - มี loading animation ก่อนตอบ
- ✅ **เป็นมิตรมากขึ้น** - อ้างอิงข้อความต้นทางเสมอ
- ✅ **โปรมากขึ้น** - ดูเป็นแอพระดับมืออาชีพ

ไม่ต้องแก้ไขอะไรเพิ่มใน LINE Developers Console แค่ deploy code ใหม่ก็พร้อมใช้งานครับ! 🎉
