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

        // Preview
        this.preview = document.getElementById('extendPromptsPreview');
        this.promptsCount = document.getElementById('extendPromptsCount');
        this.promptsContent = document.getElementById('extendPromptsContent');
        this.templatePreview = document.getElementById('extendTemplatePreview');

        // Buttons
        this.startBtn = document.getElementById('startExtendBtn');
        this.stopBtn = document.getElementById('stopExtendBtn');

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
            const firstLine = (text.split(/\r?\n/).map(l => l.trim()).filter(Boolean))[0] || '';
            if (this.templatePreview) {
                this.templatePreview.style.display = '';
                this.templatePreview.textContent = `ตัวอย่าง prompt: ${firstLine}`;
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

        // Prepare tasks
        const tasks = this.prompts.map((prompt, index) => ({
            mode: 'extend',
            prompt: prompt,
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
