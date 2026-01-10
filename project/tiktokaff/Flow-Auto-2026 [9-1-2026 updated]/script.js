// ตัวแปรเก็บข้อมูลการเชื่อมต่อ
let currentFlowUrl = null;
let currentProjectId = null;
let currentTabId = null;
let isConnected = false;

// ตัวแปรสำหรับจัดการสถานะการทำงาน
let isProcessingBatch = false;

// ตัวแปรสำหรับจัดการ storage
const MAX_IMAGES = Infinity; // ไม่จำกัดจำนวนรูปภาพ
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // จำกัดขนาดรูปภาพ 2MB

// ตัวแปรสำหรับโหมดการทำงาน
let currentMode = 'image'; // 'image' หรือ 'text'

// New Year Snow and Sparkle Effects
function createSnowflake() {
  const snowflake = document.createElement('div');
  snowflake.className = 'snowflake';
  snowflake.innerHTML = ['❄', '❅', '❆'][Math.floor(Math.random() * 3)];
  snowflake.style.left = Math.random() * 100 + 'vw';
  snowflake.style.animationDuration = Math.random() * 3 + 2 + 's';
  snowflake.style.opacity = Math.random();
  snowflake.style.fontSize = Math.random() * 10 + 10 + 'px';
  
  document.body.appendChild(snowflake);
  
  setTimeout(() => {
    snowflake.remove();
  }, 5000);
}

function createSparkle() {
  const sparkle = document.createElement('div');
  sparkle.className = 'sparkle';
  sparkle.innerHTML = ['✨', '⭐', '🌟', '💫'][Math.floor(Math.random() * 4)];
  sparkle.style.left = Math.random() * 100 + 'vw';
  sparkle.style.top = Math.random() * 100 + 'vh';
  sparkle.style.animationDelay = Math.random() * 2 + 's';
  
  document.body.appendChild(sparkle);
  
  setTimeout(() => {
    sparkle.remove();
  }, 3000);
}

// Start New Year effects
function startNewYearEffects() {
  // Create snowflakes every 300ms
  setInterval(createSnowflake, 300);
  
  // Create sparkles every 2 seconds
  setInterval(createSparkle, 2000);
  
  // Add some initial sparkles
  for (let i = 0; i < 5; i++) {
    setTimeout(createSparkle, i * 400);
  }
}

// Initialize effects when page loads
// document.addEventListener('DOMContentLoaded', startNewYearEffects);

// ฟังก์ชันจัดการโหมดการทำงาน
function switchMode(mode) {
  currentMode = mode;
  
  const imageModeBtn = document.getElementById('imageModeBtn');
  const textModeBtn = document.getElementById('textModeBtn');
  const uploadSection = document.getElementById('uploadSection');
  const imageRequired = document.getElementById('imageRequired');
  const extendSceneSection = document.getElementById('extendSceneSection');
  
  // อัปเดตปุ่ม
  if (mode === 'image') {
    imageModeBtn.classList.add('active');
    textModeBtn.classList.remove('active');
    document.body.classList.remove('text-mode'); // เอา class text-mode ออก
    
    // แสดงส่วนอัปโหลดรูป (บังคับ)
    uploadSection.classList.remove('hidden', 'optional');
    imageRequired.style.display = 'inline';
    
    // ซ่อน Extend Scene
    if (extendSceneSection) extendSceneSection.classList.add('hidden');
    
    showNotification('🖼️ เปลี่ยนเป็นโหมด Frames to Video & Images - ต้องมีรูปภาพ');
  } else {
    textModeBtn.classList.add('active');
    imageModeBtn.classList.remove('active');
    document.body.classList.add('text-mode'); // เพิ่ม class text-mode
    
    // แสดงส่วนอัปโหลดรูป (ไม่บังคับ)
    uploadSection.classList.remove('hidden');
    uploadSection.classList.add('optional');
    imageRequired.style.display = 'none';
    
    // แสดง Extend Scene
    if (extendSceneSection) extendSceneSection.classList.remove('hidden');
    
    showNotification('📝 เปลี่ยนเป็นโหมด Text to Video & Scene - รูปภาพไม่บังคับ');
  }
  
  // บันทึกโหมดใน storage
  chrome.storage.local.set({ selectedMode: mode });
}

// ฟังก์ชันอัปเดตสถานะปุ่ม Start
function updateStartButtonState(isActive = true, text = null, progress = null) {
  const generateBtn = document.getElementById('generateBtn');
  if (!generateBtn) return;
  
  if (isActive) {
    generateBtn.disabled = false;
    generateBtn.className = 'generate-btn';
    generateBtn.innerHTML = '<span class="icon">▶</span> Start (สร้างเนื้อหา)';
    generateBtn.style.background = '';
    generateBtn.style.opacity = '1';
    generateBtn.style.cursor = 'pointer';
  } else {
    generateBtn.disabled = true;
    generateBtn.className = 'generate-btn disabled';
    generateBtn.style.background = 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)';
    generateBtn.style.opacity = '0.7';
    generateBtn.style.cursor = 'not-allowed';
    
    if (text) {
      generateBtn.innerHTML = text;
    } else if (progress) {
      generateBtn.innerHTML = `<span class="icon">⏳</span> กำลังสร้าง... (${progress.current}/${progress.total})`;
    } else {
      generateBtn.innerHTML = '<span class="icon">⏳</span> กำลังประมวลผล...';
    }
  }
}

// ฟังก์ชันรับสถานะจาก content script
function handleAutomationStatus(status) {
  switch (status.type) {
    case 'started':
      isProcessingBatch = true;
      updateStartButtonState(false, '<span class="icon">🚀</span> เริ่มสร้างแล้ว...');
      break;
      
    case 'progress':
      updateStartButtonState(false, null, {
        current: status.current,
        total: status.total
      });
      break;
      
    case 'completed':
      isProcessingBatch = false;
      updateStartButtonState(true);
      resetExtendButtons();
      showNotification('✅ สร้างครบทุก prompts แล้ว!');
      break;
      
    case 'error':
      isProcessingBatch = false;
      updateStartButtonState(true);
      resetExtendButtons();
      showNotification('⚠️ เกิดข้อผิดพลาด - สามารถเริ่มใหม่ได้');
      break;
      
    case 'stopped':
      isProcessingBatch = false;
      updateStartButtonState(true);
      resetExtendButtons();
      showNotification('⏹ หยุดการทำงานแล้ว');
      break;
  }
}

function resetExtendButtons() {
    const startExtendBtn = document.getElementById('startExtendBtn');
    const stopExtendBtn = document.getElementById('stopExtendBtn');
    
    if (startExtendBtn) {
        startExtendBtn.disabled = false;
        startExtendBtn.innerHTML = '<span class="icon">🎬</span> Start Extend';
    }
    
    if (stopExtendBtn) {
        stopExtendBtn.style.display = 'none';
    }
}

// ฟังก์ชันลดขนาดรูปภาพ
function resizeImage(file, maxWidth = 800, maxHeight = 600, quality = 0.8) {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        try {
          // คำนวณขนาดใหม่
          let { width, height } = img;
          
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width *= ratio;
            height *= ratio;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // วาดรูปภาพลงใน canvas
          ctx.drawImage(img, 0, 0, width, height);
          
          // แปลงเป็น base64 พร้อมลดคุณภาพ
          const resizedDataUrl = canvas.toDataURL('image/jpeg', quality);
          
          // ล้าง object URL
          URL.revokeObjectURL(img.src);
          
          resolve(resizedDataUrl);
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error('Failed to load image'));
      };
      
      img.src = URL.createObjectURL(file);
    } catch (error) {
      reject(error);
    }
  });
}

// ฟังก์ชันตรวจสอบขนาด storage
async function checkStorageQuota() {
  try {
    const estimate = await navigator.storage.estimate();
    const usedMB = (estimate.usage / 1024 / 1024).toFixed(2);
    const quotaMB = (estimate.quota / 1024 / 1024).toFixed(2);
    const usagePercent = ((estimate.usage / estimate.quota) * 100).toFixed(1);
    
    console.log(`Storage usage: ${usedMB}MB / ${quotaMB}MB (${usagePercent}%)`);
    
    if (usagePercent > 80) {
      showNotification(`⚠️ Storage เหลือน้อย: ${usagePercent}% เต็ม`);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error checking storage:', error);
    return true;
  }
}

// ฟังก์ชันล้าง storage เก่า
async function cleanupOldStorage() {
  try {
    const result = await chrome.storage.local.get(['uploadedImages']);
    // ไม่จำกัดจำนวนรูป แต่ตรวจสอบขนาดไฟล์
    return result.uploadedImages || [];
  } catch (error) {
    console.error('Error cleaning storage:', error);
    return [];
  }
}

async function isContentScriptReady(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    return true;
  } catch (error) {
    return false;
  }
}

// ฟังก์ชันรอให้ content script พร้อม
async function waitForContentScript(tabId, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const ready = await isContentScriptReady(tabId);
    if (ready) {
      console.log('Content script is ready');
      return true;
    }
    console.log(`Waiting for content script... attempt ${i + 1}/${maxAttempts}`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return false;
}

// จัดการปุ่มเชื่อมต่อ
const connectBtn = document.getElementById('connectBtn');
connectBtn.addEventListener('click', async () => {
  try {
    // แสดงสถานะกำลังเชื่อมต่อ
    connectBtn.innerHTML = '<span class="icon">⏳</span> กำลังเชื่อมต่อ...';
    connectBtn.disabled = true;
    
    // ค้นหาแท็บ Flow
    const flowTabs = await chrome.tabs.query({ url: '*://labs.google/fx/tools/flow*' });
    
    if (flowTabs.length > 0) {
      // มีแท็บ Flow เปิดอยู่แล้ว
      const flowTab = flowTabs[0];
      currentFlowUrl = flowTab.url;
      currentTabId = flowTab.id;
      
      // ดึง project ID จาก URL
      const match = flowTab.url.match(/project\/([a-f0-9-]+)/);
      if (match) {
        currentProjectId = match[1];
      }
      
      // เปลี่ยนไปที่แท็บ Flow
      await chrome.tabs.update(flowTab.id, { active: true });
      
      isConnected = true;
      connectBtn.className = 'connect-btn connected';
      connectBtn.innerHTML = '<span class="icon">✓</span> เชื่อมต่อสำเร็จ';
      connectBtn.disabled = false;
      
    } else {
      // ไม่มีแท็บ Flow เปิดอยู่ ให้เปิดใหม่
      const newTab = await chrome.tabs.create({
        url: 'https://labs.google/fx/tools/flow',
        active: true
      });
      
      currentTabId = newTab.id;
      currentFlowUrl = 'https://labs.google/fx/tools/flow';
      
      // รอให้หน้าโหลดเสร็จ
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === newTab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          isConnected = true;
          connectBtn.className = 'connect-btn connected';
          connectBtn.innerHTML = '<span class="icon">✓</span> เชื่อมต่อสำเร็จ';
          connectBtn.disabled = false;
        }
      });
    }
    
  } catch (error) {
    console.error('Error connecting:', error);
    connectBtn.innerHTML = '<span class="icon">⚠️</span> เชื่อมต่อไม่สำเร็จ';
    connectBtn.className = 'connect-btn';
    
    setTimeout(() => {
      connectBtn.innerHTML = '<span class="icon">🔗</span> เชื่อมต่อกับ Flow';
      connectBtn.disabled = false;
    }, 2000);
  }
});

// รับข้อความจาก background script
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === 'flowPageDetected') {
    currentFlowUrl = request.url;
    currentTabId = request.tabId;
    
    // อัปเดตสถานะปุ่ม
    if (!isConnected) {
      isConnected = true;
      connectBtn.className = 'connect-btn connected';
      connectBtn.innerHTML = '<span class="icon">✓</span> เชื่อมต่อสำเร็จ';
    }
  } else if (request.action === 'automationStatus') {
    // รับสถานะการทำงานจาก content script
    handleAutomationStatus(request.status);
  }
});

// จัดการปุ่มเลือกโหมด
const imageModeBtn = document.getElementById('imageModeBtn');
const textModeBtn = document.getElementById('textModeBtn');

if (imageModeBtn) {
  imageModeBtn.addEventListener('click', () => switchMode('image'));
}

