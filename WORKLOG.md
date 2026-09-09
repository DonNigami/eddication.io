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
