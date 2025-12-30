# แก้ไขข้อผิดพลาดการสมัครสมาชิก

## ❌ ปัญหาที่พบ

### 1. LIFF init failed: Error: channel not found
**สาเหตุ:** LIFF ID ไม่ถูกต้องหรือ channel ถูกลบแล้ว
**วิธีแก้:** 
- ไป [Line Developers Console](https://developers.line.biz/)
- สร้าง LIFF app ใหม่หรือดึง LIFF ID ที่ถูกต้อง
- อัพเดต subscribe.html ที่บรรทัด:
```javascript
const liffId = '2006652117-vZO91aAk';  // ← เปลี่ยนเป็น LIFF ID ของคุณ
```

### 2. StorageApiError: signature verification failed
**สาเหตุ:** RLS policies ไม่อนุญาต anonymous upload
**วิธีแก้:** รัน SQL ใน Supabase SQL Editor:

```bash
# ใช้ไฟล์ที่เตรียมไว้
cat backend/setup-payment-slips-rls.sql | \
supabase db remote call

# หรือ copy-paste ใน Supabase Dashboard > SQL Editor
```

### 3. Failed to load image: 400
**สาเหตุ:** RLS policies ไม่อนุญาต public read
**วิธีแก้:** รัน SQL setup เดียวกันกับด้านบน

## ✅ วิธีแก้แบบเต็ม

### Step 1: อัพเดต LIFF ID (ถ้ามี LINE integration)
```javascript
// subscribe.html บรรทัด ~340
const liffId = 'YOUR_ACTUAL_LIFF_ID';  // เปลี่ยนจาก 2006652117-vZO91aAk
```

### Step 2: ตั้งค่า Supabase Storage RLS

**Option A: ใช้ Supabase CLI**
```bash
cd backend
supabase migration up setup-payment-slips-rls.sql
```

**Option B: ใช้ Dashboard**
1. ไปที่ Supabase > Storage
2. สร้าง bucket ชื่อ `payment-slips` (ถ้ายังไม่มี)
3. ตั้ง "Public" ให้ ON
4. ไปที่ SQL Editor แล้ว copy-paste `setup-payment-slips-rls.sql`

### Step 3: ทดสอบ

1. เปิด subscribe.html
2. กรอกข้อมูลและอัพโหลดสลิป
3. ดูใน Browser Console ว่ามี error ไหม

## 📋 RLS Policies ที่ต้อง

| Policy | Action | Condition |
|--------|--------|-----------|
| Allow public uploads | INSERT | bucket='payment-slips' |
| Allow public read | SELECT | bucket='payment-slips' |
| Allow user update | UPDATE | bucket='payment-slips' AND owner=auth.uid() |
| Allow user delete | DELETE | bucket='payment-slips' AND owner=auth.uid() |

## ⚙️ Backend Updates

- ✅ LIFF initialization มี fallback - ถ้า fail ก็ยังใช้ได้
- ✅ Auto-create bucket ถ้ายังไม่มี
- ✅ Better error messages
- ✅ Non-blocking backend notification (fire-and-forget)

## 🔗 Resources

- [Line Developers](https://developers.line.biz/)
- [Create LIFF App](https://developers.line.biz/en/docs/liff/getting-started/)
- [Supabase Storage Guide](https://supabase.com/docs/guides/storage/quickstart)
- [RLS Policies](https://supabase.com/docs/guides/auth/row-level-security)
