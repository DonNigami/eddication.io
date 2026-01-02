/**
 * Burst Mode Module
 * Handles burst automation (กระหน่ำ) functionality
 * Supports both random and manual product selection
 */
const BurstMode = {
  isEnabled: false,
  selectionMode: 'random', // 'random' or 'manual'
  productCount: 5,
  roundCount: 3,
  manualProducts: [], // Array of manually selected products
  selectedProducts: [], // Final products to use (either random or manual)
  currentProductIndex: 0,
  currentRound: 0,
  isRunning: false,
  tempSelectedIds: new Set(), // Temporary selection in modal

  /**
   * Initialize Burst Mode
   */
  init() {
    this.bindElements();
    this.bindEvents();
    this.loadSettings();
    this.updateMaxProductCount();
  },

  /**
   * Bind DOM elements
   */
  bindElements() {
    // Toggle and content
    this.toggle = document.getElementById('burstModeToggle');
    this.content = document.getElementById('burstModeContent');

    // Selection mode
    this.selectionModeRadios = document.querySelectorAll('input[name="burstSelectionMode"]');
    this.randomContent = document.getElementById('burstRandomContent');
    this.manualContent = document.getElementById('burstManualContent');

    // Random mode inputs
    this.productCountInput = document.getElementById('burstProductCount');
    this.roundCountInput = document.getElementById('burstRoundCount');

    // Manual mode elements
    this.selectedList = document.getElementById('burstSelectedList');
    this.addProductBtn = document.getElementById('burstAddProductBtn');
    this.manualRoundCountInput = document.getElementById('burstManualRoundCount');

    // Modal elements
    this.modal = document.getElementById('burstProductModal');
    this.modalClose = document.getElementById('burstModalClose');
    this.modalCancel = document.getElementById('burstModalCancel');
    this.modalConfirm = document.getElementById('burstModalConfirm');
    this.productSearch = document.getElementById('burstProductSearch');
    this.productGrid = document.getElementById('burstProductGrid');
    this.selectAllBtn = document.getElementById('burstSelectAll');
    this.deselectAllBtn = document.getElementById('burstDeselectAll');
    this.modalCount = document.getElementById('burstModalCount');

    // Summary and progress
    this.summary = document.getElementById('burstSummary');
    this.progressContainer = document.getElementById('burstProgress');
    this.progressText = document.getElementById('burstProgressText');
  },

  /**
   * Bind events
   */
  bindEvents() {
    // Toggle burst mode
    if (this.toggle) {
      this.toggle.addEventListener('change', () => {
        this.setEnabled(this.toggle.checked);
      });
    }

    // Selection mode change
    this.selectionModeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.setSelectionMode(e.target.value);
      });
    });

    // Random mode - product count
    if (this.productCountInput) {
      this.productCountInput.addEventListener('input', () => {
        let value = parseInt(this.productCountInput.value) || 1;
        const max = parseInt(this.productCountInput.max) || 50;

        if (value > max) {
          value = max;
          this.productCountInput.value = max;
        }

        this.productCount = value;
        this.updateSummary();
        this.saveSettings();
      });
    }

    // Random mode - round count
    if (this.roundCountInput) {
      this.roundCountInput.addEventListener('input', () => {
        this.roundCount = parseInt(this.roundCountInput.value) || 1;
        this.updateSummary();
        this.saveSettings();
      });
    }

    // Manual mode - round count
    if (this.manualRoundCountInput) {
      this.manualRoundCountInput.addEventListener('input', () => {
        this.roundCount = parseInt(this.manualRoundCountInput.value) || 1;
        this.updateSummary();
        this.saveSettings();
      });
    }

    // Add product button
    if (this.addProductBtn) {
      this.addProductBtn.addEventListener('click', () => {
        this.openProductModal();
      });
    }

    // Modal close buttons
    if (this.modalClose) {
      this.modalClose.addEventListener('click', () => this.closeProductModal());
    }
    if (this.modalCancel) {
      this.modalCancel.addEventListener('click', () => this.closeProductModal());
    }
    if (this.modalConfirm) {
      this.modalConfirm.addEventListener('click', () => this.confirmProductSelection());
    }

    // Modal backdrop click
    if (this.modal) {
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) {
          this.closeProductModal();
        }
      });
    }

    // Search products
    if (this.productSearch) {
      this.productSearch.addEventListener('input', () => {
        this.filterProducts(this.productSearch.value);
      });
    }

    // Select/Deselect all
    if (this.selectAllBtn) {
      this.selectAllBtn.addEventListener('click', () => this.selectAllProducts());
    }
    if (this.deselectAllBtn) {
      this.deselectAllBtn.addEventListener('click', () => this.deselectAllProducts());
    }
  },

  /**
   * Set enabled state
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    if (this.content) {
      this.content.hidden = !enabled;
    }
    if (enabled) {
      this.updateMaxProductCount();
    }
    this.saveSettings();
  },

  /**
   * Set selection mode (random or manual)
   */
  setSelectionMode(mode) {
    this.selectionMode = mode;

    if (this.randomContent) {
      this.randomContent.hidden = mode !== 'random';
    }
    if (this.manualContent) {
      this.manualContent.hidden = mode !== 'manual';
    }

    // Sync round count between modes
    if (mode === 'manual' && this.manualRoundCountInput) {
      this.manualRoundCountInput.value = this.roundCount;
    } else if (mode === 'random' && this.roundCountInput) {
      this.roundCountInput.value = this.roundCount;
    }

    this.updateSummary();
    this.saveSettings();
  },

  /**
   * Update max product count based on warehouse
   */
  async updateMaxProductCount() {
    if (typeof ProductWarehouse === 'undefined') return;

    const allProducts = await ProductWarehouse.getAll();
    const maxCount = allProducts.length || 1;

    if (this.productCountInput) {
      this.productCountInput.max = maxCount;

      if (this.productCount > maxCount) {
        this.productCount = maxCount;
        this.productCountInput.value = maxCount;
        this.updateSummary();
        this.saveSettings();
      }
    }

    const label = document.querySelector('label[for="burstProductCount"]');
    if (label) {
      label.innerHTML = `จำนวนสินค้า <span class="label-hint">(สูงสุด ${maxCount})</span>`;
    }
  },

  /**
   * Update summary display
   */
  updateSummary() {
    if (!this.summary) return;

    let productCount;
    if (this.selectionMode === 'manual') {
      productCount = this.manualProducts.length;
    } else {
      productCount = this.productCount;
    }

    const total = productCount * this.roundCount;
    this.summary.innerHTML = `
      <span class="burst-calc">${productCount} สินค้า × ${this.roundCount} รอบ = <strong>${total} ครั้ง</strong></span>
    `;
  },

  /**
   * Render selected products list (for manual mode)
   */
  renderSelectedList() {
    if (!this.selectedList) return;

    if (this.manualProducts.length === 0) {
      this.selectedList.innerHTML = '<div class="burst-empty-state">ยังไม่ได้เลือกสินค้า</div>';
      return;
    }

    this.selectedList.innerHTML = this.manualProducts.map((product, index) => `
      <div class="burst-selected-item" data-index="${index}">
        <img src="${product.productImage}" alt="${product.name}" class="burst-selected-item-img">
        <span class="burst-selected-item-name">${product.name}</span>
        <button type="button" class="burst-selected-item-remove" data-index="${index}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `).join('');

    // Bind remove buttons
    this.selectedList.querySelectorAll('.burst-selected-item-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);
        this.removeManualProduct(index);
      });
    });
  },

  /**
   * Remove a product from manual selection
   */
  removeManualProduct(index) {
    this.manualProducts.splice(index, 1);
    this.renderSelectedList();
    this.updateSummary();
    this.saveSettings();
  },

  /**
   * Open product selection modal
   */
  async openProductModal() {
    if (!this.modal) return;

    // Initialize temp selection with current manual products
    this.tempSelectedIds = new Set(this.manualProducts.map(p => p.id));

    // Render products
    await this.renderProductGrid();

    // Clear search
    if (this.productSearch) {
      this.productSearch.value = '';
    }

    // Update count
    this.updateModalCount();

    // Show modal
    this.modal.hidden = false;
  },

  /**
   * Close product selection modal
   */
  closeProductModal() {
    if (this.modal) {
      this.modal.hidden = true;
    }
    this.tempSelectedIds.clear();
  },

  /**
   * Render product grid in modal
   */
  async renderProductGrid(filter = '') {
    if (!this.productGrid) return;

    if (typeof ProductWarehouse === 'undefined') {
      this.productGrid.innerHTML = '<div class="burst-empty-state">ไม่พบคลังสินค้า</div>';
      return;
    }

    let products = await ProductWarehouse.getAll();

    // Filter by search
    if (filter) {
      const searchLower = filter.toLowerCase();
      products = products.filter(p =>
        p.name.toLowerCase().includes(searchLower)
      );
    }

    if (products.length === 0) {
      this.productGrid.innerHTML = '<div class="burst-empty-state">ไม่พบสินค้า</div>';
      return;
    }

    this.productGrid.innerHTML = products.map(product => `
      <div class="burst-product-card ${this.tempSelectedIds.has(product.id) ? 'selected' : ''}"
           data-id="${product.id}">
        <div class="burst-product-card-checkbox"></div>
        <img src="${product.productImage}" alt="${product.name}" class="burst-product-card-img">
        <div class="burst-product-card-name">${product.name}</div>
      </div>
    `).join('');

    // Bind click events
    this.productGrid.querySelectorAll('.burst-product-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        this.toggleProductSelection(id, card);
      });
    });
  },

  /**
   * Toggle product selection in modal
   */
  toggleProductSelection(id, cardElement) {
    if (this.tempSelectedIds.has(id)) {
      this.tempSelectedIds.delete(id);
      cardElement.classList.remove('selected');
    } else {
      this.tempSelectedIds.add(id);
      cardElement.classList.add('selected');
    }
    this.updateModalCount();
  },

  /**
   * Update modal count display
   */
  updateModalCount() {
    if (this.modalCount) {
      this.modalCount.textContent = `เลือกแล้ว ${this.tempSelectedIds.size} ชิ้น`;
    }
  },

  /**
   * Filter products in modal
   */
  filterProducts(query) {
    this.renderProductGrid(query);
  },

  /**
   * Select all products in modal
   */
  async selectAllProducts() {
    if (typeof ProductWarehouse === 'undefined') return;

    const products = await ProductWarehouse.getAll();
    products.forEach(p => this.tempSelectedIds.add(p.id));

    this.productGrid.querySelectorAll('.burst-product-card').forEach(card => {
      card.classList.add('selected');
    });

    this.updateModalCount();
  },

  /**
   * Deselect all products in modal
   */
  deselectAllProducts() {
    this.tempSelectedIds.clear();

    this.productGrid.querySelectorAll('.burst-product-card').forEach(card => {
      card.classList.remove('selected');
    });

    this.updateModalCount();
  },

  /**
   * Confirm product selection from modal
   */
  async confirmProductSelection() {
    if (typeof ProductWarehouse === 'undefined') return;

    const allProducts = await ProductWarehouse.getAll();

    // Get selected products in order
    this.manualProducts = allProducts.filter(p => this.tempSelectedIds.has(p.id));

    // Close modal
    this.closeProductModal();

    // Update UI
    this.renderSelectedList();
    this.updateSummary();
    this.saveSettings();
  },

  /**
   * Load settings from storage
   */
  loadSettings() {
    const saved = localStorage.getItem('burst_mode_settings');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        this.isEnabled = settings.enabled || false;
        this.selectionMode = settings.selectionMode || 'random';
        this.productCount = settings.productCount || 5;
        this.roundCount = settings.roundCount || 3;
        this.manualProducts = settings.manualProducts || [];

        // Update UI
        if (this.toggle) this.toggle.checked = this.isEnabled;
        if (this.productCountInput) this.productCountInput.value = this.productCount;
        if (this.roundCountInput) this.roundCountInput.value = this.roundCount;
        if (this.manualRoundCountInput) this.manualRoundCountInput.value = this.roundCount;
        if (this.content) this.content.hidden = !this.isEnabled;

        // Set selection mode radio
        const modeRadio = document.querySelector(`input[name="burstSelectionMode"][value="${this.selectionMode}"]`);
        if (modeRadio) {
          modeRadio.checked = true;
          this.setSelectionMode(this.selectionMode);
        }

        // Render selected list for manual mode
        this.renderSelectedList();
        this.updateSummary();
      } catch (e) {
        console.error('Error loading burst mode settings:', e);
      }
    }
  },

  /**
   * Save settings to storage
   */
  saveSettings() {
    const settings = {
      enabled: this.isEnabled,
      selectionMode: this.selectionMode,
      productCount: this.productCount,
      roundCount: this.roundCount,
      manualProducts: this.manualProducts
    };
    localStorage.setItem('burst_mode_settings', JSON.stringify(settings));
  },

  /**
   * Get random products from warehouse
   */
  async getRandomProducts(count) {
    if (typeof ProductWarehouse === 'undefined') return [];

    const allProducts = await ProductWarehouse.getAll();
    if (allProducts.length === 0) return [];

    // Shuffle and take count
    const shuffled = [...allProducts].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  },

  /**
   * Start burst automation
   */
  async start() {
    if (this.isRunning) return false;

    // Get products based on selection mode
    if (this.selectionMode === 'manual') {
      if (this.manualProducts.length === 0) {
        showToast('กรุณาเลือกสินค้าก่อน', 'error');
        return false;
      }
      this.selectedProducts = [...this.manualProducts];
    } else {
      this.selectedProducts = await this.getRandomProducts(this.productCount);
    }

    if (this.selectedProducts.length === 0) {
      showToast('ไม่มีสินค้าในคลัง', 'error');
      return false;
    }

    this.isRunning = true;
    this.currentProductIndex = 0;
    this.currentRound = 0;

    if (this.progressContainer) {
      this.progressContainer.hidden = false;
    }

    return true;
  },

  /**
   * Get next product for automation
   * Returns product data or null if done
   */
  getNextProduct() {
    if (!this.isRunning) return null;

    // Check if all done
    if (this.currentProductIndex >= this.selectedProducts.length) {
      return null;
    }

    const product = this.selectedProducts[this.currentProductIndex];
    this.updateProgress();

    return product;
  },

  /**
   * Move to next iteration
   * Returns true if there's more to do, false if done
   */
  nextIteration() {
    this.currentRound++;

    // If all rounds for current product done, move to next product
    if (this.currentRound >= this.roundCount) {
      this.currentRound = 0;
      this.currentProductIndex++;
    }

    // Check if all done
    if (this.currentProductIndex >= this.selectedProducts.length) {
      this.stop();
      return false;
    }

    this.updateProgress();
    return true;
  },

  /**
   * Update progress display
   */
  updateProgress() {
    if (!this.progressText) return;

    const productNum = this.currentProductIndex + 1;
    const totalProducts = this.selectedProducts.length;
    const roundNum = this.currentRound + 1;
    const totalRounds = this.roundCount;

    this.progressText.textContent = `สินค้า ${productNum}/${totalProducts} - รอบ ${roundNum}/${totalRounds}`;
  },

  /**
   * Stop burst automation
   */
  stop() {
    this.isRunning = false;
    this.selectedProducts = [];
    this.currentProductIndex = 0;
    this.currentRound = 0;

    if (this.progressContainer) {
      this.progressContainer.hidden = true;
    }
  },

  /**
   * Get total iterations count
   */
  getTotalIterations() {
    if (this.selectionMode === 'manual') {
      return this.manualProducts.length * this.roundCount;
    }
    return this.productCount * this.roundCount;
  },

  /**
   * Get current iteration number (1-based)
   */
  getCurrentIteration() {
    return (this.currentProductIndex * this.roundCount) + this.currentRound + 1;
  }
};
