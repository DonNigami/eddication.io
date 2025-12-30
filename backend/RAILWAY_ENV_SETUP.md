# Railway Environment Variables Setup

## ⚠️ CRITICAL SECURITY NOTES

**ห้ามทำ:**
- ❌ ห้ามแปะ secret keys ใน Git commits
- ❌ ห้าลง Slack, Email, หรือโลกของคน
- ❌ ห้าลง README หรือ documentation

**ต้องทำ:**
- ✅ ใช้ Railway Dashboard เพื่อตั้งค่า env vars
- ✅ ใช้ .env.example สำหรับ template (ไม่มี actual values)
- ✅ ตั้งค่าใน Railway/Docker/Server only

---

## ✅ วิธีเพิ่ม Environment Variables ใน Railway

### **ขั้นตอน 1: เข้า Railway Dashboard**
1. ไปที่ https://railway.app/dashboard
2. เลือก Project
3. เลือก Backend Service

### **ขั้นตอน 2: ไปที่ Variables**
```
Backend Service → Variables tab
```

### **ขั้นตอน 3: เพิ่ม Variables**

คลิก "New Variable" แล้วเพิ่มทั้งหมด:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `SUPABASE_URL` | `https://rwqgxdjcwrglbwlruyty.supabase.co` |
| `SUPABASE_SERVICE_KEY` | *(ใส่ Service Key)* |
| `LINE_CHANNEL_ACCESS_TOKEN` | *(ใส่ Channel Access Token)* |
| `LINE_CHANNEL_SECRET` | *(ใส่ Channel Secret)* |

### **ขั้นตอน 4: Deploy**
```
Railway จะ auto-redeploy หลังจากตั้งค่า env vars
```

### **ขั้นตอน 5: ตรวจสอบ Logs**
```
Backend Service → Deployment → Logs
ค้นหา: "[BroadcastScheduler]"

ควรเห็น:
✅ Broadcast Scheduler started - checking every 30 seconds
✅ Server running on port 3000
```

---

## 🔐 Security Best Practices

**Backend .env (Local Development Only):**
```bash
# backend/.env (DO NOT COMMIT)
NODE_ENV=development
PORT=3000
SUPABASE_URL=https://rwqgxdjcwrglbwlruyty.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here
LINE_CHANNEL_ACCESS_TOKEN=your_token_here
LINE_CHANNEL_SECRET=your_secret_here
```

**backend/.env.example (สำหรับ GitHub):**
```bash
# backend/.env.example (OK to commit)
NODE_ENV=production
PORT=3000
SUPABASE_URL=https://rwqgxdjcwrglbwlruyty.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token_here
LINE_CHANNEL_SECRET=your_line_channel_secret_here
```

---

## ✅ Verification Checklist

- [ ] Variables เพิ่มทั้งหมด ใน Railway Dashboard
- [ ] Backend deploy สำเร็จ (green status)
- [ ] Logs แสดง `Broadcast Scheduler started`
- [ ] ลองส่ง broadcast ตามเวลาจาก Frontend
- [ ] Check Supabase: `SELECT * FROM broadcast_queue LIMIT 5;`
- [ ] ตรวจสอบ status ของข้อความว่าเป็น 'sent' หรือไม่

---

## 📞 ถ้า Deploy ไม่สำเร็จ

**ดู Logs ใน Railway:**
```
Backend Service → Deployment → Logs
ค้นหาคำว่า:
- ERROR
- "Cannot find module"
- "ENOENT" (file not found)
```

**Common Issues:**

| Error | วิธีแก้ |
|-------|-------|
| `Cannot find module 'axios'` | ต้อง `npm install` ให้ครบ |
| `SUPABASE_SERVICE_KEY is undefined` | ตรวจสอบตั้งค่า env vars แล้วหรือ |
| `PORT already in use` | ส่วนใหญ่ไม่เป็นปัญหา Railway จะจัดการ |
| `Connection refused` | ตรวจสอบ `SUPABASE_URL` ถูกต้อง |

---

**ทำเสร็จแล้ว! Broadcast Scheduler จะส่งข้อความตามเวลา 🎉**
