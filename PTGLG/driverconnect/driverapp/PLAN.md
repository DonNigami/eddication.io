# 📋 PLAN - Driver Tracking App Development Plan

> **Last Updated:** 2026-01-22 (Added Driver & Owner Value Features)
> **Project:** Driver Tracking App (LINE LIFF + Supabase)
> **Status:** ✅ Core Features Working | ✅ Database Ready | ✅ Live Tracking Enabled | 🚀 Ready for Production Testing!
> **New:** 💰 Driver & Owner Value Features | 🚚 4PL Transformation Roadmap

---

## 🎯 Project Overview

แอปพลิเคชันสำหรับคนขับรถเพื่อติดตามงานส่งของ ใช้ LINE LIFF เป็นหน้าบ้าน และ Supabase เป็น Backend Database

**Main File:** `PTGLG/driverconnect/driverapp/index-supabase-modular.html`

**Schema Reference:** `PTGLG/driverconnect/app/PLAN.md` (Migration Plan)

**Additional References:**
- `4PL_TRANSFORMATION_ROADMAP.md` - แผนพัฒนาเป็น 4PL Platform (สำหรับ Fleet 800+ คัน)
- `DRIVER_OWNER_VALUE_FEATURES.md` - ฟีเจอร์เพิ่มประสิทธิภาพและลดต้นทุน
- `PROFESSIONAL_ENHANCEMENT_ROADMAP.md` - แผนยกระดับเป็น Professional-grade

---

## 📁 Project Structure

```
PTGLG/driverconnect/driverapp/
├── index-supabase-modular.html    ✅ Main application (ACTIVE)
├── index-supabase-v2.html         ⚠️  Old version (DEPRECATED)
├── index-test-20260115.html       📚 Reference version (for feature comparison)
├── js/
│   ├── app.js                     ✅ Main app logic, state management, event handling
│   ├── supabase-api.js            ✅ Supabase API wrapper (CRUD, auth, realtime)
│   ├── config.js                  ✅ App configuration (LIFF ID, Supabase keys, retry settings)
│   ├── ui.js                      ✅ UI helpers (modals, loaders, toasts, themes)
│   ├── gps.js                     ✅ GPS & location services (geolocation, geofencing)
│   ├── offline-queue.js           ✅ Offline mode action queueing and syncing
│   ├── utils.js                   ✅ Utility functions (validation, sanitization, etc.)
│   ├── enhanced-ux.js             ✅ Standalone UX features (Pull-to-Refresh)
│   └── ... (other helper/unused scripts)
└── css/
    └── styles.css                 ✅ All styling

supabase/
├── migrations/
│   ├── 20260117_create_driver_tracking_tables.sql  ✅ Applied
│   ├── 20260117_fix_rls_policies.sql               ✅ Applied (RLS disabled for testing)
│   ├── 20260117_update_user_profiles.sql           ⏳ PENDING
│   ├── 20260117_migrate_to_trips_schema.sql        ⏳ PENDING - Rename to trips schema
│   └── 20260117_create_alcohol_evidence_bucket.sql ⏳ PENDING - Create storage bucket
└── check-user-profiles.sql        📋 Query to verify table structure
```

---

## 🗄️ Database Schema (Supabase)

> **Schema aligned with:** `PTGLG/driverconnect/app/PLAN.md`

### Tables

#### 1. **jobdata** (Primary Table for App State)
> This table is the main source of truth for the app. Data is synced from the legacy `trips` table if not found here.
```sql
- id (bigint, PK)
- reference (text, INDEX)
- shipment_no (text)
- ship_to_code (text)
- ship_to_name (text)
- status (text)
- checkin_time, checkout_time, fueling_time, unload_done_time (timestamptz)
- checkin_lat, checkin_lng, checkout_lat, checkout_lng (double precision)
- checkin_odo (numeric)
- receiver_name (text), receiver_type (text)
- has_pumping (boolean), has_transfer (boolean)
- vehicle_desc (text)
- drivers (text)
- seq (int)
- route (text)
- is_origin_stop (boolean)
- materials (text)
- total_qty (numeric)
- dest_lat, dest_lng (double precision)
- radius_m (numeric)
- job_closed (boolean)
- trip_ended (boolean)
- job_closed_at (timestamptz)
- trip_ended_at (timestamptz)
- trip_end_odo (numeric)
- driver_count (int)
- vehicle_status (text)
- is_holiday_work (boolean) -- NEW
- created_at, updated_at (timestamptz)
- updated_by (text)
- closed_by (text)
- ended_by (text)
```

#### 2. **trips** (formerly driver_jobs)
```sql
- id (bigint, PK)
- reference_no (text, UNIQUE) -- รหัสงาน เช่น 2601S16472
- reference (text) -- backward compatibility
- vehicle_desc (text)
- shipment_nos (jsonb) -- array of shipment numbers
- driver_ids (jsonb) -- array of LINE User IDs
- drivers (text) -- comma-separated names (backward compatibility)
- status (text, default 'open')
- job_closed (boolean, default false)
- trip_ended (boolean, default false)
- start_time, end_time (timestamptz)
- ODO_start, end_odo (numeric)
- location (jsonb) -- {lat, lng}
- end_location (jsonb)
- total_fee, toll_fee, fees (numeric)
- created_at, updated_at (timestamptz)
```

#### 3. **trip_stops** (formerly driver_stops)
```sql
- id (bigint, PK)
- trip_id (bigint, FK -> trips.id)
- reference (text)
- sequence (int) -- stop order
- stop_number (int) -- backward compatibility
- destination_name (text) -- Maps to destination1/destination2
- stop_name (text) -- backward compatibility
- lat, lng (double precision) -- Destination coordinates
- status (text, default 'pending')
- is_origin (boolean)
- check_in_time, check_out_time (timestamptz)
- checkin_time, checkout_time (timestamptz) -- backward compatibility
- fueling_time, unload_done_time (timestamptz)
- fuel_time, unload_time (timestamptz) -- backward compatibility
- check_in_odo (numeric)
- receiver_name, receiver_type (text)
- check_in_lat, check_in_lng (double precision) -- Actual location at check-in
- checkin_location (jsonb) -- backward compatibility
```

#### 4. **alcohol_checks** (formerly driver_alcohol_checks)
```sql
- id (bigint, PK)
- trip_id (bigint, FK -> trips.id)
- reference (text)
- driver_user_id (text) -- LINE User ID
- driver_name (text)
- alcohol_value (numeric)
- image_url (text) -- URL to 'alcohol-evidence' storage bucket
- checked_at (timestamptz)
- lat, lng (double precision)
- location (jsonb) -- backward compatibility
```

#### 5. **driver_logs** (Audit Trail)
```sql
- id (uuid, PK)
- trip_id (uuid, FK -> trips.id)
- job_id (uuid) -- backward compatibility
- reference (text)
- action (text) -- 'checkin', 'checkout', 'fuel', 'unload', 'alcohol', 'close', 'endtrip'
- details (jsonb)
- location (jsonb)
- user_id (text)
- created_at (timestamptz)
```

#### 6. **user_profiles** (User Tracking)
```sql
- id (uuid, PK)
- user_id (text, UNIQUE) -- LINE User ID (starts with 'U')
- display_name (text)
- picture_url (text)
- status_message (text)
- first_seen_at (timestamp)
- last_seen_at (timestamp)
- total_visits (integer)
- last_reference (text) -- Last searched job reference
- created_at, updated_at (timestamp)
```

#### 7. **system_settings** (Key-Value Store for App Configs) (NEW)
```sql
- key (text, PK) -- e.g., "enable_live_tracking"
- value (jsonb) -- The setting's value, e.g., true, 15, "some string"
- description (text)
- updated_at (timestamptz)
```

### Storage Buckets
- `alcohol-evidence` - Store alcohol test images (per app/PLAN.md)
- ~~`alcohol-checks`~~ - Old bucket name (deprecated)

### RLS Status
- ⚠️ **Currently DISABLED for all tables** (for testing)
- 🔐 **Production:** Need to enable RLS with proper policies

### Table Name Migration
| Old Name | New Name | Status |
|----------|----------|--------|
| driver_jobs | trips | ⏳ PENDING |
| driver_stops | trip_stops | ⏳ PENDING |
| driver_alcohol_checks | alcohol_checks | ⏳ PENDING |
| driver_logs | driver_logs | ✅ No change |
| alcohol-checks (bucket) | alcohol-evidence | ⏳ PENDING |

---

## 🔗 Supabase Configuration

```
URL: https://myplpshpcordggbbtblg.supabase.co
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15cGxwc2hwY29yZGdnYmJ0YmxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0MDI2ODgsImV4cCI6MjA4Mzk3ODY4OH0.UC42xLgqSdqgaogHmyRpES_NMy5t1j7YhdEZVwWUsJ8

LINE LIFF ID: 2007705394-Fgx9wdHu
LIFF URL: https://liff.line.me/2007705394-Fgx9wdHu
Endpoint: https://donnigami.github.io/eddication.io/PTGLG/driverconnect/driverapp/index-supabase-modular.html
```

---

## ✅ Features Completed

### Core Features
- [x] LINE LIFF Login integration
- [x] Search jobs by reference number (driver_jobs + driver_stops)
- [x] Display job timeline with stops
- [x] GPS tracking and location capture (JSONB format)
- [x] Check-in/Checkout at stops
- [x] Fuel stop tracking
- [x] Unload stop tracking
- [x] Alcohol test with image upload
- [x] Close job functionality
- [x] End trip functionality
- [x] Dark mode toggle

### Enhanced UX Features
- [x] Pull-to-Refresh (PTR) - Drag down to refresh
- [x] Toast notifications - Inline feedback messages
- [x] Quick Actions Bar - Floating action buttons
- [x] Syncing Bar - Visual sync status indicator
- [x] Notification Settings - User preferences popup

### Backend & Database
- [x] Migrate from Google Sheets to Supabase
- [x] Create driver_* tables schema
- [x] Disable RLS for testing (406 error fix)
- [x] JSONB location fields instead of separate lat/lng columns
- [x] Alcohol image storage bucket
- [x] Audit logging system (driver_logs)

### User Tracking ✅ NEW
- [x] Track LINE user profiles (user_id, display_name, picture_url)
- [x] First visit timestamp
- [x] Last visit timestamp
- [x] Total visits counter
- [x] Last searched reference tracking
- [x] Auto-save on LIFF init
- [x] Update on each search

### Advanced Features ✅ UPDATED
- [x] **Geofencing:** Automatically verifies driver's location against destination coordinates before allowing Check-in, ensuring they are within the allowed radius (e.g., 200m).
- [x] **Admin Mode:** A hidden mode for administrators (`user_type = 'ADMIN'`) that bypasses the geofencing check for testing and debugging purposes.
- [x] **User Approval Workflow:** App prevents usage until a user's profile status is set to 'APPROVED' in the `user_profiles` table by an admin.
- [x] **Robust Offline Mode:** Actions (check-in, alcohol tests, etc.) are queued locally when offline and synced automatically with retry logic when the connection is restored.
- [x] **Realtime Data Sync:** Subscribes to Supabase realtime updates for the current job, automatically refreshing the data on the screen when changes occur in the database.
- [x] **Stop Filtering:** Automatically filters out any destination stop containing "คลังศรีราชา" from being displayed in the timeline or synced to the `jobdata` table.
- [x] **Live Tracking (Smart Model):** ✨ - Automatically sends driver location every 5 minutes in normal mode. When an admin opens the tracking page, switches to high-frequency mode (every 15 seconds) for real-time monitoring, then returns to normal when the page closes.
- [x] **GPS Stability with localStorage Fallback:** ✨ NEW - Auto-saves GPS position on every read to localStorage with 24hr TTL. Uses fallback chain (GPS → Memory → localStorage) to ensure position data is never lost even when GPS timeout occurs.
- [x] **ETA Calculation:** ✨ NEW - Tracking page calculates estimated time of arrival to next stop based on Haversine distance formula and average speed (45-60 km/h). Displays distance, travel time, and arrival time with visual route line on map.

### UX Quick Wins ✅ NEW (Jan 21, 2026)
- [x] **Haptic Feedback:** ✨ - Vibration on success/error actions (double-tap for success, long vibration for error, triple-tap for celebration)
- [x] **Loading Skeletons:** ✨ - Beautiful animated loading states for timeline and summary (replaces blank screens)
- [x] **Empty States:** ✨ - User-friendly messages with icons for no data, errors, and no results scenarios
- [x] **Trip Summary Modal:** ✨ - Celebration modal with trip statistics (duration, stops, distance) shown on job completion with confetti animation

### Holiday Work Approval System ✅ NEW (Jan 21, 2026)
**Driver App (Phase 1):**
- [x] Required textarea for holiday work notes (min 10 characters)
- [x] Validation with warning about supervisor approval
- [x] Save to `holiday_work_notes` field in jobdata table
- [x] Set `holiday_work_approved = false` (pending)
- [x] Show orange badge in Trip Summary "รอการอนุมัติ"
- [x] Append notes to audit log in driver_logs

**Admin Dashboard (Phase 2):**
- [x] Full-featured approval dashboard in admin/index.html
- [x] Real-time KPI cards (pending/approved/rejected counts)
- [x] Advanced filtering (status, date range, search)
- [x] Approve/Reject workflow with admin comments
- [x] Save approver ID (LINE userId) and timestamp
- [x] Update holiday_work_approved, holiday_work_approved_by, holiday_work_approved_at

**Real-time Updates (Phase 3):**
- [x] Supabase Realtime subscription to jobdata table
- [x] Auto-update navigation badge with pending count
- [x] Live notifications for new requests and approvals
- [x] Auto-refresh table when viewing holiday-work page
- [x] Pulse animation on badge updates
- [x] Auto-reconnect on connection failure

**Job Activity Notifications (Phase 4):** ✅ NEW
- [x] Real-time checkin notifications
- [x] Real-time checkout notifications
- [x] Trip completion notifications
- [x] Toast notifications with auto-dismiss
- [x] Auto-reconnect on failure

**Group Holiday Approval (Phase 5):** ✅ NEW
- [x] Group by reference in table view
- [x] Show stop count badge (X จุด)
- [x] Update ALL stops on approval/reject
- [x] Modal displays stop count
- [x] Success message shows affected count

---

## ⏳ Pending Tasks

### High Priority
- [x] **Update to use index-supabase-modular.html** ✅ DONE
  - ตอนนี้ใช้ `index-supabase-modular.html` เป็น base หลักแล้ว
  - Status: **ACTIVE IN USE**

- [x] **Apply user_profiles migration SQL** ✅ DONE
  - File: `supabase/migrations/20260117_update_user_profiles.sql`
  - Action: Run in Supabase SQL Editor
  - URL: https://supabase.com/dashboard/project/myplpshpcordggbbtblg/sql/new
  - Status: **APPLIED** (Jan 22, 2026)

- [x] **Apply driver_live_locations migration SQL** ✅ DONE
  - File: `supabase/migrations/20260120134241_create_driver_live_locations_table.sql`
  - Action: Run in Supabase SQL Editor
  - Priority: **HIGH** - Required for live tracking to work
  - Status: **APPLIED** (Jan 22, 2026)

- [ ] **Update LINE LIFF Endpoint URL (Optional)**
  - Current: May still point to old version
  - Recommended: Point to index-supabase-modular.html
  - URL: https://developers.line.biz/console/
  - Note: Can be done later if testing via direct URL

- [ ] **Commit and push all changes**
  ```cmd
  git add .
  git commit -m "Add user profile tracking to modular version"
  git push
  ```

### Google Chat Notification Feature (REVISED)
- [ ] **(ผู้ใช้) กำหนดเหตุการณ์ (Trigger Event):** ตัดสินใจว่าจะให้ส่งการแจ้งเตือนเมื่อใด (เช่น เมื่อ `job_closed` เป็น true)
- [ ] **(ผู้ใช้) ตั้งค่า Google Service Account:** (สำหรับส่ง DM) ดำเนินการตาม "ขั้นตอนการตั้งค่าที่ต้องทำเพิ่ม" และบันทึก Key เป็น Secret ใน Supabase
- [ ] **(ผู้ใช้) สร้าง Secret สำหรับ Admin-Mode:** สร้าง Secret ใหม่ชื่อ `ADMIN_NOTIFICATION_WEBHOOK` พร้อมใส่ URL/Email สำหรับรับการแจ้งเตือนตอนทดสอบ
- [x] **(Database)** สร้าง/แก้ไขไฟล์ SQL migration สำหรับตาราง `google_chat_webhooks` ให้มีคอลัมน์ `notification_type` และ `target_address`
- [ ] **(Backend)** เพิ่ม Logic ตรวจสอบ `user_type` ใน Edge Function `send-google-chat-notification` เพื่อเปลี่ยนเส้นทางการส่งถ้าเป็น 'ADMIN'
- [ ] **(Backend)** พัฒนา Logic ส่วน **Webhook** ใน Edge Function `send-google-chat-notification`
- [ ] **(Backend)** พัฒนา Logic ส่วน **Direct Message (DM)** ใน Edge Function โดยใช้ Google Auth Library และ Service Account Key
- [ ] **(Integration)** ติดตั้ง Database Trigger หรือแก้ไขโค้ดเดิมเพื่อเรียกใช้ Edge Function
- [ ] **(Admin UI - Optional)** พัฒนาหน้าจอในส่วน Admin เพื่อให้จัดการเป้าหมายการแจ้งเตือน (webhook/dm) ได้
- [ ] **(Testing)** ทดสอบการส่งแจ้งเตือนทั้ง 2 รูปแบบ (Webhook และ DM) และทดสอบ Admin Mode Override

