# 🔧 ติดตั้ง Supabase CLI และเชื่อมต่อกับ Account

## 📥 วิธีติดตั้ง Supabase CLI (Windows)

### วิธีที่ 1: ใช้ NPM (แนะนำ - ง่ายที่สุด) ⭐

```powershell
# ติดตั้งผ่าน npm (ต้องมี Node.js)
npm install -g supabase

# ตรวจสอบว่าติดตั้งสำเร็จ
supabase --version
```

### วิธีที่ 2: ดาวน์โหลดแบบ Manual

1. ไปที่: https://github.com/supabase/cli/releases/latest
2. ดาวน์โหลด `supabase_windows_amd64.tar.gz`
3. แตกไฟล์ได้ `supabase.exe`
4. ย้ายไฟล์ไปที่ `C:\Program Files\Supabase\` (หรือที่อื่นที่ต้องการ)
5. เพิ่ม Path ใน Environment Variables:
   - ค้นหา "Environment Variables" ใน Windows
   - เพิ่ม `C:\Program Files\Supabase\` ใน PATH
   - เปิด PowerShell ใหม่

### วิธีที่ 3: ใช้ Scoop (ถ้ามี Scoop)

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

---

## 🔐 เชื่อมต่อกับ Supabase Account

### Step 1: Login เข้า Supabase

```powershell
# เปิด browser ให้ login
supabase login

# หรือใช้ Access Token โดยตรง
supabase login --token <your-access-token>
```

**วิธีหา Access Token:**
1. ไปที่: https://supabase.com/dashboard/account/tokens
2. คลิก "Generate new token"
3. คัดลอก token
4. รันคำสั่ง: `supabase login --token <token-ที่คัดลอก>`

---

### Step 2: Link กับ Project

```powershell
# เข้าไปที่ folder project
cd d:\VS_Code_GitHub_DATA\eddication.io\eddication.io\project\crm

# Link กับ project (แบบ interactive)
supabase link

# หรือ link โดยระบุ project ref โดยตรง
supabase link --project-ref ckhwouxtrvuthefkxnxb
```

**วิธีหา Project Reference:**
1. ไปที่: https://supabase.com/dashboard
2. เลือก project
3. ดูที่ URL: `https://supabase.com/dashboard/project/[PROJECT_REF]`
4. หรือไปที่ Settings → General → Reference ID

---

### Step 3: ตรวจสอบการเชื่อมต่อ

```powershell
# ดู project ที่ link อยู่
supabase status

# ดู environment secrets
supabase secrets list

# ดู functions ที่มี
supabase functions list
```

---

## 🚀 Deploy Edge Function

หลังจาก link แล้ว สามารถ deploy ได้เลย:

```powershell
# Deploy function
supabase functions deploy crm-pro

# Deploy พร้อมกำหนด env vars
supabase functions deploy crm-pro --no-verify-jwt

# ดู logs
supabase functions logs crm-pro
supabase functions logs crm-pro --tail
```

---

## 🔑 ตั้งค่า Secrets (Environment Variables)

```powershell
# ตั้งค่าทีละตัว
supabase secrets set LINE_CHANNEL_ACCESS_TOKEN="your-token"
supabase secrets set TELEGRAM_BOT_TOKEN="your-bot-token"
supabase secrets set TELEGRAM_CHAT_ID="your-chat-id"

# ตั้งค่าแบบไฟล์ .env
# สร้างไฟล์ .env ก่อน:
# LINE_CHANNEL_ACCESS_TOKEN=xxx
# TELEGRAM_BOT_TOKEN=xxx
# TELEGRAM_CHAT_ID=xxx

supabase secrets set --env-file .env

# ดู secrets ที่ตั้งไว้
supabase secrets list

# ลบ secret
supabase secrets unset FUNCTION_API_KEY
```

---

## 📊 รัน Database Migration

```powershell
# สร้าง migration file
supabase migration new create_transaction_history

# รัน SQL จาก file
supabase db push

# หรือรัน SQL โดยตรง
supabase db execute --file database-schema.sql
```

---

## 🐛 Troubleshooting

### ปัญหา: "supabase: command not found"

**แก้:**
```powershell
# ลองปิดแล้วเปิด PowerShell ใหม่
# หรือรันคำสั่งนี้:
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# ถ้ายังไม่ได้ ให้ติดตั้งผ่าน npm แทน
npm install -g supabase
```

### ปัญหา: "Failed to login"

**แก้:**
```powershell
# ใช้ Access Token แทน browser login
supabase login --token <your-token>

# หา token ที่: https://supabase.com/dashboard/account/tokens
```

### ปัญหา: "Project not found"

**แก้:**
```powershell
# ตรวจสอบว่า login แล้วหรือยัง
supabase status

# Link ใหม่
supabase link --project-ref ckhwouxtrvuthefkxnxb
```

### ปัญหา: "Failed to deploy function"

**แก้:**
```powershell
# ตรวจสอบว่าอยู่ใน folder ที่ถูกต้อง
# ควรมีไฟล์ crm-pro.ts

# ลอง deploy แบบ no-verify-jwt
supabase functions deploy crm-pro --no-verify-jwt

# ดู error logs
supabase functions logs crm-pro
```

---

## 📝 คำสั่งที่ใช้บ่อย

```powershell
# Login
supabase login

# Link project
supabase link --project-ref ckhwouxtrvuthefkxnxb

# Deploy function
supabase functions deploy crm-pro

# ดู logs
supabase functions logs crm-pro --tail

# ตั้งค่า secrets
supabase secrets set KEY=value

# ดู secrets
supabase secrets list

# รัน database migration
supabase db push

# ตรวจสอบสถานะ
supabase status
```

---

## 🎯 ขั้นตอนเต็ม (ตั้งแต่ต้น)

```powershell
# 1. ติดตั้ง CLI
npm install -g supabase

# 2. Login
supabase login

# 3. เข้า folder project
cd d:\VS_Code_GitHub_DATA\eddication.io\eddication.io\project\crm

# 4. Link project
supabase link --project-ref ckhwouxtrvuthefkxnxb

# 5. รัน database schema
supabase db execute --file database-schema.sql

# 6. ตั้งค่า secrets
supabase secrets set LINE_CHANNEL_ACCESS_TOKEN="xxx"
supabase secrets set TELEGRAM_BOT_TOKEN="xxx"
supabase secrets set TELEGRAM_CHAT_ID="xxx"

# 7. Deploy function
supabase functions deploy crm-pro

# 8. ดู logs
supabase functions logs crm-pro --tail

# 9. ทดสอบ
# เปิด test.html และลองใช้งาน
```

---

## 🔗 ทรัพยากรเพิ่มเติม

- **Supabase CLI Docs:** https://supabase.com/docs/guides/cli
- **GitHub Releases:** https://github.com/supabase/cli/releases
- **Access Tokens:** https://supabase.com/dashboard/account/tokens
- **Project Dashboard:** https://supabase.com/dashboard/project/ckhwouxtrvuthefkxnxb

---

**Note:** Project Reference ของคุณคือ: `ckhwouxtrvuthefkxnxb`  
**Supabase URL:** `https://ckhwouxtrvuthefkxnxb.supabase.co`

---

**Status:** 📝 คู่มือติดตั้ง  
**Last Updated:** 2025-12-30
