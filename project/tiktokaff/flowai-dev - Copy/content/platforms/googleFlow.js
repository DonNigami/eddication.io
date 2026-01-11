/**
 * Google Flow Content Script - Extend Scene Support
 * Handles automated scene extension for Google Labs Flow
 */

// Safeguard: Define workflowState globally if it doesn't exist
if (typeof window.workflowState === 'undefined') {
    window.workflowState = {};
}

// Extend Scene Handler
class GoogleFlowExtendHandler {
    constructor() {
        this.isProcessing = false;
        this.currentTaskIndex = 0;
        this.tasks = [];
        this.settings = {};
    }

    /**
     * Start batch extend process
     */
    async startBatch(tasks, settings = {}) {
        if (this.isProcessing) {
            console.warn('[Flow Extend] Already processing');
            return;
        }

        this.isProcessing = true;
        this.tasks = tasks;
        this.settings = settings;
        this.currentTaskIndex = 0;

        console.log(`[Flow Extend] Starting batch of ${tasks.length} extends`);

        // Process tasks sequentially
        await this.processNextTask();
    }

    /**
     * Process next task in queue
     */
    async processNextTask() {
        if (!this.isProcessing || this.currentTaskIndex >= this.tasks.length) {
            if (this.currentTaskIndex >= this.tasks.length) {
                this.onComplete();
            }
            return;
        }

        const task = this.tasks[this.currentTaskIndex];
        console.log(`[Flow Extend] Processing task ${this.currentTaskIndex + 1}/${this.tasks.length}`);

        // Send progress update
        this.sendProgress(this.currentTaskIndex, this.tasks.length);

        try {
            await this.handleExtendScene(task);

            // Move to next task
            this.currentTaskIndex++;

            // Wait before next task
            const delay = this.settings.delayBetweenTasks || 3000;
            setTimeout(() => this.processNextTask(), delay);

        } catch (error) {
            console.error('[Flow Extend] Error processing task:', error);
            this.sendError(error.message);

            // Continue with next task anyway
            this.currentTaskIndex++;
            setTimeout(() => this.processNextTask(), 3000);
        }
    }

    /**
     * Handle single extend scene task
     */
    async handleExtendScene(task) {
        console.log('[Flow Extend] Extending scene:', task.prompt.substring(0, 50));

        // Step 1: Click (+) button
        const plusClicked = await this.clickPlusButton();
        if (!plusClicked) {
            throw new Error('Failed to click (+) button');
        }
        await this.delay(1500);

        // Step 2: Click Extend option
        const extendClicked = await this.clickExtendButton();
        if (!extendClicked) {
            throw new Error('Failed to click Extend option');
        }
        await this.delay(2000);

        // Step 3: Fill prompt
        const promptFilled = this.fillScriptField(task.prompt);
        if (!promptFilled) {
            throw new Error('Failed to fill prompt');
        }
        await this.delay(2000);

        // Step 4: Click Send
        const sendClicked = this.clickSendButton();
        if (!sendClicked) {
            throw new Error('Failed to click Send button');
        }
        await this.delay(2000);

        // Step 5: Wait for completion
        const targetPercent = this.settings.waitForPercent || 80;
        await this.waitForExtendCompletion(targetPercent);
    }

    /**
     * Click the (+) add button
     */
    async clickPlusButton() {
        console.log('[Flow Extend] Looking for (+) button...');

        // Try specific ID first
        const pinholeBtn = document.getElementById('PINHOLE_ADD_CLIP_CARD_ID');
        if (pinholeBtn && pinholeBtn.offsetParent !== null) {
            this.simulateClick(pinholeBtn);
            console.log('[Flow Extend] Clicked + button (ID)');
            return true;
        }

        // Fallback: Find by aria-label or text
        const buttons = document.querySelectorAll('button, [role="button"]');
        for (const btn of buttons) {
            const ariaLabel = btn.getAttribute('aria-label') || '';
            const text = btn.textContent?.trim() || '';

            if ((ariaLabel.toLowerCase().includes('add') || text === '+') &&
                btn.offsetParent !== null) {
                this.simulateClick(btn);
                console.log('[Flow Extend] Clicked + button (aria-label/text)');
                return true;
            }
        }

        console.warn('[Flow Extend] (+) button not found');
        return false;
    }

    /**
     * Click the Extend option in menu
     */
    async clickExtendButton() {
        console.log('[Flow Extend] Looking for Extend option...');

        // Try Radix menu items
        const radixItems = document.querySelectorAll('[role="menuitem"]');
        for (const item of radixItems) {
            const text = item.textContent?.trim() || '';
            if (text.toLowerCase().includes('extend') && item.offsetParent !== null) {
                this.simulateClick(item);
                console.log('[Flow Extend] Clicked Extend (menuitem)');
                return true;
            }
        }

        // Fallback: Find by aria-label or text content
        const allElements = document.querySelectorAll('button, div, span, li');
        for (const el of allElements) {
            const text = el.textContent?.trim() || '';
            const ariaLabel = el.getAttribute('aria-label') || '';

            if ((text.toLowerCase() === 'extend' || ariaLabel.toLowerCase().includes('extend')) &&
                el.offsetParent !== null) {
                this.simulateClick(el);
                console.log('[Flow Extend] Clicked Extend (fallback)');
                return true;
            }
        }

        console.warn('[Flow Extend] Extend option not found');
        return false;
    }

