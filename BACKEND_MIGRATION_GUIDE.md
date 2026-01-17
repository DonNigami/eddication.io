# Backend Migration Guide

## 📋 Overview

โปรเจคนี้ได้สร้าง **Supabase Edge Functions** เป็น Backend API Layer แทนการเรียก Supabase โดยตรงจาก frontend

### ✅ สิ่งที่สร้างเสร็จแล้ว

1. **Edge Functions (TypeScript + Deno)** - 7 ไฟล์
   - `types.ts` - Type definitions
   - `utils.ts` - Shared utilities
   - `search-job.ts` - ค้นหางาน
   - `update-stop.ts` - อัปเดตสถานะ stop
   - `upload-alcohol.ts` - บันทึกการตรวจแอลกอฮอล์
   - `close-job.ts` - ปิดงาน
   - `end-trip.ts` - จบทริป

2. **Frontend API Client** - `js/edge-functions-api.js`
   - Wrapper สำหรับเรียก Edge Functions
   - Auto-retry with exponential backoff
   - Timeout handling
   - Error handling

3. **Deployment Scripts**
   - `deploy-functions.bat` (Windows)
   - `deploy-functions.sh` (Mac/Linux)

4. **Documentation**
   - `functions/README.md` - Complete API documentation

---

## 🚀 วิธี Deploy Backend

### Step 1: ติดตั้ง Supabase CLI

```bash
npm install -g supabase
```

### Step 2: Deploy Functions

**Windows:**
```cmd
cd D:\VS_Code_GitHub_DATA\eddication.io\eddication.io\supabase
.\deploy-functions.bat
```

**Mac/Linux:**
```bash
cd /path/to/project/supabase
chmod +x deploy-functions.sh
./deploy-functions.sh
```

**หรือทำ manual:**
```bash
supabase login
supabase link --project-ref myplpshpcordggbbtblg
cd supabase/functions
supabase functions deploy search-job --no-verify-jwt
supabase functions deploy update-stop --no-verify-jwt
supabase functions deploy upload-alcohol --no-verify-jwt
supabase functions deploy close-job --no-verify-jwt
supabase functions deploy end-trip --no-verify-jwt
```

### Step 3: ตั้งค่า Environment Variables

```bash
supabase secrets set SUPABASE_URL=https://myplpshpcordggbbtblg.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

**หา Service Role Key:**
1. เข้า https://supabase.com/dashboard/project/myplpshpcordggbbtblg
2. Settings → API
3. Copy "service_role" key (ไม่ใช่ "anon" key)

---

## 🔄 วิธี Update Frontend

### ตอนนี้: เรียก Supabase โดยตรง

```javascript
// ❌ Old way - Direct Supabase call
const { data, error } = await supabase
  .from('jobdata')
  .select('*')
  .eq('reference', reference);
```

### ต่อไป: เรียกผ่าน Edge Functions

#### วิธีที่ 1: ใช้ `EdgeFunctionsAPI` (แนะนำ)

```javascript
// ✅ New way - Through Edge Functions
// 1. เพิ่ม script tag ใน HTML
<script src="js/edge-functions-api.js"></script>

// 2. เรียกใช้ใน code
const result = await EdgeFunctionsAPI.searchJob(reference, userId);
if (result.success) {
  console.log(result.data);
} else {
  console.error(result.message);
}
```

#### วิธีที่ 2: เรียก Fetch โดยตรง

```javascript
const response = await fetch(
  'https://myplpshpcordggbbtblg.supabase.co/functions/v1/search-job',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + supabaseAnonKey
    },
    body: JSON.stringify({ reference, userId })
  }
);
const result = await response.json();
```

---

## 📝 ตัวอย่างการแก้ไข Frontend

### 1. Search Job

**เดิม:**
```javascript
const SupabaseAPI = {
  async search(reference, userId) {
    const { data: jobData, error } = await supabase
      .from('jobdata')
      .select('*')
      .eq('reference', reference);
    // ... processing
  }
}
```

**ใหม่:**
```javascript
const SupabaseAPI = {
  async search(reference, userId) {
    return await EdgeFunctionsAPI.searchJob(reference, userId);
  }
}
```

### 2. Update Stop

**เดิม:**
```javascript
async updateStop(params) {
  const { data, error } = await supabase
    .from('jobdata')
    .update(updates)
    .eq('id', rowIndex);
  // ... processing
}
```

**ใหม่:**
```javascript
async updateStop(params) {
  return await EdgeFunctionsAPI.updateStop(params);
}
```

### 3. Upload Alcohol

**เดิม:**
```javascript
async uploadAlcohol(params) {
  // Upload to storage
  const { data: uploadData } = await supabase.storage
    .from('images')
    .upload(fileName, imageBytes);
  
  // Insert record
  const { data, error } = await supabase
    .from('alcohol_checks')
    .insert({ ... });
}
```

**ใหม่:**
```javascript
async uploadAlcohol(params) {
  return await EdgeFunctionsAPI.uploadAlcohol(params);
}
```

---

## 🧪 วิธีทดสอบ

### Test ใน Browser Console

```javascript
// Test search
EdgeFunctionsAPI.searchJob('TEST001', 'U1234567').then(console.log);

