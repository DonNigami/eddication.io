# 🔌 Quick Connect Guide - CRM Pro

## ✅ พร้อมใช้งานแล้ว!

test.html เชื่อมกับ `crm-pro` Edge Function เรียบร้อยแล้ว

---

## 🚀 ขั้นตอนการ Deploy

### 1. สร้างตาราง Database (ครั้งเดียว)

รัน SQL นี้ใน **Supabase SQL Editor**:

```sql
-- ดูรายละเอียดใน database-schema.sql
-- คัดลอกทั้งไฟล์แล้ววางใน SQL Editor แล้วกด Run
```

### 2. Deploy Edge Function

```bash
# เข้าไปที่ folder project/crm
cd project/crm

# Deploy function
supabase functions deploy crm-pro

# ตรวจสอบว่า deploy สำเร็จ
supabase functions list
```

### 3. ตั้งค่า Environment Variables

**Option A: ไม่ใช้ API Key (แนะนำสำหรับ TEST)**

```bash
# ไม่ต้องตั้ง FUNCTION_API_KEY
# Edge Function จะไม่เช็ค Authentication

# ตั้งค่าเฉพาะ LINE และ Telegram
supabase secrets set LINE_CHANNEL_ACCESS_TOKEN=<your-line-token>
supabase secrets set TELEGRAM_BOT_TOKEN=<your-telegram-token>
supabase secrets set TELEGRAM_CHAT_ID=<your-chat-id>
```

**Option B: ใช้ API Key (แนะนำสำหรับ PRODUCTION)**

```bash
# Generate API Key
$apiKey = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
echo $apiKey

# ตั้งค่า
supabase secrets set FUNCTION_API_KEY=$apiKey
supabase secrets set LINE_CHANNEL_ACCESS_TOKEN=<your-line-token>
supabase secrets set TELEGRAM_BOT_TOKEN=<your-telegram-token>
supabase secrets set TELEGRAM_CHAT_ID=<your-chat-id>
```

### 4. ทดสอบการเชื่อมต่อ

#### Test 1: เปิด test.html ใน LINE LIFF

```bash
# 1. เปิด test.html บน Web Server หรือ GitHub Pages
# 2. เข้าผ่าน LINE LIFF
# 3. ลองส่ง Broadcast ข้อความทดสอบ
```

#### Test 2: ทดสอบ API ด้วย curl

**ถ้าไม่มี API Key:**
```bash
curl -X POST https://ckhwouxtrvuthefkxnxb.supabase.co/functions/v1/crm-pro \
  -H "Content-Type: application/json" \
  -d '{
    "action": "update-points",
    "userId": "test123",
    "points": 100,
    "reason": "Test transaction",
    "adminId": "admin-test"
  }'
```

**ถ้ามี API Key:**
```bash
curl -X POST https://ckhwouxtrvuthefkxnxb.supabase.co/functions/v1/crm-pro \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "action": "update-points",
    "userId": "test123",
    "points": 100,
    "reason": "Test transaction",
    "adminId": "admin-test"
  }'
```

---

## 📊 ตรวจสอบข้อมูล

### ดู Transaction History

```sql
SELECT * FROM transaction_history 
ORDER BY created_at DESC 
LIMIT 10;
```

### ดู Audit Logs

```sql
SELECT 
    action,
    actor_id,
    target_count,
    success_count,
    failed_count,
    created_at
FROM audit_logs 
ORDER BY created_at DESC 
LIMIT 10;
```

### ดู Function Logs

```bash
# Real-time logs
supabase functions logs crm-pro --tail

# Recent logs
supabase functions logs crm-pro
```

---

## 🔧 Troubleshooting

### ปัญหา: "Function not found"

**แก้:**
```bash
# ตรวจสอบว่า deploy แล้วหรือยัง
supabase functions list

# Deploy ใหม่
supabase functions deploy crm-pro
```

### ปัญหา: "Unauthorized: Invalid API Key"

