/**
 * Warehouse Page Script
 * Handles product warehouse UI and interactions
 */

// State
let pendingUploads = [];
let pendingCharacterUploads = [];
let currentFilter = 'all';
let editingProductId = null;
let editingCategoryId = null;
let editingCharacterId = null;
let deletingId = null;
let deleteType = null; // 'product', 'category', or 'character'

// Video state
let currentVideoProductId = null;
let currentVideoFilter = 'all';
let videoProductCounts = {}; // Cache video counts per product

// Duplicate detection state
let duplicateModalData = {
  type: 'product', // 'product' or 'video'
  duplicates: [],
  newItems: [],
  resolveCallback: null
};

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initWarehouse();
});

/**
 * Initialize warehouse page
 */
async function initWarehouse() {
  // Initialize VideoStorage
  if (typeof VideoStorage !== 'undefined') {
    await VideoStorage.init();
  }

  setupUploadModals();
  setupDropZone();
  setupCharacterDropZone();
  setupModals();
  setupCharacterModals();
  setupVideoModal();
  setupFilterTabs();
  setupImportExport();
  setupStorageManagement();
  setupCleanNamesModal();
  setupGenerateDetailsModal();
  setupDuplicateModal();
  await loadCategories();
  await loadVideoProductCounts();
  await loadProducts();
  await loadCharacters();
  await updateStats();
  await updateStorageUsage();
}

/**
 * Setup upload modals for products and characters
 */
function setupUploadModals() {
  // Product upload modal
  const addProductBtn = document.getElementById('addProductBtn');
  const productUploadModal = document.getElementById('productUploadModal');
  const closeProductUploadModal = document.getElementById('closeProductUploadModal');

  if (addProductBtn && productUploadModal) {
    addProductBtn.addEventListener('click', async () => {
      // Load categories into modal dropdown
      await loadCategoriesForModal('productUploadCategory');
      productUploadModal.hidden = false;
    });

    closeProductUploadModal?.addEventListener('click', () => {
      productUploadModal.hidden = true;
    });

    productUploadModal.addEventListener('click', (e) => {
      if (e.target === productUploadModal) {
        productUploadModal.hidden = true;
      }
    });
  }

  // Character upload modal
  const addCharacterBtn = document.getElementById('addCharacterBtn');
  const characterUploadModal = document.getElementById('characterUploadModal');
  const closeCharacterUploadModal = document.getElementById('closeCharacterUploadModal');

  if (addCharacterBtn && characterUploadModal) {
    addCharacterBtn.addEventListener('click', () => {
      characterUploadModal.hidden = false;
    });

    closeCharacterUploadModal?.addEventListener('click', () => {
      characterUploadModal.hidden = true;
    });

    characterUploadModal.addEventListener('click', (e) => {
      if (e.target === characterUploadModal) {
        characterUploadModal.hidden = true;
      }
    });
  }
}

/**
 * Load categories into a specific dropdown
 */
async function loadCategoriesForModal(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;

  const categories = await ProductWarehouse.getCategories();

  select.innerHTML = '<option value="">ไม่ระบุหมวดหมู่</option>';
  categories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat.id;
    option.textContent = cat.name;
    select.appendChild(option);
  });
}

/**
 * Setup drop zone for file upload
 */
function setupDropZone() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');

  if (!dropZone || !fileInput) return;

  // Click to open file dialog
  dropZone.addEventListener('click', () => fileInput.click());

  // File input change
  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    fileInput.value = '';
  });

  // Drag events
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });

  // Upload actions
  document.getElementById('clearUploadBtn').addEventListener('click', clearPendingUploads);
  document.getElementById('saveAllBtn').addEventListener('click', saveAllProducts);
}

/**
 * Handle dropped/selected files
 */
async function handleFiles(files) {
  const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));

  if (imageFiles.length === 0) {
    showToast('กรุณาเลือกไฟล์รูปภาพ', 'error');
    return;
  }

  showToast(`กำลังประมวลผล ${imageFiles.length} ภาพ...`, 'info');

  for (const file of imageFiles) {
    const originalBase64 = await fileToBase64(file);
    // Resize image to reduce storage usage
    const base64 = await resizeImageForStorage(originalBase64, 400, 0.7);
    pendingUploads.push({
      file,
      base64,
      name: '',
      productId: '',
      mainHeading: '',
      subHeading: ''
    });
  }

  renderUploadPreview();
}

/**
 * Convert file to base64
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Resize image to reduce storage size
 * Target: max 400px (smaller for warehouse), quality 0.7
 */
function resizeImageForStorage(base64, maxSize = 400, quality = 0.7) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;

      // Skip if already small enough
      if (width <= maxSize && height <= maxSize) {
        resolve(base64);
        return;
      }

      // Calculate new dimensions
      let newWidth, newHeight;
      if (width > height) {
        newWidth = maxSize;
        newHeight = Math.round((height / width) * maxSize);
      } else {
        newHeight = maxSize;
        newWidth = Math.round((width / height) * maxSize);
      }

      // Create canvas and resize
      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      // Convert to JPEG with compression
      const resizedBase64 = canvas.toDataURL('image/jpeg', quality);
      resolve(resizedBase64);
    };
    img.onerror = () => resolve(base64); // Return original on error
    img.src = base64;
  });
}

/**
 * Render upload preview grid
 */
function renderUploadPreview() {
  const container = document.getElementById('uploadPreview');
  const grid = document.getElementById('uploadGrid');
  const uploadButtons = document.getElementById('uploadButtons');

  if (pendingUploads.length === 0) {
    container.hidden = true;
    if (uploadButtons) uploadButtons.hidden = true;
    return;
  }

  container.hidden = false;
  if (uploadButtons) uploadButtons.hidden = false;
  grid.innerHTML = pendingUploads.map((item, index) => `
    <div class="upload-item" data-index="${index}">
      <button class="upload-item-remove" data-remove="${index}">&times;</button>
      <img src="${item.base64}" class="upload-item-image" alt="Preview">
      <div class="form-group">
        <input type="text" placeholder="ชื่อสินค้า *" value="${item.name}" data-field="name" data-index="${index}">
      </div>
      <div class="form-group">
        <input type="text" placeholder="รหัสสินค้า (ไม่จำเป็น)" value="${item.productId}" data-field="productId" data-index="${index}">
      </div>
      <div class="form-group">
        <input type="text" placeholder="หัวข้อหลัก (spin text)" value="${item.mainHeading}" data-field="mainHeading" data-index="${index}">
      </div>
      <div class="form-group">
        <input type="text" placeholder="หัวข้อย่อย (spin text)" value="${item.subHeading}" data-field="subHeading" data-index="${index}">
      </div>
    </div>
  `).join('');

  // Add event listeners for remove buttons
  grid.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.remove);
      removeUploadItem(index);
    });
  });

  // Add event listeners for input fields
  grid.querySelectorAll('input[data-field]').forEach(input => {
    input.addEventListener('input', (e) => {
      const index = parseInt(e.target.dataset.index);
      const field = e.target.dataset.field;
      updateUploadItem(index, field, e.target.value);
    });
  });
}

/**
 * Update pending upload item
 */
function updateUploadItem(index, field, value) {
  if (pendingUploads[index]) {
    pendingUploads[index][field] = value;
  }
}

/**
 * Remove upload item
 */
function removeUploadItem(index) {
  pendingUploads.splice(index, 1);
  renderUploadPreview();
}

/**
 * Clear all pending uploads
 */
function clearPendingUploads() {
  pendingUploads = [];
  renderUploadPreview();
}

/**
 * Save all pending products
 */
async function saveAllProducts() {
  // Validate
  const hasEmptyNames = pendingUploads.some(p => !p.name.trim());
  if (hasEmptyNames) {
    showToast('กรุณากรอกชื่อสินค้าให้ครบ', 'error');
    return;
  }

  if (pendingUploads.length === 0) {
    showToast('ไม่มีสินค้าที่จะบันทึก', 'error');
    return;
  }

  // Get category from modal dropdown
  const categorySelect = document.getElementById('productUploadCategory') || document.getElementById('uploadCategory');
  const categoryId = categorySelect?.value || null;

  const products = pendingUploads.map(p => ({
    name: p.name,
    productId: p.productId,
    productImage: p.base64,
    mainHeading: p.mainHeading,
    subHeading: p.subHeading,
    categoryId
  }));

  // Check for duplicates
  const { duplicates, newProducts } = await ProductWarehouse.checkProductDuplicates(products);

  let productsToSave = newProducts;

  // If duplicates found, show modal and wait for user decision
  if (duplicates.length > 0) {
    const userChoice = await showDuplicateModal('product', duplicates, newProducts);

    if (userChoice.action === 'skip') {
      // Save only non-duplicates and unchecked items
      productsToSave = [...newProducts, ...userChoice.includeDuplicates];
    } else if (userChoice.action === 'import-all') {
      // Save all including duplicates
      productsToSave = products;
    } else {
      // User cancelled
      return;
    }
  }

  if (productsToSave.length === 0) {
    showToast('ไม่มีสินค้าใหม่ที่จะบันทึก (ข้ามสินค้าซ้ำ)', 'info');
    clearPendingUploads();
    return;
  }

  try {
    await ProductWarehouse.saveMultiple(productsToSave);
    showToast(`บันทึก ${productsToSave.length} สินค้าสำเร็จ`, 'success');
    clearPendingUploads();
    await loadProducts();
    await updateStats();
    // Close modal after successful save
    const productUploadModal = document.getElementById('productUploadModal');
    if (productUploadModal) productUploadModal.hidden = true;
  } catch (error) {
    console.error('Error saving products:', error);
    showToast('เกิดข้อผิดพลาดในการบันทึก', 'error');
  }
}

/**
 * Load and render categories
 */
