// Content script สำหรับเชื่อมต่อกับหน้า Google Labs Flow

console.log('Flow Auto 2026 by AI Influencer TH content script loaded');

// ฟังก์ชันส่งสถานะไปยัง sidepanel
function sendStatusToSidepanel(type, data = {}) {
  try {
    chrome.runtime.sendMessage({
      action: 'automationStatus',
      status: {
        type: type,
        ...data
      }
    }).catch(() => {
      // Ignore error if sidepanel is not open
    });
  } catch (error) {
    // Ignore error if sidepanel is not open
  }
}

// รับข้อความจาก extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request.action);
  
  if (request.action === 'ping') {
    // ตอบกลับว่า content script พร้อมแล้ว
    sendResponse({ ready: true });
    return true;
  }
  
  if (request.action === 'fillForm') {
    console.log('Received form data:', request.data);
    console.log('Received images:', request.images?.length || 0);
    
    try {
      // รอให้หน้าโหลดเสร็จ
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          fillFlowForm(request.data, request.images);
        });
      } else {
        fillFlowForm(request.data, request.images);
      }
      
      sendResponse({ success: true });
    } catch (error) {
      console.error('Error filling form:', error);
      sendResponse({ success: false, error: error.message });
    }
  } else if (request.action === 'startBatch') {
    console.log('Received batch tasks:', request.tasks.length);
    
    // Clear old state
    automationState = {
      isActive: true,
      isPaused: false,
      batchCount: 0,
      maxBatch: request.tasks.length,
      cooldown: request.settings?.taskCooldown || 15000,
      settings: request.settings || {},
      tasks: request.tasks,
      currentTaskIndex: 0,
      completedInBatch: 0
    };
    
    showNotification(`🚀 เริ่มต้นสร้าง ${request.tasks.length} รายการ...`);
    
    // ส่งสถานะเริ่มต้น
    sendStatusToSidepanel('started', {
      total: request.tasks.length
    });
    
    processNextTask();
    sendResponse({ success: true });
  } else if (request.action === 'checkSceneBuilder') {
    // ตรวจสอบว่าเป็นหน้า SceneBuilder หรือไม่
    const isSceneBuilder = !!(
      document.querySelector('button[aria-selected="true"]')?.textContent?.includes('SceneBuilder') ||
      document.querySelector('.active-tab')?.textContent?.includes('SceneBuilder') ||
      document.querySelector('[data-state="active"]')?.textContent?.includes('SceneBuilder') ||
      // Fallback: check if there is an explicit SceneBuilder header/label that is visible
      Array.from(document.querySelectorAll('h1, h2, h3, div[role="tab"]')).some(el => el.textContent.includes('SceneBuilder') && el.getAttribute('data-state') === 'active')
    );
    console.log('Check SceneBuilder status:', isSceneBuilder);
    sendResponse({ isSceneBuilder });
  } else if (request.action === 'inspectPage') {
    // ตรวจสอบโครงสร้างหน้า
    const pageInfo = inspectPageStructure();
    sendResponse(pageInfo);
  } else if (request.action === 'pauseAutomation') {
    automationState.isPaused = !automationState.isPaused;
    console.log('Automation paused:', automationState.isPaused);
    showNotification(automationState.isPaused ? '⏸ Automation Paused' : '▶ Automation Resumed');
    sendResponse({ success: true, isPaused: automationState.isPaused });
  } else if (request.action === 'stopAutomation') {
    automationState.isActive = false;
    automationState.isPaused = false;
    clearAllTimers(); // Clear all timers
    console.log('Automation stopped');
    showNotification('⏹ Automation Stopped');
    
    // ส่งสถานะหยุด
    sendStatusToSidepanel('stopped');
    
    sendResponse({ success: true });
  } else if (request.action === 'clearAutomation') {
    automationState = {
      isActive: false,
      isPaused: false,
      batchCount: 0,
      maxBatch: 0,
      cooldown: 15000,
      tasks: [],
      currentTaskIndex: 0
    };
    clearAllTimers(); // Clear all timers
    console.log('Automation cleared');
    showNotification('🗑 Automation Cleared');
    
    // ส่งสถานะล้าง
    sendStatusToSidepanel('stopped');
    
    sendResponse({ success: true });
  }
  
  return true; // Keep message channel open for async response
});

// ฟังก์ชันตรวจสอบโครงสร้างหน้า
function inspectPageStructure() {
  const info = {
    inputs: [],
    textareas: [],
    fileInputs: [],
    buttons: [],
    selects: []
  };
  
  // ค้นหา input ทั้งหมด
  document.querySelectorAll('input').forEach(input => {
    info.inputs.push({
      type: input.type,
      name: input.name,
      id: input.id,
      placeholder: input.placeholder,
      className: input.className
    });
  });
  
  // ค้นหา textarea ทั้งหมด
  document.querySelectorAll('textarea').forEach(textarea => {
    info.textareas.push({
      name: textarea.name,
      id: textarea.id,
      placeholder: textarea.placeholder,
      className: textarea.className
    });
  });
  
  // ค้นหา file input
  document.querySelectorAll('input[type="file"]').forEach(input => {
    info.fileInputs.push({
      name: input.name,
      id: input.id,
      accept: input.accept,
      className: input.className
    });
  });
  
  // ค้นหา button
  document.querySelectorAll('button').forEach(button => {
    info.buttons.push({
      text: button.textContent.trim(),
      id: button.id,
      className: button.className
    });
  });
  
  // ค้นหา select
  document.querySelectorAll('select').forEach(select => {
    info.selects.push({
      name: select.name,
      id: select.id,
      className: select.className
    });
  });
  
  console.log('Page structure:', info);
  return info;
}

// ตัวแปรสำหรับ Download Monitoring
let downloadMonitoringActive = false;
let downloadedVideos = new Set();

// ฟังก์ชันตรวจสอบ popup blocker
function isPopupBlocked() {
  try {
    const testWindow = window.open('', '_blank', 'width=1,height=1');
    if (testWindow) {
      testWindow.close();
      return false;
    }
    return true;
  } catch (e) {
    return true;
  }
}

// ตัวแปรสำหรับ Automation Loop
let automationState = {
  isActive: false,
  isPaused: false,
  batchCount: 0,
  maxBatch: 0,
  cooldown: 5000,
  settings: {},
  tasks: [],
  currentTaskIndex: 0,
  completedInBatch: 0
};

// Global tracking for timers
let activeTimeouts = [];
let activeIntervals = [];

// ป้องกันการหยุดทำงานเมื่อสลับแท็บ
let isPageVisible = true;
let backgroundTaskQueue = [];

// ตรวจสอบสถานะการมองเห็นหน้า
document.addEventListener('visibilitychange', () => {
    const wasVisible = isPageVisible;
    isPageVisible = !document.hidden;
    console.log('Page visibility changed:', isPageVisible ? 'visible' : 'hidden');
    
    if (isPageVisible && backgroundTaskQueue.length > 0) {
        console.log('Page became visible, processing queued tasks...');
        // ประมวลผลงานที่ค้างอยู่
        backgroundTaskQueue.forEach(task => task());
        backgroundTaskQueue = [];
    }
    
    // ถ้าหน้าไม่ visible แต่ automation ยังทำงานอยู่ ให้แจ้งเตือน
    if (!isPageVisible && (automationState.isActive || workflowState.isActive)) {
        console.log('Page hidden but automation is active - continuing in background');
        showNotification('🔄 โปรแกรมยังทำงานอยู่ในพื้นหลัง...');
    }
});

// ป้องกันการหยุดทำงานเมื่อสลับหน้าต่าง
window.addEventListener('blur', () => {
    console.log('Window lost focus - automation continues');
    if (automationState.isActive || workflowState.isActive) {
        showNotification('🔄 โปรแกรมยังทำงานอยู่ในพื้นหลัง...');
    }
});

window.addEventListener('focus', () => {
    console.log('Window gained focus');
    if (automationState.isActive || workflowState.isActive) {
        showNotification('👁️ กลับมาแล้ว - โปรแกรมยังทำงานอยู่');
    }
});

function safeTimeout(callback, delay) {
    const id = setTimeout(() => {
        activeTimeouts = activeTimeouts.filter(t => t !== id);
        if (!automationState.isActive && !workflowState.isActive) return;
        
        // ถ้าหน้าไม่ visible ให้ทำงานต่อไปแต่เก็บ log
        if (!isPageVisible && (automationState.isActive || workflowState.isActive)) {
            console.log('Executing task in background (page not visible)');
        }
        
        callback();
    }, delay);
    activeTimeouts.push(id);
    return id;
}

function safeSetInterval(callback, delay) {
    const id = setInterval(() => {
        if (!automationState.isActive && !workflowState.isActive) {
            clearInterval(id);
            activeIntervals = activeIntervals.filter(i => i !== id);
            return;
        }
        
        // ถ้าหน้าไม่ visible ให้ทำงานต่อไปแต่เก็บ log
        if (!isPageVisible && (automationState.isActive || workflowState.isActive)) {
            console.log('Executing interval task in background (page not visible)');
        }
        
        callback();
    }, delay);
    activeIntervals.push(id);
    return id;
}

function clearAllTimers() {
    activeTimeouts.forEach(clearTimeout);
    activeTimeouts = [];
    activeIntervals.forEach(clearInterval);
    activeIntervals = [];
    backgroundTaskQueue = [];
    console.log('All automation timers cleared');
}

// ฟังก์ชันเริ่มทำ Task ถัดไป
function processNextTask() {
    if (!automationState.isActive) {
        console.log('Automation stopped by user');
        return;
    }
    
    if (automationState.isPaused) {
        console.log('Paused... waiting');
        safeTimeout(processNextTask, 1000);
        return;
    }

    if (automationState.currentTaskIndex >= automationState.tasks.length) {
        console.log('All tasks completed successfully!');
        showNotification('✅ เสร็จสิ้นทุกรายการแล้ว!');
        
        // ส่งสถานะเสร็จสิ้น
        sendStatusToSidepanel('completed', {
          total: automationState.tasks.length
        });
        
        automationState.isActive = false;
        return;
    }

    const task = automationState.tasks[automationState.currentTaskIndex];
    const currentIndex = automationState.currentTaskIndex + 1;
    const totalTasks = automationState.tasks.length;
    
    console.log(`Processing task ${currentIndex}/${totalTasks}`);
    showNotification(`⏳ กำลังทำรายการที่ ${currentIndex}/${totalTasks}...`);
    
    // ส่งสถานะความคืบหน้า
    sendStatusToSidepanel('progress', {
      current: currentIndex,
      total: totalTasks
    });

    // เริ่มกระบวนการสำหรับ Task นี้
    // ถ้าไม่ใช่รอบแรก รอสักพักเพื่อให้ UI พร้อม
    if (automationState.currentTaskIndex > 0) {
        console.log('Preparing for next task...');
        
        // รอให้ UI พร้อมสำหรับ task ใหม่
        safeTimeout(() => {
            performTask(task);
        }, 3000); // เพิ่มเวลารอเป็น 3 วินาที
    } else {
        performTask(task);
    }
}