if (textModeBtn) {
  textModeBtn.addEventListener('click', () => switchMode('text'));
}

// จัดการอัปโหลดรูปภาพ (ไม่จำกัดจำนวน)
const uploadGrid = document.getElementById('uploadGrid');
const fileInput = document.getElementById('fileInput');
const imageCount = document.getElementById('imageCount');
let uploadedImages = [];

// ตรวจสอบว่า elements มีอยู่จริง
if (!uploadGrid) {
  console.error('uploadGrid element not found');
}
if (!fileInput) {
  console.error('fileInput element not found');
}
if (!imageCount) {
  console.error('imageCount element not found');
}

// โหลดรูปภาพที่บันทึกไว้
chrome.storage.local.get(['uploadedImages', 'selectedMode', 'negativePrompts', 'noCaptions', 'noTextOnImage'], async (result) => {
  try {
    if (result.uploadedImages && result.uploadedImages.length > 0) {
      // ตรวจสอบขนาดไฟล์ก่อนประมวลผล
      if (uploadedImages.length > 0) {
        // ตรวจสอบและล้างข้อมูลเก่าถ้าจำเป็น
        uploadedImages = await cleanupOldStorage();
      } else {
        uploadedImages = result.uploadedImages;
      }
      updateImageDisplay();
    }
    
    // โหลดโหมดที่เลือก (default = image)
    const savedMode = result.selectedMode || 'image';
    switchMode(savedMode);
    
    // โหลดค่า negative prompts และ checkboxes
    if (negativePrompts && result.negativePrompts) {
      negativePrompts.value = result.negativePrompts;
    }
    
    if (noCaptionsCheckbox && typeof result.noCaptions === 'boolean') {
      noCaptionsCheckbox.checked = result.noCaptions;
    }
    
    if (noTextOnImageCheckbox && typeof result.noTextOnImage === 'boolean') {
      noTextOnImageCheckbox.checked = result.noTextOnImage;
    }
    
    // แสดงสถานะ storage
    await checkStorageQuota();
  } catch (error) {
    console.error('Error loading data:', error);
    showNotification('⚠️ เกิดข้อผิดพลาดในการโหลดข้อมูล');
  }
});

// คลิกที่ grid เพื่ออัปโหลด (ถ้าไม่มีรูป) หรือปุ่มเพิ่ม
if (uploadGrid) {
  uploadGrid.addEventListener('click', (e) => {
    // If clicking on a remove button, handled by another listener
    if (e.target.classList.contains('remove-btn')) return;

    // Trigger file input
    if (fileInput) {
      fileInput.click();
    } else {
      console.error('fileInput not found when trying to click');
    }
  });
} else {
  console.error('uploadGrid not found, cannot add click listener');
}

// New Select Files Button
const selectFilesBtn = document.getElementById('selectFilesBtn');
if (selectFilesBtn) {
    selectFilesBtn.addEventListener('click', () => {
        if (fileInput) {
          fileInput.click();
        } else {
          console.error('fileInput not found when selectFilesBtn clicked');
        }
    });
} else {
  console.error('selectFilesBtn not found');
}

// ปุ่มจัดการรูปภาพ
const manageImagesBtn = document.getElementById('manageImagesBtn');
const manageImageCount = document.getElementById('manageImageCount');

if (manageImagesBtn) {
    manageImagesBtn.addEventListener('click', () => {
        showImageManagementModal();
    });
}

// ฟังก์ชันแสดง Modal จัดการรูปภาพ
function showImageManagementModal() {
    if (uploadedImages.length === 0) {
        showNotification('⚠️ ไม่มีรูปภาพให้จัดการ');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'image-management-modal';
    modal.innerHTML = `
        <div class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>🖼️ จัดการรูปภาพ (${uploadedImages.length} รูป)</h3>
                    <button class="modal-close">×</button>
                </div>
                <div class="modal-body">
                    <div class="management-controls">
                        <button class="btn-danger" id="deleteSelectedBtn" disabled>ลบที่เลือก (0)</button>
                        <button class="btn-secondary" id="selectAllManageBtn">เลือกทั้งหมด</button>
                        <button class="btn-secondary" id="clearAllManageBtn">ยกเลิกทั้งหมด</button>
                    </div>
                    <div class="image-management-grid" id="imageManagementGrid">
                        <!-- Images will be loaded here -->
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" id="closeManageBtn">ปิด</button>
                </div>
            </div>
        </div>
    `;

    // เพิ่ม CSS สำหรับ Modal จัดการรูป
    const modalStyle = document.createElement('style');
    modalStyle.textContent = `
        .image-management-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        
        .image-management-modal .modal-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .image-management-modal .modal-content {
            background: #1a1a1a;
            border-radius: 16px;
            max-width: 900px;
            max-height: 90vh;
            width: 100%;
            display: flex;
            flex-direction: column;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
        }
        
        .image-management-modal .modal-header {
            padding: 20px;
            border-bottom: 1px solid #333;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .image-management-modal .modal-header h3 {
            margin: 0;
            color: #fff;
            font-size: 18px;
        }
        
        .image-management-modal .modal-close {
            background: none;
            border: none;
            color: #999;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: all 0.2s;
        }
        
        .image-management-modal .modal-close:hover {
            background: #333;
            color: #fff;
        }
        
        .image-management-modal .modal-body {
            padding: 20px;
            flex: 1;
            overflow-y: auto;
        }
        
        .management-controls {
            display: flex;
            gap: 12px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }
        
        .image-management-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            gap: 16px;
        }
        
        .manage-image-item {
            position: relative;
            aspect-ratio: 1;
            border-radius: 12px;
            overflow: hidden;
            cursor: pointer;
            border: 3px solid transparent;
            transition: all 0.2s;
            background: #2a2a2a;
        }
        
        .manage-image-item:hover {
            border-color: #3b82f6;
            transform: scale(1.02);
        }
        
        .manage-image-item.selected {
            border-color: #ef4444;
            box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.3);
        }
        
        .manage-image-item img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        
        .manage-image-item .selection-checkbox {
            position: absolute;
            top: 8px;
            left: 8px;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-size: 14px;
            font-weight: bold;
            border: 2px solid #666;
        }
        
        .manage-image-item.selected .selection-checkbox {
            background: #ef4444;
            border-color: #ef4444;
        }
        
        .manage-image-item .image-info {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
            color: #fff;
            padding: 8px;
            font-size: 12px;
            text-align: center;
        }
        
        .image-management-modal .modal-footer {
            padding: 20px;
            border-top: 1px solid #333;
            display: flex;
            gap: 12px;
            justify-content: flex-end;
        }
        
        .btn-danger {
            background: #ef4444;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .btn-danger:hover:not(:disabled) {
            background: #dc2626;
        }
        
        .btn-danger:disabled {
            background: #6b7280;
            cursor: not-allowed;
            opacity: 0.5;
        }
    `;
    
    document.head.appendChild(modalStyle);
    document.body.appendChild(modal);

    // ตัวแปรสำหรับเก็บรูปที่เลือกจะลบ
    const selectedForDeletion = new Set();
    const imageGrid = modal.querySelector('#imageManagementGrid');
    const deleteBtn = modal.querySelector('#deleteSelectedBtn');
    const selectAllBtn = modal.querySelector('#selectAllManageBtn');
    const clearAllBtn = modal.querySelector('#clearAllManageBtn');
    const closeBtn = modal.querySelector('#closeManageBtn');
    const modalCloseBtn = modal.querySelector('.modal-close');

    // ฟังก์ชันอัปเดตปุ่มลบ
    function updateDeleteButton() {
        const count = selectedForDeletion.size;
        deleteBtn.textContent = count > 0 ? `ลบที่เลือก (${count})` : 'ลบที่เลือก (0)';
        deleteBtn.disabled = count === 0;
    }

    // สร้าง Grid รูปภาพ
    function loadManagementImages() {
        imageGrid.innerHTML = '';
        
        uploadedImages.forEach((imageData, index) => {
            const imageItem = document.createElement('div');
            imageItem.className = 'manage-image-item';
            imageItem.dataset.index = index;
            imageItem.innerHTML = `
                <img src="${imageData}" alt="Image ${index + 1}" loading="lazy">
                <div class="selection-checkbox"></div>
                <div class="image-info">รูปที่ ${index + 1}</div>
            `;

            // คลิกเพื่อเลือก/ยกเลิก
            imageItem.addEventListener('click', () => {
                const imageIndex = parseInt(imageItem.dataset.index);
                if (selectedForDeletion.has(imageIndex)) {
                    selectedForDeletion.delete(imageIndex);
                    imageItem.classList.remove('selected');
                } else {
                    selectedForDeletion.add(imageIndex);
                    imageItem.classList.add('selected');
                }
                updateDeleteButton();
            });

            imageGrid.appendChild(imageItem);
        });
    }

    // Event Listeners
    selectAllBtn.addEventListener('click', () => {
        selectedForDeletion.clear();
        uploadedImages.forEach((_, index) => {
            selectedForDeletion.add(index);
        });
        imageGrid.querySelectorAll('.manage-image-item').forEach(item => {
            item.classList.add('selected');
        });
        updateDeleteButton();
    });

    clearAllBtn.addEventListener('click', () => {
        selectedForDeletion.clear();
        imageGrid.querySelectorAll('.manage-image-item').forEach(item => {
            item.classList.remove('selected');
        });
        updateDeleteButton();
    });

    deleteBtn.addEventListener('click', async () => {
        if (selectedForDeletion.size === 0) return;

        const confirmDelete = confirm(`คุณต้องการลบรูปภาพ ${selectedForDeletion.size} รูปใช่หรือไม่?`);
        if (!confirmDelete) return;

        // ลบรูปภาพที่เลือก (เรียงจากมากไปน้อยเพื่อไม่ให้ index เปลี่ยน)
        const indicesToDelete = Array.from(selectedForDeletion).sort((a, b) => b - a);
        indicesToDelete.forEach(index => {
            uploadedImages.splice(index, 1);
        });

        try {
            await chrome.storage.local.set({ uploadedImages: uploadedImages });
            updateImageDisplay(); // อัปเดต main display
            showNotification(`🗑️ ลบรูปภาพ ${selectedForDeletion.size} รูปแล้ว`);
            
            // รีเฟรช modal
            selectedForDeletion.clear();
            loadManagementImages();
            updateDeleteButton();
            
            // อัปเดต header
            modal.querySelector('.modal-header h3').textContent = `🖼️ จัดการรูปภาพ (${uploadedImages.length} รูป)`;
            
            if (uploadedImages.length === 0) {
                closeModal();
            }
        } catch (error) {
            console.error('Error deleting images:', error);
            showNotification('⚠️ ไม่สามารถลบรูปภาพได้');
        }
    });

    function closeModal() {
        document.body.removeChild(modal);
        document.head.removeChild(modalStyle);
    }

    closeBtn.addEventListener('click', closeModal);
    modalCloseBtn.addEventListener('click', closeModal);
    modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });

    // เริ่มโหลดรูปภาพ
    loadManagementImages();
    updateDeleteButton();
}