async function loadCategories() {
  const categories = await ProductWarehouse.getCategories();

  // Update upload category dropdown
  const uploadSelect = document.getElementById('uploadCategory');
  const editSelect = document.getElementById('editCategory');

  const options = `
    <option value="">ไม่ระบุหมวดหมู่</option>
    ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
  `;

  uploadSelect.innerHTML = options;
  editSelect.innerHTML = options;

  // Update filter tabs
  renderFilterTabs(categories);
}

/**
 * Render filter tabs
 */
function renderFilterTabs(categories) {
  const container = document.getElementById('filterTabs');

  container.innerHTML = `
    <button class="filter-tab ${currentFilter === 'all' ? 'active' : ''}" data-category="all">ทั้งหมด</button>
    ${categories.map(c => `
      <button class="filter-tab ${currentFilter === c.id ? 'active' : ''}" data-category="${c.id}">
        ${c.name}
        <span class="filter-tab-actions">
          <span class="filter-tab-action" data-action="edit-category" data-id="${c.id}" data-name="${c.name}">&#9998;</span>
          <span class="filter-tab-action" data-action="delete-category" data-id="${c.id}" data-name="${c.name}">&times;</span>
        </span>
      </button>
    `).join('')}
  `;

  // Add event listeners for category actions
  container.querySelectorAll('[data-action="edit-category"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      editCategory(e.target.dataset.id, e.target.dataset.name);
    });
  });

  container.querySelectorAll('[data-action="delete-category"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      confirmDeleteCategory(e.target.dataset.id, e.target.dataset.name);
    });
  });
}

/**
 * Setup filter tabs click handler
 */
function setupFilterTabs() {
  document.getElementById('filterTabs').addEventListener('click', async (e) => {
    const tab = e.target.closest('.filter-tab');
    if (!tab || e.target.classList.contains('filter-tab-action')) return;

    currentFilter = tab.dataset.category;

    // Update active state
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    await loadProducts();
  });
}

/**
 * Load and render products
 */
async function loadProducts() {
  let products;
  if (currentFilter === 'all') {
    products = await ProductWarehouse.getAll();
  } else {
    products = await ProductWarehouse.getByCategory(currentFilter);
  }

  const categories = await ProductWarehouse.getCategories();
  const categoryMap = {};
  categories.forEach(c => categoryMap[c.id] = c.name);

  renderProducts(products, categoryMap);
}

/**
 * Render product grid
 */
