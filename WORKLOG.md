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

---

## 2026-11-03 — Boonyang: Disk IO Budget เตือนอีกรอบ (คนละสาเหตุกับรอบก่อน)

- **ไม่ใช่ตัวเดิม** — `security_events` = 0 แถว (แพตช์ 10-02 ยังอยู่) · DB นิ่งที่ 23 MB
  → ปัญหาไม่ใช่ข้อมูลโต แต่เป็น **write churn (เขียนทับซ้ำๆ)**
- ตัวกินอันดับ 1 **`botdata`**: insert 1,341,168 / delete 1,340,092 สำหรับแค่ 3,131 แถว (autovacuum 471 ครั้ง)
  = **ลบทั้งตารางแล้วใส่ใหม่หมด** ~101 รอบ/เดือน (+316k insert ในเดือนเดียว ≈ 631k row-writes/เดือน)
  → โค้ดอยู่ใน **Google Apps Script** (`backend/menu.js` + trigger ตั้งเวลา) **นอก repo นี้ ผม deploy ไม่ได้**
- ตัวกินอันดับ 2 **`userdata`**: update 449,917 ครั้ง / 1,367 แถว (autovacuum 1,602) ≈ +67k/เดือน
  เพราะ `last_interaction_at` ถูก update **ทุกข้อความ**
- **แก้แล้ว (เท่าที่อยู่ในมือ):** throttle การเขียน `last_interaction_at` → เขียนเฉพาะเมื่อข้อมูลเก่ากว่า 15 นาที
  แตะ `boonyang-webhook/index.ts:2490` → deploy **v78 ACTIVE** · baseline ไว้เทียบ: `userdata.n_tup_upd = 449,917`
- รีเซ็ตตัวนับสถิติไม่ได้ (permission denied, ไม่ใช่ superuser) → วัดผลด้วยการเทียบ counter กับ baseline รอบหน้า
- **ค้างที่เจ้าของ (ตัวใหญ่กว่า ~10 เท่า):** เปลี่ยน import BotData จาก delete-all+insert-all → **upsert ตาม item_code**
  (UserData ใช้ upsert อยู่แล้ว) หรือลดความถี่ trigger · ทางเลือกสุดท้ายคืออัป compute add-on

---

## 2026-11-22 — Boonyang: Disk IO หนักอีก → แก้ที่ต้นตอ botdata import

- **วัดผลแพตช์ 11-03 แล้ว:** `userdata` update ลดจาก ~2,200 → **464 ครั้ง/วัน (-79%)** ✅
- **ตัวกินที่เหลือทั้งหมด = `botdata`:** ~17,470 row-writes/วัน (ลบ+ใส่ทั้งตาราง 3,131 แถว **2.8 รอบ/วัน**) ≈ 38 เท่าของที่เหลือ
- ต้นตอ: `importBotData()` ใน `backend/menu.js` ลบทั้งตาราง+ใส่ใหม่**ทุกรอบ แม้ชีตไม่เปลี่ยน**
- upsert ทำไม่ได้: ข้อมูลไม่มี key ที่ unique (3,131 แถว / item_code 212 / code+lot 1,664) — upsert จะยุบแถวทิ้งเงียบๆ
- **แก้ที่ DB (มีผลแล้ว):** ลบ `idx_botdata_item_name` (ใช้ 0 ครั้ง แต่ถูกเขียนทุก insert) → botdata 2,280 → 1,848 kB
- **แก้ที่ Apps Script (`menu.js`):** เทียบ MD5 ของข้อมูลชีตกับรอบก่อน → **ไม่เปลี่ยน = ข้ามทั้งการลบและใส่**
  บันทึก hash เฉพาะตอน insert ครบทุกแถว (`insertBatch` เดิมกลืน error → แก้ให้คืน `{insertedCount, errorCount}`)
