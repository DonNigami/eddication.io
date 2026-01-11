/**
 * Extend Scene Module for flowai-dev
 * Automated scene extension from CSV prompts for Google Labs Flow
 */

// Safeguard: Define workflowState globally if other scripts need it
if (typeof window.workflowState === 'undefined') {
    window.workflowState = {};
}

class ExtendScene {
    constructor() {
        this.prompts = [];
        this.isActive = false;
        this.isPaused = false;
        this.currentIndex = 0;
        this.totalPrompts = 0;

        this.initializeElements();
        this.attachEventListeners();
        this.loadState();
    }

    initializeElements() {
        // Toggle
        this.toggle = document.getElementById('extendSceneToggle');
        this.controls = document.getElementById('extendSceneControls');

        // CSV Input
        this.csvInput = document.getElementById('extendCsvInput');
        this.csvStatus = document.getElementById('extendCsvStatus');

        // Settings
        this.waitPercentInput = document.getElementById('extendWaitPercent');
        this.timeoutInput = document.getElementById('extendTimeout');
        this.runCountInput = document.getElementById('extendRunCount');
        this.shuffleToggle = document.getElementById('extendShuffleToggle');

        // Preview
        this.preview = document.getElementById('extendPromptsPreview');
        this.promptsCount = document.getElementById('extendPromptsCount');
        this.promptsContent = document.getElementById('extendPromptsContent');
        this.templatePreview = document.getElementById('extendTemplatePreview');

        // Buttons
        this.startBtn = document.getElementById('startExtendBtn');
        this.stopBtn = document.getElementById('stopExtendBtn');

        // Camera Angle
        this.cameraAngleSelect = document.getElementById('extendCameraAngle');
        this.randomCameraAngleBtn = document.getElementById('randomCameraAngleBtn');

        // Template library
        this.templateSelect = document.getElementById('extendTemplateSelect');
        this.loadTemplateBtn = document.getElementById('loadExtendTemplateBtn');

        // Progress
        this.progress = document.getElementById('extendProgress');
        this.progressText = document.getElementById('extendProgressText');
        this.progressPercent = document.getElementById('extendProgressPercent');
        this.progressFill = document.getElementById('extendProgressFill');
        this.currentScene = document.getElementById('extendCurrentScene');

        // Status & Log
        this.statusBar = document.getElementById('extendStatusBar');
        this.logList = document.getElementById('extendLogList');
        this.clearCacheBtn = document.getElementById('clearExtendCacheBtn');

        // Prompt Generator
        this.clipDescription = document.getElementById('extendClipDescription');
        this.generateBtn = document.getElementById('generateExtendPromptsBtn');
        this.generatorStatus = document.getElementById('extendGeneratorStatus');
        this.generatedPreview = document.getElementById('extendGeneratedPreview');
        this.useGeneratedBtn = document.getElementById('useGeneratedPromptsBtn');
        this.generatedPrompts = [];
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

        if (this.loadTemplateBtn) {
            this.loadTemplateBtn.addEventListener('click', () => this.handleLoadTemplate());
        }

        if (this.templateSelect) {
            this.templateSelect.addEventListener('change', () => this.handleTemplateChange());
        }

        if (this.clearCacheBtn) {
            this.clearCacheBtn.addEventListener('click', () => this.handleClearCache());
        }

        if (this.generateBtn) {
            this.generateBtn.addEventListener('click', () => this.handleGeneratePrompts());
        }

        if (this.useGeneratedBtn) {
            this.useGeneratedBtn.addEventListener('click', () => this.handleUseGeneratedPrompts());
        }

        // Camera Angle randomizer
        if (this.randomCameraAngleBtn) {
            this.randomCameraAngleBtn.addEventListener('click', () => this.randomizeCameraAngle());
        }

        // Listen for updates from content script
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'extendProgress') {
                this.onUpdate(request.current, request.total);
            } else if (request.action === 'extendComplete') {
                this.onComplete();
            } else if (request.action === 'extendError') {
                this.onError(request.error);
            } else if (request.action === 'extendLog') {
                this.addLog(request.message);
            } else if (request.action === 'extendStatus') {
                this.updateStatus(request.status);
            }
        });
    }

    updateStatus(text) {
        const bar = document.getElementById('extendStatusBar');
        if (!bar) return;
        if (text) {
            bar.textContent = text;
            bar.style.display = '';
        } else {
            bar.style.display = 'none';
        }
    }

    addLog(message) {
        const list = document.getElementById('extendLogList');
        if (!list) return;
        const ts = new Date().toLocaleTimeString();
        const item = document.createElement('div');
        item.textContent = `[${ts}] ${message}`;
        list.appendChild(item);
        list.scrollTop = list.scrollHeight;
    }

    async handleLoadTemplate() {
        const file = this.templateSelect?.value;
        if (!file) {
            this.showNotification('⚠️ กรุณาเลือกเทมเพลตก่อน', 'warning');
            return;
        }

        try {
            this.updateCsvStatus('⏳ กำลังโหลดเทมเพลต...', 'info');
            const url = chrome.runtime.getURL(`examples/extend-prompts/${file}`);
            const res = await fetch(url);
            const text = await res.text();
            this.prompts = this.parseCsv(text);

            if (!this.prompts || this.prompts.length === 0) {
                this.showError('⚠️ ไม่พบ prompts ในเทมเพลต');
                return;
            }

            this.totalPrompts = this.prompts.length;
            this.updateCsvStatus(`✅ โหลดเทมเพลต ${this.totalPrompts} prompts แล้ว`, 'success');
            this.showPreview();
            this.saveState({ extendPrompts: this.prompts });
            this.updateStatus('Template loaded. Ready to start.');
        } catch (error) {
            console.error('Error loading template:', error);
            this.showError('⚠️ โหลดเทมเพลตไม่สำเร็จ');
        }
    }

    async handleTemplateChange() {
        const file = this.templateSelect?.value;
        if (!file) {
            if (this.templatePreview) {
                this.templatePreview.style.display = 'none';
                this.templatePreview.textContent = '';
            }
            return;
        }
        try {
            const url = chrome.runtime.getURL(`examples/extend-prompts/${file}`);
            const res = await fetch(url);
            const text = await res.text();
            const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

            if (lines.length === 0) {
                if (this.templatePreview) {
                    this.templatePreview.style.display = '';
                    this.templatePreview.textContent = 'ไม่พบ prompts';
                }
                return;
            }

            // Display all prompts (up to 5)
            const previewPrompts = lines.slice(0, 5);
            const previewHtml = previewPrompts.map((prompt, index) =>
                `<div style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); last-child:border-bottom:none;">
                    <div style="font-weight: 600; color: #3b82f6; font-size: 0.8rem; margin-bottom: 4px;">Prompt ${index + 1}</div>
                    <div style="color: var(--text-primary); font-size: 0.85rem; line-height: 1.4;">${this.escapeHtml(prompt)}</div>
                </div>`
            ).join('');

            if (this.templatePreview) {
                this.templatePreview.style.display = '';
                this.templatePreview.innerHTML = previewHtml;
            }
        } catch (err) {
            if (this.templatePreview) {
                this.templatePreview.style.display = '';
                this.templatePreview.textContent = 'ไม่สามารถโหลดตัวอย่างได้';
            }
        }
    }

    handleToggle(event) {
        const isEnabled = event.target.checked;

        if (isEnabled) {
            this.controls?.classList.remove('hidden');
            this.showNotification('🎬 เปิดโหมด Extend Scene', 'info');
        } else {
            this.controls?.classList.add('hidden');
            this.hideProgress();
            this.showNotification('ปิดโหมด Extend Scene', 'info');
        }

        // Save state
        this.saveState({ extendModeEnabled: isEnabled });
    }

    async handleCsvUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            this.updateCsvStatus('⏳ กำลังโหลด...', 'info');

            const text = await this.readFileAsText(file);
            this.prompts = this.parseCsv(text);

            if (this.prompts.length === 0) {
                this.showError('⚠️ ไม่พบ prompts ในไฟล์ CSV');
                return;
            }

            this.totalPrompts = this.prompts.length;
            this.updateCsvStatus(`✅ โหลด ${this.totalPrompts} prompts แล้ว`, 'success');
            this.showPreview();

            // Save prompts
            this.saveState({ extendPrompts: this.prompts });

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
        // Parse CSV - handle both simple and header formats
        const lines = text.split(/\r?\n/).map(line => line.trim());

        // Check if first line is a header
        const firstLine = lines[0].toLowerCase();
        const isHeader = firstLine === 'prompt' || firstLine === 'prompts' ||
            firstLine === 'text' || firstLine.includes(',');

        // Filter out empty lines and optionally skip header
        const startIndex = isHeader ? 1 : 0;
        return lines.slice(startIndex).filter(line => line.length > 0);
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
            `<div class="prompt-item">
                <span class="prompt-number">${index + 1}.</span>
                <span class="prompt-text">${this.escapeHtml(this.truncate(prompt, 80))}</span>
            </div>`
        ).join('');

        this.promptsContent.innerHTML = html;

        if (this.totalPrompts > 5) {
            this.promptsContent.innerHTML +=
                `<div class="prompt-item more">
                    <span class="prompt-text">... และอีก ${this.totalPrompts - 5} prompts</span>
                </div>`;
        }
    }

    truncate(text, length) {
        return text.length > length ? text.substring(0, length) + '...' : text;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async startExtending() {
        if (!this.prompts || this.prompts.length === 0) {
            this.showNotification('⚠️ กรุณาอัปโหลด CSV ก่อน', 'warning');
            return;
        }

        // Check if connected to Flow
        const tabs = await chrome.tabs.query({
            url: '*://labs.google/fx/tools/flow*'
        });

        if (tabs.length === 0) {
            this.showNotification('⚠️ กรุณาเปิดหน้า Google Flow ก่อน', 'warning');
            return;
        }

        this.isActive = true;
        this.currentIndex = 0;

        // Update UI
        this.startBtn.disabled = true;
        this.startBtn.innerHTML = '<span class="icon">⏳</span> กำลังทำงาน...';
        this.stopBtn?.classList.remove('hidden');
        this.showProgress();

        // Prepare prompt list with optional shuffle and run count
        let promptList = Array.isArray(this.prompts) ? [...this.prompts] : [];
        const runCountRaw = this.runCountInput?.value?.trim();
        const runCount = runCountRaw ? Math.max(1, Math.min(parseInt(runCountRaw, 10) || 1, promptList.length)) : promptList.length;
        const doShuffle = !!this.shuffleToggle?.checked;

        if (doShuffle) {
            promptList = this.shuffleArray(promptList);
        }
        promptList = promptList.slice(0, runCount);

        // Prepare tasks
        const tasks = promptList.map((prompt, index) => ({
            mode: 'extend',
            prompt: this.applyCameraAngle(prompt),
            id: index,
            type: 'extend_scene'
        }));

        // Get settings from UI
        const waitPercent = parseInt(this.waitPercentInput?.value || '80');
        const timeout = parseInt(this.timeoutInput?.value || '120');

        // Send to content script with detailed error handling
        try {
            const response = await chrome.tabs.sendMessage(tabs[0].id, {
                action: 'startBatch',
                tasks: tasks,
                settings: {
                    mode: 'extend',
                    waitForPercent: waitPercent,
                    timeout: timeout,
                    delayBetweenTasks: 3000
                }
            });

            if (response?.success) {
                this.totalPrompts = promptList.length;
                this.showNotification(`🚀 เริ่มต่อฉาก ${this.totalPrompts} รายการ`, 'success');
            } else {
                throw new Error(response?.error || 'Unknown response error');
            }

        } catch (error) {
            console.error('Error starting extend:', error);

            // Better error messages
            let errorMsg = '⚠️ ไม่สามารถเชื่อมต่อกับหน้า Flow ได้';

            if (error.message.includes('Could not establish connection')) {
                errorMsg = '⚠️ Content script ไม่โหลด - รีเฟรชหน้า Google Flow';
            } else if (error.message.includes('Extension context invalidated')) {
                errorMsg = '⚠️ Extension หมดอายุ - โปรดโหลด Extension ใหม่';
            } else if (error.message.includes('Receiving end does not exist')) {
                errorMsg = '⚠️ ไม่พบ content script - รีเฟรชหน้า Google Flow';
            }

            this.showError(errorMsg);
            console.log('[ExtendScene] Debugging info:', {
                tabFound: tabs.length > 0,
                tabId: tabs[0]?.id,
                tabUrl: tabs[0]?.url,
                errorMessage: error.message
            });
            this.resetUI();
        }
    }

    shuffleArray(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    randomizeCameraAngle() {
        const angles = ['front', 'side', 'top-down', 'low-angle', 'high-angle', 'pov', 'close-up', 'wide', 'dutch-tilt', 'tracking'];
        const pick = angles[Math.floor(Math.random() * angles.length)];
        if (this.cameraAngleSelect) {
            this.cameraAngleSelect.value = pick;
            this.showNotification(`🎥 มุมกล้อง: ${pick}`, 'info');
        }
    }

    getCameraAngleDescription(value) {
        const map = {
            'front': 'Camera angle: front-facing, centered subject, head-on framing.',
            'side': 'Camera angle: side profile, lateral perspective.',
            'top-down': 'Camera angle: top-down overhead view.',
            'low-angle': 'Camera angle: low angle (looking up), dramatic presence.',
            'high-angle': 'Camera angle: high angle (looking down), overview perspective.',
            'pov': 'Camera angle: POV (first person) perspective.',
            'close-up': 'Camera angle: close-up, tight framing on face/object.',
            'wide': 'Camera angle: wide shot, expansive framing.',
            'dutch-tilt': 'Camera angle: Dutch tilt (diagonal horizon) for tension.',
            'tracking': 'Camera angle: tracking shot following subject movement.'
        };
        return map[value] || '';
    }

    applyCameraAngle(prompt) {
        const value = this.cameraAngleSelect?.value || 'random';
        let chosen = value;
        if (value === 'random') {
            const angles = ['front', 'side', 'top-down', 'low-angle', 'high-angle', 'pov', 'close-up', 'wide', 'dutch-tilt', 'tracking'];
            chosen = angles[Math.floor(Math.random() * angles.length)];
        }
        const desc = this.getCameraAngleDescription(chosen);
        if (!desc) return prompt;
        // Avoid duplicate camera instructions if prompt already contains Camera angle
        if (/(Camera angle|มุมกล้อง)/i.test(prompt)) {
            return prompt;
        }
        return `${prompt} ${desc}`;
    }

    async stopExtending() {
        if (!this.isActive) return;

        this.isActive = false;

        const tabs = await chrome.tabs.query({
            url: '*://labs.google/fx/tools/flow*'
        });

        if (tabs.length > 0) {
            try {
                await chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'stopAutomation'
                });
            } catch (error) {
                console.error('Error stopping extend:', error);
            }
        }

        this.resetUI();
        this.showNotification('⏹ หยุดการทำงาน', 'info');
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
        if (this.startBtn) {
            this.startBtn.disabled = false;
            this.startBtn.innerHTML = '<span class="icon">🎬</span> Start Extend';
        }
        this.stopBtn?.classList.add('hidden');

        // Don't hide progress immediately, let user see final result
        setTimeout(() => {
            if (!this.isActive) {
                this.hideProgress();
            }
        }, 5000);
    }

    updateCsvStatus(message, type = '') {
        if (this.csvStatus) {
            this.csvStatus.textContent = message;
            this.csvStatus.className = `status-text ${type}`;
        }
    }

    showNotification(message, type = 'info') {
        // Use existing notification system
        if (window.showNotification) {
            window.showNotification(message);
        } else if (console) {
            const emoji = {
                'success': '✅',
                'error': '⚠️',
                'warning': '⚠️',
                'info': 'ℹ️'
            };
            console.log(`${emoji[type] || ''} ${message}`);
        }
    }

    showError(message) {
        this.updateCsvStatus(message, 'error');
        this.showNotification(message, 'error');
    }

    // Save/Load state
    saveState(data) {
        chrome.storage.local.get(['extendSceneState'], (result) => {
            const state = result.extendSceneState || {};
            Object.assign(state, data);
            chrome.storage.local.set({ extendSceneState: state });
        });
    }

    loadState() {
        chrome.storage.local.get(['extendSceneState'], (result) => {
            const state = result.extendSceneState || {};

            if (state.extendModeEnabled && this.toggle) {
                this.toggle.checked = true;
                this.controls?.classList.remove('hidden');
            }

            if (state.extendPrompts && state.extendPrompts.length > 0) {
                this.prompts = state.extendPrompts;
                this.totalPrompts = this.prompts.length;
                this.updateCsvStatus(`โหลด ${this.totalPrompts} prompts จากครั้งก่อน`, 'success');
                this.showPreview();
            }
        });
    }

    // Callbacks from content script
    handleGeneratePrompts() {
        const description = this.clipDescription?.value?.trim();
        if (!description) {
            this.showError('⚠️ กรุณาอธิบายคลิปก่อนหน้า');
            return;
        }

        if (this.generatorStatus) {
            this.generatorStatus.textContent = '⏳ กำลังสร้าง prompts...';
        }

        // Generate 5 prompts based on description
        this.generatedPrompts = this.generatePromptsFromDescription(description);

        // Display generated prompts
        if (this.generatedPreview && this.generatedPrompts.length > 0) {
            const previewHtml = this.generatedPrompts.map((prompt, index) =>
                `<div style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <div style="font-weight: 600; color: #10b981; font-size: 0.8rem; margin-bottom: 4px;">Prompt ${index + 1}</div>
                    <div style="color: var(--text-primary); font-size: 0.85rem; line-height: 1.4;">${this.escapeHtml(prompt)}</div>
                </div>`
            ).join('');

            this.generatedPreview.innerHTML = previewHtml;
            this.generatedPreview.style.display = '';
        }

        if (this.useGeneratedBtn) {
            this.useGeneratedBtn.classList.remove('hidden');
        }

        if (this.generatorStatus) {
            this.generatorStatus.textContent = `✓ สร้าง ${this.generatedPrompts.length} prompts แล้ว`;
        }

        this.showNotification('✓ สร้าง prompts สำเร็จ', 'success');
    }

    generatePromptsFromDescription(description) {
        // Template-based prompt generation based on description keywords
        const prompts = [];
        const desc = description.toLowerCase();

        // Analyze description for keywords
        const isProduct = desc.includes('สินค้า') || desc.includes('โชว์') || desc.includes('ผลิตภัณฑ์');
        const isProblem = desc.includes('ปัญหา') || desc.includes('เจอ') || desc.includes('เสียหาย');
        const isReview = desc.includes('รีวิว') || desc.includes('ความเห็น') || desc.includes('ดี');
        const isStory = desc.includes('เรื่อง') || desc.includes('ประสบการณ์') || desc.includes('สาเหตุ');

        // Generate 5-part narrative prompts
        prompts.push(
            `Extend seamlessly. Voice: Match previous tone and character. Expression shows interest in the topic. Speech: "${this.generateThaiSpeech('hook', desc)}" Audio: Natural background, clear voice, engaging energy. No text on screen. No Captions`
        );

        prompts.push(
            `Continuous transition. Voice: Keep character identity, shift to more informative tone. Character demonstrates understanding. Speech: "${this.generateThaiSpeech('point1', desc)}" Audio: Clear voice, consistent pacing. No subtitles. No text on screen. No Captions`
        );

        prompts.push(
            `Sequential extension. Voice: Same voice, tone becomes more engaging and practical. Show genuine emotion. Speech: "${this.generateThaiSpeech('point2', desc)}" Audio: High clarity, natural rhythm. No watermark. No text on screen. No Captions`
        );

        prompts.push(
            `Deeper explanation. Voice: Keep narrative flow, tone is persuasive and trustworthy. Character leans in with emphasis. Speech: "${this.generateThaiSpeech('point3', desc)}" Audio: Warm tone, steady pacing. No subtitles. No text on screen. No Captions`
        );

        prompts.push(
            `Final segment. Voice: Maintain voice identity, tone is warm and actionable. Close with genuine smile. Speech: "${this.generateThaiSpeech('cta', desc)}" Audio: Smooth closure, warm quality. No subtitles. No text on screen. No Captions`
        );

        return prompts;
    }

    generateThaiSpeech(type, description) {
        // Generate appropriate Thai speech based on type and description
        const templates = {
            hook: [
                'ตามที่เห็นในคลิปก่อนหน้า เรื่องนี้มีเรื่องสำคัญที่ต้องบอกต่อ',
                'จากที่เห็นไปแล้ว ผมอยากจะขยายความเรื่องนี้ให้ชัดเจนขึ้น',
                'มีสิ่งอีกหลายอย่างที่จำเป็นต้องรู้เกี่ยวกับเรื่องที่ได้เห็นไป'
            ],
            point1: [
                'ประเด็นแรกที่สำคัญคือ เรื่องนี้มีผลกระทบต่อชีวิตประจำวันเยอะมาก',
                'ถ้าเราดูให้ลึกลงไป เราจะพบว่ามีรายละเอียดที่น่าสนใจอีกหลายอย่าง',
                'เริ่มต้นจากจุดนี้ไป เราต้องเข้าใจพื้นฐานให้ชัด'
            ],
            point2: [
                'นอกจากนั้น ยังมีข้อดีอีกหลายอย่างที่อาจไม่ตระหนักตัว',
                'จากประสบการณ์ของผม มีคนจำนวนมากที่เห็นคุณค่าของเรื่องนี้',
                'สิ่งที่ผ่านมาเป็นแค่จุดเริ่มต้นของเรื่องใหญ่นี้เท่านั้น'
            ],
            point3: [
                'สำคัญที่สุดคือ ท่านต้องเข้าใจว่าทำไมเรื่องนี้ถึงมีความหมาย',
                'จากสิ่งที่พูดมา คิดว่าท่านเข้าใจแล้วว่าต้องทำยังไง',
                'นี่คือสิ่งที่ผมอยากให้ท่านจำไว้ตรงนี้ครับ'
            ],
            cta: [
                'ถ้าสนใจอยากรู้เพิ่มเติม หรืออยากลองด้วยตัวเอง ลิงก์ด้านล่างนี้เลย',
                'ท่านสามารถดูข้อมูลเพิ่มเติมได้ในลิงก์ที่ฉันจะให้ไว้ด้านล่าง',
                'ช่วงนี้มีโปรพิเศษด้วยนะ ใครที่สนใจลองดูด้านล่างได้เลย'
            ]
        };

        const options = templates[type] || templates.hook;
        return options[Math.floor(Math.random() * options.length)];
    }

    handleUseGeneratedPrompts() {
        if (this.generatedPrompts.length === 0) {
            this.showError('⚠️ ไม่มี prompts ที่สร้างขึ้น');
            return;
        }

        this.prompts = this.generatedPrompts;
        this.totalPrompts = this.prompts.length;
        this.updateCsvStatus(`✓ ใช้ ${this.totalPrompts} prompts ที่สร้างขึ้น`, 'success');
        this.showPreview();
        this.showNotification('✓ โหลด prompts ที่สร้างขึ้นแล้ว', 'success');

        // Hide the use button
        if (this.useGeneratedBtn) {
            this.useGeneratedBtn.classList.add('hidden');
        }
    }


    onComplete() {
        this.isActive = false;
        this.resetUI();
        this.updateProgress(this.totalPrompts, this.totalPrompts);
        this.showNotification(`✅ เสร็จสิ้นการต่อฉาก ${this.totalPrompts} รายการ!`, 'success');
    }

    onUpdate(current, total) {
        this.updateProgress(current, total);
    }

    onError(error) {
        this.showError(`⚠️ เกิดข้อผิดพลาด: ${error}`);
    }

    // Clear cache and prompts
    handleClearCache() {
        if (!confirm('ต้องการล้างแคช prompts และข้อมูลการตั้งค่าใช้หรือไม่?')) {
            return;
        }

        // Clear localStorage
        chrome.storage.local.remove(['extendSceneState'], () => {
            console.log('[ExtendScene] Cache cleared');
        });

        // Reset UI state
        this.prompts = [];
        this.totalPrompts = 0;
        this.currentIndex = 0;
        this.csvInput.value = '';
        this.csvStatus.textContent = 'ยังไม่ได้เลือกไฟล์ CSV';
        this.templateSelect.value = '';
        this.templatePreview.style.display = 'none';
        this.templatePreview.innerHTML = '';
        this.preview.classList.add('hidden');
        this.promptsContent.innerHTML = '';
        this.promptsCount.textContent = '0';
        this.logList.innerHTML = '<div style="color: var(--text-secondary); font-size: 0.85rem;">✓ Cache cleared</div>';
        this.showNotification('✓ ล้างแคชสำเร็จ', 'success');
    }

    // Utility: Get current state
    getState() {
        return {
            isActive: this.isActive,
            isPaused: this.isPaused,
            currentIndex: this.currentIndex,
            totalPrompts: this.totalPrompts,
            prompts: this.prompts
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExtendScene;
}

// Auto-initialize if DOM is ready
if (typeof window !== 'undefined') {
    window.ExtendScene = ExtendScene;

    try {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                window.extendScene = new ExtendScene();
            });
        } else {
            window.extendScene = new ExtendScene();
        }
    } catch (error) {
        console.error('[ExtendScene] Error initializing:', error);
    }
}