function renderProducts(products, categoryMap) {
  const grid = document.getElementById('productGrid');

  if (products.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" id="emptyState">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <circle cx="8.5" cy="8.5" r="1.5"></circle>
          <polyline points="21 15 16 10 5 21"></polyline>
        </svg>
        <p>ยังไม่มีสินค้าในคลัง</p>
        <p class="empty-hint">ลากวางภาพหรือคลิกที่กล่องด้านบนเพื่อเพิ่มสินค้า</p>
      </div>
    `;
    return;
  }

  // Sort by createdAt desc
  products.sort((a, b) => b.createdAt - a.createdAt);

  grid.innerHTML = products.map(p => `
    <div class="product-card" data-id="${p.id}">
      <div class="product-card-image-wrapper" data-product-id="${p.id}">
        <img src="${p.productImage}" class="product-card-image" alt="${p.name}">
        <div class="video-drop-overlay">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="23 7 16 12 23 17 23 7"></polygon>
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
          </svg>
          <span>วางวิดีโอที่นี่</span>
        </div>
      </div>
      <div class="product-card-body">
        <div class="product-card-name" data-action="edit-name" data-id="${p.id}" title="คลิกเพื่อแก้ไขชื่อ: ${p.name}">${p.name}</div>
        <div class="product-card-id-row">
          <input type="text" class="product-id-input" placeholder="รหัสสินค้า..." value="${p.productId || ''}" data-product-id="${p.id}">
          <button class="btn btn-save-id btn-sm" data-action="save-id" data-id="${p.id}" title="บันทึกรหัส">✓</button>
        </div>
        ${p.categoryId && categoryMap[p.categoryId] ? `<div class="product-card-category">${categoryMap[p.categoryId]}</div>` : ''}
        ${getVideoBadgeHTML(p.id)}
        <div class="product-card-actions">
          <button class="btn btn-primary btn-sm" data-action="select" data-id="${p.id}">เลือก</button>
          <button class="btn btn-secondary btn-sm" data-action="edit" data-id="${p.id}">แก้ไข</button>
          <button class="btn btn-secondary btn-sm" data-action="delete" data-id="${p.id}" data-name="${p.name}">ลบ</button>
        </div>
      </div>
    </div>
  `).join('');

  // Add event listeners for product actions
  grid.querySelectorAll('[data-action="select"]').forEach(btn => {
    btn.addEventListener('click', () => {
      selectProduct(btn.dataset.id);
    });
  });

  grid.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      editProduct(btn.dataset.id);
    });
  });

  grid.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => {
      confirmDeleteProduct(btn.dataset.id, btn.dataset.name);
    });
  });

  // Add event listeners for edit name (click to open modal)
  grid.querySelectorAll('[data-action="edit-name"]').forEach(el => {
    el.addEventListener('click', () => {
      openEditNameModal(el.dataset.id);
    });
  });

  // Add event listeners for save productId buttons
  grid.querySelectorAll('[data-action="save-id"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const productId = btn.dataset.id;
      const input = grid.querySelector(`input[data-product-id="${productId}"]`);
      if (input) {
        await saveProductIdInline(productId, input.value);
      }
    });
  });

  // Allow Enter key to save productId
  grid.querySelectorAll('.product-id-input').forEach(input => {
    input.addEventListener('keypress', async (e) => {
      if (e.key === 'Enter') {
        const productId = input.dataset.productId;
        await saveProductIdInline(productId, input.value);
      }
    });
  });

  // Add event listeners for video badge
  grid.querySelectorAll('[data-action="open-video"]').forEach(badge => {
    badge.addEventListener('click', () => {
      openVideoModal(badge.dataset.id);
    });
  });

  // Add drag & drop event listeners for product card image wrappers
  setupProductImageDropZones(grid);
}

/**
 * Update statistics
 */
async function updateStats() {
  const stats = await ProductWarehouse.getStats();

  document.getElementById('totalProducts').textContent = stats.total;

  const categoryStats = document.getElementById('categoryStats');
  const entries = Object.entries(stats.byCategory);

  if (entries.length === 0) {
    categoryStats.innerHTML = '<span class="stat-category"><span class="stat-category-name">ยังไม่มีหมวดหมู่</span></span>';
  } else {
    categoryStats.innerHTML = entries.map(([id, data]) => `
      <span class="stat-category">
        <span class="stat-category-name">${data.name}:</span>
        <span class="stat-category-count">${data.count}</span>
      </span>
    `).join('');
  }

  // Update video stats
  await updateVideoStats();
}

/**
 * Update video statistics
 */
async function updateVideoStats() {
  const videos = await ProductWarehouse.getVideos();

  let totalVideos = videos.length;
  let pendingCount = 0;
  let uploadedCount = 0;

  videos.forEach(v => {
    if (v.status === 'pending') {
      pendingCount++;
    } else if (v.status === 'uploaded') {
      uploadedCount++;
    }
  });

  document.getElementById('totalVideos').textContent = totalVideos;
  document.getElementById('pendingVideos').textContent = pendingCount;
  document.getElementById('uploadedVideos').textContent = uploadedCount;
}

/**
 * Open edit name modal
 */
async function openEditNameModal(id) {
  const product = await ProductWarehouse.getById(id);
  if (!product) return;

  editingProductId = id;

  document.getElementById('editPreviewImage').src = product.productImage;
  document.getElementById('editProductName').value = product.name;
  document.getElementById('editProductId').value = product.productId || '';
  document.getElementById('editMainHeading').value = product.mainHeading || '';
  document.getElementById('editSubHeading').value = product.subHeading || '';
  document.getElementById('editCartName').value = product.cartName || '';
  document.getElementById('editCartNameCount').textContent = `${(product.cartName || '').length}/29`;
  document.getElementById('editCategory').value = product.categoryId || '';

  document.getElementById('editModal').hidden = false;

  // Focus on name input
  setTimeout(() => {
    document.getElementById('editProductName').focus();
    document.getElementById('editProductName').select();
  }, 100);
}

/**
 * Save productId inline (without opening modal)
 */
async function saveProductIdInline(id, newProductId) {
  try {
    await ProductWarehouse.update(id, { productId: newProductId });
    showToast('บันทึกรหัสสินค้าสำเร็จ', 'success');
  } catch (error) {
    console.error('Error saving productId:', error);
    showToast('เกิดข้อผิดพลาดในการบันทึก', 'error');
  }
}

/**
 * Select product and notify sidebar
 */
async function selectProduct(id) {
  await ProductWarehouse.selectProduct(id);
  showToast('เลือกสินค้าแล้ว กรุณากลับไปที่ Sidebar', 'success');
}

/**
 * Setup modals
 */
function setupModals() {
  // Edit modal
  document.getElementById('closeEditModal').addEventListener('click', closeEditModal);
  document.getElementById('cancelEditBtn').addEventListener('click', closeEditModal);
  document.getElementById('saveEditBtn').addEventListener('click', saveEditProduct);

  // Cart name char count
  const editCartNameInput = document.getElementById('editCartName');
  const editCartNameCount = document.getElementById('editCartNameCount');
  if (editCartNameInput && editCartNameCount) {
    editCartNameInput.addEventListener('input', () => {
      let value = editCartNameInput.value.replace(/[^a-zA-Z0-9ก-๙\s]/g, '');
      if (value.length > 29) value = value.substring(0, 29);
      editCartNameInput.value = value;
      editCartNameCount.textContent = `${value.length}/29`;
    });
  }

  // Generate details button
  document.getElementById('generateDetailsBtn').addEventListener('click', generateDetailsAI);

  // Category modal
  document.getElementById('addCategoryBtn').addEventListener('click', () => openCategoryModal());
  document.getElementById('closeCategoryModal').addEventListener('click', closeCategoryModal);
  document.getElementById('cancelCategoryBtn').addEventListener('click', closeCategoryModal);
  document.getElementById('saveCategoryBtn').addEventListener('click', saveCategory);

  // Delete modal
  document.getElementById('closeDeleteModal').addEventListener('click', closeDeleteModal);
  document.getElementById('cancelDeleteBtn').addEventListener('click', closeDeleteModal);
  document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDelete);

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.hidden = true;
      }
    });
  });
}

/**
 * Edit product
 */
async function editProduct(id) {
  const product = await ProductWarehouse.getById(id);
  if (!product) return;

  editingProductId = id;

  document.getElementById('editPreviewImage').src = product.productImage;
  document.getElementById('editProductName').value = product.name;
  document.getElementById('editProductId').value = product.productId || '';
  document.getElementById('editMainHeading').value = product.mainHeading || '';
  document.getElementById('editSubHeading').value = product.subHeading || '';
  document.getElementById('editCartName').value = product.cartName || '';
  document.getElementById('editCartNameCount').textContent = `${(product.cartName || '').length}/29`;
  document.getElementById('editCategory').value = product.categoryId || '';

  document.getElementById('editModal').hidden = false;
}

function closeEditModal() {
  document.getElementById('editModal').hidden = true;
  editingProductId = null;
}

async function saveEditProduct() {
  if (!editingProductId) return;

  const name = document.getElementById('editProductName').value.trim();
  if (!name) {
    showToast('กรุณากรอกชื่อสินค้า', 'error');
    return;
  }

  const data = {
    name,
    productId: document.getElementById('editProductId').value,
    mainHeading: document.getElementById('editMainHeading').value,
    subHeading: document.getElementById('editSubHeading').value,
    cartName: document.getElementById('editCartName').value,
    categoryId: document.getElementById('editCategory').value || null
  };

  try {
    await ProductWarehouse.update(editingProductId, data);
    showToast('แก้ไขสินค้าสำเร็จ', 'success');
    closeEditModal();
    await loadProducts();
    await updateStats();
  } catch (error) {
    console.error('Error updating product:', error);
    showToast('เกิดข้อผิดพลาด', 'error');
  }
}

/**
 * Category modal
 */
function openCategoryModal(id = null, name = '') {
  editingCategoryId = id;
  document.getElementById('categoryModalTitle').textContent = id ? 'แก้ไขหมวดหมู่' : 'เพิ่มหมวดหมู่';
  document.getElementById('categoryName').value = name;
  document.getElementById('categoryModal').hidden = false;
}

function closeCategoryModal() {
  document.getElementById('categoryModal').hidden = true;
  editingCategoryId = null;
}

function editCategory(id, name) {
  openCategoryModal(id, name);
}

async function saveCategory() {
  const name = document.getElementById('categoryName').value.trim();
  if (!name) {
    showToast('กรุณากรอกชื่อหมวดหมู่', 'error');
    return;
  }

  try {
    if (editingCategoryId) {
      await ProductWarehouse.updateCategory(editingCategoryId, name);
      showToast('แก้ไขหมวดหมู่สำเร็จ', 'success');
    } else {
      await ProductWarehouse.addCategory(name);
      showToast('เพิ่มหมวดหมู่สำเร็จ', 'success');
    }
    closeCategoryModal();
    await loadCategories();
    await updateStats();
  } catch (error) {
    console.error('Error saving category:', error);
    showToast('เกิดข้อผิดพลาด', 'error');
  }
}

/**
 * Delete confirmation
 */
function confirmDeleteProduct(id, name) {
  deletingId = id;
  deleteType = 'product';
  document.getElementById('deleteMessage').textContent = `คุณต้องการลบสินค้า "${name}" หรือไม่?`;
  document.getElementById('deleteModal').hidden = false;
}

function confirmDeleteCategory(id, name) {
  deletingId = id;
  deleteType = 'category';
  document.getElementById('deleteMessage').textContent = `คุณต้องการลบหมวดหมู่ "${name}" หรือไม่? สินค้าในหมวดหมู่นี้จะไม่ถูกลบ`;
  document.getElementById('deleteModal').hidden = false;
}

function closeDeleteModal() {
  document.getElementById('deleteModal').hidden = true;
  deletingId = null;
  deleteType = null;
}

async function confirmDelete() {
  if (!deletingId || !deleteType) return;

  try {
    if (deleteType === 'product') {
      await ProductWarehouse.delete(deletingId);
      showToast('ลบสินค้าสำเร็จ', 'success');
    } else if (deleteType === 'category') {
      await ProductWarehouse.deleteCategory(deletingId);
      showToast('ลบหมวดหมู่สำเร็จ', 'success');
      if (currentFilter === deletingId) {
        currentFilter = 'all';
      }
    } else if (deleteType === 'character') {
      await ProductWarehouse.deleteCharacter(deletingId);
      showToast('ลบตัวละครสำเร็จ', 'success');
    }
    closeDeleteModal();
    await loadCategories();
    await loadProducts();
    await loadCharacters();
    await updateStats();
  } catch (error) {
    console.error('Error deleting:', error);
    showToast('เกิดข้อผิดพลาด', 'error');
  }
}

// =====================
// Character Management
// =====================

/**
 * Setup character drop zone
 */
function setupCharacterDropZone() {
  const dropZone = document.getElementById('characterDropZone');
  const fileInput = document.getElementById('characterFileInput');

  if (!dropZone || !fileInput) return;

  // Click to open file dialog
  dropZone.addEventListener('click', () => fileInput.click());

  // File input change
  fileInput.addEventListener('change', (e) => {
    handleCharacterFiles(e.target.files);
    fileInput.value = '';
  });

  // Drag events
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleCharacterFiles(e.dataTransfer.files);
  });

  // Upload actions
  document.getElementById('clearCharacterUploadBtn').addEventListener('click', clearPendingCharacterUploads);
  document.getElementById('saveAllCharactersBtn').addEventListener('click', saveAllCharacters);
}

/**
 * Handle character files
 */
async function handleCharacterFiles(files) {
  const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));

  if (imageFiles.length === 0) {
    showToast('กรุณาเลือกไฟล์รูปภาพ', 'error');
    return;
  }

  for (const file of imageFiles) {
    const base64 = await fileToBase64(file);
    pendingCharacterUploads.push({
      file,
      base64,
      name: '',
      gender: 'female'
    });
  }

  renderCharacterUploadPreview();
}

/**
 * Render character upload preview
 */
function renderCharacterUploadPreview() {
  const container = document.getElementById('characterUploadPreview');
  const grid = document.getElementById('characterUploadGrid');

  if (pendingCharacterUploads.length === 0) {
    container.hidden = true;
    return;
  }

  container.hidden = false;
  grid.innerHTML = pendingCharacterUploads.map((item, index) => `
    <div class="upload-item" data-index="${index}">
      <button class="upload-item-remove" data-remove-char="${index}">&times;</button>
      <img src="${item.base64}" class="upload-item-image" alt="Preview">
      <div class="form-group">
        <input type="text" placeholder="ชื่อตัวละคร *" value="${item.name}" data-char-field="name" data-char-index="${index}">
      </div>
      <div class="form-group">
        <select data-char-field="gender" data-char-index="${index}">
          <option value="female" ${item.gender === 'female' ? 'selected' : ''}>หญิง</option>
          <option value="male" ${item.gender === 'male' ? 'selected' : ''}>ชาย</option>
        </select>
      </div>
    </div>
  `).join('');

  // Add event listeners
  grid.querySelectorAll('[data-remove-char]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.removeChar);
      pendingCharacterUploads.splice(index, 1);
      renderCharacterUploadPreview();
    });
  });

  grid.querySelectorAll('[data-char-field]').forEach(input => {
    input.addEventListener('input', (e) => {
      const index = parseInt(e.target.dataset.charIndex);
      const field = e.target.dataset.charField;
      pendingCharacterUploads[index][field] = e.target.value;
    });
    input.addEventListener('change', (e) => {
      const index = parseInt(e.target.dataset.charIndex);
      const field = e.target.dataset.charField;
      pendingCharacterUploads[index][field] = e.target.value;
    });
  });
}

/**
 * Clear pending character uploads
 */
function clearPendingCharacterUploads() {
  pendingCharacterUploads = [];
  renderCharacterUploadPreview();
}

/**
 * Save all characters
 */
async function saveAllCharacters() {
  const hasEmptyNames = pendingCharacterUploads.some(c => !c.name.trim());
  if (hasEmptyNames) {
    showToast('กรุณากรอกชื่อตัวละครให้ครบ', 'error');
    return;
  }

  if (pendingCharacterUploads.length === 0) {
    showToast('ไม่มีตัวละครที่จะบันทึก', 'error');
    return;
  }

  const characters = pendingCharacterUploads.map(c => ({
    name: c.name,
    image: c.base64,
    gender: c.gender
  }));

  try {
    await ProductWarehouse.saveCharacters(characters);
    showToast(`บันทึก ${characters.length} ตัวละครสำเร็จ`, 'success');
    clearPendingCharacterUploads();
    await loadCharacters();
    // Close modal after successful save
    const characterUploadModal = document.getElementById('characterUploadModal');
    if (characterUploadModal) characterUploadModal.hidden = true;
  } catch (error) {
    console.error('Error saving characters:', error);
    showToast('เกิดข้อผิดพลาดในการบันทึก', 'error');
  }
}

/**
 * Load and render characters
 */
async function loadCharacters() {
  const characters = await ProductWarehouse.getCharacters();
  renderCharacters(characters);
}

/**
 * Render character grid
 */
function renderCharacters(characters) {
  const grid = document.getElementById('characterGrid');

  if (characters.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" id="characterEmptyState">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
        <p>ยังไม่มีตัวละคร</p>
        <p class="empty-hint">เพิ่มภาพคนเพื่อใช้กับ AI Generator</p>
      </div>
    `;
    return;
  }

  // Sort by createdAt desc
  characters.sort((a, b) => b.createdAt - a.createdAt);

  const genderMap = { female: 'หญิง', male: 'ชาย' };

  grid.innerHTML = characters.map(c => `
    <div class="character-card" data-id="${c.id}">
      <img src="${c.image}" class="character-card-image" alt="${c.name}">
      <div class="character-card-body">
        <div class="character-card-name" title="${c.name}">${c.name}</div>
        <div class="character-card-info">${genderMap[c.gender] || 'หญิง'}</div>
        <div class="character-card-actions">
          <button class="btn btn-primary btn-sm" data-action="select-char" data-id="${c.id}">เลือก</button>
          <button class="btn btn-secondary btn-sm" data-action="edit-char" data-id="${c.id}">แก้ไข</button>
          <button class="btn btn-secondary btn-sm" data-action="delete-char" data-id="${c.id}" data-name="${c.name}">ลบ</button>
        </div>
      </div>
    </div>
  `).join('');

  // Add event listeners
  grid.querySelectorAll('[data-action="select-char"]').forEach(btn => {
    btn.addEventListener('click', () => selectCharacter(btn.dataset.id));
  });

  grid.querySelectorAll('[data-action="edit-char"]').forEach(btn => {
    btn.addEventListener('click', () => editCharacter(btn.dataset.id));
  });

  grid.querySelectorAll('[data-action="delete-char"]').forEach(btn => {
    btn.addEventListener('click', () => confirmDeleteCharacter(btn.dataset.id, btn.dataset.name));
  });
}

