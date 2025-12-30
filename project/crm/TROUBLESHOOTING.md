# 🧪 CRM Pro - Diagnostic Report

## ปัญหาที่พบ

หน้า **test.html** ไม่สามารถใช้งานได้เพราะ:

### 🔴 1. Database Tables ยังไม่ถูกสร้าง
test.html ต้องการ tables เหล่านี้:
- ✗ `profiles` - เก็บข้อมูลลูกค้า/สมาชิก
- ✗ `tiers` - เก็บระดับสมาชิก (Member, Silver, Gold...)
- ✗ `news_promotions` - เก็บข่าวสารและโปรโมชั่น
- ✗ `customer_segments` - เก็บกลุ่มเป้าหมายลูกค้า

### ⚠️ 2. Edge Functions ไม่มี (Optional)
test.html เรียกใช้ functions เหล่านี้:
- `crm-core` - สำหรับแจ้งเตือน Telegram
- `crm-pro` - สำหรับ broadcast และจัดการแต้ม

**หมายเหตุ:** ถ้าไม่ deploy functions เหล่านี้ ระบบจะมี warning แต่ยังใช้งานพื้นฐานได้

---

## ✅ วิธีแก้ไข (ทำตามลำดับ)

### ขั้นตอนที่ 1: สร้าง Database Tables

1. **เปิด Supabase Dashboard SQL Editor:**
   ```
   https://supabase.com/dashboard/project/ckhwouxtrvuthefkxnxb/editor
   ```

2. **คลิก "SQL Editor" → "+ New query"**

3. **Copy ทั้งหมดจากไฟล์ `setup-crm-tables.sql` และ Paste**

4. **คลิก "RUN" (หรือกด Ctrl+Enter)**

5. **รอจนเห็นข้อความ:**
   ```
   NOTICE: ✓ Database setup completed successfully!
   NOTICE: ✓ All tables created with RLS policies
   NOTICE: ✓ Sample data inserted
   NOTICE: → You can now use test.html
   ```

### ขั้นตอนที่ 2: ทดสอบการเชื่อมต่อ

1. **เปิด `test-connection.html` ในเบราว์เซอร์**
   ```
   file:///d:/VS_Code_GitHub_DATA/eddication.io/eddication.io/project/crm/test-connection.html
   ```

2. **ดูผลการทดสอบ:**
   - ถ้า **✓ All critical tests passed!** → พร้อมใช้งาน
   - ถ้ายังมี **✗ Failed** → อ่านคำแนะนำด้านล่าง

### ขั้นตอนที่ 3: ทดสอบ test.html

1. **เปิด test.html:**
   - **ผ่าน LIFF URL** (แนะนำ): 
     ```
     https://liff.line.me/2006397073-kK6uCiwf
     ```
   - **หรือเปิดไฟล์โดยตรง** (สำหรับ debug):
     ```
     file:///d:/VS_Code_GitHub_DATA/eddication.io/eddication.io/project/crm/test.html
     ```

2. **Login ผ่าน LINE** (ถ้ายังไม่ได้ login)

3. **ทดสอบฟีเจอร์:**
   - ✓ ดูข้อมูลโปรไฟล์
   - ✓ ดูระดับสมาชิก (Tier Card)
   - ✓ ดูข่าวสาร/โปรโมชั่น

---

## 📋 Checklist การตรวจสอบ

### Database
- [ ] Tables ถูกสร้างแล้ว (4 tables)
- [ ] RLS Policies ถูกตั้งค่าแล้ว
- [ ] มีข้อมูล sample (tiers, news)

### Configuration
- [x] LIFF_ID: `2006397073-kK6uCiwf`
- [x] SUPABASE_URL: `https://ckhwouxtrvuthefkxnxb.supabase.co`
- [x] SUPABASE_KEY: `sb_publishable_QvGKuCheOXRbtGH-Cm0Q5A_ddRY3_i3`