**แก้:**
```bash
# ถ้าใช้ใน TEST - ปิด API Key ไว้ก่อน
supabase secrets unset FUNCTION_API_KEY

# ถ้าใช้ใน PRODUCTION - ตรวจสอบว่า API Key ถูกต้อง
supabase secrets list
```

### ปัญหา: "Table transaction_history does not exist"

**แก้:**
```sql
-- รัน database-schema.sql ใน Supabase SQL Editor
-- หรือรัน command นี้:
CREATE TABLE IF NOT EXISTS transaction_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    points_change INTEGER NOT NULL,
    points_before INTEGER NOT NULL,
    points_after INTEGER NOT NULL,
    action TEXT NOT NULL,
    reason TEXT,
    created_by TEXT,
    request_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB
);
```

### ปัญหา: "Rate limit exceeded"

**แก้:**
```typescript
// แก้ใน crm-pro.ts
const RATE_LIMIT_MAX = 200; // เพิ่มจาก 100 เป็น 200

// Deploy ใหม่
supabase functions deploy crm-pro
```

---

## 📝 สิ่งที่เปลี่ยนใน test.html

### 1. เปลี่ยนชื่อ Function
```javascript
// เดิม
await this.supabase.functions.invoke('crm-core', {...})

// ใหม่
await this.supabase.functions.invoke('crm-pro', {...})
```

### 2. เพิ่ม Parameters
```javascript
// เพิ่ม adminId และ testUserId
{
  action: 'broadcast',
  adminId: this.userProfile?.userId || 'unknown',
  testUserId: this.userProfile?.userId,
  ...
}
```

### 3. เพิ่ม Method ใหม่
```javascript
// Method สำหรับ update points ผ่าน crm-pro
async updatePointsViaFunction(userId, pointsChange, reason) {
  const { data, error } = await this.supabase.functions.invoke('crm-pro', {
    body: { 
      action: 'update-points', 
      userId, 
      points: pointsChange,
      reason,
      adminId: this.userProfile?.userId
    }
  });
  return data;
}
```

---

## 🎯 ขั้นตอนถัดไป

### 1. ทดสอบ Broadcast
- [ ] เปิด test.html
- [ ] ไปที่แท็บ Broadcast
- [ ] เลือก Target: test
- [ ] พิมพ์ข้อความ: "ทดสอบระบบ CRM Pro"
- [ ] กดส่ง
- [ ] ตรวจสอบว่าได้รับข้อความใน LINE

### 2. ทดสอบ Transaction Logging
- [ ] แก้ไขคะแนนลูกค้า
- [ ] ไปดูใน Supabase SQL Editor
- [ ] รัน: `SELECT * FROM transaction_history ORDER BY created_at DESC LIMIT 5;`
- [ ] ตรวจสอบว่ามีข้อมูลบันทึก

### 3. ทดสอบ Audit Logging
- [ ] ส่ง Broadcast
- [ ] ไปดูใน Supabase SQL Editor
- [ ] รัน: `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 5;`
- [ ] ตรวจสอบว่ามีข้อมูล action="broadcast"

---

## 🔒 Security Checklist

- [ ] ใช้ Supabase RLS แทน API Key ใน test.html
- [ ] อย่าเก็บ API Key ใน Frontend Code
- [ ] ตั้งค่า CORS ให้ถูกต้อง
- [ ] Enable Row Level Security บนทุกตาราง
- [ ] ใช้ HTTPS เท่านั้น
- [ ] Rotate API Key ทุก 90 วัน

---

## 📞 Support

หากมีปัญหา:
1. ดู Function Logs: `supabase functions logs crm-pro --tail`
2. ตรวจสอบ Browser Console (F12)
3. ทดสอบด้วย curl ตาม examples ข้างบน

---

**Status:** ✅ พร้อมใช้งาน  
**Version:** 2.0.0  
**Last Updated:** 2025-12-30
