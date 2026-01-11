# 🎬 Roadmap: Viral Clips & Shopping Basket Automation (Phase 2.0)

## 📊 System Overview

ระบบปัจจุบัน **Eddication Flow AI** สามารถ:
- ✅ สร้าง AI Story อัตโนมัติ (ตั้งแต่ scene → image → video)
- ✅ สร้างจากข้อมูลตัวละคร + Template Prompts
- ✅ Extend Scene สำหรับเพิ่มฉากลงใน Google Flow
- ✅ Multi-platform uploader (TikTok, Shopee, YouTube, Facebook)

---

## 🎯 Phase 2.0: Viral Clips & Basket Integration

### ภารกิจหลัก 3 ประการ:
1. **🎬 Auto Viral Clips Generator** - สร้างคลิปไวรัล (10-60 วินาที)
2. **🛒 Shopping Basket Clips** - คลิปปักตระกร้า/ขายของ
3. **📐 Multi-Format Support** - Vertical (9:16) + Horizontal (16:9)

---

## 📋 Feature Roadmap

### **Week 1-2: Viral Clips Architecture**

#### 1.1 Create "Viral Clips" Tab
**File:** `html/sidebar.html` (New section)
**Components:**
```html
<!-- Viral Clips Section -->
<div class="tab-content" id="tab-viral-clips">
  <section class="section" id="viralClipsSection">
    <h2>🎬 Viral Clips Generator</h2>
    
    <!-- Format Selector -->
    <div class="format-selector">
      <label>📐 ขนาดคลิป</label>
      <div class="radio-group">
        <label><input type="radio" name="clipFormat" value="vertical" checked> 📱 ตั้งแต่ (9:16)</label>
        <label><input type="radio" name="clipFormat" value="horizontal"> 📺 แนวนอน (16:9)</label>
      </div>
    </div>

    <!-- Hook Type Selector -->
    <div class="form-group">
      <label>🎣 ประเภท Hook</label>
      <select id="viralHookType">
        <option value="surprise">🤯 ประทับใจ (Surprise)</option>
        <option value="trending">🔥 ลาดนิยม (Trending)</option>
        <option value="emotional">❤️ อารมณ์ (Emotional)</option>
        <option value="tutorial">📚 สอน (Tutorial)</option>
        <option value="mystery">🔍 ลึกลับ (Mystery)</option>
        <option value="comparison">⚖️ เปรียบเทียบ (Comparison)</option>
      </select>
    </div>

    <!-- Duration -->
    <div class="form-group">
      <label>⏱️ ความยาว</label>
      <select id="viralClipDuration">
        <option value="15">15 วินาที</option>
        <option value="30" selected>30 วินาที</option>
        <option value="60">60 วินาที</option>
      </select>
    </div>

    <!-- Viral Algorithm Settings -->
    <div class="form-group">
      <label>⚙️ Viral Settings</label>
      <label class="checkbox">
        <input type="checkbox" id="enableHookOpening" checked>
        🎯 Hook ตั้งแต่วินาที 0-3
      </label>
      <label class="checkbox">
        <input type="checkbox" id="enableCaptions" checked>
        📝 เพิ่มคำบรรยาย
      </label>
      <label class="checkbox">
        <input type="checkbox" id="enableTransitions" checked>
        ✨ เพิ่ม Transition
      </label>
      <label class="checkbox">
        <input type="checkbox" id="enableTrendingAudio">
        🎵 ใช้เสียง Trending
      </label>
    </div>

    <!-- Generate Button -->
    <button id="generateViralClipsBtn" class="btn btn-primary">
      🚀 สร้างคลิปไวรัล
    </button>
  </section>
</div>
```

#### 1.2 Create Viral Clips Module
**File:** `js/modules/viralClipsGenerator.js` (New)

**Key Methods:**
```javascript
class ViralClipsGenerator {
  // Core methods
  async generateViralScripts(topic, hookType, duration, format)
  async generateViralPrompts(script, clipFormat)
  async createHookOpeningPrompt(topic, hookType, format)
  async addCaptions(videoPrompt, keyMessages)
  async optimizeForVirality(prompt, platform)
  
  // Hooks library
  getHookTemplates(hookType)
  generateHookLine(hookType, topic)
  
  // Format conversion
  convertTo9_16(prompt)
  convertTo16_9(prompt)
  
  // Platform optimization
  optimizeForTikTok(prompt)
  optimizeForInstagram(prompt)
  optimizeForShorts(prompt)
}
```

