/**
 * Image Upload Module
 * Handles product and person image uploads with drag & drop
 */
const ImageUpload = {
  productImage: null,
  personImage: null,
  warehousePersonImage: null,
  allProducts: [], // Store all products for search filtering
  allCategories: [], // Store all categories

  /**
   * Initialize image upload handlers
   */
  init() {
    this.setupImageUpload('product');
    this.setupImageUpload('person');
    this.setupProductModeToggle();
    this.loadSavedImages();
    this.loadWarehouseProducts();
    this.loadWarehouseCharacters();
  },

  /**
   * Setup product mode toggle (manual/warehouse)
   */
  setupProductModeToggle() {
    const modeRadios = document.querySelectorAll('input[name="productMode"]');
    const manualDiv = document.getElementById('manualProductMode');
    const warehouseDiv = document.getElementById('warehouseProductMode');

    modeRadios.forEach(radio => {
      radio.addEventListener('change', async (e) => {
        const mode = e.target.value;

        if (mode === 'manual') {
          manualDiv.hidden = false;
          warehouseDiv.hidden = true;
          await ProductWarehouse.setMode('manual');
        } else {
          manualDiv.hidden = true;
          warehouseDiv.hidden = false;
          await ProductWarehouse.setMode('warehouse');
          await this.loadWarehouseProducts();
        }
      });
    });

    // Restore saved mode
    ProductWarehouse.getMode().then(mode => {
      const radio = document.querySelector(`input[name="productMode"][value="${mode}"]`);
      if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change'));
      }
    });
  },

  /**
   * Load products from warehouse into dropdown
   */
  async loadWarehouseProducts() {
    const select = document.getElementById('warehouseProductSelect');
    const searchInput = document.getElementById('warehouseProductSearch');
    if (!select) return;

    const products = await ProductWarehouse.getAll();
    const categories = await ProductWarehouse.getCategories();
    const selectedId = await ProductWarehouse.getSelectedPresetId();

    // Store for filtering
    this.allProducts = products;
    this.allCategories = categories;

    // Build category map
    const categoryMap = {};
    categories.forEach(c => categoryMap[c.id] = c.name);

    // Render dropdown with all products
    this.renderProductDropdown(products, categoryMap, selectedId);

    // Setup search handler
    if (searchInput) {
      // Remove old listener if exists
      searchInput.removeEventListener('input', this._searchHandler);
      this._searchHandler = (e) => this.filterProducts(e.target.value);
      searchInput.addEventListener('input', this._searchHandler);
    }

    // Setup change handler (remove old one first)
    select.removeEventListener('change', this._selectHandler);
    this._selectHandler = (e) => this.handleWarehouseProductSelect(e.target.value);
    select.addEventListener('change', this._selectHandler);

    // If there's a selected product, show its preview
    if (selectedId) {
      this.handleWarehouseProductSelect(selectedId);
    }
  },

  /**
   * Render product dropdown with given products
   */
  renderProductDropdown(products, categoryMap, selectedId) {
    const select = document.getElementById('warehouseProductSelect');
    if (!select) return;

    // Clear and rebuild options
    select.innerHTML = '<option value="">-- เลือกสินค้า --</option>';

    if (products.length === 0) {
      const option = document.createElement('option');
      option.disabled = true;
      option.textContent = 'ไม่พบสินค้า';
      select.appendChild(option);
      return;
    }

    // Group products by category
    const grouped = {};
    products.forEach(p => {
      const catName = p.categoryId && categoryMap[p.categoryId] ? categoryMap[p.categoryId] : 'ไม่มีหมวดหมู่';
      if (!grouped[catName]) grouped[catName] = [];
      grouped[catName].push(p);
    });

    // Add options grouped by category
    Object.keys(grouped).forEach(catName => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = catName;

      grouped[catName].forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;
        if (p.id === selectedId) option.selected = true;
        optgroup.appendChild(option);
      });

      select.appendChild(optgroup);
    });
  },

  /**
   * Filter products by search text
   */
  filterProducts(searchText) {
    const search = searchText.trim().toLowerCase();

    // Build category map
    const categoryMap = {};
    this.allCategories.forEach(c => categoryMap[c.id] = c.name);

    // Filter products
    let filtered;
    if (!search) {
      filtered = this.allProducts;
    } else {
      filtered = this.allProducts.filter(p =>
        p.name.toLowerCase().includes(search) ||
        (p.productId && p.productId.toLowerCase().includes(search))
      );
    }

    // Re-render dropdown
    const selectedId = document.getElementById('warehouseProductSelect').value;
    this.renderProductDropdown(filtered, categoryMap, selectedId);
  },

  /**
   * Handle warehouse product selection
   */
  async handleWarehouseProductSelect(productId) {
    const preview = document.getElementById('warehouseProductImagePreview');
    const placeholder = document.getElementById('warehouseProductPlaceholder');
    const nameInput = document.getElementById('warehouseProductName');

    if (!productId) {
      preview.hidden = true;
      placeholder.hidden = false;
      nameInput.value = '';
      await chrome.storage.local.remove(['selectedPresetId']);
      return;
    }

    const product = await ProductWarehouse.getById(productId);
    if (product) {
      preview.src = product.productImage;
      preview.hidden = false;
      placeholder.hidden = true;
      nameInput.value = product.name;
      await ProductWarehouse.selectProduct(productId);
    }
  },

  /**
   * Load characters from warehouse into dropdown
   */
  async loadWarehouseCharacters() {
    const select = document.getElementById('warehouseCharacterSelect');
    if (!select) return;

    const characters = await ProductWarehouse.getCharacters();
    const selectedId = await ProductWarehouse.getSelectedCharacterId();

    // Clear and rebuild options
    select.innerHTML = '<option value="">-- เลือกตัวละคร --</option>';

    const genderMap = { female: 'หญิง', male: 'ชาย' };

    characters.forEach(c => {
      const option = document.createElement('option');
      option.value = c.id;
      option.textContent = `${c.name} (${genderMap[c.gender] || 'หญิง'})`;
      if (c.id === selectedId) option.selected = true;
      select.appendChild(option);
    });

    // Setup change handler
    select.addEventListener('change', (e) => this.handleWarehouseCharacterSelect(e.target.value));

    // If there's a selected character, show its preview
    if (selectedId) {
      this.handleWarehouseCharacterSelect(selectedId);
    }
  },

  /**
   * Handle warehouse character selection
   */
  async handleWarehouseCharacterSelect(characterId) {
    const preview = document.getElementById('warehouseCharacterImagePreview');
    const placeholder = document.getElementById('warehouseCharacterPlaceholder');

    if (!characterId) {
      if (preview) preview.hidden = true;
      if (placeholder) placeholder.hidden = false;
      this.warehousePersonImage = null;
      await chrome.storage.local.remove(['selectedCharacterId']);
      if (typeof UGCSection !== 'undefined') UGCSection.updateState();
      return;
    }

    const character = await ProductWarehouse.getCharacterById(characterId);
    if (character) {
      if (preview) {
        preview.src = character.image;
        preview.hidden = false;
      }
      if (placeholder) placeholder.hidden = true;

      this.warehousePersonImage = character.image;
      await ProductWarehouse.selectCharacter(characterId);

      // Auto-set gender based on character
      const genderRadio = document.querySelector(`input[name="reviewerGenderWarehouse"][value="${character.gender}"]`);
      if (genderRadio) genderRadio.checked = true;

      if (typeof UGCSection !== 'undefined') UGCSection.updateState();
    }
  },

  /**
   * Load saved images from storage
   */
  loadSavedImages() {
    chrome.storage.local.get(['savedProductImage', 'savedPersonImage'], (result) => {
      if (result.savedProductImage) {
        this.restoreImage('product', result.savedProductImage);
      }
      if (result.savedPersonImage) {
        this.restoreImage('person', result.savedPersonImage);
      }
    });
  },

  /**
   * Restore image from saved data
   */
  restoreImage(type, base64) {
    const isProduct = type === 'product';
    const preview = document.getElementById(isProduct ? 'productImagePreview' : 'personImagePreview');
    const box = document.getElementById(isProduct ? 'productImageBox' : 'personImageBox');
    const removeBtn = box.querySelector('.remove-image-btn');
    const placeholder = box.querySelector('.upload-placeholder');

    if (type === 'product') {
      this.productImage = base64;
    } else {
      this.personImage = base64;
    }

    preview.src = base64;
    preview.hidden = false;
    removeBtn.hidden = false;
    placeholder.hidden = true;

    if (type === 'person') {
      UGCSection.updateState();
    }
  },

  /**
   * Setup image upload with drag & drop
   */
  setupImageUpload(type) {
    const isProduct = type === 'product';
    const box = document.getElementById(isProduct ? 'productImageBox' : 'personImageBox');
    const input = document.getElementById(isProduct ? 'productImageInput' : 'personImageInput');
    const preview = document.getElementById(isProduct ? 'productImagePreview' : 'personImagePreview');
    const removeBtn = box.querySelector('.remove-image-btn');
    const placeholder = box.querySelector('.upload-placeholder');

    // Click to upload
    box.addEventListener('click', (e) => {
      if (e.target !== removeBtn) {
        input.click();
      }
    });

    // File input change
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.handleImageUpload(file, type, preview, removeBtn, placeholder);
      }
    });

    // Remove button
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeImage(type, preview, removeBtn, placeholder, input);
    });

    // Drag & Drop
    box.addEventListener('dragover', (e) => {
      e.preventDefault();
      box.classList.add('dragover');
    });

    box.addEventListener('dragleave', (e) => {
      e.preventDefault();
      box.classList.remove('dragover');
    });

    box.addEventListener('drop', (e) => {
      e.preventDefault();
      box.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) {
        this.handleImageUpload(file, type, preview, removeBtn, placeholder);
      }
    });
  },

  /**
   * Handle image upload
   */
  async handleImageUpload(file, type, preview, removeBtn, placeholder) {
    if (!file.type.startsWith('image/')) {
      Helpers.showToast('กรุณาเลือกไฟล์รูปภาพ', 'error');
      return;
    }

    try {
      const base64 = await Helpers.fileToBase64(file);

      if (type === 'product') {
        this.productImage = base64;
        chrome.storage.local.set({ savedProductImage: base64 });
      } else {
        this.personImage = base64;
        chrome.storage.local.set({ savedPersonImage: base64 });
        UGCSection.updateState();
      }

      preview.src = base64;
      preview.hidden = false;
      removeBtn.hidden = false;
      placeholder.hidden = true;

      Helpers.showToast(type === 'product' ? 'อัพโหลดภาพสินค้าแล้ว' : 'อัพโหลดภาพคนแล้ว', 'success');
    } catch (error) {
      console.error('Error uploading image:', error);
      Helpers.showToast('อัพโหลดไม่สำเร็จ', 'error');
    }
  },

  /**
   * Remove image
   */
  removeImage(type, preview, removeBtn, placeholder, input) {
    if (type === 'product') {
      this.productImage = null;
      chrome.storage.local.remove(['savedProductImage']);
    } else {
      this.personImage = null;
      chrome.storage.local.remove(['savedPersonImage']);
      UGCSection.updateState();
    }

    preview.src = '';
    preview.hidden = true;
    removeBtn.hidden = true;
    placeholder.hidden = false;
    input.value = '';
  },

  /**
   * Get product image based on current mode
   */
  async getProductImage() {
    const mode = await ProductWarehouse.getMode();

    if (mode === 'warehouse') {
      const product = await ProductWarehouse.getSelectedProduct();
      return product ? product.productImage : null;
    }

    return this.productImage;
  },

  /**
   * Get person image based on current mode
   */
  async getPersonImage() {
    const mode = await ProductWarehouse.getMode();

    if (mode === 'warehouse') {
      return this.warehousePersonImage;
    }

    return this.personImage;
  },

  /**
   * Check if person image exists based on current mode
   */
  async hasPersonImage() {
    const mode = await ProductWarehouse.getMode();

    if (mode === 'warehouse') {
      return this.warehousePersonImage !== null;
    }

    return this.personImage !== null;
  },

  /**
   * Set warehouse person image
   */
  setWarehousePersonImage(base64) {
    this.warehousePersonImage = base64;
    if (base64) {
      chrome.storage.local.set({ savedWarehousePersonImage: base64 });
    } else {
      chrome.storage.local.remove(['savedWarehousePersonImage']);
    }
  },

  /**
   * Get product name based on current mode
   */
  async getProductName() {
    const mode = await ProductWarehouse.getMode();

    if (mode === 'warehouse') {
      const product = await ProductWarehouse.getSelectedProduct();
      return product ? product.name : '';
    }

    return document.getElementById('productName').value.trim();
  },

  /**
   * Get reviewer gender based on current mode
   */
  async getReviewerGender() {
    const mode = await ProductWarehouse.getMode();
    const radioName = mode === 'warehouse' ? 'reviewerGenderWarehouse' : 'reviewerGender';
    const selected = document.querySelector(`input[name="${radioName}"]:checked`);
    return selected ? selected.value : 'female';
  },

  /**
   * Get loop count based on current mode
   */
  async getLoopCount() {
    const mode = await ProductWarehouse.getMode();
    const selectId = mode === 'warehouse' ? 'loopCountSelectWarehouse' : 'loopCountSelect';
    const customId = mode === 'warehouse' ? 'customLoopCountWarehouse' : 'customLoopCount';

    const select = document.getElementById(selectId);
    const customInput = document.getElementById(customId);

    if (select.value === 'custom') {
      return parseInt(customInput.value) || 1;
    }
    return parseInt(select.value) || 1;
  },

  /**
   * Synchronous version for backward compatibility
   */
  getProductImageSync() {
    return this.productImage;
  },

  getPersonImageSync() {
    return this.personImage;
  },

  hasPersonImageSync() {
    return this.personImage !== null;
  },

  /**
   * Load product data from warehouse product object (for Burst Mode)
   * @param {Object} product - Product object from warehouse
   */
  async loadFromProduct(product) {
    if (!product) return;

    // ตั้งค่าให้ใช้โหมด warehouse
    await ProductWarehouse.setMode('warehouse');

    // Update mode radio if exists
    const warehouseRadio = document.querySelector('input[name="productMode"][value="warehouse"]');
    if (warehouseRadio) {
      warehouseRadio.checked = true;
      warehouseRadio.dispatchEvent(new Event('change'));
    }

    // เลือกสินค้าใน dropdown
    const select = document.getElementById('warehouseProductSelect');
    if (select) {
      select.value = product.id;
    }

    // อัพเดท preview และชื่อสินค้า
    const preview = document.getElementById('warehouseProductImagePreview');
    const placeholder = document.getElementById('warehouseProductPlaceholder');
    const nameInput = document.getElementById('warehouseProductName');

    if (preview) {
      preview.src = product.productImage;
      preview.hidden = false;
    }
    if (placeholder) placeholder.hidden = true;
    if (nameInput) nameInput.value = product.name;

    // บันทึกว่าเลือกสินค้านี้
    await ProductWarehouse.selectProduct(product.id);

    // โหลดหัวข้อหลัก/หัวข้อย่อย ถ้ามี
    if (typeof CoverDetails !== 'undefined') {
      const mainHeadingInput = document.getElementById('mainHeading');
      const subHeadingInput = document.getElementById('subHeading');

      if (mainHeadingInput && product.mainHeading) {
        mainHeadingInput.value = product.mainHeading;
      }
      if (subHeadingInput && product.subHeading) {
        subHeadingInput.value = product.subHeading;
      }
    }
  }
};