/**
 * Select character
 */
async function selectCharacter(id) {
  await ProductWarehouse.selectCharacter(id);
  showToast('เลือกตัวละครแล้ว กรุณากลับไปที่ Sidebar', 'success');
}

/**
 * Setup character modals
 */
function setupCharacterModals() {
  document.getElementById('closeCharacterEditModal').addEventListener('click', closeCharacterEditModal);
  document.getElementById('cancelCharacterEditBtn').addEventListener('click', closeCharacterEditModal);
  document.getElementById('saveCharacterEditBtn').addEventListener('click', saveCharacterEdit);

  // Close on overlay click
  document.getElementById('characterEditModal').addEventListener('click', (e) => {
    if (e.target.id === 'characterEditModal') {
      closeCharacterEditModal();
    }
  });
}

/**
 * Edit character
 */
async function editCharacter(id) {
  const character = await ProductWarehouse.getCharacterById(id);
  if (!character) return;

  editingCharacterId = id;

  document.getElementById('editCharacterImage').src = character.image;
  document.getElementById('editCharacterName').value = character.name;
  document.getElementById('editCharacterGender').value = character.gender || 'female';

  document.getElementById('characterEditModal').hidden = false;
}

function closeCharacterEditModal() {
  document.getElementById('characterEditModal').hidden = true;
  editingCharacterId = null;
}

async function saveCharacterEdit() {
  if (!editingCharacterId) return;

  const name = document.getElementById('editCharacterName').value.trim();
  if (!name) {
    showToast('กรุณากรอกชื่อตัวละคร', 'error');
    return;
  }

  const data = {
    name,
    gender: document.getElementById('editCharacterGender').value
  };

  try {
    await ProductWarehouse.updateCharacter(editingCharacterId, data);
    showToast('แก้ไขตัวละครสำเร็จ', 'success');
    closeCharacterEditModal();
    await loadCharacters();
  } catch (error) {
    console.error('Error updating character:', error);
    showToast('เกิดข้อผิดพลาด', 'error');
  }
}

/**
 * Confirm delete character
 */
function confirmDeleteCharacter(id, name) {
  deletingId = id;
  deleteType = 'character';
  document.getElementById('deleteMessage').textContent = `คุณต้องการลบตัวละคร "${name}" หรือไม่?`;
  document.getElementById('deleteModal').hidden = false;
}

/**
 * Setup Import/Export functionality
 */
function setupImportExport() {
  const importBtn = document.getElementById('importBtn');
  const exportBtn = document.getElementById('exportBtn');
  const importFileInput = document.getElementById('importFileInput');
  const generateAllBtn = document.getElementById('generateAllBtn');
  const fixImagesBtn = document.getElementById('fixImagesBtn');

  // Export button click
  exportBtn.addEventListener('click', exportWarehouse);

  // Import button click - trigger file input
  importBtn.addEventListener('click', () => importFileInput.click());

  // File selected for import
  importFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      await importWarehouse(file);
      importFileInput.value = ''; // Reset input
    }
  });

  // Generate all details button - open modal
  generateAllBtn.addEventListener('click', openGenerateDetailsModal);

  // Fix images button - convert URLs to base64
  fixImagesBtn.addEventListener('click', fixImageUrls);

  // Delete all products button
  const deleteAllBtn = document.getElementById('deleteAllProductsBtn');
  if (deleteAllBtn) {
    deleteAllBtn.addEventListener('click', deleteAllProducts);
  }
}

/**
 * Fix image URLs - convert to base64
 */
async function fixImageUrls() {
  const fixBtn = document.getElementById('fixImagesBtn');

  try {
    // Disable button and show loading
    fixBtn.disabled = true;
    fixBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
        <path d="M3 3v5h5"/>
      </svg>
      กำลังแก้ไข...
    `;

    // Get all products
    const products = await ProductWarehouse.getAll();

    // Find products with URL images (not base64)
    const productsWithUrls = products.filter(p =>
      p.productImage &&
      p.productImage.startsWith('http') &&
      !p.productImage.startsWith('data:')
    );

    if (productsWithUrls.length === 0) {
      showToast('ไม่พบภาพที่เป็น URL ทุกภาพเป็น Base64 แล้ว', 'info');
      resetFixButton();
      return;
    }

    showToast(`พบ ${productsWithUrls.length} ภาพที่ต้องแก้ไข กำลังดาวน์โหลด...`, 'info');

    let fixedCount = 0;
    let errorCount = 0;

    for (const product of productsWithUrls) {
      try {
        // Fetch image and convert to base64
        const response = await fetch(product.productImage);
        const blob = await response.blob();
        const base64 = await blobToBase64(blob);

        // Update product with base64 image
        await ProductWarehouse.update(product.id, {
          productImage: base64
        });

        fixedCount++;
        console.log(`Fixed image for: ${product.name}`);
      } catch (error) {
        console.error(`Error fixing image for ${product.name}:`, error);
        errorCount++;
      }
    }

    // Reload products
    await loadProducts();
    await updateStats();

    if (errorCount > 0) {
      showToast(`แก้ไขสำเร็จ ${fixedCount} รายการ, ล้มเหลว ${errorCount} รายการ`, 'warning');
    } else {
      showToast(`แก้ไขภาพสำเร็จ ${fixedCount} รายการ`, 'success');
    }

  } catch (error) {
    console.error('Fix images error:', error);
    showToast('เกิดข้อผิดพลาด: ' + error.message, 'error');
  } finally {
    resetFixButton();
  }
}

/**
 * Reset fix button to default state
 */
function resetFixButton() {
  const fixBtn = document.getElementById('fixImagesBtn');
  if (fixBtn) {
    fixBtn.disabled = false;
    fixBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
        <path d="M3 3v5h5"/>
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
        <path d="M16 21h5v-5"/>
      </svg>
      แก้ไขภาพ
    `;
  }
}

/**
 * Convert blob to base64
 */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Export warehouse data as JSON file
 */
async function exportWarehouse() {
  try {
    const products = await ProductWarehouse.getAll();
    const categories = await ProductWarehouse.getCategories();

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      categories,
      products
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Create download link
    const a = document.createElement('a');
    a.href = url;
    a.download = `flow-warehouse-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`ส่งออก ${products.length} สินค้า, ${categories.length} หมวดหมู่ สำเร็จ`, 'success');
  } catch (error) {
    console.error('Export error:', error);
    showToast('เกิดข้อผิดพลาดในการส่งออก', 'error');
  }
}

/**
 * Import warehouse data from JSON file
 */
async function importWarehouse(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // Validate data structure
    if (!data.categories || !data.products) {
      showToast('รูปแบบไฟล์ไม่ถูกต้อง', 'error');
      return;
    }

    // Get existing data
    const existingCategories = await ProductWarehouse.getCategories();
    const existingProducts = await ProductWarehouse.getAll();

    // Create category ID mapping (old ID -> new ID)
    const categoryIdMap = {};

    // Import categories (skip duplicates by name)
    for (const cat of data.categories) {
      const existing = existingCategories.find(c => c.name === cat.name);
      if (existing) {
        categoryIdMap[cat.id] = existing.id;
      } else {
        const newCat = await ProductWarehouse.addCategory(cat.name);
        categoryIdMap[cat.id] = newCat.id;
      }
    }

    // Prepare products with updated category IDs
    const productsToImport = data.products.map(p => ({
      name: p.name,
      productId: p.productId || '',
      productImage: p.productImage,
      mainHeading: p.mainHeading || '',
      subHeading: p.subHeading || '',
      cartName: p.cartName || '',
      categoryId: p.categoryId ? (categoryIdMap[p.categoryId] || null) : null
    }));

    // Import products
    if (productsToImport.length > 0) {
      await ProductWarehouse.saveMultiple(productsToImport);
    }

    // Reload UI
    await loadCategories();
    await loadProducts();
    await updateStats();

    showToast(`นำเข้า ${productsToImport.length} สินค้าสำเร็จ`, 'success');
  } catch (error) {
    console.error('Import error:', error);
    if (error instanceof SyntaxError) {
      showToast('ไฟล์ JSON ไม่ถูกต้อง', 'error');
    } else {
      showToast('เกิดข้อผิดพลาดในการนำเข้า', 'error');
    }
  }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// =====================
// AI Generate Details
// =====================

let isGeneratingDetails = false;

/**
 * Generate product details using AI
 */
async function generateDetailsAI() {
  if (isGeneratingDetails) return;

  const productName = document.getElementById('editProductName').value.trim();
  if (!productName) {
    showToast('กรุณากรอกชื่อสินค้าก่อน', 'error');
    return;
  }

  // Get API settings
  const settings = await getAISettings();
  if (!settings.apiKey) {
    showToast('กรุณาตั้งค่า API Key ก่อน (ที่หน้า AI Generator)', 'error');
    return;
  }

  isGeneratingDetails = true;
  const btn = document.getElementById('generateDetailsBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin">⟳</span> กำลังสร้าง...';

  try {
    const result = await callAIForHeadings(settings, productName);

    // Fill form with spin format
    document.getElementById('editMainHeading').value = result.mainHeadings.join('|');
    document.getElementById('editSubHeading').value = result.subHeadings.join('|');

    showToast('สร้างรายละเอียดสำเร็จ', 'success');
  } catch (error) {
    console.error('Error generating details:', error);
    showToast(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
  } finally {
    isGeneratingDetails = false;
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
      สร้างรายละเอียด AI
    `;
  }
}

