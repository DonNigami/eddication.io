# 🎬 EXTEND SCENE - ขั้นตอนการใช้งาน (Visual Guide)

## 🖼️ แผนภาพการทำงาน

```
┌─────────────────────────────────────────────────┐
│        EXTEND SCENE WORKFLOW                    │
└─────────────────────────────────────────────────┘

STEP 1: PREPARE CSV FILE
┌──────────────────────┐
│  Create prompts.csv  │
│                      │
│ Prompt 1             │
│ Prompt 2             │
│ Prompt 3             │
│ Prompt 4             │
│ Prompt 5             │
└──────────────────────┘
          ↓

STEP 2: OPEN EXTENSION
┌──────────────────────┐
│  Eddication Flow AI  │
│  ┌────────────────┐  │
│  │ AI Reviews     │  │
│  │ AI Story       │  │
│  │ TikTok         │  │
│  │ คลังสินค้า     │  │
│  │🎬 Extend Scene │◄─── CLICK HERE
│  └────────────────┘  │
└──────────────────────┘
          ↓

STEP 3: ENABLE FEATURE
┌─────────────────────────────┐
│ ☑ Enable Extend Scene Mode  │
│                             │
│ ↓ (controls appear)         │
└─────────────────────────────┘
          ↓

STEP 4: UPLOAD CSV
┌─────────────────────────────┐
│ 📄 CSV Prompts              │
│ [Choose File...] ◄─── SELECT
│                             │
│ ✓ Loaded 5 prompts          │
└─────────────────────────────┘
          ↓

STEP 5: SEE PREVIEW
┌──────────────────────────────┐
│ 📋 Preview Prompts [5]       │
├──────────────────────────────┤
│ • A professional product ... │
│ • Modern minimalist scene ... │
│ • Cinematic slow-motion ...  │
│ • Luxury lifestyle product . │
│ • Dynamic action sequence .. │
└──────────────────────────────┘
          ↓

STEP 6: PREPARE GOOGLE FLOW
┌──────────────────────────────┐
│ Open in New Tab:             │
│ https://labs.google/...      │
│                              │
│ 1. Create Project            │
│ 2. Open SceneBuilder         │
│ 3. Wait for UI loaded        │
└──────────────────────────────┘
          ↓

STEP 7: START AUTOMATION
┌──────────────────────────────┐
│ [🎬 Start Extend] [⏹ Stop]   │
│                              │
│ Progress:                    │
│ 1/5 scenes  20%              │
│ ████░░░░░░░░░░░░░░           │
│                              │
│ Current: "A professional ... │
└──────────────────────────────┘
          ↓

STEP 8: WATCH AUTOMATION
┌──────────────────────────────┐
│  Google Flow Tab:            │
│  ┌────────────────────────┐  │
│  │ Scene 1 (Generating...) │  │
│  │ Scene 2 (Generating...) │  │
│  │ Scene 3 (Queued)       │  │
│  │ Scene 4 (Queued)       │  │
│  │ Scene 5 (Queued)       │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
          ↓

STEP 9: COMPLETION
┌──────────────────────────────┐
│ ✅ Extend Scene Complete!    │
│                              │
│ 5/5 scenes  100%             │
│ ███████████████████████░     │
│                              │
│ All scenes generated!        │
└──────────────────────────────┘
```

---

## 📱 UI Components Explained

### 1. Toggle Switch
```
┌──────────────────────────────┐
│ ☐ Enable Extend Scene Mode   │
│   (click to enable)          │
│                              │
│ → Hidden: CSV upload area    │
│ → Shown: All controls        │
└──────────────────────────────┘
```

### 2. CSV Upload Section
```
┌──────────────────────────────┐
│ 📄 CSV Prompts               │
│                              │
│ [Choose File...] ← Click     │
│                              │
│ Status:                      │
│ ✓ Loaded 5 prompts           │
└──────────────────────────────┘
```

### 3. Preview Section
```
┌──────────────────────────────┐
│ 📋 Preview Prompts [5]       │
│ ┌────────────────────────┐   │
│ │ • Prompt 1             │   │
│ │ • Prompt 2             │   │
│ │ • Prompt 3             │   │
│ │ • Prompt 4             │   │
│ │ • Prompt 5             │   │
│ └────────────────────────┘   │
│ (Scrollable if many)         │
└──────────────────────────────┘
```

### 4. Control Buttons
```
┌──────────────────────────────┐
│ [🎬 Start Extend] [⏹ Stop]   │
│                              │
│ Start = Red button           │
│ Stop = Only when running     │
└──────────────────────────────┘
```

### 5. Progress Display
```
┌──────────────────────────────┐
│ Progress Bar:                │
│                              │
│ 3/5 scenes          60%      │
│ ████████░░░░░░░░░░░░         │
│                              │
│ Current Scene:               │
│ "Cinematic slow-motion re... │
└──────────────────────────────┘
```

---

## 🎬 What Happens Inside Google Flow

### Timeline of Automation

```
T+0s:    Start Extension
         → Get list of 5 prompts

T+1s:    Click (+) button
         → Add new scene

T+3s:    Find "Extend" option
         → Click Extend button

T+4s:    Fill prompt field
         → "A professional product..."

T+5s:    Submit/Send request
         → Google AI starts generating

T+20s:   Wait for 80% completion
         → Check progress bar

T+21s:   ✅ Scene 1 DONE
         → Progress bar: 1/5

T+22s:   Repeat for Scene 2
         ↻ Loop continues...

T+115s:  ✅ ALL SCENES COMPLETE
         → Extension reports: 5/5 100%
```

