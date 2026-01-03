/**
 * Testing Utilities
 * Tools for testing platform integrations
 */

class TestingUtils {
    constructor() {
        this.testResults = [];
        this.isTestMode = false;
    }

    /**
     * Enable test mode
     */
    enableTestMode() {
        this.isTestMode = true;
        console.log('[TestMode] Enabled');
    }

    /**
     * Disable test mode
     */
    disableTestMode() {
        this.isTestMode = false;
        console.log('[TestMode] Disabled');
    }

    /**
     * Test platform uploader
     */
    async testPlatformUploader(platformId) {
        console.log(`[Test] Testing ${platformId} uploader...`);
        const results = {
            platform: platformId,
            timestamp: new Date().toISOString(),
            tests: []
        };

        try {
            // Get uploader instance
            const uploader = await this.getUploader(platformId);

            if (!uploader) {
                results.tests.push({
                    name: 'Get Uploader Instance',
                    status: 'fail',
                    error: 'Uploader not found'
                });
                return results;
            }

            results.tests.push({
                name: 'Get Uploader Instance',
                status: 'pass'
            });

            // Test initialization
            try {
                await uploader.initialize();
                results.tests.push({
                    name: 'Initialize',
                    status: 'pass'
                });
            } catch (error) {
                results.tests.push({
                    name: 'Initialize',
                    status: 'fail',
                    error: error.message
                });
            }

            // Test config
            const config = uploader.config;
            results.tests.push({
                name: 'Get Config',
                status: config ? 'pass' : 'fail',
                data: config
            });

            // Test video requirements
            const requirements = uploader.getVideoRequirements();
            results.tests.push({
                name: 'Get Video Requirements',
                status: requirements ? 'pass' : 'fail',
                data: requirements
            });

            console.log(`[Test] ${platformId} completed:`, results);

        } catch (error) {
            results.tests.push({
                name: 'Overall Test',
                status: 'fail',
                error: error.message
            });
        }

        this.testResults.push(results);
        return results;
    }

    /**
     * Test all platforms
     */
    async testAllPlatforms() {
        console.log('[Test] Testing all platforms...');
        const platforms = ['tiktok', 'shopee', 'facebook', 'youtube'];
        const results = [];

        for (const platformId of platforms) {
            const result = await this.testPlatformUploader(platformId);
            results.push(result);
        }

        return results;
    }

    /**
     * Test content script injection
     */
    async testContentScriptInjection(platformId) {
        console.log(`[Test] Testing ${platformId} content script...`);

        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tab = tabs[0];

            if (!tab) {
                return {
                    success: false,
                    error: 'No active tab'
                };
            }

            // Test ping content script
            const response = await chrome.tabs.sendMessage(tab.id, {
                action: 'ping'
            });

            return {
                success: true,
                response: response
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Test file validation
     */
    async testFileValidation(file, platformId) {
        console.log(`[Test] Testing file validation for ${platformId}...`);

        try {
            const validation = await PlatformValidator.validateVideo(file, platformId);

            return {
                success: validation.valid,
                validation: validation
            };

        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate test report
     */
    generateTestReport() {
        const report = {
            generated: new Date().toISOString(),
            totalTests: this.testResults.length,
            results: this.testResults,
            summary: this.getTestSummary()
        };

        return report;
    }

    /**
     * Get test summary
     */
    getTestSummary() {
        const summary = {
            total: 0,
            passed: 0,
            failed: 0,
            byPlatform: {}
        };

        this.testResults.forEach(result => {
            result.tests.forEach(test => {
                summary.total++;
                if (test.status === 'pass') {
                    summary.passed++;
                } else if (test.status === 'fail') {
                    summary.failed++;
                }
            });

            if (!summary.byPlatform[result.platform]) {
                summary.byPlatform[result.platform] = {
                    total: 0,
                    passed: 0,
                    failed: 0
                };
            }

            result.tests.forEach(test => {
                summary.byPlatform[result.platform].total++;
                if (test.status === 'pass') {
                    summary.byPlatform[result.platform].passed++;
                } else if (test.status === 'fail') {
                    summary.byPlatform[result.platform].failed++;
                }
            });
        });

        return summary;
    }

    /**
     * Export test report
     */
    exportTestReport() {
        const report = this.generateTestReport();
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `test-report-${Date.now()}.json`;
        a.click();

        URL.revokeObjectURL(url);
    }

    /**
     * Get uploader (helper method)
     */
    async getUploader(platformId) {
        try {
            if (typeof window !== 'undefined' && window.PlatformRegistry) {
                return window.PlatformRegistry.getInitialized(platformId);
            }
            return null;
        } catch (error) {
            console.error(`Failed to get uploader for ${platformId}:`, error);
            return null;
        }
    }

    /**
     * Create mock upload data
     */
    createMockUploadData(platformId) {
        return {
            file: this.createMockFile(),
            caption: 'Test upload from Flow AI Unlocked',
            platforms: [platformId],
            options: {
                [platformId]: {}
            }
        };
    }

    /**
     * Create mock file
     */
    createMockFile() {
        const blob = new Blob(['mock video data'], { type: 'video/mp4' });
        const file = new File([blob], 'test-video.mp4', { type: 'video/mp4' });
        return file;
    }

    /**
     * Benchmark function execution time
     */
    async benchmark(fn, label = 'Function') {
        const start = performance.now();

        try {
            const result = await fn();
            const end = performance.now();
            const duration = end - start;

            console.log(`[Benchmark] ${label}: ${duration.toFixed(2)}ms`);

            return {
                success: true,
                duration,
                result
            };
        } catch (error) {
            const end = performance.now();
            const duration = end - start;

            console.log(`[Benchmark] ${label}: ${duration.toFixed(2)}ms (failed)`);

            return {
                success: false,
                duration,
                error: error.message
            };
        }
    }
}

// Singleton instance
const testingUtils = new TestingUtils();

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TestingUtils;
}

if (typeof window !== 'undefined') {
    window.TestingUtils = TestingUtils;
    window.testingUtils = testingUtils;
}