/**
 * Generate details for products
 * @param {boolean} unprocessedOnly - Only process products without details
 */
async function generateAllDetails(unprocessedOnly = true) {
  if (isGeneratingDetails) return;

  // Get API settings
  const settings = await getAISettings();
  if (!settings.apiKey) {
    showToast('กรุณาตั้งค่า API Key ก่อน (ที่หน้า AI Generator)', 'error');
    return;
  }

  // Get all products
  const products = await ProductWarehouse.getAll();

  // Filter products based on mode
  let productsToGenerate;
  if (unprocessedOnly) {
    productsToGenerate = products.filter(p => !p.mainHeading && !p.subHeading);
  } else {
    productsToGenerate = products;
  }

  if (productsToGenerate.length === 0) {
    showToast('ไม่มีสินค้าที่ต้องสร้างรายละเอียด', 'info');
    return;
  }

  isGeneratingDetails = true;

  // Disable modal buttons
  const generateAllBtn = document.getElementById('generateAllDetailsBtn');
  const generateUnprocessedBtn = document.getElementById('generateUnprocessedDetailsBtn');
  if (generateAllBtn) generateAllBtn.disabled = true;
  if (generateUnprocessedBtn) generateUnprocessedBtn.disabled = true;

  // Show and update progress
  const progressContainer = document.getElementById('generateDetailsProgress');
  const progressFill = document.getElementById('generateDetailsProgressFill');
  const progressText = document.getElementById('generateDetailsProgressText');

  if (progressContainer) progressContainer.hidden = false;

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < productsToGenerate.length; i++) {
    const product = productsToGenerate[i];
    const progress = ((i + 1) / productsToGenerate.length) * 100;

    // Update progress UI
    if (progressFill) progressFill.style.width = `${progress}%`;
    if (progressText) progressText.textContent = `กำลังดำเนินการ ${i + 1}/${productsToGenerate.length}...`;

    try {
      const result = await callAIForHeadings(settings, product.name);

      // Update product
      await ProductWarehouse.update(product.id, {
        mainHeading: result.mainHeadings.join('|'),
        subHeading: result.subHeadings.join('|')
      });

      successCount++;

      // Delay to avoid rate limit
      if (i < productsToGenerate.length - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    } catch (error) {
      console.error(`Error generating for ${product.name}:`, error);
      errorCount++;
    }
  }

  isGeneratingDetails = false;

  // Re-enable buttons
  if (generateAllBtn) generateAllBtn.disabled = false;
  if (generateUnprocessedBtn) generateUnprocessedBtn.disabled = false;

  // Update progress text to show completion
  if (progressText) {
    progressText.textContent = `เสร็จสิ้น: สำเร็จ ${successCount} / ล้มเหลว ${errorCount}`;
  }

  // Reload products to show updated data
  await loadProducts();

  // Close modal after a short delay
  setTimeout(() => {
    closeGenerateDetailsModal();
  }, 1500);

  if (errorCount === 0) {
    showToast(`สร้างรายละเอียดสำเร็จ ${successCount} สินค้า`, 'success');
  } else {
    showToast(`สำเร็จ ${successCount} / ล้มเหลว ${errorCount}`, 'warning');
  }
}

/**
 * Get AI settings from storage
 */
function getAISettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['geminiApiKey', 'openaiApiKey', 'selectedModel'], (result) => {
      const model = result.selectedModel || 'gemini';
      const apiKey = model === 'gemini' ? result.geminiApiKey : result.openaiApiKey;
      resolve({ model, apiKey });
    });
  });
}

/**
 * Call AI to generate headings
 */
async function callAIForHeadings(settings, productName) {
  const systemPrompt = `คุณเป็นผู้เชี่ยวชาญในการคิดหัวข้อโฆษณาแนว UGC (User Generated Content) สำหรับภาพปกคลิป

กฎในการคิดหัวข้อ:
- ใช้ภาษาพูดที่เป็นกันเอง ไม่ทางการ เหมือนคนจริงๆ รีวิว
- ใช้คำที่สะดุดตา ดึงดูดความสนใจ
- เน้นอารมณ์และความรู้สึก
- หัวข้อหลักควรสั้น กระชับ 3-8 คำ
- หัวข้อย่อยเสริมรายละเอียดหรือ call to action

ข้อห้าม (สำคัญมาก):
- ห้ามใช้คำการันตี เช่น "100%", "การันตี", "รับประกัน", "ชัวร์"
- ห้ามโฆษณาเกินจริง
- ห้ามใช้คำว่า "รักษา", "หาย", "หายขาด", "cure"

ตอบในรูปแบบ JSON เท่านั้น:
{"mainHeadings":["หัวข้อ1","หัวข้อ2","หัวข้อ3","หัวข้อ4","หัวข้อ5"],"subHeadings":["หัวข้อย่อย1","หัวข้อย่อย2","หัวข้อย่อย3","หัวข้อย่อย4","หัวข้อย่อย5"]}`;

  const userMessage = `สร้างหัวข้อหลัก 5 แบบ และหัวข้อย่อย 5 แบบ สำหรับสินค้า: ${productName}`;

  let response;
  if (settings.model === 'gemini') {
    response = await callGeminiAPI(settings.apiKey, systemPrompt, userMessage);
  } else {
    response = await callOpenAIAPI(settings.apiKey, systemPrompt, userMessage);
  }

  // Parse JSON response
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  throw new Error('ไม่สามารถแปลงผลลัพธ์ได้');
}

/**
 * Call Gemini API
 */
async function callGeminiAPI(apiKey, systemPrompt, userMessage) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userMessage }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 512 }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Gemini API error');
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Call OpenAI API
 */
async function callOpenAIAPI(apiKey, systemPrompt, userMessage) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.9,
      max_tokens: 512
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'OpenAI API error');
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

// =====================
// Video Management
// =====================

/**
 * Setup drag & drop zones on product card images
 */
function setupProductImageDropZones(grid) {
  grid.querySelectorAll('.product-card-image-wrapper').forEach(wrapper => {
    const productId = wrapper.dataset.productId;

    wrapper.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      wrapper.classList.add('dragover');
    });

    wrapper.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      wrapper.classList.remove('dragover');
    });

    wrapper.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      wrapper.classList.remove('dragover');

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        await handleVideoDropOnProduct(productId, files);
      }
    });
  });
}

/**
 * Handle video files dropped directly on product thumbnail
 */
async function handleVideoDropOnProduct(productId, files) {
  const videoFiles = Array.from(files).filter(f => f.type.startsWith('video/'));

  if (videoFiles.length === 0) {
    showToast('กรุณาลากไฟล์วิดีโอ', 'error');
    return;
  }

  // Check for duplicates
  const fileNames = videoFiles.map(f => f.name);
  const { duplicates, newFiles } = await ProductWarehouse.checkVideoDuplicates(productId, fileNames);

  let filesToSave = videoFiles.filter(f => newFiles.includes(f.name));

  // If duplicates found, show modal
  if (duplicates.length > 0) {
    const userChoice = await showDuplicateModal('video', duplicates, newFiles);

    if (userChoice.action === 'skip') {
      // Keep only non-duplicates (filesToSave is already set correctly)
      // Plus any unchecked duplicates
      const checkboxes = document.querySelectorAll('#duplicateList input[type="checkbox"]');
      checkboxes.forEach((cb, index) => {
        if (!cb.checked && duplicates[index]) {
          const fileName = duplicates[index].fileName;
          const file = videoFiles.find(f => f.name === fileName);
          if (file) filesToSave.push(file);
        }
      });
    } else if (userChoice.action === 'import-all') {
      filesToSave = videoFiles;
    } else {
      // Cancelled
      return;
    }
  }

  if (filesToSave.length === 0) {
    showToast('ไม่มีวิดีโอใหม่ที่จะบันทึก (ข้ามวิดีโอซ้ำ)', 'info');
    return;
  }

  showToast(`กำลังบันทึก ${filesToSave.length} วิดีโอ...`, 'info');

  for (const file of filesToSave) {
    try {
      // Generate thumbnail and get duration
      const { thumbnail, duration } = await VideoStorage.generateThumbnail(file);

      // Save metadata to ProductWarehouse
      const videoMeta = await ProductWarehouse.saveVideo({
        productId: productId,
        fileName: file.name,
        fileSize: file.size,
        duration: duration,
        thumbnail: thumbnail
      });

      // Save actual file to IndexedDB
      await VideoStorage.save(videoMeta.id, file);

    } catch (error) {
      console.error('Error saving video:', error);
      showToast(`ไม่สามารถบันทึก ${file.name}`, 'error');
    }
  }

  showToast(`บันทึก ${filesToSave.length} วิดีโอสำเร็จ`, 'success');

  // Refresh
  await loadVideoProductCounts();
  await loadProducts(); // Update product cards with video count
  await updateVideoStats();
}

