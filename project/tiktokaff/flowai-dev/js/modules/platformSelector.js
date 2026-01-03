/**
 * Platform Selector Component
 * 
 * Multi-platform selection interface for video uploads
 */

class PlatformSelector {
    constructor() {
        this.selectedPlatforms = new Set(['tiktok']); // Default TikTok
        this.platforms = [
            {
                id: 'tiktok',
                name: 'TikTok',
                icon: '📱',
                color: '#000000',
                features: ['caption', 'product', 'schedule']
            },
            {
                id: 'shopee',
                name: 'Shopee',
                icon: '🛒',
                color: '#EE4D2D',
                features: ['caption', 'product']
            },
            {
                id: 'facebook',
                name: 'Facebook Reels',
                icon: '👤',
                color: '#1877F2',
                features: ['caption', 'product', 'privacy']
            },
            {
                id: 'youtube',
                name: 'YouTube Shorts',
                icon: '▶️',
                color: '#FF0000',
                features: ['title', 'description', 'visibility']
            }
        ];

        this.onChangeCallbacks = [];
    }

    /**
     * Initialize the selector
     */
    init() {
        this.render();
        this.attachEventListeners();
        this.loadSavedSelection();
    }

    /**
     * Render the platform selector UI
     */
    render() {
        const container = document.getElementById('platform-selector-container');
        if (!container) {
            console.warn('[PlatformSelector] Container not found');
            return;
        }

        const html = `
      <div class="platform-selector">
        <div class="platform-selector-header">
          <h3>เลือกแพลตฟอร์ม</h3>
          <button id="select-all-platforms" class="btn-link">เลือกทั้งหมด</button>
        </div>
        
        <div class="platform-grid">
          ${this.platforms.map(platform => this.renderPlatformCard(platform)).join('')}
        </div>

        <div class="platform-summary">
          <span id="selected-count">เลือก 1 แพลตฟอร์ม</span>
        </div>
      </div>
    `;

        container.innerHTML = html;
    }

    /**
     * Render individual platform card
     */
    renderPlatformCard(platform) {
        const isSelected = this.selectedPlatforms.has(platform.id);

        return `
      <div class="platform-card ${isSelected ? 'selected' : ''}" 
           data-platform="${platform.id}"
           style="--platform-color: ${platform.color}">
        <div class="platform-card-header">
          <span class="platform-icon">${platform.icon}</span>
          <div class="platform-checkbox">
            <input type="checkbox" 
                   id="platform-${platform.id}" 
                   ${isSelected ? 'checked' : ''}>
            <label for="platform-${platform.id}"></label>
          </div>
        </div>
        
        <div class="platform-card-body">
          <h4>${platform.name}</h4>
          <div class="platform-features">
            ${platform.features.map(f => `<span class="feature-tag">${f}</span>`).join('')}
          </div>
        </div>
      </div>
    `;
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Platform cards click
        document.querySelectorAll('.platform-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.type === 'checkbox') return; // Let checkbox handle it
                const platformId = card.dataset.platform;
                this.togglePlatform(platformId);
            });
        });

        // Platform checkboxes
        document.querySelectorAll('.platform-card input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const platformId = e.target.id.replace('platform-', '');
                this.togglePlatform(platformId);
            });
        });

        // Select all button
        const selectAllBtn = document.getElementById('select-all-platforms');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                this.selectAll();
            });
        }
    }

    /**
     * Toggle platform selection
     */
    togglePlatform(platformId) {
        if (this.selectedPlatforms.has(platformId)) {
            // Don't allow deselecting if it's the only one
            if (this.selectedPlatforms.size <= 1) {
                alert('ต้องเลือกอย่างน้อย 1 แพลตฟอร์ม');
                return;
            }
            this.selectedPlatforms.delete(platformId);
        } else {
            this.selectedPlatforms.add(platformId);
        }

        this.updateUI();
        this.saveSelection();
        this.notifyChange();
    }

    /**
     * Select all platforms
     */
    selectAll() {
        this.platforms.forEach(p => this.selectedPlatforms.add(p.id));
        this.updateUI();
        this.saveSelection();
        this.notifyChange();
    }

    /**
     * Update UI after selection change
     */
    updateUI() {
        // Update cards
        document.querySelectorAll('.platform-card').forEach(card => {
            const platformId = card.dataset.platform;
            const checkbox = card.querySelector('input[type="checkbox"]');
            const isSelected = this.selectedPlatforms.has(platformId);

            card.classList.toggle('selected', isSelected);
            checkbox.checked = isSelected;
        });

        // Update count
        const countEl = document.getElementById('selected-count');
        if (countEl) {
            const count = this.selectedPlatforms.size;
            countEl.textContent = `เลือก ${count} แพลตฟอร์ม`;
        }

        // Update select all button
        const selectAllBtn = document.getElementById('select-all-platforms');
        if (selectAllBtn) {
            if (this.selectedPlatforms.size === this.platforms.length) {
                selectAllBtn.textContent = 'ยกเลิกทั้งหมด';
                selectAllBtn.onclick = () => this.deselectAll();
            } else {
                selectAllBtn.textContent = 'เลือกทั้งหมด';
                selectAllBtn.onclick = () => this.selectAll();
            }
        }
    }

    /**
     * Deselect all except one
     */
    deselectAll() {
        // Keep only TikTok selected
        this.selectedPlatforms.clear();
        this.selectedPlatforms.add('tiktok');
        this.updateUI();
        this.saveSelection();
        this.notifyChange();
    }

    /**
     * Get selected platforms
     */
    getSelected() {
        return Array.from(this.selectedPlatforms);
    }

    /**
     * Get platform info
     */
    getPlatformInfo(platformId) {
        return this.platforms.find(p => p.id === platformId);
    }

    /**
     * Get all selected platform info
     */
    getSelectedPlatformsInfo() {
        return this.getSelected().map(id => this.getPlatformInfo(id));
    }

    /**
     * Save selection to storage
     */
    saveSelection() {
        const selected = this.getSelected();
        chrome.storage.local.set({ selectedPlatforms: selected }, () => {
            console.log('[PlatformSelector] Saved selection:', selected);
        });
    }

    /**
     * Load saved selection
     */
    loadSavedSelection() {
        chrome.storage.local.get(['selectedPlatforms'], (result) => {
            if (result.selectedPlatforms && result.selectedPlatforms.length > 0) {
                this.selectedPlatforms = new Set(result.selectedPlatforms);
                this.updateUI();
                this.notifyChange();
            }
        });
    }

    /**
     * Register change callback
     */
    onChange(callback) {
        this.onChangeCallbacks.push(callback);
    }

    /**
     * Notify all callbacks
     */
    notifyChange() {
        const selected = this.getSelected();
        const platformsInfo = this.getSelectedPlatformsInfo();

        this.onChangeCallbacks.forEach(callback => {
            callback(selected, platformsInfo);
        });
    }

    /**
     * Check if platform is selected
     */
    isSelected(platformId) {
        return this.selectedPlatforms.has(platformId);
    }

    /**
     * Set selected platforms programmatically
     */
    setSelected(platformIds) {
        if (!Array.isArray(platformIds) || platformIds.length === 0) {
            return;
        }

        this.selectedPlatforms = new Set(platformIds);
        this.updateUI();
        this.saveSelection();
        this.notifyChange();
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlatformSelector;
}

// Make available globally for non-module scripts
if (typeof window !== 'undefined') {
    window.PlatformSelector = PlatformSelector;
}
