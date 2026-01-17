# 🔍 LINE Profile Not Loading - Debug Steps

**Issue:** หน้าไม่ดึง profile LINE  
**Date:** 2026-01-17 04:03 AM  

---

## 🚨 สาเหตุหลัก (ที่พบบ่อยที่สุด)

### ✅ คุณเปิดในเบราว์เซอร์ธรรมดา (Chrome/Firefox) ไม่ใช่ LINE App

**นี่คือสาเหตุ 99% ที่ไม่ดึง LINE profile ได้!**

```
❌ เปิดไฟล์โดยตรง: file:///D:/path/index-supabase.html
❌ เปิดใน Chrome/Firefox: http://localhost/...
❌ เปิดใน browser ธรรมดา: https://your-site.com/...

✅ เปิดใน LINE app: https://liff.line.me/2007705394-Fgx9wdHu
```

---

## 🧪 วิธีทดสอบแบบละเอียด

### Step 1: ใช้ Debug Tool

**เปิดไฟล์นี้ก่อน:**
```
liff-debug-tool.html
```

**จะบอกคุณว่า:**
1. เปิดใน LINE app หรือ browser ธรรมดา
2. LIFF SDK โหลดหรือไม่
3. LIFF initialized หรือไม่
4. Logged in หรือไม่
5. Profile data (ถ้ามี)
6. Error messages (ถ้ามี)

---

### Step 2: ตรวจสอบ Console ใน index-supabase.html

**เปิด index-supabase.html แล้วดู Console (F12):**

```javascript
// ควรเห็น logs เหล่านี้:
🔄 Initializing LIFF with ID: 2007705394-Fgx9wdHu
✅ LIFF initialized
📱 Is in LINE client: false  // ถ้าเปิดใน browser ธรรมดา
🧪 Not in LINE client - using test mode

// หรือ (ถ้าเปิดใน LINE app):
🔄 Initializing LIFF with ID: 2007705394-Fgx9wdHu
✅ LIFF initialized
📱 Is in LINE client: true   // ถ้าเปิดใน LINE app
🔐 Is logged in: true
👤 User Profile: { userId: "...", displayName: "..." }
```

---

## 📋 Checklist - ทำทีละขั้นตอน

### ✅ Check 1: คุณเปิดอย่างไร?

```
□ เปิดไฟล์โดยตรงจาก Windows Explorer (double-click)
   → ❌ ใช้ไม่ได้! เพราะเป็น file:/// protocol

□ เปิดใน Chrome/Firefox ธรรมดา
   → ❌ ไม่ได้ profile แต่ใช้ test mode ได้

□ เปิดใน LINE app ผ่าน LIFF URL
   → ✅ ถูกต้อง! จะได้ profile
```

**วิธีที่ถูก:**
```
1. Upload ไฟล์ไปยัง hosting (Railway, Vercel, GitHub Pages)
2. ตั้งค่า LIFF Endpoint URL
3. เปิดใน LINE app: https://liff.line.me/2007705394-Fgx9wdHu
```

---

### ✅ Check 2: Hosting แล้วหรือยัง?

**LIFF ต้องใช้ HTTPS hosting ไม่สามารถใช้ file:// หรือ localhost ได้**

```
□ ยังไม่ได้ upload → ต้อง upload ก่อน
□ Upload แล้วแต่เป็น HTTP (ไม่ใช่ HTTPS) → ต้องเป็น HTTPS
□ Upload แล้วเป็น HTTPS → ✅ OK
```

**Hosting ที่แนะนำ (ฟรี):**
- Railway.app
- Vercel.com
- Netlify.com
- GitHub Pages (pages.github.com)

---

### ✅ Check 3: LIFF Endpoint URL ตั้งแล้วหรือยัง?

**ไปที่ LINE Developers Console:**
```
https://developers.line.biz/console/
→ Select Channel
→ LIFF tab
→ LIFF ID: 2007705394-Fgx9wdHu
→ Endpoint URL: ต้องเป็น HTTPS URL ของ hosting
```

**ตัวอย่าง Endpoint URL:**
```
✅ https://myapp.railway.app/PTGLG/driverconnect/driverapp/index-supabase.html
✅ https://myapp.vercel.app/index-supabase.html
✅ https://username.github.io/repo/index-supabase.html

❌ http://localhost:3000/index-supabase.html
❌ file:///D:/path/index-supabase.html
```

---

### ✅ Check 4: LIFF URL ใช้ถูกหรือไม่?

**LIFF URL format:**
```
https://liff.line.me/[LIFF-ID]
```

**สำหรับคุณ:**
```
https://liff.line.me/2007705394-Fgx9wdHu
```

**วิธีเปิด:**
1. Copy URL ข้างบน
2. ส่งให้ตัวเองใน LINE (Keep notes)
3. คลิกลิงก์ใน LINE app
4. ควรเห็นหน้า Driver App

---

## 🔧 Quick Fix - Test Locally First

### ถ้าอยากทดสอบก่อนโดยไม่ต้อง upload:

