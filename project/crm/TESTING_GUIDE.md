# 🧪 คู่มือทดสอบ CRM Pro System

## ✅ สถานะปัจจุบัน

- ✅ Supabase CLI ติดตั้งแล้ว (v2.67.1)
- ✅ Edge Function `crm-pro` deploy แล้ว
- ✅ Database tables สร้างแล้ว (`transaction_history`, `audit_logs`)
- ✅ Secrets ตั้งค่าครบแล้ว (LINE, Telegram, Supabase)
- ✅ test.html เชื่อมกับ crm-pro แล้ว

---

## 🎯 ขั้นตอนทดสอบ

### 1. เปิด test.html

**Option A: ใช้ Python HTTP Server**
```powershell
# เปิด server ที่ port 8000
python -m http.server 8000

# เข้าที่: http://localhost:8000/test.html
```

**Option B: ใช้ VS Code Live Server**
```
1. ติดตั้ง extension "Live Server"
2. คลิกขวาที่ test.html
3. เลือก "Open with Live Server"
```

**Option C: Deploy บน GitHub Pages**
```powershell
# Commit และ push ไป GitHub
git add .
git commit -m "Add CRM Pro v2.0"
git push

# ตั้งค่า GitHub Pages ใน Settings
```

### 2. เข้าผ่าน LINE LIFF

1. เปิด LINE App
2. ไปที่ Official Account ของคุณ
3. เปิด LIFF App (test.html)
4. Login ด้วย LINE Account

### 3. ทดสอบ Broadcast

**สำหรับ Admin:**
1. เข้าแท็บ "Broadcast"
2. เลือก Target: **test** (ส่งให้ตัวเองก่อน)
3. เลือก Message Type: **text**
4. พิมพ์ข้อความ: "ทดสอบระบบ CRM Pro v2.0"
5. กด "ส่งข้อความ"

**ผลที่คาดหวัง:**
- ✅ แสดง SweetAlert "สำเร็จ"
- ✅ ได้รับข้อความใน LINE Chat
- ✅ บันทึกใน `audit_logs` table

### 4. ทดสอบ Update Points

**สำหรับ Admin:**
1. เข้าแท็บ "Customers"
2. เลือกลูกค้าคนหนึ่ง → คลิก "แก้ไข"
3. ปรับคะแนน (เช่น +100)
4. กด "บันทึกข้อมูล"

**ผลที่คาดหวัง:**
- ✅ คะแนนอัพเดทสำเร็จ
- ✅ บันทึกใน `transaction_history` table

---

## 🔍 ตรวจสอบข้อมูล

### ดู Audit Logs

```sql
-- ไปที่ Supabase SQL Editor
SELECT 
    action,
    actor_id,
    target_type,
    target_count,
    success_count,
    failed_count,
    created_at
FROM audit_logs
ORDER BY created_at DESC
LIMIT 10;
```

### ดู Transaction History

```sql
SELECT 
    user_id,
    points_change,
    points_before,
    points_after,
    reason,
    created_by,
    created_at
FROM transaction_history
ORDER BY created_at DESC
LIMIT 10;
```

### ดู Function Logs

```powershell
# Real-time logs
supabase functions logs crm-pro --tail

# Recent logs only
supabase functions logs crm-pro
```

---

## 🐛 Troubleshooting

### ปัญหา: ไม่ได้รับข้อความ LINE

**สาเหตุที่เป็นไปได้:**
1. LINE_CHANNEL_ACCESS_TOKEN ไม่ถูกต้อง
2. User ID ไม่ถูกต้อง
3. Channel ไม่มีสิทธิ์ส่งข้อความ

**วิธีแก้:**
```powershell
# ตรวจสอบ logs
supabase functions logs crm-pro --tail

# ดู error message ใน browser console (F12)
```

### ปัญหา: Transaction History ไม่บันทึก

**สาเหตุที่เป็นไปได้:**
1. Table `transaction_history` ไม่มี
2. RLS policy block การ insert
3. Edge Function error

**วิธีแก้:**
```sql
-- ตรวจสอบว่า table มีหรือไม่
SELECT * FROM transaction_history LIMIT 1;

-- ตรวจสอบ RLS policies
SELECT * FROM pg_policies WHERE tablename = 'transaction_history';

-- ทดสอบ insert โดยตรง
INSERT INTO transaction_history (
    user_id, points_change, points_before, points_after, 
    action, reason, created_by
) VALUES (
    'test123', 100, 0, 100, 
    'manual_test', 'Testing', 'admin'
);
```

### ปัญหา: "Unauthorized: Invalid API Key"

**สาเหตุ:**
- FUNCTION_API_KEY ตั้งค่าไว้ แต่ test.html ไม่ส่ง API Key

