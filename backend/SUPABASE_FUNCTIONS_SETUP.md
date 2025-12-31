# Supabase Broadcast Scheduler - Simple Edition

✅ ใช้งานได้จริง (Supabase รองรับ)  
✅ ไม่ต้อง Railway  
✅ ตั้ง Cron trigger ภายนอก  

---

## วิธีเลือก 3 ตัวเลือก

### **ตัวเลือก 1: Supabase Edge Function + External Cron (แนะนำ) 🎯**
**ข้อดี:**
- ง่ายที่สุด - ทำ 3 ขั้นตอน เสร็จ
- ไม่ต้อง Railway
- ประสิทธิภาพดี
- Control ได้ดี

**ข้อเสีย:**
- ต้องตั้ง cron trigger ภายนอก (เช่น EasyCron, Vercel Cron)

---

### **ตัวเลือก 2: Node.js Backend ของเดิม + External Cron**
**ข้อดี:**
- ใช้ code ที่มีอยู่เดิม
- ไม่ต้องสร้างใหม่

**ข้อเสีย:**
- ต้อง host backend ที่ไหน (Railway, Render, etc)

---

### **ตัวเลือก 3: Manual - ส่งเอง ในหน้า frontend**
**ข้อดี:**
- ไม่ต้องตั้งอะไร

**ข้อเสีย:**
- ต้องเปิดหน้า admin ตลอด
- ไม่แน่นอน

---

## 🚀 Step-by-Step: ตัวเลือก 1 (แนะนำ)

### ขั้นตอนที่ 1: รัน SQL Migration

1. ไป **Supabase Dashboard** > **SQL Editor**
2. Copy-paste จากไฟล์นี้ทั้งหมด:
   ```
   supabase/migrations/20251230_broadcast_scheduler_function.sql
   ```
3. กด **RUN**
4. ควรเห็น "Success" - ถ้าเห็น error ลองบอกให้ฉันทราบ

---

### ขั้นตอนที่ 2: Deploy Edge Function

เปิด Terminal แล้วรัน:

```bash
# ไปที่ project directory
cd d:\VS_Code_GitHub_DATA\eddication.io\eddication.io

# ติดตั้ง Supabase CLI (ถ้ายังไม่มี)
npm install -g supabase

# Login Supabase
supabase login

# Deploy function
supabase functions deploy broadcast-scheduler
```

ตอนรัน deploy มันจะถาม project - ให้เลือก project ที่ขึ้นมา

**ตอบคำถาม:**
```
✓ Select project: rwqgxdjcwrglbwlruyty (CRM project ของคุณ)
```

---

### ขั้นตอนที่ 3: ตั้ง Secrets

```bash
# ใน Terminal เดียวกัน
supabase secrets set LINE_CHANNEL_ACCESS_TOKEN "F7CyFs8k/RakWmZvk..."
```

หรือ **ใน Supabase Dashboard:**
1. **Settings** > **Secrets**
2. เพิ่ม key: `LINE_CHANNEL_ACCESS_TOKEN`
3. value: ของคุณ
4. Save

---

### ขั้นตอนที่ 4: ตั้ง Cron Trigger

ตัวเลือก A หรือ B:

#### **ตัวเลือก A: ใช้ EasyCron (ฟรี, ง่ายสุด)**

1. ไป https://www.easycron.com
2. Sign up (free)
3. Create a new cron job:
   - **URL:** 
     ```
     https://rwqgxdjcwrglbwlruyty.supabase.co/functions/v1/broadcast-scheduler
     ```
   - **Method:** POST
   - **Cron Expression:** `*/30 * * * * *` (ทุก 30 วินาที)
4. Save - เสร็จแล้ว!

#### **ตัวเลือก B: ใช้ Vercel Cron**

```bash
# ใน vercel.json (ถ้าไม่มี สร้างใหม่)
{
  "crons": [{
    "path": "/api/trigger-broadcast",
    "schedule": "*/30 * * * * *"
  }]
}
```

ใน API route:
```javascript
// pages/api/trigger-broadcast.js
export default async function handler(req, res) {
  await fetch('https://rwqgxdjcwrglbwlruyty.supabase.co/functions/v1/broadcast-scheduler', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_SERVICE_ROLE_KEY'
    }
  });
  res.status(200).json({ ok: true });
}
```

