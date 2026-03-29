# FWD - Fuel Receipt OCR with LINE Bot

ระบบอ่านค่าสลิปเติมน้ำมันด้วย AI และ LINE Messaging API

---

## 📋 Overview

โปรเจคนี้สร้างระบบอัตโนมัติในการอ่านค่าสลิปเติมน้ำมันจากรูปภาพ ผ่าน LINE Bot โดยใช้:
- **Python** + **FastAPI** - Webhook server ที่รวดเร็วและทันสมัย
- **LINE Messaging API** - รับรูปภาพและตอบกลับ
- **AI Vision APIs** - อ่านและแปลงภาพเป็นข้อมูล (รองรับทั้ง Gemini API และ OpenAI GPT-4o)
- **Pydantic** - Data validation และ type safety
- **JSON** - Output format ที่ structured และง่ายต่อการใช้งาน

---

## ✨ คุณสมบัติเด่น

✅ **รองรับ 2 AI Providers** - Switch ระหว่าง Gemini ↔ OpenAI ได้ง่าย
✅ **Default ใช้ Gemini** - ประหยัดค่าใช้จ่าย (Free tier สูง)
✅ **Production-Ready** - Switch เป็น OpenAI สำหรับความแม่นยำสูงสุด
✅ **Abstraction Layer** - Code เดียวรองรับทั้ง 2 providers

---

## 🚀 เริ่มต้นใช้งาน

### 1. สร้าง Virtual Environment

```bash
cd D:\VS_Code_GitHub_DATA\eddication.io\eddication.io\FWD

python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Mac/Linux)
source venv/bin/activate
```

### 2. ติดตั้ง Dependencies

```bash
pip install -r requirements.txt
```

### 3. ตั้งค่า Environment Variables

Copy `.env.example` เป็น `.env` และกรอกค่า:

```bash
# LINE Bot
LINE_CHANNEL_ACCESS_TOKEN=your_token_here
LINE_CHANNEL_SECRET=your_secret_here

# AI Vision Provider
AI_PROVIDER=gemini  # หรือ 'openai'
GEMINI_API_KEY=your_gemini_key_here
OPENAI_API_KEY=your_openai_key_here
```

### 4. รับ API Keys

**Gemini API (Recommended - Free tier huge quota):**
1. ไปที่: https://aistudio.google.com/app/apikey
2. Create API key ใหม่
3. Copy และวางใน `.env`

**OpenAI API (Optional - For production):**
1. ไปที่: https://platform.openai.com/api-keys
2. Create new secret key
3. Copy และวางใน `.env`

**LINE Developers Console:**
1. ไปที่: https://developers.line.biz/
2. Create new provider และ channel (Messaging API)
3. Get Channel Access Token & Channel Secret
4. Set webhook URL: `https://your-domain.com/webhook`

---

## 🏗️ โครงสร้างโปรเจค

```
FWD/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI entry point
│   ├── config.py               # Environment variables & settings
│   └── utils/
│       ├── __init__.py
│       ├── line_client.py      # LINE Messaging API client
│       ├── ai_vision/          # AI Vision abstraction layer
│       │   ├── __init__.py
│       │   ├── base.py         # Base interface
│       │   ├── gemini_client.py    # Gemini API implementation
│       │   └── openai_client.py    # OpenAI GPT-4o implementation
│       ├── receipt_parser.py   # Receipt data extraction logic
│       └── json_formatter.py   # JSON output formatter
│
├── models/
│   ├── receipt_data.py         # Pydantic models for receipt data
│   └── line_events.py          # LINE webhook event models
│
├── tests/
│   ├── __init__.py
│   ├── test_ocr.py
│   ├── test_parser.py
│   └── test_line_client.py
│
├── requirements.txt            # Python dependencies
├── .env.example                # Environment variables template
└── README.md                   # This file
```

---

## 🎯 วิธีใช้งาน

### 1. Run Local Server

```bash
uvicorn app.main:app --reload
```

Server จะรันที่ `http://localhost:8000`

### 2. Setup ngrok (สำหรับ local testing)

```bash
ngrok http 8000
```

Copy HTTPS URL (เช่น `https://abc123.ngrok.io`) และ set ใน LINE Developers Console

### 3. ใช้งานบน LINE