// ฟังก์ชันรีเซ็ต UI ก่อนเริ่ม task ใหม่
function resetUIForNewTask() {
    try {
        console.log('Resetting UI for new task...');
        
        // ลบรูปภาพเก่าที่อาจจะยังค้างอยู่
        const existingImages = document.querySelectorAll('img[alt*="Product"], img[src*="blob:"]');
        existingImages.forEach(img => {
            const removeBtn = img.parentElement?.querySelector('button[aria-label*="remove"], button[title*="remove"], .remove-btn');
            if (removeBtn) {
                console.log('Removing old image');
                simulateClick(removeBtn);
            }
        });
        
        // เคลียร์ textarea
        const textareas = document.querySelectorAll('textarea');
        textareas.forEach(textarea => {
            if (textarea.value) {
                textarea.value = '';
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                textarea.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        
        console.log('UI reset completed');
        return true;
    } catch (error) {
        console.error('Error resetting UI:', error);
        return false;
    }
}

// ฟังก์ชันคลิกคำสั่ง Extend
function clickExtendButton() {
    console.log('Looking for Extend button...');
    
    // 1. Try Specific Selector from user (might be dynamic ID, so handle with care)
    try {
        // User provided: #radix-\:r1db\: > div:nth-child(2)
        // We also try a more generic approach for Radix menus: [id^="radix-"] > div:nth-child(2)
        const specificSelector = document.querySelector('#radix-\\:r1db\\: > div:nth-child(2)');
        if (specificSelector && specificSelector.textContent.includes('Extend')) {
            console.log('Found Extend button via specific selector');
            specificSelector.click();
            showNotification('✓ คลิกคำสั่ง Extend (Selector)');
            return true;
        }
        
        // Try generic Radix menu item (2nd item often Extend)
        const radixItems = document.querySelectorAll('[role="menuitem"], [id^="radix-"] > div');
        for (const item of radixItems) {
            if (item.textContent.includes('Extend') && item.offsetParent !== null) {
                console.log('Found Extend button in Radix menu');
                item.click();
                showNotification('✓ คลิกคำสั่ง Extend (Menu)');
                return true;
            }
        }
    } catch (e) {
        console.error('Error finding Extend button via selector:', e);
    }

    // 2. Fallback: Helper to find button by text/aria-label
    const findBtn = (keyword) => {
        const buttons = document.querySelectorAll('button, div[role="button"], span[role="button"], li[role="menuitem"], div[role="menuitem"], span');
        for (const btn of buttons) {
            const text = btn.textContent?.trim() || '';
            const ariaLabel = btn.getAttribute('aria-label') || '';
            
            if ((text.includes(keyword) || ariaLabel.includes(keyword)) && btn.offsetParent !== null) {
                return btn;
            }
        }
        return null;
    };

    // Try to find by aria-label "Extend" specifically as requested
    let extendBtn = document.querySelector('[aria-label*="Extend"]');
    
    if (!extendBtn) {
         extendBtn = findBtn('Extend');
    }
    
    if (extendBtn) {
        console.log('Found Extend button via text search:', extendBtn);
        // Highlight
        const originalBorder = extendBtn.style.border;
        extendBtn.style.border = '2px solid yellow';
        setTimeout(() => extendBtn.style.border = originalBorder, 500);
        
        extendBtn.click();
        showNotification('✓ คลิกคำสั่ง Extend...');
        return true;
    }
    
    console.log('Extend button not found');
    return false;
}

// ==========================================
// Extend Scene Logic
// ==========================================

function handleExtendScene(task) {
    console.log('Handling Extend Scene:', task.prompt);
    showNotification(`🎬 Extend Scene: ${task.prompt.substring(0, 30)}...`);

    // 1. Click "+" button
    findAndClickPlusButton(() => {
        // 2. Click Extend
        safeTimeout(() => {
            const success = clickExtendButton(); // Reuse existing function
            if (!success) {
                // Retry once
                console.log('Retry clicking Extend...');
                safeTimeout(() => {
                    const retrySuccess = clickExtendButton();
                    if (!retrySuccess) {
                        console.error('Failed to click Extend');
                        showNotification('⚠️ ไม่พบคำสั่ง Extend');
                        // Proceed to next task (skip)
                         automationState.currentTaskIndex++;
                         processNextTask();
                    } else {
                         proceedToFillAndSend(task);
                    }
                }, 1000);
            } else {
                 proceedToFillAndSend(task);
            }
        }, 1500);
    });
}

function proceedToFillAndSend(task) {
    // 3. Fill Prompt
    safeTimeout(() => {
        fillScriptField(task.prompt);

        // 4. Click Send
        safeTimeout(() => {
            clickSendButton();

            // 5. Wait for completion
            if (task.mode === 'extend') {
                waitForExtendCompletion();
            } else {
                waitForGenerationCompletion();
            }
        }, 2000);
    }, 2000);
}

function waitForExtendCompletion() {
    console.log('Waiting for Extend completion (80% via aria-label)...');
    showNotification('⏳ รอการประมวลผล (เป้าหมาย 80%)...');
    
    let attempts = 0;
    const maxAttempts = 600; // 5 minutes
    
    const interval = safeSetInterval(() => {
        attempts++;
        
        // Check for aria-label with percentage >= 80%
        let isReady = false;
        
        // 1. Check aria-label
        const elements = document.querySelectorAll('[aria-label]');
        for (const el of elements) {
            const label = el.getAttribute('aria-label');
            const match = label.match(/(\d+)%/);
            if (match) {
                const percent = parseInt(match[1]);
                if (percent >= 80) {
                    console.log(`Found progress ${percent}% via aria-label:`, label);
                    isReady = true;
                    break;
                }
            }
        }
        
        // 2. Fallback: Check text content for 100% (just in case)
        if (!isReady) {
            const textElements = document.querySelectorAll('span, div, p');
            for (const el of textElements) {
                if (el.textContent.includes('100%') && el.offsetParent !== null) {
                    console.log('Found 100% text content');
                    isReady = true;
                    break;
                }
            }
        }
        
        if (isReady) {
            clearInterval(interval);
            activeIntervals = activeIntervals.filter(i => i !== interval);
            console.log('Extend target reached (>=80%)!');
            showNotification('✅ ถึง 80% แล้ว - เริ่มรายการถัดไป');
            
            safeTimeout(() => {
                automationState.currentTaskIndex++;
                processNextTask();
            }, 2000);
        } else if (attempts >= maxAttempts) {
             clearInterval(interval);
             activeIntervals = activeIntervals.filter(i => i !== interval);
             console.warn('Timeout waiting for extend completion');
             showNotification('⚠️ หมดเวลารอ - ข้ามไปรายการถัดไป');
             automationState.currentTaskIndex++;
             processNextTask();
        }
    }, 1000);
}

function findAndClickPlusButton(callback) {
    console.log('Looking for (+) button...');
    let attempts = 0;
    const interval = safeSetInterval(() => {
        attempts++;
        
        // 1. Priority: Specific Selector #PINHOLE_ADD_CLIP_CARD_ID
        const pinholeBtn = document.getElementById('PINHOLE_ADD_CLIP_CARD_ID');
        if (pinholeBtn) {
            clearInterval(interval);
            activeIntervals = activeIntervals.filter(i => i !== interval);
            simulateClick(pinholeBtn);
            console.log('Clicked + button (#PINHOLE_ADD_CLIP_CARD_ID)');
            if (callback) safeTimeout(callback, 1000);
            return;
        }

        // 2. Fallback: Aria-label "Add" or text "+"
        const buttons = document.querySelectorAll('button, div[role="button"]');
        let plusBtn = null;
        
        for (const btn of buttons) {
            const text = btn.textContent.trim();
            const ariaLabel = btn.getAttribute('aria-label') || '';
            
            if ((text === '+' || ariaLabel === 'Add' || ariaLabel.includes('Add Scene')) && !ariaLabel.includes('Image')) {
                if (btn.offsetParent !== null) {
                    plusBtn = btn;
                    break;
                }
            }
        }
        
        if (plusBtn) {
            clearInterval(interval);
            activeIntervals = activeIntervals.filter(i => i !== interval);
            simulateClick(plusBtn);
            console.log('Clicked + button (Fallback)');
            if (callback) safeTimeout(callback, 1000);
        } else if (attempts > 10) {
            clearInterval(interval);
            activeIntervals = activeIntervals.filter(i => i !== interval);
            console.error('Could not find + button');
            showNotification('⚠️ ไม่พบปุ่ม +');
            // Move to next task
            automationState.currentTaskIndex++;
            processNextTask();
        }
    }, 500);
}

function waitForGenerationCompletion() {
    console.log('Waiting for generation to complete (100%)...');
    let attempts = 0;
    const maxAttempts = 600; // 5 minutes
    
    const interval = safeSetInterval(() => {
        attempts++;
        
        // Check for "100%" text or "Complete"
        let isComplete = false;
        
        const elements = document.querySelectorAll('span, div, p');
        for (const el of elements) {
            if (el.textContent.includes('100%') && el.offsetParent !== null) {
                isComplete = true;
                break;
            }
        }
        
        if (isComplete) {
            clearInterval(interval);
            activeIntervals = activeIntervals.filter(i => i !== interval);
            console.log('Generation completed!');
            showNotification('✅ สร้างเสร็จแล้ว (100%)');
            
            safeTimeout(() => {
                automationState.currentTaskIndex++;
                processNextTask();
            }, 3000);
        } else if (attempts >= maxAttempts) {
             clearInterval(interval);
             activeIntervals = activeIntervals.filter(i => i !== interval);
             console.warn('Timeout waiting for completion');
             showNotification('⚠️ หมดเวลารอ - ข้ามไปรายการถัดไป');
             automationState.currentTaskIndex++;
             processNextTask();
        }
    }, 1000);
}

function performTask(task) {
    try {
        if (!automationState.isActive) {
            console.log('Task aborted: automation is not active');
            return;
        }
        console.log('Starting task with prompt:', task.prompt.substring(0, 50) + '...');
        console.log('Task mode:', task.mode);
        
        if (task.mode === 'extend') {
            handleExtendScene(task);
            return;
        }

        // 0. Reset UI ก่อนเริ่มงานใหม่ (ยกเว้นรอบแรก)
        if (automationState.currentTaskIndex > 0) {
            resetUIForNewTask();
        }
        
        // 1. Select Frames to Video (รอนานขึ้นเพื่อให้แน่ใจ) - เฉพาะโหมด Image
        if (task.mode === 'image') {
            safeTimeout(() => {
                const success = selectFramesToVideo();
                if (!success) {
                    console.log('Failed to select Frames to Video, but continuing...');
                }
            }, 1000);
        }

        // 1.5 Try to click Extend button (After selecting mode, before filling script)
        safeTimeout(() => {
            clickExtendButton();
        }, task.mode === 'image' ? 2500 : 1500);

        // 2. Fill Script (รอให้ UI พร้อม และหลังกด Extend)
        safeTimeout(() => {
            fillScriptField(task.prompt);
        }, task.mode === 'image' ? 4000 : 2500);

        if (task.mode === 'text') {
            // โหมด Text to Video & Scene
            
            // ถ้ามีรูปภาพ ให้พยายามอัปโหลดรูปด้วย (SceneBuilder)
            if (task.image) {
                console.log('Text to Video & Scene mode (SceneBuilder) - uploading image');
                showNotification('📝 SceneBuilder - กำลังอัปโหลดรูปภาพ');
                
                // ตรวจสอบว่าเป็น SceneBuilder หรือไม่
                const isSceneBuilder = document.querySelector('button[aria-selected="true"]')?.textContent?.includes('SceneBuilder') ||
                                     document.querySelector('.active-tab')?.textContent?.includes('SceneBuilder') ||
                                     document.body.innerText.includes('SceneBuilder');
                                     
                if (isSceneBuilder) {
                    console.log('Confirmed SceneBuilder mode');
                } else {
                    console.log('Not in SceneBuilder mode explicitly, but trying to upload anyway');
                }
                
                // Upload Image (รอให้ script field เสร็จ)
                safeTimeout(() => {
                    console.log('Checking UI for image upload (SceneBuilder)...');
                    // ใช้ Logic การหาปุ่มเหมือน Frames to Video
                    handleImageUpload(task.image, 0, task.color);
                    
                    // หลังจากอัปโหลดรูปเสร็จ (กะเวลาเอา) ให้กด Send
                    safeTimeout(() => {
                        clickSendButton();
                    }, 8000); // รอ 8 วินาทีสำหรับการอัปโหลดและ crop
                    
                }, 3000);
                
            } else {
                // ถ้าไม่มีรูป (Text to Video & Scene ปกติ)
                console.log('Text to Video & Scene mode - skipping image upload, clicking Send directly');
                showNotification('📝 Text to Video & Scene - ข้าม image upload');
                
                safeTimeout(() => {
                    clickSendButton();
                }, 3000);
            }
        } else {
            // โหมด Frames to Video & Images - อัปโหลดรูปตามปกติ
            console.log('Frames to Video & Images mode - uploading image');
            
            // 3. Upload Image (รอให้ script field เสร็จ)
            safeTimeout(() => {
                console.log('Checking UI for image upload...');
                const addBtnSelector = '#__next > div.sc-c7ee1759-1.crzReP > div > div > div.sc-b0c0bd7-1.kvzLFA > div > div.sc-897c0dbb-0.eHacXb > div.sc-77366d4e-0.eaiEre > div > div > div.sc-408537d4-0.eBSqXt > div:nth-child(1) > div > div:nth-child(1) > button';
                
                let attempts = 0;
                const maxAttempts = 15; // เพิ่มจำนวนครั้งที่ลอง
                
                const checkUIReady = safeSetInterval(() => {
                    attempts++;
                    const addBtn = document.querySelector(addBtnSelector);
                    
                    if (addBtn) {
                        clearInterval(checkUIReady);
                        activeIntervals = activeIntervals.filter(i => i !== checkUIReady);
                        console.log('✓ UI Ready for image upload');
                        handleImageUpload(task.image, 0, task.color); 
                    } else if (attempts >= maxAttempts) {
                        clearInterval(checkUIReady);
                        activeIntervals = activeIntervals.filter(i => i !== checkUIReady);
                        console.log('UI not ready after max attempts, trying image upload anyway');
                        handleImageUpload(task.image, 0, task.color);
                    }
                }, 1000); // เพิ่มช่วงเวลาการตรวจสอบ
            }, 4000); // เพิ่มเวลารอ
        }
        
    } catch (error) {
        console.error('Error performing task:', error);
        showNotification('⚠️ เกิดข้อผิดพลาดในการทำงาน - ลองต่อไป');
        
        // ถ้าเกิด error ให้ข้ามไปรายการถัดไป
        safeTimeout(() => {
            automationState.currentTaskIndex++;
            
            // ส่งสถานะ error
            sendStatusToSidepanel('error', {
              current: automationState.currentTaskIndex,
              total: automationState.tasks.length,
              message: 'เกิดข้อผิดพลาดในการทำงาน'
            });
            
            processNextTask();
        }, 5000);
    }
}

// ฟังก์ชันคลิกปุ่ม Send สำหรับโหมด Text to Video
function clickSendButton() {
    try {
        console.log('Attempting to click Send button...');
        
        // Selector ที่ให้มา
        const sendBtnSelector = '#__next > div.sc-c7ee1759-1.crzReP > div > div > div.sc-b0c0bd7-1.kvzLFA > div > div.sc-897c0dbb-0.eHacXb > div.sc-77366d4e-0.eaiEre > div > div > div.sc-408537d4-0.eBSqXt > div.sc-408537d4-1.eiHkev > button.sc-c177465c-1.gdArnN.sc-408537d4-2.gdXWm';
        
        let attempts = 0;
        const maxAttempts = 20;
        
        const checkSendButton = safeSetInterval(() => {
            attempts++;
            console.log(`Looking for Send button (attempt ${attempts}/${maxAttempts})...`);
            
            let sendBtn = document.querySelector(sendBtnSelector);
            
            // ถ้าไม่เจอด้วย selector เฉพาะ ลองหาด้วยวิธีอื่น
            if (!sendBtn) {
                // ลองหาจาก text content
                const allButtons = document.querySelectorAll('button');
                for (const btn of allButtons) {
                    const text = btn.textContent?.toLowerCase().trim() || '';
                    const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
                    
                    if (text.includes('send') || text.includes('generate') || 
                        text.includes('create') || ariaLabel.includes('send') ||
                        text.includes('submit')) {
                        sendBtn = btn;
                        console.log('Found Send button via text/aria-label:', text || ariaLabel);
                        break;
                    }
                }
            }
            
            // ลองหาจาก class ที่คล้ายกัน
            if (!sendBtn) {
                sendBtn = document.querySelector('button[class*="gdArnN"], button[class*="gdXWm"]');
                if (sendBtn) {
                    console.log('Found Send button via class pattern');
                }
            }
            
            if (sendBtn && !sendBtn.disabled) {
                clearInterval(checkSendButton);
                activeIntervals = activeIntervals.filter(i => i !== checkSendButton);
                console.log('Found Send button:', sendBtn);
                
                // Highlight button to confirm
                const originalBorder = sendBtn.style.border;
                sendBtn.style.border = '3px solid lime';
                
                safeTimeout(() => {
                    sendBtn.style.border = originalBorder;
                }, 1000);
                
                // คลิกปุ่ม Send
                simulateClick(sendBtn);
                showNotification('✅ คลิกปุ่ม Send แล้ว');
                
                // รอแล้วไปขั้นตอนถัดไป
                safeTimeout(() => {
                    proceedToNextStep();
                }, 3000);
                
                return;
            } else if (sendBtn && sendBtn.disabled) {
                console.log('Send button found but disabled, waiting...');
            } else if (attempts >= maxAttempts) {
                clearInterval(checkSendButton);
                activeIntervals = activeIntervals.filter(i => i !== checkSendButton);
                console.log('Send button not found after max attempts');
                showNotification('⚠️ ไม่พบปุ่ม Send - กรุณาคลิกเอง');
                
                // ไปขั้นตอนถัดไปต่อไป
                safeTimeout(() => {
                    proceedToNextStep();
                }, 5000);
            }
        }, 1000);
        
    } catch (error) {
        console.error('Error clicking Send button:', error);
        showNotification('⚠️ ไม่สามารถคลิกปุ่ม Send ได้');
        
        // ไปขั้นตอนถัดไปต่อไป
        safeTimeout(() => {
            proceedToNextStep();
        }, 5000);
    }
}

// ฟังก์ชันไปขั้นตอนถัดไป (รอการสร้างเสร็จและดาวน์โหลด)
function proceedToNextStep() {
    console.log('Proceeding to next step - waiting for video generation...');
    
    // รอให้วิดีโอสร้างเสร็จแล้วไปรายการถัดไป
    safeTimeout(() => {
        console.log('Proceeding to next task...');
        // ไปรายการถัดไป
        safeTimeout(() => {
            automationState.currentTaskIndex++;
            processNextTask();
        }, automationState.cooldown);
    }, automationState.settings.saveDelay || 10000);
}

// ฟังก์ชันเดิม (เก็บไว้ก่อนแต่ไม่ได้ใช้ใน Loop ใหม่)
function fillFlowForm(data, images) {
  // Legacy support or direct single run
  console.log('Legacy fillFlowForm called');
}

// ฟังก์ชันเลือก "Frames to Video" จาก dropdown
function selectFramesToVideo() {
  console.log('Selecting Frames to Video...');
  
  try {
    // Helper function to find button by text or aria-label
    const findBtn = (keyword) => {
        const buttons = document.querySelectorAll('button, div[role="button"], span[role="button"]');
        for (const btn of buttons) {
            const text = btn.textContent?.trim() || '';
            const ariaLabel = btn.getAttribute('aria-label') || '';
            
            // Check exact match or inclusion
            if (text === keyword || ariaLabel === keyword || 
                (text.includes(keyword) && text.length < keyword.length + 15) || 
                (ariaLabel.includes(keyword) && ariaLabel.length < keyword.length + 15)) {
                return btn;
            }
        }
        return null;
    };

    // 1. ลองหาปุ่ม Frames to Video โดยตรงก่อน
    let framesBtn = findBtn('Frames to Video');
    
    if (framesBtn) {
        console.log('Found Frames to Video button directly');
        framesBtn.click();
        showNotification('✓ เลือก Frames to Video แล้ว');
        return true;
    }
    
    // 2. ถ้าไม่เจอ แสดงว่าอาจจะเป็นโหมด Text to Video หรือ SceneBuilder อยู่
    // ให้หาปุ่ม Text to Video หรือ SceneBuilder (ด้วย aria-label หรือ text) เพื่อกดเปลี่ยน
    console.log('Frames to Video not found, looking for Text to Video or SceneBuilder to switch...');
    let textModeBtn = findBtn('Text to Video');
    if (!textModeBtn) {
        textModeBtn = findBtn('SceneBuilder');
    }
    
    if (textModeBtn) {
        console.log('Found Text to Video/SceneBuilder button, clicking to open menu...');
        textModeBtn.click();
        
        // รอให้เมนูเปิดแล้วกด Frames to Video
        safeTimeout(() => {
            // หาใหม่หลังจากเปิดเมนู
            framesBtn = findBtn('Frames to Video');
            if (framesBtn) {
                console.log('Found Frames to Video in menu');
                framesBtn.click();
                showNotification('✓ เปลี่ยนเป็น Frames to Video แล้ว');
            } else {
                console.log('Still could not find Frames to Video button after clicking Text to Video');
            }
        }, 500);
        
        return true;
    }
    
    console.log('Could not find Frames to Video or Text to Video buttons');
    showNotification('⚠️ ไม่พบปุ่มเปลี่ยนโหมด - กรุณาเลือกเอง');
    return false;
    
  } catch (error) {
    console.error('Error selecting Frames to Video:', error);
    showNotification('⚠️ เกิดข้อผิดพลาดในการเลือก Frames to Video');
    return false;
  }
}

// ฟังก์ชันกรอกบทพูดในฟอร์ม
function fillScriptField(script) {
  if (!script) {
    console.log('No script provided');
    return;
  }
  
  console.log('Filling script field with:', script);
  
  // ค้นหา textarea ที่มี placeholder "Generate a video with text and frames..."
  const textareas = document.querySelectorAll('textarea');
  
  console.log('Found textareas:', textareas.length);
  
  let targetField = null;
  
  // ค้นหา textarea ที่มี placeholder ตรงกับที่ต้องการ
  textareas.forEach(textarea => {
    const placeholder = textarea.placeholder?.toLowerCase() || '';
    
    if (placeholder.includes('generate') || placeholder.includes('text') || placeholder.includes('frame') || placeholder.includes('prompt')) {
      targetField = textarea;
      console.log('Found target textarea with placeholder:', textarea.placeholder);
    }
  });
  
  // ถ้าไม่เจอ ใช้ textarea แรก
  if (!targetField && textareas.length > 0) {
    targetField = textareas[0];
    console.log('Using first textarea');
  }
  
  if (targetField) {
    console.log('Filling textarea...');
    
    // วิธีที่ 1: กรอกโดยตรง
    targetField.focus();
    targetField.value = script;
    targetField.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    targetField.dispatchEvent(new Event('change', { bubbles: true }));
    
    // วิธีที่ 2: ใช้ Object.getOwnPropertyDescriptor (สำหรับ React)
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    if (nativeInputValueSetter) {
        nativeInputValueSetter.call(targetField, script);
        const inputEvent = new Event('input', { bubbles: true });
        targetField.dispatchEvent(inputEvent);
    }
    
    showNotification('✓ กรอก Prompts แล้ว: ' + script.substring(0, 30) + '...');
  } else {
    console.log('No textarea found');
    showNotification('⚠️ ไม่พบช่องกรอกข้อมูล - กรุณากรอก Prompts เอง');
  }
}

// ฟังก์ชันเลือกรูปแบบ (แนวตั้ง/แนวนอน)
function selectOrientation(colorValue) {
  console.log('Selecting orientation based on:', colorValue);
  
  // แปลงค่าจาก sidepanel เป็นรูปแบบ
  let targetRatio = '9:16'; // default
  
  if (colorValue === '9:16') {
    targetRatio = '9:16'; // แนวตั้ง
  } else if (colorValue === '16:9') {
    targetRatio = '16:9'; // แนวนอน
  } else if (colorValue === '1:1') {
    targetRatio = '1:1'; // สี่เหลี่ยม
  }
  
  console.log('Target aspect ratio:', targetRatio);
  
  // ค้นหาทุก element ที่มีข้อความตรงกับ aspect ratio
  const allElements = document.querySelectorAll('button, div, span, [role="button"], [role="option"]');
  let found = false;
  
  allElements.forEach(element => {
    const text = element.textContent?.trim();
    const ariaLabel = element.getAttribute('aria-label') || '';
    
    // ตรวจสอบว่ามี aspect ratio ที่ต้องการ
    if ((text === targetRatio || ariaLabel.includes(targetRatio)) && !found) {
      console.log('Found aspect ratio element:', element, text);
      element.click();
      found = true;
      
      setTimeout(() => {
        showNotification(`✓ เลือกรูปแบบ ${targetRatio}`);
      }, 300);
    }
  });
  
  if (!found) {
    console.log('Aspect ratio option not found');
    showNotification(`⚠️ ไม่พบตัวเลือก ${targetRatio} - กรุณาเลือกเอง`);
  }
}

// ฟังก์ชันสำหรับอัปโหลดหลายรูปภาพ
function handleMultipleImageUpload(images, aspectRatio) {
  console.log('Attempting to upload', images.length, 'images...');
  console.log('Target aspect ratio:', aspectRatio);
  
  // เก็บ aspect ratio ไว้ใน global variable
  window.flowAssistantAspectRatio = aspectRatio;
  
  // อัปโหลดรูปแรก
  if (images[0]) {
    handleImageUpload(images[0], 0, aspectRatio);
  }
  
  // อัปโหลดรูปที่เหลือ (ถ้ามี)
  images.slice(1).forEach((imageData, index) => {
    if (imageData) {
      // รอให้รูปก่อนหน้าเสร็จ (รวมเวลา crop) ประมาณ 5 วินาที
      safeTimeout(() => {
        const addImageBtnSelector = '#__next > div.sc-c7ee1759-1.crzReP > div > div > div.sc-b0c0bd7-1.kvzLFA > div > div.sc-897c0dbb-0.eHacXb > div.sc-77366d4e-0.eaiEre > div > div > div.sc-408537d4-0.eBSqXt > div:nth-child(1) > div > div:nth-child(1) > button';
        const addImageBtn = document.querySelector(addImageBtnSelector);
        
        if (addImageBtn) {
          console.log('Clicking add image button for image', index + 2);
          addImageBtn.click();
          
          safeTimeout(() => {
            uploadImageToInput(imageData, index + 1, aspectRatio);
          }, 500);
        } else {
          console.log('Add image button not found, trying direct upload');
          uploadImageToInput(imageData, index + 1, aspectRatio);
        }
      }, (index + 1) * 5000); 
    }
  });
}

// ฟังก์ชันสำหรับอัปโหลดรูปภาพ
function handleImageUpload(imageData, index = 0, aspectRatio = '9:16') {
  console.log('Attempting to upload image', index + 1, '...');
  console.log('Aspect ratio:', aspectRatio);
  
  try {
    // ขั้นตอนที่ 1: ค้นหาปุ่มเพิ่มภาพ (+)
    // Selector เก่าอาจจะเปลี่ยนได้ ให้ลองหาแบบกว้างๆ ก่อน
    const addImageBtnSelector = '#__next > div.sc-c7ee1759-1.crzReP > div > div > div.sc-b0c0bd7-1.kvzLFA > div > div.sc-897c0dbb-0.eHacXb > div.sc-77366d4e-0.eaiEre > div > div > div.sc-408537d4-0.eBSqXt > div:nth-child(1) > div > div:nth-child(1) > button';
    
    let addImageBtn = document.querySelector(addImageBtnSelector);
    
    // วิธีสำรอง 1: ค้นหาปุ่มที่มี icon + หรือ text เกี่ยวกับ add/upload
    if (!addImageBtn) {
      console.log('Trying fallback method to find add image button...');
      
      const allButtons = document.querySelectorAll('button, div[role="button"]');
      for (const btn of allButtons) {
        const text = btn.textContent?.trim();
        const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
        
        // Check for specific keywords
        if (text === '+' || text.includes('Add') || text.includes('Upload') || 
            ariaLabel.includes('add') || ariaLabel.includes('upload') || ariaLabel.includes('image')) {
            
            // Avoid buttons that are likely "Frames to Video" or other controls
            if (ariaLabel.includes('frame') || text.includes('Video')) continue;
            
            console.log('Found potential add button:', btn, text, ariaLabel);
            addImageBtn = btn;
            break;
        }
        
        // Check for SVG children that look like plus signs (path data is too complex, but maybe class names?)
        // Or if it's the FIRST button in a grid?
      }
    }

    // วิธีสำรอง 2: ถ้ายังไม่เจอ ให้หา container ของรูปภาพ แล้วหาปุ่มแรกในนั้น
    if (!addImageBtn) {
         // พยายามหา Grid Container
         const grids = document.querySelectorAll('div[class*="grid"], div[style*="grid"]');
         for (const grid of grids) {
             const btn = grid.querySelector('button');
             if (btn) {
                 // Check if it looks like an upload button (empty or +)
                 if (btn.textContent.trim() === '+' || btn.innerHTML.includes('<svg') || btn.innerHTML.includes('<path')) {
                     addImageBtn = btn;
                     console.log('Found potential add button in grid:', btn);
                     break;
                 }
             }
         }
    }
    
    if (addImageBtn) {
      console.log('Found add image button (+)');
      
      // Highlight
      const originalBorder = addImageBtn.style.border;
      addImageBtn.style.border = '2px solid red';
      safeTimeout(() => addImageBtn.style.border = originalBorder, 1000);
      
      // Click
      simulateClick(addImageBtn);
      
      console.log('Clicked add image button (+)');
      showNotification(`📤 กำลังอัปโหลดรูปภาพ ${index + 1}...`);
      
      // รอให้ file input ปรากฏ
      safeTimeout(() => {
        uploadImageToInput(imageData, index, aspectRatio);
      }, 800);
      return;
    } else {
      console.log('Add image button (+) not found - trying direct file input');
      
      // ลองหา file input โดยตรง
      safeTimeout(() => {
        uploadImageToInput(imageData, index, aspectRatio);
      }, 500);
    }
    
  } catch (error) {
    console.error('Error uploading image:', error);
    showNotification('⚠️ ไม่สามารถอัปโหลดรูปภาพอัตโนมัติได้');
  }
}

// ฟังก์ชันอัปโหลดรูปภาพไปยัง file input
function uploadImageToInput(imageData, index = 0, aspectRatio = '9:16') {
  try {
    // ค้นหา file input ทั้งหมด
    const fileInputs = document.querySelectorAll('input[type="file"]');
    console.log('Found file inputs:', fileInputs.length);
    
    if (fileInputs.length === 0) {
      console.log('No file input found');
      showNotification('💡 กรุณาอัปโหลดรูปภาพด้วยตนเอง - คลิกที่ปุ่ม +');
      return;
    }
    
    // แปลง base64 เป็น blob
    fetch(imageData)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], `product-image-${index + 1}.png`, { type: 'image/png' });
        console.log('Created file:', file.name, file.size, 'bytes');
        
        // ใช้ file input ล่าสุด (มักจะเป็นตัวที่เพิ่งเปิด)
        const targetInput = fileInputs[fileInputs.length - 1];
        console.log('Using file input:', targetInput);
        
        try {
          // สร้าง DataTransfer object
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          targetInput.files = dataTransfer.files;
          
          // Trigger หลาย events
          targetInput.dispatchEvent(new Event('change', { bubbles: true }));
          targetInput.dispatchEvent(new Event('input', { bubbles: true }));
          
          console.log('Image', index + 1, 'uploaded successfully');
          showNotification(`✓ อัปโหลดรูปภาพ ${index + 1} แล้ว`);
          
          // รอให้หน้า Crop ปรากฏ แล้วจัดการ
          const delay = automationState.settings?.uploadDelay || 10000;
          safeTimeout(() => {
            handleCropDialog(index, aspectRatio);
          }, delay);
          
        } catch (err) {
          console.error('Error with file input:', err);
          showNotification('⚠️ เกิดข้อผิดพลาดในการอัปโหลด');
        }
      })
      .catch(error => {
        console.error('Error converting image:', error);
      });
      
  } catch (error) {
    console.error('Error in uploadImageToInput:', error);
  }
}

