# 🔧 Quick Fix - Deploy Commands

## ปัญหา: Path not found

**สาเหตุ:** รันคำสั่งจาก directory ที่ผิด

---

## ✅ วิธีแก้ (รันทีละคำสั่ง)

### Step 1: เปลี่ยน Directory ไปที่ ROOT (สำคัญ!)
```cmd
cd D:\VS_Code_GitHub_DATA\eddication.io\eddication.io
```

### Step 2: ตรวจสอบว่าอยู่ที่ถูกต้อง
```cmd
dir supabase\functions\search-job\index.ts
```
**ต้องเห็นไฟล์!** ถ้าไม่เห็น = อยู่ directory ผิด

### Step 3: Deploy ทีละตัว
```cmd
supabase functions deploy search-job --no-verify-jwt
```

```cmd
supabase functions deploy update-stop --no-verify-jwt
```

```cmd
supabase functions deploy upload-alcohol --no-verify-jwt
```

```cmd
supabase functions deploy close-job --no-verify-jwt
```

```cmd
supabase functions deploy end-trip --no-verify-jwt
```

---

## ⚡ หรือใช้คำสั่งเดียว (Deploy ทั้งหมด)

```cmd
cd D:\VS_Code_GitHub_DATA\eddication.io\eddication.io
supabase functions deploy --no-verify-jwt
```

---

## 🧪 ตรวจสอบว่า Deploy สำเร็จ

```cmd
supabase functions list
```

ควรเห็น:
```
┌─────────────────┬──────────────┬─────────┬────────────────────┐
│ Name            │ Status       │ Version │ Created            │
├─────────────────┼──────────────┼─────────┼────────────────────┤
│ search-job      │ active       │ 1       │ 2026-01-17 05:00   │
│ update-stop     │ active       │ 1       │ 2026-01-17 05:00   │
│ upload-alcohol  │ active       │ 1       │ 2026-01-17 05:00   │
│ close-job       │ active       │ 1       │ 2026-01-17 05:00   │
│ end-trip        │ active       │ 1       │ 2026-01-17 05:00   │
└─────────────────┴──────────────┴─────────┴────────────────────┘
```

---

## 📝 After Deploy: ตั้งค่า Secrets

```cmd
supabase secrets set SUPABASE_URL=https://myplpshpcordggbbtblg.supabase.co

supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

**หา Service Role Key:**
https://supabase.com/dashboard/project/myplpshpcordggbbtblg/settings/api

---

## 🎯 Key Points

1. ❌ **ผิด**: รันจาก `D:\...\supabase\` directory
2. ✅ **ถูก**: รันจาก `D:\...\eddication.io\` directory (root)

Supabase CLI ต้องการ:
```
<root>/
  supabase/
    functions/
      search-job/
        index.ts
```

---

ลองรันใหม่ตามนี้ครับ! 🚀
