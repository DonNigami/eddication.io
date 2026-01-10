# Phase 2: Shopee Integration - Complete ✅

## Overview
Phase 2 เพิ่มการรองรับ Shopee Video/Live เข้ามาใน Flow AI แล้ว ตอนนี้สามารถ upload วิดีโอไปยัง Shopee Seller Center ได้

---

## What's New

### 1. Shopee Content Script

#### **content/platforms/shopeeSelectors.js**
- DOM selectors สำหรับ Shopee Seller Center
- รองรับหลาย selectors เผื่อ UI เปลี่ยน
- Helper functions: `findElement()`, `waitForElement()`
- **NOTE:** Selectors เป็น placeholder ต้องทดสอบบน Shopee จริง

#### **content/platforms/shopee.js**
- Content script สำหรับ Shopee
- Functions:
  - `uploadToShopee()` - Upload video
  - `fillShopeeCaption()` - Fill title/caption
  - `linkShopeeProduct()` - Link product to video
  - `publishShopeeVideo()` - Publish immediately
- Message handlers สำหรับติดต่อกับ extension

### 2. Shopee Uploader Module

#### **js/platforms/shopeeUploader.js**
- ShopeeUploader class extends BaseUploader
- Methods implemented:
  - `uploadVideo()` - Upload with validation
  - `fillCaption()` - Max 500 characters
  - `addProduct()` - Product linking (may not be available)
  - `schedulePost()` - Not supported, publishes immediately
  - `publishVideo()` - Publish video
  - `uploadComplete()` - Full workflow
  - `uploadBatch()` - Sequential only

### 3. Configuration Updates

#### **manifest.json**
- เพิ่ม content script สำหรับ Shopee
- Matches: `seller.shopee.co.th`, `.com`, `.com.my`

#### **js/platforms/index.js**
- Import และ register ShopeeUploader
- Auto-initialize เมื่อ extension โหลด

---

## How to Use

### Basic Usage - Upload to Shopee

```javascript
// Get Shopee uploader
import { getUploader } from './js/platforms/index.js';

const shopeeUploader = await getUploader('shopee');

// Upload video
await shopeeUploader.uploadVideo(videoFile);

// Fill caption/title
await shopeeUploader.fillCaption('สินค้าดีมาก ราคาถูก #shopee');

// Add product (may not work on all Shopee versions)
await shopeeUploader.addProduct('123456');

// Publish immediately (Shopee doesn't support scheduling)
await shopeeUploader.publishVideo();

// Or use complete workflow
await shopeeUploader.uploadComplete({
  file: videoFile,
  caption: 'สินค้าดีมาก ราคาถูก #shopee',
  productId: '123456'
});
```

### Using Platform Adapter

```javascript
// Switch to Shopee
await window.PlatformAdapter.switchPlatform('shopee');

// Upload
await window.PlatformAdapter.uploadComplete({
  file: videoFile,
  caption: 'My Shopee video',
  productId: '123456'
});
```

### Batch Upload to Shopee

```javascript
const uploads = [
  { file: video1, caption: 'Product 1', productId: '111' },
  { file: video2, caption: 'Product 2', productId: '222' },
  { file: video3, caption: 'Product 3', productId: '333' }
];

// Shopee only supports sequential (one by one)
const results = await shopeeUploader.uploadBatch(uploads, 'sequential');

console.log(`Uploaded ${results.filter(r => r.success).length} videos to Shopee`);
```

### Platform Detection

```javascript
import PlatformRegistry from './js/platforms/platformRegistry.js';

// Detect platform from URL
const detected = await PlatformRegistry.detectPlatformFromUrl(
  'https://seller.shopee.co.th/portal/video'
);

if (detected) {
  console.log(`Platform: ${detected.platform}`); // 'shopee'
  const uploader = detected.uploader;
  // Use uploader...
}
```

---

## Shopee vs TikTok Comparison

| Feature | TikTok | Shopee |
|---------|--------|--------|
| **Max Video Size** | 2 GB | 100 MB |
| **Max Duration** | 10 min | 60 sec |
| **Caption Length** | 2,200 chars | 500 chars |
| **Product Linking** | ✅ Pin Cart | ⚠️ May vary |
| **Scheduling** | ✅ Yes | ❌ No |
| **Batch Upload** | Sequential/Parallel | Sequential only |
| **Aspect Ratio** | 9:16 preferred | 9:16 required |

---

## Configuration

### Video Requirements (Shopee)

```javascript
{
  maxSize: 100 * 1024 * 1024,  // 100MB
  maxDuration: 60,              // 60 seconds
  minDuration: 1,               // 1 second
  formats: ['mp4', 'mov'],
  aspectRatio: '9:16',
  minWidth: 720,
  minHeight: 1280,
  maxWidth: 1920,
  maxHeight: 1920
}
```

### Caption Requirements

```javascript
{
  maxLength: 500,         // 500 characters
  maxHashtags: 10,
  maxMentions: 0
}
```

---

## Testing Guide

### ⚠️ Important: Selectors Need Verification

Shopee selectors เป็น **placeholder** และต้อง**ทดสอบบนเว็บจริง** ก่อนใช้งาน:

#### Step 1: Open Shopee Seller Center
1. ไปที่ https://seller.shopee.co.th/
2. Login with seller account
3. Navigate to Video section

#### Step 2: Inspect Elements
1. เปิด Chrome DevTools (F12)
2. Click Elements tab
3. Use Element Picker (Ctrl+Shift+C)
4. Click on upload button, caption field, etc.
5. จดบันทึก selectors ที่ถูกต้อง

