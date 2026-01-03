# Video Generation Settings Enhancement 🎬⏱️

## การปรับปรุง

เพิ่มการตั้งค่าสำหรับควบคุมความยาวคลิปและความหน่วงในการสร้างวิดีโอ เพื่อป้องกัน error และปรับให้เหมาะกับการใช้งาน

---

## ✨ Features ใหม่

### 1. ความยาวคลิปวิดีโอ (Video Duration)
- **ตั้งค่าได้:** 5, 10, 15 วินาที
- **ค่า Default:** 10 วินาที
- ใช้กับ Runway Gen-3 Alpha Turbo
- ตั้งค่าอัตโนมัติเมื่อเปลี่ยนเป็น Video Mode

### 2. Delay หลังสร้างภาพ (Image Generation Delay)
- **ตั้งค่าได้:** 30, 45, 60, 90, 120 วินาที
- **ค่า Default:** 60 วินาที
- รอให้ภาพโหลดเสร็จก่อนขั้นตอนถัดไป
- ป้องกัน error จากการเปลี่ยนโหมดเร็วเกินไป

### 3. Delay หลังสร้างวิดีโอ (Video Generation Delay)
- **ตั้งค่าได้:** 60, 90, 120, 150, 180, 240 วินาที
- **ค่า Default:** 90 วินาที (1.5 นาที)
- รอให้วิดีโอ render เสร็จก่อนดาวน์โหลด
- แยกต่างหากจาก Download Delay

### 4. Delay ก่อนดาวน์โหลด (Download Delay)
- **ตั้งค่าได้:** 0, 5, 10, 15, 30 วินาที
- **ค่า Default:** 0 วินาที (ทันที)
- Delay เพิ่มเติมหลังจากวิดีโอ render เสร็จแล้ว
- ใช้กรณีต้องการรอเพิ่มเพื่อความปลอดภัย

---

## 📁 ไฟล์ที่แก้ไข

### 1. **sidebar.html**
เพิ่ม UI สำหรับตั้งค่าใน Settings Modal:
```html
<select id="videoDuration">
  <option value="5">5 วินาที</option>
  <option value="10" selected>10 วินาที</option>
  <option value="15">15 วินาที</option>
</select>

<select id="imageGenerationDelay">
  <option value="30">30 วินาที</option>
  <option value="60" selected>60 วินาที</option>
  <option value="90">90 วินาที</option>
  ...
</select>

<select id="videoGenerationDelay">
  <option value="90" selected>90 วินาที</option>
  <option value="120">120 วินาที</option>
  ...
</select>
```

### 2. **js/modules/settings.js**
เพิ่ม properties และ methods:

**Properties:**
- `videoDurationSelect` - Element reference
- `imageGenerationDelaySelect` - Element reference
- `videoGenerationDelaySelect` - Element reference
- `videoDuration` - ค่าปัจจุบัน (default: 10)
- `imageGenerationDelay` - ค่าปัจจุบัน (default: 60)
- `videoGenerationDelay` - ค่าปัจจุบัน (default: 90)
- `downloadDelay` - เปลี่ยน default เป็น 0

**Methods:**
```javascript
getVideoDuration() → number
getImageGenerationDelay() → number
getVideoGenerationDelay() → number
getDownloadDelay() → number (existing, updated)
```

**Storage:**
Settings ทั้งหมดถูกบันทึกใน `chrome.storage.local` พร้อม sync อัตโนมัติ

### 3. **js/sidebar.js**
อัพเดท automation workflow:

**Step 4 - Create Image:**
```javascript
// Before:
await Controls.handleCreate();
await this.delay(60000); // Hardcoded 60s

// After:
await Controls.handleCreate();
const imageDelay = (Settings.getImageGenerationDelay() || 60) * 1000;
this.updateStoryAutomationStatus(`รอภาพ ${Settings.getImageGenerationDelay()} วินาที...`);
await this.delay(imageDelay);
```

**Step 9 - Create Video:**
```javascript
// Before:
await Controls.handleCreate();
const downloadDelay = (Settings.getDownloadDelay() || 90) * 1000;
await this.delay(downloadDelay);

// After:
await Controls.handleCreate();

// Video generation delay
const videoDelay = (Settings.getVideoGenerationDelay() || 90) * 1000;
this.updateStoryAutomationStatus(`รอวิดีโอ ${Settings.getVideoGenerationDelay()} วินาที...`);
await this.delay(videoDelay);

// Additional download delay (if set)
const downloadDelay = (Settings.getDownloadDelay() || 0) * 1000;
if (downloadDelay > 0) {
  this.updateStoryAutomationStatus(`รอเพิ่มเติม ${Settings.getDownloadDelay()} วินาที...`);
  await this.delay(downloadDelay);
}
```

### 4. **js/modules/controls.js**
เพิ่มฟังก์ชัน `setVideoDuration()`:

