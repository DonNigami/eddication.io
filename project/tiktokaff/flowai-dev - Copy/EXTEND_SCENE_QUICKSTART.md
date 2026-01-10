# 🎬 Extend Scene Feature - Quick Start

## ✅ Installation Complete!

ฟีเจอร์ Extend Scene ได้ถูกเพิ่มเข้าไปใน flowai-dev-copy แล้ว

---

## 📦 Files Created

### 1. **Core Module**
- ✅ `js/modules/extendScene.js` - Main logic and UI handling
- ✅ `content/platforms/googleFlow.js` - Content script for Google Flow
- ✅ `css/extendScene.css` - Styling

### 2. **Documentation**
- ✅ `EXTEND_SCENE_FEATURE.md` - Complete feature guide
- ✅ `html/snippets/extend-scene-section.html` - HTML template

### 3. **Configuration**
- ✅ `manifest.json` - Updated with Google Flow permissions

---

## 🔧 Integration Steps

### Step 1: Add HTML to Sidebar
เปิดไฟล์ `html/sidebar.html` และเพิ่ม HTML section:

```html
<!-- เพิ่มใน <head> -->
<link rel="stylesheet" href="../css/extendScene.css">

<!-- เพิ่มใน <body> (ในตำแหน่งที่เหมาะสม) -->
<!-- คัดลอกจาก html/snippets/extend-scene-section.html -->

<!-- เพิ่มก่อน </body> -->
<script src="../js/modules/extendScene.js"></script>
```

### Step 2: Show/Hide Based on Context
ในไฟล์ `js/sidebar.js`, เพิ่มโค้ดเพื่อแสดง/ซ่อน Extend Scene section:

```javascript
// Show Extend Scene when appropriate
function updateExtendSceneVisibility() {
    const section = document.getElementById('extendSceneSection');
    if (!section) return;
    
    // แสดงเมื่ออยู่ใน appropriate tab/mode
    const shouldShow = currentTab === 'ai-generator' || 
                      currentTab === 'video-mode';
    
    if (shouldShow) {
        section.classList.remove('hidden');
    } else {
        section.classList.add('hidden');
    }
}
```

### Step 3: Test Extension
1. โหลด extension ใหม่ใน Chrome (`chrome://extensions/`)
2. เปิด Google Labs Flow: https://labs.google/fx/tools/flow
3. เปิด Extension sidebar
4. ไปที่ section ที่มี Extend Scene
5. ทดสอบฟีเจอร์

---

## 📝 Usage Example

### 1. Prepare CSV File
สร้างไฟล์ `prompts.csv`:

```csv
A professional product showcase with dynamic lighting
Modern minimalist scene with elegant transitions
Cinematic slow-motion product reveal with dramatic music
Vibrant colors scene with smooth camera movements
Luxury style presentation with golden hour lighting
High-energy action scene with quick cuts
Emotional storytelling moment with soft focus
Tech-forward futuristic scene with neon accents
```

### 2. Use Extension
1. เปิด Google Flow และสร้างโปรเจกต์
2. เข้า SceneBuilder mode
3. เปิด Extension → Enable Extend Scene Mode
4. Upload CSV file
5. Review preview
6. Click "Start Extend"
7. Extension จะทำงานอัตโนมัติ

### 3. Monitor Progress
- Progress bar แสดงความคืบหน้า
- Current scene แสดง prompt ที่กำลังประมวลผล
- รอจนกว่า 80% แล้วไปต่อ prompt ถัดไป

---

## 🎨 Customization

### Change Target Completion Percentage
แก้ไขใน `js/modules/extendScene.js`:

```javascript
// เปลี่ยนจาก 80% เป็น 90%
const targetPercent = this.settings.waitForPercent || 90;
```

### Change Delay Between Tasks
แก้ไขใน `js/modules/extendScene.js`:

