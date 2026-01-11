/**
 * Viral Hooks Library Module
 * Provides 50+ viral opening patterns for video content
 * Increases engagement and watch time
 */
class ViralHooks {
    constructor() {
        this.currentHook = null;
        this.hookHistory = [];
    }

    /**
     * Viral hooks organized by category
     */
    static HOOKS = {
        // Surprise & Shock (15 hooks)
        surprise: [
            "คุณเชื่อไหมว่า {topic}",
            "ไม่มีใครบอกคุณเรื่อง {secret}",
            "สิ่งที่คุณไม่รู้เกี่ยวกับ {topic}",
            "ความจริงที่ซ่อนอยู่ของ {topic}",
            "อันตราย! สิ่งที่ {warning}",
            "ผลวิจัยใหม่เผย {fact}",
            "ดูให้จบ! คุณจะตกใจ {reason}",
            "ใครคิดว่า {assumption} คิดผิดแล้ว",
            "นี่คือเหตุผลที่ {reason}",
            "ปรากฏการณ์แปลกที่ {phenomenon}",
            "สิ่งที่เกิดขึ้นเมื่อ {condition}",
            "ไม่น่าเชื่อ! {unbelievable}",
            "คุณกำลังทำผิดพลาดกับ {mistake}",
            "เตรียมตกใจ! {shock}",
            "ความลับที่ {secret_holder} ไม่อยากให้รู้"
        ],

        // Questions (15 hooks)
        question: [
            "ทำไมคนส่วนใหญ่ถึง {action}?",
            "รู้ไหมว่า {fact}?",
            "{topic} ดีจริงหรือ? มาดูกัน",
            "คุณเคย {experience} บ้างไหม?",
            "อะไรคือสาเหตุที่ {problem}?",
            "จะเกิดอะไรขึ้นถ้า {hypothetical}?",
            "คุณรู้วิธี {method} ไหม?",
            "ใครว่า {myth} จริง?",
            "ทำไม {topic} ถึงฮิตขนาดนี้?",
            "คุณเลือกอะไรระหว่าง {option1} กับ {option2}?",
            "อยากรู้ไหมว่า {curiosity}?",
            "คุณทำถูกวิธีแล้วหรือยัง?",
            "มีใครเคย {experience} บ้าง?",
            "คุณเชื่อว่า {belief} จริงไหม?",
            "วิธีไหนดีกว่ากัน {comparison}?"
        ],

        // Problems & Solutions (10 hooks)
        problem: [
            "ถ้าคุณมีปัญหา {problem} ต้องดูนี่",
            "หยุด! ก่อนคุณจะ {wrong_action}",
            "ผิดหวังกับ {disappointment}? ลองนี่",
            "วิธีแก้ {problem} ที่ใช้ได้จริง",
            "เลิกทำ {bad_habit} ได้ด้วยวิธีนี้",
            "ปัญหา {problem} แก้ได้ใน {time}",
            "คุณกำลังเสีย {loss} อยู่หรือเปล่า?",
            "วิธีป้องกัน {problem} ที่คุณควรรู้",
            "ทำไม {problem} ยังไม่หาย? คำตอบคือ...",
            "อย่าให้ {problem} ทำลายชีวิตคุณ"
        ],

        // Trending & FOMO (10 hooks)
        trending: [
            "ทุกคนกำลังพูดถึง {trend}",
            "ยังไม่ลอง {trend}? คุณพลาดแล้ว",
            "กระแสใหม่ที่กำลังฮิต {trend}",
            "ทำไมคนดังใช้ {product} กันหมด?",
            "ปี {year} ต้องมี {must_have}",
            "เทรนด์ใหม่ที่คุณห้ามพลาด {trend}",
            "ใครยังไม่รู้ {trend} เชิญทางนี้",
            "สิ่งที่คนรุ่นใหม่ {generation_trend}",
            "Viral! ปรากฏการณ์ {viral_phenomenon}",
            "แชร์กันระเบิด! {trending_topic}"
        ],

        // Before & After (5 hooks)
        transformation: [
            "ก่อนและหลังใช้ {product} ต่างกันขนาดนี้",
            "เปลี่ยนจาก {before} เป็น {after} ใน {time}",
            "ผลลัพธ์หลังใช้ {duration} คือ...",
            "การเปลี่ยนแปลงที่คุณต้องเห็น",
            "จาก {problem} สู่ {solution} ด้วยวิธีนี้"
        ],

        // Direct Address (5 hooks)
        direct: [
            "เฮ้! คนที่ {target_audience}",
            "สำหรับคุณที่ {situation}",
            "ข้อความนี้ถึง {recipient}",
            "ถ้าคุณ {condition} ต้องดู",
            "คนที่ {characteristic} ต้องรู้เรื่องนี้"
        ]
    };