```javascript
async setVideoDuration() {
  const duration = Settings.getVideoDuration() || 10;
  
  // Click Gen5Duration dropdown
  // Select matching duration option (5s, 10s, 15s)
  // Uses WASM selectors: Gen5DurationBtn, Gen5DurationMenuItem
}
```

อัพเดท `handleVideoMode()`:
```javascript
// After switching to video mode, automatically set duration
if (results && results[0] && results[0].result) {
  await new Promise(resolve => setTimeout(resolve, 1000));
  await this.setVideoDuration(); // ← เพิ่มบรรทัดนี้
  
  Helpers.showToast('เปลี่ยนเป็น Frames to Video แล้ว', 'success');
}
```

---

## 🎯 Use Cases

### Use Case 1: Fast Mode (รอน้อย)
สำหรับเครื่องเร็ว หรือเน็ตเร็ว:
```
Video Duration: 5s
Image Delay: 30s
Video Delay: 60s
Download Delay: 0s
```

### Use Case 2: Balanced (แนะนำ)
สำหรับใช้งานทั่วไป:
```
Video Duration: 10s (default)
Image Delay: 60s (default)
Video Delay: 90s (default)
Download Delay: 0s (default)
```

### Use Case 3: Safe Mode (ป้องกัน error)
สำหรับเครื่องช้า หรือเน็ตช้า:
```
Video Duration: 10s
Image Delay: 90s
Video Delay: 150s
Download Delay: 10s
```

### Use Case 4: Long Videos
สำหรับคลิปยาว 15 วินาที:
```
Video Duration: 15s
Image Delay: 60s
Video Delay: 180s (3 นาที)
Download Delay: 15s
```

---

## 🔧 Technical Details

### Automation Workflow Timeline

**ก่อนแก้ไข:**
```
Step 4: Create Image → Wait 60s (hardcoded)
Step 9: Create Video → Wait 90s (downloadDelay)
```

**หลังแก้ไข:**
```
Step 4: Create Image → Wait [imageGenerationDelay]s (configurable)
Step 9: Create Video → Wait [videoGenerationDelay]s + [downloadDelay]s (configurable)
```

### Settings Storage Structure
```javascript
chrome.storage.local: {
  videoDuration: 10,               // seconds
  imageGenerationDelay: 60,        // seconds
  videoGenerationDelay: 90,        // seconds
  downloadDelay: 0,                // seconds
  // ... other settings
}
```

### Video Duration Selector Logic
```javascript
// WASM selectors required:
selectors.Gen5DurationBtn        // Button to open duration menu
selectors.Gen5DurationMenuItem   // Menu items selector

// Selection logic:
1. Click Gen5DurationBtn
2. Wait 300ms for menu
3. Find item with text matching "{duration}s" (e.g., "10s")
4. Click item
```

---

## ⚠️ หมายเหตุ

### Delay Settings แนะนำ:

**Image Generation Delay:**
- ภาพปกติ: 30-60 วินาที
- ภาพซับซ้อน: 60-90 วินาที
- เครื่องช้า: 90-120 วินาที

**Video Generation Delay:**
- 5s clips: 60-90 วินาที
- 10s clips: 90-120 วินาที (default)
- 15s clips: 150-180 วินาที

**Download Delay:**
- ส่วนใหญ่: 0 วินาที (ไม่จำเป็น)
- เน็ตช้า: 5-10 วินาที
- ปลอดภัยมาก: 15-30 วินาที

### Troubleshooting:

**Error: ภาพยังไม่เสร็จ**
→ เพิ่ม `imageGenerationDelay`

**Error: วิดีโอยังไม่เสร็จ**
→ เพิ่ม `videoGenerationDelay`

**Error: ดาวน์โหลดไม่ได้**
→ เพิ่ม `downloadDelay` (5-10s)

**Duration ไม่ตั้งได้**
→ ตรวจสอบว่า WASM selectors มี `Gen5DurationBtn` และ `Gen5DurationMenuItem`

---

## ✅ Testing Checklist

- [x] Settings UI renders correctly
- [x] Default values load properly
- [x] Settings save to storage
- [x] Settings load from storage on reload
- [x] `getVideoDuration()` returns correct value
- [x] `getImageGenerationDelay()` returns correct value
- [x] `getVideoGenerationDelay()` returns correct value
- [x] `getDownloadDelay()` returns correct value
- [x] Automation uses new delays
- [x] Status messages show correct timing
- [ ] Video duration actually changes on Runway (requires testing on actual site)
- [ ] WASM selectors for Gen5Duration work correctly

---

## 🎊 สรุป

การอัพเดทนี้เพิ่มความยืดหยุ่นในการตั้งค่าเวลาสำหรับ:
1. ✅ ความยาวคลิป (5/10/15s)
2. ✅ Delay หลังสร้างภาพ (30-120s)
3. ✅ Delay หลังสร้างวิดีโอ (60-240s)
4. ✅ Delay ก่อนดาวน์โหลด (0-30s)

ทำให้ผู้ใช้สามารถปรับแต่งตามความเร็วเครื่อง/เน็ต และป้องกัน error จากการรอไม่พอได้!
