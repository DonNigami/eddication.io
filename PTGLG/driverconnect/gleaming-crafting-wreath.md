# DriverConnect Development Plan

## Executive Summary

โปรเจค DriverConnect เป็นระบบจัดการการขนส่งครบวงจร ประกอบด้วย:
- **Admin Panel** - Dashboard, จัดการงาน, รายงาน
- **Driver App** - ค้นหางาน, Check-in/out, ทดสอบแอลกอฮอล์, Live tracking
- **Backend** - Supabase (PostgreSQL) + Realtime

---

## Progress Log

### 2026-01-25
- ✅ **Phase 2.3 Completed**: Driver App Improvements
  - Created: `driverapp/js/state-manager.js` - Centralized state with subscriptions, batch updates, persistence
  - Created: `driverapp/js/state-manager.js` - Error codes (17 types) + Recovery actions + Thai messages
  - Created: `driverapp/js/location-service.js` - Origin/customer coordinate lookup with caching (5min TTL)
  - Refactored: `driverapp/js/app.js` - Use StateManager instead of global variables
  - Refactored: `driverapp/js/supabase-api.js` - Import enrichStopsWithCoordinates, getOriginConfig (~130 lines removed)
  - Refactored: `driverapp/js/gps.js` - Import haversineDistanceMeters from location-service
