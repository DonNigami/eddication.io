# 🚀 Feature Enhancement Guide - Next Level Content Automation

**Document Version:** 1.0  
**Date:** January 11, 2026  
**Status:** Strategic Roadmap for Advanced Features

---

## 📋 Table of Contents

1. [Recently Completed Features](#recently-completed-features)
2. [Camera Angle System](#camera-angle-system)
3. [Thai Speech + English Prompt System](#thai-speech--english-prompt-system)
4. [Recommended Feature Enhancements](#recommended-feature-enhancements)
5. [Implementation Priorities](#implementation-priorities)
6. [Technical Architecture for Next Features](#technical-architecture-for-next-features)

---

## ✅ Recently Completed Features

### **1. Camera Angle Control (NEW!)**
- ✅ Added to AI Story tab
- ✅ Added to AI Review tab  
- ✅ Added to Extend Scene tab (existing)
- **10 Camera Angles:** Front, Side, Top-Down, Low-Angle, High-Angle, POV, Close-up, Wide, Dutch Tilt, Tracking
- **Smart Random:** Randomize camera angles for variety
- **Auto-Apply:** Camera angle descriptions automatically appended to prompts

**Usage:**
```
Select มุมกล้อง → Random or specific angle
Prompt automatically gets: "Camera angle: low-angle (looking up), dramatic presence."
```

---

### **2. Thai Speech + English Prompt Enforcement**
- ✅ Template prompts enforce: **Speech in Thai only, Prompt in English only**
- ✅ Format: `"English instruction. Speech: \"คำพูดภาษาไทย\". No text on screen."`
- ✅ Applied to all 60+ templates (Extend Scene, AI Story, Product templates)

**Example:**
```
Before: "A woman reviewing skincare product ผิวสวย"
After: "A woman reviewing skincare product. Speech: \"ผิวสวยขึ้นจริงๆ เห็นผลใน 7 วัน\". No text on screen."
```

---

## 🎥 Camera Angle System

### **How It Works**

1. **Select Camera Angle** from dropdown (or "สุ่ม" for random)
2. **System automatically appends** camera angle description to prompt
3. **Avoids duplicates** - checks if prompt already has camera angle
4. **Supports all 3 tabs:** AI Story, AI Review, Extend Scene

### **Camera Angle Library**

| Angle | Description | Best Use Case |
|-------|-------------|---------------|
| **Front** | Front-facing, centered, head-on | Product showcases, talking heads |
| **Side** | Side profile, lateral perspective | Fashion, beauty, body language |
| **Top-Down** | Overhead view | Food, flat lays, unboxing |
| **Low-Angle** | Looking up, dramatic presence | Heroic shots, power dynamics |
| **High-Angle** | Looking down, overview | Cute shots, vulnerable emotions |
| **POV** | First-person perspective | Immersive experiences, reactions |
| **Close-Up** | Tight framing on face/object | Details, emotions, textures |
| **Wide** | Expansive framing | Establishing shots, environments |
| **Dutch Tilt** | Diagonal horizon | Tension, unease, dynamic |
| **Tracking** | Following subject movement | Action, walking, following |

### **Implementation Notes**
- Camera angle applied via `applyCameraAngleToPrompt(prompt, selectId)`
- Dropdown IDs: `storyCameraAngle`, `reviewCameraAngle`, `extendCameraAngle`
- Random selection from 10 angles if "สุ่ม" is chosen

---

## 🗣️ Thai Speech + English Prompt System

### **Why This Matters**

Google Flow AI and other video generation tools work best when:
- **Prompt (instructions)** = English (better understanding)
- **Speech (audio/captions)** = Thai (target audience)
- **No on-screen text** = Better video quality, no OCR conflicts

### **Template Format Standard**

```csv
"English instruction describing the scene. Speech: \"คำพูดภาษาไทยที่จะออกเสียง\". No text on screen. No captions."
```

**Example Templates:**
```
"A Thai woman applying sunscreen. Speech: \"กันแดดตัวนี้กันได้ยาวนาน SPF 50\". No text on screen."
"A man testing gaming headset. Speech: \"เสียงชัดมาก รายละเอียดเกมยอดเยี่ยม\". No text on screen."
```

### **Enforcement Strategy**

1. **Template Library:** All 60+ templates follow this format
2. **AI Generation:** System prompts instruct AI to separate Speech from instruction
3. **Prompt Preview:** Shows formatted output with Speech: "..." format
4. **Validation:** Future enhancement - auto-check for Thai in Speech, English in instruction

---

## 🎯 Recommended Feature Enhancements

### **Priority 1: Viral Hooks Library (P0)**

**Why:** Viral content needs attention-grabbing hooks in first 3 seconds

**Features:**
- 🎣 **Hook Library** with 50+ viral opening patterns
  - Surprise hooks: "คุณเชื่อไหมว่า...", "ไม่มีใครบอกคุณเรื่องนี้"
  - Question hooks: "ทำไมคนส่วนใหญ่ทำผิด...", "รู้ไหมว่า..."
  - Problem hooks: "ถ้าคุณมีปัญหา...", "หยุด! ก่อนคุณจะ..."
  - Shocking hooks: "อันตราย! สิ่งที่...", "ความจริงที่..."

**Implementation:**
```javascript
const VIRAL_HOOKS = {
  surprise: [
    "คุณเชื่อไหมว่า {product} สามารถ {benefit}",
    "ไม่มีใครบอกคุณเรื่อง {secret}",
    "สิ่งที่คุณไม่รู้เกี่ยวกับ {topic}"
  ],
  question: [
    "ทำไมคนส่วนใหญ่ถึง {mistake}?",
    "รู้ไหมว่า {fact}?",
    "{product} ดีจริงหรือ? มาดูกัน"
  ],
  problem: [
    "ถ้าคุณมีปัญหา {problem} ต้องดูนี่",
    "หยุด! ก่อนคุณจะ {action}",
    "ผิดหวังกับ {product}? ลองนี่"
  ]
};
```

**UI:**
- Dropdown selector in AI Story: "เลือก Hook สำหรับวิดีโอแรก"
- Preview: "Hook ที่ใช้: คุณเชื่อไหมว่า..."
- Auto-inject to first scene

---

### **Priority 2: Multi-Format Conversion (P0)**

**Why:** Content needs both 9:16 (TikTok) and 16:9 (YouTube) formats

**Features:**
- 🔄 **Auto Format Converter**
  - 9:16 → 16:9 (add side padding/blur background)
  - 16:9 → 9:16 (crop center/smart focus)
- 📏 **Format Specs per Platform:**
  - TikTok: 9:16, 1080x1920
  - YouTube Shorts: 9:16, 1080x1920
  - YouTube: 16:9, 1920x1080
  - Instagram Reels: 9:16, 1080x1920
  - Facebook: 16:9 or 1:1

**Implementation:**
```javascript
class FormatConverter {
  async convert(videoBlob, sourceFormat, targetFormat) {
    if (sourceFormat === '9:16' && targetFormat === '16:9') {
      return this.verticalToHorizontal(videoBlob);
    } else if (sourceFormat === '16:9' && targetFormat === '9:16') {
      return this.horizontalToVertical(videoBlob);
    }
    return videoBlob;
  }

  verticalToHorizontal(blob) {
    // Add black/blur bars on sides
    // Keep center content intact
  }

  horizontalToVertical(blob) {
    // Smart crop center
    // Or zoom and pan
  }
}
```

**UI:**
- Checkbox: "สร้างทั้ง 9:16 และ 16:9"
- Batch conversion after AI Story automation
- Storage: Save both formats with suffix `_vertical`, `_horizontal`

---

### **Priority 3: Shopping Basket Clips Generator (P1)**

**Why:** E-commerce needs product showcase with purchase flow

**Features:**
- 🛒 **Basket Clip Templates**
  - Product reveal (3-5 seconds)
  - Feature highlights (5-10 seconds)
  - Checkout simulation (3-5 seconds)
  - Call-to-action (2-3 seconds)
- 💰 **Dynamic Pricing Display**
  - Original price + Sale price
  - "ลดเหลือ X บาท" animation
- 🎬 **Multi-Angle Recording**
  - Front view (product intro)
  - Close-up (details, textures)
  - Usage demo (hands holding/using)
  - Comparison (before/after)

**Implementation:**
```javascript
class BasketClipsGenerator {
  async generate(product, options) {
    const scenes = [
      { type: 'reveal', duration: 4, angle: 'front' },
      { type: 'feature', duration: 8, angle: 'close-up' },
      { type: 'checkout', duration: 5, angle: 'top-down' },
      { type: 'cta', duration: 3, angle: 'wide' }
    ];

    for (const scene of scenes) {
      const prompt = this.buildBasketPrompt(product, scene);
      await this.createVideoScene(prompt, scene.angle);
    }
  }

  buildBasketPrompt(product, scene) {
    const templates = {
      reveal: `Product reveal: ${product.name}. Speech: "มาแล้ว ${product.name} ที่รอคอย". Camera angle: ${scene.angle}.`,
      feature: `Showcasing ${product.features}. Speech: "${product.benefit}". Camera angle: ${scene.angle}.`,
      checkout: `Simulated checkout flow. Speech: "สั่งเลยตอนนี้ ลดเหลือ ${product.salePrice} บาท". Camera angle: ${scene.angle}.`,
      cta: `Strong call-to-action. Speech: "กดสั่งเลย ลิงก์ด้านล่าง". Camera angle: ${scene.angle}.`
    };
    return templates[scene.type];
  }
}
```

**UI:**
- New tab: "Basket Clips"
- Select product from warehouse
- Configure: Price, discount, CTA text
- Auto-generate 4-scene sequence

---

### **Priority 4: Trending Sound/Music Library (P2)**

**Why:** Viral videos use trending audio

**Features:**
- 🎵 **Trending Audio Database**
  - TikTok trending sounds API
  - YouTube trending music
  - Copyright-free music library
- 🔍 **Search & Filter**
  - By mood: energetic, calm, funny, dramatic
  - By genre: pop, EDM, lo-fi, traditional
- 🎧 **Preview Player**
  - 15-second preview
  - Download and apply to video

**Implementation:**
```javascript
class TrendingAudioLibrary {
  async fetchTrendingSounds(platform = 'tiktok') {
    const sounds = await API.get(`/trending-sounds/${platform}`);
    return sounds.map(s => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      previewUrl: s.preview,
      trendingScore: s.score
    }));
  }

  async applyAudioToVideo(videoBlob, audioUrl) {
    // Download audio
    // Merge with video using FFmpeg.wasm
    // Return new video with audio
  }
}
```

**UI:**
- Section in AI Story: "เพิ่มเสียงเพลง"
- Dropdown: Trending sounds sorted by score
- Button: "Preview" (play 15s), "Apply" (merge audio)

---

### **Priority 5: Automated Caption Generator (P2)**

**Why:** Captions increase watch time by 80%

**Features:**
- 📝 **Auto-Transcribe Thai Speech**
  - Use Google Speech-to-Text API
  - Extract from "Speech: \"...\""" template
- 🎨 **Caption Styling**
  - Font: Kanit, Sarabun, Prompt (Thai fonts)
  - Position: Bottom, Center, Top
  - Animation: Fade in, Slide up, Bounce
- ⏱️ **Timing Sync**
  - Word-by-word timing
  - Auto-sync with video

**Implementation:**
```javascript
class CaptionGenerator {
  async generateCaptions(speech, videoDuration) {
    // Extract Thai speech from prompt
    const thaiText = this.extractSpeech(speech);

    // Generate word-by-word captions
    const words = thaiText.split(' ');
    const avgWordDuration = videoDuration / words.length;

    return words.map((word, i) => ({
      text: word,
      startTime: i * avgWordDuration,
      endTime: (i + 1) * avgWordDuration
    }));
  }

  extractSpeech(prompt) {
    const match = prompt.match(/Speech: "([^"]+)"/);
    return match ? match[1] : '';
  }

  async renderCaptionsOnVideo(videoBlob, captions, style) {
    // Use canvas API or FFmpeg
    // Overlay text with timing
  }
}
```

**UI:**
- Checkbox: "เพิ่มคำบรรยาย"
- Style selector: Font, Size, Color, Position
- Preview: Shows captions on video

---

### **Priority 6: Batch Content Calendar (P3)**

**Why:** Schedule content for 30 days in advance

**Features:**
- 📅 **Content Calendar View**
  - Month/Week/Day view
  - Drag & drop videos to schedule
- ⏰ **Smart Scheduling**
  - Best posting times per platform
  - Auto-distribute content evenly
- 📊 **Performance Tracking**
  - Views, likes, comments per post
  - Best-performing content types

**Implementation:**
```javascript
class ContentCalendar {
  async schedulePosts(videos, startDate, platforms) {
    const schedule = [];
    const bestTimes = this.getBestPostingTimes(platforms);

    videos.forEach((video, i) => {
      const postDate = this.addDays(startDate, i);
      const postTime = bestTimes[i % bestTimes.length];
      schedule.push({
        video,
        platform: platforms[i % platforms.length],
        scheduledAt: `${postDate} ${postTime}`
      });
    });

    await this.saveSchedule(schedule);
  }

  getBestPostingTimes(platforms) {
    const defaults = {
      tiktok: ['06:00', '12:00', '18:00', '21:00'],
      youtube: ['15:00', '18:00', '20:00'],
      facebook: ['09:00', '13:00', '19:00']
    };
    // Merge best times from all selected platforms
  }
}
```

**UI:**
- New tab: "Content Calendar"
- Calendar grid with scheduled posts
- Bulk actions: "Schedule 10 videos over 2 weeks"

---

### **Priority 7: A/B Testing Module (P3)**

**Why:** Test different hooks, thumbnails, CTAs

**Features:**
- 🧪 **Create Test Variants**
  - Test 2-3 versions of same video
  - Different hooks, thumbnails, captions
- 📊 **Performance Comparison**
  - Views, CTR, completion rate
  - Winner declared after X days
- 🏆 **Auto-Apply Winner**
  - Use winning variant for future content

**Implementation:**
```javascript
class ABTestingModule {
  async createTest(baseVideo, variants) {
    const testId = this.generateTestId();
    const tests = variants.map((v, i) => ({
      id: `${testId}_v${i}`,
      video: this.applyVariant(baseVideo, v),
      variant: v,
      metrics: { views: 0, ctr: 0, completion: 0 }
    }));

    await this.saveTest(testId, tests);
    return tests;
  }

  async analyzeResults(testId) {
    const tests = await this.getTest(testId);
    const winner = tests.reduce((best, current) =>
      current.metrics.ctr > best.metrics.ctr ? current : best
    );
    return winner;
  }
}
```

**UI:**
- Button: "Create A/B Test"
- Select: Hook, Thumbnail, Caption variants
- Dashboard: Real-time results

---

## 📊 Implementation Priorities

### **Phase 1 (Week 1-2): Core Enhancements**
- ✅ Camera angle system (DONE)
- ✅ Thai speech enforcement (DONE)
- 🚧 Viral hooks library (P0)
- 🚧 Multi-format conversion (P0)

### **Phase 2 (Week 3-5): E-Commerce Focus**
- Shopping basket clips generator (P1)
- Product showcase templates (P1)
- Dynamic pricing display (P1)

### **Phase 3 (Week 6-8): Content Quality**
- Trending audio library (P2)
- Automated caption generator (P2)
- Multi-angle recording (P2)

### **Phase 4 (Week 9-12): Scaling & Analytics**
- Batch content calendar (P3)
- A/B testing module (P3)
- Performance dashboard (P3)

---

## 🏗️ Technical Architecture for Next Features

### **Module Structure**

```
js/modules/
├── viralHooks.js          # Viral hooks library (P0)
├── formatConverter.js     # 9:16 ↔ 16:9 conversion (P0)
├── basketClips.js         # Shopping basket generator (P1)
├── trendingAudio.js       # Trending sounds API (P2)
├── captionGenerator.js    # Auto-caption + STT (P2)
├── contentCalendar.js     # Scheduling system (P3)
└── abTesting.js           # A/B test framework (P3)
```

### **Database Extensions (Supabase)**

```sql
-- Viral hooks library
CREATE TABLE viral_hooks (
  id UUID PRIMARY KEY,
  type VARCHAR(50),    -- surprise, question, problem, shocking
  template TEXT,        -- "คุณเชื่อไหมว่า {product}..."
  performance_score INT,-- Avg views from tests
  created_at TIMESTAMP
);

-- Content calendar
CREATE TABLE scheduled_posts (
  id UUID PRIMARY KEY,
  video_id UUID,
  platform VARCHAR(20), -- tiktok, youtube, facebook
  scheduled_at TIMESTAMP,
  status VARCHAR(20),   -- pending, posted, failed
  metrics JSONB         -- {views, likes, comments}
);

-- A/B tests
CREATE TABLE ab_tests (
  id UUID PRIMARY KEY,
  base_video_id UUID,
  variants JSONB,       -- [{id, hook, thumbnail, caption}]
  results JSONB,        -- [{variantId, views, ctr, completion}]
  winner_id UUID,
  created_at TIMESTAMP
);
```

### **API Integrations Needed**

1. **TikTok Trending API** - Get trending sounds/hashtags
2. **Google Speech-to-Text** - Transcribe Thai speech
3. **FFmpeg.wasm** - Client-side video editing (captions, audio)
4. **TikTok/YouTube Scheduling APIs** - Auto-post content

---

## 🎯 Success Metrics

### **User Adoption**
- **Goal:** 80% of users use camera angles
- **Goal:** 50% of users enable multi-format conversion
- **Goal:** 30% of users use viral hooks library

### **Content Performance**
- **Goal:** 25% increase in avg views with viral hooks
- **Goal:** 40% higher completion rate with captions
- **Goal:** 2x content output with format converter

### **Time Savings**
- **Goal:** 50% reduction in manual video editing
- **Goal:** 5x faster content calendar planning
- **Goal:** 3x more A/B tests per month

---

## 📚 Next Steps

1. **Review & Approval** - Get stakeholder approval on priorities
2. **Sprint Planning** - Break down P0 features into 2-week sprints
3. **API Research** - Evaluate TikTok/Google APIs for feasibility
4. **UI/UX Design** - Create mockups for new features
5. **Development** - Start with Viral Hooks Library (Week 1)

---

**Document Owner:** AI Development Team  
**Last Updated:** January 11, 2026  
**Next Review:** January 25, 2026 (after Phase 1 completion)

---

## 💡 Bonus: Quick Wins (Can Implement Immediately)

1. **Prompt Preview Pane** - Show formatted prompt before automation starts
2. **Favorite Camera Angles** - Save user's preferred 3 angles
3. **Batch Template Apply** - Apply template to all scenes at once
4. **Export Prompt Library** - Download all generated prompts as CSV
5. **Keyboard Shortcuts** - Ctrl+Enter to start automation, Esc to stop

These quick wins can be implemented in 1-2 days each and provide immediate value! 🚀
