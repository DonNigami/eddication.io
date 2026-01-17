# Supabase Status Check - Manual Instructions

## 🎯 วิธีตรวจสอบ Supabase Status

เนื่องจากระบบไม่สามารถรัน Supabase CLI ได้โดยตรง กรุณารันคำสั่งต่อไปนี้ใน **Terminal/Command Prompt** ของคุณ:

---

## 📍 ขั้นตอนที่ 1: เปิด Terminal

### วิธีที่ 1: VS Code Terminal
```
1. เปิด VS Code
2. กด Ctrl + ` (หรือ View > Terminal)
3. รันคำสั่งด้านล่าง
```

### วิธีที่ 2: Command Prompt (Windows)
```
1. กด Win + R
2. พิมพ์ "cmd" แล้วกด Enter
3. รันคำสั่งด้านล่าง
```

---

## 📍 ขั้นตอนที่ 2: รันคำสั่ง

```bash
# Navigate to project directory
cd D:\VS_Code_GitHub_DATA\eddication.io\eddication.io\PTGLG\driverconnect\driverapp

# Check Supabase status
supabase status
```

---

## 📊 Output ที่คาดว่าจะได้

### กรณีที่ 1: Local services ไม่ได้รัน (Normal)
```
         API URL: http://localhost:54321
          DB URL: postgresql://postgres:postgres@localhost:54322/postgres
      Studio URL: http://localhost:54323
    Inbucket URL: http://localhost:54324
      JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
        anon key: eyJhbG...
service_role key: eyJhbG...

Status: stopped
```

### กรณีที่ 2: Local services กำลังรัน
```
         API URL: http://localhost:54321
          DB URL: postgresql://postgres:postgres@localhost:54322/postgres
      Studio URL: http://localhost:54323
    Inbucket URL: http://localhost:54324
      JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
        anon key: eyJhbG...
service_role key: eyJhbG...

Service status:
- API: running
- DB: running  
- Studio: running
- Inbucket: running
- Realtime: running
- Edge Functions: running
```

### กรณีที่ 3: ยังไม่ได้ start local development
```
Error: Cannot find Supabase project at D:\...\driverapp
Have you run 'supabase init'?
```

---

## 🔍 คำสั่งเพิ่มเติมที่ควรรัน

```bash
# 1. Check Supabase CLI version
supabase --version

# 2. Check project link status
supabase projects list

# 3. Check migrations
supabase migration list

# 4. Check database differences
supabase db diff

# 5. Start local development (optional)
supabase start
```

---

## 📋 การตีความผลลัพธ์

### ✅ สถานะปกติ:
- `Status: stopped` - Local dev environment ไม่ได้รัน (ใช้ remote อยู่)
- มี API URL, DB URL, Studio URL แสดง - Project setup ถูกต้อง
- มี JWT secret และ keys - Configuration เรียบร้อย

### ⚠️ ต้องแก้ไข:
- `Error: Cannot find Supabase project` - ต้องรัน `supabase init` หรือ `supabase link`
- `Error: supabase: command not found` - ต้องติดตั้ง Supabase CLI

### 🎯 Services ที่มีใน Local Development:
| Service | Port | Purpose |
|---------|------|---------|
| API (Kong) | 54321 | REST API Gateway |
| DB (PostgreSQL) | 54322 | Database |
| Studio | 54323 | Web UI Admin Panel |
| Inbucket | 54324 | Email testing |
| Realtime | - | WebSocket subscriptions |
| Edge Functions | 54328 | Serverless functions |

---

## 🚀 การใช้งาน Local Development

### Start local Supabase:
```bash
supabase start
```

### Stop local Supabase:
```bash
supabase stop
```

### Reset local database:
```bash
supabase db reset
```

---

## 🔗 Remote Project Info

```
Project Ref: myplpshpcordggbbtblg
Project URL: https://myplpshpcordggbbtblg.supabase.co
Dashboard: https://supabase.com/dashboard/project/myplpshpcordggbbtblg

Database:
- Host: aws-0-ap-southeast-1.pooler.supabase.com
- Port: 6543
- Database: postgres
```

---

## 💡 หมายเหตุสำคัญ

### คุณไม่จำเป็นต้องรัน Local Development ถ้า:
- ✅ ใช้งานกับ Production database โดยตรง (แนะนำ)
- ✅ ใช้ Supabase URL และ anon key ใน config.js แล้ว
- ✅ Test บน LINE LIFF app จริง

### คุณควรรัน Local Development ถ้า:
- 🧪 ต้องการ test migrations ก่อน push ขึ้น production
- 🧪 ต้องการ develop offline
- 🧪 ต้องการ test database changes โดยไม่กระทบ production

---

## 🎯 สรุป

**สำหรับโปรเจคนี้:**
- ใช้ **Remote Supabase** เป็นหลัก (Production)
- Local Development เป็น **optional** สำหรับ testing เท่านั้น
- Migration file (`20260117015031_remote_schema.sql`) เป็น snapshot จาก remote

---

## 📝 หลังจากรัน `supabase status` แล้ว

กรุณา copy output กลับมาให้ฉัน เพื่อให้ฉันช่วย:
1. ✅ Verify configuration ถูกต้อง
2. ✅ แนะนำขั้นตอนต่อไป (ถ้ามี)
3. ✅ แก้ปัญหา (ถ้าเจอ error)

---

**Last Updated:** 2026-01-17  
**Project:** Driver Connect Supabase  
**Environment:** Windows
