# SCORDS LINE AI Bot - Setup Guide

## ภาพรวม

SCORDS LINE AI Bot เป็นบอท LINE ที่เชื่อมต่อกับระบบ SCORDS เพื่อให้บริการ:

- ✅ เช็คสถานะการลงทะเบียนและแต้มสะสม
- 🤖 AI Assistant ตอบคำถามเกี่ยวกับ SCOR framework, แต้มสะสม, และกิจกรรมต่างๆ
- 📊 ดูข้อมูลส่วนตัวและสถิติ
- 🎮 ระบบแต้มสะสม

---

## การตั้งค่า LINE Developers Console

### 1. สร้าง LINE Messaging API Channel

1. ไปที่ [LINE Developers Console](https://developers.line.biz/console/)
2. ล็อกอินด้วยบัญชี LINE
3. คลิก "Create a new provider"
4. ตั้งชื่อ Provider (เช่น: "SCORDS")
5. ภายใต้ Provider ให้คลิก "Create a Channel"
6. เลือก "Messaging API"
7. กรอกข้อมูล Channel:
   - Channel name: `SCORDS Bot`
   - Channel description: `AI Bot for SCORDS System`
   - Category: `None (Personal)`
   - Email: อีเมลของคุณ

### 2. ตั้งค่า Channel Access Token

1. ไปที่ Channel ที่สร้าง
2. คลิก "Messaging API" ในเมนูด้านซ้าย
3. ดูที่ส่วน "Channel access token"
4. คลิก "Issue" เพื่อสร้าง Long-lived channel access token
5. **คัดลอก Token นี้** เก็บไว้ใช้ใน Google Apps Script

### 3. ตั้งค่า Webhook URL

1. ในหน้าเดียวกัน (Messaging API)
2. ดูที่ส่วน "Webhook settings"
3. คลิก "Edit"
4. ใส่ Webhook URL:

```
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

**วิธีหา Deployment ID:**
- เปิด Google Apps Script project
- คลิก "Deploy" > "New deployment"
- เลือก type: "Web app"
- ตั้งค่า:
  - Description: `SCORDS LINE Bot`
  - Execute as: `Me`
  - Who has access: `Anyone`
- คลิก "Deploy"
- คัดลอก URL ที่ได้ (เช่น: `https://script.google.com/macros/s/XXXXXXXXXX/exec`)

5. คลิก "Verify" เพื่อยืนยัน Webhook
6. เปิด "Use webhook" เป็น ON

### 4. ตั้งค่า Auto-reply (ปิดการใช้งาน)

1. ในหน้า Messaging API
2. ดูที่ส่วน "Reply messages"
3. ปิด "Auto-reply" เพื่อให้บอททำงานเอง

### 5. เปิดใช้งาน LINE Bot

1. ใน LINE Developers Console
2. ไปที่ "Messaging API" > "Channel information"
3. คัดลอก "Your user ID" เก็บไว้ (อาจจะต้องใช้ในอนาคต)
4. เพิ่ม LINE Official Account เป็นเพื่อน หรือสร้าง QR Code ให้คนอื่นแอดได้ที่:
   - "Messaging API" > "QR Code" หรือ "LINE ID"

---

## การตั้งค่า Google Apps Script

### 1. ตั้งค่า LINE Channel Access Token

1. เปิด Google Apps Script project ([SCORDS/backend/Code.gs](SCORDS/backend/Code.gs))
2. รันฟังก์ชัน `setupScriptProperties()` ครั้งเดียว
3. หรือไปที่: **Files** > **Project properties** > **Script properties**
4. เพิ่ม property ดังนี้:

```
Name: LINE_CHANNEL_ACCESS_TOKEN
Value: <วาง Channel Access Token จาก LINE Developers Console>
```

### 2. Deploy Web App

1. ใน Google Apps Script
2. คลิก **Deploy** > **New deployment**
3. เลือก type: **Web app**
4. ตั้งค่า:
   - **Description**: `SCORDS LINE Bot`
   - **Execute as**: `Me` (อีเมลของคุณ)
   - **Who has access**: `Anyone` (สำคัญมาก!)
5. คลิก **Deploy**
6. **คัดลอก Web app URL** (เช่น: `https://script.google.com/macros/s/XXXXXXXXXX/exec`)
7. วางใน LINE Developers Console ที่ Webhook URL

---

## การตั้งค่า AI Providers (อย่างน้อย 1 ตัว)

สำหรับให้ AI Chat ทำงานได้ ต้องตั้งค่า API Key อย่างน้อย 1 ตัว:

### แนะนำ: Gemini API (มี Free tier!) ⭐

1. ไปที่ [Google AI Studio](https://aistudio.google.com/app/apikey)
2. ล็อกอินด้วย Google Account
3. คลิก "Create API key"
4. **คัดลอก API Key**
5. ใน Google Apps Script: **Files** > **Project properties** > **Script properties**
6. เพิ่ม property:

```
Name: GEMINI_API_KEY
Value: <วาง Gemini API Key>
```

**ข้อดี:**
- ✅ มี Free tier (1,500 requests/day สำหรับ gemini-1.5-flash)
- ✅ รองรับภาษาไทยได้ดี
- ✅ ราคาถูกมากหลังจากใช้ฟรีหมด

### ทางเลือก 1: Z.AI (Zhipu AI)

1. ไปที่ [Zhipu AI Platform](https://open.bigmodel.cn/)
2. ลงทะเบียนและเติมเงิน
3. ไปที่ API Keys
4. **คัดลอก API Key**
5. ใน Script properties:

```
Name: ZAI_API_KEY
Value: <วาง Z.AI API Key>
```

### ทางเลือก 2: OpenAI

1. ไปที่ [OpenAI Platform](https://platform.openai.com/api-keys)
2. ล็อกอินและสร้าง API Key
3. **คัดลอก API Key**
4. ใน Script properties:

```
Name: OPENAI_API_KEY
Value: <วาง OpenAI API Key>
```

---

## การทดสอบ LINE Bot

### 1. เพิ่ม LINE Official Account เป็นเพื่อน

1. ใน LINE Developers Console
2. ไปที่ "Messaging API" > "Channel information"
3. คัดลอก "LINE ID" หรือสร้าง QR Code
4. เปิด LINE บนมือถือ
5. แอด LINE Official Account หรือสแกน QR Code

### 2. ทดสอบคำสั่ง

พิมพ์ข้อความเหล่านี้ใน LINE:

- `help` หรือ `ช่วยเหลือ` - ดูคำสั่งทั้งหมด
- `status` หรือ `สถานะ` - เช็คสถานะ
- `SCOR คืออะไร?` - ทดสอบ AI
- `จะได้แต้มอย่างไร?` - ทดสอบ AI
- `Process คืออะไร?` - ทดสอบ AI

### 3. ตรวจสอบ Logs

ใน Google Apps Script:
1. คลิก **Executions** ที่เมนูด้านซ้าย
2. ดู logs ว่ามี error หรือไม่
3. หรือรันฟังก์ชัน `test_askAI()` เพื่อทดสอบ AI

---

## คำสั่งที่ใช้ได้ใน LINE Bot

| คำสั่ง | คำอธิบาย | ตัวอย่าง |
|--------|----------|---------|
| `status` หรือ `สถานะ` | เช็คสถานะการลงทะเบียนและแต้มสะสม | `status` |
| `help` หรือ `ช่วยเหลือ` | ดูคำสั่งทั้งหมด | `help` |
| `menu` หรือ `เมนู` | ดูคำสั่งทั้งหมด | `menu` |
| ข้อความอื่นๆ | AI จะตอบโดยอัตโนมัติ | `SCOR คืออะไร?` |

---

## การ Debug

### ปัญหาที่พบบ่อย

**1. Webhook ไม่ทำงาน**
- ตรวจสอบ Webhook URL ว่าถูกต้องหรือไม่
- ตรวจสอบว่า Deploy Web app ให้ "Anyone" หรือยัง
- ตรวจสอบ Script properties ว่ามี LINE_CHANNEL_ACCESS_TOKEN หรือไม่

**2. AI ไม่ตอบ**
- ตรวจสอบว่ามีอย่างน้อย 1 AI API Key (GEMINI_API_KEY, ZAI_API_KEY, หรือ OPENAI_API_KEY)
- รัน `test_askAI()` เพื่อทดสอบ AI
- ตรวจสอบ logs ใน Google Apps Script

**3. ข้อความตอบกลับไม่ถูกต้อง**
- ตรวจสอบ LINE Developers Console ว่า Auto-reply ปิดอยู่หรือไม่
- ตรวจสอบ logs ใน Google Apps Script

**4. Error: "Invalid reply token"**
- Reply token หมดอายุ (ใช้ได้แค่ครั้งเดียว)
- ตรวจสอบว่าเรียก `sendLineReplyDirect()` แค่ครั้งเดียวต่อ event

---

## โครงสร้างการทำงาน

```
LINE User Message
    ↓
LINE Webhook
    ↓
Google Apps Script (doPost)
    ↓
handleLineWebhook()
    ↓
handleLineMessage()
    ↓
┌─────────────────┬───────────────┐
│  Special Command│  AI Chat      │
│  (status/help)  │  (askAI)      │
└─────────────────┴───────────────┘
         ↓                 ↓
   sendLineReplyDirect() ← AI Response
         ↓
   LINE User receives reply
```

---

## ข้อมูลเพิ่มเติม

### LINE Platform Docs
- [Messaging API Documentation](https://developers.line.biz/en/docs/messaging-api/)
- [Webhook Documentation](https://developers.line.biz/en/docs/messaging-api/receiving-messages/)

### AI API Docs
- [Google Gemini API](https://ai.google.dev/gemini-api/docs/models)
- [Zhipu AI API](https://open.bigmodel.cn/dev/api#glm-4)
- [OpenAI API](https://platform.openai.com/docs/models)

---

## สรุป Checklist

- [ ] สร้าง LINE Messaging API Channel
- [ ] ได้ Channel Access Token
- [ ] Deploy Google Apps Script เป็น Web App
- [ ] ได้ Web App URL
- [ ] ตั้งค่า Webhook URL ใน LINE Developers Console
- [ ] ตั้งค่า Script properties (LINE_CHANNEL_ACCESS_TOKEN)
- [ ] ตั้งค่า AI API Key อย่างน้อย 1 ตัว
- [ ] ทดสอบด้วยคำสั่ง `help`
- [ ] ทดสอบ AI Chat

---

## ติดต่อสนับสนุน

หากมีปัญหาหรือข้อสงสัย:
1. ตรวจสอบ logs ใน Google Apps Script
2. ตรวจสอบ LINE Developers Console
3. อ่านเอกสารด้านบน

---

**หมายเหตุ:** ระบบ LINE Bot นี้เชื่อมต่อกับ SCORDS System และใช้ AI Chat (Gemini/Z.AI/OpenAI) เพื่อตอบคำถามเกี่ยวกับ SCOR framework และระบบแต้มสะสม
