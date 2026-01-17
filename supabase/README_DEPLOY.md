# 🚀 Deploy Instructions - ทำเอง!

## ผมสร้าง script ที่ทำทุกอย่างให้แล้วครับ!

### ✨ วิธีใช้ (ง่ายมาก!)

#### **Windows:**
```cmd
cd D:\VS_Code_GitHub_DATA\eddication.io\eddication.io\supabase
deploy-all-functions.bat
```

หรือ **Double-click** ไฟล์ `deploy-all-functions.bat` ใน File Explorer

#### **Mac/Linux:**
```bash
cd /path/to/project/supabase
chmod +x deploy-all-functions.sh
./deploy-all-functions.sh
```

---

## 📋 Script จะทำอะไรให้คุณ

### ✅ Step 1: ตรวจสอบ Supabase CLI
- เช็คว่าติดตั้งแล้วหรือยัง
- ถ้ายัง → บอกให้ติดตั้ง `npm install -g supabase`

### ✅ Step 2: Login
- เช็คว่า login แล้วหรือยัง
- ถ้ายัง → เปิด browser ให้ authorize

### ✅ Step 3: Link Project
- Link กับ project `myplpshpcordggbbtblg`
- อาจถามรหัส database

### ✅ Step 4: Deploy Functions (ทั้งหมด 5 ตัว)
1. search-job ✅
2. update-stop ✅
3. upload-alcohol ✅
4. close-job ✅
5. end-trip ✅

### ✅ Step 5: Verify
- แสดงรายการ functions ที่ deploy แล้ว

---

## ⚠️ สิ่งที่คุณต้องทำเอง (หลัง deploy)

### 1. หา Service Role Key

1. เข้า https://supabase.com/dashboard/project/myplpshpcordggbbtblg/settings/api
2. หาส่วน **"Project API keys"**
3. Copy **"service_role"** key (⚠️ ไม่ใช่ "anon" key!)

### 2. ตั้งค่า Secrets

```bash
# ตั้งค่า URL
supabase secrets set SUPABASE_URL=https://myplpshpcordggbbtblg.supabase.co

# ตั้งค่า Service Role Key (แทนที่ YOUR_KEY ด้วย key จริง)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...YOUR_KEY_HERE...
```

---

## 🧪 ทดสอบว่า Deploy สำเร็จ

### Test ด้วย curl:
```bash
curl -X POST https://myplpshpcordggbbtblg.supabase.co/functions/v1/search-job ^
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15cGxwc2hwY29yZGdnYmJ0YmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MDI2ODgsImV4cCI6MjA4Mzk3ODY4OH0.UC42xLgqSdqgaogHmyRpES_NMy5t1j7YhdEZVwWUsJ8" ^
  -H "Content-Type: application/json" ^
  -d "{\"reference\":\"TEST001\",\"userId\":\"U1234\"}"
```

### ดู logs:
```bash
supabase functions logs search-job --tail
```

---

## 🆘 ถ้ามีปัญหา

### ❌ "supabase: command not found"
```bash
npm install -g supabase
```

### ❌ "Failed to link project"
- ตรวจสอบ internet connection
- ตรวจสอบว่า login แล้ว: `supabase login`
- ลอง link ใหม่: `supabase link --project-ref myplpshpcordggbbtblg`

### ❌ "Deploy failed"
- ดู error message
- ตรวจสอบ syntax: `deno check supabase/functions/search-job/index.ts`
- ลอง deploy ทีละตัว

### ❌ "Function returns 500 error"
- ตรวจสอบว่าตั้งค่า secrets แล้ว: `supabase secrets list`
- ดู logs: `supabase functions logs search-job --tail`

---

## 📝 Summary

1. **รัน script**: `deploy-all-functions.bat`
2. **รอให้มัน deploy เสร็จ** (~2-3 นาที)
3. **ตั้งค่า secrets** (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
4. **Test endpoints** ด้วย curl หรือ Postman
5. **Update frontend** ให้ใช้ EdgeFunctionsAPI

---

## ✅ Checklist

- [ ] รัน `deploy-all-functions.bat`
- [ ] Login to Supabase (script จะถาม)
- [ ] Link project (script จะทำให้)
- [ ] Deploy 5 functions (script จะทำให้)
- [ ] ตั้งค่า SUPABASE_URL secret
- [ ] ตั้งค่า SUPABASE_SERVICE_ROLE_KEY secret
- [ ] Test endpoint ด้วย curl
- [ ] ดู logs ว่า function ทำงาน
- [ ] Update frontend code

---

**ง่ายแค่นี้!** รันแค่ 1 script แล้วทำงานให้เกือบหมด 🎉

มี error บอกผมนะครับ! 🚀
