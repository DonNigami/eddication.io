# 📋 PLAN - Driver Tracking App Development Plan

> **Last Updated:** 2026-01-17
> **Project:** Driver Tracking App (LINE LIFF + Supabase)
> **Status:** ✅ Core Features Working | 🔄 Schema Aligned with app/PLAN.md

---

## 🎯 Project Overview

แอปพลิเคชันสำหรับคนขับรถเพื่อติดตามงานส่งของ ใช้ LINE LIFF เป็นหน้าบ้าน และ Supabase เป็น Backend Database

**Main File:** `PTGLG/driverconnect/driverapp/index-supabase-modular.html`

**Schema Reference:** `PTGLG/driverconnect/app/PLAN.md` (Migration Plan)

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

### Advanced Features ✅ NEW
- [x] **Geofencing:** Automatically verifies driver's location against destination coordinates before allowing Check-in, ensuring they are within the allowed radius (e.g., 200m).
- [x] **Admin Mode:** A hidden mode for administrators (`user_type = 'ADMIN'`) that bypasses the geofencing check for testing and debugging purposes.
- [x] **User Approval Workflow:** App prevents usage until a user's profile status is set to 'APPROVED' in the `user_profiles` table by an admin.
- [x] **Robust Offline Mode:** Actions (check-in, alcohol tests, etc.) are queued locally when offline and synced automatically with retry logic when the connection is restored.
- [x] **Realtime Data Sync:** Subscribes to Supabase realtime updates for the current job, automatically refreshing the data on the screen when changes occur in the database.
- [x] **Stop Filtering:** Automatically filters out any destination stop containing "คลังศรีราชา" from being displayed in the timeline or synced to the `jobdata` table.

---

## ⏳ Pending Tasks

### High Priority
- [ ] **Apply user_profiles migration SQL**
  - File: `supabase/migrations/20260117_update_user_profiles.sql`
  - Action: Run in Supabase SQL Editor
  - URL: https://supabase.com/dashboard/project/myplpshpcordggbbtblg/sql/new

- [ ] **Update LINE LIFF Endpoint URL**
  - Current: index-supabase-v2.html
  - Target: index-supabase-modular.html
  - URL: https://developers.line.biz/console/

- [ ] **Commit and push all changes**
  ```cmd
  git add .
  git commit -m "Add user profile tracking to modular version"
  git push
  ```

### Testing Needed
- [ ] Test user profile tracking in production
- [ ] Verify total_visits increments correctly
- [ ] Verify last_reference updates on search
- [ ] Test all CRUD operations (Create, Read, Update stops)
- [ ] Test alcohol upload with large images
- [ ] Test offline behavior and error handling

### Future Enhancements
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
- `index-supabase-modular.html` - ACTIVE production file
- `index-supabase-v2.html` - Old version, keep for reference
- `index-test-20260115.html` - Original with all features, keep for reference

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

---

## 📚 Change Log

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
        [Execute or Queue Update]           │ No    │ Yes
            ↓                               ↓       ↓
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
│  ┌──────────────────┐  ┌─────────────────┐                  │
│  │  alcohol_checks  │  │  user_profiles  │                  │
│  │                  │  │   (Tracking)    │                  │
│  └──────────────────┘  └─────────────────┘                  │
│  ┌──────────────────────────────────────────┐               │
│  │         Storage: 'alcohol-evidence'      │               │
│  │              (Image uploads)             │               │
│  └──────────────────────────────────────────┘               │
└──────────────────────────────────────────────────────────────┘
```

---

**End of Plan Document**

> 💡 **Remember:** Always read this plan before making changes!
> 📝 **Always update:** Document new features and changes here!
> 🧪 **Always test:** Before committing to production!