// ฟังก์ชันจัดการหน้า Crop
function handleCropDialog(imageIndex, aspectRatio = '9:16') {
  console.log('Handling crop dialog for image', imageIndex + 1);
  console.log('Target aspect ratio:', aspectRatio);
  
  try {
    // เลือกรูปแบบตาม aspect ratio
    let cropMode = 'Portrait'; // default
    
    if (aspectRatio === '9:16') {
      cropMode = 'Portrait';
    } else if (aspectRatio === '16:9') {
      cropMode = 'Landscape';
    } else if (aspectRatio === '1:1') {
      cropMode = 'Square';
    }
    
    console.log('Selecting crop mode:', cropMode);
    
    // รอให้ Dialog ปรากฏและค้นหาปุ่ม
    let attempts = 0;
    const maxAttempts = 20; // 10 วินาที
    let triggerClicked = false;
    
    const checkDialog = safeSetInterval(() => {
        attempts++;
        console.log(`Searching for ${cropMode} button (Attempt ${attempts}/${maxAttempts})...`);
        
        // 1. ลองหาปุ่มที่มีคำว่า Portrait โดยตรงก่อน (เผื่อมันโชว์อยู่แล้ว)
        let cropModeBtn = findButtonByText(cropMode);
        
        // 2. ถ้าไม่เจอ และยังไม่ได้กด Trigger ให้หาปุ่ม Landscape หรือปุ่มที่มี aria-label เกี่ยวกับ ratio
        if (!cropModeBtn && !triggerClicked) {
            console.log('Target button not found directly. Looking for ratio trigger...');
            
            let triggerBtn = null;

            // กรณีต้องการ Landscape (16:9) ระบบมักจะ Default เป็น Portrait
            // ให้หาปุ่มที่เป็น Portrait (ด้วย Text หรือ aria-label) เพื่อกดเปลี่ยน
            if (cropMode === 'Landscape') {
                console.log('Looking for Portrait button to switch to Landscape...');
                // 1. Find by text
                triggerBtn = findButtonByText('Portrait');
                
                // 2. Find by aria-label
                if (!triggerBtn) {
                    triggerBtn = document.querySelector('button[aria-label*="Portrait"], div[role="button"][aria-label*="Portrait"]');
                    if (triggerBtn) console.log('Found Portrait trigger by aria-label');
                }
            }
            
            // ลองหาปุ่ม Landscape (Default ของระบบตามที่ User บอก)
            if (!triggerBtn) triggerBtn = findButtonByText('Landscape');
            
            // ถ้าไม่เจอ Landscape ลองหา Square หรือ Free
            if (!triggerBtn) triggerBtn = findButtonByText('Square');
            if (!triggerBtn) triggerBtn = findButtonByText('Free');
            
            // ลองหาจาก aria-label
            if (!triggerBtn) {
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    const label = btn.getAttribute('aria-label') || '';
                    if (label.toLowerCase().includes('aspect ratio') || label.toLowerCase().includes('crop ratio')) {
                        triggerBtn = btn;
                        break;
                    }
                }
            }
            
            if (triggerBtn) {
                console.log('Found ratio trigger button:', triggerBtn.textContent || 'Icon');
                triggerBtn.click();
                triggerClicked = true;
                // หลังจากกดแล้ว ต้องรอรอบถัดไปเพื่อให้เมนูเด้งขึ้นมา
                return;
            }
        }
        
        // 3. ถ้าไม่เจอ ลองหาใน Dialog/Radix Portal (หลังจากกด Trigger เมนูมักจะอยู่ใน Portal)
        if (!cropModeBtn) {
            const dialogs = document.querySelectorAll('div[role="dialog"], div[id^="radix-"], div[role="menu"]');
            for (const dialog of dialogs) {
                const btn = findElementInContainer(dialog, cropMode);
                if (btn) {
                    cropModeBtn = btn;
                    console.log('Found button inside Dialog/Portal/Menu');
                    break;
                }
            }
        }
        
        // 4. ลอง XPath
        if (!cropModeBtn) {
            const xpath = `//button[contains(., '${cropMode}')] | //div[@role='button'][contains(., '${cropMode}')] | //span[contains(., '${cropMode}')] | //div[@role='menuitem'][contains(., '${cropMode}')] | //div[@role='option'][contains(., '${cropMode}')]`;
            const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            if (result.singleNodeValue) {
                cropModeBtn = result.singleNodeValue;
                console.log('Found button via XPath');
            }
        }
        
        if (cropModeBtn) {
            clearInterval(checkDialog);
            console.log(`Found ${cropMode} button:`, cropModeBtn);
            
            // Highlight element to confirm finding
            const originalBorder = cropModeBtn.style.border;
            cropModeBtn.style.border = '2px solid red';
            safeTimeout(() => {
                cropModeBtn.style.border = originalBorder;
            }, 1000);
            
            // คลิกปุ่ม using helper
            simulateClick(cropModeBtn);
            
            // บางทีต้องคลิกที่ parent ถ้าตัวที่เจอเป็น span
            if (cropModeBtn.tagName === 'SPAN' || (cropModeBtn.tagName === 'DIV' && !cropModeBtn.getAttribute('role'))) {
                const parent = cropModeBtn.closest('button') || cropModeBtn.closest('[role="button"]') || cropModeBtn.closest('[role="menuitem"]');
                if (parent) {
                    console.log('Also clicking parent:', parent);
                    simulateClick(parent);
                }
            }
            
            showNotification(`✓ เลือก ${cropMode} แล้ว`);
            
            // ขั้นตอนที่ 2: รอแล้วคลิก "Crop and save"
            safeTimeout(() => {
                handleCropSave(imageIndex);
            }, 800);
            
        } else if (attempts >= maxAttempts) {
            clearInterval(checkDialog);
            console.log(`${cropMode} button not found after all attempts`);
            showNotification(`⚠️ ไม่พบปุ่ม ${cropMode} - กรุณาเลือกเอง`);
            
            // ลองไปขั้นตอน Save เลยเผื่อมันเลือกให้อยู่แล้ว
            safeTimeout(() => {
                handleCropSave(imageIndex);
            }, 1000);
        }
        
    }, 500);
    
  } catch (error) {
    console.error('Error handling crop dialog:', error);
  }
}