---

## 🔄 State Diagram

```
START
  ↓
┌─────────────────────┐
│  Feature Disabled   │
│  (Toggle OFF)       │
└─────────────────────┘
  ↓ (Toggle ON)
┌─────────────────────┐
│  Feature Enabled    │
│  Controls Visible   │
└─────────────────────┘
  ↓ (Upload CSV)
┌─────────────────────┐
│  CSV Loaded         │
│  Preview Showing    │
│  Ready to Start     │
└─────────────────────┘
  ↓ (Click Start)
┌─────────────────────┐
│  Automation Running │
│  Progress Tracking  │
│  Stop Available     │
└─────────────────────┘
  ↓ (Completion)
┌─────────────────────┐
│  Complete!          │
│  All Scenes Done    │
└─────────────────────┘
```

---

## 💾 Data Flow

```
User Computer          Extension            Google Labs Flow
─────────────────────────────────────────────────────────

┌───────────┐
│ CSV File  │
└─────┬─────┘
      │
      │ Upload
      ↓
┌──────────────┐         Message         ┌─────────────┐
│ Parse CSV    │ ─────────────────────→ │ Content     │
│ Store in     │                        │ Script      │
│ Storage     │                        │ (googleFlow │
└──────────────┘                        │  .js)       │
      ↓                                  └──────┬──────┘
┌──────────────┐                              │
│ Show Preview │                              │ DOM Events
│ on Sidebar   │                              │ (clicks)
└──────────────┘                              ↓
      ↓                                 ┌──────────────┐
┌──────────────┐      Progress          │ Google Flow  │
│ Update       │ ←────Messages───────── │ Generates    │
│ Progress Bar │                        │ Scenes       │
│ & Counter    │                        └──────────────┘
└──────────────┘
```

---

## 🎯 CSV Format Examples

### ✅ CORRECT FORMAT
```
A professional product showcase with studio lighting
Modern minimalist scene with clean aesthetics
Cinematic slow-motion reveal with depth of field
Luxury lifestyle product photography style
Dynamic action sequence with motion blur
```

### ❌ WRONG FORMATS

```
Format 1 (with quotes):
"A professional product showcase"
"Modern minimalist scene"

Format 2 (with headers):
Prompt Description
"A professional" "Studio lighting"
"Modern" "Clean aesthetic"

Format 3 (with commas):
A professional, product showcase, studio
Modern, minimalist, scene

Format 4 (empty lines):
A professional product showcase

Modern minimalist scene


Cinematic reveal

Format 5 (single column CSV):
Prompt
A professional product showcase
Modern minimalist scene
```

---

## 🔐 Security Flow

```
User Input (CSV)
     ↓
Validation Check
  • File type: .csv only
  • File size: < 1MB
  • Encoding: UTF-8
     ↓
Parse CSV
  • Split by newline
  • Trim whitespace
  • Remove empty lines
     ↓
Sanitize (DOMPurify)
  • Remove XSS attempts
  • Clean HTML tags
  • Safe for storage
     ↓
Store in chrome.storage.local
  • Encrypted by browser
  • Local machine only
  • No server transfer
     ↓
Display in Preview
  • Read-only display
  • No execution risk
```

---

## ⚡ Performance Timeline

```
Action              Duration    Status
─────────────────────────────────────
Load Extension       ~100ms      ✓ Fast
Parse CSV (10 items) ~30ms       ✓ Fast
Display Preview      ~50ms       ✓ Fast
Send message         <10ms       ✓ Instant
Generate 1 Scene     30-60s      ⚠ API limit
───────────────────────────────────────
Total for 5 scenes   2.5-5 min   Normal
```

---

## 🆘 Error Recovery

```
ERROR OCCURS
     ↓
┌──────────────────────┐
│ Is file type wrong?  │
└──────────────────────┘
    YES ↓
    └→ Re-upload as .csv
       ↓
       TRY AGAIN

    NO ↓
┌──────────────────────┐
│ Is CSV format wrong? │
└──────────────────────┘
    YES ↓
    └→ Check for:
       • Empty lines
       • Special chars
       • Quotes/commas
       ↓
       SAVE & RE-UPLOAD

    NO ↓
┌──────────────────────┐
│ Extension error?     │
└──────────────────────┘
    YES ↓
    └→ Reload extension
       1. chrome://extensions
       2. Click reload
       ↓
       TRY AGAIN
```

---

## 📊 Real-Time Monitoring

```
As automation runs, you see:

┌────────────────────────────────────┐
│ Extend Scene Progress              │
├────────────────────────────────────┤
│                                    │
│ Counter: 1/5 scenes    Percent: 20% │
│                                    │
│ Progress Bar:                      │
│ ████░░░░░░░░░░░░░░░░░░░░░░░░      │
│                                    │
│ Current Working On:                │
│ "A professional product showcase   │
│  with studio lighting"             │
│                                    │
│ Status:                            │
│ ✓ Generating...                    │
│                                    │
└────────────────────────────────────┘

Updates every ~5-10 seconds
```

---

## ✨ Success Indicators

```
✅ CSV Loaded
  → Preview shows prompts
  → Count badge displays number

✅ Automation Started
  → Progress bar appears
  → Percentage shows

✅ Scene Generated
  → Counter increments (1/5 → 2/5)
  → Current scene updates
  → Progress percentage increases

✅ Complete
  → Progress bar full (100%)
  → Counter shows (5/5)
  → Message: "Extend Scene Complete!"
  → Google Flow shows all 5 scenes
```

---

**Ready to start?** Follow the main diagram at the top! 🚀
