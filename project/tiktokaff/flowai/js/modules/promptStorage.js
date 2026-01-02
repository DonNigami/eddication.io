/**
 * Prompt Storage Module
 * IndexedDB wrapper สำหรับเก็บ Prompt Templates
 */

const PromptStorage = {
  DB_NAME: 'FlowAIPromptDB',
  DB_VERSION: 1,
  STORE_NAME: 'prompts',
  CATEGORY_KEY: 'promptCategories',
  db: null,

  /**
   * Initialize IndexedDB
   */
  async init() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('categoryId', 'categoryId', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });
  },

  /**
   * Save prompt to IndexedDB
   */
  async save(prompt) {
    await this.init();
    const data = {
      ...prompt,
      id: prompt.id || `prompt-${Date.now()}`,
      createdAt: prompt.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.put(data);

      request.onsuccess = () => resolve(data);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get prompt by ID
   */
  async get(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get all prompts
   */
  async getAll() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const results = request.result || [];
        results.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get prompts by type (image/video)
   */
  async getByType(type) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('type');
      const request = index.getAll(type);

      request.onsuccess = () => {
        const results = request.result || [];
        results.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get prompts by category ID
   */
  async getByCategory(categoryId) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const index = store.index('categoryId');
      const request = index.getAll(categoryId);

      request.onsuccess = () => {
        const results = request.result || [];
        results.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Get prompts by type AND category
   */
  async getByTypeAndCategory(type, categoryId) {
    const allByType = await this.getByType(type);
    return allByType.filter(p => p.categoryId === categoryId);
  },

  /**
   * Get prompts by type EXCLUDING AI Story category (for AI Review)
   */
  async getByTypeExcludeAIStory(type) {
    const allByType = await this.getByType(type);
    return allByType.filter(p => p.categoryId !== this.AI_STORY_CATEGORY_ID);
  },

  /**
   * Delete prompt by ID
   */
  async delete(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Delete all prompts
   */
  async deleteAll() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Check if prompt exists
   */
  async exists(id) {
    const prompt = await this.get(id);
    return !!prompt;
  },

  /**
   * Count prompts
   */
  async count() {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  // ==================== Categories ====================

  /**
   * Get categories from Chrome Storage
   */
  async getCategories() {
    return new Promise((resolve) => {
      chrome.storage.local.get([this.CATEGORY_KEY], (result) => {
        resolve(result[this.CATEGORY_KEY] || []);
      });
    });
  },

  /**
   * Save categories to Chrome Storage
   */
  async saveCategories(categories) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [this.CATEGORY_KEY]: categories }, () => {
        resolve(categories);
      });
    });
  },

  /**
   * Add category
   */
  async addCategory(name) {
    const categories = await this.getCategories();
    const newCategory = {
      id: `pcat-${Date.now()}`,
      name: name.trim()
    };
    categories.push(newCategory);
    await this.saveCategories(categories);
    return newCategory;
  },

  /**
   * Delete category
   */
  async deleteCategory(categoryId) {
    const categories = await this.getCategories();
    const filtered = categories.filter(c => c.id !== categoryId);
    await this.saveCategories(filtered);
    return true;
  },

  // ==================== Import/Export ====================

  /**
   * Export all prompts as JSON
   */
  async exportAll() {
    const prompts = await this.getAll();
    const categories = await this.getCategories();
    return {
      version: '2.1',
      exportedAt: Date.now(),
      categories,
      prompts
    };
  },

  /**
   * Import prompts from JSON
   */
  async importAll(data, overwrite = false) {
    if (overwrite) {
      await this.deleteAll();
    }

    // Import categories
    if (data.categories && data.categories.length > 0) {
      const existingCategories = await this.getCategories();
      const merged = [...existingCategories];
      for (const cat of data.categories) {
        if (!merged.find(c => c.id === cat.id)) {
          merged.push(cat);
        }
      }
      await this.saveCategories(merged);
    }

    // Import prompts
    let importedCount = 0;
    for (const prompt of data.prompts || []) {
      const exists = await this.exists(prompt.id);
      if (!exists || overwrite) {
        await this.save(prompt);
        importedCount++;
      }
    }

    return importedCount;
  },

  /**
   * Import default templates (built-in)
   * Accepts both object (BUILT_IN_TEMPLATES) and array formats
   */
  async importDefaults(imageTemplates, videoTemplates) {
    const categories = [
      { id: 'pcat-ugc', name: 'UGC' },
      { id: 'pcat-professional', name: 'Professional' },
      { id: 'pcat-other', name: 'อื่นๆ' }
    ];

    // Save categories
    await this.saveCategories(categories);

    let count = 0;

    // Convert to array if object
    const imageArray = Array.isArray(imageTemplates)
      ? imageTemplates
      : Object.values(imageTemplates || {});

    const videoArray = Array.isArray(videoTemplates)
      ? videoTemplates
      : Object.values(videoTemplates || {});

    // Import image templates
    for (const template of imageArray) {
      if (template.isRandom) continue; // Skip random templates

      const exists = await this.exists(template.id);
      if (!exists) {
        // Use getThumbnail() to encode SVG on-demand
        const thumbnail = this.getThumbnail(template.id);

        await this.save({
          id: template.id,
          name: template.name,
          description: template.description || '',
          type: 'image',
          categoryId: template.id.startsWith('ugc') ? 'pcat-ugc' :
                      template.id.startsWith('professional') ? 'pcat-professional' : 'pcat-other',
          thumbnail: thumbnail,
          systemPrompt: template.systemPrompt || '',
          userMessageTemplate: template.userMessageTemplate || '',
          isBuiltIn: true,
          settings: template.settings || {},
          createdAt: Date.now()
        });
        count++;
      }
    }

    // Import video templates
    for (const template of videoArray) {
      if (template.isRandom) continue;

      const exists = await this.exists(template.id);
      if (!exists) {
        // Use getThumbnail() to encode SVG on-demand
        const thumbnail = this.getThumbnail(template.id);

        await this.save({
          id: template.id,
          name: template.name,
          description: template.description || '',
          type: 'video',
          categoryId: template.id.includes('ugc') ? 'pcat-ugc' :
                      template.id.includes('professional') ? 'pcat-professional' : 'pcat-other',
          thumbnail: thumbnail,
          systemPrompt: template.systemPrompt || '',
          userMessageTemplate: template.userMessageTemplate || '',
          isBuiltIn: true,
          settings: template.settings || {},
          createdAt: Date.now()
        });
        count++;
      }
    }

    return count;
  },

  // ==================== Utilities ====================

  /**
   * Search prompts by name
   */
  async search(query) {
    const all = await this.getAll();
    const lowerQuery = query.toLowerCase();
    return all.filter(p =>
      p.name.toLowerCase().includes(lowerQuery) ||
      (p.description && p.description.toLowerCase().includes(lowerQuery))
    );
  },

  /**
   * Get prompts filtered by type and category
   */
  async getFiltered(type = null, categoryId = null) {
    let prompts = await this.getAll();

    if (type) {
      prompts = prompts.filter(p => p.type === type);
    }

    if (categoryId) {
      prompts = prompts.filter(p => p.categoryId === categoryId);
    }

    return prompts;
  },

  /**
   * Migrate old relative thumbnail paths to chrome.runtime.getURL format
   * Call this once to fix existing data
   */
  async migrateThumbnailPaths() {
    const prompts = await this.getAll();
    let migratedCount = 0;

    for (const prompt of prompts) {
      // Check if thumbnail uses old relative path format
      if (prompt.thumbnail && prompt.thumbnail.startsWith('../images/')) {
        // Convert ../images/prompt-thumbnails/xxx.svg to chrome.runtime.getURL format
        const relativePath = prompt.thumbnail.replace('../', '');
        const absolutePath = chrome.runtime.getURL(relativePath);

        prompt.thumbnail = absolutePath;
        await this.save(prompt);
        migratedCount++;
      }
    }

    return migratedCount;
  },

  /**
   * Reset all built-in prompts (delete and re-import)
   * Useful when thumbnails need to be updated
   */
  async resetBuiltInPrompts() {
    const prompts = await this.getAll();

    // Delete only built-in prompts
    for (const prompt of prompts) {
      if (prompt.isBuiltIn) {
        await this.delete(prompt.id);
      }
    }

    return true;
  },

  /**
   * Migrate custom templates from Chrome Storage to IndexedDB
   * This migrates legacy custom templates to the new Prompt Warehouse
   * Key: flowPromptTemplates (จาก promptTemplateSelector.js)
   */
  async migrateCustomTemplates() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['flowPromptTemplates'], async (data) => {
        const customTemplates = data.flowPromptTemplates?.custom || {};
        const customList = Object.values(customTemplates);

        if (customList.length === 0) {
          resolve({ migrated: 0, skipped: 0 });
          return;
        }

        let migrated = 0;
        let skipped = 0;

        for (const template of customList) {
          // Check if already exists in IndexedDB
          const existing = await this.get(template.id);
          if (existing) {
            skipped++;
            continue;
          }

          // Create new prompt in IndexedDB
          const newPrompt = {
            id: template.id,
            name: template.name || 'Custom Template',
            description: template.description || '',
            type: 'image',
            categoryId: '',
            thumbnail: template.thumbnail || '',
            systemPrompt: template.systemPrompt || '',
            userMessageTemplate: template.userMessageTemplate || '',
            isBuiltIn: false,
            createdAt: template.createdAt || Date.now(),
            updatedAt: Date.now()
          };

          await this.save(newPrompt);
          migrated++;
        }

        resolve({ migrated, skipped });
      });
    });
  },

  // ==================== Inline SVG Thumbnails for Built-in Templates ====================

  /**
   * Get thumbnail data URI for a template ID
   * Encodes SVG on-demand to support Thai text
   */
  getThumbnail(templateId) {
    const svg = this.RAW_SVG_THUMBNAILS[templateId];
    if (!svg) return '';
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  },

  /**
   * Raw SVG strings for built-in templates (no encoding)
   * Will be encoded on-demand by getThumbnail()
   */
  RAW_SVG_THUMBNAILS: {
    // ===== UGC Templates =====
    'ugc-review': `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="ugcBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#10b981"/><stop offset="100%" style="stop-color:#059669"/></linearGradient></defs><rect width="200" height="200" fill="url(#ugcBg)"/><circle cx="100" cy="70" r="35" fill="#fff" opacity="0.9"/><path d="M70 130 Q100 145 130 130 L140 170 Q100 185 60 170 Z" fill="#fff" opacity="0.9"/><rect x="120" y="90" width="40" height="55" rx="5" fill="#fbbf24" opacity="0.9"/><path d="M75 130 L80 110 L88 115 L92 95 L100 100" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="85" cy="62" r="5" fill="#333"/><circle cx="115" cy="62" r="5" fill="#333"/><path d="M90 78 Q100 88 110 78" stroke="#333" stroke-width="3" fill="none" stroke-linecap="round"/><text x="100" y="190" text-anchor="middle" font-family="Arial" font-size="14" font-weight="bold" fill="#fff">UGC Cover</text></svg>`,

    'ugc-using': `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="ugcUsingBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#3b82f6"/><stop offset="100%" style="stop-color:#1d4ed8"/></linearGradient></defs><rect width="200" height="200" fill="url(#ugcUsingBg)"/><ellipse cx="80" cy="100" rx="50" ry="60" fill="#fff" opacity="0.2"/><circle cx="80" cy="60" r="30" fill="#fff" opacity="0.9"/><path d="M55 110 Q80 125 105 110 L110 150 Q80 165 50 150 Z" fill="#fff" opacity="0.9"/><rect x="115" y="70" width="50" height="70" rx="8" fill="#fbbf24" opacity="0.9"/><path d="M120 100 L130 100 L130 110 L155 110" stroke="#fff" stroke-width="3" fill="none"/><circle cx="72" cy="55" r="4" fill="#333"/><circle cx="92" cy="55" r="4" fill="#333"/><path d="M75 68 Q82 75 90 68" stroke="#333" stroke-width="2" fill="none"/><text x="100" y="185" text-anchor="middle" font-family="Arial" font-size="12" font-weight="bold" fill="#fff">ใช้จริง</text></svg>`,

    'ugc-feeling': `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="ugcFeelBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#ec4899"/><stop offset="100%" style="stop-color:#be185d"/></linearGradient></defs><rect width="200" height="200" fill="url(#ugcFeelBg)"/><circle cx="100" cy="80" r="45" fill="#fff" opacity="0.9"/><circle cx="85" cy="70" r="6" fill="#333"/><circle cx="115" cy="70" r="6" fill="#333"/><path d="M80 95 Q100 115 120 95" stroke="#333" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="75" cy="85" r="8" fill="#fca5a5" opacity="0.6"/><circle cx="125" cy="85" r="8" fill="#fca5a5" opacity="0.6"/><path d="M100 130 C70 120 50 140 60 170 C70 190 100 185 100 185 C100 185 130 190 140 170 C150 140 130 120 100 130 Z" fill="#fff" opacity="0.8"/><path d="M55 50 L65 60" stroke="#fbbf24" stroke-width="3"/><path d="M145 50 L135 60" stroke="#fbbf24" stroke-width="3"/><path d="M50 80 L60 80" stroke="#fbbf24" stroke-width="3"/><path d="M140 80 L150 80" stroke="#fbbf24" stroke-width="3"/><text x="100" y="190" text-anchor="middle" font-family="Arial" font-size="12" font-weight="bold" fill="#fff">ความรู้สึก</text></svg>`,

    'ugc-compare': `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="ugcCompBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#8b5cf6"/><stop offset="100%" style="stop-color:#6d28d9"/></linearGradient></defs><rect width="200" height="200" fill="url(#ugcCompBg)"/><rect x="20" y="40" width="70" height="100" rx="8" fill="#fff" opacity="0.3"/><rect x="110" y="40" width="70" height="100" rx="8" fill="#fff" opacity="0.9"/><circle cx="55" cy="70" r="18" fill="#fff" opacity="0.5"/><circle cx="145" cy="70" r="18" fill="#fff"/><path d="M48 67 Q55 73 62 67" stroke="#666" stroke-width="2" fill="none"/><path d="M138 67 Q145 77 152 67" stroke="#333" stroke-width="2" fill="none"/><circle cx="50" cy="64" r="3" fill="#666"/><circle cx="60" cy="64" r="3" fill="#666"/><circle cx="140" cy="64" r="3" fill="#333"/><circle cx="150" cy="64" r="3" fill="#333"/><path d="M92 90 L108 90" stroke="#fff" stroke-width="3"/><path d="M103 85 L108 90 L103 95" stroke="#fff" stroke-width="3" fill="none"/><text x="55" y="125" text-anchor="middle" font-family="Arial" font-size="11" fill="#fff" opacity="0.7">ก่อน</text><text x="145" y="125" text-anchor="middle" font-family="Arial" font-size="11" fill="#6d28d9" font-weight="bold">หลัง</text><text x="100" y="175" text-anchor="middle" font-family="Arial" font-size="12" font-weight="bold" fill="#fff">ก่อน-หลัง</text></svg>`,

    'ugc-closeup': `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="ugcCloseBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#f59e0b"/><stop offset="100%" style="stop-color:#d97706"/></linearGradient></defs><rect width="200" height="200" fill="url(#ugcCloseBg)"/><circle cx="100" cy="100" r="60" fill="#fff" opacity="0.15"/><circle cx="100" cy="100" r="45" fill="#fff" opacity="0.25"/><rect x="70" y="75" width="60" height="80" rx="8" fill="#fff" opacity="0.95"/><rect x="78" y="83" width="44" height="25" rx="3" fill="#fbbf24"/><text x="100" y="100" text-anchor="middle" font-family="Arial" font-size="9" fill="#92400e">PRODUCT</text><rect x="78" y="115" width="44" height="4" rx="2" fill="#e5e7eb"/><rect x="78" y="123" width="30" height="4" rx="2" fill="#e5e7eb"/><rect x="78" y="131" width="38" height="4" rx="2" fill="#e5e7eb"/><path d="M45 130 Q60 110 75 120" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round" opacity="0.6"/><path d="M155 130 Q140 110 125 120" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round" opacity="0.6"/><text x="100" y="185" text-anchor="middle" font-family="Arial" font-size="12" font-weight="bold" fill="#fff">ซูมสินค้า</text></svg>`,

    'ugc-recommend': `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="ugcRecBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#14b8a6"/><stop offset="100%" style="stop-color:#0d9488"/></linearGradient></defs><rect width="200" height="200" fill="url(#ugcRecBg)"/><circle cx="100" cy="75" r="35" fill="#fff" opacity="0.9"/><path d="M70 125 Q100 140 130 125 L140 170 Q100 185 60 170 Z" fill="#fff" opacity="0.9"/><circle cx="88" cy="68" r="5" fill="#333"/><circle cx="112" cy="68" r="5" fill="#333"/><path d="M90 85 Q100 95 110 85" stroke="#333" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M145 90 L155 75 L165 90 L155 85 Z" fill="#fbbf24"/><path d="M155 75 L155 55" stroke="#fbbf24" stroke-width="4"/><rect x="40" y="95" width="35" height="45" rx="5" fill="#fbbf24" opacity="0.9"/><circle cx="150" cy="60" r="15" fill="#fff" opacity="0.3"/><path d="M145 60 L150 55 L155 65" stroke="#14b8a6" stroke-width="3" fill="none"/><text x="100" y="190" text-anchor="middle" font-family="Arial" font-size="12" font-weight="bold" fill="#fff">แนะนำ</text></svg>`,

    // ===== Professional Templates =====
    'professional-ad': `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="proBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#1e293b"/><stop offset="100%" style="stop-color:#0f172a"/></linearGradient></defs><rect width="200" height="200" fill="url(#proBg)"/><rect x="30" y="30" width="140" height="120" rx="5" fill="#fff" opacity="0.1"/><ellipse cx="100" cy="90" rx="35" ry="45" fill="#fff" opacity="0.9"/><circle cx="100" cy="65" r="25" fill="#fbbf24" opacity="0.1"/><circle cx="90" cy="80" r="4" fill="#333"/><circle cx="110" cy="80" r="4" fill="#333"/><path d="M92 95 Q100 102 108 95" stroke="#333" stroke-width="2" fill="none"/><rect x="75" y="105" width="50" height="35" rx="3" fill="#fbbf24" opacity="0.8"/><path d="M20 50 L30 90 L20 90" stroke="#fbbf24" stroke-width="2" fill="none" opacity="0.5"/><path d="M180 50 L170 90 L180 90" stroke="#fbbf24" stroke-width="2" fill="none" opacity="0.5"/><circle cx="30" cy="50" r="8" fill="#fbbf24" opacity="0.3"/><circle cx="170" cy="50" r="8" fill="#fbbf24" opacity="0.3"/><text x="100" y="175" text-anchor="middle" font-family="Arial" font-size="11" font-weight="bold" fill="#fbbf24">PROFESSIONAL</text></svg>`,

    'product-only': `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="prodBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#6366f1"/><stop offset="100%" style="stop-color:#4f46e5"/></linearGradient></defs><rect width="200" height="200" fill="url(#prodBg)"/><ellipse cx="100" cy="160" rx="60" ry="15" fill="#000" opacity="0.2"/><rect x="60" y="50" width="80" height="110" rx="10" fill="#fff" opacity="0.95"/><rect x="70" y="60" width="60" height="40" rx="5" fill="#c7d2fe"/><text x="100" y="85" text-anchor="middle" font-family="Arial" font-size="10" fill="#4f46e5">BRAND</text><rect x="70" y="108" width="60" height="6" rx="3" fill="#e0e7ff"/><rect x="70" y="120" width="45" height="6" rx="3" fill="#e0e7ff"/><rect x="70" y="132" width="55" height="6" rx="3" fill="#e0e7ff"/><path d="M50 70 L55 65 L60 70" stroke="#fff" stroke-width="2" fill="none" opacity="0.5"/><path d="M140 70 L145 65 L150 70" stroke="#fff" stroke-width="2" fill="none" opacity="0.5"/><text x="100" y="190" text-anchor="middle" font-family="Arial" font-size="12" font-weight="bold" fill="#fff">Product Only</text></svg>`,

    'lifestyle': `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="lifeBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#84cc16"/><stop offset="100%" style="stop-color:#65a30d"/></linearGradient></defs><rect width="200" height="200" fill="url(#lifeBg)"/><rect x="20" y="60" width="160" height="100" rx="10" fill="#fff" opacity="0.2"/><circle cx="70" cy="100" r="25" fill="#fff" opacity="0.9"/><circle cx="62" cy="95" r="4" fill="#333"/><circle cx="78" cy="95" r="4" fill="#333"/><path d="M65 107 Q70 112 75 107" stroke="#333" stroke-width="2" fill="none"/><path d="M90 85 L100 85 Q115 85 115 100 L115 130" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round" opacity="0.7"/><rect x="125" y="90" width="40" height="50" rx="5" fill="#fbbf24" opacity="0.9"/><path d="M40 45 Q60 35 80 45" stroke="#fff" stroke-width="2" fill="none" opacity="0.5"/><circle cx="60" cy="40" r="8" fill="#fbbf24" opacity="0.5"/><path d="M160 50 L165 45 L170 55" stroke="#fff" stroke-width="2" fill="none" opacity="0.5"/><text x="100" y="185" text-anchor="middle" font-family="Arial" font-size="12" font-weight="bold" fill="#fff">Lifestyle</text></svg>`,

    'social-viral': `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="viralBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#f43f5e"/><stop offset="100%" style="stop-color:#e11d48"/></linearGradient></defs><rect width="200" height="200" fill="url(#viralBg)"/><circle cx="100" cy="85" r="40" fill="#fff" opacity="0.9"/><circle cx="88" cy="78" r="6" fill="#333"/><circle cx="112" cy="78" r="6" fill="#333"/><path d="M85 98 Q100 112 115 98" stroke="#333" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="78" cy="88" r="6" fill="#fca5a5" opacity="0.6"/><circle cx="122" cy="88" r="6" fill="#fca5a5" opacity="0.6"/><path d="M50 50 L65 40 L70 55" stroke="#fbbf24" stroke-width="3" fill="none"/><path d="M150 50 L135 40 L130 55" stroke="#fbbf24" stroke-width="3" fill="none"/><circle cx="60" cy="45" r="10" fill="#fbbf24" opacity="0.5"/><circle cx="140" cy="45" r="10" fill="#fbbf24" opacity="0.5"/><path d="M100 130 L100 160" stroke="#fff" stroke-width="3"/><path d="M90 150 L100 160 L110 150" stroke="#fff" stroke-width="3" fill="none"/><text x="100" y="185" text-anchor="middle" font-family="Arial" font-size="12" font-weight="bold" fill="#fff">Social Viral</text></svg>`,

    'funny-short-clip': `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="funnyImgBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#FFD93D"/><stop offset="100%" style="stop-color:#FF9F1C"/></linearGradient></defs><rect width="200" height="200" fill="url(#funnyImgBg)"/><circle cx="100" cy="85" r="45" fill="#fff" opacity="0.9"/><circle cx="82" cy="75" r="8" fill="#333"/><circle cx="118" cy="75" r="8" fill="#333"/><circle cx="85" cy="73" r="3" fill="#fff"/><circle cx="121" cy="73" r="3" fill="#fff"/><path d="M75 100 Q100 125 125 100" stroke="#333" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M70 60 L80 70" stroke="#333" stroke-width="3"/><path d="M130 60 L120 70" stroke="#333" stroke-width="3"/><path d="M45 50 L55 40 L50 60" stroke="#fff" stroke-width="3" fill="none" opacity="0.7"/><path d="M155 50 L145 40 L150 60" stroke="#fff" stroke-width="3" fill="none" opacity="0.7"/><ellipse cx="100" cy="160" rx="40" ry="8" fill="#000" opacity="0.1"/><text x="100" y="180" text-anchor="middle" font-family="Arial" font-size="12" font-weight="bold" fill="#fff">คลิปตลก</text></svg>`,

    // ===== Video Templates =====
    'video-ugc': `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="vugcBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#10b981"/><stop offset="100%" style="stop-color:#059669"/></linearGradient></defs><rect width="200" height="200" fill="url(#vugcBg)"/><rect x="50" y="35" width="100" height="110" rx="8" fill="#fff" opacity="0.9"/><circle cx="100" cy="75" r="25" fill="#10b981" opacity="0.2"/><circle cx="92" cy="70" r="4" fill="#333"/><circle cx="108" cy="70" r="4" fill="#333"/><path d="M92 82 Q100 90 108 82" stroke="#333" stroke-width="2" fill="none"/><rect x="80" y="100" width="40" height="30" rx="4" fill="#fbbf24" opacity="0.8"/><polygon points="130,85 150,95 130,105" fill="#059669"/><text x="100" y="170" text-anchor="middle" font-family="Arial" font-size="12" font-weight="bold" fill="#fff">VIDEO UGC</text></svg>`,

    'video-ugc-using': `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="vugcUseBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#3b82f6"/><stop offset="100%" style="stop-color:#1d4ed8"/></linearGradient></defs><rect width="200" height="200" fill="url(#vugcUseBg)"/><rect x="50" y="35" width="100" height="110" rx="8" fill="#fff" opacity="0.9"/><circle cx="85" cy="70" r="22" fill="#3b82f6" opacity="0.2"/><circle cx="78" cy="65" r="3" fill="#333"/><circle cx="92" cy="65" r="3" fill="#333"/><path d="M80 75 Q85 80 90 75" stroke="#333" stroke-width="2" fill="none"/><rect x="105" y="55" width="35" height="50" rx="4" fill="#fbbf24" opacity="0.8"/><path d="M75 95 L90 95 Q110 95 110 80" stroke="#1d4ed8" stroke-width="4" fill="none" opacity="0.5"/><polygon points="130,85 150,95 130,105" fill="#1d4ed8"/><text x="100" y="170" text-anchor="middle" font-family="Arial" font-size="11" font-weight="bold" fill="#fff">VIDEO ใช้จริง</text></svg>`,

    'video-ugc-feeling': `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="vugcFeelBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#ec4899"/><stop offset="100%" style="stop-color:#be185d"/></linearGradient></defs><rect width="200" height="200" fill="url(#vugcFeelBg)"/><rect x="50" y="35" width="100" height="110" rx="8" fill="#fff" opacity="0.9"/><circle cx="100" cy="75" r="28" fill="#ec4899" opacity="0.15"/><circle cx="90" cy="70" r="5" fill="#333"/><circle cx="110" cy="70" r="5" fill="#333"/><path d="M88 88 Q100 100 112 88" stroke="#333" stroke-width="3" fill="none"/><circle cx="82" cy="80" r="6" fill="#fca5a5" opacity="0.5"/><circle cx="118" cy="80" r="6" fill="#fca5a5" opacity="0.5"/><polygon points="130,85 150,95 130,105" fill="#be185d"/><text x="100" y="170" text-anchor="middle" font-family="Arial" font-size="11" font-weight="bold" fill="#fff">VIDEO ความรู้สึก</text></svg>`,

    'video-ugc-compare': `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="vugcCompBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#8b5cf6"/><stop offset="100%" style="stop-color:#6d28d9"/></linearGradient></defs><rect width="200" height="200" fill="url(#vugcCompBg)"/><rect x="50" y="35" width="100" height="110" rx="8" fill="#fff" opacity="0.9"/><rect x="55" y="45" width="40" height="50" rx="4" fill="#8b5cf6" opacity="0.2"/><rect x="105" y="45" width="40" height="50" rx="4" fill="#8b5cf6" opacity="0.4"/><circle cx="75" cy="65" r="12" fill="#fff"/><circle cx="125" cy="65" r="12" fill="#fff"/><circle cx="72" cy="62" r="2" fill="#333"/><circle cx="78" cy="62" r="2" fill="#333"/><circle cx="122" cy="62" r="2" fill="#333"/><circle cx="128" cy="62" r="2" fill="#333"/><path d="M72 72 Q75 75 78 72" stroke="#333" stroke-width="1.5" fill="none"/><path d="M122 72 Q125 78 128 72" stroke="#333" stroke-width="1.5" fill="none"/><path d="M95 65 L105 65" stroke="#6d28d9" stroke-width="2"/><path d="M102 62 L105 65 L102 68" stroke="#6d28d9" stroke-width="2" fill="none"/><polygon points="130,85 150,95 130,105" fill="#6d28d9"/><text x="100" y="170" text-anchor="middle" font-family="Arial" font-size="11" font-weight="bold" fill="#fff">VIDEO ก่อน-หลัง</text></svg>`,

    'video-ugc-closeup': `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="vugcCloseBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#f59e0b"/><stop offset="100%" style="stop-color:#d97706"/></linearGradient></defs><rect width="200" height="200" fill="url(#vugcCloseBg)"/><rect x="50" y="35" width="100" height="110" rx="8" fill="#fff" opacity="0.9"/><circle cx="100" cy="80" r="35" fill="#f59e0b" opacity="0.15"/><rect x="80" y="60" width="40" height="55" rx="5" fill="#fbbf24" opacity="0.9"/><rect x="85" y="68" width="30" height="18" rx="3" fill="#fff"/><text x="100" y="80" text-anchor="middle" font-family="Arial" font-size="7" fill="#d97706">PRODUCT</text><rect x="85" y="92" width="30" height="3" rx="1" fill="#fff" opacity="0.7"/><rect x="85" y="98" width="22" height="3" rx="1" fill="#fff" opacity="0.7"/><polygon points="130,85 150,95 130,105" fill="#d97706"/><text x="100" y="170" text-anchor="middle" font-family="Arial" font-size="11" font-weight="bold" fill="#fff">VIDEO ซูม</text></svg>`,

    'video-ugc-recommend': `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="vugcRecBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#14b8a6"/><stop offset="100%" style="stop-color:#0d9488"/></linearGradient></defs><rect width="200" height="200" fill="url(#vugcRecBg)"/><rect x="50" y="35" width="100" height="110" rx="8" fill="#fff" opacity="0.9"/><circle cx="90" cy="75" r="25" fill="#14b8a6" opacity="0.15"/><circle cx="83" cy="70" r="4" fill="#333"/><circle cx="97" cy="70" r="4" fill="#333"/><path d="M85 82 Q90 88 95 82" stroke="#333" stroke-width="2" fill="none"/><rect x="115" y="60" width="25" height="35" rx="4" fill="#fbbf24" opacity="0.8"/><path d="M70 95 L75 85 L80 95 L75 92 Z" fill="#fbbf24"/><polygon points="130,85 150,95 130,105" fill="#0d9488"/><text x="100" y="170" text-anchor="middle" font-family="Arial" font-size="11" font-weight="bold" fill="#fff">VIDEO แนะนำ</text></svg>`,

    'video-professional': `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="vproBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#1e293b"/><stop offset="100%" style="stop-color:#0f172a"/></linearGradient></defs><rect width="200" height="200" fill="url(#vproBg)"/><rect x="50" y="35" width="100" height="110" rx="8" fill="#fff" opacity="0.1"/><ellipse cx="100" cy="85" rx="30" ry="38" fill="#fff" opacity="0.9"/><circle cx="93" cy="78" r="3" fill="#333"/><circle cx="107" cy="78" r="3" fill="#333"/><path d="M95 90 Q100 95 105 90" stroke="#333" stroke-width="2" fill="none"/><path d="M55 50 L60 85" stroke="#fbbf24" stroke-width="2" opacity="0.5"/><path d="M145 50 L140 85" stroke="#fbbf24" stroke-width="2" opacity="0.5"/><circle cx="57" cy="48" r="5" fill="#fbbf24" opacity="0.4"/><circle cx="143" cy="48" r="5" fill="#fbbf24" opacity="0.4"/><polygon points="130,85 150,95 130,105" fill="#fbbf24"/><text x="100" y="170" text-anchor="middle" font-family="Arial" font-size="10" font-weight="bold" fill="#fbbf24">VIDEO PRO</text></svg>`,

    'video-product-only': `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="vprodBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#6366f1"/><stop offset="100%" style="stop-color:#4f46e5"/></linearGradient></defs><rect width="200" height="200" fill="url(#vprodBg)"/><rect x="50" y="35" width="100" height="110" rx="8" fill="#fff" opacity="0.9"/><ellipse cx="100" cy="120" rx="30" ry="8" fill="#000" opacity="0.1"/><rect x="75" y="55" width="50" height="70" rx="6" fill="#c7d2fe"/><rect x="82" y="62" width="36" height="25" rx="3" fill="#6366f1" opacity="0.3"/><text x="100" y="78" text-anchor="middle" font-family="Arial" font-size="8" fill="#4f46e5">BRAND</text><rect x="82" y="95" width="36" height="4" rx="2" fill="#fff" opacity="0.7"/><rect x="82" y="103" width="28" height="4" rx="2" fill="#fff" opacity="0.7"/><path d="M60 70 C65 60 70 75 75 65" stroke="#4f46e5" stroke-width="2" fill="none" opacity="0.4"/><path d="M125 65 C130 75 135 60 140 70" stroke="#4f46e5" stroke-width="2" fill="none" opacity="0.4"/><polygon points="130,85 150,95 130,105" fill="#4f46e5"/><text x="100" y="170" text-anchor="middle" font-family="Arial" font-size="10" font-weight="bold" fill="#fff">VIDEO PRODUCT</text></svg>`,

    'video-lifestyle': `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="vlifeBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#84cc16"/><stop offset="100%" style="stop-color:#65a30d"/></linearGradient></defs><rect width="200" height="200" fill="url(#vlifeBg)"/><rect x="50" y="35" width="100" height="110" rx="8" fill="#fff" opacity="0.9"/><circle cx="85" cy="75" r="20" fill="#84cc16" opacity="0.2"/><circle cx="78" cy="70" r="3" fill="#333"/><circle cx="92" cy="70" r="3" fill="#333"/><path d="M80 80 Q85 85 90 80" stroke="#333" stroke-width="2" fill="none"/><rect x="108" y="60" width="30" height="40" rx="4" fill="#fbbf24" opacity="0.8"/><path d="M75 95 L85 95 Q98 95 98 85" stroke="#65a30d" stroke-width="3" fill="none" opacity="0.5"/><circle cx="65" cy="50" r="6" fill="#fbbf24" opacity="0.4"/><polygon points="130,85 150,95 130,105" fill="#65a30d"/><text x="100" y="170" text-anchor="middle" font-family="Arial" font-size="10" font-weight="bold" fill="#fff">VIDEO LIFESTYLE</text></svg>`,

    'video-social-viral': `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="vviralBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#f43f5e"/><stop offset="100%" style="stop-color:#e11d48"/></linearGradient></defs><rect width="200" height="200" fill="url(#vviralBg)"/><rect x="50" y="35" width="100" height="110" rx="8" fill="#fff" opacity="0.9"/><circle cx="100" cy="75" r="28" fill="#f43f5e" opacity="0.15"/><circle cx="90" cy="68" r="5" fill="#333"/><circle cx="110" cy="68" r="5" fill="#333"/><path d="M88 85 Q100 98 112 85" stroke="#333" stroke-width="3" fill="none"/><circle cx="82" cy="78" r="5" fill="#fca5a5" opacity="0.5"/><circle cx="118" cy="78" r="5" fill="#fca5a5" opacity="0.5"/><path d="M55 45 L65 38 L62 52" stroke="#fbbf24" stroke-width="2" fill="none"/><path d="M145 45 L135 38 L138 52" stroke="#fbbf24" stroke-width="2" fill="none"/><polygon points="130,85 150,95 130,105" fill="#e11d48"/><text x="100" y="170" text-anchor="middle" font-family="Arial" font-size="10" font-weight="bold" fill="#fff">VIDEO VIRAL</text></svg>`,

    'video-ugc-silent': `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="vsilentBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#64748b"/><stop offset="100%" style="stop-color:#475569"/></linearGradient></defs><rect width="200" height="200" fill="url(#vsilentBg)"/><rect x="50" y="35" width="100" height="110" rx="8" fill="#fff" opacity="0.9"/><circle cx="100" cy="75" r="28" fill="#64748b" opacity="0.15"/><circle cx="90" cy="68" r="5" fill="#333"/><circle cx="110" cy="68" r="5" fill="#333"/><line x1="88" y1="88" x2="112" y2="88" stroke="#333" stroke-width="3" stroke-linecap="round"/><path d="M60 100 L65 95 L70 100" stroke="#475569" stroke-width="3" fill="none" opacity="0.6"/><path d="M60 108 L65 103 L70 108 L65 103 L60 108" stroke="#475569" stroke-width="2" fill="none" opacity="0.4"/><polygon points="130,85 150,95 130,105" fill="#475569"/><text x="100" y="170" text-anchor="middle" font-family="Arial" font-size="10" font-weight="bold" fill="#fff">VIDEO SILENT</text></svg>`,

    'video-funny-short-clip': `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="vfunnyBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#FFD93D"/><stop offset="100%" style="stop-color:#FF9F1C"/></linearGradient></defs><rect width="200" height="200" fill="url(#vfunnyBg)"/><rect x="50" y="35" width="100" height="110" rx="8" fill="#fff" opacity="0.9"/><circle cx="100" cy="78" r="30" fill="#FFD93D" opacity="0.2"/><circle cx="88" cy="70" r="6" fill="#333"/><circle cx="112" cy="70" r="6" fill="#333"/><circle cx="90" cy="68" r="2" fill="#fff"/><circle cx="114" cy="68" r="2" fill="#fff"/><path d="M82 90 Q100 108 118 90" stroke="#333" stroke-width="3" fill="none"/><path d="M75 58 L82 66" stroke="#333" stroke-width="2"/><path d="M125 58 L118 66" stroke="#333" stroke-width="2"/><polygon points="130,85 150,95 130,105" fill="#FF9F1C"/><text x="100" y="170" text-anchor="middle" font-family="Arial" font-size="10" font-weight="bold" fill="#fff">VIDEO ตลก</text></svg>`
  },

  // ==================== AI Story Templates ====================

  AI_STORY_CATEGORY_ID: 'ai-story',
  AI_STORY_CATEGORY_NAME: 'AI Story',

  /**
   * AI Story Default Templates - ภาษาไทยทั้งหมด
   */
  AI_STORY_TEMPLATES: {
    // ===== Image Templates - สัตว์น่ารัก (Cute Animals) =====
    'story-cute-cat': {
      id: 'story-cute-cat',
      name: 'ภาพแมวน่ารัก',
      description: 'ภาพนิ่งแมวน่ารัก',
      type: 'image',
      thumbnail: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="icatBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#FFB6C1"/><stop offset="100%" style="stop-color:#FFA07A"/></linearGradient></defs><rect width="200" height="200" fill="url(#icatBg)"/><ellipse cx="100" cy="100" rx="50" ry="45" fill="#fff" opacity="0.95"/><polygon points="60,65 45,30 75,55" fill="#fff" opacity="0.95"/><polygon points="140,65 155,30 125,55" fill="#fff" opacity="0.95"/><circle cx="75" cy="90" r="10" fill="#333"/><circle cx="125" cy="90" r="10" fill="#333"/><circle cx="78" cy="87" r="4" fill="#fff"/><circle cx="128" cy="87" r="4" fill="#fff"/><ellipse cx="100" cy="110" rx="8" ry="5" fill="#FFB6C1"/><path d="M92 118 Q100 128 108 118" stroke="#333" stroke-width="2.5" fill="none"/><text x="100" y="175" text-anchor="middle" font-family="Arial" font-size="14" font-weight="bold" fill="#fff">CUTE CAT</text></svg>`,
      systemPrompt: `สร้าง prompt ภาพนิ่งแมวน่ารัก

ตอบแค่ prompt ล้วนๆ 2-3 ประโยค ห้ามมีหัวข้อ/คำนำหน้า

ห้ามเด็ดขาด:
- ห้ามขึ้นต้นด้วย "ฉาก:", "Prompt:", "**", หัวข้อใดๆ

ตอบ prompt ตรงๆ เลย เช่น:
ลูกแมวขนฟูสีส้มนอนขดบนโซฟานุ่มๆ แสงอาทิตย์ยามบ่ายส่องผ่านหน้าต่าง โทนสีอบอุ่น`,
      userMessageTemplate: `{{sceneDescription}}

ตอบแค่ prompt ภาพนิ่งแมวน่ารัก ภาษาไทย 2-3 ประโยค (ห้ามมีหัวข้อ/คำนำหน้า)`
    },

    'story-cute-dog': {
      id: 'story-cute-dog',
      name: 'ภาพหมาน่ารัก',
      description: 'ภาพนิ่งหมาน่ารัก',
      type: 'image',
      thumbnail: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="idogBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#DEB887"/><stop offset="100%" style="stop-color:#D2691E"/></linearGradient></defs><rect width="200" height="200" fill="url(#idogBg)"/><ellipse cx="100" cy="100" rx="50" ry="45" fill="#fff" opacity="0.95"/><ellipse cx="55" cy="70" rx="20" ry="30" fill="#D2691E" opacity="0.8"/><ellipse cx="145" cy="70" rx="20" ry="30" fill="#D2691E" opacity="0.8"/><circle cx="75" cy="90" r="10" fill="#333"/><circle cx="125" cy="90" r="10" fill="#333"/><circle cx="78" cy="87" r="4" fill="#fff"/><circle cx="128" cy="87" r="4" fill="#fff"/><ellipse cx="100" cy="115" rx="12" ry="8" fill="#333"/><ellipse cx="100" cy="130" rx="25" ry="8" fill="#FFB6C1" opacity="0.6"/><text x="100" y="175" text-anchor="middle" font-family="Arial" font-size="14" font-weight="bold" fill="#fff">CUTE DOG</text></svg>`,
      systemPrompt: `สร้าง prompt ภาพนิ่งหมาน่ารัก

ตอบแค่ prompt ล้วนๆ 2-3 ประโยค ห้ามมีหัวข้อ/คำนำหน้า

ห้ามเด็ดขาด:
- ห้ามขึ้นต้นด้วย "ฉาก:", "Prompt:", "**", หัวข้อใดๆ

ตอบ prompt ตรงๆ เลย เช่น:
ลูกหมาโกลเด้นรีทรีฟเวอร์นั่งอยู่ในสวนดอกไม้ หูตั้งสดใส มีผีเสื้อบินรอบหัว โทนสีสดใส`,
      userMessageTemplate: `{{sceneDescription}}

ตอบแค่ prompt ภาพนิ่งหมาน่ารัก ภาษาไทย 2-3 ประโยค (ห้ามมีหัวข้อ/คำนำหน้า)`
    },

    'story-cute-bunny': {
      id: 'story-cute-bunny',
      name: 'ภาพกระต่ายน่ารัก',
      description: 'ภาพนิ่งกระต่ายน่ารัก',
      type: 'image',
      thumbnail: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="ibunnyBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#E6E6FA"/><stop offset="100%" style="stop-color:#DDA0DD"/></linearGradient></defs><rect width="200" height="200" fill="url(#ibunnyBg)"/><ellipse cx="75" cy="50" rx="15" ry="40" fill="#fff" opacity="0.95"/><ellipse cx="125" cy="50" rx="15" ry="40" fill="#fff" opacity="0.95"/><ellipse cx="75" cy="50" rx="8" ry="30" fill="#FFB6C1" opacity="0.5"/><ellipse cx="125" cy="50" rx="8" ry="30" fill="#FFB6C1" opacity="0.5"/><ellipse cx="100" cy="110" rx="45" ry="40" fill="#fff" opacity="0.95"/><circle cx="80" cy="100" r="8" fill="#333"/><circle cx="120" cy="100" r="8" fill="#333"/><circle cx="82" cy="98" r="3" fill="#fff"/><circle cx="122" cy="98" r="3" fill="#fff"/><ellipse cx="100" cy="118" rx="6" ry="4" fill="#FFB6C1"/><path d="M94 125 Q100 132 106 125" stroke="#333" stroke-width="2" fill="none"/><text x="100" y="175" text-anchor="middle" font-family="Arial" font-size="12" font-weight="bold" fill="#fff">CUTE BUNNY</text></svg>`,
      systemPrompt: `สร้าง prompt ภาพนิ่งกระต่ายน่ารัก

ตอบแค่ prompt ล้วนๆ 2-3 ประโยค ห้ามมีหัวข้อ/คำนำหน้า

ห้ามเด็ดขาด:
- ห้ามขึ้นต้นด้วย "ฉาก:", "Prompt:", "**", หัวข้อใดๆ

ตอบ prompt ตรงๆ เลย เช่น:
กระต่ายขนปุยสีขาวนั่งอยู่บนหญ้าเขียวขจี มีดอกไม้ป่ารอบตัว แสงยามเช้าอ่อนๆ`,
      userMessageTemplate: `{{sceneDescription}}

ตอบแค่ prompt ภาพนิ่งกระต่ายน่ารัก ภาษาไทย 2-3 ประโยค (ห้ามมีหัวข้อ/คำนำหน้า)`
    },

    'story-cute-bird': {
      id: 'story-cute-bird',
      name: 'ภาพนกน่ารัก',
      description: 'ภาพนิ่งนกน่ารัก',
      type: 'image',
      thumbnail: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="ibirdBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#87CEEB"/><stop offset="100%" style="stop-color:#4682B4"/></linearGradient></defs><rect width="200" height="200" fill="url(#ibirdBg)"/><ellipse cx="100" cy="100" rx="45" ry="40" fill="#FFD700" opacity="0.95"/><circle cx="100" cy="70" r="30" fill="#FFD700" opacity="0.95"/><circle cx="88" cy="65" r="8" fill="#333"/><circle cx="112" cy="65" r="8" fill="#333"/><circle cx="90" cy="63" r="3" fill="#fff"/><circle cx="114" cy="63" r="3" fill="#fff"/><polygon points="100,78 90,88 110,88" fill="#FF6347"/><ellipse cx="60" cy="100" rx="20" ry="12" fill="#87CEEB" opacity="0.8"/><ellipse cx="140" cy="100" rx="20" ry="12" fill="#87CEEB" opacity="0.8"/><text x="100" y="175" text-anchor="middle" font-family="Arial" font-size="14" font-weight="bold" fill="#fff">CUTE BIRD</text></svg>`,
      systemPrompt: `สร้าง prompt ภาพนิ่งนกน่ารัก

ตอบแค่ prompt ล้วนๆ 2-3 ประโยค ห้ามมีหัวข้อ/คำนำหน้า

ห้ามเด็ดขาด:
- ห้ามขึ้นต้นด้วย "ฉาก:", "Prompt:", "**", หัวข้อใดๆ

ตอบ prompt ตรงๆ เลย เช่น:
นกแก้วสีเขียวเกาะอยู่บนกิ่งไม้ หัวเอียงมองกล้อง พื้นหลังป่าเขตร้อนเบลอๆ`,
      userMessageTemplate: `{{sceneDescription}}

ตอบแค่ prompt ภาพนิ่งนกน่ารัก ภาษาไทย 2-3 ประโยค (ห้ามมีหัวข้อ/คำนำหน้า)`
    },

    'story-cute-hamster': {
      id: 'story-cute-hamster',
      name: 'ภาพแฮมสเตอร์น่ารัก',
      description: 'ภาพนิ่งแฮมสเตอร์น่ารัก',
      type: 'image',
      thumbnail: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="ihamBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#FFDAB9"/><stop offset="100%" style="stop-color:#FFA500"/></linearGradient></defs><rect width="200" height="200" fill="url(#ihamBg)"/><ellipse cx="100" cy="105" rx="50" ry="45" fill="#fff" opacity="0.95"/><circle cx="60" cy="70" r="18" fill="#FFA500" opacity="0.6"/><circle cx="140" cy="70" r="18" fill="#FFA500" opacity="0.6"/><circle cx="75" cy="90" r="8" fill="#333"/><circle cx="125" cy="90" r="8" fill="#333"/><circle cx="77" cy="88" r="3" fill="#fff"/><circle cx="127" cy="88" r="3" fill="#fff"/><ellipse cx="100" cy="105" rx="6" ry="4" fill="#FFB6C1"/><ellipse cx="75" cy="115" rx="15" ry="12" fill="#FFE4E1" opacity="0.8"/><ellipse cx="125" cy="115" rx="15" ry="12" fill="#FFE4E1" opacity="0.8"/><text x="100" y="175" text-anchor="middle" font-family="Arial" font-size="11" font-weight="bold" fill="#fff">CUTE HAMSTER</text></svg>`,
      systemPrompt: `สร้าง prompt ภาพนิ่งแฮมสเตอร์น่ารัก

ตอบแค่ prompt ล้วนๆ 2-3 ประโยค ห้ามมีหัวข้อ/คำนำหน้า

ห้ามเด็ดขาด:
- ห้ามขึ้นต้นด้วย "ฉาก:", "Prompt:", "**", หัวข้อใดๆ

ตอบ prompt ตรงๆ เลย เช่น:
แฮมสเตอร์ตัวกลมสีน้ำตาลนั่งอยู่ในกรง กำลังกินเมล็ดทานตะวัน แก้มพองน่ารัก`,
      userMessageTemplate: `{{sceneDescription}}

ตอบแค่ prompt ภาพนิ่งแฮมสเตอร์น่ารัก ภาษาไทย 2-3 ประโยค (ห้ามมีหัวข้อ/คำนำหน้า)`
    },

    // ===== Video Templates - สัตว์น่ารัก (Cute Animals) =====
    'story-video-cute-cat': {
      id: 'story-video-cute-cat',
      name: 'วิดีโอแมวน่ารัก',
      description: 'วิดีโอแมวน่ารัก 8 วินาที',
      type: 'video',
      thumbnail: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="vcatBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#FFB6C1"/><stop offset="100%" style="stop-color:#FFA07A"/></linearGradient></defs><rect width="200" height="200" fill="url(#vcatBg)"/><ellipse cx="100" cy="110" rx="45" ry="40" fill="#fff" opacity="0.95"/><polygon points="65,70 55,40 80,60" fill="#fff" opacity="0.95"/><polygon points="135,70 145,40 120,60" fill="#fff" opacity="0.95"/><circle cx="80" cy="95" r="8" fill="#333"/><circle cx="120" cy="95" r="8" fill="#333"/><circle cx="83" cy="92" r="3" fill="#fff"/><circle cx="123" cy="92" r="3" fill="#fff"/><ellipse cx="100" cy="115" rx="6" ry="4" fill="#FFB6C1"/><path d="M94 120 Q100 128 106 120" stroke="#333" stroke-width="2" fill="none"/><polygon points="130,100 150,110 130,120" fill="#FF69B4"/><text x="100" y="175" text-anchor="middle" font-family="Arial" font-size="12" font-weight="bold" fill="#fff">CUTE CAT</text></svg>`,
      systemPrompt: `สร้าง prompt วิดีโอ 8 วินาที แมวน่ารัก

ตอบแค่ prompt ล้วนๆ 2-3 ประโยค ห้ามมีหัวข้อ/คำนำหน้า

ห้ามเด็ดขาด:
- ห้ามขึ้นต้นด้วย "ฉาก:", "Prompt:", "**", หัวข้อใดๆ

ตอบ prompt ตรงๆ เลย เช่น:
ลูกแมวขนฟูสีส้มนอนกลิ้งเล่นบนพรม กระดิกหางช้าๆ กล้องซูมเข้าหน้าน่ารัก`,
      userMessageTemplate: `{{sceneDescription}}

ตอบแค่ prompt วิดีโอแมวน่ารัก 8 วินาที ภาษาไทย 2-3 ประโยค (ห้ามมีหัวข้อ/คำนำหน้า)`
    },

    'story-video-cute-dog': {
      id: 'story-video-cute-dog',
      name: 'วิดีโอหมาน่ารัก',
      description: 'วิดีโอหมาน่ารัก 8 วินาที',
      type: 'video',
      thumbnail: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="vdogBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#87CEEB"/><stop offset="100%" style="stop-color:#4169E1"/></linearGradient></defs><rect width="200" height="200" fill="url(#vdogBg)"/><ellipse cx="100" cy="105" rx="50" ry="45" fill="#D2691E" opacity="0.95"/><ellipse cx="60" cy="70" rx="20" ry="30" fill="#8B4513" opacity="0.9"/><ellipse cx="140" cy="70" rx="20" ry="30" fill="#8B4513" opacity="0.9"/><circle cx="85" cy="95" r="8" fill="#333"/><circle cx="115" cy="95" r="8" fill="#333"/><circle cx="87" cy="92" r="3" fill="#fff"/><circle cx="117" cy="92" r="3" fill="#fff"/><ellipse cx="100" cy="115" rx="12" ry="8" fill="#333"/><path d="M85 130 Q100 145 115 130" stroke="#FF69B4" stroke-width="4" fill="none"/><polygon points="130,100 150,110 130,120" fill="#4169E1"/><text x="100" y="175" text-anchor="middle" font-family="Arial" font-size="12" font-weight="bold" fill="#fff">CUTE DOG</text></svg>`,
      systemPrompt: `สร้าง prompt วิดีโอ 8 วินาที หมาน่ารัก

ตอบแค่ prompt ล้วนๆ 2-3 ประโยค ห้ามมีหัวข้อ/คำนำหน้า

ห้ามเด็ดขาด:
- ห้ามขึ้นต้นด้วย "ฉาก:", "Prompt:", "**", หัวข้อใดๆ

ตอบ prompt ตรงๆ เลย เช่น:
ลูกหมาพันธุ์ชิบะสีน้ำตาลวิ่งเล่นในสวน กระดิกหางดีใจ กล้อง tracking ตาม`,
      userMessageTemplate: `{{sceneDescription}}

ตอบแค่ prompt วิดีโอหมาน่ารัก 8 วินาที ภาษาไทย 2-3 ประโยค (ห้ามมีหัวข้อ/คำนำหน้า)`
    },

    'story-video-cute-bunny': {
      id: 'story-video-cute-bunny',
      name: 'วิดีโอกระต่ายน่ารัก',
      description: 'วิดีโอกระต่ายน่ารัก 8 วินาที',
      type: 'video',
      thumbnail: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="vbunBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#E6E6FA"/><stop offset="100%" style="stop-color:#DDA0DD"/></linearGradient></defs><rect width="200" height="200" fill="url(#vbunBg)"/><ellipse cx="100" cy="115" rx="40" ry="35" fill="#fff" opacity="0.95"/><ellipse cx="75" cy="50" rx="12" ry="35" fill="#fff" opacity="0.95"/><ellipse cx="125" cy="50" rx="12" ry="35" fill="#fff" opacity="0.95"/><ellipse cx="75" cy="55" rx="6" ry="25" fill="#FFB6C1" opacity="0.6"/><ellipse cx="125" cy="55" rx="6" ry="25" fill="#FFB6C1" opacity="0.6"/><circle cx="85" cy="105" r="6" fill="#FF69B4"/><circle cx="115" cy="105" r="6" fill="#FF69B4"/><ellipse cx="100" cy="120" rx="5" ry="3" fill="#FFB6C1"/><path d="M95 125 L100 130 L105 125" stroke="#333" stroke-width="2" fill="none"/><polygon points="130,105 150,115 130,125" fill="#DDA0DD"/><text x="100" y="175" text-anchor="middle" font-family="Arial" font-size="12" font-weight="bold" fill="#fff">CUTE BUNNY</text></svg>`,
      systemPrompt: `สร้าง prompt วิดีโอ 8 วินาที กระต่ายน่ารัก

ตอบแค่ prompt ล้วนๆ 2-3 ประโยค ห้ามมีหัวข้อ/คำนำหน้า

ห้ามเด็ดขาด:
- ห้ามขึ้นต้นด้วย "ฉาก:", "Prompt:", "**", หัวข้อใดๆ

ตอบ prompt ตรงๆ เลย เช่น:
กระต่ายขนฟูสีขาวกำลังกินแครอท กระดิกจมูกน่ารัก กล้องซูมเข้าใบหน้า`,
      userMessageTemplate: `{{sceneDescription}}

ตอบแค่ prompt วิดีโอกระต่ายน่ารัก 8 วินาที ภาษาไทย 2-3 ประโยค (ห้ามมีหัวข้อ/คำนำหน้า)`
    },

    'story-video-cute-bird': {
      id: 'story-video-cute-bird',
      name: 'วิดีโอนกน่ารัก',
      description: 'วิดีโอนกน่ารัก 8 วินาที',
      type: 'video',
      thumbnail: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="vbirdBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#98FB98"/><stop offset="100%" style="stop-color:#32CD32"/></linearGradient></defs><rect width="200" height="200" fill="url(#vbirdBg)"/><ellipse cx="100" cy="100" rx="40" ry="35" fill="#FFD700" opacity="0.95"/><circle cx="100" cy="70" r="25" fill="#FFD700" opacity="0.95"/><circle cx="90" cy="65" r="5" fill="#333"/><circle cx="91" cy="63" r="2" fill="#fff"/><polygon points="110,70 130,68 110,75" fill="#FF6347"/><path d="M70 110 Q50 130 60 140" stroke="#FF6347" stroke-width="4" fill="none"/><path d="M130 110 Q150 130 140 140" stroke="#FF6347" stroke-width="4" fill="none"/><ellipse cx="100" cy="135" rx="8" ry="5" fill="#FF6347"/><polygon points="130,90 150,100 130,110" fill="#32CD32"/><text x="100" y="175" text-anchor="middle" font-family="Arial" font-size="12" font-weight="bold" fill="#fff">CUTE BIRD</text></svg>`,
      systemPrompt: `สร้าง prompt วิดีโอ 8 วินาที นกน่ารัก

ตอบแค่ prompt ล้วนๆ 2-3 ประโยค ห้ามมีหัวข้อ/คำนำหน้า

ห้ามเด็ดขาด:
- ห้ามขึ้นต้นด้วย "ฉาก:", "Prompt:", "**", หัวข้อใดๆ

ตอบ prompt ตรงๆ เลย เช่น:
นกแก้วสีเขียวเกาะกิ่งไม้ร้องเพลง กระพือปีกเบาๆ กล้อง pan รอบตัว`,
      userMessageTemplate: `{{sceneDescription}}

ตอบแค่ prompt วิดีโอนกน่ารัก 8 วินาที ภาษาไทย 2-3 ประโยค (ห้ามมีหัวข้อ/คำนำหน้า)`
    },

    'story-video-cute-hamster': {
      id: 'story-video-cute-hamster',
      name: 'วิดีโอแฮมสเตอร์น่ารัก',
      description: 'วิดีโอแฮมสเตอร์น่ารัก 8 วินาที',
      type: 'video',
      thumbnail: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="vhamBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#FFDAB9"/><stop offset="100%" style="stop-color:#F4A460"/></linearGradient></defs><rect width="200" height="200" fill="url(#vhamBg)"/><ellipse cx="100" cy="110" rx="45" ry="40" fill="#FFE4C4" opacity="0.95"/><circle cx="70" cy="80" r="12" fill="#FFE4C4" opacity="0.95"/><circle cx="130" cy="80" r="12" fill="#FFE4C4" opacity="0.95"/><circle cx="70" cy="80" r="6" fill="#FFB6C1" opacity="0.7"/><circle cx="130" cy="80" r="6" fill="#FFB6C1" opacity="0.7"/><circle cx="85" cy="100" r="5" fill="#333"/><circle cx="115" cy="100" r="5" fill="#333"/><circle cx="86" cy="98" r="2" fill="#fff"/><circle cx="116" cy="98" r="2" fill="#fff"/><ellipse cx="100" cy="115" rx="4" ry="3" fill="#FFB6C1"/><ellipse cx="80" cy="120" rx="15" ry="10" fill="#FFDAB9" opacity="0.8"/><ellipse cx="120" cy="120" rx="15" ry="10" fill="#FFDAB9" opacity="0.8"/><polygon points="130,100 150,110 130,120" fill="#F4A460"/><text x="100" y="175" text-anchor="middle" font-family="Arial" font-size="10" font-weight="bold" fill="#fff">CUTE HAMSTER</text></svg>`,
      systemPrompt: `สร้าง prompt วิดีโอ 8 วินาที แฮมสเตอร์น่ารัก

ตอบแค่ prompt ล้วนๆ 2-3 ประโยค ห้ามมีหัวข้อ/คำนำหน้า

ห้ามเด็ดขาด:
- ห้ามขึ้นต้นด้วย "ฉาก:", "Prompt:", "**", หัวข้อใดๆ

ตอบ prompt ตรงๆ เลย เช่น:
แฮมสเตอร์สีน้ำตาลอมเมล็ดทานตะวันในกระพุ้งแก้ม ขยับหนวดน่ารัก กล้องซูมเข้าใกล้`,
      userMessageTemplate: `{{sceneDescription}}

ตอบแค่ prompt วิดีโอแฮมสเตอร์น่ารัก 8 วินาที ภาษาไทย 2-3 ประโยค (ห้ามมีหัวข้อ/คำนำหน้า)`
    },

    // ===== เพลง (MV) - ไม่มีบทพูด =====
    'story-music': {
      id: 'story-music',
      name: 'เพลง (MV)',
      description: 'ภาพสำหรับ MV เพลง - ใส่เนื้อเพลงได้',
      type: 'image',
      thumbnail: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="musicBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#9c27b0"/><stop offset="100%" style="stop-color:#673ab7"/></linearGradient></defs><rect width="200" height="200" fill="url(#musicBg)"/><circle cx="70" cy="120" r="25" fill="#fff" opacity="0.9"/><circle cx="130" cy="100" r="25" fill="#fff" opacity="0.9"/><rect x="92" y="50" width="8" height="70" fill="#fff" opacity="0.9"/><rect x="152" y="30" width="8" height="70" fill="#fff" opacity="0.9"/><path d="M95 50 L95 35 L160 20 L160 35 Z" fill="#fff" opacity="0.9"/><circle cx="50" cy="50" r="8" fill="#e1bee7" opacity="0.6"/><circle cx="160" cy="150" r="10" fill="#e1bee7" opacity="0.6"/><circle cx="40" cy="150" r="6" fill="#e1bee7" opacity="0.6"/><text x="100" y="175" text-anchor="middle" font-family="Arial" font-size="16" font-weight="bold" fill="#fff">MUSIC MV</text></svg>`,
      systemPrompt: `แปลงเนื้อเพลงเป็น prompt สร้างภาพ

ตอบแค่ prompt ล้วนๆ 2-3 ประโยค ห้ามมีหัวข้อ/คำนำหน้า

ห้ามเด็ดขาด:
- ห้ามขึ้นต้นด้วย "ฉาก:", "Prompt:", "**", หัวข้อใดๆ
- ห้าม copy เนื้อเพลง
- ห้ามมี Verse/Chorus/เนื้อร้อง
- ห้ามมีบทพูด/ชื่อ/อารมณ์/การเคลื่อนไหว

ตอบ prompt ตรงๆ เลย เช่น:
ชายหนุ่มยืนริมสะพาน แสงยามเย็นส่องผ่านต้นไม้ บรรยากาศเหงา`,
      userMessageTemplate: `เนื้อเพลง:
{{sceneDescription}}

ตอบแค่ prompt ภาษาไทย 2-3 ประโยค (ห้ามมีหัวข้อ/คำนำหน้า)`
    },

    'story-video-music': {
      id: 'story-video-music',
      name: 'วิดีโอเพลง (MV)',
      description: 'วิดีโอ MV 8 วินาที - ใส่เนื้อเพลงได้',
      type: 'video',
      thumbnail: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="vmusicBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#9c27b0"/><stop offset="100%" style="stop-color:#673ab7"/></linearGradient></defs><rect width="200" height="200" fill="url(#vmusicBg)"/><rect x="50" y="40" width="100" height="100" rx="10" fill="#fff" opacity="0.9"/><circle cx="80" cy="100" r="18" fill="#9c27b0" opacity="0.8"/><circle cx="115" cy="85" r="18" fill="#9c27b0" opacity="0.8"/><rect x="95" y="55" width="5" height="45" fill="#9c27b0" opacity="0.8"/><rect x="130" y="40" width="5" height="45" fill="#9c27b0" opacity="0.8"/><path d="M97 55 L97 45 L135 35 L135 45 Z" fill="#9c27b0" opacity="0.8"/><polygon points="130,85 150,95 130,105" fill="#673ab7"/><text x="100" y="170" text-anchor="middle" font-family="Arial" font-size="12" font-weight="bold" fill="#fff">VIDEO MUSIC</text></svg>`,
      systemPrompt: `แปลงเนื้อเพลงเป็น prompt สร้างวิดีโอ 8 วินาที

ตอบแค่ prompt ล้วนๆ 2-3 ประโยค ห้ามมีหัวข้อ/คำนำหน้า

ห้ามเด็ดขาด:
- ห้ามขึ้นต้นด้วย "ฉาก:", "Prompt:", "**", หัวข้อใดๆ
- ห้าม copy เนื้อเพลง
- ห้ามมี Verse/Chorus/เนื้อร้อง
- ห้ามมีบทพูด/ชื่อ/ขยับปาก

ตอบ prompt ตรงๆ เลย เช่น:
ชายหนุ่มยืนมองออกไปไกลๆ ลมพัดผมเบาๆ กล้อง zoom out ช้าๆ`,
      userMessageTemplate: `เนื้อเพลง:
{{sceneDescription}}

ตอบแค่ prompt วิดีโอ 8 วินาที ภาษาไทย 2-3 ประโยค (ห้ามมีหัวข้อ/คำนำหน้า)`
    },

    // ===== Lofi - วิดีโอ loop ได้ =====
    'story-lofi': {
      id: 'story-lofi',
      name: 'Lofi',
      description: 'ภาพสงบ เหมาะทำวิดีโอ loop',
      type: 'image',
      thumbnail: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="lofiBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#2d5a27"/><stop offset="100%" style="stop-color:#4a7c59"/></linearGradient></defs><rect width="200" height="200" fill="url(#lofiBg)"/><ellipse cx="100" cy="120" rx="45" ry="30" fill="#8b4513" opacity="0.8"/><path d="M55 120 Q55 90 75 85 Q90 80 100 90 Q110 80 125 85 Q145 90 145 120" fill="#6b3a0f"/><ellipse cx="100" cy="95" rx="30" ry="10" fill="#4a2c0a"/><path d="M85 90 Q100 70 115 90" stroke="#fff" stroke-width="2" fill="none" opacity="0.5"/><circle cx="95" cy="88" r="3" fill="#fff" opacity="0.3"/><path d="M60 60 Q70 40 80 60 Q85 45 90 55" stroke="#4a7c59" stroke-width="3" fill="none"/><path d="M120 50 Q130 30 140 50 Q145 35 150 45" stroke="#4a7c59" stroke-width="3" fill="none"/><circle cx="70" cy="55" r="8" fill="#81c784" opacity="0.7"/><circle cx="135" cy="45" r="10" fill="#81c784" opacity="0.7"/><circle cx="50" cy="160" r="4" fill="#a5d6a7" opacity="0.5"/><circle cx="160" cy="150" r="5" fill="#a5d6a7" opacity="0.5"/><text x="100" y="175" text-anchor="middle" font-family="Arial" font-size="18" font-weight="bold" fill="#fff">LOFI</text></svg>`,
      systemPrompt: `สร้าง prompt ภาษาไทยสำหรับภาพฉาก Lofi/Chill

หน้าที่: รับข้อมูลฉากจาก user แล้วสร้าง prompt ที่ตรงกับฉากนั้น

กฎ:
- ตอบเป็นภาษาไทยเท่านั้น
- Prompt สั้น 2-3 ประโยค
- ต้องใช้ข้อมูลฉากที่ user ให้มาเป็นหลัก (ห้ามสร้างฉากใหม่เอง)
- ถ้ามีตัวละคร ใช้ตามเพศที่ระบุ ถ้าไม่มีก็ไม่ต้องมีคนในฉาก
- ฉากสงบ ผ่อนคลาย บรรยากาศ cozy
- เน้นองค์ประกอบที่ขยับได้เล็กน้อย (ใบไม้ไหว แสงกระพริบ ควันลอย)
- กล้องมุมนิ่ง ไม่ pan ไม่ซูม
- ตอบเฉพาะ prompt`,
      userMessageTemplate: `{{genderText}}{{sceneDescription}}

สร้าง prompt ภาษาไทย 2-3 ประโยค สำหรับฉาก lofi ที่สงบ โดยใช้ข้อมูลฉากข้างต้น`
    },

    'story-video-lofi': {
      id: 'story-video-lofi',
      name: 'วิดีโอ Lofi',
      description: 'วิดีโอ loop ได้ 8 วินาที',
      type: 'video',
      thumbnail: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs><linearGradient id="vlofiBg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#2d5a27"/><stop offset="100%" style="stop-color:#4a7c59"/></linearGradient></defs><rect width="200" height="200" fill="url(#vlofiBg)"/><rect x="50" y="40" width="100" height="100" rx="10" fill="#fff" opacity="0.9"/><ellipse cx="100" cy="100" rx="30" ry="20" fill="#8b4513" opacity="0.8"/><path d="M70 100 Q70 80 85 75 Q95 72 100 80 Q105 72 115 75 Q130 80 130 100" fill="#6b3a0f"/><ellipse cx="100" cy="82" rx="20" ry="7" fill="#4a2c0a"/><path d="M90 80 Q100 65 110 80" stroke="#fff" stroke-width="1.5" fill="none" opacity="0.5"/><circle cx="75" cy="60" r="6" fill="#81c784" opacity="0.7"/><circle cx="125" cy="55" r="8" fill="#81c784" opacity="0.7"/><polygon points="130,85 150,95 130,105" fill="#4a7c59"/><path d="M60 50 C65 45 70 50 75 48" stroke="#4a7c59" stroke-width="2" fill="none"/><text x="100" y="170" text-anchor="middle" font-family="Arial" font-size="14" font-weight="bold" fill="#fff">VIDEO LOFI</text></svg>`,
      systemPrompt: `สร้าง prompt วิดีโอ 8 วินาที ฉาก Lofi/Chill ที่ loop ได้

ตอบแค่ prompt ล้วนๆ 2-3 ประโยค ห้ามมีหัวข้อ/คำนำหน้า

ห้ามเด็ดขาด:
- ห้ามขึ้นต้นด้วย "ฉาก:", "Prompt:", "**", หัวข้อใดๆ

ตอบ prompt ตรงๆ เลย เช่น:
สาวนั่งอ่านหนังสือข้างหน้าต่าง กล้องนิ่ง แสงแดดส่องผ่าน ใบไม้ไหวเบาๆ`,
      userMessageTemplate: `{{genderText}}{{sceneDescription}}

ตอบแค่ prompt วิดีโอ lofi 8 วินาที ภาษาไทย 2-3 ประโยค (ห้ามมีหัวข้อ/คำนำหน้า กล้องนิ่ง)`
    }
  },

  /**
   * Import AI Story default templates
   */
  async importAIStoryDefaults() {
    await this.init();

    // Ensure AI Story category exists
    let categories = await this.getCategories();
    const existingCategory = categories.find(c => c.id === this.AI_STORY_CATEGORY_ID);
    if (!existingCategory) {
      categories.push({
        id: this.AI_STORY_CATEGORY_ID,
        name: this.AI_STORY_CATEGORY_NAME
      });
      await this.saveCategories(categories);
    }

    let imported = 0;
    let skipped = 0;

    for (const [id, template] of Object.entries(this.AI_STORY_TEMPLATES)) {
      const exists = await this.exists(id);
      if (exists) {
        skipped++;
        continue;
      }

      // Encode thumbnail SVG on-demand
      let thumbnail = template.thumbnail || '';
      if (thumbnail && thumbnail.startsWith('<svg')) {
        thumbnail = 'data:image/svg+xml,' + encodeURIComponent(thumbnail);
      }

      const newPrompt = {
        ...template,
        thumbnail: thumbnail,
        categoryId: this.AI_STORY_CATEGORY_ID,
        isBuiltIn: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await this.save(newPrompt);
      imported++;
    }

    return { imported, skipped };
  },

  /**
   * Get AI Story templates by type
   */
  async getAIStoryTemplates(type) {
    return await this.getByTypeAndCategory(type, this.AI_STORY_CATEGORY_ID);
  },

  /**
   * Re-import AI Story templates - ลบเก่าที่ thumbnail ว่างแล้ว import ใหม่
   */
  async reimportAIStoryDefaults() {
    await this.init();

    let fixed = 0;

    for (const [id, template] of Object.entries(this.AI_STORY_TEMPLATES)) {
      const existing = await this.get(id);

      // ถ้ามีอยู่แล้วและ thumbnail ว่างหรือไม่ใช่ data URI ให้ลบแล้ว import ใหม่
      if (existing && (!existing.thumbnail || !existing.thumbnail.startsWith('data:'))) {
        await this.delete(id);

        // Encode thumbnail SVG
        let thumbnail = template.thumbnail || '';
        if (thumbnail && thumbnail.startsWith('<svg')) {
          thumbnail = 'data:image/svg+xml,' + encodeURIComponent(thumbnail);
        }

        const newPrompt = {
          ...template,
          thumbnail: thumbnail,
          categoryId: this.AI_STORY_CATEGORY_ID,
          isBuiltIn: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        await this.save(newPrompt);
        fixed++;
      }
    }

    return { fixed };
  },

  /**
   * Force update AI Story templates - อัพเดท systemPrompt/userMessageTemplate ให้ตรงกับ built-in
   * ใช้เมื่อแก้ไข template ใน code แล้วต้องการ sync กับ IndexedDB
   */
  async forceUpdateAIStoryTemplates() {
    await this.init();

    let updated = 0;

    for (const [id, template] of Object.entries(this.AI_STORY_TEMPLATES)) {
      const existing = await this.get(id);

      if (existing && existing.isBuiltIn) {
        // Encode thumbnail SVG
        let thumbnail = template.thumbnail || '';
        if (thumbnail && thumbnail.startsWith('<svg')) {
          thumbnail = 'data:image/svg+xml,' + encodeURIComponent(thumbnail);
        }

        // Update with latest template data
        const updatedPrompt = {
          ...existing,
          name: template.name,
          description: template.description,
          systemPrompt: template.systemPrompt,
          userMessageTemplate: template.userMessageTemplate,
          thumbnail: thumbnail,
          updatedAt: Date.now()
        };

        await this.save(updatedPrompt);
        updated++;
      }
    }

    return { updated };
  },

  /**
   * Force update Video templates (UGC ปก, etc.) - อัพเดท systemPrompt ให้ตรงกับ built-in
   * ใช้เมื่อแก้ไข template ใน videoPromptTemplates.js แล้วต้องการ sync กับ IndexedDB
   */
  async forceUpdateVideoTemplates() {
    await this.init();

    // Check if VIDEO_BUILT_IN_TEMPLATES is available
    if (typeof VIDEO_BUILT_IN_TEMPLATES === 'undefined') {
      console.warn('VIDEO_BUILT_IN_TEMPLATES not found');
      return { updated: 0 };
    }

    let updated = 0;

    // Convert to array if object
    const videoArray = Array.isArray(VIDEO_BUILT_IN_TEMPLATES)
      ? VIDEO_BUILT_IN_TEMPLATES
      : Object.values(VIDEO_BUILT_IN_TEMPLATES);

    for (const template of videoArray) {
      if (template.isRandom) continue;

      const existing = await this.get(template.id);

      if (existing && existing.isBuiltIn) {
        // Keep existing thumbnail, update prompts
        const updatedPrompt = {
          ...existing,
          name: template.name,
          description: template.description || '',
          systemPrompt: template.systemPrompt || '',
          userMessageTemplate: template.userMessageTemplate || '',
          updatedAt: Date.now()
        };

        await this.save(updatedPrompt);
        updated++;
        console.log(`Updated video template: ${template.id}`);
      }
    }

    return { updated };
  },

  /**
   * Force update Image templates (UGC รีวิว, etc.) - อัพเดท systemPrompt ให้ตรงกับ built-in
   * ใช้เมื่อแก้ไข template ใน promptTemplates.js แล้วต้องการ sync กับ IndexedDB
   */
  async forceUpdateImageTemplates() {
    await this.init();

    // Check if BUILT_IN_TEMPLATES is available
    if (typeof BUILT_IN_TEMPLATES === 'undefined') {
      console.warn('BUILT_IN_TEMPLATES not found');
      return { updated: 0 };
    }

    let updated = 0;

    // Convert to array if object
    const imageArray = Array.isArray(BUILT_IN_TEMPLATES)
      ? BUILT_IN_TEMPLATES
      : Object.values(BUILT_IN_TEMPLATES);

    for (const template of imageArray) {
      if (template.isRandom) continue;

      const existing = await this.get(template.id);

      if (existing && existing.isBuiltIn) {
        // Keep existing thumbnail, update prompts
        const updatedPrompt = {
          ...existing,
          name: template.name,
          description: template.description || '',
          systemPrompt: template.systemPrompt || '',
          userMessageTemplate: template.userMessageTemplate || '',
          updatedAt: Date.now()
        };

        await this.save(updatedPrompt);
        updated++;
        console.log(`Updated image template: ${template.id}`);
      }
    }

    return { updated };
  }
};

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.PromptStorage = PromptStorage;
}
