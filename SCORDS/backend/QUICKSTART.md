# SCORDS LINE AI Bot - Quick Start Guide

## 🚀 เริ่มต้นใช้งานได้ใน 5 นาที

### Step 1: ตั้งค่า LINE Developers Console (2 นาที)

1. ไปที่ [LINE Developers Console](https://developers.line.biz/console/)
2. สร้าง Provider และ Channel ประเภท "Messaging API"
3. ไปที่ "Messaging API" > "Channel access token"
4. คลิก "Issue" เพื่อสร้าง Token
5. **คัดลอก Token นี้** เก็บไว้

### Step 2: Deploy Google Apps Script (1 นาที)

1. เปิด [SCORDS/backend/Code.gs](SCORDS/backend/Code.gs)
2. คลิก **Deploy** > **New deployment**
3. เลือก type: **Web app**
4. ตั้งค่า:
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
5. คลิก **Deploy**
6. **คัดลอก Web app URL** (เช่น: `https://script.google.com/macros/s/XXXXXXXXXX/exec`)

### Step 3: ตั้งค่า Script Properties (1 นาที)

1. ใน Google Apps Script
2. คลิก **Files** > **Project properties** > **Script properties**
3. เพิ่ม property 2 ตัว:

```
Name: LINE_CHANNEL_ACCESS_TOKEN
Value: <วาง LINE Channel Access Token จาก Step 1>

Name: GEMINI_API_KEY
Value: <วาง Gemini API Key จาก https://aistudio.google.com/app/apikey>
```

### Step 4: ตั้งค่า Webhook URL (1 นาที)

1. กลับไปที่ [LINE Developers Console](https://developers.line.biz/console/)
2. ไปที่ "Messaging API" > "Webhook settings"
3. คลิก "Edit"
4. วาง Web app URL จาก Step 2
5. คลิก "Verify" (ต้องขึ้นว่า "Success")
6. เปิด "Use webhook" เป็น ON

### Step 5: ทดสอบ (30 วินาที)

1. เปิด LINE บนมือถือ
2. แอด LINE Official Account ของคุณ
3. พิมพ์ `help`
4. ควรได้รับตอบกลับพร้อมเมนูคำสั่ง

---

## ✅ สำเร็จ!

ตอนนี้คุณสามารถ:
- พิมพ์ `status` - เช็คสถานะ
- พิมพ์ `help` - ดูเมนู
- พิมพ์คำถามเกี่ยวกับ SCOR - AI จะตอบ!

---

## ❓ ติดปัญหา?

### AI ไม่ตอบ
- ตรวจสอบว่ามี `GEMINI_API_KEY` ใน Script properties หรือไม่
- รัน `test_askAI()` ใน Google Apps Script เพื่อทดสอบ

### Webhook ไม่ทำงาน
- ตรวจสอบว่า Web app URL ถูกต้อง
- ตรวจสอบว่า "Who has access" เป็น "Anyone"
- ตรวจสอบว่ามี `LINE_CHANNEL_ACCESS_TOKEN` หรือไม่

ดูรายละเอียดเพิ่มเติมใน [LINE_BOT_SETUP.md](LINE_BOT_SETUP.md)

---

## 📚 เอกสารเพิ่มเติม

- [LINE_BOT_SETUP.md](LINE_BOT_SETUP.md) - วิธีตั้งค่าแบบละเอียด
- [LINE_BOT_CHANGES.md](LINE_BOT_CHANGES.md) - สรุปฟีเจอร์ใหม่
- [Code.gs](Code.gs) - โค้ดหลัก
