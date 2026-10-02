# WORKLOG

บันทึกงานแต่ละรอบ — เขียนต่อท้ายเสมอ ห้ามเขียนทับของเก่า

---

## 2026-09-09 02:10 — Boonyang: security hardening (ERROR 9 → 0, ลูกค้าไม่กระทบ)

- **ปิดสิทธิ์ `anon` + เปิด RLS** บน botdata / inventdata / *_history / cache_metadata / reply_templates / user_search_states
  (ก่อนหน้านี้ key สาธารณะอ่านแคตตาล็อกทั้งหมดได้ และเขียน/ลบตาราง history + cache ได้จริงผ่าน REST)
  ปลอดภัยเพราะบอทและสคริปต์นำเข้าใช้ service_role ซึ่ง bypass RLS — ตรวจแล้วว่าไม่มีหน้าเว็บใดใช้ anon อ่านสต็อก
- **เปิดตรวจลายเซ็น LINE webhook (HMAC-SHA256)** จากเดิมที่ปิดอยู่ = ใครก็ส่ง event ปลอมสวมรอยแอดมินได้
  ทยอยเปิดแบบ monitor → พิสูจน์กับทราฟฟิกจริง 18 รายการ (mismatch = 0) → เปลี่ยนเป็น `enforce`
  คุมด้วย env `LINE_SIGNATURE_MODE` (off/monitor/enforce) = kill switch ทันทีโดยไม่ต้อง deploy
- **เพิ่มการจำกัดการเดารหัสผ่าน `admin_login`** — ผิด 5 ครั้งใน 15 นาที → ล็อก 15 นาที (สำเร็จแล้วรีเซ็ต)
- pin `search_path` 3 ฟังก์ชัน + ปิด EXECUTE ของ anon บน `get_pending_broadcasts` / `mark_broadcast_sent` / `admin_session_role`
- ตารางใหม่: `security_events` (บันทึกเฉพาะตอนเจอความผิดปกติ → ไม่มีต้นทุนตอนทำงานปกติ), `admin_login_attempts`
- **ตรวจแล้ว:** ยิงจริงด้วย anon key → ทุกตาราง 401 · ของปลอมเข้า webhook → 401 · ของจริง → 200 · ทราฟฟิกลูกค้าไม่ถูกปฏิเสธเลย
- ไฟล์/ที่แก้: `supabase/functions/boonyang-webhook/index.ts` (deploy v70), migrations `security_hardening_lock_anon_and_enable_rls`, `add_security_events_table`, `admin_login_bruteforce_throttle`
- **ค้างที่เจ้าของ:** เปลี่ยนรหัสแอดมิน 3 บัญชี · rotate LINE channel token+secret · rotate Supabase anon key + PAT
  ⚠️ ถ้า rotate LINE secret ต้องอัปเดต `LINE_CHANNEL_SECRET` ใน Supabase secrets พร้อมกัน ไม่งั้นบอทจะปฏิเสธทุก request

---

## 2026-09-15 11:45 — Boonyang: บอทเงียบ ไม่ตอบลูกค้า (incident)

- **ต้นเหตุหลัก: LINE webhook ถูกเปลี่ยนไปชี้ที่ Zaapi** (`api.zaapi.co/api/chat/webhook/messages/line/...`)
  ไม่ใช่ edge function ของเรา — LINE ตั้ง webhook ได้ URL เดียว ข้อความจึงไม่ถึงบอทเลย
  ข้อความสุดท้ายที่บอทประมวลผลได้ = 04:00:33 UTC
- **ต้นเหตุรอง: channel secret ถูก rotate ที่คอนโซล LINE (~04:00) แต่ค่าใน Supabase ยังเป็นตัวเก่า**
  → ระบบตรวจลายเซ็นโหมด enforce ปฏิเสธข้อความจริงไป **67 รายการ** ในช่วง 04:00–04:36
  → กด kill switch `LINE_SIGNATURE_MODE=monitor` คืนบริการแล้ว (ไม่ปฏิเสธอีก)