/**
 * Load video counts for all products (for badge display)
 */
async function loadVideoProductCounts() {
  const videos = await ProductWarehouse.getVideos();
  videoProductCounts = {};

  videos.forEach(v => {
    if (!videoProductCounts[v.productId]) {
      videoProductCounts[v.productId] = { total: 0, pending: 0, uploaded: 0 };
    }
    videoProductCounts[v.productId].total++;
    if (v.status === 'pending') {
      videoProductCounts[v.productId].pending++;
    } else {
      videoProductCounts[v.productId].uploaded++;
    }
  });
}

/**
 * Setup video modal
 */
function setupVideoModal() {
  const modal = document.getElementById('videoModal');
  const dropZone = document.getElementById('videoDropZone');
  const fileInput = document.getElementById('videoFileInput');
  const closeBtn = document.getElementById('closeVideoModal');
  const closeFooterBtn = document.getElementById('closeVideoModalBtn');

  // Close modal
  closeBtn.addEventListener('click', closeVideoModal);
  closeFooterBtn.addEventListener('click', closeVideoModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeVideoModal();
  });

  // Video drop zone
  dropZone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    handleVideoFiles(e.target.files);
    fileInput.value = '';
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleVideoFiles(e.dataTransfer.files);
  });

  // Filter tabs
  document.querySelectorAll('.video-filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentVideoFilter = tab.dataset.filter;
      document.querySelectorAll('.video-filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderVideoList();
    });
  });
}

/**
 * Open video modal for a product
 */
async function openVideoModal(productId) {
  const product = await ProductWarehouse.getById(productId);
  if (!product) return;

  currentVideoProductId = productId;
  currentVideoFilter = 'all';

  document.getElementById('videoModalProductName').textContent = product.name;
  document.querySelectorAll('.video-filter-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.filter === 'all');
  });

  document.getElementById('videoModal').hidden = false;
  await renderVideoList();
}

/**
 * Close video modal
 */
function closeVideoModal() {
  document.getElementById('videoModal').hidden = true;
  currentVideoProductId = null;
}

/**
 * Handle video file uploads
 */
async function handleVideoFiles(files) {
  if (!currentVideoProductId) return;

  const videoFiles = Array.from(files).filter(f => f.type.startsWith('video/'));

  if (videoFiles.length === 0) {
    showToast('กรุณาเลือกไฟล์วิดีโอ', 'error');
    return;
  }

  // Check for duplicates
  const fileNames = videoFiles.map(f => f.name);
  const { duplicates, newFiles } = await ProductWarehouse.checkVideoDuplicates(currentVideoProductId, fileNames);

  let filesToSave = videoFiles.filter(f => newFiles.includes(f.name));

  // If duplicates found, show modal
  if (duplicates.length > 0) {
    const userChoice = await showDuplicateModal('video', duplicates, newFiles);

    if (userChoice.action === 'skip') {
      // Keep only non-duplicates
      const checkboxes = document.querySelectorAll('#duplicateList input[type="checkbox"]');
      checkboxes.forEach((cb, index) => {
        if (!cb.checked && duplicates[index]) {
          const fileName = duplicates[index].fileName;
          const file = videoFiles.find(f => f.name === fileName);
          if (file) filesToSave.push(file);
        }
      });
    } else if (userChoice.action === 'import-all') {
      filesToSave = videoFiles;
    } else {
      // Cancelled
      return;
    }
  }

  if (filesToSave.length === 0) {
    showToast('ไม่มีวิดีโอใหม่ที่จะบันทึก (ข้ามวิดีโอซ้ำ)', 'info');
    return;
  }

  showToast(`กำลังประมวลผล ${filesToSave.length} วิดีโอ...`, 'info');

  for (const file of filesToSave) {
    try {
      // Generate thumbnail and get duration
      const { thumbnail, duration } = await VideoStorage.generateThumbnail(file);

      // Save metadata to ProductWarehouse
      const videoMeta = await ProductWarehouse.saveVideo({
        productId: currentVideoProductId,
        fileName: file.name,
        fileSize: file.size,
        duration: duration,
        thumbnail: thumbnail
      });

      // Save actual file to IndexedDB
      await VideoStorage.save(videoMeta.id, file);

    } catch (error) {
      console.error('Error saving video:', error);
      showToast(`ไม่สามารถบันทึก ${file.name}`, 'error');
    }
  }

  showToast(`บันทึก ${filesToSave.length} วิดีโอสำเร็จ`, 'success');

  // Refresh
  await loadVideoProductCounts();
  await renderVideoList();
  await loadProducts(); // Update product cards with video count
}

/**
 * Render video list in modal
 */
async function renderVideoList() {
  if (!currentVideoProductId) return;

  const listContainer = document.getElementById('videoList');
  let videos = await ProductWarehouse.getVideosByProduct(currentVideoProductId);

  // Apply filter
  if (currentVideoFilter !== 'all') {
    videos = videos.filter(v => v.status === currentVideoFilter);
  }

  // Sort by createdAt desc
  videos.sort((a, b) => b.createdAt - a.createdAt);

  if (videos.length === 0) {
    listContainer.innerHTML = `
      <div class="video-empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <polygon points="23 7 16 12 23 17 23 7"></polygon>
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
        </svg>
        <p>${currentVideoFilter === 'all' ? 'ยังไม่มีวิดีโอ' : currentVideoFilter === 'pending' ? 'ไม่มีวิดีโอที่รอ Upload' : 'ไม่มีวิดีโอที่ Upload แล้ว'}</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = videos.map(v => `
    <div class="video-item" data-id="${v.id}">
      ${v.thumbnail
        ? `<img src="${v.thumbnail}" class="video-thumbnail" alt="Thumbnail">`
        : `<div class="video-thumbnail-placeholder">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="23 7 16 12 23 17 23 7"></polygon>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
          </div>`
      }
      <div class="video-info">
        <div class="video-name" title="${v.fileName}">${v.fileName}</div>
        <div class="video-meta">
          <span>${VideoStorage.formatSize(v.fileSize)}</span>
          <span>${VideoStorage.formatDuration(v.duration)}</span>
        </div>
      </div>
      <span class="video-status ${v.status}">
        ${v.status === 'pending' ? 'รอ Upload' : 'Upload แล้ว'}
      </span>
      <div class="video-actions">
        ${v.status === 'uploaded' ? `
          <button class="btn btn-secondary btn-sm" data-action="reset-status" data-id="${v.id}" title="รีเซ็ตสถานะ">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 4 23 10 17 10"></polyline>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
          </button>
        ` : ''}
        <button class="btn btn-danger btn-sm" data-action="delete-video" data-id="${v.id}" title="ลบ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  `).join('');

  // Add event listeners
  listContainer.querySelectorAll('[data-action="delete-video"]').forEach(btn => {
    btn.addEventListener('click', () => deleteVideo(btn.dataset.id));
  });

  listContainer.querySelectorAll('[data-action="reset-status"]').forEach(btn => {
    btn.addEventListener('click', () => resetVideoStatus(btn.dataset.id));
  });
}

/**
 * Delete video
 */
async function deleteVideo(videoId) {
  if (!confirm('ต้องการลบวิดีโอนี้หรือไม่?')) return;

  try {
    await ProductWarehouse.deleteVideo(videoId);
    showToast('ลบวิดีโอสำเร็จ', 'success');

    await loadVideoProductCounts();
    await renderVideoList();
    await loadProducts();
  } catch (error) {
    console.error('Error deleting video:', error);
    showToast('เกิดข้อผิดพลาดในการลบ', 'error');
  }
}

/**
 * Reset video status to pending
 */
async function resetVideoStatus(videoId) {
  try {
    await ProductWarehouse.updateVideoStatus(videoId, 'pending');
    showToast('รีเซ็ตสถานะสำเร็จ', 'success');

    await loadVideoProductCounts();
    await renderVideoList();
    await loadProducts();
  } catch (error) {
    console.error('Error resetting status:', error);
    showToast('เกิดข้อผิดพลาด', 'error');
  }
}

/**
 * Get video badge HTML for product card
 */
function getVideoBadgeHTML(productId) {
  const counts = videoProductCounts[productId];

  if (!counts || counts.total === 0) {
    return `
      <div class="product-card-video-badge empty" data-action="open-video" data-id="${productId}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="23 7 16 12 23 17 23 7"></polygon>
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
        </svg>
        0 วิดีโอ
      </div>
    `;
  }

  return `
    <div class="product-card-video-badge" data-action="open-video" data-id="${productId}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="23 7 16 12 23 17 23 7"></polygon>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
      </svg>
      ${counts.total} วิดีโอ (${counts.pending} รอ)
    </div>
  `;
}

// =====================
// Storage Management
// =====================

/**
 * Setup storage management
 */
function setupStorageManagement() {
  const clearOldDataBtn = document.getElementById('clearOldDataBtn');
  if (clearOldDataBtn) {
    clearOldDataBtn.addEventListener('click', clearOldData);
  }

  const clearUploadedVideosBtn = document.getElementById('clearUploadedVideosBtn');
  if (clearUploadedVideosBtn) {
    clearUploadedVideosBtn.addEventListener('click', clearUploadedVideos);
  }
}

/**
 * Update storage usage display
 */
async function updateStorageUsage() {
  try {
    const usage = await ProductWarehouse.getStorageUsage();

    // Update info text
    const storageInfo = document.getElementById('storageInfo');
    if (storageInfo) {
      storageInfo.textContent = `${usage.mbUsed} MB / ${ProductWarehouse.SOFT_LIMIT_MB} MB`;
    }

    // Update bar fill
    const storageBarFill = document.getElementById('storageBarFill');
    if (storageBarFill) {
      const percent = parseFloat(usage.percentUsed);
      storageBarFill.style.width = `${percent}%`;

      // Update color based on usage
      storageBarFill.classList.remove('warning', 'danger');
      if (percent >= 80) {
        storageBarFill.classList.add('danger');
      } else if (percent >= 50) {
        storageBarFill.classList.add('warning');
      }
    }

    // Update percent text
    const storagePercent = document.getElementById('storagePercent');
    if (storagePercent) {
      const percent = parseFloat(usage.percentUsed);
      storagePercent.textContent = `${usage.percentUsed}%`;

      storagePercent.classList.remove('warning', 'danger');
      if (percent >= 80) {
        storagePercent.classList.add('danger');
      } else if (percent >= 50) {
        storagePercent.classList.add('warning');
      }
    }
  } catch (error) {
    console.error('Error updating storage usage:', error);
  }
}

/**
 * Clear old data to free up storage
 */
async function clearOldData() {
  const products = await ProductWarehouse.getAll();

  if (products.length === 0) {
    showToast('ไม่มีสินค้าให้ลบ', 'info');
    return;
  }

  // Calculate how many to delete (show in confirm)
  const countToDelete = Math.min(5, products.length);

  if (!confirm(`ต้องการลบสินค้าที่เก่าที่สุด ${countToDelete} รายการหรือไม่?\n\nข้อมูลที่ลบจะไม่สามารถกู้คืนได้`)) {
    return;
  }

  try {
    const deleted = await ProductWarehouse.deleteOldestProducts(countToDelete);
    showToast(`ลบสินค้าเก่า ${deleted.length} รายการสำเร็จ`, 'success');

    // Refresh UI
    await loadProducts();
    await updateStats();
    await updateStorageUsage();
  } catch (error) {
    console.error('Error clearing old data:', error);
    showToast('เกิดข้อผิดพลาดในการลบข้อมูล', 'error');
  }
}

/**
 * Clear all uploaded videos
 */
async function clearUploadedVideos() {
  // Get count first
  const videos = await ProductWarehouse.getVideos();
  const uploadedCount = videos.filter(v => v.status === 'uploaded').length;

  if (uploadedCount === 0) {
    showToast('ไม่มีวิดีโอที่โพสแล้วให้ลบ', 'info');
    return;
  }

  if (!confirm(`ต้องการลบวิดีโอที่โพสแล้ว ${uploadedCount} รายการหรือไม่?\n\nข้อมูลที่ลบจะไม่สามารถกู้คืนได้`)) {
    return;
  }

  try {
    const result = await ProductWarehouse.deleteUploadedVideos();
    showToast(`ลบวิดีโอที่โพสแล้ว ${result.deletedCount} รายการสำเร็จ`, 'success');

    // Refresh UI
    await loadVideoProductCounts();
    await loadProducts();
    await updateVideoStats();
    await updateStorageUsage();
  } catch (error) {
    console.error('Error clearing uploaded videos:', error);
    showToast('เกิดข้อผิดพลาดในการลบวิดีโอ', 'error');
  }
}

// =====================
// Clean Product Names
// =====================

let isCleaningNames = false;

/**
 * Setup clean names modal
 */
function setupCleanNamesModal() {
  const cleanNamesBtn = document.getElementById('cleanNamesBtn');
  const closeBtn = document.getElementById('closeCleanNamesModal');
  const cancelBtn = document.getElementById('cancelCleanNamesBtn');
  const cleanAllBtn = document.getElementById('cleanAllNamesBtn');
  const cleanUnprocessedBtn = document.getElementById('cleanUnprocessedNamesBtn');

  if (cleanNamesBtn) {
    cleanNamesBtn.addEventListener('click', openCleanNamesModal);
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeCleanNamesModal);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeCleanNamesModal);
  }

  if (cleanAllBtn) {
    cleanAllBtn.addEventListener('click', () => cleanProductNames(false));
  }

  if (cleanUnprocessedBtn) {
    cleanUnprocessedBtn.addEventListener('click', () => cleanProductNames(true));
  }

  // Close on overlay click
  const modal = document.getElementById('cleanNamesModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeCleanNamesModal();
      }
    });
  }
}

