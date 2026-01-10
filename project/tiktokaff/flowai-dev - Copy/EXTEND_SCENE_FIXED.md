# ✅ Extend Scene - ทำงานแล้ว! (Fixed)

## 🎉 แก้ไขเสร็จแล้ว

ปัญหา: Tab content ไม่แสดง (hidden by default)
วิธีแก้: เพิ่ม `display: none;` style เพื่อให้ tab system จัดการการแสดง/ซ่อน

---

## 🧪 ทดสอบวิธี

### Step 1: Reload Extension
```
1. chrome://extensions
2. Toggle OFF/ON extension
3. Reload sidebar (F5)
```

### Step 2: Click Extend Scene Tab
```
ด้านบนขวา ของ sidebar
ดูหมวดต่างๆ:
- AI Reviews
- AI Story
- TikTok
- คลังสินค้า
- 🎬 Extend Scene ← CLICK
```

### Step 3: ควรเห็น
```
🎬 Extend Scene (Google Flow)

☑ Enable Extend Scene Mode
   ต่อฉากอัตโนมัติจาก CSV prompts สำหรับ Google Labs Flow

(ก็จบ เพราะยังไม่เปิด toggle)
```

### Step 4: เปิด Toggle
```
✓ Enable Extend Scene Mode (click)

ควรเห็น:
┌─────────────────────────────┐
│ 📄 CSV Prompts              │
│ [Choose File...]            │
│                             │
│ 📋 Preview Prompts [0]      │
│                             │
│ [🎬 Start Extend] [⏹ Stop] │
└─────────────────────────────┘
```

---

## 📋 Checklist ยืนยัน

- [ ] Extension โหลดเรียบร้อย (ไม่มี error แดด)
- [ ] Tab "🎬 Extend Scene" เห็น
- [ ] Click tab ไปได้
- [ ] Toggle "Enable" เปิดได้
- [ ] CSV upload section ขึ้น
- [ ] Preview section ขึ้น
- [ ] Start/Stop buttons ขึ้น

---

## ถัดไป: ใช้งานจริง

1. **สร้าง CSV file**
   ```
   prompts.csv
   ─────────────
   A professional product showcase
   Modern minimalist scene
   Cinematic reveal
   ```

2. **Upload CSV**
   ```
   Click "Choose File..."
   เลือกไฟล์ prompts.csv
   → Preview ต้องแสดง 3 prompts
   ```

3. **เตรียม Google Flow**
   ```
   https://labs.google/fx/tools/flow
   Create Project → SceneBuilder
   ```

4. **Start Automation**
   ```
   Click "🎬 Start Extend"
   → Progress bar ขึ้น
   → Google Flow สร้าง scenes
   ```

---

## 🎯 Success Indicators

✅ Tab ขึ้นและสลับได้  
✅ Toggle เปิด/ปิดได้  
✅ CSV upload section ขึ้น  
✅ Preview display ถูกต้อง  
✅ Progress bar เตรียมไว้  

---

**🚀 พร้อมแล้ว! ลองใช้จริงเลย**