// Helper function to find element with text in a container
function findElementInContainer(container, text) {
    const elements = container.querySelectorAll('button, div[role="button"], span, div[role="menuitem"], div[role="option"]');
    for (const el of elements) {
        if (el.textContent?.trim() === text || el.textContent?.includes(text)) {
            return el;
        }
    }
    return null;
}

// Robust click simulation
function simulateClick(element) {
    if (!element) return;
    
    // Create mouse events
    const mouseEvents = ['mouseover', 'mousedown', 'mouseup', 'click'];
    
    mouseEvents.forEach(eventType => {
        const event = new MouseEvent(eventType, {
            bubbles: true,
            cancelable: true,
            view: window,
            buttons: 1
        });
        element.dispatchEvent(event);
    });
}

// แยกฟังก์ชันกดปุ่ม Save ออกมาเพื่อความชัดเจน
function handleCropSave(imageIndex) {
    console.log('Looking for Crop and save button...');
    
    let attempts = 0;
    const maxAttempts = 10;
    
    const checkSaveBtn = safeSetInterval(() => {
        attempts++;
        
        let cropSaveBtn = document.querySelector('button[type="submit"]'); // ลองหา submit button ก่อน
        
        if (!cropSaveBtn) {
           cropSaveBtn = findButtonByText('Crop and save');
        }
        
        if (!cropSaveBtn) {
            // ลองหาปุ่มที่มีคำว่า Save หรือ Crop
            const allButtons = document.querySelectorAll('button');
            for (const btn of allButtons) {
                const text = btn.textContent?.toLowerCase() || '';
                if ((text.includes('crop') && text.includes('save')) || text === 'save' || text === 'crop') {
                    cropSaveBtn = btn;
                    break;
                }
            }
        }
        
        if (cropSaveBtn) {
            clearInterval(checkSaveBtn);
            console.log('✓ Found Crop and save button:', cropSaveBtn.textContent);
            cropSaveBtn.click();
            console.log('✓ Clicked Crop and save button');
            showNotification(`✓ บันทึกรูปภาพ ${imageIndex + 1} แล้ว`);

            const delay = automationState.settings?.saveDelay || 10000;
            safeTimeout(() => {
                finishAndSend();
            }, delay);
        } else if (attempts >= maxAttempts) {
            clearInterval(checkSaveBtn);
            console.log('❌ Crop and save button not found');
            showNotification('⚠️ ไม่พบปุ่ม Crop and save - กรุณากดเอง');
            
            // ถึงหาไม่เจอก็ลองไปต่อ (เผื่อ User กดเอง)
            safeTimeout(() => {
                finishAndSend();
            }, 3000);
        }
    }, 500);
}

