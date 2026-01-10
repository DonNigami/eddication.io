# 🔧 DEBUG: Extend Scene ไม่ขึ้นเมนู - วิธีแก้

## 🔍 Step 1: ตรวจสอบว่าปัญหาอะไร

### เปิด Console (F12)
```
1. คลิก Extension icon
2. กด F12 (Dev Tools)
3. ดู Console tab
4. มี error สีแดด ไหม?
```

---

## ✅ Checklist ตรวจสอบ

### ✓ Check 1: Tab Button มี ไหม
```
คลิกแถบแดด "🎬 Extend Scene" ด้านบน
- ถ้าเห็นแถบแดด = OK ✓
- ถ้าไม่เห็น = ปัญหาที่ HTML
```

### ✓ Check 2: ดูใน Console
```
F12 → Console tab
ตรวจหา error:
- "Cannot read properties of null"
- "extendSceneToggle is not found"
- "Uncaught ReferenceError"
- "workflowState"
```

### ✓ Check 3: ดู Network Tab
```
F12 → Network tab
- Reload sidebar
- ตรวจว่า js/modules/extendScene.js load ไหม
- Status ต้องเป็น 200 (OK)
- ถ้า 404 = file หาไม่เจอ
```

### ✓ Check 4: ดู HTML Structure
```
F12 → Elements tab
- Ctrl+F "extendSceneToggle"
- ถ้าเจอ = HTML OK
- ถ้าไม่เจอ = HTML ไม่เพิ่มไป
```

---

## 🐛 ปัญหาทั่วไป & วิธีแก้

### Problem 1: "Cannot read properties of null"
```
สาเหตุ: HTML elements หาไม่เจอ
แก้ไข:
1. ไปที่ sidebar.html
2. ตรวจว่า id ตรงกัน:
   - id="extendSceneToggle"
   - id="extendSceneControls"
   - id="extendCsvInput"
3. ลอง reload extension
```

### Problem 2: "extendScene.js ไม่ load"
```
ตรวจสอบ:
1. ไป chrome://extensions
2. Click "Errors" ดูเหนือ extension
3. ถ้ามี error = manifest.json มีปัญหา
4. ลอง reload extension
```

### Problem 3: Tab button มี แต่ content ไม่ขึ้น
```
สาเหตุ: HTML section หาไม่เจอ
แก้ไข:
1. F12 → Elements
2. ตรหา <div id="tab-extend-scene">
3. ถ้าไม่เจอ = ต้องเพิ่ม HTML
```

### Problem 4: Error "workflowState is not defined"
```
แก้แล้ว! (เพิ่ม safeguard ใน extendScene.js)
ลอง reload extension ใหม่:
1. chrome://extensions
2. Toggle OFF/ON extension
3. Reload sidebar
```

---

## 🛠️ วิธีแก้ทีละขั้น

### Step A: Reload Extension
```
1. ไปที่ chrome://extensions
2. หา "Eddication Flow AI"
3. Toggle OFF (ปิด)
4. โปรดรอ 2 วินาที
5. Toggle ON (เปิด)
6. Reload sidebar (F5)
```

### Step B: Clear Cache
```
1. chrome://extensions
2. Click "Clear extension data"
3. Confirm
4. Reload sidebar
```

### Step C: Check manifest.json
```
ตรวจสอบไฟล์: manifest.json

ต้องมี:
- "content_scripts" สำหรับ Google Flow
- extendScene.css ใน CSS link
- extendScene.js ใน script import

ถ้าไม่มี = ต้องเพิ่มเอง
```

### Step D: Verify HTML
```
ตรวจสอบไฟล์: sidebar.html

ต้องมี 3 อย่าง:
1. <link rel="stylesheet" href="../css/extendScene.css">
   (ในส่วน <head>)

2. <button class="tab-btn" data-tab="extend-scene">
   (ในส่วน navigation)

3. <div class="tab-content" id="tab-extend-scene">
   (ในส่วน main content)

4. <script src="../js/modules/extendScene.js"></script>
   (ก่อน </body>)

ถ้าขาด = ต้องเพิ่มเอง
```

