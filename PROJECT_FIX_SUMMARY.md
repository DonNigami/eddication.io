## ปัญหาและวิธีแก้ Admin Panel

### ❌ ปัญหาเดิม

1. **Table Schema Mismatch**
   - Code พยายาม insert ไป `subscriptions` table
   - แต่ table นี้มี column: `tenant_id, plan, status` 
   - ไม่มี `customer_name, customer_phone, package_name`

2. **RLS Policies Too Restrictive**
   - Policies ใช้ `auth.jwt()` ซึ่งต้อง authenticated user
   - `anon` key ไม่มี email → all queries fail
   - Error: `PGRST204: Could not find customer_name column`

3. **Wrong Table Names**
   - ใช้ `subscriptions` แทน `customer_subscriptions`
   - ใช้ `subscriptions` ท่า template แทน `subscriptions_packages`

### ✅ วิธีแก้

1. **Use Correct Table** 
   - ✅ Changed `subscriptions` → `customer_subscriptions`
   - ✅ Join with `profiles` (customer) and `subscriptions_packages` (package details)

2. **Fix RLS Policies** (ต้องรัน SQL ใน Supabase Dashboard)
   - ✅ Created `fix-admin-rls-policies.sql`
   - ✅ Drops auth-based policies
   - ✅ Creates anon-friendly policies
   - ✅ Creates missing tables: `subscription_requests`, `payments`

3. **Enhanced Approve/Reject Logic**
   - ✅ Step 1: Update subscription_requests status
   - ✅ Step 2: Find or create customer profile
   - ✅ Step 3: Find package ID by name
   - ✅ Step 4: Insert into customer_subscriptions
   - ✅ Step 5: Create payment record
   - ✅ Reload data after each operation

### 📋 ขั้นตอนการแก้ไขให้สม

**Step 1: Copy SQL ด้านล่าง**
```sql
[See fix-admin-rls-policies.sql file]
```

**Step 2: ไปที่ Supabase Dashboard**
- https://app.supabase.com → เลือก Project
- SQL Editor → สร้าง New Query
- Paste SQL ข้างบน
- Click "RUN" (หรือ Ctrl+Enter)

**Step 3: Reload packages-admin.html**
- Press Ctrl+Shift+R (hard refresh)
- ไปที่ "ใบสมัครใหม่" tab
- กดปุ่ม "อนุมัติ" และดู console logs
- ตรวจว่าข้อมูลปรากฏในแท็บ "สมาชิก"

### 🔍 Debug Commands

ถ้ายังมีปัญหา ลองรันใน Browser Console:

```javascript
// Test query
const { data, error } = await supabase
  .from('customer_subscriptions')
  .select('*')
  .limit(1)

console.log('Subscriptions:', data)
console.log('Error:', error)

// Check RLS
const { data: test } = await supabase
  .from('subscription_requests')
  .select('count(*)')

console.log('Can access subscription_requests:', test)
```

### 📚 Table Structure Reference

**subscription_requests** (ใบสมัครรอตรวจสอบ)
- id, customer_name, customer_phone, package_name
- duration_months, total_price, slip_url, status

**customer_subscriptions** (สมาชิกใช้งาน)
- id, customer_id, package_id, status, payment_status
- start_date, end_date, paid_amount

**subscriptions_packages** (แพคเกจสมาชิก)
- id, name, price_yearly, color_theme, benefits, is_active

**profiles** (ข้อมูลลูกค้า)
- id, display_name, phone, email, picture_url, role

**payments** (ประวัติการชำระ)
- id, customer_name, amount, status, slip_url, created_at