    /**
     * Initialize the module
     */
    init() {
        this.setupUI();
        console.log('[ViralHooks] Module initialized with', this.getTotalHooksCount(), 'hooks');
    }

    /**
     * Setup UI elements
     */
    setupUI() {
        const hookToggle = document.getElementById('storyUseViralHook');
        const hookSelect = document.getElementById('storyViralHookSelect');
        const hookPreview = document.getElementById('storyViralHookPreview');
        const randomHookBtn = document.getElementById('storyRandomViralHookBtn');

        if (hookToggle) {
            hookToggle.addEventListener('change', (e) => {
                const container = document.getElementById('storyViralHookContainer');
                if (container) {
                    container.hidden = !e.target.checked;
                }
            });
        }

        if (hookSelect) {
            hookSelect.addEventListener('change', () => {
                this.updateHookPreview();
            });
        }

        if (randomHookBtn) {
            randomHookBtn.addEventListener('click', () => {
                this.selectRandomHook();
            });
        }

        // Populate dropdown
        this.populateHookDropdown();
    }

    /**
     * Populate hook category dropdown
     */
    populateHookDropdown() {
        const select = document.getElementById('storyViralHookSelect');
        if (!select) return;

        // Clear existing options (keep first one)
        while (select.options.length > 1) {
            select.remove(1);
        }

        // Add categories
        const categories = [
            { value: 'surprise', label: 'แปลกใจ/ช็อก (15)', count: 15 },
            { value: 'question', label: 'คำถาม (15)', count: 15 },
            { value: 'problem', label: 'ปัญหา/แก้ไข (10)', count: 10 },
            { value: 'trending', label: 'กระแส/FOMO (10)', count: 10 },
            { value: 'transformation', label: 'ก่อน-หลัง (5)', count: 5 },
            { value: 'direct', label: 'เรียกตรง (5)', count: 5 }
        ];

        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.value;
            option.textContent = cat.label;
            select.appendChild(option);
        });
    }

    /**
     * Select random hook from selected category
     */
    selectRandomHook() {
        const select = document.getElementById('storyViralHookSelect');
        if (!select || select.value === '') return;

        const category = select.value;
        const hooks = ViralHooks.HOOKS[category];
        if (!hooks || hooks.length === 0) return;

        // Pick random hook
        const randomIndex = Math.floor(Math.random() * hooks.length);
        const hook = hooks[randomIndex];

        this.currentHook = {
            category,
            template: hook,
            index: randomIndex
        };

        this.updateHookPreview();

        if (typeof showToast === 'function') {
            showToast(`🎣 สุ่ม Hook: ${this.formatHookForDisplay(hook)}`, 'info');
        }
    }

    /**
     * Update hook preview
     */
    updateHookPreview() {
        const select = document.getElementById('storyViralHookSelect');
        const preview = document.getElementById('storyViralHookPreview');

        if (!select || !preview) return;

        if (select.value === '') {
            preview.textContent = 'เลือกประเภท Hook แล้วกด "สุ่ม" หรือใช้ hook ที่สุ่มไว้';
            preview.style.color = 'var(--text-secondary)';
            return;
        }

        if (!this.currentHook) {
            preview.textContent = 'กด "สุ่ม" เพื่อเลือก Hook';
            preview.style.color = 'var(--text-secondary)';
            return;
        }

        const exampleTopic = this.getExampleForCategory(this.currentHook.category);
        const formattedHook = this.formatHook(this.currentHook.template, exampleTopic);

        preview.innerHTML = `<strong>ตัวอย่าง:</strong> "${formattedHook}"`;
        preview.style.color = 'var(--text-primary)';
    }

    /**
     * Get example placeholders for category
     */
    getExampleForCategory(category) {
        const examples = {
            surprise: { topic: 'ครีมบำรุงผิว', secret: 'วิธีใช้ที่ถูกต้อง', warning: 'คุณควรหลีกเลี่ยง' },
            question: { fact: 'ผิวแห้งเกิดจากอากาศ', action: 'ใช้ครีมผิด', experience: 'ผิวแพ้' },
            problem: { problem: 'สิว', wrong_action: 'ซื้อ', disappointment: 'ครีมราคาแพง' },
            trending: { trend: 'ครีมนี้', product: 'ผลิตภัณฑ์นี้', year: '2026' },
            transformation: { product: 'ครีม X', before: 'ผิวหมองคล้ำ', after: 'ผิวใส', time: '7 วัน' },
            direct: { target_audience: 'ผิวแห้ง', situation: 'กำลังมองหาครีม', condition: 'อายุ 30+' }
        };
        return examples[category] || {};
    }

    /**
     * Format hook template with placeholders
     */
    formatHook(template, values) {
        let result = template;
        for (const [key, value] of Object.entries(values)) {
            result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
        }
        return result;
    }

    /**
     * Format hook for display (show placeholders)
     */
    formatHookForDisplay(template) {
        return template.substring(0, 50) + (template.length > 50 ? '...' : '');
    }

    /**
     * Get total hooks count
     */
    getTotalHooksCount() {
        return Object.values(ViralHooks.HOOKS).reduce((sum, hooks) => sum + hooks.length, 0);
    }

    /**
     * Get current selected hook
     */
    getCurrentHook() {
        return this.currentHook;
    }

    /**
     * Check if viral hook is enabled
     */
    isEnabled() {
        const toggle = document.getElementById('storyUseViralHook');
        return toggle ? toggle.checked : false;
    }

    /**
     * Apply hook to scene description
     * @param {string} sceneDescription - Original scene description
     * @param {object} context - Context variables (topic, product, etc.)
     * @returns {string} - Scene with hook prepended
     */
    applyHookToScene(sceneDescription, context = {}) {
        if (!this.isEnabled() || !this.currentHook) {
            return sceneDescription;
        }

        // Format hook with context
        const formattedHook = this.formatHook(this.currentHook.template, context);

        // Prepend hook to scene (for first scene only)
        return `${formattedHook}\n\n${sceneDescription}`;
    }

    /**
     * Get hook for first scene only
     * @param {number} sceneNumber - Current scene number (1-based)
     * @param {string} sceneDescription - Scene description
     * @param {object} context - Context variables
     * @returns {string} - Scene with or without hook
     */
    getSceneWithHook(sceneNumber, sceneDescription, context = {}) {
        // Only apply to first scene
        if (sceneNumber === 1) {
            return this.applyHookToScene(sceneDescription, context);
        }
        return sceneDescription;
    }

    /**
     * Extract topic from story details for context
     * @param {string} storyDetails - Full story details
     * @returns {object} - Extracted context
     */
    extractContextFromStory(storyDetails) {
        const context = {
            topic: 'หัวข้อนี้',
            product: 'ผลิตภัณฑ์',
            fact: 'ข้อเท็จจริงนี้',
            problem: 'ปัญหานี้',
            secret: 'ความลับ',
            trend: 'เทรนด์นี้'
        };

        // Try to extract topic from first line
        const firstLine = storyDetails.split('\n')[0];
        if (firstLine && firstLine.trim()) {
            context.topic = firstLine.trim().replace(/ฉากที่\s*\d+:\s*/g, '').substring(0, 30);
        }

        return context;
    }

    /**
     * Save hook to history
     */
    saveToHistory(hook) {
        this.hookHistory.push({
            ...hook,
            timestamp: Date.now()
        });

        // Keep only last 20
        if (this.hookHistory.length > 20) {
            this.hookHistory.shift();
        }
    }

    /**
     * Get hooks by category
     */
    getHooksByCategory(category) {
        return ViralHooks.HOOKS[category] || [];
    }

    /**
     * Get all categories
     */
    getAllCategories() {
        return Object.keys(ViralHooks.HOOKS);
    }

    /**
     * Get random hook from any category
     */
    getRandomHookFromAll() {
        const allCategories = this.getAllCategories();
        const randomCategory = allCategories[Math.floor(Math.random() * allCategories.length)];
        const hooks = this.getHooksByCategory(randomCategory);
        const randomHook = hooks[Math.floor(Math.random() * hooks.length)];

        return {
            category: randomCategory,
            template: randomHook,
            index: hooks.indexOf(randomHook)
        };
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.ViralHooks = ViralHooks;
}
