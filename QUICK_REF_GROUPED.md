# ⚡ Quick Reference - Frontend Grouped Display

## 🎯 Concept

- **Database** → แยกรายแถว (4 rows)
- **Frontend** → แสดงรวมจุด (2 stops)
- **Update** → บันทึกทุกแถวพร้อมกัน

---

## 📊 Example

```
Database (jobdata):          Frontend Display:
┌───────────────────┐        ┌──────────────────┐
│ id=1: GASOHOL 95  │   →    │ Stop 1: 11000973 │
│ id=2: DIESEL      │        │ Materials: 2     │
├───────────────────┤        │ Total: 11.00 KL  │
│ id=3: GASOHOL 95  │        └──────────────────┘
│ id=4: DIESEL      │   →    ┌──────────────────┐
└───────────────────┘        │ Stop 2: ZSF76    │
                              │ Materials: 2     │
                              │ Total: 7.00 KL   │
                              └──────────────────┘
```

---

## 🚀 Quick Commands

### Setup (ครั้งแรก)

```sql
\i supabase/migrations/20260117_jobdata_grouped_view.sql
```

### Query (Frontend)

```javascript
import { getGroupedJobs } from './js/jobdata-grouped-api.js';

const stops = await getGroupedJobs('2601M01559');
// Returns 2 stops (grouped)
```

### Check-in

```javascript
import { checkinGroupedStop } from './js/jobdata-grouped-api.js';

const result = await checkinGroupedStop({
  reference: '2601M01559',
  shipToCode: '11000973',
  checkinLat: 14.35,
  checkinLng: 100.87
});
// Updates 2 rows at once
```

---

## 📦 Files

1. **Migration:** `supabase/migrations/20260117_jobdata_grouped_view.sql`
2. **Test:** `supabase/test_jobdata_grouped.sql`
3. **JS API:** `PTGLG/driverconnect/driverapp/js/jobdata-grouped-api.js`
4. **HTML:** `PTGLG/driverconnect/driverapp/test-grouped-jobdata.html`
5. **Guide:** `FRONTEND_GROUPED_GUIDE.md`

---

## 💡 Full Guide

👉 [FRONTEND_GROUPED_GUIDE.md](FRONTEND_GROUPED_GUIDE.md)