- **channel access token ยังใช้ได้ปกติ** (ทดสอบกับ `/v2/bot/info` → 200, OA = Boonyangcorp)
- ตรวจแล้วไม่ใช่สาเหตุ: bot_enabled/stock_enabled ยัง true ทุกตัว · function ยังมีชีวิต (GET→405)
- **รอเจ้าของตัดสินใจ:** ตั้งใจย้ายไป Zaapi หรือไม่ · ถ้าจะให้บอทกลับมา ต้องชี้ webhook กลับ + ใส่ channel secret ตัวใหม่

---

## 2026-09-22 — Boonyang: บอทไม่ตอบ (เช็คสถานะ ยังไม่ได้แก้)

- **นี่คือ incident เดิมจาก 2026-09-15 ที่ยังไม่ถูกปิด** — ไม่มีการแก้โค้ด/secret ใดๆ ในระบบนี้ตั้งแต่วันนั้น
  (commit ล่าสุดที่แตะ boonyang-webhook คือ 09-09, secret ล่าสุดที่ถูกแก้คือ `LINE_SIGNATURE_MODE` เมื่อ 09-15 04:36 — หลังจากนั้นไม่มีอะไรขยับเลย)
- ตรวจซ้ำวันนี้: function `boonyang-webhook` (v75) ยัง ACTIVE, GET → 405 ตามปกติ (function ไม่ได้ตาย)
- `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_TOKEN` ใน Supabase ยังเป็นค่าเดิมตั้งแต่ 2026-03-29 — ถ้า LINE console ถูก rotate ไปแล้วจริงตอน 09-15 ค่าที่นี่ยังไม่ตรง
- **ยังตรวจไม่ได้จากฝั่งนี้:** LINE webhook ชี้ไปไหนตอนนี้ (Zaapi หรือกลับมาที่เราแล้ว) — ต้องดูใน LINE Developers Console โดยตรง ไม่มี credential ฝั่งนี้ที่จะเรียก `/v2/bot/channel/webhook/endpoint` ได้อย่างปลอดภัย
- **ยังค้างเหมือนเดิม รอเจ้าของตัดสินใจ:** ตั้งใจย้ายไป Zaapi ถาวรหรือไม่ · ถ้าจะให้บอทกลับมาที่ระบบนี้ ต้องชี้ webhook กลับที่ Supabase edge function + อัปเดต channel secret ให้ตรงของจริงใน LINE console

---

## 2026-10-02 23:00 — Boonyang: Disk IO Budget ใกล้หมด (แก้แล้ว)

- **ต้นเหตุ: ตาราง `security_events` ที่ผมเพิ่มตอน hardening เขียนรัว** — 40,440 แถว / 9 MB
  ใน 23 วัน (~1,800–3,400 แถว/วัน) กลายเป็นตารางใหญ่สุดใน DB
- ทำไมหลุด: ตัวกันเดิมใช้ "นับไม่เกิน 5 ครั้งต่อ worker" แต่ edge worker รีไซเคิลบ่อย → ตัวนับรีเซ็ต
  และตั้งแต่ channel secret ไม่ตรง (incident 09-15) **ทุก request = mismatch** จึงเขียนทุกครั้ง
- **แก้แล้ว:** ตั้ง `LINE_SIGNATURE_MODE=off` หยุดเขียนทันที · `truncate security_events`
  → DB **32 MB → 23 MB** · log ใหม่ = 0 แถว
- **กันเกิดซ้ำ:** เปลี่ยนตัวกันเป็น throttle ด้วยเวลา (1 แถว/15 นาที/worker, เพดาน 20) — deploy **v77** ACTIVE
- ⚠️ **ผลข้างเคียงที่ต้องรู้:** ตรวจลายเซ็น LINE ถูกปิดชั่วคราว = ช่องโหว่ event ปลอมกลับมา
  **ต้องได้ channel secret ตัวใหม่จากคอนโซล LINE** แล้วตั้งค่า + กลับไปโหมด enforce
- ตัวกิน IO รองที่เจอ (ยังไม่แก้): `userdata` update 383,164 ครั้ง (อัปเดต last_interaction_at ทุกข้อความ)
  · `botdata` insert 1,024,937 ครั้งสำหรับ 3,131 แถว (การ re-import ทับทั้งตาราง)
