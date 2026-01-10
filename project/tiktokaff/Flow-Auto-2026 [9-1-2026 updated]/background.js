// เปิด side panel และหน้า Flow เมื่อคลิกไอคอน extension
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // เปิด side panel
    await chrome.sidePanel.open({ windowId: tab.windowId });
    
    // ตรวจสอบว่ามีแท็บ Flow เปิดอยู่หรือไม่
    const flowTabs = await chrome.tabs.query({ url: '*://labs.google/fx/tools/flow*' });
    
    if (flowTabs.length === 0) {
      // ถ้าไม่มี ให้เปิดหน้า Flow ใหม่
      await chrome.tabs.create({
        url: 'https://labs.google/fx/tools/flow',
        active: true
      });
    } else {
      // ถ้ามีแล้ว ให้เปลี่ยนไปที่แท็บนั้น
      await chrome.tabs.update(flowTabs[0].id, { active: true });
    }
  } catch (error) {
    console.error('Error opening side panel:', error);
  }
});

// ตั้งค่า side panel ให้พร้อมใช้งานเสมอ
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// ตั้งค่าให้เปิด side panel อัตโนมัติเมื่อเข้าเว็บ Google Labs Flow
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('labs.google/fx/tools/flow')) {
    try {
      await chrome.sidePanel.setOptions({
        tabId,
        path: 'sidepanel.html',
        enabled: true
      });
      
      // ส่งข้อมูล URL ไปยัง sidepanel
      chrome.runtime.sendMessage({
        action: 'flowPageDetected',
        url: tab.url,
        tabId: tabId
      }).catch(() => {
        // Ignore error if sidepanel is not open
      });
    } catch (error) {
      console.error('Error setting side panel options:', error);
    }
  }
});