**Viral Hooks Library:**
```javascript
const VIRAL_HOOKS = {
  surprise: [
    "Wait for the end...",
    "You won't believe what happens next",
    "ฉันแปลกใจ...",
    "สิ่งนี้เปลี่ยนทุกอย่าง"
  ],
  trending: [
    "#viral #foryou #trending",
    "POV: คุณเห็นสิ่งนี้ตอนเช้า",
    "Everyone is talking about..."
  ],
  emotional: [
    "นี่คือเหตุผลที่...",
    "This changed my life",
    "You need to see this"
  ]
}
```

---

### **Week 3-4: Shopping Basket Clips**

#### 2.1 Create "Basket Clips" Tab
**File:** `html/sidebar.html` (New section)

**Components:**
```html
<!-- Shopping Basket Clips Section -->
<div class="tab-content" id="tab-basket-clips">
  <section class="section" id="basketClipsSection">
    <h2>🛒 Shopping Basket Clips</h2>
    
    <!-- Product Integration -->
    <div class="form-group">
      <label>📦 เลือกสินค้า</label>
      <select id="basketProductSelect">
        <option value="">-- ดึงจากคลัง --</option>
      </select>
    </div>

    <!-- Basket Actions -->
    <div class="form-group">
      <label>🎬 ประเภทการปักตระกร้า</label>
      <div class="radio-group">
        <label><input type="radio" name="basketType" value="addCart"> 🛍️ เพิ่มตะกร้า</label>
        <label><input type="radio" name="basketType" value="checkout"> 💳 ชำระเงิน</label>
        <label><input type="radio" name="basketType" value="comparison"> ⚖️ เปรียบเทียบ</label>
        <label><input type="radio" name="basketType" value="review"> ⭐ รีวิว</label>
      </div>
    </div>

    <!-- Multi-angle Recording -->
    <div class="form-group">
      <label>📹 มุมกล้อง</label>
      <div class="checkbox-group">
        <label><input type="checkbox" value="product"> 📦 ชิดชื่อสินค้า</label>
        <label><input type="checkbox" value="process"> 👆 กระบวนการ</label>
        <label><input type="checkbox" value="reaction"> 😊 ปฏิกิริยา</label>
        <label><input type="checkbox" value="before_after"> ⬅️➡️ Before/After</label>
      </div>
    </div>

    <!-- Pricing Display -->
    <div class="form-group">
      <label>💰 แสดงราคา</label>
      <label class="checkbox">
        <input type="checkbox" id="showPrice" checked>
        แสดงราคาเดิม + ลด
      </label>
      <label class="checkbox">
        <input type="checkbox" id="showDiscount" checked>
        ไฮไลท์ส่วนลด (%)
      </label>
    </div>

    <!-- CTA Buttons -->
    <div class="form-group">
      <label>🔗 Call-to-Action</label>
      <select id="basketCTA">
        <option value="link_in_bio">🔗 Link in Bio</option>
        <option value="shop_now">🛒 Shop Now</option>
        <option value="limited_time">⏰ Limited Time</option>
        <option value="exclusive_deal">👑 Exclusive</option>
      </select>
    </div>

    <!-- Generate Button -->
    <button id="generateBasketClipsBtn" class="btn btn-primary">
      🎬 สร้างคลิปปักตระกร้า
    </button>
  </section>
</div>
```

#### 2.2 Create Basket Clips Module
**File:** `js/modules/basketClipsGenerator.js` (New)

**Key Methods:**
```javascript
class BasketClipsGenerator {
  // Basket automation
  async generateBasketPrompt(product, basketType, angles, format)
  async generateCheckoutFlow(product, paymentMethod)
  async generateComparisonClips(products, format)
  
  // Product integration
  async fetchProductData(productId)
  async extractProductFeatures(product)
  async calculateDiscountPercentage(originalPrice, sellingPrice)
  
  // Basket interactions
  async simulateAddToCart(product)
  async simulateCheckout(product)
  async recordBasketAnimation(product)
  
  // CTA Generation
  generateCTAPrompt(ctaType, product)
  
  // Multi-angle recording
  generateMultiAngleScript(product, angles)
}
```

**Basket Prompt Templates:**
```javascript
const BASKET_PROMPTS = {
  addCart: {
    vertical: "ฉากที่ 1: ใจดีใจช่วย {{productName}} ใส่ตะกร้า\nแสดงราคา: {{discountedPrice}} (ลด {{discount}}%)\nที่นี่ครับ: {{ctaText}}",
    horizontal: "วิดีโอแนวนอน: ... [similar]"
  },
  checkout: {
    vertical: "ฉากที่ 1: ขั้นตอนอย่างง่าย\nฉากที่ 2: ป้อนที่อยู่\n...",
    horizontal: "..."
  }
}
```