### Live Tracking Feature (Smart Tracking Model) ✅ COMPLETED
- [x] **(Database)** สร้างไฟล์ SQL migration สำหรับตาราง `driver_live_locations` และเพิ่มคอลัมน์ `is_tracked_in_realtime` (boolean)
- [x] **(Backend)** สร้าง Edge Function `start-live-tracking` และ `stop-live-tracking` - **DEPLOYED**
- [x] **(Driver App)** Implement Supabase Realtime subscription เพื่อ "ฟัง" การเปลี่ยนแปลงของ `is_tracked_in_realtime` ในแถวของตัวเอง
- [x] **(Driver App)** Implement Logic การสลับโหมดส่งข้อมูล (15 วินาที vs 5 นาที) ตาม event ที่ได้รับจาก Realtime
- [x] **(Driver App)** Fix initialization order - เรียก liveTracking.init() หลัง LIFF login สำเร็จ
- [x] **(Driver App)** Add localStorage fallback - บันทึกพิกัดทุกครั้งที่อ่าน GPS (gps.js)
- [x] **(Tracking Page)** สร้างหน้า `track/index.html` พร้อมแผนที่ Leaflet.js - **COMPLETE**
- [x] **(Tracking Page)** Implement Logic การเรียก `start-live-tracking` เมื่อเปิดหน้า และ `stop-live-tracking` เมื่อปิดหน้า (on unload)
- [x] **(Tracking Page)** Add ETA calculation - คำนวณเวลาถึงจุดถัดไปด้วย Haversine formula
- [x] **(Tracking Page)** Fix 0,0 coordinates validation and error handling
- [x] **(Documentation)** สร้างเอกสาร LIVE_TRACKING_GUIDE.md, QUICKSTART.md, และ SUMMARY.md
- [ ] **(Database)** Apply migration ใน Supabase SQL Editor - **PENDING**
- [ ] **(Integration)** ปรับปรุง Flow การส่ง Notification ให้สร้าง `tracking_id` ที่ไม่ซ้ำกัน และแนบลิงก์ไปยังหน้า Tracking Page
- [x] **(Testing)** ทดสอบ GPS fallback และ localStorage persistence
  
**Files Created:**
- `js/live-tracking.js` - Core tracking module with localStorage fallback
- `js/gps.js` - Enhanced with auto-save to localStorage
- `track/index.html` - Interactive map tracking page with ETA
- Edge Functions: `start-live-tracking`, `stop-live-tracking`
- Documentation: Full guides and deployment scripts

**Recent Improvements (2026-01-21):**
- ✅ GPS Stability: Auto-save to localStorage on every GPS read
- ✅ Fallback Chain: GPS → Memory → localStorage (24hr TTL)
- ✅ Coordinate Validation: Reject 0,0 and out-of-bounds coordinates
- ✅ ETA Calculation: Distance + Travel Time + Arrival Time
- ✅ Visual Route: Dashed line between current and destination
- ✅ GPS Settings: Increased timeout to 60s, maximumAge to 30s

### Testing Needed
- [x] Test GPS fallback when timeout occurs
- [x] Test localStorage persistence across page reloads
- [x] Test ETA calculation accuracy
- [ ] Test user profile tracking in production
- [ ] Verify total_visits increments correctly
- [ ] Verify last_reference updates on search
- [ ] Test all CRUD operations (Create, Read, Update stops)
- [ ] Test alcohol upload with large images
- [ ] Test offline behavior and error handling

### Future Enhancements
- [x] **(COMPLETED)** Live Tracking with Smart Tracking Model - See LIVE_TRACKING_GUIDE.md
- [ ] Enable RLS with proper auth policies for production
- [ ] Add user device info to user_profiles (device type, browser, OS)
- [ ] Add app version tracking
- [ ] Create admin dashboard to view user analytics
- [ ] Add notification preferences storage in user_profiles
- [ ] Implement real-time notifications via LINE Messaging API
- [ ] Add job assignment/dispatch feature
- [ ] Add earnings/salary calculation
- [ ] Export job reports to PDF
- [ ] Multi-language support (TH/EN)

---

## 🗺️ Product Roadmap (2026)

### **Q1 2026 - Foundation & Stability** ✅ IN PROGRESS

#### ✅ Completed
- [x] Core tracking features
- [x] GPS with localStorage fallback
- [x] Live tracking system
- [x] ETA calculation
- [x] Offline queue
- [x] User approval workflow
- [x] **Quick Wins (Jan 21, 2026)** 🎉
  - [x] Haptic Feedback (vibration on success/error)
  - [x] Loading Skeletons (timeline & summary)
  - [x] Empty States (no jobs, no stops, errors)
  - [x] Trip Summary Modal (celebration with stats)
- [x] **Holiday Work Approval System (Jan 21, 2026)** 🎊
  - [x] Phase 1: Driver notes with validation (30 min)
  - [x] Phase 2: Admin approval dashboard (1-2 hrs)
  - [x] Phase 3: Real-time updates + badge (30 min)

#### 🔄 In Progress
- [ ] Database migration completion
- [ ] Production deployment
- [ ] User acceptance testing
- [ ] Performance optimization

---

### **Q2 2026 - User Experience Enhancement**

#### 📱 Mobile Experience
- [ ] **Progressive Web App (PWA)** - 2 weeks
  - Add manifest.json
  - Service Worker for offline
  - Install prompt
  - Push notifications
  - Background sync

- [ ] **Improved UI/UX** - 1 week ⚡ PARTIALLY DONE
  - [x] Loading skeletons ✅ 
  - [x] Empty states ✅
  - [ ] Error boundaries
  - [x] Haptic feedback ✅
  - [ ] Sound notifications
  - [ ] Smooth animations

- [ ] **Performance Optimization** - 1 week
  - Code splitting
  - Lazy loading
  - Image optimization
  - Cache strategies
  - Bundle size reduction

#### 📊 Driver Features
- [ ] **Trip Summary Dashboard** - 3 days ⚡ PARTIALLY DONE
  - [x] Trip completion modal with stats ✅
  - [ ] Daily/Weekly/Monthly stats
  - [ ] Performance metrics
  - [ ] Earnings summary
  - [ ] Achievement badges
  - [ ] Leaderboard

- [ ] **Driver Profile Enhancement** - 2 days
  - Personal statistics
  - Delivery history
  - Rating system
  - Preferences settings
  - Document management

- [ ] **Communication Tools** - 3 days
  - In-app chat with dispatch
  - Quick message templates
  - Photo sharing
  - Voice messages
  - Read receipts

---

### **Q3 2026 - Admin & Management Tools**

#### 🎛️ Admin Dashboard
- [ ] **Fleet Management Dashboard** - 2 weeks
  - Real-time map (all vehicles)
  - Driver status overview
  - Trip assignments
  - Performance KPIs
  - Alert system

- [ ] **Analytics & Reporting** - 1.5 weeks
  - Custom date range reports
  - Export to Excel/PDF
  - Visual charts (Chart.js)
  - Delivery success rate
  - Cost analysis
  - Driver performance matrix

- [ ] **User Management** - 1 week
  - Approve/Reject drivers
  - Role management
  - Permissions control
  - Activity logs
  - Bulk operations

#### 📢 Notification System
- [ ] **Google Chat Integration** - 1 week
  - Job status notifications
  - Exception alerts
  - Daily summaries
  - Webhook management UI

- [ ] **LINE Notify Integration** - 3 days
  - Personal notifications
  - Group broadcasts
  - Rich messages
  - Stickers support

- [ ] **Email Notifications** - 2 days
  - Automated reports
  - Alert emails
  - Newsletter
  - Template management

---

### **Q4 2026 - Intelligence & Optimization**

#### 🤖 Smart Features
- [ ] **Route Optimization** - 3 weeks
  - Google Maps Directions API
  - Multi-stop optimization
  - Traffic-aware routing
  - Fuel-efficient routes
  - Time window constraints

- [ ] **Predictive Analytics** - 2 weeks
  - ETA prediction with ML
  - Delay detection
  - Traffic pattern analysis
  - Historical data mining
  - Anomaly detection

- [ ] **Smart Recommendations** - 1 week
  - Best route suggestions
  - Optimal break times
  - Fuel stop recommendations
  - Weather alerts
  - Maintenance reminders

#### 🔒 Security & Compliance
- [ ] **Enhanced Security** - 1 week
  - RLS policies enabled
  - Rate limiting
  - API key rotation
  - Audit trail
  - GDPR compliance

- [ ] **Compliance Features** - 1 week
  - Driver hour tracking
  - Break enforcement
  - Document expiry alerts
  - Safety checklists
  - Incident reporting

---

## 🎯 Feature Priorities (Impact vs Effort)

### **High Impact, Low Effort** ⭐ DO FIRST
| Feature | Effort | Impact | Timeline |
|---------|--------|--------|----------|
| Loading Skeletons | 2h | High | Week 1 |
| Empty States | 2h | High | Week 1 |
| Haptic Feedback | 1h | Medium | Week 1 |
| Sound Notifications | 1h | Medium | Week 1 |
| Trip Summary | 3d | High | Week 2 |
| LINE Notify | 3d | High | Week 2 |

### **High Impact, High Effort** 🚀 STRATEGIC
| Feature | Effort | Impact | Timeline |
|---------|--------|--------|----------|
| Admin Dashboard | 2w | Very High | Month 2 |
| Route Optimization | 3w | Very High | Month 3-4 |
| PWA Implementation | 2w | High | Month 2 |
| Analytics System | 1.5w | High | Month 2-3 |
| Predictive Analytics | 2w | High | Month 4 |

### **Low Impact, Low Effort** ✅ NICE TO HAVE
| Feature | Effort | Impact | Timeline |
|---------|--------|--------|----------|
| Dark Mode Improvements | 1d | Low | Anytime |
| Multi-language | 2d | Medium | Month 3 |
| Custom Themes | 1d | Low | Anytime |
| Export to PDF | 2d | Medium | Month 3 |

### **Low Impact, High Effort** ⚠️ AVOID
| Feature | Effort | Impact | Timeline |
|---------|--------|--------|----------|
| Native Mobile App | 8w | Medium | Future |
| Blockchain Integration | 4w | Low | Not Planned |

---

## 🛠️ Technical Improvements

### **Performance**
- [ ] Implement code splitting
- [ ] Add service worker
- [ ] Optimize bundle size (<500KB)
- [ ] Implement lazy loading
- [ ] Add CDN for assets
- [ ] Database query optimization
- [ ] Add Redis caching layer

### **Testing**
- [ ] Unit tests (Jest)
- [ ] Integration tests (Cypress)
- [ ] E2E tests (Playwright)
- [ ] Performance tests (Lighthouse)
- [ ] Load testing (k6)
- [ ] Security testing (OWASP)
- [ ] Accessibility testing (WAVE)

### **DevOps**
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Automated testing
- [ ] Staging environment
- [ ] Blue-green deployment
- [ ] Monitoring (Sentry)
- [ ] Logging (LogRocket)
- [ ] Analytics (Google Analytics)

### **Documentation**
- [ ] API documentation (Swagger)
- [ ] User guide (interactive)
- [ ] Admin guide
- [ ] Developer guide
- [ ] Troubleshooting guide
- [ ] Video tutorials
- [ ] FAQ section

---

## 📊 Success Metrics

### **User Metrics**
```
Target (3 months):
- Daily Active Users: 50+
- Weekly Active Users: 100+
- User Retention (30-day): >80%
- Average Session Time: >5 min
- Feature Adoption Rate: >60%
```

### **Performance Metrics**
```
Target:
- Page Load Time: <2s
- Time to Interactive: <3s
- GPS Lock Time: <5s
- API Response Time: <500ms
- Error Rate: <1%
- Uptime: >99.9%
```

### **Business Metrics**
```
Target:
- Trips per Driver/Day: 8-12
- On-Time Delivery Rate: >95%
- Average Trip Duration: <2h
- Customer Satisfaction: >4.5/5
- Cost per Trip: Reduce 10%
```

---

## 🚨 Risk Management

### **Technical Risks**
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| GPS Accuracy Issues | High | Medium | Multi-source fallback, WiFi triangulation |
| Battery Drain | Medium | High | Optimize tracking intervals, power modes |
| Network Instability | High | Medium | Offline queue, retry logic |
| Database Performance | High | Low | Indexing, query optimization, caching |
| Security Breach | Critical | Low | RLS, rate limiting, audit logs |

### **Business Risks**
| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Low User Adoption | High | Medium | Training, incentives, feedback loops |
| Driver Resistance | Medium | Medium | Change management, demos, support |
| Competitor Features | Medium | Medium | Continuous innovation, user feedback |
| Budget Overrun | Medium | Low | Phased rollout, MVP approach |

---

## 💰 Cost Estimation

### **Infrastructure (Monthly)**
```
Supabase Pro: $25
GitHub Pages: Free
Domain: $1
Monitoring: $10
Total: ~$36/month
```

### **Third-party Services (Optional)**
```
Google Maps API: $0-200 (depends on usage)
LINE Messaging API: Free-$100
SMS Notifications: $0-50
Email Service: $0-20
```

### **Development Time**
```
Q2 Features: 6 weeks (1 developer)
Q3 Features: 5 weeks (1 developer)
Q4 Features: 6 weeks (1 developer)
Total: ~17 weeks = 4 months
```

### Admin Panel Enhancements (Recommended)
- [ ] **Unified Settings Page (หน้าจอตั้งค่าระบบแบบรวม)**
  - **คำอธิบาย:** สร้างหน้าเว็บ `admin/settings.html` ที่รวมการตั้งค่าทั้งหมดของระบบไว้ในที่เดียว โดยแต่ละการตั้งค่าจะมี "ปุ่มเปิด/ปิด" (Toggle Switch) หรือช่องให้กรอกข้อมูลได้อย่างอิสระ
  - **ฐานข้อมูล:** ต้องสร้างตาราง `system_settings` (key-value store) เพื่อเก็บค่าเหล่านี้ และ Edge Function ต่างๆ จะต้องอ่านค่าจากตารางนี้ก่อนทำงาน
  - **รายการ Settings ที่จะแสดงใน UI:**
    - **Live Tracking Settings:**
        -   `[Toggle]` เปิด/ปิด ระบบติดตามรถแบบสด (`enable_live_tracking`)
        -   `[Input]` ความถี่โหมดไลฟ์ (วินาที) (`live_tracking_interval_seconds`)
        -   `[Input]` ความถี่โหมดปกติ (วินาที) (`normal_tracking_interval_seconds`)
        -   `[Input]` อายุของลิงก์ติดตาม (ชั่วโมง) (`tracking_link_ttl_hours`)
    - **Notification Settings:**
        -   `[Toggle]` เปิด/ปิด ระบบแจ้งเตือนทั้งหมด (`enable_all_notifications`)
        -   `[Toggle]` เปิด/ปิด การแจ้งเตือน "ปิดงาน" (Job Closed)
        -   `[Toggle]` เปิด/ปิด การแจ้งเตือน "สิ้นสุดทริป" (Trip Ended)
- [ ] **Notification Target Management**
    - **รายละเอียด:** สร้างหน้าจอ CRUD สำหรับจัดการ `notification_targets` เพื่อให้ Admin เพิ่ม/ลบ/แก้ไข ปลายทางของการแจ้งเตือนได้ (ทั้ง Google Chat Webhook และ LINE User ID)
- [ ] **Driver Tracking (Live Location with History Playback)**
- [ ] **Alerts & Anomaly Detection (การแจ้งเตือนและตรวจจับความผิดปกติ)**
- [ ] **Actionable Notifications (การแจ้งเตือนที่สั่งการได้)**
- [ ] **Analytics Dashboard (แดชบอร์ดสรุปผลเชิงวิเคราะห์)**
- [ ] **Visual Geofence Management (การจัดการ Geofence บนแผนที่)**

---

## 🐛 Known Issues

### Resolved ✅
- ~~Duplicate `supabase` constant declaration~~ - Fixed in v3
- ~~Table name mismatch (jobdata vs driver_jobs)~~ - Fixed in supabase-api.js
- ~~RLS blocking access (406 errors)~~ - Fixed with 20260117_fix_rls_policies.sql
- ~~Syntax error in supabase-api.js line 368~~ - Fixed duplicate code
- ~~LIFF endpoint URL mismatch warning~~ - Need to update in LINE Console

### Active Issues
- ⚠️ LIFF still pointing to old v2 URL (need manual update)
- ⚠️ user_profiles columns may be missing (need to run migration)

---

## 📋 Development Workflow

### Before Making Changes

1. **Read this PLAN.md** - Understand current state
2. **Check Project Structure** - Know which files to modify
3. **Review Database Schema** - Understand data relationships
4. **Check Known Issues** - Avoid repeating past mistakes
5. **Test locally first** - Use test-supabase-debug.html if needed

### Making Changes

1. **Identify affected files** - Usually app.js, supabase-api.js, or HTML
2. **Make minimal changes** - Don't refactor unnecessarily
3. **Test incrementally** - Test each change before moving to next
4. **Update this PLAN.md** - Document what you did
5. **Commit with clear message** - Explain what and why

### After Changes

1. **Test in browser** - Open index-supabase-modular.html
2. **Check console** - Look for errors
3. **Test all features** - Search, check-in, upload, etc.
4. **Commit and push** - Save your work
5. **Update documentation** - If needed

---

## 📝 Common Operations

### Run Supabase Migration
```cmd
cd D:\VS_Code_GitHub_DATA\eddication.io\eddication.io
supabase db execute --file supabase\migrations\[filename].sql
```

### Check Supabase Status
```cmd
supabase status
supabase migration list
```

### Deploy to GitHub Pages
```cmd
git add .
git commit -m "Your message"
git push
```
Then access: https://donnigami.github.io/eddication.io/PTGLG/driverconnect/driverapp/index-supabase-modular.html

### Update LIFF Endpoint
1. Go to: https://developers.line.biz/console/
2. Find LIFF ID: 2007705394-Fgx9wdHu
3. Update Endpoint URL
4. Wait 1-2 minutes for propagation

