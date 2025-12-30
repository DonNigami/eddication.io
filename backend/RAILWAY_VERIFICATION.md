# Railway Deployment Verification Checklist

ใช้ checklist นี้เพื่อตรวจสอบว่า Railway deployment เรียบร้อยหรือไม่

---

## 🚀 Step 1: ตรวจสอบ Deployment Status

**ไปที่:** https://railway.app/dashboard

### ✅ ต้องเห็น:
```
Backend Service:
- Status: ✅ "Healthy" (สีเขียว) หรือ "Running" 
- ไม่มี Error messages สีแดง
```

**ถ้าเห็น:**
- 🔴 "Failed" → Deploy ไม่สำเร็จ ต้องดู Logs
- 🟡 "Building" → รอสักครู่
- 🟢 "Running" → ถูกต้อง ✅

---

## 📋 Step 2: ตรวจสอบ Environment Variables

**ไปที่:** Backend Service → Variables

### ✅ ต้องมีครบ:
```
☑️ NODE_ENV = production
☑️ PORT = 3000
☑️ SUPABASE_URL = https://rwqgxdjcwrglbwlruyty.supabase.co
☑️ SUPABASE_SERVICE_KEY = (มีค่า ไม่ว่าง)
☑️ LINE_CHANNEL_ACCESS_TOKEN = (มีค่า ไม่ว่าง)
☑️ LINE_CHANNEL_SECRET = (มีค่า ไม่ว่าง)
```

**ถ้าขาดตัวไหน:**
```
Railway → Variables → Add New Variable
เพิ่มให้ครบตามด้านบน
```

---

## 🔍 Step 3: ตรวจสอบ Logs

**ไปที่:** Backend Service → Deployments → Logs (ปุ่มสีดำ)

### ✅ ต้องเห็น (บรรทัดแรกๆ):
```
[timestamp] 🔧 Initializing Google Sheets connection...
[timestamp] ✅ Google Sheets connected
[timestamp] 🔧 Initializing services...
[timestamp] ✅ Services initialized
[timestamp] ✅ Broadcast Scheduler started - checking every 30 seconds
[timestamp] Server running on port 3000
```

### ❌ ไม่ควรเห็น:
```
ERROR
Cannot find module
ENOENT
undefined
Connection refused
Failed to authenticate
```

**ถ้าเห็น ERROR:**
```bash
1. อ่าน error message ให้เพิ่มเติม
2. หาคำว่า "Error" ทั้งหมด
3. ดูว่า error เกิดจากอะไร:
   - Supabase not connected?
   - Missing variable?
   - Module not found?
```

---

## 🧪 Step 4: ทดสอบ Broadcast ส่งจริง

### วิธีที่ 1: ตั้งเวลาส่ง + ทดสอบ

**ใน Frontend (project/crm/test.html):**
```
1. Login as Admin
2. ส่งข้อความ (Broadcast)
3. เลือก Target: "all"
4. Type: "text"
5. Message: "Test Broadcast 🎯"
6. ตั้งเวลาส่ง: 1 นาทีข้างหน้า (เช่นตอนนี้ 14:00 → ตั้ง 14:01)
7. คลิก "ยืนยันการส่ง"
```

**ตรวจสอบ Supabase:**
```sql
SELECT * FROM broadcast_queue 
WHERE message LIKE 'Test Broadcast%'
ORDER BY created_at DESC 
LIMIT 5;
```

### ✅ ต้องเห็น:
```
id | target | msg_type | message | scheduled_at | status | created_at
1  | all    | text     | Test... | 2025-12-30 14:01:00 | scheduled | 2025-12-30 14:00:00
```

### ⏳ รอ 1 นาทีแล้วตรวจสอบใหม่:
```sql
SELECT * FROM broadcast_queue 
WHERE message LIKE 'Test Broadcast%'
ORDER BY created_at DESC 
LIMIT 5;
```

### ✅ ต้องเห็น Status เปลี่ยนเป็น:
```
status = 'sent'  ← เปลี่ยนจาก 'scheduled'
```

**ถ้ายังเป็น 'scheduled':**
- Scheduler ยังไม่ส่งเสร็จ รอต่อไป (max 30 วินาทีต่อ check)
- หรือ Scheduler ไม่ทำงาน → ดู Logs ใน Railway

---

## 🔗 Step 5: ตรวจสอบ Service URL

**ไปที่:** Backend Service → Deployments

### ✅ ต้องเห็น:
```
Railway URL: https://crm-backend-[random].up.railway.app
Status: ✅ Active/Running
```

**Copy URL นี้:** 
```
https://crm-backend-[random].up.railway.app
```

ใช้ทดสอบ API:
```bash
curl https://crm-backend-[random].up.railway.app/
# ควรได้ response (ไม่ได้ error 404 หรือ 500)
```

---

## 📊 Step 6: ตรวจสอบ Database Connection

**ใน Supabase Dashboard:**

```sql
-- ตรวจสอบตาราง broadcast_queue มีข้อมูลหรือไม่
SELECT COUNT(*) as total_broadcasts FROM broadcast_queue;

-- ตรวจสอบข้อความที่ส่งแล้ว
SELECT COUNT(*) as sent_count FROM broadcast_queue WHERE status = 'sent';

-- ตรวจสอบข้อความที่ค้างอยู่
SELECT COUNT(*) as pending_count FROM broadcast_queue WHERE status = 'scheduled';
```

### ✅ ถ้า query ส่งได้ = Database connection OK ✅

---

## 🎯 Final Verification Checklist

```
✅ Railway Status = Running (Green)
✅ Environment Variables = ครบทั้ง 6 ตัว
✅ Logs = "Broadcast Scheduler started"
✅ Test Broadcast = Status เปลี่ยนเป็น 'sent'
✅ Service URL = ทำงาน (ไม่ error)
✅ Database = มีข้อมูล broadcasted
```

### ถ้า ✅ ทั้งหมด → **ทำเสร็จแล้ว! 🎉**

---

## ❌ Troubleshooting Quick Guide

| ปัญหา | วิธีแก้ |
|------|-------|
| Status = Failed | ดู Logs ค้นหา ERROR |
| Scheduler ไม่ start | ตรวจสอบ env vars ครบ? |
| Broadcast ไม่ส่ง | ตรวจสอบ LINE_CHANNEL_ACCESS_TOKEN ถูกต้อง |
| Port error | Railway จะจัดการเอง ไม่ต้องห่วง |
| Connection timeout | ตรวจสอบ SUPABASE_URL ถูกต้อง |
| Service URL error 404 | ต้องเพิ่ม endpoint ใน server.js (เช่น `/api/health`) |

---

**📖 ท่านอ่านจนบรรทัดนี้ให้บอกผล:**
- ✅ ทุกอย่างเรียบร้อย
- ⚠️ มีข้อมูลบางอย่าง
- ❌ มีปัญหา (บอกอะไร)
