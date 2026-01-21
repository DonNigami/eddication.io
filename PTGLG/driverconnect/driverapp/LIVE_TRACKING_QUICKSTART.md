# 🌍 Quick Start - Live Tracking Feature

## 🚀 การติดตั้งและเปิดใช้งาน (5 นาที)

### ขั้นตอนที่ 1: Apply Database Migration
```bash
# เปิด Supabase SQL Editor
# URL: https://supabase.com/dashboard/project/myplpshpcordggbbtblg/sql/new

# Copy and Run:
CREATE TABLE public.driver_live_locations (
    driver_user_id text PRIMARY KEY,
    trip_id bigint,
    lat float8 NOT NULL,
    lng float8 NOT NULL,
    last_updated timestamptz DEFAULT now() NOT NULL,
    is_tracked_in_realtime boolean DEFAULT false NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_driver_live_locations_trip_id 
ON public.driver_live_locations (trip_id);
```

### ขั้นตอนที่ 2: Deploy Edge Functions และ Code
```bash
cd D:\VS_Code_GitHub_DATA\eddication.io\eddication.io\PTGLG\driverconnect\driverapp
deploy-live-tracking.bat
```

### ขั้นตอนที่ 3: ทดสอบ
1. **เปิด Driver App** (LIFF)
   - เข้าสู่ระบบผ่าน LINE
   - เช็คว่า Console log มี "🌍 Initializing live tracking"

2. **เปิด Tracking Page**
   - URL: `track/?driver_user_id=<YOUR_LINE_USER_ID>`
   - ดูว่ามีแผนที่และ marker ปรากฏ
   - Status badge แสดง "LIVE" (สีเขียว)

3. **ทดสอบ Mode Switching**
   - ปิดหน้า Tracking → Status ควรกลับเป็น "Normal" (สีส้ม)
   - Driver App จะส่งตำแหน่งทุก 5 นาทีแทน 15 วินาที

---

## 🔗 URLs สำหรับทดสอบ

| Resource | URL |
|----------|-----|
| Driver App | https://donnigami.github.io/eddication.io/PTGLG/driverconnect/driverapp/index-supabase-modular.html |
| Tracking Page | https://donnigami.github.io/eddication.io/PTGLG/driverconnect/driverapp/track/?driver_user_id=U... |
| Supabase Dashboard | https://supabase.com/dashboard/project/myplpshpcordggbbtblg |
| Edge Functions Log | https://supabase.com/dashboard/project/myplpshpcordggbbtblg/functions |

---

## ⚙️ การปรับแต่ง Interval

แก้ไขในไฟล์ `js/config.js`:
```javascript
LIVE_TRACKING: {
  normalInterval: 300000, // 5 นาที (เปลี่ยนตามต้องการ)
  liveInterval: 15000,    // 15 วินาที (เปลี่ยนตามต้องการ)
  enableAutoTracking: true // เปิด/ปิดระบบ
}
```

---

## 🐛 Troubleshooting

### ปัญหา: แผนที่ไม่แสดง
- ตรวจสอบว่า `driver_user_id` ถูกต้อง
- เช็ค Console log หา error
- ตรวจสอบว่าตารางมีข้อมูล: `SELECT * FROM driver_live_locations`

### ปัญหา: Mode ไม่สลับ
- ตรวจสอบ Realtime subscription status
- ดู Edge Functions logs
- ลองรัน Edge Function manual ใน Postman/Insomnia

### ปัญหา: Battery drain
- ลด `liveInterval` จาก 15s → 30s
- หรือปิด `enableAutoTracking` ชั่วคราว

---

## 📊 การตรวจสอบสถานะ

```sql
-- ดูข้อมูล Live Tracking ทั้งหมด
SELECT 
  driver_user_id,
  lat,
  lng,
  is_tracked_in_realtime,
  last_updated,
  NOW() - last_updated AS time_ago
FROM driver_live_locations
ORDER BY last_updated DESC;
```

---

## ✅ Checklist

- [ ] Migration applied
- [ ] Edge Functions deployed
- [ ] Code pushed to GitHub
- [ ] Driver app auto-tracking works
- [ ] Tracking page displays map
- [ ] Mode switching verified
- [ ] Performance acceptable

---

**Need Help?** อ่าน `LIVE_TRACKING_GUIDE.md` สำหรับรายละเอียดเพิ่มเติม
