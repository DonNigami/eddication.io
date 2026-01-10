# 🎬 Extend Scene Feature - Implementation Guide

## 📖 Overview

ฟีเจอร์ **Extend Scene** จาก Flow-Auto-2026 ช่วยให้สามารถต่อฉากใน Google Labs Flow อัตโนมัติจาก CSV prompts

---

## ✨ Features

### 1. **Extend Scene Mode**
- เปิด/ปิดโหมด Extend Scene ผ่าน Checkbox
- อัปโหลด CSV ที่มี prompts สำหรับต่อฉาก
- ประมวลผล prompts ทีละรายการอัตโนมัติ

### 2. **Automated Process**
```
1. Click (+) button → เปิดเมนู
2. Click "Extend" → เลือกคำสั่งต่อฉาก
3. Fill prompt → กรอก prompt จาก CSV
4. Click Send → ส่งคำสั่ง
5. Wait 80% completion → รอจนถึง 80%
6. Next prompt → ไปยัง prompt ถัดไป
```

### 3. **Smart Waiting System**
- ตรวจสอบ aria-label ที่แสดง % progress
- รอจนถึง 80% (ไม่ต้องรอ 100%)
- Auto-proceed to next prompt
- Timeout protection (5 minutes max)

### 4. **Controls**
- ✅ Start Extend: เริ่มการต่อฉาก
- ⏹️ Stop: หยุดการทำงานทันที
- 📊 Progress display: แสดงความคืบหน้า

---

## 🏗️ Implementation Plan

### **Phase 1: UI Components**

#### 1.1 Add Extend Section to HTML
ตำแหน่ง: `html/sidebar.html` (ในแท็บที่เกี่ยวข้อง)

```html
<!-- Extend Scene Section (Show in appropriate mode) -->
<div id="extendSceneSection" class="section-card hidden">
    <div class="section-header">
        <span class="section-icon">🎬</span>
        <span class="section-title">Extend Scene</span>
    </div>

    <div class="form-group">
        <div class="checkbox-wrapper">
            <label class="checkbox-label">
                <input type="checkbox" id="extendSceneToggle">
                <span><b>Enable Extend Scene Mode</b></span>
            </label>
            <div class="help-text">ต่อฉากอัตโนมัติจาก CSV prompts</div>
        </div>
    </div>

    <div id="extendSceneControls" class="hidden">
        <!-- CSV Upload -->
        <div class="form-group">
            <label>
                <span class="icon">📄</span> CSV Prompts สำหรับต่อฉาก
            </label>
            <input type="file" 
                   id="extendCsvInput" 
                   accept=".csv" 
                   class="file-input">
            <div id="extendCsvStatus" class="status-text">
                ยังไม่ได้เลือกไฟล์
            </div>
        </div>

        <!-- Preview Prompts -->
        <div id="extendPromptsPreview" class="prompts-preview hidden">
            <div class="preview-header">
                <span>📋 Preview Prompts</span>
                <span id="extendPromptsCount" class="badge">0</span>
            </div>
            <div id="extendPromptsContent" class="preview-content"></div>
        </div>

        <!-- Controls -->
        <div class="extend-controls" style="display: flex; gap: 8px; margin-top: 16px;">
            <button id="startExtendBtn" class="btn btn-primary" style="flex: 1;">
                <span class="icon">🎬</span> Start Extend
            </button>
            <button id="stopExtendBtn" class="btn btn-danger hidden" style="flex: 0 0 auto;">
                <span class="icon">⏹</span> Stop
            </button>
        </div>

        <!-- Progress Display -->
        <div id="extendProgress" class="progress-container hidden">
            <div class="progress-header">
                <span id="extendProgressText">0/0 scenes</span>
                <span id="extendProgressPercent">0%</span>
            </div>
            <div class="progress-bar">
                <div id="extendProgressFill" class="progress-fill"></div>
            </div>
            <div id="extendCurrentScene" class="current-scene"></div>
        </div>
    </div>
</div>
```

#### 1.2 Add Styles
ตำแหน่ง: `css/components.css` หรือไฟล์ที่เหมาะสม

