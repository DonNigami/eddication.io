# Boonyang Inventory - Supabase Edge Function (Full Version)

## 📋 สิ่งที่ต้องเตรียม (Prerequisites)

1. **ติดตั้ง Supabase CLI**
   ```bash
   npm install -g supabase
   ```

2. **Link ไปยัง Supabase Project**
   ```bash
   supabase link --project-ref cbxicbynxnprscwqnyld
   ```

---

## 🚀 ขั้นตอนการ Deploy

### 1. ใช้งาน Database Migration

**⚠️ สำคัญ: ใช้ migration ใหม่ที่รองรับฟีเจอร์ครบถ้วน**

```bash
cd supabase

# ใช้ migration script ใหม่ (Full Schema)
supabase db push

# หรือรัน SQL ผ่าน Dashboard
# เปิด: https://supabase.com/dashboard/project/cbxicbynxnprscwqnyld/sql
# Copy ไฟล์: migrations/20260315_boonyang_inventory_full.sql
# แล้ว Run
```

**ตารางใหม่ที่เพิ่มมา:**
- `botdata` - ข้อมูลสต็อกสำหรับค้นหาแบบ Exact Match (item_code, alternative_key_1, alternative_key_2)
- `inventdata` - ข้อมูลสต็อกสำหรับค้นหาแบบ Partial Match (item_name)
- `line_users` - ข้อมูลผู้ใช้แบบเต็ม (พร้อม registration fields)
- `reply_templates` - ข้อความตอบกลับหลายประเภท (text, flex, template, telegram)
- `system_settings` - ตั้งค่าระบบทุกอย่าง (bot_enabled, stock_enabled, require_approval, register_required)
- `cache_metadata` - จัดการ cache สำหรับ BotData และ InventData

### 2. ใส่ Environment Variables

สร้างไฟล์ `.env` ในโฟลเดอร์ `supabase/functions/boonyang-webhook/`:

```env
LINE_CHANNEL_TOKEN=your_line_channel_token
LINE_CHANNEL_SECRET=your_line_channel_secret
```

หรือ set ผ่าน CLI:

```bash
supabase secrets set LINE_CHANNEL_TOKEN=your_token
supabase secrets set LINE_CHANNEL_SECRET=your_secret
```

### 3. Deploy Edge Function

```bash
# จาก root directory
supabase functions deploy boonyang-webhook
```

---

## ✅ ฟีเจอร์ที่รองรับ (Full Backend Logic)

### 1. **ระบบลงทะเบียนแบบเต็ม (Complete Registration Flow)**
- ลงทะเบียน: พิมพ์ "ลงทะเบียน"
- ขั้นตอน: ชื่อ → นามสกุล → ชื่อร้าน → เลขที่ภาษี
- Flex message แสดงผลการลงทะเบียนสำเร็จ
- ติดตาม flow_status สำหรับแต่ละขั้นตอน

### 2. **ระบบค้นหาสต็อกแบบ 2 ชั้น (Two-Tier Stock Search)**
- **BotData** (Exact Match):
  - ค้นหาโดย item_code, alternative_key_1, alternative_key_2
  - แสดง LOT number และ sorting จากเก่าที่สุด
  - Stock status: >= 4 = "มีสินค้า", < 4 = "กรุณาโทรสอบถาม"

- **InventData** (Partial Match):
  - ค้นหาโดย item_name แบบ Partial/Fuzzy
  - แสดงผลเป็น Flex Carousel (12 ปุ่ม/bubble)
  - รองรับหลายรายการพร้อมกัน

### 3. **ระบบตอบกล้าอัตโนมัติ (Reply Templates)**
- **text** - ข้อความธรรมดา
- **flex** - Flex Message แบบ custom
- **template** - Template message แบบ JSON
- **telegram** - ส่ง notification ไป Telegram (พร้อมภาพ)

