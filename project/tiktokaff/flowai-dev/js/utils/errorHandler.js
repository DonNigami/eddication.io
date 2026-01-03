/**
 * Error Handler Module
 * Centralized error handling and logging for multi-platform uploads
 */

class ErrorHandler {
    constructor() {
        this.errors = [];
        this.maxErrors = 100;
    }

    /**
     * Log error with context
     */
    logError(error, context = {}) {
        const errorEntry = {
            timestamp: new Date().toISOString(),
            message: error.message || error,
            stack: error.stack,
            context: context,
            platform: context.platform || 'unknown',
            action: context.action || 'unknown'
        };

        this.errors.push(errorEntry);

        // Keep only last 100 errors
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }

        console.error('[ErrorHandler]', errorEntry);

        // Store in chrome.storage for debugging
        this.saveToStorage();

        return errorEntry;
    }

    /**
     * Handle platform-specific errors
     */
    handlePlatformError(platformId, error, action) {
        const context = {
            platform: platformId,
            action: action,
            timestamp: Date.now()
        };

        // Platform-specific error messages
        let userMessage = this.getUserFriendlyMessage(platformId, error);

        this.logError(error, context);

        return {
            success: false,
            error: userMessage,
            details: error.message,
            platform: platformId
        };
    }

    /**
     * Get user-friendly error message
     */
    getUserFriendlyMessage(platformId, error) {
        const errorMsg = error.message || error.toString();

        // Common errors
        if (errorMsg.includes('timeout')) {
            return `${platformId}: หมดเวลารอ - ลองเพิ่ม delay ในการตั้งค่า`;
        }

        if (errorMsg.includes('not found')) {
            return `${platformId}: ไม่พบองค์ประกอบบนหน้าเว็บ - UI อาจเปลี่ยนแปลง`;
        }

        if (errorMsg.includes('validation')) {
            return `${platformId}: วิดีโอไม่ผ่านการตรวจสอบ`;
        }

        if (errorMsg.includes('network')) {
            return `${platformId}: ปัญหาเครือข่าย - ตรวจสอบการเชื่อมต่อ`;
        }

        // Platform-specific errors
        if (platformId === 'tiktok') {
            if (errorMsg.includes('product')) {
                return 'TikTok: ไม่พบสินค้าในคลัง - ตรวจสอบ Product ID';
            }
            if (errorMsg.includes('cart')) {
                return 'TikTok: ไม่สามารถปักหมุดตะกร้าได้';
            }
        }

        if (platformId === 'shopee') {
            if (errorMsg.includes('seller')) {
                return 'Shopee: ไม่ได้เปิด Shopee Seller Center';
            }
        }

        if (platformId === 'facebook') {
            if (errorMsg.includes('privacy')) {
                return 'Facebook: ไม่สามารถตั้งค่าความเป็นส่วนตัวได้';
            }
        }

        if (platformId === 'youtube') {
            if (errorMsg.includes('studio')) {
                return 'YouTube: ไม่ได้เปิด YouTube Studio';
            }
            if (errorMsg.includes('visibility')) {
                return 'YouTube: ไม่สามารถตั้งค่า visibility ได้';
            }
        }

        return `${platformId}: ${errorMsg}`;
    }

    /**
     * Get all errors
     */
    getErrors(filter = {}) {
        let filtered = this.errors;

        if (filter.platform) {
            filtered = filtered.filter(e => e.platform === filter.platform);
        }

        if (filter.action) {
            filtered = filtered.filter(e => e.action === filter.action);
        }

        if (filter.since) {
            filtered = filtered.filter(e => new Date(e.timestamp) > filter.since);
        }

        return filtered;
    }

    /**
     * Get error summary
     */
    getSummary() {
        const byPlatform = {};
        const byAction = {};

        this.errors.forEach(error => {
            // By platform
            if (!byPlatform[error.platform]) {
                byPlatform[error.platform] = 0;
            }
            byPlatform[error.platform]++;

            // By action
            if (!byAction[error.action]) {
                byAction[error.action] = 0;
            }
            byAction[error.action]++;
        });

        return {
            total: this.errors.length,
            byPlatform,
            byAction,
            lastError: this.errors[this.errors.length - 1]
        };
    }

    /**
     * Clear errors
     */
    clear() {
        this.errors = [];
        this.saveToStorage();
    }

    /**
     * Export errors as JSON
     */
    exportErrors() {
        const data = {
            exported: new Date().toISOString(),
            total: this.errors.length,
            errors: this.errors
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `error-log-${Date.now()}.json`;
        a.click();

        URL.revokeObjectURL(url);
    }

    /**
     * Save to storage
     */
    async saveToStorage() {
        try {
            // Keep last 20 errors in storage
            const recentErrors = this.errors.slice(-20);
            await chrome.storage.local.set({ errorLog: recentErrors });
        } catch (error) {
            console.error('Failed to save errors to storage:', error);
        }
    }

    /**
     * Load from storage
     */
    async loadFromStorage() {
        try {
            const result = await chrome.storage.local.get(['errorLog']);
            if (result.errorLog) {
                this.errors = result.errorLog;
            }
        } catch (error) {
            console.error('Failed to load errors from storage:', error);
        }
    }

    /**
     * Validate upload data before processing
     */
    validateUploadData(uploadData) {
        const errors = [];

        if (!uploadData.file) {
            errors.push('ไม่มีไฟล์วิดีโอ');
        }

        if (!uploadData.platforms || uploadData.platforms.length === 0) {
            errors.push('ไม่ได้เลือกแพลตฟอร์ม');
        }

        if (!uploadData.caption && !uploadData.title) {
            errors.push('ไม่มี Caption หรือ Title');
        }

        if (uploadData.caption && uploadData.caption.length > 2200) {
            errors.push('Caption ยาวเกิน 2200 ตัวอักษร');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Retry logic with exponential backoff
     */
    async retry(fn, options = {}) {
        const {
            maxAttempts = 3,
            delay = 1000,
            backoff = 2,
            onRetry = null
        } = options;

        let lastError;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;

                if (attempt < maxAttempts) {
                    const waitTime = delay * Math.pow(backoff, attempt - 1);

                    if (onRetry) {
                        onRetry(attempt, maxAttempts, waitTime, error);
                    }

                    console.log(`[ErrorHandler] Retry ${attempt}/${maxAttempts} after ${waitTime}ms`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
        }

        throw lastError;
    }
}

// Singleton instance
const errorHandler = new ErrorHandler();

// Initialize from storage
errorHandler.loadFromStorage();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorHandler;
}

if (typeof window !== 'undefined') {
    window.ErrorHandler = ErrorHandler;
    window.errorHandler = errorHandler;
}
