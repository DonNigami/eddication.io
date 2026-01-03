# 🔄 Hard Reload Extension - Fix Cache Issue

## ขั้นตอน

### 1. เปิด Chrome Extensions Page
```
chrome://extensions/
```

### 2. หา "Eddication Flow AI"
- ค้นหา Eddication Flow AI จากรายการ extensions

### 3. Hard Reload
**ตัวเลือก A: ใช้ปุ่ม Reload**
- เปลี่ยนเป็น **Developer mode** (มุมบนขวา)
- คลิกปุ่ม **Reload** (ไอคอน circular arrows) ของ Eddication Flow AI

**ตัวเลือก B: ปิด-เปิด Extension**
1. Toggle off (ปิด) extension
2. รอ 2 วินาที
3. Toggle on (เปิด) extension

**ตัวเลือก C: ลบและติดตั้งใหม่**
- คลิก **Remove** button
- ปิด Chrome
- เปิด Chrome
- ติดตั้ง extension ใหม่

### 4. เปิด Extension Popup
- คลิกไอคอน Eddication Flow AI ที่หน้า toolbar
- ตรวจสอบ console สำหรับ logs

## ตรวจสอบว่าแก้ไขแล้ว

### ใน Console ของ Extension:
```javascript
// Right-click extension icon → Inspect popup
// จะเห็นหน้า Console แสดงลอง logs
```

### ควรเห็น Logs:
```
[FlowAI] DOM Content Loaded - Initializing app...
[FlowAI] initApp() starting...
[FlowAI] Setting up tabs...
[FlowAI] ✓ Tabs setup complete
[FlowAI] Setting up header buttons...
[FlowAI] ✓ All header buttons setup complete ✓✓✓
[FlowAI] Setting up settings modal...
[FlowAI] ✓ Settings modal setup complete
[FlowAI] Flow AI v4.0 (Eddication) initialized successfully
```

## ถ้าเจอ Error อีก

1. **Ctrl+Shift+Del** → Clear browsing data
   - ✓ Cookies and other site data
   - ✓ Cached images and files
   - Click **Clear data**

2. ไปที่ `chrome://extensions/`
3. ปิด-เปิด Eddication Flow AI extension

4. หากยังมี Error:
   - ไปที่ extension page
   - คลิก **Service Worker** link
   - ตรวจสอบ console log
   - ค้นหา `response` หรือ `SyntaxError`

## Note
- Cache issue เป็นเรื่องปกติหลัง code update
- Hard reload ล้างโค้ดเก่าออก
- ปกติแล้วทำงานได้หลังจากรีโหลด
