# Scene-Specific Prompt Logic Implementation

## Overview
Implemented automated scene-specific content injection system:
- **Scene 1 (Opening)**: Viral Hook only - Attention-grabbing opening pattern
- **Middle Scenes**: Auto-generated or template-based content
- **Last Scene (Closing)**: CTA (Call-to-Action) - Drive engagement/conversion

## Implementation Details

### 1. CTA Library Addition (viralHooks.js)
Added 31 pre-written Call-To-Action templates in 6 categories:

**Urgency** (8 CTAs)
- "สั่งเลยตอนนี้ ก่อน {item} หมด"
- "กดลิงก์ด้านล่างก่อนโปรโมชั่นจบ"
- "อย่าพลาด! ของดีจำนวนจำกัด"
- "กดสั่งเลย ส่งฟรีวันนี้เท่านั้น"

**Visit/Link** (6 CTAs)
- "ลิงก์อยู่ด้านล่าง ไปเช็คกันเลย"
- "คลิกลิงก์ในโพสต์เพื่อสั่งการ"
- "ไปเว็บของเรา {link} ดูรายละเอียด"

**Social/Share** (5 CTAs)
- "แชร์ให้เพื่อนๆ ยังไม่รู้เรื่องนี้"
- "ถ้าชอบ ให้ไลค์และแชร์นะ"
- "บอกเพื่อนว่าเจอของดีแบบนี้"

**Follow/Subscribe** (5 CTAs)
- "ติดตามช่องนี้ สำหรับวิดีโออื่นๆ"
- "ฟอลโล่เพื่อไม่พลาดข้อมูลดีๆ"
- "ติดตามเรา เพิ่มเติม {content_type}"

**Opinion/Review** (4 CTAs)
- "ความเห็นของคุณเป็นอย่างไร ลงความเห็นนะ"
- "คุณจะลองหรือเปล่า บอกในความเห็น"
- "รีวิว {product} ของคุณเป็นไงบ้าง"

**Contact** (3 CTAs)
- "ติดต่อเราในข้อความโดยตรง"
- "ถ้ามีคำถาม ส่งข้อความมาได้"

### 2. New Methods in ViralHooks Class

```javascript
/**
 * Get random CTA from any category
 */
getRandomCTA()

/**
 * Apply CTA to last scene
 * @param {string} sceneDescription - Original scene description
 * @param {object} context - Context variables
 * @returns {string} - Scene with CTA appended
 */
applyCTAToScene(sceneDescription, context = {})

/**
 * Get CTA for last scene only
 * @param {number} sceneNumber - Current scene number (1-based)
 * @param {number} totalScenes - Total number of scenes
 * @param {string} sceneDescription - Scene description
 * @param {object} context - Context variables
 * @returns {string} - Scene with or without CTA
 */
getSceneWithCTA(sceneNumber, totalScenes, sceneDescription, context = {})

/**
 * Get CTA by category
 */
getCTAsByCategory(category)

/**
 * Get all CTA categories
 */
getAllCTACategories()
```

### 3. Updated generateScenePrompt() Method

**New Signature:**
```javascript
async generateScenePrompt(type, scene, character, genderText, genderTextEn, totalScenes = null)
```

**Logic Flow:**
```javascript
1. Check if scene.number === 1
   ↓ YES: Apply Viral Hook (prepend to description)
   ↓ NO: Continue

2. Check if totalScenes && scene.number === totalScenes
   ↓ YES: Apply CTA (append to description)
   ↓ NO: Continue

3. Build AI prompt with modified sceneDescription
```

**Example:**
- Scene 1: "คุณเชื่อไหมว่า..." (Hook) + original description
- Scene 2: original description
- Scene 3: original description  
- Scene N (last): original description + "สั่งเลยตอนนี้..." (CTA)

### 4. Updated generateStoryPrompts() Method