#### Step 3: Update Selectors
1. แก้ไขไฟล์ `content/platforms/shopeeSelectors.js`
2. Update selector arrays
3. Test ด้วย console: `document.querySelector('your-selector')`

#### Step 4: Test Upload Flow
1. โหลด extension ใน Chrome (Developer mode)
2. เปิด Shopee Seller Center
3. เปิด sidebar extension
4. ลองใช้ PlatformAdapter upload
5. ดู console logs (`[Shopee]` prefix)

### Manual Testing Checklist

- [ ] Shopee content script loads on seller.shopee.co.th
- [ ] File input found and clickable
- [ ] Video upload starts
- [ ] Upload progress detected
- [ ] Caption field found and fillable
- [ ] Product linking works (if available)
- [ ] Publish button works
- [ ] Complete workflow works end-to-end

---

## Known Limitations

### 1. **Selectors Not Verified**
- All selectors are placeholders
- Need testing on actual Shopee Seller Center
- May need updates when Shopee UI changes

### 2. **Product Linking Uncertain**
- Shopee may or may not have product linking for videos
- Implementation tries but doesn't fail if not available
- Logs warning instead of throwing error

### 3. **No Scheduling**
- Shopee doesn't support scheduled posts for videos
- `schedulePost()` publishes immediately instead

### 4. **Sequential Upload Only**
- Shopee likely has rate limits
- Batch upload uses sequential mode only
- 5-7 second delay between uploads

### 5. **Regional Differences**
- Different Shopee regions (.th, .com, .com.my) may have different UIs
- Selectors may need regional variations

---

## Troubleshooting

### Issue: "File input not found"
**Solution:**
1. Check if on correct page (seller.shopee.co.th/portal/video)
2. Inspect page and update `ShopeeSelectors.fileInput`
3. Try clicking upload button first

### Issue: "Caption field not found"
**Solution:**
1. Wait for upload to complete first
2. Check if caption field appears after upload
3. Update `ShopeeSelectors.captionField`

### Issue: "Product linking failed"
**Solution:**
- This is expected if Shopee doesn't support product linking
- Check logs for warning message
- Video will still upload without product

### Issue: "Upload timeout"
**Solution:**
- Check video size (max 100MB)
- Check internet connection
- Increase timeout in `waitForUploadComplete()`

---

## File Structure

```
flowai-dev/
├── content/
│   └── platforms/
│       ├── tiktok.js
│       ├── shopee.js                    ✨ NEW
│       └── shopeeSelectors.js           ✨ NEW
├── js/
│   └── platforms/
│       ├── baseUploader.js
│       ├── platformConfig.js
│       ├── platformRegistry.js
│       ├── tiktokUploader.js
│       ├── shopeeUploader.js            ✨ NEW
│       └── index.js                     ✅ Updated
├── manifest.json                        ✅ Updated
└── docs/
    ├── PHASE_1_COMPLETE.md
    └── PHASE_2_SHOPEE.md                📄 This file
```

---

## Next Steps: Phase 3

### Phase 3: Facebook Reels Integration (Week 5-6)

**Tasks:**
1. Research Facebook Reels upload flow
2. Create `content/platforms/facebook.js`
3. Create `js/platforms/facebookUploader.js`
4. Handle dynamic class names
5. Handle contenteditable fields

**Challenges:**
- Facebook uses dynamic class names
- Need to use data attributes or aria-labels
- Contenteditable div for caption (not input/textarea)
- Product tagging more complex

---

## API Reference

### ShopeeUploader Class

```javascript
class ShopeeUploader extends BaseUploader {
  // Find Shopee seller tab
  async findUploadButton(): Promise<Tab>
  
  // Upload video (max 100MB, 60 sec)
  async uploadVideo(file: File): Promise<Result>
  
  // Fill caption (max 500 chars)
  async fillCaption(caption: string): Promise<Result>
  
  // Add product (may not be available)
  async addProduct(productId: string): Promise<Result>
  
  // Publish immediately (no scheduling)
  async schedulePost(scheduleTime: any): Promise<Result>
  async publishVideo(): Promise<Result>
  
  // Complete workflow
  async uploadComplete(options: {
    file: File,
    caption?: string,
    productId?: string
  }): Promise<Result>
  
  // Batch upload (sequential only)
  async uploadBatch(
    uploads: Array<Options>,
    mode: 'sequential'
  ): Promise<Array<Result>>
  
  // Get video requirements
  getVideoRequirements(): Requirements
  
  // Check if on seller page
  async checkIfSellerPage(tabId: number): Promise<boolean>
}
```

---

## Support

### Debug Logs
ดู console logs ที่มี prefix `[Shopee]`:
```javascript
[Shopee] Content script loaded
[Shopee] Starting video upload...
[Shopee] Looking for file input...
[Shopee] File input found
[Shopee] Files set, waiting for upload...
[Shopee] Upload completed
```

### Common Errors
- `Not on Shopee seller page` - Navigate to seller.shopee.co.th first
- `File input not found` - Update selectors
- `Upload timeout` - Check video size/connection
- `Product linking may not be available` - Expected, continue

---

**Status:** ✅ Phase 2 Complete (3 Jan 2026)  
**Next Phase:** Phase 3 - Facebook Reels Integration  
**Version:** 4.0-dev  
**Platforms:** TikTok ✅ | Shopee ✅ | Facebook ⏳ | YouTube ⏳
