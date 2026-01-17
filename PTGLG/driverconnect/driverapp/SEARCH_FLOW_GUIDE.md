# ✅ การค้นหาข้อมูล - รองรับทั้ง jobdata และ driver_jobs

## 🎯 วิธีการค้นหา (Search Flow)

```
User กรอก Reference และกดค้นหา
  ↓
┌─────────────────────────────────────────┐
│ Step 1: ค้นหาใน jobdata ก่อน           │
└─────────────────────────────────────────┘
  ↓
  ├─ ✅ พบข้อมูล → ใช้ข้อมูลจาก jobdata ทันที
  │   └─ แสดง badge "jobdata" (สีเขียว)
  │
  └─ ❌ ไม่พบข้อมูล
       ↓
     ┌─────────────────────────────────────────┐
     │ Step 2: ค้นหาใน driver_jobs             │
     └─────────────────────────────────────────┘
       ↓
       ├─ ✅ พบข้อมูล
       │   ↓
       │   ┌─────────────────────────────────────────┐
       │   │ Step 3: Sync ไปเก็บใน jobdata          │
       │   └─────────────────────────────────────────┘
       │   ↓
       │   └─ แสดง badge "driver_jobs→synced" (สีส้ม)
       │
       └─ ❌ ไม่พบข้อมูล → แสดงข้อความ "ไม่พบข้อมูลงาน"
```

---

## 📊 การทำงานของแต่ละไฟล์

### 1. **supabase-api.js** (Logic หลัก)
```javascript
async search(reference) {
  // Step 1: Query jobdata
  const jobdata = await supabase.from('jobdata')...
  
  if (jobdata.length > 0) {
    return { success: true, source: 'jobdata', data: ... }
  }
  
  // Step 2: Query driver_jobs (fallback)
  const driverJobs = await supabase.from('driver_jobs')...
  
  if (driverJobs.length > 0) {
    // Step 3: Sync to jobdata
    await syncToJobdata(...)
    return { success: true, source: 'driver_jobs', data: ... }
  }
  
  return { success: false, message: 'ไม่พบข้อมูล' }
}
```

### 2. **app.js** (UI Controller)
```javascript
async function search() {
  const result = await SupabaseAPI.search(reference)
  
  if (result.success) {
    const source = result.source // 'jobdata' or 'driver_jobs'
    renderSummary(result.data, source) // แสดง badge บอก source
  }
}
```

### 3. **index-supabase-modular.html** (UI)
- ไม่ต้องแก้ไข HTML
- Logic อยู่ใน JavaScript แล้ว
- แสดง badge บอกว่าข้อมูลมาจากไหน

---

## 🔍 การ Sync จาก driver_jobs → jobdata

```javascript
async function syncToJobdata(jobs, stops, reference) {
  // 1. ลบข้อมูลเก่าใน jobdata (ถ้ามี)
  await supabase.from('jobdata').delete().eq('reference', reference)
  
  // 2. Insert ข้อมูลใหม่จาก driver_jobs
  const rows = jobs.map((job, index) => ({
    reference: reference,
    ship_to_name: job.ship_to_name,
    vehicle_desc: job.vehicle_desc,
    seq: index + 1,
    // ... เก็บข้อมูลอื่นๆ
  }))
  
  await supabase.from('jobdata').insert(rows)
}
```

---

## 🎨 UI Indicators

### Badge สีเขียว (jobdata)
```
Reference: 2601M01559 [jobdata]
```
→ ข้อมูลมาจาก `jobdata` table (cached data)

### Badge สีส้ม (driver_jobs→synced)
```
Reference: 2601M01559 [driver_jobs→synced]
```
→ ข้อมูลมาจาก `driver_jobs` และได้ sync ไปเก็บใน `jobdata` แล้ว

---

## ⚠️ Error Handling

### RLS Policy Blocked (Error 406)
```javascript
if (error.code === 'PGRST116' || error.includes('406')) {
  return { 
    success: false,
    message: '⚠️ ไม่พบข้อมูลในระบบ...'
  }
}
```

### ไม่พบข้อมูลทั้งสองที่
```javascript
if (!jobdata && !driverJobs) {
  return {
    success: false,
    message: 'ไม่พบข้อมูลงาน Reference: XXX\n(ค้นหาทั้ง jobdata และ driver_jobs แล้ว)'
  }
}
```

---

## 🧪 วิธีทดสอบ

### Test Case 1: ข้อมูลอยู่ใน jobdata
```sql
-- เตรียมข้อมูล
INSERT INTO jobdata (reference, vehicle_desc, ...) 
VALUES ('TEST-001', 'กข-1234', ...);
```

ค้นหา: `TEST-001`
- ✅ ควรพบใน jobdata
- ✅ แสดง badge สีเขียว "jobdata"
- ✅ ไม่มี query ไป driver_jobs

### Test Case 2: ข้อมูลอยู่ใน driver_jobs
```sql
-- เตรียมข้อมูล
INSERT INTO driver_jobs (reference, vehicle_desc, ...) 
VALUES ('TEST-002', 'กค-5678', ...);
```

ค้นหา: `TEST-002`
- ✅ ไม่พบใน jobdata
- ✅ พบใน driver_jobs
- ✅ Sync ไปเก็บใน jobdata
- ✅ แสดง badge สีส้ม "driver_jobs→synced"

### Test Case 3: ไม่มีข้อมูลทั้งสองที่
ค้นหา: `NOTFOUND-999`
- ✅ ไม่พบใน jobdata
- ✅ ไม่พบใน driver_jobs
- ✅ แสดงข้อความ "ไม่พบข้อมูลงาน (ค้นหาทั้ง jobdata และ driver_jobs แล้ว)"

---

## 📝 สรุป

- ✅ **ค้นหา jobdata ก่อน** (Performance ดี)
- ✅ **Fallback ไป driver_jobs** (ถ้าไม่พบ)
- ✅ **Auto Sync** (driver_jobs → jobdata)
- ✅ **UI Indicator** (แสดง badge บอก source)
- ✅ **Error Handling** (RLS, Permission, Not Found)

---

## 🔧 การแก้ไข RLS Policies

ถ้ายัง Error 406 อยู่ ให้รัน SQL นี้:

```sql
-- Allow anon to access driver_jobs
CREATE POLICY "anon_select_all" ON driver_jobs 
  FOR SELECT TO anon USING (true);
```

หรือใช้ไฟล์: `supabase/FIX_RLS_DRIVER_JOBS.sql`

---

**เสร็จสมบูรณ์แล้ว!** 🎉
