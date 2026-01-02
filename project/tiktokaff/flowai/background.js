/**
 * Background Service Worker for Flow AI Unlocked
 */

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
});

// Set side panel behavior
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Initialize default settings on first install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({
      autoScan: false,
      notifications: true,
      products: [],
      uploadHistory: [],
      productPresets: [],
      productCategories: []
    });
    console.log('Flow AI Unlocked installed');
  }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'downloadFile') {
    chrome.downloads.download({
      url: message.url,
      filename: message.filename
    }, (downloadId) => {
      sendResponse({ success: true, downloadId });
    });
    return true;
  }
});
