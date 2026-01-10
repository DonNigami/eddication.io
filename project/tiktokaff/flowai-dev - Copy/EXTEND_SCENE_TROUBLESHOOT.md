# 🔧 ขั้นตอนแก้ไข: Extend Scene ไม่ขึ้น

## ✅ Step 1: Disable Flow-Auto-2026 Extension

**เนื่องจาก Flow-Auto-2026 กำลัง conflict**

```
1. ไป chrome://extensions
2. หา "Flow Auto 2026 by AI Influencer TH"
3. Toggle OFF (ปิด)
4. Page ควร reload อัตโนมัติ
```

---

## ✅ Step 2: Verify Eddication Flow AI ยังเปิด

```
ใน chrome://extensions
- "Eddication Flow AI" ต้อง ON (toggle blue)
- ไม่มี error สีแดด
```

---

## ✅ Step 3: Open DevTools Console

```
F12 → Console tab
ตรหาข้อความ:
  "[FlowAI] Setting up tabs..."
  
ถ้าเห็น = tabs initialize OK ✓
ถ้าไม่เห็น = sidebar.js ไม่ load
```

---

## ✅ Step 4: Check Tab Buttons

```
ใน DevTools Console พิมพ์:

document.querySelectorAll('.tab-btn')

ควรเห็น 5 buttons:
1. AI Reviews
2. AI Story
3. TikTok
4. คลังสินค้า
5. 🎬 Extend Scene ← MUST SHOW!

ถ้ามี 5 ตัว = HTML OK ✓
ถ้าไม่มี = HTML ไม่เพิ่ม
```

---

## ✅ Step 5: Click Extend Scene Tab

```
ใน sidebar ด้านขวา
คลิก "🎬 Extend Scene" tab

ควรเห็น:
┌─────────────────────────────┐
│ 🎬 Extend Scene             │
│ (Google Flow)               │
│                             │
│ ☑ Enable Extend Scene Mode  │
│   ต่อฉากอัตโนมัติจาก CSV... │
│                             │
│ (ก็จบ เพราะยังไม่เปิด toggle)│
└─────────────────────────────┘
```

---

## ✅ Step 6: Toggle Enable

```
Click checkbox: ☑ Enable Extend Scene Mode

ควรเห็น CSV upload section:
┌─────────────────────────────┐
│ 📄 CSV Prompts              │
│ [Choose File...]            │
│                             │
│ 📋 Preview Prompts [0]      │
│                             │
│ [🎬 Start Extend] [⏹ Stop] │
│                             │
│ Progress: 0/0 scenes  0%    │
└─────────────────────────────┘
```

---

## 🆘 ถ้ายังไม่ได้:

### Check 1: ดู Console Log
```
F12 → Console
ตรหา error ด้วย:
- "Cannot find element"
- "extendSceneToggle is null"
- "Cannot read properties"
- "workflowState"

Report error ที่ได้เห็นมา
```

### Check 2: ดู Network
```
F12 → Network tab
Reload (F5)
ตรหา:
- extendScene.js (status ต้อง 200)
- extendScene.css (status ต้อง 200)
- googleFlow.js (status ต้อง 200)

ถ้า 404 = file หาไม่เจอ
```

### Check 3: ตรวจ HTML Element
```
F12 → Elements
Ctrl+F "extendSceneToggle"

ถ้าเจอ = HTML OK
ถ้าไม่เจอ = ต้องเพิ่ม HTML ใหม่
```

---

## 📋 Checklist

- [ ] Flow-Auto-2026 ปิด (OFF)
- [ ] Eddication Flow AI เปิด (ON)
- [ ] Console ดู "[FlowAI] Setting up tabs..."
- [ ] 5 tab buttons เห็น (ใน console test)
- [ ] Click "🎬 Extend Scene" tab ไปได้
- [ ] ส่วน Enable checkbox เห็น
- [ ] Click checkbox เปิดได้
- [ ] CSV upload section ขึ้นมา

---

## 🚀 ถ้าทุกอย่าง OK แล้ว:

1. สร้าง prompts.csv
2. Upload CSV
3. Click "Start Extend"
4. ดู Google Flow สร้าง scenes

---

**ลองตามขั้นตอนข้างต้นแล้วบอกผลได้ไหม?** 🔍