// ปุ่มดึงรูปจาก TikTok
const fetchTikTokBtn = document.getElementById('fetchTikTokBtn');
if (fetchTikTokBtn) {
    fetchTikTokBtn.addEventListener('click', async () => {
        try {
            const originalText = fetchTikTokBtn.innerHTML;
            fetchTikTokBtn.disabled = true;
            fetchTikTokBtn.innerHTML = '<span class="icon">⏳</span> กำลังดึงรูป...';

            // ค้นหาแท็บ TikTok Studio หรือ TikTok ทั่วไป
            const tikTokTabs = await chrome.tabs.query({ 
                url: ['*://*.tiktok.com/*', '*://studio.tiktok.com/*', '*://www.tiktok.com/*', '*://tiktok.com/*'] 
            });
            
            let targetTab = null;
            
            if (tikTokTabs.length > 0) {
                // หา TikTok Studio ก่อน (ให้ความสำคัญมากกว่า)
                const studioTab = tikTokTabs.find(tab => tab.url.includes('studio.tiktok.com'));
                if (studioTab) {
                    targetTab = studioTab;
                    showNotification('🎯 พบ TikTok Studio - กำลังดึงรูป...');
                } else {
                    // ใช้แท็บ TikTok ทั่วไป
                    targetTab = tikTokTabs[0];
                    showNotification('🎯 พบ TikTok - กำลังดึงรูป...');
                }
            } else {
                // ถ้าไม่มีแท็บ TikTok ให้ใช้แท็บปัจจุบัน
                const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (currentTab && (currentTab.url.includes('tiktok.com') || currentTab.url.includes('studio.tiktok.com'))) {
                    targetTab = currentTab;
                    showNotification('🎯 ใช้แท็บปัจจุบัน - กำลังดึงรูป...');
                } else {
                    showNotification('⚠️ ไม่พบแท็บ TikTok หรือ TikTok Studio');
                    resetTikTokBtn();
                    return;
                }
            }

            if (!targetTab) {
                showNotification('⚠️ ไม่พบแท็บ TikTok ที่เหมาะสม');
                resetTikTokBtn();
                return;
            }

            // Execute script to get image URLs
            const results = await chrome.scripting.executeScript({
                target: { tabId: targetTab.id },
                func: extractTikTokImages
            });

            console.log('Script execution results:', results);

            if (!results || !results[0] || !results[0].result) {
                showNotification('⚠️ ไม่สามารถเรียกใช้ script ได้');
                resetTikTokBtn();
                return;
            }

            const imageUrls = results[0].result;
            console.log('Extracted image URLs:', imageUrls);

            if (imageUrls.length === 0) {
                // แสดงข้อมูล debug เพิ่มเติม
                const debugInfo = await chrome.scripting.executeScript({
                    target: { tabId: targetTab.id },
                    func: () => {
                        return {
                            url: window.location.href,
                            title: document.title,
                            imgCount: document.querySelectorAll('img').length,
                            visibleImgCount: Array.from(document.querySelectorAll('img')).filter(img => img.offsetParent !== null).length,
                            bodyText: document.body.innerText.substring(0, 200)
                        };
                    }
                });
                
                console.log('Debug info:', debugInfo[0]?.result);
                showNotification(`⚠️ ไม่พบรูปภาพ - URL: ${debugInfo[0]?.result?.url || 'unknown'}, IMG tags: ${debugInfo[0]?.result?.imgCount || 0}`);
                resetTikTokBtn();
                return;
            }

            showNotification(`🔎 พบ ${imageUrls.length} รูป กำลังแสดง...`);

            // แสดง Modal สำหรับเลือกรูป
            await showImageSelectionModal(imageUrls, targetTab.url.includes('studio.tiktok.com'));
            
            resetTikTokBtn();

        } catch (error) {
            console.error('Error fetching TikTok images:', error);
            showNotification('⚠️ เกิดข้อผิดพลาด (ต้องเปิดหน้าเว็บ TikTok)');
            resetTikTokBtn();
        }
    });
}

// ปุ่มเปิด TikTok Studio
const openTikTokStudioBtn = document.getElementById('openTikTokStudioBtn');
if (openTikTokStudioBtn) {
    openTikTokStudioBtn.addEventListener('click', async () => {
        try {
            // เปิด TikTok Studio Upload และ Showcase Products ในแท็บใหม่
            await chrome.tabs.create({
                url: 'https://www.tiktok.com/tiktokstudio/upload',
                active: true
            });
            
            // เปิดหน้า Showcase Products ในแท็บใหม่
            setTimeout(async () => {
                await chrome.tabs.create({
                    url: 'https://www.tiktok.com/business/en/showcase',
                    active: false
                });
            }, 1000);
            
            showNotification('🚀 เปิด TikTok Studio และ Showcase Products แล้ว');
        } catch (error) {
            console.error('Error opening TikTok Studio:', error);
            showNotification('⚠️ ไม่สามารถเปิด TikTok Studio ได้');
        }
    });
}

function resetTikTokBtn() {
    if (fetchTikTokBtn) {
        fetchTikTokBtn.disabled = false;
        fetchTikTokBtn.innerHTML = '<span class="icon" style="filter: drop-shadow(0 0 2px rgba(255,0,80,0.5));">🎵</span> ดึงรูปจาก TikTok/Studio';
    }
}

// Function that runs in the content script context
function extractTikTokImages() {
    const images = new Set();
    
    console.log('=== TikTok Showcase Products Image Extraction ===');
    console.log('Current URL:', window.location.href);
    console.log('Page title:', document.title);
    
    // ตรวจสอบว่าอยู่ในหน้า Add product links / Showcase products
    const isProductLinksPage = window.location.href.includes('product') || 
                              document.body.innerText.includes('Add product links') ||
                              document.body.innerText.includes('Showcase products') ||
                              document.body.innerText.includes('Product name');
    
    console.log('Is Product Links/Showcase page:', isProductLinksPage);
    
    // 1. เจาะจงดึงรูปสินค้าจากตารางโดยตรง
    console.log('\n=== Method 1: Table-based extraction ===');
    
    // ค้นหาแถวในตาราง (table rows)
    const tableRows = document.querySelectorAll('tr, [role="row"], .table-row, div[class*="row"]');
    console.log(`Found ${tableRows.length} potential table rows`);
    
    tableRows.forEach((row, rowIndex) => {
        const rowImages = row.querySelectorAll('img');
        if (rowImages.length > 0) {
            console.log(`Row ${rowIndex + 1}: Found ${rowImages.length} images`);
            
            rowImages.forEach((img, imgIndex) => {
                const src = img.src;
                const alt = img.alt || '';
                const width = img.naturalWidth || img.width || img.offsetWidth || 0;
                const height = img.naturalHeight || img.height || img.offsetHeight || 0;
                
                console.log(`  Image ${imgIndex + 1}:`, {
                    src: src ? src.substring(0, 60) + '...' : 'NO SRC',
                    alt: alt.substring(0, 20),
                    size: `${width}x${height}`,
                    visible: img.offsetParent !== null
                });
                
                if (src && !src.startsWith('data:') && width > 0 && height > 0) {
                    images.add(src);
                    console.log(`    ✓ Added to collection`);
                }
            });
        }
    });
    
    // 2. ค้นหาจาก table cells โดยตรง
    console.log('\n=== Method 2: Table cell extraction ===');
    const tableCells = document.querySelectorAll('td, th, [role="cell"], [role="gridcell"]');
    console.log(`Found ${tableCells.length} table cells`);
    
    tableCells.forEach((cell, cellIndex) => {
        const cellImages = cell.querySelectorAll('img');
        cellImages.forEach(img => {
            const src = img.src;
            if (src && !src.startsWith('data:')) {
                images.add(src);
                console.log(`Cell ${cellIndex + 1}: Added image ${src.substring(0, 60)}...`);
            }
        });
    });
    
    // 3. ค้นหาจาก divs ที่มี layout แบบ grid หรือ flex
    console.log('\n=== Method 3: Grid/Flex layout extraction ===');
    const gridContainers = document.querySelectorAll('[class*="grid"], [class*="flex"], [style*="display: grid"], [style*="display: flex"]');
    console.log(`Found ${gridContainers.length} grid/flex containers`);
    
    gridContainers.forEach((container, containerIndex) => {
        const containerImages = container.querySelectorAll('img');
        if (containerImages.length > 0) {
            console.log(`Container ${containerIndex + 1}: Found ${containerImages.length} images`);
            containerImages.forEach(img => {
                const src = img.src;
                if (src && !src.startsWith('data:')) {
                    images.add(src);
                    console.log(`  ✓ Added grid/flex image`);
                }
            });
        }
    });
    
    // 4. ค้นหาจาก elements ที่มี class หรือ attribute เกี่ยวกับ product
    console.log('\n=== Method 4: Product-specific elements ===');
    const productSelectors = [
        '[class*="product"]',
        '[data-product]',
        '[class*="item"]',
        '[class*="card"]',
        '[class*="list"]'
    ];
    
    productSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            console.log(`Selector "${selector}": Found ${elements.length} elements`);
            elements.forEach(element => {
                const elementImages = element.querySelectorAll('img');
                elementImages.forEach(img => {
                    const src = img.src;
                    if (src && !src.startsWith('data:')) {
                        images.add(src);
                        console.log(`  ✓ Added product element image`);
                    }
                });
            });
        }
    });
    
    // 5. Fallback: ดึงรูปทั้งหมดที่มีขนาดเหมาะสม
    if (images.size === 0) {
        console.log('\n=== Method 5: Fallback - All images ===');
        const allImages = document.querySelectorAll('img');
        console.log(`Found ${allImages.length} total images, applying fallback`);
        
        allImages.forEach((img, index) => {
            const src = img.src;
            const width = img.naturalWidth || img.width || img.offsetWidth || 0;
            const height = img.naturalHeight || img.height || img.offsetHeight || 0;
            
            // ใช้เงื่อนไขที่ผ่อนปรนมาก
            if (src && 
                !src.startsWith('data:') && 
                !src.includes('.svg') &&
                width >= 10 && 
                height >= 10) {
                
                images.add(src);
                console.log(`Fallback: Added image ${index + 1} (${width}x${height})`);
            }
        });
    }
    
    const imageArray = Array.from(images);
    console.log(`\n=== FINAL RESULT ===`);
    console.log(`Total unique images found: ${imageArray.length}`);
    
    // แสดงรายการรูปที่พบ (แค่ 5 รูปแรก)
    imageArray.slice(0, 5).forEach((url, index) => {
        console.log(`${index + 1}. ${url.substring(0, 80)}...`);
    });
    
    if (imageArray.length === 0) {
        console.log('\n=== DEBUG INFO ===');
        console.log('Page structure analysis:');
        console.log('- Total img tags:', document.querySelectorAll('img').length);
        console.log('- Table rows (tr):', document.querySelectorAll('tr').length);
        console.log('- Table cells (td):', document.querySelectorAll('td').length);
        console.log('- Elements with "product" class:', document.querySelectorAll('[class*="product"]').length);
        console.log('- Page text includes "Showcase":', document.body.innerText.includes('Showcase'));
        console.log('- Page text includes "Product name":', document.body.innerText.includes('Product name'));
    }
    
    return imageArray;
}