```css
/* Extend Scene Styles */
.extend-controls {
    display: flex;
    gap: 8px;
    margin-top: 16px;
}

.prompts-preview {
    margin-top: 12px;
    padding: 12px;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    max-height: 200px;
    overflow-y: auto;
}

.preview-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-weight: 600;
}

.preview-content {
    font-size: 0.9em;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.8);
}

.preview-content .prompt-item {
    padding: 4px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.preview-content .prompt-item:last-child {
    border-bottom: none;
}

.progress-container {
    margin-top: 16px;
    padding: 12px;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 8px;
}

.progress-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    font-weight: 600;
}

.progress-bar {
    height: 8px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #10b981 0%, #059669 100%);
    transition: width 0.3s ease;
    width: 0%;
}

.current-scene {
    margin-top: 8px;
    font-size: 0.9em;
    color: rgba(255, 255, 255, 0.7);
}

.badge {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 0.85em;
    font-weight: 600;
}

.status-text {
    margin-top: 4px;
    font-size: 0.9em;
    color: rgba(255, 255, 255, 0.6);
}

.status-text.success {
    color: #4ade80;
}

.status-text.error {
    color: #ef4444;
}

.help-text {
    font-size: 0.85em;
    color: rgba(255, 255, 255, 0.5);
    margin-top: 4px;
}
```

---

### **Phase 2: JavaScript Module**

#### 2.1 Create Extend Scene Module
สร้างไฟล์: `js/modules/extendScene.js`

