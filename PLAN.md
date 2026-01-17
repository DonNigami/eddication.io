# 📋 PLAN - Driver Tracking App Development Plan

> **Last Updated:** 2026-01-17  
> **Project:** Driver Tracking App (LINE LIFF + Supabase)  
> **Status:** ✅ Core Features Working | 🔄 User Tracking Added

---

## 🎯 Project Overview

แอปพลิเคชันสำหรับคนขับรถเพื่อติดตามงานส่งของ ใช้ LINE LIFF เป็นหน้าบ้าน และ Supabase เป็น Backend Database

**Main File:** `PTGLG/driverconnect/driverapp/index-supabase-modular.html`

---

## 📁 Project Structure

```
PTGLG/driverconnect/driverapp/
├── index-supabase-modular.html    ✅ Main application (ACTIVE)
├── index-supabase-v2.html         ⚠️  Old version (DEPRECATED)
├── index-test-20260115.html       📚 Reference version (original features)
├── js/
│   ├── app.js                     ✅ Main app logic + LIFF init + User tracking
│   ├── supabase-api.js            ✅ Database API layer (driver_* tables) + User profile functions
│   ├── enhanced-ux.js             ✅ UX features (PTR, toast, quick actions, syncing bar)
│   ├── config.js                  ✅ Configuration (LIFF ID, Supabase credentials)
│   └── supabase-api-helper.js     ⚠️  Not actively used
└── css/
    └── styles.css                 ✅ All styling

supabase/
├── migrations/
│   ├── 20260117_create_driver_tracking_tables.sql  ✅ Applied
│   ├── 20260117_fix_rls_policies.sql               ✅ Applied (RLS disabled for testing)
│   └── 20260117_update_user_profiles.sql           ⏳ PENDING - Need to apply!
└── check-user-profiles.sql        📋 Query to verify table structure
```

---

## 🗄️ Database Schema (Supabase)

### Tables

#### 1. **driver_jobs** (Job Headers)
```sql
- id (uuid, PK)
- reference (text, UNIQUE) -- รหัสงาน เช่น 2601S16472
- vehicle_desc (text)
- drivers (text) -- comma-separated names
- status (text) -- 'active', 'completed', 'closed'
- ODO_start, ODO_end (numeric)
- location (jsonb) -- {lat, lng}
- total_fee, toll_fee, etc. (numeric)
- created_at, updated_at (timestamp)
```

#### 2. **driver_stops** (Individual Stops)
```sql
- id (uuid, PK)
- job_id (uuid, FK -> driver_jobs)
- reference (text)
- stop_number (integer)
- status (text)
- checkin_time, checkout_time (timestamp)
- checkin_location, checkout_location (jsonb) -- {lat, lng}
- fuel_location, unload_location (jsonb)
```

#### 3. **driver_alcohol_checks**
```sql
- id (uuid, PK)
- job_id (uuid, FK)
- reference (text)
- driver_name (text)
- alcohol_value (numeric)
- image_url (text) -- URL to 'alcohol-checks' storage bucket
- location (jsonb)
- created_at (timestamp)
```

#### 4. **driver_logs** (Audit Trail)
```sql
- id (uuid, PK)
- job_id (uuid, FK)
- reference (text)
- action (text) -- 'checkin', 'checkout', 'fuel', etc.
- details (jsonb)
- location (jsonb)
- created_at (timestamp)
```

#### 5. **user_profiles** (User Tracking) ✅ EXISTS
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
- `alcohol-checks` - Store alcohol test images

### RLS Status
- ⚠️ **Currently DISABLED for all driver_* tables** (for testing)
- 🔐 **Production:** Need to enable RLS with proper policies

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

**End of Plan Document**

> 💡 **Remember:** Always read this plan before making changes!  
> 📝 **Always update:** Document new features and changes here!  
> 🧪 **Always test:** Before committing to production!