---

### **Week 5-6: Multi-Format Automation**

#### 3.1 Create Format Converter Module
**File:** `js/modules/formatConverter.js` (New)

**Responsibilities:**
```javascript
class FormatConverter {
  // Conversion logic
  convertPrompt_9_16_to_16_9(prompt)
  convertPrompt_16_9_to_9_16(prompt)
  
  // Aspect ratio calculation
  calculateOptimalLayout(format, contentType)
  
  // Platform presets
  getFormatPresets(platform)
  
  // Automatic reframing
  generateReframedPrompt(originalPrompt, targetFormat)
  
  // Quality preservation
  optimizeResolution(format)
  
  // Batch conversion
  convertMultipleFormats(prompts, formats)
}
```

**Format Specifications:**
```javascript
const FORMAT_SPECS = {
  vertical: {
    ratio: "9:16",
    resolution: "1080x1920",
    platforms: ["TikTok", "Instagram Reels", "YouTube Shorts"],
    margins: "safe area 40px",
    textPosition: "center",
    hookPlacement: "top 0-3s"
  },
  horizontal: {
    ratio: "16:9",
    resolution: "1920x1080",
    platforms: ["YouTube", "Facebook", "Twitter"],
    margins: "safe area 60px",
    textPosition: "bottom",
    hookPlacement: "center 0-5s"
  }
}
```

#### 3.2 Batch Generation for Multi-Format
**File:** `js/modules/batchMultiFormatGenerator.js` (New)

**Key Methods:**
```javascript
class BatchMultiFormatGenerator {
  async generateMultiFormatBatch(config) {
    // Generate viral clips for multiple formats
    // config = {
    //   topic, hookType, duration,
    //   formats: ['vertical', 'horizontal'],
    //   platforms: ['TikTok', 'YouTube', 'Facebook']
    // }
  }
  
  async generateBasketClipsAllFormats(product, formats)
  
  async optimizePerPlatform(prompt, platform, format)
  
  // Batch automation
  async runBatchAutomation(configs)
}
```

---

### **Week 7: Integration & Automation Orchestration**

#### 4.1 Create Master Automation Controller
**File:** `js/modules/automationOrchestrator.js` (New)

**Purpose:** Central hub สำหรับสร้าง content แบบ multi-format ครบวงจร

```javascript
class AutomationOrchestrator {
  async orchestrateFullContent(config) {
    // 1. Generate viral scripts
    // 2. Create baskets animations
    // 3. Convert to multi-formats
    // 4. Generate prompts for each format
    // 5. Auto-upload to each platform
  }
  
  async generateContentFlow(topic) {
    // Workflow:
    // topic → viral scripts → prompts → images → videos → upload
  }
  
  // Queue management
  addToQueue(job)
  processQueue()
  
  // Progress tracking
  trackProgress(jobId)
  
  // Error recovery
  retryFailedJobs()
}
```

#### 4.2 Create Advanced Scheduling
**File:** `js/modules/contentScheduler.js` (New)

**Features:**
```javascript
class ContentScheduler {
  // Schedule posts
  schedulePostToTikTok(video, datetime, timezone)
  schedulePostToYoutube(video, datetime, publishType)
  scheduleMultiPlatform(video, platforms, schedule)
  
  // Batch scheduling
  scheduleBatch(videos, startTime, interval)
  
  // Optimal posting times
  getOptimalPostingTime(platform, audienceTimezone)
  
  // Queue visualization
  getSchedulePreview()
}
```

---

## 🏗️ Implementation Architecture

### Database Schema Extensions (Supabase)

```sql
-- Viral Clips Management
CREATE TABLE viral_clips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users,
  topic TEXT NOT NULL,
  hook_type VARCHAR(50),
  duration INT,
  format VARCHAR(20), -- 'vertical' or 'horizontal'
  prompts JSONB,
  generated_videos JSONB,
  viral_score INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Shopping Basket Clips
CREATE TABLE basket_clips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users,
  product_id TEXT NOT NULL,
  basket_type VARCHAR(50),
  angles JSONB,
  generated_videos JSONB,
  conversion_rate DECIMAL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Multi-Format Conversions
CREATE TABLE format_conversions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  original_prompt TEXT,
  vertical_9_16 TEXT,
  horizontal_16_9 TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Scheduled Posts
CREATE TABLE scheduled_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users,
  video_id TEXT NOT NULL,
  platform VARCHAR(50),
  scheduled_time TIMESTAMP,
  status VARCHAR(20), -- 'pending', 'posted', 'failed'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Analytics
CREATE TABLE viral_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  video_id TEXT NOT NULL,
  platform VARCHAR(50),
  views INT,
  likes INT,
  shares INT,
  comments INT,
  ctr DECIMAL, -- Click-through rate
  tracked_at TIMESTAMP
);
```