```javascript
// เปลี่ยนจาก 3 วินาที เป็น 5 วินาที
const delay = this.settings.delayBetweenTasks || 5000;
```

### Customize Styles
แก้ไขใน `css/extendScene.css`:

```css
/* Change progress bar color */
.progress-fill {
    background: linear-gradient(90deg, #your-color 0%, #your-color2 100%);
}

/* Change button styles */
.btn-primary {
    background: linear-gradient(135deg, #your-color 0%, #your-color2 100%);
}
```

---

## 🐛 Troubleshooting

### Issue: Extension not connecting to Flow
**Solution:**
1. Reload หน้า Google Flow
2. Reload Extension
3. ตรวจสอบว่า URL เป็น `https://labs.google/fx/tools/flow`

### Issue: Extend button not found
**Solution:**
1. ตรวจสอบว่าอยู่ในหน้า SceneBuilder
2. คลิกปุ่ม (+) ด้วยตนเองครั้งแรก เพื่อให้ menu โหลด
3. ลองใหม่อีกครั้ง

### Issue: Progress stuck at 0%
**Solution:**
1. ตรวจสอบ Console logs (`F12` → Console tab)
2. ตรวจสอบว่า prompt ถูกกรอกลงใน textarea
3. ตรวจสอบว่าปุ่ม Send ถูกคลิก

### Issue: CSV not loading
**Solution:**
1. ตรวจสอบ encoding เป็น UTF-8
2. ตรวจสอบว่าแต่ละบรรทัดมี prompt (ไม่ว่าง)
3. ลบ empty lines ออก

---

## 📊 CSV Format Examples

### Simple Format (Recommended)
```csv
First prompt here
Second prompt here
Third prompt here
```

### With Header
```csv
prompt
First prompt here
Second prompt here
Third prompt here
```

### Advanced (Ignored columns after first)
```csv
prompt,notes,tags
First prompt,Scene 1,product
Second prompt,Scene 2,lifestyle
Third prompt,Scene 3,cta
```

---

## 🚀 Future Enhancements

แนวคิดสำหรับพัฒนาต่อ:

1. **✨ Prompt Library**
   - บันทึก prompts ที่ใช้บ่อย
   - Categories และ Tags
   - Search และ Filter

2. **📊 Analytics**
   - Track success rate
   - Average processing time
   - Popular prompts

3. **🎨 Prompt Editor**
   - แก้ไข prompts ก่อนรัน
   - Reorder prompts
   - Enable/Disable specific prompts

4. **🔄 Smart Retry**
   - Auto-retry on failure
   - Skip failed prompts
   - Error notifications

5. **💾 Auto-Save Results**
   - Download completed scenes
   - Save metadata
   - Export report

6. **⏸️ Pause/Resume**
   - Pause mid-process
   - Resume from last prompt
   - Save progress

7. **🎯 Batch Operations**
   - Multiple CSV files
   - Queue management
   - Priority ordering

---

## 📖 Additional Resources

- [EXTEND_SCENE_FEATURE.md](EXTEND_SCENE_FEATURE.md) - Complete documentation
- [COMPARISON_AND_IMPROVEMENT_PLAN.md](../COMPARISON_AND_IMPROVEMENT_PLAN.md) - Overall comparison

---

## ✅ Testing Checklist

- [ ] Extension loads without errors
- [ ] Extend Scene section appears in sidebar
- [ ] CSV file uploads successfully
- [ ] Prompts preview displays correctly
- [ ] Start button enables after CSV load
- [ ] Extension connects to Google Flow
- [ ] (+) button is found and clicked
- [ ] Extend option is found and clicked
- [ ] Prompt is filled in textarea
- [ ] Send button is clicked
- [ ] Progress percentage is detected
- [ ] Next prompt starts after 80%
- [ ] All prompts complete successfully
- [ ] Stop button works
- [ ] Progress persists after reload

---

**Status**: ✅ Ready to use!  
**Version**: 1.0  
**Date**: January 10, 2026