### Testing
- [ ] test-connection.html แสดง "✓ All critical tests passed!"
- [ ] test.html เปิดได้โดยไม่มี error
- [ ] Login ผ่าน LINE ได้
- [ ] แสดงข้อมูลโปรไฟล์ถูกต้อง

---

## 🔍 วิธี Debug เพิ่มเติม

### ถ้าเจอ Error ใน Console

1. **เปิด Browser DevTools:**
   - Chrome/Edge: กด `F12` หรือ `Ctrl+Shift+I`
   - คลิก tab "Console"

2. **ดู Error Messages:**
   ```javascript
   // ตัวอย่าง errors ที่อาจพบ:
   
   // ❌ Table not found
   relation "public.profiles" does not exist
   → ยังไม่ได้สร้าง tables (กลับไปทำขั้นตอนที่ 1)
   
   // ❌ RLS Policy error
   new row violates row-level security policy
   → RLS policies ไม่ถูกต้อง (ลอง execute setup-crm-tables.sql อีกครั้ง)
   
   // ❌ LIFF error
   LIFF init failed
   → ตรวจสอบ LIFF_ID หรือเปิดผ่าน LIFF URL
   
   // ⚠️ Function not found (ไม่มีปัญหา)
   FunctionsHttpError: Edge Function not found
   → Edge Functions ยังไม่ได้ deploy (ไม่จำเป็นสำหรับฟีเจอร์พื้นฐาน)
   ```

3. **ดู Network Tab:**
   - คลิก tab "Network"
   - Refresh หน้า
   - ดู requests ที่เป็นสีแดง (failed)
   - คลิกดูรายละเอียด error

### ถ้า test-connection.html พบปัญหา

**ปัญหา: Table missing**
```sql
-- แก้ไข: Execute setup-crm-tables.sql ใหม่อีกครั้ง
```

**ปัญหา: RLS Policy blocking**
```sql
-- ตรวจสอบ RLS policies:
SELECT tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('profiles', 'tiers', 'news_promotions', 'customer_segments');
```

**ปัญหา: LIFF not logged in**
```
→ เปิด test.html ผ่าน LIFF URL แทน:
https://liff.line.me/2006397073-kK6uCiwf
```

---

## 🎯 สรุป

### ปัญหาหลัก
**Database tables ยังไม่ถูกสร้าง** → test.html query ไม่สำเร็จ

### วิธีแก้
1. Execute `setup-crm-tables.sql` ใน Supabase SQL Editor
2. ทดสอบด้วย `test-connection.html`
3. เปิด `test.html` ผ่าน LIFF URL

### Expected Result
- ✓ หน้า test.html เปิดได้
- ✓ Login ผ่าน LINE ได้
- ✓ แสดงข้อมูลโปรไฟล์และ tier card
- ✓ แสดงข่าวสาร (2 รายการจาก sample data)
- ⚠️ Broadcast และ Admin features จะทำงานไม่เต็มที่ถ้าไม่มี Edge Functions (แต่ไม่กระทบการใช้งานพื้นฐาน)

---

## 📝 หมายเหตุเพิ่มเติม

### Admin Mode
ถ้าต้องการทดสอบ Admin features:
1. Execute SQL:
   ```sql
   UPDATE profiles 
   SET role = 'admin' 
   WHERE line_user_id = 'YOUR_LINE_USER_ID';
   ```
2. Refresh หน้า test.html
3. จะเห็น Admin Dashboard พร้อม sidebar

### Edge Functions (Optional)
ถ้าต้องการ broadcast และ notification ให้ทำงานเต็มรูปแบบ:
- ต้อง deploy `crm-core` และ `crm-pro` functions
- ต้องตั้งค่า Telegram Bot Token
- (ไม่จำเป็นสำหรับการทดสอบพื้นฐาน)

---

**📌 ไฟล์ที่สำคัญ:**
- ✅ [test-connection.html](test-connection.html) - Tool สำหรับ debug
- ✅ [setup-crm-tables.sql](setup-crm-tables.sql) - Script สร้าง database
- ✅ [test.html](test.html) - หน้าจอหลักของระบบ
