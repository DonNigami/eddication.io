/**
 * Cover Details Module
 * Handles cover heading fields with spin text support
 */
const CoverDetails = {
  isGenerating: false,
  warehouseMainHeading: '',
  warehouseSubHeading: '',

  /**
   * Initialize cover details
   */
  init() {
    this.setupToggle();
    this.setupGenerateButton();
  },

  /**
   * Setup toggle checkbox to show/hide content
   */
  setupToggle() {
    const checkbox = document.getElementById('coverDetailsEnabled');
    const content = document.getElementById('coverDetailsContent');

    if (checkbox && content) {
      // Set initial state
      content.hidden = !checkbox.checked;

      // Listen for changes
      checkbox.addEventListener('change', () => {
        content.hidden = !checkbox.checked;
      });
    }
  },

  /**
   * Load headings from warehouse product
   */
  loadFromWarehouse(mainHeading, subHeading) {
    this.warehouseMainHeading = mainHeading || '';
    this.warehouseSubHeading = subHeading || '';

    // Also update the form fields for display
    if (mainHeading) {
      document.getElementById('mainHeading').value = mainHeading;
    }
    if (subHeading) {
      document.getElementById('subHeading').value = subHeading;
    }
  },

  /**
   * Setup generate details button
   */
  setupGenerateButton() {
    const btn = document.getElementById('generateDetailsBtn');
    btn.addEventListener('click', () => this.generateDetails());
  },

  /**
   * Generate headings using AI
   */
  async generateDetails() {
    if (this.isGenerating) return;

    // ดึงชื่อสินค้าตามโหมดที่เลือก
    const mode = await ProductWarehouse.getMode();
    let productName;

    if (mode === 'warehouse') {
      productName = document.getElementById('warehouseProductName').value.trim();
    } else {
      productName = document.getElementById('productName').value.trim();
    }

    if (!productName) {
      Helpers.showToast('กรุณากรอกชื่อสินค้าก่อน', 'error');
      return;
    }

    // Get API settings
    const settings = await this.getSettings();
    if (!settings.apiKey) {
      Helpers.showToast('กรุณาตั้งค่า API Key ก่อน', 'error');
      return;
    }

    this.isGenerating = true;
    const btn = document.getElementById('generateDetailsBtn');
    btn.disabled = true;
    btn.textContent = 'กำลังสร้าง...';

    try {
      const result = await this.callAiForHeadings(settings, productName);

      // Fill form with spin format
      document.getElementById('mainHeading').value = result.mainHeadings.join('|');
      document.getElementById('subHeading').value = result.subHeadings.join('|');

      FormState.saveFormState();
      Helpers.showToast('สร้างรายละเอียดสำเร็จ', 'success');
    } catch (error) {
      console.error('Error generating details:', error);
      Helpers.showToast(`เกิดข้อผิดพลาด: ${error.message}`, 'error');
    } finally {
      this.isGenerating = false;
      btn.disabled = false;
      btn.textContent = 'สร้างรายละเอียด';
    }
  },

  /**
   * Get API settings
   */
  getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['geminiApiKey', 'openaiApiKey', 'selectedModel'], (result) => {
        const model = result.selectedModel || 'gemini';
        const apiKey = model === 'gemini' ? result.geminiApiKey : result.openaiApiKey;
        resolve({ model, apiKey });
      });
    });
  },

  /**
   * Call AI to generate headings
   */
  async callAiForHeadings(settings, productName) {
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
      response = await this.callGemini(settings.apiKey, systemPrompt, userMessage);
    } else {
      response = await this.callOpenai(settings.apiKey, systemPrompt, userMessage);
    }

    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('ไม่สามารถแปลงผลลัพธ์ได้');
  },

  /**
   * Call Gemini API
   */
  async callGemini(apiKey, systemPrompt, userMessage) {
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
  },

  /**
   * Call OpenAI API (Responses API)
   */
  async callOpenai(apiKey, systemPrompt, userMessage) {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-5-nano',
        instructions: systemPrompt,
        input: userMessage
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'OpenAI API error');
    }

    const data = await response.json();

    // Extract text from output array
    const textOutput = data.output?.find(item => item.type === 'message');
    const content = textOutput?.content?.find(c => c.type === 'output_text');
    return content?.text || data.output_text || '';
  },

  /**
   * Spin text - สุ่มเลือกจาก "xxx|yyy|zzz"
   * @param {string} text - Text with spin syntax
   * @returns {string} - Random selected text
   */
  spinText(text) {
    if (!text) return '';

    // ถ้ามี | ให้สุ่มเลือก
    if (text.includes('|')) {
      const options = text.split('|').map(s => s.trim()).filter(s => s);
      if (options.length > 0) {
        const randomIndex = Math.floor(Math.random() * options.length);
        return options[randomIndex];
      }
    }

    return text;
  },

  /**
   * Check if cover details is enabled
   */
  isEnabled() {
    const checkbox = document.getElementById('coverDetailsEnabled');
    return checkbox ? checkbox.checked : true;
  },

  /**
   * Get cover details with spin applied
   */
  async getDetails() {
    // ถ้าปิดใช้งาน ให้ return ค่าว่าง
    if (!this.isEnabled()) {
      return {
        useAi: false,
        mainHeading: '',
        subHeading: '',
        price: ''
      };
    }

    const mode = await ProductWarehouse.getMode();

    // ถ้าโหมดคลัง และมีข้อมูลจากคลัง ให้ใช้ค่าจากคลัง
    if (mode === 'warehouse') {
      const product = await ProductWarehouse.getSelectedProduct();
      if (product) {
        return {
          useAi: false,
          mainHeading: this.spinText(product.mainHeading || document.getElementById('mainHeading').value),
          subHeading: this.spinText(product.subHeading || document.getElementById('subHeading').value),
          price: this.spinText(document.getElementById('price').value)
        };
      }
    }

    return {
      useAi: false,
      mainHeading: this.spinText(document.getElementById('mainHeading').value),
      subHeading: this.spinText(document.getElementById('subHeading').value),
      price: this.spinText(document.getElementById('price').value)
    };
  },

  /**
   * Get raw details without spin (for display)
   */
  getRawDetails() {
    return {
      mainHeading: document.getElementById('mainHeading').value,
      subHeading: document.getElementById('subHeading').value,
      price: document.getElementById('price').value
    };
  }
};