/**
 * Open clean names modal
 */
async function openCleanNamesModal() {
  const products = await ProductWarehouse.getAll();
  const unprocessed = products.filter(p => !p.nameCleanedAt);

  document.getElementById('cleanAllCount').textContent = products.length;
  document.getElementById('cleanUnprocessedCount').textContent = unprocessed.length;

  // Reset progress
  document.getElementById('cleanNamesProgress').hidden = true;
  document.getElementById('cleanNamesProgressFill').style.width = '0%';

  // Enable buttons
  document.getElementById('cleanAllNamesBtn').disabled = false;
  document.getElementById('cleanUnprocessedNamesBtn').disabled = unprocessed.length === 0;

  document.getElementById('cleanNamesModal').hidden = false;
}

/**
 * Close clean names modal
 */
function closeCleanNamesModal() {
  if (!isCleaningNames) {
    document.getElementById('cleanNamesModal').hidden = true;
  }
}

// =====================
// Generate Details Modal
// =====================

/**
 * Setup generate details modal
 */
function setupGenerateDetailsModal() {
  const closeBtn = document.getElementById('closeGenerateDetailsModal');
  const cancelBtn = document.getElementById('cancelGenerateDetailsBtn');
  const generateAllBtn = document.getElementById('generateAllDetailsBtn');
  const generateUnprocessedBtn = document.getElementById('generateUnprocessedDetailsBtn');

  if (closeBtn) {
    closeBtn.addEventListener('click', closeGenerateDetailsModal);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeGenerateDetailsModal);
  }

  if (generateAllBtn) {
    generateAllBtn.addEventListener('click', () => generateAllDetails(false));
  }

  if (generateUnprocessedBtn) {
    generateUnprocessedBtn.addEventListener('click', () => generateAllDetails(true));
  }

  // Close on overlay click
  const modal = document.getElementById('generateDetailsModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeGenerateDetailsModal();
      }
    });
  }
}

/**
 * Open generate details modal
 */
async function openGenerateDetailsModal() {
  const products = await ProductWarehouse.getAll();
  const unprocessed = products.filter(p => !p.mainHeading && !p.subHeading);

  document.getElementById('generateAllCount').textContent = products.length;
  document.getElementById('generateUnprocessedCount').textContent = unprocessed.length;

  // Reset progress
  document.getElementById('generateDetailsProgress').hidden = true;
  document.getElementById('generateDetailsProgressFill').style.width = '0%';

  // Enable buttons
  document.getElementById('generateAllDetailsBtn').disabled = products.length === 0;
  document.getElementById('generateUnprocessedDetailsBtn').disabled = unprocessed.length === 0;

  document.getElementById('generateDetailsModal').hidden = false;
}

/**
 * Close generate details modal
 */
function closeGenerateDetailsModal() {
  if (!isGeneratingDetails) {
    document.getElementById('generateDetailsModal').hidden = true;
  }
}

/**
 * Clean product names using AI
 * @param {boolean} unprocessedOnly - Only process products without nameCleanedAt
 */
