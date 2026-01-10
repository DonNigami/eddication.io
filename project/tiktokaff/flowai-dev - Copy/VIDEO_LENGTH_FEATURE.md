# Video Length Feature - Implementation Summary

## Overview
เพิ่มฟีเจอร์เลือกความยาวคลิป 8 หรือ 16 วินาที สำหรับทุกฟังก์ชันการสร้าง prompt

## Changes Made

### 1. UI Components (sidebar.html)
**ไฟล์:** `html/sidebar.html`

เพิ่ม dropdown สำหรับเลือกความยาวคลิป:
```html
<!-- Video Length Selector -->
<div class="form-group style-selector-row">
  <label>ความยาวคลิป</label>
  <div class="style-dropdown-wrapper">
    <select id="videoLengthSelect" class="style-dropdown">
      <option value="8" selected>8 วินาที (TikTok, Shorts)</option>
      <option value="16">16 วินาที (Extended)</option>
    </select>
  </div>
</div>
```

### 2. System Prompt Module (systemPrompt.js)
**ไฟล์:** `js/api/systemPrompt.js`

อัปเดต `buildUserMessage()` เพื่อรับและประมวลผล `videoLength`:
- เพิ่มพารามิเตอร์ `videoLength = 8` (default)
- Replace placeholder `{{videoLength}}` ใน template
- ส่งต่อค่า videoLength ไปยัง `buildFromTemplate()` และ `buildDefaultMessage()`

### 3. Video Prompt Templates (videoPromptTemplates.js)
**ไฟล์:** `js/data/videoPromptTemplates.js`

อัปเดตทุก template ให้รองรับความยาวคลิปแบบ dynamic:

#### System Prompts:
- เปลี่ยนจาก: `วิดีโอความยาว 8 วินาที`
- เป็น: `วิดีโอความยาว {{videoLength}} วินาที`
- เพิ่ม: `(สำหรับ 8 วิ: ในช่วง 2-6 วินาที, สำหรับ 16 วิ: ในช่วง 3-13 วินาที)`

#### User Message Templates:
- เปลี่ยนจาก: `- วิดีโอ 8 วินาที`
- เป็น: `- วิดีโอ {{videoLength}} วินาที`
- เปลี่ยนจาก: `- บทพูดภาษาไทยในช่วง 2-6 วินาที`
- เป็น: `- บทพูดภาษาไทย (8วิ: ช่วง 2-6 วิ / 16วิ: ช่วง 3-13 วิ)`

#### Templates Updated:
- ✅ video-ugc (UGC ปก)
- ✅ video-ugc-using (UGC เนื้อหา: ใช้จริง)
- ✅ video-ugc-feeling (UGC เนื้อหา: ความรู้สึก)
- ✅ video-ugc-compare (UGC เนื้อหา: ก่อน-หลัง)
- ✅ video-ugc-closeup (UGC เนื้อหา: ซูมสินค้า)
- ✅ video-ugc-recommend (UGC เนื้อหา: แนะนำ)
- ✅ All other video templates...

### 4. API Modules
**ไฟล์:** `js/api/geminiApi.js` และ `js/api/openaiApi.js`

อัปเดตฟังก์ชัน `generatePrompt()` ให้รับพารามิเตอร์ `videoLength`:

```javascript
async generatePrompt(apiKey, productImage, productName, hasPersonImage, ugcSettings, videoLength = 8) {
  // ... existing code ...
  text: SystemPrompt.buildUserMessage(productName, hasPersonImage, ugcSettings, videoLength)
}
```

### 5. Controls Module (controls.js)
**ไฟล์:** `js/modules/controls.js`

เพิ่มการดึงค่า `videoLength` จาก UI และส่งต่อไปยัง API:

```javascript
// Get video length from select element (default to 8 if not found)
const videoLengthSelect = document.getElementById('videoLengthSelect');
const videoLength = videoLengthSelect ? parseInt(videoLengthSelect.value) : 8;

// Pass videoLength to API
rawResponse = await GeminiApi.generatePrompt(
  settings.apiKey, productImage, productName, hasPersonImage, ugcSettings, videoLength
);
```

### 6. Form State Module (formState.js)
**ไฟล์:** `js/modules/formState.js`

เพิ่ม `videoLengthSelect` ลงใน `formFields` array เพื่อบันทึกและโหลดค่า:

```javascript
formFields: ['productName', 'mainHeading', 'subHeading', 'price', 'gender', 'ageRange', 'videoLengthSelect']
```

## How It Works

1. **ผู้ใช้เลือกความยาวคลิป** (8 หรือ 16 วินาที) จาก dropdown ใน UI
2. **เมื่อกดปุ่ม Generate Prompt:**
   - `controls.js` อ่านค่า videoLength จาก `#videoLengthSelect`
   - ส่งค่าไปยัง `GeminiApi.generatePrompt()` หรือ `OpenaiApi.generatePrompt()`
3. **API Module** ส่งค่าต่อไปยัง `SystemPrompt.buildUserMessage()`
4. **SystemPrompt** แทนที่ `{{videoLength}}` ใน template
5. **AI ได้รับ prompt** ที่ระบุความยาวคลิปและช่วงเวลาบทพูดที่ถูกต้อง
6. **ค่าถูกบันทึก** อัตโนมัติโดย `formState.js`

## Prompt Instructions for AI

### สำหรับ 8 วินาที:
- วิดีโอความยาว 8 วินาที
- บทพูดภาษาไทยในช่วง 2-6 วินาที

### สำหรับ 16 วินาที:
- วิดีโอความยาว 16 วินาที  
- บทพูดภาษาไทยในช่วง 3-13 วินาที

## Testing

### Test Cases:
1. ✅ เลือก 8 วินาที → prompt ต้องระบุ "8 วินาที" และ "2-6 วินาที"
2. ✅ เลือก 16 วินาที → prompt ต้องระบุ "16 วินาที" และ "3-13 วินาที"
3. ✅ ค่า default = 8 วินาที (ถ้า element ไม่พบ)
4. ✅ บันทึกและโหลดค่าผ่าน formState
5. ✅ ใช้งานได้กับทุก video template

## Benefits

- ✅ ผู้ใช้สามารถเลือกความยาวคลิปได้ตามต้องการ
- ✅ AI จะสร้าง prompt ที่เหมาะสมกับความยาวที่เลือก
- ✅ บทพูดจะอยู่ในช่วงเวลาที่เหมาะสม
- ✅ รองรับ TikTok (8 วิ) และ Extended format (16 วิ)
- ✅ ทำงานกับทุกฟังก์ชัน (ปก, เนื้อหา, burst mode, warehouse mode)

## Files Modified

1. `html/sidebar.html` - เพิ่ม UI dropdown
2. `js/api/systemPrompt.js` - อัปเดต buildUserMessage
3. `js/data/videoPromptTemplates.js` - อัปเดตทุก template
4. `js/api/geminiApi.js` - เพิ่ม videoLength parameter
5. `js/api/openaiApi.js` - เพิ่ม videoLength parameter
6. `js/modules/controls.js` - อ่านและส่งค่า videoLength
7. `js/modules/formState.js` - บันทึก/โหลดค่า videoLength

## Automation Script

สร้าง Python script `update_video_templates.py` เพื่ออัปเดต templates อัตโนมัติ:
- Replace "8 วินาที" → "{{videoLength}} วินาที"
- Update dialogue timing instructions
- Handle Thai language encoding correctly

---

**Date:** January 4, 2026  
**Status:** ✅ Completed  
**Tested:** ✅ All features working