---

## 🚀 Quick Fix Commands

### Command 1: Reload Extension
```powershell
# ใช้ DevTools เพื่อ reload
# 1. กด F12 ใน sidebar
# 2. Ctrl+Shift+J (open console)
# 3. Type: location.reload()
# 4. Press Enter
```

### Command 2: Check Console
```javascript
// Copy-paste ใน DevTools Console:

// 1. ตรวจว่า element มี ไหม
console.log(document.getElementById('extendSceneToggle'));

// 2. ตรวจว่า class load ไหม
console.log(typeof ExtendScene);

// 3. ตรวจว่า storage มี ไหม
chrome.storage.local.get(['formState'], (result) => {
  console.log('Form state:', result);
});
```

---

## 📋 Testing Steps

### Test 1: Element Exists
```javascript
// ใน DevTools Console:
const toggle = document.getElementById('extendSceneToggle');
console.log('Toggle exists:', toggle !== null);

const controls = document.getElementById('extendSceneControls');
console.log('Controls exists:', controls !== null);

const csvInput = document.getElementById('extendCsvInput');
console.log('CSV Input exists:', csvInput !== null);
```

### Test 2: Class Loaded
```javascript
// ใน DevTools Console:
console.log('ExtendScene class:', typeof ExtendScene);
console.log('Instance:', window.extendSceneInstance || 'Not created');
```

### Test 3: Event Listener Works
```javascript
// ใน DevTools Console:
const toggle = document.getElementById('extendSceneToggle');
toggle.click(); // Try clicking
console.log('Toggle checked:', toggle.checked);
```

---

## ⚠️ Common Errors & Solutions

| Error | สาเหตุ | แก้ไข |
|-------|--------|-------|
| "Cannot read null" | Element หาไม่เจอ | ตรวจ HTML id |
| "workflowState undefined" | Other script error | Reload extension |
| "extendScene.js 404" | File หาไม่เจอ | ตรวจ path |
| "Tab not responding" | JS error | ตรวจ console |
| "Checkbox not working" | Event listener fail | Reload page |

---

## 📞 If Still Not Working

### Option 1: Re-add Files
```
1. ตรวจว่าไฟล์อยู่:
   - js/modules/extendScene.js
   - content/platforms/googleFlow.js
   - css/extendScene.css

2. ถ้าไม่มี = ต้องสร้างใหม่
```

### Option 2: Re-add HTML
```
1. ไป html/sidebar.html
2. ตรหา "extend-scene"
3. ถ้าไม่เจอ = ต้องเพิ่มใหม่
```

### Option 3: Reset Extension
```
1. Uninstall extension (trash icon)
2. Reload page
3. Load unpacked ใหม่
```

---

## 🧪 Manual Test

### Test in Console:
```javascript
// Run ทีละอันใน console:

// 1. Check if module loaded
typeof ExtendScene

// 2. Try creating instance
const extend = new ExtendScene();

// 3. Check elements
extend.toggle
extend.csvInput
extend.startBtn

// 4. Check storage
chrome.storage.local.get(null, console.log)

// 5. Simulate toggle
if (extend.toggle) extend.toggle.click()
```

---

## 📝 Summary

ถ้า menu ยังไม่ขึ้น ให้ทำตามนี้:

```
1️⃣  เปิด F12 ตรวจ Console หา error
2️⃣  Reload extension (chrome://extensions)
3️⃣  ตรวจ HTML มีครบไหม (sidebar.html)
4️⃣  ตรวจ JS load ไหม (network tab)
5️⃣  ตรวจ element exist ไหม (console test)
6️⃣  ถ้ายังไม่ได้ → report error ให้เห็น
```

---

**ลองตามขั้นตอนข้างต้นแล้วบอกว่า console error เป็นอะไร** 🔍
