// OAuth Auto-Approver Background Service Worker

// Initialize extension state
chrome.runtime.onInstalled.addListener(async () => {
  // Set default values
  const settings = await chrome.storage.sync.get(['enabled', 'delay']);
  if (settings.enabled === undefined) {
    await chrome.storage.sync.set({ enabled: true, delay: 1500, activityLog: [] });
  }

  // Update badge
  updateBadge(settings.enabled !== false);
});

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'logAction') {
    logActivity(message.data);
    sendResponse({ success: true });
  } else if (message.type === 'updateBadge') {
    updateBadge(message.enabled);
    sendResponse({ success: true });
  } else if (message.type === 'getStatus') {
    chrome.storage.sync.get(['enabled']).then(result => {
      sendResponse({ enabled: result.enabled !== false });
    });
    return true; // Keep channel open for async response
  }
});

// Update extension badge
function updateBadge(enabled) {
  chrome.action.setBadgeText({ text: enabled ? 'ON' : 'OFF' });
  chrome.action.setBadgeBackgroundColor({
    color: enabled ? '#22c55e' : '#6b7280'
  });
}

// Log activity
async function logActivity(data) {
  const result = await chrome.storage.sync.get(['activityLog']);
  const logs = result.activityLog || [];

  // Add new entry
  logs.push(data);

  // Keep only last 20 entries
  if (logs.length > 20) {
    logs.shift();
  }

  await chrome.storage.sync.set({ activityLog: logs });
}

// Initialize badge on startup
chrome.storage.sync.get(['enabled']).then(result => {
  updateBadge(result.enabled !== false);
});