---

## 🔍 Sample Data for Testing

```
Job Reference: 2601S16472
Vehicle: ABC-1234
Stops: 2 stops
Status: Active

Job Reference: 2512S08072
(Add more as you create test data)
```

---

## 💡 Important Notes

### Architecture Decisions
- **Modular JS** - Use ES6 modules, not inline scripts
- **JSONB locations** - Flexible structure `{lat, lng}` instead of separate columns
- **No RLS** - Currently disabled for testing, enable for production
- **User tracking** - Only save users with ID starting with 'U' (real LINE users)

### File Naming
- `index-supabase-modular.html` - ✅ **ACTIVE** production file (currently in use)
- `index-supabase-v2.html` - 📦 Old version, keep for reference
- `index-test-20260115.html` - 📚 Original with all features, keep for reference

### Debugging
- Use `test-supabase-debug.html` for connection troubleshooting
- Check browser console for detailed error messages
- Use Supabase Dashboard SQL Editor for database inspection

---

## 🎯 Success Criteria

Application is considered "production-ready" when:

- [x] LIFF login works consistently
- [x] Search finds jobs from driver_jobs table
- [x] All stop operations (check-in, fuel, unload, checkout) work
- [x] Alcohol test uploads successfully to storage
- [x] GPS captures location accurately
- [x] Dark mode persists across sessions
- [x] Enhanced UX features work (PTR, toast, quick actions)
- [ ] User tracking saves and updates correctly
- [ ] No console errors on normal operation
- [ ] RLS enabled with proper policies (production only)

---

## 📞 Quick Reference

**Supabase Dashboard:** https://supabase.com/dashboard/project/myplpshpcordggbbtblg  
**LINE Developers:** https://developers.line.biz/console/  
**GitHub Pages:** https://donnigami.github.io/eddication.io/PTGLG/driverconnect/driverapp/index-supabase-modular.html  
**LIFF Direct:** https://liff.line.me/2007705394-Fgx9wdHu  
**Live Tracking Page:** https://donnigami.github.io/eddication.io/PTGLG/driverconnect/driverapp/track/?driver_user_id=YOUR_USER_ID ✨ NEW

**Documentation:**
- Live Tracking Guide: `LIVE_TRACKING_GUIDE.md`
- Quick Start: `LIVE_TRACKING_QUICKSTART.md`
- Deployment Status: `DEPLOYMENT_STATUS.md`

---

## 📚 Change Log

### 2026-01-21 - GPS Stability & ETA Calculation ✨ LATEST
- **Objective:** Improve GPS tracking reliability and add ETA calculation to tracking page
- **Changes:**
  - **GPS Stability Improvements:**
    - Modified `gps.js` to auto-save GPS position to localStorage on every read
    - Added localStorage backup with 24-hour TTL
    - Implemented fallback chain: GPS → Memory → localStorage
    - Increased GPS timeout to 60s and maximumAge to 30s
    - Added coordinate validation (reject 0,0 and out-of-bounds)
  - **Live Tracking Enhancements:**
    - Fixed initialization order in `app.js` - now calls after LIFF login
    - Added localStorage load/save methods in `live-tracking.js`
    - Implemented `sendFallbackLocation()` for GPS timeout handling
    - Exposed `window.liveTracking` for debugging
  - **Tracking Page ETA Feature:**
    - Added Haversine distance calculation (km)
    - Implemented ETA calculation based on average speed (45-60 km/h)
    - Display next stop destination on map with marker (📍)
    - Draw dashed route line between current and destination
    - Show distance (km) and estimated arrival time
    - Fixed 0,0 coordinates validation with waiting state
    - Auto-fit map bounds to show both markers
- **Files Modified:**
  - `js/gps.js` - Auto-save to localStorage on every GPS read
  - `js/live-tracking.js` - Add localStorage persistence and fallback logic
  - `js/app.js` - Move liveTracking.init() after LIFF login
  - `js/config.js` - Increase GPS timeout and maximumAge
  - `track/index.html` - Add ETA calculation and fix validation
- **Status:** ✅ All changes committed and pushed to GitHub
- **Impact:** 
  - GPS tracking is now highly stable with 3-layer fallback
  - Drivers never lose position data even with GPS timeout
  - Tracking page provides accurate ETA information
  - Better user experience with visual route display

### 2026-01-21 - Live Tracking Feature Implementation ✨
- **Objective:** Add real-time GPS tracking with Smart Model (auto-switching intervals)
- **Changes:**
  - Created `live-tracking.js` module with Realtime subscription
  - Added LIVE_TRACKING config to config.js (5min/15s intervals)
  - Integrated live tracking auto-init in app.js on LIFF login
  - Created Edge Functions: `start-live-tracking`, `stop-live-tracking`
  - Created `track/index.html` tracking page with Leaflet.js map
  - Created `cors.ts` helper for Edge Functions
  - Fixed `edge_runtime.port` config error in config.toml
- **Features:**
  - Normal mode: Send location every 5 minutes (battery-efficient)
  - LIVE mode: Send location every 15 seconds (real-time)
  - Auto-switch based on tracking page open/close
  - Interactive map with real-time updates
  - Status indicator (LIVE/Normal mode)
- **Files Created:**
  - `js/live-tracking.js`
  - `track/index.html`
  - `supabase/functions/start-live-tracking/index.ts`
  - `supabase/functions/stop-live-tracking/index.ts`
  - `supabase/functions/_shared/cors.ts`
  - `LIVE_TRACKING_GUIDE.md`
  - `LIVE_TRACKING_QUICKSTART.md`
  - `LIVE_TRACKING_SUMMARY.md`
  - `deploy-live-tracking.bat`
- **Files Modified:**
  - `js/config.js` - Added LIVE_TRACKING config
  - `js/app.js` - Added live tracking initialization
  - `PLAN.md` - Updated flows and documentation
  - `supabase/config.toml` - Fixed edge_runtime config
- **Migrations:** 20260120134241_create_driver_live_locations_table.sql (pending)
- **Status:** Edge Functions deployed ✅ | Code pushed to GitHub ✅ | Migration pending

### 2026-01-17 - Schema Alignment with app/PLAN.md
- **Objective:** Align driverapp schema with migration plan in `PTGLG/driverconnect/app/PLAN.md`
- **Changes:**
  - Renamed table references: driver_jobs → trips, driver_stops → trip_stops, driver_alcohol_checks → alcohol_checks
  - Updated supabase-api.js to use TABLES constant for all table references
  - Added new column mappings: sequence, destination_name, check_in_time, check_out_time, fueling_time, unload_done_time
  - Added trip_id FK to trip_stops and alcohol_checks tables
  - Changed storage bucket from 'alcohol-checks' to 'alcohol-evidence'
  - Created migration SQL: `20260117_migrate_to_trips_schema.sql`
  - Created storage bucket SQL: `20260117_create_alcohol_evidence_bucket.sql`
- **Backward Compatibility:** Old column names preserved alongside new ones
- **Files Modified:** `js/supabase-api.js`, `PLAN.md`
- **Migrations:** 2 new SQL files pending execution

### 2026-01-17 - Bug Fix: Pull-to-Refresh Search Error
- **Issue:** PTR called `window.search()` which didn't exist (ES6 module scope)
- **Fix:** Changed to `window.DriverApp.search()` in enhanced-ux.js line 57
- **Impact:** Pull-to-Refresh now works correctly without console errors
- **Files Modified:** `js/enhanced-ux.js`

### 2026-01-17 - User Tracking Implementation
- Added user_profiles table with visit tracking
- Added saveUserProfile() and updateUserLastReference() to supabase-api.js
- Updated app.js to call profile functions on LIFF init and search
- Created 20260117_update_user_profiles.sql migration
- Only tracks users with ID starting with 'U' (real LINE users)

### 2026-01-17 - Core Features Migration
- Migrated from Google Sheets to Supabase
- Created driver_jobs, driver_stops, driver_alcohol_checks, driver_logs tables
- Fixed RLS blocking issues (disabled for testing)
- Updated all API functions in supabase-api.js to use new tables
- Changed location format to JSONB

### 2026-01-17 - Enhanced UX Addition
- Added Pull-to-Refresh functionality
- Added Toast notification system
- Added Quick Actions Bar
- Added Syncing status indicator
- Added Notification Settings popup
- Created enhanced-ux.js module

### 2026-01-16 - Initial Supabase Setup
- Created Supabase project
- Set up LINE LIFF integration
- Created initial HTML structure

---

## 🔄 Application Process Flow

> **Reference:** `index-test-20260115.html` (Original implementation)

### 1. Initialization Flow

```
[User opens LIFF URL]
        ↓
[liff.init({liffId})]
        ↓
[liff.isLoggedIn()?]
        ├─── No ──> [liff.login()]
        ↓ Yes
[Get Profile: liff.getProfile()]
        ↓
[Save/Update user_profiles table (Supabase)]
        ↓
[Fetch full user profile from Supabase]
        ↓
[Is user_profile.status === 'APPROVED'?]
        ├─── No ──> [Display 'Waiting for Approval' & block UI]
        ↓ Yes
[Display: "สวัสดี {displayName}"]
        ↓
[Initialize GPS, Admin Mode (if applicable), Offline Queue]
        ↓
[Auto-load last searched job from localStorage]
```

### 2. Search Job Flow

```
[User enters Reference Number]
        ↓
[Click "ค้นหา / ดึงงาน" button]
        ↓
[Validate input (not empty)]
        ↓
[Query Supabase: trips WHERE reference_no = ?]
        ↓
    ┌───┴───┐
    │ Not Found │ Found
    ↓           ↓
[Show error] [Fetch trip_stops WHERE trip_id = ?]
                ↓
            [Update user_profiles.last_reference]
                ↓
            [Cache to localStorage]
                ↓
            [Display Summary Card]
                ↓
            [Render Timeline with stops]
                ↓
            [Setup Quick Actions for next stop]
                ↓
            [Start Auto-refresh timer]
```

### 3. Alcohol Check Flow

```
[Click "บันทึกผลแอลกอฮอล์" button]
        ↓
[SweetAlert2 Popup: input alcohol value]
        ↓
[User enters value (0.00 format)]
        ↓
[SweetAlert2 Popup: capture/upload image]
        ↓
[Get current GPS location]
        ↓
[Upload image to Supabase Storage: 'alcohol-evidence' bucket]
        ↓
[Insert to alcohol_checks table:
 - trip_id, reference, driver_name
 - alcohol_value, image_url
 - location: {lat, lng}
 - created_at]
        ↓
[Show success toast notification]
        ↓
[Refresh job data]
```

### 4. Stop Status Update Flows

#### 4.1 Check-in Flow
```
[Click "Check-in" button on timeline stop]
        ↓
[Is it an Origin stop?]
        ├─── Yes ────────────────────────────────┐
        ↓                                        ↓
[Check if alcohol test is done]            [SweetAlert2: Input ODO, Receiver Name & Type]
        ↓                                        ↓
    ┌───┴───┐                                [Validate Inputs]
    │ No    │ Yes                              ↓
    ↓       ↓                             [User Confirms]
[Show Error] [SweetAlert2: Input Start ODO]     ↓
            ↓                             [Get current GPS location]
        [User Confirms]                       ↓
            ↓                             [Geofence Check: Is user within radius?]
[Get current GPS location]                     ↓
            ↓                               ┌───┴───┐
    │ No    │ Yes
    ↓       ↓
[Show Error] [Execute or Queue Update]
            ↓                                           ↓
    [Update trips: ODO_start]           [Show Error] [Execute or Queue Update]
            ↓                                           ↓
    [Update trip_stops: status, time, location] [Update trip_stops: status, time, ODO, receiver]
            ↓                                           ↓
    [Insert driver_logs: action='checkin']      [Insert driver_logs: action='checkin']
            ↓                                           ↓
    [Show Notification & Refresh]               [Show Notification & Refresh]
```

#### 4.2 Fuel Stop Flow
```
[Click "เติมน้ำมัน" button]
        ↓
[Get current GPS location]
        ↓
[SweetAlert2: input fuel liters & amount]
        ↓
[Update trip_stops:
 - fuel_location: {lat, lng}
 - fuel_liters, fuel_amount]
        ↓
[Insert driver_logs: action='fuel']
        ↓
[Show success notification]
```

#### 4.3 Unload Stop Flow
```
[Click "ลงสินค้า" button]
        ↓
[Get current GPS location]
        ↓
[Confirm with SweetAlert2]
        ↓
[Update trip_stops:
 - unload_location: {lat, lng}
 - unload_time: now()]
        ↓
[Insert driver_logs: action='unload']
        ↓
[Show success notification]
```

#### 4.4 Check-out Flow
```
[Click "Check-out" button]
        ↓
[Get current GPS location]
        ↓
[Validate: must have checked_in first]
        ↓
[Confirm with SweetAlert2]
        ↓
[Update trip_stops:
 - status: 'completed'
 - checkout_time: now()
 - checkout_location: {lat, lng}]
        ↓
[Insert driver_logs: action='checkout']
        ↓
[Check if all stops completed]
        ↓
    ┌───┴───┐
    │ No    │ Yes
    ↓       ↓
[Refresh] [Show "ปิดงาน" button]
```

### 5. Close Job Flow

```
[Click "ปิดงาน" button]
        ↓
[SweetAlert2: Input Driver Count, Vehicle Status, Holiday Work, etc.]
        ↓
[User Confirms]
        ↓
[Was 'Holiday Work' checked?]
        ├─── Yes ──> [Show 2nd Confirmation Dialog] ──> [User Cancels] ──> [Abort]
        ↓ No / User Confirms 2nd Dialog
[Execute or Queue 'closeJob']
        ↓
[Update jobdata table]
        ↓
[Insert driver_logs]
        ↓
[Show Success Notification & Refresh UI]
```

### 6. End Trip Flow

```
[Click "บันทึกจบทริป" button]
        ↓
[SweetAlert2: input ODO_end (ending mileage)]
        ↓
[Get current GPS location]
        ↓
[Update trips:
 - ODO_end: value
 - end_location: {lat, lng}
 - status: 'completed']
        ↓
[Insert driver_logs: action='end_trip']
        ↓
[Show success notification with trip summary]
```

### 7. Additional Features

#### 7.1 Offline Mode
```
[Network status change detected]
        ↓
    ┌───┴───┐
    │ Offline │ Online
    ↓         ↓
[Show offline bar] [Process offline queue]
[Queue actions to localStorage] [Sync pending items]
                                [Hide offline bar]
```

#### 7.2 Auto-Refresh
```
[Job is successfully loaded via Search]
        ↓
[Subscribe to Supabase Realtime Channel for the job]
        ↓
[Database change detected for the job]
        ↓
[Receive update payload]
        ↓
[Trigger a silent refresh: search(true)]
        ↓
[UI updates with new data]
```

#### 7.3 Pull-to-Refresh (PTR)
```
[User pulls down on container]
        ↓
[touchmove: calculate pull distance]
        ↓
[If distance > threshold (60px)]
        ↓
[Show PTR indicator with spinner]
        ↓
[touchend: trigger refresh]
        ↓
[Call window.DriverApp.search()]
        ↓
[Hide PTR indicator]
```

#### 7.4 GPS Monitor
```
[Initialize: navigator.geolocation.watchPosition()]
        ↓
[Every position update]
        ↓
[Calculate accuracy level:
 - excellent: < 10m
 - good: < 30m
 - fair: < 100m
 - poor: >= 100m]
        ↓
[Update GPS status indicator]
        ↓
[Store latest position for actions]
```

#### 7.5 Quick Actions Bar
```
[Job loaded with pending stops]
        ↓
[Find next incomplete stop]
        ↓
[Show floating quick actions bar]
        ↓
[Display relevant buttons:
 - Check-in (if not checked in)
 - Fuel (if checked in)
 - Unload (if checked in)
 - Check-out (if checked in)]
        ↓
[User clicks action → execute flow]
```

#### 7.6 Notification Settings
```
[Click notification bell icon]
        ↓
[Show settings popup:
 - Sound notifications toggle
 - Vibration toggle
 - Auto-refresh interval]
        ↓
[Save to localStorage]
        ↓
[Apply settings immediately]
```

#### 7.7 Dark Mode
```
[Click moon/sun icon]
        ↓
[Toggle document.body class 'dark-mode']
        ↓
[Save preference to localStorage]
        ↓
[CSS variables automatically switch:
 - --bg-main: light/dark
 - --text-main: dark/light
 - --card-bg: white/dark-gray]
```

### 8. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      LINE LIFF App                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   app.js    │  │ enhanced-   │  │   supabase-api.js   │ │
│  │  (Main UI)  │  │   ux.js     │  │   (API Layer)       │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                     │            │
│         │    ┌───────────────────────┐         │            │
│         │    │  live-tracking.js     │◄────────┤            │
│         │    │  (GPS Tracking)       │         │            │
│         │    └───────────┬───────────┘         │            │
│         └────────────────┼─────────────────────┘            │
│                          │                                  │
└──────────────────────────┼──────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                      Supabase Backend                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │    trips     │  │  trip_stops  │  │ driver_logs  │       │
│  │  (Headers)   │  │   (Items)    │  │   (Audit)    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────────┐  ┌─────────────────────────────┐      │
│  │  alcohol_checks  │  │  user_profiles              │      │
│  │                  │  │   (User Tracking)           │      │
│  └──────────────────┘  └─────────────────────────────┘      │
│  ┌──────────────────────────────────────────────────┐       │
│  │  driver_live_locations ✨ NEW                    │       │
│  │  (Real-time GPS Tracking)                        │       │
│  └──────────────────────────────────────────────────┘       │
│  ┌──────────────────────────────────────────┐               │
│  │         Storage: 'alcohol-evidence'      │               │
│  │              (Image uploads)             │               │
│  └──────────────────────────────────────────┘               │
│                                                              │
│  Edge Functions:                                            │
│  - start-live-tracking ✨ NEW                               │
│  - stop-live-tracking ✨ NEW                                │
└──────────────────────────────────────────────────────────────┘
                           ▲
                           │