// ฟังก์ชันค้นหาปุ่มจากข้อความ
function findButtonByText(text) {
  const buttons = document.querySelectorAll('button, div[role="button"]');
  
  for (const btn of buttons) {
    const btnText = btn.textContent?.trim();
    if (btnText === text || btnText?.includes(text)) {
      return btn;
    }
  }
  
  return null;
}

// ฟังก์ชันสุดท้าย: กดปุ่มส่งและจัดการ Loop
function finishAndSend() {
  console.log('Attempting to click Send button...');
  
  // Selector ของปุ่ม Send ที่ผู้ใช้ระบุ
  const sendBtnSelector = '#__next > div.sc-c7ee1759-1.crzReP > div > div > div.sc-b0c0bd7-1.kvzLFA > div > div.sc-897c0dbb-0.eHacXb > div.sc-77366d4e-0.eaiEre > div > div > div.sc-408537d4-0.eBSqXt > div.sc-408537d4-1.eiHkev > button';
  const sendBtnXpath = '//*[@id="__next"]/div[2]/div/div/div[2]/div/div[1]/div[2]/div/div/div[2]/div[2]/button';
  
  let attempts = 0;
  const maxAttempts = 30; // เพิ่มเวลารอเป็น 15 วินาที
  
  const checkSendBtn = safeSetInterval(() => {
    attempts++;
    
    // วิธีที่ 1: ลองหาด้วย Selector ก่อน
    let sendBtn = document.querySelector(sendBtnSelector);
    
    // วิธีที่ 2: ถ้าไม่เจอ ลองหาด้วย Xpath
    if (!sendBtn) {
        const xpathResult = document.evaluate(sendBtnXpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        sendBtn = xpathResult.singleNodeValue;
    }

    // วิธีที่ 3: ลองหาแบบเดิม (Fallback)
    if (!sendBtn) {
        const oldSelector = '#__next > div.sc-c7ee1759-1.crzReP > div > div > div.sc-b0c0bd7-1.kvzLFA > div > div.sc-897c0dbb-0.eHacXb > div.sc-77366d4e-0.eaiEre > div > div > div.sc-408537d4-0.eBSqXt > div.sc-408537d4-1.eiHkev';
        const container = document.querySelector(oldSelector);
        if (container) {
            sendBtn = container.querySelector('button') || container;
        }
    }
    
    // วิธีที่ 4: หาปุ่มที่มีข้อความ "Generate" หรือ "Send" หรือ "Create"
    if (!sendBtn) {
        const allButtons = document.querySelectorAll('button');
        for (const btn of allButtons) {
            const text = btn.textContent?.toLowerCase().trim() || '';
            const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
            
            if (text.includes('generate') || text.includes('send') || text.includes('create') || 
                ariaLabel.includes('generate') || ariaLabel.includes('send') || ariaLabel.includes('create')) {
                // ตรวจสอบว่าไม่ใช่ปุ่มอื่นๆ
                if (!text.includes('cancel') && !text.includes('back') && !text.includes('close')) {
                    sendBtn = btn;
                    console.log('Found send button by text:', text);
                    break;
                }
            }
        }
    }
    
    // วิธีที่ 5: หาปุ่มที่อยู่ในตำแหน่งล่างขวา (มักเป็นปุ่มหลัก)
    if (!sendBtn) {
        const allButtons = document.querySelectorAll('button');
        const potentialSendButtons = [];
        
        allButtons.forEach(btn => {
            const rect = btn.getBoundingClientRect();
            const style = window.getComputedStyle(btn);
            
            // ตรวจสอบว่าปุ่มอยู่ในตำแหน่งที่เหมาะสม และมีสีที่เด่น
            if (rect.bottom > window.innerHeight * 0.5 && // อยู่ครึ่งล่างของหน้าจอ
                rect.right > window.innerWidth * 0.5 && // อยู่ครึ่งขวาของหน้าจอ
                (style.backgroundColor.includes('rgb') || style.background.includes('gradient'))) {
                potentialSendButtons.push(btn);
            }
        });
        
        if (potentialSendButtons.length > 0) {
            // เลือกปุ่มที่อยู่ขวาสุดล่างสุด
            sendBtn = potentialSendButtons.reduce((rightmost, current) => {
                const rightmostRect = rightmost.getBoundingClientRect();
                const currentRect = current.getBoundingClientRect();
                return currentRect.right > rightmostRect.right ? current : rightmost;
            });
            console.log('Found send button by position');
        }
    }
    
    if (sendBtn) {
      const isDisabled = sendBtn.getAttribute('aria-disabled') === 'true' || 
                         sendBtn.classList.contains('disabled') ||
                         sendBtn.disabled;
      
      if (!isDisabled) {
        clearInterval(checkSendBtn);
        console.log('Found Send button and it seems active');
        
        // Highlight ปุ่มก่อนคลิก
        const originalBorder = sendBtn.style.border;
        sendBtn.style.border = '3px solid #00ff00';
        safeTimeout(() => sendBtn.style.border = originalBorder, 1000);
        
        // คลิกปุ่มส่ง
        simulateClick(sendBtn);
        console.log('Clicked Send button');
        
        showNotification('🚀 ส่งคำสั่งสร้าง Video แล้ว');
        
        // จัดการ Automation Loop (New Logic)
        safeTimeout(() => {
            automationState.currentTaskIndex++;
            automationState.completedInBatch++;
            
            // Default cooldown
            let cooldown = automationState.cooldown || 15000;
            
            // Check Batch Pause
            const batchSize = automationState.settings?.batchSize || 5;
            const batchPauseTime = automationState.settings?.batchPauseTime || 120000;
            
            if (automationState.completedInBatch >= batchSize && automationState.currentTaskIndex < automationState.tasks.length) {
                console.log(`Batch limit reached (${batchSize}). Pausing for ${batchPauseTime}ms...`);
                showNotification(`☕ ครบ ${batchSize} งานแล้ว พักเครื่อง ${batchPauseTime/1000} วินาที...`);
                cooldown = batchPauseTime;
                automationState.completedInBatch = 0; // Reset batch counter
            } else {
                console.log(`Waiting ${cooldown}ms before next task...`);
                showNotification(`⏳ รอ ${cooldown/1000} วินาที ก่อนทำรายการต่อไป...`);
            }
            
            safeTimeout(() => {
                processNextTask();
            }, cooldown);
            
        }, 2000); 
        
      } else {
        console.log('Send button found but disabled, waiting...');
      }
    } else {
      console.log(`Waiting for Send button... ${attempts}/${maxAttempts}`);
    }
    
    if (attempts >= maxAttempts) {
      clearInterval(checkSendBtn);
      console.log('❌ Timeout waiting for Send button');
      showNotification('⚠️ ไม่พบปุ่มส่ง - ข้ามไปรายการถัดไป');
      
      // ข้ามไปรายการถัดไปแทนที่จะหยุด
      safeTimeout(() => {
          automationState.currentTaskIndex++;
          showNotification(`⏭️ ข้ามไปรายการที่ ${automationState.currentTaskIndex + 1}`);
          
          // ส่งสถานะความคืบหน้า
          sendStatusToSidepanel('progress', {
            current: automationState.currentTaskIndex + 1,
            total: automationState.tasks.length
          });
          
          processNextTask();
      }, 3000);
    }
  }, 500);
}

// ลองใช้ drag & drop
function tryDragAndDrop(file) {
  // ค้นหา drop zone
  const dropZones = document.querySelectorAll('[class*="drop"], [class*="Drop"], [class*="upload"], [class*="Upload"]');
  console.log('Found potential drop zones:', dropZones.length);
  
  if (dropZones.length > 0) {
    const dropZone = dropZones[0];
    
    // สร้าง drag event
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    
    const dropEvent = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer: dataTransfer
    });
    
    dropZone.dispatchEvent(dropEvent);
    console.log('Tried drag & drop on:', dropZone);
  }
}