1. เปิด LINE และเพิ่มเพื่อนกับบอท
2. ถ่ายรูปสลิปเติมน้ำมัน
3. ส่งรูปมาที่บอท
4. รับผลลัพธ์เป็น JSON

---

## 📊 ผลลัพธ์ตัวอย่าง

เมื่อ user ส่งรูปสลิปเติมน้ำมัน → ระบบอ่านค่า → ตอบกลับเป็น JSON format:

```json
{
  "station_name": "PT GAS STATION",
  "date": "2025-03-18",
  "time": "14:30",
  "pump_number": "A1",
  "fuel_type": "ดีเซล",
  "liters": 35.50,
  "price_per_liter": 35.50,
  "total_amount": 1260.25,
  "payment_method": "เงินสด",
  "receipt_number": "12345"
}
```

**หมายเหตุ:**
- `date` อยู่ในรูปแบบ **YYYY-MM-DD** (string ไม่ใช่ datetime)
- `time` อยู่ในรูปแบบ **HH:MM** (24-hour format)
- ตัวเลขทั้งหมดเป็น number type ไม่ใช่ string

---

## 🔧 AI Provider Comparison

| Feature | **Gemini API** | **OpenAI GPT-4o** |
|---------|---------------|------------------|
| **ราคา** | Free 15M tokens/month<br>Pro $20/เดือน | ~$2.50-5/1M images |
| **Vision Quality** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **ภาษาไทย** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **JSON Mode** | ✅ Native | ✅ Native |
| **Speed** | 🚀 Very Fast | 🚀 Very Fast |
| **Recommendation** | **Default choice** | Production/high-accuracy |

### การเปลี่ยน AI Provider

แก้ไข `.env`:

```bash
# ใช้ Gemini (Default)
AI_PROVIDER=gemini

# หรือใช้ OpenAI
AI_PROVIDER=openai
```

---

## 🧪 Testing

```bash
# Run all tests
pytest

# Run specific test file
pytest tests/test_ocr.py

# Run with coverage
pytest --cov=app tests/
```

---

## 📦 Deployment

### Option 1: Railway (Recommended)
- Free tier available
- Easy GitHub integration
- Auto-deploy on push

### Option 2: Render
- Free tier available
- Simple setup

### Option 3: Google Cloud Run
- Scalable
- Good for AI integration

ขั้นตอน deployment:
1. Push code ไป GitHub
2. เชื่อมต่อ repository กับ platform
3. Set environment variables
4. Deploy
5. Update LINE webhook URL

---

## 📝 API Endpoints

### POST /webhook
LINE Bot webhook endpoint - รับ events จาก LINE

### GET /health
Health check endpoint - ตรวจสอบสถานะระบบ

Response:
```json
{
  "status": "healthy",
  "ai_provider": "gemini",
  "environment": "development"
}
```

---

## 🛠️ Development

### เพิ่ม AI Provider ใหม่

1. สร้างไฟล์ใน `app/utils/ai_vision/`
2. Inherit จาก `AIVisionBase`
3. Implement `extract_receipt_data()` method
4. Update factory function ใน `__init__.py`

### เพิ่ม field ใน receipt

1. Update `ReceiptData` model ใน `models/receipt_data.py`
2. Update prompt ใน AI vision client
3. Test กับ sample receipts

---

## 🔄 Future Enhancements

- [ ] Database Integration (เก็บประวัติการใช้งาน)
- [ ] Multi-Receipt Batch (อ่านหลายใบเพิ่มเติมพร้อมกัน)
- [ ] Export Options (Excel/CSV)
- [ ] Integration with DriverConnect
- [ ] Admin Dashboard
- [ ] Analytics & Reporting

---

## 📚 Dependencies

- FastAPI - Web framework
- LINE Bot SDK - LINE Messaging API
- Google Generative AI - Gemini API
- OpenAI - GPT-4o API
- Pydantic - Data validation
- Pillow - Image processing
- Uvicorn - ASGI server

---

## 📄 License

MIT License

---

## 👨‍💻 ผู้พัฒนา

Eddication Team

---

## 📞 ติดต่อ

สำหรับคำถามหรือปัญหา กรุณาติดต่อที่:
- GitHub Issues: [สร้าง issue ใน repository]
- Email: support@eddication.io

---

**Made with ❤️ by Eddication**