┌──────────────────────────┴───────────────────────────────────┐
│                   Tracking Page (track/index.html)           │
│  - Leaflet.js map                                            │
│  - Real-time location display                                │
│  - Status indicator (LIVE/Normal)                            │
└──────────────────────────────────────────────────────────────┘
```

### 9. Live Tracking Flow (Smart Model) ✨ NEW

```
[Driver opens LIFF App]
         ↓
[LIFF Init & Login]
         ↓
[liveTracking.init(userId, tripId)]
         ↓
[Subscribe to Realtime channel: 'live-tracking-{userId}']
         ↓
[Start sending location in NORMAL mode (every 5 minutes)]
         ↓
┌────────────────────────────────────────────────────┐
│  NORMAL MODE - Battery Efficient                  │
│  🔋 Send location every 5 minutes (300,000ms)      │
│  📊 ~12 updates/hour, ~2% battery/hour            │
└────────────────────────────────────────────────────┘
         ↓
    [Background GPS tracking...]
         ↓
         │
         ├──────────────────────────────────┐
         │                                  │
         ↓                                  ↓
[Admin opens Tracking Page]        [Driver continues working]
         ↓
[GET driver_live_locations WHERE driver_user_id = ?]
         ↓
[Display map with current location]
         ↓
[Call Edge Function: start-live-tracking]
  POST /functions/v1/start-live-tracking
  Body: { driver_user_id, trip_id }
         ↓
[Edge Function: UPDATE driver_live_locations]
  SET is_tracked_in_realtime = true
         ↓
[Supabase Realtime broadcasts change]
         ↓
[Driver App receives Realtime event]
         ↓
[liveTracking.switchMode(true)]
         ↓
┌────────────────────────────────────────────────────┐
│  LIVE MODE - Real-time Tracking                   │
│  ⚡ Send location every 15 seconds (15,000ms)      │
│  📊 ~240 updates/hour, ~8% battery/hour           │
└────────────────────────────────────────────────────┘
         ↓
[High-frequency GPS updates...]
         ↓
[Tracking Page subscribes to Realtime updates]
         ↓
[Map updates in real-time with each location change]
         ↓
         │
         ↓
[Admin closes Tracking Page]
         ↓
[beforeunload event fires]
         ↓
[Call Edge Function: stop-live-tracking]
  POST /functions/v1/stop-live-tracking
  Body: { driver_user_id }
         ↓
[Edge Function: UPDATE driver_live_locations]
  SET is_tracked_in_realtime = false
         ↓
[Supabase Realtime broadcasts change]
         ↓
[Driver App receives Realtime event]
         ↓
[liveTracking.switchMode(false)]
         ↓
[Return to NORMAL MODE (5 minutes interval)]
```

### 10. Google Chat Notification Flow (REVISED)

```
[Event Triggered: e.g., 'job_closed' or 'trip_ended']
                  ↓
[Invoke Supabase Edge Function: 'send-google-chat-notification']
(Payload: { "job_id": 123, "event_type": "job_closed", "user_id": "U123..." })
                  ↓
[Edge Function: 'send-google-chat-notification' starts]
  1. Get user_id from payload and query 'user_profiles' table.
                  ↓
  ┌─────────────┴─────────────┐
  │ Is user_profile.user_type │ Is user_profile.user_type
  │      == 'ADMIN'?          │      != 'ADMIN'?
  ↓                           ↓
[PATH A: ADMIN/TEST MODE]     [PATH B: NORMAL MODE]
  1. Fetch 'ADMIN_NOTIFICATION_WEBHOOK' from Supabase Secrets.
  2. Format a special [TEST] message.
  3. Send notification ONLY to the admin webhook.
  4. End.
                              ↓
                            [Edge Function continues with normal logic]
                              1. Fetch job details from 'jobdata'.
                              2. Query 'google_chat_webhooks' for customer/station targets.
                              ↓
                              For each 'target' found:
                                - Get 'notification_type' and 'target_address'
                                ↓
                                ┌───────────┴───────────┐
                                │ type=='webhook'       │ type=='dm'
                                ↓                       ↓
                              [Send to Webhook]       [Send to DM via API]
                                ↓                       ↓
                              [Log success/failure]   [Log success/failure]
                                          ↓
[Message appears ONLY in Admin's Chat]    [Message appears in Customer/Station Chat]
```

---

## 🎊 Holiday Work Approval System (Implementation Details)

> **Implemented:** 2026-01-21  
> **Total Time:** ~2-3 hours (3 phases)  
> **Status:** ✅ Production Ready

### **Overview**
ระบบอนุมัติการทำงานวันหยุดที่สมบูรณ์แบบ ประกอบด้วย 3 ส่วนหลัก:
1. **Driver App:** คนขับกรอกเหตุผลเมื่อทำงานวันหยุด
2. **Admin Dashboard:** ผู้จัดการอนุมัติ/ปฏิเสธคำขอ
3. **Real-time Updates:** อัพเดทสถานะแบบ real-time

---

### **Phase 1: Driver App (30 minutes)**

#### **Files Modified:**
- `driverapp/js/app.js` - closeJob dialog enhancement
- `driverapp/js/supabase-api.js` - closeJob API update
- `driverapp/js/ui.js` - Trip Summary with holiday badge

#### **Features:**
```javascript
// 1. Required textarea for holiday work notes
if (formValues.isHolidayWork) {
  const { value: notes } = await Swal.fire({
    title: 'ยืนยันทำงานวันหยุด',
    html: '<textarea required minlength="10">...</textarea>',
    preConfirm: () => validateNotes() // Min 10 chars
  });
  formValues.holidayWorkNotes = notes;
}

// 2. Save to database
await SupabaseAPI.closeJob({
  ...closeJobData,
  isHolidayWork: true,
  holidayWorkNotes: notes
});

// 3. Show badge in Trip Summary
showTripSummary({
  ...tripData,
  isHolidayWork: true,
  holidayWorkNotes: notes
});
// Displays: 🎊 ทำงานวันหยุด - รอการอนุมัติ
```

#### **Database Fields (jobdata table):**
```sql
holiday_work_notes         TEXT    -- Driver's reason (required)
holiday_work_approved      BOOLEAN -- null = pending, true = approved, false = rejected
holiday_work_approved_by   TEXT    -- LINE userId of approver
holiday_work_approved_at   TIMESTAMP
```

#### **Validation:**
- Notes required (min 10 characters)
- Warning message shown
- Appended to driver_logs for audit

---

### **Phase 2: Admin Dashboard (1-2 hours)**

#### **Files Modified:**
- `admin/index.html` - Complete UI redesign
- `admin/admin.js` - New approval functions

#### **Dashboard Features:**

**1. KPI Cards (Real-time)**
```
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ รอการอนุมัติ    │ │ อนุมัติแล้ว     │ │ ปฏิเสธ          │
│      5          │ │      23         │ │      2          │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

**2. Advanced Filters**
- Status: All / Pending / Approved / Rejected
- Date Range: From - To
- Search: Reference, Driver, Vehicle

**3. Table View**
| Reference | Date | Driver | Vehicle | Notes | Status | Approver | Actions |
|-----------|------|--------|---------|-------|--------|----------|---------|
| 2601M01944 | 21/01 13:45 | ส.ชาย | รถ 1 | ลูกค้าขอ... | ⏳ รอ | - | [✅][❌] |

**4. Approval Modal**
```javascript
// Open modal
openHolidayApprovalModal(job, 'approve');

// Show job details
- Reference: 2601M01944
- Driver: ส.ชาย
- Vehicle: รถ 1
- Date: 21 ม.ค. 2026
- Reason: "ลูกค้าขอส่งของเพิ่มเติมเร่งด่วน"

// Admin adds comment (optional for approve, required for reject)
Comment: "อนุมัติตามคำขอ"

// Save approval
await supabase.from('jobdata').update({
  holiday_work_approved: true,
  holiday_work_approved_by: adminUserId,
  holiday_work_approved_at: new Date().toISOString(),
  holiday_work_notes: originalNotes + '\n[อนุมัติ โดย Admin]\n' + comment
});
```

**5. Functions Added:**
```javascript
// admin.js
async function loadHolidayWorkJobs(searchTerm, statusFilter)
async function updateHolidaySummary()
function openHolidayApprovalModal(job, action)
function closeHolidayApprovalModal()
async function handleHolidayApprovalSubmit(event)
```

---

### **Phase 3: Real-time Updates (30 minutes)**

#### **Files Modified:**
- `admin/admin.js` - Realtime subscription
- `admin/admin.css` - Pulse animation

#### **Features:**

**1. Supabase Realtime Subscription**
```javascript
holidayWorkRealtimeChannel = supabase
  .channel('holiday-work-changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'jobdata',
    filter: 'is_holiday_work=eq.true'
  }, (payload) => {
    // Handle INSERT/UPDATE/DELETE
    if (payload.eventType === 'INSERT') {
      showNotification(`🆕 มีคำขอใหม่: ${payload.new.reference}`);
    }
    // Auto-refresh if viewing holiday-work page
    if (currentPage === 'holiday-work') {
      loadHolidayWorkJobs();
    }
  })
  .subscribe();
```

**2. Navigation Badge**
```javascript
function updateHolidayNavBadge(count) {
  const badge = document.createElement('span');
  badge.textContent = count;
  badge.style.cssText = `
    background: #ff9800;
    color: white;
    padding: 2px 6px;
    border-radius: 10px;
    animation: pulse 0.5s ease-in-out;
  `;
  navLink.appendChild(badge);
}

// CSS Animation
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
}
```

**3. Auto-reconnect**
```javascript
.subscribe((status) => {
  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
    setTimeout(() => {
      subscribeToHolidayWorkUpdates(); // Retry after 5s
    }, 5000);
  }
});
```

---

### **Complete Workflow**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. DRIVER APP (Phase 1)                                     │
├─────────────────────────────────────────────────────────────┤
│ Driver closes job → Checks "ทำงานในวันหยุด"               │
│        ↓                                                    │
│ Swal.fire() shows textarea (min 10 chars)                   │
│        ↓                                                    │
│ Validates input → Shows warning about approval              │
│        ↓                                                    │
│ Saves to jobdata:                                           │
│   - holiday_work_notes = "ลูกค้าขอเพิ่มเติม..."          │
│   - holiday_work_approved = false (pending)                 │
│        ↓                                                    │
│ Trip Summary shows: 🎊 ทำงานวันหยุด - รอการอนุมัติ       │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. REAL-TIME (Phase 3)                                      │
├─────────────────────────────────────────────────────────────┤
│ Supabase Realtime detects INSERT event                      │
│        ↓                                                    │
│ Admin sees toast notification:                              │
│   "🆕 มีคำขอทำงานวันหยุดใหม่: 2601M01944"                │
│        ↓                                                    │
│ Navigation badge updates: 🎊 Holiday Work [5]              │
│   (with pulse animation)                                    │
│        ↓                                                    │
│ If viewing holiday-work page → Table auto-refreshes         │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. ADMIN DASHBOARD (Phase 2)                                │
├─────────────────────────────────────────────────────────────┤
│ Admin opens Holiday Work Approval page                      │
│        ↓                                                    │
│ Sees list of pending requests with filters                  │
│        ↓                                                    │
│ Clicks "✅ อนุมัติ" on specific request                    │
│        ↓                                                    │
│ Modal shows:                                                │
│   - Job details (ref, driver, vehicle, date)               │
│   - Driver's reason                                         │
│   - Textarea for admin comment (optional)                   │
│        ↓                                                    │
│ Admin clicks "✅ อนุมัติ"                                  │
│        ↓                                                    │
│ Updates ALL stops in reference (not just one):             │
│   - holiday_work_approved = true                            │
│   - holiday_work_approved_by = "U1234567..."               │
│   - holiday_work_approved_at = NOW()                        │
│   - holiday_work_notes += "\n[อนุมัติ โดย Admin]..."      │
│   WHERE reference = 'xxx' AND is_holiday_work = true        │
│        ↓                                                    │
│ Success notification + Table refresh                        │
│        ↓                                                    │
│ Status badge changes: ⏳ → ✅ อนุมัติแล้ว                  │
└─────────────────────────────────────────────────────────────┘
```

---

### **Database Queries**

```sql
-- Get pending approvals
SELECT * FROM jobdata 
WHERE is_holiday_work = true 
  AND (holiday_work_approved IS NULL OR holiday_work_approved = false)
  AND holiday_work_approved_at IS NULL
ORDER BY job_closed_at DESC;

-- Get approved
SELECT * FROM jobdata
WHERE is_holiday_work = true
  AND holiday_work_approved = true
ORDER BY holiday_work_approved_at DESC;

-- Get rejected
SELECT * FROM jobdata
WHERE is_holiday_work = true
  AND holiday_work_approved = false
  AND holiday_work_approved_at IS NOT NULL
ORDER BY holiday_work_approved_at DESC;

-- Count by status
SELECT 
  COUNT(*) FILTER (WHERE holiday_work_approved IS NULL) as pending,
  COUNT(*) FILTER (WHERE holiday_work_approved = true) as approved,
  COUNT(*) FILTER (WHERE holiday_work_approved = false AND holiday_work_approved_at IS NOT NULL) as rejected
FROM jobdata
WHERE is_holiday_work = true;
```

---

### **Testing Checklist**

**Driver App:**
- [ ] Close job → Check "ทำงานวันหยุด"
- [ ] Try submit without notes → See validation error
- [ ] Enter < 10 characters → See validation error
- [ ] Enter valid notes (10+ chars) → Success
- [ ] See Trip Summary with orange badge
- [ ] Check database: `holiday_work_approved = false`

**Admin Dashboard:**
- [ ] Open Holiday Work page
- [ ] See pending count in KPI card
- [ ] See pending count in navigation badge
- [ ] Filter by "รอการอนุมัติ" → See only pending
- [ ] Search by reference → Filter works
- [ ] Select date range → Filter works
- [ ] Click "✅ อนุมัติ" → Modal opens
- [ ] See job details and driver notes
- [ ] Add admin comment → Submit
- [ ] See success notification
- [ ] See status change to "อนุมัติแล้ว"
- [ ] Check database: `holiday_work_approved = true`

**Real-time:**
- [ ] Keep admin panel open (different tab)
- [ ] Driver submits new request
- [ ] See toast notification on admin
- [ ] See badge count increase
- [ ] See table auto-refresh
- [ ] Badge has pulse animation

---

### **Phase 4: Real-time Job Activity Notifications ✅ NEW (Jan 21, 2026)**

เพิ่มการแจ้งเตือนแบบ real-time สำหรับกิจกรรมการทำงานของคนขับ

#### **Files Modified:**
- `admin/admin.js` - Added subscribeToJobActivityUpdates()
- `admin/admin.js` - Modified setupRealtimeSubscriptions()

#### **Features:**

**1. Subscribe to Checkin/Checkout Events**
```javascript
jobActivityRealtimeChannel = supabase
  .channel('job-activity-changes')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'jobdata'
  }, (payload) => {
    const oldData = payload.old;
    const newData = payload.new;
    
    // Check-in notification
    if (!oldData.checkin_time && newData.checkin_time) {
      showNotification(`📍 Check-in: ${newData.reference} - ${newData.ship_to_name}`, 'info');
    }
    
    // Check-out notification
    if (!oldData.checkout_time && newData.checkout_time) {
      showNotification(`✅ Check-out: ${newData.reference} - ${newData.ship_to_name}`, 'success');
    }
    
    // Trip completion notification
    if (!oldData.trip_ended && newData.trip_ended) {
      showNotification(`🎉 Trip จบแล้ว: ${newData.reference}`, 'success');
    }
  })
  .subscribe();
```

**2. Toast Notifications:**
- 📍 **Check-in:** `"Check-in: 2601M01944 - บริษัท ABC"` (blue, 5 sec)
- ✅ **Check-out:** `"Check-out: 2601M01944 - บริษัท ABC"` (green, 5 sec)
- 🎉 **Trip End:** `"Trip จบแล้ว: 2601M01944"` (green, 7 sec)

**3. Auto-reconnect:**
- Monitors connection status
- Auto-retry after 5 seconds on failure
- Integrated with setupRealtimeSubscriptions()

**Benefits:**
- Admin ทราบกิจกรรมแบบ real-time
- ไม่ต้องรีเฟรชหน้าเองตลอดเวลา
- ช่วยติดตามความคืบหน้าของงาน

---

### **Phase 5: Group Holiday Approval by Reference ✅ NEW (Jan 21, 2026)**

แสดงแค่ 1 reference แต่อนุมัติทีละทั้ง reference (ทุก seq/จุด)

#### **Files Modified:**
- `admin/admin.js` - Modified loadHolidayWorkJobs()
- `admin/admin.js` - Modified openHolidayApprovalModal()
- `admin/admin.js` - Modified handleHolidayApprovalSubmit()
- `admin/index.html` - Added 'จำนวนจุด' column

#### **Changes:**

**1. Group by Reference in Table**
```javascript
// Before: แสดงทุกแถว (1 reference มี 5 seq = 5 rows)
// After: Group แล้วแสดงแค่ 1 row พร้อม badge จำนวนจุด

const groupedJobs = {};
filteredJobs.forEach(job => {
  if (!groupedJobs[job.reference]) {
    groupedJobs[job.reference] = {
      ...job,
      stop_count: 1,
      all_seqs: [job.seq]
    };
  } else {
    groupedJobs[job.reference].stop_count++;
    groupedJobs[job.reference].all_seqs.push(job.seq);
  }
});
```

**2. Show Stop Count Badge**
```html
<td style="text-align:center;">
  <span style="background:#2196f3;color:white;padding:2px 8px;border-radius:10px;">
    5 จุด
  </span>