- ✅ **Phase 1.5 Completed**: Driver Approval System
  - Migration: `20260126000000_add_driver_approval_fields.sql` (approved_by, approved_at, rejection_reason)
  - `shared/driver-auth.js`: isUserApproved(), getUserProfile(), registerUser(), logAudit()
  - Driver app: New users default to PENDING status (fixed bug in supabase-api.js)
  - Admin UI: `users.js` tracks approved_by/approved_at when approving drivers
  - Config: BYPASS_JOB_ACCESS_CHECK=true (database doesn't support driver-to-job assignment)

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
| 2 | **Anon RLS = No access control** | CRITICAL | 🔴 NEW | `20260125160000*.sql` |
| 3 | Row-Level Security (RLS) policies | CRITICAL | 🟡 IN PROGRESS | Supabase migrations |
| 4 | XSS vulnerabilities (115 จุด) | CRITICAL | ✅ DONE | admin/*.js |
| 5 | Exposed API keys (15+ files) | HIGH | ✅ DONE | shared/config.js |

> **⚠️ SECURITY ALERT**: Migration `20260125160000` grants full anon access. RLS policies use `WITH CHECK (true)` which means ANYONE can INSERT/UPDATE. Must implement **application-layer ownership verification** (see Phase 1.5).

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

### 1.5 Application-Layer Auth for LIFF 🔴 NEW
**Problem:** Anon RLS policies allow ANYONE to modify data. Need ownership verification.

**Create:** `shared/driver-auth.js`
```javascript
export class DriverAuth {
    static async verifyJobAccess(supabase, liffId, jobId) {
        const { data } = await supabase
            .from('driver_jobs')
            .select('id')
            .eq('job_id', jobId)
            .eq('driver_liff_id', liffId)
            .single();
        return !!data;
    }

    static async verifyProfileOwnership(supabase, liffId, profileId) {
        const { data } = await supabase
            .from('user_profiles')
            .select('liff_id')
            .eq('id', profileId)
            .single();
        return data?.liff_id === liffId;
    }
}
```

**Update all driverapp mutations:**
- `checkInToJob()` → verify before update
- `submitAlcoholTest()` → verify before insert
- `updateProfile()` → verify ownership

**Effort:** 6 ชั่วโมง | **Status:** 🔴 TODO

### 1.6 Database Indexes for Performance 🔴 NEW
```sql
-- Migration: 20260125180000_add_performance_indexes.sql
CREATE INDEX idx_driver_jobs_liff_job ON driver_jobs(driver_liff_id, job_id);
CREATE INDEX idx_driver_logs_reference_created ON driver_logs(reference, created_at DESC);
CREATE INDEX idx_jobdata_reference_status ON jobdata(reference, status);
CREATE INDEX idx_user_profiles_liff ON user_profiles(liff_id);
```

**Effort:** 1 ชั่วโมง | **Status:** 🔴 TODO

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

### 3.1 Alert Workflows (Prioritized by Business Impact)

| Priority | Workflow | Trigger | Action | KPI Impact |
|----------|----------|---------|--------|------------|
| 🔴 1 | **Route Deviation Alert** | GPS > 500m from route | LINE notify dispatch | Reduce theft/missuse |
| 🔴 2 | **Late Check-in Alert** | Job start +30min no check-in | Alert supervisor | Improve on-time rate |
| 🔴 3 | **Missed Alcohol Test** | Checkout without test | Block + notify | Safety compliance |
| 🟡 4 | Holiday Work Alert | DB webhook | LINE notify admin | Overtime tracking |
| 🟡 5 | Alcohol Fail Alert | DB webhook | LINE + Email | Safety response |
| 🟢 6 | Daily Summary | 6 AM daily | Report to stakeholders | Management visibility |
| 🟢 7 | Driver Offline Alert | Every 30 min | Alert dispatch | Fleet awareness |

### 3.2 Data Sync Workflows
- Google Sheets backup (daily)
- ERP integration (future)

**Effort:** 24 ชั่วโมง

---

---

## Phase 4: Feature Enhancements (Week 7-10)

### 4.1 Critical Logistics Features 🔴 (High Business Impact)

| Feature | Description | Business Value |
|---------|-------------|----------------|
| **Proof of Delivery (POD)** | Signature/photo confirmation | Reduce disputes, proof of service |
| **Route Deviation Detection** | Alert when GPS > 500m off route | Prevent theft, unauthorized trips |
| **Customer ETA Link** | Shareable tracking URL | Customer satisfaction, fewer calls |
| **Vehicle Load Utilization** | Track cargo weight vs capacity | Optimize fleet usage |

### 4.2 Driver Value Features
- Fuel Efficiency Tracker
- Trip Cost Calculator
- Driver Performance Score
- Weekly Dashboard

### 4.3 Operational KPIs Dashboard (NEW)
```javascript
// Add to admin/js/dashboard.js
const operationalKPIs = {
    // Service Metrics
    onTimeDeliveryRate: '(On-Time / Total) × 100',
    firstTimeSuccessRate: '(First-Trip Success / Total) × 100',
    avgCheckinToCheckout: 'AVG(checkout_time - checkin_time)',

    // Safety Metrics
    alcoholTestPassRate: '(Passed / Total Tests) × 100',
    missedTestsCount: 'COUNT WHERE status = missed',

    // Cost Metrics
    fuelCostPerKM: 'Total Fuel Cost / Total KM',
    vehicleUtilization: '(Loaded KM / Total KM) × 100',

    // Performance
    driverPerformanceScore: 'Weighted: on-time + safety + efficiency'
};
```

### 4.4 UX Improvements
- Loading skeletons
- Better error messages
- Confirmation dialogs
- Mobile responsive

### 4.5 Professional Enhancements
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
- [ ] **Application-layer auth blocks unauthorized job updates**
- [ ] **Test: Driver A cannot check in to Driver B's job**
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
Week 1-2:   Security Fixes ━━━━━━━━━━━━━━━━━━━━ (37 hrs)
            + NEW: 1.5 App-layer auth (6hrs)
            + NEW: 1.6 DB Indexes (1hr)

Week 3-4:   Code Quality  ━━━━━━━━━━━━━━━━━━━━━ (40 hrs)

Week 5-6:   n8n Automation ━━━━━━━━━━━━━━━━━━━━ (24 hrs)
            + Priority: Route/Late/Missed Test alerts

Week 7-10:  Features ━━━━━━━━━━━━━━━━━━━━━━━━━━ (flexible)
            + NEW: POD, Route Deviation, ETA Link

Week 11-12: Testing ━━━━━━━━━━━━━━━━━━━━━━━━━━━ (flexible)
```

---

## Key Files to Modify

1. **`PTGLG/driverconnect/admin/admin.js`** - Security fixes, refactoring
2. **`PTGLG/driverconnect/driverapp/js/config.js`** - Centralize config
3. **`PTGLG/driverconnect/driverapp/js/supabase-api.js`** - Code deduplication
4. **`PTGLG/driverconnect/driverapp/js/app.js`** - State management
5. **`PTGLG/driverconnect/shared/driver-auth.js`** - NEW: App-layer auth verification
6. **`PTGLG/driverconnect/admin/js/dashboard.js`** - NEW: Operational KPIs
7. **`Supabase Dashboard`** - RLS policies + Performance indexes