// ฟังก์ชันแสดงการแจ้งเตือน
function showNotification(message) {
  // สร้าง notification element
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    font-weight: 500;
    animation: slideIn 0.3s ease;
  `;
  
  // เพิ่ม animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(notification);
  
  // ลบ notification หลัง 3 วินาที
  setTimeout(() => {
    notification.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ป้องกัน error จาก extension อื่น
window.addEventListener('error', (e) => {
  // ถ้า error มาจาก extension อื่น ให้ ignore
  if (e.message?.includes('translate-page') || e.filename?.includes('content-all.js')) {
    e.stopPropagation();
    e.preventDefault();
    return false;
  }
});

// เพิ่มปุ่มตรวจสอบโครงสร้างหน้า (สำหรับ debug)
window.addEventListener('load', () => {
  console.log('Page fully loaded, Flow Auto 2026 by AI Influencer TH ready');
  
  // สร้างปุ่ม debug
  const debugBtn = document.createElement('button');
  debugBtn.textContent = '🔍 Debug Flow';
  debugBtn.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    padding: 10px 15px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 12px;
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    display: none;
  `;
  
  debugBtn.addEventListener('click', () => {
    const info = inspectPageStructure();
    console.log('=== PAGE STRUCTURE ===');
    console.log('Inputs:', info.inputs);
    console.log('Textareas:', info.textareas);
    console.log('File Inputs:', info.fileInputs);
    console.log('Buttons:', info.buttons);
    console.log('Selects:', info.selects);
    
    // แสดงข้อมูลใน alert
    alert(`พบ:\n- Input: ${info.inputs.length}\n- Textarea: ${info.textareas.length}\n- File Input: ${info.fileInputs.length}\n- Button: ${info.buttons.length}\n- Select: ${info.selects.length}\n\nดูรายละเอียดใน Console (F12)`);
  });
  
  document.body.appendChild(debugBtn);
  
  // แสดงปุ่มเมื่อกด Ctrl+Shift+D
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      debugBtn.style.display = debugBtn.style.display === 'none' ? 'block' : 'none';
      if (debugBtn.style.display === 'block') {
        showNotification('🔍 เปิดโหมด Debug - กด Ctrl+Shift+D อีกครั้งเพื่อปิด');
      }
    }
  });
});

// ==========================================
// AUTO WORKFLOW CONTENT SCRIPT FUNCTIONS
// ==========================================

// รับข้อความสำหรับ Auto Workflow
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // ... existing message handlers ...
  
  if (request.action === 'navigateToImagesMode') {
    console.log('Navigating to Images mode for workflow...');
    navigateToImagesMode();
    sendResponse({ success: true });
  } else if (request.action === 'uploadImageForWorkflow') {
    console.log('Uploading image for workflow...');
    uploadImageForWorkflow(request.image, request.index);
    sendResponse({ success: true });
  } else if (request.action === 'generateImageWithPrompt') {
    console.log('Generating image with prompt for workflow...');
    generateImageWithPrompt(request.prompt);
    sendResponse({ success: true });
  } else if (request.action === 'addImageToPrompts') {
    console.log('Adding image to prompts for workflow...');
    addImageToPrompts();
    sendResponse({ success: true });
  } else if (request.action === 'generateVideoWithPrompt') {
    console.log('Generating video with prompt for workflow...');
    generateVideoWithPrompt(request.prompt);
    sendResponse({ success: true });
  } else if (request.action === 'navigateToSceneBuilder') {
    console.log('Navigating to SceneBuilder for workflow...');
    navigateToSceneBuilder();
    sendResponse({ success: true });
  } else if (request.action === 'extendSceneWithPrompt') {
    console.log('Extending scene with prompt for workflow...');
    extendSceneWithPrompt(request.prompt, request.sceneName);
    sendResponse({ success: true });
  } else if (request.action === 'downloadVideoForWorkflow') {
    console.log('Downloading video for workflow...');
    downloadVideoForWorkflow();
    sendResponse({ success: true });
  }
  
  return true;
});

// Navigate to Images Mode (ใช้ logic เดียวกับ selectFramesToVideo)
function navigateToImagesMode() {
  try {
    console.log('Navigating to Images mode for workflow...');
    
    // ใช้ฟังก์ชันเดียวกับ selectFramesToVideo แต่หา Images แทน
    const findBtn = (keyword) => {
        const buttons = document.querySelectorAll('button, div[role="button"], span[role="button"], li[role="menuitem"], div[role="menuitem"], span');
        for (const btn of buttons) {
            const text = btn.textContent?.trim() || '';
            const ariaLabel = btn.getAttribute('aria-label') || '';
            
            if ((text.includes(keyword) || ariaLabel.includes(keyword)) && btn.offsetParent !== null) {
                return btn;
            }
        }
        return null;
    };

    // 1. ลองหาปุ่ม Images โดยตรงก่อน
    let imagesBtn = findBtn('Images');
    
    if (imagesBtn) {
        console.log('Found Images button directly');
        simulateClick(imagesBtn);
        showNotification('✓ เลือก Images แล้ว');
        
        // รอแล้วหา Create Images
        safeTimeout(() => {
            let createImagesBtn = findBtn('Create Images');
            if (!createImagesBtn) {
                createImagesBtn = findBtn('Create Image');
            }
            
            if (createImagesBtn) {
                console.log('Found Create Images button');
                simulateClick(createImagesBtn);
                showNotification('✓ เข้าสู่โหมด Create Images แล้ว');
            } else {
                console.log('Create Images button not found, but Images mode selected');
                showNotification('✓ อยู่ในโหมด Images แล้ว');
            }
        }, 2000);
        
        return true;
    }
    
    // 2. ถ้าไม่เจอ แสดงว่าอาจจะเป็นโหมดอื่นอยู่ ให้หาปุ่มโหมดปัจจุบันเพื่อกดเปลี่ยน
    console.log('Images not found, looking for current mode to switch...');
    let currentModeBtn = findBtn('Frames to Video');
    if (!currentModeBtn) {
        currentModeBtn = findBtn('Text to Video');
    }
    if (!currentModeBtn) {
        currentModeBtn = findBtn('SceneBuilder');
    }
    
    if (currentModeBtn) {
        console.log('Found current mode button, clicking to open menu...');
        simulateClick(currentModeBtn);
        
        // รอให้เมนูเปิดแล้วหา Images
        safeTimeout(() => {
            imagesBtn = findBtn('Images');
            if (imagesBtn) {
                console.log('Found Images in menu');
                simulateClick(imagesBtn);
                showNotification('✓ เปลี่ยนเป็น Images แล้ว');
                
                // รอแล้วหา Create Images
                safeTimeout(() => {
                    let createImagesBtn = findBtn('Create Images');
                    if (createImagesBtn) {
                        simulateClick(createImagesBtn);
                        showNotification('✓ เข้าสู่โหมด Create Images แล้ว');
                    }
                }, 2000);
            } else {
                console.log('Still could not find Images button after clicking current mode');
                showNotification('⚠️ ไม่พบโหมด Images - กรุณาเลือกเอง');
            }
        }, 500);
        
        return true;
    }
    
    console.log('Could not find Images or current mode buttons');
    showNotification('⚠️ ไม่พบโหมด Images - กรุณาเลือกเอง');
    return false;
    
  } catch (error) {
    console.error('Error navigating to Images mode:', error);
    showNotification('⚠️ เกิดข้อผิดพลาดในการไปหน้า Images');
    return false;
  }
}

// Upload Image for Workflow (ใช้ logic เดียวกับ handleImageUpload)
function uploadImageForWorkflow(imageData, index) {
  try {
    console.log('Uploading image for workflow, index:', index);
    
    // ใช้ selector เดียวกับ handleImageUpload
    const addImageBtnSelector = '#__next > div.sc-c7ee1759-1.crzReP > div > div > div.sc-b0c0bd7-1.kvzLFA > div > div.sc-897c0dbb-0.eHacXb > div.sc-77366d4e-0.eaiEre > div > div > div.sc-408537d4-0.eBSqXt > div:nth-child(1) > div > div:nth-child(1) > button';
    
    let addImageBtn = document.querySelector(addImageBtnSelector);
    
    // วิธีสำรอง 1: ค้นหาปุ่มที่มี icon + หรือ text เกี่ยวกับ add/upload (เหมือน handleImageUpload)
    if (!addImageBtn) {
      console.log('Trying fallback method to find add image button...');
      
      const allButtons = document.querySelectorAll('button, div[role="button"]');
      for (const btn of allButtons) {
        const text = btn.textContent?.trim();
        const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
        
        // Check for specific keywords
        if (text === '+' || text.includes('Add') || text.includes('Upload') || 
            ariaLabel.includes('add') || ariaLabel.includes('upload') || ariaLabel.includes('image')) {
            
            // Avoid buttons that are likely "Frames to Video" or other controls
            if (ariaLabel.includes('frame') || text.includes('Video')) continue;
            
            console.log('Found potential add button:', btn, text, ariaLabel);
            addImageBtn = btn;
            break;
        }
      }
    }

    // วิธีสำรอง 2: ถ้ายังไม่เจอ ให้หา container ของรูปภาพ แล้วหาปุ่มแรกในนั้น (เหมือน handleImageUpload)
    if (!addImageBtn) {
         const grids = document.querySelectorAll('div[class*="grid"], div[style*="grid"]');
         for (const grid of grids) {
             const btn = grid.querySelector('button');
             if (btn) {
                 if (btn.textContent.trim() === '+' || btn.innerHTML.includes('<svg') || btn.innerHTML.includes('<path')) {
                     addImageBtn = btn;
                     console.log('Found potential add button in grid:', btn);
                     break;
                 }
             }
         }
    }
    
    if (addImageBtn) {
      console.log('Found add image button (+)');
      
      // Highlight (เหมือน handleImageUpload)
      const originalBorder = addImageBtn.style.border;
      addImageBtn.style.border = '2px solid red';
      safeTimeout(() => addImageBtn.style.border = originalBorder, 1000);
      
      // Click
      simulateClick(addImageBtn);
      
      console.log('Clicked add image button (+)');
      showNotification(`📤 กำลังอัปโหลดรูปภาพ ${index + 1}...`);
      
      // รอให้ file input ปรากฏ (เหมือน handleImageUpload)
      safeTimeout(() => {
        uploadImageToFileInputWorkflow(imageData, index);
      }, 800);
      return;
    } else {
      console.log('Add image button (+) not found - trying direct file input');
      
      // ลองหา file input โดยตรง
      safeTimeout(() => {
        uploadImageToFileInputWorkflow(imageData, index);
      }, 500);
    }
    
  } catch (error) {
    console.error('Error uploading image for workflow:', error);
    showNotification('⚠️ เกิดข้อผิดพลาดในการอัปโหลดรูป');
  }
}