#### **ตัวเลือก C: ใช้ Node.js local + PM2**

```bash
# ติดตั้ง PM2
npm install -g pm2

# สร้างไฟล์ scripts/cron-trigger.js
const axios = require('axios');

setInterval(async () => {
  try {
    await axios.post(
      'https://rwqgxdjcwrglbwlruyty.supabase.co/functions/v1/broadcast-scheduler',
      {},
      {
        headers: {
          'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIs...'
        }
      }
    );
    console.log('Triggered broadcast scheduler');
  } catch (e) {
    console.error('Error:', e.message);
  }
}, 30000);  // ทุก 30 วินาที

# รัน
pm2 start scripts/cron-trigger.js
pm2 save
pm2 startup
```

---

## ✅ ทดสอบ

### ขั้นตอน 1: สร้าง broadcast

1. เปิด frontend: `project/crm/test.html`
2. แท็บ "ส่งข้อความ"
3. เลือก "Broadcast แบบกำหนดเวลา"
4. **เวลา:** เลือกเวลา 1-2 นาที ในอนาคต
5. **ข้อความ:** "Test broadcast"
6. กด "ส่ง"

### ขั้นตอน 2: รอให้ LINE message มาถึง

- ถ้ารอ 2-3 นาที ยังไม่ได้ → ตรวจสอบ logs
- ถ้าได้ message → **ทำงานแล้ว! 🎉**

### ตรวจสอบ Logs

**Supabase Dashboard:**
```
1. Functions > broadcast-scheduler
2. Click ที่ function
3. ดูที่ "Logs" tab
```

**หรือ Terminal:**
```bash
supabase functions list
supabase functions delete broadcast-scheduler --confirm  # ถ้าต้องอัปเดต
supabase functions deploy broadcast-scheduler  # Deploy ใหม่
```

---

## ⚠️ Troubleshooting

### "Function not found" (404)
```
✅ วิธีแก้:
   - ตรวจสอบ URL ถูกต้อง
   - ตรวจสอบ function deployed: `supabase functions list`
```

### "Invalid credentials" (401)
```
✅ วิธีแก้:
   - Secrets ตั้งถูกไหม?
   - ตรวจสอบ: Supabase > Settings > Secrets
```

### "Broadcast not sending"
```
✅ ตรวจสอบ:
   1. status = 'scheduled' ใน broadcast_queue?
   2. scheduled_at <= NOW()?
   3. Cron trigger ทำงานไหม? (ดู logs)
   4. LINE token ถูกต้องไหม?
```

---

## หากต้องการเลือกตัวเลือก 2 (Node.js Backend)

สร้าง endpoint ใน backend ที่เรียก function นี้:

```javascript
// backend/server.js
app.get('/api/trigger-broadcasts', async (req, res) => {
  try {
    // เรียก Supabase function
    const { data, error } = await supabase.rpc('get_pending_broadcasts');
    
    if (error) throw error;

    let count = 0;
    for (const broadcast of data) {
      // ส่ง LINE message
      try {
        await axios.post(
          'https://api.line.biz/v2/bot/message/push',
          {
            to: broadcast.target,
            messages: buildLineMessage(broadcast)
          },
          { headers: { Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}` } }
        );

        // อัปเดต status
        await supabase.rpc('mark_broadcast_sent', {
          broadcast_id: broadcast.id,
          success: true
        });

        count++;
      } catch (e) {
        console.error('Error:', e);
        await supabase.rpc('mark_broadcast_sent', {
          broadcast_id: broadcast.id,
          success: false
        });
      }
    }

    res.json({ ok: true, processed: count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
```

แล้วตั้ง external cron ให้เรียก:
```
GET https://your-backend.com/api/trigger-broadcasts
```

---

## สรุป: เลือกตัวไหน?

| | Edge Function | Node.js Backend |
|---|---|---|
| ความง่าย | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| ประสิทธิภาพ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Cost | ฟรี (Supabase) | $5+ (hosting) |
| ข้อเสีย | ต้อง external cron | ต้อง host backend |

**ถ้ารีบ → เลือก Edge Function + EasyCron ✅**

