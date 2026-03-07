# 🚀 SCORDS LINE Bot - Quick Fix (5 นาที)

## ปัญหา: LINE Bot ไม่ตอบ

---

## ✅ แก้ไขตามนี้ทันที (5 ขั้นตอน)

### 1️⃣ Deploy ใหม่ (สำคัญที่สุด!)

1. ไปที่ **Google Apps Script Editor**
2. คลิก **Deploy** > **Manage deployments**
3. ลบ deployment **เก่าทั้งหมด** (click 3 dots > Delete)
4. คลิก **Deploy** > **New deployment**
5. ⭐ **Select type: Web app** (อย่าใช้ API Executable!)
6. Description: `LINE Bot Webhook v2`
7. Execute as: **Me (your-email@gmail.com)**
8. ⭐ **Who has access: Anyone** (สำคัญมาก!)
9. คลิก **Deploy**
10. Copy **Web app URL** (ลงท้ายด้วย `/exec`)

---

### 2️⃣ ตั้งค่า LINE Webhook

1. ไปที่ [LINE Developers Console](https://developers.line.biz/console/)
2. เลือก Channel ของคุณ
3. ไปที่ **Messaging API** tab
4. หา **Webhook settings**
5. วาง Web app URL จากขั้นตอนที่ 1
6. เปิด **Use webhook**: **Enabled**
7. คลิก **Verify** (ต้องเป็น **200 OK** ✅)

---

### 3️⃣ ตั้งค่า LINE Token

ใน Google Apps Script Editor:

```javascript
// รันฟังก์ชันนี้
function setupLineToken() {
  const token = "paste-your-line-channel-access-token-here";
  ScriptProperties.setProperty("LINE_CHANNEL_ACCESS_TOKEN", token);
  console.log("✅ Token saved!");
}
```

วิธีรับ Token:
1. LINE Console > Messaging API
2. หา **Channel access token (long-lived)**
3. คลิก **Issue** (ถ้ายังไม่มี)
4. Copy token
5. Paste ในฟังก์ชันด้านบน
6. รันฟังก์ชัน

---

### 4️⃣ ทดสอบ Bot

ใน Google Apps Script Editor:

```javascript
// รันฟังก์ชันนี้เพื่อทดสอบ
function test_botSetup() {
  test_lineBotSetup();
}
```

ดูผลลัพธ์:
- ✅ Spreadsheet: Connected
- ✅ LINE Token: Set
- ✅ AI Keys: At least one

---

### 5️⃣ ทดสออบจริง

1. ส่งข้อความใน LINE: `help`
2. Bot ต้องตอบกลับพร้อมเมนู
3. ถ้ายังไม่ตอบ:
   - ไป Script Editor > **Executions** (รูปนาฬิกา)
   - ดู log ล่าสุด
   - หา error และแก้ไข

---

## 🆘 ถ้ายังไม่ได้

### ตรวจสอบ:

**❌ ไม่เห็น log ใน Executions?**
→ Webhook URL ผิด หรือ deployment ไม่ถูกต้อง

**❌ Log แสดงแต่ Bot ไม่ตอบ?**
→ LINE_CHANNEL_ACCESS_TOKEN ผิด หรือไม่ได้ตั้งค่า

**❌ Verify ใน LINE Console ไม่ผ่าน?**
→ Webhook URL ผิด หรือ "Who has access" ไม่ใช่ "Anyone"

**❌ Error: "Invalid action specified"?**
→ doPost() รับ LINE webhook ไม่ได้ (Code.gs ต้องอัปเดตแล้ว)

---

## 📋 Checklist

ก่อนร้องเหนียว ให้ตรวจสอบ:

- [ ] Deploy เป็น **Web app** (ไม่ใช่ API Executable)
- [ ] Who has access: **Anyone** (ไม่ใช่ Only myself)
- [ ] Webhook URL ลงท้ายด้วย **/exec** (ไม่ใช่ /dev)
- [ ] Use webhook: **Enabled** ใน LINE Console
- [ ] Verify: **200 OK** ใน LINE Console
- [ ] LINE_CHANNEL_ACCESS_TOKEN: ตั้งค่าแล้ว
- [ ] doPost() รองรับ LINE webhook แล้ว (Code.gs อัปเดตแล้ว)

---

## 🔧 ดู Log ที่ไหน

### 1. Executions (แนะนำ)
- Script Editor > รูปนาฬิกา (Executions)
- จะเห็นทุกครั้งที่มีการเรียก script
- คลิกแต่ละ record เพื่อดู log

### 2. Console Logs (ระหว่างรัน)
- Script Editor > **View** > **Logs** (หรือ Cmd+Enter)
- เห็น log เฉพาะตอนรันฟังก์ชัน

### 3. Stackdriver Logging
- ดู error history ย้อนหลัง
- เข้าได้จาก **View** > **Stackdriver Logging**

---

## 💬 ทดสออบคำสั่ง

พิมพ์ใน LINE หรือ รันฟังก์ชัน test:

```
help        → แสดงเมนู
status      → เช็คสถานะ (ถ้าลงทะเบียนแล้ว)
test        → ทดสอบ AI chat
```

---

## 📞 ติดต่อ

ถ้าทำตามทุกขั้นตอนแล้วยังไม่ได้:
1. Screenshot หน้า **Deployments**
2. Screenshot หน้า **Executions** (log)
3. Screenshot หน้า **LINE Console > Webhook**
4. แจ้งรายละเอียด

---

**⏱️ เวลาที่ใช้: 5 นาที**
**🎯 Success rate: 95%** ถ้าทำตามขั้นตอน