// Function to show image selection modal
async function showImageSelectionModal(imageUrls, isStudio = false) {
    return new Promise((resolve) => {
        // สร้าง Modal
        const modal = document.createElement('div');
        modal.className = 'tiktok-image-modal';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>🎵 เลือกรูปภาพจาก ${isStudio ? 'TikTok Studio' : 'TikTok'}</h3>
                        <button class="modal-close">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="image-selection-grid" id="imageSelectionGrid">
                            <!-- Images will be loaded here -->
                        </div>
                        <div class="selection-info">
                            <span id="selectedCount">0</span> รูปที่เลือก
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-secondary" id="selectAllBtn">เลือกทั้งหมด</button>
                        <button class="btn-secondary" id="clearAllBtn">ยกเลิกทั้งหมด</button>
                        <button class="btn-primary" id="confirmSelectionBtn">เพิ่มรูปที่เลือก</button>
                    </div>
                </div>
            </div>
        `;

        // เพิ่ม CSS สำหรับ Modal
        const modalStyle = document.createElement('style');
        modalStyle.textContent = `
            .tiktok-image-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
            
            .modal-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            
            .modal-content {
                background: #1a1a1a;
                border-radius: 16px;
                max-width: 800px;
                max-height: 90vh;
                width: 100%;
                display: flex;
                flex-direction: column;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
            }
            
            .modal-header {
                padding: 20px;
                border-bottom: 1px solid #333;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .modal-header h3 {
                margin: 0;
                color: #fff;
                font-size: 18px;
            }
            
            .modal-close {
                background: none;
                border: none;
                color: #999;
                font-size: 24px;
                cursor: pointer;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: all 0.2s;
            }
            
            .modal-close:hover {
                background: #333;
                color: #fff;
            }
            
            .modal-body {
                padding: 20px;
                flex: 1;
                overflow-y: auto;
            }
            
            .image-selection-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                gap: 12px;
                margin-bottom: 16px;
            }
            
            .image-item {
                position: relative;
                aspect-ratio: 1;
                border-radius: 8px;
                overflow: hidden;
                cursor: pointer;
                border: 2px solid transparent;
                transition: all 0.2s;
            }
            
            .image-item:hover {
                border-color: #3b82f6;
                transform: scale(1.02);
            }
            
            .image-item.selected {
                border-color: #10b981;
                box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.3);
            }
            
            .image-item img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            
            .image-item .selection-overlay {
                position: absolute;
                top: 4px;
                right: 4px;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                color: #fff;
                font-size: 12px;
                font-weight: bold;
            }
            
            .image-item.selected .selection-overlay {
                background: #10b981;
            }
            
            .selection-info {
                text-align: center;
                color: #999;
                font-size: 14px;
                margin-bottom: 16px;
            }
            
            .modal-footer {
                padding: 20px;
                border-top: 1px solid #333;
                display: flex;
                gap: 12px;
                justify-content: flex-end;
            }
            
            .btn-primary, .btn-secondary {
                padding: 10px 20px;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .btn-primary {
                background: #3b82f6;
                color: white;
            }
            
            .btn-primary:hover {
                background: #2563eb;
            }
            
            .btn-secondary {
                background: #374151;
                color: #d1d5db;
            }
            
            .btn-secondary:hover {
                background: #4b5563;
            }
            
            .loading-placeholder {
                display: flex;
                align-items: center;
                justify-content: center;
                height: 120px;
                background: #2a2a2a;
                border-radius: 8px;
                color: #999;
                font-size: 12px;
            }
        `;
        
        document.head.appendChild(modalStyle);
        document.body.appendChild(modal);

        // ตัวแปรสำหรับเก็บรูปที่เลือก
        const selectedImages = new Set();
        const imageGrid = modal.querySelector('#imageSelectionGrid');
        const selectedCount = modal.querySelector('#selectedCount');
        const selectAllBtn = modal.querySelector('#selectAllBtn');
        const clearAllBtn = modal.querySelector('#clearAllBtn');
        const confirmBtn = modal.querySelector('#confirmSelectionBtn');
        const closeBtn = modal.querySelector('.modal-close');

        // ฟังก์ชันอัปเดตจำนวนที่เลือก
        function updateSelectedCount() {
            selectedCount.textContent = selectedImages.size;
            confirmBtn.textContent = selectedImages.size > 0 ? 
                `เพิ่ม ${selectedImages.size} รูป` : 'เพิ่มรูปที่เลือก';
        }

        // โหลดรูปภาพ
        async function loadImages() {
            imageGrid.innerHTML = '<div class="loading-placeholder">กำลังโหลดรูปภาพ...</div>';
            
            // ไม่ตรวจสอบ accessibility ของรูป เพราะ TikTok มี CORS protection
            // แสดงรูปทั้งหมดที่พบ
            const validImages = imageUrls.slice(0, 30); // จำกัดที่ 30 รูป

            if (validImages.length === 0) {
                imageGrid.innerHTML = '<div class="loading-placeholder">ไม่พบรูปภาพ</div>';
                return;
            }

            // สร้าง Grid รูปภาพ
            imageGrid.innerHTML = '';
            validImages.forEach((url, index) => {
                const imageItem = document.createElement('div');
                imageItem.className = 'image-item';
                imageItem.innerHTML = `
                    <img src="${url}" alt="TikTok Image ${index + 1}" loading="lazy" 
                         onerror="this.style.display='none'; this.parentElement.style.display='none';">
                    <div class="selection-overlay"></div>
                `;

                // คลิกเพื่อเลือก/ยกเลิก
                imageItem.addEventListener('click', () => {
                    if (selectedImages.has(url)) {
                        selectedImages.delete(url);
                        imageItem.classList.remove('selected');
                    } else {
                        selectedImages.add(url);
                        imageItem.classList.add('selected');
                    }
                    updateSelectedCount();
                });

                imageGrid.appendChild(imageItem);
            });
        }

        // Event Listeners
        selectAllBtn.addEventListener('click', () => {
            const imageItems = imageGrid.querySelectorAll('.image-item');
            imageItems.forEach((item, index) => {
                const url = imageUrls[index];
                if (url) {
                    selectedImages.add(url);
                    item.classList.add('selected');
                }
            });
            updateSelectedCount();
        });

        clearAllBtn.addEventListener('click', () => {
            selectedImages.clear();
            imageGrid.querySelectorAll('.image-item').forEach(item => {
                item.classList.remove('selected');
            });
            updateSelectedCount();
        });

        confirmBtn.addEventListener('click', async () => {
            if (selectedImages.size > 0) {
                showNotification(`📥 กำลังดาวน์โหลด ${selectedImages.size} รูป...`);
                await processRemoteImages(Array.from(selectedImages));
            }
            closeModal();
        });

        closeBtn.addEventListener('click', closeModal);
        modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeModal();
        });

        function closeModal() {
            document.body.removeChild(modal);
            document.head.removeChild(modalStyle);
            resolve();
        }

        // เริ่มโหลดรูปภาพ
        loadImages();
        updateSelectedCount();
    });
}

// Function to process and save remote images
async function processRemoteImages(urls) {
    let processedCount = 0;
    const newImages = [];

    for (let i = 0; i < urls.length; i++) {
        try {
            const url = urls[i];
            console.log(`Downloading: ${url}`);
            
            const response = await fetch(url);
            const blob = await response.blob();
            
            // ตรวจสอบขนาดไฟล์ก่อนประมวลผล
            if (blob.size > MAX_IMAGE_SIZE) {
                console.log(`Image ${i + 1} too large (${(blob.size / 1024 / 1024).toFixed(2)}MB), skipping...`);
                showNotification(`⚠️ รูปที่ ${i + 1} ใหญ่เกิน 2MB (${(blob.size / 1024 / 1024).toFixed(2)}MB) - ข้าม`);
                continue;
            }
            
            const resizedImage = await resizeImage(blob);
            newImages.push(resizedImage);
            processedCount++;
            
        } catch (e) {
            console.error(`Failed to download ${urls[i]}:`, e);
        }
    }
    
    if (processedCount > 0) {
        uploadedImages.push(...newImages);
        await chrome.storage.local.set({ uploadedImages: uploadedImages });
        updateImageDisplay();
        showNotification(`✅ เพิ่มรูปภาพ ${processedCount} รูปแล้ว`);
    } else {
        showNotification('⚠️ ไม่สามารถดาวน์โหลดรูปภาพได้');
    }
}

// เมื่อเลือกไฟล์
if (fileInput) {
  fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    console.log('Files selected:', files.length);

    try {
      // ตรวจสอบ storage quota ก่อน
      const hasSpace = await checkStorageQuota();
      if (!hasSpace) {
        await cleanupOldStorage();
      }

    showNotification(`📤 กำลังประมวลผล ${files.length} รูป...`);
      
      let processedCount = 0;
      const newImages = [];
      
      // ตรวจสอบขนาดไฟล์แต่ละไฟล์
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          // ตรวจสอบขนาดไฟล์ก่อนประมวลผล
          if (file.size > MAX_IMAGE_SIZE) {
            console.log(`File ${file.name} too large (${(file.size / 1024 / 1024).toFixed(2)}MB), skipping...`);
            showNotification(`⚠️ ไฟล์ ${file.name} ใหญ่เกิน 2MB (${(file.size / 1024 / 1024).toFixed(2)}MB) - ข้าม`);
            continue;
          }

          try {
            console.log(`Processing image ${i + 1}:`, file.name);
            
            // ลดขนาดรูปภาพก่อนเก็บ
            const resizedImage = await resizeImage(file);
            console.log('Image resized successfully');
            
            newImages.push(resizedImage);
            processedCount++;
            console.log(`Processed ${processedCount} images`);
            
          } catch (error) {
            console.error('Error processing image:', file.name, error);
            showNotification(`⚠️ ไม่สามารถประมวลผลรูป ${file.name}`);
          }
        }
      }

      if (processedCount > 0) {
        // เพิ่มรูปใหม่เข้าไปใน array
        uploadedImages.push(...newImages);
        
        try {
          await chrome.storage.local.set({ uploadedImages: uploadedImages });
          updateImageDisplay();
          showNotification(`✅ เพิ่มรูปภาพ ${processedCount} รูปแล้ว`);
          console.log('Images saved to storage successfully');
        } catch (error) {
          console.error('Storage error:', error);
          if (error.message.includes('quota')) {
            showNotification('⚠️ Storage เต็ม กำลังล้างข้อมูลเก่า...');
            uploadedImages = await cleanupOldStorage();
            updateImageDisplay();
          } else {
            showNotification('⚠️ เกิดข้อผิดพลาดในการบันทึก');
          }
        }
      }

    } catch (error) {
      console.error('Error in file upload:', error);
      showNotification('⚠️ เกิดข้อผิดพลาดในการอัปโหลด');
    }

    fileInput.value = '';
  });
} else {
  console.error('fileInput not found, cannot add change listener');
}

// อัปเดตการแสดงผลรูปภาพ
function updateImageDisplay() {
  try {
    console.log('Updating image display, total images:', uploadedImages.length);
    
    uploadGrid.innerHTML = ''; // Clear current
    
    // Determine how many items to show
    const maxDisplay = 6;
    const totalImages = uploadedImages.length;
    let displayCount = totalImages;
    
    if (totalImages > maxDisplay) {
      displayCount = maxDisplay;
    }
    
    for (let i = 0; i < displayCount; i++) {
      const imageData = uploadedImages[i];
      if (!imageData) {
        console.warn(`Image data at index ${i} is empty`);
        continue;
      }
      
      const slot = document.createElement('div');
      slot.className = 'upload-slot has-image';
      slot.dataset.index = i;
      
      // Check if this is the last slot and we have more images
      if (totalImages > maxDisplay && i === maxDisplay - 1) {
         const overlayCount = totalImages - (maxDisplay - 1);
         
         slot.innerHTML = `
           <img src="${imageData}" alt="Product ${i + 1}" onerror="console.error('Failed to load image ${i + 1}')">
           <div class="more-overlay">
              <span>+${overlayCount}</span>
              <span style="font-size: 10px;">more...</span>
           </div>
           <button class="remove-btn" data-index="${i}">×</button>
         `;
      } else {
         slot.innerHTML = `
           <img src="${imageData}" alt="Product ${i + 1}" onerror="console.error('Failed to load image ${i + 1}')">
           <button class="remove-btn" data-index="${i}">×</button>
         `;
      }
      
      uploadGrid.appendChild(slot);
    }
    
    // Add "Add New" slot - REMOVED per requirements for compact 3x2 grid
    // Users can use the "Select Files" button below the grid instead.
    
    imageCount.textContent = `(${uploadedImages.length})`;
    
    // ไม่มีการจำกัดจำนวนรูป ไม่ต้องเปลี่ยนสี

    // Check Random Style Visibility
    const randomStyleContainer = document.getElementById('randomStyleContainer');
    const randomStyleCheckbox = document.getElementById('randomStyleCheckbox');
    if (randomStyleContainer && randomStyleCheckbox) {
        if (uploadedImages.length > 2) {
            randomStyleContainer.style.display = 'flex';
            const labelSpan = randomStyleContainer.querySelector('span');
            // Keep the text consistent but maybe add count
            if (labelSpan) labelSpan.textContent = `🎲 Random Style กับทุกภาพที่เลือก (${uploadedImages.length} รูป)`;
        } else {
            randomStyleContainer.style.display = 'none';
            randomStyleCheckbox.checked = false;
        }
    }

    // อัปเดตปุ่มจัดการรูปภาพ
    if (manageImagesBtn && manageImageCount) {
        if (uploadedImages.length > 0) {
            manageImagesBtn.style.display = 'block';
            manageImageCount.textContent = uploadedImages.length;
        } else {
            manageImagesBtn.style.display = 'none';
        }
    }
    
    console.log('Image display updated successfully');
  } catch (error) {
    console.error('Error updating image display:', error);
    showNotification('⚠️ เกิดข้อผิดพลาดในการแสดงรูปภาพ');
  }
}

// ลบรูปภาพ
uploadGrid.addEventListener('click', async (e) => {
  if (e.target.classList.contains('remove-btn')) {
    e.stopPropagation();
    const index = parseInt(e.target.dataset.index);
    uploadedImages.splice(index, 1); // Remove item
    
    try {
      await chrome.storage.local.set({ uploadedImages: uploadedImages });
      updateImageDisplay();
      showNotification('🗑️ ลบรูปภาพแล้ว');
    } catch (error) {
      console.error('Error removing image:', error);
      showNotification('⚠️ ไม่สามารถลบรูปภาพได้');
    }
  }
});

// CSV Handling
const csvInput = document.getElementById('csvInput');
const csvStatus = document.getElementById('csvStatus');
let csvPrompts = [];

csvInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            // Split by new line, remove empty lines
            csvPrompts = text.split(/\r?\n/).filter(line => line.trim() !== '');
            csvStatus.textContent = `โหลด ${csvPrompts.length} prompts แล้ว`;
            csvStatus.style.color = '#4ade80';
        };
        // Specify encoding as UTF-8 explicitly, although readAsText default is usually UTF-8
        reader.readAsText(file, 'UTF-8');
    }
});

// Extend Scene Handling
const extendSceneToggle = document.getElementById('extendSceneToggle');
const extendSceneControls = document.getElementById('extendSceneControls');
const extendCsvInput = document.getElementById('extendCsvInput');
const extendCsvStatus = document.getElementById('extendCsvStatus');
const startExtendBtn = document.getElementById('startExtendBtn');
const stopExtendBtn = document.getElementById('stopExtendBtn');
let extendPrompts = [];

if (extendSceneToggle) {
    extendSceneToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            extendSceneControls.classList.remove('hidden');
            // Disable main Start button when Extend mode is active to avoid confusion
            const generateBtn = document.getElementById('generateBtn');
            if (generateBtn) generateBtn.disabled = true;
        } else {
            extendSceneControls.classList.add('hidden');
            const generateBtn = document.getElementById('generateBtn');
            if (generateBtn) generateBtn.disabled = false;
        }
    });
}

if (extendCsvInput) {
    extendCsvInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                // Simple CSV parse: split by newline
                extendPrompts = text.split(/\r?\n/).filter(line => line.trim() !== '');
                extendCsvStatus.textContent = `โหลด ${extendPrompts.length} prompts แล้ว`;
                extendCsvStatus.style.color = '#4ade80';
            };
            reader.readAsText(file, 'UTF-8');
        }
    });
}

if (startExtendBtn) {
        startExtendBtn.addEventListener('click', async () => {
            if (!isConnected) {
                showNotification('⚠️ กรุณาเชื่อมต่อกับ Flow ก่อน');
                return;
            }

            if (extendPrompts.length === 0) {
                showNotification('⚠️ กรุณาเลือกไฟล์ CSV ที่มี Prompts');
                return;
            }

            const ready = await waitForContentScript(currentTabId);
            if (!ready) {
                showNotification('⚠️ ไม่สามารถติดต่อหน้า Flow ได้ กรุณารีเฟรช');
                return;
            }

            startExtendBtn.disabled = true;
            startExtendBtn.innerHTML = '<span class="icon">⏳</span> กำลังทำงาน...';
            
            // Show Stop button
            if (stopExtendBtn) {
                stopExtendBtn.style.display = 'inline-flex';
                stopExtendBtn.disabled = false;
            }

            // Prepare tasks
            const tasks = extendPrompts.map((prompt, index) => ({
                mode: 'extend',
                prompt: prompt.trim(),
                id: index
            }));

            chrome.tabs.sendMessage(currentTabId, {
                action: 'startBatch',
                tasks: tasks,
                settings: {
                    mode: 'extend'
                }
            });
            
            showNotification(`🚀 เริ่มต่อฉาก ${tasks.length} รายการ`);
        });
    }

    if (stopExtendBtn) {
        stopExtendBtn.addEventListener('click', async () => {
            const sent = await sendToFlowTab({ action: 'stopAutomation' });
            if (sent) {
                showNotification('⏹ กำลังหยุดการทำงาน...');
            } else {
                showNotification('⚠️ ไม่สามารถเชื่อมต่อกับ Flow ได้');
            }
        });
    }


// ==========================================
// Generate Button Logic
// ==========================================

// ฟังก์ชันสำหรับประมวลผล prompts รวมกับ negative prompts และ checkboxes
function processPromptWithNegatives(originalPrompt) {
    let processedPrompt = originalPrompt;
    
    // เพิ่ม negative prompts ถ้ามี
    const negativePromptsValue = negativePrompts?.value?.trim();
    if (negativePromptsValue) {
        processedPrompt += ` --no ${negativePromptsValue}`;
    }
    
    // เพิ่ม negative prompts จาก checkboxes
    const additionalNegatives = [];
    
    if (noCaptionsCheckbox?.checked) {
        additionalNegatives.push('captions', 'subtitles', 'text overlay');
    }
    
    if (noTextOnImageCheckbox?.checked) {
        additionalNegatives.push('text', 'letters', 'words', 'typography', 'writing');
    }
    
    if (additionalNegatives.length > 0) {
        if (negativePromptsValue) {
            processedPrompt += `, ${additionalNegatives.join(', ')}`;
        } else {
            processedPrompt += ` --no ${additionalNegatives.join(', ')}`;
        }
    }
    
    return processedPrompt;
}

// จัดการปุ่มสร้าง
const generateBtn = document.getElementById('generateBtn');
generateBtn.addEventListener('click', async () => {
  // ตรวจสอบว่ากำลังประมวลผลอยู่หรือไม่
  if (isProcessingBatch) {
    showNotification('⚠️ กำลังสร้างคลิปอยู่ กรุณารอให้เสร็จก่อน');
    return;
  }

  try {
    const color = document.getElementById('colorSelect').value;
    
    // 1. Prepare Prompts (CSV or Manual or Random)
    let finalPrompts = [...csvPrompts];
    const randomStyleCheckbox = document.getElementById('randomStyleCheckbox');

    // Check if Random Style is active (Priority over Manual Input)
    if (randomStyleCheckbox && randomStyleCheckbox.checked && uploadedImages.length > 0) {
         console.log('Generating random styles for execution...');
         const styleKeys = Object.keys(PROMPT_STYLES);
         finalPrompts = [];
         
         for(let i=0; i<uploadedImages.length; i++) {
             const randomKey = styleKeys[Math.floor(Math.random() * styleKeys.length)];
             let stylePrompt = PROMPT_STYLES[randomKey];
             // Add enhancements
             stylePrompt += ", 8k resolution, cinematic lighting, masterpiece";
             finalPrompts.push(stylePrompt);
         }
         console.log(`Generated ${finalPrompts.length} random prompts`);
    } 
    // ถ้า CSV ว่าง และไม่ได้ใช้ Random Style ให้ลองดูจาก Manual Input
    else if (finalPrompts.length === 0) {
        const manualPromptsText = document.getElementById('manualPrompts').value;
        if (manualPromptsText && manualPromptsText.trim()) {
            finalPrompts = manualPromptsText.split(/\r?\n/).filter(line => line.trim() !== '');
            console.log('Using manual prompts:', finalPrompts.length);
        }
    }

    // ถ้ามี Product Name ให้เติมข้างหน้า
    const productName = document.getElementById('manualProduct').value.trim();
    if (productName && finalPrompts.length > 0) {
        // ถ้าใช้ Manual Input หรือ CSV ก็ตาม ถ้ามีการกรอก Product Name จะเอาไปรวม
        finalPrompts = finalPrompts.map(p => `${productName} ${p}`);
        console.log('Added product name to prompts');
    }

    // ตรวจสอบ Prompts
    if (finalPrompts.length === 0) {
        alert('กรุณาอัปโหลดไฟล์ CSV หรือกรอก Prompt ในช่อง Manual Input');
        return;
    }

    let tasks = [];
    let count = 0;

    // Prepare images list (Sequential or Random)
    let imagesToProcess = [...uploadedImages];
    const randomizeImages = document.getElementById('randomizeImages').checked;
    
    if (randomizeImages && imagesToProcess.length > 0) {
        // Fisher-Yates shuffle
        for (let i = imagesToProcess.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [imagesToProcess[i], imagesToProcess[j]] = [imagesToProcess[j], imagesToProcess[i]];
        }
        console.log('Images shuffled for task generation');
    }

    // ตรวจสอบตามโหมดที่เลือก
    if (currentMode === 'image') {
      // โหมด Frames to Video & Images - ต้องมีรูป
      if (imagesToProcess.length === 0) {
        alert('โหมด Frames to Video & Images: กรุณาอัปโหลดรูปสินค้าอย่างน้อย 1 รูป');
        return;
      }
      
      // Pair Images and Prompts
      let useSinglePrompt = document.getElementById('useSinglePrompt').checked;
      
      // If Random Style is active, force sequential mode (unique style per image)
      if (randomStyleCheckbox && randomStyleCheckbox.checked) {
          useSinglePrompt = false;
      }
      
      if (useSinglePrompt) {
          // กรณีใช้ 1 Prompt กับทุกรูปภาพ
          count = imagesToProcess.length;
          
          // ใช้ Prompt แรกสุด
          const singlePrompt = finalPrompts[0];
          
          for(let i=0; i<count; i++) {
              tasks.push({
                  image: imagesToProcess[i],
                  prompt: processPromptWithNegatives(singlePrompt),
                  color: color,
                  mode: 'image'
              });
          }
          
          showNotification(`🖼️ โหมด Frames to Video & Images - ใช้ Prompt แรกกับ ${count} รูปภาพ`);
          
      } else {
          // กรณีจับคู่ตามลำดับ (Sequential)
          count = Math.min(imagesToProcess.length, finalPrompts.length);
          if (count === 0) {
              alert('ไม่สามารถจับคู่รูปภาพกับ Prompt ได้ (จำนวนเป็น 0)');
              return;
          }
          
          for(let i=0; i<count; i++) {
              tasks.push({
                  image: imagesToProcess[i],
                  prompt: processPromptWithNegatives(finalPrompts[i]),
                  color: color,
                  mode: 'image'
              });
          }
          
          if (imagesToProcess.length !== finalPrompts.length) {
              if(!confirm(`มีรูปภาพ ${imagesToProcess.length} รูป และ Prompts ${finalPrompts.length} ข้อความ\nระบบจะสร้าง ${count} งานตามจำนวนที่น้อยกว่า\nต้องการดำเนินการต่อหรือไม่?`)) {
                  return;
              }
          }
          
          showNotification('🖼️ โหมด Frames to Video & Images - ใช้รูปภาพ + prompts');
      }
      
    } else {
      // โหมด Text to Video & Scene
      
      let useSceneBuilder = false;

      // เช็คว่ามีรูปภาพหรือไม่ (สำหรับ SceneBuilder)
      if (imagesToProcess.length > 0) {
          // ตรวจสอบกับหน้าเว็บว่าเป็น SceneBuilder จริงหรือไม่
          try {
             // ส่งข้อความไปถาม content script
             const response = await sendToFlowTab({ action: 'checkSceneBuilder' });
             if (response && response.isSceneBuilder) {
                 useSceneBuilder = true;
             }
          } catch (e) {
             console.log('Failed to check SceneBuilder status:', e);
          }
      }

      if (useSceneBuilder) {
          // ถ้ามีรูปภาพ และเป็นหน้า SceneBuilder ให้ใช้ Logic แบบ Frames to Video
          // จับคู่ 1 prompt กับ 1 รูป (Sequential)
          
          count = Math.min(imagesToProcess.length, finalPrompts.length);
          if (count === 0) {
              alert('ไม่สามารถจับคู่รูปภาพกับ Prompt ได้ (จำนวนเป็น 0)');
              return;
          }
          
          for(let i=0; i<count; i++) {
              tasks.push({
                  image: imagesToProcess[i],
                  prompt: processPromptWithNegatives(finalPrompts[i]),
                  color: color,
                  mode: 'text' // ใช้ mode text แต่ส่งรูปไปด้วย
              });
          }
          
          if (imagesToProcess.length !== finalPrompts.length) {
              if(!confirm(`(SceneBuilder) มีรูปภาพ ${imagesToProcess.length} รูป และ Prompts ${finalPrompts.length} ข้อความ\nระบบจะสร้าง ${count} งานตามจำนวนที่น้อยกว่า\nต้องการดำเนินการต่อหรือไม่?`)) {
                  return;
              }
          }
          
          showNotification('📝 โหมด Text to Video & Scene (SceneBuilder) - ใช้รูปภาพ + prompts');
          
      } else {
          // ถ้าไม่มีรูปภาพ หรือไม่ใช่หน้า SceneBuilder ใช้เฉพาะ Prompt (แบบเดิม)
          tasks = finalPrompts.map(prompt => ({
            image: null, // ไม่ใช้รูป
            prompt: processPromptWithNegatives(prompt),
            color: color,
            mode: 'text'
          }));
          
          count = tasks.length;
          
          if (imagesToProcess.length > 0) {
              showNotification('📝 Text to Video & Scene (Normal) - ไม่ใช้รูปภาพ');
          } else {
              showNotification('📝 โหมด Text to Video & Scene - ใช้เฉพาะ prompts');
          }
      }
    }
    
    // เปลี่ยนสถานะปุ่มเป็น inactive
    updateStartButtonState(false, '<span class="icon">⏳</span> กำลังส่งข้อมูล...');
    
    // อ่านค่า Settings
    const uploadDelay = parseFloat(document.getElementById('uploadDelay').value) * 1000 || 10000;
    const saveDelay = parseFloat(document.getElementById('saveDelay').value) * 1000 || 10000;
    const taskCooldown = parseFloat(document.getElementById('taskCooldown').value) * 1000 || 15000;
    const batchSize = parseInt(document.getElementById('batchSize').value) || 5;
    const batchPauseTime = parseFloat(document.getElementById('batchPauseTime').value) * 1000 || 120000;

    // Send to Content Script
    const sent = await sendToFlowTab({
        action: 'startBatch',
        tasks: tasks,
        settings: {
            uploadDelay,
            saveDelay,
            taskCooldown,
            batchSize,
            batchPauseTime
        }
    });
    
    if (sent) {
        isProcessingBatch = true;
        updateStartButtonState(false, '<span class="icon">✓</span> ส่งข้อมูลสำเร็จ');
        
        // อัปเดตสถานะเป็นกำลังสร้าง
        setTimeout(() => {
            updateStartButtonState(false, null, { current: 0, total: count });
        }, 2000);
    } else {
        throw new Error('ไม่สามารถเชื่อมต่อกับหน้า Flow ได้');
    }
    
  } catch (error) {
    console.error('Error:', error);
    alert('เกิดข้อผิดพลาด: ' + error.message);
    
    // คืนสถานะปุ่มเป็น active
    updateStartButtonState(true);
    isProcessingBatch = false;
  }
});

// เพิ่ม event listener สำหรับปุ่มล้าง Storage
const clearStorageBtn = document.getElementById('clearStorageBtn');
if (clearStorageBtn) {
    clearStorageBtn.addEventListener('click', async () => {
        if (confirm('คุณแน่ใจหรือไม่ที่จะล้างข้อมูลทั้งหมด?\nรูปภาพและการตั้งค่าจะถูกลบ')) {
            try {
                await chrome.storage.local.clear();
                uploadedImages = [];
                updateImageDisplay();
                showNotification('🧹 ล้าง Storage สำเร็จ');
                
                // แสดงสถานะ storage ใหม่
                setTimeout(checkStorageQuota, 1000);
            } catch (error) {
                console.error('Error clearing storage:', error);
                showNotification('⚠️ ไม่สามารถล้าง Storage ได้');
            }
        }
    });
}

// ฟังก์ชันแสดงการแจ้งเตือนใน sidepanel
function showNotification(message) {
  // สร้าง notification element
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #dc2626 0%, #b91c1c 50%, #ffd700 100%);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4), 0 0 20px rgba(255, 215, 0, 0.3);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px;
    font-weight: 500;
    animation: slideIn 0.3s ease;
    max-width: 300px;
    border: 1px solid rgba(255, 215, 0, 0.5);
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

// Helper to send message to active flow tab
async function sendToFlowTab(message) {
  try {
    // Attempt 1: Use currentTabId if available
    if (currentTabId) {
      try {
        const response = await chrome.tabs.sendMessage(currentTabId, message);
        return response || true;
      } catch (e) {
        console.log('Failed to send to currentTabId, retrying with fresh query...', e);
        currentTabId = null; // Reset invalid ID
      }
    }

    // Attempt 2: Query for tabs
    const tabs = await chrome.tabs.query({ url: 'https://labs.google/fx/tools/flow/*' });
    if (tabs.length > 0) {
      // Prioritize active tab if multiple
      const activeTab = tabs.find(t => t.active) || tabs[0];
      currentTabId = activeTab.id;
      
      // Update URL just in case
      currentFlowUrl = activeTab.url;
      
      try {
        const response = await chrome.tabs.sendMessage(currentTabId, message);
        return response || true;
      } catch (err) {
        if (err.message.includes('Receiving end does not exist')) {
          console.log('Content script not ready, injecting...');
          try {
            await chrome.scripting.executeScript({
              target: { tabId: currentTabId },
              files: ['content.js']
            });
            // Wait a bit for script to initialize
            await new Promise(resolve => setTimeout(resolve, 500));
            // Retry
            const response = await chrome.tabs.sendMessage(currentTabId, message);
            return response || true;
          } catch (injectErr) {
             console.error('Failed to inject script:', injectErr);
             throw injectErr;
          }
        }
        throw err;
      }
    }
    
    console.error('No Flow tabs found');
    return false;
  } catch (err) {
    console.error('Error sending message:', err);
    return false;
  }
}

// Pause Button
document.getElementById('pauseBtn').addEventListener('click', async () => {
  const sent = await sendToFlowTab({ action: 'pauseAutomation' });
  if (sent) {
     const btn = document.getElementById('pauseBtn');
     btn.innerHTML = '<span class="icon">✓</span> Paused';
     setTimeout(() => btn.innerHTML = '<span class="icon">⏸</span> Pause', 2000);
  } else {
     alert('ไม่พบแท็บ Flow หรือไม่ได้เชื่อมต่อ');
  }
});

// Stop Button
document.getElementById('stopBtn').addEventListener('click', async () => {
  const sentStop = await sendToFlowTab({ action: 'stopAutomation' });
  if (sentStop) {
     await sendToFlowTab({ action: 'clearAutomation' });
     isProcessingBatch = false;
     updateStartButtonState(true);
     resetExtendButtons();
     const btn = document.getElementById('stopBtn');
     btn.innerHTML = '<span class="icon">✓</span> Stopped & Cleared';
     setTimeout(() => btn.innerHTML = '<span class="icon">⏹</span> Stop', 2000);
     showNotification('🗑 หยุดและล้างงานที่ค้างทั้งหมดเรียบร้อย');
  } else {
     alert('ไม่พบแท็บ Flow หรือไม่ได้เชื่อมต่อ');
  }
});

// How to Button
const howToBtn = document.getElementById('howToBtn');
if (howToBtn) {
    howToBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'user-guide.html' });
    });
}

// Style Selection Logic
const PROMPT_STYLES = {
    "luxury_director": `Create a premium product advertisement based strictly on the uploaded reference image(s). Analyze the product and determine whether a male or female model should be present. If a model exists in the uploaded image, preserve the same identity and have the model naturally hold, wear, or use the product depending on its category. If no model is provided, introduce a suitable professional model that matches the brand’s target audience. Design a luxurious, powerful CGI scene with cinematic lighting, refined reflections, elegant particles, and a high-end atmosphere. Render in hyper-realistic quality. Automatically generate a Thai CTA based on the product’s strongest value, displayed in bold typography with a premium gradient fill and a clean, well-balanced stroke.`,
    "cinematic_prestige": `Analyze the uploaded image to identify the product, usage context, and ideal model interaction. Depict the model realistically using or holding the product. Create a cinematic CGI scene featuring volumetric lighting, god rays, atmospheric depth, and premium contrast. Maintain absolute realism in product and model proportions. Automatically generate a Thai CTA aligned with the product’s premium positioning, styled in bold gradient typography with an elegant stroke.`,
    "dark_authority": `Analyze the uploaded reference image(s) to identify product type and user persona. Present a suitable model confidently interacting with the product. Create a dark luxury CGI advertisement using controlled smoke, rim lighting, dramatic shadows, and refined highlights. Keep the product as the hero. Automatically generate a strong Thai CTA derived from the product’s authority and value, rendered in bold gradient text with a sharp but refined stroke.`,
    "minimal_billion": `Analyze the uploaded image to determine product form, material quality, and brand tone. Place a model only if it enhances credibility and scale, interacting naturally with the product. Create a clean, minimal CGI scene with studio-grade lighting, soft shadows, and precise composition. Hyper-realistic rendering only. Automatically generate a concise Thai CTA reflecting simplicity and quality, styled as bold gradient typography with subtle stroke.`,
    "epic_scale": `Analyze the uploaded product image and decide the appropriate model interaction. Generate an epic-scale CGI scene with cinematic camera movement, slow-motion particles, and atmospheric depth. The model and product must feel grounded and realistic. Automatically generate a Thai CTA emphasizing impact or performance, presented in bold gradient lettering with a balanced stroke.`,
    "smart_tech": `Analyze the uploaded image to determine whether the product is technology- or innovation-focused. Present a model using the product naturally in a futuristic yet realistic luxury CGI environment with controlled energy glow or light trails. Avoid exaggeration beyond real-world use. Automatically generate a Thai CTA highlighting intelligence or innovation, displayed in bold gradient typography with a clean stroke.`,
    "emotional_story": `Analyze the uploaded image to infer lifestyle and emotional context. Introduce or preserve a model expressing natural emotion while using the product. Create a cinematic CGI scene that subtly tells a story through lighting, mood, and composition. Hyper-realistic, premium color grading. Automatically generate an emotionally resonant Thai CTA, styled in bold gradient text with a soft, elegant stroke.`,
    "nature_fusion": `Analyze whether the uploaded product logically fits a natural or elemental environment. If suitable, show a model interacting with the product within a luxury nature-inspired CGI scene (water, mist, light, wind). If not suitable, default to a premium studio setting. Automatically generate a Thai CTA derived from the product’s real benefit, shown in bold gradient typography with appropriate stroke thickness.`,
    "viral_hook": `Analyze the uploaded image to identify the most attention-grabbing visual and usage moment. Create a scroll-stopping CGI composition featuring a model interacting with the product in a dynamic yet premium way. Ensure clarity within the first visual beat. Automatically generate a punchy Thai CTA optimized for engagement, rendered in bold gradient lettering with high-contrast stroke for readability.`,
    "master_brain": `Act as a world-class commercial director. Fully analyze the uploaded reference image(s) to determine product type, target audience, ideal model presence, interaction style, CGI effects, lighting, and mood. Generate a hyper-realistic, luxury CGI advertisement that meets global advertising standards. Automatically generate a Thai CTA perfectly aligned with the product’s real positioning, displayed in bold, premium gradient typography with a professionally balanced stroke.`
};

const styleSelect = document.getElementById('styleSelect');
const manualPrompts = document.getElementById('manualPrompts');
const negativePrompts = document.getElementById('negativePrompts');
const noCaptionsCheckbox = document.getElementById('noCaptionsCheckbox');
const noTextOnImageCheckbox = document.getElementById('noTextOnImageCheckbox');
const useNegativePromptsCheckbox = document.getElementById('useNegativePromptsCheckbox');
const globalNoCaptionsCheckbox = document.getElementById('globalNoCaptionsCheckbox');
const globalNoTextCheckbox = document.getElementById('globalNoTextCheckbox');

if (styleSelect && manualPrompts) {
    styleSelect.addEventListener('change', (e) => {
        const selectedStyle = e.target.value;
        if (selectedStyle && PROMPT_STYLES[selectedStyle]) {
            manualPrompts.value = PROMPT_STYLES[selectedStyle];
            
            // เพิ่ม negative prompts เริ่มต้นตามสไตล์
            if (negativePrompts) {
                let defaultNegative = 'text, watermark, logo, signature, blurry, low quality, distorted';
                
                // เพิ่ม negative prompts เฉพาะตามสไตล์
                if (selectedStyle.includes('luxury') || selectedStyle.includes('prestige')) {
                    defaultNegative += ', cheap, plastic, fake, amateur';
                } else if (selectedStyle.includes('tech') || selectedStyle.includes('smart')) {
                    defaultNegative += ', outdated, old-fashioned, analog';
                }
                
                negativePrompts.value = defaultNegative;
            }
            
            // Visual feedback
            manualPrompts.style.transition = 'background-color 0.3s';
            manualPrompts.style.backgroundColor = 'rgba(0, 113, 227, 0.1)';
            setTimeout(() => {
                manualPrompts.style.backgroundColor = '';
            }, 500);
        }
    });
}

// เพิ่ม event listeners สำหรับบันทึกค่า negative prompts และ checkboxes
if (negativePrompts) {
    negativePrompts.addEventListener('input', () => {
        chrome.storage.local.set({ negativePrompts: negativePrompts.value });
    });
}

if (noCaptionsCheckbox) {
    noCaptionsCheckbox.addEventListener('change', () => {
        chrome.storage.local.set({ noCaptions: noCaptionsCheckbox.checked });
    });
}

if (noTextOnImageCheckbox) {
    noTextOnImageCheckbox.addEventListener('change', () => {
        chrome.storage.local.set({ noTextOnImage: noTextOnImageCheckbox.checked });
    });
}

// Smart Enhance Logic
const smartEnhanceBtn = document.getElementById('smartEnhanceBtn');
if (smartEnhanceBtn && manualPrompts) {
    smartEnhanceBtn.addEventListener('click', () => {
        // Loading State
        const originalText = smartEnhanceBtn.innerHTML;
        smartEnhanceBtn.innerHTML = '<span class="icon">✨</span> Enhancing...';
        smartEnhanceBtn.disabled = true;

        setTimeout(() => {
            // Check Random Style First
            const randomStyleCheckbox = document.getElementById('randomStyleCheckbox');
            
            if (randomStyleCheckbox && randomStyleCheckbox.checked && uploadedImages.length > 0) {
                // Generate Random Styles for all images
                const styleKeys = Object.keys(PROMPT_STYLES);
                const generatedPrompts = [];
                
                for(let i=0; i<uploadedImages.length; i++) {
                     const randomKey = styleKeys[Math.floor(Math.random() * styleKeys.length)];
                     let stylePrompt = PROMPT_STYLES[randomKey];
                     
                     // Add simple enhancement to ensure quality
                     stylePrompt += ", 8k resolution, cinematic lighting, masterpiece";
                     
                     generatedPrompts.push(stylePrompt);
                }
                
                manualPrompts.value = generatedPrompts.join('\n');
                showNotification(`🎲 สุ่มสไตล์ให้ ${uploadedImages.length} รูปเรียบร้อย!`);
                
            } else {
                // Existing Single Prompt Logic
                let currentText = manualPrompts.value.trim();
                
                // Base enhancements
                const qualityKeywords = [
                    "cinematic lighting",
                    "8k resolution", 
                    "photorealistic",
                    "highly detailed",
                    "depth of field",
                    "sharp focus",
                    "professional photography", 
                    "masterpiece",
                    "best quality", 
                    "HDR",
                    "volumetric lighting"
                ];

                // If empty, provide a strong base
                if (!currentText) {
                    currentText = "A luxury product shot, premium quality, elegant atmosphere";
                }

                // Check and append missing keywords
                const textLower = currentText.toLowerCase();
                const keywordsToAdd = qualityKeywords.filter(kw => !textLower.includes(kw.toLowerCase()));
                
                // Select random subset of keywords
                const randomKeywords = keywordsToAdd.sort(() => 0.5 - Math.random()).slice(0, 6);
                
                if (randomKeywords.length > 0) {
                    currentText += ", " + randomKeywords.join(", ");
                }

                // Update Textarea
                manualPrompts.value = currentText;
            }

            // Visual Feedback
            manualPrompts.style.transition = 'background-color 0.5s';
            manualPrompts.style.backgroundColor = 'rgba(255, 215, 0, 0.2)'; // Gold tint
            setTimeout(() => {
                manualPrompts.style.backgroundColor = '';
            }, 800);

            // Restore Button
            smartEnhanceBtn.innerHTML = '<span class="icon">✨</span> Enhanced!';
            setTimeout(() => {
                smartEnhanceBtn.innerHTML = originalText;
                smartEnhanceBtn.disabled = false;
            }, 1500);

        }, 800); // Fake delay for "AI processing" feel
    });
}

// ==========================================
// AUTO WORKFLOW SYSTEM
// ==========================================

// ตัวแปรสำหรับ Auto Workflow
let workflowState = {
    isActive: false,
    isPaused: false,
    currentWorkflow: null,
    currentStep: 0,
    currentProductIndex: 0,
    totalProducts: 0,
    steps: [],
    settings: {}
};

// Workflow Elements
const workflowSelect = document.getElementById('workflowSelect');
const productBasketWorkflow = document.getElementById('productBasketWorkflow');
const customWorkflow = document.getElementById('customWorkflow');
const workflowStatus = document.getElementById('workflowStatus');
const currentWorkflowStep = document.getElementById('currentWorkflowStep');
const workflowProgressBar = document.getElementById('workflowProgressBar');
const workflowProgressText = document.getElementById('workflowProgressText');
const startWorkflowBtn = document.getElementById('startWorkflowBtn');
const workflowActionControls = document.querySelector('.workflow-action-controls');
const pauseWorkflowBtn = document.getElementById('pauseWorkflowBtn');
const stopWorkflowBtn = document.getElementById('stopWorkflowBtn');
const skipWorkflowStepBtn = document.getElementById('skipWorkflowStepBtn');

// Workflow Selection Handler
if (workflowSelect) {
    workflowSelect.addEventListener('change', (e) => {
        const selectedWorkflow = e.target.value;
        
        // Hide all workflow configs
        if (productBasketWorkflow) productBasketWorkflow.classList.add('hidden');
        if (customWorkflow) customWorkflow.classList.add('hidden');
        
        // Show selected workflow config
        if (selectedWorkflow === 'product_basket') {
            if (productBasketWorkflow) productBasketWorkflow.classList.remove('hidden');
        } else if (selectedWorkflow === 'custom_workflow') {
            if (customWorkflow) customWorkflow.classList.remove('hidden');
        }
        
        // Update start button
        updateWorkflowStartButton(selectedWorkflow);
    });
}

// Update Workflow Start Button
function updateWorkflowStartButton(workflowType) {
    if (!startWorkflowBtn) return;
    
    if (workflowType === 'product_basket') {
        startWorkflowBtn.innerHTML = '<span class="icon">🛒</span> เริ่ม Product Basket Workflow';
        startWorkflowBtn.disabled = false;
    } else if (workflowType === 'custom_workflow') {
        startWorkflowBtn.innerHTML = '<span class="icon">⚙️</span> เริ่ม Custom Workflow';
        startWorkflowBtn.disabled = false;
    } else {
        startWorkflowBtn.innerHTML = '<span class="icon">🤖</span> เริ่ม Auto Workflow';
        startWorkflowBtn.disabled = true;
    }
}

// Start Workflow Handler
if (startWorkflowBtn) {
    startWorkflowBtn.addEventListener('click', async () => {
        const selectedWorkflow = workflowSelect?.value;
        
        if (!selectedWorkflow) {
            showNotification('⚠️ กรุณาเลือก Workflow');
            return;
        }
        
        if (!isConnected) {
            showNotification('⚠️ กรุณาเชื่อมต่อกับ Flow ก่อน');
            return;
        }
        
        if (uploadedImages.length === 0) {
            showNotification('⚠️ กรุณาอัปโหลดรูปสินค้าก่อน');
            return;
        }
        
        // เริ่ม Workflow
        await startAutoWorkflow(selectedWorkflow);
    });
}

// Workflow Control Handlers
if (pauseWorkflowBtn) {
    pauseWorkflowBtn.addEventListener('click', () => {
        workflowState.isPaused = !workflowState.isPaused;
        pauseWorkflowBtn.innerHTML = workflowState.isPaused ? 
            '<span class="icon">▶</span> Resume' : 
            '<span class="icon">⏸</span> Pause';
        
        showNotification(workflowState.isPaused ? '⏸ Workflow หยุดชั่วคราว' : '▶ Workflow ทำงานต่อ');
    });
}

if (stopWorkflowBtn) {
    stopWorkflowBtn.addEventListener('click', () => {
        stopAutoWorkflow();
    });
}

if (skipWorkflowStepBtn) {
    skipWorkflowStepBtn.addEventListener('click', () => {
        skipCurrentWorkflowStep();
    });
}

// Start Auto Workflow
async function startAutoWorkflow(workflowType) {
    try {
        // ตรวจสอบ content script
        const ready = await waitForContentScript(currentTabId);
        if (!ready) {
            showNotification('⚠️ ไม่สามารถติดต่อหน้า Flow ได้ กรุณารีเฟรช');
            return;
        }
        
        // เตรียม workflow state
        workflowState = {
            isActive: true,
            isPaused: false,
            currentWorkflow: workflowType,
            currentStep: 0,
            currentProductIndex: 0,
            totalProducts: uploadedImages.length,
            steps: getWorkflowSteps(workflowType),
            settings: getWorkflowSettings(workflowType)
        };
        
        // อัปเดต UI
        updateWorkflowUI(true);
        showWorkflowStatus();
        
        showNotification(`🤖 เริ่ม ${getWorkflowName(workflowType)} สำหรับ ${workflowState.totalProducts} สินค้า`);
        
        // เริ่มขั้นตอนแรก
        await executeNextWorkflowStep();
        
    } catch (error) {
        console.error('Error starting workflow:', error);
        showNotification('⚠️ เกิดข้อผิดพลาดในการเริ่ม Workflow');
        stopAutoWorkflow();
    }
}

// Stop Auto Workflow
function stopAutoWorkflow() {
    workflowState.isActive = false;
    workflowState.isPaused = false;
    
    updateWorkflowUI(false);
    hideWorkflowStatus();
    
    showNotification('⏹ หยุด Auto Workflow แล้ว');
}

// Skip Current Workflow Step
function skipCurrentWorkflowStep() {
    if (!workflowState.isActive) return;
    
    showNotification('⏭️ ข้ามขั้นตอนปัจจุบัน');
    workflowState.currentStep++;
    
    setTimeout(() => {
        executeNextWorkflowStep();
    }, 1000);
}

// Get Workflow Steps
function getWorkflowSteps(workflowType) {
    if (workflowType === 'product_basket') {
        return [
            'navigate_to_images',      // ไปหน้า Images > Create Images
            'upload_product_image',    // อัปโหลดรูปสินค้า
            'generate_image',          // สร้างรูป
            'add_to_prompts',          // Add to Prompts
            'generate_video',          // สร้างวิดีโอ
            'navigate_to_scenebuilder', // ไปหน้า SceneBuilder
            'extend_scene_hook',       // ต่อฉาก 1: Hook
            'extend_scene_painpoint',  // ต่อฉาก 2: Pain Point
            'extend_scene_solution',   // ต่อฉาก 3: Solution
            'extend_scene_cta',        // ต่อฉาก 4: Call to Action
            'download_video',          // ดาวน์โหลดวิดีโอ
            'next_product'             // ไปสินค้าถัดไป
        ];
    } else if (workflowType === 'custom_workflow') {
        // Parse custom workflow steps
        const customSteps = document.getElementById('customWorkflowSteps')?.value || '';
        return customSteps.split('\n').filter(step => step.trim()).map((step, index) => `custom_step_${index}`);
    }
    
    return [];
}

// Get Workflow Settings
function getWorkflowSettings(workflowType) {
    if (workflowType === 'product_basket') {
        return {
            imageGenDelay: parseInt(document.getElementById('imageGenDelay')?.value || '30') * 1000,
            videoGenDelay: parseInt(document.getElementById('videoGenDelay')?.value || '60') * 1000,
            sceneExtendDelay: parseInt(document.getElementById('sceneExtendDelay')?.value || '45') * 1000,
            downloadDelay: parseInt(document.getElementById('downloadDelay')?.value || '15') * 1000,
            autoDownload: document.getElementById('autoDownloadWorkflow')?.checked || true,
            hookPrompt: document.getElementById('hookPrompt')?.value || 'Show the product in an eye-catching way that creates immediate curiosity and desire',
            painPointPrompt: document.getElementById('painPointPrompt')?.value || 'Highlight the common problem or frustration that this product solves',
            solutionPrompt: document.getElementById('solutionPrompt')?.value || 'Demonstrate how this product perfectly solves the problem, show benefits',
            ctaPrompt: document.getElementById('ctaPrompt')?.value || 'Create urgency and encourage immediate action - buy now, limited offer'
        };
    }
    
    return {};
}

// Get Workflow Name
function getWorkflowName(workflowType) {
    const names = {
        'product_basket': 'Product Basket Workflow',
        'custom_workflow': 'Custom Workflow'
    };
    return names[workflowType] || 'Unknown Workflow';
}

// Execute Next Workflow Step
async function executeNextWorkflowStep() {
    if (!workflowState.isActive) return;
    
    // ตรวจสอบ pause
    if (workflowState.isPaused) {
        setTimeout(() => executeNextWorkflowStep(), 1000);
        return;
    }
    
    // ตรวจสอบว่าจบแล้วหรือยัง
    if (workflowState.currentProductIndex >= workflowState.totalProducts) {
        completeWorkflow();
        return;
    }
    
    // ตรวจสอบขั้นตอนปัจจุบัน
    if (workflowState.currentStep >= workflowState.steps.length) {
        // จบขั้นตอนสำหรับสินค้าชิ้นนี้ ไปสินค้าถัดไป
        workflowState.currentProductIndex++;
        workflowState.currentStep = 0;
        
        if (workflowState.currentProductIndex < workflowState.totalProducts) {
            updateWorkflowProgress();
            setTimeout(() => executeNextWorkflowStep(), 2000);
        } else {
            completeWorkflow();
        }
        return;
    }
    
    const currentStep = workflowState.steps[workflowState.currentStep];
    const currentProduct = uploadedImages[workflowState.currentProductIndex];
    
    console.log(`Executing workflow step: ${currentStep} for product ${workflowState.currentProductIndex + 1}`);
    
    // อัปเดต UI
    updateWorkflowProgress();
    updateCurrentStepDisplay(currentStep);
    
    try {
        // Execute step
        await executeWorkflowStep(currentStep, currentProduct, workflowState.currentProductIndex);
        
        // ไปขั้นตอนถัดไป
        workflowState.currentStep++;
        
        // รอตามการตั้งค่าแล้วทำขั้นตอนถัดไป
        const delay = getStepDelay(currentStep);
        setTimeout(() => executeNextWorkflowStep(), delay);
        
    } catch (error) {
        console.error('Error executing workflow step:', currentStep, error);
        showNotification(`⚠️ เกิดข้อผิดพลาดในขั้นตอน: ${getStepDisplayName(currentStep)}`);
        
        // ข้ามขั้นตอนนี้และทำต่อ
        workflowState.currentStep++;
        setTimeout(() => executeNextWorkflowStep(), 3000);
    }
}

// Execute Individual Workflow Step
async function executeWorkflowStep(stepName, productImage, productIndex) {
    switch (stepName) {
        case 'navigate_to_images':
            await navigateToImagesMode();
            break;
            
        case 'upload_product_image':
            await uploadProductImageForWorkflow(productImage, productIndex);
            break;
            
        case 'generate_image':
            await generateImageForWorkflow();
            break;
            
        case 'add_to_prompts':
            await addImageToPrompts();
            break;
            
        case 'generate_video':
            await generateVideoForWorkflow();
            break;
            
        case 'navigate_to_scenebuilder':
            await navigateToSceneBuilder();
            break;
            
        case 'extend_scene_hook':
            await extendSceneWithPrompt(workflowState.settings.hookPrompt, 'Hook');
            break;
            
        case 'extend_scene_painpoint':
            await extendSceneWithPrompt(workflowState.settings.painPointPrompt, 'Pain Point');
            break;
            
        case 'extend_scene_solution':
            await extendSceneWithPrompt(workflowState.settings.solutionPrompt, 'Solution');
            break;
            
        case 'extend_scene_cta':
            await extendSceneWithPrompt(workflowState.settings.ctaPrompt, 'Call to Action');
            break;
            
        case 'download_video':
            await downloadVideoForWorkflow();
            break;
            
        case 'next_product':
            // This is handled in executeNextWorkflowStep
            break;
            
        default:
            console.log('Unknown workflow step:', stepName);
    }
}

// Workflow Step Implementations
async function navigateToImagesMode() {
    showNotification('🖼️ กำลังไปหน้า Images > Create Images...');
    
    // Send message to content script to navigate to Images mode
    await chrome.tabs.sendMessage(currentTabId, {
        action: 'navigateToImagesMode'
    });
}

async function uploadProductImageForWorkflow(productImage, productIndex) {
    showNotification(`📤 กำลังอัปโหลดรูปสินค้าที่ ${productIndex + 1}...`);
    
    // Send message to content script to upload image
    await chrome.tabs.sendMessage(currentTabId, {
        action: 'uploadImageForWorkflow',
        image: productImage,
        index: productIndex
    });
}

async function generateImageForWorkflow() {
    showNotification('🎨 กำลังสร้างรูปภาพ...');
    
    // Get prompt from CSV or manual input
    let prompt = '';
    if (csvPrompts.length > 0) {
        const promptIndex = workflowState.currentProductIndex % csvPrompts.length;
        prompt = csvPrompts[promptIndex];
    } else {
        prompt = document.getElementById('manualPrompts')?.value || 'Create a professional product image';
    }
    
    // Send message to content script to generate image
    await chrome.tabs.sendMessage(currentTabId, {
        action: 'generateImageWithPrompt',
        prompt: prompt
    });
}

async function addImageToPrompts() {
    showNotification('➕ กำลังเพิ่มรูปไปยัง Prompts...');
    
    // Send message to content script to add image to prompts
    await chrome.tabs.sendMessage(currentTabId, {
        action: 'addImageToPrompts'
    });
}

async function generateVideoForWorkflow() {
    showNotification('🎬 กำลังสร้างวิดีโอ...');
    
    // Get the same prompt used for image generation
    let prompt = '';
    if (csvPrompts.length > 0) {
        const promptIndex = workflowState.currentProductIndex % csvPrompts.length;
        prompt = csvPrompts[promptIndex];
    } else {
        prompt = document.getElementById('manualPrompts')?.value || 'Create a professional product video';
    }
    
    // Send message to content script to generate video
    await chrome.tabs.sendMessage(currentTabId, {
        action: 'generateVideoWithPrompt',
        prompt: prompt
    });
}

async function navigateToSceneBuilder() {
    showNotification('🎭 กำลังไปหน้า SceneBuilder...');
    
    // Send message to content script to navigate to SceneBuilder
    await chrome.tabs.sendMessage(currentTabId, {
        action: 'navigateToSceneBuilder'
    });
}

async function extendSceneWithPrompt(prompt, sceneName) {
    showNotification(`🎬 กำลังต่อฉาก: ${sceneName}...`);
    
    // Send message to content script to extend scene
    await chrome.tabs.sendMessage(currentTabId, {
        action: 'extendSceneWithPrompt',
        prompt: prompt,
        sceneName: sceneName
    });
}

async function downloadVideoForWorkflow() {
    if (!workflowState.settings.autoDownload) {
        showNotification('📥 กรุณาดาวน์โหลดวิดีโอด้วยตนเอง');
        return;
    }
    
    showNotification('📥 กำลังดาวน์โหลดวิดีโอ...');
    
    // Send message to content script to download video
    await chrome.tabs.sendMessage(currentTabId, {
        action: 'downloadVideoForWorkflow'
    });
}

// Get Step Delay
function getStepDelay(stepName) {
    const delays = {
        'navigate_to_images': 3000,
        'upload_product_image': 5000,
        'generate_image': workflowState.settings.imageGenDelay || 30000,
        'add_to_prompts': 3000,
        'generate_video': workflowState.settings.videoGenDelay || 60000,
        'navigate_to_scenebuilder': 5000,
        'extend_scene_hook': workflowState.settings.sceneExtendDelay || 45000,
        'extend_scene_painpoint': workflowState.settings.sceneExtendDelay || 45000,
        'extend_scene_solution': workflowState.settings.sceneExtendDelay || 45000,
        'extend_scene_cta': workflowState.settings.sceneExtendDelay || 45000,
        'download_video': workflowState.settings.downloadDelay || 15000,
        'next_product': 2000
    };
    
    return delays[stepName] || 3000;
}

// Get Step Display Name
function getStepDisplayName(stepName) {
    const names = {
        'navigate_to_images': 'ไปหน้า Images',
        'upload_product_image': 'อัปโหลดรูปสินค้า',
        'generate_image': 'สร้างรูปภาพ',
        'add_to_prompts': 'เพิ่มไปยัง Prompts',
        'generate_video': 'สร้างวิดีโอ',
        'navigate_to_scenebuilder': 'ไปหน้า SceneBuilder',
        'extend_scene_hook': 'ต่อฉาก Hook',
        'extend_scene_painpoint': 'ต่อฉาก Pain Point',
        'extend_scene_solution': 'ต่อฉาก Solution',
        'extend_scene_cta': 'ต่อฉาก Call to Action',
        'download_video': 'ดาวน์โหลดวิดีโอ',
        'next_product': 'ไปสินค้าถัดไป'
    };
    
    return names[stepName] || stepName;
}

// Update Workflow UI
function updateWorkflowUI(isActive) {
    if (isActive) {
        // Hide start button, show controls
        if (startWorkflowBtn) startWorkflowBtn.style.display = 'none';
        if (workflowActionControls) {
            workflowActionControls.style.display = 'flex';
            workflowActionControls.classList.remove('hidden');
        }
    } else {
        // Show start button, hide controls
        if (startWorkflowBtn) startWorkflowBtn.style.display = 'block';
        if (workflowActionControls) {
            workflowActionControls.style.display = 'none';
            workflowActionControls.classList.add('hidden');
        }
        
        // Reset pause button
        if (pauseWorkflowBtn) {
            pauseWorkflowBtn.innerHTML = '<span class="icon">⏸</span> Pause';
        }
    }
}

// Show Workflow Status
function showWorkflowStatus() {
    if (workflowStatus) {
        workflowStatus.classList.remove('hidden');
    }
}

// Hide Workflow Status
function hideWorkflowStatus() {
    if (workflowStatus) {
        workflowStatus.classList.add('hidden');
    }
}

// Update Workflow Progress
function updateWorkflowProgress() {
    const progress = ((workflowState.currentProductIndex / workflowState.totalProducts) * 100);
    
    if (workflowProgressBar) {
        workflowProgressBar.style.width = `${progress}%`;
    }
    
    if (workflowProgressText) {
        workflowProgressText.textContent = `${workflowState.currentProductIndex}/${workflowState.totalProducts} สินค้า`;
    }
}

// Update Current Step Display
function updateCurrentStepDisplay(stepName) {
    if (currentWorkflowStep) {
        const stepDisplayName = getStepDisplayName(stepName);
        const productNum = workflowState.currentProductIndex + 1;
        currentWorkflowStep.textContent = `สินค้าที่ ${productNum}: ${stepDisplayName}`;
    }
}

// Complete Workflow
function completeWorkflow() {
    workflowState.isActive = false;
    
    updateWorkflowUI(false);
    hideWorkflowStatus();
    
    showNotification(`✅ เสร็จสิ้น ${getWorkflowName(workflowState.currentWorkflow)} สำหรับ ${workflowState.totalProducts} สินค้า!`);
    
    // Reset workflow state
    workflowState = {
        isActive: false,
        isPaused: false,
        currentWorkflow: null,
        currentStep: 0,
        currentProductIndex: 0,
        totalProducts: 0,
        steps: [],
        settings: {}
    };
}

// Initialize Workflow UI
function initializeWorkflowUI() {
    // Hide workflow configs initially
    if (productBasketWorkflow) productBasketWorkflow.classList.add('hidden');
    if (customWorkflow) customWorkflow.classList.add('hidden');
    if (workflowStatus) workflowStatus.classList.add('hidden');
    if (workflowActionControls) workflowActionControls.classList.add('hidden');
    
    // Set default values
    updateWorkflowStartButton('');
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeWorkflowUI();
});

// Export workflow functions for content script communication
window.workflowFunctions = {
    executeNextWorkflowStep,
    stopAutoWorkflow,
    updateWorkflowProgress,
    updateCurrentStepDisplay
};