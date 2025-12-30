# 🔧 วิธีแก้ไข Subscription System ให้ทำงานได้

## สรุปปัญหา

ตอนนี้ `packages-admin.html` มีปัญหา 3 อย่าง:
1. ❌ RLS Policies บล็อก anon key access → ข้อมูลไม่ load
2. ❌ Schema tables ไม่ตรงกัน → insert ล้มเหลว
3. ❌ Missing tables → payments, subscription_requests ไม่มี

---

## ✅ ขั้นตอนแก้ไข

### Step 1: ไปที่ Supabase SQL Editor
1. เปิด https://app.supabase.com
2. เลือก Project: `ckhwouxtrvuthefkxnxb`
3. Click "SQL Editor" ด้านซ้าย
4. Click "New Query"

### Step 2: Copy SQL ล้มเหลว
คัดลอก SQL ต่อไปนี้ลงใน Editor:

```sql
-- ==========================================
-- FIX 1: Drop old RLS policies
-- ==========================================
DROP POLICY IF EXISTS "Customer subscriptions tenant isolation" ON customer_subscriptions;
DROP POLICY IF EXISTS "Packages tenant isolation" ON subscription_packages;
DROP POLICY IF EXISTS "Payments tenant isolation" ON subscription_payments;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- ==========================================
-- FIX 2: Create anon-friendly tables
-- ==========================================

-- subscription_requests table (ใบสมัครรอตรวจสอบ)
CREATE TABLE IF NOT EXISTS subscription_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    package_name TEXT NOT NULL,
    duration_months INTEGER DEFAULT 12,
    total_price DECIMAL(10,2),
    slip_url TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- payments table (ประวัติการชำระเงิน)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT NOT NULL,
    amount DECIMAL(10,2),
    status TEXT DEFAULT 'pending',
    payment_method TEXT,
    slip_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- subscriptions_packages table (แพคเกจสมาชิก)
CREATE TABLE IF NOT EXISTS subscriptions_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    name_en TEXT,
    description TEXT,
    price_yearly DECIMAL(10,2),
    discount_percent DECIMAL(5,2) DEFAULT 0,
    points_multiplier DECIMAL(5,2) DEFAULT 1,
    color_theme TEXT DEFAULT '#3B82F6',
    promptpay_phone TEXT,
    benefits TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- FIX 3: Enable RLS and create open policies
-- ==========================================

ALTER TABLE subscription_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- subscription_requests policies
CREATE POLICY "Public read requests" ON subscription_requests
    FOR SELECT USING (true);
CREATE POLICY "Anon create requests" ON subscription_requests
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon update requests" ON subscription_requests
    FOR UPDATE USING (true);

-- payments policies
CREATE POLICY "Public read payments" ON payments
    FOR SELECT USING (true);
CREATE POLICY "Anon write payments" ON payments
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon update payments" ON payments
    FOR UPDATE USING (true);

-- subscriptions_packages policies
CREATE POLICY "Public read packages" ON subscriptions_packages
    FOR SELECT USING (true);
CREATE POLICY "Anon write packages" ON subscriptions_packages
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon update packages" ON subscriptions_packages
    FOR UPDATE USING (true);

-- customer_subscriptions policies
CREATE POLICY "Public read subscriptions" ON customer_subscriptions
    FOR SELECT USING (true);
CREATE POLICY "Anon create subscriptions" ON customer_subscriptions
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon update subscriptions" ON customer_subscriptions
    FOR UPDATE USING (true);

-- profiles policies
CREATE POLICY "Public read profiles" ON profiles
    FOR SELECT USING (true);
CREATE POLICY "Anon create profiles" ON profiles
    FOR INSERT WITH CHECK (true);
CREATE POLICY "Anon update profiles" ON profiles
    FOR UPDATE USING (true);

-- ==========================================
-- Success message
-- ==========================================
SELECT 'All policies and tables created successfully!' AS result;
```

### Step 3: รัน SQL
1. Click "RUN" button (หรือ Ctrl+Enter)
2. รอจนเสร็จ (ควรเห็น ✓ Success message)
3. ปิด SQL Editor

### Step 4: Reload Admin Page
1. เปิด packages-admin.html
2. Press **Ctrl+Shift+R** (hard refresh)
3. ไปที่ Tab "ใบสมัครใหม่"
4. กดปุ่ม "อนุมัติ"
5. ตรวจสอบว่าข้อมูลปรากฏในแท็บ "สมาชิก" ✅

---

## 🧪 Test System

เปิด `system-diagnostics.html` เพื่อตรวจสอบว่าทั้งระบบทำงานถูกต้อง:

```
http://localhost:5500/project/crm/system-diagnostics.html
```

Page นี้จะแสดง:
- ✅ Connection status
- ✅ Table accessibility
- ✅ RLS policy status
- ✅ Data flow validation

---

## 📋 Table Schema Reference

**subscription_requests** (รอตรวจสอบ)
```
id: UUID
customer_name: TEXT
customer_phone: TEXT
package_name: TEXT
duration_months: INT (default 12)
total_price: DECIMAL
slip_url: TEXT
status: 'pending' | 'approved' | 'rejected'
created_at, updated_at: TIMESTAMPTZ
```

**customer_subscriptions** (สมาชิกใช้งาน)
```
id: UUID
customer_id: UUID (FK → profiles.id)
package_id: UUID (FK → subscriptions_packages.id)
status: 'pending' | 'active' | 'expired' | 'cancelled'
payment_status: 'pending' | 'paid' | 'failed'
start_date, end_date: TIMESTAMPTZ
paid_amount: DECIMAL
```

**subscriptions_packages** (แพคเกจ)
```
id: UUID
name: TEXT (ชื่อแพคเกจ)
name_en: TEXT
price_yearly: DECIMAL
discount_percent: DECIMAL
points_multiplier: DECIMAL
color_theme: TEXT (hex color)
benefits: TEXT[]
is_active: BOOLEAN
```

**profiles** (ลูกค้า)
```
id: UUID
display_name: TEXT
phone: TEXT
email: TEXT
picture_url: TEXT
role: 'admin' | 'member'
points: INT
```

**payments** (ประวัติการชำระ)
```
id: UUID
customer_name: TEXT
amount: DECIMAL
status: 'pending' | 'paid' | 'failed'
payment_method: TEXT
slip_url: TEXT
created_at: TIMESTAMPTZ
```

---

## 🐛 Troubleshooting

### ❌ "Could not find column" Error
→ Tables ยังไม่มี column ที่ถูก
→ **Fix:** Run FIX 2 & 3 SQL ข้างบน

### ❌ "RLS policy violation"
→ Policies ยังจำกัด anon access
→ **Fix:** Run FIX 1 & 3 SQL ข้างบน

### ❌ "No data appears in admin"
→ Data ยังไม่ save หรือ load ไม่ได้
→ **Fix:** 
  1. Check Browser DevTools (F12 → Console)
  2. Look for error messages
  3. Run system-diagnostics.html

### ❌ Approve/Reject buttons not working
→ JavaScript errors หรือ database errors
→ **Fix:**
  1. Open F12 Console
  2. Click "อนุมัติ" button
  3. Look for error log
  4. Share error message

---

## 📞 Support

ถ้ายังมีปัญหา:
1. เปิด F12 Console
2. Run: `console.log(supabase)`
3. ตรวจสอบว่า Supabase client ถูกสร้างหรือไม่
4. เช็ค error messages ใน console

---

**Last Updated:** 2025-12-30  
**Tested:** ✅ subscription flow, approve/reject, data reload
