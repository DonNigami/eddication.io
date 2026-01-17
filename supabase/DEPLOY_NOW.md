# Quick Deploy Guide

## ✅ โครงสร้างถูกต้องแล้ว!

ตอนนี้ functions อยู่ในรูปแบบที่ Supabase ต้องการ:
```
functions/
├── _shared/
│   ├── types.ts ✅
│   └── utils.ts ✅
├── search-job/
│   └── index.ts ✅
├── update-stop/
│   └── index.ts ✅
├── upload-alcohol/
│   └── index.ts ✅
├── close-job/
│   └── index.ts ✅
└── end-trip/
    └── index.ts ✅
```

---

## 🚀 Deploy to Supabase

### Step 1: ติดตั้ง Supabase CLI (ถ้ายังไม่ได้ติดตั้ง)
```bash
npm install -g supabase
```

### Step 2: Login
```bash
supabase login
```
- จะเปิด browser ให้ authorize
- Login ด้วย GitHub account ที่เชื่อมกับ Supabase

### Step 3: Link Project
```bash
cd D:\VS_Code_GitHub_DATA\eddication.io\eddication.io
supabase link --project-ref myplpshpcordggbbtblg
```
- ใส่ Database password (ถ้ามีถาม)

### Step 4: Deploy Functions
```bash
cd supabase
supabase functions deploy --no-verify-jwt
```

หรือ deploy ทีละ function:
```bash
supabase functions deploy search-job --no-verify-jwt
supabase functions deploy update-stop --no-verify-jwt
supabase functions deploy upload-alcohol --no-verify-jwt
supabase functions deploy close-job --no-verify-jwt
supabase functions deploy end-trip --no-verify-jwt
```

### Step 5: ตั้งค่า Environment Variables
```bash
supabase secrets set SUPABASE_URL=https://myplpshpcordggbbtblg.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

**หา Service Role Key:**
1. เข้า https://supabase.com/dashboard/project/myplpshpcordggbbtblg
2. Settings → API
3. Copy "service_role" key (⚠️ ไม่ใช่ "anon" key)

---

## 🧪 Test Locally (ไม่บังคับ)

ถ้าต้องการทดสอบก่อน deploy:

```bash
# Start local dev server
supabase functions serve

# Test endpoint
curl -X POST http://localhost:54321/functions/v1/search-job \
  -H "Content-Type: application/json" \
  -d '{"reference":"TEST001","userId":"U1234"}'
```

---

## ✅ Verify Deployment

หลังจาก deploy เสร็จ:

```bash
# List functions
supabase functions list

# View logs
supabase functions logs search-job --tail

# Test endpoint
curl -X POST https://myplpshpcordggbbtblg.supabase.co/functions/v1/search-job \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reference":"TEST001","userId":"U1234"}'
```

---

## 🆘 Common Issues

### ❌ Error: "supabase: command not found"
**แก้:** ติดตั้ง Supabase CLI
```bash
npm install -g supabase
```

### ❌ Error: "Project not linked"
**แก้:** Link project
```bash
supabase link --project-ref myplpshpcordggbbtblg
```

### ❌ Error: "Invalid import"
**แก้:** ตรวจสอบว่า import paths ถูกต้อง (`../_shared/types.ts`)

### ❌ Error: "Function timeout"
**แก้:** เพิ่ม timeout หรือ optimize query

### ❌ Error: "Environment variable not set"
**แก้:** Set secrets
```bash
supabase secrets set SUPABASE_URL=...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
```

---

## 📊 Checklist

- [ ] Supabase CLI installed
- [ ] Logged in (`supabase login`)
- [ ] Project linked (`supabase link`)
- [ ] Functions deployed (`supabase functions deploy`)
- [ ] Secrets configured (`supabase secrets set`)
- [ ] Endpoints tested (curl/Postman)
- [ ] Frontend updated to use Edge Functions

---

บอกผมถ้ามี error ไหนครับ จะช่วยแก้ให้! 🚀
