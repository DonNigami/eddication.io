# Quick Reference: Scene-Specific Logic

## 🎯 What Changed

| Aspect | Before | After |
|--------|--------|-------|
| Scene 1 | Normal content | Hook + Content |
| Middle Scenes | Normal content | Normal content |
| Last Scene | Normal content | Content + CTA |

## 📋 CTA Templates Available

### Urgency (8)
🔴 "สั่งเลยตอนนี้", "กดลิงก์ก่อนจบโปรโมชั่น", "อย่าพลาด!"

### Link (6)  
🔗 "ลิงก์อยู่ด้านล่าง", "คลิกลิงก์ในโพสต์", "ไปเว็บของเรา"

### Social (5)
📲 "แชร์ให้เพื่อน", "ไลค์และแชร์", "บอกเพื่อน"

### Follow (5)
👥 "ติดตามช่องนี้", "ฟอลโล่เพื่อไม่พลาด", "ติดตามเรา"

### Opinion (4)
💬 "ความเห็นของคุณ", "คุณจะลองไหม", "รีวิวให้ผู้อื่น"

### Contact (3)
📧 "ติดต่อเราในข้อความ", "ถ้ามีคำถาม", "ฉันพร้อมตอบ"

**Total: 31 CTA templates**

## 🔧 Code Implementation

### Scene Detection
```javascript
// In generateScenePrompt()
const totalScenes = scenes.length;

if (scene.number === 1) {
  // Apply Hook
  sceneDescription = this.viralHooks.applyHookToScene(...);
}

if (scene.number === totalScenes) {
  // Apply CTA
  sceneDescription = this.viralHooks.applyCTAToScene(...);
}
```

### Method Calls
```javascript
// Old (no CTA)
const prompt = await this.generateScenePrompt('image', scene, ...);

// New (with CTA support)  
const prompt = await this.generateScenePrompt('image', scene, ..., scenes.length);
                                                                  ↑
                                                     Pass totalScenes
```

## 🎥 Visual Example

**3-Scene Story Flow:**
```
┌─────────────┐
│  SCENE 1    │
│  🎣 HOOK    │  ← Viral opening pattern
│  Content    │
└─────────────┘
      ↓
┌─────────────┐
│  SCENE 2    │
│  Content    │  ← Normal content
└─────────────┘
      ↓
┌─────────────┐
│  SCENE 3    │
│  Content    │
│  🎯 CTA     │  ← Call-to-action
└─────────────┘
```

## 📊 File Changes Summary

| File | Status | Change |
|------|--------|--------|
| viralHooks.js | NEW | 31 CTA templates + methods |
| formatConverter.js | NEW | Video format conversion |
| sidebar.js | UPDATED | generateScenePrompt signature |

## ✅ Testing Checklist

- [ ] Scene 1 shows Hook in prompt
- [ ] Last scene shows CTA in prompt  
- [ ] Middle scenes unaffected
- [ ] Works with 1, 2, 3+ scenes
- [ ] Hook/CTA random each time
- [ ] Context variables replaced ({item}, {price})

## 🚀 Deployment

All changes committed to:
- `flowai-dev/` (main)
- `flowai-dev - Copy/` (backup)

Ready for production testing.

---

**Key Commits:**
- `fdbdbc7` - Implementation Summary
- `e63ca3e` - ViralHooks + FormatConverter
- `1a7c280` - Scene-specific CTA logic
