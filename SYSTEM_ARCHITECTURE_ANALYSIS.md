# 📊 System Architecture & Capability Analysis

## 🎯 Current System (Phase 1.0)

### ✅ สิ่งที่ระบบทำได้ตอนนี้

**1. AI Content Generation**
- ✅ AI Story Automation (scene → image → video)
- ✅ Template-based prompt generation
- ✅ Multi-character support
- ✅ Character image upload automation
- ✅ Scene rotation (content mode) / repetition (repeat mode)

**2. Video Creation**
- ✅ 9:16 Vertical format (TikTok, Instagram Reels, YouTube Shorts)
- ✅ Configurable delays for image/video generation
- ✅ Batch processing (multiple videos in sequence)
- ✅ Optional download automation

**3. Template Library**
- ✅ 60+ Pre-built prompt templates
- ✅ 50 Product-specific templates (Thai speech)
- ✅ Scene-based prompt cycling (ฉาก 1→Prompt 1, ฉาก 2→Prompt 2, etc.)
- ✅ Mix & match prompts with AI generation

**4. Multi-Platform Upload**
- ✅ TikTok (manual & automated)
- ✅ Shopee
- ✅ YouTube
- ✅ Facebook
- ✅ Scheduled posting

**5. Warehouse Management**
- ✅ Product database
- ✅ Character library
- ✅ Video inventory tracking
- ✅ Category organization

---

## 🔧 Technical Foundation

### Frontend (Chrome Extension MV3)
- **Main Entry:** `html/sidebar.html` + `js/sidebar.js` (3500+ lines)
- **Tabs:** AI Reviews, AI Story, TikTok, Warehouse, Extend Scene
- **Storage:** Chrome Storage API + IndexedDB
- **UI Framework:** Vanilla JS with CSS grid/flexbox

### Backend
- **Node.js Server** (Google Apps Script)
- **Supabase Database** (PostgreSQL with RLS policies)
- **Google Drive Integration** (with quota management)
- **Google Sheets** (data synchronization)

### APIs
- **Gemini API** (Google AI, free tier)
- **OpenAI API** (gpt-4o-mini)
- **Google Labs Flow** (extension automation)
- **Platform APIs:** TikTok, Shopee, YouTube, Facebook

---

## 📈 System Capabilities Matrix

| Feature | Status | Format | Automation | Multi-Platform |
|---------|--------|--------|-----------|-----------------|
| **AI Story** | ✅ | 9:16 V | ✅ Full | ✅ Yes |
| **Image Gen** | ✅ | 9:16 V | ✅ Batch | ✅ Yes |
| **Template Prompts** | ✅ | Custom | ✅ Cycling | ✅ Yes |
| **Multi-Character** | ✅ | 9:16 V | ✅ Yes | ✅ Limited |
| **Scene Rotation** | ✅ | 9:16 V | ✅ Yes | ✅ Limited |
| **16:9 Horizontal** | ❌ | - | - | - |
| **Viral Hooks** | ❌ | - | - | - |
| **Basket Clips** | ❌ | - | - | - |
| **Smart Scheduling** | ⚠️ | - | Manual | TikTok only |
| **Analytics** | ❌ | - | - | - |

---

## 🎬 Deep Dive: AI Story Current Flow

### **Preparation Phase**
```
1. Select Character (optional)
   └─ Image auto-upload to Google Flow

2. Input Story Topic
   └─ Or use "Gen หัวข้อ" (AI generates 3 options)

3. Create Story Details
   └─ Format: "ฉากที่ 1: Description..."
      OR use template button to auto-generate from Template Prompts

4. Load Template (optional)
   └─ CSV from Extend Scene library (50-60 templates)

5. Set Loop Count
   └─ 1-20 videos (or custom)

6. Select Mode
   └─ Content Mode: rotate scenes
   └─ Repeat Mode: use 1 scene N times
```

### **Automation Phase (12 Steps/Loop)**
```
Loop i = 1 to totalLoops:
  1. Upload character image (if exists) → 20s wait
  2. Get Image Prompt:
     ├─ Option A: Pre-generated from "Prompt ภาพ" button
     ├─ Option B: Template prompt (sceneIndex % templateLength)
     └─ Option C: AI generate from scene description
  3. Fill image prompt on page
  4. Click Create button
  5. Wait for image (60s default)
  6. Switch to Video Mode
  7. Select image
  8. Get Video Prompt:
     ├─ Option A: Template prompt (same logic as image)
     └─ Option B: AI generate from scene description
  9. Fill video prompt
  10. Click Create button
  11. Wait for video (90s default)
  12. Download (or skip)
  13. Reset for next loop
  
  After each loop: wait 5s before next iteration
```

### **Prompt Sequencing (Key Feature)**
```
If Template Loaded (5 prompts):
  ฉาก 1 → Template Prompt 1
  ฉาก 2 → Template Prompt 2
  ฉาก 3 → Template Prompt 3
  ฉาก 4 → Template Prompt 4
  ฉาก 5 → Template Prompt 5
  ฉาก 6 → Template Prompt 1 (wrap around)
  ...

Content Mode with 3 scenes + 5 templates + 7 loops:
  Loop 1, Scene 1, Prompt 1
  Loop 2, Scene 2, Prompt 2
  Loop 3, Scene 3, Prompt 3
  Loop 4, Scene 1, Prompt 4
  Loop 5, Scene 2, Prompt 5
  Loop 6, Scene 3, Prompt 1
  Loop 7, Scene 1, Prompt 2
```

---

## 🛠️ Extend Scene (Bonus Feature)

### Purpose
Extend scenes in Google Flow UI using CSV-based prompts

### How It Works
1. Select template or upload CSV
2. Specify camera angles (optional)
3. Set run count (how many times to apply)
4. Toggle shuffle (randomize order)
5. Click "Start Extend"
6. System fills prompt boxes in Google Flow UI

