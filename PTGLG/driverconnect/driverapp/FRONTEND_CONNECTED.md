# ✅ Frontend เชื่อมต่อแล้ว! แต่ต้องตั้งค่า Secrets

## สิ่งที่แก้ไขแล้ว ✅

1. **เพิ่ม Edge Functions API Client**
   ```html
   <script src="js/edge-functions-api.js"></script>
   ```

2. **แก้ไข SupabaseAPI ให้เรียก Edge Functions**
   - `search()` → `EdgeFunctionsAPI.searchJob()`
   - `updateStop()` → `EdgeFunctionsAPI.updateStop()`
   - `uploadAlcohol()` → `EdgeFunctionsAPI.uploadAlcohol()`
   - `closeJob()` → `EdgeFunctionsAPI.closeJob()`
   - `endTrip()` → `EdgeFunctionsAPI.endTrip()`

---

## ⚠️ ขั้นตอนสุดท้าย: ตั้งค่า Secrets (สำคัญมาก!)

### Step 1: หา Service Role Key

1. เข้า https://supabase.com/dashboard/project/myplpshpcordggbbtblg/settings/api
2. หา **"Project API keys"**
3. Copy **"service_role"** key (⚠️ **ไม่ใช่** "anon" key!)

ตัวอย่าง:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

### Step 2: ตั้งค่า Secrets

รันคำสั่งเหล่านี้:

```bash
cd D:\VS_Code_GitHub_DATA\eddication.io\eddication.io

supabase secrets set SUPABASE_URL=https://myplpshpcordggbbtblg.supabase.co

supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<paste-your-service-role-key-here>
```

### Step 3: ตรวจสอบว่าตั้งค่าแล้ว

```bash
supabase secrets list
```

ควรเห็น:
```
┌──────────────────────────────┬─────────────────┐
│ Name                         │ Value           │
├──────────────────────────────┼─────────────────┤
│ SUPABASE_URL                 │ https://mypl... │
│ SUPABASE_SERVICE_ROLE_KEY    │ eyJhbGciOi...   │
└──────────────────────────────┴─────────────────┘
```

---

## 🧪 Test ว่าเชื่อมต่อได้

### Test 1: เปิดหน้าเว็บ

1. เปิด `index-supabase.html`
2. เปิด **Browser DevTools** (F12)
3. ไปที่ tab **Console**
4. ค้นหางาน (ใส่ reference)

ควรเห็น logs:
```
🔍 [API] Searching job: TEST001
✅ [API] Job found: 3 stops
```

### Test 2: Test ด้วย curl

```bash
curl -X POST https://myplpshpcordggbbtblg.supabase.co/functions/v1/search-job ^
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." ^
  -H "Content-Type: application/json" ^
  -d "{\"reference\":\"TEST001\",\"userId\":\"U1234\"}"
```

ควรได้ response:
```json
{
  "success": true,
  "data": {
    "referenceNo": "TEST001",
    "vehicleDesc": "...",
    "stops": [...]
  }
}
```

### Test 3: ดู Function Logs

```bash
supabase functions logs search-job --tail
```

ควรเห็น logs เมื่อมีการเรียก API

---

## 🆘 Troubleshooting

### ❌ Error: "SUPABASE_URL is not defined"
**สาเหตุ:** ยังไม่ได้ตั้งค่า secrets

**แก้:**
```bash
supabase secrets set SUPABASE_URL=https://myplpshpcordggbbtblg.supabase.co
```

### ❌ Error: "SUPABASE_SERVICE_ROLE_KEY is not defined"
**สาเหตุ:** ยังไม่ได้ตั้งค่า service role key

**แก้:**
```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-key>
```

### ❌ Error: "Failed to fetch"
**สาเหตุ:** 
- Network issue
- Function ยังไม่ deploy
- CORS issue

**แก้:**
1. ตรวจสอบ internet connection
2. ตรวจสอบว่า function deploy แล้ว: `supabase functions list`
3. ดู logs: `supabase functions logs search-job`

### ❌ Error: "Database error"
**สาเหตุ:** Service role key ไม่ถูกต้อง

**แก้:** Copy service role key ใหม่จาก dashboard

### ❌ หน้าเว็บไม่โหลด
**สาเหตุ:** `edge-functions-api.js` ไม่เจอ

**แก้:** ตรวจสอบว่าไฟล์อยู่ที่ `PTGLG/driverconnect/driverapp/js/edge-functions-api.js`

---

## 📊 ก่อนและหลัง

### ❌ ก่อน (Direct Supabase)
```
Frontend → Supabase Database
```
- ไม่ปลอดภัย (client มี access โดยตรง)
- ไม่มี business logic ใน backend
- ไม่มี logging

### ✅ หลัง (Edge Functions)
```
Frontend → Edge Functions → Supabase Database
```
- ปลอดภัย (service role key อยู่ฝั่ง backend)
- มี business logic ใน backend
- มี logging และ monitoring
- มี validation

---

## ✅ Checklist

- [x] Deploy functions
- [x] เพิ่ม edge-functions-api.js ใน HTML
- [x] แก้ไข SupabaseAPI ให้เรียก EdgeFunctionsAPI
- [ ] **ตั้งค่า SUPABASE_URL secret** ← ทำตอนนี้!
- [ ] **ตั้งค่า SUPABASE_SERVICE_ROLE_KEY secret** ← ทำตอนนี้!
- [ ] Test search job
- [ ] Test update stop
- [ ] Test upload alcohol
- [ ] Test close job
- [ ] Test end trip

---

## 🎯 คำสั่งที่ต้องรันตอนนี้

```bash
# 1. ตั้งค่า SUPABASE_URL
supabase secrets set SUPABASE_URL=https://myplpshpcordggbbtblg.supabase.co

# 2. ตั้งค่า SUPABASE_SERVICE_ROLE_KEY (แทนที่ด้วย key จริง)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...YOUR_KEY...

# 3. ตรวจสอบ
supabase secrets list

# 4. Test
curl -X POST https://myplpshpcordggbbtblg.supabase.co/functions/v1/search-job ^
  -H "Authorization: Bearer YOUR_ANON_KEY" ^
  -H "Content-Type: application/json" ^
  -d "{\"reference\":\"TEST001\",\"userId\":\"U1234\"}"
```

---

**รันคำสั่งเหล่านี้แล้วลองเปิดหน้าเว็บใหม่ครับ! 🚀**
