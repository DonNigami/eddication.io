# 🎬 วิธีใช้งาน Extend Scene Feature - Quick Guide

## 📍 ขั้นตอนการใช้งาน

### ขั้นที่ 1️⃣: เปิด Tab "Extend Scene"
```
1. คลิก Extension icon 
2. ใน Sidebar ด้านขวา
3. ดูหมวดต่างๆด้านบน: 
   - AI Reviews
   - AI Story  
   - TikTok
   - คลังสินค้า
   - 🎬 Extend Scene ← คลิกแถบแดดนี้
```

---

### ขั้นที่ 2️⃣: เปิดใช้งาน Feature
```
✓ เปิด Toggle เสมือน: "Enable Extend Scene Mode"
  → ตัวควบคุม CSV จะปรากฎขึ้นมา
```

---

### ขั้นที่ 3️⃣: เตรียม CSV File
สร้างไฟล์ `prompts.csv` โดยใช้ Notepad/Excel:

```csv
A professional product showcase with studio lighting
Modern minimalist scene with clean aesthetics
Cinematic slow-motion reveal with depth of field
Luxury lifestyle product photography style
Dynamic action sequence with motion blur
```

**ห้ามทำ:**
- ❌ ไม่ใส่ headers
- ❌ ไม่เว้นบรรทัด (empty lines)
- ❌ ไม่ใส่ space หลังฟาก
- ❌ ไม่ใส่ quotes หรือ comma

---

### ขั้นที่ 4️⃣: อัปโหลด CSV
```
1. คลิก "📄 CSV Prompts สำหรับต่อฉาก"
2. เลือกไฟล์ CSV ที่สร้างไว้
3. จะเห็น Preview ปรากฎขึ้น พร้อมตัวเลข
   เช่น: "📋 Preview Prompts [5]"
```

---

### ขั้นที่ 5️⃣: เตรียม Google Labs Flow
```
1. ไปที่ https://labs.google/fx/tools/flow
2. Create New Project
3. Enter SceneBuilder
4. ⏳ รอจนกว่า UI จะเต็ม
```

---

### ขั้นที่ 6️⃣: Start Automation
```
1. กลับมา Extension sidebar
2. คลิก "🎬 Start Extend" (ปุ่มสีแดด)
3. จะเห็น Progress bar ขึ้นมา:
   ├─ จำนวน scenes: "0/5 scenes"
   ├─ Percentage: "0%"  
   └─ Current scene: "A professional product..."
```

---

### ขั้นที่ 7️⃣: ตามดูความคืบหน้า
```
📊 Progress Bar:
┌─────────────────┐
│███░░░░░░░░░░░░░│ 40%
└─────────────────┘

- Bar เต็ม = เสร็จแล้ว ✓
- Scenes count เพิ่มขึ้น = ทำงาน ✓
- Current scene อัปเดต = ต่อฉากเพิ่มเติม ✓
```

---

### ขั้นที่ 8️⃣: ดู Result ใน Google Flow
```
🔄 ระหว่าง automation:
- Google Flow จะสร้างฉากใหม่
- AI generate จาก prompts
- Progress bar update ทีละขั้น
```

---

### ขั้นที่ 9️⃣: เสร็จ
```
✅ Progress bar เต็ม 100%
✅ Message: "Extend Scene Complete"
✅ Scenes ใน Google Flow พร้อม
```

---

## ⏹️ ถ้าต้องหยุด
```
คลิก "⏹ Stop" ปุ่มแดด
→ Automation หยุด
→ Current scene เสร็จสิ้น
```

---

## 📊 ตัวอย่าง CSV Format

### ✅ ถูก
```
A professional product showcase
Modern minimalist scene
Cinematic reveal
Luxury photography
Action sequence
```

### ❌ ผิด
```
Prompt,Description
"A professional product showcase","With studio lighting"
"Modern minimalist scene","Clean aesthetic"

Prompt with comma, and weird format
```

---

## ⚠️ อาจเจอ Error

### Error 1: "workflowState is not defined"
```
原因: Form state ยังไม่ initialize
แก้ไข: Reload extension
   1. ไป chrome://extensions
   2. ปิด/เปิด extension
   3. ลองใหม่
```

### Error 2: "File is not CSV"
```
原因: ไฟล์นามสกุล ผิด หรือ format ผิด
แก้ไข: บันทึกเป็น .csv
   1. File → Save As
   2. Type: CSV (.csv)
   3. Encoding: UTF-8
```

### Error 3: "No prompts loaded"
```
原因: CSV file ว่าง หรือ ไม่อ่านได้
แก้ไข: ตรวจสอบ CSV
   1. ใจให้ยาว 1-2000 chars/line
   2. ไม่เว้นบรรทัด
   3. Save ใหม่แล้วลองใหม่
```

---

## 💡 Pro Tips

### Tip 1: เตรียม Prompts
```
ทำให้ descriptive:
❌ "scene"
✅ "A cinematic product showcase with dramatic lighting"

✅ "Modern minimalist interior with natural daylight"
✅ "Professional photography studio ambiance"
```

### Tip 2: Testing
```
1. ลองกับ 3 prompts ก่อน
2. ดูว่า Generate ได้ดีไหม
3. ถ้า OK แล้ว ค่อยโหลด batch ใหญ่
```

### Tip 3: Batch Processing
```
Split CSV เป็นหลายไฟล์:
- batch1.csv (5 prompts)
- batch2.csv (5 prompts)
- batch3.csv (5 prompts)

Process ทีละไฟล์ เพื่อไม่เกิน quota
```

### Tip 4: Export Result
```
ใน Google Flow:
1. Scene Generate เสร็จ
2. เลือกทั้งหมด
3. Export / Download
```

---

## 📋 Checklist ก่อนเริ่ม

- [ ] Extension loaded (ไม่มี error แบบสีแดด)
- [ ] Sidebar sidebar.html opened
- [ ] CSV file สร้างเรียบร้อย
- [ ] Google Labs Flow tab open
- [ ] SceneBuilder page loaded
- [ ] Toggle "Enable" ✓
- [ ] CSV uploaded พร้อม preview
- [ ] Ready to click "Start Extend"

---

## 🎯 Expected Results

```
จำนวน Prompts: 5

Timeline:
├─ T+0s:  Start automation
├─ T+15s: Scene 1 generating...
├─ T+35s: Scene 2 generating...
├─ T+55s: Scene 3 generating...
├─ T+75s: Scene 4 generating...
├─ T+95s: Scene 5 generating...
└─ T+115s: ✅ COMPLETE!

Time per scene: ~20 seconds (network dependent)
Total time: 1.5-2 minutes for 5 scenes
```

---

## 🔗 Useful Links

- **Google Labs Flow**: https://labs.google/fx/tools/flow
- **Documentation**: See EXTEND_SCENE_README.md
- **Troubleshooting**: See EXTEND_SCENE_INTEGRATION_COMPLETE.md

---

## ✨ Ready to Go!

คุณพร้อมแล้ว! ลองทำตามขั้นตอนข้างต้นเลย 🚀

**ถ้ามี Error:** ดูส่วน "⚠️ อาจเจอ Error" ด้านบน