### Key Capability
- ✅ Handles 50+ prompts
- ✅ Camera angle variations
- ✅ Shuffle/sequential modes
- ✅ Live logging

---

## 📊 Data Storage Architecture

### Frontend Storage (Chrome)
```
Chrome Storage (Local):
├── geminiApiKey
├── openaiApiKey
├── selectedModel
├── imageGenerationDelay
├── videoGenerationDelay
├── skipDownload
└── (All user settings)

Chrome IndexedDB:
├── promptStorage (custom templates)
├── videoStorage (generated videos)
└── characterWarehouse
```

### Backend Storage (Supabase)
```
Tables:
├── products (warehouse)
├── characters
├── categories
├── videos
├── subscription_packages
├── customer_subscriptions
└── (Other CRM data)
```

---

## 🎓 How to Extend This System

### Option 1: Add New Tab (Easiest)
```javascript
// In html/sidebar.html, add new tab button:
<button class="tab-btn" data-tab="new-feature">
  🎬 New Feature
</button>

// Add tab content:
<div class="tab-content" id="tab-new-feature">
  <!-- Your UI here -->
</div>

// In js/sidebar.js, handle new tab logic:
// Initialize in initApp()
if (typeof NewFeatureModule !== 'undefined') {
  this.newFeature = new NewFeatureModule();
  this.newFeature.init();
}
```

### Option 2: Extend AI Story (Medium Difficulty)
```javascript
// Add new automation step to handleStoryAutomation():
// Example: Add subtitle generation
this.updateStoryAutomationStatus(loopPrefix + 'ขั้นตอน 13/13: สร้างคำบรรยาย...');
const subtitle = await this.generateSubtitles(videoPrompt);
await Controls.fillSubtitleField(subtitle);
```

### Option 3: New Module (Advanced)
```javascript
// Create js/modules/myModule.js
class MyModule {
  async init() {
    // Setup
  }
  
  async myFeature(params) {
    // Logic
  }
}

// In html/sidebar.html, add script tag:
<script src="../js/modules/myModule.js"></script>

// In js/sidebar.js initApp():
this.myModule = new MyModule();
await this.myModule.init();
```

---

## 🎬 Real-World Usage Scenarios

### Scenario 1: Quick TikTok Content (5-10 videos)
```
1. Topic: "กำลังออกกำลังกาย"
2. Mode: Content (3 different scenes)
3. Template: Product Skincare (5 prompts)
4. Loop Count: 10
5. Auto-upload: ✅ TikTok
→ 10 videos in ~30-40 minutes
```

### Scenario 2: Shopee Product Showcase
```
1. Character: นาง สร้อยทอง
2. Product Images: 5 items
3. Template: Product Fashion
4. Details: สร้างจากรายละเอียดสินค้า
5. Upload: Shopee (with product links)
→ 5 product videos automatically
```

### Scenario 3: Multi-Platform Campaign
```
1. Generate: 15 AI Story videos
2. Format: 9:16 (vertical)
3. Upload:
   - TikTok: 8 videos
   - Instagram Reels: 4 videos
   - YouTube Shorts: 3 videos
→ 15 videos across 3 platforms in parallel
```

---

## ⚡ Performance Metrics

### Speed (Per Video)
- Image Generation: 60 seconds (configurable)
- Video Generation: 90 seconds (configurable)
- Upload: 30-60 seconds
- **Total per video:** ~3 minutes
- **10 videos:** ~30 minutes

### Batch Processing
- **Simultaneous videos:** Limited to 1 (sequential)
- **Can process:** 10-20 videos per hour
- **Manual rate:** 2-3 videos per hour

### Resource Usage
- CPU: Low to Medium (mostly waiting for AI/Flow)
- Memory: ~150MB (sidebar only)
- Bandwidth: ~50MB per video
- Storage: 500MB-1GB per 10 videos

---

## 🔒 Security & Compliance

### Data Protection
- ✅ Chrome extension isolation (no external data leaks)
- ✅ API keys stored locally only
- ✅ Supabase RLS policies enforced
- ✅ Google Drive OAuth delegation

### API Safety
- ⚠️ Rate limiting: Gemini (free tier), OpenAI (usage-based)
- ✅ Error handling: Graceful fallback to alternative API
- ✅ Retry logic: Automatic with backoff

---

## 📚 Documentation Files

| File | Purpose | Audience |
|------|---------|----------|
| **AI_STORY_WORKFLOW_GUIDE.md** | Step-by-step usage guide | End Users |
| **ROADMAP_VIRAL_CLIPS_AND_BASKET.md** | Phase 2.0 features | Developers |
| **SYSTEM_ARCHITECTURE.md** (this file) | Technical overview | Developers |
| **EXTEND_SCENE_README.md** | Extend Scene feature | Users |
| **backend/README.md** | Backend setup | DevOps |

---

## 🚀 Next Steps (Recommendations)

### Immediate (This Week)
1. ✅ User testing of AI Story flow
2. ✅ Gather feedback on template quality
3. ✅ Monitor API quota usage

### Short Term (Next 2 Weeks)
1. Fix any reported bugs
2. Optimize delays based on user feedback
3. Add more templates if needed

### Medium Term (Next Month)
1. Implement Phase 2.0: Viral Clips (Week 1-2)
2. Add Basket Clips (Week 3-4)
3. Multi-format conversion (Week 5-6)

### Long Term (Next Quarter)
1. Advanced analytics dashboard
2. AI-powered trending detection
3. Auto-caption generation
4. Multi-language support

---

**Document Version:** 1.0  
**Date:** January 11, 2026  
**Last Updated:** Today  
**Status:** Complete Analysis
