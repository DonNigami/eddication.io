# DriverConnect Development Plan

## Executive Summary

โปรเจค DriverConnect เป็นระบบจัดการการขนส่งครบวงจร ประกอบด้วย:
- **Admin Panel** - Dashboard, จัดการงาน, รายงาน
- **Driver App** - ค้นหางาน, Check-in/out, ทดสอบแอลกอฮอล์, Live tracking
- **Backend** - Supabase (PostgreSQL) + Realtime

---

## Critical Issues (ต้องแก้ก่อน)

| Priority | Issue | Risk | File |
|----------|-------|------|------|
| 1 | Dev mode bypass `?dev=1` | CRITICAL | admin/admin.js:2715 |
| 2 | Row-Level Security (RLS) ปิดอยู่ | CRITICAL | Supabase Dashboard |
| 3 | XSS vulnerabilities (115 จุด) | CRITICAL | admin/*.js |
| 4 | Exposed API keys (15+ files) | HIGH | Multiple files |

---

## Phase 1: Security Hardening (Week 1-2)

### 1.1 Remove Dev Mode Bypass
**File:** `PTGLG/driverconnect/admin/admin.js` (lines 2715-2723)
```javascript
// ลบโค้ดนี้:
const devMode = urlParams.get('dev') === '1';
if (devMode) { ... }
```
**Effort:** 1 ชั่วโมง

### 1.2 Enable Row-Level Security (RLS)
**Location:** Supabase Dashboard → Tables
- Enable RLS บนทุกตาราง (user_profiles, jobdata, driver_jobs, etc.)
- สร้าง policies สำหรับ driver/admin access

**Effort:** 8 ชั่วโมง

### 1.3 Fix XSS Vulnerabilities
**Files:**
- `admin/admin.js` (73 innerHTML)
- `admin/debug-import.js` (34 innerHTML)
- `admin/logistics-performance.js` (8 innerHTML)

**Solution:** สร้าง sanitize utility + replace innerHTML

**Effort:** 16 ชั่วโมง

### 1.4 Centralize API Keys
**Create:** `shared/config.js` เป็น single source of truth
**Remove:** hardcoded keys จาก 15+ files

**Effort:** 4 ชั่วโมง

---

## Phase 2: Code Quality (Week 3-4)

### 2.1 Refactor admin.js (2,984 lines)
แยกเป็น modules:
```
admin/modules/
├── auth.js
├── dashboard.js
├── jobs.js
├── users.js
├── map.js
├── reports.js
└── notifications.js
```
**Effort:** 24 ชั่วโมง

### 2.2 Fix N+1 Queries
**File:** `admin/admin.js` - updateMapMarkers()
- เปลี่ยนจาก loop queries เป็น batch query

**Effort:** 4 ชั่วโมง

### 2.3 Driver App Improvements
**Files:** `driverapp/js/`
- Consolidate global state เป็น StateManager
- Extract duplicate enrichStopsWithCoordinates()
- เพิ่ม error codes และ recovery guidance

**Effort:** 12 ชั่วโมง

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
