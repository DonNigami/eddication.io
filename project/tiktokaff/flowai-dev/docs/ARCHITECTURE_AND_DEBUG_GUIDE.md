# Flow AI Unlocked - Architecture & Debug Guide

เอกสารนี้อธิบายสถาปัตยกรรม หลักการทำงาน และวิธีการ debug โปรแกรม Flow AI Unlocked เพื่อให้สามารถต่อยอดไปยังแพลตฟอร์มอื่นๆ เช่น Shopee, Facebook Reels, YouTube Shorts

---

## 📋 Table of Contents

1. [ภาพรวมโปรแกรม](#ภาพรวมโปรแกรม)
2. [สถาปัตยกรรมระบบ](#สถาปัตยกรรมระบบ)
3. [กระบวนการทำงานหลัก](#กระบวนการทำงานหลัก)
4. [โครงสร้างไฟล์](#โครงสร้างไฟล์)
5. [การสื่อสารระหว่าง Components](#การสื่อสารระหว่าง-components)
6. [ขั้นตอนการ Upload ไป TikTok](#ขั้นตอนการ-upload-ไป-tiktok)
7. [ขั้นตอนการ Pin Cart](#ขั้นตอนการ-pin-cart)
8. [Debug Tips](#debug-tips)
9. [การต่อยอดไปแพลตฟอร์มอื่น](#การต่อยอดไปแพลตฟอร์มอื่น)

---

## 🎯 ภาพรวมโปรแกรม

**Flow AI Unlocked** เป็น Chrome Extension ที่ทำหน้าที่:

1. **สร้าง AI Content** - ใช้ Google Gemini API สร้าง prompt/caption จากรูปสินค้า
2. **จัดการคลังสินค้า** - เก็บข้อมูลสินค้า ตัวละคร วิดีโอ
3. **Upload อัตโนมัติ** - อัปโหลดวิดีโอไป TikTok พร้อม caption และปักตะกร้าสินค้า
4. **จัดการตารางเวลา** - กำหนดเวลาโพสต์และช่วงเวลาระหว่างโพสต์

### ประเภทของการโพสต์
- **Product Mode** - โพสต์พร้อมปักตะกร้าสินค้า (มี Product ID)
- **Content Mode** - โพสต์คอนเทนต์ทั่วไป (ไม่มีปักตะกร้า)
- **Warehouse Mode** - เลือกสินค้าและวิดีโอจากคลัง
- **Burst Mode** - อัปโหลดหลายสินค้าพร้อมกัน (แบบอัตโนมัติหรือเลือกเอง)

---

## 🏗 สถาปัตยกรรมระบบ

Flow AI Unlocked เป็น **Chrome Extension Manifest V3** ประกอบด้วย 3 ส่วนหลัก:

```
┌─────────────────────────────────────────────────────────────┐
│                     Chrome Extension                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │  Background │◄───┤  Side Panel  │◄───┤    Content   │   │
│  │   Worker    │    │    (UI)      │    │    Script    │   │
│  └─────────────┘    └──────────────┘    └──────────────┘   │
│         │                   │                     │          │
│         │                   │                     │          │
│         ▼                   ▼                     ▼          │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │   Storage   │    │  Gemini API  │    │  TikTok DOM  │   │
│  └─────────────┘    └──────────────┘    └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 1. **Background Worker** (`background.js`)
- Service Worker ที่ทำงานเบื้องหลัง
- จัดการ extension lifecycle
- ฟังและส่งต่อข้อความระหว่าง components
- เปิด Side Panel เมื่อคลิก extension icon

**หน้าที่:**
```javascript
- เปิด side panel
- จัดการ storage
- รับส่งข้อความ (message passing)
- จัดการ downloads
```

### 2. **Side Panel** (`html/sidebar.html` + `js/sidebar.js`)
- UI หลักของโปรแกรม (แสดงด้านข้างของ browser)
- แบ่งเป็น 4 แท็บ:
  - **AI Reviews** - สร้าง review content จากรูปภาพ
  - **AI Story** - สร้าง story content
  - **TikTok** - จัดการการ upload ไป TikTok
  - **คลังสินค้า** - จัดการสินค้า ตัวละคร วิดีโอ

**โครงสร้าง:**
```javascript
sidebar.js (Main Controller)
├── License.js (License validation)
├── Tabs/
│   ├── AI Reviews (ImageUpload, PromptGenerator, Controls)
│   ├── AI Story (VideoPromptTemplateSelector)
│   ├── TikTok (TikTokUploader)
│   └── Warehouse (ProductWarehouse)
└── Modules/
    ├── imageUpload.js
    ├── promptGenerator.js
    ├── productWarehouse.js
    ├── videoStorage.js
    └── settings.js
```

### 3. **Content Script** (`content/tiktok.js`)
- รันบนหน้า TikTok Creator/Upload
- จัดการ DOM ของ TikTok โดยตรง
- รับคำสั่งจาก Side Panel แล้วดำเนินการ

**หน้าที่:**
```javascript
- Upload วิดีโอไป TikTok
- กรอก caption
- ปักตะกร้าสินค้า (Pin Cart)
- ตั้งเวลาโพสต์
- สแกนสินค้าที่มีอยู่
```

---

## ⚙️ กระบวนการทำงานหลัก

### 1. **AI Content Generation Flow**

```
┌───────────────┐
│ เลือกรูปสินค้า│
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ เลือกรูปคน    │ (Optional)
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ ตั้งค่า UGC   │ (Optional)
└───────┬───────┘
        │
        ▼
┌───────────────┐
│ คลิก Generate │
└───────┬───────┘
        │
        ▼
┌───────────────────┐
│ Resize Image      │ (ลดขนาดเป็น 1024px)
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│ ส่ง API Request   │
│ Gemini API        │
│ - System Prompt   │
│ - User Message    │
│ - Product Image   │
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│ Parse Response    │
│ - Extract Prompt  │
│ - Extract Caption │
│ - Extract Hashtag │
└───────┬───────────┘
        │
        ▼
┌───────────────────┐
│ แสดงผลลัพธ์      │
└───────────────────┘
```

**ไฟล์ที่เกี่ยวข้อง:**
- `js/modules/promptGenerator.js` - สร้าง prompt
- `js/api/geminiApi.js` - เชื่อมต่อ Gemini
- `js/api/imageUtils.js` - จัดการรูปภาพ
- `js/api/systemPrompt.js` - System prompt template
- `js/api/responseParser.js` - แปลง response

### 2. **TikTok Upload Flow**

```
┌────────────────┐
│ เลือกโหมด      │ (Product/Content/Warehouse/Burst)
└────────┬───────┘
         │
         ▼
┌────────────────┐
│ เลือกวิดีโอ    │ (Drag & Drop หรือ Browse)
└────────┬───────┘
         │
         ▼
┌────────────────┐
│ กรอกข้อมูล     │
│ - Caption      │
│ - Product ID   │ (Product Mode)
│ - Cart Name    │ (Product Mode)
│ - Schedule     │
└────────┬───────┘
         │
         ▼
┌────────────────┐
│ คลิก Start     │
└────────┬───────┘
         │
         ▼
┌────────────────────┐
│ ตรวจสอบ TikTok Tab │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ ส่ง Message        │
│ uploadToTikTok     │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Content Script     │
│ 1. Find Upload Btn │
│ 2. Trigger Upload  │
│ 3. Wait for Load   │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Fill Caption       │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐      Yes
│ Product Mode?      ├─────────┐
└────────┬───────────┘         │
         │ No                  ▼
         │              ┌────────────┐
         │              │ Pin Cart   │
         │              └────────┬───┘
         │                       │
         ◄───────────────────────┘
         │
         ▼
┌────────────────────┐      Yes
│ Schedule?          ├─────────┐
└────────┬───────────┘         │
         │ No                  ▼
         │              ┌────────────┐
         │              │ Set Time   │
         │              └────────┬───┘
         │                       │
         ◄───────────────────────┘
         │
         ▼
┌────────────────────┐
│ เสร็จสิ้น          │
└────────────────────┘
```

**ไฟล์ที่เกี่ยวข้อง:**
- `js/tabs/tiktokUploader.js` - ควบคุมการ upload
- `content/tiktok.js` - จัดการ DOM ของ TikTok

---

## 📁 โครงสร้างไฟล์

```
flowai/
├── manifest.json                 # Extension configuration
├── background.js                 # Background service worker
├── config.js                     # Global configuration
├── license.js                    # License validation
│
├── content/
│   └── tiktok.js                # Content script for TikTok
│
├── html/
│   ├── sidebar.html             # Main UI
│   ├── warehouse.html           # Product warehouse UI
│   └── prompt-warehouse.html    # Prompt warehouse UI
│
├── css/
│   ├── main.css                 # Main styles
│   ├── components.css           # Component styles
│   ├── tabs.css                 # Tab styles
│   ├── tiktok.css              # TikTok tab styles
│   └── warehouse.css           # Warehouse styles
│
├── js/
│   ├── sidebar.js              # Main controller
│   ├── warehouse.js            # Warehouse controller
│   ├── prompt-warehouse.js     # Prompt warehouse controller
│   │
│   ├── api/
│   │   ├── geminiApi.js        # Gemini API integration
│   │   ├── openaiApi.js        # OpenAI API integration
│   │   ├── imageUtils.js       # Image processing
│   │   ├── systemPrompt.js     # Prompt templates
│   │   └── responseParser.js   # Response parsing
│   │
│   ├── modules/
│   │   ├── imageUpload.js      # Image upload & crop
│   │   ├── promptGenerator.js  # Prompt generation
│   │   ├── productWarehouse.js # Product management
│   │   ├── videoStorage.js     # Video management
│   │   ├── promptStorage.js    # Prompt management
│   │   ├── settings.js         # Settings management
│   │   ├── burstMode.js        # Burst upload mode
│   │   ├── controls.js         # UI controls
│   │   ├── formState.js        # Form state management
│   │   └── ugcSection.js       # UGC settings
│   │
│   ├── tabs/
│   │   └── tiktokUploader.js   # TikTok upload logic
│   │
│   ├── utils/
│   │   ├── helpers.js          # Helper functions
│   │   └── storage.js          # Storage utilities
│   │
│   └── data/
│       ├── promptTemplates.js  # Image prompt templates
│       └── videoPromptTemplates.js # Video prompt templates
│
└── docs/
    ├── tiktok-post-workflow.md
    └── ARCHITECTURE_AND_DEBUG_GUIDE.md
```

---

## 📡 การสื่อสารระหว่าง Components

### Message Passing Architecture

```
Side Panel                  Background Worker              Content Script
    │                            │                              │
    │───sendMessage──────────────┼─────forward────────────────►│
    │   {action: "uploadToTikTok"}                             │
    │                            │                              │
    │                            │                              │
    │◄──────────────────────────┼────sendResponse──────────────│
    │   {success: true}          │                              │
```

### Message Types

#### 1. **uploadToTikTok**
```javascript
// Side Panel → Content Script
{
  action: 'uploadToTikTok',
  files: [
    {
      name: 'video.mp4',
      type: 'video/mp4',
      dataUrl: 'data:video/mp4;base64,...'
    }
  ]
}

// Response
{
  success: true,
  message: 'อัพโหลดสำเร็จ'
}
```

#### 2. **fillCaption**
```javascript
// Side Panel → Content Script
{
  action: 'fillCaption',
  caption: 'ข้อความ caption พร้อม hashtag'
}

// Response
{
  success: true,
  message: 'กรอก caption สำเร็จ'
}
```

#### 3. **pinCart**
```javascript
// Side Panel → Content Script
{
  action: 'pinCart',
  productId: '1234567890',
  cartName: 'ชื่อตะกร้า'
}

// Response
{
  success: true,
  message: 'ปักตะกร้าสำเร็จ'
}
```

#### 4. **schedulePost**
```javascript
// Side Panel → Content Script
{
  action: 'schedulePost',
  scheduleTime: '2024-01-15T14:30',
  postInterval: '0' // หรือ '30', '60', '120'
}

// Response
{
  success: true,
  message: 'ตั้งเวลาสำเร็จ'
}
```

#### 5. **scanProducts**
```javascript
// Side Panel → Content Script
{
  action: 'scanProducts'
}

// Response
{
  success: true,
  products: [
    {
      id: '1234567890',
      name: 'ชื่อสินค้า',
      price: '100.00',
      image: 'https://...'
    }
  ]
}
```

---

## 🚀 ขั้นตอนการ Upload ไป TikTok

### ขั้นตอนโดยละเอียด

#### **Step 1: Prepare Data (Side Panel)**
```javascript
// tiktokUploader.js
async runAutomation() {
  // 1. ตรวจสอบข้อมูล
  if (!this.files.length) {
    Helpers.showToast('กรุณาเลือกไฟล์วิดีโอ', 'error');
    return;
  }

  // 2. แปลงไฟล์เป็น base64 (เพื่อส่งผ่าน message)
  const filesData = await Promise.all(
    this.files.map(async (file) => ({
      name: file.name,
      type: file.type,
      dataUrl: await Helpers.fileToBase64Url(file)
    }))
  );

  // 3. ส่ง message ไป content script
  const result = await this.sendMessage(tab.id, {
    action: 'uploadToTikTok',
    files: filesData
  });
}
```

#### **Step 2: Upload Video (Content Script)**
```javascript
// content/tiktok.js
async function uploadToTikTok(filesData) {
  // 1. ตรวจสอบว่าอยู่ในหน้า upload
  if (!checkIfUploadPage()) {
    return { success: false, error: 'ไม่ได้อยู่ในหน้า upload' };
  }

  // 2. หา input element
  const uploadInput = findUploadInput();
  
  // 3. แปลง base64 กลับเป็น File objects
  const files = await Promise.all(filesData.map(async (fileData) => {
    const response = await fetch(fileData.dataUrl);
    const blob = await response.blob();
    return new File([blob], fileData.name, { type: fileData.type });
  }));

  // 4. สร้าง DataTransfer และ set files
  const dataTransfer = new DataTransfer();
  files.forEach(file => dataTransfer.items.add(file));
  uploadInput.files = dataTransfer.files;

  // 5. Trigger change event
  uploadInput.dispatchEvent(new Event('change', { bubbles: true }));

  // 6. รอให้วิดีโอโหลด
  await waitForVideoLoad();

  return { success: true, message: 'อัพโหลดสำเร็จ' };
}
```

#### **Step 3: Fill Caption**
```javascript
// content/tiktok.js
async function fillCaption(caption) {
  // 1. หา editor element
  const editor = findCaptionEditor();
  
  // 2. Focus editor
  editor.focus();
  await randomSleep(CONFIG.captionDelays.afterFocus);

  // 3. Clear existing text
  editor.innerHTML = '';

  // 4. Set new text
  editor.textContent = caption;

  // 5. Trigger input event
  editor.dispatchEvent(new Event('input', { bubbles: true }));

  return { success: true };
}
```

#### **Step 4: Pin Cart** (ถ้าเป็น Product Mode)
```javascript
// content/tiktok.js
async function pinCart(productId, cartName) {
  // Step 1: คลิกปุ่ม "Add product"
  const addProductBtn = findAddProductButton();
  addProductBtn.click();
  await randomSleep(CONFIG.delays.step1ToStep2);

  // Step 2: คลิกยืนยัน showcase
  const confirmBtn = findConfirmShowcaseButton();
  confirmBtn.click();
  await randomSleep(CONFIG.delays.step2ToStep3);

  // Step 2.5: คลิกแท็บ "Showcase products"
  const showcaseTab = findShowcaseTab();
  showcaseTab.click();
  await new Promise(r => setTimeout(r, 1500));

  // Step 3: กรอก Product ID
  const productIdInput = findProductIdInput();
  productIdInput.value = productId;
  productIdInput.dispatchEvent(new Event('input', { bubbles: true }));
  await randomSleep(CONFIG.delays.step3ToStep4);

  // Step 4: คลิกค้นหา
  const searchBtn = findSearchButton();
  searchBtn.click();
  await randomSleep(CONFIG.delays.step4ToStep5);

  // Step 5: เลือกสินค้า
  const productCard = findFirstProductCard();
  productCard.click();
  await randomSleep(CONFIG.delays.step5ToStep6);

  // Step 6: คลิก Next
  const nextBtn = findNextButton();
  nextBtn.click();
  await randomSleep(CONFIG.delays.step6ToStep7);

  // Step 7: กรอกชื่อตะกร้า
  const cartNameInput = findCartNameInput();
  cartNameInput.value = cartName;
  cartNameInput.dispatchEvent(new Event('input', { bubbles: true }));
  await randomSleep(CONFIG.delays.step7ToStep8);

  // Step 8: คลิกยืนยัน
  const confirmFinalBtn = findFinalConfirmButton();
  confirmFinalBtn.click();

  return { success: true, message: 'ปักตะกร้าสำเร็จ' };
}
```

#### **Step 5: Schedule Post** (ถ้ามีการตั้งเวลา)
```javascript
// content/tiktok.js
async function schedulePost(scheduleTime, postInterval) {
  // 1. คลิก "Schedule post" radio
  const scheduleRadio = findScheduleRadio();
  scheduleRadio.click();
  await new Promise(r => setTimeout(r, 500));

  // 2. คำนวณเวลา (บวก interval ถ้ามี)
  const targetTime = calculateScheduleTime(scheduleTime, postInterval);

  // 3. เลือกวันที่
  const dateInput = findDateInput();
  selectDate(dateInput, targetTime);

  // 4. เลือกเวลา
  const timeSelect = findTimeSelect();
  selectTime(timeSelect, targetTime);

  return { success: true };
}
```

---

## 🔍 Debug Tips

### 1. **Console Logging**

ทุกฟังก์ชันสำคัญมี console.log แล้ว สามารถเปิด DevTools ดูได้:

```javascript
// เปิด DevTools
// 1. Right-click บน extension sidebar → Inspect
// 2. เปิดแท็บ Console

// ดู logs ของ content script
// 1. เปิด TikTok page
// 2. F12 → Console
// 3. Filter ด้วย "[TikTok Unlocked]"
```

### 2. **Breakpoints**

ใช้ `debugger;` เพื่อหยุดโค้ด:

```javascript
async function uploadToTikTok(filesData) {
  debugger; // จะหยุดตรงนี้
  
  const uploadInput = findUploadInput();
  debugger; // หรือตรงนี้
  
  // ...
}
```

### 3. **Check Elements**

ใช้ตรวจสอบว่า selectors ยังใช้งานได้หรือไม่:

```javascript
// ใน Console ของ TikTok page
document.querySelector('.TUXButton-label:has-text("Add product")');
document.querySelector('#\\:r7k\\:'); // Product ID input
document.querySelector('.TUXModal-confirm-btn');
```

### 4. **Message Testing**

ทดสอบการส่ง message:

```javascript
// ใน sidebar console
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  chrome.tabs.sendMessage(tabs[0].id, {
    action: 'ping'
  }, (response) => {
    console.log('Response:', response);
  });
});
```

### 5. **Storage Inspection**

ดูข้อมูลใน storage:

```javascript
// ใน sidebar console
chrome.storage.local.get(null, (data) => {
  console.log('All storage:', data);
});

// ดูข้อมูลเฉพาะ key
chrome.storage.local.get(['products', 'videos'], (data) => {
  console.log('Products:', data.products);
  console.log('Videos:', data.videos);
});
```

### 6. **Common Issues**

#### ❌ "Cannot find upload input"
```javascript
// แก้ไข: ตรวจสอบว่า selectors ยังถูกต้อง
const selectors = [
  'input[type="file"]',
  '[data-e2e="upload-input"]',
  // เพิ่ม selectors ใหม่ตาม DOM ของ TikTok
];
```

#### ❌ "Caption not filling"
```javascript
// แก้ไข: เพิ่ม delay หรือใช้ method อื่น
editor.focus();
await new Promise(r => setTimeout(r, 200)); // เพิ่ม delay
editor.textContent = caption;
```

#### ❌ "Pin cart failed"
```javascript
// แก้ไข: ตรวจสอบแต่ละ step
console.log('Step 1:', findAddProductButton());
console.log('Step 2:', findConfirmShowcaseButton());
// ... ตรวจสอบทุก step
```

### 7. **Performance Monitoring**

```javascript
// วัดเวลาแต่ละ step
console.time('Upload');
await uploadToTikTok(files);
console.timeEnd('Upload'); // Upload: 2345ms

console.time('Pin Cart');
await pinCart(productId, cartName);
console.timeEnd('Pin Cart'); // Pin Cart: 8234ms
```

---

## 🌐 การต่อยอดไปแพลตฟอร์มอื่น

### สถาปัตยกรรมที่แนะนำ

```
flowai/
├── content/
│   ├── tiktok.js          # ของเดิม
│   ├── shopee.js          # สำหรับ Shopee
│   ├── facebook.js        # สำหรับ Facebook Reels
│   └── youtube.js         # สำหรับ YouTube Shorts
│
└── js/
    └── tabs/
        ├── tiktokUploader.js
        ├── shopeeUploader.js
        ├── facebookUploader.js
        └── youtubeUploader.js
```

### 1. **Shopee Live/Video**

#### ขั้นตอนการพัฒนา:

1. **สร้าง Content Script** (`content/shopee.js`)
```javascript
// shopee.js
(() => {
  console.log('[Shopee Uploader] Content script loaded');

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'uploadToShopee') {
      uploadToShopee(message.files)
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }

    if (message.action === 'addShopeeProduct') {
      addShopeeProduct(message.productId)
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;
    }
  });

  async function uploadToShopee(filesData) {
    // 1. ตรวจสอบว่าอยู่ในหน้า Shopee Live/Video upload
    if (!window.location.href.includes('shopee')) {
      return { success: false, error: 'Not on Shopee page' };
    }

    // 2. หา upload element
    // Shopee ใช้ <input type="file"> ซ่อนอยู่
    const uploadInput = document.querySelector('input[type="file"][accept*="video"]');
    
    // 3. Set files
    const files = await convertBase64ToFiles(filesData);
    const dataTransfer = new DataTransfer();
    files.forEach(file => dataTransfer.items.add(file));
    uploadInput.files = dataTransfer.files;
    
    // 4. Trigger event
    uploadInput.dispatchEvent(new Event('change', { bubbles: true }));
    
    // 5. รอให้โหลด
    await waitForUpload();
    
    return { success: true };
  }

  async function addShopeeProduct(productId) {
    // 1. คลิกปุ่ม "เพิ่มสินค้า"
    const addBtn = document.querySelector('[data-testid="add-product-btn"]');
    addBtn.click();
    await new Promise(r => setTimeout(r, 1000));

    // 2. ค้นหาสินค้า
    const searchInput = document.querySelector('input[placeholder*="ค้นหา"]');
    searchInput.value = productId;
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 1500));

    // 3. เลือกสินค้า
    const productCard = document.querySelector('.product-card');
    productCard.click();

    // 4. ยืนยัน
    const confirmBtn = document.querySelector('button[type="submit"]');
    confirmBtn.click();

    return { success: true };
  }
})();
```

2. **อัปเดต manifest.json**
```json
{
  "content_scripts": [
    {
      "matches": ["https://*.tiktok.com/*"],
      "js": ["content/tiktok.js"]
    },
    {
      "matches": ["https://*.shopee.co.th/*", "https://*.shopee.com/*"],
      "js": ["content/shopee.js"]
    }
  ]
}
```

3. **สร้าง Uploader Module** (`js/tabs/shopeeUploader.js`)
```javascript
const ShopeeUploader = {
  async upload(files, caption, productId) {
    // 1. หา Shopee tab
    const tabs = await chrome.tabs.query({ url: '*://shopee.co.th/*' });
    
    if (tabs.length === 0) {
      return { success: false, error: 'Please open Shopee upload page' };
    }

    // 2. Upload video
    const uploadResult = await chrome.tabs.sendMessage(tabs[0].id, {
      action: 'uploadToShopee',
      files: files
    });

    if (!uploadResult.success) return uploadResult;

    // 3. Add product (ถ้ามี)
    if (productId) {
      const productResult = await chrome.tabs.sendMessage(tabs[0].id, {
        action: 'addShopeeProduct',
        productId: productId
      });
      if (!productResult.success) return productResult;
    }

    return { success: true, message: 'อัปโหลด Shopee สำเร็จ' };
  }
};
```

### 2. **Facebook Reels**

```javascript
// content/facebook.js
async function uploadToFacebookReels(filesData) {
  // 1. หา Reels upload area
  const uploadArea = document.querySelector('[aria-label*="Create reel"]');
  uploadArea.click();
  await new Promise(r => setTimeout(r, 1000));

  // 2. Upload video
  const fileInput = document.querySelector('input[type="file"][accept*="video"]');
  // ... similar to TikTok

  // 3. Fill caption
  const captionBox = document.querySelector('[contenteditable="true"]');
  captionBox.textContent = caption;

  return { success: true };
}
```

### 3. **YouTube Shorts**

```javascript
// content/youtube.js
async function uploadToYouTubeShorts(filesData) {
  // YouTube Shorts ใช้ YouTube Studio
  // URL: https://studio.youtube.com/
  
  // 1. คลิก "Create" → "Upload videos"
  const createBtn = document.querySelector('[aria-label="Create"]');
  createBtn.click();
  await new Promise(r => setTimeout(r, 500));

  const uploadBtn = document.querySelector('[test-id="upload-videos"]');
  uploadBtn.click();

  // 2. Select file
  const fileInput = document.querySelector('input[type="file"]');
  // ...

  // 3. Mark as "Short"
  const shortCheckbox = document.querySelector('[aria-label*="Short"]');
  shortCheckbox.click();

  return { success: true };
}
```

### เปรียบเทียบแพลตฟอร์ม

| Feature | TikTok | Shopee | Facebook Reels | YouTube Shorts |
|---------|--------|--------|----------------|----------------|
| Upload Method | File Input | File Input | File Input | File Input |
| Caption | innerHTML | Input field | contenteditable | Textarea |
| Product Link | Pin Cart API | Add Product | Tag Product | Link in description |
| Schedule | Built-in | Limited | Built-in | Built-in |
| Video Length | 10 min | 1 min | 90 sec | 60 sec |

### กลยุทธ์การพัฒนา

#### 1. **สร้าง Base Class**
```javascript
// js/tabs/baseUploader.js
class BaseUploader {
  constructor(platform) {
    this.platform = platform;
    this.files = [];
  }

  async findUploadInput() {
    // Override ในแต่ละ platform
  }

  async uploadFiles(files) {
    // Common upload logic
    const filesData = await this.convertToBase64(files);
    const tabs = await this.findPlatformTab();
    return await this.sendUploadMessage(tabs[0].id, filesData);
  }

  async fillCaption(caption) {
    // Common caption logic
  }

  async addProduct(productId) {
    // Override ในแต่ละ platform
  }
}

// Extend for each platform
class TikTokUploader extends BaseUploader {
  constructor() {
    super('tiktok');
  }

  async addProduct(productId) {
    // TikTok specific pin cart logic
  }
}

class ShopeeUploader extends BaseUploader {
  constructor() {
    super('shopee');
  }

  async addProduct(productId) {
    // Shopee specific add product logic
  }
}
```

#### 2. **Unified UI**
```html
<!-- เพิ่ม Platform Selector -->
<div class="platform-selector">
  <label>
    <input type="radio" name="platform" value="tiktok" checked>
    TikTok
  </label>
  <label>
    <input type="radio" name="platform" value="shopee">
    Shopee
  </label>
  <label>
    <input type="radio" name="platform" value="facebook">
    Facebook Reels
  </label>
  <label>
    <input type="radio" name="platform" value="youtube">
    YouTube Shorts
  </label>
</div>
```

#### 3. **Configuration per Platform**
```javascript
// config.js
const PLATFORM_CONFIG = {
  tiktok: {
    uploadUrl: '*://*.tiktok.com/creator*',
    maxVideos: 1,
    maxDuration: 600, // 10 min
    captionMaxLength: 2200,
    selectors: {
      uploadInput: 'input[type="file"]',
      captionEditor: '.DraftEditor-root'
    }
  },
  shopee: {
    uploadUrl: '*://shopee.co.th/seller/*',
    maxVideos: 1,
    maxDuration: 60, // 1 min
    captionMaxLength: 500,
    selectors: {
      uploadInput: 'input[accept*="video"]',
      captionEditor: 'textarea[name="description"]'
    }
  },
  // ...
};
```

### ข้อควรระวัง

1. **DOM Structure เปลี่ยนบ่อย**
   - Facebook, TikTok อัปเดต UI บ่อย
   - ต้อง maintain selectors ให้อัปเดตอยู่เสมอ
   - แนะนำใช้ multiple fallback selectors

2. **Rate Limiting**
   - แต่ละแพลตฟอร์มมี rate limit
   - ควรเพิ่ม delay ระหว่าง uploads
   - TikTok: ~10-15 วิดีโอ/ชั่วโมง
   - YouTube: ~10 วิดีโอ/วัน (สำหรับ account ใหม่)

3. **Video Requirements**
   - แต่ละแพลตฟอร์มมีข้อกำหนดต่างกัน
   - ควรมี video validator ก่อน upload
   - Transcode ถ้าจำเป็น

4. **Authentication**
   - ต้อง login ไว้ในแต่ละแพลตฟอร์ม
   - ไม่สามารถ automate login ได้ (security)
   - ควรมีการ detect session expired

---

## 🛠 Development Roadmap

### Phase 1: Core Enhancement
- [ ] Improve error handling
- [ ] Add retry mechanism
- [ ] Better logging system
- [ ] Performance optimization

### Phase 2: Shopee Integration
- [ ] Shopee content script
- [ ] Shopee uploader module
- [ ] Product linking
- [ ] Testing

### Phase 3: Facebook Reels
- [ ] Facebook content script
- [ ] Reels uploader module
- [ ] Product tagging
- [ ] Testing

### Phase 4: YouTube Shorts
- [ ] YouTube content script
- [ ] Shorts uploader module
- [ ] Description formatting
- [ ] Testing

### Phase 5: Multi-Platform
- [ ] Unified uploader interface
- [ ] Cross-platform scheduling
- [ ] Analytics dashboard
- [ ] Bulk operations

---

## 📚 Resources

### Documentation
- [Chrome Extension APIs](https://developer.chrome.com/docs/extensions/)
- [Content Scripts](https://developer.chrome.com/docs/extensions/mv3/content_scripts/)
- [Message Passing](https://developer.chrome.com/docs/extensions/mv3/messaging/)

### Platform APIs
- [TikTok Business API](https://business-api.tiktok.com/)
- [Facebook Graph API](https://developers.facebook.com/docs/graph-api/)
- [YouTube Data API](https://developers.google.com/youtube/v3)
- [Shopee Open Platform](https://open.shopee.com/)

### Tools
- Chrome DevTools
- [Selector Gadget](https://selectorgadget.com/)
- [JSONView](https://chrome.google.com/webstore/detail/jsonview/)

---

## 🤝 Contributing

หากต้องการพัฒนาต่อ:

1. Clone repository
2. แก้ไขโค้ดตามโครงสร้างที่กำหนด
3. ทดสอบบน Chrome
4. Submit changes

---

## 📝 License

Flow AI Unlocked - Proprietary License
© 2024-2026 All Rights Reserved

---

**สร้างโดย:** Flow AI Team  
**วันที่อัปเดต:** 3 มกราคม 2026  
**เวอร์ชัน:** 3.2