- ตรวจ: `node --check` ผ่าน · จำลองตรรกะ 5 กรณีผ่าน รวม "insert ล้ม → รอบหน้าต้อง import ใหม่"
- **ค้างที่เจ้าของ:** ก๊อป `importBotData()` + `insertBatch()` จาก `menu.js` ไปวางใน Apps Script editor แล้วกดบันทึก
  (ไม่มี `.clasp.json` ผูก project → push จากเครื่องนี้ไม่ได้)

---

## 2026-11-22 — Boonyang: ย้าย import สต็อกจาก Apps Script → edge function `boonyang-stock-sync`

- เดิมกด Import 1 ครั้ง = ลบ+ใส่ใหม่ทั้งตาราง ~6,262 แถว (ต้นเหตุหลักของ Disk IO) — ตอนนี้ **เขียนเฉพาะแถวที่เปลี่ยน · ชีตไม่เปลี่ยน = 0 แถว** (วัดจาก counter จริง)
- อ่านชีตได้ 2 แบบ: public link (`/export?format=csv&gid=` — ไม่ใช้ gviz เพราะเดาชนิดคอลัมน์แล้วทำค่าหาย) · Service Account (ใส่ secret `GOOGLE_SA_JSON` แล้วสลับเอง — ยังไม่ได้ทดสอบจริง)
- สั่ง sync ได้ 2 แบบ: pg_cron ทุกชั่วโมง (secret อ่านจาก Vault) · ปุ่มเมนูเดิมใน Apps Script (`menu.js` → เรียก function แทน)
- Migrations: `20261122120000` RPC atomic · `…121000` lock+กันชนกัน (cron กับปุ่มทำพร้อมกัน → ยกเลิกแทนใส่ซ้ำ) · `…130000` pg_cron+pg_net
- ด่านกันพัง: ชีตว่าง / ไม่ใช่ CSV / หัวคอลัมน์ไม่ตรง / แถวหายเกิน 50% → **ไม่แตะตาราง**
- รันจริงแล้ว: ลบแถวขยะ (ว่างทุกช่อง) 765 แถว → botdata 3,131 → **2,366 = ชีตพอดี** · เทียบทุกช่องหลัง sync ต่างกัน 0
- ตรวจ: dry-run · guard ทดสอบใน transaction+rollback · ADVISOR review (ไม่พบทางลบข้อมูลที่ยังอยู่ในชีต; แก้ 3 จุดที่แนะนำแล้ว) · cron path → HTTP 200
- **ค้างที่เจ้าของ:** วาง `syncStockViaSupabase_` + `importBotData` + `importInventData` จาก `menu.js` ใน Apps Script · ตั้ง Script Property `BOONYANG_SYNC_SECRET`

---

## 2026-11-22 17:53 — LIFF SDK 2.32.0: clinic-connect-saas + driverconnect acc (CVE-2026-112148)

