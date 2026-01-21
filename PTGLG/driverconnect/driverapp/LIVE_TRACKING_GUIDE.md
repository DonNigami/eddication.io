# 🌍 Live Tracking Feature - Implementation Complete

> **Feature:** Smart Live Tracking with automatic interval switching
> **Status:** ✅ Ready for Deployment
> **Date:** 2026-01-20

---

## 📋 Overview

ระบบติดตามตำแหน่งแบบเรียลไทม์ (Live Tracking) ที่ใช้ระบบ **Smart Model** ในการสลับความถี่ในการส่งตำแหน่ง:
- **โหมดปกติ:** ส่งตำแหน่งทุก 5 นาที
- **โหมด LIVE:** ส่งตำแหน่งทุก 15 วินาที (เมื่อมีคนเปิดหน้าติดตาม)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Driver App                         │
│  ┌──────────────────────────────────────────┐      │
│  │   live-tracking.js                        │      │
│  │   - Auto sends location every 5 min       │      │
│  │   - Listens for realtime flag changes     │      │
│  │   - Switches to 15s when flag = true      │      │
│  └──────────────────────────────────────────┘      │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────┐
│              Supabase Backend                      │
│  ┌──────────────────────────────────────────┐     │
│  │  driver_live_locations Table              │     │
│  │  - driver_user_id (PK)                    │     │
│  │  - lat, lng                               │     │
│  │  - is_tracked_in_realtime (boolean)       │     │
│  │  - last_updated                           │     │
│  └──────────────────────────────────────────┘     │
│                                                    │
│  Edge Functions:                                  │
│  - start-live-tracking → Set flag = true          │
│  - stop-live-tracking  → Set flag = false         │
└────────────────────────────────────────────────────┘
                    ▲
                    │
┌───────────────────┴─────────────────────────────────┐
│                Tracking Page                        │
│  track/index.html                                   │
│  - Calls start-live-tracking on load                │
│  - Displays map with driver location                │
│  - Subscribes to realtime location updates          │
│  - Calls stop-live-tracking on unload               │
└─────────────────────────────────────────────────────┘
```

---

## 📁 Files Created/Modified

### New Files
1. **`supabase/functions/start-live-tracking/index.ts`**
   - Edge Function to enable live tracking
   - Sets `is_tracked_in_realtime = true`

2. **`supabase/functions/stop-live-tracking/index.ts`**
   - Edge Function to disable live tracking
   - Sets `is_tracked_in_realtime = false`

3. **`PTGLG/driverconnect/driverapp/js/live-tracking.js`**
   - Main live tracking module
   - Handles location sending and mode switching
   - Subscribes to realtime flag changes

4. **`PTGLG/driverconnect/driverapp/track/index.html`**
   - Tracking page with Leaflet.js map
   - Displays real-time driver location
   - Controls live tracking on/off

### Modified Files
1. **`PTGLG/driverconnect/driverapp/js/config.js`**
   - Added `LIVE_TRACKING` configuration
   - Set intervals for normal (5min) and live (15s) modes

2. **`PTGLG/driverconnect/driverapp/js/app.js`**
   - Imported `live-tracking.js`
   - Auto-initializes tracking on LIFF login

---

## ⚙️ Configuration

### config.js Settings
```javascript
LIVE_TRACKING: {
  normalInterval: 300000, // 5 minutes
  liveInterval: 15000,    // 15 seconds
  enableAutoTracking: true
}
```

---

## 🚀 Deployment Steps

### 1. Apply Database Migration
```bash
# Run in Supabase SQL Editor
# Migration file: supabase/migrations/20260120134241_create_driver_live_locations_table.sql
```

### 2. Deploy Edge Functions
```bash
cd D:\VS_Code_GitHub_DATA\eddication.io\eddication.io
supabase functions deploy start-live-tracking
supabase functions deploy stop-live-tracking
```

### 3. Deploy to GitHub Pages
```bash
git add .
git commit -m "feat: Add Live Tracking with Smart Model"
git push
```

### 4. Test URLs
- **Driver App:** https://donnigami.github.io/eddication.io/PTGLG/driverconnect/driverapp/index-supabase-modular.html
- **Tracking Page:** https://donnigami.github.io/eddication.io/PTGLG/driverconnect/driverapp/track/?driver_user_id=U1234567890

---

## 📖 Usage Guide

### For Drivers
1. เปิดแอปผ่าน LINE LIFF
2. ระบบจะเริ่มส่งตำแหน่งอัตโนมัติทุก 5 นาที
3. เมื่อมีคนเปิดหน้าติดตาม ความถี่จะเพิ่มเป็น 15 วินาที
4. เมื่อปิดหน้าติดตาม กลับไปส่งทุก 5 นาทีอีกครั้ง

### For Admin/Tracking
1. เปิด URL: `track/?driver_user_id=<LINE_USER_ID>`
2. หน้าจะแสดงแผนที่พร้อมตำแหน่งปัจจุบัน
3. เห็นสถานะ "LIVE" = กำลังติดตามแบบสด
4. ปิดหน้าเมื่อไม่ใช้งาน เพื่อประหยัด quota

---

## 🔧 API Reference

### Start Live Tracking
```javascript
POST /functions/v1/start-live-tracking
Body: {
  "driver_user_id": "U1234567890",
  "trip_id": 123  // optional
}
```

### Stop Live Tracking
```javascript
POST /functions/v1/stop-live-tracking
Body: {
  "driver_user_id": "U1234567890"
}
```

### Get Current Status
```javascript
import { liveTracking } from './live-tracking.js';
const status = liveTracking.getStatus();
// Returns: { isTracking, isLiveMode, userId, tripId, lastPosition }
```

---

## 🧪 Testing Checklist

- [ ] Apply migration successfully
- [ ] Deploy Edge Functions
- [ ] Test driver app auto-tracking
- [ ] Test tracking page map display
- [ ] Test mode switching (5min → 15s → 5min)
- [ ] Test multiple concurrent viewers
- [ ] Verify realtime subscription works
- [ ] Check performance and battery usage

---

## 🎯 Future Enhancements

1. **History Playback**
   - Store historical locations
   - Add timeline slider on map

2. **Route Optimization**
   - Compare planned vs actual route
   - Alert on deviation

3. **Multiple Drivers View**
   - Show all active drivers on one map
   - Filter by status/region

4. **Battery Optimization**
   - Adaptive intervals based on movement
   - Pause when vehicle stopped

5. **Analytics Dashboard**
   - Total distance traveled
   - Average speed
   - Stop duration analysis

---

## 📝 Notes

- ตารางใช้ `driver_user_id` เป็น Primary Key (ติดตาม 1 คนขับ = 1 แถว)
- Realtime subscription ใช้ Supabase Realtime Channel
- Edge Functions ใช้ Service Role Key (ไม่ต้อง RLS)
- Tracking Page ควรมี authentication ก่อนใช้งานจริง (ป้องกันคนอื่นดู)

---

**End of Document**

> 💡 **Tip:** ทดสอบด้วย User จริงก่อน deploy production เพื่อตรวจสอบ battery drain!
