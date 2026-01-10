# 🔍 DEBUG: Extend Scene Tab ขึ้นแต่ Content ว่าง

## วิธีแก้แบบ Step-by-Step

### 🧪 Step 1: Open DevTools
```
กด F12 เพื่อเปิด DevTools
ไป Console tab
```

### 🧪 Step 2: Click Extend Scene Tab
```
ใน sidebar ด้านขวา
คลิก "🎬 Extend Scene" tab

ตรวจดู Console:
ควรเห็น:
[FlowAI] Switching to tab: extend-scene
[FlowAI] Tab button active: 🎬 Extend Scene
[FlowAI] Tab content active: tab-extend-scene
```

---

## 📋 ถ้า Console ไม่แสดง log:

### A. ตรวจว่า setupTabs run ไหม
```javascript
// ใน Console พิมพ์:
document.querySelectorAll('.tab-btn')

ควรเห็น NodeList with 5 items:
1. AI Reviews
2. AI Story
3. TikTok
4. คลังสินค้า
5. 🎬 Extend Scene
```

### B. ตรวจว่า click listener attached ไหม
```javascript
// ใน Console พิมพ์:
const extendBtn = Array.from(document.querySelectorAll('.tab-btn'))
  .find(btn => btn.dataset.tab === 'extend-scene');

console.log('Button found:', extendBtn);
console.log('Has click handler:', extendBtn ? 'Yes' : 'No');

// Try clicking manually
extendBtn.click();
```

---

## 🔍 ถ้า Tab Content ยังว่างเปล่า:

### Check: CSS ว่าอยู่ไหม
```javascript
// ใน Console พิมพ์:
const tabContent = document.getElementById('tab-extend-scene');
console.log('Tab content found:', tabContent);
console.log('Classes:', tabContent.className);
console.log('Display style:', getComputedStyle(tabContent).display);
```

### Check: HTML Content มีไหม
```javascript
// ใน Console พิมพ์:
const tabContent = document.getElementById('tab-extend-scene');
console.log('Content length:', tabContent?.innerHTML?.length);
console.log('First child:', tabContent?.firstChild?.tagName);
```

---

## 🛠️ Manual Fix

### Option 1: Force Show (Testing)
```javascript
// ใน Console พิมพ์:
document.getElementById('tab-extend-scene').style.display = 'block';
document.getElementById('tab-extend-scene').classList.add('active');
```

### Option 2: Trigger Switch Tab
```javascript
// ใน Console พิมพ์:
// ถ้า sidebar มี instance:
if (window.sidebar) {
  window.sidebar.switchTab('extend-scene');
}
```

---

## 📊 Complete Diagnostic

```javascript
// Copy-paste ทั้งหมดใน Console:

console.log('=== EXTEND SCENE DEBUG ===');

// 1. Check buttons
const buttons = document.querySelectorAll('.tab-btn');
console.log('Tab buttons:', buttons.length);
const extendBtn = Array.from(buttons).find(b => b.dataset.tab === 'extend-scene');
console.log('Extend button found:', !!extendBtn);

// 2. Check content
const content = document.getElementById('tab-extend-scene');
console.log('Tab content found:', !!content);
console.log('Tab content HTML length:', content?.innerHTML?.length);

// 3. Check styles
if (content) {
  const styles = getComputedStyle(content);
  console.log('Display:', styles.display);
  console.log('Classes:', content.className);
}

// 4. Try clicking
if (extendBtn) {
  console.log('Clicking button...');
  extendBtn.click();
  
  // Check result
  setTimeout(() => {
    if (content) {
      console.log('After click - Display:', getComputedStyle(content).display);
      console.log('After click - Classes:', content.className);
    }
  }, 100);
}

console.log('=== END DEBUG ===');
```

---

## 🚨 ถ้า Console แสดง Error:

### Error 1: "Cannot read properties of null"
```
สาเหตุ: Element หาไม่เจอ
แก้: เช็ค HTML ว่ามี id ที่ถูกต้อง
```

### Error 2: "document.getElementById is not a function"
```
สาเหตุ: Conflict with other script
แก้: Reload extension ใหม่
```

### Error 3: "Cannot find 'extend-scene' in tab"
```
สาเหตุ: data-tab attribute ไม่ตรง
แก้: ตรวจ HTML button data-tab="extend-scene"
```

---

## ✅ Success Indicators

✅ Console ไม่มี error (สีแดด)  
✅ "[FlowAI] Switching to tab: extend-scene" ปรากฏ  
✅ Tab content display = "block"  
✅ Tab content classList มี "active"  
✅ Content ไม่ว่างเปล่า  

---

## 🎯 Final Test

ถ้าทุกอย่าง OK:

```javascript
// ใน Console:
document.getElementById('tab-extend-scene').querySelector('.section-header')?.textContent
// ควรเห็น: "🎬 Extend Scene (Google Flow)"
```

---

**ลองตามขั้นตอนแล้วรีพอร์ต Console output ที่เห็นครับ** 🔍
