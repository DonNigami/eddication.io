# ⚡ Quick Reference - Merge Driver Jobs to JobData

## 🎯 สิ่งที่ทำได้

รวมข้อมูลจาก `driver_jobs` → `jobdata` โดยรวมจุดที่ซ้ำกัน (ship_to_code เดียวกัน) ให้เป็น 1 แถว

---

## 🚀 Quick Commands

### Setup (ครั้งแรกเท่านั้น)

```sql
-- 1. แก้ไข driver_jobs ให้รองรับ reference ซ้ำได้
\i supabase/migrations/20260117_fix_driver_jobs_allow_duplicate.sql

-- 2. สร้าง merge functions
\i supabase/migrations/20260117_merge_driver_jobs_to_jobdata.sql
```

### Test

```sql
-- รัน test ทั้งหมด
\i supabase/test_merge_driver_jobs.sql
```

### Production

```sql
-- รวมข้อมูลทั้งหมด
SELECT * FROM sync_all_driver_jobs_to_jobdata();

-- หรือเฉพาะ reference
SELECT * FROM merge_driver_jobs_to_jobdata('2601M01559');
```

---

## 📊 ผลลัพธ์

**Input (driver_jobs):** 4 แถว  
**Output (jobdata):** 2 แถว (รวมจุดซ้ำกัน)

```
reference: 2601M01559
├─ ship_to: 11000973 → materials: "DIESEL, GASOHOL 95", qty: 11.00
└─ ship_to: ZSF76    → materials: "DIESEL, GASOHOL 95", qty: 7.00
```

---

## 📦 ไฟล์ที่สร้าง

1. `supabase/migrations/20260117_fix_driver_jobs_allow_duplicate.sql` - แก้ไข schema
2. `supabase/migrations/20260117_merge_driver_jobs_to_jobdata.sql` - สร้าง functions
3. `supabase/test_merge_driver_jobs.sql` - ทดสอบ
4. `sync-driver-jobs-to-jobdata.bat` - batch script
5. `MERGE_DRIVER_JOBS_GUIDE.md` - คู่มือฉบับเต็ม
6. `README_MERGE_SOLUTION.md` - สรุปโซลูชัน

---

## 💡 เอกสารเต็ม

👉 [MERGE_DRIVER_JOBS_GUIDE.md](MERGE_DRIVER_JOBS_GUIDE.md)  
👉 [README_MERGE_SOLUTION.md](README_MERGE_SOLUTION.md)