Added same Hook + CTA logic during pre-generation:
```javascript
// Apply viral hook to first scene if enabled
if (this.viralHooks && this.viralHooks.isEnabled() && scene.number === 1) {
  const context = this.viralHooks.extractContextFromStory(storyDetails);
  finalPrompt = this.viralHooks.applyHookToScene(finalPrompt, context);
}

// Apply CTA to last scene if enabled
if (this.viralHooks && scene.number === scenes.length) {
  const context = this.viralHooks.extractContextFromStory(storyDetails);
  finalPrompt = this.viralHooks.applyCTAToScene(finalPrompt, context);
}
```

### 5. Updated AI Story Automation Calls

Modified both image and video prompt generation calls to pass totalScenes:

```javascript
// Before:
imagePrompt = await this.generateScenePrompt('image', scene, character, genderText, genderTextEn);

// After:
imagePrompt = await this.generateScenePrompt('image', scene, character, genderText, genderTextEn, scenes.length);
```

## Files Modified

### flowai-dev - Copy (Development Version)
1. **js/sidebar.js** (lines 2717-2745)
   - Updated generateScenePrompt() with totalScenes parameter
   - Added CTA application logic
   - Updated both image/video prompt generation calls

2. **js/modules/viralHooks.js** (lines 366-418)
   - Added getRandomCTA() method
   - Added applyCTAToScene() method
   - Added getSceneWithCTA() helper
   - Added getCTAsByCategory() and getAllCTACategories()

### flowai-dev (Main Development)
1. **js/sidebar.js** (lines 2519-2569)
   - Updated generateScenePrompt() method with CTA support
   - Added same scene detection logic

2. **js/modules/viralHooks.js** (NEW - 514 lines)
   - Complete ViralHooks class with 60 Hooks + 31 CTAs

3. **js/modules/formatConverter.js** (NEW - 359 lines)
   - Format conversion module (for future multi-format distribution)

## Behavior Example

### AI Story with 3 scenes:

**Scene 1 (Opening):**
```
Prompt: "คุณเชื่อไหมว่า {topic}"
[Hook from ViralHooks.HOOKS.surprise]
[Original scene description]
```

**Scene 2 (Middle):**
```
Prompt: [Template or AI-generated]
[Original scene description]
```

**Scene 3 (Closing - Last Scene):**
```
Prompt: [Template or AI-generated]
[Original scene description]
"สั่งเลยตอนนี้ ก่อน {item} หมด"
[CTA from ViralHooks.CTAS.urgency]
```

## Integration Points

1. **Hook Application**: Only Scene 1 when `this.viralHooks.isEnabled()`
2. **CTA Application**: Only Last Scene (when `scene.number === totalScenes`)
3. **Context Extraction**: From story details textarea
4. **Template Usage**: Existing template system respected
5. **AI Generation**: Falls back to AI if no templates available

## Technical Notes

- **Scene Numbering**: 1-based (1, 2, 3...) for scene.number
- **Array Indexing**: 0-based indexing for template templates (already fixed)
- **Detection Method**: `scene.number === totalScenes` for last scene
- **CTA Randomization**: Random category + random template within category
- **Context Variables**: {topic}, {product}, {item}, {price}, {link}, {content_type}, etc.

## Testing Checklist

- [ ] Scene 1 has Hook prepended
- [ ] Last scene has CTA appended
- [ ] Middle scenes unaffected
- [ ] Hook/CTA only applied when viralHooks enabled
- [ ] Multi-scene stories work correctly (3+)
- [ ] Single-scene stories apply both Hook and CTA
- [ ] Template prompts still cycle correctly
- [ ] AI-generated prompts include Hook/CTA

## Future Enhancements

1. UI selector for CTA categories (similar to Hook selector)
2. CTA preview in sidebar
3. Per-scene Hook/CTA customization
4. Dynamic CTA based on product category
5. A/B testing different Hook/CTA combinations

---

**Implementation Date:** 2026-01-11
**Commits:**
- e63ca3e: Added viralHooks + formatConverter to flowai-dev
- 1a7c280: Updated scene-specific CTA logic in flowai-dev Copy