**วิธีแก้:**
```powershell
# Option 1: ปิด API Key Authentication (แนะนำสำหรับ TEST)
supabase secrets unset FUNCTION_API_KEY

# Option 2: เพิ่ม API Key ใน test.html (ไม่แนะนำ - unsafe)
# แก้ไขใน test.html:
# headers: {
#   'Authorization': 'Bearer YOUR_API_KEY'
# }
```

### ปัญหา: "Rate limit exceeded"

**สาเหตุ:**
- ส่ง request มากกว่า 100 ครั้งภายใน 1 นาที

**วิธีแก้:**
```typescript
// แก้ใน crm-pro.ts
const RATE_LIMIT_MAX = 200; // เพิ่มจาก 100

// Deploy ใหม่
supabase functions deploy crm-pro --no-verify-jwt
```

---

## 📊 Test Cases

### Test Case 1: Broadcast to Test User

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | เลือก Target: test | - |
| 2 | พิมพ์ข้อความ | - |
| 3 | กดส่ง | แสดง "สำเร็จ" |
| 4 | ตรวจสอบ LINE | ได้รับข้อความ |
| 5 | ตรวจสอบ audit_logs | มีข้อมูลใหม่ |

### Test Case 2: Broadcast to All Users

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | เลือก Target: all | - |
| 2 | พิมพ์ข้อความ | - |
| 3 | กดส่ง | แสดงจำนวนที่ส่งสำเร็จ |
| 4 | ตรวจสอบ audit_logs | target_count = จำนวน users |

### Test Case 3: Update Customer Points

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | เลือกลูกค้า | - |
| 2 | ปรับคะแนน +100 | - |
| 3 | บันทึก | แสดง "สำเร็จ" |
| 4 | ตรวจสอบ profiles table | points เพิ่ม 100 |
| 5 | ตรวจสอบ transaction_history | มีข้อมูลใหม่ |

### Test Case 4: Update Customer Points (Negative)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | เลือกลูกค้า (points = 50) | - |
| 2 | ปรับคะแนน -100 | - |
| 3 | บันทึก | points = 0 (ไม่ติดลบ) |
| 4 | ตรวจสอบ transaction_history | points_after = 0 |

---

## 🧪 API Testing (ใช้ curl)

### Test 1: Update Points

```powershell
curl -X POST https://ckhwouxtrvuthefkxnxb.supabase.co/functions/v1/crm-pro `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer <anon-key>" `
  -d '{
    "action": "update-points",
    "userId": "U1234567890abcdef",
    "points": 100,
    "reason": "Test via curl",
    "adminId": "test-admin"
  }'
```

### Test 2: Broadcast

```powershell
curl -X POST https://ckhwouxtrvuthefkxnxb.supabase.co/functions/v1/crm-pro `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer <anon-key>" `
  -d '{
    "action": "broadcast",
    "target": "test",
    "testUserId": "U1234567890abcdef",
    "msgType": "text",
    "message": "Test broadcast from curl",
    "adminId": "test-admin"
  }'
```

---

## 📝 Checklist ก่อน Production

- [ ] ทดสอบ Broadcast ส่งถึงผู้ใช้จริง
- [ ] ทดสอบ Update Points บันทึก transaction_history
- [ ] ทดสอบ Audit Logs บันทึกครบถ้วน
- [ ] ตรวจสอบ RLS policies ทำงานถูกต้อง
- [ ] ตรวจสอบ Rate Limiting ทำงาน
- [ ] ทดสอบ Error Handling (network error, invalid data)
- [ ] ตั้งค่า FUNCTION_API_KEY สำหรับ production
- [ ] Review Secrets ใน Supabase Dashboard
- [ ] Backup database ก่อน launch
- [ ] เตรียม monitoring และ alerting

---

## 🔗 Quick Links

- **Supabase Dashboard:** https://supabase.com/dashboard/project/ckhwouxtrvuthefkxnxb
- **SQL Editor:** https://supabase.com/dashboard/project/ckhwouxtrvuthefkxnxb/sql/new
- **Functions Logs:** https://supabase.com/dashboard/project/ckhwouxtrvuthefkxnxb/logs/edge-functions
- **Database Editor:** https://supabase.com/dashboard/project/ckhwouxtrvuthefkxnxb/editor

---

## 📞 Commands Reference

```powershell
# ดู function logs
supabase functions logs crm-pro --tail

# ดู secrets
supabase secrets list

# Deploy function ใหม่
supabase functions deploy crm-pro --no-verify-jwt

# Push database changes
supabase db push

# Pull database schema
supabase db pull
```

---

**Version:** 2.0.0  
**Status:** ✅ Ready for Testing  
**Last Updated:** 2025-12-30
