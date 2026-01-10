/**
 * Testing Panel UI
 * 
 * Provides UI for testing and debugging platform uploaders
 */

class TestingPanel {
    constructor() {
        this.isOpen = false;
        this.testingUtils = null;
        this.errorHandler = null;
        this.validator = null;
        this.testResults = [];
    }

    /**
     * Initialize testing panel
     */
    async init() {
        console.log('[TestingPanel] Initializing...');

        // Check if testing utilities are available
        if (window.TestingUtils) {
            this.testingUtils = new window.TestingUtils();
            console.log('[TestingPanel] TestingUtils loaded');
        } else {
            console.warn('[TestingPanel] TestingUtils not available');
        }

        if (window.ErrorHandler) {
            this.errorHandler = new window.ErrorHandler();
        }

        if (window.PlatformValidator) {
            this.validator = window.PlatformValidator;
        }

        // Create panel UI
        this.createPanelUI();

        // Setup keyboard shortcut (Ctrl+Shift+T)
        this.setupKeyboardShortcut();
    }

    /**
     * Create testing panel UI
     */
    createPanelUI() {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'testing-panel-overlay';
        overlay.className = 'testing-panel-overlay hidden';
        overlay.innerHTML = `
            <div class="testing-panel">
                <div class="testing-panel-header">
                    <h3>🧪 Testing & Debugging Panel</h3>
                    <button class="close-btn" id="closeTestingPanel">✕</button>
                </div>

                <div class="testing-panel-content">
                    <!-- Platform Testing -->
                    <div class="testing-section">
                        <h4>Platform Testing</h4>
                        <div class="platform-test-buttons">
                            <button class="test-btn" data-platform="tiktok">Test TikTok</button>
                            <button class="test-btn" data-platform="shopee">Test Shopee</button>
                            <button class="test-btn" data-platform="facebook">Test Facebook</button>
                            <button class="test-btn" data-platform="youtube">Test YouTube</button>
                            <button class="test-btn-primary" id="testAllPlatforms">Test All Platforms</button>
                        </div>
                    </div>

                    <!-- Validation Testing -->
                    <div class="testing-section">
                        <h4>Validation Testing</h4>
                        <div class="validation-controls">
                            <input type="file" id="testVideoFile" accept="video/*">
                            <input type="text" id="testCaption" placeholder="Enter test caption...">
                            <button class="test-btn" id="validateVideo">Validate Video</button>
                            <button class="test-btn" id="validateCaption">Validate Caption</button>
                        </div>
                        <div class="validation-results" id="validationResults"></div>
                    </div>

                    <!-- Error Log Viewer -->
                    <div class="testing-section">
                        <h4>Error Log</h4>
                        <div class="error-log-controls">
                            <button class="test-btn" id="viewErrorLog">View Errors</button>
                            <button class="test-btn" id="clearErrorLog">Clear Log</button>
                            <button class="test-btn" id="exportErrorLog">Export Log</button>
                        </div>
                        <div class="error-log-viewer" id="errorLogViewer"></div>
                    </div>

                    <!-- Test Results -->
                    <div class="testing-section">
                        <h4>Test Results</h4>
                        <div class="test-results-controls">
                            <button class="test-btn" id="exportTestResults">Export Results</button>
                            <button class="test-btn" id="clearTestResults">Clear Results</button>
                        </div>
                        <div class="test-results-viewer" id="testResultsViewer"></div>
                    </div>

                    <!-- Performance Monitor -->
                    <div class="testing-section">
                        <h4>Performance Monitor</h4>
                        <div class="performance-stats" id="performanceStats">
                            <div class="stat">
                                <label>Total Uploads:</label>
                                <span id="statTotalUploads">0</span>
                            </div>
                            <div class="stat">
                                <label>Success Rate:</label>
                                <span id="statSuccessRate">0%</span>
                            </div>
                            <div class="stat">
                                <label>Avg Upload Time:</label>
                                <span id="statAvgTime">0s</span>
                            </div>
                            <div class="stat">
                                <label>Total Errors:</label>
                                <span id="statTotalErrors">0</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Add event listeners
        this.setupEventListeners();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Close button
        document.getElementById('closeTestingPanel')?.addEventListener('click', () => {
            this.hide();
        });

        // Platform test buttons
        document.querySelectorAll('.test-btn[data-platform]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const platform = e.target.dataset.platform;
                this.testPlatform(platform);
            });
        });

        // Test all platforms
        document.getElementById('testAllPlatforms')?.addEventListener('click', () => {
            this.testAllPlatforms();
        });

        // Validation buttons
        document.getElementById('validateVideo')?.addEventListener('click', () => {
            this.validateTestVideo();
        });

        document.getElementById('validateCaption')?.addEventListener('click', () => {
            this.validateTestCaption();
        });

        // Error log buttons
        document.getElementById('viewErrorLog')?.addEventListener('click', () => {
            this.viewErrorLog();
        });

        document.getElementById('clearErrorLog')?.addEventListener('click', () => {
            this.clearErrorLog();
        });

        document.getElementById('exportErrorLog')?.addEventListener('click', () => {
            this.exportErrorLog();
        });

        // Test results buttons
        document.getElementById('exportTestResults')?.addEventListener('click', () => {
            this.exportTestResults();
        });

        document.getElementById('clearTestResults')?.addEventListener('click', () => {
            this.clearTestResults();
        });

        // Click outside to close
        document.getElementById('testing-panel-overlay')?.addEventListener('click', (e) => {
            if (e.target.id === 'testing-panel-overlay') {
                this.hide();
            }
        });
    }

    /**
     * Setup keyboard shortcut
     */
    setupKeyboardShortcut() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+T
            if (e.ctrlKey && e.shiftKey && e.key === 'T') {
                e.preventDefault();
                this.toggle();
            }
        });
    }

    /**
     * Show testing panel
     */
    show() {
        const overlay = document.getElementById('testing-panel-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            this.isOpen = true;
            this.updatePerformanceStats();
        }
    }

    /**
     * Hide testing panel
     */
    hide() {
        const overlay = document.getElementById('testing-panel-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            this.isOpen = false;
        }
    }

    /**
     * Toggle testing panel
     */
    toggle() {
        if (this.isOpen) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Test single platform
     */
    async testPlatform(platformId) {
        if (!this.testingUtils) {
            alert('TestingUtils not available');
            return;
        }

        this.showTestStatus(`Testing ${platformId}...`, 'info');

        try {
            const result = await this.testingUtils.testPlatformUploader(platformId);
            this.testResults.push(result);
            this.displayTestResult(result);
            this.updatePerformanceStats();
        } catch (error) {
            console.error('[TestingPanel] Test failed:', error);
            this.showTestStatus(`Test failed: ${error.message}`, 'error');
        }
    }

    /**
     * Test all platforms
     */
    async testAllPlatforms() {
        if (!this.testingUtils) {
            alert('TestingUtils not available');
            return;
        }

        this.showTestStatus('Testing all platforms...', 'info');

        try {
            const results = await this.testingUtils.testAllPlatforms();
            this.testResults.push(...results);

            // Display summary
            const summary = {
                total: results.length,
                passed: results.filter(r => r.passed).length,
                failed: results.filter(r => !r.passed).length
            };

            this.showTestStatus(
                `Tests complete: ${summary.passed}/${summary.total} passed`,
                summary.failed > 0 ? 'warning' : 'success'
            );

            // Display individual results
            results.forEach(result => this.displayTestResult(result));
            this.updatePerformanceStats();

        } catch (error) {
            console.error('[TestingPanel] Test all failed:', error);
            this.showTestStatus(`Test failed: ${error.message}`, 'error');
        }
    }

    /**
     * Display test result
     */
    displayTestResult(result) {
        const viewer = document.getElementById('testResultsViewer');
        if (!viewer) return;

        const resultDiv = document.createElement('div');
        resultDiv.className = `test-result ${result.passed ? 'passed' : 'failed'}`;
        resultDiv.innerHTML = `
            <div class="result-header">
                <span class="result-icon">${result.passed ? '✓' : '✗'}</span>
                <span class="result-platform">${result.platformId}</span>
                <span class="result-time">${new Date(result.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="result-details">
                ${result.errors.length > 0 ? `
                    <div class="result-errors">
                        <strong>Errors:</strong>
                        <ul>
                            ${result.errors.map(e => `<li>${e}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                ${result.warnings.length > 0 ? `
                    <div class="result-warnings">
                        <strong>Warnings:</strong>
                        <ul>
                            ${result.warnings.map(w => `<li>${w}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;

        viewer.insertBefore(resultDiv, viewer.firstChild);
    }

    /**
     * Validate test video
     */
    async validateTestVideo() {
        const fileInput = document.getElementById('testVideoFile');
        const file = fileInput?.files[0];

        if (!file) {
            alert('Please select a video file');
            return;
        }

        if (!this.validator) {
            alert('PlatformValidator not available');
            return;
        }

        const resultsDiv = document.getElementById('validationResults');
        if (!resultsDiv) return;

        resultsDiv.innerHTML = '<p>Validating video...</p>';

        try {
            // Test against all platforms
            const platforms = ['tiktok', 'shopee', 'facebook', 'youtube'];
            const results = [];

            for (const platformId of platforms) {
                const validation = await this.validator.validateVideo(file, platformId);
                results.push({
                    platform: platformId,
                    valid: validation.valid,
                    errors: validation.errors,
                    warnings: validation.warnings
                });
            }

            // Display results
            resultsDiv.innerHTML = `
                <div class="validation-result">
                    ${results.map(r => `
                        <div class="platform-validation ${r.valid ? 'valid' : 'invalid'}">
                            <h5>${r.platform}: ${r.valid ? '✓ Valid' : '✗ Invalid'}</h5>
                            ${r.errors.length > 0 ? `
                                <ul class="errors">
                                    ${r.errors.map(e => `<li>${e}</li>`).join('')}
                                </ul>
                            ` : ''}
                            ${r.warnings.length > 0 ? `
                                <ul class="warnings">
                                    ${r.warnings.map(w => `<li>${w}</li>`).join('')}
                                </ul>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            `;

        } catch (error) {
            resultsDiv.innerHTML = `<p class="error">Validation failed: ${error.message}</p>`;
        }
    }

    /**
     * Validate test caption
     */
    validateTestCaption() {
        const captionInput = document.getElementById('testCaption');
        const caption = captionInput?.value;

        if (!caption) {
            alert('Please enter a caption');
            return;
        }

        if (!this.validator) {
            alert('PlatformValidator not available');
            return;
        }

        const resultsDiv = document.getElementById('validationResults');
        if (!resultsDiv) return;

        // Test against all platforms
        const platforms = ['tiktok', 'shopee', 'facebook', 'youtube'];
        const results = [];

        for (const platformId of platforms) {
            const validation = this.validator.validateCaption(caption, platformId);
            results.push({
                platform: platformId,
                valid: validation.valid,
                errors: validation.errors,
                warnings: validation.warnings
            });
        }

        // Display results
        resultsDiv.innerHTML = `
            <div class="validation-result">
                <p><strong>Caption length:</strong> ${caption.length} characters</p>
                ${results.map(r => `
                    <div class="platform-validation ${r.valid ? 'valid' : 'invalid'}">
                        <h5>${r.platform}: ${r.valid ? '✓ Valid' : '✗ Invalid'}</h5>
                        ${r.errors.length > 0 ? `
                            <ul class="errors">
                                ${r.errors.map(e => `<li>${e}</li>`).join('')}
                            </ul>
                        ` : ''}
                        ${r.warnings.length > 0 ? `
                            <ul class="warnings">
                                ${r.warnings.map(w => `<li>${w}</li>`).join('')}
                            </ul>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * View error log
     */
    async viewErrorLog() {
        if (!this.errorHandler) {
            alert('ErrorHandler not available');
            return;
        }

        const viewer = document.getElementById('errorLogViewer');
        if (!viewer) return;

        try {
            const errors = await this.errorHandler.getErrors();

            if (errors.length === 0) {
                viewer.innerHTML = '<p>No errors logged</p>';
                return;
            }

            viewer.innerHTML = `
                <div class="error-log">
                    ${errors.map(err => `
                        <div class="error-entry">
                            <div class="error-time">${new Date(err.timestamp).toLocaleString()}</div>
                            <div class="error-message">${err.message}</div>
                            ${err.context ? `
                                <div class="error-context">
                                    <strong>Context:</strong>
                                    <pre>${JSON.stringify(err.context, null, 2)}</pre>
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            `;

        } catch (error) {
            viewer.innerHTML = `<p class="error">Failed to load error log: ${error.message}</p>`;
        }
    }

    /**
     * Clear error log
     */
    async clearErrorLog() {
        if (!this.errorHandler) {
            alert('ErrorHandler not available');
            return;
        }

        if (confirm('Clear all error logs?')) {
            await this.errorHandler.clearErrors();
            const viewer = document.getElementById('errorLogViewer');
            if (viewer) {
                viewer.innerHTML = '<p>Error log cleared</p>';
            }
        }
    }

    /**
     * Export error log
     */
    async exportErrorLog() {
        if (!this.errorHandler) {
            alert('ErrorHandler not available');
            return;
        }

        try {
            const json = await this.errorHandler.exportErrors();
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `error-log-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            alert(`Export failed: ${error.message}`);
        }
    }

    /**
     * Export test results
     */
    exportTestResults() {
        if (this.testResults.length === 0) {
            alert('No test results to export');
            return;
        }

        const json = JSON.stringify(this.testResults, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `test-results-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Clear test results
     */
    clearTestResults() {
        if (confirm('Clear all test results?')) {
            this.testResults = [];
            const viewer = document.getElementById('testResultsViewer');
            if (viewer) {
                viewer.innerHTML = '<p>Test results cleared</p>';
            }
            this.updatePerformanceStats();
        }
    }

    /**
     * Update performance stats
     */
    updatePerformanceStats() {
        const totalUploads = this.testResults.length;
        const successCount = this.testResults.filter(r => r.passed).length;
        const successRate = totalUploads > 0 ? ((successCount / totalUploads) * 100).toFixed(1) : 0;

        document.getElementById('statTotalUploads').textContent = totalUploads;
        document.getElementById('statSuccessRate').textContent = `${successRate}%`;
        document.getElementById('statAvgTime').textContent = '0s'; // TODO: Calculate from actual timing data
        document.getElementById('statTotalErrors').textContent = this.testResults.filter(r => !r.passed).length;
    }

    /**
     * Show test status message
     */
    showTestStatus(message, type = 'info') {
        const viewer = document.getElementById('testResultsViewer');
        if (!viewer) return;

        const statusDiv = document.createElement('div');
        statusDiv.className = `test-status ${type}`;
        statusDiv.textContent = message;

        viewer.insertBefore(statusDiv, viewer.firstChild);

        // Remove after 5 seconds
        setTimeout(() => {
            statusDiv.remove();
        }, 5000);
    }
}

// Export
window.TestingPanel = TestingPanel;
