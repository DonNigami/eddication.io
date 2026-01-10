# 🎬 EXTEND SCENE - วิธีใช้งาน (แบบรวบรัด)

## 📍 ตำแหน่งในซ่อง UI

```
Extension Sidebar ด้านขวา
┌─────────────────────────────────────┐
│  🎬 Extend Scene  (แถบแดดด้านขวา)    │ ← CLICK HERE
│                                     │
│  ☐ Enable Extend Scene Mode         │
│    (toggle เพื่อเปิด)                │
│                                     │
│  📄 CSV Prompts สำหรับต่อฉาก         │
│     [Choose File...]                │
│                                     │
│  📋 Preview Prompts [0]             │
│                                     │
│  [🎬 Start Extend] [⏹ Stop]        │
│                                     │
│  Progress: 0/0 scenes  0%           │
│                                     │
└─────────────────────────────────────┘
```

---

## 🚀 ขั้นตอนรวบรัด (9 ขั้น)

### ขั้น 1: เปิด Extend Scene Tab
```
คลิกแถบแดด "🎬 Extend Scene" ด้านบนขวา
```

### ขั้น 2: เปิด Toggle
```
☑ Enable Extend Scene Mode
→ ตัวควบคุมจะปรากฏขึ้น
```

### ขั้น 3: สร้าง CSV File
สร้างไฟล์ `prompts.csv` ใน Notepad/Excel:
```
A professional product showcase
Modern minimalist scene
Cinematic slow-motion reveal
```
บันทึกเป็น `.csv` และ UTF-8 encoding

### ขั้น 4: Upload CSV
```
คลิก "📄 CSV Prompts"
เลือกไฟล์ที่สร้าง
→ Preview จะแสดงจำนวน prompts
```

### ขั้น 5: ตรวจสอบ Preview
```
📋 Preview Prompts [3]
• A professional product showcase
• Modern minimalist scene
• Cinematic slow-motion reveal
```

### ขั้น 6: เปิด Google Flow
```
https://labs.google/fx/tools/flow
→ Create Project
→ Open SceneBuilder
```

### ขั้น 7: กลับมา Extension
```
ดูอีกครั้งที่ Extend Scene tab
```

### ขั้น 8: Click Start
```
[🎬 Start Extend] ← Click
→ Progress bar เริ่มทำงาน
→ ดูใน Google Flow tab สถานะสร้างฉาก
```

### ขั้น 9: รอให้เสร็จ
```
⏳ รอจนกว่า:
   • Progress: 3/3 scenes
   • Percentage: 100%
   • Google Flow: 3 scenes generated ✅
```

---

## ❌ ห้ามทำ

```
❌ Empty lines ในไฟล์
❌ Quotes หรือ Commas
❌ Special characters
❌ Headers (Prompt, Description)
❌ Format: CSV with headers
```

---

## ✅ ทำได้

```
✅ Plain text, one per line
✅ UTF-8 encoding
✅ 1-2000 characters per prompt
✅ Copy from CSV (Excel)
```

---

## 📊 Expected Result

```
Timeline:
├─ 0s:   Start automation
├─ 15s:  Scene 1 generating
├─ 35s:  Scene 2 generating
├─ 55s:  Scene 3 generating
└─ 75s:  ✅ Complete!

Progress updates:
├─ 1/3 scenes  33%
├─ 2/3 scenes  67%
└─ 3/3 scenes  100%
```

---

## 🛠️ Troubleshooting

### Error: "File is not CSV"
```
แก้: Save as .csv not .txt
```

### Error: "No prompts loaded"
```
แก้: ตรวจสอบ CSV format
   • ไม่มี empty lines
   • ไม่มี headers
   • UTF-8 encoding
```

### Error: "workflowState not defined"
```
แก้: Reload extension
   1. chrome://extensions
   2. Click reload button
   3. Try again
```

---

## 💡 Pro Tips

```
Tip 1: Test with 3 prompts first
Tip 2: Use descriptive prompts
Tip 3: Avoid special characters
Tip 4: Wait 2-3 seconds between uploads
```

---

## 📚 More Info

- `EXTEND_SCENE_QUICKSTART_TH.md` - ขั้นตอนละเอียด
- `EXTEND_SCENE_VISUAL_GUIDE.md` - แผนภาพและ diagrams
- `EXTEND_SCENE_README.md` - คู่มือเต็ม

---

**พร้อม!** ลองตามขั้นตอนข้างต้นเลย 🚀