**1. ใช้ ngrok (expose localhost เป็น HTTPS)**
```bash
# Install ngrok
npm install -g ngrok

# Run local server
python -m http.server 8000

# In another terminal
ngrok http 8000

# Copy HTTPS URL (example: https://abc123.ngrok.io)
# Set as LIFF Endpoint URL
# Open: https://liff.line.me/2007705394-Fgx9wdHu
```

**2. หรือใช้ VS Code Live Server + ngrok**
```bash
1. Install VS Code extension: Live Server
2. Right-click index-supabase.html → Open with Live Server
3. Run: ngrok http 5500
4. Copy HTTPS URL
5. Set as LIFF Endpoint URL
```

---

## 📊 Expected Behavior

### Scenario 1: เปิดในเบราว์เซอร์ธรรมดา (Chrome/Firefox)
```
Status text: "🧪 กำลังใช้งานแบบทดสอบ (ไม่ได้อยู่ใน LINE)"
Console: "📱 Is in LINE client: false"
Console: "🧪 Not in LINE client - using test mode"
Profile: ❌ ไม่ได้
Test mode: ✅ ใช้งานได้
```

### Scenario 2: เปิดใน LINE app (correct setup)
```
Status text: "✅ สวัสดี [Your Name]"
Console: "📱 Is in LINE client: true"
Console: "🔐 Is logged in: true"
Console: "👤 User Profile: {...}"
Profile: ✅ ได้
```

### Scenario 3: เปิดใน LINE app (not logged in)
```
Status text: "⚠️ กรุณาเข้าสู่ระบบ LINE"
Console: "📱 Is in LINE client: true"
Console: "🔐 Is logged in: false"
Profile: ❌ ไม่ได้
→ ต้อง login ก่อน (จะมี login screen)
```

---

## 🎯 Complete Setup Flow

### Step 1: Upload to Hosting

**Option A: Railway**
```bash
1. Go to railway.app
2. New Project > Deploy from GitHub
3. Connect repository
4. Deploy
5. Copy URL: https://xxx.railway.app
```

**Option B: Vercel**
```bash
1. Go to vercel.com
2. Import Git Repository
3. Select folder
4. Deploy
5. Copy URL: https://xxx.vercel.app
```

---

### Step 2: Set LIFF Endpoint

```bash
1. Go to: https://developers.line.biz/console/
2. Select your channel
3. LIFF tab
4. Find LIFF ID: 2007705394-Fgx9wdHu
5. Click Edit
6. Set Endpoint URL:
   https://xxx.railway.app/PTGLG/driverconnect/driverapp/index-supabase.html
7. Save
```

---

### Step 3: Test in LINE

```bash
1. Open LINE app on your phone
2. Send this to yourself (Keep notes):
   https://liff.line.me/2007705394-Fgx9wdHu
3. Click the link
4. Should see: "✅ สวัสดี [Your Name]"
```

---

## 🚨 Common Mistakes

### ❌ Mistake 1: Opening file directly
```
Double-click index-supabase.html
→ Opens as: file:///D:/path/index-supabase.html
→ LIFF won't work with file:// protocol
```

### ❌ Mistake 2: Using localhost
```
http://localhost:8000/index-supabase.html
→ LIFF needs HTTPS (not HTTP)
→ LIFF needs public URL (not localhost)
```

### ❌ Mistake 3: Wrong LIFF URL
```
Opening: https://your-site.com/index-supabase.html
Instead of: https://liff.line.me/2007705394-Fgx9wdHu
→ Must use liff.line.me URL to get LINE profile
```

### ❌ Mistake 4: Endpoint URL not set
```
LIFF Endpoint URL: (empty)
→ LIFF won't work
→ Must set Endpoint URL in LINE Developers Console
```

---

## 📝 What to Send Me

**ถ้ายังไม่ work ส่งข้อมูลนี้มา:**

### 1. Console Output
```
เปิด F12 > Console
Copy ทั้งหมด (especially lines with 🔄, ✅, ❌, 📱, 🔐, 👤)
```

### 2. How You're Opening
```
□ Double-click file (file://)
□ Local server (http://localhost:...)
□ Hosting (https://...)
□ LINE app (https://liff.line.me/...)
```

### 3. Debug Tool Results
```
เปิด liff-debug-tool.html
Click "Initialize LIFF"
Screenshot หรือ copy logs
```

### 4. LINE Console Settings
```
LIFF ID: ?
Endpoint URL: ?
Status: Published/Draft?
```

---

## 💡 TL;DR (สรุปสั้นๆ)

**คุณต้องทำ 3 ขั้นตอนนี้เท่านั้น:**

```
1. Upload ไฟล์ไปยัง hosting (Railway/Vercel/etc.)
   → https://your-app.railway.app/index-supabase.html

2. ตั้ง LIFF Endpoint URL ใน LINE Console
   → https://developers.line.biz/console/

3. เปิดใน LINE app
   → https://liff.line.me/2007705394-Fgx9wdHu
```

**ถ้าไม่ทำ 3 ขั้นตอนนี้ = จะไม่ได้ LINE profile!**

---

**ส่ง Console output มาให้ฉันดูครับ!** 🔍