// Upload Image to File Input (ใช้ logic เดียวกับ uploadImageToInput)
function uploadImageToFileInputWorkflow(imageData, index) {
  try {
    // ค้นหา file input ทั้งหมด (เหมือน uploadImageToInput)
    const fileInputs = document.querySelectorAll('input[type="file"]');
    console.log('Found file inputs:', fileInputs.length);
    
    if (fileInputs.length === 0) {
      console.log('No file input found');
      showNotification('💡 กรุณาอัปโหลดรูปภาพด้วยตนเอง - คลิกที่ปุ่ม +');
      return;
    }
    
    // แปลง base64 เป็น blob (เหมือน uploadImageToInput)
    fetch(imageData)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], `workflow-product-${index + 1}.png`, { type: 'image/png' });
        console.log('Created file:', file.name, file.size, 'bytes');
        
        // ใช้ file input ล่าสุด (มักจะเป็นตัวที่เพิ่งเปิด) - เหมือน uploadImageToInput
        const targetInput = fileInputs[fileInputs.length - 1];
        console.log('Using file input:', targetInput);
        
        try {
          // สร้าง DataTransfer object (เหมือน uploadImageToInput)
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          targetInput.files = dataTransfer.files;
          
          // Trigger หลาย events (เหมือน uploadImageToInput)
          targetInput.dispatchEvent(new Event('change', { bubbles: true }));
          targetInput.dispatchEvent(new Event('input', { bubbles: true }));
          
          console.log('Image', index + 1, 'uploaded successfully');
          showNotification(`✓ อัปโหลดรูปภาพ ${index + 1} แล้ว`);
          
          // รอให้หน้า Crop ปรากฏ แล้วจัดการ (เหมือน uploadImageToInput)
          const delay = 10000; // 10 วินาที
          safeTimeout(() => {
            handleCropDialogForWorkflow(index, '9:16');
          }, delay);
          
        } catch (err) {
          console.error('Error with file input:', err);
          showNotification('⚠️ เกิดข้อผิดพลาดในการอัปโหลด');
        }
      })
      .catch(error => {
        console.error('Error converting image:', error);
      });
      
  } catch (error) {
    console.error('Error in uploadImageToFileInputWorkflow:', error);
  }
}

// Handle Crop Dialog for Workflow (ใช้ logic เดียวกับ handleCropDialog)
function handleCropDialogForWorkflow(imageIndex, aspectRatio = '9:16') {
  console.log('Handling crop dialog for workflow, image', imageIndex + 1);
  console.log('Target aspect ratio:', aspectRatio);
  
  try {
    // เลือกรูปแบบตาม aspect ratio (เหมือน handleCropDialog)
    let cropMode = 'Portrait'; // default
    
    if (aspectRatio === '9:16') {
      cropMode = 'Portrait';
    } else if (aspectRatio === '16:9') {
      cropMode = 'Landscape';
    } else if (aspectRatio === '1:1') {
      cropMode = 'Square';
    }
    
    console.log('Selecting crop mode:', cropMode);
    
    // รอให้ Dialog ปรากฏและค้นหาปุ่ม (เหมือน handleCropDialog)
    let attempts = 0;
    const maxAttempts = 20; // 10 วินาที
    let triggerClicked = false;
    
    const checkDialog = safeSetInterval(() => {
        attempts++;
        console.log(`Searching for ${cropMode} button (Attempt ${attempts}/${maxAttempts})...`);
        
        // 1. ลองหาปุ่มที่มีคำว่า Portrait โดยตรงก่อน (เหมือน handleCropDialog)
        let cropModeBtn = findButtonByText(cropMode);
        
        // 2. ถ้าไม่เจอ และยังไม่ได้กด Trigger ให้หาปุ่ม Landscape หรือปุ่มที่มี aria-label เกี่ยวกับ ratio
        if (!cropModeBtn && !triggerClicked) {
            console.log('Target button not found directly. Looking for ratio trigger...');
            
            let triggerBtn = null;

            // กรณีต้องการ Landscape (16:9) ระบบมักจะ Default เป็น Portrait
            if (cropMode === 'Landscape') {
                console.log('Looking for Portrait button to switch to Landscape...');
                triggerBtn = findButtonByText('Portrait');
                
                if (!triggerBtn) {
                    triggerBtn = document.querySelector('button[aria-label*="Portrait"], div[role="button"][aria-label*="Portrait"]');
                    if (triggerBtn) console.log('Found Portrait trigger by aria-label');
                }
            }
            
            // ลองหาปุ่ม Landscape (Default ของระบบ)
            if (!triggerBtn) triggerBtn = findButtonByText('Landscape');
            if (!triggerBtn) triggerBtn = findButtonByText('Square');
            if (!triggerBtn) triggerBtn = findButtonByText('Free');
            
            // ลองหาจาก aria-label
            if (!triggerBtn) {
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    const label = btn.getAttribute('aria-label') || '';
                    if (label.toLowerCase().includes('aspect ratio') || label.toLowerCase().includes('crop ratio')) {
                        triggerBtn = btn;
                        break;
                    }
                }
            }
            
            if (triggerBtn) {
                console.log('Found ratio trigger button:', triggerBtn.textContent || 'Icon');
                triggerBtn.click();
                triggerClicked = true;
                return;
            }
        }
        
        // 3. ถ้าไม่เจอ ลองหาใน Dialog/Radix Portal (เหมือน handleCropDialog)
        if (!cropModeBtn) {
            const dialogs = document.querySelectorAll('div[role="dialog"], div[id^="radix-"], div[role="menu"]');
            for (const dialog of dialogs) {
                const btn = findElementInContainer(dialog, cropMode);
                if (btn) {
                    cropModeBtn = btn;
                    console.log('Found button inside Dialog/Portal/Menu');
                    break;
                }
            }
        }
        
        // 4. ลอง XPath (เหมือน handleCropDialog)
        if (!cropModeBtn) {
            const xpath = `//button[contains(., '${cropMode}')] | //div[@role='button'][contains(., '${cropMode}')] | //span[contains(., '${cropMode}')] | //div[@role='menuitem'][contains(., '${cropMode}')] | //div[@role='option'][contains(., '${cropMode}')]`;
            const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            if (result.singleNodeValue) {
                cropModeBtn = result.singleNodeValue;
                console.log('Found button via XPath');
            }
        }
        
        if (cropModeBtn) {
            clearInterval(checkDialog);
            console.log(`Found ${cropMode} button:`, cropModeBtn);
            
            // Highlight element (เหมือน handleCropDialog)
            const originalBorder = cropModeBtn.style.border;
            cropModeBtn.style.border = '2px solid red';
            safeTimeout(() => {
                cropModeBtn.style.border = originalBorder;
            }, 1000);
            
            // คลิกปุ่ม (เหมือน handleCropDialog)
            simulateClick(cropModeBtn);
            
            // บางทีต้องคลิกที่ parent ถ้าตัวที่เจอเป็น span
            if (cropModeBtn.tagName === 'SPAN' || (cropModeBtn.tagName === 'DIV' && !cropModeBtn.getAttribute('role'))) {
                const parent = cropModeBtn.closest('button') || cropModeBtn.closest('[role="button"]') || cropModeBtn.closest('[role="menuitem"]');
                if (parent) {
                    console.log('Also clicking parent:', parent);
                    simulateClick(parent);
                }
            }
            
            showNotification(`✓ เลือก ${cropMode} แล้ว`);
            
            // ขั้นตอนที่ 2: รอแล้วคลิก "Crop and save" (เหมือน handleCropDialog)
            safeTimeout(() => {
                handleCropSaveForWorkflow(imageIndex);
            }, 800);
            
        } else if (attempts >= maxAttempts) {
            clearInterval(checkDialog);
            console.log(`${cropMode} button not found after all attempts`);
            showNotification(`⚠️ ไม่พบปุ่ม ${cropMode} - กรุณาเลือกเอง`);
            
            // ลองไปขั้นตอน Save เลยเผื่อมันเลือกให้อยู่แล้ว
            safeTimeout(() => {
                handleCropSaveForWorkflow(imageIndex);
            }, 1000);
        }
        
    }, 500);
    
  } catch (error) {
    console.error('Error handling crop dialog for workflow:', error);
  }
}

// Handle Crop Save for Workflow (เหมือน handleCropSave)
function handleCropSaveForWorkflow(imageIndex) {
    console.log('Looking for Crop and save button for workflow...');
    
    let attempts = 0;
    const maxAttempts = 10;
    
    const checkSaveBtn = safeSetInterval(() => {
        attempts++;
        
        let cropSaveBtn = document.querySelector('button[type="submit"]'); // ลองหา submit button ก่อน
        
        if (!cropSaveBtn) {
           cropSaveBtn = findButtonByText('Crop and save');
        }
        
        if (!cropSaveBtn) {
            // ลองหาปุ่มที่มีคำว่า Save หรือ Crop
            const allButtons = document.querySelectorAll('button');
            for (const btn of allButtons) {
                const text = btn.textContent?.toLowerCase() || '';
                if ((text.includes('crop') && text.includes('save')) || text === 'save' || text === 'crop') {
                    cropSaveBtn = btn;
                    break;
                }
            }
        }
        
        if (cropSaveBtn) {
            clearInterval(checkSaveBtn);
            console.log('✓ Found Crop and save button:', cropSaveBtn.textContent);
            cropSaveBtn.click();
            console.log('✓ Clicked Crop and save button');
            showNotification(`✓ บันทึกรูปภาพ ${imageIndex + 1} แล้ว`);

            // หลังจาก crop and save แล้ว ให้ไปขั้นตอนถัดไป (ไม่ต้องรอนาน)
            safeTimeout(() => {
                console.log('Image upload and crop completed for workflow');
                showNotification('✓ เสร็จสิ้นการอัปโหลดและ crop รูปภาพแล้ว');
            }, 3000);
        } else if (attempts >= maxAttempts) {
            clearInterval(checkSaveBtn);
            console.log('❌ Crop and save button not found');
            showNotification('⚠️ ไม่พบปุ่ม Crop and save - กรุณากดเอง');
            
            // ถึงหาไม่เจอก็ลองไปต่อ (เผื่อ User กดเอง)
            safeTimeout(() => {
                console.log('Proceeding without crop save for workflow');
            }, 3000);
        }
    }, 500);
}

// Generate Image with Prompt (ใช้ logic เดียวกับ fillScriptField)
function generateImageWithPrompt(prompt) {
  try {
    console.log('Generating image with prompt:', prompt);
    
    // รอให้การอัปโหลดและ crop เสร็จก่อน (ประมาณ 15 วินาที)
    console.log('Waiting for image upload and crop to complete...');
    showNotification('⏳ รอการอัปโหลดและ crop รูปภาพเสร็จ...');
    
    safeTimeout(() => {
      // ใช้ logic เดียวกับ fillScriptField
      const textareas = document.querySelectorAll('textarea');
      console.log('Found textareas:', textareas.length);
      
      let targetField = null;
      
      // ค้นหา textarea ที่มี placeholder ตรงกับที่ต้องการ (เหมือน fillScriptField)
      textareas.forEach(textarea => {
        const placeholder = textarea.placeholder?.toLowerCase() || '';
        
        if (placeholder.includes('generate') || placeholder.includes('text') || placeholder.includes('frame') || placeholder.includes('prompt')) {
          targetField = textarea;
          console.log('Found target textarea with placeholder:', textarea.placeholder);
        }
      });
      
      // ถ้าไม่เจอ ใช้ textarea แรก (เหมือน fillScriptField)
      if (!targetField && textareas.length > 0) {
        targetField = textareas[0];
        console.log('Using first textarea');
      }
      
      if (targetField) {
        console.log('Filling textarea...');
        
        // วิธีที่ 1: กรอกโดยตรง (เหมือน fillScriptField)
        targetField.focus();
        targetField.value = prompt;
        targetField.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        targetField.dispatchEvent(new Event('change', { bubbles: true }));
        
        // วิธีที่ 2: ใช้ Object.getOwnPropertyDescriptor (สำหรับ React) - เหมือน fillScriptField
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        if (nativeInputValueSetter) {
            nativeInputValueSetter.call(targetField, prompt);
            const inputEvent = new Event('input', { bubbles: true });
            targetField.dispatchEvent(inputEvent);
        }
        
        showNotification('✓ กรอก Prompts แล้ว: ' + prompt.substring(0, 30) + '...');
        
        // หาปุ่ม Generate (ใช้ logic เดียวกับ clickSendButton)
        safeTimeout(() => {
          clickGenerateButtonForWorkflow();
        }, 2000);
        
      } else {
        console.log('No textarea found');
        showNotification('⚠️ ไม่พบช่องกรอกข้อมูล - กรุณากรอก Prompts เอง');
      }
    }, 15000); // รอ 15 วินาทีให้การอัปโหลดและ crop เสร็จ
    
  } catch (error) {
    console.error('Error generating image with prompt:', error);
    showNotification('⚠️ เกิดข้อผิดพลาดในการสร้างรูป');
  }
}