    /**
     * Fill the prompt/script textarea
     */
    fillScriptField(prompt) {
        console.log('[Flow Extend] Filling prompt...');

        // Find visible textarea
        const textareas = document.querySelectorAll('textarea');
        for (const textarea of textareas) {
            if (textarea.offsetParent !== null) {
                textarea.value = prompt;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                textarea.dispatchEvent(new Event('change', { bubbles: true }));
                console.log('[Flow Extend] Prompt filled');
                return true;
            }
        }

        // Try contenteditable
        const editables = document.querySelectorAll('[contenteditable="true"]');
        for (const editable of editables) {
            if (editable.offsetParent !== null) {
                editable.textContent = prompt;
                editable.dispatchEvent(new Event('input', { bubbles: true }));
                console.log('[Flow Extend] Prompt filled (contenteditable)');
                return true;
            }
        }

        console.warn('[Flow Extend] Script field not found');
        return false;
    }

    /**
     * Click the Send button
     */
    clickSendButton() {
        console.log('[Flow Extend] Looking for Send button...');

        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
            const text = btn.textContent?.trim().toLowerCase() || '';
            const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();

            if ((text.includes('send') || text.includes('generate') ||
                ariaLabel.includes('send') || ariaLabel.includes('generate')) &&
                btn.offsetParent !== null && !btn.disabled) {
                this.simulateClick(btn);
                console.log('[Flow Extend] Clicked Send button');
                return true;
            }
        }

        console.warn('[Flow Extend] Send button not found');
        return false;
    }

    /**
     * Wait for extend completion (progress reaches target %)
     */
    async waitForExtendCompletion(targetPercent = 80) {
        console.log(`[Flow Extend] Waiting for ${targetPercent}% completion...`);

        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 600; // 10 minutes max

            const interval = setInterval(() => {
                attempts++;

                // Check aria-label for progress percentage
                const elements = document.querySelectorAll('[aria-label]');
                for (const el of elements) {
                    const label = el.getAttribute('aria-label');
                    const match = label.match(/(\d+)%/);

                    if (match) {
                        const percent = parseInt(match[1]);
                        if (percent >= targetPercent) {
                            clearInterval(interval);
                            console.log(`[Flow Extend] Reached ${percent}%!`);
                            resolve(true);
                            return;
                        } else if (attempts % 10 === 0) {
                            // Log progress every 10 seconds
                            console.log(`[Flow Extend] Progress: ${percent}%`);
                        }
                    }
                }

                // Also check for text content showing 100%
                if (attempts > 30) { // After 30 seconds, also check text
                    const textElements = document.querySelectorAll('span, div, p');
                    for (const el of textElements) {
                        if (el.textContent.includes('100%') && el.offsetParent !== null) {
                            clearInterval(interval);
                            console.log('[Flow Extend] Found 100% completion');
                            resolve(true);
                            return;
                        }
                    }
                }

                // Timeout check
                if (attempts >= maxAttempts) {
                    clearInterval(interval);
                    console.warn('[Flow Extend] Timeout waiting for completion');
                    resolve(false);
                }
            }, 1000);
        });
    }

    /**
     * Stop processing
     */
    stop() {
        console.log('[Flow Extend] Stopping...');
        this.isProcessing = false;
        this.tasks = [];
        this.currentTaskIndex = 0;
    }

    /**
     * Send progress update to sidebar
     */
    sendProgress(current, total) {
        chrome.runtime.sendMessage({
            action: 'extendProgress',
            current: current,
            total: total
        });
    }

    /**
     * Send completion message to sidebar
     */
    onComplete() {
        console.log('[Flow Extend] All tasks completed');
        this.isProcessing = false;

        chrome.runtime.sendMessage({
            action: 'extendComplete'
        });
    }

    /**
     * Send error message to sidebar
     */
    sendError(errorMessage) {
        chrome.runtime.sendMessage({
            action: 'extendError',
            error: errorMessage
        });
    }

    /**
     * Simulate click with proper event dispatching
     */
    simulateClick(element) {
        if (!element) return;

        // Highlight element briefly
        const originalBorder = element.style.border;
        element.style.border = '2px solid yellow';
        setTimeout(() => element.style.border = originalBorder, 500);

        // Dispatch events
        element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }

    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize handler
try {
    const extendHandler = new GoogleFlowExtendHandler();

    // Listen for messages from sidebar
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'startBatch' && request.settings?.mode === 'extend') {
            extendHandler.startBatch(request.tasks, request.settings);
            sendResponse({ success: true });
        } else if (request.action === 'stopAutomation') {
            extendHandler.stop();
            sendResponse({ success: true });
        }
        return true; // Keep message channel open
    });

    console.log('[Flow Extend] Content script loaded');
} catch (error) {
    console.error('[Flow Extend] Error initializing content script:', error);
}
