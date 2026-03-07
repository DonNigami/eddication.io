# 🔧 SCORDS LINE Webhook Configuration

## Environment Variables

เพิ่ม environment variables ต่อไปนี้ในไฟล์ `.env` ของคุณ:

```bash
# ============================================
# SCORDS LINE Bot Configuration
# ============================================

# LINE Messaging API Credentials
SCORDS_CHANNEL_ACCESS_TOKEN=your-scords-channel-token
SCORDS_CHANNEL_SECRET=your-scords-channel-secret

# หรือใช้ค่าเดียวกับ DriverConnect (ถ้าใช้ LINE OA เดียวกัน)
CHANNEL_ACCESS_TOKEN=your-channel-token
CHANNEL_SECRET=your-channel-secret

# Webhook URL สำหรับ SCORDS
# ตั้งค่าใน LINE Developers Console:
# https://your-domain.com/api/scords/webhook
```

## LINE Developers Console Setup

### 1. Webhook Configuration

ไปที่ [LINE Developers Console](https://developers.line.biz/console/) → เลือก Channel → Messaging API → Webhook settings

**Webhook URL:**
```
https://your-domain.com/api/scords/webhook
```

**คลิก "Verify"** ต้องได้ ✅ **200 OK**

### 2. Required Permissions

LINE OA ของ SCORDS ต้องมี permissions ดังนี้:

- ✅ Messaging API (ส่ง/รับข้อความ)
- ✅ Webhook (รับ event)
- ✅ Profile (ดูข้อมูล user)
- ✅ Rich Menu (เมนูด้านล่าง)

## Webhook Event Handling

SCORDS LINE Bot รองรับ events ดังนี้:

| Event | Description | Handler |
|-------|-------------|---------|
| **follow** | User แอด LINE OA | `handleFollow()` - บันทึก user, ส่งข้อความต้อนรับ |
| **message** | User ส่งข้อความ | `handleMessage()` - ตอบคำถาม (status, help) |
| **postback** | User กดเมนู Rich Menu | `handlePostback()` - ดำเนินการตามคำสั่ง |
| **unfollow** | User block LINE OA | `handleUnfollow()` - อัปเดตสถานะ user |

## Available Commands

User สามารถพิมพ์คำสั่งใน LINE:

| Command | Response |
|---------|----------|
| `status` หรือ `สถานะ` | แสดงสถานะบัญชี |
| `help` หรือ `ช่วยเหลือ` | แสดงวิธีใช้งาน |
| `menu` หรือ `เมนู` | แนะนำให้ใช้ Rich Menu |

## Database Schema (Google Sheets)

### Sheet: Users

| Column | Field | Description |
|--------|-------|-------------|
| A | userId | LINE User ID |
| B | displayName | ชื่อแสดงใน LINE |
| C | pictureUrl | URL รูปโปรไฟล์ |
| D | status | PENDING, ACTIVE, SUSPENDED, INACTIVE |
| E | createdAt | วันที่สร้างบัญชี |
| F | updatedAt | วันที่อัปเดตล่าสุด |

### Sheet: Activities

| Column | Field | Description |
|--------|-------|-------------|
| A | timestamp | เวลาที่เกิด event |
| B | userId | LINE User ID |
| C | action | FOLLOW, MESSAGE, POSTBACK, UNFOLLOW |
| D | details | รายละเอียดเพิ่มเติม (JSON) |

## API Endpoints

### SCORDS Webhook Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/scords/webhook` | POST | LINE webhook endpoint |
| `/api/scords/health` | GET | Health check |
| `/api/scords/test-message` | POST | Send test message |
| `/api/scords/user/:userId` | GET | Get user status |

### Example Usage

**Test webhook:**
```bash
node test-scords-webhook.js https://your-domain.com/api/scords/webhook
```

**Send test message:**
```bash
curl -X POST https://your-domain.com/api/scords/test-message \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "U1234567890",
    "message": "ทดสอบส่งข้อความ"
  }'
```

## Testing

### Local Testing (ด้วย ngrok)

1. Start backend:
```bash
cd backend
npm start
```

2. Start ngrok:
```bash
ngrok http 3000
```

3. คัดลอก ngrok URL (เช่น `https://abc123.ngrok.io`)

4. Set webhook ใน LINE Developers Console:
```
https://abc123.ngrok.io/api/scords/webhook
```

5. Test ด้วย:
```bash
node test-scords-webhook.js https://abc123.ngrok.io/api/scords/webhook
```

### Production Testing

1. Deploy backend ไป server (Vercel, Railway, AWS, etc.)

2. Update webhook URL ใน LINE Developers Console:
```
https://your-production-domain.com/api/scords/webhook
```

3. Click "Verify" - ต้องได้ 200 OK

4. Test โดยการแอด LINE OA และส่งข้อความ

## Troubleshooting

### ❌ Webhook returns 302 Found

**ปัญหา:** URL มี trailing slash หรือ redirect

**วิธีแก้:**
- ตรวจสอบว่า webhook URL ใน LINE Console ไม่มี trailing slash
- ใช้ `https://your-domain.com/api/scords/webhook` (ไม่มี `/` ท้ายสุด)

### ❌ Webhook returns 401 Unauthorized

**ปัญหา:** Signature verification ล้มเหลว

**วิธีแก้:**
- ตรวจสอบ `CHANNEL_SECRET` ใน `.env`
- ตรวจสอบว่า LINE Channel Secret ถูกต้อง

### ❌ Webhook returns 500 Internal Server Error

**ปัญหา:** Server error

**วิธีแก้:**
- ดู server logs: `console.log`
- ตรวจสอบว่า Google Sheets credentials ถูกต้อง
- ตรวจสอบว่า Sheets "Users" และ "Activities" มีอยู่

### ❌ User ไม่ได้รับข้อความตอบกลับ

**ปัญหา:** LINE API call ล้มเหลว

**วิธีแก้:**
- ตรวจสอบ `CHANNEL_ACCESS_TOKEN` ใน `.env`
- ตรวจสอบว่า token ยังไม่หมดอายุ
- ดู console logs สำหรับ error messages

## Migration from Google Apps Script

ถ้าย้ายจาก Google Apps Script (Code.gs):

1. **ตรวจสอบ spreadsheet structure** - ต้องมี sheets "Users" และ "Activities"

2. **Copy environment variables** - ย้าย `LINE_CHANNEL_ACCESS_TOKEN` และ `LINE_CHANNEL_SECRET`

3. **Update webhook URL** - เปลี่ยนจาก Google Script URL เป็น Node.js backend URL

4. **Test all features**:
   - ✅ User add LINE OA (follow event)
   - ✅ User ส่งข้อความ (message event)
   - ✅ User กดเมนู (postback event)
   - ✅ User block LINE OA (unfollow event)

5. **Deploy เป็น production**:
   - อย่าลืม set webhook URL ใน LINE Developers Console
   - คลิก "Verify" ให้แน่ใจว่าได้ 200 OK

## Support

หากพบปัญหา:

1. ดู server logs: `console.log`
2. รัน test tool: `node test-scords-webhook.js`
3. ตรวจสอบ environment variables ใน `.env`
4. ตรวจสอบ LINE Developers Console settings
5. ติดต่อ: support@scords.com

---

**Last Updated:** 2026-03-07
**Status:** ✅ Production Ready