</td>
```

**3. Update ALL Stops on Approval**
```javascript
// Before: .eq('reference', reference) 
// - Updates just first match (1 row)

// After: .eq('reference', reference).eq('is_holiday_work', true)
// - Updates ALL rows with same reference (5 rows)

const { error, count } = await supabase
  .from('jobdata')
  .update(updateData)
  .eq('reference', reference)
  .eq('is_holiday_work', true);

showNotification(`✅ อนุมัติแล้ว: ${reference} (${count} จุด)`);
```

**4. Modal Shows Stop Count**
```javascript
// Approval modal title
const stopInfo = job.stop_count > 1 ? ` (${job.stop_count} จุด)` : '';
approvalReference.textContent = `${job.reference}${stopInfo}`;
// Result: "2601M01944 (5 จุด)"
```

**Benefits:**
- ✅ Cleaner UI (1 reference = 1 row)
- ✅ Easier to scan and approve
- ✅ Prevents partial approval (all-or-nothing)
- ✅ Better data consistency
- ✅ Admin knows exactly how many stops affected

**Before vs After:**
```
BEFORE (5 rows):
2601M01944 | Seq 1 | ส.ชาย | [อนุมัติ]
2601M01944 | Seq 2 | ส.ชาย | [อนุมัติ]
2601M01944 | Seq 3 | ส.ชาย | [อนุมัติ]
2601M01944 | Seq 4 | ส.ชาย | [อนุมัติ]
2601M01944 | Seq 5 | ส.ชาย | [อนุมัติ]

AFTER (1 row):
2601M01944 | ส.ชาย | [5 จุด] | [อนุมัติ]
```

---

### **Future Enhancements (Optional)**

**Phase 4: LINE Notification (1-2 hrs)**
- Notify admin via LINE when new request
- Notify driver when approved/rejected

**Phase 5: Reports & Analytics (2-3 hrs)**
- Monthly holiday work report
- Export to Excel
- Statistics: Most OT drivers
- Cost calculation

**Phase 6: Approval Chain**
- Multi-level approval (Manager → Director)
- Approval delegation
- Approval limits by amount

---

## 🎁 Quick Wins Catalog

### **Week 1 - Immediate Improvements** (8 hours total)

#### 1. Loading Skeletons (2 hours)
```css
/* Add to styles.css */
.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s ease-in-out infinite;
  border-radius: 4px;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

#### 2. Empty States (2 hours)
```html
<!-- Add to timeline when no stops -->
<div class="empty-state">
  <span style="font-size: 48px;">📭</span>
  <h3>ยังไม่มีจุดส่งในทริปนี้</h3>
  <p>กรุณาค้นหางานใหม่</p>
</div>
```

#### 3. Haptic Feedback (1 hour)
```javascript
// Add to utils.js
export function vibrate(pattern = [200]) {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

// Use on success actions
vibrate([200, 100, 200]); // Success pattern
```

#### 4. Sound Notifications (1 hour)
```javascript
// Add to ui.js
const sounds = {
  success: new Audio('assets/success.mp3'),
  error: new Audio('assets/error.mp3'),
  notification: new Audio('assets/notification.mp3')
};

export function playSound(type) {
  if (sounds[type] && localStorage.getItem('sound_enabled') !== 'false') {
    sounds[type].play().catch(console.warn);
  }
}
```

#### 5. Better Error Messages (2 hours)
```javascript
// Replace generic errors with helpful messages
const ERROR_MESSAGES = {
  GPS_DENIED: '📍 กรุณาเปิด GPS ในการตั้งค่าเบราว์เซอร์',
  GPS_TIMEOUT: '⏱️ GPS ใช้เวลานานเกินไป กรุณาลองใหม่',
  OFFLINE: '📡 ไม่มีสัญญาณอินเทอร์เน็ต ข้อมูลจะถูกบันทึกไว้',
  GEOFENCE: '📍 คุณอยู่นอกพื้นที่ที่กำหนด กรุณาเข้าใกล้จุดหมาย'
};
```

---

### **Week 2 - Enhanced Features** (40 hours total)

#### 6. Trip Summary Modal (1 day)
```javascript
// Show after job close
function showTripSummary(tripData) {
  const duration = calculateDuration(tripData.start_time, tripData.end_time);
  const stops = tripData.stops.length;
  const distance = calculateTotalDistance(tripData.stops);
  
  showModal({
    title: '✅ ทริปเสร็จสิ้น',
    content: `
      <div class="trip-summary">
        <div class="stat">
          <span class="icon">⏱️</span>
          <span class="value">${duration}</span>
          <span class="label">เวลาที่ใช้</span>
        </div>
        <div class="stat">
          <span class="icon">📍</span>
          <span class="value">${stops}</span>
          <span class="label">จุดส่ง</span>
        </div>
        <div class="stat">
          <span class="icon">🚗</span>
          <span class="value">${distance} km</span>
          <span class="label">ระยะทาง</span>
        </div>
      </div>
    `
  });
}
```

#### 7. Driver Performance Widget (2 days)
```javascript
// Add to main screen
<div class="performance-widget">
  <h3>📊 สถิติของคุณ</h3>
  <div class="stats-grid">
    <div class="stat-card">
      <span class="stat-value">12</span>
      <span class="stat-label">ทริปวันนี้</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">95%</span>
      <span class="stat-label">ตรงเวลา</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">4.8⭐</span>
      <span class="stat-label">คะแนน</span>
    </div>
  </div>
</div>
```

#### 8. LINE Notify Integration (3 days)
```javascript
// Send notification on important events
async function sendLineNotify(message, imageUrl = null) {
  const token = await getLineNotifyToken(currentUserId);
  
  const formData = new FormData();
  formData.append('message', message);
  if (imageUrl) {
    formData.append('imageUrl', imageUrl);
  }
  
  await fetch('https://notify-api.line.me/api/notify', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
}

// Use on events
await sendLineNotify('✅ Check-in สำเร็จ: บริษัท ABC');
await sendLineNotify('🏁 ทริปเสร็จสิ้น: 8 จุด, 3.5 ชม.');
```

---

## 📱 Progressive Web App (PWA) Implementation

### **Phase 1: Basic PWA** (1 week)

#### 1. Create manifest.json
```json
{
  "name": "Driver Tracking App",
  "short_name": "DriverApp",
  "description": "ระบบติดตามงานขนส่ง",
  "start_url": "/PTGLG/driverconnect/driverapp/index-supabase-modular.html",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1abc9c",
  "orientation": "portrait",
  "icons": [
    {
      "src": "assets/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "assets/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

#### 2. Create Service Worker
```javascript
// sw.js
const CACHE_NAME = 'driver-app-v1';
const urlsToCache = [
  '/PTGLG/driverconnect/driverapp/index-supabase-modular.html',
  '/PTGLG/driverconnect/driverapp/css/styles.css',
  '/PTGLG/driverconnect/driverapp/js/app.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});
```

#### 3. Add Install Prompt
```javascript
// app.js
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallButton();
});

async function installApp() {
  if (!deferredPrompt) return;
  
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  
  if (outcome === 'accepted') {
    console.log('User accepted the install prompt');
  }
  deferredPrompt = null;
}
```

---

## 🎯 Admin Dashboard Specification

### **Dashboard Features**

#### 1. Real-time Fleet Map
```javascript
// Show all active vehicles
<div id="fleetMap" class="fleet-map">
  <!-- Leaflet map with multiple markers -->
  <!-- Each marker shows: Driver name, Status, ETA -->
</div>

Features:
- Cluster markers when zoomed out
- Filter by status (Active, Idle, Offline)
- Click marker for details
- Auto-refresh every 30s
```

#### 2. Trip List View
```javascript
<table class="trip-table">
  <thead>
    <tr>
      <th>คนขับ</th>
      <th>เลข Ref</th>
      <th>จุดปัจจุบัน</th>
      <th>จุดถัดไป</th>
      <th>ETA</th>
      <th>สถานะ</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody id="tripListBody">
    <!-- Dynamic rows -->
  </tbody>
</table>

Actions:
- 🗺️ View on map
- 📞 Call driver
- 📝 View details
- ⚠️ Report issue
```

#### 3. KPI Dashboard
```javascript
<div class="kpi-grid">
  <div class="kpi-card">
    <h3>Active Trips</h3>
    <div class="kpi-value">24</div>
    <div class="kpi-change">+12% vs yesterday</div>
  </div>
  
  <div class="kpi-card">
    <h3>On-Time Rate</h3>
    <div class="kpi-value">94.5%</div>
    <div class="kpi-change">-2.1% vs yesterday</div>
  </div>
  
  <div class="kpi-card">
    <h3>Avg Trip Time</h3>
    <div class="kpi-value">2.3h</div>
    <div class="kpi-change">-0.2h vs yesterday</div>
  </div>
</div>
```

---

## 🔔 Notification System Architecture

### **Notification Types**

#### 1. Driver Notifications (LINE Notify)
```
Events:
- Check-in successful
- Check-out successful
- Trip assigned
- Trip completed
- Achievement unlocked
- Important announcements
```

#### 2. Admin Notifications (Google Chat)
```
Events:
- Job closed
- Trip ended
- Late delivery
- GPS offline
- Exception occurred
- Daily summary
```

#### 3. Customer Notifications (Optional)
```
Events:
- Driver on the way
- Arrived at location
- Delivery completed
- POD uploaded
```

### **Implementation Plan**

```javascript
// Notification Manager
class NotificationManager {
  async send(userId, type, data) {
    const preferences = await getUserPreferences(userId);
    
    if (!preferences.notifications_enabled) return;
    
    switch (type) {
      case 'checkin':
        await this.sendCheckInNotification(userId, data);
        break;
      case 'checkout':
        await this.sendCheckOutNotification(userId, data);
        break;
      // ... more types
    }
  }
  
  async sendCheckInNotification(userId, data) {
    const message = `✅ Check-in สำเร็จ\n📍 ${data.location}\n⏰ ${data.time}`;
    await sendLineNotify(userId, message);
    
    // Also send to admin
    await sendGoogleChat({
      text: `Driver ${data.driverName} checked in at ${data.location}`,
      link: `tracking/?driver_user_id=${userId}`
    });
  }
}
```

---

## 📈 Analytics Implementation

### **Events to Track**

```javascript
// Google Analytics 4 Events
const EVENTS = {
  // User Actions
  'user_login': { userId, timestamp },
  'job_search': { reference, found },
  'check_in': { reference, location, duration },
  'check_out': { reference, location, duration },
  'alcohol_test': { reference, value, timestamp },
  'job_close': { reference, totalTime, stops },
  
  // Performance Metrics
  'gps_lock_time': { duration, accuracy },
  'gps_fallback_used': { reason, timestamp },
  'offline_queue_sync': { items, duration },
  'api_error': { endpoint, errorCode, message },
  
  // Feature Usage
  'dark_mode_toggle': { enabled },
  'notification_clicked': { type },
  'tracking_page_opened': { driverUserId }
};

// Implementation
function trackEvent(eventName, params) {
  if (window.gtag) {
    gtag('event', eventName, params);
  }
  
  // Also send to Supabase for custom analytics
  supabase.from('analytics_events').insert({
    event_name: eventName,
    params: params,
    user_id: currentUserId,
    timestamp: new Date()
  });
}
```

---

## 🚚 4PL Supply Chain Provider Features

> **Strategic Context:** เมื่อทำหน้าที่เป็น 4PL (Fourth-Party Logistics Provider) จะต้องมีความสามารถในการจัดการ Supply Chain แบบครบวงจร ไม่ใช่แค่การขนส่ง แต่รวมถึงการจัดการหลาย 3PL providers, Visibility, Optimization, และ Customer Experience

### **4PL Core Capabilities Required**

```
1. Multi-Carrier Management - จัดการหลาย 3PL/Carrier
2. End-to-End Visibility - มองเห็นทั้ง supply chain
3. Control Tower - ศูนย์บัญชาการ real-time
4. Analytics & BI - วิเคราะห์และพยากรณ์
5. Customer Portal - ให้ลูกค้าเข้าถึงข้อมูล
6. Multi-Modal Transport - บก/เรือ/อากาศ
7. Cost Optimization - เพิ่มประสิทธิภาพต้นทุน
8. Integration Hub - เชื่อมต่อหลายระบบ
```

---

### **PHASE A: Multi-Carrier & Fleet Management** (2-3 weeks)

#### A.1 Carrier Management System (1 week)

**Database Schema:**
```sql
-- carriers table
CREATE TABLE carriers (
  id bigint PRIMARY KEY,
  carrier_code text UNIQUE,
  carrier_name text,
  carrier_type text, -- '3PL', 'OWN_FLEET', 'PARTNER'
  contact_info jsonb,
  service_areas jsonb,
  vehicle_types jsonb,
  pricing_model jsonb,
  performance_rating numeric(3,2),
  status text, -- 'ACTIVE', 'INACTIVE', 'SUSPENDED'
  created_at timestamptz DEFAULT now()
);

-- carrier_vehicles table
CREATE TABLE carrier_vehicles (
  id bigint PRIMARY KEY,
  carrier_id bigint REFERENCES carriers(id),
  vehicle_registration text,
  vehicle_type text, -- 'TRUCK', 'VAN', 'TRAILER', 'TANKER'
  capacity_kg numeric,
  capacity_cbm numeric,
  gps_device_id text,
  driver_id text,
  current_status text, -- 'AVAILABLE', 'IN_TRANSIT', 'MAINTENANCE', 'OFFLINE'
  last_location jsonb,
  last_update timestamptz,
  created_at timestamptz DEFAULT now()
);

-- carrier_performance table
CREATE TABLE carrier_performance (
  id bigint PRIMARY KEY,
  carrier_id bigint REFERENCES carriers(id),
  date date,
  total_trips int,
  completed_on_time int,
  completed_late int,
  cancelled int,
  avg_delivery_time interval,
  customer_rating numeric(3,2),
  cost_per_trip numeric,
  created_at timestamptz DEFAULT now()
);
```

**Features:**
- [ ] **Carrier Profile Management**
  - เพิ่ม/แก้ไข/ลบ carrier
  - กำหนด service areas
  - กำหนด pricing rules
  - Track performance metrics

- [ ] **Vehicle Fleet Overview**
  - Real-time fleet status (all carriers)
  - Vehicle availability
  - Maintenance schedule
  - Utilization rate

- [ ] **Carrier Selection Algorithm**
  ```javascript
  // Auto-assign best carrier based on:
  // 1. Service area coverage
  // 2. Vehicle availability
  // 3. Cost
  // 4. Performance history
  // 5. Current load
  ```

---

#### A.2 Multi-Tenant Architecture (4 days)

**Database Schema:**
```sql
-- tenants (customers/shippers)
CREATE TABLE tenants (
  id bigint PRIMARY KEY,
  tenant_code text UNIQUE,
  tenant_name text,
  tenant_type text, -- 'SHIPPER', 'RECEIVER', 'BOTH'
  industry text,
  business_size text,
  contact_info jsonb,
  billing_info jsonb,
  service_level text, -- 'STANDARD', 'PREMIUM', 'ENTERPRISE'
  api_key text,
  webhook_url text,
  preferences jsonb,
  created_at timestamptz DEFAULT now()
);

-- tenant_users (customer users)
CREATE TABLE tenant_users (
  id bigint PRIMARY KEY,
  tenant_id bigint REFERENCES tenants(id),
  user_email text,
  user_name text,
  user_role text, -- 'ADMIN', 'PLANNER', 'VIEWER'
  permissions jsonb,
  last_login timestamptz,
  created_at timestamptz DEFAULT now()
);

-- shipments (customer orders)
CREATE TABLE shipments (
  id bigint PRIMARY KEY,
  tenant_id bigint REFERENCES tenants(id),
  shipment_no text UNIQUE,
  reference_no text, -- customer reference
  order_date timestamptz,
  pickup_location jsonb,
  delivery_location jsonb,
  pickup_datetime timestamptz,
  delivery_datetime timestamptz,
  cargo_details jsonb,
  special_instructions text,
  status text,
  assigned_carrier_id bigint REFERENCES carriers(id),
  assigned_trip_id bigint REFERENCES trips(id),
  tracking_link text,
  pod_url text,
  created_at timestamptz DEFAULT now()
);
```

**Features:**
- [ ] **Customer Onboarding Portal**
  - Self-service registration
  - Service level selection
  - Integration setup

- [ ] **Customer Dashboard**
  - Active shipments overview
  - Pending pickups
  - In-transit tracking
  - Delivered today
  - Performance metrics

---

### **PHASE B: Control Tower & Visibility** (2-3 weeks)

#### B.1 Real-Time Control Tower Dashboard (1.5 weeks)

**Dashboard Components:**

**1. Live Operations Map**
```javascript
// Real-time map showing:
// - All active vehicles (color-coded by carrier)
// - All shipments (in-transit, pending, completed)
// - Geofences (pickup/delivery zones)
// - Traffic conditions
// - Incident markers
// - Weather overlays

class ControlTowerMap {
  async init() {
    this.map = L.map('control-tower-map');
    
    // Load all active vehicles
    this.loadVehicleMarkers();
    
    // Load all shipments
    this.loadShipmentMarkers();
    
    // Subscribe to real-time updates
    this.subscribeToUpdates();
    
    // Auto-refresh every 30 seconds
    setInterval(() => this.refresh(), 30000);
  }
  
  loadVehicleMarkers() {
    // Different icons for different carriers/status
    // Clustering for dense areas
    // Click to see vehicle details
  }
  