// Click Generate Button for Workflow (ใช้ logic เดียวกับ clickSendButton)
function clickGenerateButtonForWorkflow() {
    try {
        console.log('Attempting to click Generate button for workflow...');
        
        // ใช้ selector เดียวกับ finishAndSend function
        const sendBtnSelector = '#__next > div.sc-c7ee1759-1.crzReP > div > div > div.sc-b0c0bd7-1.kvzLFA > div > div.sc-897c0dbb-0.eHacXb > div.sc-77366d4e-0.eaiEre > div > div > div.sc-408537d4-0.eBSqXt > div.sc-408537d4-1.eiHkev > button';
        const sendBtnXpath = '//*[@id="__next"]/div[2]/div/div/div[2]/div/div[1]/div[2]/div/div/div[2]/div[2]/button';
        
        let attempts = 0;
        const maxAttempts = 30; // เพิ่มเวลารอ
        
        const checkGenerateButton = safeSetInterval(() => {
            attempts++;
            console.log(`Looking for Generate button (attempt ${attempts}/${maxAttempts})...`);
            
            // วิธีที่ 1: ลองหาด้วย Selector ก่อน (เหมือน finishAndSend)
            let generateBtn = document.querySelector(sendBtnSelector);
            
            // วิธีที่ 2: ถ้าไม่เจอ ลองหาด้วย Xpath (เหมือน finishAndSend)
            if (!generateBtn) {
                const xpathResult = document.evaluate(sendBtnXpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                generateBtn = xpathResult.singleNodeValue;
            }

            // วิธีที่ 3: ลองหาแบบเดิม (Fallback) - เหมือน finishAndSend
            if (!generateBtn) {
                const oldSelector = '#__next > div.sc-c7ee1759-1.crzReP > div > div > div.sc-b0c0bd7-1.kvzLFA > div > div.sc-897c0dbb-0.eHacXb > div.sc-77366d4e-0.eaiEre > div > div > div.sc-408537d4-0.eBSqXt > div.sc-408537d4-1.eiHkev';
                const container = document.querySelector(oldSelector);
                if (container) {
                    generateBtn = container.querySelector('button') || container;
                }
            }
            
            // วิธีที่ 4: หาปุ่มที่มีข้อความ "Generate" หรือ "Send" หรือ "Create" (เหมือน finishAndSend)
            if (!generateBtn) {
                const allButtons = document.querySelectorAll('button');
                for (const btn of allButtons) {
                    const text = btn.textContent?.toLowerCase().trim() || '';
                    const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
                    
                    if (text.includes('generate') || text.includes('send') || text.includes('create') || 
                        ariaLabel.includes('generate') || ariaLabel.includes('send') || ariaLabel.includes('create')) {
                        // ตรวจสอบว่าไม่ใช่ปุ่มอื่นๆ
                        if (!text.includes('cancel') && !text.includes('back') && !text.includes('close')) {
                            generateBtn = btn;
                            console.log('Found generate button by text:', text);
                            break;
                        }
                    }
                }
            }
            
            // วิธีที่ 5: หาปุ่มที่อยู่ในตำแหน่งล่างขวา (มักเป็นปุ่มหลัก) - เหมือน finishAndSend
            if (!generateBtn) {
                const allButtons = document.querySelectorAll('button');
                const potentialSendButtons = [];
                
                allButtons.forEach(btn => {
                    const rect = btn.getBoundingClientRect();
                    const style = window.getComputedStyle(btn);
                    
                    // ตรวจสอบว่าปุ่มอยู่ในตำแหน่งที่เหมาะสม และมีสีที่เด่น
                    if (rect.bottom > window.innerHeight * 0.5 && // อยู่ครึ่งล่างของหน้าจอ
                        rect.right > window.innerWidth * 0.5 && // อยู่ครึ่งขวาของหน้าจอ
                        (style.backgroundColor.includes('rgb') || style.background.includes('gradient'))) {
                        potentialSendButtons.push(btn);
                    }
                });
                
                if (potentialSendButtons.length > 0) {
                    // เลือกปุ่มที่อยู่ขวาสุดล่างสุด
                    generateBtn = potentialSendButtons.reduce((rightmost, current) => {
                        const rightmostRect = rightmost.getBoundingClientRect();
                        const currentRect = current.getBoundingClientRect();
                        return currentRect.right > rightmostRect.right ? current : rightmost;
                    });
                    console.log('Found generate button by position');
                }
            }
            
            if (generateBtn) {
                const isDisabled = generateBtn.getAttribute('aria-disabled') === 'true' || 
                                   generateBtn.classList.contains('disabled') ||
                                   generateBtn.disabled;
                
                if (!isDisabled) {
                    clearInterval(checkGenerateButton);
                    activeIntervals = activeIntervals.filter(i => i !== checkGenerateButton);
                    console.log('Found Generate button and it seems active');
                    
                    // Highlight button (เหมือน finishAndSend)
                    const originalBorder = generateBtn.style.border;
                    generateBtn.style.border = '3px solid #00ff00';
                    
                    safeTimeout(() => {
                        generateBtn.style.border = originalBorder;
                    }, 1000);
                    
                    // คลิกปุ่ม Generate
                    simulateClick(generateBtn);
                    console.log('Clicked Generate button for image creation');
                    showNotification('🎨 เริ่มสร้างรูปภาพแล้ว');
                    
                    return;
                } else {
                    console.log('Generate button found but disabled, waiting...');
                }
            } else {
                console.log(`Waiting for Generate button... ${attempts}/${maxAttempts}`);
            }
            
            if (attempts >= maxAttempts) {
                clearInterval(checkGenerateButton);
                activeIntervals = activeIntervals.filter(i => i !== checkGenerateButton);
                console.log('❌ Timeout waiting for Generate button');
                showNotification('⚠️ ไม่พบปุ่ม Generate - กรุณากดด้วยตนเอง');
            }
        }, 500); // ลดเวลาการตรวจสอบเป็น 500ms
        
    } catch (error) {
        console.error('Error clicking Generate button:', error);
        showNotification('⚠️ ไม่สามารถคลิกปุ่ม Generate ได้');
    }
}

// Generate Video with Prompt
function generateVideoWithPrompt(prompt) {
  try {
    console.log('Generating video with prompt:', prompt);
    
    // Fill prompt in textarea (same as image generation)
    const textareas = document.querySelectorAll('textarea');
    let promptField = null;
    
    for (const textarea of textareas) {
      const placeholder = textarea.placeholder?.toLowerCase() || '';
      if (placeholder.includes('prompt') || placeholder.includes('describe') || 
          placeholder.includes('generate') || placeholder.includes('video')) {
        promptField = textarea;
        break;
      }
    }
    
    if (!promptField && textareas.length > 0) {
      promptField = textareas[0];
    }
    
    if (promptField) {
      // Fill prompt
      promptField.focus();
      promptField.value = prompt;
      promptField.dispatchEvent(new Event('input', { bubbles: true }));
      promptField.dispatchEvent(new Event('change', { bubbles: true }));
      
      console.log('Video prompt filled successfully');
      showNotification('✓ กรอก Prompt สำหรับวิดีโอแล้ว');
      
      // Look for Generate/Send button
      safeTimeout(() => {
        const generateButtons = document.querySelectorAll('button');
        for (const btn of generateButtons) {
          const text = btn.textContent?.toLowerCase() || '';
          if (text.includes('generate') || text.includes('send') || text.includes('create')) {
            console.log('Found video generate button:', btn.textContent);
            simulateClick(btn);
            showNotification('✓ เริ่มสร้างวิดีโอแล้ว');
            return;
          }
        }
        
        console.log('Video generate button not found');
        showNotification('⚠️ ไม่พบปุ่ม Generate Video - กรุณากดด้วยตนเอง');
      }, 1000);
      
    } else {
      console.log('Video prompt field not found');
      showNotification('⚠️ ไม่พบช่องกรอก Prompt - กรุณากรอกด้วยตนเอง');
    }
    
  } catch (error) {
    console.error('Error generating video with prompt:', error);
    showNotification('⚠️ เกิดข้อผิดพลาดในการสร้างวิดีโอ');
  }
}

// Navigate to SceneBuilder
function navigateToSceneBuilder() {
  try {
    console.log('Looking for SceneBuilder tab or button...');
    
    const tabs = document.querySelectorAll('[role="tab"], button, div[role="button"]');
    let sceneBuilderTab = null;
    
    for (const tab of tabs) {
      const text = tab.textContent?.trim() || '';
      const ariaLabel = tab.getAttribute('aria-label') || '';
      
      if (text.includes('SceneBuilder') || text.includes('Scene Builder') ||
          ariaLabel.includes('SceneBuilder') || ariaLabel.includes('Scene Builder')) {
        sceneBuilderTab = tab;
        console.log('Found SceneBuilder tab:', text);
        break;
      }
    }
    
    if (sceneBuilderTab) {
      simulateClick(sceneBuilderTab);
      showNotification('✓ ไปหน้า SceneBuilder แล้ว');
    } else {
      console.log('SceneBuilder tab not found');
      showNotification('⚠️ ไม่พบแท็บ SceneBuilder - กรุณาไปด้วยตนเอง');
    }
    
  } catch (error) {
    console.error('Error navigating to SceneBuilder:', error);
    showNotification('⚠️ เกิดข้อผิดพลาดในการไปหน้า SceneBuilder');
  }
}

// Extend Scene with Prompt
function extendSceneWithPrompt(prompt, sceneName) {
  try {
    console.log('Extending scene with prompt:', prompt, 'Scene:', sceneName);
    
    // First, click the "+" button to add a new scene
    findAndClickPlusButton(() => {
      // Then click Extend
      safeTimeout(() => {
        const success = clickExtendButton();
        if (success) {
          // Fill prompt and send
          safeTimeout(() => {
            fillScriptField(prompt);
            
            safeTimeout(() => {
              clickSendButton();
              showNotification(`✓ เริ่มต่อฉาก ${sceneName} แล้ว`);
            }, 2000);
          }, 2000);
        } else {
          showNotification(`⚠️ ไม่สามารถต่อฉาก ${sceneName} ได้ - กรุณาทำด้วยตนเอง`);
        }
      }, 1500);
    });
    
  } catch (error) {
    console.error('Error extending scene with prompt:', error);
    showNotification(`⚠️ เกิดข้อผิดพลาดในการต่อฉาก ${sceneName}`);
  }
}

// Download Video for Workflow
function downloadVideoForWorkflow() {
  try {
    console.log('Looking for download button...');
    
    const buttons = document.querySelectorAll('button, div[role="button"], a');
    let downloadButton = null;
    
    for (const btn of buttons) {
      const text = btn.textContent?.trim() || '';
      const ariaLabel = btn.getAttribute('aria-label') || '';
      
      if (text.includes('Download') || text.includes('download') ||
          ariaLabel.includes('Download') || ariaLabel.includes('download')) {
        downloadButton = btn;
        console.log('Found download button:', text);
        break;
      }
    }
    
    if (downloadButton) {
      simulateClick(downloadButton);
      showNotification('✓ เริ่มดาวน์โหลดวิดีโอแล้ว');
    } else {
      console.log('Download button not found');
      showNotification('⚠️ ไม่พบปุ่ม Download - กรุณาดาวน์โหลดด้วยตนเอง');
    }
    
  } catch (error) {
    console.error('Error downloading video for workflow:', error);
    showNotification('⚠️ เกิดข้อผิดพลาดในการดาวน์โหลดวิดีโอ');
  }
}