async function cleanProductNames(unprocessedOnly = false) {
  if (isCleaningNames) return;

  // Get API settings
  const settings = await getAISettings();
  if (!settings.apiKey) {
    showToast('กรุณาตั้งค่า API Key ก่อน (ที่หน้า AI Generator)', 'error');
    return;
  }

  const products = await ProductWarehouse.getAll();
  let productsToClean = unprocessedOnly
    ? products.filter(p => !p.nameCleanedAt)
    : products;

  if (productsToClean.length === 0) {
    showToast('ไม่มีสินค้าที่ต้องปรับชื่อ', 'info');
    return;
  }

  isCleaningNames = true;

  // Disable buttons
  document.getElementById('cleanAllNamesBtn').disabled = true;
  document.getElementById('cleanUnprocessedNamesBtn').disabled = true;

  // Show progress
  const progressContainer = document.getElementById('cleanNamesProgress');
  const progressFill = document.getElementById('cleanNamesProgressFill');
  const progressText = document.getElementById('cleanNamesProgressText');
  progressContainer.hidden = false;

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < productsToClean.length; i++) {
    const product = productsToClean[i];
    const percent = Math.round(((i + 1) / productsToClean.length) * 100);

    progressFill.style.width = `${percent}%`;
    progressText.textContent = `กำลังดำเนินการ ${i + 1}/${productsToClean.length}...`;

    try {
      const cleanedName = await cleanSingleProductName(settings, product.name);

      if (cleanedName && cleanedName !== product.name) {
        // Save original name and update with cleaned name
        await ProductWarehouse.update(product.id, {
          name: cleanedName,
          originalName: product.originalName || product.name, // Keep first original
          nameCleanedAt: Date.now()
        });
        successCount++;
      } else {
        // Mark as processed even if no change
        await ProductWarehouse.update(product.id, {
          nameCleanedAt: Date.now()
        });
      }

      // Delay to avoid rate limit
      if (i < productsToClean.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (error) {
      console.error(`Error cleaning name for ${product.name}:`, error);
      errorCount++;
    }
  }

  isCleaningNames = false;

  // Update UI
  progressText.textContent = `เสร็จสิ้น! แก้ไข ${successCount} รายการ`;

  // Reload products
  await loadProducts();

  // Re-enable close
  document.getElementById('cleanAllNamesBtn').disabled = false;
  document.getElementById('cleanUnprocessedNamesBtn').disabled = false;

  if (errorCount === 0) {
    showToast(`ปรับชื่อสินค้าสำเร็จ ${successCount} รายการ`, 'success');
  } else {
    showToast(`สำเร็จ ${successCount} / ล้มเหลว ${errorCount}`, 'warning');
  }
}

/**
 * Clean a single product name using AI
 */
async function cleanSingleProductName(settings, productName) {
  const systemPrompt = `คุณเป็นผู้เชี่ยวชาญในการปรับชื่อสินค้าให้กระชับ

หน้าที่: รับชื่อสินค้าที่ยาวและมีข้อมูลซ้ำซ้อน แล้วปรับให้สั้นกระชับ เหลือแค่ชื่อสินค้าหลัก

สิ่งที่ต้องเอาออก:
- คำโปรโมชั่น เช่น [AFFILIATE], ลดราคา, โปรพิเศษ, ขายดี, แนะนำ
- เลขรุ่น, ขนาด, จำนวน เช่น 2 กระปุก, size M, 100ml (ยกเว้นถ้าจำเป็นต่อการเข้าใจสินค้า)
- คำซ้ำซ้อน เช่น เต็นท์แคมปิ้ง เต้นท์แค้มป์ปิ้ง เต็นท์สนาม (เลือกแค่คำเดียว)
- คำอธิบายยาวๆ ที่ไม่จำเป็น
- แบรนด์ที่ซ้ำหลายครั้ง
- keywords สำหรับ SEO

ตัวอย่าง:
- "[AFFILIATE] เครื่องหอม จงเจริญ JONGJAROEN [EMBRYO size] จำนวน 2 กระปุก" → "เครื่องหอม จงเจริญ"
- "SIKA เต้นท์แคมปิ้ง 4×6คน เต้นท์แคมป์ปิ้ง้ 3คน เต็นท์สนาม เต้นท์แคปปิ้ง..." → "เต็นท์แคมปิ้ง SIKA"
- "ครีมบำรุงผิวหน้า ABC ลดริ้วรอย กระชับรูขุมขน ขนาด 50g แพ็ค 2" → "ครีมบำรุงผิวหน้า ABC"

กฎสำคัญ:
- ตอบเฉพาะชื่อสินค้าที่ปรับแล้วเท่านั้น ไม่ต้องอธิบาย
- ถ้าชื่อสั้นอยู่แล้ว ให้ตอบชื่อเดิม
- เก็บแบรนด์ไว้ถ้าสำคัญ
- ความยาวไม่ควรเกิน 50 ตัวอักษร`;

  const userMessage = `ปรับชื่อสินค้านี้ให้กระชับ: "${productName}"`;

  let response;
  if (settings.model === 'gemini') {
    response = await callGeminiAPI(settings.apiKey, systemPrompt, userMessage);
  } else {
    response = await callOpenAIAPI(settings.apiKey, systemPrompt, userMessage);
  }

  // Clean up response (remove quotes, trim)
  let cleanedName = response.trim();
  cleanedName = cleanedName.replace(/^["']|["']$/g, ''); // Remove surrounding quotes
  cleanedName = cleanedName.replace(/\n/g, ' ').trim(); // Remove newlines

  return cleanedName;
}

// =====================
// Duplicate Detection
// =====================

/**
 * Setup duplicate modal
 */
function setupDuplicateModal() {
  const closeBtn = document.getElementById('closeDuplicateModal');
  const skipBtn = document.getElementById('skipDuplicatesBtn');
  const importAllBtn = document.getElementById('importAllDuplicatesBtn');
  const selectAllCheckbox = document.getElementById('duplicateSelectAll');

  if (closeBtn) {
    closeBtn.addEventListener('click', closeDuplicateModal);
  }

  if (skipBtn) {
    skipBtn.addEventListener('click', () => handleDuplicateAction('skip'));
  }

  if (importAllBtn) {
    importAllBtn.addEventListener('click', () => handleDuplicateAction('import-all'));
  }

  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
      const checkboxes = document.querySelectorAll('#duplicateList input[type="checkbox"]');
      checkboxes.forEach(cb => cb.checked = e.target.checked);
    });
  }

  // Close on overlay click
  const modal = document.getElementById('duplicateModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeDuplicateModal();
      }
    });
  }
}

/**
 * Show duplicate modal and wait for user decision
 * @param {string} type - 'product' or 'video'
 * @param {Array} duplicates - Array of duplicate items
 * @param {Array} newItems - Array of new (non-duplicate) items
 * @returns {Promise<Object>} User's choice: { action: 'skip'|'import-all'|'cancel', includeDuplicates: [] }
 */
function showDuplicateModal(type, duplicates, newItems) {
  return new Promise((resolve) => {
    duplicateModalData = {
      type,
      duplicates,
      newItems,
      resolveCallback: resolve
    };

    // Update message
    const typeText = type === 'product' ? 'สินค้า' : 'วิดีโอ';
    document.getElementById('duplicateMessage').textContent =
      `พบ${typeText}ที่มีอยู่แล้ว ${duplicates.length} รายการ:`;

    // Render duplicate list
    renderDuplicateList(type, duplicates);

    // Reset select all
    document.getElementById('duplicateSelectAll').checked = true;

    // Show modal
    document.getElementById('duplicateModal').hidden = false;
  });
}

/**
 * Render duplicate items in the list
 */
function renderDuplicateList(type, duplicates) {
  const listContainer = document.getElementById('duplicateList');

  listContainer.innerHTML = duplicates.map((dup, index) => {
    const item = type === 'product' ? dup.pending : dup;
    const existing = type === 'product' ? dup.existing : dup.existing;

    // Format date
    const createdAt = existing.createdAt
      ? formatRelativeDate(existing.createdAt)
      : 'ไม่ทราบวันที่';

    // Get image or placeholder
    const imageUrl = type === 'product'
      ? (item.productImage || existing.productImage || '')
      : (existing.thumbnail || '');

    const itemName = type === 'product' ? item.name : dup.fileName;

    return `
      <div class="duplicate-item" data-index="${index}">
        <input type="checkbox" checked data-dup-index="${index}">
        ${imageUrl
          ? `<img src="${imageUrl}" class="duplicate-item-image" alt="Thumbnail">`
          : `<div class="duplicate-item-image" style="display:flex;align-items:center;justify-content:center;background:#f5f5f5;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
            </div>`
        }
        <div class="duplicate-item-info">
          <div class="duplicate-item-name" title="${itemName}">${itemName}</div>
          <div class="duplicate-item-date">เพิ่มเมื่อ ${createdAt}</div>
        </div>
        <span class="duplicate-item-type ${type === 'video' ? 'video' : ''}">
          ${type === 'product' ? 'สินค้าซ้ำ' : 'วิดีโอซ้ำ'}
        </span>
      </div>
    `;
  }).join('');

  // Update select all when individual checkbox changes
  listContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', updateSelectAllState);
  });
}

/**
 * Update select all checkbox state
 */
function updateSelectAllState() {
  const checkboxes = document.querySelectorAll('#duplicateList input[type="checkbox"]');
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  document.getElementById('duplicateSelectAll').checked = allChecked;
}

/**
 * Handle duplicate modal action
 */
function handleDuplicateAction(action) {
  if (!duplicateModalData.resolveCallback) return;

  let result = { action, includeDuplicates: [] };

  if (action === 'skip') {
    // Get unchecked duplicates (these will be included in save)
    const checkboxes = document.querySelectorAll('#duplicateList input[type="checkbox"]');
    checkboxes.forEach((cb, index) => {
      if (!cb.checked && duplicateModalData.duplicates[index]) {
        // Include the pending item (not the existing one)
        const dup = duplicateModalData.duplicates[index];
        if (duplicateModalData.type === 'product') {
          result.includeDuplicates.push(dup.pending);
        }
      }
    });
  }

  closeDuplicateModal();
  duplicateModalData.resolveCallback(result);
}

/**
 * Close duplicate modal
 */
function closeDuplicateModal() {
  document.getElementById('duplicateModal').hidden = true;

  // If modal closed without action, treat as cancel
  if (duplicateModalData.resolveCallback) {
    duplicateModalData.resolveCallback({ action: 'cancel', includeDuplicates: [] });
    duplicateModalData.resolveCallback = null;
  }
}

/**
 * Format relative date
 */
function formatRelativeDate(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const weeks = Math.floor(diff / 604800000);
  const months = Math.floor(diff / 2592000000);

  if (minutes < 1) return 'เมื่อกี้';
  if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  if (days < 7) return `${days} วันที่แล้ว`;
  if (weeks < 4) return `${weeks} สัปดาห์ที่แล้ว`;
  return `${months} เดือนที่แล้ว`;
}

// =====================
// Delete All Products
// =====================

/**
 * Delete all products from warehouse
 */
async function deleteAllProducts() {
  const products = await ProductWarehouse.getAll();

  if (products.length === 0) {
    showToast('ไม่มีสินค้าให้ลบ', 'info');
    return;
  }

  // Double confirmation for safety
  const firstConfirm = confirm(`⚠️ คุณต้องการลบสินค้าทั้งหมด ${products.length} รายการหรือไม่?\n\nข้อมูลที่ลบจะไม่สามารถกู้คืนได้!`);
  if (!firstConfirm) return;

  const secondConfirm = confirm(`⚠️ ยืนยันอีกครั้ง!\n\nกด OK เพื่อลบสินค้าทั้งหมด ${products.length} รายการ`);
  if (!secondConfirm) return;

  try {
    // Delete all products one by one
    for (const product of products) {
      await ProductWarehouse.delete(product.id);
    }

    showToast(`ลบสินค้าทั้งหมด ${products.length} รายการสำเร็จ`, 'success');

    // Refresh UI
    await loadProducts();
    await updateStats();
    await updateStorageUsage();
  } catch (error) {
    console.error('Error deleting all products:', error);
    showToast('เกิดข้อผิดพลาดในการลบข้อมูล', 'error');
  }
}