```javascript
/**
 * Extend Scene Module
 * Handles automated scene extension from CSV prompts
 */

class ExtendScene {
    constructor() {
        this.prompts = [];
        this.isActive = false;
        this.isPaused = false;
        this.currentIndex = 0;
        this.totalPrompts = 0;
        
        this.initializeElements();
        this.attachEventListeners();
    }

    initializeElements() {
        // Toggle
        this.toggle = document.getElementById('extendSceneToggle');
        this.controls = document.getElementById('extendSceneControls');
        
        // CSV Input
        this.csvInput = document.getElementById('extendCsvInput');
        this.csvStatus = document.getElementById('extendCsvStatus');
        
        // Preview
        this.preview = document.getElementById('extendPromptsPreview');
        this.promptsCount = document.getElementById('extendPromptsCount');
        this.promptsContent = document.getElementById('extendPromptsContent');
        
        // Buttons
        this.startBtn = document.getElementById('startExtendBtn');
        this.stopBtn = document.getElementById('stopExtendBtn');
        
        // Progress
        this.progress = document.getElementById('extendProgress');
        this.progressText = document.getElementById('extendProgressText');
        this.progressPercent = document.getElementById('extendProgressPercent');
        this.progressFill = document.getElementById('extendProgressFill');
        this.currentScene = document.getElementById('extendCurrentScene');
    }

    attachEventListeners() {
        if (this.toggle) {
            this.toggle.addEventListener('change', (e) => this.handleToggle(e));
        }

        if (this.csvInput) {
            this.csvInput.addEventListener('change', (e) => this.handleCsvUpload(e));
        }

        if (this.startBtn) {
            this.startBtn.addEventListener('click', () => this.startExtending());
        }

        if (this.stopBtn) {
            this.stopBtn.addEventListener('click', () => this.stopExtending());
        }
    }

    handleToggle(event) {
        if (event.target.checked) {
            this.controls?.classList.remove('hidden');
            this.showNotification('🎬 เปิดโหมด Extend Scene');
        } else {
            this.controls?.classList.add('hidden');
            this.hideProgress();
            this.showNotification('ปิดโหมด Extend Scene');
        }
    }

    async handleCsvUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await this.readFileAsText(file);
            this.prompts = this.parseCsv(text);
            
            if (this.prompts.length === 0) {
                this.showError('⚠️ ไม่พบ prompts ในไฟล์ CSV');
                return;
            }

            this.totalPrompts = this.prompts.length;
            this.updateCsvStatus(`✅ โหลด ${this.totalPrompts} prompts แล้ว`, 'success');
            this.showPreview();
            
        } catch (error) {
            console.error('Error reading CSV:', error);
            this.showError('⚠️ เกิดข้อผิดพลาดในการอ่านไฟล์');
        }
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file, 'UTF-8');
        });
    }

    parseCsv(text) {
        // Simple CSV parsing (one prompt per line)
        return text
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0);
    }

    showPreview() {
        if (!this.preview || !this.promptsContent) return;

        this.preview.classList.remove('hidden');
        if (this.promptsCount) {
            this.promptsCount.textContent = this.totalPrompts;
        }

        // Show first 5 prompts
        const previewPrompts = this.prompts.slice(0, 5);
        const html = previewPrompts.map((prompt, index) => 
            `<div class="prompt-item">${index + 1}. ${this.truncate(prompt, 60)}</div>`
        ).join('');

        this.promptsContent.innerHTML = html;

        if (this.totalPrompts > 5) {
            this.promptsContent.innerHTML += 
                `<div class="prompt-item" style="color: rgba(255,255,255,0.5);">
                    ... และอีก ${this.totalPrompts - 5} prompts
                </div>`;
        }
    }

    truncate(text, length) {
        return text.length > length ? text.substring(0, length) + '...' : text;
    }

    async startExtending() {
        if (!this.prompts || this.prompts.length === 0) {
            this.showNotification('⚠️ กรุณาอัปโหลด CSV ก่อน');
            return;
        }

        // Check if connected to Flow
        const tabs = await chrome.tabs.query({ 
            url: '*://labs.google/fx/tools/flow*' 
        });

        if (tabs.length === 0) {
            this.showNotification('⚠️ กรุณาเปิดหน้า Google Flow ก่อน');
            return;
        }

        this.isActive = true;
        this.currentIndex = 0;

        // Update UI
        this.startBtn.disabled = true;
        this.startBtn.innerHTML = '<span class="icon">⏳</span> กำลังทำงาน...';
        this.stopBtn?.classList.remove('hidden');
        this.showProgress();

        // Send to content script
        const tasks = this.prompts.map((prompt, index) => ({
            mode: 'extend',
            prompt: prompt,
            id: index
        }));

        chrome.tabs.sendMessage(tabs[0].id, {
            action: 'startBatch',
            tasks: tasks,
            settings: {
                mode: 'extend',
                waitForPercent: 80
            }
        });

        this.showNotification(`🚀 เริ่มต่อฉาก ${this.totalPrompts} รายการ`);
    }

    stopExtending() {
        this.isActive = false;
        
        chrome.tabs.query({ url: '*://labs.google/fx/tools/flow*' }, (tabs) => {
            if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'stopAutomation'
                });
            }
        });

        this.resetUI();
        this.showNotification('⏹ หยุดการทำงาน');
    }

    updateProgress(current, total) {
        this.currentIndex = current;
        
        if (this.progressText) {
            this.progressText.textContent = `${current}/${total} scenes`;
        }

        if (this.progressPercent) {
            const percent = Math.round((current / total) * 100);
            this.progressPercent.textContent = `${percent}%`;
        }

        if (this.progressFill) {
            const percent = (current / total) * 100;
            this.progressFill.style.width = `${percent}%`;
        }

        if (this.currentScene && current < total) {
            const prompt = this.prompts[current];
            this.currentScene.textContent = `ปัจจุบัน: ${this.truncate(prompt, 80)}`;
        }
    }

    showProgress() {
        this.progress?.classList.remove('hidden');
        this.updateProgress(0, this.totalPrompts);
    }

    hideProgress() {
        this.progress?.classList.add('hidden');
    }

    resetUI() {
        this.startBtn.disabled = false;
        this.startBtn.innerHTML = '<span class="icon">🎬</span> Start Extend';
        this.stopBtn?.classList.add('hidden');
        this.hideProgress();
    }

    updateCsvStatus(message, type = '') {
        if (this.csvStatus) {
            this.csvStatus.textContent = message;
            this.csvStatus.className = `status-text ${type}`;
        }
    }

    showNotification(message) {
        // Use existing notification system
        if (window.showNotification) {
            window.showNotification(message);
        } else {
            console.log(message);
        }
    }

    showError(message) {
        this.updateCsvStatus(message, 'error');
        this.showNotification(message);
    }

    // Called when automation completes
    onComplete() {
        this.isActive = false;
        this.resetUI();
        this.showNotification(`✅ เสร็จสิ้นการต่อฉาก ${this.totalPrompts} รายการ!`);
    }

    // Called when automation updates
    onUpdate(current, total) {
        this.updateProgress(current, total);
    }
}

// Export
window.ExtendScene = ExtendScene;

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.extendScene = new ExtendScene();
    });
} else {
    window.extendScene = new ExtendScene();
}
```

