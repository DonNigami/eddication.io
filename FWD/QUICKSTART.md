# 🚀 Quick Start Guide - FWD Fuel Receipt OCR

## 5 นาทีเริ่มต้นใช้งาน

### 1️⃣ ติดตั้ง Dependencies

```bash
cd D:\VS_Code_GitHub_DATA\eddication.io\eddication.io\FWD

python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### 2️⃣ ตั้งค่า Environment Variables

```bash
# Copy .env.example เป็น .env
copy .env.example .env

# แก้ไข .env และกรอกค่า:
# - LINE_CHANNEL_ACCESS_TOKEN
# - LINE_CHANNEL_SECRET
# - GEMINI_API_KEY
```

**รับ API Keys:**

**Gemini API (ฟรี!):**
1. ไปที่: https://aistudio.google.com/app/apikey
2. Create API key ใหม่
3. Copy มาใส่ใน `.env`

**LINE Developers:**
1. ไปที่: https://developers.line.biz/
2. Create Provider → Channel (Messaging API)
3. Copy Channel Access Token & Secret
4. ใส่ใน `.env`

### 3️⃣ Run Server

```bash
python -m app.main
```

หรือใช้ uvicorn:

```bash
uvicorn app.main:app --reload
```

Server จะรันที่: `http://localhost:8000`

### 4️⃣ Test Local Endpoint

```bash
curl http://localhost:8000/health
```

ควรได้รับ response:
```json
{
  "status": "healthy",
  "ai_provider": "gemini",
  "environment": "development"
}
```

### 5️⃣ Setup Webhook (Ngrok)

```bash
# ดาวน์โหลด ngrok: https://ngrok.com/download

# Run ngrok
ngrok http 8000
```

Copy HTTPS URL (เช่น `https://abc123.ngrok.io`) และ:

1. ไปที่ LINE Developers Console
2. เลือก Channel ของคุณ
3. ไปที่ "Messaging API" tab
4. ใน "Webhook URL" ใส่: `https://abc123.ngrok.io/webhook`
5. กด "Verify" เพื่อตรวจสอบ

### 6️⃣ ใช้งานบน LINE

1. เปิด LINE และเพิ่มเพื่อนกับบอท (ใช้ LINE QR Code จาก Console)
2. ส่งรูปสลิปเติมน้ำมันมา
3. รับผลลัพธ์เป็น JSON! 🎉

---

## 📝 คำสั่งพื้นฐาน

### พิมพ์ใน LINE:
- `ช่วยเหลือ` - ดูวิธีใช้งาน
- `สถานะ` - ตรวจสอบสถานะระบบ

### ส่งรูปสลิป:
แค่ส่งรูปสลิปเติมน้ำมันมา ระบบจะอ่านและตอบกลับเป็น JSON

---

## 🛠️ Troubleshooting

### ปัญหา: Import error
```bash
pip install -r requirements.txt
```

### ปัญหา: LINE webhook ไม่ทำงาน
1. ตรวจสอบว่า webhook URL ถูกต้อง
2. กด "Verify" ใน LINE Console
3. ตรวจสอบ logs: `tail -f logs/app.log`

### ปัญหา: AI อ่านไม่ออก
- ตรวจสอบ API key ใน `.env`
- ลองเปลี่ยนภาพที่ชัดกว่า
- แสงสว่างพอ ไม่สะท้อน

### ปัญหา: Gemini API quota
- Gemini free tier: 15M tokens/day
- ถ้าเกิน ให้รอหรือ switch เป็น OpenAI:
  ```
  AI_PROVIDER=openai
  OPENAI_API_KEY=your_key
  ```

---

## 📚 Resources

- [README.md](README.md) - เอกสารทั้งหมด
- [LINE Messaging API Docs](https://developers.line.biz/en/docs/)
- [Gemini API Docs](https://ai.google.dev/docs)
- [FastAPI Docs](https://fastapi.tiangolo.com/)

---

**พร้อมใช้งานแล้ว! 🎉**

มีปัญหา? ติดต่อ: support@eddication.io