### API Endpoints (Backend)

```javascript
// New endpoints in backend/server.js

// Viral Clips
POST /api/viral-clips/generate
GET /api/viral-clips/:id
DELETE /api/viral-clips/:id

// Basket Clips
POST /api/basket-clips/generate
GET /api/basket-clips/:productId
POST /api/basket-clips/simulate-checkout

// Format Conversion
POST /api/convert/9-16-to-16-9
POST /api/convert/batch-multi-format

// Scheduling
POST /api/schedule/post
GET /api/schedule/queue
PATCH /api/schedule/:id

// Analytics
GET /api/analytics/viral-score/:videoId
GET /api/analytics/platform/:platform
```

---

## 🎨 UI/UX Enhancements

### New Tab Icons & Structure
```
Current Tabs:
  AI Reviews | AI Story | TikTok | Warehouse | Extend Scene

New Tabs (Phase 2.0):
  AI Reviews | AI Story | 🎬 Viral Clips | 🛒 Basket Clips | TikTok | Warehouse | Extend Scene
```

### Dashboard Enhancements
**New Widget: Content Pipeline Dashboard**
```
┌─────────────────────────────────┐
│ 📊 Content Pipeline Status      │
├─────────────────────────────────┤
│ 🎬 Viral Clips       [████  ] 40%│
│ 🛒 Basket Clips      [██    ] 20%│
│ 📐 Format Convert    [███   ] 30%│
│ 📤 Upload Queue      [██████] 100%│
└─────────────────────────────────┘
```

---

## 📈 Performance Metrics

### Success Indicators
- **Viral Clip CTR**: Target 5-10% engagement rate
- **Basket Clip Conversion**: Target 2-5% add-to-cart rate
- **Multi-format ROI**: 40% time savings vs manual creation
- **Automation Efficiency**: 10 videos/hour vs 2-3 videos/hour manually

---

## 🔄 Content Flow (Complete)

```
PHASE 1 (Current):
Topic → Scenes → AI Story → Video → Upload

PHASE 2.0 (Proposed):
┌─ Viral Clips
│  ├─ Hook Generator → Script → Prompts → Images → Videos
│  ├─ Format: Vertical (9:16) + Horizontal (16:9)
│  └─ Platforms: TikTok, Instagram, YouTube Shorts
│
├─ Basket Clips
│  ├─ Product Selection → Interactions → Animations → Prompts
│  ├─ Basket Type: Add, Checkout, Comparison, Review
│  └─ Multi-angle: Product, Process, Reaction, Before/After
│
├─ Format Converter
│  └─ 9:16 ↔ 16:9 (with content reframing)
│
└─ Master Orchestrator
   ├─ Batch generation (all formats at once)
   ├─ Smart scheduling (optimal posting times)
   └─ Analytics tracking (engagement, conversion)
```

---

## 💾 Implementation Priority

### P0 (Critical)
- [ ] Viral Clips Generator Tab
- [ ] Viral Hooks Library
- [ ] Format Converter Module

### P1 (High)
- [ ] Basket Clips Generator
- [ ] Multi-format batch generation
- [ ] Integration with existing AI Story

### P2 (Medium)
- [ ] Scheduling system
- [ ] Analytics dashboard
- [ ] Database schema

### P3 (Low)
- [ ] Advanced AI optimizations
- [ ] Trending audio integration
- [ ] Real-time analytics

---

## 🎓 Technology Stack

**Frontend:**
- Existing: Vue.js patterns (adapt current sidebar.js)
- Add: Chart.js (analytics), date-picker (scheduling)

**Backend:**
- Existing: Node.js, Express
- Add: Supabase (scheduling, analytics), FFmpeg (format conversion)

**AI/ML:**
- Existing: Gemini API, OpenAI
- Add: Prompt engineering for viral hooks, basket interactions

---

## ⏱️ Estimated Timeline

- **Phase 2.0 Core Features**: 4-6 weeks
- **Full Integration**: 8-10 weeks
- **Production Ready**: 10-12 weeks

---

## 🚀 Quick Start for Next Phase

When ready to start:
1. Create feature branches: `feature/viral-clips`, `feature/basket-clips`
2. Implement modules in parallel
3. Integrate with `automationOrchestrator.js`
4. Add unit tests and end-to-end tests
5. Deploy as beta feature

---

**Document Version:** 1.0  
**Date:** January 11, 2026  
**Status:** Ready for Review & Implementation Planning