---

### **Phase 3: Content Script Updates**

#### 3.1 Add Extend Scene Handler
เพิ่มใน `content/platforms/googleFlow.js` (ไฟล์ใหม่) หรือเพิ่มใน content script ที่มีอยู่

```javascript
/**
 * Google Flow Content Script - Extend Scene Support
 */

// Extend Scene Functions
function clickExtendButton() {
    console.log('[Flow] Looking for Extend button...');
    
    // Try specific Radix selector
    try {
        const radixItems = document.querySelectorAll('[role="menuitem"]');
        for (const item of radixItems) {
            if (item.textContent.includes('Extend') && item.offsetParent !== null) {
                console.log('[Flow] Found Extend in Radix menu');
                item.click();
                return true;
            }
        }
    } catch (e) {
        console.error('[Flow] Error finding Extend:', e);
    }

    // Fallback: Find by aria-label or text
    const buttons = document.querySelectorAll('button, [role="button"], [role="menuitem"]');
    for (const btn of buttons) {
        const text = btn.textContent?.trim() || '';
        const ariaLabel = btn.getAttribute('aria-label') || '';
        
        if ((text.includes('Extend') || ariaLabel.includes('Extend')) && 
            btn.offsetParent !== null) {
            console.log('[Flow] Found Extend button');
            btn.click();
            return true;
        }
    }
    
    console.warn('[Flow] Extend button not found');
    return false;
}

async function handleExtendScene(task) {
    console.log('[Flow] Handling Extend Scene:', task.prompt.substring(0, 50));
    
    // 1. Click (+) button
    const plusClicked = await clickPlusButton();
    if (!plusClicked) {
        console.error('[Flow] Failed to click (+) button');
        return false;
    }

    await delay(1500);

    // 2. Click Extend
    const extendClicked = clickExtendButton();
    if (!extendClicked) {
        console.error('[Flow] Failed to click Extend');
        return false;
    }

    await delay(2000);

    // 3. Fill prompt
    fillScriptField(task.prompt);
    await delay(2000);

    // 4. Click Send
    clickSendButton();
    await delay(2000);

    // 5. Wait for completion (80%)
    await waitForExtendCompletion(task.settings?.waitForPercent || 80);

    return true;
}

async function clickPlusButton() {
    // Try specific ID first
    const pinholeBtn = document.getElementById('PINHOLE_ADD_CLIP_CARD_ID');
    if (pinholeBtn) {
        pinholeBtn.click();
        console.log('[Flow] Clicked + button (ID)');
        return true;
    }

    // Fallback: Find by aria-label or text
    const buttons = document.querySelectorAll('button, [role="button"]');
    for (const btn of buttons) {
        const ariaLabel = btn.getAttribute('aria-label') || '';
        const text = btn.textContent?.trim() || '';
        
        if (ariaLabel.includes('Add') || text === '+') {
            btn.click();
            console.log('[Flow] Clicked + button (fallback)');
            return true;
        }
    }

    console.warn('[Flow] (+) button not found');
    return false;
}

async function waitForExtendCompletion(targetPercent = 80) {
    console.log(`[Flow] Waiting for ${targetPercent}% completion...`);
    
    return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 600; // 10 minutes max
        
        const interval = setInterval(() => {
            attempts++;
            
            // Check aria-label for progress
            const elements = document.querySelectorAll('[aria-label]');
            for (const el of elements) {
                const label = el.getAttribute('aria-label');
                const match = label.match(/(\d+)%/);
                
                if (match) {
                    const percent = parseInt(match[1]);
                    if (percent >= targetPercent) {
                        clearInterval(interval);
                        console.log(`[Flow] Reached ${percent}%!`);
                        resolve(true);
                        return;
                    }
                }
            }
            
            // Timeout check
            if (attempts >= maxAttempts) {
                clearInterval(interval);
                console.warn('[Flow] Timeout waiting for completion');
                resolve(false);
            }
        }, 1000);
    });
}

function fillScriptField(prompt) {
    // Find script/prompt textarea
    const textareas = document.querySelectorAll('textarea');
    for (const textarea of textareas) {
        if (textarea.offsetParent !== null) {
            textarea.value = prompt;
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            console.log('[Flow] Filled prompt');
            return true;
        }
    }
    
    console.warn('[Flow] Script field not found');
    return false;
}

function clickSendButton() {
    // Find Send button
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
        const text = btn.textContent?.trim() || '';
        const ariaLabel = btn.getAttribute('aria-label') || '';
        
        if ((text.includes('Send') || ariaLabel.includes('Send')) && 
            btn.offsetParent !== null) {
            btn.click();
            console.log('[Flow] Clicked Send button');
            return true;
        }
    }
    
    console.warn('[Flow] Send button not found');
    return false;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## 🔗 Integration Steps

### 1. **Add to Sidebar**
ใน `html/sidebar.html`, เพิ่มส่วน Extend Scene ตำแหน่งที่เหมาะสม (แนะนำให้อยู่ในแท็บที่เกี่ยวข้องกับการสร้างคอนเทนต์)

### 2. **Import Module**
ใน `html/sidebar.html`, เพิ่ม script tag:
```html
<script src="../js/modules/extendScene.js"></script>
```

### 3. **Update Content Script**
เพิ่มการรองรับ Extend Scene ใน content script:
- เพิ่ม handler สำหรับ `action: 'startBatch'` กรณี mode = 'extend'
- เพิ่มฟังก์ชัน extend scene ที่จำเป็น

### 4. **Test**
1. โหลด extension
2. เปิดหน้า Google Flow
3. เปิด Extend Scene mode
4. อัปโหลด CSV
5. คลิก Start Extend
6. ตรวจสอบการทำงาน

---

## 📝 CSV Format

ตัวอย่างไฟล์ CSV สำหรับ Extend Scene:

```csv
A professional product showcase with dynamic lighting
Modern minimalist scene with elegant transitions
Cinematic slow-motion product reveal
Vibrant colors with smooth camera movements
Luxury style presentation with golden hour lighting
```

หรือแบบมี header:
```csv
prompt
A professional product showcase with dynamic lighting
Modern minimalist scene with elegant transitions
Cinematic slow-motion product reveal
```

---

## 🎯 Next Steps

1. ✅ Implement UI components
2. ✅ Create ExtendScene module
3. ✅ Add content script handlers
4. ✅ Test with Google Flow
5. 🔄 Add progress tracking
6. 🔄 Add error handling
7. 🔄 Add pause/resume
8. 🔄 Save prompts history

---

## 💡 Future Enhancements

- 📊 **Analytics**: Track success rate ของแต่ละ prompt
- 🎨 **Template Library**: สร้าง prompt templates สำเร็จรูป
- 🔀 **Randomization**: สุ่มลำดับ prompts
- 📝 **Prompt Editor**: แก้ไข prompts ก่อนรัน
- 💾 **Auto-save**: บันทึกผลลัพธ์อัตโนมัติ
- 🔄 **Retry Logic**: ลองใหม่อัตโนมัติถ้าล้มเหลว
- 📱 **Notifications**: แจ้งเตือนเมื่อเสร็จสิ้น

---

**Created**: January 10, 2026  
**Version**: 1.0  
**Status**: Ready for Implementation