// Test update stop
EdgeFunctionsAPI.updateStop({
  rowIndex: 1,
  status: 'IN_TRANSIT',
  type: 'checkin',
  userId: 'U1234567',
  lat: 13.7563,
  lng: 100.5018
}).then(console.log);
```

### Test ด้วย curl

```bash
curl -X POST \
  https://myplpshpcordggbbtblg.supabase.co/functions/v1/search-job \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reference":"TEST001","userId":"U1234"}'
```

---

## 📊 ตรวจสอบ Logs

```bash
# ดู logs ของ function
supabase functions logs search-job

# ดู logs แบบ real-time
supabase functions logs search-job --tail

# ดู logs ทั้งหมด
supabase functions logs
```

---

## ⚠️ Important Notes

### 1. CORS
- Edge Functions มี CORS headers configured แล้ว
- สามารถเรียกจาก domain ไหนก็ได้

### 2. Authentication
- ใช้ Anon Key จาก frontend
- Backend ใช้ Service Role Key (server-side only)

### 3. Rate Limiting
- Supabase มี rate limiting built-in
- Free plan: 500,000 requests/month
- ถ้าเกิน ต้อง upgrade plan

### 4. Timeout
- Default timeout: 30 seconds
- ปรับได้ใน `edge-functions-api.js`

### 5. Retry Logic
- Auto-retry 3 ครั้งถ้า network error
- Exponential backoff (1s → 2s → 4s)

---

## 🎯 Migration Checklist

### Backend (เสร็จแล้ว ✅)
- [x] สร้าง types.ts
- [x] สร้าง utils.ts
- [x] สร้าง search-job.ts
- [x] สร้าง update-stop.ts
- [x] สร้าง upload-alcohol.ts
- [x] สร้าง close-job.ts
- [x] สร้าง end-trip.ts
- [x] สร้าง edge-functions-api.js
- [x] สร้าง deploy scripts
- [x] สร้าง documentation

### Deployment (รอทำ)
- [ ] Login to Supabase CLI
- [ ] Link project
- [ ] Deploy functions
- [ ] Set environment variables
- [ ] Test endpoints

### Frontend Update (รอทำ)
- [ ] เพิ่ม `<script src="js/edge-functions-api.js"></script>` ใน HTML
- [ ] แก้ `SupabaseAPI.search()` ให้เรียก `EdgeFunctionsAPI.searchJob()`
- [ ] แก้ `SupabaseAPI.updateStop()` ให้เรียก `EdgeFunctionsAPI.updateStop()`
- [ ] แก้ `SupabaseAPI.uploadAlcohol()` ให้เรียก `EdgeFunctionsAPI.uploadAlcohol()`
- [ ] แก้ `SupabaseAPI.closeJob()` ให้เรียก `EdgeFunctionsAPI.closeJob()`
- [ ] แก้ `SupabaseAPI.endTrip()` ให้เรียก `EdgeFunctionsAPI.endTrip()`
- [ ] ทดสอบทุก feature
- [ ] ลบ direct Supabase calls ที่ไม่ใช้แล้ว

### Testing (รอทำ)
- [ ] ทดสอบ search job
- [ ] ทดสอบ check-in/check-out
- [ ] ทดสอบ alcohol check + image upload
- [ ] ทดสอบ close job
- [ ] ทดสอบ end trip
- [ ] ทดสอบ offline queue sync
- [ ] ทดสอบ realtime updates

---

## 📚 Resources

- **Edge Functions Docs**: https://supabase.com/docs/guides/functions
- **Project Dashboard**: https://supabase.com/dashboard/project/myplpshpcordggbbtblg
- **Local Files**:
  - Backend: `supabase/functions/`
  - Frontend Client: `PTGLG/driverconnect/driverapp/js/edge-functions-api.js`
  - Documentation: `supabase/functions/README.md`

---

## 🆘 Troubleshooting

### ปัญหา: Deploy ไม่สำเร็จ
```bash
# ตรวจสอบว่า login แล้วหรือยัง
supabase status

# ตรวจสอบว่า link project แล้วหรือยัง
cat .supabase/project-ref
```

### ปัญหา: Function ไม่ทำงาน
```bash
# ดู logs
supabase functions logs <function-name> --tail

# ตรวจสอบ environment variables
supabase secrets list
```

### ปัญหา: CORS Error
- ตรวจสอบว่ามี `corsHeaders` ใน response
- ตรวจสอบว่า handle OPTIONS request

### ปัญหา: Authentication Error
- ตรวจสอบ Anon Key ใน frontend
- ตรวจสอบ Service Role Key ใน backend secrets

---

**Created:** 2026-01-17  
**Version:** 1.0.0  
**Status:** Backend สร้างเสร็จแล้ว / รอ Deploy และ Update Frontend
