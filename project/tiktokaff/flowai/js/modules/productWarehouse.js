/**
 * Product Warehouse Module
 * Handles product storage with categories
 */
const ProductWarehouse = {
  // With unlimitedStorage permission, limit is much higher
  // For display purposes, we'll use a soft limit of 100MB
  SOFT_LIMIT_MB: 100,

  /**
   * Get current storage usage
   */
  async getStorageUsage() {
    return new Promise((resolve) => {
      chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
        const softLimitBytes = this.SOFT_LIMIT_MB * 1024 * 1024;
        resolve({
          bytesUsed: bytesInUse,
          bytesTotal: softLimitBytes,
          mbUsed: (bytesInUse / (1024 * 1024)).toFixed(2),
          percentUsed: Math.min(100, ((bytesInUse / softLimitBytes) * 100)).toFixed(1),
          isUnlimited: true
        });
      });
    });
  },

  /**
   * Check if storage has enough space
   * With unlimitedStorage, this is mainly for soft warnings
   */
  async hasSpace(additionalBytes = 0) {
    const usage = await this.getStorageUsage();
    const requiredBytes = usage.bytesUsed + additionalBytes;
    // With unlimitedStorage, we have much more room
    return requiredBytes < (this.SOFT_LIMIT_MB * 1024 * 1024);
  },

  /**
   * Delete oldest products to free up space
   */
  async deleteOldestProducts(count = 5) {
    const products = await this.getAll();
    if (products.length === 0) return [];

    // Sort by createdAt (oldest first)
    products.sort((a, b) => a.createdAt - b.createdAt);

    // Get the oldest products
    const toDelete = products.slice(0, count);
    const remaining = products.slice(count);

    await this.safeSet({ productPresets: remaining });
    return toDelete;
  },

  /**
   * Safe storage set with error handling
   */
  async safeSet(data) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message || 'Unknown error';
          if (errorMsg.includes('QUOTA_BYTES') || errorMsg.includes('quota')) {
            reject(new Error('STORAGE_FULL'));
          } else {
            reject(new Error(errorMsg));
          }
        } else {
          resolve();
        }
      });
    });
  },
  /**
   * Get all categories
   */
  async getCategories() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['productCategories'], (result) => {
        resolve(result.productCategories || []);
      });
    });
  },

  /**
   * Add new category
   */
  async addCategory(name) {
    const categories = await this.getCategories();
    const newCategory = {
      id: `cat-${Date.now()}`,
      name: name.trim()
    };
    categories.push(newCategory);
    await chrome.storage.local.set({ productCategories: categories });
    return newCategory;
  },

  /**
   * Update category
   */
  async updateCategory(id, name) {
    const categories = await this.getCategories();
    const index = categories.findIndex(c => c.id === id);
    if (index !== -1) {
      categories[index].name = name.trim();
      await chrome.storage.local.set({ productCategories: categories });
    }
    return categories;
  },

  /**
   * Delete category
   */
  async deleteCategory(id) {
    const categories = await this.getCategories();
    const filtered = categories.filter(c => c.id !== id);
    await chrome.storage.local.set({ productCategories: filtered });

    // Update products with this category to null
    const products = await this.getAll();
    const updatedProducts = products.map(p => {
      if (p.categoryId === id) {
        return { ...p, categoryId: null };
      }
      return p;
    });
    await chrome.storage.local.set({ productPresets: updatedProducts });

    return filtered;
  },

  /**
   * Get all products
   */
  async getAll() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['productPresets'], (result) => {
        resolve(result.productPresets || []);
      });
    });
  },

  /**
   * Get products by category
   */
  async getByCategory(categoryId) {
    const products = await this.getAll();
    if (!categoryId) return products;
    return products.filter(p => p.categoryId === categoryId);
  },

  /**
   * Get single product by ID
   */
  async getById(id) {
    const products = await this.getAll();
    return products.find(p => p.id === id) || null;
  },

  /**
   * Save multiple products at once
   */
  async saveMultiple(newProducts) {
    const existing = await this.getAll();
    const timestamp = Date.now();

    const productsToAdd = newProducts.map((p, index) => ({
      id: `preset-${timestamp}-${index}`,
      name: p.name.trim(),
      productId: p.productId ? p.productId.trim() : '',
      productImage: p.productImage,
      mainHeading: p.mainHeading ? p.mainHeading.trim() : '',
      subHeading: p.subHeading ? p.subHeading.trim() : '',
      cartName: p.cartName ? p.cartName.trim() : '',
      categoryId: p.categoryId || null,
      createdAt: timestamp + index
    }));

    const updated = [...existing, ...productsToAdd];

    try {
      await this.safeSet({ productPresets: updated });
    } catch (error) {
      if (error.message === 'STORAGE_FULL') {
        const usage = await this.getStorageUsage();
        throw new Error(`พื้นที่เก็บข้อมูลเต็ม (ใช้ไป ${usage.mbUsed}MB / 10MB)\nกรุณาลบสินค้าเก่าก่อนเพิ่มใหม่`);
      }
      throw error;
    }
    return productsToAdd;
  },

  /**
   * Update single product
   */
  async update(id, data) {
    const products = await this.getAll();
    const index = products.findIndex(p => p.id === id);
    if (index !== -1) {
      products[index] = {
        ...products[index],
        name: data.name ? data.name.trim() : products[index].name,
        productId: data.productId !== undefined ? data.productId.trim() : products[index].productId,
        productImage: data.productImage || products[index].productImage,
        mainHeading: data.mainHeading !== undefined ? data.mainHeading.trim() : products[index].mainHeading,
        subHeading: data.subHeading !== undefined ? data.subHeading.trim() : products[index].subHeading,
        cartName: data.cartName !== undefined ? data.cartName.trim() : (products[index].cartName || ''),
        categoryId: data.categoryId !== undefined ? data.categoryId : products[index].categoryId
      };
      await chrome.storage.local.set({ productPresets: products });
    }
    return products[index];
  },

  /**
   * Delete product
   */
  async delete(id) {
    const products = await this.getAll();
    const filtered = products.filter(p => p.id !== id);
    await chrome.storage.local.set({ productPresets: filtered });

    // Clear selectedPresetId if this product was selected
    const { selectedPresetId } = await chrome.storage.local.get(['selectedPresetId']);
    if (selectedPresetId === id) {
      await chrome.storage.local.remove(['selectedPresetId']);
    }

    return filtered;
  },

  /**
   * Get statistics
   */
  async getStats() {
    const products = await this.getAll();
    const categories = await this.getCategories();

    const stats = {
      total: products.length,
      byCategory: {}
    };

    // Count products by category
    categories.forEach(cat => {
      stats.byCategory[cat.id] = {
        name: cat.name,
        count: products.filter(p => p.categoryId === cat.id).length
      };
    });

    // Count uncategorized
    const uncategorized = products.filter(p => !p.categoryId).length;
    if (uncategorized > 0) {
      stats.byCategory['uncategorized'] = {
        name: 'ไม่มีหมวดหมู่',
        count: uncategorized
      };
    }

    return stats;
  },

  /**
   * Select product for use in sidebar
   */
  async selectProduct(id) {
    await chrome.storage.local.set({
      selectedPresetId: id,
      productMode: 'warehouse'
    });
    return this.getById(id);
  },

  /**
   * Get current product mode
   */
  async getMode() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['productMode'], (result) => {
        resolve(result.productMode || 'manual');
      });
    });
  },

  /**
   * Set product mode
   */
  async setMode(mode) {
    await chrome.storage.local.set({ productMode: mode });
  },

  /**
   * Get selected preset ID
   */
  async getSelectedPresetId() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['selectedPresetId'], (result) => {
        resolve(result.selectedPresetId || null);
      });
    });
  },

  /**
   * Get selected product data
   */
  async getSelectedProduct() {
    const id = await this.getSelectedPresetId();
    if (!id) return null;
    return this.getById(id);
  },

  // =====================
  // Character Management
  // =====================

  /**
   * Get all characters
   */
  async getCharacters() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['warehouseCharacters'], (result) => {
        resolve(result.warehouseCharacters || []);
      });
    });
  },

  /**
   * Get character by ID
   */
  async getCharacterById(id) {
    const characters = await this.getCharacters();
    return characters.find(c => c.id === id) || null;
  },

  /**
   * Save multiple characters at once
   */
  async saveCharacters(newCharacters) {
    const existing = await this.getCharacters();
    const timestamp = Date.now();

    const charactersToAdd = newCharacters.map((c, index) => ({
      id: `char-${timestamp}-${index}`,
      name: c.name.trim(),
      image: c.image,
      gender: c.gender || 'female',
      ageRange: c.ageRange || 'random',
      createdAt: timestamp + index
    }));

    const updated = [...existing, ...charactersToAdd];
    await chrome.storage.local.set({ warehouseCharacters: updated });
    return charactersToAdd;
  },

  /**
   * Update character
   */
  async updateCharacter(id, data) {
    const characters = await this.getCharacters();
    const index = characters.findIndex(c => c.id === id);
    if (index !== -1) {
      characters[index] = {
        ...characters[index],
        name: data.name ? data.name.trim() : characters[index].name,
        image: data.image || characters[index].image,
        gender: data.gender || characters[index].gender,
        ageRange: data.ageRange || characters[index].ageRange
      };
      await chrome.storage.local.set({ warehouseCharacters: characters });
    }
    return characters[index];
  },

  /**
   * Delete character
   */
  async deleteCharacter(id) {
    const characters = await this.getCharacters();
    const filtered = characters.filter(c => c.id !== id);
    await chrome.storage.local.set({ warehouseCharacters: filtered });

    // Clear selectedCharacterId if this was selected
    const { selectedCharacterId } = await chrome.storage.local.get(['selectedCharacterId']);
    if (selectedCharacterId === id) {
      await chrome.storage.local.remove(['selectedCharacterId']);
    }

    return filtered;
  },

  /**
   * Select character for use
   */
  async selectCharacter(id) {
    await chrome.storage.local.set({ selectedCharacterId: id });
    return this.getCharacterById(id);
  },

  /**
   * Get selected character ID
   */
  async getSelectedCharacterId() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['selectedCharacterId'], (result) => {
        resolve(result.selectedCharacterId || null);
      });
    });
  },

  /**
   * Get selected character data
   */
  async getSelectedCharacter() {
    const id = await this.getSelectedCharacterId();
    if (!id) return null;
    return this.getCharacterById(id);
  },

  // =====================
  // Video Management
  // =====================

  /**
   * Get all videos
   */
  async getVideos() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['warehouseVideos'], (result) => {
        resolve(result.warehouseVideos || []);
      });
    });
  },

  /**
   * Get videos by product ID
   */
  async getVideosByProduct(productId) {
    const videos = await this.getVideos();
    return videos.filter(v => v.productId === productId);
  },

  /**
   * Get video by ID
   */
  async getVideoById(id) {
    const videos = await this.getVideos();
    return videos.find(v => v.id === id) || null;
  },

  /**
   * Get pending videos (not uploaded yet)
   */
  async getPendingVideos() {
    const videos = await this.getVideos();
    return videos.filter(v => v.status === 'pending');
  },

  /**
   * Get pending videos by product
   */
  async getPendingVideosByProduct(productId) {
    const videos = await this.getVideosByProduct(productId);
    return videos.filter(v => v.status === 'pending');
  },

  /**
   * Save video metadata
   * Note: Actual video file is stored in IndexedDB via VideoStorage
   */
  async saveVideo(videoData) {
    const videos = await this.getVideos();
    const timestamp = Date.now();

    const newVideo = {
      id: `video-${timestamp}`,
      productId: videoData.productId,
      fileName: videoData.fileName,
      fileSize: videoData.fileSize || 0,
      duration: videoData.duration || 0,
      thumbnail: videoData.thumbnail || null,
      status: 'pending', // pending, uploaded
      uploadedAt: null,
      createdAt: timestamp
    };

    videos.push(newVideo);
    await chrome.storage.local.set({ warehouseVideos: videos });
    return newVideo;
  },

  /**
   * Save multiple videos
   */
  async saveVideos(videosData) {
    const existing = await this.getVideos();
    const timestamp = Date.now();

    const newVideos = videosData.map((v, index) => ({
      id: `video-${timestamp}-${index}`,
      productId: v.productId,
      fileName: v.fileName,
      fileSize: v.fileSize || 0,
      duration: v.duration || 0,
      thumbnail: v.thumbnail || null,
      status: 'pending',
      uploadedAt: null,
      createdAt: timestamp + index
    }));

    const updated = [...existing, ...newVideos];
    await chrome.storage.local.set({ warehouseVideos: updated });
    return newVideos;
  },

  /**
   * Update video status
   */
  async updateVideoStatus(id, status) {
    const videos = await this.getVideos();
    const index = videos.findIndex(v => v.id === id);
    if (index !== -1) {
      videos[index].status = status;
      if (status === 'uploaded') {
        videos[index].uploadedAt = Date.now();
      }
      await chrome.storage.local.set({ warehouseVideos: videos });
    }
    return videos[index];
  },

  /**
   * Delete video
   */
  async deleteVideo(id) {
    const videos = await this.getVideos();
    const filtered = videos.filter(v => v.id !== id);
    await chrome.storage.local.set({ warehouseVideos: filtered });

    // Also delete from IndexedDB
    if (typeof VideoStorage !== 'undefined') {
      await VideoStorage.delete(id);
    }

    return filtered;
  },

  /**
   * Delete all videos for a product
   */
  async deleteVideosByProduct(productId) {
    const videos = await this.getVideos();
    const toDelete = videos.filter(v => v.productId === productId);
    const filtered = videos.filter(v => v.productId !== productId);
    await chrome.storage.local.set({ warehouseVideos: filtered });

    // Also delete from IndexedDB
    if (typeof VideoStorage !== 'undefined') {
      for (const video of toDelete) {
        await VideoStorage.delete(video.id);
      }
    }

    return filtered;
  },

  /**
   * Get video count by product
   */
  async getVideoCountByProduct(productId) {
    const videos = await this.getVideosByProduct(productId);
    return {
      total: videos.length,
      pending: videos.filter(v => v.status === 'pending').length,
      uploaded: videos.filter(v => v.status === 'uploaded').length
    };
  },

  // =====================
  // Duplicate Detection
  // =====================

  /**
   * Find product by name (case-insensitive)
   * @param {string} name - Product name to search
   * @returns {Object|null} Existing product or null
   */
  async findByName(name) {
    const products = await this.getAll();
    const normalized = name.trim().toLowerCase();
    return products.find(p => p.name.trim().toLowerCase() === normalized) || null;
  },

  /**
   * Find video by fileName in a specific product
   * @param {string} productId - Product ID
   * @param {string} fileName - Video file name
   * @returns {Object|null} Existing video or null
   */
  async findVideoByFileName(productId, fileName) {
    const videos = await this.getVideosByProduct(productId);
    const normalized = fileName.trim().toLowerCase();
    return videos.find(v => v.fileName.trim().toLowerCase() === normalized) || null;
  },

  /**
   * Check multiple products for duplicates
   * @param {Array} products - Array of product objects with name
   * @returns {Object} { duplicates: [], newProducts: [] }
   */
  async checkProductDuplicates(products) {
    const existingProducts = await this.getAll();
    const existingNames = new Set(
      existingProducts.map(p => p.name.trim().toLowerCase())
    );

    const duplicates = [];
    const newProducts = [];

    for (const product of products) {
      const normalized = product.name.trim().toLowerCase();
      const existing = existingProducts.find(p => p.name.trim().toLowerCase() === normalized);

      if (existing) {
        duplicates.push({
          pending: product,
          existing: existing
        });
      } else {
        newProducts.push(product);
      }
    }

    return { duplicates, newProducts };
  },

  /**
   * Check multiple videos for duplicates within a product
   * @param {string} productId - Product ID
   * @param {Array} fileNames - Array of file names
   * @returns {Object} { duplicates: [], newFiles: [] }
   */
  async checkVideoDuplicates(productId, fileNames) {
    const existingVideos = await this.getVideosByProduct(productId);
    const existingNames = new Set(
      existingVideos.map(v => v.fileName.trim().toLowerCase())
    );

    const duplicates = [];
    const newFiles = [];

    for (const fileName of fileNames) {
      const normalized = fileName.trim().toLowerCase();
      const existing = existingVideos.find(v => v.fileName.trim().toLowerCase() === normalized);

      if (existing) {
        duplicates.push({
          fileName: fileName,
          existing: existing
        });
      } else {
        newFiles.push(fileName);
      }
    }

    return { duplicates, newFiles };
  },

  /**
   * Delete all uploaded videos (status = 'uploaded')
   * @returns {Object} { deletedCount: number }
   */
  async deleteUploadedVideos() {
    const videos = await this.getVideos();
    const uploadedVideos = videos.filter(v => v.status === 'uploaded');
    const remainingVideos = videos.filter(v => v.status !== 'uploaded');

    // Delete from IndexedDB
    if (typeof VideoStorage !== 'undefined') {
      for (const video of uploadedVideos) {
        await VideoStorage.delete(video.id);
      }
    }

    // Save remaining videos
    await chrome.storage.local.set({ warehouseVideos: remainingVideos });

    return { deletedCount: uploadedVideos.length };
  }
};