  subscribeToUpdates() {
    supabase
      .channel('control-tower')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'driver_live_locations' },
        (payload) => this.updateVehiclePosition(payload)
      )
      .subscribe();
  }
}
```

**2. Operations KPIs**
```
┌─────────────────────────────────────────────┐
│ TODAY'S OPERATIONS                          │
├─────────────────────────────────────────────┤
│ Active Shipments:        156  ↑ +12        │
│ Vehicles On Road:         87  ↓ -3         │
│ Completed Today:         234  ↑ +45        │
│ Pending Pickups:          23  ↑ +5         │
│ Late Deliveries:           4  ↓ -2         │
│ Average Delivery Time:  2.3h  ↓ -0.2h      │
│ On-Time Rate:          94.2%  ↑ +1.5%      │
└─────────────────────────────────────────────┘
```

**3. Alert Management Center**
```javascript
// Real-time alerts
const ALERTS = {
  CRITICAL: [
    'Vehicle offline > 30 min',
    'Delivery delayed > 2 hours',
    'Geofence violation',
    'Accident reported',
    'Cargo temperature out of range'
  ],
  WARNING: [
    'Traffic jam on route',
    'Weather alert',
    'Driver overtime threshold',
    'Vehicle maintenance due',
    'Low fuel alert'
  ],
  INFO: [
    'Shipment picked up',
    'Shipment delivered',
    'Driver break started',
    'Route deviation (minor)'
  ]
};

class AlertManager {
  async processAlert(alert) {
    // Auto-classify by severity
    const severity = this.classifyAlert(alert);
    
    // Notify relevant parties
    await this.notifyStakeholders(alert, severity);
    
    // Trigger automation if configured
    await this.triggerAutomation(alert);
    
    // Log to database
    await this.logAlert(alert);
  }
  
