# การตั้งค่า Telegram สำหรับ Subscription System

## วิธี 1: ใช้ Supabase Secrets (แนะนำ)

### ขั้นตอน:

1. **ไปที่ Supabase Dashboard**
   - Project > Settings > Secrets

2. **เพิ่ม Secrets ใหม่:**
   ```
   TELEGRAM_BOT_TOKEN = YOUR_BOT_TOKEN
   TELEGRAM_CHAT_ID = YOUR_CHAT_ID
   ```

3. **Backend จะดึง secrets โดยอัตโนมัติ**
   - ตัวอย่าง API call:
   ```
   GET https://your-project.supabase.co/rest/v1/rpc/get_telegram_config
   Headers: apikey + Authorization
   ```

## วิธี 2: ใช้ Admin Config Table

### ขั้นตอน:

1. **รัน SQL ใน Supabase SQL Editor:**
   ```bash
   # ใช้ไฟล์ setup-telegram-secrets.sql
   supabase sql < setup-telegram-secrets.sql
   ```

2. **อัปเดต Telegram Credentials:**
   ```sql
   UPDATE admin_config 
   SET telegram_bot_token = 'YOUR_BOT_TOKEN', 
       telegram_chat_id = 'YOUR_CHAT_ID' 
   WHERE id = 1;
   ```

3. **Backend จะดึงจาก Table โดยอัตโนมัติ**

## วิธี 3: ใช้ Environment Variables (Local Development)

ถ้าไม่มี Supabase Secrets จาก local `.env`:

```env
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN
TELEGRAM_CHAT_ID=YOUR_CHAT_ID
```

## การทดสอบ

```bash
curl -X POST "http://localhost:3000/api/subscription/notify" \
  -H "Content-Type: application/json" \
  -d '{
    "package_name": "Gold",
    "customer_info": {"name": "Test", "phone": "0812345678"},
    "duration_months": 12,
    "total_price": 10788,
    "original_price": 10788,
    "discount_percent": 0,
    "slip_url": "https://example.com/slip.jpg",
    "submission_time": "2025-01-01T10:00:00Z"
  }'
```

## Notes

- สนับสนุนทั้งสาม method: Secrets, Table, Environment
- ลำดับความสำคัญ: `this.telegramBotToken` > `process.env.TELEGRAM_BOT_TOKEN`
- Supabase Secrets ปลอดภัยที่สุด (encrypted at rest)
- Table approach ให้ผู้ใช้สามารถอัปเดตได้ผ่าน Admin UI ในอนาคต
