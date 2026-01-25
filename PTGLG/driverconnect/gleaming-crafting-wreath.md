# DriverConnect Development Plan

## Executive Summary

โปรเจค DriverConnect เป็นระบบจัดการการขนส่งครบวงจร ประกอบด้วย:
- **Admin Panel** - Dashboard, จัดการงาน, รายงาน
- **Driver App** - ค้นหางาน, Check-in/out, ทดสอบแอลกอฮอล์, Live tracking
- **Backend** - Supabase (PostgreSQL) + Realtime

---

## Progress Log

### 2025-01-25
- ✅ **Phase 1.3-1.4 Completed**: Security hardening (commit 53f6683)
  - Fixed XSS vulnerabilities with sanitize utility
  - Centralized API keys to `shared/config.js`
- ✅ **Phase 2.1 Completed**: Refactored admin.js (3,118 → 162 lines entry point)
  - Created 15 modules in `admin/js/`
  - Original backed up as `admin/admin.old.js`
- ✅ **Phase 2.2 Completed**: Fixed N+1 Query in updateMapMarkers()
  - Changed from loop queries to single batch query with `.in()`

---

## Critical Issues (ต้องแก้ก่อน)

| Priority | Issue | Risk | Status | File |
|----------|-------|------|--------|------|
| 1 | Dev mode bypass `?dev=1` | CRITICAL | ⚠️ PENDING | admin/admin.old.js:2715 |
| 2 | Row-Level Security (RLS) ปิดอยู่ | CRITICAL | 🟡 IN PROGRESS | Supabase migrations |
| 3 | XSS vulnerabilities (115 จุด) | CRITICAL | ✅ DONE | admin/*.js |
| 4 | Exposed API keys (15+ files) | HIGH | ✅ DONE | shared/config.js |

---

## Phase 1: Security Hardening (Week 1-2)

### 1.1 Remove Dev Mode Bypass
**File:** `admin/admin.old.js` (lines 2715-2723) - **PENDING**
```javascript
// ลบโค้ดนี้:
const devMode = urlParams.get('dev') === '1';
if (devMode) { ... }
```
**Effort:** 1 ชั่วโมง | **Status:** ⚠️ TODO

### 1.2 Enable Row-Level Security (RLS)
**Location:** Supabase Dashboard → Tables
- ✅ Created migrations: `20260125140000_fix_user_profiles_rls.sql`, `20260125150000_fix_jobdata_rls.sql`
- ⚠️ Need to verify all tables have RLS enabled
- ⚠️ Need to create policies for driver/admin access

**Effort:** 8 ชั่วโมง | **Status:** 🟡 IN PROGRESS

### 1.3 Fix XSS Vulnerabilities
**Files:**
- `admin/js/utils.js` - ✅ Created sanitizeHTML utility
- All modules now use `sanitizeHTML()` instead of raw innerHTML

**Status:** ✅ DONE

### 1.4 Centralize API Keys
**Created:** `shared/config.js` as single source of truth
**Removed:** Hardcoded keys from admin modules (import from config)

**Status:** ✅ DONE

---

## Phase 2: Code Quality (Week 3-4)

### 2.1 Refactor admin.js ✅ COMPLETED
**Before:** 3,118 lines monolithic file
**After:** 162 lines entry point + 15 modules

**New Structure:**
```
admin/
├── admin.js (162 lines - LIFF init, routing)
├── admin.old.js (backup - 3,118 lines)
└── js/
    ├── utils.js - sanitizeHTML, showNotification, formatters
    ├── map.js - initMap, updateMapMarkers (N+1 fixed), playback
    ├── dashboard.js - loadDashboardAnalytics
    ├── users.js - loadUsers, handleUserUpdate
    ├── jobs.js - loadJobs, openJobModal, handleJobSubmit, details
    ├── reports.js - loadDriverReports, generateDriverReport
    ├── settings.js - loadSettings, saveSettings
    ├── alerts.js - loadAlerts, updateAlertsBadge
    ├── logs.js - loadLogs, search filters
    ├── holiday-work.js - holiday approval workflow
    ├── breakdown.js - vehicle breakdown handling
    ├── siphoning.js - fuel siphoning records
    ├── b100.js - B100 jobs management
    ├── notifications.js - notification bell & dropdown
    ├── realtime.js - Supabase subscriptions
    └── main.js - initialization & event setup
```

**Status:** ✅ DONE

### 2.2 Fix N+1 Queries ✅ COMPLETED
**File:** `admin/js/map.js` - updateMapMarkers()

**Before (admin.old.js:283-297):**
```javascript
// ❌ N+1: Loop + query per job
for (const job of activeJobs) {
    const { data: latestLog } = await supabase
        .from('driver_logs')
        .select('*')
        .eq('reference', job.reference)
        .limit(1);
}
```

**After (js/map.js:91-103):**
```javascript
// ✅ Single batch query
const references = activeJobs.map(job => job.reference);
const { data: allLogs } = await supabase
    .from('driver_logs')
    .select('*')
    .in('reference', references)
    .order('created_at', { ascending: false });
```

**Status:** ✅ DONE

### 2.3 Driver App Improvements
**Files:** `driverapp/js/`
- Consolidate global state เป็น StateManager
- Extract duplicate enrichStopsWithCoordinates()
- เพิ่ม error codes และ recovery guidance

**Effort:** 12 ชั่วโมง | **Status:** ⚠️ TODO

---

## Phase 3: n8n Automation (Week 5-6)

### 3.1 Alert Workflows
| Workflow | Trigger | Action |
|----------|---------|--------|
| Holiday Work Alert | DB webhook | LINE notify admin |
| Driver Offline Alert | Every 30 min | Alert dispatch |
| Alcohol Fail Alert | DB webhook | LINE + Email supervisor |
| Daily Summary | 6 AM daily | Report to stakeholders |

### 3.2 Data Sync Workflows
- Google Sheets backup (daily)
- ERP integration (future)

**Effort:** 24 ชั่วโมง

---

## Phase 4: Feature Enhancements (Week 7-10)

### 4.1 Driver Value Features
- Fuel Efficiency Tracker
- Trip Cost Calculator
- Driver Performance Score
- Weekly Dashboard

### 4.2 UX Improvements
- Loading skeletons
- Better error messages
- Confirmation dialogs
- Mobile responsive

### 4.3 Professional Enhancements
- Design system
- PWA support
- Analytics (Sentry)

---

## Phase 5: Testing & Documentation (Week 11-12)

- Unit tests (Jest) - target 80% coverage
- E2E tests (Cypress)
- API documentation
- User guides

---

## Verification Steps

### Security
- [ ] `?dev=1` returns access denied
- [ ] RLS policies active (test driver sees only own jobs)
- [ ] XSS scanner shows 0 vulnerabilities
- [ ] API keys not visible in browser devtools

### Performance
- [ ] Page load < 2 seconds
- [ ] < 50 queries per page load
- [ ] Memory stable over 1 hour

### Automation
- [ ] n8n workflows tested in staging
- [ ] Alerts delivered < 1 minute
- [ ] Daily reports generated

---

## Timeline Summary

```
Week 1-2:   Security Fixes ━━━━━━━━━━━━━━━━━━━━ (29 hrs)
Week 3-4:   Code Quality  ━━━━━━━━━━━━━━━━━━━━━ (40 hrs)
Week 5-6:   n8n Automation ━━━━━━━━━━━━━━━━━━━━ (24 hrs)
Week 7-10:  Features ━━━━━━━━━━━━━━━━━━━━━━━━━━ (flexible)
Week 11-12: Testing ━━━━━━━━━━━━━━━━━━━━━━━━━━━ (flexible)
```

---

## Key Files to Modify

1. **`PTGLG/driverconnect/admin/admin.js`** - Security fixes, refactoring
2. **`PTGLG/driverconnect/driverapp/js/config.js`** - Centralize config
3. **`PTGLG/driverconnect/driverapp/js/supabase-api.js`** - Code deduplication
4. **`PTGLG/driverconnect/driverapp/js/app.js`** - State management
5. **Supabase Dashboard** - RLS policies