### 4. **ระบบบังคับใช้ (System Switches)**
- `bot_enabled` (B20) - เปิด/ปิด บอท
- `stock_enabled` (B21) - เปิด/ปิด การถามสต็อก
- `stock_require_approval` (B22) - บังคับอนุมัติสำหรับสต็อก
- `register_required` (B23) - บังคับลงทะเบียน

### 5. **คำสั่ง Admin (Admin Commands)**
- `bot on` / `bot off` - เปิด/ปิด บอท
- `stock on` / `stock off` - เปิด/ปิด การถามสต็อก
- `require on` / `require off` - เปิด/ปิด การบังคับอนุมัติ
- `approve <userId>` - อนุมัติ user เป็น customer
- `block <userId>` - บล็อก user
- `makeadmin <userId>` - ทำให้ user เป็น admin
- `/refreshcache` หรือ `/rf` - รีเฟรช cache BotData และ InventData

### 6. **สิทธิ์ผู้ใช้ (User Permissions)**
- **admin** - เข้าถึงทุกคำสั่ง และ admin commands
- **customer** - ถามสต็อกได้ (ถ้า require approval = ON)
- **ว่าง/blank** - ไม่มีสิทธิ์ (กรณี require approval = ON)

### 7. **การจัดการ Cache (Cache Management)**
- Auto-preload BotData และ InventData เมื่อเริ่มทำงาน
- TTL 30 นาที
- Manual refresh ด้วย `/refreshcache` หรือ `/rf`
- In-memory cache สำหรับ performance

### 8. **Group/Room Support**
- Group join events
- Member join/leave events
- Group info tracking
- Silent reply ใน group/room สำหรับบางกรณี

### 9. **LOT Number Processing**
- Parse LOT number (สัปดาห์ + ปี 2 หลัก)
- Sort โดยเก่าสุดก่อน (older LOT first)
- Display format: `LOT: 25024 (W02/2025)`

---

## 🧪 ทดสอบการทำงาน

### Test ด้วย cURL

```bash
curl -X POST https://cbxicbynxnprscwqnyld.supabase.co/functions/v1/boonyang-webhook \
  -H "Content-Type: application/json" \
  -H "x-line-signature: test" \
  -d '{
    "destination": "U1234567890",
    "events": [
      {
        "type": "message",
        "replyToken": "test-reply-token",
        "source": {"userId": "test-user-id"},
        "message": {"type": "text", "text": "ลงทะเบียน"},
        "timestamp": 1234567890
      }
    ]
  }'
```

### Test ด้วย LINE App

**1. ทดสอบการลงทะเบียน:**
```
- พิมพ์: ลงทะเบียน
- ใส่ชื่อ: ทดสอบ
- ใส่นามสกุล: ระบบ
- ใส่ชื่อร้าน: ร้านทดสอบ
- ใส่เลขที่ภาษี: 1234567890123
```

**2. ทดสอบการค้นหาสต็อก:**
```
- พิมพ์ SKU: 001-01-NH112-P-SIL (ค้นหาจาก BotData)
- พิมพ์ชื่อ: civic (ค้นหาจาก InventData)
- พิมพ์ keyword ที่อยู่ใน reply templates
```

**3. ทดสอบ Admin Commands (ต้องเป็น admin):**
```
- bot on / bot off
- stock on / stock off
- require on / require off
- approve u<userId>
- makeadmin u<userId>
- /rf (refresh cache)
```

---

## 📊 โครงสร้าง Database

### ตารางหลัก:

1. **line_users** - ข้อมูลผู้ใช้ LINE (พร้อม registration fields)
2. **botdata** - ข้อมูลสต็อกสำหรับ Exact Match
3. **inventdata** - ข้อมูลสต็อกสำหรับ Partial Match
4. **reply_templates** - ข้อความตอบกลับอัตโนมัติ
5. **system_settings** - ตั้งค่าระบบ
6. **cache_metadata** - จัดการ cache

### ตัวอย่าง SQL Query:

```sql
-- เพิ่มข้อมูล BotData
INSERT INTO botdata (item_code, item_name, lot_number, on_hand_quantity, alternative_key_1, alternative_key_2)
VALUES ('001-01-NH112-P-SIL', '001-01-NH112-P-SIL : CIVIC FD (06-11)', '25024', 5, 'NH112', 'CIVIC FD');

-- เพิ่มข้อมูล InventData
INSERT INTO inventdata (item_name, stock_quantity)
VALUES ('001-01-NH112-P-SIL : CIVIC FD (06-11)', 5);

-- เพิ่ม reply template
INSERT INTO reply_templates (keyword, reply_type, reply_content)
VALUES ('ราคา', 'text', '📋 กรุณาระบุ SKU หรือชื่อสินค้าที่ต้องการทราบราคา');

-- ตั้งค่าระบบ
UPDATE system_settings SET value = 'true' WHERE key = 'bot_enabled';

-- อนุมัติ user
UPDATE line_users SET userstaff = 'customer' WHERE user_id = 'U...';

-- ทำให้ user เป็น admin
UPDATE line_users SET userstaff = 'admin' WHERE user_id = 'U...';
```

---

## 🔧 การแก้ไขปัญหา

### ปัญหา: CORS Error

ถ้าเจอ CORS error ตรวจสอบว่า Edge Function มี CORS headers:

```typescript
// ใน boonyang-webhook/index.ts
if (req.method === 'OPTIONS') {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-line-signature, content-type',
    },
  });
}
```

### ปัญหา: Missing Environment Variables

ตรวจสอบ variables:

```bash
supabase secrets list
```

ตั้งค่าถ้ายังไม่มี:

```bash
supabase secrets set LINE_CHANNEL_TOKEN=your_token
supabase secrets set LINE_CHANNEL_SECRET=your_secret
```

### ปัญหา: Function ไม่ตอบสนอง

ตรวจสอบ logs:

```bash
supabase functions logs boonyang-webhook --tail
```

---

## 📝 การอัปเดต Function

หลังแก้ไขโค้ด:

```bash
# Deploy ใหม่
supabase functions deploy boonyang-webhook

# ตรวจสอบ logs
supabase functions logs boonyang-webhook --tail
```

---

## 🔐 Security Notes

1. **LINE Signature Verification**: ใน Edge Function นี้ปิดใช้งาน signature verification เพื่อความเข้ากันได้
   - หากต้องการเปิดใช้งาน ให้ตั้งค่า `LINE_CHANNEL_SECRET`

2. **Row Level Security (RLS)**: เปิดใช้งานแล้ว ตรวจสอบ policies:
   ```sql
   SELECT * FROM pg_policies WHERE tablename IN ('line_users', 'botdata', 'inventdata', 'reply_templates');
   ```

3. **Service Role Key**: อย่าแชร์ SUPABASE_SERVICE_ROLE_KEY ต่อหน้า client

4. **User Permissions**: ระบบตรวจสอบสิทธิ์อย่างละเอียด:
   - Admin commands เฉพาะ private chat
   - Stock queries ต้องได้รับอนุมัติ (ถ้าเปิด require approval)
   - Group/Room silent return สำหรับบางกรณี

---

## 📞 ติดต่อ

หากมีปัญหา:
1. ตรวจสอบ logs: `supabase functions logs boonyang-webhook --tail`
2. ตรวจสอบ database: เปิด Supabase Dashboard > Table Editor
3. ตรวจสอบ LINE settings: เปิด LINE Developers Console

---

## 🎯 ถัดไป

1. **Import Data** - Import ข้อมูลจาก Google Sheets ไป BotData/InventData
2. **Telegram Integration** - เชื่อมต่อ Telegram notifications
3. **Admin Panel** - สร้าง dashboard สำหรับจัดการ inventory และ settings
4. **Reports** - เพิ่มรายงานสต็อกและการใช้งาน
5. **Auto-cache refresh** - ตั้งเวลา auto-refresh cache ทุก 30 นาที
