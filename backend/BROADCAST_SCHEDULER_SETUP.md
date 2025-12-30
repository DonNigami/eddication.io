# Broadcast Scheduler Setup Guide

ระบบจะส่งข้อความแบบกำหนดเวลา (Scheduled Broadcast) โดยอัตโนมัติ

## ✅ ขั้นตอนการตั้งค่า

### 1. **Supabase Configuration**

ต้องตั้งค่า Environment Variables ใน backend/.env หรือ Railway:

```bash
SUPABASE_URL=https://rwqgxdjcwrglbwlruyty.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
```

**ที่มา:**
- `SUPABASE_URL` + `SUPABASE_SERVICE_KEY`: ได้จาก Supabase Dashboard → Settings → API
  - ต้องใช้ **Service Key** (ไม่ใช่ Anon Key) เพื่อให้เข้าถึงข้อมูลได้เต็มที่
- `LINE_CHANNEL_ACCESS_TOKEN`: ได้จาก LINE Official Account Manager

### 2. **สร้าง Supabase Tables**

รัน migration SQL ใน Supabase Dashboard:
```
supabase/migrations/20251230_create_missing_tables.sql
```

ตารางที่จะถูกสร้าง:
- `broadcast_queue` - เก็บข้อความที่รออยู่
- `news_metrics` - บันทึกการดู/คลิกข่าว
- `audit_logs` - บันทึกการเปลี่ยนแปลง
- `points_history` - ประวัติการเปลี่ยนแต้ม

### 3. **Deploy Backend**

ต้อง deploy backend ให้รัน BroadcastScheduler:
- Railway: `.env` ต้องมี Supabase variables
- Docker: ส่ง env vars เข้า container
- Local: `npm install` แล้ว `npm start`

### 4. **ทดสอบการส่ง**

#### วิธีที่ 1: ใน Frontend (project/crm/test.html)
1. Admin panel → "ส่งข้อความ (Broadcast)"
2. เลือกกลุ่มเป้าหมาย (all, segment, tag)
3. เขียนข้อความ
4. **เลือกวันเวลา** ใน "ตั้งเวลาส่ง"
5. คลิก "ยืนยันการส่ง"

#### วิธีที่ 2: ส่งข้อความทันที
- ไม่เลือกเวลา → จะส่งโดยอัตโนมัติทันที

#### วิธีที่ 3: ตรวจสอบ Queue ใน Supabase
```sql
SELECT * FROM broadcast_queue ORDER BY created_at DESC LIMIT 10;
```

## 🔄 มันทำงานอย่างไร?

```
Frontend: User ตั้งเวลาส่ง
    ↓
Supabase: INSERT ลงตาราง broadcast_queue
    ↓
Backend Scheduler: ตรวจสอบทุก 30 วินาที
    ↓
Scheduler: ถ้าเวลา >= scheduled_at → ส่งข้อความ
    ↓
LINE API: ส่งข้อความไปยัง users
    ↓
Supabase: UPDATE status = 'sent'
```

## ⚙️ Scheduler Configuration

ค่าเริ่มต้น:
- **Check Interval**: 30 วินาที
- **Batch Size**: 50 broadcasts ต่อครั้ง
- **Target Audience**:
  - `all` → ลูกค้าทั้งหมด
  - `segment:id` → ลูกค้าตามเงื่อนไข (วันที่เข้า, แต้ม, เคยเข้า)
  - `tag:name` → ลูกค้าตามป้ายกำกับ

## 🎯 Message Types

1. **Text** - ข้อความข้อความธรรมชาติ
2. **Image** - รูปภาพพร้อม URL
3. **Flex Message** - JSON complex message

## 📊 ตัวอย่าง broadcast_queue Record

```json
{
  "id": 1,
  "target": "all",
  "msg_type": "text",
  "message": "ส่วนลด 50% สำหรับวันนี้",
  "scheduled_at": "2025-12-31T15:00:00Z",
  "status": "scheduled",
  "created_at": "2025-12-30T10:00:00Z"
}
```

## ❌ Troubleshooting

| ปัญหา | วิธีแก้ |
|------|-------|
| 404 on broadcast_queue | รัน migration ใน Supabase |
| Scheduler ไม่ทำงาน | ตรวจสอบ `SUPABASE_SERVICE_KEY` |
| ส่ง broadcast ไม่ได้ | ตรวจสอบ `LINE_CHANNEL_ACCESS_TOKEN` |
| ไม่เห็น queue ใน DB | ตรวจสอบ `SUPABASE_URL` |
| Backend ไม่ start | ดู logs: `npm start` หรือ Railway dashboard |

## 🔐 Security Notes

- ใช้ **Service Key** (ไม่ใช่ Anon Key) ให้เข้าถึงข้อมูลได้
- RLS Policies ต้อง allow authenticated users
- LINE Token ต้องเก็บเป็นความลับ (ไม่ commit ลง Git)

---

✅ **ถ้าทำตามขั้นตอนนี้ สามารถส่ง broadcast ตามเวลาได้**
