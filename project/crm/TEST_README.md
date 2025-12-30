# 🧪 CRM Pro - Testing Guide

## ✅ สถานะการทดสอบ

### **test.html**
- ✅ Title: "CRM Pro - MINI App (TEST)"
- ✅ TEST MODE badge (มุมขวาบน)
- ✅ Console log แสดง TEST MODE
- ✅ Phone validation (10 หลัก + เริ่มต้น 06/08/09)
- ✅ jumpPageInput initialized

### **crm-pro.ts** (Edge Function)
- ✅ TypeScript errors แก้ไขแล้ว
- ✅ Environment variables support
- ✅ Input validation
- ✅ Error sanitization
- ✅ Retry mechanism (3 attempts)

---

## 🚀 การทดสอบ

### **1. ทดสอบ test.html (Local)**

```bash
# เปิดไฟล์ใน browser
# หรือใช้ Live Server
```

**Expected Results:**
- เห็น badge "🧪 TEST MODE" สีแดงมุมขวาบน
- Console แสดง: `🧪 TEST MODE ACTIVE` และ `Environment: TEST`
- Phone input จำกัดแค่ตัวเลข 10 หลัก
- Pagination มี jump to page feature

---

### **2. ทดสอบ crm-pro.ts (Supabase)**

#### **Deploy Edge Function:**
```bash
# ติดตั้ง Supabase CLI (ถ้ายังไม่มี)
npm install -g supabase

# Login
supabase login

# Deploy function
supabase functions deploy crm-pro --project-ref YOUR_PROJECT_REF
```

#### **ตั้งค่า Environment Variables:**
```bash
supabase secrets set TELEGRAM_BOT_TOKEN=your_telegram_token
supabase secrets set TELEGRAM_CHAT_ID=your_chat_id
supabase secrets set LINE_CHANNEL_ACCESS_TOKEN=your_line_token
supabase secrets set LINE_CHUNK_SIZE=500
supabase secrets set CHUNK_DELAY_MS=200
supabase secrets set MAX_POINTS_CHANGE=10000
```

#### **ทดสอบด้วย curl:**

**Test 1: Update Points**
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/crm-pro \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "action": "update-points",
    "userId": "U1234567890abcdef",
    "points": 100
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "newPoints": 100
}
```

**Test 2: Send Telegram**
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/crm-pro \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "action": "notify-telegram",
    "message": "🧪 Test message from CRM Pro"
  }'
```

**Expected Response:**
```json
{
  "success": true
}
```

**Test 3: LINE Broadcast (Text)**
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/crm-pro \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "action": "broadcast",
    "target": "test",
    "testUserId": "U1234567890abcdef",
    "msgType": "text",
    "message": "สวัสดีค่ะ ทดสอบระบบ CRM"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "count": 1,
  "sent": 1,
  "failed": 0,
  "message": "ส่งสำเร็จ 1 คน (ล้มเหลว 0)"
}
```

---

## 🧪 Test Cases

### **Phone Validation Tests**

| Input | Expected | Result |
|-------|----------|--------|
| `0812345678` | ✅ Valid | Pass |
| `0612345678` | ✅ Valid | Pass |
| `0912345678` | ✅ Valid | Pass |
| `0512345678` | ❌ Invalid | Show error |
| `081234567` | ❌ Invalid (9 digits) | Show error |
| `08123456789` | ⚠️ Truncate to 10 | Auto-trim |
| `abc123` | ⚠️ Only numbers | Remove letters |

### **Points Validation Tests**

| Input | Expected | Result |
|-------|----------|--------|
| `points: 100` | ✅ Valid | Pass |
| `points: -50` | ✅ Valid (deduct) | Pass |
| `points: 11000` | ❌ Exceeds limit | Error |
| `points: "abc"` | ❌ Invalid type | Error |
| `points: null` | ❌ Missing value | Error |

### **Retry Mechanism Tests**

1. **Success on first attempt** → Return true
2. **Fail on 4xx error** → No retry, return false
3. **Fail on 5xx error** → Retry 3 times with backoff
4. **Network timeout** → Retry 3 times

---

## 📊 Performance Benchmarks

### **Broadcast Performance**

| User Count | Chunk Size | Expected Time | Memory |
|------------|------------|---------------|--------|
| 100 | 500 | ~2s | Low |
| 1,000 | 500 | ~10s | Medium |
| 5,000 | 500 | ~50s | High |
| 10,000 | 500 | ~100s | Very High |

**Optimization:**
- ถ้ามีผู้ใช้มากกว่า 5,000 คน ควรใช้ Queue System (ตามคำแนะนำ Priority 3)

---

## 🔍 Debugging Tips

### **test.html Console Logs:**
```javascript
// ดูว่า TEST MODE active หรือไม่
console.log('%c🧪 TEST MODE ACTIVE', ...)

// ตรวจสอบ LIFF init
console.log('LIFF Ready:', liff.isLoggedIn())

// ดู API responses
console.log('Supabase Response:', data)
```

### **crm-pro.ts Logs:**
```typescript
// ดู request logs ใน Supabase Dashboard
{
  "timestamp": "2025-12-30T...",
  "requestId": "abc123",
  "action": "update-points"
}

// ดู error logs
"Function Error:", error
"LINE API Error (attempt 1/3):", err
```

---

## ✅ Checklist ก่อน Production

- [ ] ลบ TEST MODE badge จาก test.html
- [ ] ตั้งค่า FUNCTION_API_KEY สำหรับ authentication
- [ ] เปิด Supabase RLS (Row Level Security)
- [ ] ตรวจสอบ Rate Limiting
- [ ] Backup database ก่อน deploy
- [ ] ทดสอบกับ real users (10-20 คน)
- [ ] Monitor logs ใน Supabase Dashboard
- [ ] Setup error alerting (Sentry/DataDog)

---

## 🆘 Troubleshooting

### **Problem: "Deno is not defined"**
**Solution:** ไฟล์ crm-pro.ts เป็น Deno runtime สำหรับ Supabase Edge Functions - error นี้ปกติใน VS Code (ไม่กระทบการทำงาน)

### **Problem: Phone validation ไม่ทำงาน**
**Solution:** ตรวจสอบว่ามี `@input="onPhoneInput"` ใน input element

### **Problem: LINE broadcast ไม่ส่ง**
**Solution:** 
1. ตรวจสอบ LINE_CHANNEL_ACCESS_TOKEN
2. ดู logs ว่า retry กี่ครั้ง
3. เช็ค LINE API quota

### **Problem: Edge function timeout**
**Solution:**
- ลด LINE_CHUNK_SIZE จาก 500 เป็น 200
- เพิ่ม CHUNK_DELAY_MS จาก 200 เป็น 500

---

## 📚 Additional Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [LINE Messaging API Docs](https://developers.line.biz/en/docs/messaging-api/)
- [Deno Deploy Docs](https://deno.com/deploy/docs)

---

**Version:** 1.0.0  
**Last Updated:** 2025-12-30  
**Status:** ✅ Ready for Testing