  async triggerAutomation(alert) {
    if (alert.type === 'DELIVERY_DELAYED') {
      // Auto-notify customer
      // Suggest alternative routes
      // Dispatch backup vehicle if available
    }
  }
}
```

**Features:**
- [ ] **Real-Time Fleet Visualization**
  - All vehicles on one map
  - Color-coded by status/carrier
  - Click for details
  - Route visualization

- [ ] **Exception Management**
  - Alert dashboard
  - Automated workflows
  - Escalation rules
  - Resolution tracking

- [ ] **Capacity Planning**
  - Vehicle utilization
  - Available capacity
  - Peak time analysis
  - Resource allocation

---

#### B.2 End-to-End Shipment Tracking (1 week)

**Shipment Lifecycle:**
```
Created → Planned → Assigned → Picked Up → In Transit → 
Out for Delivery → Delivered → POD Submitted → Closed
```

**Database Schema:**
```sql
-- shipment_events table
CREATE TABLE shipment_events (
  id bigint PRIMARY KEY,
  shipment_id bigint REFERENCES shipments(id),
  event_type text,
  event_timestamp timestamptz,
  location jsonb,
  performed_by text,
  notes text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- shipment_milestones table
CREATE TABLE shipment_milestones (
  id bigint PRIMARY KEY,
  shipment_id bigint REFERENCES shipments(id),
  milestone_type text, -- 'PICKUP_SCHEDULED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'
  planned_time timestamptz,
  actual_time timestamptz,
  variance_minutes int,
  status text, -- 'PENDING', 'ON_TIME', 'DELAYED', 'COMPLETED'
  created_at timestamptz DEFAULT now()
);
```

**Features:**
- [ ] **Public Tracking Portal**
  - Track by shipment number
  - Real-time status updates
  - ETA calculation
  - Delivery proof
  - No login required

- [ ] **Milestone Tracking**
  - Automatic milestone detection
  - Planned vs Actual time
  - Delay notifications
  - Performance scoring

- [ ] **Event Timeline**
  - Complete shipment history
  - Location trail
  - Status changes
  - Documents attached

---

### **PHASE C: Customer Experience & Portal** (2 weeks)

#### C.1 Customer Self-Service Portal (1.5 weeks)

**Portal Features:**

**1. Shipment Booking**
```javascript
// Customer can create shipment requests
class ShipmentBooking {
  async createShipment(data) {
    // Validate pickup/delivery locations
    const isServiceable = await this.checkServiceability(
      data.pickup_location,
      data.delivery_location
    );
    
    if (!isServiceable) {
      throw new Error('Location not in service area');
    }
    
    // Get instant quote
    const quote = await this.calculateQuote(data);
    
    // Create shipment
    const shipment = await supabase.from('shipments').insert({
      tenant_id: this.tenantId,
      ...data,
      estimated_cost: quote.cost,
      estimated_duration: quote.duration,
      status: 'PENDING'
    });
    
    return { shipment, quote };
  }
  
  async calculateQuote(data) {
    // Distance calculation
    const distance = this.calculateDistance(
      data.pickup_location,
      data.delivery_location
    );
    
    // Weight/volume consideration
    const { weight, volume } = data.cargo_details;
    
    // Dynamic pricing based on:
    // - Distance
    // - Weight/volume
    // - Service level
    // - Current demand
    // - Customer tier
    
    return {
      cost: calculatedCost,
      duration: estimatedDuration,
      breakdown: {...}
    };
  }
}
```

**2. Shipment Dashboard**
```
┌─────────────────────────────────────────────────────┐
│ MY SHIPMENTS                                        │
├─────────────────────────────────────────────────────┤
│ 📦 Active (12)                                      │
│ ⏱️  Pending Pickup (5)                              │
│ 🚚 In Transit (7)                                   │
│ ✅ Delivered Today (23)                             │
├─────────────────────────────────────────────────────┤
│ Shipment No    Status        ETA        Action      │
│ SH-2601-0123   In Transit   14:30      🔍 Track    │
│ SH-2601-0124   Picked Up    15:45      🔍 Track    │
│ SH-2601-0125   Pending      -          📝 Edit     │
└─────────────────────────────────────────────────────┘
```

**3. Analytics & Reports**
```javascript
// Customer can see their own performance
const CUSTOMER_METRICS = {
  // Volume
  total_shipments: 1245,
  mtd_shipments: 87,
  ytd_shipments: 1245,
  
  // Performance
  on_time_delivery_rate: 94.2,
  avg_delivery_time: '2.3 hours',
  
  // Cost
  total_spend: 450000,
  avg_cost_per_shipment: 361,
  cost_trend: 'decreasing',
  
  // Quality
  pod_completion_rate: 98.5,
  customer_complaints: 3,
  carrier_rating: 4.7
};
```

**Features:**
- [ ] **Shipment Creation & Booking**
  - Instant quote
  - Schedule pickup
  - Recurring shipments
  - Bulk upload (CSV)

- [ ] **Track & Trace**
  - Real-time tracking
  - Multiple shipment view
  - ETA updates
  - Delivery notifications

- [ ] **Document Management**
  - Upload shipping docs
  - View POD
  - Download invoices
  - Compliance docs

- [ ] **Reporting & Analytics**
  - Shipment history
  - Performance dashboard
  - Cost analysis
  - Export reports

---

#### C.2 Customer Notifications & Communication (0.5 week)

**Notification Channels:**
```javascript
class CustomerNotifications {
  async notifyCustomer(shipment, event) {
    const tenant = await this.getTenant(shipment.tenant_id);
    
    // Email notification
    if (tenant.preferences.email_notifications) {
      await this.sendEmail(tenant, event);
    }
    
    // SMS notification
    if (tenant.preferences.sms_notifications) {
      await this.sendSMS(tenant, event);
    }
    
    // Webhook (for system integration)
    if (tenant.webhook_url) {
      await this.triggerWebhook(tenant.webhook_url, event);
    }
    
    // Push notification (if mobile app)
    if (tenant.push_token) {
      await this.sendPush(tenant, event);
    }
  }
  
  async sendEmail(tenant, event) {
    const templates = {
      'SHIPMENT_CREATED': 'Your shipment {shipment_no} has been created',
      'PICKUP_SCHEDULED': 'Pickup scheduled for {pickup_time}',
      'PICKED_UP': 'Your shipment has been picked up',
      'IN_TRANSIT': 'Your shipment is on the way. ETA: {eta}',
      'DELIVERED': 'Shipment delivered successfully',
      'DELAYED': 'Shipment delayed. New ETA: {new_eta}',
      'EXCEPTION': 'Exception on shipment {shipment_no}: {reason}'
    };
    
    // Send templated email
  }
}
```

**Features:**
- [ ] **Multi-Channel Notifications**
  - Email
  - SMS
  - Webhook
  - Push notifications

- [ ] **Smart Notifications**
  - Based on preferences
  - Event-driven
  - Customizable templates
  - Delivery confirmation

- [ ] **Proactive Communication**
  - Delay predictions
  - Exception alerts
  - ETA updates
  - Service updates

---

### **PHASE D: Advanced Analytics & BI** (2 weeks)

#### D.1 Business Intelligence Dashboard (1 week)

**Analytics Modules:**

**1. Operational Analytics**
```sql
-- Daily operations summary
CREATE VIEW v_daily_operations AS
SELECT 
  date,
  COUNT(*) as total_shipments,
  COUNT(*) FILTER (WHERE status = 'DELIVERED') as completed,
  COUNT(*) FILTER (WHERE delivered_late) as late_deliveries,
  AVG(delivery_time) as avg_delivery_time,
  SUM(revenue) as total_revenue,
  AVG(customer_rating) as avg_rating
FROM shipments
GROUP BY date
ORDER BY date DESC;

-- Carrier performance comparison
CREATE VIEW v_carrier_performance AS
SELECT 
  c.carrier_name,
  COUNT(s.id) as total_shipments,
  AVG(s.delivery_time) as avg_delivery_time,
  COUNT(*) FILTER (WHERE s.delivered_late) / COUNT(*)::float * 100 as late_rate,
  AVG(s.customer_rating) as avg_rating,
  SUM(s.cost) as total_cost
FROM shipments s
JOIN carriers c ON s.assigned_carrier_id = c.id
WHERE s.created_at > NOW() - INTERVAL '30 days'
GROUP BY c.carrier_name;
```

**2. Customer Analytics**
```javascript
// Customer segmentation
class CustomerAnalytics {
  async segmentCustomers() {
    // Segment by:
    // - Shipment volume (High/Medium/Low)
    // - Revenue contribution
    // - Growth rate
    // - Service level
    
    return {
      platinum: [], // Top 10% revenue
      gold: [],     // Top 11-30%
      silver: [],   // Top 31-60%
      bronze: []    // Rest
    };
  }
  
  async calculateCLV(tenantId) {
    // Customer Lifetime Value
    const history = await this.getShipmentHistory(tenantId);
    
    return {
      total_revenue: history.total_revenue,
      avg_monthly_revenue: history.avg_monthly_revenue,
      tenure_months: history.tenure_months,
      predicted_ltv: this.predictLTV(history)
    };
  }
  
  async getCustomerHealth(tenantId) {
    // Health score based on:
    // - Usage frequency
    // - Payment history
    // - Complaint rate
    // - Retention risk
    
    return {
      health_score: 85, // 0-100
      risk_level: 'low',
      recommendations: []
    };
  }
}
```

**3. Predictive Analytics**
```javascript
class PredictiveAnalytics {
  async predictDeliveryTime(shipment) {
    // ML model based on historical data
    // Factors: distance, time of day, traffic, weather, carrier
    
    const features = {
      distance: this.calculateDistance(shipment),
      hour_of_day: new Date().getHours(),
      day_of_week: new Date().getDay(),
      carrier_avg_speed: await this.getCarrierAvgSpeed(shipment.carrier_id),
      traffic_index: await this.getTrafficIndex(shipment.route)
    };
    
    return this.mlModel.predict(features);
  }
  
  async predictCapacityShortage() {
    // Predict if we'll run out of capacity
    const historicalDemand = await this.getDemandPattern();
    const upcomingBookings = await this.getUpcomingBookings();
    const availableCapacity = await this.getAvailableCapacity();
    
    if (upcomingBookings > availableCapacity * 0.9) {
      return {
        shortage_predicted: true,
        shortage_date: '2026-01-25',
        shortage_amount: 15,
        recommendation: 'Contract additional carriers'
      };
    }
  }
  
  async optimizeRoute(shipments) {
    // Multi-stop route optimization
    // Using genetic algorithm or similar
    
    return {
      optimized_sequence: [],
      total_distance: 0,
      total_time: 0,
      fuel_saved: 0,
      cost_saved: 0
    };
  }
}
```

**Features:**
- [ ] **Executive Dashboard**
  - High-level KPIs
  - Trends & forecasts
  - Cost analysis
  - Revenue tracking

- [ ] **Operations Dashboard**
  - Real-time operations
  - Carrier performance
  - Vehicle utilization
  - Exception handling

- [ ] **Financial Dashboard**
  - Revenue by customer
  - Cost by carrier
  - Profit margins
  - Invoice tracking

- [ ] **Custom Reports**
  - Report builder
  - Scheduled reports
  - Export to Excel/PDF
  - Email distribution

---

#### D.2 Cost Optimization & Planning (1 week)

**Optimization Features:**

**1. Route Optimization**
```javascript
class RouteOptimizer {
  async optimizeMultiStop(stops) {
    // Given: Multiple pickup/delivery stops
    // Find: Optimal sequence to minimize distance/time/cost
    
    // Constraints:
    // - Time windows (must pickup/deliver within timeframe)
    // - Vehicle capacity
    // - Driver shift hours
    // - Traffic patterns
    
    // Algorithms:
    // - Traveling Salesman Problem (TSP)
    // - Vehicle Routing Problem (VRP)
    // - Genetic Algorithm
    
    return {
      optimized_route: [],
      total_distance: 0,
      total_time: 0,
      estimated_cost: 0,
      savings_vs_current: 15.5 // percentage
    };
  }
}
```

**2. Load Consolidation**
```javascript
class LoadConsolidation {
  async findConsolidationOpportunities() {
    // Find shipments that can share a vehicle
    const pendingShipments = await this.getPendingShipments();
    
    const opportunities = [];
    
    for (let i = 0; i < pendingShipments.length; i++) {
      for (let j = i + 1; j < pendingShipments.length; j++) {
        const shipmentA = pendingShipments[i];
        const shipmentB = pendingShipments[j];
        
        // Check if compatible
        if (this.canConsolidate(shipmentA, shipmentB)) {
          const savings = this.calculateSavings(shipmentA, shipmentB);
          
          opportunities.push({
            shipments: [shipmentA.id, shipmentB.id],
            savings_amount: savings.amount,
            savings_percent: savings.percent
          });
        }
      }
    }
    
    return opportunities.sort((a, b) => b.savings_amount - a.savings_amount);
  }
  
  canConsolidate(shipmentA, shipmentB) {
    // Same general direction
    // Compatible time windows
    // Combined volume < vehicle capacity
    // No conflicting requirements (e.g., temperature)
    return true;
  }
}
```

**3. Carrier Rate Negotiation Support**
```javascript
class RateAnalysis {
  async analyzeCarrierRates() {
    // Compare carrier rates
    const carriers = await this.getAllCarriers();
    const lanes = await this.getCommonLanes();
    
    const analysis = [];
    
    for (const lane of lanes) {
      const rates = await this.getCarrierRatesForLane(lane, carriers);
      
      analysis.push({
        lane: lane,
        volume: lane.shipment_count,
        current_avg_rate: lane.avg_rate,
        market_avg_rate: await this.getMarketRate(lane),
        best_rate: Math.min(...rates),
        worst_rate: Math.max(...rates),
        recommendation: this.getRecommendation(rates)
      });
    }
    
    return analysis;
  }
  
  async suggestRateNegotiation() {
    // Identify high-volume lanes with above-market rates
    // Suggest negotiation targets
    
    return {
      lanes_to_negotiate: [],
      potential_savings: 0,
      negotiation_leverage: 'high' // based on volume
    };
  }
}
```

**Features:**
- [ ] **Route Optimization Engine**
  - Multi-stop optimization
  - Traffic consideration
  - Time window constraints
  - Real-time re-routing

- [ ] **Load Consolidation**
  - Auto-suggest consolidation
  - Cost savings calculator
  - Compatibility checker
  - Manual override

- [ ] **Carrier Rate Analysis**
  - Rate comparison
  - Market benchmarking
  - Negotiation support
  - Contract management

- [ ] **Capacity Planning**
  - Demand forecasting
  - Capacity vs demand
  - Peak season planning
  - Resource allocation

---

### **PHASE E: Integration & API** (1.5 weeks)

#### E.1 RESTful API for Customers (1 week)

**API Endpoints:**
```javascript
// Customer API for system integration

// Authentication
POST   /api/v1/auth/token                 // Get API token
GET    /api/v1/auth/verify                // Verify token

// Shipments
POST   /api/v1/shipments                  // Create shipment
GET    /api/v1/shipments                  // List shipments
GET    /api/v1/shipments/:id              // Get shipment details
PUT    /api/v1/shipments/:id              // Update shipment
DELETE /api/v1/shipments/:id              // Cancel shipment

// Tracking
GET    /api/v1/track/:shipment_no         // Track shipment
GET    /api/v1/track/:shipment_no/events  // Get event history
GET    /api/v1/track/:shipment_no/location // Get current location

// Quotes
POST   /api/v1/quotes                     // Get instant quote

// Documents
GET    /api/v1/shipments/:id/pod          // Get POD
POST   /api/v1/shipments/:id/documents    // Upload document

// Webhooks
POST   /api/v1/webhooks                   // Register webhook
GET    /api/v1/webhooks                   // List webhooks
DELETE /api/v1/webhooks/:id               // Delete webhook

// Reports
GET    /api/v1/reports/performance        // Performance report
GET    /api/v1/reports/invoices           // Invoice report
```

**API Documentation:**
```yaml
openapi: 3.0.0
info:
  title: 4PL Logistics API
  version: 1.0.0
  description: RESTful API for shipment management

paths:
  /api/v1/shipments:
    post:
      summary: Create a new shipment
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                reference_no:
                  type: string
                pickup_location:
                  type: object
                delivery_location:
                  type: object
                pickup_datetime:
                  type: string
                  format: date-time
                cargo_details:
                  type: object
      responses:
        201:
          description: Shipment created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Shipment'
        400:
          description: Bad request
        401:
          description: Unauthorized
```

**Features:**
- [ ] **RESTful API**
  - Full CRUD operations
  - Pagination
  - Filtering & sorting
  - Rate limiting

- [ ] **Webhook System**
  - Event subscriptions
  - Automatic retries
  - Delivery confirmation
  - Payload validation

- [ ] **API Documentation**
  - Interactive docs (Swagger)
  - Code examples
  - Postman collection
  - SDK libraries

---

#### E.2 Third-Party Integrations (0.5 week)

**Integration Points:**

**1. ERP Integration**
```javascript
// Connect with customer ERP systems
class ERPIntegration {
  // SAP, Oracle, Microsoft Dynamics, etc.
  
  async syncOrders() {
    // Pull new orders from ERP
    // Create shipments automatically
    // Update ERP with shipment status
  }
  
  async updateStatus(shipmentId, status) {
    // Push status back to ERP
    await this.erpClient.updateOrder({
      order_id: shipment.reference_no,
      status: this.mapStatus(status),
      tracking_link: this.getTrackingLink(shipmentId)
    });
  }
}
```

**2. E-Commerce Platform Integration**
```javascript
// Shopify, WooCommerce, Magento, etc.
class EcommerceIntegration {
  async processOrder(order) {
    // Automatically create shipment from e-commerce order
    const shipment = await this.createShipmentFromOrder(order);
    
    // Update order with tracking info
    await this.updateOrderTracking(order.id, shipment.tracking_no);
    
    // Send tracking to customer
    await this.notifyCustomer(order.customer_email, shipment);
  }
}
```

**3. Accounting System Integration**
```javascript
// QuickBooks, Xero, etc.
class AccountingIntegration {
  async syncInvoices() {
    // Create invoices in accounting system
    // Sync payment status
    // Generate financial reports
  }
}
```

**Features:**
- [ ] **ERP Connectors**
  - SAP
  - Oracle
  - Microsoft Dynamics
  - Custom ERP

- [ ] **E-commerce Platforms**
  - Shopify
  - WooCommerce
  - Magento
  - Custom platforms

- [ ] **Accounting Systems**
  - QuickBooks
  - Xero
  - Wave
  - Custom systems

- [ ] **Mapping & Geocoding**
  - Google Maps API
  - Mapbox
  - HERE Maps
  - OpenStreetMap

---

### **PHASE F: Compliance & Sustainability** (1 week)

#### F.1 Regulatory Compliance (0.5 week)

**Compliance Features:**

**1. E-POD (Electronic Proof of Delivery)**
```sql
-- pod_records table
CREATE TABLE pod_records (
  id bigint PRIMARY KEY,
  shipment_id bigint REFERENCES shipments(id),
  delivered_at timestamptz,
  delivered_to text,
  recipient_signature_url text,
  recipient_id_photo_url text,
  delivery_photo_url text,
  gps_location jsonb,
  notes text,
  digital_signature_hash text, -- for non-repudiation
  created_at timestamptz DEFAULT now()
);
```

**2. Customs & Cross-Border**
```javascript
class CustomsCompliance {
  async prepareCustomsDocuments(shipment) {
    return {
      commercial_invoice: this.generateCommercialInvoice(shipment),
      packing_list: this.generatePackingList(shipment),
      certificate_of_origin: this.getCertificateOfOrigin(shipment),
      hs_codes: this.getHSCodes(shipment.cargo_details)
    };
  }
  
  async validateCompliance(shipment) {
    // Check all required documents
    // Validate HS codes
    // Check import/export restrictions
    // Verify customs value
    
    return {
      is_compliant: true,
      missing_documents: [],
      warnings: []
    };
  }
}
```

**3. DOT/Transport Regulations**
```javascript
class TransportCompliance {
  async checkDriverHOS(driverId) {
    // Hours of Service compliance
    const logs = await this.getDriverLogs(driverId);
    
    return {
      can_drive: true,
      hours_available: 8.5,
      next_break_due: '2026-01-22T18:00:00Z',
      warnings: []
    };
  }
  
  async checkVehicleCompliance(vehicleId) {
    // Maintenance records
    // Insurance validity
    // Registration validity
    
    return {
      is_compliant: true,
      issues: []
    };
  }
}
```

**Features:**
- [ ] **E-POD System**
  - Digital signature
  - Photo proof
  - GPS verification
  - Timestamp proof

- [ ] **Customs Documentation**
  - Auto-generate docs
  - HS code lookup
  - Compliance checker
  - Document vault

- [ ] **Safety Compliance**
  - Driver HOS tracking
  - Vehicle inspections
  - Insurance validation
  - Certification tracking

---

#### F.2 Carbon Footprint & Sustainability (0.5 week)

**Sustainability Tracking:**

```sql
-- carbon_emissions table
CREATE TABLE carbon_emissions (
  id bigint PRIMARY KEY,
  shipment_id bigint REFERENCES shipments(id),
  distance_km numeric,
  vehicle_type text,
  fuel_type text,
  fuel_consumed_liters numeric,
  co2_kg numeric,
  calculation_method text,
  offset_purchased boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```

**Carbon Calculator:**
```javascript
class CarbonFootprint {
  async calculateEmissions(shipment) {
    const distance = shipment.distance_km;
    const vehicleType = shipment.vehicle_type;
    
    // Emission factors (kg CO2 per km)
    const factors = {
      'TRUCK': 0.62,
      'VAN': 0.35,
      'TRAILER': 0.85,
      'ELECTRIC_VAN': 0.12
    };
    
    const co2_kg = distance * factors[vehicleType];
    
    // Save to database
    await supabase.from('carbon_emissions').insert({
      shipment_id: shipment.id,
      distance_km: distance,
      vehicle_type: vehicleType,
      co2_kg: co2_kg,
      calculation_method: 'STANDARD_FACTORS'
    });
    
    return {
      co2_kg: co2_kg,
      trees_equivalent: co2_kg / 21, // 21kg per tree per year
      offset_cost: co2_kg * 0.02 // $0.02 per kg
    };
  }
  
  async getSustainabilityReport(tenantId, dateRange) {
    const emissions = await this.getTenantEmissions(tenantId, dateRange);
    
    return {
      total_co2_kg: emissions.total,
      total_distance_km: emissions.distance,
      avg_co2_per_km: emissions.total / emissions.distance,
      trend: emissions.trend, // 'improving', 'stable', 'worsening'
      recommendations: [
        'Consider electric vehicles for urban routes',
        'Optimize routes to reduce distance by 15%',
        'Consolidate shipments to reduce trips'
      ]
    };
  }
}
```

**Features:**
- [ ] **Carbon Tracking**
  - Per-shipment emissions
  - Tenant-level reporting
  - Industry benchmarking
  - Trend analysis

- [ ] **Green Initiatives**
  - Electric vehicle options
  - Route optimization for fuel efficiency
  - Load consolidation suggestions
  - Carbon offset program

- [ ] **Sustainability Reporting**
  - ESG reports
  - Customer carbon reports
  - Certification support (ISO 14001)
  - Public sustainability page

---

### **PHASE G: Advanced Value-Added Services** (2 weeks)

#### G.1 Warehouse Management Integration (1 week)

**WMS Features:**
```sql
-- warehouses table
CREATE TABLE warehouses (
  id bigint PRIMARY KEY,
  warehouse_code text UNIQUE,
  warehouse_name text,
  location jsonb,
  type text, -- 'OWN', 'PARTNER', '3PL'
  capacity_cbm numeric,
  current_utilization numeric,
  services jsonb, -- ['STORAGE', 'CROSS_DOCK', 'KITTING', 'RETURNS']
  operating_hours jsonb,
  created_at timestamptz DEFAULT now()
);

-- inventory table
CREATE TABLE inventory (
  id bigint PRIMARY KEY,
  warehouse_id bigint REFERENCES warehouses(id),
  tenant_id bigint REFERENCES tenants(id),
  sku text,
  product_name text,
  quantity int,
  location_in_warehouse text,
  last_movement timestamptz,
  created_at timestamptz DEFAULT now()
);

-- warehouse_orders table
CREATE TABLE warehouse_orders (
  id bigint PRIMARY KEY,
  warehouse_id bigint REFERENCES warehouses(id),
  tenant_id bigint REFERENCES tenants(id),
  order_type text, -- 'INBOUND', 'OUTBOUND', 'TRANSFER'
  status text,
  scheduled_date timestamptz,
  completed_date timestamptz,
  items jsonb,
  created_at timestamptz DEFAULT now()
);
```

**Features:**
- [ ] **Inventory Visibility**
  - Real-time stock levels
  - Multi-warehouse view
  - Low stock alerts
  - Aging inventory

- [ ] **Order Fulfillment**
  - Pick & pack
  - Wave picking
  - Batch processing
  - Quality control

- [ ] **Cross-Docking**
  - Direct transfer
  - Reduced storage time
  - Cost savings

---

#### G.2 Returns Management (0.5 week)

**Returns Process:**
```sql
-- returns table
CREATE TABLE returns (
  id bigint PRIMARY KEY,
  original_shipment_id bigint REFERENCES shipments(id),
  tenant_id bigint REFERENCES tenants(id),
  return_reason text,
  return_status text, -- 'REQUESTED', 'APPROVED', 'PICKED_UP', 'RECEIVED', 'PROCESSED'
  return_shipment_id bigint REFERENCES shipments(id),
  refund_amount numeric,
  refund_status text,
  notes text,
  created_at timestamptz DEFAULT now()
);
```

**Features:**
- [ ] **Return Authorization**
  - Customer initiates return
  - Auto-approval rules
  - Return labels
  - Pickup scheduling

- [ ] **Return Tracking**
  - Return shipment tracking
  - Receipt confirmation
  - Inspection status
  - Refund processing

---

#### G.3 Value-Added Services (0.5 week)

**Additional Services:**
```javascript
class ValueAddedServices {
  services = {
    // Packaging
    GIFT_WRAPPING: { price: 5, duration_min: 10 },
    SPECIAL_PACKAGING: { price: 10, duration_min: 15 },
    
    // Assembly
    PRODUCT_ASSEMBLY: { price: 20, duration_min: 30 },
    KITTING: { price: 15, duration_min: 20 },
    
    // Inspection
    QUALITY_CHECK: { price: 8, duration_min: 10 },
    PHOTO_DOCUMENTATION: { price: 5, duration_min: 5 },
    
    // Special handling
    WHITE_GLOVE: { price: 50, duration_min: 60 },
    INSTALLATION: { price: 100, duration_min: 120 },
    
    // Documentation
    COD_COLLECTION: { price_percent: 2, duration_min: 5 },
    SIGNATURE_REQUIRED: { price: 3, duration_min: 2 }
  };
  
  async addService(shipmentId, serviceName) {
    const service = this.services[serviceName];
    
    await supabase.from('shipment_services').insert({
      shipment_id: shipmentId,
      service_name: serviceName,
      service_price: service.price,
      status: 'REQUESTED'
    });
  }
}
```

**Features:**
- [ ] **Special Handling**
  - White glove service
  - Installation service
  - Temperature-controlled
  - Fragile handling

- [ ] **Documentation Services**
  - COD collection
  - Signature required
  - Photo documentation
  - Video proof

- [ ] **Packaging Services**
  - Gift wrapping
  - Custom packaging
  - Eco-friendly options
  - Branded packaging

---

## 📊 4PL Success Metrics

### **Operational KPIs**
- ✅ **On-Time Delivery Rate:** > 95%
- ✅ **Perfect Order Rate:** > 90%
- ✅ **Vehicle Utilization:** > 85%
- ✅ **Cost per Shipment:** Trending down
- ✅ **Transit Time:** < industry average

### **Customer KPIs**
- ✅ **Customer Retention:** > 90%
- ✅ **NPS Score:** > 50
- ✅ **API Adoption Rate:** > 60%
- ✅ **Self-Service Usage:** > 70%
- ✅ **Customer Satisfaction:** > 4.5/5

### **Financial KPIs**
- ✅ **Revenue Growth:** > 20% YoY
- ✅ **Gross Margin:** > 30%
- ✅ **Customer Acquisition Cost:** Decreasing
- ✅ **Customer Lifetime Value:** Increasing
- ✅ **Days Sales Outstanding:** < 30 days

### **Sustainability KPIs**
- ✅ **Carbon Intensity:** Decreasing 5% YoY
- ✅ **Electric Vehicle %:** Increasing
- ✅ **Route Efficiency:** > 90%
- ✅ **Load Consolidation Rate:** > 40%

---

## 🗺️ 4PL Implementation Roadmap

### **Quarter 1 (Weeks 1-12): Foundation**
- ✅ Multi-carrier management
- ✅ Control tower dashboard
- ✅ Customer portal MVP
- ✅ Basic API

### **Quarter 2 (Weeks 13-24): Scale**
- ✅ Advanced analytics
- ✅ Predictive features
- ✅ WMS integration
- ✅ Full API suite

### **Quarter 3 (Weeks 25-36): Optimize**
- ✅ Route optimization
- ✅ Cost optimization
- ✅ Sustainability tracking
- ✅ Returns management

### **Quarter 4 (Weeks 37-48): Expand**
- ✅ International shipping
- ✅ Customs compliance
- ✅ Value-added services
- ✅ Marketplace features

---

## 🎯 4PL Competitive Advantages

1. **End-to-End Visibility** - Real-time tracking ทุก shipment
2. **Multi-Carrier Network** - เลือก carrier ที่ดีที่สุดแบบอัตโนมัติ
3. **Predictive Analytics** - ทำนายปัญหาก่อนเกิด
4. **Cost Optimization** - ลดต้นทุนด้วย AI
5. **Customer Self-Service** - ลดต้นทุนการดูแล
6. **API-First** - เชื่อมต่อง่าย ไม่ต้องพึ่ง manual
7. **Sustainability** - รายงาน carbon footprint
8. **Scalable** - รองรับการเติบโต

---

## 🚛 Driver & Owner Value Features

> **Added:** 2026-01-22  
> **Goal:** เพิ่มประสิทธิภาพและลดต้นทุนสำหรับคนขับและเจ้าของรถ  
> **Reference:** `DRIVER_OWNER_VALUE_FEATURES.md`

### **Pain Points & Solutions**

#### **สำหรับคนขับ (Driver)**
| Pain Point | Feature Solution |
|------------|------------------|
| ไม่รู้ว่าทำงานได้ดีแค่ไหน | Performance Dashboard + Driver Score |
| ไม่รู้ว่าจะได้ bonus ไหม | Incentive Calculator + Achievement System |
| ใช้น้ำมันเยอะ | Fuel Efficiency Tracking + Comparison |
| ทำงาน overtime แต่ไม่มีใครเห็น | Work Hours Tracker + Overtime Alert |
| ไม่รู้ route ไหนประหยัดเวลา | Route Analytics + Best Route Suggestion |
| รถเสียบ่อย | Maintenance Alert + Preventive Reminder |

#### **สำหรับเจ้าของรถ (Truck Owner)**
| Pain Point | Feature Solution |
|------------|------------------|
| ไม่รู้ต้นทุนจริงต่อเที่ยว | Cost Tracking + Profit Calculator |
| ไม่รู้ว่ารถคันไหนทำกำไรดี | Vehicle Performance Comparison |
| รถวิ่งไม่เต็มศักยภาพ | Utilization Dashboard + Idle Time Alert |
| ค่าซ่อมสูง | Predictive Maintenance + Cost Analysis |
| คนขับบางคนขับไม่ดี | Driver Performance Ranking |
| ไม่รู้ว่าควรลงทุนซื้อรถเพิ่มไหม | Business Intelligence Dashboard |

---

### **Feature Roadmap**

#### **QUICK WINS (Week 1-2)** 🔴 เห็นผลเร็ว

**1. Fuel Efficiency Tracker**
- [ ] เก็บข้อมูล: start_odo, end_odo, fuel_amount, fuel_price
- [ ] คำนวณ km/L อัตโนมัติ
- [ ] เปรียบเทียบกับค่าเฉลี่ย fleet
- [ ] แสดง ranking + reward
- [ ] แสดง trend 7 วัน
- [ ] คำนวณเงินประหยัดได้

**2. Trip Cost Calculator**
- [ ] เก็บค่าใช้จ่าย: น้ำมัน, ค่าผ่านทาง, อาหาร, อื่นๆ
- [ ] คำนวณค่าเสื่อมราคาอัตโนมัติ
- [ ] แสดง profit margin
- [ ] เปรียบเทียบกับเที่ยวอื่นๆ
- [ ] ถ่ายรูปใบเสร็จ (OCR future)

**3. Driver Performance Score**
- [ ] คำนวณ score จาก:
  - On-time delivery rate (30%)
  - Fuel efficiency vs average (25%)
  - Vehicle condition reports (20%)
  - Safety score (15%)
  - Customer ratings (10%)
- [ ] แสดงผล 0-100
- [ ] แสดง trend เปรียบเทียบเดือนก่อน
- [ ] แสดงคำแนะนำการปรับปรุง

---

#### **CORE FEATURES (Week 3-6)** 🟡 สำคัญมาก

**4. Daily Performance Dashboard (For Driver)**
```
Display:
- เที่ยววันนี้
- ระยะทาง
- เวลา
- รายได้
- ประสิทธิภาพน้ำมัน
- กำไรสุทธิ
- Performance score + ranking
- เป้าหมายสัปดาห์
```

**Tasks:**
- [ ] สร้างไฟล์ `dashboard.html`
- [ ] สร้าง view `v_driver_daily_stats`
- [ ] สร้าง API endpoint
- [ ] ออกแบบ UI/UX
- [ ] เพิ่มใน navigation menu

**5. Cost Breakdown System**
- [ ] สร้างตาราง `trip_costs`
  - fuel_total_cost
  - toll_total
  - meal_total
  - parking_total
  - maintenance_total
  - other_costs
  - trip_revenue
  - net_profit (calculated)
  - profit_margin (calculated)
- [ ] เพิ่ม cost entry form ตอนจบเที่ยว
- [ ] แสดง breakdown แบบ visual (pie chart)
- [ ] Export cost report

**6. Vehicle Performance Comparison (For Owner)**
- [ ] สร้าง view `v_vehicle_monthly_performance`
- [ ] แสดงรถทั้งหมดเปรียบเทียบกัน:
  - Total trips
  - Total profit
  - Avg profit margin
  - Fuel efficiency
  - Uptime percentage
  - Performance score
- [ ] Ranking system
- [ ] Filter by vehicle type
- [ ] Sort by different metrics
- [ ] Alert สำหรับรถที่มีปัญหา

**7. Predictive Maintenance Alert**
- [ ] สร้างตาราง `maintenance_schedule`
  - Mileage-based triggers
  - Time-based triggers
  - Condition-based triggers
  - Estimated cost
- [ ] สร้างตาราง `maintenance_records`
- [ ] Alert system (push notification)
- [ ] แสดงค่าใช้จ่ายประมาณการ
- [ ] แสดงประวัติการซ่อม
- [ ] นัดหมายอู่ integration (future)

---

#### **ADVANCED FEATURES (Week 7-10)** 🟢 เพิ่มมูลค่า

**8. Route Efficiency Analysis**
- [ ] เก็บข้อมูล route history
  - Origin/Destination
  - Highway used
  - Distance
  - Duration
  - Cost
  - Profit
- [ ] วิเคราะห์เส้นทางที่ผ่านมา
- [ ] เปรียบเทียบ routes ต่างๆ
- [ ] แนะนำ route ที่ดีที่สุด
- [ ] คำนวณเงินประหยัดได้ถ้าใช้ route ที่ดีกว่า

**9. Income & Expense Report Generator**
- [ ] Daily/Weekly/Monthly/Yearly reports
- [ ] Export to Excel
- [ ] Export to PDF
- [ ] Auto-send email
- [ ] Tax-ready format
- [ ] Charts and visualizations:
  - Expense breakdown (pie chart)
  - Revenue vs Expenses trend (line chart)
  - Profit margin trend
  - Vehicle comparison (bar chart)

**10. Driver Incentive System**
- [ ] สร้างตาราง `driver_incentives`
- [ ] สร้างตาราง `driver_achievements`
- [ ] สร้างตาราง `driver_rewards_redemption`
- [ ] กำหนด incentive rules:
  - Performance-based
  - Volume-based
  - Achievement-based
- [ ] Points system
- [ ] Leaderboard
- [ ] Achievement badges
- [ ] Reward redemption
- [ ] Push notifications for achievements

---

### **Database Schema**

#### **New Tables Required**

```sql
-- 1. Fuel records
CREATE TABLE fuel_records (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  trip_id bigint REFERENCES trips(id),
  driver_user_id text,
  vehicle_id bigint,
  fuel_amount_liters numeric,
  fuel_price_per_liter numeric,
  fuel_total_cost numeric,
  odo_reading numeric,
  fuel_efficiency_kml numeric,
  receipt_photo_url text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX idx_fuel_records_driver ON fuel_records(driver_user_id);
CREATE INDEX idx_fuel_records_trip ON fuel_records(trip_id);

-- 2. Trip costs
CREATE TABLE trip_costs (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  trip_id bigint REFERENCES trips(id),
  driver_user_id text,
  vehicle_id bigint,
  
  -- Costs
  fuel_total_cost numeric,
  toll_total numeric,
  toll_receipts jsonb,
  meal_total numeric,
  meal_receipts jsonb,
  parking_total numeric,
  maintenance_total numeric,
  maintenance_notes text,
  other_costs numeric,
  other_notes text,
  
  -- Revenue
  trip_revenue numeric,
  
  -- Calculated fields
  total_costs numeric GENERATED ALWAYS AS (
    COALESCE(fuel_total_cost, 0) +
    COALESCE(toll_total, 0) +
    COALESCE(meal_total, 0) +
    COALESCE(parking_total, 0) +
    COALESCE(maintenance_total, 0) +
    COALESCE(other_costs, 0)
  ) STORED,
  
  net_profit numeric GENERATED ALWAYS AS (
    COALESCE(trip_revenue, 0) - (
      COALESCE(fuel_total_cost, 0) +
      COALESCE(toll_total, 0) +
      COALESCE(meal_total, 0) +
      COALESCE(parking_total, 0) +
      COALESCE(maintenance_total, 0) +
      COALESCE(other_costs, 0)
    )
  ) STORED,
  
  profit_margin numeric GENERATED ALWAYS AS (
    CASE 
      WHEN COALESCE(trip_revenue, 0) > 0 THEN
        ((COALESCE(trip_revenue, 0) - (
          COALESCE(fuel_total_cost, 0) +
          COALESCE(toll_total, 0) +
          COALESCE(meal_total, 0) +
          COALESCE(parking_total, 0) +
          COALESCE(maintenance_total, 0) +
          COALESCE(other_costs, 0)
        )) / COALESCE(trip_revenue, 0)) * 100
      ELSE 0
    END
  ) STORED,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX idx_trip_costs_driver ON trip_costs(driver_user_id);
CREATE INDEX idx_trip_costs_vehicle ON trip_costs(vehicle_id);

-- 3. Maintenance schedule
CREATE TABLE maintenance_schedule (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  vehicle_id bigint REFERENCES vehicles(id),
  maintenance_type text, -- 'OIL_CHANGE', 'TIRE_ROTATION', 'BRAKE_CHECK', etc.
  trigger_type text, -- 'MILEAGE', 'TIME', 'CONDITION'
  trigger_value numeric,
  last_done_at timestamptz,
  last_done_odo numeric,
  next_due_odo numeric,
  next_due_date date,
  estimated_cost numeric,
  actual_cost numeric,
  status text DEFAULT 'SCHEDULED', -- SCHEDULED, DUE, OVERDUE, COMPLETED
  created_at timestamptz DEFAULT now()
);

-- 4. Maintenance records
CREATE TABLE maintenance_records (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  vehicle_id bigint REFERENCES vehicles(id),
  maintenance_type text,
  performed_at timestamptz DEFAULT now(),
  odo_reading numeric,
  cost numeric,
  parts_replaced jsonb,
  notes text,
  receipt_url text,
  performed_by text,
  created_at timestamptz DEFAULT now()
);

-- 5. Driver performance daily
CREATE TABLE driver_performance_daily (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  driver_user_id text,
  date date,
  trips_completed int,
  total_distance_km numeric,
  total_duration_hours numeric,
  fuel_efficiency_kml numeric,
  on_time_deliveries int,
  late_deliveries int,
  revenue_today numeric,
  costs_today numeric,
  net_profit numeric,
  performance_score numeric,
  rank_today int,
  created_at timestamptz DEFAULT now(),
  UNIQUE(driver_user_id, date)
);

-- 6. Driver incentives
CREATE TABLE driver_incentives (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  driver_user_id text,
  incentive_type text,
  points_earned int,
  cash_bonus numeric,
  earned_at timestamptz DEFAULT now(),
  reason text,
  trip_id bigint REFERENCES trips(id)
);

-- 7. Driver achievements
CREATE TABLE driver_achievements (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  driver_user_id text,
  achievement_type text,
  achievement_name text,
  points_awarded int,
  unlocked_at timestamptz DEFAULT now()
);

-- 8. Driver rewards redemption
CREATE TABLE driver_rewards_redemption (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  driver_user_id text,
  reward_name text,
  points_spent int,
  cash_value numeric,
  redeemed_at timestamptz DEFAULT now(),
  status text DEFAULT 'PENDING' -- PENDING, APPROVED, PAID
);

-- 9. Route history
CREATE TABLE route_history (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  trip_id bigint REFERENCES trips(id),
  origin_lat numeric,
  origin_lng numeric,
  origin_province text,
  destination_lat numeric,
  destination_lng numeric,
  destination_province text,
  route_details jsonb,
  distance_km numeric,
  duration_hours numeric,
  created_at timestamptz DEFAULT now()
);
```

#### **Views for Analytics**

```sql
-- Driver monthly stats
CREATE VIEW v_driver_monthly_stats AS
SELECT 
  driver_user_id,
  DATE_TRUNC('month', date) as month,
  SUM(trips_completed) as total_trips,
  SUM(total_distance_km) as total_distance,
  AVG(fuel_efficiency_kml) as avg_fuel_efficiency,
  SUM(on_time_deliveries)::float / NULLIF(SUM(trips_completed), 0) * 100 as on_time_rate,
  SUM(revenue_today) as total_revenue,
  SUM(costs_today) as total_costs,
  SUM(net_profit) as total_profit,
  AVG(performance_score) as avg_score
FROM driver_performance_daily
GROUP BY driver_user_id, DATE_TRUNC('month', date);

-- Vehicle efficiency ranking
CREATE VIEW v_vehicle_efficiency_ranking AS
SELECT 
  v.id,
  v.registration_no,
  v.vehicle_type,
  AVG(f.fuel_efficiency_kml) as avg_fuel_efficiency,
  COUNT(t.id) as total_trips,
  SUM(tc.net_profit) as total_profit,
  AVG(tc.profit_margin) as avg_profit_margin,
  RANK() OVER (ORDER BY AVG(tc.profit_margin) DESC) as profit_rank
FROM vehicles v
JOIN trips t ON t.vehicle_id = v.id
JOIN fuel_records f ON f.trip_id = t.id
JOIN trip_costs tc ON tc.trip_id = t.id
WHERE t.created_at > NOW() - INTERVAL '30 days'
GROUP BY v.id, v.registration_no, v.vehicle_type;

-- Route analysis
CREATE VIEW v_route_analysis AS
SELECT 
  CONCAT(origin_province, ' → ', destination_province) as route_name,
  route_details->>'highway' as highway,
  COUNT(*) as trip_count,
  AVG(distance_km) as avg_distance,
  AVG(duration_hours) as avg_hours,
  AVG(tc.toll_total) as avg_toll,
  AVG(tc.fuel_total_cost / (distance_km / 100)) as fuel_cost_per_100km,
  AVG(tc.net_profit) as avg_profit,
  AVG(f.fuel_efficiency_kml) as avg_fuel_efficiency
FROM route_history rh
JOIN trips t ON t.id = rh.trip_id
JOIN trip_costs tc ON tc.trip_id = t.id
JOIN fuel_records f ON f.trip_id = t.id
WHERE t.status = 'DELIVERED'
GROUP BY route_name, highway
HAVING COUNT(*) >= 5
ORDER BY avg_profit DESC;
```

---

### **UI/UX Updates**

#### **Navigation Menu Enhancement**
```
Add new menu items:

Current:
- หน้าหลัก
- ค้นหางาน
- ประวัติ
- ตั้งค่า

New:
- หน้าหลัก
- ค้นหางาน
- 📊 Dashboard (NEW!)
  - ภาพรวมวันนี้
  - สถิติสัปดาห์/เดือน
  - เปรียบเทียบประสิทธิภาพ
- 💰 รายรับ-รายจ่าย (NEW!)
  - บันทึกค่าใช้จ่าย
  - รายงานรายเดือน
  - ดาวน์โหลด Excel/PDF
- 🏆 แต้มและรางวัล (NEW!)
  - คะแนนสะสม
  - ความสำเร็จ
  - แลกรางวัล
- 🔧 บำรุงรักษา (NEW!)
  - ตารางบำรุงรักษา
  - แจ้งเตือน
  - ประวัติการซ่อม
- ประวัติ
- ตั้งค่า
```

---

### **Business Value**

#### **For Drivers (คนขับ):**
```
Before: รายได้ไม่แน่นอน ไม่รู้ว่าประหยัดได้หรือไม่
After:  เห็นข้อมูลชัด → ปรับปรุงได้ → เพิ่มรายได้ 10-15%

Estimated Income Increase:
- ลดค่าซ่อม (ดูแลรถดีขึ้น):       +฿500/เดือน
- ลดค่าน้ำมัน (ขับประหยัด):        +฿800/เดือน  
- ได้ bonus (ทำงานมีประสิทธิภาพ):   +฿2,000/เดือน
──────────────────────────────────────────
Total: +฿3,300/เดือน = +฿39,600/ปี 🎉
```

#### **For Truck Owners (เจ้าของรถ 10 คัน):**
```
Before: กำไร ฿300,000/เดือน
After:  กำไร ฿354,000/เดือน (+18%)

Improvements:
- Optimize fuel: +5%           = +฿15,000/เดือน
- Reduce maintenance: +3%      = +฿9,000/เดือน
- Increase utilization: +10%   = +฿30,000/เดือน
────────────────────────────────────────────
Total: +฿54,000/เดือน = +฿648,000/ปี 💰
```

#### **For Fleet Owners (800 คัน):**
```
Current: ฿24M/เดือน (฿30K/คัน average)
Potential: ฿28.3M/เดือน (+18% = +฿4.3M/เดือน)

Annual Profit Increase: ฿51.6M
```

---

### **Implementation Priority**

#### **Week 1-2: Foundation (MUST HAVE)** 🔴
- [ ] Fuel tracking + efficiency display
- [ ] Basic cost entry form
- [ ] Simple daily dashboard

#### **Week 3-4: Core Value (HIGH PRIORITY)** 🟡
- [ ] Driver performance score
- [ ] Trip cost calculator with breakdown
- [ ] Basic reports (daily/weekly)

#### **Week 5-6: Owner Value (IMPORTANT)** 🟡
- [ ] Vehicle performance comparison
- [ ] Maintenance alerts
- [ ] Monthly reports with Excel export

#### **Week 7-8: Advanced Features (NICE TO HAVE)** 🟢
- [ ] Route efficiency analysis
- [ ] Incentive system
- [ ] Predictive analytics

---

### **Success Metrics**

#### **Driver Engagement:**
- ✅ Daily active users > 80%
- ✅ Dashboard usage > 70%
- ✅ Cost entry compliance > 90%
- ✅ Driver satisfaction > 4.5/5

#### **Operational Improvement:**
- ✅ Fuel efficiency improvement > 5%
- ✅ Maintenance cost reduction > 10%
- ✅ On-time delivery rate > 95%
- ✅ Vehicle utilization > 85%

#### **Financial Impact:**
- ✅ Driver income increase > 10%
- ✅ Fleet profit margin increase > 15%
- ✅ Maintenance cost reduction > 15%
- ✅ ROI < 2 months

---

### **Quick Start Guide**

#### **Minimum Viable Features (1 Week):**

```javascript
// Step 1: Add to existing check-out flow
async function completeTripWithCosts() {
  // Existing checkout code...
  
  // NEW: Prompt for costs
  const costs = await Swal.fire({
    title: '💰 บันทึกค่าใช้จ่าย',
    html: `
      <input id="fuel-liters" placeholder="น้ำมัน (ลิตร)" type="number" class="swal2-input">
      <input id="fuel-price" placeholder="ราคา/ลิตร" type="number" class="swal2-input">
      <input id="toll" placeholder="ค่าผ่านทาง" type="number" class="swal2-input">
      <input id="meal" placeholder="ค่าอาหาร" type="number" class="swal2-input">
    `,
    confirmButtonText: 'บันทึก',
    showCancelButton: true
  });
  
  if (costs.isConfirmed) {
    const fuelLiters = parseFloat(document.getElementById('fuel-liters').value);
    const fuelPrice = parseFloat(document.getElementById('fuel-price').value);
    const distance = endOdo - startOdo;
    const efficiency = distance / fuelLiters;
    
    // Save to database
    await supabase.from('fuel_records').insert({
      trip_id: tripId,
      driver_user_id: userId,
      fuel_amount_liters: fuelLiters,
      fuel_price_per_liter: fuelPrice,
      fuel_total_cost: fuelLiters * fuelPrice,
      fuel_efficiency_kml: efficiency,
      odo_reading: endOdo
    });
    
    await supabase.from('trip_costs').insert({
      trip_id: tripId,
      driver_user_id: userId,
      fuel_total_cost: fuelLiters * fuelPrice,
      toll_total: parseFloat(document.getElementById('toll').value) || 0,
      meal_total: parseFloat(document.getElementById('meal').value) || 0,
      trip_revenue: 3500 // from job data
    });
    
    // Show feedback
    const avgEfficiency = 4.0; // Get from database
    const comparison = ((efficiency - avgEfficiency) / avgEfficiency * 100).toFixed(1);
    
    Swal.fire({
      title: efficiency > avgEfficiency ? '🎉 เยี่ยม!' : '💡 ปรับปรุงได้',
      html: `
        <p>ประสิทธิภาพน้ำมัน: <strong>${efficiency.toFixed(1)} km/L</strong></p>
        <p>${comparison > 0 ? 'ดีกว่า' : 'ต่ำกว่า'}ค่าเฉลี่ย ${Math.abs(comparison)}%</p>
        <p>กำไรเที่ยวนี้: <strong>฿${(3500 - (fuelLiters * fuelPrice)).toFixed(0)}</strong></p>
      `,
      icon: efficiency > avgEfficiency ? 'success' : 'info'
    });
  }
}
```

---

**End of Plan Document**

> 💡 **Remember:** Always read this plan before making changes!
> 📝 **Always update:** Document new features and changes here!
> 🧪 **Always test:** Before committing to production!
> 🚀 **Stay focused:** Prioritize high-impact, low-effort features first!
> 📊 **Measure everything:** Track metrics to validate assumptions!
> 🚚 **Think 4PL:** Always consider the complete supply chain, not just transportation!
> 💰 **Value First:** Every feature should create measurable value for drivers and owners!