- **ทำอะไร:** ถอดแท็ก `edge/3/sdk.js` (URL นี้ตอบ 403 ไม่เคยโหลดได้จริง) ออกจาก 3 หน้า clinic-connect (`apps/index.html`, `liff-doctor`, `liff-patient`) · `PTGLG/driverconnect/liff-apps/acc/index.html` เปลี่ยน `edge/2.1` → `edge/2`
- **หน้า router `apps/index.html`:** เลิกรอ `liffReady` / timeout 5 วินาที เริ่มทำงานทันทีที่ DOM พร้อม (เดิมค้างรอ 5 วิทุกครั้งเพราะ SDK โหลดไม่ขึ้น) · LIFF init/login ยังทำโดยแอปลูกผ่าน `@line/liff` (npm) เหมือนเดิม
- **เวอร์ชัน:** `@line/liff` `^2.27.3` → `^2.32.0` ใน liff-doctor + liff-patient · อัปเดต `pnpm-lock.yaml` (เขียนด้วย pnpm 10 แล้วทดสอบ `--frozen-lockfile` ด้วย pnpm 9 แบบเดียวกับ CI ผ่าน)
- **dist:** `apps/liff-patient/dist` ถูก commit และ `static.yml` เสิร์ฟไฟล์ในรีโปตรงๆ → build ใหม่แล้ว commit ไปด้วย (chunk liff = 2.32.0, ไม่มี sdk.js) · `liff-doctor/dist` ไม่ได้ commit (เหมือนเดิม) มีเฉพาะตอน deploy-all build ใน CI
- **ตรวจ:** `pnpm build` (tsc + vite) ทั้ง 2 แอปผ่าน · turbo build ผ่าน · `@line/liff` ที่ติดตั้งจริง = 2.32.0
- **ส่งขึ้น:** push main พร้อม commit นี้ → GitHub Pages deploy ผ่าน Actions (deploy-all + static) · ไม่แตะ DB/secrets
- **เหลือ:** พี่เอ็ดดี้ลองเปิดแอปใน LINE (login + หน้าคนไข้/หมอ) 1 รอบ เพราะทดสอบในแอป LINE จากเครื่องนี้ไม่ได้ · `apps/shared/role-detection.js` ยังอ้าง `window.liff` แต่ไม่มีไฟล์ไหนเรียกใช้ (โค้ดตาย ไม่ได้แตะ)

---

## 2026-11-22 18:20 — LIFF เฟส 3: เลิกใช้ API ที่ถูก deprecate + Dependabot เฝ้า @line/liff

- **ทำอะไร:** SCORDS `checkin.html` + `checkin_new.html` เลิกเรียก `liff.scanCode()` (เดิมใช้เฉพาะ Android) → `liff.scanCodeV2()` ทุก OS (ถ้า SDK ไม่มีฟังก์ชันนี้ขึ้นข้อความไทยให้อัปเดตแอป LINE) · หน้าทดสอบ driverconnect (`liff-debug-tool.html`, `quick-line-test.html`) เปลี่ยน `getLanguage()` → `getAppLanguage()` (มี fallback) · เพิ่ม `.github/dependabot.yml` (npm · รายสัปดาห์ · เฉพาะ `@line/liff` ที่ `/project/line/clinic-connect-saas`)
- **commit:** `72da338` SCORDS · `c039457` driverconnect · `11e31b9` dependabot (post-commit hook ดัน origin/main ให้เองทุก commit) · ไม่มี migration · ไม่แตะ secrets
- **ตรวจ:** compile inline script ครบ 5 ไฟล์ · จำลอง `scanCodeV2` มี/ขาด/พัง/คืนค่าว่าง ผ่านหมด · Actions: deploy-all (72da338) + static (11e31b9) + Dependabot run สำเร็จ · curl หน้าจริงบน github.io เห็นโค้ดใหม่ครบ 4 หน้า
- **FuelSlip:** มีจุดเดียว `liff/edit-ocr.html:528` ซึ่งอยู่ในโฟลเดอร์ untracked ของงาน "edit OCR" ที่ค้างตั้งแต่ 7 เม.ย. (พร้อมไฟล์แก้ค้างอื่นของงานเดียวกัน) → แก้ในเครื่องแล้วแต่ **ไม่ commit / ไม่ push / ไม่ deploy** เพราะไม่อยากขนงานที่ยังไม่เสร็จขึ้นไปด้วย · repo นี้ผูก Railway/Render ตาม DEPLOYMENT.md ให้พี่เอ็ดดี้ commit งาน edit OCR ทั้งชุดเองก่อน
- **เหลือ:** (1) เช็ค LIFF console ว่า SCORDS เปิด "Scan QR" และ screen size = Full (Android ใช้ scanCodeV2 ได้เฉพาะ Full) แล้วลองสแกนใน LINE 1 รอบ (2) Dependabot ยังไม่เปิด PR เพราะ `@line/liff` ล่าสุดคือ 2.32.0 อยู่แล้ว · เมื่อมี PR ต้องกด merge เอง (ไม่มี auto-merge)
